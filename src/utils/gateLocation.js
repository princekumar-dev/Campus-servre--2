export function getGateLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location access is not supported by this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission is required. Allow precise location access and try again.'
          : error.code === error.TIMEOUT
            ? 'Location lookup timed out. Move outdoors near the gate and try again.'
            : 'Your current location could not be determined. Turn on GPS and try again.'
        reject(new Error(message))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 }
    )
  })
}

export function locationQuery(location) {
  return new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    accuracy: String(location.accuracy)
  }).toString()
}
