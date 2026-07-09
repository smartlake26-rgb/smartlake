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

/**
 * Matn shaklidagi koordinatani (DMS, DDM yoki o'nlik) songa aylantiradi.
 * Masalan: "41.5325", "41,5325", "41°18'32.4\"N", "41 18 32.4"
 */
export function parseCoordinateString(str) {
  if (str == null) return NaN;
  const clean = String(str).trim();
  if (clean === '') return NaN;

  // 1. Oddiy o'nlik format (nuqta yoki vergul bilan)
  const simpleDec = Number(clean.replace(',', '.'));
  if (!Number.isNaN(simpleDec)) {
    return simpleDec;
  }

  // 2. DMS (Degrees Minutes Seconds) format: e.g. 41°18'32.4"N yoki 41 18 32.4 N
  const dmsRegex = /^\s*(\d+)\s*(?:°|d|deg)?\s*(\d+)\s*(?:'|m|min)?\s*(\d+(?:\.\d+)?)\s*(?:"|''|s|sec)?\s*(N|S|E|W)?\s*$/i;
  const matchDms = clean.match(dmsRegex);
  if (matchDms) {
    const deg = parseFloat(matchDms[1]);
    const min = parseFloat(matchDms[2]);
    const sec = parseFloat(matchDms[3]);
    const dir = matchDms[4] ? matchDms[4].toUpperCase() : '';

    let decimal = deg + (min / 60) + (sec / 3600);
    if (dir === 'S' || dir === 'W') {
      decimal = -decimal;
    }
    return decimal;
  }

  // 3. DDM (Degrees Decimal Minutes) format: e.g. 41 18.54' N yoki 41° 18.54 N
  const ddmRegex = /^\s*(\d+)\s*(?:°|d|deg)?\s*(\d+(?:\.\d+)?)\s*(?:'|m|min)?\s*(N|S|E|W)?\s*$/i;
  const matchDdm = clean.match(ddmRegex);
  if (matchDdm) {
    const deg = parseFloat(matchDdm[1]);
    const min = parseFloat(matchDdm[2]);
    const dir = matchDdm[3] ? matchDdm[3].toUpperCase() : '';

    let decimal = deg + (min / 60);
    if (dir === 'S' || dir === 'W') {
      decimal = -decimal;
    }
    return decimal;
  }

  return NaN;
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
