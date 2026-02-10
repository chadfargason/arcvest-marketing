/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arcvest/shared', '@arcvest/services'],
  serverExternalPackages: ['@supabase/supabase-js'],
  eslint: {
    // Allow production builds to successfully complete even if
    // your project has ESLint warnings (unused variables, etc.)
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
