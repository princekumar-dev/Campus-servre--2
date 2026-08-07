import { describe, expect, it } from 'vitest'
import { distanceInMeters, distanceToCampusBoundary, isInsideCampusBoundary, validateGateLocation } from '../../lib/gateGeofence'

describe('gate PO geofence', () => {
  it('rejects the previous location because the old 1 km buffer was removed', () => {
    expect(validateGateLocation({
      latitude: 13.050807,
      longitude: 80.224843,
      accuracy: 15
    }).allowed).toBe(false)
  })

  it('allows the centre of the new approved scan area', () => {
    expect(validateGateLocation({
      latitude: 13.0541390965,
      longitude: 80.2270551494,
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

  it('calculates zero distance at the configured scan-area centre', () => {
    expect(distanceInMeters(13.0541390965, 80.2270551494)).toBe(0)
  })

  it('uses all four supplied corners as the campus polygon', () => {
    expect(isInsideCampusBoundary(13.0541390965, 80.2270551494)).toBe(true)
    expect(isInsideCampusBoundary(13.0543, 80.2272)).toBe(false)
  })

  it('measures zero boundary distance inside campus and a positive distance outside', () => {
    expect(distanceToCampusBoundary(13.0541390965, 80.2270551494)).toBe(0)
    expect(distanceToCampusBoundary(13.0641390965, 80.2270551494)).toBeGreaterThan(1000)
  })

  it('allows a Service PO scan within the 200 m campus GPS buffer', () => {
    const location = {
      latitude: 13.05555,
      longitude: 80.2270551494,
      accuracy: 25
    }
    expect(distanceToCampusBoundary(location.latitude, location.longitude)).toBeGreaterThan(100)
    expect(distanceToCampusBoundary(location.latitude, location.longitude)).toBeLessThan(200)
    expect(validateGateLocation(location, { boundaryBufferMeters: 200 }).allowed).toBe(true)
  })

  it('still rejects a Service PO scan beyond the 200 m campus GPS buffer', () => {
    expect(validateGateLocation({
      latitude: 13.057,
      longitude: 80.2270551494,
      accuracy: 25
    }, { boundaryBufferMeters: 200 }).allowed).toBe(false)
  })
})
