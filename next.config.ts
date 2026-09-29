import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  images: {
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dytobweya/image/upload/**",
        search: "",
      },
    ],
  },
  
  // Optional modern configurations:
  compiler: {
    // removeConsole: true, // Uncomment to remove console logs in production
    // styledComponents: true, // If using styled-components
  },
  experimental: {
    // disableOptimizedLoading: true, // Only if you need to disable optimizations
    // serverActions: true, // If using Next.js server actions
  }
};

export default nextConfig;
