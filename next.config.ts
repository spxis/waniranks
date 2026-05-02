import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.umakuma.com",
          },
        ],
        destination: "https://umakuma.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
