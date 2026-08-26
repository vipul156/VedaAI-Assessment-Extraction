import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "pdfjs-dist"],
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.mjs"],
  },
};

export default nextConfig;
