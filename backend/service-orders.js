import { GoodsReceipt, PurchaseOrder, ServiceRequest } from '../models.js'
import { getSystemSettings } from '../lib/systemSettings.js'
import { verifyIssuedPoQrToken } from '../lib/poQrToken.js'
import { requireGateLocation } from '../lib/gateGeofence.js'

const allowedRoles = new Set(['vendor', 'service_provider', 'manager', 'admin', 'super_admin'])

function actor(req) {
  return {
    id: String(req.user?.id || req.user?._id || ''),
    name: req.user?.name || req.user?.email || 'Service provider',
    email: String(req.user?.email || '').toLowerCase(),
    role: req.user?.role || ''
  }
}

async function loadServiceOrder(id) {
  const po = await PurchaseOrder.findById(id)
  if (!po) return { error: 'Service purchase order not found', status: 404 }
  const request = po.requestId ? await ServiceRequest.findById(po.requestId).lean() : null
  if (request?.adminAssessment?.requirementType !== 'MAINTENANCE') {
    return { error: 'This purchase order uses the goods receiving workflow', status: 409 }
  }
  return { po, request }
}

function canAccess(po, user) {
  if (!allowedRoles.has(user.role)) return false
  if (user.role === 'service_provider') {
    return (!po.serviceProviderId && !po.serviceProviderEmail) ||
      String(po.serviceProviderId || '') === String(user.id || '') ||
      String(po.serviceProviderEmail || '').toLowerCase() === user.email
  }
  if (user.role !== 'vendor') return true
  return !po.vendorEmail || po.vendorEmail.toLowerCase() === user.email
}

export default async function serviceOrdersHandler(req, res) {
  try {
    const id = String(req.query.id || req.body?.poId || '')
    const user = actor(req)
    if (!allowedRoles.has(user.role)) return res.status(403).json({ success: false, error: 'Service-provider access is required' })
    const suppliedToken = req.method === 'GET' ? req.query.token : req.body?.qrToken
    if (suppliedToken) {
      if (user.role !== 'service_provider' || req.user?.scanPortal !== 'service' || req.user?.scanTarget !== `/service/po/${id}`) {
        return res.status(403).json({ success: false, code: 'SCAN_LOGIN_REQUIRED', error: 'Sign in with the service-provider account to scan this Service PO' })
      }
      const qrPoId = await verifyIssuedPoQrToken(suppliedToken)
      if (!qrPoId || qrPoId !== id) {
        return res.status(403).json({ success: false, code: 'INVALID_PO_QR', error: 'Invalid or altered Service PO QR code' })
      }
      if (!requireGateLocation(req, res).allowed) return
    }
    if (!id && req.method === 'GET') {
      const serviceRequests = await ServiceRequest.find({ 'adminAssessment.requirementType': 'MAINTENANCE' }).select('_id title location assetCode').lean()
      const requestById = new Map(serviceRequests.map(request => [String(request._id), request]))
      const filter = { requestId: { $in: serviceRequests.map(request => request._id) } }
      if (user.role === 'vendor') filter.vendorEmail = user.email
      if (user.role === 'service_provider') filter.$or = [
        { serviceProviderId: user.id },
        { serviceProviderEmail: user.email },
        { serviceProviderId: { $exists: false }, serviceProviderEmail: { $exists: false } }
      ]
      const orders = await PurchaseOrder.find(filter)
        .select('-signedPo.url -qrTokenHash -documentUrl -serviceExecution.workEvidence.url -serviceExecution.expenses.bill.url -statusHistory')
        .sort({ createdAt: -1 })
        .lean()
      return res.json({ success: true, data: orders.map(order => ({ ...order, request: requestById.get(String(order.requestId)) })) })
    }
    if (!id) return res.status(400).json({ success: false, error: 'Service PO id is required' })
    const loaded = await loadServiceOrder(id)
    if (loaded.error) return res.status(loaded.status).json({ success: false, error: loaded.error })
    const { po, request } = loaded
    if (!canAccess(po, user)) return res.status(403).json({ success: false, code: 'SERVICE_PO_NOT_ASSIGNED', error: 'This service order is not assigned to your account' })

    if (req.method === 'GET') {
      return res.json({ success: true, data: po.toObject(), request })
    }
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

    const action = req.query.action
    po.serviceExecution ||= {}
    po.serviceExecution.expenses ||= []
    po.serviceExecution.workEvidence ||= []
    if (action === 'start') {
      po.serviceExecution.status = 'IN_PROGRESS'
      po.serviceExecution.startedAt ||= new Date()
      po.serviceExecution.technicianName = String(req.body.technicianName || user.name).trim()
    } else if (action === 'expense') {
      const amount = Number(req.body.amount)
      const category = String(req.body.category || 'OTHER').toUpperCase()
      const categoryLabels = { PARTS: 'Parts', LABOUR: 'Labour', TRANSPORT: 'Transport', TAX: 'Tax', OTHER: 'Other' }
      const description = String(req.body.description || '').trim() || categoryLabels[category] || 'Service cost'
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Enter a cost greater than zero' })
      }
      const bill = req.body.bill
      if (!bill?.url) return res.status(400).json({ success: false, error: 'Upload the scanned bill for this cost' })
      po.serviceExecution.status = 'IN_PROGRESS'
      po.serviceExecution.startedAt ||= new Date()
      po.serviceExecution.expenses.push({
        category, description, amount,
        bill: { name: bill.name, url: bill.url, mimeType: bill.mimeType, size: bill.size },
        uploadedBy: user.name
      })
    } else if (action === 'evidence') {
      const file = req.body.file
      if (!file?.url) return res.status(400).json({ success: false, error: 'Choose a work photo or service document' })
      po.serviceExecution.workEvidence.push({
        name: file.name, url: file.url, mimeType: file.mimeType, size: file.size,
        note: String(req.body.note || '').trim(), uploadedBy: user.name
      })
    } else if (action === 'submit') {
      const systemSettings = await getSystemSettings()
      if (!po.serviceExecution.expenses.length) {
        return res.status(400).json({ success: false, error: 'Add at least one repair cost and scanned bill before submitting' })
      }
      if (systemSettings.requireCompletionPhotos && !po.serviceExecution.workEvidence.length) {
        return res.status(400).json({ success: false, error: 'Add at least one completion photo before submitting completed work' })
      }
      po.serviceExecution.status = 'SUBMITTED'
      po.serviceExecution.completedAt = new Date()
      po.serviceExecution.serviceSummary = String(req.body.serviceSummary || '').trim()
    } else if (action === 'approve-grn') {
      // Completing through the signed service-PO workspace is the service
      // equivalent of gate QR confirmation. It must be able to finish records
      // that were submitted by the service provider, including older records
      // left at SUBMITTED by the previous two-step UI.
      if (po.serviceExecution.status !== 'SUBMITTED') {
        return res.status(409).json({ success: false, error: 'The service provider must submit completed work before GRN approval' })
      }
      const existing = await GoodsReceipt.findOne({ poId: po._id, source: 'SERVICE_PO', status: 'FINALIZED' })
      if (existing) return res.status(409).json({ success: false, error: `Service GRN ${existing.grnNumber} already exists` })

      const expenses = po.serviceExecution.expenses || []
      const actualTotal = Math.round(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) * 100) / 100
      const year = new Date().getFullYear()
      const grnNumber = `SGRN-${year}-${Math.floor(Math.random() * 900000) + 100000}`
      const grn = await GoodsReceipt.create({
        grnNumber,
        poId: po._id,
        poNumber: po.poNumber,
        grnType: 'FINAL',
        status: 'FINALIZED',
        source: 'SERVICE_PO',
        receivedBy: user.id,
        receivedByName: user.name,
        remarks: `Service completion approved against ${po.poNumber}`,
        items: expenses.map((expense, index) => ({
          productId: `SERVICE-${String(index + 1).padStart(3, '0')}`,
          poItemDescription: `${expense.category}: ${expense.description}`,
          quantityOrdered: 1,
          quantityDeliveredNow: 1,
          quantityAcceptedNow: 1,
          quantityRemaining: 0,
          unit: 'service',
          unitPrice: Number(expense.amount || 0),
          lineSubtotal: Number(expense.amount || 0),
          taxableAmount: Number(expense.amount || 0),
          lineTotal: Number(expense.amount || 0),
          remarks: expense.bill?.name ? `Verified bill: ${expense.bill.name}` : undefined
        })),
        subtotal: actualTotal,
        grandTotal: actualTotal,
        cumulativeAcceptedValue: actualTotal,
        poGrandTotal: Number(po.grandTotal || 0),
        serviceReceipt: {
          summary: po.serviceExecution.serviceSummary,
          technicianName: po.serviceExecution.technicianName,
          completedAt: po.serviceExecution.completedAt,
          expenseCount: expenses.length,
          billCount: expenses.filter(expense => expense.bill?.url).length,
          evidenceCount: po.serviceExecution.workEvidence?.length || 0
        }
      })
      const oldStatus = po.status
      po.status = 'CLOSED'
      po.serviceExecution.status = 'COMPLETED'
      po.statusHistory.push({
        oldStatus, newStatus: 'CLOSED', actorId: user.id, actorName: user.name,
        comment: `Completed service and actual costs approved in ${grnNumber}`, createdAt: new Date()
      })
      if (po.requestId) {
        const serviceRequest = await ServiceRequest.findById(po.requestId)
        if (serviceRequest && serviceRequest.status !== 'CLOSED') {
          const previousStatus = serviceRequest.status
          serviceRequest.status = 'CLOSED'
          serviceRequest.currentOwnerRole = null
          serviceRequest.closedAt = new Date()
          serviceRequest.statusHistory.push({
            oldStatus: previousStatus, newStatus: 'CLOSED', actorId: user.id, actorName: user.name,
            comment: `Service completion approved and ${grnNumber} generated`
          })
          await serviceRequest.save()
        }
      }
      await po.save()
      return res.json({ success: true, data: po.toObject(), grn })
    } else {
      return res.status(400).json({ success: false, error: 'Unknown service action' })
    }
    await po.save()
    return res.json({ success: true, data: po.toObject() })
  } catch (error) {
    console.error('Service Orders API error:', error)
    return res.status(500).json({ success: false, error: error.message || 'Unable to update service order' })
  }
}
