/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow local development through both localhost and 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
