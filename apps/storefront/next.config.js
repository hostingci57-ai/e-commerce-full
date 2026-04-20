/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.localhost:3000'],
    },
  },
  eslint: {
    // During build we do not want lint failures to fail the build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep type-safety; flip to true only if blocking
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
