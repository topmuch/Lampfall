import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  // Note : toute modification de ce fichier déclenche le redémarrage automatique
  // du worker next dev (utile après un `prisma generate` — nouveau client Prisma).
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "http://21.0.16.170:81",
  ],
};

export default nextConfig;
