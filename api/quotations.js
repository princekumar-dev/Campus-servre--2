import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, PurchaseOrder, User } from '../models.js'
import { finalizeRequestWorkflow } from '../lib/workflowEngine.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in quotations API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const { action, id, requestId } = req.query
  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown User'
  const actorRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')

  try {
    // List quotations. Quotations are stored as subdocuments on service requests,
    // so expose a flat collection for the manager quotations screen.
    if (req.method === 'GET' && !action && !id && !requestId) {
      const query = {}

      // Managers may only see quotations belonging to requests assigned to them.
      // Administrative oversight roles can see the complete quotation register.
      if (actorRole === 'manager') query.assignedManagerId = actorId
      else if (!['admin', 'super_admin'].includes(actorRole)) {
        return res.status(403).json({ success: false, error: 'You do not have permission to view quotations' })
      }

      const requests = await ServiceRequest.find(query)
        .select('requestNumber title requesterName assignedManagerId assignedManagerName quotation createdAt')
        .sort({ 'quotation.approvedAt': -1, createdAt: -1 })
        .lean()

      // Older POs may predate quotation snapshots. Include them as vendor-price
      // quotations so existing records are visible without data recreation.
      const requestIds = requests.map(request => request._id)
      const purchaseOrders = requestIds.length
        ? await PurchaseOrder.find({ requestId: { $in: requestIds } }).sort({ createdAt: -1 }).lean()
        : []
      const poByRequest = new Map(purchaseOrders.map(po => [String(po.requestId), po]))

      const quotations = requests.map(request => {
        const po = poByRequest.get(String(request._id))
        const quotation = request.quotation?.quotationNumber ? request.quotation : (po ? {
          quotationNumber: String(po.poNumber || '').replace(/^PO-/, 'QUO-'),
          version: 1,
          status: 'APPROVED',
          subtotal: po.subtotal,
          taxTotal: po.taxTotal,
          discountTotal: po.discountTotal,
          additionalCharges: po.deliveryCharge,
          grandTotal: po.grandTotal,
          validUntil: po.expectedDeliveryDate,
          terms: po.paymentTerms,
          createdBy: po.vendorName,
          approvedBy: po.createdBy,
          approvedAt: po.createdAt,
          items: (po.items || []).map(item => ({
            itemType: 'MATERIAL', description: item.description,
            quantity: item.quantityOrdered, unit: item.unit,
            unitPrice: item.unitPrice, taxRate: item.taxRate,
            discount: item.discount, lineTotal: item.lineTotal
          }))
        } : null)
        if (!quotation) return null
        return {
        ...quotation,
        _id: request._id,
        requestId: request._id,
        requestNumber: request.requestNumber,
        requestTitle: request.title,
        requesterName: request.requesterName,
        assignedManagerId: request.assignedManagerId,
        assignedManagerName: request.assignedManagerName,
        vendorName: quotation.createdBy || 'CampusServe quotation',
        createdAt: request.createdAt
      }}).filter(Boolean)

      return res.status(200).json({ success: true, data: quotations })
    }

    // 1. Create or Revise Quotation (updates subdocument)
    if (req.method === 'POST' && !action && requestId) {
      const request = await ServiceRequest.findById(requestId)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })
      if (actorRole !== 'super_admin') return res.status(403).json({ success: false, error: 'Managers generate purchase orders directly for assigned requests' })
      if (!['QUOTATION_IN_PROGRESS', 'QUOTATION_REVISION_REQUIRED'].includes(request.status)) return res.status(409).json({ success: false, error: 'A quotation can only be drafted after inspection or a revision request' })

      const { items, terms, validUntil } = req.body
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one line item is required' })
      }

      // Calculate totals
      let subtotal = 0
      let taxTotal = 0
      let discountTotal = 0

      const processedItems = items.map(item => {
        const qty = Number(item.quantity || 1)
        const price = Number(item.unitPrice || 0)
        const taxRate = Number(item.taxRate || 18)
        const discount = Number(item.discount || 0)
        
        const lineSubtotal = qty * price
        const lineDiscount = discount
        const lineTax = (lineSubtotal - lineDiscount) * (taxRate / 100)
        const lineTotal = lineSubtotal - lineDiscount + lineTax

        subtotal += lineSubtotal
        discountTotal += lineDiscount
        taxTotal += lineTax

        return {
          itemType: item.itemType || 'MATERIAL',
          description: item.description,
          quantity: qty,
          unit: item.unit || 'pcs',
          unitPrice: price,
          taxRate,
          discount,
          lineTotal
        }
      })

      const grandTotal = subtotal - discountTotal + taxTotal
      const oldStatus = request.status

      // Increments version if replacing
      const newVersion = request.quotation && request.quotation.version ? request.quotation.version + 1 : 1
      const year = new Date().getFullYear()
      const randomNum = Math.floor(Math.random() * 90000) + 10000
      const quotationNumber = request.quotation && request.quotation.quotationNumber ? request.quotation.quotationNumber : `QUO-${year}-${randomNum}`

      request.quotation = {
        quotationNumber,
        version: newVersion,
        status: 'DRAFT',
        subtotal,
        taxTotal,
        discountTotal,
        additionalCharges: 0,
        grandTotal,
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        terms: terms || 'Standard maintenance quotation terms apply.',
        createdBy: actorName,
        items: processedItems
      }

      request.status = 'QUOTATION_IN_PROGRESS'
      request.statusHistory.push({
        oldStatus,
        newStatus: 'QUOTATION_IN_PROGRESS',
        actorId,
        actorName,
        comment: `Quotation (v${newVersion}) created as draft`
      })

      await finalizeRequestWorkflow(request, { id: actorId, name: actorName, role: actorRole })
      await request.save()
      return res.status(200).json({ success: true, data: request })
    }

    // 2. Actions on quotations
    if (req.method === 'POST' && action && id) {
      const request = await ServiceRequest.findById(id)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })
      if (!request.quotation) return res.status(400).json({ success: false, error: 'No quotation found for this request' })

      // Role authorization for quotation actions
      const quotationRoles = {
        'approve': ['super_admin'],
        'reject': ['super_admin'],
        'revise': ['super_admin'],
        'submit': ['super_admin']
      }
      if (quotationRoles[action]) {
        if (!quotationRoles[action].includes(actorRole)) {
          return res.status(403).json({ success: false, error: `Action '${action}' requires one of these roles: ${quotationRoles[action].join(', ')}` })
        }
      }

      const oldStatus = request.status
      const allowedStatuses = {
        submit: ['QUOTATION_IN_PROGRESS'],
        approve: ['QUOTATION_SUBMITTED'],
        reject: ['QUOTATION_SUBMITTED'],
        revise: ['QUOTATION_SUBMITTED']
      }
      if (allowedStatuses[action] && !allowedStatuses[action].includes(request.status)) {
        return res.status(409).json({ success: false, error: `Action '${action}' is not available while the quotation is ${request.status.replace(/_/g, ' ').toLowerCase()}` })
      }

      if (action === 'submit') {
        request.quotation.status = 'SUBMITTED'
        request.status = 'QUOTATION_SUBMITTED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'QUOTATION_SUBMITTED',
          actorId,
          actorName,
          comment: `Quotation v${request.quotation.version} submitted for admin review`
        })
      }
      else if (action === 'approve') {
        request.quotation.status = 'APPROVED'
        request.quotation.approvedBy = actorName
        request.quotation.approvedAt = new Date()
        request.status = 'QUOTATION_APPROVED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'QUOTATION_APPROVED',
          actorId,
          actorName,
          comment: `Quotation v${request.quotation.version} approved by Admin. Approved Budget: ₹${request.quotation.grandTotal.toFixed(2)}`
        })
      }
      else if (action === 'reject') {
        const { comment } = req.body
        if (!comment) return res.status(400).json({ success: false, error: 'Rejection comment is required' })

        request.quotation.status = 'REJECTED'
        request.status = 'QUOTATION_REJECTED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'QUOTATION_REJECTED',
          actorId,
          actorName,
          comment: `Quotation rejected. Reason: ${comment}`
        })
      }
      else if (action === 'revise') {
        const { comment } = req.body
        if (!comment) return res.status(400).json({ success: false, error: 'Revision requests must contain a comment' })

        request.quotation.status = 'REVISION_REQUIRED'
        request.status = 'QUOTATION_REVISION_REQUIRED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'QUOTATION_REVISION_REQUIRED',
          actorId,
          actorName,
          comment: `Quotation revision requested. Details: ${comment}`
        })
      }
      else {
        return res.status(400).json({ success: false, error: 'Invalid action' })
      }

      await finalizeRequestWorkflow(request, { id: actorId, name: actorName, role: actorRole })
      await request.save()
      return res.status(200).json({ success: true, data: request })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (error) {
    console.error('Error in quotations API:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
