"use client";

import "./globals.css";

// Last resort: shown only if the whole app fails to load. Kept simple on purpose.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #003057, #0A4A7A)",
          color: "#FAF9F6",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <p style={{ fontSize: "72px", margin: 0, fontWeight: 700, color: "#C9A227" }}>IRMS</p>
          <h1 style={{ fontSize: "28px", margin: "16px 0 8px" }}>IRMS couldn&apos;t load</h1>
          <p style={{ opacity: 0.75, maxWidth: 420, margin: "0 auto 24px" }}>
            Something went wrong on our side. Please try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#C9A227",
              color: "#003057",
              border: 0,
              borderRadius: 999,
              padding: "10px 22px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && <p style={{ opacity: 0.35, fontSize: 11, marginTop: 16 }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
