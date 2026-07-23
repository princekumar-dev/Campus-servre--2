import { connectToDatabase } from '../lib/mongo.js'
import { GoodsReceipt, PurchaseOrder, DeliverySchedule, User } from '../models.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try { await connectToDatabase() } catch (e) {
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown'

  try {
    const { id, action, poId, deliveryId } = req.query

    // ── GET /api/grn ──────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (id) {
        const grn = await GoodsReceipt.findById(id).lean()
        if (!grn) return res.status(404).json({ success: false, error: 'GRN not found' })
        return res.json({ success: true, data: grn })
      }
      const filter = {}
      if (poId) filter.poId = poId
      if (deliveryId) filter.deliveryScheduleId = deliveryId
      if (req.query.grnType) filter.grnType = req.query.grnType
      const grns = await GoodsReceipt.find(filter).sort({ createdAt: -1 }).lean()
      return res.json({ success: true, data: grns, total: grns.length })
    }

    // ── POST /api/grn — Create GRN ────────────────────────────────────────────
    if (req.method === 'POST' && !id) {
      const { poId: bodyPoId, deliveryScheduleId, items, remarks } = req.body
      if (!bodyPoId || !items || !items.length) {
        return res.status(400).json({ success: false, error: 'poId and items are required' })
      }

      const po = await PurchaseOrder.findById(bodyPoId)
      if (!po) return res.status(404).json({ success: false, error: 'PO not found' })

      // Validate quantities per spec:
      // accepted + damaged + rejected <= delivered
      // cumulative accepted <= ordered
      // remaining >= 0
      const processedItems = []
      for (const item of items) {
        const deliveredNow = Number(item.quantityDeliveredNow || 0)
        const acceptedNow = Number(item.quantityAcceptedNow || 0)
        const damaged = Number(item.quantityDamaged || 0)
        const rejected = Number(item.quantityRejected || 0)

        if (acceptedNow + damaged + rejected > deliveredNow) {
          return res.status(400).json({ success: false, error: `Accepted + Damaged + Rejected cannot exceed Delivered for item: ${item.poItemDescription}` })
        }

        // Find PO item and check cumulative
        const poItem = po.items.find(pi => pi.description === item.poItemDescription)
        if (poItem) {
          const prevAccepted = Number(item.quantityPreviouslyAccepted || 0)
          const cumulativeAccepted = prevAccepted + acceptedNow
          if (cumulativeAccepted > poItem.quantityOrdered) {
            return res.status(400).json({ success: false, error: `Cumulative accepted quantity exceeds ordered for: ${item.poItemDescription}` })
          }
          const remaining = poItem.quantityOrdered - cumulativeAccepted
          if (remaining < 0) {
            return res.status(400).json({ success: false, error: `Remaining quantity cannot be negative for: ${item.poItemDescription}` })
          }
          // Update PO item quantities
          poItem.quantityAccepted = cumulativeAccepted
          poItem.quantityRemaining = remaining
          item.quantityRemaining = remaining
        }

        processedItems.push({
          ...item,
          quantityDeliveredNow: deliveredNow,
          quantityAcceptedNow: acceptedNow,
          quantityDamaged: damaged,
          quantityRejected: rejected
        })
      }

      // Determine GRN type
      const allFulfilled = po.items.every(pi => (pi.quantityRemaining || 0) === 0)
      const grnType = allFulfilled ? 'FINAL' : 'PARTIAL'

      const year = new Date().getFullYear()
      const rnd = Math.floor(Math.random() * 900000) + 100000
      const grnNumber = `GRN-${year}-${rnd}`

      const grn = new GoodsReceipt({
        grnNumber, poId: bodyPoId, poNumber: po.poNumber, deliveryScheduleId,
        grnType, status: 'DRAFT', receivedBy: actorId, receivedByName: actorName,
        remarks, items: processedItems
      })
      await grn.save()

      // Update PO status
      const oldPoStatus = po.status
      po.status = grnType === 'FINAL' ? 'FULFILLED' : 'PARTIALLY_FULFILLED'
      po.statusHistory.push({ oldStatus: oldPoStatus, newStatus: po.status, actorId, actorName, comment: `${grnType} GRN created: ${grnNumber}`, createdAt: new Date() })
      await po.save()

      // Update delivery schedule status
      if (deliveryScheduleId) {
        const ds = await DeliverySchedule.findById(deliveryScheduleId)
        if (ds) {
          const oldDsStatus = ds.status
          ds.status = grnType === 'FINAL' ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
          ds.statusHistory.push({ oldStatus: oldDsStatus, newStatus: ds.status, actorId, actorName, comment: `${grnType} GRN recorded`, createdAt: new Date() })
          await ds.save()
        }
      }

      return res.status(201).json({ success: true, data: grn, grnType, poStatus: po.status })
    }

    // ── POST /api/grn?id=&action=finalize — Finalize GRN ─────────────────────
    if (req.method === 'POST' && id && action === 'finalize') {
      const grn = await GoodsReceipt.findById(id)
      if (!grn) return res.status(404).json({ success: false, error: 'GRN not found' })
      if (grn.status === 'FINALIZED') return res.status(400).json({ success: false, error: 'GRN already finalized' })
      grn.status = 'FINALIZED'
      await grn.save()
      return res.json({ success: true, data: grn })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('GRN API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
