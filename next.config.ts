import type { NextConfig } from "next";

// Sent with every page: stop IRMS being shown inside other sites (click-jacking),
// stop browsers guessing file types, limit what's shared when following links, and
// allow only the camera (QR scanning) and location (check-in), only for IRMS itself.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets phones and other computers on your Wi-Fi open the dev server
  // (for example http://192.168.1.153:3000). Only affects "npm run dev".
  allowedDevOrigins: ["192.168.1.153", "192.168.*.*"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
