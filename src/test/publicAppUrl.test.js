import { describe, expect, it } from 'vitest'
import { CAMPUSSERVE_PUBLIC_URL, resolvePublicAppUrl } from '../../lib/publicAppUrl'

describe('resolvePublicAppUrl', () => {
  it('uses CampusServe when no deployment URL is configured', () => {
    expect(resolvePublicAppUrl()).toBe(CAMPUSSERVE_PUBLIC_URL)
  })

  it('replaces the retired Academics deployment URL', () => {
    expect(resolvePublicAppUrl('https://msec-academics.vercel.app/')).toBe(CAMPUSSERVE_PUBLIC_URL)
  })

  it('keeps a valid explicitly configured CampusServe URL', () => {
    expect(resolvePublicAppUrl('https://msec-campusserve.vercel.app/')).toBe(CAMPUSSERVE_PUBLIC_URL)
  })
})
