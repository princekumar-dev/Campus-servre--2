import { connectToDatabase } from '../lib/mongo.js'
import { GateEntry, DeliverySchedule, PurchaseOrder, User } from '../models.js'
import crypto from 'crypto'
import { verifyPoQrToken } from '../lib/poQrToken.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try { await connectToDatabase() } catch (e) {
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown'
  const actorRole = req.user?.role || req.headers['x-user-role'] || ''

  try {
    const { action, token } = req.query

    // ── GET /api/gate?action=po-details&token=... — PO QR landing data ───────
    if (req.method === 'GET' && action === 'po-details') {
      if (!req.poQrAccess && !['gate', 'super_admin', 'receiving_officer', 'manager'].includes(actorRole)) {
        return res.status(403).json({ success: false, error: 'Gate verification access is required' })
      }

      const poId = verifyPoQrToken(token)
      if (!poId) return res.status(400).json({ success: false, error: 'Invalid or altered purchase-order QR code' })
      if (req.poQrAccess && req.poQrAccess.poId !== poId) {
        return res.status(403).json({ success: false, error: 'QR access does not match this purchase order' })
      }

      const po = await PurchaseOrder.findById(poId).lean()
      if (!po) return res.status(404).json({ success: false, error: 'Purchase Order not found' })
      if (!['ACTIVE', 'PARTIALLY_FULFILLED'].includes(po.status)) {
        return res.status(409).json({ success: false, error: `This PO is ${po.status.replace(/_/g, ' ').toLowerCase()} and cannot receive goods` })
      }

      return res.json({
        success: true,
        data: {
          _id: po._id,
          poNumber: po.poNumber,
          status: po.status,
          vendorName: po.vendorName,
          vendorEmail: po.vendorEmail,
          deliveryAddress: po.deliveryAddress,
          deliveryLocation: po.deliveryLocation,
          expectedDeliveryDate: po.expectedDeliveryDate,
          items: (po.items || []).map(item => ({
            itemId: item._id,
            description: item.description,
            specification: item.specification,
            brand: item.brand,
            model: item.model,
            unit: item.unit,
            quantityOrdered: item.quantityOrdered,
            quantityAccepted: item.quantityAccepted || 0,
            quantityRemaining: item.quantityRemaining ?? item.quantityOrdered
          }))
        }
      })
    }

    // ── GET /api/gate?action=today — Today's entries ────────────────────────
    if (req.method === 'GET' && action === 'today') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
      const entries = await GateEntry.find({
        entryTime: { $gte: todayStart, $lte: todayEnd }
      }).sort({ entryTime: -1 }).lean()
      return res.json({ success: true, data: entries })
    }

    // ── POST /api/gate?action=verify-qr — Scan QR ────────────────────────────
    if (req.method === 'POST' && action === 'verify-qr') {
      const { token, actualPersonName, actualVehicleNumber } = req.body
      if (!token) return res.status(400).json({ success: false, error: 'QR token is required' })

      const tokenHash = hashToken(token)
      const ds = await DeliverySchedule.findOne({ qrTokenHash: tokenHash })

      const result = await validateDelivery(ds, 'QR', res)
      if (result.rejected) return

      await recordEntry(ds, 'QR', 'APPROVED', null, actorId, actorName, actualPersonName, actualVehicleNumber, res)
    }

    // ── POST /api/gate?action=verify-code — Manual code ──────────────────────
    if (req.method === 'POST' && action === 'verify-code') {
      const { code, actualPersonName, actualVehicleNumber } = req.body
      if (!code) return res.status(400).json({ success: false, error: 'Backup code is required' })

      const codeHash = hashToken(String(code))
      const ds = await DeliverySchedule.findOne({ backupCodeHash: codeHash })

      const result = await validateDelivery(ds, 'MANUAL_CODE', res)
      if (result.rejected) return

      await recordEntry(ds, 'MANUAL_CODE', 'APPROVED', null, actorId, actorName, actualPersonName, actualVehicleNumber, res)
    }

    // ── POST /api/gate?action=reject — Reject entry ──────────────────────────
    if (req.method === 'POST' && action === 'reject') {
      const { deliveryScheduleId, reason, actualPersonName, actualVehicleNumber, method } = req.body
      if (!deliveryScheduleId || !reason) return res.status(400).json({ success: false, error: 'deliveryScheduleId and reason are required' })

      const ds = await DeliverySchedule.findById(deliveryScheduleId)
      if (!ds) return res.status(404).json({ success: false, error: 'Delivery not found' })

      const oldStatusBeforeReject = ds.status

      const entry = new GateEntry({
        deliveryScheduleId, poId: ds.poId, poNumber: ds.poNumber,
        verificationMethod: method || 'MANUAL_CODE', decision: 'REJECTED', rejectionReason: reason,
        securityUserId: actorId, securityUserName: actorName,
        actualDeliveryPersonName: actualPersonName || '', actualVehicleNumber: actualVehicleNumber || ''
      })
      await entry.save()

      ds.status = 'ENTRY_REJECTED'
      ds.statusHistory.push({ oldStatus: oldStatusBeforeReject, newStatus: 'ENTRY_REJECTED', actorId, actorName, comment: `Entry rejected: ${reason}`, createdAt: new Date() })
      await ds.save()

      return res.json({ success: true, decision: 'REJECTED', reason, data: entry })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Gate API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

async function validateDelivery(ds, method, res) {
  if (!ds) {
    res.status(404).json({ success: false, decision: 'REJECTED', reason: 'INVALID_PASS', message: 'No delivery found for this pass' })
    return { rejected: true }
  }
  if (ds.passRevoked) {
    res.status(400).json({ success: false, decision: 'REJECTED', reason: 'REVOKED', message: 'This pass has been revoked' })
    return { rejected: true }
  }
  const now = new Date()
  if (ds.passValidUntil && now > ds.passValidUntil) {
    res.status(400).json({ success: false, decision: 'REJECTED', reason: 'EXPIRED', message: 'Pass has expired' })
    return { rejected: true }
  }
  if (['FULLY_RECEIVED', 'EXIT_RECORDED', 'CANCELLED'].includes(ds.status)) {
    res.status(400).json({ success: false, decision: 'REJECTED', reason: 'ALREADY_COMPLETED', message: 'This delivery is already completed or cancelled' })
    return { rejected: true }
  }

  // Verify PO is still active
  const po = await PurchaseOrder.findById(ds.poId).lean()
  if (!po || !['ACTIVE', 'PARTIALLY_FULFILLED'].includes(po.status)) {
    res.status(400).json({ success: false, decision: 'REJECTED', reason: 'PO_INACTIVE', message: 'Purchase Order is no longer active' })
    return { rejected: true }
  }

  return { rejected: false, ds, po }
}

async function recordEntry(ds, method, decision, reason, actorId, actorName, actualPersonName, actualVehicleNumber, res) {
  const entry = new GateEntry({
    deliveryScheduleId: ds._id, poId: ds.poId, poNumber: ds.poNumber,
    verificationMethod: method, decision, rejectionReason: reason,
    securityUserId: actorId, securityUserName: actorName,
    actualDeliveryPersonName: actualPersonName || ds.deliveryPersonName,
    actualVehicleNumber: actualVehicleNumber || ds.vehicleNumber
  })
  await entry.save()

  // Update delivery schedule status
  ds.passUsageCount = (ds.passUsageCount || 0) + 1
  ds.status = 'ENTRY_APPROVED'
  ds.statusHistory.push({ oldStatus: 'PASS_GENERATED', newStatus: 'ENTRY_APPROVED', actorId, actorName, comment: `Gate entry approved via ${method}`, createdAt: new Date() })
  await ds.save()

  return res.json({
    success: true,
    decision: 'APPROVED',
    data: entry,
    delivery: {
      deliveryNumber: ds.deliveryNumber, vendorName: ds.vendorName,
      deliveryPersonName: ds.deliveryPersonName, vehicleNumber: ds.vehicleNumber,
      scheduledDate: ds.scheduledDate, slotStart: ds.slotStart, slotEnd: ds.slotEnd,
      deliveryLocation: ds.deliveryLocation, poNumber: ds.poNumber,
      items: ds.items.map(i => ({ description: i.description, quantityExpected: i.quantityExpected, unit: i.unit }))
    }
  })
}
