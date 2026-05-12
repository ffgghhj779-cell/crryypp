'use client';

import { useEffect, useState } from 'react';

// Calculate seconds remaining until next 00:00 UTC
function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1, // next day
    0, 0, 0, 0,
  ));
  return Math.max(0, Math.floor((midnight.getTime() - Date.now()) / 1000));
}

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

export function DailyCloseWidget() {
  const [secs, setSecs] = useState<number>(secondsUntilMidnightUTC);

  useEffect(() => {
    // Sync to the top of the next second for pixel-perfect accuracy
    const msToNextSecond = 1000 - (Date.now() % 1000);

    const timeout = setTimeout(() => {
      setSecs(secondsUntilMidnightUTC());

      const interval = setInterval(() => {
        setSecs(secondsUntilMidnightUTC());
      }, 1000);

      // Store interval id on timeout cleanup
      (timeout as unknown as { _iv: ReturnType<typeof setInterval> })._iv = interval;
    }, msToNextSecond);

    return () => {
      clearTimeout(timeout);
      // Safely clear the nested interval if it was set
      const iv = (timeout as unknown as { _iv?: ReturnType<typeof setInterval> })._iv;
      if (iv) clearInterval(iv);
    };
  }, []);

  const display = formatHMS(secs);

  // Split into HH MM SS for colour accent on seconds
  const [hh, mm, ss] = display.split(':');

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 flex flex-col" dir="rtl">
      {/* Title */}
      <p className="text-[10px] font-bold text-orange-400 mb-2 text-right">
        الإغلاق اليومي للبيتكوين
      </p>

      {/* Countdown display */}
      <div className="flex-1 flex items-center justify-center">
        <span
          className="font-mono font-black tabular-nums tracking-tight select-none"
          style={{ fontSize: 'clamp(1.5rem, 6vw, 1.875rem)', color: 'white' }}
        >
          {hh}
          <span className="text-white/40">:</span>
          {mm}
          <span className="text-white/40">:</span>
          {/* Seconds pulse on every tick */}
          <span
            key={ss}               /* key change re-mounts → triggers animation */
            className="text-orange-400"
            style={{ animation: 'fade-in 0.15s ease forwards' }}
          >
            {ss}
          </span>
        </span>
      </div>

      {/* Subtitle */}
      <p className="text-[9px] text-white/30 text-right mt-2">
        متبقي على إغلاق شمعة اليوم
      </p>
    </div>
  );
}
