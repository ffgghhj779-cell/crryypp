/**
 * scripts/parity-test.mjs
 * ========================
 * اختبار التطابق 1:1 مع المنافس
 * يقارن خوارزمياتنا بخوارزميات المنافس الأصلية على نفس البيانات
 *
 * تشغيل: node scripts/parity-test.mjs
 */

// ─── ANSI Colors ──────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const pass = (msg) => console.log(`  ${C.green}✓${C.reset} ${msg}`);
const fail = (msg) => console.log(`  ${C.red}✗${C.reset} ${C.red}${msg}${C.reset}`);
const warn = (msg) => console.log(`  ${C.yellow}⚠${C.reset} ${msg}`);
const info = (msg) => console.log(`  ${C.cyan}→${C.reset} ${msg}`);

// ─── جلب بيانات Binance حقيقية ────────────────────────────────────────────────
async function fetchKlines(symbol = 'BTCUSDT', interval = '1d', limit = 200) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.map(k => ({
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// خوارزميات المنافس الأصلية (مستخرجة من sources/)
// ═══════════════════════════════════════════════════════════════════════════════

// --- من calculations.js السطر 19-20 ---
function competitor_getSF(p, d) {
  if (p >= 10000) return d === 'up' ? 0.0001 : (p >= 40000 ? 0.0001 : 0.001);
  if (p >= 1000) return 0.01;
  if (p >= 100) return 0.1;
  if (p >= 5) return d === 'down' ? 100 : 1;
  if (p >= 1) return d === 'down' ? 100 : 1;
  return 100;
}

function competitor_sc(p, deg, d) {
  let m = competitor_getSF(p, d), r = Math.sqrt(p * m), f = deg / 180;
  let nr = d === 'up' ? r + f : r - f;
  return nr < 0 ? 0 : (nr * nr) / m;
}

// --- من time-frameworks.js السطر 124-162 ---
function competitor_calcEMAArray(data, period) {
  const ema = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function competitor_calcBinanceRSI(closes, period) {
  if (closes.length < period) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function competitor_analyzeTF(candles) {
  const closes = candles.map(c => c.close);
  const n = closes.length;
  const ema9 = competitor_calcEMAArray(closes, 9);
  const ema21 = competitor_calcEMAArray(closes, 21);
  const emaCurrent9 = ema9[n - 1], emaCurrent21 = ema21[n - 1];
  const emaPrev9 = ema9[n - 2], emaPrev21 = ema21[n - 2];

  let emaSignal;
  if (emaCurrent9 > emaCurrent21) {
    emaSignal = 'bullish';
  } else {
    emaSignal = 'bearish';
  }

  const rsiVal = competitor_calcBinanceRSI(closes, 14);
  let rsiSignal;
  if (rsiVal >= 70) rsiSignal = 'overbought';
  else if (rsiVal <= 30) rsiSignal = 'oversold';
  else rsiSignal = 'neutral';

  const ema12 = competitor_calcEMAArray(closes, 12);
  const ema26 = competitor_calcEMAArray(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = competitor_calcEMAArray(macdLine, 9);
  const macdSignal = macdLine[n - 1] > signalLine[n - 1] ? 'bullish' : 'bearish';

  const ema50 = competitor_calcEMAArray(closes, 50);
  const posSignal = closes[n - 1] > ema50[n - 1] ? 'bullish' : 'bearish';

  return { ema: { signal: emaSignal }, rsi: { signal: rsiSignal, value: rsiVal }, macd: { signal: macdSignal }, position: { signal: posSignal } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// خوارزمياتنا (منقولة بدقة من lib/algorithms/)
// ═══════════════════════════════════════════════════════════════════════════════

function our_calcEMA(data, period) {
  const result = new Array(data.length).fill(NaN);
  if (data.length < period) return result;
  let seed = 0;
  for (let i = 0; i < period; i++) seed += data[i];
  result[period - 1] = seed / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function our_calcBinanceRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function our_getSF(p, direction = 'up') {
  if (p >= 10000) return direction === 'up' ? 0.0001 : (p >= 40000 ? 0.0001 : 0.001);
  if (p >= 1000)  return 0.01;
  if (p >= 100)   return 0.1;
  if (p >= 5)     return direction === 'down' ? 100 : 1;
  if (p >= 1)     return direction === 'down' ? 100 : 1;
  return 100; // sub-$1
}

function our_sq9Level(price, angleDeg, direction) {
  const sf = our_getSF(price, direction);
  const root = Math.sqrt(price * sf);
  const inc = angleDeg / 180;
  if (direction === 'up') return Math.pow(root + inc, 2) / sf;
  const newRoot = root - inc;
  if (newRoot < 0) return 0;
  return Math.pow(newRoot, 2) / sf;
}

// ═══════════════════════════════════════════════════════════════════════════════
// دوال المقارنة
// ═══════════════════════════════════════════════════════════════════════════════

function compare(name, competitor, ours, tolerance = 0.001) {
  const diff = Math.abs(competitor - ours);
  const relDiff = competitor !== 0 ? (diff / Math.abs(competitor)) * 100 : diff;
  if (relDiff <= tolerance) {
    pass(`${name}: ${C.green}MATCH${C.reset} | Competitor=${competitor.toFixed(6)} | Ours=${ours.toFixed(6)} | Δ=${relDiff.toFixed(6)}%`);
    return true;
  } else {
    fail(`${name}: MISMATCH | Competitor=${competitor.toFixed(6)} | Ours=${ours.toFixed(6)} | Δ=${relDiff.toFixed(4)}%`);
    return false;
  }
}

function compareSignal(name, competitor, ours) {
  if (competitor === ours) {
    pass(`${name}: ${C.green}MATCH${C.reset} | Both = "${competitor}"`);
    return true;
  } else {
    fail(`${name}: MISMATCH | Competitor="${competitor}" | Ours="${ours}"`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// الاختبارات
// ═══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  let passed = 0, failed = 0, total = 0;

  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}   اختبار التطابق 1:1 مع المنافس — Parity Test   ${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════${C.reset}\n`);

  // ─── جلب البيانات الحقيقية ─────────────────────────────────────────────────
  info('جلب بيانات Binance الحقيقية (BTCUSDT 1d 200 شمعة)...');
  let klines;
  try {
    klines = await fetchKlines('BTCUSDT', '1d', 200);
    info(`تم جلب ${klines.length} شمعة. آخر سعر إغلاق: ${klines[klines.length-1].close}`);
  } catch(e) {
    warn('فشل جلب البيانات من Binance — سيتم استخدام بيانات وهمية للاختبار');
    // بيانات وهمية مولّدة بطريقة منطقية
    klines = [];
    let price = 65000;
    for (let i = 0; i < 200; i++) {
      const change = (Math.random() - 0.48) * 1200;
      price = Math.max(price + change, 1000);
      klines.push({ open: price - 200, high: price + 400, low: price - 500, close: price, volume: 1000 + Math.random() * 5000 });
    }
    info(`استخدام ${klines.length} شمعة وهمية. آخر سعر: ${klines[klines.length-1].close.toFixed(2)}`);
  }

  const closes = klines.map(k => k.close);
  const lastPrice = closes[closes.length - 1];

  // ═══════════════════════════════════════════════════════════════════════════
  // الاختبار 1: RSI (calcBinanceRSI)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}━━━ 1. RSI (Wilder's RMA) ━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);

  const competitor_rsi = competitor_calcBinanceRSI(closes, 14);
  const our_rsi = our_calcBinanceRSI(closes, 14);
  total++;
  if (compare('RSI(14) — BTCUSDT 1D', competitor_rsi, our_rsi, 0.01)) passed++; else failed++;

  // اختبار على فترات مختلفة
  for (const p of [7, 14, 21]) {
    const c_rsi = competitor_calcBinanceRSI(closes.slice(0, 100), p);
    const o_rsi = our_calcBinanceRSI(closes.slice(0, 100), p);
    total++;
    if (compare(`RSI(${p}) — 100 شمعة`, c_rsi, o_rsi, 0.01)) passed++; else failed++;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // الاختبار 2: EMA
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}━━━ 2. EMA (Exponential Moving Average) ━━━━━━━━━━━━${C.reset}`);

  // ملاحظة مهمة: المنافس يبدأ EMA من البيانات الأولى بدون seed، نحن نبدأ بـ SMA seed
  // هذا سيؤدي لفرق في البداية لكن يتقارب مع الوقت
  for (const period of [9, 21, 50]) {
    const c_ema = competitor_calcEMAArray(closes, period);
    const o_ema = our_calcEMA(closes, period);
    const c_last = c_ema[c_ema.length - 1];
    const o_last = o_ema[o_ema.length - 1];
    total++;
    if (compare(`EMA(${period}) — آخر قيمة`, c_last, o_last, 0.05)) passed++; else failed++;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // الاختبار 3: MTF Signals (4x4 Matrix)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}━━━ 3. MTF Matrix Signals (4X4) ━━━━━━━━━━━━━━━━━━━${C.reset}`);

  const c_tf = competitor_analyzeTF(klines);

  // EMA Signal
  const c_ema9 = competitor_calcEMAArray(closes, 9);
  const c_ema21 = competitor_calcEMAArray(closes, 21);
  const o_ema9 = our_calcEMA(closes, 9);
  const o_ema21 = our_calcEMA(closes, 21);
  const c_ema_signal = c_ema9[c_ema9.length-1] > c_ema21[c_ema21.length-1] ? 'bullish' : 'bearish';
  const o_ema_signal = o_ema9[o_ema9.length-1] > o_ema21[o_ema21.length-1] ? 'bullish' : 'bearish';
  total++;
  if (compareSignal('EMA9/21 Signal', c_ema_signal, o_ema_signal)) passed++; else failed++;

  // RSI Signal
  const c_rsi_val = competitor_calcBinanceRSI(closes, 14);
  const o_rsi_val = our_calcBinanceRSI(closes, 14);
  const c_rsi_sig = c_rsi_val >= 70 ? 'overbought' : c_rsi_val <= 30 ? 'oversold' : 'neutral';
  const o_rsi_sig = o_rsi_val >= 70 ? 'overbought' : o_rsi_val <= 30 ? 'oversold' : 'neutral';
  total++;
  if (compareSignal('RSI Signal (overbought/oversold/neutral)', c_rsi_sig, o_rsi_sig)) passed++; else failed++;

  // MACD Signal
  const c_macd = competitor_calcEMAArray(closes, 12).map((v, i) => v - competitor_calcEMAArray(closes, 26)[i]);
  const o_macd_arr = our_calcEMA(closes, 12).map((v, i) => {
    const e26 = our_calcEMA(closes, 26)[i];
    return isNaN(v) || isNaN(e26) ? NaN : v - e26;
  });
  const c_macd_sig_line = competitor_calcEMAArray(c_macd, 9);
  const c_macd_signal = c_macd[closes.length-1] > c_macd_sig_line[closes.length-1] ? 'bullish' : 'bearish';

  const validMacd = o_macd_arr.filter(v => !isNaN(v));
  const o_sig_raw = our_calcEMA(validMacd, 9);
  let si = 0;
  const o_sig = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) { if (!isNaN(o_macd_arr[i])) o_sig[i] = o_sig_raw[si++] ?? NaN; }
  const o_macd_signal = o_macd_arr[closes.length-1] > o_sig[closes.length-1] ? 'bullish' : 'bearish';
  total++;
  if (compareSignal('MACD Signal (bullish/bearish)', c_macd_signal, o_macd_signal)) passed++; else failed++;

  // Price vs EMA50 Signal
  const c_ema50 = competitor_calcEMAArray(closes, 50);
  const o_ema50 = our_calcEMA(closes, 50);
  const c_pos_signal = closes[closes.length-1] > c_ema50[c_ema50.length-1] ? 'bullish' : 'bearish';
  const o_pos_signal = closes[closes.length-1] > o_ema50[o_ema50.length-1] ? 'bullish' : 'bearish';
  total++;
  if (compareSignal('Price vs EMA50 Signal', c_pos_signal, o_pos_signal)) passed++; else failed++;

  // ═══════════════════════════════════════════════════════════════════════════
  // الاختبار 4: Gann Square of Nine (getSF + sc)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}━━━ 4. Gann Square of Nine (SQ9) ━━━━━━━━━━━━━━━━━━${C.reset}`);

  const testPrices = [65000, 3500, 150, 45, 1.5, 0.15, 0.0045];
  const testAngles = [45, 90, 180, 270, 360];

  for (const price of testPrices) {
    for (const angle of testAngles) {
      for (const dir of ['up', 'down']) {
        const c_level = competitor_sc(price, angle, dir);
        const o_level = our_sq9Level(price, angle, dir);
        total++;
        if (compare(`SQ9 P=${price} A=${angle}° D=${dir}`, c_level, o_level, 0.001)) passed++; else failed++;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // النتيجة النهائية
  // ═══════════════════════════════════════════════════════════════════════════
  const pct = ((passed / total) * 100).toFixed(1);
  const color = pct == 100 ? C.green : pct >= 90 ? C.yellow : C.red;

  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  النتيجة النهائية: ${color}${passed}/${total} اختبار نجح (${pct}%)${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════${C.reset}`);

  if (failed === 0) {
    console.log(`\n${C.green}${C.bold}  ✅ تطابق كامل 100% — المنصة مطابقة للمنافس!${C.reset}\n`);
  } else {
    console.log(`\n${C.yellow}${C.bold}  ⚠ ${failed} اختبار فشل — يحتاج مراجعة${C.reset}\n`);
    console.log(`${C.gray}  الفروقات في EMA طبيعية: المنافس يبدأ من القيمة الأولى مباشرةً (no seed)${C.reset}`);
    console.log(`${C.gray}  بينما نحن نستخدم SMA seed للدقة. الفرق يختفي بعد period*3 شمعة.${C.reset}\n`);
  }

  return { passed, failed, total, pct };
}

runTests().catch(console.error);
