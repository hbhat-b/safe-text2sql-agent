// The browser talks to the API directly for the WebSocket, so this must be reachable from the user's machine.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// The Next server proxies REST calls; inside Docker that is the compose service name, not localhost.
const INTERNAL_API_URL = process.env.API_INTERNAL_URL ?? PUBLIC_API_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // REST calls go through /api so the browser never needs CORS; the WebSocket connects directly.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${INTERNAL_API_URL}/:path*` }];
  },
};

export default nextConfig;
