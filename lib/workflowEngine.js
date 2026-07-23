import { AuditLog, Notification, User } from '../models.js'

export const WORKFLOW_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CLARIFICATION_REQUIRED', 'CANCELLED'],
  CLARIFICATION_REQUIRED: ['SUBMITTED', 'CANCELLED'],
  REOPENED: ['APPROVED', 'REJECTED'],
  APPROVED: ['ASSIGNED_TO_MANAGER'],
  ASSIGNED_TO_MANAGER: ['QUOTATION_IN_PROGRESS'],
  QUOTATION_IN_PROGRESS: ['QUOTATION_SUBMITTED'],
  QUOTATION_SUBMITTED: ['QUOTATION_APPROVED', 'QUOTATION_REVISION_REQUIRED', 'QUOTATION_REJECTED'],
  QUOTATION_REVISION_REQUIRED: ['QUOTATION_IN_PROGRESS', 'QUOTATION_SUBMITTED'],
  QUOTATION_REJECTED: ['QUOTATION_IN_PROGRESS', 'CANCELLED'],
  QUOTATION_APPROVED: ['WORK_ORDER_CREATED', 'TECHNICIAN_ASSIGNED'],
  WORK_ORDER_CREATED: ['TECHNICIAN_ASSIGNED', 'CANCELLED'],
  TECHNICIAN_ASSIGNED: ['WORK_ACCEPTED', 'WORK_DECLINED'],
  WORK_DECLINED: ['TECHNICIAN_ASSIGNED', 'WORK_ORDER_CREATED', 'CANCELLED'],
  WORK_ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['PAUSED', 'ADDITIONAL_COST_PENDING', 'TECHNICIAN_COMPLETED'],
  PAUSED: ['IN_PROGRESS', 'CANCELLED'],
  ADDITIONAL_COST_PENDING: ['IN_PROGRESS'],
  TECHNICIAN_COMPLETED: ['SERVICE_VERIFIED', 'REOPENED'],
  SERVICE_VERIFIED: ['INVOICE_IN_PROGRESS'],
  INVOICE_IN_PROGRESS: ['INVOICE_SUBMITTED'],
  INVOICE_SUBMITTED: ['PAYMENT_PENDING', 'INVOICE_REVISION_REQUIRED', 'INVOICE_REJECTED'],
  INVOICE_REVISION_REQUIRED: ['INVOICE_IN_PROGRESS', 'INVOICE_SUBMITTED'],
  INVOICE_REJECTED: ['INVOICE_IN_PROGRESS', 'CANCELLED'],
  PAYMENT_PENDING: ['PARTIALLY_PAID', 'CLOSED'],
  PARTIALLY_PAID: ['PARTIALLY_PAID', 'CLOSED'],
  CLOSED: [], REJECTED: [], CANCELLED: [],
}

const OWNER_BY_STATUS = {
  DRAFT: 'requester', SUBMITTED: 'admin', CLARIFICATION_REQUIRED: 'requester', REOPENED: 'admin', APPROVED: 'admin',
  ASSIGNED_TO_MANAGER: 'manager', QUOTATION_IN_PROGRESS: 'manager', QUOTATION_REVISION_REQUIRED: 'manager',
  QUOTATION_REJECTED: 'manager', QUOTATION_SUBMITTED: 'admin', QUOTATION_APPROVED: 'manager', WORK_ORDER_CREATED: 'manager',
  TECHNICIAN_ASSIGNED: 'technician', WORK_DECLINED: 'manager', WORK_ACCEPTED: 'technician', IN_PROGRESS: 'technician',
  PAUSED: 'technician', ADDITIONAL_COST_PENDING: 'admin', TECHNICIAN_COMPLETED: 'requester', SERVICE_VERIFIED: 'manager',
  INVOICE_IN_PROGRESS: 'manager', INVOICE_REVISION_REQUIRED: 'manager', INVOICE_REJECTED: 'manager', INVOICE_SUBMITTED: 'accounts',
  PAYMENT_PENDING: 'accounts', PARTIALLY_PAID: 'accounts',
}

const SLA_HOURS = { EMERGENCY: 2, HIGH: 8, MEDIUM: 24, LOW: 48 }
const TERMINAL = new Set(['CLOSED', 'REJECTED', 'CANCELLED'])

export function canTransition(from, to) {
  return (WORKFLOW_TRANSITIONS[from] || []).includes(to)
}

export function getWorkflowOwner(status) {
  return OWNER_BY_STATUS[status] || null
}

export function calculateSlaDueAt(priority, status, from = new Date()) {
  if (TERMINAL.has(status)) return null
  const multiplier = ['IN_PROGRESS', 'PAUSED'].includes(status) ? 3 : ['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(status) ? 5 : 1
  return new Date(from.getTime() + (SLA_HOURS[priority] || SLA_HOURS.LOW) * multiplier * 60 * 60 * 1000)
}

async function resolveRecipient(request, ownerRole) {
  if (!ownerRole) return null
  if (ownerRole === 'requester') return User.findById(request.requesterId).lean()
  if (ownerRole === 'manager' && request.assignedManagerId) return User.findById(request.assignedManagerId).lean()
  if (ownerRole === 'technician' && request.workOrder?.technicianId) return User.findById(request.workOrder.technicianId).lean()
  return User.findOne({ role: ownerRole, isActive: { $ne: false } }).lean()
}

export async function finalizeRequestWorkflow(request, actor = {}) {
  const latest = request.statusHistory?.[request.statusHistory.length - 1]
  const statusChanged = latest && latest.oldStatus !== latest.newStatus && latest.newStatus === request.status
  const now = new Date()
  request.currentOwnerRole = getWorkflowOwner(request.status)
  if (statusChanged || !request.slaDueAt) request.slaDueAt = calculateSlaDueAt(request.priority, request.status, now)
  request.isEscalated = Boolean(request.slaDueAt && request.slaDueAt < now)
  if (request.status === 'CLOSED' && !request.closedAt) request.closedAt = now

  if (!statusChanged) return

  await AuditLog.create({
    entityType: 'SERVICE_REQUEST', entityId: String(request._id), action: 'STATUS_CHANGED',
    actorId: String(actor.id || latest.actorId || ''), actorName: actor.name || latest.actorName || 'System', actorRole: actor.role || '',
    details: { requestNumber: request.requestNumber, oldStatus: latest.oldStatus, newStatus: latest.newStatus, comment: latest.comment || '' },
  })

  const recipient = await resolveRecipient(request, request.currentOwnerRole)
  if (recipient?._id && String(recipient._id) !== String(actor.id || '')) {
    await Notification.create({
      userId: recipient._id, userEmail: String(recipient.email || '').trim().toLowerCase(),
      type: 'service_request',
      title: `${request.requestNumber}: action required`,
      message: `${request.title} is now ${request.status.replace(/_/g, ' ').toLowerCase()}.`,
      url: `/requests/${request._id}`,
    })
  }
}
