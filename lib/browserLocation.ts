export type Fix = { latitude: number; longitude: number; accuracy: number };
export type GeoFailure = "denied" | "unavailable" | "timeout" | "unsupported";
export type GeoResult = { ok: true; fix: Fix } | { ok: false; reason: GeoFailure };

function once(options: PositionOptions): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          fix: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }),
      (err) =>
        resolve({
          ok: false,
          reason: err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "timeout",
        }),
      options
    );
  });
}

export async function getLocation(): Promise<GeoResult> {
  // 1) A quick, rough fix: usually arrives in a couple of seconds, even indoors
  const quick = await once({ enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
  if (!quick.ok && quick.reason === "denied") return quick;
  if (quick.ok && quick.fix.accuracy <= 300) return quick;

  // 2) The rough fix wasn't good enough: wait longer for GPS
  const precise = await once({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  if (precise.ok) return precise;
  return quick.ok ? quick : precise;
}