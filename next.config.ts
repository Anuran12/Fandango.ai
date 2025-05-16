import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Enable static file serving for the screenshots directory
  images: {
    // Allow unoptimized images to be served from the screenshots directory
    unoptimized: true,
  },
  // We'll need to extend the Next.js output
  output: "standalone",
};

export default nextConfig;
