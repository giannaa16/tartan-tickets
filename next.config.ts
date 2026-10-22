import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SEC-3: tell browsers to use HTTPS only (HSTS) on every page and API route.
  headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }],
      },
    ];
  },
};

export default nextConfig;
