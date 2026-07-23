import { connectToDatabase } from '../lib/mongo.js'
import { Vendor, DeliveryPerson, Vehicle, User } from '../models.js'

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
        const deliveryPersons = await DeliveryPerson.find({ vendorId: id }).lean()
        const vehicles = await Vehicle.find({ vendorId: id }).lean()
        return res.json({ success: true, data: vendor, deliveryPersons, vehicles })
      }

      // List vendors
      const filter = {}
      if (req.query.status) filter.status = req.query.status
      const vendors = await Vendor.find(filter).sort({ legalName: 1 }).lean()
      return res.json({ success: true, data: vendors, total: vendors.length })
    }

    // ── POST /api/vendors — Create vendor ────────────────────────────────────
    if (req.method === 'POST' && !id && !subResource) {
      const { legalName, contactPerson, email, phone, taxNumber, address } = req.body
      if (!legalName || !contactPerson || !email || !phone) {
        return res.status(400).json({ success: false, error: 'legalName, contactPerson, email and phone are required' })
      }
      const year = new Date().getFullYear()
      const rnd = Math.floor(Math.random() * 90000) + 10000
      const vendorCode = `VND-${year}-${rnd}`
      const vendor = new Vendor({ vendorCode, legalName, contactPerson, email, phone, taxNumber, address, createdBy: actorName })
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
      const allowed = ['legalName', 'contactPerson', 'email', 'phone', 'taxNumber', 'address', 'notes']
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
