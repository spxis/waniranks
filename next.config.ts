import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "covers.openlibrary.org",
			},
			{
				protocol: "https",
				hostname: "cover.openbd.jp",
			},
		],
	},
};

export default nextConfig;
