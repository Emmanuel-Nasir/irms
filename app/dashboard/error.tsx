"use client";

import { useEffect } from "react";
import ErrorScreen from "@/app/components/ErrorScreen";

// Shown inside the dashboard, so the menu stays there and you can carry on elsewhere
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <ErrorScreen
      full={false}
      code={offline ? "OFF" : "500"}
      title={offline ? "You're offline" : "This page hit a snag"}
      message={
        offline
          ? "Your device has lost its internet connection. Reconnect, then try again."
          : "Something went wrong loading this page. Try again, or pick another page from the menu. If it keeps happening, tell your coordinator."
      }
      onRetry={reset}
      reference={error.digest}
    />
  );
}
