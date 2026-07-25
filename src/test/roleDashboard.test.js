import { describe, expect, it } from 'vitest'
import { getDashboardPath } from '../utils/auth'

describe('role dashboard routing', () => {
  it.each([
    ['gate', '/gate/dashboard'],
    ['vendor', '/vendor/dashboard'],
    ['receiving_officer', '/receiving/dashboard'],
    ['accounts', '/accounts/dashboard']
  ])('routes %s to its dedicated dashboard', (role, expectedPath) => {
    expect(getDashboardPath(role)).toBe(expectedPath)
  })

  it.each([
    'admin',
    'super_admin',
    'manager',
    'requester',
    'hod',
    'staff',
    'technician',
    'delivery_person'
  ])('routes %s to the role-aware main dashboard', (role) => {
    expect(getDashboardPath(role)).toBe('/dashboard')
  })

  it('uses the safe main dashboard for an unknown role', () => {
    expect(getDashboardPath('unknown')).toBe('/dashboard')
  })
})
