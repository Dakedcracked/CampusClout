import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyTimeout: 120_000,  // 2 minutes for slow Ollama responses
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    if (!apiUrl || typeof apiUrl !== "string") {
      console.warn("NEXT_PUBLIC_API_URL not set, using default");
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
        {
          source: "/uploads/:path*",
          destination: "http://localhost:8000/uploads/:path*",
        },
      ];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
