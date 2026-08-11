import { connectToDatabase } from '../lib/mongo.js'
import { ServiceRequest, User, PurchaseOrder, DeliverySchedule, GateEntry, GoodsReceipt } from '../models.js'

const finiteAmount = value => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const roundMoney = value => Math.round((finiteAmount(value) + Number.EPSILON) * 100) / 100

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
        .select('status currentOwnerRole category requesterId quotation.grandTotal payments.amount workOrder.technicianId workOrder.technicianName workOrder.status')
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
        technicians,
        awaitingGate,
        gateApprovedToday,
        gateRejectedToday,
        awaitingReceipt,
        partialReceipts,
        completedReceipts,
        finalizedGrns,
      ] = await Promise.all([
        PurchaseOrder.find(poFilter).select('status signedPo.status grandTotal requestId').lean(),
        User.find({ role: 'technician', isActive: true }).select('name').sort({ name: 1 }).lean(),
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
      const pendingAdmin = requests.filter(r =>
        r.status === 'SUBMITTED' || (r.currentOwnerRole === 'admin' && !['CLOSED', 'REJECTED', 'CANCELLED'].includes(r.status))
      ).length
      const activeWork = requests.filter(r => ['WORK_ORDER_CREATED', 'TECHNICIAN_ASSIGNED', 'WORK_ACCEPTED', 'IN_PROGRESS', 'PAUSED', 'WAITING_FOR_MATERIAL', 'ADDITIONAL_COST_PENDING'].includes(r.status)).length
      const pendingInvoicing = requests.filter(r => r.status === 'SERVICE_VERIFIED').length
      const pendingPayment = requests.filter(r => ['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(r.status)).length
      const closed = requests.filter(r => r.status === 'CLOSED').length
      const myActions = requests.filter(r => r.currentOwnerRole === userRole).length
      const requestsToClassify = pendingAdmin
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
      const committedStatuses = new Set(['ACTIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CLOSED'])
      const reportablePOs = purchaseOrders.filter(po => committedStatuses.has(po.status) && po.signedPo?.status === 'VERIFIED')
      const totalPOValue = roundMoney(reportablePOs.reduce((sum, po) => sum + finiteAmount(po.grandTotal), 0))

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

      const requesterIds = [...new Set(requests.filter(r => r.requesterId).map(r => String(r.requesterId)))]
      const requesterDepartments = requesterIds.length
        ? await User.find({ _id: { $in: requesterIds } }).select('department').lean()
        : []
      const departmentByRequester = new Map(
        requesterDepartments.map(requester => [String(requester._id), requester.department || 'General'])
      )
      const requestById = new Map(requests.map(request => [String(request._id), request]))

      technicians.forEach(technician => {
        techStats[String(technician._id)] = { name: technician.name, assigned: 0, completed: 0 }
      })

      for (const r of requests) {
        // Category count
        const category = String(r.category || 'Uncategorized').trim() || 'Uncategorized'
        categories[category] = (categories[category] || 0) + 1

        // Financials
        const approvedCost = finiteAmount(r.quotation?.grandTotal)
        totalQuotations += approvedCost

        // Actual expense (total of recorded payments)
        const totalPaid = Array.isArray(r.payments) ? r.payments.reduce((sum, payment) => sum + finiteAmount(payment?.amount), 0) : 0
        totalExpenses += totalPaid

        // Tech stats
        if (r.workOrder && r.workOrder.technicianName) {
          const techKey = String(r.workOrder.technicianId || `name:${r.workOrder.technicianName}`)
          if (!techStats[techKey]) {
            techStats[techKey] = { name: r.workOrder.technicianName, assigned: 0, completed: 0 }
          }
          techStats[techKey].assigned += 1
          if (r.workOrder.status === 'COMPLETED' || r.status === 'CLOSED') {
            techStats[techKey].completed += 1
          }
        }
      }

      // Attribute committed PO value to the department that raised each request.
      for (const po of reportablePOs) {
        const request = requestById.get(String(po.requestId || ''))
        const dept = departmentByRequester.get(String(request?.requesterId || '')) || 'General'
        departmentCosts[dept] = roundMoney((departmentCosts[dept] || 0) + finiteAmount(po.grandTotal))
      }

      // Turn categories object into array for charting
      const categoryData = Object.keys(categories).map(name => ({
        name,
        value: categories[name]
      })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))

      // Turn departmentCosts into array
      const departmentData = Object.keys(departmentCosts).map(name => ({
        name,
        cost: departmentCosts[name]
      })).sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))

      // Turn tech stats into array
      const technicianData = Object.values(techStats).map(technician => ({
        name: technician.name,
        assigned: technician.assigned,
        completed: technician.completed
      })).filter(technician => technician.assigned > 0)
        .sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name))

      totalExpenses = roundMoney(totalExpenses)
      totalQuotations = roundMoney(totalQuotations)

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
          totalQuotations,
          totalPOValue
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
