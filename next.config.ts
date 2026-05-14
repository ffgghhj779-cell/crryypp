import type { NextConfig } from 'next';

// ─── Build-time secret leak guard (VULN-12) ──────────────────────────────────
// Fails the Vercel build immediately if a server-only secret is accidentally
// prefixed with NEXT_PUBLIC_ (which would embed it in the client JS bundle).
const SERVER_ONLY_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
];
for (const key of SERVER_ONLY_KEYS) {
  if (process.env[`NEXT_PUBLIC_${key}`]) {
    throw new Error(
      `🚨 SECURITY BUILD FAILURE: ${key} is exposed as NEXT_PUBLIC_${key}! ` +
      `This would embed the secret in the client JS bundle. Remove it immediately.`
    );
  }
}

// ─── HTTP Security Headers (VULN-04) ─────────────────────────────────────────
const securityHeaders = [
  // Prevent MIME type sniffing
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  // Prevent clickjacking
  { key: 'X-Frame-Options',           value: 'DENY' },
  // DNS prefetch control
  { key: 'X-DNS-Prefetch-Control',    value: 'on' },
  // Enforce HTTPS for 2 years including subdomains (enable preloading)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Restrict referrer info sent to third parties
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // Disable browser features not needed by this app
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Content Security Policy — strict allowlist
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // TradingView widget requires 'unsafe-inline' for its inline scripts
      "script-src 'self' 'unsafe-inline' https://s3.tradingview.com https://s.tradingview.com",
      // WebSocket (Binance) + Supabase + self API calls
      "connect-src 'self' wss://stream.binance.com:9443 https://api.binance.com " +
        "https://*.supabase.co wss://*.supabase.co https://blockchain.info",
      // Coin images from CoinGecko served via our proxy, plus self
      "img-src 'self' data: blob: https://assets.coingecko.com https://coin-images.coingecko.com",
      // TradingView iframe embed
      "frame-src 'self' https://www.tradingview.com",
      // Fonts: self + Google Fonts CDN
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // No plugins
      "object-src 'none'",
      // Block base tag injection
      "base-uri 'self'",
      // All form actions go to self only
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // VULN-16: Re-enable ESLint during builds — security linting is not optional
  eslint: {
    ignoreDuringBuilds: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  // CoinGecko coin images served via our /api/markets proxy
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'coin-images.coingecko.com',
        pathname: '/**',
      },
    ],
  },

  // Apply security headers to ALL routes (VULN-04)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  output: 'standalone',
  transpilePackages: ['motion'],

  webpack: (config, { dev, webpack }) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = { ignored: /.*/ };
    }

    // ── Step 2: Aggressive Terser obfuscation for production builds ───────────
    if (!dev) {
      const TerserPlugin = require('terser-webpack-plugin');
      config.optimization = {
        ...config.optimization,
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              // Mangle all identifier names to single/double chars
              mangle: {
                toplevel:   true,   // Mangle top-level identifiers
                eval:       true,   // Mangle in eval scopes
                properties: false,  // Keep properties readable (breaks some libs if true)
              },
              compress: {
                drop_console:   true,  // Remove all console.* calls
                drop_debugger:  true,  // Remove debugger statements
                dead_code:      true,  // Remove unreachable code
                passes:         3,     // Multi-pass compression
                pure_getters:   true,
                unsafe:         true,
                unsafe_arrows:  true,
                unsafe_methods: true,
              },
              format: {
                comments:       false, // Strip all comments (no source hints)
                ascii_only:     true,  // ASCII-safe output
              },
            },
            extractComments: false,   // No LICENSE.txt files (leaks library names)
          }),
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
