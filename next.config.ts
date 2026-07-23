import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  async redirects() {
    return [
      { source: "/codex", destination: "/datacore", permanent: true },
      { source: "/codex/:path*", destination: "/datacore/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
