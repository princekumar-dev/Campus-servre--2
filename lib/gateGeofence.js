import { getSystemSettings } from './systemSettings.js'

export const GATE_LOCATION = Object.freeze({
  // Centre of the approved PO scanning area supplied by the campus.
  latitude: Number(process.env.GATE_LATITUDE || 13.0541390965),
  longitude: Number(process.env.GATE_LONGITUDE || 80.2270551494),
  boundaryBufferMeters: Number(process.env.GATE_BOUNDARY_BUFFER_METERS || 0),
  maxAccuracyMeters: Number(process.env.GATE_MAX_ACCURACY_METERS || 100),
  address: '363G+RHC, 363 Arcot Road, Kodambakkam, Chennai, Tamil Nadu 600024'
})

// Clockwise campus boundary: north-west, north-east, south-east, south-west.
export const CAMPUS_BOUNDARY = Object.freeze([
  Object.freeze({ latitude: 13.054232020489877, longitude: 80.22696725797628 }),
  Object.freeze({ latitude: 13.054251368762879, longitude: 80.22710277756981 }),
  Object.freeze({ latitude: 13.054054432215692, longitude: 80.22717346569492 }),
  Object.freeze({ latitude: 13.05401856447674, longitude: 80.22697709640454 })
])

const toRadians = value => value * Math.PI / 180

export function distanceInMeters(latitude, longitude) {
  const earthRadius = 6371000
  const latDelta = toRadians(latitude - GATE_LOCATION.latitude)
  const lonDelta = toRadians(longitude - GATE_LOCATION.longitude)
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(GATE_LOCATION.latitude)) * Math.cos(toRadians(latitude)) *
    Math.sin(lonDelta / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isInsideCampusBoundary(latitude, longitude) {
  let inside = false
  for (let current = 0, previous = CAMPUS_BOUNDARY.length - 1; current < CAMPUS_BOUNDARY.length; previous = current++) {
    const a = CAMPUS_BOUNDARY[current]
    const b = CAMPUS_BOUNDARY[previous]
    const crossesLatitude = (a.latitude > latitude) !== (b.latitude > latitude)
    const boundaryLongitude = (b.longitude - a.longitude) * (latitude - a.latitude) /
      (b.latitude - a.latitude) + a.longitude
    if (crossesLatitude && longitude < boundaryLongitude) inside = !inside
  }
  return inside
}

export function distanceToCampusBoundary(latitude, longitude) {
  if (isInsideCampusBoundary(latitude, longitude)) return 0
  const metersPerLatitudeDegree = 111320
  const metersPerLongitudeDegree = metersPerLatitudeDegree * Math.cos(toRadians(latitude))
  let shortest = Number.POSITIVE_INFINITY

  for (let index = 0; index < CAMPUS_BOUNDARY.length; index += 1) {
    const start = CAMPUS_BOUNDARY[index]
    const end = CAMPUS_BOUNDARY[(index + 1) % CAMPUS_BOUNDARY.length]
    const startX = (start.longitude - longitude) * metersPerLongitudeDegree
    const startY = (start.latitude - latitude) * metersPerLatitudeDegree
    const endX = (end.longitude - longitude) * metersPerLongitudeDegree
    const endY = (end.latitude - latitude) * metersPerLatitudeDegree
    const segmentX = endX - startX
    const segmentY = endY - startY
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2
    const projection = segmentLengthSquared
      ? Math.max(0, Math.min(1, -(startX * segmentX + startY * segmentY) / segmentLengthSquared))
      : 0
    const closestX = startX + projection * segmentX
    const closestY = startY + projection * segmentY
    shortest = Math.min(shortest, Math.hypot(closestX, closestY))
  }
  return shortest
}

export function validateGateLocation(location, options = {}) {
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  const accuracy = Number(location?.accuracy)
  if (![latitude, longitude, accuracy].every(Number.isFinite)) {
    return { allowed: false, status: 400, error: 'Your current GPS location is required to use the gate PO scanner.' }
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy < 0) {
    return { allowed: false, status: 400, error: 'The device returned an invalid GPS location.' }
  }
  if (accuracy > GATE_LOCATION.maxAccuracyMeters) {
    return {
      allowed: false,
      status: 403,
      error: `GPS accuracy is too low (${Math.round(accuracy)} m). Move outdoors near the gate and try again.`
    }
  }
  const distance = distanceInMeters(latitude, longitude)
  const boundaryDistance = distanceToCampusBoundary(latitude, longitude)
  const configuredBuffer = Number(options.boundaryBufferMeters ?? GATE_LOCATION.boundaryBufferMeters)
  const boundaryBufferMeters = Number.isFinite(configuredBuffer) && configuredBuffer >= 0 ? configuredBuffer : 0
  if (boundaryDistance > boundaryBufferMeters) {
    return {
      allowed: false,
      status: 403,
      error: boundaryBufferMeters > 0
        ? `PO verification is available only within ${boundaryBufferMeters} m of the approved campus scan area. Your reported position is approximately ${Math.round(boundaryDistance)} m outside it.`
        : `PO scanning is available only inside the approved campus scan area. Your reported position is approximately ${Math.max(1, Math.round(boundaryDistance))} m outside it.`
    }
  }
  return { allowed: true, distance, boundaryDistance, accuracy }
}

export async function requireGateLocation(req, res, options = {}) {
  const settings = await getSystemSettings()
  const settingKey = options.settingKey || 'goodsPoGeofenceEnabled'
  if (settings[settingKey] === false) return { allowed: true, bypassed: true }
  const source = req.method === 'GET' ? req.query : req.body
  const result = validateGateLocation({
    latitude: source?.latitude,
    longitude: source?.longitude,
    accuracy: source?.accuracy
  }, options)
  if (!result.allowed) res.status(result.status).json({ success: false, error: result.error, code: 'OUTSIDE_GATE_GEOFENCE' })
  return result
}
