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

      // ── connect-src: every external origin the browser fetches directly ────
      // Binance: REST prices + WebSocket stream
      // CoinGecko: market cap data (direct client fetches in some widgets)
      // Alternative.me: Fear & Greed index (fetched client-side by FearGreedWidget)
      // Supabase: realtime + storage
      // blockchain.info: BTC on-chain data
      // TradingView: widget data WebSocket
      "connect-src 'self'" +
        " wss://stream.binance.com:9443 https://api.binance.com" +
        " https://api.alternative.me" +
        " https://api.coingecko.com https://pro-api.coingecko.com" +
        " https://*.supabase.co wss://*.supabase.co" +
        " https://blockchain.info" +
        " wss://data.tradingview.com wss://widgetdata.tradingview.com",

      // Coin images from CoinGecko served via our proxy, plus self
      "img-src 'self' data: blob: https://assets.coingecko.com https://coin-images.coingecko.com",

      // TradingView iframe embed (Economic Calendar, Heatmap, charts)
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

  // Step 2: Strip all console.* in production via SWC compiler (no extra package needed)
  // SWC minifier already handles identifier mangling + dead-code elimination by default.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] } // Keep error/warn for monitoring
      : false,
  },

  output: 'standalone',
  transpilePackages: ['motion'],

  webpack: (config, { dev }) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = { ignored: /.*/ };
    }
    return config;
  },
};

export default nextConfig;
