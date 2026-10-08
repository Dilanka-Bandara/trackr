import type { NextConfig } from 'next';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';
loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const config: NextConfig = {
  transpilePackages: ['@trackr/shared'],
  output: 'standalone',
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : '') +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' http://localhost:4000 ws://localhost:4000 http://localhost:9000 https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};
export default config;
