/**
 * Browser Geolocation. This is the phone's own GPS chip via the browser — no
 * API key, no network call, no cost. Turning coordinates into a street address
 * would need a geocoding service; the address is typed on the form instead.
 */

export interface FieldLocation {
  latitude: number
  longitude: number
  /** Metres. Anything over ~50 usually means it fell back to wifi/cell. */
  accuracy: number
  /** When the fix was taken, not when the report was generated. */
  capturedAt: string
}

export function isGeolocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function getFieldLocation(): Promise<FieldLocation> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationAvailable()) {
      reject(new Error('This browser has no location support.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp).toISOString(),
        }),
      (err) => {
        // The default GeolocationPositionError messages are vague, and the
        // permission case is the one worth naming precisely.
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Enable it for this site in your browser settings.'))
            break
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Location unavailable. Try again outdoors or with a clearer view of the sky.'))
            break
          case err.TIMEOUT:
            reject(new Error('Location timed out. Try again.'))
            break
          default:
            reject(new Error(err.message || 'Could not get location.'))
        }
      },
      {
        // Standing at a property: worth waiting for the real GPS fix rather
        // than accepting a wifi-derived guess that could be a block away.
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000, // a fix from the last minute is still this property
      }
    )
  })
}

/** For the report and the file note. */
export function formatLocation(loc: FieldLocation): string {
  const lat = loc.latitude.toFixed(6)
  const lon = loc.longitude.toFixed(6)
  return `${lat}, ${lon} (+/-${Math.round(loc.accuracy)}m) at ${new Date(loc.capturedAt).toLocaleString('en-US')}`
}

/** Tapping the coordinates in the file note should open a map. */
export function mapsUrl(loc: FieldLocation): string {
  return `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
}
