const guidance = {
  DRAFT: { tab: 'Overview', owner: 'requester', title: 'Submit this request', description: 'Review the details, then submit it for administrative review.' },
  SUBMITTED: { tab: 'Overview', owner: 'admin', title: 'Admin triage required', description: 'Classify the requirement as maintenance, replacement, or new purchase, then assign a manager.' },
  UNDER_ADMIN_REVIEW: { tab: 'Overview', owner: 'admin', title: 'Complete the administrative review', description: 'Approve, reject, or return the request with a clear comment.' },
  CLARIFICATION_REQUIRED: { tab: 'Overview', owner: 'requester', title: 'Clarification requested', description: 'Add the missing information and resubmit the request.' },
  REOPENED: { tab: 'Overview', owner: 'super_admin', title: 'Review the reopened request', description: 'Confirm the new information and move the request forward.' },
  APPROVED: { tab: 'Overview', owner: 'super_admin', title: 'Assign an operations manager', description: 'Choose the manager who will inspect and scope the work.' },
  ASSIGNED_TO_MANAGER: { tab: 'Overview', owner: 'manager', title: 'Generate the purchase order', description: 'Review the admin classification, select a vendor, confirm items and pricing, then generate the PO.' },
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
  TECHNICIAN_COMPLETED: { tab: 'Overview', owner: 'requester', title: 'Verify the completed service', description: 'Confirm the outcome, rate the service, or reopen the request.' },
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

export const WORKFLOW_PHASES = [
  { key: 'request', label: 'Intent Request', short: 'Request', statuses: ['DRAFT'] },
  { key: 'review', label: 'Admin Review', short: 'Review', statuses: ['SUBMITTED'] },
  { key: 'assignment', label: 'PM Assignment', short: 'Assigned', statuses: ['ASSIGNED_TO_MANAGER'] },
  { key: 'order', label: 'Order Created', short: 'Order', statuses: ['PURCHASE_ORDER_CREATED'] },
  { key: 'complete', label: 'Completed', short: 'Complete', statuses: ['CLOSED'] },
]

export const ROLE_ACTION_STATUSES = {
  requester: [],
  admin: ['SUBMITTED'],
  super_admin: [],
  manager: ['ASSIGNED_TO_MANAGER'],
  technician: [],
  accounts: [],
}

export function getRoleActionStatuses(role) {
  return ROLE_ACTION_STATUSES[normalizeRole(role)] || []
}

export function getWorkflowPhase(status) {
  return WORKFLOW_PHASES.find(phase => phase.statuses.includes(status)) || null
}

export function getWorkflowGuidance(status, role) {
  const activeStatuses = new Set(['DRAFT', 'SUBMITTED', 'ASSIGNED_TO_MANAGER', 'PURCHASE_ORDER_CREATED', 'CLOSED', 'REJECTED', 'CANCELLED'])
  const item = activeStatuses.has(status)
    ? guidance[status]
    : { tab: 'History', owner: null, title: 'Archived workflow record', description: 'This request belongs to the previous workflow and is available for reference only.' }
  const normalizedRole = normalizeRole(role)
  return {
    ...item,
    isMyTurn: Boolean(item.owner && item.owner === normalizedRole),
    ownerLabel: item.owner ? roleLabels[item.owner] : null,
  }
}
