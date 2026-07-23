import { describe, expect, it } from 'vitest'
import { addProductIds, generateProductId, getProductId } from '../../lib/productId.js'

describe('product ids', () => {
  it('generates readable product ids', () => {
    expect(generateProductId()).toMatch(/^PRD-[A-F0-9]{10}$/)
  })

  it('keeps a valid stored product id', () => {
    expect(getProductId({ productId: 'prd-a1b2c3d4e5' })).toBe('PRD-A1B2C3D4E5')
  })

  it('derives a stable id for legacy PO items', () => {
    const legacy = { _id: '507f1f77bcf86cd799439011', description: 'Pump' }
    expect(getProductId(legacy)).toBe('PRD-D799439011')
    expect(addProductIds([legacy])[0].productId).toBe('PRD-D799439011')
  })
})
