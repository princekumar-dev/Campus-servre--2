import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, User } from '../models.js'
import { finalizeRequestWorkflow } from '../lib/workflowEngine.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in invoices API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const { action, id, requestId } = req.query
  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown User'
  const actorRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')

  try {
    // 1. Create or Revise Invoice
    if (req.method === 'POST' && !action && requestId) {
      const request = await ServiceRequest.findById(requestId)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })
      if (actorRole !== 'super_admin') return res.status(403).json({ success: false, error: 'Managers generate purchase orders directly for assigned requests' })
      if (!['SERVICE_VERIFIED', 'INVOICE_REVISION_REQUIRED'].includes(request.status)) return res.status(409).json({ success: false, error: 'An invoice can only be drafted after service verification or a revision request' })

      const { items, discountTotal } = req.body
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one line item is required' })
      }

      let subtotal = 0
      let taxTotal = 0
      const discount = Number(discountTotal || 0)

      const processedItems = items.map(item => {
        const qty = Number(item.quantity || 1)
        const price = Number(item.unitPrice || 0)
        const taxRate = Number(item.taxRate || 18)
        
        const lineSubtotal = qty * price
        const lineTax = lineSubtotal * (taxRate / 100)
        const lineTotal = lineSubtotal + lineTax

        subtotal += lineSubtotal
        taxTotal += lineTax

        return {
          description: item.description,
          quantity: qty,
          unit: item.unit || 'pcs',
          unitPrice: price,
          taxRate,
          lineTotal
        }
      })

      const grandTotal = subtotal - discount + taxTotal
      const oldStatus = request.status

      const newVersion = request.invoice && request.invoice.version ? request.invoice.version + 1 : 1
      const year = new Date().getFullYear()
      const randomNum = Math.floor(Math.random() * 90000) + 10000
      const invoiceNumber = request.invoice && request.invoice.invoiceNumber ? request.invoice.invoiceNumber : `INV-${year}-${randomNum}`

      request.invoice = {
        invoiceNumber,
        version: newVersion,
        status: 'DRAFT',
        subtotal,
        taxTotal,
        discountTotal: discount,
        grandTotal,
        balanceDue: grandTotal,
        createdBy: actorName,
        items: processedItems
      }

      request.status = 'INVOICE_IN_PROGRESS'
      request.statusHistory.push({
        oldStatus,
        newStatus: 'INVOICE_IN_PROGRESS',
        actorId,
        actorName,
        comment: `Invoice (v${newVersion}) drafted by manager`
      })

      await finalizeRequestWorkflow(request, { id: actorId, name: actorName, role: actorRole })
      await request.save()
      return res.status(200).json({ success: true, data: request })
    }

    // 2. Perform invoice action
    if (req.method === 'POST' && action && id) {
      const request = await ServiceRequest.findById(id)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })
      if (!request.invoice) return res.status(400).json({ success: false, error: 'No invoice found for this request' })

      // Role authorization for invoice actions
      const invoiceRoles = {
        'approve': ['super_admin', 'accounts'],
        'reject': ['super_admin', 'accounts'],
        'revise': ['super_admin', 'accounts'],
        'submit': ['super_admin', 'vendor']
      }
      if (invoiceRoles[action]) {
        if (!invoiceRoles[action].includes(actorRole)) {
          return res.status(403).json({ success: false, error: `Action '${action}' requires one of these roles: ${invoiceRoles[action].join(', ')}` })
        }
      }

      const oldStatus = request.status
      const allowedStatuses = {
        submit: ['INVOICE_IN_PROGRESS'],
        approve: ['INVOICE_SUBMITTED'],
        reject: ['INVOICE_SUBMITTED'],
        revise: ['INVOICE_SUBMITTED']
      }
      if (allowedStatuses[action] && !allowedStatuses[action].includes(request.status)) {
        return res.status(409).json({ success: false, error: `Action '${action}' is not available while the invoice is ${request.status.replace(/_/g, ' ').toLowerCase()}` })
      }

      if (action === 'submit') {
        request.invoice.status = 'SUBMITTED'
        request.status = 'INVOICE_SUBMITTED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'INVOICE_SUBMITTED',
          actorId,
          actorName,
          comment: `Invoice v${request.invoice.version} submitted for admin review`
        })
      }
      else if (action === 'approve') {
        request.invoice.status = 'APPROVED'
        request.invoice.approvedBy = actorName
        request.invoice.approvedAt = new Date()
        request.status = 'PAYMENT_PENDING'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'PAYMENT_PENDING',
          actorId,
          actorName,
          comment: `Invoice v${request.invoice.version} approved by Admin. Awaiting payment: ₹${request.invoice.grandTotal.toFixed(2)}`
        })
      }
      else if (action === 'reject') {
        const { comment } = req.body
        if (!comment) return res.status(400).json({ success: false, error: 'Rejection comment is required' })

        request.invoice.status = 'REJECTED'
        request.status = 'INVOICE_REJECTED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'INVOICE_REJECTED',
          actorId,
          actorName,
          comment: `Invoice rejected. Reason: ${comment}`
        })
      }
      else if (action === 'revise') {
        const { comment } = req.body
        if (!comment) return res.status(400).json({ success: false, error: 'Revision details are required' })

        request.invoice.status = 'REVISION_REQUIRED'
        request.status = 'INVOICE_REVISION_REQUIRED'
        request.statusHistory.push({
          oldStatus,
          newStatus: 'INVOICE_REVISION_REQUIRED',
          actorId,
          actorName,
          comment: `Invoice revision requested: ${comment}`
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
    console.error('Error in invoices API:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
