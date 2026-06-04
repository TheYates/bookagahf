/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "172.21.30.176:3000",
  ],
  turbopack: {},
}

export default nextConfig
