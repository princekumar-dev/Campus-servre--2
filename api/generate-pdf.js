import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, PurchaseOrder } from '../models.js'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { createPoQrToken } from '../lib/poQrToken.js'

const LOGO_PATH = (() => {
  const logoPath = path.resolve(process.cwd(), 'public', 'images', 'mseclogo.png')
  return fs.existsSync(logoPath) ? logoPath : null
})()

const PDF = {
  purple: '#5b21b6', darkPurple: '#4c1d95', indigo: '#312e81',
  ink: '#172033', text: '#334155', muted: '#64748b',
  border: '#dbe3ee', soft: '#f5f3ff', stripe: '#f8fafc', white: '#ffffff'
}

const money = value => `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dateText = value => value ? new Date(value).toLocaleDateString('en-IN') : 'Not specified'

function getPublicBaseUrl(req) {
  const configured = process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL
  if (configured) return configured.replace(/\/+$/, '')
  const protocol = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0]
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0]
  return `${protocol}://${host}`.replace(/\/+$/, '')
}

function drawInstitutionHeader(doc, title, reference = '') {
  const left = doc.page.margins.left
  const right = doc.page.width - doc.page.margins.right
  const width = right - left
  const top = 42
  if (LOGO_PATH) doc.image(LOGO_PATH, left, top, { fit: [66, 72], align: 'center', valign: 'center' })
  const textX = left + (LOGO_PATH ? 78 : 0)
  const textWidth = width - (LOGO_PATH ? 78 : 0)
  doc.fillColor(PDF.darkPurple).font('Helvetica-Bold').fontSize(15)
    .text('MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE', textX, top + 2, { width: textWidth, align: 'center' })
  doc.fillColor(PDF.text).font('Helvetica-Bold').fontSize(10)
    .text('MSEC CampusServe', textX, top + 24, { width: textWidth, align: 'center' })
  doc.fillColor(PDF.muted).font('Helvetica').fontSize(8)
    .text('College Maintenance & Service Operations Portal', textX, top + 40, { width: textWidth, align: 'center' })
  doc.fillColor(PDF.purple).font('Helvetica-Bold').fontSize(12)
    .text(title.toUpperCase(), textX, top + 55, { width: textWidth, align: 'center' })
  if (reference) doc.fillColor(PDF.muted).font('Helvetica').fontSize(7.5)
    .text(reference, textX, top + 70, { width: textWidth, align: 'center' })
  const lineY = reference ? 126 : 116
  doc.strokeColor(PDF.purple).lineWidth(1.5).moveTo(left, lineY).lineTo(right, lineY).stroke()
  doc.y = lineY + 16
}

function drawSectionTitle(doc, title) {
  const left = doc.page.margins.left
  const width = doc.page.width - left - doc.page.margins.right
  const y = doc.y
  doc.roundedRect(left, y, width, 23, 3).fill(PDF.soft)
  doc.fillColor(PDF.darkPurple).font('Helvetica-Bold').fontSize(8.5)
    .text(title.toUpperCase(), left + 9, y + 7, { characterSpacing: 0.6 })
  doc.y = y + 31
}

function drawMetadata(doc, rows) {
  const left = doc.page.margins.left
  const width = doc.page.width - left - doc.page.margins.right
  const labelWidth = 126
  rows.filter(row => row && row[1] !== undefined && row[1] !== null && row[1] !== '').forEach(([label, value], index) => {
    const y = doc.y
    const valueText = String(value || 'N/A')
    const rowHeight = Math.max(25, doc.heightOfString(valueText, { width: width - labelWidth - 18 }) + 12)
    doc.rect(left, y, width, rowHeight).fill(index % 2 ? PDF.white : PDF.stripe).stroke(PDF.border)
    doc.fillColor(PDF.muted).font('Helvetica-Bold').fontSize(7.5).text(label.toUpperCase(), left + 8, y + 8, { width: labelWidth - 12 })
    doc.fillColor(PDF.ink).font('Helvetica').fontSize(8.5).text(valueText, left + labelWidth, y + 7, { width: width - labelWidth - 8 })
    doc.y = y + rowHeight
  })
  doc.moveDown(0.8)
}

function drawTable(doc, headers, rows, widths, repeatHeader) {
  const left = doc.page.margins.left
  const tableWidth = widths.reduce((sum, value) => sum + value, 0)
  const header = () => {
    const y = doc.y
    doc.rect(left, y, tableWidth, 26).fill(PDF.indigo)
    let x = left
    headers.forEach((label, index) => {
      doc.fillColor(PDF.white).font('Helvetica-Bold').fontSize(7.2)
        .text(label, x + 5, y + 8, { width: widths[index] - 10, align: index > 1 ? 'right' : 'left' })
      x += widths[index]
    })
    doc.y = y + 26
  }
  header()
  rows.forEach((row, rowIndex) => {
    const heights = row.map((value, index) => doc.heightOfString(String(value ?? ''), { width: widths[index] - 10 }))
    const rowHeight = Math.max(28, ...heights) + 10
    if (doc.y + rowHeight > 752) {
      doc.addPage()
      repeatHeader()
      header()
    }
    const y = doc.y
    doc.rect(left, y, tableWidth, rowHeight).fill(rowIndex % 2 ? PDF.stripe : PDF.white).stroke(PDF.border)
    let x = left
    row.forEach((value, index) => {
      doc.fillColor(PDF.text).font(index === 1 ? 'Helvetica' : 'Helvetica-Bold').fontSize(7.5)
        .text(String(value ?? ''), x + 5, y + 8, { width: widths[index] - 10, align: index > 1 ? 'right' : 'left' })
      x += widths[index]
    })
    doc.y = y + rowHeight
  })
  doc.moveDown(0.8)
}

function drawTotals(doc, values) {
  const x = doc.page.width - doc.page.margins.right - 215
  values.filter(item => item && item[1] !== undefined).forEach(([label, value, strong]) => {
    if (strong) {
      const y = doc.y + 3
      doc.roundedRect(x, y, 215, 30, 4).fill(PDF.purple)
      doc.fillColor(PDF.white).font('Helvetica-Bold').fontSize(10).text(label, x + 10, y + 9)
      doc.text(value, x + 105, y + 9, { width: 100, align: 'right' })
      doc.y = y + 38
    } else {
      const y = doc.y
      doc.fillColor(PDF.muted).font('Helvetica').fontSize(8.5).text(label, x + 8, y, { width: 100 })
      doc.fillColor(PDF.ink).font('Helvetica-Bold').text(value, x + 108, y, { width: 99, align: 'right' })
      doc.y = y + 17
    }
  })
}

function addPageFooters(doc) {
  const pages = doc.bufferedPageRange()
  const left = doc.page.margins.left
  const right = doc.page.width - doc.page.margins.right
  for (let page = pages.start; page < pages.start + pages.count; page++) {
    doc.switchToPage(page)
    // Keep the footer inside PDFKit's printable area. Drawing text below the
    // bottom margin makes PDFKit add a new overflow page for every footer.
    const footerY = doc.page.height - doc.page.margins.bottom - 12
    doc.strokeColor(PDF.border).lineWidth(0.7).moveTo(left, footerY - 6).lineTo(right, footerY - 6).stroke()
    doc.fillColor(PDF.muted).font('Helvetica').fontSize(7)
      .text('System-generated official document | MSEC CampusServe', left, footerY, { width: 360, lineBreak: false })
    doc.text(`Page ${page + 1} of ${pages.count}`, right - 100, footerY, { width: 100, align: 'right', lineBreak: false })
  }
}

async function loadEvidenceImage(url) {
  try {
    let input
    if (/^data:image\/(jpeg|png|webp);base64,/.test(url || '')) {
      input = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
    } else if (/^https?:\/\//.test(url || '')) {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) return null
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength > 10 * 1024 * 1024) return null
      input = Buffer.from(bytes)
    } else return null
    // PDFKit accepts JPEG/PNG; normalize WEBP and camera formats safely.
    const buffer = await sharp(input).rotate().jpeg({ quality: 82 }).toBuffer()
    // Validate the image has actual content (check size and dimensions)
    if (buffer.length < 1024) {
      return null
    }
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height || metadata.width < 10 || metadata.height < 10) {
      return null
    }
    return buffer
  } catch (error) {
    console.warn('Skipping unreadable PO evidence image:', error.message)
    return null
  }
}

function renderServiceDocument(res, type, request) {
  const config = {
    quotation: request.quotation && {
      title: 'Quotation Estimate', reference: request.quotation.quotationNumber,
      metadata: [
        ['Request reference', request.requestNumber], ['Subject', request.title],
        ['Requester', `${request.requesterName || 'N/A'} (${request.requesterEmail || 'N/A'})`],
        ['Department / Category', request.department || request.category], ['Location', request.location],
        ['Valid until', dateText(request.quotation.validUntil)], ['Created by', request.quotation.createdBy || 'Service Manager']
      ],
      headers: ['#', 'Description', 'Qty', 'Unit price', 'Tax', 'Amount'], widths: [28, 202, 48, 78, 52, 87],
      rows: (request.quotation.items || []).map((item, index) => [index + 1, item.description, item.quantity, money(item.unitPrice), `${Number(item.taxRate || 0)}%`, money(item.lineTotal)]),
      totals: [['Subtotal', money(request.quotation.subtotal)], ['Discount', `- ${money(request.quotation.discountTotal)}`], ['GST / Tax', money(request.quotation.taxTotal)], ['GRAND TOTAL', money(request.quotation.grandTotal), true]],
      note: 'This estimate is valid only for the period stated above and is subject to institutional approval.'
    },
    workorder: request.workOrder && {
      title: 'Work Order', reference: request.workOrder.workOrderNumber,
      metadata: [
        ['Request reference', request.requestNumber], ['Subject', request.title],
        ['Assigned technician', request.workOrder.technicianName || 'External Vendor'],
        ['External vendor', request.workOrder.vendorName],
        ['Start date', dateText(request.workOrder.startDate)], ['Due date', dateText(request.workOrder.dueDate)],
        ['Approved budget', money(request.workOrder.approvedAmount)]
      ],
      scope: request.workOrder.scope || request.description,
      note: 'Wear appropriate PPE, isolate electrical supplies where applicable, and record all material usage and progress updates.'
    },
    invoice: request.invoice && {
      title: 'Final Service Invoice', reference: request.invoice.invoiceNumber,
      metadata: [
        ['Request reference', request.requestNumber], ['Subject', request.title],
        ['Service provider', 'Campus Maintenance Department'],
        ['Requester', `${request.requesterName || 'N/A'} (${request.requesterEmail || 'N/A'})`],
        ['Created by', request.invoice.createdBy || 'Service Manager'], ['Invoice date', dateText(request.invoice.createdAt || request.updatedAt)]
      ],
      headers: ['#', 'Description', 'Qty', 'Unit price', 'Amount'], widths: [28, 246, 52, 82, 87],
      rows: (request.invoice.items || []).map((item, index) => [index + 1, item.description, item.quantity, money(item.unitPrice), money(item.lineTotal)]),
      totals: [['Subtotal', money(request.invoice.subtotal)], ['Discount', `- ${money(request.invoice.discountTotal)}`], ['GST / Tax', money(request.invoice.taxTotal)], ['GRAND TOTAL', money(request.invoice.grandTotal), true]],
      note: 'Invoice generated under institutional guidelines and submitted for payment settlement.'
    },
    receipt: (() => {
      const payment = request.payments?.length ? request.payments[request.payments.length - 1] : null
      if (!payment) return null
      return {
        title: 'Official Payment Receipt', reference: payment.paymentNumber,
        metadata: [
          ['Payment reference', payment.paymentNumber], ['Invoice reference', request.invoice?.invoiceNumber || 'N/A'],
          ['Request reference', request.requestNumber], ['Paid at', payment.paidAt ? new Date(payment.paidAt).toLocaleString('en-IN') : 'N/A'],
          ['Payment method', payment.method], ['Transaction reference', payment.referenceNumber],
          ['Amount settled', money(payment.amount)], ['Remaining balance', money(request.invoice?.balanceDue)],
          ['Recorded by', payment.recordedBy || 'Accounts Officer']
        ],
        scopeTitle: 'Payment notes', scope: payment.notes || 'Payment received and recorded successfully.',
        note: 'This system-generated receipt acknowledges receipt of funds.'
      }
    })()
  }[type]

  if (!['quotation', 'workorder', 'invoice', 'receipt'].includes(type)) {
    return res.status(400).json({ success: false, error: 'Unsupported document type' })
  }
  if (!config) return res.status(404).json({ success: false, error: `No ${type} is available for this request yet` })

  const filename = `${config.reference || `${type}-${request._id}`}.pdf`.replace(/[^a-z0-9._-]/gi, '-')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: {
    Title: `${config.title} ${config.reference || ''}`.trim(), Author: 'MSEC CampusServe', Subject: request.title || config.title
  } })
  doc.pipe(res)
  const repeatHeader = () => drawInstitutionHeader(doc, config.title, config.reference)
  repeatHeader()
  drawSectionTitle(doc, 'Document information')
  drawMetadata(doc, config.metadata)
  if (config.rows) {
    drawSectionTitle(doc, type === 'quotation' ? 'Quotation items' : 'Service items')
    drawTable(doc, config.headers, config.rows, config.widths, repeatHeader)
    drawTotals(doc, config.totals)
    doc.moveDown(0.7)
  }
  if (config.scope) {
    if (doc.y > 680) { doc.addPage(); repeatHeader() }
    drawSectionTitle(doc, config.scopeTitle || 'Scope of work')
    doc.fillColor(PDF.text).font('Helvetica').fontSize(9).text(String(config.scope), { lineGap: 3 })
    doc.moveDown(1)
  }
  if (config.note) {
    if (doc.y > 700) { doc.addPage(); repeatHeader() }
    drawSectionTitle(doc, type === 'workorder' ? 'Safety and operational instructions' : 'Terms and notes')
    doc.fillColor(PDF.text).font('Helvetica').fontSize(8.5).text(config.note, { lineGap: 3 })
  }
  const signatureY = Math.min(Math.max(doc.y + 42, 680), 748)
  const left = doc.page.margins.left
  const right = doc.page.width - doc.page.margins.right
  doc.strokeColor(PDF.border).moveTo(left, signatureY).lineTo(left + 150, signatureY).stroke()
  doc.moveTo(right - 150, signatureY).lineTo(right, signatureY).stroke()
  doc.fillColor(PDF.muted).font('Helvetica').fontSize(7.5).text('Prepared / recorded by', left, signatureY + 7, { width: 150, align: 'center' })
  doc.text('Authorized signatory', right - 150, signatureY + 7, { width: 150, align: 'center' })
  addPageFooters(doc)
  doc.end()
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  // PDFs must always reflect the current institutional template and source data.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')
  res.setHeader('X-CampusServe-PDF-Template', 'academics-marksheet-v2')

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in generate-pdf API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const { type, id } = req.query

  if (!id || !type) {
    return res.status(400).json({ success: false, error: 'Request ID and document type are required' })
  }

  try {
    if (type === 'purchase-order') {
      const po = await PurchaseOrder.findById(id).lean()
      if (!po) return res.status(404).json({ success: false, error: 'Purchase Order not found' })
      const poQrToken = createPoQrToken(po._id)
      const gateVerificationUrl = `${getPublicBaseUrl(req)}/gate/po/${po._id}?token=${encodeURIComponent(poQrToken)}`
      const gateQrImage = await QRCode.toBuffer(gateVerificationUrl, {
        type: 'png',
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M'
      })
      const linkedRequest = po.requestId ? await ServiceRequest.findById(po.requestId).lean() : null
      const photoEvidence = (linkedRequest?.evidence || []).filter(item => {
        const url = item.url || ''
        if (!url || url.length < 20) return false
        if (/^data:image\/(jpeg|png|webp);base64,/.test(url)) {
          return url.length > 50
        }
        if (/^https?:\/\//.test(url)) {
          return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(url) || url.includes('image')
        }
        return false
      })
      const attachedImages = []
      for (const evidence of photoEvidence) {
        const image = await loadEvidenceImage(evidence.url)
        if (image) attachedImages.push({ evidence, image })
      }

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${po.poNumber}.pdf"`)
      const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: {
        Title: `Purchase Order ${po.poNumber}`,
        Author: 'MSEC CampusServe',
        Subject: linkedRequest ? `Purchase order for ${linkedRequest.requestNumber}` : 'Official purchase order'
      } })
      doc.pipe(res)

      const left = 42, right = 553, width = right - left
      const sectionTitle = title => {
        const y = doc.y
        doc.roundedRect(left, y, width, 24, 4).fill('#f5f3ff')
        doc.rect(left, y, 4, 24).fill(PDF.purple)
        doc.fillColor(PDF.darkPurple).font('Helvetica-Bold').fontSize(9)
          .text(title.toUpperCase(), left + 13, y + 8, { characterSpacing: 0.45 })
        doc.y = y + 32
      }
      const field = (label, value, x, y, fieldWidth = 245) => {
        const previousY = doc.y
        const labelWidth = Math.min(100, fieldWidth * 0.41)
        doc.fillColor(PDF.muted).font('Helvetica-Bold').fontSize(7.2)
          .text(label.toUpperCase(), x, y, { width: labelWidth, characterSpacing: 0.25 })
        doc.fillColor(PDF.ink).font('Helvetica-Bold').fontSize(8.5)
          .text(String(value || 'N/A'), x + labelWidth, y - 1, { width: fieldWidth - labelWidth })
        doc.y = previousY
      }
      const drawHeader = subtitle => {
        const headerTop = 42
        const logoWidth = 64
        const logoHeight = 70
        const textX = left + logoWidth + 14
        const qrSize = 58
        const textWidth = width - logoWidth - qrSize - 24
        if (LOGO_PATH) doc.image(LOGO_PATH, left, headerTop, { width: logoWidth, height: logoHeight })
        doc.image(gateQrImage, right - qrSize, headerTop, { width: qrSize, height: qrSize })
        doc.fillColor(PDF.muted).font('Helvetica-Bold').fontSize(5.5)
          .text('GATE VERIFY', right - qrSize, headerTop + qrSize + 2, { width: qrSize, align: 'center', lineBreak: false })
        doc.fillColor(PDF.ink).font('Helvetica-Bold').fontSize(13)
          .text('MEENAKSHI SUNDARARAJAN ENGINEERING COLLEGE', textX, headerTop + 2, { width: textWidth, align: 'center' })
        doc.fillColor(PDF.muted).font('Helvetica').fontSize(7.5)
          .text('AN AUTONOMOUS INSTITUTION AFFILIATED TO ANNA UNIVERSITY', textX, headerTop + 22, { width: textWidth, align: 'center' })
        doc.text('363, Arcot Road, Kodambakkam, Chennai - 600024', textX, headerTop + 35, { width: textWidth, align: 'center' })
        doc.fillColor(PDF.purple).font('Helvetica-Bold').fontSize(9)
          .text('MSEC CAMPUSSERVE', textX, headerTop + 50, { width: textWidth, align: 'center', characterSpacing: 0.6 })
        doc.roundedRect(textX + 112, headerTop + 65, textWidth - 224, 22, 4).fill(PDF.purple)
        doc.fillColor(PDF.white).fontSize(9).text(subtitle, textX + 112, headerTop + 72, { width: textWidth - 224, align: 'center', characterSpacing: 0.5 })
        doc.strokeColor(PDF.purple).lineWidth(1.2).moveTo(left, headerTop + 98).lineTo(right, headerTop + 98).stroke()
        doc.y = headerTop + 110
      }

      drawHeader('PURCHASE ORDER')
      const summaryY = doc.y
      doc.roundedRect(left, summaryY, width, 58, 5).fillAndStroke(PDF.stripe, PDF.border)
      doc.strokeColor(PDF.border).moveTo(297.5, summaryY + 8).lineTo(297.5, summaryY + 50).stroke()
      field('PO Number', po.poNumber, left + 12, summaryY + 11, 230)
      field('Issue Date', dateText(po.createdAt), 310, summaryY + 11, 230)
      field('Request Reference', linkedRequest?.requestNumber || 'Direct purchase', left + 12, summaryY + 35, 230)
      field('Expected Delivery', dateText(po.expectedDeliveryDate), 310, summaryY + 35, 230)
      doc.y = summaryY + 70

      sectionTitle('Vendor and delivery information')
      const detailsY = doc.y
      doc.roundedRect(left, detailsY, 247, 65, 5).fillAndStroke(PDF.white, PDF.border)
      doc.roundedRect(306, detailsY, 247, 65, 5).fillAndStroke(PDF.white, PDF.border)
      field('Vendor', po.vendorName, left + 10, detailsY + 12, 227)
      field('Email', po.vendorEmail || 'N/A', left + 10, detailsY + 40, 227)
      field('Deliver To', po.deliveryAddress, 316, detailsY + 12, 227)
      field('Location', po.deliveryLocation || linkedRequest?.location || 'MSEC Campus', 316, detailsY + 40, 227)
      doc.y = detailsY + 77

      sectionTitle('Order items')
      const columns = [left, left + 28, left + 250, left + 305, left + 380, left + 440]
      const widths = [28, 222, 55, 75, 60, 71]
      const drawTableHeader = () => {
        const y = doc.y
        doc.rect(left, y, width, 30).fillAndStroke(PDF.indigo, PDF.indigo)
        ;['#', 'Description / Specification', 'Qty', 'Unit Price', 'Tax', 'Amount'].forEach((label, i) =>
          doc.fillColor(PDF.white).font('Helvetica-Bold').fontSize(7.5).text(label, columns[i] + 4, y + 10, { width: widths[i] - 8, align: i >= 2 ? 'right' : 'left' })
        )
        columns.slice(1).forEach(x => doc.strokeColor('#58549a').lineWidth(0.5).moveTo(x, y).lineTo(x, y + 30).stroke())
        doc.y = y + 30
      }
      drawTableHeader()
      ;(po.items || []).forEach((item, index) => {
        const description = [item.description, item.specification, item.brand, item.model].filter(Boolean).join(' | ')
        const rowHeight = Math.max(34, doc.heightOfString(description, { width: widths[1] - 10 }) + 14)
        if (doc.y + rowHeight > 720) {
          doc.addPage(); drawHeader('PURCHASE ORDER'); drawTableHeader()
        }
        const y = doc.y
        doc.rect(left, y, width, rowHeight).fillAndStroke(index % 2 ? PDF.stripe : PDF.white, PDF.border)
        columns.slice(1).forEach(x => doc.strokeColor(PDF.border).lineWidth(0.5).moveTo(x, y).lineTo(x, y + rowHeight).stroke())
        const values = [String(index + 1), description, `${item.quantityOrdered} ${item.unit}`, money(item.unitPrice), `${Number(item.taxRate || 0)}%`, money(item.lineTotal)]
        values.forEach((value, i) => doc.fillColor(PDF.text).font(i === 1 ? 'Helvetica' : 'Helvetica-Bold').fontSize(8)
          .text(value, columns[i] + 4, y + 9, { width: widths[i] - 8, align: i >= 2 ? 'right' : 'left' }))
        doc.y = y + rowHeight
      })

      if (doc.y > 650) { doc.addPage(); drawHeader('PURCHASE ORDER - SUMMARY') }
      const totalsY = doc.y + 10
      const totalX = 340
      doc.roundedRect(totalX, totalsY, 213, 107, 5).fillAndStroke(PDF.stripe, PDF.border)
      ;[
        ['Subtotal', money(po.subtotal)],
        ['Discount', `- ${money(po.discountTotal)}`],
        ['GST / Tax', money(po.taxTotal)],
        ['Delivery', money(po.deliveryCharge)]
      ].forEach(([label, value], index) => {
        const rowY = totalsY + 11 + (index * 17)
        doc.fillColor(PDF.muted).font('Helvetica').fontSize(8).text(label, totalX + 12, rowY, { width: 92 })
        doc.fillColor(PDF.ink).font('Helvetica-Bold').text(value, totalX + 108, rowY, { width: 92, align: 'right' })
      })
      const grandTotalY = totalsY + 76
      doc.roundedRect(totalX + 6, grandTotalY, 201, 25, 4).fill(PDF.purple)
      doc.fillColor(PDF.white).font('Helvetica-Bold').fontSize(9).text('GRAND TOTAL', totalX + 16, grandTotalY + 8)
      doc.text(money(po.grandTotal), totalX + 108, grandTotalY + 8, { width: 88, align: 'right' })
      doc.y = totalsY + 119

      sectionTitle('Commercial terms')
      const termsY = doc.y
      doc.roundedRect(left, termsY, width, 58, 5).fillAndStroke(PDF.stripe, PDF.border)
      field('Payment', po.paymentTerms || 'Net 30', left + 12, termsY + 11, 240)
      field('Warranty', po.warrantyTerms || 'As per vendor/manufacturer warranty', 306, termsY + 11, 235)
      doc.fillColor(PDF.muted).font('Helvetica-Bold').fontSize(7.2).text('NOTES', left + 12, termsY + 36, { width: 62 })
      doc.fillColor(PDF.text).font('Helvetica').fontSize(7.8).text(po.notes || 'Supply must conform to the specifications and quantities stated in this purchase order.', left + 75, termsY + 35, { width: width - 87, height: 18, ellipsis: true })
      doc.y = termsY + 77
      const signatureY = Math.min(doc.y + 33, 756)
      const signatureWidth = 170
      ;[
        [left + 18, 'Prepared by', 'Purchase Department'],
        [right - signatureWidth - 18, 'Authorized signatory', 'For MSEC']
      ].forEach(([x, label, caption]) => {
        doc.strokeColor(PDF.border).lineWidth(0.8).moveTo(x, signatureY).lineTo(x + signatureWidth, signatureY).stroke()
        doc.fillColor(PDF.ink).font('Helvetica-Bold').fontSize(7.5).text(label, x, signatureY + 7, { width: signatureWidth, align: 'center' })
        doc.fillColor(PDF.muted).font('Helvetica').fontSize(6.8).text(caption, x, signatureY + 19, { width: signatureWidth, align: 'center' })
      })

      attachedImages.forEach(({ evidence, image }, index) => {
        doc.addPage(); drawHeader(`ATTACHED EVIDENCE ${index + 1}`)
        doc.fillColor('#172033').font('Helvetica-Bold').fontSize(12).text(evidence.name || `Request photo ${index + 1}`)
        doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(`${(evidence.kind || 'PHOTO').replace(/_/g, ' ')}${evidence.note ? ` - ${evidence.note}` : ''}`)
        const imageY = doc.y + 15
        doc.roundedRect(left, imageY, width, 560, 5).stroke('#cbd5e1')
        doc.image(image, left + 10, imageY + 10, { fit: [width - 20, 540], align: 'center', valign: 'center' })
      })

      const pages = doc.bufferedPageRange()
      for (let page = pages.start; page < pages.start + pages.count; page++) {
        doc.switchToPage(page)
        // Footer text must remain above the bottom margin or PDFKit will
        // silently append blank overflow pages.
        const footerY = doc.page.height - doc.page.margins.bottom - 12
        doc.strokeColor(PDF.border).lineWidth(0.6).moveTo(left, footerY - 6).lineTo(right, footerY - 6).stroke()
        doc.fillColor(PDF.muted).font('Helvetica').fontSize(7)
          .text(`System-generated official document · ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, left, footerY, { width: 350, lineBreak: false })
        doc.text(`Page ${page + 1} of ${pages.count}`, 450, footerY, { width: 103, align: 'right', lineBreak: false })
      }
      doc.end()
      return
    }
    const request = await ServiceRequest.findById(id).lean()
    if (!request) {
      return res.status(404).json({ success: false, error: 'Service Request not found' })
    }

    // All service documents use the same institutional PDF system as Academics:
    // crest-led header, bordered metadata, proper tables, signatures and page footers.
    return renderServiceDocument(res, type, request)

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${type}-${id}.pdf"`)

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    doc.pipe(res)

    // Common Header Layout
    doc.fillColor('#4c1d95').font('Helvetica-Bold').fontSize(24).text('CAMPUSSERVE PRO', { align: 'center' })
    doc.fillColor('#6b7280').font('Helvetica').fontSize(10).text('College Maintenance & Service Operations Portal', { align: 'center' })
    doc.text('Meenakshi Sundararajan Engineering College, Chennai', { align: 'center' })
    doc.moveDown()
    
    // Draw line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown()

    const labelX = 50
    const valX = 180

    if (type === 'quotation') {
      const q = request.quotation
      if (!q) {
        doc.fillColor('red').fontSize(14).text('No quotation generated for this request yet.', { align: 'center' })
        doc.end()
        return
      }

      // Title
      doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(16).text(`QUOTATION ESTIMATE: ${q.quotationNumber} (v${q.version})`)
      doc.moveDown(0.5)

      // Meta Table
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10)
      doc.text('Request Ref:', labelX, doc.y).font('Helvetica').text(request.requestNumber, valX)
      doc.font('Helvetica-Bold').text('Subject Title:', labelX, doc.y).font('Helvetica').text(request.title, valX)
      doc.font('Helvetica-Bold').text('Requester:', labelX, doc.y).font('Helvetica').text(`${request.requesterName} (${request.requesterEmail})`, valX)
      doc.font('Helvetica-Bold').text('Department & Location:', labelX, doc.y).font('Helvetica').text(`${request.category} - ${request.location}`, valX)
      doc.font('Helvetica-Bold').text('Validity:', labelX, doc.y).font('Helvetica').text(new Date(q.validUntil).toLocaleDateString(), valX)
      doc.font('Helvetica-Bold').text('Created By:', labelX, doc.y).font('Helvetica').text(q.createdBy || 'Service Manager', valX)
      doc.moveDown()

      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Table Header
      doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(10)
      doc.text('Description', 50, doc.y, { width: 220 })
      doc.text('Qty', 270, doc.y - 12, { width: 40, align: 'right' })
      doc.text('Unit Price', 320, doc.y - 12, { width: 70, align: 'right' })
      doc.text('Tax', 400, doc.y - 12, { width: 50, align: 'right' })
      doc.text('Total', 460, doc.y - 12, { width: 80, align: 'right' })
      doc.moveDown(0.5)

      doc.strokeColor('#f3f4f6').moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(0.5)

      // Items
      doc.font('Helvetica').fillColor('#1f2937')
      q.items.forEach(item => {
        const itemY = doc.y
        doc.text(item.description, 50, itemY, { width: 220 })
        doc.text(item.quantity.toString(), 270, itemY, { width: 40, align: 'right' })
        doc.text(`₹${item.unitPrice.toFixed(2)}`, 320, itemY, { width: 70, align: 'right' })
        doc.text(`${item.taxRate}%`, 400, itemY, { width: 50, align: 'right' })
        doc.text(`₹${item.lineTotal.toFixed(2)}`, 460, itemY, { width: 80, align: 'right' })
        doc.moveDown(0.5)
      })

      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Summary
      doc.font('Helvetica-Bold')
      doc.text(`Subtotal:  ₹${q.subtotal.toFixed(2)}`, 380, doc.y, { align: 'right' })
      doc.text(`Tax Total:  ₹${q.taxTotal.toFixed(2)}`, 380, doc.y, { align: 'right' })
      if (q.discountTotal > 0) {
        doc.text(`Discount: -₹${q.discountTotal.toFixed(2)}`, 380, doc.y, { align: 'right' })
      }
      doc.fillColor('#7c3aed').fontSize(12).text(`Grand Total: ₹${q.grandTotal.toFixed(2)}`, 380, doc.y, { align: 'right' })

      doc.moveDown(2)
      doc.fillColor('#9ca3af').fontSize(8).text('This is a computer generated document. Verified and approved digitally.', { align: 'center' })
    } 
    
    else if (type === 'workorder') {
      const w = request.workOrder
      if (!w) {
        doc.fillColor('red').fontSize(14).text('No work order raised for this request yet.', { align: 'center' })
        doc.end()
        return
      }

      // Title
      doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(16).text(`WORK ORDER: ${w.workOrderNumber}`)
      doc.moveDown(0.5)

      // Meta Table
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10)
      doc.text('Request Ref:', labelX, doc.y).font('Helvetica').text(request.requestNumber, valX)
      doc.font('Helvetica-Bold').text('Subject Title:', labelX, doc.y).font('Helvetica').text(request.title, valX)
      doc.font('Helvetica-Bold').text('Assigned Technician:', labelX, doc.y).font('Helvetica').text(w.technicianName || 'External Vendor', valX)
      if (w.vendorName) {
        doc.font('Helvetica-Bold').text('External Vendor:', labelX, doc.y).font('Helvetica').text(w.vendorName, valX)
      }
      doc.font('Helvetica-Bold').text('Dates:', labelX, doc.y).font('Helvetica').text(`Start: ${new Date(w.startDate).toLocaleDateString()} | Due: ${new Date(w.dueDate).toLocaleDateString()}`, valX)
      doc.font('Helvetica-Bold').text('Approved Budget:', labelX, doc.y).font('Helvetica').text(`₹${w.approvedAmount.toFixed(2)}`, valX)
      doc.moveDown()

      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(11).text('Scope of Work:')
      doc.font('Helvetica').fillColor('#1f2937').fontSize(10).text(w.scope || request.description)
      doc.moveDown()

      // Safety Instructions
      doc.fillColor('#b45309').font('Helvetica-Bold').fontSize(11).text('Safety and Operational Instructions:')
      doc.font('Helvetica').fillColor('#1f2937').fontSize(10).text('1. Wear appropriate protection equipment (PPE) before commencing work.\n2. In case of electrical tasks, verify lines are powered off and locked.\n3. Log any material usage and post progress updates live.')
      
      doc.moveDown(2)
      doc.fillColor('#9ca3af').fontSize(8).text('Authorized and dispatched dynamically. Standard SLAs apply.', { align: 'center' })
    } 
    
    else if (type === 'invoice') {
      const inv = request.invoice
      if (!inv) {
        doc.fillColor('red').fontSize(14).text('No invoice created for this request yet.', { align: 'center' })
        doc.end()
        return
      }

      // Title
      doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(16).text(`FINAL SERVICE INVOICE: ${inv.invoiceNumber}`)
      doc.moveDown(0.5)

      // Meta Table
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10)
      doc.text('Request Ref:', labelX, doc.y).font('Helvetica').text(request.requestNumber, valX)
      doc.font('Helvetica-Bold').text('Subject Title:', labelX, doc.y).font('Helvetica').text(request.title, valX)
      doc.font('Helvetica-Bold').text('Service Provider:', labelX, doc.y).font('Helvetica').text('Campus Maintenance Department', valX)
      doc.font('Helvetica-Bold').text('Requester:', labelX, doc.y).font('Helvetica').text(`${request.requesterName} (${request.requesterEmail})`, valX)
      doc.font('Helvetica-Bold').text('Created By:', labelX, doc.y).font('Helvetica').text(inv.createdBy || 'Service Manager', valX)
      doc.moveDown()

      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Table Header
      doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(10)
      doc.text('Description', 50, doc.y, { width: 260 })
      doc.text('Qty', 310, doc.y - 12, { width: 40, align: 'right' })
      doc.text('Unit Price', 360, doc.y - 12, { width: 80, align: 'right' })
      doc.text('Total', 450, doc.y - 12, { width: 90, align: 'right' })
      doc.moveDown(0.5)

      doc.strokeColor('#f3f4f6').moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(0.5)

      // Items
      doc.font('Helvetica').fillColor('#1f2937')
      inv.items.forEach(item => {
        const itemY = doc.y
        doc.text(item.description, 50, itemY, { width: 260 })
        doc.text(item.quantity.toString(), 310, itemY, { width: 40, align: 'right' })
        doc.text(`₹${item.unitPrice.toFixed(2)}`, 360, itemY, { width: 80, align: 'right' })
        doc.text(`₹${item.lineTotal.toFixed(2)}`, 450, itemY, { width: 90, align: 'right' })
        doc.moveDown(0.5)
      })

      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      // Summary
      doc.font('Helvetica-Bold')
      doc.text(`Subtotal:  ₹${inv.subtotal.toFixed(2)}`, 380, doc.y, { align: 'right' })
      doc.text(`Tax Total:  ₹${inv.taxTotal.toFixed(2)}`, 380, doc.y, { align: 'right' })
      if (inv.discountTotal > 0) {
        doc.text(`Discount: -₹${inv.discountTotal.toFixed(2)}`, 380, doc.y, { align: 'right' })
      }
      doc.fillColor('#7c3aed').fontSize(12).text(`Grand Total: ₹${inv.grandTotal.toFixed(2)}`, 380, doc.y, { align: 'right' })

      doc.moveDown(2)
      doc.fillColor('#9ca3af').fontSize(8).text('Invoice generated under institutional guidelines. Approved for payment settlement.', { align: 'center' })
    } 
    
    else if (type === 'receipt') {
      const lastPayment = request.payments && request.payments.length > 0 ? request.payments[request.payments.length - 1] : null
      if (!lastPayment) {
        doc.fillColor('red').fontSize(14).text('No payment has been recorded for this invoice yet.', { align: 'center' })
        doc.end()
        return
      }

      // Title
      doc.fillColor('#7c3aed').font('Helvetica-Bold').fontSize(16).text(`OFFICIAL PAYMENT RECEIPT: REC-${lastPayment.paymentNumber.split('-')[2]}`)
      doc.moveDown(0.5)

      // Meta Table
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10)
      doc.text('Payment Ref:', labelX, doc.y).font('Helvetica').text(lastPayment.paymentNumber, valX)
      doc.font('Helvetica-Bold').text('Invoice Ref:', labelX, doc.y).font('Helvetica').text(request.invoice ? request.invoice.invoiceNumber : 'N/A', valX)
      doc.font('Helvetica-Bold').text('Request Ref:', labelX, doc.y).font('Helvetica').text(request.requestNumber, valX)
      doc.font('Helvetica-Bold').text('Paid At:', labelX, doc.y).font('Helvetica').text(new Date(lastPayment.paidAt).toLocaleString(), valX)
      doc.font('Helvetica-Bold').text('Payment Method:', labelX, doc.y).font('Helvetica').text(lastPayment.method, valX)
      if (lastPayment.referenceNumber) {
        doc.font('Helvetica-Bold').text('Transaction Ref:', labelX, doc.y).font('Helvetica').text(lastPayment.referenceNumber, valX)
      }
      doc.font('Helvetica-Bold').text('Amount Settled:', labelX, doc.y).font('Helvetica').fillColor('#059669').text(`₹${lastPayment.amount.toFixed(2)}`, valX)
      doc.fillColor('#374151').font('Helvetica-Bold').text('Remaining Balance:', labelX, doc.y).font('Helvetica').text(`₹${request.invoice ? request.invoice.balanceDue.toFixed(2) : '0.00'}`, valX)
      doc.font('Helvetica-Bold').text('Recorded By:', labelX, doc.y).font('Helvetica').text(lastPayment.recordedBy || 'Accounts Officer', valX)
      doc.moveDown()

      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown()

      doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(11).text('Payment Notes:')
      doc.font('Helvetica').fillColor('#1f2937').fontSize(10).text(lastPayment.notes || 'No payment description notes added.')

      doc.moveDown(3)
      doc.fillColor('#9ca3af').fontSize(8).text('This is a system generated transaction receipt acknowledging receipt of funds.', { align: 'center' })
    } 
    
    else {
      doc.fillColor('red').fontSize(14).text('Unsupported document type.', { align: 'center' })
    }

    doc.end()

  } catch (error) {
    console.error('Error generating PDF:', error)
    return res.status(500).json({ success: false, error: 'Internal server error rendering PDF' })
  }
}
