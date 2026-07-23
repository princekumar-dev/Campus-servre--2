import { connectToDatabase } from '../lib/mongo.js'
import { DeliverySchedule, PurchaseOrder, GateEntry, User, DeliveryPerson, Vehicle } from '../models.js'
import crypto from 'crypto'
import { addProductIds } from '../lib/productId.js'
import { canReceivePo, getPoReceivingBlockReason } from '../lib/poReceiving.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const genRandom = (len) => crypto.randomBytes(len).toString('hex').slice(0, len)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try { await connectToDatabase() } catch (e) {
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const userRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown'

  const pushHistory = (ds, oldStatus, newStatus, comment) => {
    ds.statusHistory.push({ oldStatus, newStatus, actorId, actorName, comment, createdAt: new Date() })
  }

  try {
    const { id, action, sub } = req.query

    // ── GET /api/deliveries ────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (id) {
        const ds = await DeliverySchedule.findById(id).lean()
        if (!ds) return res.status(404).json({ success: false, error: 'Delivery not found' })
        // Fetch gate entries
        const entries = await GateEntry.find({ deliveryScheduleId: id }).sort({ entryTime: -1 }).lean()
        return res.json({ success: true, data: ds, gateEntries: entries })
      }

      // Today's deliveries for gate view
      if (sub === 'today') {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
        const deliveries = await DeliverySchedule.find({
          scheduledDate: { $gte: todayStart, $lte: todayEnd }
        }).sort({ scheduledDate: 1 }).lean()
        return res.json({ success: true, data: deliveries })
      }

      const filter = {}
      if (req.query.poId) filter.poId = req.query.poId
      if (req.query.status) filter.status = req.query.status
      const deliveries = await DeliverySchedule.find(filter).sort({ scheduledDate: -1 }).lean()
      return res.json({ success: true, data: deliveries, total: deliveries.length })
    }

    // ── POST /api/deliveries — Schedule delivery ───────────────────────────────
    if (req.method === 'POST' && !id) {
      const { poId, deliveryPersonId, vehicleId, scheduledDate, slotStart, slotEnd, deliveryLocation, challanNumber, items } = req.body
      if (!poId || !scheduledDate || !deliveryLocation) {
        return res.status(400).json({ success: false, error: 'poId, scheduledDate, and deliveryLocation are required' })
      }

      const po = await PurchaseOrder.findById(poId).lean()
      if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
      if (!canReceivePo(po)) {
        return res.status(409).json({ success: false, error: getPoReceivingBlockReason(po) })
      }

      let dpName = '', dpPhone = '', vNumber = ''
      if (deliveryPersonId) {
        const dp = await DeliveryPerson.findById(deliveryPersonId).lean()
        if (dp) { dpName = dp.name; dpPhone = dp.phone }
      }
      if (vehicleId) {
        const v = await Vehicle.findById(vehicleId).lean()
        if (v) vNumber = v.vehicleNumber
      }

      const year = new Date().getFullYear()
      const rnd = Math.floor(Math.random() * 900000) + 100000
      const deliveryNumber = `DEL-${year}-${rnd}`
      const poItemsWithIds = addProductIds(po.items)
      const scheduledItems = Array.isArray(items) && items.length
        ? items.map(item => {
            const poItem = poItemsWithIds.find(candidate =>
              String(candidate._id) === String(item.poItemId || '') ||
              candidate.productId === item.productId ||
              candidate.description === item.description
            )
            return { ...item, productId: poItem?.productId || item.productId }
          })
        : poItemsWithIds.map(item => ({
            productId: item.productId,
            description: item.description,
            quantityExpected: item.quantityRemaining || item.quantityOrdered,
            unit: item.unit
          }))

      const ds = new DeliverySchedule({
        deliveryNumber, poId, poNumber: po.poNumber, vendorId: po.vendorId, vendorName: po.vendorName,
        deliveryPersonId: deliveryPersonId || null, deliveryPersonName: dpName, deliveryPersonPhone: dpPhone,
        vehicleId: vehicleId || null, vehicleNumber: vNumber,
        scheduledDate: new Date(scheduledDate), slotStart, slotEnd, deliveryLocation, challanNumber,
        items: scheduledItems,
        status: 'SCHEDULED',
        statusHistory: [{ oldStatus: '', newStatus: 'SCHEDULED', actorId, actorName, comment: 'Delivery scheduled', createdAt: new Date() }]
      })
      await ds.save()
      return res.status(201).json({ success: true, data: ds })
    }

    // ── POST /api/deliveries?id=&action= — Delivery actions ──────────────────
    if (req.method === 'POST' && id && action) {
      const ds = await DeliverySchedule.findById(id)
      if (!ds) return res.status(404).json({ success: false, error: 'Delivery not found' })
      const oldStatus = ds.status

      if (action === 'generate-pass') {
        // Generate QR token + backup code
        const token = genRandom(32)
        const backupCode = String(Math.floor(100000 + Math.random() * 900000))
        const validFrom = new Date()
        const validUntil = new Date(ds.scheduledDate)
        validUntil.setHours(23, 59, 59, 999)

        ds.qrToken = token
        ds.qrTokenHash = hashToken(token)
        ds.backupCode = backupCode
        ds.backupCodeHash = hashToken(backupCode)
        ds.passValidFrom = validFrom
        ds.passValidUntil = validUntil
        ds.passRevoked = false
        ds.passUsageCount = 0
        ds.status = 'PASS_GENERATED'
        pushHistory(ds, oldStatus, 'PASS_GENERATED', 'QR pass and backup code generated')
      }
      else if (action === 'revoke-pass') {
        ds.passRevoked = true
        pushHistory(ds, oldStatus, ds.status, 'Pass revoked manually')
      }
      else if (action === 'reschedule') {
        const { newDate, reason } = req.body
        if (!newDate) return res.status(400).json({ success: false, error: 'newDate is required' })
        ds.scheduledDate = new Date(newDate)
        ds.status = 'RESCHEDULED'
        ds.passRevoked = true // Revoke existing pass on reschedule
        pushHistory(ds, oldStatus, 'RESCHEDULED', `Rescheduled to ${newDate}. Reason: ${reason || 'None'}`)
      }
      else if (action === 'cancel') {
        ds.status = 'CANCELLED'
        pushHistory(ds, oldStatus, 'CANCELLED', req.body.reason || 'Delivery cancelled')
      }
      else if (action === 'record-exit') {
        ds.status = 'EXIT_RECORDED'
        pushHistory(ds, oldStatus, 'EXIT_RECORDED', 'Vehicle exit recorded by gate')
        // Update gate entry exit time
        const lastEntry = await GateEntry.findOne({ deliveryScheduleId: id, decision: 'APPROVED' }).sort({ entryTime: -1 })
        if (lastEntry) { lastEntry.exitTime = new Date(); await lastEntry.save() }
      }
      else {
        return res.status(400).json({ success: false, error: 'Invalid action' })
      }

      await ds.save()
      return res.json({ success: true, data: ds })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Deliveries API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
