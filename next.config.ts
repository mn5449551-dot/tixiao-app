import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    localPatterns: [
      {
        pathname: "/api/images/**",
      },
      {
        pathname: "/api/logo-assets/**",
      },
      {
        pathname: "/api/ip-assets/**",
      },
    ],
  },
  turbopack: {
    ignoreIssue: [
      {
        path: /next\.config\.ts$/,
        title: "Encountered unexpected file in NFT list",
        description: /whole project was traced unintentionally/i,
      },
    ],
  },
};

export default nextConfig;
