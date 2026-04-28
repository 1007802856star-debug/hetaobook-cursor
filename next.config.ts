import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ['@prisma/client', 'prisma'],
  allowedDevOrigins: [
    '.space.z.ai',
    '.chatglm.site',
    '.z.ai',
  ],
};

export default nextConfig;
