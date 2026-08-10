"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function CheckInPage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function submit(coords: { latitude: number; longitude: number } | null) {
      fetch(`/api/attendance/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords ?? {}),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            setStatus("error");
            setMessage(data.error ?? "Check-in failed");
            return;
          }
          setStatus("success");
          setMessage("You're checked in!");
        });
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => submit({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => submit(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="rounded-lg bg-white p-8 text-center shadow-md">
        {status === "loading" && <p className="text-gray-600">Checking you in...</p>}
        {status === "success" && <p className="text-lg font-medium text-green-600">✅ {message}</p>}
        {status === "error" && <p className="text-lg font-medium text-red-600">❌ {message}</p>}
      </div>
    </div>
  );
}