/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  assetPrefix: isProd ? "https://dm-recap.vercel.app" : undefined,
  reactStrictMode: true,
  async headers() {
    return [
      {
        // assets 폴더의 모든 파일에 CORS 헤더 추가
        source: "/assets/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
