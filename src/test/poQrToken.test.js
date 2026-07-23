import { describe, expect, it } from 'vitest'
import { createPoQrToken, verifyPoQrToken } from '../../lib/poQrToken'

describe('purchase-order QR tokens', () => {
  it('round-trips a signed purchase-order id', () => {
    const poId = '6a61e79319bb2562090e9614'
    expect(verifyPoQrToken(createPoQrToken(poId))).toBe(poId)
  })

  it('rejects an altered purchase-order id', () => {
    const token = createPoQrToken('6a61e79319bb2562090e9614')
    expect(verifyPoQrToken(`7a61e79319bb2562090e9614.${token.split('.')[1]}`)).toBeNull()
  })

  it('rejects malformed tokens', () => {
    expect(verifyPoQrToken('not-a-signed-token')).toBeNull()
  })
})
