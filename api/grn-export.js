import PDFDocument from 'pdfkit'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectToDatabase } from '../lib/mongo.js'
import { GoodsReceipt, PurchaseOrder } from '../models.js'

const money = value => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const date = value => value ? new Date(value).toLocaleDateString('en-IN') : '—'
const safeName = value => String(value || 'report').replace(/[^a-z0-9._-]+/gi, '-')
const statusLabel = value => String(value || 'UNKNOWN').replace(/_/g, ' ').toUpperCase()
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const crestPath = path.join(moduleDir, '..', 'public', 'images', 'mseclogo.png')

function collectPdf(draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    draw(doc)
    doc.end()
  })
}

function header(doc, title, subtitle) {
  doc.roundedRect(42, 38, 511, 72, 10).fill('#6d28d9')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('MSEC CampusServe', 62, 57)
  doc.font('Helvetica').fontSize(9).text(title, 62, 84)
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text(subtitle, 42, 126, { width: 511 })
  doc.y = 154
}

function section(doc, title) {
  if (doc.y > 720) doc.addPage()
  doc.y += 10
  doc.fillColor('#6d28d9').font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), 42, doc.y, { width: 511 })
  doc.y += 4
  doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#ddd6fe').stroke()
  doc.y += 10
}

function row(doc, label, value, x = 42, width = 511) {
  const y = doc.y
  doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(8).text(label.toUpperCase(), x, y, { width: width * 0.32 })
  doc.fillColor('#0f172a').font('Helvetica').fontSize(9).text(String(value ?? '—'), x + width * 0.32, y, { width: width * 0.68 })
  doc.y = Math.max(doc.y, y + 17)
}

function itemsTable(doc, items = []) {
  const columns = [
    ['Product / Item', 170], ['Ordered', 48], ['Previous', 48], ['Received', 52],
    ['Accepted Now / Total', 62], ['Damaged', 43], ['Rejected', 43], ['Remaining', 45]
  ]
  let y = doc.y
  doc.rect(42, y, 511, 22).fill('#ede9fe')
  let x = 42
  columns.forEach(([label, width]) => {
    doc.fillColor('#5b21b6').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x + 4, y + 7, { width: width - 8, align: label === 'Item' ? 'left' : 'right' })
    x += width
  })
  y += 22
  items.forEach((item, index) => {
    if (y > 755) { doc.addPage(); y = 52 }
    if (index % 2 === 0) doc.rect(42, y, 511, 28).fill('#f8fafc')
    x = 42
    const values = [
      `${item.productId || ''} ${item.poItemDescription || ''}`.trim(),
      item.quantityOrdered || 0,
      item.quantityPreviouslyAccepted || 0,
      item.quantityDeliveredNow || 0,
      `${item.quantityAcceptedNow || 0} / ${Number(item.quantityPreviouslyAccepted || 0) + Number(item.quantityAcceptedNow || 0)}`,
      item.quantityDamaged || 0,
      item.quantityRejected || 0,
      item.quantityRemaining || 0
    ]
    columns.forEach(([label, width], column) => {
      doc.fillColor('#334155').font(column === 0 ? 'Helvetica' : 'Helvetica-Bold').fontSize(7.5)
        .text(String(values[column]), x + 4, y + 8, { width: width - 8, align: column === 0 ? 'left' : 'right', ellipsis: true })
      x += width
    })
    y += 28
  })
  doc.y = y
}

async function grnPdf(po, grn) {
  return collectPdf(doc => {
    const items = (grn.items || []).filter(item => Number(item.quantityDeliveredNow || 0) > 0)
    const totals = items.reduce((summary, item) => ({
      ordered: summary.ordered + Number(item.quantityOrdered || 0),
      delivered: summary.delivered + Number(item.quantityDeliveredNow || 0),
      accepted: summary.accepted + Number(item.quantityAcceptedNow || 0),
      damaged: summary.damaged + Number(item.quantityDamaged || 0),
      rejected: summary.rejected + Number(item.quantityRejected || 0),
      remaining: summary.remaining + Number(item.quantityRemaining || 0),
    }), { ordered: 0, delivered: 0, accepted: 0, damaged: 0, rejected: 0, remaining: 0 })
    const poStatus = po?.status || 'UNKNOWN'
    const grnStatus = grn.grnType === 'FINAL' && poStatus === 'CLOSED'
      ? 'FINALIZED'
      : (grn.status || (grn.grnType === 'FINAL' ? 'FINALIZED' : 'DRAFT'))

    const ink = '#111111'
    const gold = '#9a5b00'
    const pale = '#f7f5f1'
    const left = 42
    const width = 511
    const label = (text, x, y, w = 76) => doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(6.5).text(text.toUpperCase(), x, y, { width: w })
    const value = (text, x, y, w) => doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.3).text(String(text || '—'), x, y, { width: w, ellipsis: true })
    const sectionTitle = (text, y) => {
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(8).text(text.toUpperCase(), left, y)
      doc.moveTo(left, y + 13).lineTo(left + width, y + 13).lineWidth(0.7).strokeColor('#374151').stroke()
      doc.moveTo(left, y + 13).lineTo(left + 16, y + 13).lineWidth(2).strokeColor(gold).stroke()
    }

    // Institutional header — mirrors the purchase-order document.
    if (fs.existsSync(crestPath)) doc.image(crestPath, 48, 42, { fit: [62, 62], align: 'center', valign: 'center' })
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(10).text('MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE', 105, 47, { width: 385, align: 'center' })
    doc.font('Helvetica').fontSize(6.2).text('AN AUTONOMOUS INSTITUTION AFFILIATED TO ANNA UNIVERSITY', 105, 62, { width: 385, align: 'center' })
    doc.text('363, Arcot Road, Kodambakkam, Chennai - 600024', 105, 72, { width: 385, align: 'center' })
    doc.font('Helvetica-Bold').fontSize(6.5).text('MSEC CAMPUSSERVE', 105, 82, { width: 385, align: 'center' })
    doc.font('Times-Bold').fontSize(15).text('GOODS RECEIPT NOTE', 105, 96, { width: 385, align: 'center' })
    doc.moveTo(left, 119).lineTo(left + width, 119).lineWidth(1).strokeColor(ink).stroke()
    doc.moveTo(left, 119).lineTo(left + 45, 119).lineWidth(2).strokeColor(gold).stroke()

    // Reference block.
    doc.rect(left, 132, width, 55).fillAndStroke(pale, '#d6d3d1')
    doc.moveTo(296, 132).lineTo(296, 187).lineWidth(0.5).strokeColor('#d6d3d1').stroke()
    label('GRN Number', 54, 140); value(grn.grnNumber, 130, 140, 150)
    label('GRN Date', 54, 156); value(date(grn.receivedAt || grn.createdAt), 130, 156, 150)
    label('GRN Status', 54, 172); value(statusLabel(grnStatus), 130, 172, 150)
    label('PO Number', 308, 140); value(po?.poNumber || grn.poNumber, 378, 140, 160)
    label('PO Status', 308, 156); value(statusLabel(poStatus), 378, 156, 160)
    label('Receipt Type', 308, 172); value(statusLabel(grn.grnType), 378, 172, 160)

    sectionTitle('Vendor and receipt information', 201)
    doc.rect(left, 222, 248, 67).fillAndStroke('#ffffff', '#d6d3d1')
    doc.rect(305, 222, 248, 67).fillAndStroke('#ffffff', '#d6d3d1')
    label('Vendor', 54, 234); value(po?.vendorName, 124, 234, 155)
    label('PO Value', 54, 254); value(money(po?.grandTotal), 124, 254, 155)
    label('Delivery To', 317, 234); value(po?.deliveryLocation, 387, 234, 154)
    label('Received By', 317, 254); value(grn.receivedByName, 387, 254, 154)
    label('Source', 317, 274); value(grn.source === 'PO_QR' ? 'Gate PO QR verified' : 'Manual receipt', 387, 274, 154)

    sectionTitle('Receipt quantity summary', 304)
    const summary = [
      ['Ordered', totals.ordered], ['Previous', items.reduce((s, i) => s + Number(i.quantityPreviouslyAccepted || 0), 0)],
      ['Received Now', totals.delivered], ['Accepted Now', totals.accepted],
      ['Damaged', totals.damaged], ['Rejected', totals.rejected], ['Remaining', totals.remaining]
    ]
    summary.forEach(([name, amount], index) => {
      const cellWidth = 69
      const x = left + index * 73
      doc.rect(x, 325, cellWidth, 39).fillAndStroke('#ffffff', '#d6d3d1')
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(10).text(String(amount), x, 334, { width: cellWidth, align: 'center' })
      doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.3).text(name.toUpperCase(), x, 350, { width: cellWidth, align: 'center' })
    })

    sectionTitle('Items received in this GRN', 379)
    const columns = [
      ['#', 18], ['Product ID / Description', 154], ['Ordered', 48], ['Previous', 48],
      ['Received', 48], ['Accepted', 48], ['Damaged', 43], ['Rejected', 43], ['Remaining', 61]
    ]
    let tableY = 400
    doc.rect(left, tableY, width, 22).fill(ink)
    let tableX = left
    columns.forEach(([name, cellWidth]) => {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(5.5).text(name.toUpperCase(), tableX + 3, tableY + 7, { width: cellWidth - 6, align: name === 'Product ID / Description' ? 'left' : 'center' })
      tableX += cellWidth
    })
    tableY += 22
    items.slice(0, 9).forEach((item, index) => {
      const rowHeight = 22
      if (index % 2 === 0) doc.rect(left, tableY, width, rowHeight).fill('#fafafa')
      const cumulative = Number(item.quantityPreviouslyAccepted || 0) + Number(item.quantityAcceptedNow || 0)
      const cells = [
        index + 1,
        `${item.productId || '—'}\n${item.poItemDescription || ''}`,
        item.quantityOrdered || 0, item.quantityPreviouslyAccepted || 0,
        item.quantityDeliveredNow || 0, `${item.quantityAcceptedNow || 0} (${cumulative})`,
        item.quantityDamaged || 0, item.quantityRejected || 0, item.quantityRemaining || 0
      ]
      tableX = left
      columns.forEach(([name, cellWidth], cellIndex) => {
        doc.fillColor(ink).font(cellIndex === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(cellIndex === 1 ? 5.6 : 6.2)
          .text(String(cells[cellIndex]), tableX + 3, tableY + 5, { width: cellWidth - 6, height: rowHeight - 6, align: cellIndex === 1 ? 'left' : 'center', ellipsis: true })
        tableX += cellWidth
      })
      doc.moveTo(left, tableY + rowHeight).lineTo(left + width, tableY + rowHeight).lineWidth(0.3).strokeColor('#d6d3d1').stroke()
      tableY += rowHeight
    })

    const remarksY = Math.max(535, tableY + 16)
    sectionTitle('Inspection remarks and certification', remarksY)
    doc.rect(left, remarksY + 21, width, 45).fillAndStroke(pale, '#d6d3d1')
    doc.fillColor(ink).font('Helvetica').fontSize(7)
      .text(grn.remarks || 'Goods received and inspected without additional remarks.', left + 10, remarksY + 31, { width: width - 20, height: 28, ellipsis: true })
    doc.fontSize(6.5).text('Certified that the above goods were physically received, inspected and recorded against the referenced purchase order.', left, remarksY + 78, { width })

    const stampY = Math.min(674, remarksY + 106)
    const stampSize = 82
    const stampGap = 44
    const stamps = [
      { title: 'MANAGER VERIFIED', name: po?.signedPo?.uploadedBy || po?.createdBy || 'Purchase Manager', at: po?.signedPo?.uploadedAt || po?.createdAt, color: '#b45309' },
      { title: 'ADMIN VERIFIED', name: po?.signedPo?.verifiedBy || po?.approvedBy || 'MSEC Admin', at: po?.signedPo?.verifiedAt || po?.approvedAt, color: '#2563eb' },
      { title: 'SECRETARY VERIFIED', name: 'MSEC Secretary', at: po?.signedPo?.verifiedAt || po?.approvedAt, color: '#7c3aed' },
      { title: 'GATE RECEIVED', name: grn.receivedByName || 'Gate / Stores', at: grn.receivedAt || grn.createdAt, color: '#059669' }
    ]
    stamps.forEach((stamp, index) => {
      const x = left + 2 + index * (stampSize + stampGap)
      const centerX = x + stampSize / 2
      const centerY = stampY + stampSize / 2
      doc.save().opacity(0.82)
      doc.circle(centerX, centerY, stampSize / 2).lineWidth(1.8).strokeColor(stamp.color).stroke()
      doc.circle(centerX, centerY, stampSize / 2 - 4.5).lineWidth(0.7).strokeColor(stamp.color).stroke()
      doc.moveTo(x + 11, centerY - 9).lineTo(x + stampSize - 11, centerY - 9).lineWidth(0.5).strokeColor(stamp.color).stroke()
      doc.moveTo(x + 11, centerY + 13).lineTo(x + stampSize - 11, centerY + 13).stroke()
      doc.fillColor(stamp.color).font('Helvetica-Bold').fontSize(5.5).text('MSEC CAMPUSSERVE', x + 7, stampY + 12, { width: stampSize - 14, align: 'center' })
      doc.font('Times-Bold').fontSize(7.2).text(stamp.title.replace(' VERIFIED', '').replace(' RECEIVED', ''), x + 7, centerY - 4, { width: stampSize - 14, align: 'center' })
      doc.font('Helvetica-Bold').fontSize(4.7).text(stamp.name, x + 10, centerY + 4, { width: stampSize - 20, align: 'center', ellipsis: true })
      doc.font('Helvetica').fontSize(4.4).text(stamp.at ? new Date(stamp.at).toLocaleDateString('en-IN') : 'VERIFIED', x + 8, centerY + 19, { width: stampSize - 16, align: 'center' })
      doc.restore()
    })

    doc.moveTo(left, 774).lineTo(left + width, 774).lineWidth(0.4).strokeColor('#d6d3d1').stroke()
    doc.fillColor('#4b5563').font('Helvetica').fontSize(5.5)
      .text(`System-generated official GRN · ${new Date().toLocaleString('en-IN')}`, left, 781, { width: 350, lineBreak: false })
      .text(`PO ${po?.poNumber || grn.poNumber} · ${grn.grnNumber}`, 392, 781, { width: 161, align: 'right', lineBreak: false })

    if (items.length > 9) {
      doc.addPage()
      if (fs.existsSync(crestPath)) doc.image(crestPath, 48, 42, { fit: [58, 58] })
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(10)
        .text('MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE', 105, 51, { width: 385, align: 'center' })
      doc.font('Times-Bold').fontSize(14).text('GRN ITEM ANNEXURE', 105, 78, { width: 385, align: 'center' })
      doc.font('Helvetica-Bold').fontSize(7).text(`${grn.grnNumber} · ${po?.poNumber || grn.poNumber}`, left, 112, { width })
      doc.moveTo(left, 126).lineTo(left + width, 126).lineWidth(1).strokeColor(ink).stroke()
      doc.y = 146
      itemsTable(doc, items.slice(9))
      doc.moveTo(left, 774).lineTo(left + width, 774).lineWidth(0.4).strokeColor('#d6d3d1').stroke()
      doc.fillColor('#4b5563').font('Helvetica').fontSize(5.5)
        .text(`Continuation of ${grn.grnNumber} · ${items.length} received products total`, left, 781, { width, lineBreak: false })
    }
  })
}

async function poPdf(po, grns) {
  return collectPdf(doc => {
    header(doc, 'COMPLETED PURCHASE ORDER REPORT', po.poNumber)
    section(doc, 'Purchase order')
    row(doc, 'Vendor', po.vendorName)
    row(doc, 'Status', po.status)
    row(doc, 'Created', date(po.createdAt))
    row(doc, 'Expected delivery', date(po.expectedDeliveryDate))
    row(doc, 'Delivery location', po.deliveryLocation)
    row(doc, 'Grand total', money(po.grandTotal))
    section(doc, `Goods receipts (${grns.length})`)
    grns.forEach(grn => {
      if (doc.y > 735) doc.addPage()
      doc.roundedRect(42, doc.y, 511, 42, 6).fill('#f8fafc')
      const y = doc.y + 9
      doc.fillColor('#5b21b6').font('Helvetica-Bold').fontSize(9).text(grn.grnNumber, 52, y)
      doc.fillColor('#475569').font('Helvetica').fontSize(8)
        .text(`${grn.grnType} · ${grn.status} · ${date(grn.receivedAt || grn.createdAt)} · ${grn.items?.length || 0} items`, 52, y + 16)
      doc.y = y + 42
    })
    section(doc, 'PO items')
    const summaryItems = (po.items || []).map(item => ({
      productId: item.productId,
      poItemDescription: item.description,
      quantityDeliveredNow: item.quantityAccepted || 0,
      quantityAcceptedNow: item.quantityAccepted || 0,
      quantityDamaged: 0,
      quantityRejected: 0,
      quantityRemaining: item.quantityRemaining || 0,
    }))
    itemsTable(doc, summaryItems)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' })
  try {
    const actorRole = req.user?.role || req.headers['x-user-role'] || ''
    if (!['admin', 'super_admin', 'manager', 'receiving_officer', 'accounts', 'vendor'].includes(actorRole)) {
      return res.status(403).json({ success: false, error: 'You are not authorized to export purchase-order receipts' })
    }
    await connectToDatabase()
    const { type, grnId, poId } = req.query
    if (type === 'grn') {
      const grn = await GoodsReceipt.findById(grnId).lean()
      if (!grn) return res.status(404).json({ success: false, error: 'GRN not found' })
      const po = await PurchaseOrder.findById(grn.poId).lean()
      const pdf = await grnPdf(po, grn)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName(grn.grnNumber)}.pdf"`)
      return res.end(pdf)
    }
    if (type === 'po-package') {
      const po = await PurchaseOrder.findById(poId).lean()
      if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' })
      const grns = await GoodsReceipt.find({ poId }).sort({ createdAt: 1 }).lean()
      const zip = new JSZip()
      zip.file(`${safeName(po.poNumber)}-complete-report.pdf`, await poPdf(po, grns))
      const folder = zip.folder('GRNs')
      for (const grn of grns) folder.file(`${safeName(grn.grnNumber)}.pdf`, await grnPdf(po, grn))
      zip.file('README.txt', `${po.poNumber}\nStatus: ${po.status}\nVendor: ${po.vendorName}\nGRNs included: ${grns.length}\nGenerated: ${new Date().toISOString()}\n`)
      const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName(po.poNumber)}-complete.zip"`)
      return res.end(archive)
    }
    return res.status(400).json({ success: false, error: 'Invalid export type' })
  } catch (error) {
    console.error('GRN export error:', error)
    return res.status(500).json({ success: false, error: 'Unable to generate report' })
  }
}
