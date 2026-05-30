'use client';

import { Send, Heart } from 'lucide-react';

const CHANNELS = [
  {
    icon: <Send className="w-5 h-5" />,
    label: 'Telegram Bot',
    labelAr: 'بوت تيليغرام',
    handle: '@Abdullah360_admin_bot',
    href: 'https://t.me/Abdullah360_admin_bot',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/[0.06]',
  },
  {
    icon: <Send className="w-5 h-5" />,
    label: 'Telegram Channel',
    labelAr: 'قناة تيليغرام',
    handle: '@mycryptoappTT20',
    href: 'https://t.me/mycryptoappTT20',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/[0.06]',
  },
];

export function Footer() {
  return (
    <footer className="w-full" dir="rtl">

      {/* ── Official Channels ────────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-sm font-bold text-white/30 uppercase tracking-widest mb-3 text-right">
          OFFICIAL CHANNELS · القنوات الرسمية
        </p>
        <div className="grid grid-cols-2 gap-3">
          {CHANNELS.map((ch) => (
            <a
              key={ch.label}
              href={ch.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-3 rounded-xl border ${ch.border} ${ch.bg} hover:border-orange-500/30 active:scale-[0.97] transition-all duration-150`}
            >
              <span className={`shrink-0 ${ch.color}`}>{ch.icon}</span>
              <div className="min-w-0 text-right">
                <p className={`text-sm font-bold ${ch.color}`}>{ch.labelAr}</p>
                <p className="text-sm text-white/30 font-mono truncate">{ch.handle}</p>
              </div>
            </a>
          ))}
        </div>
      </div>


      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.05] pt-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Copyright */}
          <p className="text-sm text-white/25 font-mono flex items-center gap-1">
            © 2025 Crypto Terminal 360 · صُنع بـ
            <Heart className="w-2.5 h-2.5 text-red-500 inline" />
          </p>

          {/* Links */}
          <div className="flex items-center gap-3">
            {[
              { ar: 'شروط الاستخدام', href: '/terms' },
              { ar: 'سياسة الخصوصية', href: '/privacy' },
            ].map(({ ar, href }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/25 hover:text-orange-400 transition-colors font-mono"
              >
                {ar}
              </a>
            ))}
          </div>
        </div>

        {/* Version tag */}
        <p className="text-sm text-white/10 font-mono mt-2 text-right">
          v3.0.0 · Thick Client Architecture · 25 Live Tools
        </p>
      </div>
    </footer>
  );
}
