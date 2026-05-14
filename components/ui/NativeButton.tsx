'use client';

/**
 * NativeButton — Flutter/iOS-style tap feedback wrapper.
 *
 * Uses spring physics (not easing curves) for the press scale,
 * fires Telegram haptic on press, and removes the 300ms web tap delay.
 *
 * Usage:
 *   <NativeButton onClick={handlePress} className="...your styles...">
 *     <span>Tap me</span>
 *   </NativeButton>
 *
 *   // or as a div (non-interactive role):
 *   <NativeButton as="div" role="button" onClick={...}>...</NativeButton>
 */

import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';

// Spring that feels like native: fast in, springy out
const TAP_SPRING = { type: 'spring', stiffness: 500, damping: 30, mass: 0.6 } as const;

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';

function haptic(style: HapticStyle = 'light') {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch { /* non-Telegram environment */ }
}

interface NativeButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children:     ReactNode;
  /** Scale factor when pressed (default 0.97 — matches iOS spring feel) */
  pressScale?:  number;
  /** Haptic strength on press */
  hapticStyle?: HapticStyle;
  /** Disable haptic (e.g. for text inputs) */
  noHaptic?:    boolean;
}

export function NativeButton({
  children,
  pressScale  = 0.97,
  hapticStyle = 'light',
  noHaptic    = false,
  onClick,
  className = '',
  disabled,
  ...rest
}: NativeButtonProps) {
  return (
    <motion.button
      {...rest}
      disabled={disabled}
      className={className}
      // Spring-based press scale — NOT a CSS transition
      whileTap={{ scale: disabled ? 1 : pressScale }}
      transition={TAP_SPRING}
      // Haptic + original onClick
      onTapStart={() => { if (!disabled && !noHaptic) haptic(hapticStyle); }}
      onClick={onClick}
      // Performance: composited layer for transforms
      style={{ willChange: 'transform', touchAction: 'manipulation' }}
    >
      {children}
    </motion.button>
  );
}

/**
 * NativeCard — same spring feedback but renders as a div.
 * Use for non-button interactive cards.
 */
export function NativeCard({
  children,
  pressScale  = 0.97,
  hapticStyle = 'light',
  noHaptic    = false,
  onClick,
  className = '',
  ...rest
}: Omit<NativeButtonProps, 'disabled'> & { onClick?: () => void }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      className={className}
      whileTap={{ scale: pressScale }}
      transition={TAP_SPRING}
      onTapStart={() => { if (!noHaptic) haptic(hapticStyle); }}
      onClick={onClick}
      style={{ willChange: 'transform', touchAction: 'manipulation' }}
    >
      {children}
    </motion.div>
  );
}
