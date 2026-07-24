import { PurchaseOrder, Vendor, User, ServiceRequest, GoodsReceipt } from '../models.js'

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
import { connectToDatabase } from '../lib/mongo.js'
import { addProductIds, generateProductId, getProductId } from '../lib/productId.js'
import { storeNotification } from '../lib/notificationService.js'

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
      await reconcileLegacyQrClosures()
      if (id) {
        const po = await PurchaseOrder.findById(id).lean()
        if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
        po.items = addProductIds(po.items)
        return res.json({ success: true, data: po })
      }
      const filter = {}
      if (req.query.status) filter.status = req.query.status
      if (req.query.vendorId) filter.vendorId = req.query.vendorId
      if (req.query.requestId) filter.requestId = req.query.requestId
      if (userRole === 'vendor') {
        // Vendors see their own POs only
        const vendorDocs = await Vendor.find({ email: actor?.email }).lean()
        if (vendorDocs.length > 0) filter.vendorId = vendorDocs[0]._id
      }
      const pos = await PurchaseOrder.find(filter).select('-signedPo.url -documentUrl').sort({ createdAt: -1 }).lean()
      pos.forEach(po => { po.items = addProductIds(po.items) })
      return res.json({ success: true, data: pos, total: pos.length })
    }

    // ── POST /api/purchase-orders — Create PO ─────────────────────────────────
    if (req.method === 'POST' && !id) {
      if (userRole !== 'manager') {
        return res.status(403).json({ success: false, error: 'Only the assigned manager can generate a purchase order' })
      }
      const { vendorId, requestId, items, deliveryAddress, deliveryLocation, expectedDeliveryDate, paymentTerms, warrantyTerms, notes, deliveryCharge } = req.body
      if (!vendorId || !Array.isArray(items) || !items.length || !deliveryAddress) {
        return res.status(400).json({ success: false, error: 'A vendor, at least one item, and a delivery address are required' })
      }
      if (items.some(item => !String(item.description || '').trim())) {
        return res.status(400).json({ success: false, error: 'Every purchase order item needs a product description' })
      }
      const vendor = await Vendor.findById(vendorId).lean()
      if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' })
      if (vendor.status !== 'ACTIVE') return res.status(400).json({ success: false, error: 'Vendor is not active' })
      let serviceRequest = null
      if (requestId) {
        serviceRequest = await ServiceRequest.findById(requestId)
        if (!serviceRequest) return res.status(404).json({ success: false, error: 'Service request not found' })
        if (userRole === 'manager' && String(serviceRequest.assignedManagerId) !== String(actorId)) {
          return res.status(403).json({ success: false, error: 'This request is not assigned to you' })
        }
        const existingPo = await PurchaseOrder.findOne({ requestId }).lean()
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
        const requestedUnit = String(serviceRequest.requestedUnit || 'pcs').trim().toLowerCase()
        const submittedItem = items[0]
        if (
          items.length !== 1 ||
          String(submittedItem?.description || '').trim().toLowerCase() !== requestedDescription ||
          Number(submittedItem?.quantityOrdered) !== requestedQuantity ||
          String(submittedItem?.unit || '').trim().toLowerCase() !== requestedUnit
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
        const qty = Number(item.quantityOrdered || 1)
        const price = Number(item.unitPrice || 0)
        const parsedTaxRate = Number(item.taxRate)
        const taxRate = Number.isFinite(parsedTaxRate) ? Math.min(100, Math.max(0, parsedTaxRate)) : 18
        const discount = Number(item.discount || 0)
        const lineSubtotal = qty * price
        const lineDiscount = discount
        const lineTax = (lineSubtotal - lineDiscount) * (taxRate / 100)
        const lineTotal = lineSubtotal - lineDiscount + lineTax
        subtotal += lineSubtotal; discountTotal += lineDiscount; taxTotal += lineTax
        return { ...item, productId: generateProductId(), quantityOrdered: qty, unitPrice: price, taxRate, discount, lineTotal, quantityAccepted: 0, quantityRemaining: qty }
      })
      const dc = Number(deliveryCharge || 0)
      const grandTotal = subtotal - discountTotal + taxTotal + dc

      const year = new Date().getFullYear()
      const rnd = Math.floor(Math.random() * 900000) + 100000
      const poNumber = `PO-${year}-${rnd}`

      const po = new PurchaseOrder({
        poNumber, requestId, vendorId, vendorName: vendor.legalName, vendorEmail: vendor.email,
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

      // Role authorization for PO actions
      const poRoles = {
        'upload-signed-po': ['manager'],
        'verify-signed-po': ['admin', 'super_admin'],
        'reject-signed-po': ['admin', 'super_admin'],
        'approve': ['admin', 'super_admin'],
        'reject': ['admin', 'super_admin'],
        'request-revision': ['admin', 'super_admin'],
        'send-to-vendor': ['admin', 'super_admin', 'manager']
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
          status: 'PENDING_VERIFICATION',
          previousPoStatus: oldStatus,
          uploadedBy: actorName,
          uploadedById: actorId,
          uploadedAt: new Date()
        }
        po.status = 'SUBMITTED_FOR_APPROVAL'
        pushHistory(po, oldStatus, po.status, `Signed official PO uploaded: ${String(name).slice(0, 160)}. Awaiting verification.`)
      }
      else if (action === 'verify-signed-po') {
        if (po.status !== 'SUBMITTED_FOR_APPROVAL' || !po.signedPo?.url || po.signedPo?.status !== 'PENDING_VERIFICATION') {
          return res.status(409).json({ success: false, error: 'A pending signed PO upload is required before verification' })
        }
        po.signedPo.status = 'VERIFIED'
        po.signedPo.verifiedBy = actorName
        po.signedPo.verifiedById = actorId
        po.signedPo.verifiedAt = new Date()
        po.signedPo.verificationComment = req.body.comment || 'Signed official PO verified'
        po.approvedBy = actorName
        po.approvedAt = new Date()
        po.status = po.signedPo.previousPoStatus === 'PARTIALLY_FULFILLED' ? 'PARTIALLY_FULFILLED' : 'ACTIVE'
        pushHistory(po, oldStatus, po.status, `Signed official PO verified by ${actorName}. PO activated for QR receiving.${req.body.comment ? ` ${req.body.comment}` : ''}`)
      }
      else if (action === 'reject-signed-po') {
        if (po.status !== 'SUBMITTED_FOR_APPROVAL' || !po.signedPo?.url) {
          return res.status(409).json({ success: false, error: 'A signed PO awaiting verification is required' })
        }
        const decisionComment = String(req.body.comment || '').trim()
        if (!decisionComment) return res.status(400).json({ success: false, error: 'A rejection reason is required' })
        po.signedPo.status = 'REJECTED'
        po.signedPo.verifiedBy = actorName
        po.signedPo.verifiedById = actorId
        po.signedPo.verifiedAt = new Date()
        po.signedPo.verificationComment = decisionComment
        po.status = 'REVISION_REQUIRED'
        pushHistory(po, oldStatus, po.status, `Signed PO rejected by ${actorName}: ${decisionComment}`)
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
      else if (action === 'send-to-vendor') {
        if (po.status !== 'APPROVED') return res.status(400).json({ success: false, error: 'PO must be APPROVED before sending to vendor' })
        po.status = 'SENT_TO_VENDOR'
        pushHistory(po, oldStatus, 'SENT_TO_VENDOR', `PO sent to vendor ${po.vendorName}`)
      }
      else if (action === 'vendor-accept') {
        if (po.status !== 'SENT_TO_VENDOR') return res.status(400).json({ success: false, error: 'PO must be in SENT_TO_VENDOR state' })
        po.status = 'VENDOR_ACCEPTED'
        po.vendorAcceptedAt = new Date()
        pushHistory(po, oldStatus, 'VENDOR_ACCEPTED', `PO accepted by vendor ${po.vendorName}`)
        // Move to ACTIVE
        po.status = 'ACTIVE'
        pushHistory(po, 'VENDOR_ACCEPTED', 'ACTIVE', 'PO is now active and ready for delivery scheduling')
      }
      else if (action === 'vendor-reject') {
        const { reason } = req.body
        po.status = 'VENDOR_REJECTED'
        po.vendorRejectionReason = reason || 'No reason provided'
        pushHistory(po, oldStatus, 'VENDOR_REJECTED', `Vendor rejected PO: ${po.vendorRejectionReason}`)
      }
      else if (action === 'cancel') {
        if (['FULFILLED', 'CLOSED'].includes(po.status)) return res.status(400).json({ success: false, error: 'Cannot cancel a fulfilled or closed PO' })
        po.status = 'CANCELLED'
        pushHistory(po, oldStatus, 'CANCELLED', req.body.comment || 'PO cancelled')
      }
      else if (action === 'close') {
        po.status = 'CLOSED'
        pushHistory(po, oldStatus, 'CLOSED', 'PO closed')
      }
      else {
        return res.status(400).json({ success: false, error: 'Invalid action' })
      }

      await po.save()
      if (action === 'upload-signed-po') {
        const approvers = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true }).select('email').lean()
        await Promise.allSettled(approvers.map(approver => storeNotification({
          userEmail: approver.email,
          title: `Signed PO awaiting verification: ${po.poNumber}`,
          body: `${actorName} uploaded the signed official PO for ${po.vendorName}.`,
          url: `/purchase-orders/${po._id}`,
          type: 'signed_po_uploaded',
          data: { poId: po._id, poNumber: po.poNumber }
        })))
      }
      if (['verify-signed-po', 'reject-signed-po'].includes(action) && po.createdById) {
        const manager = await User.findById(po.createdById).select('email').lean()
        if (manager?.email) {
          await storeNotification({
            userEmail: manager.email,
            title: action === 'verify-signed-po' ? `PO verified and active: ${po.poNumber}` : `Signed PO needs revision: ${po.poNumber}`,
            body: action === 'verify-signed-po'
              ? 'The signed official PO was verified. Gate QR receiving and GRN creation are now enabled.'
              : `The signed PO was rejected: ${po.signedPo.verificationComment}`,
            url: `/purchase-orders/${po._id}`,
            type: action === 'verify-signed-po' ? 'signed_po_verified' : 'signed_po_rejected',
            data: { poId: po._id, poNumber: po.poNumber }
          }).catch(error => console.warn('Unable to store signed PO workflow notification:', error.message))
        }
      }
      return res.json({ success: true, data: po })
    }

    // ── PATCH /api/purchase-orders?id= — Edit draft PO ───────────────────────
    if (req.method === 'PATCH' && id) {
      const po = await PurchaseOrder.findById(id)
      if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
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
      return res.json({ success: true, data: po })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Purchase Orders API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
