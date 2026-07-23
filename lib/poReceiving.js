const RECEIVABLE_STATUSES = new Set(['ACTIVE', 'PARTIALLY_FULFILLED'])

export function isSignedPoVerified(po) {
  return po?.signedPo?.status === 'VERIFIED'
}

export function canReceivePo(po) {
  return Boolean(po && RECEIVABLE_STATUSES.has(po.status) && isSignedPoVerified(po))
}

export function getPoReceivingBlockReason(po) {
  if (!po) return 'Purchase order not found'
  if (!isSignedPoVerified(po)) return 'The signed official PO must be verified before receiving goods'
  if (!RECEIVABLE_STATUSES.has(po.status)) {
    return `This purchase order is ${String(po.status || 'unknown').replace(/_/g, ' ').toLowerCase()} and is not ready to receive goods`
  }
  return ''
}
