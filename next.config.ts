import type { NextConfig } from "next";
// @ts-ignore — next-pwa types not always up to date
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  experimental: {},
};

export default withPWA(nextConfig);
