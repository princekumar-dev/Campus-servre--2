import PDFDocument from 'pdfkit'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { connectToDatabase } from '../lib/mongo.js'
import { GoodsReceipt, PurchaseOrder, ServiceRequest, DeliverySchedule, GateEntry } from '../models.js'
import { getSystemSettings } from '../lib/systemSettings.js'

const money = value => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const roundMoney = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
const date = value => value ? new Date(value).toLocaleDateString('en-IN') : '—'
const dateTime = value => value ? new Date(value).toLocaleString('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata'
}) : '—'
const safeName = value => String(value || 'report').replace(/[^a-z0-9._-]+/gi, '-')
const statusLabel = value => String(value || 'UNKNOWN').replace(/_/g, ' ').toUpperCase()
const INSTITUTION_LOGOS = {
  msec: ['mseclogo.png'],
  nest: ['thenestschoollogo.webp', 'camlogo.webp'],
  mcw: ['mseclogo.webp'],
  mssm: ['mssm.png'],
  iic: ['mseclogo.webp']
}

async function getPdfBrand(institution = 'msec') {
  const settings = await getSystemSettings()
  const profile = settings.institutions?.find(item => item.id === institution)
    || settings.institutions?.find(item => item.id === 'msec')
  const logos = []
  for (const [index, fileName] of (INSTITUTION_LOGOS[institution] || INSTITUTION_LOGOS.msec).entries()) {
    const logoPath = path.resolve(process.cwd(), 'public', 'images', fileName)
    if (!fs.existsSync(logoPath)) continue
    const image = sharp(logoPath)
    if (index > 0) image.trim({ background: '#ffffff' })
    logos.push(await image.png().toBuffer())
  }
  return { id: institution, ...profile, primaryLogo: logos[0] || null, secondaryLogo: logos[1] || null }
}

function institutionHeader(doc, brand, subtitle, { lineY = 119, accent = '#9a5b00', context = '' } = {}) {
  const left = 42
  const width = 511
  const textX = 105
  const textWidth = 385
  if (brand.primaryLogo) doc.image(brand.primaryLogo, 48, 42, { fit: [58, 58], align: 'center', valign: 'center' })
  if (brand.secondaryLogo) doc.image(brand.secondaryLogo, 497, 47, { fit: [48, 48], align: 'center', valign: 'center' })
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10)
    .text(String(brand.fullName || brand.shortName || 'MSEC').toUpperCase(), textX, 47, { width: textWidth, align: 'center', ellipsis: true })
  doc.font('Helvetica').fontSize(6.2)
    .text(String(brand.affiliation || '').toUpperCase(), textX, 62, { width: textWidth, align: 'center', ellipsis: true })
    .text(brand.documentAddress || '', textX, 72, { width: textWidth, align: 'center', ellipsis: true })
  doc.font('Helvetica-Bold').fontSize(6.5)
    .text(`${brand.shortName || 'MSEC'} CAMPUSSERVE${context ? ` · ${context}` : ''}`.toUpperCase(), textX, 82, { width: textWidth, align: 'center', ellipsis: true })
  doc.font('Times-Bold').fontSize(15).text(subtitle, textX, 96, { width: textWidth, align: 'center', ellipsis: true })
  doc.moveTo(left, lineY).lineTo(left + width, lineY).lineWidth(1).strokeColor('#111111').stroke()
  doc.moveTo(left, lineY).lineTo(left + 45, lineY).lineWidth(2).strokeColor(accent).stroke()
}

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
    ['Product / Item', 165], ['Ordered', 46], ['Previous', 48], ['Received', 48],
    ['Accepted\nNow / Total', 65], ['Damaged', 45], ['Rejected', 45], ['Remaining', 49]
  ]
  const drawHeader = y => {
    doc.rect(42, y, 511, 28).fill('#ede9fe')
    let x = 42
    columns.forEach(([label, width], column) => {
      doc.fillColor('#5b21b6').font('Helvetica-Bold').fontSize(6)
        .text(label.toUpperCase(), x + 3, y + 7, { width: width - 6, align: column === 0 ? 'left' : 'center', lineGap: 0 })
      x += width
    })
    return y + 28
  }
  let y = doc.y
  y = drawHeader(y)
  items.forEach((item, index) => {
    const itemText = `${item.productId || ''}${item.poItemDescription ? ` · ${item.poItemDescription}` : ''}\n${money(item.unitPrice)} each · ${money(item.lineTotal)}`.trim()
    doc.font('Helvetica').fontSize(7)
    const rowHeight = Math.max(32, doc.heightOfString(itemText, { width: columns[0][1] - 8 }) + 12)
    if (y + rowHeight > 770) {
      doc.addPage()
      y = drawHeader(52)
    }
    if (index % 2 === 0) doc.rect(42, y, 511, rowHeight).fill('#f8fafc')
    let x = 42
    const values = [
      itemText,
      item.quantityOrdered || 0,
      item.quantityPreviouslyAccepted || 0,
      item.quantityDeliveredNow || 0,
      `${item.quantityAcceptedNow || 0} / ${Number(item.quantityPreviouslyAccepted || 0) + Number(item.quantityAcceptedNow || 0)}`,
      item.quantityDamaged || 0,
      item.quantityRejected || 0,
      item.quantityRemaining || 0
    ]
    columns.forEach(([, width], column) => {
      doc.fillColor('#334155').font(column === 0 ? 'Helvetica' : 'Helvetica-Bold').fontSize(7)
        .text(String(values[column]), x + 4, y + 8, { width: width - 8, align: column === 0 ? 'left' : 'center' })
      x += width
    })
    y += rowHeight
  })
  doc.y = y
}

async function storedImage(url) {
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(url || ''))) return null
  try {
    return await sharp(Buffer.from(url.split(',')[1], 'base64')).rotate().jpeg({ quality: 86 }).toBuffer()
  } catch {
    return null
  }
}

function appendWorkflowAnnexure(doc, po, currentGrn, request, context = {}, brand = {}) {
  const left = 42
  const width = 511
  const ink = '#172033'
  const muted = '#64748b'
  const violet = '#6d28d9'
  const green = '#047857'
  const allGrns = context.allGrns || [currentGrn]
  const deliveries = context.deliveries || []
  const gateEntries = context.gateEntries || []
  const requestHistory = request?.statusHistory || []
  const poHistory = po?.statusHistory || []
  const isService = currentGrn.source === 'SERVICE_PO' || po?.poType === 'SERVICE'
  const accepted = allGrns.reduce((sum, receipt) => sum + (receipt.items || []).reduce((itemSum, item) => itemSum + Number(item.quantityAcceptedNow || 0), 0), 0)
  const ordered = (po?.items || []).reduce((sum, item) => sum + Number(item.quantityOrdered || 0), 0)
  const progress = ordered > 0 ? Math.min(100, Math.round((accepted / ordered) * 100)) : (po?.status === 'CLOSED' ? 100 : 0)

  const addPage = title => {
    doc.addPage()
    institutionHeader(doc, brand, title, { lineY: 122, accent: violet, context: 'COMPLETE AUDIT TRAIL' })
    doc.y = 140
  }
  const ensure = height => { if (doc.y + height > 755) addPage('WORKFLOW AUDIT TRAIL — CONTINUED') }
  const title = text => {
    ensure(40)
    const y = doc.y + 8
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(8.5).text(text.toUpperCase(), left, y)
    doc.moveTo(left, y + 16).lineTo(left + width, y + 16).lineWidth(0.6).strokeColor('#cbd5e1').stroke()
    doc.moveTo(left, y + 16).lineTo(left + 34, y + 16).lineWidth(2).strokeColor(violet).stroke()
    doc.y = y + 27
  }
  const auditRowHeight = description => Math.max(34, doc.heightOfString(String(description || 'Status updated'), { width: 260 }) + 18)
  const auditRow = (when, stage, actor, description, tone = ink) => {
    const descriptionText = String(description || 'Status updated')
    const rowHeight = auditRowHeight(descriptionText)
    ensure(rowHeight + 3)
    const y = doc.y
    doc.rect(left, y, width, rowHeight).fillAndStroke('#ffffff', '#e2e8f0')
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(6.2).text(dateTime(when), left + 8, y + 9, { width: 92 })
    doc.fillColor(tone).font('Helvetica-Bold').fontSize(6.8).text(statusLabel(stage), left + 105, y + 9, { width: 100 })
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(6.5).text(actor || 'CampusServe', left + 210, y + 9, { width: 85, ellipsis: true })
    doc.fillColor('#334155').font('Helvetica').fontSize(6.5).text(descriptionText, left + 300, y + 8, { width: 202, lineGap: 1 })
    doc.y = y + rowHeight
  }

  addPage('PROCUREMENT WORKFLOW RECORD')
  title('Original intent / request')
  const requestRows = [
    ['Request', request?.requestNumber || 'Standalone purchase order'],
    ['Title and description', `${request?.title || po?.adminDescription || 'Purchase requirement'}${request?.description ? ` — ${request.description}` : ''}`],
    ['Requested by', request ? `${request.requesterName || '—'} (${request.requesterEmail || '—'})` : '—'],
    ['Department / location', `${request?.department || request?.category || '—'} · ${request?.location || po?.deliveryLocation || po?.deliveryAddress || '—'}`],
    ['Requirement', `${request?.adminAssessment?.requirementType || po?.adminRequirementType || po?.poType || '—'} · ${request?.requestedQuantity || '—'} ${request?.requestedUnit || ''} ${request?.requestedItem || ''}`],
    ['Admin assessment', `${request?.adminAssessment?.note || po?.adminAssessmentNote || 'No additional assessment note'}${request?.adminAssessment?.assessedBy ? ` · Assessed by ${request.adminAssessment.assessedBy}` : ''}`],
    ['Assigned manager', request?.assignedManagerName || po?.createdBy || 'Purchase Manager'],
    ['Priority / SLA', `${request?.priority || '—'} · SLA ${dateTime(request?.slaDueAt)}`]
  ]
  requestRows.forEach(([labelText, valueText], index) => {
    const h = Math.max(21, doc.heightOfString(String(valueText), { width: 355 }) + 10)
    ensure(h)
    const y = doc.y
    doc.rect(left, y, width, h).fill(index % 2 ? '#ffffff' : '#f8fafc')
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(6.5).text(labelText.toUpperCase(), left + 8, y + 7, { width: 135 })
    doc.fillColor(ink).font('Helvetica').fontSize(7.2).text(String(valueText), left + 148, y + 6, { width: 355 })
    doc.y = y + h
  })

  title('Live stage progress')
  const hasGate = allGrns.some(receipt => receipt.gateVerifiedAt || receipt.source === 'PO_QR') || gateEntries.length > 0
  const stages = [
    ['1', 'Intent raised', Boolean(request), request ? `${request.requestNumber} submitted by ${request.requesterName}` : 'Standalone PO'],
    ['2', 'Reviewed & assigned', Boolean(request?.assignedManagerId || request?.assignedManagerName), request?.adminAssessment?.note || 'Assigned to purchase manager'],
    ['3', 'Purchase order', Boolean(po), `${po?.poNumber} created by ${po?.createdBy || 'Purchase Manager'}`],
    ['4', 'Signed PO active', po?.signedPo?.status === 'VERIFIED', po?.signedPo?.status === 'VERIFIED' ? `Uploaded ${dateTime(po.signedPo.uploadedAt)} by ${po.signedPo.uploadedBy || po.createdBy}` : 'Signed PO not recorded'],
    ['5', isService ? 'Service execution' : 'Gate verification', isService ? ['COMPLETED', 'SUBMITTED'].includes(po?.serviceExecution?.status) : hasGate, isService ? `${statusLabel(po?.serviceExecution?.status)} · ${po?.serviceExecution?.serviceSummary || 'Service progress recorded'}` : (hasGate ? `${allGrns.length} gate receipt verification(s) recorded` : 'Awaiting gate receipt')],
    ['6', 'GRN receiving', allGrns.length > 0, `${allGrns.length} GRN(s) · ${accepted}/${ordered || accepted} accepted · ${progress}% complete`],
    ['7', 'Closure', po?.status === 'CLOSED', po?.status === 'CLOSED' ? 'PO and linked request closed' : `Current PO status: ${statusLabel(po?.status)}`]
  ]
  stages.forEach(([number, name, complete, description]) => {
    ensure(35)
    const y = doc.y
    doc.circle(left + 13, y + 13, 10).fill(complete ? green : '#e2e8f0')
    doc.fillColor(complete ? '#ffffff' : muted).font('Helvetica-Bold').fontSize(7).text(number, left + 7, y + 10, { width: 12, align: 'center' })
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.2).text(name, left + 31, y + 5, { width: 115 })
    doc.fillColor(complete ? green : muted).font('Helvetica-Bold').fontSize(6).text(complete ? 'COMPLETE' : 'PENDING / ACTIVE', left + 148, y + 5, { width: 88 })
    doc.fillColor('#334155').font('Helvetica').fontSize(6.5).text(description, left + 239, y + 4, { width: 264, height: 26, ellipsis: true })
    doc.y = y + 34
  })

  title(`GRN sequence and cumulative receiving (${allGrns.length})`)
  allGrns.forEach((receipt, index) => {
    const receiptAccepted = (receipt.items || []).reduce((sum, item) => sum + Number(item.quantityAcceptedNow || 0), 0)
    const receiptDelivered = (receipt.items || []).reduce((sum, item) => sum + Number(item.quantityDeliveredNow || 0), 0)
    auditRow(receipt.receivedAt || receipt.createdAt, `${index + 1}. ${receipt.grnType}${String(receipt._id) === String(currentGrn._id) ? ' · THIS PDF' : ''}`, receipt.receivedByName, `${receipt.grnNumber} · Delivered ${receiptDelivered}, accepted ${receiptAccepted} · ${money(receipt.grandTotal)} · ${receipt.remarks || 'No additional remarks'}`, receipt.grnType === 'FINAL' ? green : violet)
  })

  const gateVerifiedGrns = !gateEntries.length
    ? allGrns.filter(receipt => receipt.gateVerifiedAt || receipt.source === 'PO_QR')
    : []
  if (deliveries.length || gateEntries.length || gateVerifiedGrns.length) {
    const firstGateDescription = deliveries.length
      ? `${deliveries[0].deliveryNumber} · Vehicle ${deliveries[0].vehicleNumber || '—'} · ${deliveries[0].deliveryLocation || po?.deliveryLocation || '—'} · Challan ${deliveries[0].challanNumber || '—'}`
      : gateEntries.length
        ? `${gateEntries[0].verificationMethod} verification · Person ${gateEntries[0].actualDeliveryPersonName || '—'} · Vehicle ${gateEntries[0].actualVehicleNumber || '—'}${gateEntries[0].rejectionReason ? ` · Reason: ${gateEntries[0].rejectionReason}` : ''}${gateEntries[0].exitTime ? ` · Exit ${dateTime(gateEntries[0].exitTime)}` : ''}`
        : `${gateVerifiedGrns[0].grnNumber} created after PO QR and physical receipt verification`
    ensure(40 + auditRowHeight(firstGateDescription))
    title('Delivery and gate verification')
    deliveries.forEach(delivery => auditRow(delivery.scheduledDate || delivery.createdAt, delivery.status, delivery.deliveryPersonName, `${delivery.deliveryNumber} · Vehicle ${delivery.vehicleNumber || '—'} · ${delivery.deliveryLocation || po?.deliveryLocation || '—'} · Challan ${delivery.challanNumber || '—'}`, violet))
    gateEntries.forEach(entry => auditRow(entry.entryTime || entry.createdAt, `Gate ${entry.decision}`, entry.securityUserName, `${entry.verificationMethod} verification · Person ${entry.actualDeliveryPersonName || '—'} · Vehicle ${entry.actualVehicleNumber || '—'}${entry.rejectionReason ? ` · Reason: ${entry.rejectionReason}` : ''}${entry.exitTime ? ` · Exit ${dateTime(entry.exitTime)}` : ''}`, entry.decision === 'APPROVED' ? green : '#991b1b'))
    gateVerifiedGrns.forEach(receipt => auditRow(receipt.gateVerifiedAt || receipt.receivedAt, 'Gate PO QR verified', receipt.receivedByName, `${receipt.grnNumber} created after PO QR and physical receipt verification`, green))
  }

  if (requestHistory.length || poHistory.length) {
    const firstHistory = requestHistory[0] || poHistory[0]
    ensure(40 + auditRowHeight(firstHistory.comment))
    title('Complete status history')
    requestHistory.forEach(entry => auditRow(entry.createdAt, `Request · ${entry.newStatus}`, entry.actorName, entry.comment))
    poHistory.forEach(entry => auditRow(entry.createdAt, `PO · ${entry.newStatus}`, entry.actorName, entry.comment, violet))
  }
  doc.fillColor(muted).font('Helvetica').fontSize(6).text(`Live audit snapshot generated ${dateTime(new Date())} · Current GRN ${currentGrn.grnNumber}`, left, Math.min(770, doc.y + 12), { width })
}

async function loadWorkflowContext(po) {
  const allGrns = await GoodsReceipt.find({ poId: po._id }).sort({ receivedAt: 1, createdAt: 1 }).lean()
  const deliveries = await DeliverySchedule.find({ poId: po._id }).sort({ scheduledDate: 1, createdAt: 1 }).lean()
  const deliveryIds = deliveries.map(delivery => delivery._id)
  const gateEntries = await GateEntry.find({
    $or: [
      { poId: po._id },
      ...(deliveryIds.length ? [{ deliveryScheduleId: { $in: deliveryIds } }] : [])
    ]
  }).sort({ entryTime: 1, createdAt: 1 }).lean()
  return { allGrns, deliveries, gateEntries }
}

async function grnPdf(po, grn, request = null, workflowContext = {}) {
  const institution = request?.institution || po?.institution || grn?.institution || 'msec'
  const brand = await getPdfBrand(institution)
  const receiptEvidenceBuffer = await storedImage(grn.receiptEvidence?.url)
  const damageEvidenceBuffer = await storedImage(grn.damageEvidence?.url)
  const indentEvidence = []
  for (const evidence of (request?.evidence || [])) {
    const buffer = await storedImage(evidence.url)
    if (buffer) indentEvidence.push({ evidence, buffer })
  }
  const serviceBills = []
  if (grn.source === 'SERVICE_PO') {
    for (const [index, expense] of (po?.serviceExecution?.expenses || []).entries()) {
      const bill = expense.bill || {}
      const match = String(bill.url || '').match(/^data:([^;,]+);base64,(.+)$/s)
      let buffer = null
      let preview = null
      if (match) {
        try {
          buffer = Buffer.from(match[2], 'base64')
          if (match[1].startsWith('image/')) preview = await sharp(buffer).rotate().png().toBuffer()
        } catch {
          buffer = null
          preview = null
        }
      }
      serviceBills.push({
        index: index + 1,
        category: expense.category || 'OTHER',
        description: expense.description || 'Service cost',
        amount: Number(expense.amount || 0),
        uploadedBy: expense.uploadedBy,
        createdAt: expense.createdAt,
        name: bill.name || `service-bill-${index + 1}`,
        mimeType: bill.mimeType || match?.[1] || 'application/octet-stream',
        url: bill.url,
        buffer,
        preview
      })
    }
  }
  if (grn.source === 'SERVICE_PO') {
    return collectPdf(doc => {
      const left = 48, width = 505, ink = '#172033', muted = '#5b6472', violet = '#6d28d9', pale = '#f5f3ff'
      const expenses = po?.serviceExecution?.expenses || []
      const actualTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      const drawServiceHeader = subtitle => {
        institutionHeader(doc, brand, subtitle, { lineY: 124, accent: violet, context: 'SERVICE MANAGEMENT' })
      }
      const section = (title, y) => {
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(8).text(title.toUpperCase(), left, y)
        doc.moveTo(left, y + 14).lineTo(left + width, y + 14).lineWidth(0.6).strokeColor('#cbd5e1').stroke()
        doc.moveTo(left, y + 14).lineTo(left + 32, y + 14).lineWidth(2).strokeColor(violet).stroke()
      }
      const field = (labelText, valueText, x, y, fieldWidth = 220) => {
        doc.fillColor(muted).font('Helvetica-Bold').fontSize(6).text(labelText.toUpperCase(), x, y, { width: 75 })
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.5).text(String(valueText || '—'), x + 76, y, { width: fieldWidth - 76, ellipsis: true })
      }

      drawServiceHeader('SERVICE COMPLETION CERTIFICATE')
      doc.rect(left, 142, width, 74).fillAndStroke(pale, '#ddd6fe')
      field('Certificate', grn.grnNumber, left + 12, 154, 235)
      field('Service PO', po?.poNumber || grn.poNumber, 305, 154, 235)
      field('GRN Created', dateTime(grn.createdAt || grn.receivedAt), left + 12, 176, 235)
      field('Status', 'SERVICE VERIFIED & CLOSED', 305, 176, 235)
      field('Location', po?.deliveryLocation || po?.deliveryAddress, left + 12, 198, 235)
      field('Technician', po?.serviceExecution?.technicianName || grn.serviceReceipt?.technicianName, 305, 198, 235)

      section('Service provider and completion details', 238)
      doc.rect(left, 262, width, 82).fillAndStroke('#ffffff', '#d6d3d1')
      field('Provider', po?.vendorName, left + 12, 276, 235)
      field('Verified by', grn.receivedByName || 'Purchase Manager', 305, 276, 235)
      field('PO estimate', money(po?.grandTotal), left + 12, 300, 235)
      field('Actual cost', money(actualTotal || grn.grandTotal), 305, 300, 235)
      field('Bills checked', `${serviceBills.length} supporting bill(s)`, left + 12, 324, 235)
      field('Evidence', `${grn.serviceReceipt?.evidenceCount || po?.serviceExecution?.workEvidence?.length || 0} work file(s)`, 305, 324, 235)

      section('Work completed', 365)
      doc.rect(left, 389, width, 68).fillAndStroke('#ffffff', '#d6d3d1')
      doc.fillColor(ink).font('Helvetica').fontSize(8).text(po?.serviceExecution?.serviceSummary || grn.serviceReceipt?.summary || grn.remarks || 'The approved service scope was completed and verified.', left + 12, 402, { width: width - 24, height: 43, ellipsis: true, lineGap: 2 })

      section('Verified service expenses', 479)
      let y = 503
      doc.rect(left, y, width, 22).fill(ink)
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.5)
        .text('#', left + 8, y + 7, { width: 20 }).text('CATEGORY / DESCRIPTION', left + 31, y + 7, { width: 280 }).text('BILL', left + 316, y + 7, { width: 110 }).text('AMOUNT', left + 426, y + 7, { width: 70, align: 'right' })
      y += 22
      expenses.slice(0, 6).forEach((expense, index) => {
        doc.rect(left, y, width, 34).fillAndStroke(index % 2 ? '#ffffff' : '#f8fafc', '#e2e8f0')
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(6.8).text(String(index + 1), left + 8, y + 11, { width: 20 })
        doc.text(`${expense.category || 'OTHER'} · ${expense.description || 'Service cost'}`, left + 31, y + 7, { width: 280, height: 20, ellipsis: true })
        doc.fillColor(muted).font('Helvetica').fontSize(6.2).text(expense.bill?.name || 'No bill', left + 316, y + 10, { width: 110, ellipsis: true })
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(7).text(money(expense.amount), left + 426, y + 10, { width: 70, align: 'right' })
        y += 34
      })
      doc.fillColor(violet).font('Helvetica-Bold').fontSize(9).text(`TOTAL ACTUAL SERVICE COST: ${money(actualTotal || grn.grandTotal)}`, left, y + 10, { width, align: 'right' })

      const certY = Math.min(710, y + 42)
      doc.rect(left, certY, width, 54).fillAndStroke(pale, '#ddd6fe')
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(7.5).text('SERVICE ACCEPTANCE CERTIFICATION', left + 12, certY + 10)
      doc.font('Helvetica').fontSize(6.7).text('Certified that the service described above was completed, inspected, and accepted. Actual costs and supporting bills were verified against the approved service purchase order.', left + 12, certY + 25, { width: width - 24, height: 23 })
      doc.fillColor(muted).fontSize(5.5).text(`System-generated service completion certificate · ${new Date().toLocaleString('en-IN')}`, left, 785, { width })

      serviceBills.forEach(bill => {
        if (bill.buffer) {
          try { doc.file(bill.buffer, { name: bill.name, description: `${bill.description} · ${money(bill.amount)}` }) } catch { /* annexure remains visible */ }
        }
        doc.addPage(); drawServiceHeader(`VERIFIED SERVICE BILL ${bill.index}`)
        doc.rect(left, 145, width, 58).fillAndStroke(pale, '#ddd6fe')
        field('Expense', bill.description, left + 12, 158, 300)
        field('Amount', money(bill.amount), 385, 158, 155)
        field('Category', bill.category, left + 12, 181, 235)
        field('File', bill.name, 305, 181, 235)
        if (bill.preview) {
          doc.rect(left, 220, width, 510).stroke('#d6d3d1')
          doc.image(bill.preview, left + 10, 230, { fit: [width - 20, 490], align: 'center', valign: 'center' })
        } else {
          doc.rect(left, 260, width, 145).fillAndStroke('#f8fafc', '#d6d3d1')
          doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text('ORIGINAL BILL EMBEDDED', left + 20, 305, { width: width - 40, align: 'center' })
          doc.fillColor(muted).font('Helvetica').fontSize(8).text('Open this PDF’s attachments panel to view the original scanned PDF bill.', left + 30, 335, { width: width - 60, align: 'center' })
        }
      })
      appendWorkflowAnnexure(doc, po, grn, request, workflowContext, brand)
    })
  }
  return collectPdf(doc => {
    const items = (grn.items || []).filter(item => Number(item.quantityDeliveredNow || 0) > 0).map(item => {
      const poItem = (po?.items || []).find(candidate =>
        String(candidate._id) === String(item.poItemId) ||
        candidate.productId === item.productId ||
        candidate.description === item.poItemDescription
      )
      if (!poItem || item.unitPrice !== undefined) return item
      const unitPrice = roundMoney(poItem.unitPrice)
      const lineSubtotal = roundMoney(Number(item.quantityAcceptedNow || 0) * unitPrice)
      const discountAllocated = roundMoney(Number(poItem.discount || 0) * Number(item.quantityAcceptedNow || 0) / Math.max(1, Number(poItem.quantityOrdered || 1)))
      const taxableAmount = Math.max(0, roundMoney(lineSubtotal - discountAllocated))
      const taxRate = Number(poItem.taxRate || 0)
      const taxAmount = roundMoney(taxableAmount * taxRate / 100)
      return { ...item, unitPrice, taxRate, lineSubtotal, discountAllocated, taxableAmount, taxAmount, lineTotal: roundMoney(taxableAmount + taxAmount) }
    })
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
    const receiptSubtotal = roundMoney(grn.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0))
    const receiptDiscount = roundMoney(grn.discountTotal ?? items.reduce((sum, item) => sum + Number(item.discountAllocated || 0), 0))
    const receiptTax = roundMoney(grn.taxTotal ?? items.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0))
    const receiptDelivery = roundMoney(grn.deliveryChargeAllocated || 0)
    const receiptTotal = roundMoney(grn.grandTotal ?? (receiptSubtotal - receiptDiscount + receiptTax + receiptDelivery))

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

    institutionHeader(doc, brand, grn.source === 'SERVICE_PO' ? 'SERVICE COMPLETION RECEIPT (GRN)' : 'GOODS RECEIPT NOTE', { accent: gold })

    // Reference block.
    doc.rect(left, 132, width, 55).fillAndStroke(pale, '#d6d3d1')
    doc.moveTo(296, 132).lineTo(296, 187).lineWidth(0.5).strokeColor('#d6d3d1').stroke()
    label('GRN Number', 54, 140); value(grn.grnNumber, 130, 140, 150)
    label('GRN Created', 54, 156); value(dateTime(grn.createdAt || grn.receivedAt), 130, 156, 150)
    label('GRN Status', 54, 172); value(statusLabel(grnStatus), 130, 172, 150)
    label('PO Number', 308, 140); value(po?.poNumber || grn.poNumber, 378, 140, 160)
    label('PO Status', 308, 156); value(statusLabel(poStatus), 378, 156, 160)
    label('Receipt Type', 308, 172); value(statusLabel(grn.grnType), 378, 172, 160)

    sectionTitle('Vendor and receipt information', 201)
    doc.rect(left, 222, 248, 67).fillAndStroke('#ffffff', '#d6d3d1')
    doc.rect(305, 222, 248, 67).fillAndStroke('#ffffff', '#d6d3d1')
    label('Vendor', 54, 234); value(po?.vendorName, 124, 234, 155)
    label('PO Value', 54, 254); value(money(po?.grandTotal), 124, 254, 155)
    label('GRN Value', 54, 274); value(money(receiptTotal), 124, 274, 155)
    label('Delivery To', 317, 234); value(po?.deliveryLocation, 387, 234, 154)
    label('Received By', 317, 254); value(grn.receivedByName, 387, 254, 154)
    label('Source', 317, 274); value(`${grn.source === 'SERVICE_PO' ? 'Approved service PO' : grn.source === 'PO_QR' ? 'Gate PO QR verified' : 'Manual receipt'}${request?.requestNumber ? ` · ${request.requestNumber}` : ''}`, 387, 274, 154)

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

    sectionTitle('Items received in this GRN', 375)
    doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(5.7)
      .text(
        `ACCEPTED SUBTOTAL ${money(receiptSubtotal)}   ·   DISCOUNT ${money(receiptDiscount)}   ·   GST ${money(receiptTax)}   ·   DELIVERY ${money(receiptDelivery)}   ·   GRN TOTAL ${money(receiptTotal)}`,
        left, 391, { width, align: 'right', lineBreak: false }
      )
    const columns = [
      ['#', 18], ['Product ID / Description', 154], ['Ordered', 48], ['Previous', 48],
      ['Received', 48], ['Accepted', 48], ['Damaged', 43], ['Rejected', 43], ['Remaining', 61]
    ]
    let tableY = 405
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
        `${item.productId || '—'}\n${item.poItemDescription || ''} · ${money(item.unitPrice)} × ${item.quantityAcceptedNow || 0} · ${money(item.lineTotal)}`,
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
      .text(grn.remarks || (grn.source === 'SERVICE_PO' ? 'Service work, supporting bills, and actual costs were reviewed and accepted.' : 'Goods received and inspected without additional remarks.'), left + 10, remarksY + 31, { width: width - 20, height: 28, ellipsis: true })
    doc.fontSize(6.5).text('Certified that the above goods were physically received, inspected and recorded against the referenced purchase order.', left, remarksY + 78, { width })

    doc.moveTo(left, 774).lineTo(left + width, 774).lineWidth(0.4).strokeColor('#d6d3d1').stroke()
    doc.fillColor('#4b5563').font('Helvetica').fontSize(5.5)
      .text(`System-generated official GRN · ${new Date().toLocaleString('en-IN')}`, left, 781, { width: 350, lineBreak: false })
      .text(`PO ${po?.poNumber || grn.poNumber} · ${grn.grnNumber}`, 392, 781, { width: 161, align: 'right', lineBreak: false })

    if (items.length > 9) {
      doc.addPage()
      institutionHeader(doc, brand, 'GRN ITEM ANNEXURE', { lineY: 126, accent: gold })
      doc.font('Helvetica-Bold').fontSize(7).text(`${grn.grnNumber} · ${po?.poNumber || grn.poNumber}`, left, 112, { width })
      doc.y = 146
      itemsTable(doc, items.slice(9))
      doc.moveTo(left, 774).lineTo(left + width, 774).lineWidth(0.4).strokeColor('#d6d3d1').stroke()
      doc.fillColor('#4b5563').font('Helvetica').fontSize(5.5)
        .text(`Continuation of ${grn.grnNumber} · ${items.length} received products total`, left, 781, { width, lineBreak: false })
    }
    if (serviceBills.length) {
      doc.addPage()
      institutionHeader(doc, brand, 'SERVICE BILL REGISTER', { lineY: 128, accent: gold, context: 'SERVICE MANAGEMENT' })
      doc.fillColor('#4b5563').font('Helvetica').fontSize(7)
        .text(`${grn.grnNumber} · PO ${po?.poNumber || grn.poNumber} · ${serviceBills.length} verified bill(s)`, left, 112, { width })
      let billY = 148
      serviceBills.forEach(bill => {
        doc.rect(left, billY, width, 56).fillAndStroke('#ffffff', '#d6d3d1')
        doc.fillColor(ink).font('Helvetica-Bold').fontSize(8).text(`${bill.index}. ${bill.description}`, left + 10, billY + 9, { width: 280, ellipsis: true })
        doc.fillColor('#4b5563').font('Helvetica').fontSize(6.5).text(`${bill.category} · ${bill.name} · ${bill.mimeType}`, left + 10, billY + 25, { width: 360, ellipsis: true })
        doc.text(`Uploaded by ${bill.uploadedBy || 'Service provider'}${bill.createdAt ? ` on ${date(bill.createdAt)}` : ''}`, left + 10, billY + 39, { width: 360, ellipsis: true })
        doc.fillColor('#047857').font('Helvetica-Bold').fontSize(10).text(money(bill.amount), left + width - 120, billY + 19, { width: 105, align: 'right' })
        billY += 64
      })
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(9).text(`TOTAL VERIFIED SERVICE BILLS: ${money(serviceBills.reduce((sum, bill) => sum + bill.amount, 0))}`, left, Math.min(735, billY + 8), { width, align: 'right' })

      serviceBills.forEach(bill => {
        if (bill.buffer) {
          try { doc.file(bill.buffer, { name: bill.name, description: `${bill.description} · ${money(bill.amount)}` }) } catch { /* visible annexure remains */ }
        }
        doc.addPage()
        institutionHeader(doc, brand, `SERVICE BILL ${bill.index}`, { lineY: 140, accent: gold, context: 'SERVICE MANAGEMENT' })
        doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(7).text(`${bill.description} · ${bill.category} · ${money(bill.amount)}`, left, 111, { width })
        doc.font('Helvetica').fontSize(6.5).text(`File: ${bill.name} (${bill.mimeType})`, left, 124, { width })
        if (bill.preview) {
          doc.rect(left, 152, width, 575).stroke('#d6d3d1')
          doc.image(bill.preview, left + 10, 162, { fit: [width - 20, 555], align: 'center', valign: 'center' })
        } else {
          doc.rect(left, 190, width, 155).fillAndStroke(pale, '#d6d3d1')
          doc.fillColor(ink).font('Helvetica-Bold').fontSize(13).text('SCANNED BILL ATTACHED TO THIS PDF', left + 20, 232, { width: width - 40, align: 'center' })
          doc.fillColor('#4b5563').font('Helvetica').fontSize(9).text('Open the PDF attachments panel and select the bill filename shown above.', left + 30, 265, { width: width - 60, align: 'center' })
          if (!bill.buffer && /^https?:\/\//.test(String(bill.url || ''))) {
            doc.fillColor('#2563eb').font('Helvetica-Bold').fontSize(8).text('Open original bill', left + 30, 300, { width: width - 60, align: 'center', link: bill.url, underline: true })
          }
        }
      })
    }
    if (receiptEvidenceBuffer) {
      doc.addPage()
      institutionHeader(doc, brand, 'RECEIVED GOODS PHOTO PROOF', { lineY: 112, accent: gold, context: 'GOODS RECEIPT EVIDENCE' })
      doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(7)
        .text(`${grn.grnNumber} · PO ${po?.poNumber || grn.poNumber} · ${date(grn.receivedAt || grn.createdAt)}`, left, 124, { width })
      doc.rect(left, 145, width, 590).lineWidth(0.7).strokeColor('#d6d3d1').stroke()
      try {
        doc.image(receiptEvidenceBuffer, left + 10, 155, { fit: [width - 20, 570], align: 'center', valign: 'center' })
      } catch {
        doc.fillColor('#991b1b').font('Helvetica-Bold').fontSize(9)
          .text('The attached proof photo could not be rendered.', left, 420, { width, align: 'center' })
      }
      doc.moveTo(left, 774).lineTo(left + width, 774).lineWidth(0.4).strokeColor('#d6d3d1').stroke()
      doc.fillColor('#4b5563').font('Helvetica').fontSize(5.5)
        .text(`Gate receipt evidence · ${grn.receiptEvidence.name || 'Received goods photo'}`, left, 781, { width, lineBreak: false })
    }
    if (damageEvidenceBuffer) {
      doc.addPage()
      institutionHeader(doc, brand, 'DAMAGED GOODS PHOTO PROOF', { lineY: 112, accent: '#991b1b', context: 'GOODS RECEIPT EVIDENCE' })
      doc.rect(left, 145, width, 590).lineWidth(0.7).strokeColor('#fecaca').stroke()
      doc.image(damageEvidenceBuffer, left + 10, 155, { fit: [width - 20, 570], align: 'center', valign: 'center' })
      doc.fillColor('#4b5563').font('Helvetica').fontSize(5.5).text(`Damage evidence · ${grn.damageEvidence.name || 'Damage photo'} · ${grn.grnNumber}`, left, 781, { width, lineBreak: false })
    }
    indentEvidence.forEach(({ evidence, buffer }, index) => {
      doc.addPage()
      institutionHeader(doc, brand, `INDENT PHOTO EVIDENCE ${index + 1}`, { lineY: 112, accent: gold, context: 'REQUEST EVIDENCE' })
      doc.fillColor('#4b5563').font('Helvetica-Bold').fontSize(7).text(`${request.requestNumber} · ${request.title} · ${evidence.name || 'Uploaded evidence'}`, left, 122, { width })
      doc.rect(left, 145, width, 590).lineWidth(0.7).strokeColor('#d6d3d1').stroke()
      doc.image(buffer, left + 10, 155, { fit: [width - 20, 570], align: 'center', valign: 'center' })
      doc.fillColor('#4b5563').font('Helvetica').fontSize(5.5).text(`Original indent evidence · ${(evidence.kind || 'PHOTO').replace(/_/g, ' ')} · ${grn.grnNumber}`, left, 781, { width, lineBreak: false })
    })
    appendWorkflowAnnexure(doc, po, grn, request, workflowContext, brand)
  })
}

async function poPdf(po, grns, request = null, workflowContext = {}) {
  const brand = await getPdfBrand(request?.institution || po?.institution || 'msec')
  return collectPdf(doc => {
    header(doc, 'COMPLETED PURCHASE ORDER REPORT', po.poNumber)
    section(doc, 'Purchase order')
    row(doc, 'Vendor', po.vendorName)
    row(doc, 'Status', po.status)
    row(doc, 'Created At', dateTime(po.createdAt))
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
        .text(`${grn.grnType} · ${grn.status} · ${dateTime(grn.createdAt || grn.receivedAt)} · ${grn.items?.length || 0} items · ${money(grn.grandTotal)}`, 52, y + 16)
      doc.y = y + 42
    })
    section(doc, 'PO items')
    const summaryItems = (po.items || []).map(item => ({
      productId: item.productId,
      poItemDescription: item.description,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      quantityOrdered: item.quantityOrdered || 0,
      quantityPreviouslyAccepted: 0,
      quantityDeliveredNow: item.quantityAccepted || 0,
      quantityAcceptedNow: item.quantityAccepted || 0,
      quantityDamaged: 0,
      quantityRejected: 0,
      quantityRemaining: item.quantityRemaining || 0,
    }))
    itemsTable(doc, summaryItems)
    if (grns.length) appendWorkflowAnnexure(doc, po, grns[grns.length - 1], request, workflowContext, brand)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' })
  try {
    const actorRole = req.user?.role || req.headers['x-user-role'] || ''
    const actorId = req.user?.id || req.headers['x-user-id'] || ''
    if (actorRole !== 'manager') {
      return res.status(403).json({ success: false, error: 'Only the responsible manager can download PO and GRN reports' })
    }
    await connectToDatabase()
    const { type, grnId, poId } = req.query
    if (type === 'grn') {
      const grn = await GoodsReceipt.findById(grnId).lean()
      if (!grn) return res.status(404).json({ success: false, error: 'GRN not found' })
      const po = await PurchaseOrder.findById(grn.poId).lean()
      if (!po || String(po.createdById || '') !== String(actorId)) {
        return res.status(403).json({ success: false, error: 'You can download only GRNs for purchase orders assigned to you' })
      }
      const request = po?.requestId ? await ServiceRequest.findById(po.requestId).lean() : null
      const workflowContext = await loadWorkflowContext(po)
      const pdf = await grnPdf(po, grn, request, workflowContext)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${safeName(grn.grnNumber)}.pdf"`)
      return res.end(pdf)
    }
    if (type === 'po-package') {
      const po = await PurchaseOrder.findById(poId).lean()
      if (!po) return res.status(404).json({ success: false, error: 'Purchase order not found' })
      if (String(po.createdById || '') !== String(actorId)) {
        return res.status(403).json({ success: false, error: 'You can download only purchase orders assigned to you' })
      }
      const grns = await GoodsReceipt.find({ poId }).sort({ createdAt: 1 }).lean()
      const request = po.requestId ? await ServiceRequest.findById(po.requestId).lean() : null
      const workflowContext = await loadWorkflowContext(po)
      const zip = new JSZip()
      zip.file(`${safeName(po.poNumber)}-complete-report.pdf`, await poPdf(po, grns, request, workflowContext))
      const folder = zip.folder('GRNs')
      for (const grn of grns) folder.file(`${safeName(grn.grnNumber)}.pdf`, await grnPdf(po, grn, request, workflowContext))
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
