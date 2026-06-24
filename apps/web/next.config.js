const path = require('path');

/** @type {import('next').NextConfig} */
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
