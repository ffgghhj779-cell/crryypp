// lib/utils/historyStore.ts
// LocalStorage-based scan history — keeps last 10 entries per browser.

export interface HistoryEntry {
  id:        string;
  toolName:  string;
  symbol:    string;
  timeframe: string;
  timestamp: number;   // Unix ms
  summary:   string;   // 1-line summary of the result
}

const KEY     = 'cryp_scan_history_v1';
const MAX_LEN = 10;

// ── Read ──────────────────────────────────────────────────────────────────────

export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as HistoryEntry[];
  } catch {
    return [];
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function saveAnalysis(
  toolName:  string,
  symbol:    string,
  timeframe: string,
  summary:   string,
): void {
  if (typeof window === 'undefined') return;
  const entry: HistoryEntry = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    toolName,
    symbol,
    timeframe,
    timestamp: Date.now(),
    summary,
  };
  const prev = getHistory().filter(e => e.id !== entry.id);
  const next = [entry, ...prev].slice(0, MAX_LEN);
  localStorage.setItem(KEY, JSON.stringify(next));
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

export function deleteEntry(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(getHistory().filter(e => e.id !== id)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatAge(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const s = Math.floor(diffMs / 1000);
  if (s < 60)   return `${s}ث`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}س`;
  return `${Math.floor(h / 24)}ي`;
}
