import type { Metadata, Viewport } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Crypto Terminal 360 | تحليل العملات الرقمية',
  description: 'محطة تحليل العملات الرقمية — 25 أداة تحليل فني لحظية بيانات مباشرة من Binance',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <style>{`
          :root { --tg-viewport-height: 100vh; }
          html, body { height: var(--tg-viewport-height, 100vh); overflow: hidden; }
        `}</style>
      </head>
      <body
        suppressHydrationWarning
        className={`overflow-hidden ${inter.variable} ${robotoMono.variable} font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
