'use client';

import { Send, Twitter, Link2, BookOpen, AlertTriangle, Heart } from 'lucide-react';

const CHANNELS = [
  {
    icon: <Send className="w-5 h-5" />,
    label: 'Telegram Bot',
    labelAr: 'ط¨ظˆطھ طھظٹظ„ظٹط؛ط±ط§ظ…',
    handle: '@Abdullah360_admin_bot',
    href: 'https://t.me/Abdullah360_admin_bot',
    color: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/[0.06]',
  },
  {
    icon: <Send className="w-5 h-5" />,
    label: 'Telegram Channel',
    labelAr: 'ظ‚ظ†ط§ط© طھظٹظ„ظٹط؛ط±ط§ظ…',
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

      {/* â”€â”€ Official Channels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="mb-4">
        <p className="text-sm font-bold text-white/30 uppercase tracking-widest mb-3 text-right">
          OFFICIAL CHANNELS آ· ط§ظ„ظ‚ظ†ظˆط§طھ ط§ظ„ط±ط³ظ…ظٹط©
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

      {/* â”€â”€ Disclaimer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.04] p-6 mb-4">
        <div className="flex items-start gap-3.5 mb-2">
          <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-orange-400 uppercase tracking-wider">
            ط¥ط®ظ„ط§ط، ظ…ط³ط¤ظˆظ„ظٹط© آ· Disclaimer
          </p>
        </div>
        <p className="text-sm text-white/45 leading-relaxed text-right">
          ط¬ظ…ظٹط¹ ط§ظ„طھط­ظ„ظٹظ„ط§طھ ظˆط§ظ„ظ…ط¹ظ„ظˆظ…ط§طھ ط§ظ„ظ…ظ‚ط¯ظ…ط© ظپظٹ ظ‡ط°ط§ ط§ظ„طھط·ط¨ظٹظ‚ ظ‡ظٹ{' '}
          <span className="text-orange-400 font-bold">ظ„ط£ط؛ط±ط§ط¶ طھط¹ظ„ظٹظ…ظٹط© ظˆط¥ط¹ظ„ط§ظ…ظٹط© ظپظ‚ط·</span>طŒ ظˆظ„ط§ طھظڈط¹ط¯ظ‘ ظ†طµظٹط­ط©ظ‹ ط§ط³طھط«ظ…ط§ط±ظٹط© ط£ظˆ طھظˆطµظٹط©ظ‹ ط¨ط§ظ„ط´ط±ط§ط، ط£ظˆ ط§ظ„ط¨ظٹط¹.
          ط£ط³ظˆط§ظ‚ ط§ظ„ط¹ظ…ظ„ط§طھ ط§ظ„ط±ظ‚ظ…ظٹط© ط´ط¯ظٹط¯ط© ط§ظ„طھظ‚ظ„ط¨ ظˆطھظ†ط·ظˆظٹ ط¹ظ„ظ‰ ظ…ط®ط§ط·ط± ط¹ط§ظ„ظٹط©. طھط­ظ…ظ‘ظ„ ظ…ط³ط¤ظˆظ„ظٹط© ظ‚ط±ط§ط±ط§طھظƒ ط§ظ„ط§ط³طھط«ظ…ط§ط±ظٹط© ط¨ط§ظ„ظƒط§ظ…ظ„ ظˆطھط´ط§ظˆط± ظ…ط¹ ظ…ط³طھط´ط§ط± ظ…ط§ظ„ظٹ ظ…ط±ط®ظ‘طµ ظ‚ط¨ظ„ ط§طھط®ط§ط° ط£ظٹ ظ‚ط±ط§ط±.
        </p>
      </div>

      {/* â”€â”€ Divider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="border-t border-white/[0.05] pt-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Copyright */}
          <p className="text-sm text-white/25 font-mono flex items-center gap-1">
            آ© 2025 Crypto Terminal 360 آ· طµظڈظ†ط¹ ط¨ظ€
            <Heart className="w-2.5 h-2.5 text-red-500 inline" />
          </p>

          {/* Links */}
          <div className="flex items-center gap-3">
            {[
              { ar: 'ط´ط±ظˆط· ط§ظ„ط§ط³طھط®ط¯ط§ظ…', href: '/terms' },
              { ar: 'ط³ظٹط§ط³ط© ط§ظ„ط®طµظˆطµظٹط©', href: '/privacy' },
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
          v3.0.0 آ· Thick Client Architecture آ· 25 Live Tools
        </p>
      </div>
    </footer>
  );
}
