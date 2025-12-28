/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  assetPrefix: isProd ? "https://dm-recap.vercel.app" : undefined,
  reactStrictMode: true,
};

export default nextConfig;
