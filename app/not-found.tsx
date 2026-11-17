import type { Metadata } from "next";
import ErrorScreen from "@/app/components/ErrorScreen";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="This page wandered off"
      message="The address may be mistyped, or the page has moved. If you followed a link inside IRMS, let your coordinator know."
    />
  );
}
