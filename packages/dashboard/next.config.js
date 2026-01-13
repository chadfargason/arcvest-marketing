/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arcvest/shared', '@arcvest/services'],
  serverExternalPackages: ['@supabase/supabase-js'],
};

module.exports = nextConfig;
