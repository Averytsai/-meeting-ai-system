/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 只在本地開發時使用 rewrites
  async rewrites() {
    // 生產環境不使用 rewrites，直接呼叫外部 API
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
