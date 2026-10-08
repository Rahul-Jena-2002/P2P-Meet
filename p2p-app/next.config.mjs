/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Item 17: Prevent leaking source maps in production builds
  productionBrowserSourceMaps: false,
};

export default nextConfig;
