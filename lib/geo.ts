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

// How far from the classroom a student may be before any GPS uncertainty is added
export const BASE_CHECKIN_METERS = 200;

// A position is only trusted as "where the class is" if it is this precise.
// Applies both to saving a classroom location and to a teacher's live position.
// (Laptops guess from Wi-Fi and are often far less precise, or confidently wrong.)
export const MAX_VENUE_ACCURACY_METERS = 100;

// Caps so a phone reporting a huge uncertainty can't check in from anywhere
const MAX_STUDENT_EXTRA = 500;
const MAX_CLASSROOM_EXTRA = MAX_VENUE_ACCURACY_METERS;

function clamp(value: number | null | undefined, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;
}

// How far a student may be: the base radius, plus how unsure the student's phone is,
// plus how unsure the saved classroom position was. Both readings can be off, so both count.
export function allowedDistance(studentAccuracy?: number | null, classroomAccuracy?: number | null): number {
  return (
    BASE_CHECKIN_METERS +
    clamp(studentAccuracy, MAX_STUDENT_EXTRA) +
    clamp(classroomAccuracy, MAX_CLASSROOM_EXTRA)
  );
}
