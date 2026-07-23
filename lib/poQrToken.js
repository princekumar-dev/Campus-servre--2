import crypto from 'crypto'

function getSecret() {
  return process.env.PO_QR_SECRET || process.env.JWT_SECRET || 'campusserve-default-secret-change-in-production'
}

function signatureFor(poId) {
  return crypto.createHmac('sha256', getSecret()).update(String(poId)).digest('base64url')
}

export function createPoQrToken(poId) {
  const id = String(poId)
  return `${id}.${signatureFor(id)}`
}

export function verifyPoQrToken(token) {
  const [poId, suppliedSignature, ...extra] = String(token || '').split('.')
  if (!poId || !suppliedSignature || extra.length) return null

  const expectedSignature = signatureFor(poId)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null
  return poId
}
