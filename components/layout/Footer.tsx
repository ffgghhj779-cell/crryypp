'use client';

import { Send, Twitter, Link2, BookOpen, AlertTriangle, Heart } from 'lucide-react';

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
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 text-right">
          OFFICIAL CHANNELS · القنوات الرسمية
        </p>
        <div className="grid grid-cols-2 gap-2">
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
                <p className={`text-[11px] font-bold ${ch.color}`}>{ch.labelAr}</p>
                <p className="text-[9px] text-white/30 font-mono truncate">{ch.handle}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.04] p-4 mb-4">
        <div className="flex items-start gap-2.5 mb-2">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
            إخلاء مسؤولية · Disclaimer
          </p>
        </div>
        <p className="text-[10px] text-white/45 leading-relaxed text-right">
          جميع التحليلات والمعلومات المقدمة في هذا التطبيق هي{' '}
          <span className="text-orange-400 font-bold">لأغراض تعليمية وإعلامية فقط</span>، ولا تُعدّ نصيحةً استثمارية أو توصيةً بالشراء أو البيع.
          أسواق العملات الرقمية شديدة التقلب وتنطوي على مخاطر عالية. تحمّل مسؤولية قراراتك الاستثمارية بالكامل وتشاور مع مستشار مالي مرخّص قبل اتخاذ أي قرار.
        </p>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.05] pt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Copyright */}
          <p className="text-[9px] text-white/25 font-mono flex items-center gap-1">
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
                className="text-[9px] text-white/25 hover:text-orange-400 transition-colors font-mono"
              >
                {ar}
              </a>
            ))}
          </div>
        </div>

        {/* Version tag */}
        <p className="text-[8px] text-white/10 font-mono mt-2 text-right">
          v3.0.0 · Thick Client Architecture · 25 Live Tools
        </p>
      </div>
    </footer>
  );
}
