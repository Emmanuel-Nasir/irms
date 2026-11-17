"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Users } from "lucide-react";
import { getBestLocation, type Fix } from "@/lib/browserLocation";

type Session = { token: string; expiresAt: string; locationSource?: "venue" | "device" | null } | null;
type Mark = "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
type RosterStudent = {
  studentId: string;
  name: string;
  status: Exclude<Mark, "ABSENT"> | null;
  markedByTeacher: boolean;
  checkedInAt: string | null;
  sharedWith: string[];
};
type Roster = { students: RosterStudent[]; total: number; present: number; late: number; excused: number };
type ClassVenue = {
  name: string;
  venue: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  venueAccuracy: number | null;
  venueSavedAt: string | null;
};
type Note = { good: boolean; text: string } | null;

// A position is only trusted as "where the class is" if it's this precise (the server checks too)
const MAX_TRUSTED_ACCURACY = 100;

const MARK_BUTTONS: { mark: Mark; label: string; on: string }[] = [
  { mark: "PRESENT", label: "P", on: "bg-sage text-white" },
  { mark: "LATE", label: "L", on: "bg-gold text-navy" },
  { mark: "EXCUSED", label: "E", on: "bg-navy/70 text-white" },
  { mark: "ABSENT", label: "A", on: "bg-clay text-white" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ClassAttendancePage() {
  const params = useParams();
  const classId = params.classId as string;
  const [cls, setCls] = useState<ClassVenue | null>(null);
  const [session, setSession] = useState<Session>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState<"start" | "save" | "retry" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [deviceFix, setDeviceFix] = useState<Fix | null>(null);
  const [verify, setVerify] = useState(true);
  const [note, setNote] = useState<Note>(null);
  const [justArrived, setJustArrived] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<"qr" | "list">("qr");
  const fixRef = useRef<Fix | null>(null);
  const verifyRef = useRef(true);
  const scannedRef = useRef<Set<string> | null>(null);

  const hasVenue = cls?.venueLatitude != null && cls?.venueLongitude != null;
  const canCheck = hasVenue || !!deviceFix;

  const loadClass = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}/venue`);
    if (res.ok) setCls(await res.json());
  }, [classId]);

  const loadRoster = useCallback(async () => {
    const res = await fetch(`/api/attendance/roster?classId=${classId}`);
    if (!res.ok) return;
    const data: Roster = await res.json();
    // Announce students who have just scanned in (not ones the teacher marked)
    const scanned = new Set(data.students.filter((s) => s.status && !s.markedByTeacher).map((s) => s.studentId));
    if (scannedRef.current) {
      const fresh = data.students.find((s) => scanned.has(s.studentId) && !scannedRef.current!.has(s.studentId));
      if (fresh) {
        setJustArrived(fresh.name);
        setTimeout(() => setJustArrived(null), 3000);
      }
    }
    scannedRef.current = scanned;
    setRoster(data);
  }, [classId]);

  // The server measures students from the saved classroom location if there is one,
  // otherwise from this device's live position (sent here only when it's precise)
  const createSession = useCallback(async () => {
    const body: Record<string, unknown> = { classId, checkLocation: verifyRef.current };
    if (fixRef.current) {
      body.latitude = fixRef.current.latitude;
      body.longitude = fixRef.current.longitude;
      body.accuracy = fixRef.current.accuracy;
    }
    const res = await fetch("/api/attendance/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) setSession(await res.json());
  }, [classId]);

  function locate() {
    setProgress(null);
    return getBestLocation({ goodEnough: 20, maxWaitMs: 15000, onProgress: (f) => setProgress(Math.round(f.accuracy)) });
  }

  // Used only when no classroom location is saved: try this device's own position
  async function findDeviceLocation() {
    const geo = await locate();
    if (geo.ok && geo.fix.accuracy <= MAX_TRUSTED_ACCURACY) {
      fixRef.current = geo.fix;
      setDeviceFix(geo.fix);
      setNote({
        good: true,
        text: `Location check is on, using this device's position (to about ${Math.round(geo.fix.accuracy)} m). Save it as the classroom location below and next time any device can run attendance here.`,
      });
      return;
    }
    fixRef.current = null;
    setDeviceFix(null);
    setNote({
      good: false,
      text:
        (geo.ok
          ? `This device only knows its location to about ${Math.round(geo.fix.accuracy)} m, which is too rough to check students fairly.`
          : geo.reason === "denied"
          ? "Location is blocked in this browser."
          : "This device couldn't find its location.") +
        " Students can still check in, without a location check. To check location, save the classroom location once from a phone inside the room.",
    });
  }

  async function startAttendance() {
    setNote(null);
    if (hasVenue) {
      setNote({
        good: true,
        text: "Location check is on, using this classroom's saved location. Students must be in or near the room.",
      });
      setActive(true);
      return;
    }
    setBusy("start");
    await findDeviceLocation();
    setBusy(null);
    setActive(true);
  }

  async function retryLocation() {
    setBusy("retry");
    await findDeviceLocation();
    setBusy(null);
    createSession(); // the next code carries the new location straight away
  }

  async function saveVenue() {
    setBusy("save");
    setNote(null);
    const geo = await locate();
    if (!geo.ok) {
      setNote({
        good: false,
        text:
          geo.reason === "denied"
            ? "Location is blocked in this browser. Allow it for this site, then try again."
            : "This device couldn't find its location. Turn Location on, move near a window, then try again.",
      });
      setBusy(null);
      return;
    }
    if (geo.fix.accuracy > MAX_TRUSTED_ACCURACY) {
      setNote({
        good: false,
        text: `This device only knows its position to about ${Math.round(geo.fix.accuracy)} m. Save the classroom location from a phone inside the room with Location on (it needs to be within ${MAX_TRUSTED_ACCURACY} m). Standing near a window helps.`,
      });
      setBusy(null);
      return;
    }

    const res = await fetch(`/api/classes/${classId}/venue`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geo.fix),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNote({ good: false, text: data.error ?? "The location couldn't be saved. Please try again." });
    } else {
      setCls(data);
      setNote({
        good: true,
        text: `Classroom location saved (to about ${Math.round(geo.fix.accuracy)} m). From now on students are checked against it, whichever device runs attendance.`,
      });
      if (active) createSession();
    }
    setBusy(null);
  }

  async function forgetVenue() {
    if (!window.confirm("Forget this classroom's saved location? Location checking will then depend on the device running attendance.")) return;
    const res = await fetch(`/api/classes/${classId}/venue`, { method: "DELETE" });
    if (res.ok) {
      setCls(await res.json());
      setNote({ good: false, text: "Classroom location forgotten. Save it again from a phone in the room when you can." });
      if (active) createSession();
    }
  }

  async function mark(studentId: string, status: Mark) {
    setSaving(studentId);
    // Show the change straight away; the next refresh confirms it
    setRoster((r) =>
      r && {
        ...r,
        students: r.students.map((s) =>
          s.studentId === studentId
            ? { ...s, status: status === "ABSENT" ? null : status, markedByTeacher: status !== "ABSENT" }
            : s
        ),
      }
    );
    await fetch("/api/attendance/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, studentId, status }),
    });
    setSaving(null);
    loadRoster();
  }

  function toggleVerify(next: boolean) {
    setVerify(next);
    verifyRef.current = next;
    createSession(); // refresh the code so the change applies straight away
  }

  function stopAttendance() {
    setActive(false);
    setSession(null);
  }

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  useEffect(() => {
    loadRoster();
    const interval = setInterval(loadRoster, 5000);
    return () => clearInterval(interval);
  }, [loadRoster]);

  useEffect(() => {
    if (!active) return;
    createSession();
    const rotate = setInterval(createSession, 60 * 1000);
    return () => clearInterval(rotate);
  }, [active, createSession]);

  const checkinUrl = session
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/checkin/${session.token}`
    : "";

  const finding = () => (progress === null ? "Finding location..." : `Finding location (±${progress} m)...`);
  const smallButton =
    "rounded border border-navy/20 px-3 py-1 text-sm text-navy transition-colors hover:border-gold hover:text-gold disabled:opacity-60";

  const q = search.trim().toLowerCase();
  const shown = (roster?.students ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  const attending = roster ? roster.present + roster.late : 0;
  const flagged = (roster?.students ?? []).filter((s) => s.sharedWith.length > 0).length;

  return (
    <div className="min-h-screen bg-navy">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-1 text-center font-display text-3xl tracking-wide text-parchment">Attendance</h1>
        <p className="mb-8 text-center text-sm text-parchment/70">
          {cls ? `${cls.name}${cls.venue ? ` · ${cls.venue}` : ""}` : " "}
        </p>

        {/* Tabs: the QR code can go on a projector while the class list stays one tap away */}
        <div className="mx-auto mb-6 flex w-full max-w-md rounded-full bg-white/10 p-1 backdrop-blur" role="tablist">
          {([
            { id: "qr", label: "QR code", icon: QrCode },
            { id: "list", label: "Class list", icon: Users },
          ] as const).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                tab === t.id ? "bg-gold text-navy shadow-lg" : "text-parchment/80 hover:text-parchment"
              }`}
            >
              <t.icon size={16} />
              {t.label}
              {t.id === "list" && roster && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${tab === t.id ? "bg-navy text-parchment" : "bg-white/15"}`}
                >
                  {attending}/{roster.total}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pops up on either tab when a student scans in */}
        {justArrived && (
          <div className="irms-toast fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-white shadow-2xl">
            ✓ {justArrived} just checked in
          </div>
        )}

        <div>
          {/* QR code and location */}
          <div
            key="qr"
            hidden={tab !== "qr"}
            className="irms-enter-up mx-auto flex max-w-md flex-col items-center rounded-lg border-t-4 border-gold bg-parchment p-6 shadow-2xl sm:p-8"
          >
            {note && (
              <p
                className={`mb-4 w-full rounded border px-3 py-2 text-left text-xs ${
                  note.good ? "border-sage/30 bg-sage/10 text-sage" : "border-gold/40 bg-gold/10 text-navy"
                }`}
              >
                {note.text}
              </p>
            )}

            {active ? (
              <>
                {session ? (
                  <>
                    <div className="rounded-lg bg-white p-5 shadow-inner">
                      <QRCodeSVG value={checkinUrl} size={240} />
                    </div>
                    <p className="mt-4 break-all text-center text-xs text-navy/50">{checkinUrl}</p>
                    <button onClick={() => navigator.clipboard.writeText(checkinUrl)} className={`${smallButton} mt-2`}>
                      Copy link
                    </button>
                  </>
                ) : (
                  <p className="py-10 text-sm text-navy/60">Preparing the code...</p>
                )}

                {canCheck ? (
                  <label className="mt-4 flex items-center gap-2 text-sm text-navy">
                    <input type="checkbox" checked={verify} onChange={(e) => toggleVerify(e.target.checked)} />
                    Check students&apos; location
                  </label>
                ) : (
                  <button onClick={retryLocation} disabled={busy !== null} className={`${smallButton} mt-4`}>
                    {busy === "retry" ? finding() : "Try finding location again"}
                  </button>
                )}

                <p className="mt-4 flex items-center gap-2 text-sm text-navy/60">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sage" />
                  New code every 60 seconds (each works for 3 minutes)
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
                disabled={busy !== null}
                className="rounded bg-navy px-8 py-4 text-lg font-medium text-parchment transition-all hover:scale-105 hover:bg-gold hover:text-navy disabled:opacity-60"
              >
                {busy === "start" ? finding() : "Start Attendance"}
              </button>
            )}

            <div className="mt-6 w-full rounded border border-navy/10 bg-white/60 p-4 text-left">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-navy/50">Classroom location</p>
              {hasVenue && cls?.venueSavedAt ? (
                <>
                  <p className="text-sm text-navy">
                    Saved on {formatDate(cls.venueSavedAt)}
                    {cls.venueAccuracy != null && ` (to about ${Math.round(cls.venueAccuracy)} m)`}. Any device can run
                    attendance here with location checking.
                  </p>
                  <p className="mt-1 text-xs text-navy/50">
                    If students in the room are told they&apos;re too far, update it from a phone standing in the room.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={saveVenue} disabled={busy !== null} className={smallButton}>
                      {busy === "save" ? finding() : "Update from this device"}
                    </button>
                    <button
                      onClick={forgetVenue}
                      disabled={busy !== null}
                      className={`${smallButton} hover:border-clay hover:text-clay`}
                    >
                      Forget
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-navy">
                    Not saved yet. Stand in the room with a phone and save it once. After that any device, even a
                    laptop, can run attendance with location checking.
                  </p>
                  <button onClick={saveVenue} disabled={busy !== null} className={`${smallButton} mt-3`}>
                    {busy === "save" ? finding() : "Save this room's location"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Class list */}
          <div
            key="list"
            hidden={tab !== "list"}
            className="irms-enter-up mx-auto max-w-3xl rounded-lg border-t-4 border-gold bg-parchment p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-navy">Class list</h2>
                <p className="text-xs text-navy/50">Tap P, L, E or A to mark anyone by hand.</p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl leading-none text-navy">
                  {attending}
                  <span className="text-lg text-navy/40"> / {roster?.total ?? 0}</span>
                </p>
                <p className="mt-1 text-xs text-navy/60">
                  here today
                  {roster && roster.late > 0 && ` · ${roster.late} late`}
                  {roster && roster.excused > 0 && ` · ${roster.excused} excused`}
                </p>
              </div>
            </div>

            {flagged > 0 && (
              <div className="mb-3 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay">
                {flagged} student{flagged !== 1 ? "s" : ""} checked in from a phone that also checked in someone else.
                Make sure each of them is really here.
              </div>
            )}

            {(roster?.total ?? 0) > 8 && (
              <input
                placeholder="Search names"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-3 w-full rounded border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
              />
            )}

            {!roster ? (
              <p className="py-8 text-center text-sm text-navy/40">Loading the class list...</p>
            ) : roster.total === 0 ? (
              <p className="py-8 text-center text-sm text-navy/50">
                No students are enrolled in this class yet. Enroll them on the Enrollments page.
              </p>
            ) : (
              <div className="space-y-2">
                {shown.map((s) => {
                  const current: Mark = s.status ?? "ABSENT";
                  return (
                    <div
                      key={s.studentId}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded border bg-white px-3 py-2.5 shadow-sm ${
                        s.sharedWith.length ? "border-clay/40" : "border-navy/10"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-display text-sm text-parchment">
                          {s.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy">{s.name}</p>
                          <p className="text-xs text-navy/50">
                            {!s.status
                              ? "Not checked in"
                              : s.markedByTeacher
                              ? "Marked by teacher"
                              : `Scanned in${s.checkedInAt ? ` at ${formatTime(s.checkedInAt)}` : ""}`}
                          </p>
                          {s.sharedWith.length > 0 && (
                            <p className="text-xs font-medium text-clay">Same phone as {s.sharedWith.join(", ")}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex overflow-hidden rounded border border-navy/15" role="group" aria-label={`Mark ${s.name}`}>
                        {MARK_BUTTONS.map((b) => (
                          <button
                            key={b.mark}
                            onClick={() => current !== b.mark && mark(s.studentId, b.mark)}
                            disabled={saving === s.studentId}
                            title={b.mark.charAt(0) + b.mark.slice(1).toLowerCase()}
                            className={`w-9 py-1.5 text-xs font-semibold transition-colors ${
                              current === b.mark ? b.on : "bg-white text-navy/50 hover:bg-parchment hover:text-navy"
                            }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {shown.length === 0 && <p className="py-4 text-center text-sm text-navy/50">No names match.</p>}
              </div>
            )}
            <p className="mt-4 text-xs text-navy/50">P present · L late · E excused · A absent</p>
          </div>
        </div>
      </div>
    </div>
  );
}
