/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "v-archive.net",
        pathname: "/static/images/jackets/**",
      },
    ],
  },
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
