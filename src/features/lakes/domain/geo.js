// ============================================================
//  features/lakes/domain/geo.js — Geo model (WGS84)
//  Koordinatalar WGS84 (lat/lng) formatida. Sof modul.
//  Kelajakda xarita (Google Maps/OSM) integratsiyasi uchun seam:
//  toGeoPoint() bir joyda -> provayderga moslash oson.
// ============================================================

/** lat WGS84 chegarasi. */
export function isValidLat(lat) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

/** lng WGS84 chegarasi. */
export function isValidLng(lng) {
  return typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/** {lat,lng} juftligi to'g'rimi? (null = koordinatasiz — ruxsat) */
export function isValidCoordinates(coords) {
  if (coords == null) return true;                 // ixtiyoriy
  return !!coords && isValidLat(coords.lat) && isValidLng(coords.lng);
}

/**
 * Xarita provayderi uchun normal shakl (seam).
 * Hozircha oddiy {lat,lng}; kelajakda provider formatiga moslanadi.
 */
export function toGeoPoint(coords) {
  if (!isValidCoordinates(coords) || coords == null) return null;
  return { lat: coords.lat, lng: coords.lng };
}

export default { isValidLat, isValidLng, isValidCoordinates, toGeoPoint };
