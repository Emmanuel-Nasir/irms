// Haversine formula: distance between two points, in metres
export function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const BASE_CHECKIN_METERS = 300;

// A classroom location is only saved if the device knew its position this precisely
export const MAX_VENUE_ACCURACY_METERS = 100;

// How far from the class a student may be: the base radius plus however
// uncertain the phone says its own position is (capped so it can't be abused)
export function allowedDistance(studentAccuracy?: number): number {
  const extra =
    typeof studentAccuracy === "number" && Number.isFinite(studentAccuracy)
      ? Math.min(Math.max(studentAccuracy, 0), 1000)
      : 0;
  return BASE_CHECKIN_METERS + extra;
}