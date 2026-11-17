"use client";

import { useEffect } from "react";
import ErrorScreen from "@/app/components/ErrorScreen";

// Shown when something breaks outside the dashboard (for example on the check-in page)
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorScreen
      code="500"
      title="Something went wrong"
      message="IRMS hit a problem it didn't expect. Try again in a moment. If it keeps happening, check your internet connection or tell your coordinator."
      onRetry={reset}
      reference={error.digest}
    />
  );
}
