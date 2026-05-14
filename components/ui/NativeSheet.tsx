'use client';

/**
 * NativeSheet — iOS/Flutter-style spring bottom-sheet.
 *
 * Usage pattern (parent is responsible for AnimatePresence so exit
 * animation plays before React unmounts the component):
 *
 *   import { AnimatePresence } from 'motion/react';
 *   import { NativeSheet }    from '@/components/ui/NativeSheet';
 *
 *   <AnimatePresence>
 *     {isOpen && (
 *       <NativeSheet key="my-sheet" onClose={() => setIsOpen(false)}>
 *         ...content...
 *       </NativeSheet>
 *     )}
 *   </AnimatePresence>
 *
 * The sheet handles:
 *   - Spring slide-up / spring slide-down exit
 *   - Swipe-down to dismiss (velocity > 300 or offset > 120px)
 *   - GPU-composited via willChange: transform
 *   - Backdrop fade + blur
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

// ─── Spring presets ────────────────────────────────────────────────────────────
// iOS bottom-sheet spring: high stiffness, adequate damping → snappy but smooth
const SHEET_SPRING = { type: 'spring', stiffness: 420, damping: 38, mass: 0.75 } as const;
const FADE         = { duration: 0.18, ease: 'easeOut' } as const;

interface NativeSheetProps {
  onClose:    () => void;
  children:   ReactNode;
  /** CSS max-height of the sheet (default 88dvh minus safe-area) */
  maxHeight?: string;
  /** z-index layer (default 60 — above BottomNav z-40) */
  zSheet?:    number;
}

export function NativeSheet({
  onClose,
  children,
  maxHeight = 'calc(88dvh - env(safe-area-inset-bottom, 0px))',
  zSheet    = 60,
}: NativeSheetProps) {
  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <motion.div
        key="sheet-backdrop"
        className="fixed inset-0"
        style={{ zIndex: zSheet - 1 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FADE}
        onClick={onClose}
        aria-hidden
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      </motion.div>

      {/* ── Sheet ─────────────────────────────────────────────────────────── */}
      <motion.div
        key="sheet-panel"
        className="fixed bottom-0 left-0 right-0 flex flex-col rounded-t-3xl border border-white/[0.08] shadow-2xl shadow-black/80"
        style={{
          zIndex:            zSheet,
          maxHeight,
          background:        'rgba(8,8,8,0.97)',
          backdropFilter:    'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          willChange:        'transform',   // GPU layer
        }}
        // ── Entry / exit spring ──────────────────────────────────────────
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SHEET_SPRING}
        // ── Swipe-down to dismiss ────────────────────────────────────────
        drag="y"
        dragConstraints={{ top: 0 }}   // cannot drag above rest position
        dragElastic={{ top: 0.05, bottom: 0.3 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          // Dismiss on fast flick OR slow drag past threshold
          if (info.velocity.y > 300 || info.offset.y > 120) {
            onClose();
          }
        }}
      >
        {/* Drag handle — also signals "draggable" to the user */}
        <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing select-none">
          <div className="w-10 h-1.5 bg-white/20 rounded-full" />
        </div>

        {/* Caller's content fills the rest */}
        {children}
      </motion.div>
    </>
  );
}
