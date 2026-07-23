import crypto from 'crypto'

const PRODUCT_ID_PATTERN = /^PRD-[A-F0-9]{10}$/

export function generateProductId() {
  return `PRD-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
}

// Older PO items already have a unique Mongo subdocument id. Deriving their
// display id from it gives them a stable product id without a risky migration.
export function getProductId(item) {
  const stored = String(item?.productId || '').trim().toUpperCase()
  if (PRODUCT_ID_PATTERN.test(stored)) return stored

  const legacyId = String(item?._id || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase()
  if (legacyId.length >= 10) return `PRD-${legacyId.slice(-10)}`

  return generateProductId()
}

export function addProductIds(items = []) {
  return items.map(item => ({ ...item, productId: getProductId(item) }))
}
