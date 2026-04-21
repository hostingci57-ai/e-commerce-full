const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone build — ships a self-contained server.js + trimmed node_modules.
  // In a monorepo we must pin `outputFileTracingRoot` to the workspace root so
  // Next.js includes workspace packages (@ecf/types, @ecf/validation) correctly.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
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
