import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones and other computers on your Wi-Fi open the dev server
  // (for example http://192.168.1.153:3000). Only affects "npm run dev".
  allowedDevOrigins: ["192.168.1.153", "192.168.*.*"],
};

export default nextConfig;
