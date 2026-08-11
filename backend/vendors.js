import { connectToDatabase } from '../lib/mongo.js'
import { Vendor, DeliveryPerson, Vehicle, User, PurchaseOrder } from '../models.js'

const excludedOrderStatuses = ['CANCELLED', 'REJECTED', 'VENDOR_REJECTED']
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

async function attachPurchaseOrderStats(vendors) {
  if (!vendors.length) return vendors
  const vendorIds = vendors.map(vendor => vendor._id)
  const totals = await PurchaseOrder.aggregate([
    {
      $match: {
        vendorId: { $in: vendorIds },
        status: { $nin: excludedOrderStatuses }
      }
    },
    {
      $group: {
        _id: '$vendorId',
        totalOrders: { $sum: 1 },
        totalValue: { $sum: { $ifNull: ['$grandTotal', 0] } }
      }
    }
  ])
  const totalsByVendor = new Map(totals.map(total => [String(total._id), total]))
  return vendors.map(vendor => {
    const total = totalsByVendor.get(String(vendor._id))
    return {
      ...vendor,
      totalOrders: total?.totalOrders || 0,
      totalValue: total?.totalValue || 0
    }
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try { await connectToDatabase() } catch (e) {
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  const actorId = req.user ? req.user.id : (req.headers['x-user-id'] || 'system')
  const userRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')
  const actor = req.user || await User.findById(actorId).lean()
  const actorName = actor ? actor.name : 'Unknown'

  try {
    const { id, action, subResource } = req.query

    // ── GET /api/vendors ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
      if (id) {
        // Single vendor with their delivery persons and vehicles
        const vendor = await Vendor.findById(id).lean()
        if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' })
        const [vendorWithStats] = await attachPurchaseOrderStats([vendor])
        const deliveryPersons = await DeliveryPerson.find({ vendorId: id }).lean()
        const vehicles = await Vehicle.find({ vendorId: id }).lean()
        return res.json({ success: true, data: vendorWithStats, deliveryPersons, vehicles })
      }

      // List vendors
      const filter = {}
      if (req.query.status) filter.status = req.query.status
      const vendors = await Vendor.find(filter).sort({ legalName: 1 }).lean()
      // Active-vendor requests populate selectors and do not display aggregate
      // order statistics. Avoid a second database round trip on that hot path.
      if (req.query.status === 'ACTIVE') {
        return res.json({ success: true, data: vendors, total: vendors.length })
      }
      const vendorsWithStats = await attachPurchaseOrderStats(vendors)
      return res.json({ success: true, data: vendorsWithStats, total: vendorsWithStats.length })
    }

    // ── POST /api/vendors — Create vendor ────────────────────────────────────
    if (req.method === 'POST' && !id && !subResource) {
      const { legalName, contactPerson, email, phone, taxNumber, address } = req.body
      const panNumber = String(req.body.panNumber || '').trim().toUpperCase()
      if (!legalName?.trim() || !contactPerson?.trim() || !email?.trim() || !phone?.trim() || !panNumber) {
        return res.status(400).json({ success: false, error: 'Legal business name, contact person, email, phone and PAN number are required' })
      }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return res.status(400).json({ success: false, error: 'Enter a valid email address' })
      if (!PAN_PATTERN.test(panNumber)) return res.status(400).json({ success: false, error: 'Enter a valid PAN number in the format ABCDE1234F' })
      const existingPan = await Vendor.findOne({ panNumber }).select('_id').lean()
      if (existingPan) return res.status(409).json({ success: false, error: 'A vendor with this PAN number is already registered' })
      const year = new Date().getFullYear()
      const rnd = Math.floor(Math.random() * 90000) + 10000
      const vendorCode = `VND-${year}-${rnd}`
      const vendor = new Vendor({ vendorCode, legalName: legalName.trim(), contactPerson: contactPerson.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), panNumber, taxNumber: taxNumber?.trim(), address: address?.trim(), createdBy: actorName })
      await vendor.save()
      return res.status(201).json({ success: true, data: vendor })
    }

    // ── POST /api/vendors?id=&action=activate|deactivate|blacklist ────────────
    if (req.method === 'POST' && id && action) {
      if (!['admin', 'super_admin', 'manager'].includes(userRole)) {
        return res.status(403).json({ success: false, error: 'Only admin or manager can change vendor status' })
      }
      const vendor = await Vendor.findById(id)
      if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' })
      if (action === 'activate') vendor.status = 'ACTIVE'
      else if (action === 'deactivate') vendor.status = 'INACTIVE'
      else if (action === 'blacklist') vendor.status = 'BLACKLISTED'
      else return res.status(400).json({ success: false, error: 'Invalid action' })
      await vendor.save()
      return res.json({ success: true, data: vendor })
    }

    // ── POST /api/vendors?subResource=delivery-persons — Add delivery person ──
    if (req.method === 'POST' && subResource === 'delivery-persons') {
      const { vendorId, name, phone, idType, idNumber } = req.body
      if (!name || !phone || !idNumber) {
        return res.status(400).json({ success: false, error: 'name, phone, idNumber are required' })
      }
      const dp = new DeliveryPerson({ vendorId, name, phone, idType: idType || 'AADHAR', idNumber })
      await dp.save()
      return res.status(201).json({ success: true, data: dp })
    }

    // ── POST /api/vendors?subResource=vehicles — Add vehicle ─────────────────
    if (req.method === 'POST' && subResource === 'vehicles') {
      const { vendorId, vehicleNumber, vehicleType } = req.body
      if (!vehicleNumber) return res.status(400).json({ success: false, error: 'vehicleNumber is required' })
      const v = new Vehicle({ vendorId, vehicleNumber, vehicleType: vehicleType || 'OTHER' })
      await v.save()
      return res.status(201).json({ success: true, data: v })
    }

    // ── GET /api/vendors?subResource=delivery-persons ────────────────────────
    if (req.method === 'GET' && subResource === 'delivery-persons') {
      const filter = {}
      if (req.query.vendorId) filter.vendorId = req.query.vendorId
      const dps = await DeliveryPerson.find(filter).lean()
      return res.json({ success: true, data: dps })
    }

    // ── GET /api/vendors?subResource=vehicles ────────────────────────────────
    if (req.method === 'GET' && subResource === 'vehicles') {
      const filter = {}
      if (req.query.vendorId) filter.vendorId = req.query.vendorId
      const vs = await Vehicle.find(filter).lean()
      return res.json({ success: true, data: vs })
    }

    // ── PATCH /api/vendors?id= — Update vendor ───────────────────────────────
    if (req.method === 'PATCH' && id) {
      const vendor = await Vendor.findById(id)
      if (!vendor) return res.status(404).json({ success: false, error: 'Vendor not found' })
      const allowed = ['legalName', 'contactPerson', 'email', 'phone', 'panNumber', 'taxNumber', 'address', 'notes']
      if (req.body.panNumber !== undefined) {
        const panNumber = String(req.body.panNumber).trim().toUpperCase()
        if (!PAN_PATTERN.test(panNumber)) return res.status(400).json({ success: false, error: 'Enter a valid PAN number in the format ABCDE1234F' })
        const existingPan = await Vendor.findOne({ panNumber, _id: { $ne: id } }).select('_id').lean()
        if (existingPan) return res.status(409).json({ success: false, error: 'A vendor with this PAN number is already registered' })
        req.body.panNumber = panNumber
      }
      allowed.forEach(f => { if (req.body[f] !== undefined) vendor[f] = req.body[f] })
      await vendor.save()
      return res.json({ success: true, data: vendor })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Vendors API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
