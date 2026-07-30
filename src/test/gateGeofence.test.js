import { describe, expect, it } from 'vitest'
import { distanceInMeters, distanceToCampusBoundary, isInsideCampusBoundary, validateGateLocation } from '../../lib/gateGeofence'

describe('gate PO geofence', () => {
  it('allows the previous location because it is within the 1 km buffer', () => {
    expect(validateGateLocation({
      latitude: 13.050807,
      longitude: 80.224843,
      accuracy: 15
    }).allowed).toBe(true)
  })

  it('allows the supplied college centre point', () => {
    expect(validateGateLocation({
      latitude: 13.0551111111,
      longitude: 80.2268611111,
      accuracy: 15
    }).allowed).toBe(true)
  })

  it('rejects a location outside the campus boundary', () => {
    const result = validateGateLocation({
      latitude: 13.070807,
      longitude: 80.224843,
      accuracy: 15
    })
    expect(result.allowed).toBe(false)
    expect(result.status).toBe(403)
  })

  it('rejects an inaccurate GPS reading', () => {
    expect(validateGateLocation({
      latitude: 13.050807,
      longitude: 80.224843,
      accuracy: 150
    }).allowed).toBe(false)
  })

  it('calculates zero distance at the configured gate point', () => {
    expect(distanceInMeters(13.0551111111, 80.2268611111)).toBe(0)
  })

  it('uses all four supplied corners as the campus polygon', () => {
    expect(isInsideCampusBoundary(13.0552, 80.2272)).toBe(true)
    expect(isInsideCampusBoundary(13.0535, 80.2272)).toBe(false)
  })

  it('measures zero boundary distance inside campus and a positive distance outside', () => {
    expect(distanceToCampusBoundary(13.0552, 80.2272)).toBe(0)
    expect(distanceToCampusBoundary(13.0652, 80.2272)).toBeGreaterThan(900)
  })
})
