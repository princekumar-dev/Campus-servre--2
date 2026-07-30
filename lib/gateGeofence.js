export const GATE_LOCATION = Object.freeze({
  // 13°03'18.4"N 80°13'36.7"E
  latitude: Number(process.env.GATE_LATITUDE || 13.0551111111),
  longitude: Number(process.env.GATE_LONGITUDE || 80.2268611111),
  boundaryBufferMeters: Number(process.env.GATE_BOUNDARY_BUFFER_METERS || 1000),
  maxAccuracyMeters: Number(process.env.GATE_MAX_ACCURACY_METERS || 100),
  address: '363G+RHC, 363 Arcot Road, Kodambakkam, Chennai, Tamil Nadu 600024'
})

// Clockwise campus boundary: north-west, north-east, south-east, south-west.
export const CAMPUS_BOUNDARY = Object.freeze([
  Object.freeze({ latitude: 13.0563333333, longitude: 80.2261666667 }),
  Object.freeze({ latitude: 13.056473455204358, longitude: 80.22829108386149 }),
  Object.freeze({ latitude: 13.054180736114551, longitude: 80.22782964950994 }),
  Object.freeze({ latitude: 13.0539166667, longitude: 80.2258055556 })
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

export function validateGateLocation(location) {
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
  if (boundaryDistance > GATE_LOCATION.boundaryBufferMeters) {
    return {
      allowed: false,
      status: 403,
      error: `Gate PO verification is available only within ${GATE_LOCATION.boundaryBufferMeters} m of the MSEC campus boundary. Your reported position is approximately ${Math.round(boundaryDistance)} m outside it.`
    }
  }
  return { allowed: true, distance, boundaryDistance, accuracy }
}

export function requireGateLocation(req, res) {
  const source = req.method === 'GET' ? req.query : req.body
  const result = validateGateLocation({
    latitude: source?.latitude,
    longitude: source?.longitude,
    accuracy: source?.accuracy
  })
  if (!result.allowed) res.status(result.status).json({ success: false, error: result.error, code: 'OUTSIDE_GATE_GEOFENCE' })
  return result
}
