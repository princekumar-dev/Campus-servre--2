import { connectToDatabase } from '../lib/mongo.js'
import { GoodsReceipt, PurchaseOrder, DeliverySchedule, User, ServiceRequest } from '../models.js'
import { storeNotification } from '../lib/notificationService.js'
import { getProductId } from '../lib/productId.js'
import { canReceivePo, getPoReceivingBlockReason } from '../lib/poReceiving.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try { await connectToDatabase() } catch (e) {
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const actorRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')
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
      const poIds = [...new Set(grns.map(grn => String(grn.poId || '')).filter(Boolean))]
      const purchaseOrders = poIds.length
        ? await PurchaseOrder.find({ _id: { $in: poIds } })
          .select('poNumber vendorName status grandTotal expectedDeliveryDate deliveryLocation createdAt closedAt items')
          .lean()
        : []
      return res.json({ success: true, data: grns, purchaseOrders, total: grns.length })
    }

    // ── POST /api/grn — Create GRN ────────────────────────────────────────────
    if (req.method === 'POST' && !id) {
      const hasQrAccess = Boolean(req.poQrAccess)
      if (!hasQrAccess && !['gate', 'receiving_officer', 'manager', 'admin', 'super_admin'].includes(actorRole)) {
        return res.status(403).json({ success: false, error: 'You are not authorized to record a GRN' })
      }

      const { poId: bodyPoId, deliveryScheduleId, items, remarks, qrToken } = req.body
      if (!bodyPoId || !items || !items.length) {
        return res.status(400).json({ success: false, error: 'poId and items are required' })
      }
      if ((hasQrAccess || actorRole === 'gate') && req.poQrAccess?.poId !== String(bodyPoId)) {
        return res.status(403).json({ success: false, error: 'A valid PO QR code is required for gate receipt entry' })
      }

      const receiptActorId = hasQrAccess ? `po-qr:${bodyPoId}` : actorId
      const receiptActorName = hasQrAccess ? 'Gate QR verification' : actorName

      const po = await PurchaseOrder.findById(bodyPoId)
      if (!po) return res.status(404).json({ success: false, error: 'PO not found' })
      if (!canReceivePo(po)) {
        return res.status(409).json({ success: false, error: getPoReceivingBlockReason(po) })
      }

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

        if (![deliveredNow, acceptedNow, damaged, rejected].every(Number.isFinite) || [deliveredNow, acceptedNow, damaged, rejected].some(value => value < 0)) {
          return res.status(400).json({ success: false, error: `Quantities must be valid non-negative numbers for item: ${item.poItemDescription}` })
        }
        if (acceptedNow + damaged + rejected > deliveredNow) {
          return res.status(400).json({ success: false, error: `Accepted + Damaged + Rejected cannot exceed Delivered for item: ${item.poItemDescription}` })
        }
        // A GRN documents only products physically included in this receipt.
        // Unreceived PO rows must not be copied into the GRN.
        if (deliveredNow === 0) continue

        // Find PO item and check cumulative
        const poItem = po.items.find(pi =>
          (item.poItemId && String(pi._id) === String(item.poItemId)) ||
          (!item.poItemId && pi.description === item.poItemDescription)
        )
        if (!poItem) {
          return res.status(400).json({ success: false, error: `PO item was not found: ${item.poItemDescription}` })
        }
        {
          // Always use the server's current accepted quantity. Do not trust a
          // stale or edited client-side "previously accepted" value.
          const prevAccepted = Number(poItem.quantityAccepted || 0)
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
          item.quantityPreviouslyAccepted = prevAccepted
        }

        processedItems.push({
          ...item,
          productId: getProductId(poItem),
          poItemId: String(poItem._id),
          quantityDeliveredNow: deliveredNow,
          quantityAcceptedNow: acceptedNow,
          quantityDamaged: damaged,
          quantityRejected: rejected
        })
      }
      if (!processedItems.some(item => item.quantityDeliveredNow > 0)) {
        return res.status(400).json({ success: false, error: 'Enter a delivered quantity for at least one item' })
      }

      // Determine GRN type
      const allFulfilled = po.items.every(pi => (pi.quantityRemaining || 0) === 0)
      const grnType = allFulfilled ? 'FINAL' : 'PARTIAL'

      const year = new Date().getFullYear()
      const rnd = Math.floor(Math.random() * 900000) + 100000
      const grnNumber = `GRN-${year}-${rnd}`

      // A final receipt is the terminal PO event, regardless of whether the
      // receiving screen was opened from the printed PO QR or manually.
      const closesPo = grnType === 'FINAL'
      const grn = new GoodsReceipt({
        grnNumber, poId: bodyPoId, poNumber: po.poNumber, deliveryScheduleId,
        grnType, status: closesPo ? 'FINALIZED' : 'DRAFT', receivedBy: receiptActorId, receivedByName: receiptActorName,
        source: qrToken ? 'PO_QR' : 'MANUAL',
        gateVerifiedAt: qrToken ? new Date() : undefined,
        remarks, items: processedItems
      })
      await grn.save()

      // Update PO status
      const oldPoStatus = po.status
      po.status = closesPo ? 'CLOSED' : grnType === 'FINAL' ? 'FULFILLED' : 'PARTIALLY_FULFILLED'
      po.statusHistory.push({
        oldStatus: oldPoStatus,
        newStatus: po.status,
        actorId: receiptActorId,
        actorName: receiptActorName,
        comment: closesPo
          ? `PO QR verified and final GRN created: ${grnNumber}. PO closed automatically.`
          : `${grnType} GRN created: ${grnNumber}`,
        createdAt: new Date()
      })
      await po.save()

      // A request-backed PO completes the originating request at the same time.
      if (closesPo && po.requestId) {
        const serviceRequest = await ServiceRequest.findById(po.requestId)
        if (serviceRequest && serviceRequest.status !== 'CLOSED') {
          const previousRequestStatus = serviceRequest.status
          serviceRequest.status = 'CLOSED'
          serviceRequest.currentOwnerRole = null
          serviceRequest.closedAt = new Date()
          serviceRequest.statusHistory.push({
            oldStatus: previousRequestStatus,
            newStatus: 'CLOSED',
            actorId: receiptActorId,
            actorName: receiptActorName,
            comment: `Purchase order ${po.poNumber} closed after successful QR receiving (${grnNumber})`
          })
          await serviceRequest.save()
        }
      }

      // Update delivery schedule status
      if (deliveryScheduleId) {
        const ds = await DeliverySchedule.findById(deliveryScheduleId)
        if (ds) {
          const oldDsStatus = ds.status
          ds.status = grnType === 'FINAL' ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
          ds.statusHistory.push({ oldStatus: oldDsStatus, newStatus: ds.status, actorId: receiptActorId, actorName: receiptActorName, comment: `${grnType} GRN recorded`, createdAt: new Date() })
          await ds.save()
        }
      }

      // Make gate-created receipts immediately visible to the responsible
      // managers through their notification bell and the shared GRN section.
      if (qrToken) {
        const managers = await User.find({ role: { $in: ['manager', 'super_admin'] }, isActive: true })
          .select('email')
          .lean()
        await Promise.allSettled(managers.map(manager => storeNotification({
          userEmail: manager.email,
          title: `Gate GRN created: ${grnNumber}`,
          body: `${po.poNumber} from ${po.vendorName} was manually verified at the gate.`,
          url: '/grn',
          type: 'gate_grn_created',
          data: { grnId: grn._id, poId: po._id, poNumber: po.poNumber }
        })))
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
