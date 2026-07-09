'use client';

import { useEffect } from 'react';

/**
 * AntiInspect — Step 3: Harden the Telegram WebView against casual inspection.
 *
 * ARCHITECT'S NOTE: This is a deterrent layer, not an absolute barrier.
 * A determined attacker with physical device access or a custom Telegram client
 * can bypass all of these. Your real security is server-side (HMAC, RLS, rate limits).
 * This stops ~95% of casual/script-kiddie attempts.
 */
export function AntiInspect() {
  useEffect(() => {
    // Only activate in production — don't cripple your own dev experience
    if (process.env.NODE_ENV !== 'production') return;

    // ── 1. Block right-click context menu ─────────────────────────────────────
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', onContextMenu);

    // ── 2. Block keyboard inspection shortcuts ────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const key   = e.key.toLowerCase();
      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      const blocked =
        e.key === 'F12' ||                          // DevTools
        (ctrl && shift && key === 'i') ||           // Inspect Element
        (ctrl && shift && key === 'j') ||           // Console
        (ctrl && shift && key === 'c') ||           // Element picker
        (ctrl && shift && key === 'k') ||           // Firefox console
        (ctrl && key === 'u') ||                    // View source
        (ctrl && key === 's') ||                    // Save page
        (ctrl && key === 'p') ||                    // Print (reveals layout)
        (ctrl && key === 'a');                      // Select all

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    // ── 3. Disable text selection (prevents scraping visible text) ────────────
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      input, textarea {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    // ── 4. Debugger trap — pauses execution whenever DevTools is open ─────────
    // A paused debugger statement causes DevTools to freeze on the line,
    // making dynamic analysis very tedious. Runs every 3 seconds.
    let devtoolsOpen = false;
    const debuggerTrap = setInterval(() => {

      debugger;
      devtoolsOpen = false;
    }, 3000);

    // ── 5. DevTools size detection — redirect if detected ─────────────────────
    // When DevTools is open on the side/bottom, window dimensions change.
    const checkDevTools = setInterval(() => {
      const threshold = 160;
      const widthDiff  = window.outerWidth  - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          // Wipe the page content
          document.body.innerHTML =
            `<div style="position:fixed;inset:0;background:#000;display:flex;align-items:center;
            justify-content:center;flex-direction:column;gap:16px;font-family:sans-serif;color:white">
            <p style="font-size:2rem">⛔</p>
            <p dir="rtl" style="color:rgba(255,255,255,0.5);font-size:14px">
              تم اكتشاف أدوات المطور. يرجى إغلاقها للمتابعة.
            </p></div>`;
        }
      }
    }, 1000);

    // ── 6. Disable drag-and-drop (prevents asset extraction) ─────────────────
    const onDragStart = (e: DragEvent) => e.preventDefault();
    document.addEventListener('dragstart', onDragStart);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('dragstart', onDragStart);
      clearInterval(debuggerTrap);
      clearInterval(checkDevTools);
      if (style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);

  return null; // Renders nothing — pure side-effect component
}
