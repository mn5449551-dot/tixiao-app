import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
