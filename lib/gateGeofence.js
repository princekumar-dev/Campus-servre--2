export const GATE_LOCATION = Object.freeze({
  latitude: Number(process.env.GATE_LATITUDE || 13.050807),
  longitude: Number(process.env.GATE_LONGITUDE || 80.224843),
  radiusMeters: Number(process.env.GATE_RADIUS_METERS || 250),
  maxAccuracyMeters: Number(process.env.GATE_MAX_ACCURACY_METERS || 100),
  address: '363G+RHC, 363 Arcot Road, Kodambakkam, Chennai, Tamil Nadu 600024'
})

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
  if (distance > GATE_LOCATION.radiusMeters) {
    return {
      allowed: false,
      status: 403,
      error: `Gate PO verification is available only within ${GATE_LOCATION.radiusMeters} m of the campus gate. You are approximately ${Math.round(distance)} m away.`
    }
  }
  return { allowed: true, distance, accuracy }
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
