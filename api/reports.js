import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, User, PurchaseOrder, DeliverySchedule, GateEntry, GoodsReceipt } from '../models.js'

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
      const userEmail = req.user ? req.user.email : (req.headers['x-user-email'] || '')

      // Build role-scoped filter
      const filter = {}
      if (userRole === 'manager') {
        filter.$or = [
          { assignedManagerId: userId },
          { status: 'APPROVED' }
        ]
      } else if (userRole === 'technician') {
        filter['workOrder.technicianId'] = userId
      } else if (['requester', 'hod', 'staff'].includes(userRole)) {
        filter.requesterId = userId
      }
      // admin, accounts, super_admin see all

      const requests = await ServiceRequest.find(filter)
        .select('status currentOwnerRole category requesterId quotation.grandTotal payments.amount workOrder.technicianName workOrder.status')
        .lean()
      const requestIds = requests.map(request => request._id)
      const poFilter = {}
      if (userRole === 'manager') {
        poFilter.createdById = userId
      } else if (['requester', 'hod', 'staff'].includes(userRole)) {
        poFilter.requestId = { $in: requestIds }
      } else if (userRole === 'vendor') {
        poFilter.vendorEmail = String(userEmail || '').trim().toLowerCase()
      }
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const [
        purchaseOrders,
        awaitingGate,
        gateApprovedToday,
        gateRejectedToday,
        awaitingReceipt,
        partialReceipts,
        completedReceipts,
        finalizedGrns,
      ] = await Promise.all([
        PurchaseOrder.find(poFilter).select('status signedPo.status').lean(),
        DeliverySchedule.countDocuments({ status: { $in: ['PASS_GENERATED', 'AT_GATE'] } }),
        GateEntry.countDocuments({ entryTime: { $gte: startOfToday }, decision: 'APPROVED' }),
        GateEntry.countDocuments({ entryTime: { $gte: startOfToday }, decision: 'REJECTED' }),
        DeliverySchedule.countDocuments({ status: 'ENTRY_APPROVED' }),
        DeliverySchedule.countDocuments({ status: 'PARTIALLY_RECEIVED' }),
        DeliverySchedule.countDocuments({ status: { $in: ['FULLY_RECEIVED', 'EXIT_RECORDED'] } }),
        GoodsReceipt.countDocuments({ status: 'FINALIZED' }),
      ])

      // Calculate stats
      const totalRequests = requests.length
      const pendingAdmin = requests.filter(r => r.status === 'SUBMITTED').length
      const activeWork = requests.filter(r => ['WORK_ORDER_CREATED', 'TECHNICIAN_ASSIGNED', 'WORK_ACCEPTED', 'IN_PROGRESS', 'PAUSED', 'WAITING_FOR_MATERIAL', 'ADDITIONAL_COST_PENDING'].includes(r.status)).length
      const pendingInvoicing = requests.filter(r => r.status === 'SERVICE_VERIFIED').length
      const pendingPayment = requests.filter(r => ['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(r.status)).length
      const closed = requests.filter(r => r.status === 'CLOSED').length
      const myActions = requests.filter(r => r.currentOwnerRole === userRole).length
      const requestsToClassify = requests.filter(r => ['SUBMITTED', 'REOPENED'].includes(r.status)).length
      const assignedRequests = requests.filter(r => r.status === 'ASSIGNED_TO_MANAGER').length
      const purchaseOrderCreated = requests.filter(r => r.status === 'PURCHASE_ORDER_CREATED').length
      const totalPOs = purchaseOrders.length
      const draftPOs = purchaseOrders.filter(po => ['DRAFT', 'REVISION_REQUIRED'].includes(po.status)).length
      const signedPOsPending = purchaseOrders.filter(po =>
        po.status === 'SUBMITTED_FOR_APPROVAL' && po.signedPo?.status === 'PENDING_VERIFICATION'
      ).length
      const activePOs = purchaseOrders.filter(po => ['ACTIVE', 'PARTIALLY_FULFILLED'].includes(po.status)).length
      const fulfilledPOs = purchaseOrders.filter(po => po.status === 'FULFILLED').length
      const closedPOs = purchaseOrders.filter(po => po.status === 'CLOSED').length

      const byStatus = requests.reduce((counts, request) => {
        const key = String(request.status || 'UNKNOWN').toLowerCase()
        counts[key] = (counts[key] || 0) + 1
        return counts
      }, {})

      // Category-wise distribution
      const categories = {}
      // Department-wise costs
      const departmentCosts = {}
      // Technician performance
      const techStats = {}

      let totalExpenses = 0
      let totalQuotations = 0

      const paidRequesterIds = [...new Set(requests
        .filter(r => r.payments?.some(payment => Number(payment.amount) > 0) && r.requesterId)
        .map(r => String(r.requesterId)))]
      const requesterDepartments = paidRequesterIds.length
        ? await User.find({ _id: { $in: paidRequesterIds } }).select('department').lean()
        : []
      const departmentByRequester = new Map(
        requesterDepartments.map(requester => [String(requester._id), requester.department || 'General'])
      )

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
          const dept = departmentByRequester.get(String(r.requesterId || '')) || 'General'
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
          myActions,
          requestsToClassify,
          assignedRequests,
          purchaseOrderCreated,
          totalPOs,
          draftPOs,
          signedPOsPending,
          activePOs,
          fulfilledPOs,
          closedPOs,
          awaitingGate,
          gateApprovedToday,
          gateRejectedToday,
          awaitingReceipt,
          partialReceipts,
          completedReceipts,
          finalizedGrns,
          byStatus,
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
