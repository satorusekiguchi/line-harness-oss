import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  transpilePackages: ['@line-crm/shared'],
  devIndicators: false,
}
export default nextConfig
