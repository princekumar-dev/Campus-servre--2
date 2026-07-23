import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, User } from '../models.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in reports API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'GET') {
      const userId = req.user ? req.user.id : (req.headers['x-user-id'] || '')
      const userRole = req.user ? req.user.role : (req.headers['x-user-role'] || '')

      // Build role-scoped filter
      const filter = {}
      if (userRole === 'manager') {
        filter.$or = [
          { assignedManagerId: userId },
          { status: 'APPROVED' }
        ]
      } else if (userRole === 'technician') {
        filter['workOrder.technicianId'] = userId
      } else if (userRole === 'requester') {
        filter.requesterId = userId
      }
      // admin, accounts, super_admin see all

      const requests = await ServiceRequest.find(filter).lean()

      // Calculate stats
      const totalRequests = requests.length
      const pendingAdmin = requests.filter(r => r.status === 'SUBMITTED').length
      const activeWork = requests.filter(r => ['WORK_ORDER_CREATED', 'TECHNICIAN_ASSIGNED', 'WORK_ACCEPTED', 'IN_PROGRESS', 'PAUSED', 'WAITING_FOR_MATERIAL', 'ADDITIONAL_COST_PENDING'].includes(r.status)).length
      const pendingInvoicing = requests.filter(r => r.status === 'SERVICE_VERIFIED').length
      const pendingPayment = requests.filter(r => ['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(r.status)).length
      const closed = requests.filter(r => r.status === 'CLOSED').length

      // Category-wise distribution
      const categories = {}
      // Department-wise costs
      const departmentCosts = {}
      // Technician performance
      const techStats = {}

      let totalExpenses = 0
      let totalQuotations = 0

      for (const r of requests) {
        // Category count
        categories[r.category] = (categories[r.category] || 0) + 1

        // Financials
        const approvedCost = r.quotation ? r.quotation.grandTotal : 0
        totalQuotations += approvedCost

        // Actual expense (total of recorded payments)
        const totalPaid = r.payments ? r.payments.reduce((sum, p) => sum + p.amount, 0) : 0
        totalExpenses += totalPaid

        // Department cost — look up requester's department
        if (totalPaid > 0) {
          let dept = 'General'
          if (r.requesterId) {
            try {
              const requester = await User.findById(r.requesterId).select('department').lean()
              if (requester && requester.department) dept = requester.department
            } catch (e) { /* ignore */ }
          }
          departmentCosts[dept] = (departmentCosts[dept] || 0) + totalPaid
        }

        // Tech stats
        if (r.workOrder && r.workOrder.technicianName) {
          const tech = r.workOrder.technicianName
          if (!techStats[tech]) {
            techStats[tech] = { assigned: 0, completed: 0 }
          }
          techStats[tech].assigned += 1
          if (r.workOrder.status === 'COMPLETED' || r.status === 'CLOSED') {
            techStats[tech].completed += 1
          }
        }
      }

      // Turn categories object into array for charting
      const categoryData = Object.keys(categories).map(name => ({
        name,
        value: categories[name]
      }))

      // Turn departmentCosts into array
      const departmentData = Object.keys(departmentCosts).map(name => ({
        name,
        cost: departmentCosts[name]
      }))

      // Turn tech stats into array
      const technicianData = Object.keys(techStats).map(name => ({
        name,
        assigned: techStats[name].assigned,
        completed: techStats[name].completed
      }))

      return res.status(200).json({
        success: true,
        stats: {
          totalRequests,
          pendingAdmin,
          activeWork,
          pendingInvoicing,
          pendingPayment,
          closed,
          totalExpenses,
          totalQuotations
        },
        charts: {
          categoryData,
          departmentData,
          technicianData
        }
      })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (error) {
    console.error('Error in reports API:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
