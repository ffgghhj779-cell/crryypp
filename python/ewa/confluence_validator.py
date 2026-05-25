"""
ewa/confluence_validator.py

Confluence Validation Layer — Elliott Wave Phase 3.5
====================================================

PURPOSE:
    Before confirming a Wave 3 or Wave 5 breakout as valid, this module
    verifies that BOTH of the following technical conditions are met at the
    breakout bar:

    1. RSI CONFIRMATION (Momentum):
       - Bullish Wave 3/5: RSI(14) > 60 (strong bullish momentum)
       - Bearish Wave 3/5: RSI(14) < 40 (strong bearish momentum)

    2. VOLUME EXPANSION:
       - Volume at the breakout bar MUST be > 20-period SMA of Volume
       - This confirms institutional participation, not just retail noise

    If EITHER condition fails for Wave 3 or Wave 5, the entire wave count
    is INVALIDATED. This filters out false breakouts and dramatically
    reduces false positives in the Elliott Guard.

DESIGN:
    - Operates on the raw OHLCV array (list[OHLCVBar])
    - Looks up the bar at the pivot's bar_index to get volume and close price
    - Computes RSI and volume SMA purely from numpy (no external dependencies)
    - Returns a structured ConfluentResult for transparency in the UI
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from .pivot_engine import OHLCVBar, Pivot

log = logging.getLogger(__name__)

# ─── Thresholds (approved by client) ──────────────────────────────────────────
RSI_PERIOD             = 14
VOLUME_SMA_PERIOD      = 20
RSI_BULLISH_THRESHOLD  = 60.0   # RSI must be > 60 for bullish W3/W5
RSI_BEARISH_THRESHOLD  = 40.0   # RSI must be < 40 for bearish W3/W5


# ─── Result Types ─────────────────────────────────────────────────────────────

@dataclass
class ConfluenceCheck:
    """Result of a single wave's confluence validation."""
    wave_label:       str    # "W3" or "W5"
    bar_index:        int
    rsi_value:        float
    rsi_passes:       bool
    volume_value:     float
    volume_sma:       float
    volume_passes:    bool
    confluence_valid: bool   # True only if BOTH RSI and volume pass
    reject_reason:   str = ""

    def to_dict(self) -> dict:
        return {
            "wave_label":       self.wave_label,
            "bar_index":        self.bar_index,
            "rsi":              round(self.rsi_value, 2),
            "rsi_threshold":    RSI_BULLISH_THRESHOLD,
            "rsi_passes":       self.rsi_passes,
            "volume":           round(self.volume_value, 4),
            "volume_sma20":     round(self.volume_sma, 4),
            "volume_passes":    self.volume_passes,
            "confluence_valid": self.confluence_valid,
            "reject_reason":    self.reject_reason,
        }


@dataclass
class ConfluentResult:
    """Full confluence validation result for a 5-wave impulse."""
    passed:       bool            # True only if all checked waves pass
    w3_check:     ConfluenceCheck | None
    w5_check:     ConfluenceCheck | None
    reject_reason: str = ""

    def to_dict(self) -> dict:
        return {
            "confluence_passed": self.passed,
            "reject_reason":     self.reject_reason,
            "w3":                self.w3_check.to_dict() if self.w3_check else None,
            "w5":                self.w5_check.to_dict() if self.w5_check else None,
        }


# ─── RSI Calculator ───────────────────────────────────────────────────────────

def compute_rsi(closes: np.ndarray, period: int = RSI_PERIOD) -> np.ndarray:
    """
    Compute Wilder's RSI over a closes array.

    Returns an array of the same length as closes. Values at indices < period
    are set to 50.0 (neutral) to avoid NaN propagation.

    Algorithm:
        gains  = max(delta, 0)
        losses = max(-delta, 0)
        avg_gain = EMA(gains, period) using Wilder's smoothing (alpha = 1/period)
        avg_loss = EMA(losses, period)
        RS = avg_gain / avg_loss
        RSI = 100 - (100 / (1 + RS))
    """
    if len(closes) < period + 1:
        return np.full(len(closes), 50.0)

    deltas = np.diff(closes)
    gains  = np.maximum(deltas, 0.0)
    losses = np.maximum(-deltas, 0.0)

    # Wilder smoothing factor
    alpha = 1.0 / period

    # Seed with simple average of first `period` elements
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    rsi_vals = np.full(len(closes), 50.0)

    for i in range(period, len(deltas)):
        avg_gain = alpha * gains[i]  + (1 - alpha) * avg_gain
        avg_loss = alpha * losses[i] + (1 - alpha) * avg_loss

        if avg_loss == 0.0:
            rsi_vals[i + 1] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi_vals[i + 1] = 100.0 - (100.0 / (1.0 + rs))

    return rsi_vals


# ─── Volume SMA Calculator ────────────────────────────────────────────────────

def compute_volume_sma(volumes: np.ndarray, period: int = VOLUME_SMA_PERIOD) -> np.ndarray:
    """
    Compute rolling simple moving average of volume.
    Uses a convolution for efficiency. Returns the same length as volumes.
    Values at indices < period are set to volumes[idx] (neutral — no rejection).
    """
    sma = np.full(len(volumes), 0.0)
    for i in range(len(volumes)):
        start = max(0, i - period + 1)
        sma[i] = float(np.mean(volumes[start:i + 1]))
    return sma


# ─── Core Validator ───────────────────────────────────────────────────────────

class ConfluenceValidator:
    """
    Validates RSI + Volume confluence at Wave 3 and Wave 5 pivot bars.

    Usage:
        validator = ConfluenceValidator()
        result = validator.validate_impulse_confluence(
            ohlcv=bars,         # Full OHLCVBar list
            w3_pivot=w3,        # Pivot object for Wave 3 end
            w5_pivot=w5,        # Pivot object for Wave 5 end
            direction="bullish"
        )
        if not result.passed:
            # Discard this wave count — not confirmed by momentum/volume
    """

    def __init__(self) -> None:
        self._rsi_cache:  dict[int, np.ndarray] = {}  # keyed by id(ohlcv)
        self._vsma_cache: dict[int, np.ndarray] = {}

    def _get_rsi(self, bars: list[OHLCVBar]) -> np.ndarray:
        """Compute and cache RSI for a given bar array."""
        key = id(bars)
        if key not in self._rsi_cache:
            closes = np.array([b.c for b in bars], dtype=np.float64)
            self._rsi_cache[key] = compute_rsi(closes)
        return self._rsi_cache[key]

    def _get_volume_sma(self, bars: list[OHLCVBar]) -> np.ndarray:
        """Compute and cache Volume SMA-20 for a given bar array."""
        key = id(bars)
        if key not in self._vsma_cache:
            volumes = np.array([b.v for b in bars], dtype=np.float64)
            self._vsma_cache[key] = compute_volume_sma(volumes)
        return self._vsma_cache[key]

    def _check_single_wave(
        self,
        bars:       list[OHLCVBar],
        pivot:      Pivot,
        direction:  str,
        wave_label: str,
    ) -> ConfluenceCheck:
        """
        Validate RSI and Volume confluence at a single wave's end pivot.

        Parameters
        ----------
        bars       : Full OHLCV bar array used for detection
        pivot      : The Wave end pivot (W3 or W5)
        direction  : "bullish" or "bearish"
        wave_label : "W3" or "W5" (for reporting)
        """
        idx = pivot.bar_index
        n   = len(bars)

        # Guard: ensure bar index is in range
        if idx < 0 or idx >= n:
            return ConfluenceCheck(
                wave_label=wave_label, bar_index=idx,
                rsi_value=50.0, rsi_passes=False,
                volume_value=0.0, volume_sma=0.0, volume_passes=False,
                confluence_valid=False,
                reject_reason=f"{wave_label}: bar_index {idx} out of range (n={n})",
            )

        # Need at least RSI_PERIOD bars before the pivot to compute meaningful RSI
        if idx < RSI_PERIOD:
            log.debug(
                f"[ConfluenceValidator] {wave_label} at bar {idx}: "
                f"insufficient bars for RSI ({idx} < {RSI_PERIOD}) — skipping confluence"
            )
            # Not enough history → skip confluence for this wave (don't reject)
            return ConfluenceCheck(
                wave_label=wave_label, bar_index=idx,
                rsi_value=50.0, rsi_passes=True,
                volume_value=bars[idx].v, volume_sma=bars[idx].v, volume_passes=True,
                confluence_valid=True,
                reject_reason="",
            )

        # Compute RSI and Volume SMA
        rsi_arr  = self._get_rsi(bars)
        vsma_arr = self._get_volume_sma(bars)

        rsi_val   = float(rsi_arr[idx])
        vol_val   = float(bars[idx].v)
        vsma_val  = float(vsma_arr[idx])

        # ── RSI Confirmation ──────────────────────────────────────────────────
        if direction == "bullish":
            rsi_passes = rsi_val > RSI_BULLISH_THRESHOLD
            rsi_reason = (
                f"{wave_label} RSI {rsi_val:.1f} > {RSI_BULLISH_THRESHOLD} ✓"
                if rsi_passes else
                f"{wave_label} RSI {rsi_val:.1f} ≤ {RSI_BULLISH_THRESHOLD} — weak momentum, REJECT"
            )
        else:  # bearish
            rsi_passes = rsi_val < RSI_BEARISH_THRESHOLD
            rsi_reason = (
                f"{wave_label} RSI {rsi_val:.1f} < {RSI_BEARISH_THRESHOLD} ✓"
                if rsi_passes else
                f"{wave_label} RSI {rsi_val:.1f} ≥ {RSI_BEARISH_THRESHOLD} — weak bearish momentum, REJECT"
            )

        # ── Volume Expansion ──────────────────────────────────────────────────
        volume_passes = vol_val > vsma_val
        vol_reason = (
            f"{wave_label} Vol {vol_val:.2f} > SMA20 {vsma_val:.2f} ✓"
            if volume_passes else
            f"{wave_label} Vol {vol_val:.2f} ≤ SMA20 {vsma_val:.2f} — no expansion, REJECT"
        )

        confluence_valid = rsi_passes and volume_passes

        reject_parts = []
        if not rsi_passes:
            reject_parts.append(rsi_reason)
        if not volume_passes:
            reject_parts.append(vol_reason)
        reject_reason = " | ".join(reject_parts)

        log.debug(
            f"[ConfluenceValidator] {wave_label} bar={idx} dir={direction} "
            f"RSI={rsi_val:.1f} {'✓' if rsi_passes else '✗'} "
            f"Vol={vol_val:.2f} SMA={vsma_val:.2f} {'✓' if volume_passes else '✗'} "
            f"→ {'PASS' if confluence_valid else 'FAIL'}"
        )

        return ConfluenceCheck(
            wave_label=wave_label,
            bar_index=idx,
            rsi_value=round(rsi_val, 2),
            rsi_passes=rsi_passes,
            volume_value=round(vol_val, 4),
            volume_sma=round(vsma_val, 4),
            volume_passes=volume_passes,
            confluence_valid=confluence_valid,
            reject_reason=reject_reason,
        )

    def validate_impulse_confluence(
        self,
        bars:      list[OHLCVBar],
        pivots:    list[Pivot],    # Full 6-pivot impulse [W0..W5]
        direction: str,
    ) -> ConfluentResult:
        """
        Validate RSI + Volume confluence for Wave 3 (pivots[3]) and
        Wave 5 (pivots[5]) of a 5-wave impulse.

        If EITHER Wave 3 OR Wave 5 fails confluence, the entire wave count
        is rejected. This is the strict filter requested by the client.

        Parameters
        ----------
        bars      : OHLCV bars for the timeframe being analyzed
        pivots    : Exactly 6 pivots [W0, W1, W2, W3, W4, W5]
        direction : "bullish" or "bearish"
        """
        if len(pivots) != 6:
            return ConfluentResult(
                passed=False, w3_check=None, w5_check=None,
                reject_reason=f"Confluence requires 6 pivots, got {len(pivots)}",
            )

        w3_pivot = pivots[3]  # End of Wave 3
        w5_pivot = pivots[5]  # End of Wave 5

        w3_check = self._check_single_wave(bars, w3_pivot, direction, "W3")
        w5_check = self._check_single_wave(bars, w5_pivot, direction, "W5")

        passed = w3_check.confluence_valid and w5_check.confluence_valid

        reject_parts = []
        if not w3_check.confluence_valid and w3_check.reject_reason:
            reject_parts.append(w3_check.reject_reason)
        if not w5_check.confluence_valid and w5_check.reject_reason:
            reject_parts.append(w5_check.reject_reason)

        reject_reason = " || ".join(reject_parts)

        if not passed:
            log.info(
                f"[ConfluenceValidator] REJECT {direction} impulse — confluence failed: {reject_reason}"
            )
        else:
            log.info(
                f"[ConfluenceValidator] PASS {direction} impulse — RSI+Volume confirmed W3 & W5"
            )

        return ConfluentResult(
            passed=passed,
            w3_check=w3_check,
            w5_check=w5_check,
            reject_reason=reject_reason,
        )

    def clear_cache(self) -> None:
        """Clear cached computations (call between analyses to free memory)."""
        self._rsi_cache.clear()
        self._vsma_cache.clear()
