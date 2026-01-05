/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 允許跨域請求到後端 API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
