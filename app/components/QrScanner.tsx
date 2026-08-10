"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function QrScanner({ onClose }: { onClose: () => void }) {
  const containerId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`).current;
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (container && container.childElementCount > 0) {
      // A scanner already rendered into this container (Strict Mode's first pass) — skip.
      return;
    }

    const scanner = new Html5QrcodeScanner(containerId, { fps: 10, qrbox: 240 }, false);
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        scanner.clear().catch(() => {});
        window.location.href = decodedText;
      },
      () => {}
    );

    return () => {
      scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [containerId]);

  return (
    <div className="rounded-lg border-t-4 border-gold bg-white p-4 shadow-xl">
      <div id={containerId} />
      <button onClick={onClose} className="mt-3 text-sm text-clay transition-colors hover:underline">
        Cancel
      </button>
    </div>
  );
}