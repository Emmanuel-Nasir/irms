export type Fix = { latitude: number; longitude: number; accuracy: number };
export type GeoFailure = "denied" | "unavailable" | "timeout" | "unsupported";
export type GeoResult = { ok: true; fix: Fix } | { ok: false; reason: GeoFailure };

type Options = {
  // Stop as soon as a reading is at least this precise (metres)
  goodEnough?: number;
  // Give up waiting after this long and use the best reading so far
  maxWaitMs?: number;
  // Called with every reading, so the page can show "accurate to about X m"
  onProgress?: (fix: Fix) => void;
};

function reason(code: number): GeoFailure {
  return code === 1 ? "denied" : code === 2 ? "unavailable" : "timeout";
}

/**
 * Watches the device's position for a few seconds and keeps the most precise reading.
 *
 * The first reading a phone gives is often a rough guess from Wi-Fi or mobile masts,
 * hundreds of metres off. GPS readings arrive a few seconds later and are usually far
 * better. Taking the first reading is what made students appear "300+ m away".
 */
export function getBestLocation({ goodEnough = 30, maxWaitMs = 15000, onProgress }: Options = {}): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    let best: Fix | null = null;
    let lastError: GeoFailure = "timeout";
    let done = false;
    let watchId: number | null = null;

    const finish = (result: GeoResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve(result);
    };

    const timer = setTimeout(
      () => finish(best ? { ok: true, fix: best } : { ok: false, reason: lastError }),
      maxWaitMs
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (!best || fix.accuracy < best.accuracy) {
          best = fix;
          onProgress?.(fix);
        }
        if (fix.accuracy <= goodEnough) finish({ ok: true, fix });
      },
      (err) => {
        lastError = reason(err.code);
        if (err.code === 1) finish({ ok: false, reason: "denied" }); // no point waiting
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWaitMs }
    );
  });
}

// Kept for older callers: same as getBestLocation with default settings
export function getLocation(): Promise<GeoResult> {
  return getBestLocation();
}
