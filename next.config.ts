import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms https://*.clarity.ms https://*.cdn.office.net ${isDev ? "'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://*.cdn.office.net;
  img-src 'self' data: blob: https://*.clarity.ms https://c.bing.com https://*.cdn.office.net;
  font-src 'self' data: https://*.cdn.office.net https://res.cdn.office.net https://res-1.cdn.office.net https://*.clarity.ms;
  connect-src 'self' https://*.clarity.ms https://c.bing.com https://*.bing.com https://*.cdn.office.net;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: cspHeader },
        ],
      },
    ];
  },
};

export default nextConfig;

