import { describe, expect, it } from 'vitest'
import { distanceInMeters, validateGateLocation } from '../../lib/gateGeofence'

describe('gate PO geofence', () => {
  it('allows a precise location at the configured campus gate', () => {
    expect(validateGateLocation({
      latitude: 13.050807,
      longitude: 80.224843,
      accuracy: 15
    }).allowed).toBe(true)
  })

  it('rejects a location outside the gate radius', () => {
    const result = validateGateLocation({
      latitude: 13.060807,
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
    expect(distanceInMeters(13.050807, 80.224843)).toBe(0)
  })
})
