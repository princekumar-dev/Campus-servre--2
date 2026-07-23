import crypto from 'crypto'
import { connectToDatabase } from './mongo.js'
import { PurchaseOrder } from '../models.js'

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

export function hashPoQrToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

export function getPoIdFromQrToken(token) {
  const [poId, suppliedSignature, ...extra] = String(token || '').split('.')
  if (!/^[a-f\d]{24}$/i.test(poId || '') || !suppliedSignature || extra.length) return null
  return poId
}

export function verifyPoQrToken(token) {
  const poId = getPoIdFromQrToken(token)
  if (!poId) return null
  const suppliedSignature = String(token).split('.')[1]

  const expectedSignature = signatureFor(poId)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null
  return poId
}

// Issued-token hashes survive environment secret rotation and prevent a valid
// printed PO from becoming unusable after a deployment. Only the exact token
// saved while generating the PDF is accepted.
export async function verifyIssuedPoQrToken(token) {
  const signedPoId = verifyPoQrToken(token)
  if (signedPoId) return signedPoId

  const poId = getPoIdFromQrToken(token)
  if (!poId) return null

  await connectToDatabase()
  const issued = await PurchaseOrder.exists({
    _id: poId,
    qrTokenHash: hashPoQrToken(token)
  })
  return issued ? poId : null
}
