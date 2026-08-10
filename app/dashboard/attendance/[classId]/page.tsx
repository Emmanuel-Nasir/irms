"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

type Session = { token: string; expiresAt: string } | null;
type AttendanceRecord = { id: string; student: { user: { name: string } }; status: string };

export default function ClassAttendancePage() {
  const params = useParams();
  const classId = params.classId as string;
  const [session, setSession] = useState<Session>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [active, setActive] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [justArrived, setJustArrived] = useState<string | null>(null);
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const prevCountRef = useRef(0);

  const loadRecords = useCallback(async () => {
    const res = await fetch(`/api/attendance?classId=${classId}`);
    const data: AttendanceRecord[] = await res.json();
    if (data.length > prevCountRef.current && data.length > 0) {
      setJustArrived(data[data.length - 1].student.user.name);
      setTimeout(() => setJustArrived(null), 2500);
    }
    prevCountRef.current = data.length;
    setRecords(data);
  }, [classId]);

  const createSession = useCallback(async () => {
    const body: Record<string, unknown> = { classId };
    if (coordsRef.current) {
      body.latitude = coordsRef.current.latitude;
      body.longitude = coordsRef.current.longitude;
    }
    const res = await fetch("/api/attendance/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSession(await res.json());
  }, [classId]);

  async function startAttendance() {
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setActive(true);
      },
      () => {
        setLocationError("Location access denied — check-ins won't be location-verified.");
        coordsRef.current = null;
        setActive(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function stopAttendance() {
    setActive(false);
    setSession(null);
  }

  async function removeCheckin(id: string) {
    await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    loadRecords();
  }

  useEffect(() => {
    loadRecords();
    const recordsInterval = setInterval(loadRecords, 5000);
    return () => clearInterval(recordsInterval);
  }, [loadRecords]);

  useEffect(() => {
    if (!active) return;
    createSession();
    const rotateInterval = setInterval(createSession, 60 * 1000);
    return () => clearInterval(rotateInterval);
  }, [active, createSession]);

  const checkinUrl = session
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/checkin/${session.token}`
    : "";

  return (
    <div className="min-h-screen bg-navy">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-8 text-center font-display text-3xl tracking-wide text-parchment">
          Attendance Check-In
        </h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[420px_1fr]">
          {/* QR panel */}
          <div className="flex flex-col items-center rounded-lg border-t-4 border-gold bg-parchment p-8 shadow-2xl">
            {locationError && (
              <p className="mb-4 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-center text-sm text-clay">
                {locationError}
              </p>
            )}

            {active && session ? (
              <>
                <div className="rounded-lg bg-white p-6 shadow-inner">
                  <QRCodeSVG value={checkinUrl} size={260} />
                </div>
                <p className="mt-5 break-all text-center text-xs text-navy/50">{checkinUrl}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(checkinUrl)}
                  className="mt-2 rounded border border-navy/20 px-3 py-1 text-sm text-navy transition-colors hover:border-gold hover:text-gold"
                >
                  Copy link
                </button>
                <p className="mt-4 flex items-center gap-2 text-sm text-navy/60">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sage" />
                  Live — refreshes every 60s
                </p>
                <button
                  onClick={stopAttendance}
                  className="mt-6 w-full rounded bg-clay py-2.5 font-medium text-white transition-all hover:bg-clay/90"
                >
                  Stop Attendance
                </button>
              </>
            ) : (
              <button
                onClick={startAttendance}
                className="rounded bg-navy px-8 py-4 text-lg font-medium text-parchment transition-all hover:scale-105 hover:bg-gold hover:text-navy"
              >
                Start Attendance
              </button>
            )}
          </div>

          {/* Live roster panel */}
          <div className="rounded-lg border-t-4 border-gold bg-parchment p-6 shadow-2xl">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-navy">Checked In</h2>
              <span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-white">
                {records.length}
              </span>
            </div>

            {justArrived && (
              <div className="mb-3 animate-pulse rounded border border-sage/40 bg-sage/10 px-3 py-2 text-sm font-medium text-sage">
                ✓ {justArrived} just checked in
              </div>
            )}

            {records.length === 0 ? (
              <p className="py-8 text-center text-sm text-navy/40">
                No one has checked in yet — the room fills up here as students scan.
              </p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded border border-navy/10 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy font-display text-sm text-parchment">
                        {r.student.user.name.charAt(0)}
                      </span>
                      <span className="font-medium text-navy">{r.student.user.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sage">
                        {r.status}
                      </span>
                      <button
                        onClick={() => removeCheckin(r.id)}
                        className="text-xs text-clay transition-colors hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}