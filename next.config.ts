import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['@prisma/client', 'prisma', 'better-sqlite3'],
  allowedDevOrigins: [
    '.space.z.ai',
    '.chatglm.site',
    '.z.ai',
  ],
};

export default nextConfig;
