import { PurchaseOrder, Vendor, VendorQuotation, User, ServiceRequest, GoodsReceipt } from '../models.js'

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
const normalizeUnit = value => ({ pieces: 'pcs', sets: 'set', units: 'unit', boxes: 'box', meters: 'm' }[String(value || '').toLowerCase()] || String(value || 'pcs').toLowerCase())
const invalidOrder = message => Object.assign(new Error(message), { status: 400 })
const displayManagerName = value => String(value || '').trim().replace(/^Service Manager$/i, 'Purchase Manager') || 'Purchase Manager'

function withoutEmbeddedFiles(value) {
  const po = typeof value?.toObject === 'function' ? value.toObject() : { ...value }
  if (po.signedPo) {
    po.signedPo = { ...po.signedPo, hasFile: Boolean(po.signedPo.url || po.signedPo.name) }
    delete po.signedPo.url
  }
  delete po.documentUrl
  if (po.serviceExecution) {
    po.serviceExecution = { ...po.serviceExecution }
    po.serviceExecution.workEvidence = (po.serviceExecution.workEvidence || []).map(file => ({ ...file, url: undefined }))
    po.serviceExecution.expenses = (po.serviceExecution.expenses || []).map(expense => ({
      ...expense,
      bill: expense.bill ? { ...expense.bill, url: undefined } : expense.bill
    }))
  }
  return po
}

let legacyQrReconciliationPromise = null

async function reconcileLegacyQrClosures() {
  const finalQrPoIds = await GoodsReceipt.distinct('poId', { grnType: 'FINAL', source: 'PO_QR' })
  if (!finalQrPoIds.length) return
  const stuck = await PurchaseOrder.find({ _id: { $in: finalQrPoIds }, status: 'FULFILLED' })
    .select('_id requestId poNumber statusHistory')
  if (!stuck.length) return
  const now = new Date()
  await Promise.all(stuck.map(async po => {
    po.status = 'CLOSED'
    po.statusHistory.push({
      oldStatus: 'FULFILLED',
      newStatus: 'CLOSED',
      actorId: 'system',
      actorName: 'CampusServe',
      comment: 'Reconciled legacy final gate QR receipt; PO closed automatically',
      createdAt: now
    })
    await po.save()
    if (po.requestId) {
      await ServiceRequest.updateOne(
        { _id: po.requestId, status: { $ne: 'CLOSED' } },
        {
          $set: { status: 'CLOSED', currentOwnerRole: null, closedAt: now },
          $push: {
            statusHistory: {
              oldStatus: 'PURCHASE_ORDER_CREATED',
              newStatus: 'CLOSED',
              actorId: 'system',
              actorName: 'CampusServe',
              comment: `Purchase order ${po.poNumber} closed after final gate QR receipt`
            }
          }
        }
      )
    }
  }))
}

// This is a one-time migration safety net, not work that belongs on every list
// request. Keep it off the response critical path and share the work between
// concurrent requests in the same server process.
function scheduleLegacyQrReconciliation() {
  if (legacyQrReconciliationPromise) return
  legacyQrReconciliationPromise = reconcileLegacyQrClosures().catch(error => {
    console.warn('Legacy QR closure reconciliation failed:', error.message)
    legacyQrReconciliationPromise = null
  })
}

import { connectToDatabase } from '../lib/mongo.js'
import { addProductIds, generateProductId, getProductId } from '../lib/productId.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try { await connectToDatabase() } catch (e) {
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const userRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown'

  const pushHistory = (po, oldStatus, newStatus, comment) => {
    po.statusHistory.push({ oldStatus, newStatus, actorId, actorName, comment, createdAt: new Date() })
  }

  try {
    const { id, action } = req.query

    // ── GET /api/purchase-orders ──────────────────────────────────────────────
    if (req.method === 'GET') {
      scheduleLegacyQrReconciliation()
      if (id && action === 'signed-po') {
        const po = await PurchaseOrder.findById(id).select('signedPo createdById vendorId').lean()
        if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
        if (userRole === 'manager' && String(po.createdById || '') !== String(actorId)) {
          return res.status(403).json({ success: false, error: 'This purchase order is not assigned to you' })
        }
        if (userRole === 'vendor') {
          const vendor = await Vendor.findOne({ email: actor?.email }).select('_id').lean()
          if (!vendor || String(po.vendorId || '') !== String(vendor._id)) {
            return res.status(403).json({ success: false, error: 'This purchase order is not assigned to your vendor account' })
          }
        }
        if (!po.signedPo?.url) return res.status(404).json({ success: false, error: 'Signed PO file not found' })
        return res.json({ success: true, data: po.signedPo })
      }
      if (id) {
        const po = await PurchaseOrder.findById(id)
          .select('-signedPo.url -documentUrl -serviceExecution.workEvidence.url -serviceExecution.expenses.bill.url')
          .lean()
        if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
        if (userRole === 'manager' && String(po.createdById || '') !== String(actorId)) {
          return res.status(403).json({ success: false, error: 'This purchase order is not assigned to you' })
        }
        if (userRole === 'vendor') {
          const vendor = await Vendor.findOne({ email: actor?.email }).select('_id').lean()
          if (!vendor || String(po.vendorId || '') !== String(vendor._id)) {
            return res.status(403).json({ success: false, error: 'This purchase order is not assigned to your vendor account' })
          }
        }
        if (po.signedPo) po.signedPo.hasFile = Boolean(po.signedPo.name)
        const [vendor, request, creator] = await Promise.all([
          po.vendorId && !po.vendorAddress ? Vendor.findById(po.vendorId).select('address').lean() : null,
          po.requestId && (!po.adminDescription || !po.adminRequirementType || !po.adminAssessmentNote)
            ? ServiceRequest.findById(po.requestId).select('description adminAssessment').lean()
            : null,
          po.createdById ? User.findById(po.createdById).select('name').lean() : null
        ])
        po.createdBy = displayManagerName(creator?.name || po.createdBy)
        if (vendor?.address) po.vendorAddress = vendor.address
        if (request) {
          po.adminRequirementType ||= request.adminAssessment?.requirementType || ''
          po.adminDescription ||= request.description || ''
          po.adminAssessmentNote ||= request.adminAssessment?.note || ''
          po.items = (po.items || []).map(item => ({
            ...item,
            specification: item.specification || request.description || request.adminAssessment?.note || ''
          }))
        }
        po.items = addProductIds(po.items)
        return res.json({ success: true, data: po })
      }
      const filter = {}
      if (req.query.status) filter.status = req.query.status
      if (req.query.vendorId) filter.vendorId = req.query.vendorId
      if (req.query.requestId) filter.requestId = req.query.requestId
      if (userRole === 'manager') filter.createdById = actorId
      if (userRole === 'vendor') {
        // Vendors see their own POs only
        const vendor = await Vendor.findOne({ email: actor?.email }).select('_id').lean()
        if (!vendor) return res.json({ success: true, data: [], total: 0 })
        filter.vendorId = vendor._id
      }
      const pos = await PurchaseOrder.find(filter)
        .select('-signedPo.url -documentUrl -serviceExecution.workEvidence.url -serviceExecution.expenses.bill.url -statusHistory')
        .sort({ createdAt: -1 })
        .lean()
      // Always derive request-based PO type from the admin assessment. This also
      // corrects legacy records that predate poType or received an incorrect default.
      const requestIds = [...new Set(pos.filter(po => po.requestId).map(po => String(po.requestId)))]
      const linkedRequests = requestIds.length
        ? await ServiceRequest.find({ _id: { $in: requestIds } }).select('adminAssessment.requirementType').lean()
        : []
      const requirementByRequest = new Map(linkedRequests.map(request => [String(request._id), request.adminAssessment?.requirementType]))
      const creatorIds = [...new Set(pos.filter(po => po.createdById).map(po => String(po.createdById)))]
      const creators = creatorIds.length
        ? await User.find({ _id: { $in: creatorIds } }).select('name').lean()
        : []
      const creatorNameById = new Map(creators.map(creator => [String(creator._id), displayManagerName(creator.name)]))
      pos.forEach(po => {
        po.createdBy = creatorNameById.get(String(po.createdById || '')) || displayManagerName(po.createdBy)
        const requirementType = requirementByRequest.get(String(po.requestId || '')) || po.adminRequirementType
        po.adminRequirementType = requirementType || ''
        po.poType = requirementType === 'MAINTENANCE'
          ? 'SERVICE'
          : requirementType === 'REPLACEMENT'
            ? 'REPLACEMENT'
            : requirementType === 'NEW_PURCHASE'
              ? 'GOODS'
              : (po.poType || 'GOODS')
        po.items = addProductIds(po.items)
      })
      return res.json({ success: true, data: pos, total: pos.length })
    }

    // ── POST /api/purchase-orders — Create PO ─────────────────────────────────
    if (req.method === 'POST' && !id) {
      if (userRole !== 'manager') {
        return res.status(403).json({ success: false, error: 'Only the assigned manager can generate a purchase order' })
      }
      const { vendorId: requestedVendorId, serviceProviderId, selectedQuotationId, requestId, poType: requestedPoType, items: requestedItems, deliveryAddress, deliveryLocation, expectedDeliveryDate, paymentTerms, warrantyTerms, notes, deliveryCharge } = req.body
      let vendorId = requestedVendorId
      let items = requestedItems
      let selectedQuotation = null
      let serviceRequest = null
      let serviceProvider = null
      if (selectedQuotationId) {
        selectedQuotation = await VendorQuotation.findById(selectedQuotationId).lean()
        if (!selectedQuotation || !selectedQuotation.selected || selectedQuotation.status !== 'SELECTED') {
          return res.status(400).json({ success: false, error: 'Select a valid quotation before generating the purchase order' })
        }
        if (String(selectedQuotation.requestId) !== String(requestId || '')) {
          return res.status(400).json({ success: false, error: 'The selected quotation does not belong to this indent' })
        }
        vendorId = selectedQuotation.vendorId
        const requestedItemSpecs = Array.isArray(requestedItems) ? requestedItems : []
        items = selectedQuotation.items.map(item => ({
          description: item.description,
          specification: requestedItemSpecs.find(candidate => String(candidate.description || '').trim().toLowerCase() === String(item.description || '').trim().toLowerCase())?.specification,
          quantityOrdered: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount || 0
        }))
      }
      if (requestId) {
        serviceRequest = await ServiceRequest.findById(requestId)
        if (!serviceRequest) return res.status(404).json({ success: false, error: 'Service request not found' })
      }
      const isServiceOrder = serviceRequest?.adminAssessment?.requirementType === 'MAINTENANCE' || (!serviceRequest && requestedPoType === 'SERVICE')
      if (!Array.isArray(items) || !items.length || !deliveryAddress) {
        return res.status(400).json({ success: false, error: 'At least one scope/item and a campus service or delivery address are required' })
      }
      if (isServiceOrder && !serviceProviderId) return res.status(400).json({ success: false, error: 'Select an active service provider' })
      if (!isServiceOrder && !vendorId) return res.status(400).json({ success: false, error: 'Select an active vendor' })
      if (items.some(item => !String(item.description || '').trim())) {
        return res.status(400).json({ success: false, error: 'Every purchase order item needs a product description' })
      }
      const vendor = isServiceOrder ? null : await Vendor.findById(vendorId).lean()
      if (!isServiceOrder && !vendor) return res.status(404).json({ success: false, error: 'Vendor not found' })
      if (vendor && vendor.status !== 'ACTIVE') return res.status(400).json({ success: false, error: 'Vendor is not active' })
      if (isServiceOrder) {
        serviceProvider = await User.findOne({ _id: serviceProviderId, role: 'service_provider', isActive: true }).lean()
        if (!serviceProvider) return res.status(404).json({ success: false, error: 'Active service provider not found' })
      }
      if (requestId) {
        if (userRole === 'manager' && String(serviceRequest.assignedManagerId) !== String(actorId)) {
          return res.status(403).json({ success: false, error: 'This request is not assigned to you' })
        }
        const isServiceRequest = serviceRequest.adminAssessment?.requirementType === 'MAINTENANCE'
        const quotationCount = await VendorQuotation.countDocuments({ requestId })
        if (!isServiceRequest && quotationCount > 0 && !selectedQuotationId) {
          return res.status(400).json({ success: false, error: 'Compare and select a quotation before generating the PO' })
        }
        if (!isServiceRequest && serviceRequest.selectedQuotationId && String(serviceRequest.selectedQuotationId) !== String(selectedQuotationId || '')) {
          return res.status(400).json({ success: false, error: 'Generate the PO from the quotation selected for this indent' })
        }
        const existingPo = await PurchaseOrder.findOne({ requestId, status: { $ne: 'CANCELLED' } }).lean()
        // Repeated clicks reopen the order already generated for this request.
        if (existingPo) {
          existingPo.items = addProductIds(existingPo.items)
          return res.status(200).json({
            success: true,
            data: existingPo,
            existing: true,
            message: `Purchase order ${existingPo.poNumber} already exists for this request`
          })
        }
        if (serviceRequest.status !== 'ASSIGNED_TO_MANAGER') {
          return res.status(400).json({ success: false, error: 'The request must be triaged and assigned before an order can be created' })
        }
        if (!['MAINTENANCE', 'REPLACEMENT', 'NEW_PURCHASE'].includes(serviceRequest.adminAssessment?.requirementType)) {
          return res.status(400).json({ success: false, error: 'Admin classification is required before creating an order' })
        }
        const requestedDescription = String(serviceRequest.requestedItem || serviceRequest.title || '').trim().toLowerCase()
        const requestedQuantity = Number(serviceRequest.requestedQuantity || 1)
        const requestedUnit = normalizeUnit(serviceRequest.requestedUnit)
        const submittedItem = items[0]
        const isServicePo = serviceRequest.adminAssessment?.requirementType === 'MAINTENANCE'
        const expectedDescription = isServicePo ? String(serviceRequest.title || '').trim().toLowerCase() : requestedDescription
        const expectedQuantity = isServicePo ? 1 : requestedQuantity
        const expectedUnit = isServicePo ? 'service' : requestedUnit
        if (
          items.length !== 1 ||
          String(submittedItem?.description || '').trim().toLowerCase() !== expectedDescription ||
          Number(submittedItem?.quantityOrdered) !== expectedQuantity ||
          normalizeUnit(submittedItem?.unit) !== expectedUnit
        ) {
          return res.status(400).json({
            success: false,
            error: 'A request-based purchase order must contain only the single item, quantity, and unit approved in that request'
          })
        }
      }

      // Calculate totals
      let subtotal = 0, taxTotal = 0, discountTotal = 0
      const processedItems = items.map(item => {
        const qty = Number(item.quantityOrdered)
        const price = Number(item.unitPrice)
        const parsedTaxRate = Number(item.taxRate)
        const taxRate = Number.isFinite(parsedTaxRate) ? Math.min(100, Math.max(0, parsedTaxRate)) : 18
        const discount = Number(item.discount || 0)
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0) {
          throw invalidOrder(`Invalid quantity, unit price, or discount for ${item.description}`)
        }
        const lineSubtotal = roundMoney(qty * price)
        if (discount > lineSubtotal) throw invalidOrder(`Discount cannot exceed the line subtotal for ${item.description}`)
        const lineDiscount = roundMoney(discount)
        const lineTax = roundMoney((lineSubtotal - lineDiscount) * (taxRate / 100))
        const lineTotal = roundMoney(lineSubtotal - lineDiscount + lineTax)
        subtotal += lineSubtotal; discountTotal += lineDiscount; taxTotal += lineTax
        return {
          ...item,
          specification: String(item.specification || serviceRequest?.description || serviceRequest?.adminAssessment?.note || '').trim(),
          productId: generateProductId(),
          quantityOrdered: qty,
          unit: normalizeUnit(item.unit),
          unitPrice: roundMoney(price),
          taxRate,
          discount: lineDiscount,
          lineTotal,
          quantityAccepted: 0,
          quantityRemaining: qty
        }
      })
      subtotal = roundMoney(subtotal); discountTotal = roundMoney(discountTotal); taxTotal = roundMoney(taxTotal)
      const dc = roundMoney(deliveryCharge || 0)
      if (!Number.isFinite(dc) || dc < 0) return res.status(400).json({ success: false, error: 'Additional or delivery charge must be a valid non-negative amount' })
      const grandTotal = roundMoney(subtotal - discountTotal + taxTotal + dc)

      const year = new Date().getFullYear()
      const rnd = Math.floor(Math.random() * 900000) + 100000
      const poNumber = `PO-${year}-${rnd}`

      const po = new PurchaseOrder({
        poNumber, requestId,
        vendorId: vendor?._id, vendorName: vendor?.legalName || serviceProvider?.name, vendorEmail: vendor?.email || serviceProvider?.email,
        vendorAddress: vendor?.address || '',
        serviceProviderId: serviceProvider?._id,
        serviceProviderName: serviceProvider?.name,
        serviceProviderEmail: serviceProvider?.email,
        adminRequirementType: serviceRequest?.adminAssessment?.requirementType || '',
        poType: serviceRequest?.adminAssessment?.requirementType === 'MAINTENANCE'
          ? 'SERVICE'
          : serviceRequest?.adminAssessment?.requirementType === 'REPLACEMENT'
            ? 'REPLACEMENT'
            : (['SERVICE', 'GOODS', 'REPLACEMENT'].includes(requestedPoType) ? requestedPoType : 'GOODS'),
        adminDescription: serviceRequest?.description || '',
        adminAssessmentNote: serviceRequest?.adminAssessment?.note || '',
        items: processedItems, subtotal, taxTotal, discountTotal, deliveryCharge: dc, grandTotal,
        deliveryAddress, deliveryLocation, expectedDeliveryDate, paymentTerms: paymentTerms || 'Net 30',
        warrantyTerms, notes, createdBy: actorName, createdById: actorId, status: 'DRAFT',
        statusHistory: [{ oldStatus: '', newStatus: 'DRAFT', actorId, actorName, comment: 'PO created as draft', createdAt: new Date() }]
      })
      await po.save()
      if (serviceRequest) {
        const previousStatus = serviceRequest.status
        serviceRequest.status = 'PURCHASE_ORDER_CREATED'
        serviceRequest.currentOwnerRole = null
        serviceRequest.statusHistory.push({ oldStatus: previousStatus, newStatus: 'PURCHASE_ORDER_CREATED', actorId, actorName, comment: `Purchase order ${po.poNumber} generated` })
        await serviceRequest.save()
      }
      return res.status(201).json({ success: true, data: po })
    }

    // ── POST /api/purchase-orders?id=&action= — Workflow actions ────────────
    if (req.method === 'POST' && id && action) {
      const po = await PurchaseOrder.findById(id)
      if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
      const oldStatus = po.status
      let linkedRequestToReopen = null

      // Role authorization for PO actions
      const poRoles = {
        'upload-signed-po': ['manager'],
        'cancel': ['manager'],
        'approve': ['admin', 'super_admin'],
        'reject': ['admin', 'super_admin'],
        'request-revision': ['admin', 'super_admin']
      }
      if (poRoles[action]) {
        if (!poRoles[action].includes(userRole)) {
          return res.status(403).json({ success: false, error: `Action '${action}' requires one of these roles: ${poRoles[action].join(', ')}` })
        }
      }

      if (action === 'upload-signed-po') {
        if (!['DRAFT', 'REVISION_REQUIRED', 'ACTIVE', 'PARTIALLY_FULFILLED'].includes(po.status) || po.signedPo?.status === 'VERIFIED') {
          return res.status(409).json({ success: false, error: 'This purchase order is not eligible for a signed PO upload' })
        }
        if (
          (po.createdById && String(po.createdById) !== String(actorId)) ||
          (!po.createdById && po.createdBy && po.createdBy !== actorName)
        ) {
          return res.status(403).json({ success: false, error: 'Only the manager who generated this PO can upload its signed copy' })
        }
        const { name, url, mimeType, size } = req.body?.document || {}
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        const parsedSize = Number(size || 0)
        if (!name || !url || !allowedTypes.includes(mimeType) || !url.startsWith(`data:${mimeType};base64,`)) {
          return res.status(400).json({ success: false, error: 'Upload a valid JPG, PNG, or WebP photo of the signed PO' })
        }
        if (!Number.isFinite(parsedSize) || parsedSize <= 0 || parsedSize > 4 * 1024 * 1024 || url.length > 5.7 * 1024 * 1024) {
          return res.status(413).json({ success: false, error: 'The signed PO photo must be 4 MB or smaller' })
        }
        po.signedPo = {
          name: String(name).slice(0, 160),
          url,
          mimeType,
          size: parsedSize,
          status: 'VERIFIED',
          previousPoStatus: oldStatus,
          uploadedBy: actorName,
          uploadedById: actorId,
          uploadedAt: new Date(),
          verifiedBy: actorName,
          verifiedById: actorId,
          verifiedAt: new Date(),
          verificationComment: 'Automatically verified when the signed official PO was uploaded'
        }
        po.approvedBy = actorName
        po.approvedAt = new Date()
        po.status = po.signedPo.previousPoStatus === 'PARTIALLY_FULFILLED' ? 'PARTIALLY_FULFILLED' : 'ACTIVE'
        pushHistory(po, oldStatus, po.status, `Signed official PO uploaded by ${actorName}, automatically verified, and activated for QR receiving.`)
      }
      else if (action === 'submit') {
        if (po.status !== 'DRAFT' && po.status !== 'REVISION_REQUIRED') {
          return res.status(400).json({ success: false, error: 'Only DRAFT or REVISION_REQUIRED POs can be submitted' })
        }
        po.status = 'SUBMITTED_FOR_APPROVAL'
        pushHistory(po, oldStatus, 'SUBMITTED_FOR_APPROVAL', 'PO submitted for admin approval')
      }
      else if (action === 'approve') {
        if (po.status !== 'SUBMITTED_FOR_APPROVAL') return res.status(400).json({ success: false, error: 'PO must be in SUBMITTED_FOR_APPROVAL state' })
        if (!po.signedPo?.url) return res.status(400).json({ success: false, error: 'The manager must upload the signed official PO before approval' })
        po.status = 'ACTIVE'
        po.signedPo.status = 'VERIFIED'
        po.signedPo.verifiedBy = actorName
        po.signedPo.verifiedById = actorId
        po.signedPo.verifiedAt = new Date()
        po.signedPo.verificationComment = req.body.comment || 'Signed official PO verified'
        po.approvedBy = actorName
        po.approvedAt = new Date()
        pushHistory(po, oldStatus, 'ACTIVE', `Signed official PO verified and activated by ${actorName}. Total: ₹${po.grandTotal.toFixed(2)}`)
      }
      else if (action === 'reject') {
        const { comment } = req.body
        if (!comment) return res.status(400).json({ success: false, error: 'Rejection comment required' })
        po.status = 'REJECTED'
        pushHistory(po, oldStatus, 'REJECTED', `PO rejected: ${comment}`)
      }
      else if (action === 'request-revision') {
        const { comment } = req.body
        if (!comment) return res.status(400).json({ success: false, error: 'Revision comment required' })
        po.status = 'REVISION_REQUIRED'
        pushHistory(po, oldStatus, 'REVISION_REQUIRED', `Revision requested: ${comment}`)
      }
      else if (action === 'cancel') {
        if (
          (po.createdById && String(po.createdById) !== String(actorId)) ||
          (!po.createdById && po.createdBy && po.createdBy !== actorName)
        ) {
          return res.status(403).json({ success: false, error: 'Only the manager who generated this PO can cancel it' })
        }
        if (!['DRAFT', 'ACTIVE'].includes(po.status)) {
          return res.status(409).json({ success: false, error: 'Only draft or active POs with no received goods can be cancelled' })
        }
        const comment = String(req.body?.comment || '').trim()
        if (comment.length < 5 || comment.length > 500) {
          return res.status(400).json({ success: false, error: 'Provide a cancellation reason between 5 and 500 characters' })
        }
        const hasReceipt = await GoodsReceipt.exists({ poId: po._id })
        if (hasReceipt) {
          return res.status(409).json({ success: false, error: 'This PO has a goods receipt and can no longer be cancelled' })
        }
        po.status = 'CANCELLED'
        pushHistory(po, oldStatus, 'CANCELLED', `Cancelled by ${actorName}. Reason: ${comment}`)
        if (po.requestId) {
          linkedRequestToReopen = await ServiceRequest.findById(po.requestId)
          if (linkedRequestToReopen && linkedRequestToReopen.status === 'PURCHASE_ORDER_CREATED') {
            const previousRequestStatus = linkedRequestToReopen.status
            linkedRequestToReopen.status = 'ASSIGNED_TO_MANAGER'
            linkedRequestToReopen.currentOwnerRole = 'manager'
            linkedRequestToReopen.statusHistory.push({
              oldStatus: previousRequestStatus,
              newStatus: 'ASSIGNED_TO_MANAGER',
              actorId,
              actorName,
              comment: `Purchase order ${po.poNumber} cancelled: ${comment}. Request returned to the manager for a replacement order.`
            })
          } else {
            linkedRequestToReopen = null
          }
        }
      }
      else if (action === 'close') {
        po.status = 'CLOSED'
        pushHistory(po, oldStatus, 'CLOSED', 'PO closed')
      }
      else {
        return res.status(400).json({ success: false, error: 'Invalid action' })
      }

      await po.save()
      if (linkedRequestToReopen) await linkedRequestToReopen.save()
      return res.json({ success: true, data: withoutEmbeddedFiles(po) })
    }

    // ── PATCH /api/purchase-orders?id= — Edit draft PO ───────────────────────
    if (req.method === 'PATCH' && id) {
      const po = await PurchaseOrder.findById(id)
      if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
      if (userRole !== 'manager' || String(po.createdById || '') !== String(actorId)) {
        return res.status(403).json({ success: false, error: 'Only the responsible manager can edit this purchase order' })
      }
      if (!['DRAFT', 'REVISION_REQUIRED'].includes(po.status)) {
        return res.status(400).json({ success: false, error: 'Only DRAFT or REVISION_REQUIRED POs can be edited' })
      }
      if (req.body.items) {
        const existingProductIds = new Map(po.items.map(item => [String(item._id), getProductId(item)]))
        req.body.items = req.body.items.map(item => ({
          ...item,
          productId: existingProductIds.get(String(item._id || '')) || generateProductId()
        }))
      }
      const allowed = ['items', 'deliveryAddress', 'deliveryLocation', 'expectedDeliveryDate', 'paymentTerms', 'warrantyTerms', 'notes', 'deliveryCharge']
      allowed.forEach(f => { if (req.body[f] !== undefined) po[f] = req.body[f] })
      // Recalculate totals if items changed
      if (req.body.items) {
        let subtotal = 0, taxTotal = 0, discountTotal = 0
        po.items.forEach(item => {
          const lineSub = item.quantityOrdered * item.unitPrice
          const lineDiscount = Number(item.discount || 0)
          const lineTax = (lineSub - lineDiscount) * (item.taxRate / 100)
          subtotal += lineSub; discountTotal += lineDiscount; taxTotal += lineTax
        })
        po.subtotal = subtotal; po.taxTotal = taxTotal; po.discountTotal = discountTotal
        po.grandTotal = subtotal - discountTotal + taxTotal + (po.deliveryCharge || 0)
      }
      await po.save()
      return res.json({ success: true, data: withoutEmbeddedFiles(po) })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Purchase Orders API error:', err)
    return res.status(err.status || 500).json({ success: false, error: err.status ? err.message : 'Internal server error' })
  }
}
