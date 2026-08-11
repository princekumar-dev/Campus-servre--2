const guidance = {
  DRAFT: { tab: 'Overview', owner: 'requester', title: 'Submit this request', description: 'Review the details, then submit it for administrative review.' },
  SUBMITTED: { tab: 'Overview', owner: 'admin', title: 'Admin triage required', description: 'Classify the requirement as maintenance, replacement, or new purchase, then assign a manager.' },
  UNDER_ADMIN_REVIEW: { tab: 'Overview', owner: 'admin', title: 'Complete the administrative review', description: 'Approve, reject, or return the request with a clear comment.' },
  CLARIFICATION_REQUIRED: { tab: 'History', owner: null, title: 'Archived clarification record', description: 'This status belongs to the previous service workflow and is available for reference only.' },
  REOPENED: { tab: 'Overview', owner: 'super_admin', title: 'Review the reopened request', description: 'Confirm the new information and move the request forward.' },
  APPROVED: { tab: 'Overview', owner: 'super_admin', title: 'Assign a Purchase Manager', description: 'Choose the Purchase Manager who will prepare the required order.' },
  ASSIGNED_TO_MANAGER: { tab: 'Quotation', owner: 'manager', title: 'Collect and compare quotations', description: 'Add vendor quotations for this indent, select the preferred offer, then generate the PO.' },
  PURCHASE_ORDER_CREATED: { tab: 'Overview', owner: null, title: 'Purchase order generated', description: 'The assigned manager generated the purchase order for this request.' },
  UNDER_INSPECTION: { tab: 'Diagnosis', owner: 'manager', title: 'Finish the inspection', description: 'Complete the diagnosis so a quotation can be prepared.' },
  QUOTATION_IN_PROGRESS: { tab: 'Quotation', owner: 'manager', title: 'Prepare the quotation', description: 'Add scoped items and terms, then submit the quotation for approval.' },
  QUOTATION_REVISION_REQUIRED: { tab: 'Quotation', owner: 'manager', title: 'Revise the quotation', description: 'Address the review comments and resubmit the updated quotation.' },
  QUOTATION_SUBMITTED: { tab: 'Quotation', owner: 'super_admin', title: 'Review the quotation', description: 'Approve it, request a revision, or reject it with a reason.' },
  QUOTATION_APPROVED: { tab: 'Work Order', owner: 'manager', title: 'Create the work order', description: 'Confirm the scope and assign a technician or external vendor.' },
  WORK_ORDER_CREATED: { tab: 'Work Order', owner: 'manager', title: 'Assign the work', description: 'Select the person responsible and release the work order.' },
  TECHNICIAN_ASSIGNED: { tab: 'Work Order', owner: 'technician', title: 'Accept the work order', description: 'Review the scope and acknowledge the assignment before starting.' },
  WORK_ACCEPTED: { tab: 'Work Order', owner: 'technician', title: 'Start the work', description: 'Begin service and keep progress notes current.' },
  PAUSED: { tab: 'Work Order', owner: 'technician', title: 'Resume or update the work', description: 'Record what is blocking progress, then resume when ready.' },
  IN_PROGRESS: { tab: 'Work Order', owner: 'technician', title: 'Update service progress', description: 'Record progress, materials, and completion details as the work advances.' },
  ADDITIONAL_COST_PENDING: { tab: 'Work Order', owner: 'super_admin', title: 'Review the additional cost', description: 'Approve or reject the cost request so work can continue.' },
  TECHNICIAN_COMPLETED: { tab: 'History', owner: null, title: 'Archived service record', description: 'This status belongs to the previous service workflow and is available for reference only.' },
  SERVICE_VERIFIED: { tab: 'Invoice', owner: 'manager', title: 'Create the invoice', description: 'Use the approved scope and final work details to prepare the invoice.' },
  INVOICE_IN_PROGRESS: { tab: 'Invoice', owner: 'manager', title: 'Finish the invoice', description: 'Check totals and supporting details, then submit it for approval.' },
  INVOICE_REVISION_REQUIRED: { tab: 'Invoice', owner: 'manager', title: 'Revise the invoice', description: 'Address the finance review comments and resubmit it.' },
  INVOICE_SUBMITTED: { tab: 'Invoice', owner: 'super_admin', title: 'Review the invoice', description: 'Approve it, request a revision, or reject it with a reason.' },
  PAYMENT_PENDING: { tab: 'Payments', owner: 'accounts', title: 'Record the payment', description: 'Enter the payment amount, method, reference, and notes.' },
  PARTIALLY_PAID: { tab: 'Payments', owner: 'accounts', title: 'Complete the remaining payment', description: 'Review the balance and record the next settlement.' },
  CLOSED: { tab: 'History', owner: null, title: 'Workflow complete', description: 'The service, invoice, and payment lifecycle is complete.' },
  REJECTED: { tab: 'History', owner: null, title: 'Request stopped', description: 'Review the decision and comments in the history.' },
  CANCELLED: { tab: 'History', owner: null, title: 'Request cancelled', description: 'Review the cancellation details in the history.' },
  WORK_DECLINED: { tab: 'Work Order', owner: 'manager', title: 'Reassign the work order', description: 'Review the decline reason and assign another technician or vendor.' },
  QUOTATION_REJECTED: { tab: 'Quotation', owner: 'manager', title: 'Recover the quotation', description: 'Create a corrected quotation or close the request with a documented reason.' },
  INVOICE_REJECTED: { tab: 'Invoice', owner: 'manager', title: 'Recover the invoice', description: 'Correct the rejected invoice and submit a new version.' },
}

const roleLabels = {
  admin: 'Admin', super_admin: 'Super admin', requester: 'Requester', hod: 'Requester', staff: 'Requester',
  manager: 'Purchase manager', technician: 'Technician', accounts: 'Accounts',
}

const normalizeRole = role => ['hod', 'staff'].includes(role) ? 'requester' : role

// These labels are the single display vocabulary for request workflow statuses.
// API/database codes remain unchanged so transitions and filters stay stable.
export const WORKFLOW_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Admin Review',
  UNDER_ADMIN_REVIEW: 'Admin Review',
  CLARIFICATION_REQUIRED: 'Clarification Required',
  REOPENED: 'Reopened for Review',
  APPROVED: 'Awaiting Manager Assignment',
  ASSIGNED_TO_MANAGER: 'Assigned to Purchase Manager',
  PURCHASE_ORDER_CREATED: 'Purchase Order Created',
  UNDER_INSPECTION: 'Under Inspection',
  QUOTATION_IN_PROGRESS: 'Quotation in Progress',
  QUOTATION_REVISION_REQUIRED: 'Quotation Revision Required',
  QUOTATION_SUBMITTED: 'Quotation Approval Pending',
  QUOTATION_APPROVED: 'Quotation Approved',
  QUOTATION_REJECTED: 'Quotation Rejected',
  WORK_ORDER_CREATED: 'Work Order Created',
  TECHNICIAN_ASSIGNED: 'Technician Assigned',
  WORK_ACCEPTED: 'Work Accepted',
  WORK_DECLINED: 'Work Declined',
  PAUSED: 'Work Paused',
  IN_PROGRESS: 'Work in Progress',
  ADDITIONAL_COST_PENDING: 'Additional Cost Approval Pending',
  TECHNICIAN_COMPLETED: 'Technician Work Completed',
  SERVICE_VERIFIED: 'Service Verified',
  INVOICE_IN_PROGRESS: 'Invoice in Progress',
  INVOICE_REVISION_REQUIRED: 'Invoice Revision Required',
  INVOICE_SUBMITTED: 'Invoice Approval Pending',
  INVOICE_REJECTED: 'Invoice Rejected',
  PAYMENT_PENDING: 'Payment Pending',
  PARTIALLY_PAID: 'Partially Paid',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

export function getWorkflowStatusLabel(status) {
  if (!status) return 'Status Unknown'
  return WORKFLOW_STATUS_LABELS[status] || String(status)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

export const WORKFLOW_PHASES = [
  { key: 'request', label: 'Intent Request', short: 'Request', statuses: ['DRAFT'] },
  { key: 'review', label: 'Admin Review', short: 'Review', statuses: ['SUBMITTED'] },
  { key: 'assignment', label: 'Quotation & Selection', short: 'Quotation', statuses: ['ASSIGNED_TO_MANAGER', 'QUOTATION_IN_PROGRESS', 'QUOTATION_REVISION_REQUIRED', 'QUOTATION_REJECTED'] },
  { key: 'order', label: 'Order Created', short: 'Order', statuses: ['PURCHASE_ORDER_CREATED'] },
  { key: 'complete', label: 'Completed', short: 'Complete', statuses: ['CLOSED'] },
]

export const ROLE_ACTION_STATUSES = {
  requester: [],
  admin: ['SUBMITTED'],
  // Super admins can perform admin triage and must see the same pending list.
  super_admin: ['SUBMITTED'],
  manager: ['ASSIGNED_TO_MANAGER', 'QUOTATION_IN_PROGRESS', 'QUOTATION_REVISION_REQUIRED', 'QUOTATION_REJECTED'],
  technician: [],
  accounts: [],
}

export function getRoleActionStatuses(role) {
  return ROLE_ACTION_STATUSES[normalizeRole(role)] || []
}

export function getWorkflowPhase(status) {
  return WORKFLOW_PHASES.find(phase => phase.statuses.includes(status)) || null
}

export function getWorkflowGuidance(status, role, request) {
  const isServiceRequest = request?.adminAssessment?.requirementType === 'MAINTENANCE'
  const item = status === 'ASSIGNED_TO_MANAGER' && isServiceRequest
    ? { tab: 'Overview', owner: 'manager', title: 'Create the Service PO', description: 'Create the Service PO directly. Actual repair costs and scanned bills will be recorded after the service is completed.' }
    : guidance[status] || { tab: 'History', owner: null, title: 'Archived workflow record', description: 'This request belongs to the previous workflow and is available for reference only.' }
  const normalizedRole = normalizeRole(role)
  return {
    ...item,
    isMyTurn: Boolean(item.owner && item.owner === normalizedRole),
    ownerLabel: item.owner ? roleLabels[item.owner] : null,
  }
}
