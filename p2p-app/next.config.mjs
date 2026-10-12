/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production builds separate from a concurrently running local dev server.
  distDir: process.argv.includes('build') ? '.next-build' : '.next',
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Item 17: Prevent leaking source maps in production builds
  productionBrowserSourceMaps: false,
};

export default nextConfig;
