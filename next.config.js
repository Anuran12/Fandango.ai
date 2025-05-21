/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Enable static file serving for the screenshots directory
  images: {
    // Allow unoptimized images to be served from the screenshots directory
    unoptimized: true,
  },
  // We'll need to extend the Next.js output
  output: "standalone",
  // Increase build memory limit
  experimental: {
    memoryBasedWorkersCount: true,
  },
  // Add production source maps for easier debugging
  productionBrowserSourceMaps: true,
};

module.exports = nextConfig;
