/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid statically prerendering any page — this panel is 100% client-side
  // against the API, so there is nothing to render at build time.
  experimental: {
    typedRoutes: false,
  },
  eslint: {
    // The monorepo root eslint config (with prettier extension) is unavailable
    // in-app; lint runs in turbo `lint` step instead.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
