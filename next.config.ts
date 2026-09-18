import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  // Next.js 16 blocks HMR websockets unless the Host/Origin you actually
  // browse with is listed here. Needed when `npm run dev` sits behind nginx
  // at class.jigmenidup.site rather than localhost:3000.
  allowedDevOrigins: ["class.jigmenidup.site", "localhost", "127.0.0.1"],
};

export default nextConfig;
