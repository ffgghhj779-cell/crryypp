import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crypto Terminal',
  description: 'Real-time Crypto Market Analysis & Monitoring',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // This prevents the iOS bounce / overscroll that breaks TMA layout
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Telegram Mini App: use tg-viewport-height instead of 100vh */}
        <style>{`
          :root { --tg-viewport-height: 100vh; }
          html, body { height: var(--tg-viewport-height, 100vh); overflow: hidden; }
        `}</style>
      </head>
      <body suppressHydrationWarning className="overflow-hidden">
        {children}
      </body>
    </html>
  );
}
