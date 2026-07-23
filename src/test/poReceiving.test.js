import { describe, expect, it } from 'vitest'
import { canReceivePo, getPoReceivingBlockReason } from '../../lib/poReceiving.js'

describe('PO receiving gate', () => {
  it('blocks a draft even when a signed photo exists', () => {
    const po = { status: 'DRAFT', signedPo: { status: 'VERIFIED' } }
    expect(canReceivePo(po)).toBe(false)
    expect(getPoReceivingBlockReason(po)).toMatch(/draft/)
  })

  it('blocks an active PO until its signed official photo is verified', () => {
    const po = { status: 'ACTIVE', signedPo: { status: 'PENDING_VERIFICATION' } }
    expect(canReceivePo(po)).toBe(false)
    expect(getPoReceivingBlockReason(po)).toMatch(/signed official PO/)
  })

  it.each(['ACTIVE', 'PARTIALLY_FULFILLED'])('allows verified %s POs', status => {
    expect(canReceivePo({ status, signedPo: { status: 'VERIFIED' } })).toBe(true)
  })
})
