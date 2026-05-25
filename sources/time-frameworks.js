// ==========================================
// محرك 4X4 — مصفوفة الأطر الزمنية المتعددة
// تم التحديث للتطابق مع خوارزميات Binance اللحظية (RMA & 250 Depth)
// ==========================================

async function runMTFMatrix() {
  const coinInput = document.getElementById('mtf-symbol').value.trim().toUpperCase();
  const btn = document.getElementById('mtf-btn');
  if (!coinInput) return;

  const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري تحليل الأطر (مزامنة Binance)...';
  btn.disabled = true;

  try {
    // زيادة عمق البيانات إلى 250 لضمان استقرار حسابات EMA و RMA
    const timeframes = ['15m', '1h', '4h', '1d'];
    const responses = await Promise.all(
      timeframes.map(tf => fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=500`).then(r => {
        if (!r.ok) throw new Error('فشل جلب البيانات');
        return r.json();
      }))
    );

    const results = timeframes.map((tf, i) => {
      const candles = responses[i].map(k => ({
        close: parseFloat(k[4]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        volume: parseFloat(k[5])
      }));
      return { tf: tf.toUpperCase(), ...analyzeTF(candles) };
    });

    const currentPrice = responses[3][responses[3].length - 1][4];
    renderMTFDashboard(symbol, currentPrice, results);
    document.getElementById('mtf-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message || 'تعذر جلب البيانات. تأكد من صحة الرمز.');
  } finally {
    btn.innerText = 'تحليل الأطر الزمنية';
    btn.disabled = false;
  }
}

// ==========================================
// تحليل إطار زمني واحد — 4 مؤشرات
// ==========================================
function analyzeTF(candles) {
  const closes = candles.map(c => c.close);
  const n = closes.length;

  // 1. EMA Cross (9/21)
  const ema9 = calcEMAArray(closes, 9);
  const ema21 = calcEMAArray(closes, 21);
  const emaCurrent9 = ema9[n - 1];
  const emaCurrent21 = ema21[n - 1];
  const emaPrev9 = ema9[n - 2];
  const emaPrev21 = ema21[n - 2];

  let emaSignal, emaLabel, emaDetail;
  if (emaCurrent9 > emaCurrent21) {
    emaSignal = 'bullish';
    emaLabel = emaPrev9 <= emaPrev21 ? 'تقاطع صاعد' : 'صاعد';
    emaDetail = 'EMA9 > EMA21';
  } else {
    emaSignal = 'bearish';
    emaLabel = emaPrev9 >= emaPrev21 ? 'تقاطع هابط' : 'هابط';
    emaDetail = 'EMA9 < EMA21';
  }

  // 2. Binance Authentic RSI (Wilder's RMA Method)
  const rsiVal = calcBinanceRSI(closes, 14);
  let rsiSignal, rsiLabel;
  if (rsiVal >= 70) { rsiSignal = 'overbought'; rsiLabel = 'تشبع شرائي'; }
  else if (rsiVal <= 30) { rsiSignal = 'oversold'; rsiLabel = 'تشبع بيعي'; }
  else { rsiSignal = 'neutral'; rsiLabel = 'محايد'; }

  // 3. MACD (12/26/9)
  const ema12 = calcEMAArray(closes, 12);
  const ema26 = calcEMAArray(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = calcEMAArray(macdLine, 9);
  const currentMACD = macdLine[n - 1];
  const currentSignal = signalLine[n - 1];
  const prevMACD = macdLine[n - 2];
  const prevSignal = signalLine[n - 2];

  let macdSignal, macdLabel, macdDetail;
  if (currentMACD > currentSignal) {
    macdSignal = 'bullish';
    macdLabel = prevMACD <= prevSignal ? 'تقاطع صاعد' : 'صاعد';
    macdDetail = 'MACD > Signal';
  } else {
    macdSignal = 'bearish';
    macdLabel = prevMACD >= prevSignal ? 'تقاطع هابط' : 'هابط';
    macdDetail = 'MACD < Signal';
  }

  // 4. Price vs EMA50
  const ema50 = calcEMAArray(closes, 50);
  const currentPrice = closes[n - 1];
  const currentEMA50 = ema50[n - 1];

  let posSignal, posLabel, posDetail;
  if (currentPrice > currentEMA50) {
    posSignal = 'bullish'; posLabel = 'فوق'; posDetail = 'Price > EMA50';
  } else {
    posSignal = 'bearish'; posLabel = 'تحت'; posDetail = 'Price < EMA50';
  }

  return {
    ema: { signal: emaSignal, label: emaLabel, detail: emaDetail },
    rsi: { signal: rsiSignal, label: rsiLabel, detail: 'RSI ' + rsiVal.toFixed(1) },
    macd: { signal: macdSignal, label: macdLabel, detail: macdDetail },
    position: { signal: posSignal, label: posLabel, detail: posDetail }
  };
}

// ==========================================
// دوال الحساب الرياضي (متطابقة مع Binance)
// ==========================================
function calcEMAArray(data, period) {
  const ema = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

// خوارزمية التمهيد لـ J. Welles Wilder (RMA) المطابقة لـ Binance
function calcBinanceRSI(closes, period) {
  if (closes.length < period) return 50;
  let gains = 0, losses = 0;
  
  // حساب SMA الأولي لأول فترة
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;

  // التمهيد باستخدام RMA لباقي السلسلة
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

// ==========================================
// عرض النتائج وبناء الواجهة
// ==========================================
function renderMTFDashboard(symbol, price, results) {
  let bullishTotal = 0, bearishTotal = 0, totalSignals = 0;
  
  results.forEach(tf => {
    [tf.ema, tf.rsi, tf.macd, tf.position].forEach(ind => {
      totalSignals++;
      if (ind.signal === 'bullish' || ind.signal === 'oversold') bullishTotal++;
      else if (ind.signal === 'bearish' || ind.signal === 'overbought') bearishTotal++;
    });
  });

  const alignmentPct = Math.round((Math.max(bullishTotal, bearishTotal) / totalSignals) * 100);
  const dominant = bullishTotal > bearishTotal ? 'bullish' : bearishTotal > bullishTotal ? 'bearish' : 'neutral';
  const dominantColor = dominant === 'bullish' ? '#ffffff' : dominant === 'bearish' ? '#ff6a00' : '#444';
  const dominantLabel = dominant === 'bullish' ? 'صاعد' : dominant === 'bearish' ? 'هابط' : 'محايد';

  const ring = document.getElementById('mtf-ring');
  ring.setAttribute('stroke', dominantColor);
  ring.setAttribute('stroke-dashoffset', (440 - (alignmentPct / 100 * 440)).toString());

  document.getElementById('mtf-pct').textContent = alignmentPct + '%';
  document.getElementById('mtf-pct').style.color = dominantColor;
  document.getElementById('mtf-dominant').textContent = dominantLabel;
  document.getElementById('mtf-dominant').style.color = dominantColor;

  const cardsWrap = document.getElementById('mtf-tf-cards');
  let cardsHtml = '';

  results.forEach(tf => {
    const align = mtfGetTfAlignment(tf);
    const borderC = align.color === '#444' ? '#1a1a1a' : (align.color.startsWith('rgba') ? '#1a1a1a' : align.color + '33');

    let dotsHtml = '';
    [tf.ema, tf.rsi, tf.macd, tf.position].forEach(ind => {
      const dc = mtfDotColor(ind.signal);
      const anim = dc !== '#333' ? 'animation:pulseSoft 2s ease infinite;' : '';
      dotsHtml += `<div style="width:5px; height:5px; border-radius:50%; background:${dc}; ${anim}"></div>`;
    });

    cardsHtml += `<div style="background:#0a0a0a; border:1px solid ${borderC}; border-radius:8px; padding:10px 4px; text-align:center; border-top:2px solid ${align.color};">
      <div style="font-family:'Share Tech Mono',monospace; font-size:0.9rem; font-weight:bold; color:#fff; margin-bottom:4px;">${tf.tf}</div>
      <div style="font-size:0.6rem; color:${align.color}; font-weight:700;">${align.label}</div>
      <div style="display:flex; justify-content:center; gap:3px; margin-top:6px;">${dotsHtml}</div>
    </div>`;
  });
  cardsWrap.innerHTML = cardsHtml;

  const matrixWrap = document.getElementById('mtf-matrix-grid');
  const indicators = [
    { key: 'ema', label: 'EMA CROSS', sub: '9 / 21' },
    { key: 'rsi', label: 'RSI', sub: 'Period 14' },
    { key: 'macd', label: 'MACD', sub: '12 / 26 / 9' },
    { key: 'position', label: 'PRICE', sub: 'vs EMA50' }
  ];

  let matrixHtml = '<div style="display:grid; grid-template-columns:64px repeat(4,1fr); gap:4px; margin-bottom:6px;"><div></div>';
  results.forEach(tf => {
    matrixHtml += `<div style="text-align:center; font-family:'Share Tech Mono',monospace; font-size:0.7rem; color:#888; font-weight:bold;">${tf.tf}</div>`;
  });
  matrixHtml += '</div>';

  indicators.forEach(indicator => {
    matrixHtml += `<div style="display:grid; grid-template-columns:64px repeat(4,1fr); gap:4px; margin-bottom:4px;">
      <div style="display:flex; flex-direction:column; justify-content:center; padding-right:2px;">
        <div style="font-family:'Share Tech Mono',monospace; font-size:0.58rem; color:#888; font-weight:bold; letter-spacing:0.5px; line-height:1.3;">${indicator.label}</div>
        <div style="font-family:'Share Tech Mono',monospace; font-size:0.42rem; color:#333;">${indicator.sub}</div>
      </div>`;

    results.forEach(tf => {
      const ind = tf[indicator.key];
      const dotC = mtfDotColor(ind.signal);
      const sigC = mtfSignalColor(ind.signal);
      const cellBg = mtfSignalBg(ind.signal);
      const anim = dotC !== '#333' ? 'animation:pulseSoft 2s ease infinite;' : '';

      matrixHtml += `<div style="background:${cellBg}; border:1px solid #1a1a1a; border-radius:6px; padding:7px 3px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;">
        <div style="width:5px; height:5px; border-radius:50%; background:${dotC}; ${anim}"></div>
        <div style="font-size:0.55rem; color:${sigC}; font-weight:600; line-height:1.2;">${ind.label}</div>
        <div style="font-family:'Share Tech Mono',monospace; font-size:0.45rem; color:#444;">${ind.detail}</div>
      </div>`;
    });
    matrixHtml += '</div>';
  });

  matrixWrap.innerHTML = matrixHtml;

  let conclusion = '';
  if (alignmentPct >= 80) {
    conclusion = dominant === 'bullish'
      ? `توافق صعودي قوي (${alignmentPct}%). الأطر الزمنية الأربعة والمؤشرات الأربعة تدعم الاتجاه الصاعد. البيئة مواتية للمراكز الشرائية مع إدارة مخاطر محكمة.`
      : `توافق هبوطي قوي (${alignmentPct}%). الأطر الزمنية والمؤشرات تدعم الاتجاه الهابط. يُنصح بالحذر من المراكز الشرائية ومراقبة مستويات الدعم.`;
  } else if (alignmentPct >= 60) {
    conclusion = `توافق جزئي (${alignmentPct}%). أغلب الأطر الزمنية تميل ${dominant === 'bullish' ? 'للصعود' : 'للهبوط'} لكن بعض المؤشرات تتضارب. يُنصح بانتظار تأكيد إضافي قبل اتخاذ قرار.`;
  } else {
    conclusion = `تضارب واضح بين الأطر الزمنية والمؤشرات (${alignmentPct}%). السوق في حالة عدم وضوح اتجاهي. يُنصح بالانتظار حتى تتوافق الإشارات.`;
  }
  document.getElementById('mtf-conclusion').textContent = conclusion;
}

// — دوال مساعدة للعرض —
function mtfGetTfAlignment(tf) {
  let b = 0, s = 0;
  [tf.ema, tf.rsi, tf.macd, tf.position].forEach(ind => {
    if (ind.signal === 'bullish' || ind.signal === 'oversold') b++;
    else if (ind.signal === 'bearish' || ind.signal === 'overbought') s++;
  });
  if (b >= 3) return { label: 'صاعد', color: '#ffffff' };
  if (s >= 3) return { label: 'هابط', color: '#ff6a00' };
  if (b > s) return { label: 'يميل للصعود', color: 'rgba(255,255,255,0.6)' };
  if (s > b) return { label: 'يميل للهبوط', color: 'rgba(255,106,0,0.6)' };
  return { label: 'متضارب', color: '#444' };
}

function mtfDotColor(signal) {
  if (signal === 'bullish' || signal === 'oversold') return '#ffffff';
  if (signal === 'bearish' || signal === 'overbought') return '#ff6a00';
  return '#333';
}

function mtfSignalColor(signal) {
  if (signal === 'bullish' || signal === 'oversold') return '#ffffff';
  if (signal === 'bearish' || signal === 'overbought') return '#ff6a00';
  return '#444';
}

function mtfSignalBg(signal) {
  if (signal === 'bullish' || signal === 'oversold') return 'rgba(255,255,255,0.03)';
  if (signal === 'bearish' || signal === 'overbought') return 'rgba(255,106,0,0.04)';
  return 'transparent';
}

if (!document.getElementById('mtf-pulse-style')) {
  var s = document.createElement('style');
  s.id = 'mtf-pulse-style';
  s.textContent = '@keyframes pulseSoft{0%,100%{opacity:0.6}50%{opacity:1}}';
  document.head.appendChild(s);
}
// ==========================================
// محرك Wyckoff Phase Detector (المحدث)
// تحليل الحجم القائم على الجهد و Spring/UTAD الموسع
// ==========================================

async function runWyckoff() {
  const coinInput = document.getElementById('wk-symbol').value.trim().toUpperCase();
  const tfInput = document.getElementById('wk-tf').value;
  const btn = document.getElementById('wk-btn');

  if (!coinInput) return;

  const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري تحليل السيولة المؤسسية...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tfInput}&limit=500`);
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    const raw = await res.json();

    const candles = raw.map(k => ({
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    if (candles.length < 80) throw new Error('بيانات غير كافية (تحتاج 80 شمعة على الأقل للتحليل الدقيق).');

    const currentPrice = candles[candles.length - 1].close;
    const result = analyzeWyckoff(candles);

    renderWyckoffDashboard(symbol, currentPrice, tfInput.toUpperCase(), result);
    document.getElementById('wk-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'تحليل مراحل Wyckoff';
    btn.disabled = false;
  }
}

function analyzeWyckoff(candles) {
  const recent = candles.slice(-80); // توسيع النطاق إلى 80 شمعة
  const closes = recent.map(c => c.close);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);

  const volAnalysis = analyzeVolumeEffort(recent);
  const structure = analyzePriceStructure(closes, highs, lows);
  const volatility = analyzeVolatility(candles);
  const springUtad = detectSpringUTAD(recent);
  const phase = classifyPhase(volAnalysis, structure, volatility, springUtad);

  return { volAnalysis, structure, volatility, springUtad, phase };
}

// التحديث الأول: قياس جهد الشراء والبيع بدلاً من الوسيط السعري
function analyzeVolumeEffort(candles) {
  let buyVol = 0, sellVol = 0;

  candles.forEach(c => {
    if (c.close > c.open) buyVol += c.volume;
    else if (c.close < c.open) sellVol += c.volume;
    else { buyVol += c.volume / 2; sellVol += c.volume / 2; }
  });

  sellVol = sellVol === 0 ? 1 : sellVol; // حماية القسمة على صفر
  const totalVol = buyVol + sellVol;
  
  const pctBuy = Math.round((buyVol / totalVol) * 100);
  const pctSell = Math.round((sellVol / totalVol) * 100);
  const ratio = (buyVol / sellVol).toFixed(2);

  let verdict = '';
  let score = 0;

  if (ratio > 1.5) {
    verdict = 'سيطرة شرائية قوية — امتصاص مستمر للعرض (علامة تجميع)';
    score = 2;
  } else if (ratio > 1.2) {
    verdict = 'ميل شرائي — جهد إيجابي يميل للتجميع';
    score = 1;
  } else if (ratio < 0.67) {
    verdict = 'سيطرة بيعية واضحة — ضغط تفريغ (علامة توزيع)';
    score = -2;
  } else if (ratio < 0.83) {
    verdict = 'ميل بيعي — ضغط سلبي يميل للتوزيع';
    score = -1;
  } else {
    verdict = 'توازن بين قوى الشراء والبيع — صراع داخل النطاق';
    score = 0;
  }

  return { pctBuy, pctSell, ratio: parseFloat(ratio), verdict, score };
}

function analyzePriceStructure(closes, highs, lows) {
  const n = closes.length;
  const peakIdxs = [], troughIdxs = [];
  
  for (let i = 3; i < n - 3; i++) {
    if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2]) peakIdxs.push(i);
    if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2]) troughIdxs.push(i);
  }

  let higherHighs = false, higherLows = false;
  if (peakIdxs.length >= 2) higherHighs = highs[peakIdxs[peakIdxs.length - 1]] > highs[peakIdxs[peakIdxs.length - 2]];
  if (troughIdxs.length >= 2) higherLows = lows[troughIdxs[troughIdxs.length - 1]] > lows[troughIdxs[troughIdxs.length - 2]];

  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const rangeWidth = rangeLow > 0 ? ((rangeHigh - rangeLow) / rangeLow * 100).toFixed(1) : 0;

  let trend = 'عرضي', score = 0;
  if (higherHighs && higherLows) { trend = 'صاعد'; score = 3; }
  else if (!higherHighs && !higherLows && peakIdxs.length > 1) { trend = 'هابط'; score = -3; }
  else if (higherLows && !higherHighs) { trend = 'عرضي مائل للصعود'; score = 1; }
  else if (!higherLows && higherHighs) { trend = 'عرضي مائل للهبوط'; score = -1; }

  return { trend, higherHighs, higherLows, rangeWidth, score };
}

function analyzeVolatility(candles) {
  const n = candles.length;
  
  function calcATR(data, start, period) {
    let sum = 0;
    for (let i = start; i < start + period && i < data.length; i++) {
      const tr = Math.max(
        data[i].high - data[i].low,
        i > 0 ? Math.abs(data[i].high - data[i-1].close) : 0,
        i > 0 ? Math.abs(data[i].low - data[i-1].close) : 0
      );
      sum += tr;
    }
    return period > 0 ? sum / period : 1;
  }

  const atrCurrent = calcATR(candles, Math.max(0, n - 14), 14);
  const atrAvg = calcATR(candles, Math.max(0, n - 60), 60);
  const safeAtrAvg = atrAvg === 0 ? 1 : atrAvg;
  const atrRatio = (atrCurrent / safeAtrAvg).toFixed(2);

  let verdict = '', score = 0;
  if (atrRatio < 0.6) { verdict = 'تقلص حاد في التقلب — ضغط سعري انفجاري قادم'; score = 2; }
  else if (atrRatio < 0.8) { verdict = 'هدوء سعري وانحسار في السيولة'; score = 1; }
  else if (atrRatio > 1.5) { verdict = 'توسع حاد في التقلب — حركة اتجاهية قائمة'; score = -1; }
  else { verdict = 'تقلب طبيعي ضمن المعدل'; score = 0; }

  return { atrCurrent: atrCurrent.toFixed(1), atrAvg: atrAvg.toFixed(1), atrRatio: parseFloat(atrRatio), verdict, score };
}

// التحديث الثاني: نطاق بحث أوسع لكشف الـ Spring / UTAD بشكل صلب
function detectSpringUTAD(candles) {
  const rangeCandles = candles.slice(0, -5); // قياس النطاق لـ 75 شمعة
  const rangeHigh = Math.max(...rangeCandles.map(c => c.high));
  const rangeLow = Math.min(...rangeCandles.map(c => c.low));
  const rangeSize = rangeHigh - rangeLow;

  const last5 = candles.slice(-5);
  const avgVol = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;

  let detected = false, type = '', desc = '', score = 0;

  for (let i = 0; i < last5.length; i++) {
    const c = last5[i];
    
    // Spring Logic
    if (c.low < rangeLow - (rangeSize * 0.005) && c.close > rangeLow) {
      detected = true; type = 'Spring'; score = 3;
      desc = 'كسر كاذب للقاع (Spring) مع إغلاق إيجابي. تأكيد مؤسسي لامتصاص البيع.';
      if (c.volume > avgVol * 1.5) desc += ' الحجم الضخم يؤكد مصداقية الإشارة.';
      break;
    }
    // UTAD Logic
    if (c.high > rangeHigh + (rangeSize * 0.005) && c.close < rangeHigh) {
      detected = true; type = 'UTAD'; score = -3;
      desc = 'كسر كاذب للقمة (UTAD) مع إغلاق سلبي. تأكيد مؤسسي لبدء التصريف.';
      if (c.volume > avgVol * 1.5) desc += ' الحجم الضخم يؤكد مصداقية الإشارة.';
      break;
    }
  }

  return { detected, type, desc, score };
}

function classifyPhase(vol, structure, volatility, spring) {
  let totalScore = vol.score + structure.score + volatility.score + spring.score;
  let phase, phaseAr, nextPhase, conclusion;
  let confidence = 0;
  
  const isRangebound = volatility.atrRatio < 0.85 || Math.abs(structure.score) <= 1;

  if (isRangebound && totalScore >= 2) {
    phase = 'accumulation'; phaseAr = 'تجميع مؤسسي'; nextPhase = 'Markup (صعود)';
    confidence = Math.min(95, 50 + totalScore * 8);
    conclusion = 'السوق في مرحلة تجميع. المؤسسات تبني مراكز شرائية داخل النطاق.';
    if (vol.ratio > 1.2) conclusion += ' السيطرة الشرائية تدعم امتصاص العرض.';
    if (spring.type === 'Spring') conclusion += ' الكسر الكاذب (Spring) يمثل تأكيداً نهائياً.';
  } else if (isRangebound && totalScore <= -2) {
    phase = 'distribution'; phaseAr = 'توزيع مؤسسي'; nextPhase = 'Markdown (هبوط)';
    confidence = Math.min(95, 50 + Math.abs(totalScore) * 8);
    conclusion = 'السوق في مرحلة توزيع. المؤسسات تُصرف الكميات داخل النطاق.';
    if (vol.ratio < 0.8) conclusion += ' الضغط البيعي مستمر لتفريغ الطلب.';
    if (spring.type === 'UTAD') conclusion += ' الكسر الكاذب (UTAD) يمثل إشارة قوية للهبوط.';
  } else if (structure.score >= 2) {
    phase = 'markup'; phaseAr = 'صعود اتجاهي'; nextPhase = 'Distribution (توزيع)';
    confidence = Math.min(95, 55 + structure.score * 7);
    conclusion = 'السوق في مرحلة صعود. القمم والقيعان تتصاعد بشكل صحي.';
  } else if (structure.score <= -2) {
    phase = 'markdown'; phaseAr = 'هبوط اتجاهي'; nextPhase = 'Accumulation (تجميع)';
    confidence = Math.min(95, 55 + Math.abs(structure.score) * 7);
    conclusion = 'السوق في مرحلة هبوط. المسار العام يسيطر عليه الدببة.';
  } else {
    phase = totalScore >= 0 ? 'accumulation' : 'distribution';
    phaseAr = 'إشارات مختلطة'; nextPhase = 'انتظار التأكيد';
    confidence = Math.min(60, 35 + Math.abs(totalScore) * 5);
    conclusion = 'لا توجد سيطرة مؤسسية واضحة حالياً. يُنصح بالانتظار وتجنب المخاطرة.';
  }

  return { phase, phaseAr, nextPhase, conclusion, confidence: Math.max(20, confidence) };
}

function renderWyckoffDashboard(symbol, price, tf, result) {
  const { volAnalysis, structure, volatility, springUtad, phase } = result;
  const phaseColor = (phase.phase === 'accumulation' || phase.phase === 'markup') ? '#ffffff' : 'var(--o)';
  
  const phaseCycle = [
    { key: 'accumulation', en: 'ACC', ar: 'تجميع' },
    { key: 'markup', en: 'MRK', ar: 'صعود' },
    { key: 'distribution', en: 'DST', ar: 'توزيع' },
    { key: 'markdown', en: 'MDN', ar: 'هبوط' }
  ];

  document.getElementById('wk-pair').textContent = symbol;
  document.getElementById('wk-price').textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  document.getElementById('wk-tf-label').textContent = tf;

  phaseCycle.forEach((p, i) => {
    const ring = document.getElementById('wk-ring-' + i);
    const isActive = p.key === phase.phase;
    const c = (p.key === 'accumulation' || p.key === 'markup') ? '#ffffff' : 'var(--o)';
    ring.setAttribute('stroke', isActive ? c : '#1a1a1a');
    ring.setAttribute('stroke-width', isActive ? '6' : '3');
  });

  document.getElementById('wk-phase-ar').textContent = phase.phaseAr;
  document.getElementById('wk-phase-ar').style.color = phaseColor;
  document.getElementById('wk-confidence').textContent = phase.confidence + '%';
  document.getElementById('wk-confidence').style.color = phaseColor;

  let phasesHtml = '';
  phaseCycle.forEach(p => {
    const isActive = p.key === phase.phase;
    const c = (p.key === 'accumulation' || p.key === 'markup') ? '#ffffff' : 'var(--o)';
    const bg = isActive ? (c === '#ffffff' ? 'rgba(255,255,255,0.06)' : 'var(--od)') : 'transparent';
    const borderC = isActive ? (c === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(255,106,0,0.3)') : '#1a1a1a';
    phasesHtml += `<div style="background:${bg}; border:1px solid ${borderC}; border-radius:6px; padding:8px 4px; text-align:center; border-bottom:2px solid ${isActive ? c : '#111'};">
      <div style="font-family:'Share Tech Mono',monospace; font-size:0.65rem; color:${isActive ? c : '#333'}; font-weight:bold; letter-spacing:1px;">${p.en}</div>
      <div style="font-size:0.55rem; color:${isActive ? c : '#333'}; margin-top:2px;">${p.ar}</div>
    </div>`;
  });
  document.getElementById('wk-phases-bar').innerHTML = phasesHtml;

  document.getElementById('wk-vol-buy').textContent = volAnalysis.pctBuy + '%';
  document.getElementById('wk-vol-sell').textContent = volAnalysis.pctSell + '%';
  document.getElementById('wk-vol-buy-bar').style.width = volAnalysis.pctBuy + '%';
  document.getElementById('wk-vol-sell-bar').style.width = volAnalysis.pctSell + '%';
  document.getElementById('wk-vol-ratio').textContent = volAnalysis.ratio + 'x';
  document.getElementById('wk-vol-ratio').style.color = volAnalysis.ratio > 1.2 ? '#fff' : volAnalysis.ratio < 0.8 ? 'var(--o)' : '#888';
  document.getElementById('wk-vol-verdict').textContent = volAnalysis.verdict;

  document.getElementById('wk-structure').innerHTML = `الاتجاه: <span style="color:#fff; font-weight:bold;">${structure.trend}</span><br> قمم أعلى: <span style="color:${structure.higherHighs ? '#fff' : 'var(--o)'}; font-weight:bold;">${structure.higherHighs ? 'نعم' : 'لا'}</span><br> قيعان أعلى: <span style="color:${structure.higherLows ? '#fff' : 'var(--o)'}; font-weight:bold;">${structure.higherLows ? 'نعم' : 'لا'}</span><br> عرض النطاق: <span style="color:#fff; font-weight:bold;">${structure.rangeWidth}%</span>`;

  document.getElementById('wk-volatility').innerHTML = `ATR الحالي: <span style="color:#fff; font-weight:bold;">${volatility.atrCurrent}</span><br> ATR المتوسط: <span style="color:#888; font-weight:bold;">${volatility.atrAvg}</span><br> النسبة: <span style="color:${volatility.atrRatio < 0.8 ? '#fff' : 'var(--o)'}; font-weight:bold;">${volatility.atrRatio}x</span><br> <span style="font-size:0.65rem; color:#777; margin-top:4px; display:inline-block;">${volatility.verdict}</span>`;

  const springBox = document.getElementById('wk-spring-box');
  if (springUtad.detected) {
    const sColor = springUtad.type === 'Spring' ? '#ffffff' : 'var(--o)';
    const sBg = springUtad.type === 'Spring' ? 'rgba(255,255,255,0.03)' : 'var(--od)';
    const sBorder = springUtad.type === 'Spring' ? 'rgba(255,255,255,0.15)' : 'rgba(255,106,0,0.3)';
    springBox.style.display = 'block';
    springBox.innerHTML = `<div style="background:${sBg}; border:1px solid ${sBorder}; border-radius:10px; padding:14px; border-right:3px solid ${sColor};">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-family:'Share Tech Mono',monospace; font-size:0.7rem; color:${sColor}; font-weight:bold; letter-spacing:1px;">${springUtad.type.toUpperCase()} DETECTED</span>
        <span style="font-size:0.6rem; font-weight:600; padding:2px 8px; border-radius:10px; color:${sColor}; background:${springUtad.type === 'Spring' ? 'rgba(255,255,255,0.08)' : 'rgba(255,106,0,0.1)'}; border:1px solid ${sBorder};">تأكيد ${springUtad.type === 'Spring' ? 'تجميع' : 'توزيع'}</span>
      </div>
      <div style="font-size:0.72rem; color:#999; line-height:1.5;">${springUtad.desc}</div>
    </div>`;
  } else {
    springBox.style.display = 'none';
  }

  document.getElementById('wk-conclusion').textContent = phase.conclusion;
  document.getElementById('wk-next-phase').textContent = phase.nextPhase;
  document.getElementById('wk-next-phase').style.color = phaseColor;
}

// ==========================================
// 6 Tools — محرك القرار الموحّد (المحسن)
// تم تطبيق: 1- الأوزان التفاضلية 2- فلترة الحياد 3- الكاش المدمج
// ==========================================

async function run6Tools() {
  const coinInput = document.getElementById('st-symbol').value.trim().toUpperCase();
  const tfInput = document.getElementById('st-tf').value.toLowerCase();
  const btn = document.getElementById('st-btn');

  if (!coinInput) return;

  const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING...';
  btn.disabled = true;

  try {
    const mainRes = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tfInput}&limit=500`);
    if (!mainRes.ok) throw new Error('تعذر جلب البيانات.');
    const mainRaw = await mainRes.json();

    const candles = mainRaw.map(k => ({
      open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]),
      close: parseFloat(k[4]), volume: parseFloat(k[5])
    }));

    if (candles.length < 80) throw new Error('بيانات غير كافية (80 شمعة على الأقل).');

    const currentPrice = candles[candles.length - 1].close;
    const closes = candles.map(c => c.close);
    const toolResults = [];

    // 1. Trend Probability Engine (Multiplier: 1.5x)
    try {
      const vwmacd = calculateTrueVWMACD(candles);
      const weis = calculateRobustWeisWave(candles);
      const volRsi = calculateVolAdjustedRSI(candles);
      const probs = compileProbabilities(vwmacd, weis, volRsi);

      let tpSignal = 'neutral', tpLabel = '', tpDetail = '';
      if (probs.up >= 60) { tpSignal = 'bullish'; tpLabel = 'صعود ' + probs.up + '%'; }
      else if (probs.down >= 60) { tpSignal = 'bearish'; tpLabel = 'هبوط ' + probs.down + '%'; }
      else { tpLabel = 'عرضي ' + probs.side + '%'; }

      toolResults.push({ name: 'محرك الترجيح', en: 'TREND ENGINE', signal: tpSignal, label: tpLabel, detail: vwmacd.status + ' | ' + weis.dir, weight: Math.max(probs.up, probs.down) * 1.5 });
    } catch(e) { toolResults.push({ name: 'محرك الترجيح', en: 'TREND ENGINE', signal: 'neutral', label: 'خطأ', detail: 'فشل التحليل', weight: 0 }); }

    // 2. 4X4 MTF Matrix (Multiplier: 1.5x) + API Deduplication
    try {
      const tfList = ['15m', '1h', '4h', '1d'];
      const mtfResponses = await Promise.all(
        tfList.map(tf => {
          if (tf === tfInput) return Promise.resolve(mainRaw); // Cache Hit
          return fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=500`).then(r => r.ok ? r.json() : null);
        })
      );

      let mtfBull = 0, mtfBear = 0, mtfTotal = 0;
      mtfResponses.forEach(raw => {
        if (!raw || raw.length < 50) return;
        const tfCandles = raw.map(k => ({ close: parseFloat(k[4]), high: parseFloat(k[2]), low: parseFloat(k[3]), volume: parseFloat(k[5]) }));
        const analysis = analyzeTF(tfCandles);
        [analysis.ema, analysis.rsi, analysis.macd, analysis.position].forEach(ind => {
          mtfTotal++;
          if (ind.signal === 'bullish' || ind.signal === 'oversold') mtfBull++;
          else if (ind.signal === 'bearish' || ind.signal === 'overbought') mtfBear++;
        });
      });

      const mtfPct = mtfTotal > 0 ? Math.round((Math.max(mtfBull, mtfBear) / mtfTotal) * 100) : 50;
      const mtfDom = mtfBull > mtfBear ? 'bullish' : mtfBear > mtfBull ? 'bearish' : 'neutral';
      
      toolResults.push({ name: '4X4', en: 'MTF MATRIX', signal: mtfDom, label: 'توافق ' + mtfPct + '%', detail: mtfBull + ' صعود / ' + mtfBear + ' هبوط', weight: mtfPct * 1.5 });
    } catch(e) { toolResults.push({ name: '4X4', en: 'MTF MATRIX', signal: 'neutral', label: 'خطأ', detail: 'فشل التحليل', weight: 0 }); }

    // 3. Divergence Scanner (Multiplier: 1.0x)
    try {
      const rsiDiv = detectRSIDivergence(candles);
      const macdDiv = detectMACDDivergence(candles);
      const obvDiv = detectOBVDivergence(candles);

      const divResults = [rsiDiv, macdDiv, obvDiv];
      const divBearish = divResults.filter(r => r.type === 'bearish').length;
      const divBullish = divResults.filter(r => r.type === 'bullish').length;
      const divScore = Math.max(divBearish, divBullish);

      let divSignal = 'neutral', divLabel = '';
      if (divBearish >= 2) { divSignal = 'bearish'; divLabel = 'سلبي ' + divBearish + '/3'; }
      else if (divBullish >= 2) { divSignal = 'bullish'; divLabel = 'إيجابي ' + divBullish + '/3'; }
      else if (divScore === 1) { divLabel = 'معزول 1/3'; } else { divLabel = 'لا يوجد 0/3'; }

      toolResults.push({ name: 'Divergence', en: 'DIVERGENCE', signal: divSignal, label: divLabel, detail: 'RSI: ' + rsiDiv.label, weight: (divScore >= 2 ? 70 : divScore === 1 ? 40 : 20) * 1.0 });
    } catch(e) { toolResults.push({ name: 'Divergence', en: 'DIVERGENCE', signal: 'neutral', label: 'خطأ', detail: 'فشل التحليل', weight: 0 }); }

    // 4. CHOP Index (Multiplier: 1.0x)
    try {
      const chopCandles = candles.slice(-15);
      let trueRanges = [], chopHighs = [], chopLows = [];
      for (let i = 1; i < chopCandles.length; i++) {
        const h = chopCandles[i].high, l = chopCandles[i].low, pc = chopCandles[i-1].close;
        trueRanges.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
        chopHighs.push(h); chopLows.push(l);
      }
      const sumTR = trueRanges.reduce((a, b) => a + b, 0);
      const maxH = Math.max(...chopHighs), minL = Math.min(...chopLows);
      const chop = 100 * Math.log10(sumTR / (maxH - minL)) / Math.log10(14);

      let chopSignal = 'neutral', chopLabel = '', chopDetail = '';
      if (chop < 38.2) {
        const sma14 = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
        if (currentPrice > sma14) { chopSignal = 'bullish'; chopDetail = 'اتجاه صاعد وزخم مرتفع'; }
        else { chopSignal = 'bearish'; chopDetail = 'اتجاه هابط وزخم مرتفع'; }
        chopLabel = 'قوي ' + chop.toFixed(1);
      } else if (chop > 61.8) { chopLabel = 'تذبذب ' + chop.toFixed(1); chopDetail = 'عشوائية وانعدام اتجاه'; }
      else { chopLabel = 'طبيعي ' + chop.toFixed(1); chopDetail = 'توازن في الزخم'; }

      toolResults.push({ name: 'CHOP', en: 'CHOPPINESS', signal: chopSignal, label: chopLabel, detail: chopDetail, weight: (chop < 38.2 ? 75 : chop > 61.8 ? 30 : 50) * 1.0 });
    } catch(e) { toolResults.push({ name: 'CHOP', en: 'CHOPPINESS', signal: 'neutral', label: 'خطأ', detail: 'فشل التحليل', weight: 0 }); }

    // 5. Wyckoff Phase (Multiplier: 1.5x)
    try {
      const wkResult = analyzeWyckoff(candles);
      const phase = wkResult.phase;

      let wkSignal = 'neutral', wkLabel = '', wkDetail = '';
      if (phase.phase === 'accumulation') { wkSignal = 'bullish'; wkLabel = 'تجميع ' + phase.confidence + '%'; wkDetail = 'امتصاص شرائي للعرض'; }
      else if (phase.phase === 'markup') { wkSignal = 'bullish'; wkLabel = 'صعود ' + phase.confidence + '%'; wkDetail = 'اتجاه مؤسسي نشط'; }
      else if (phase.phase === 'distribution') { wkSignal = 'bearish'; wkLabel = 'توزيع ' + phase.confidence + '%'; wkDetail = 'تفريغ بيعي للطلب'; }
      else if (phase.phase === 'markdown') { wkSignal = 'bearish'; wkLabel = 'هبوط ' + phase.confidence + '%'; wkDetail = 'ضغط بيعي مسيطر'; }
      else { wkLabel = phase.phaseAr; wkDetail = 'انتظار التأكيد'; }

      toolResults.push({ name: 'Wyckoff', en: 'WYCKOFF', signal: wkSignal, label: wkLabel, detail: wkDetail, weight: phase.confidence * 1.5 });
    } catch(e) { toolResults.push({ name: 'Wyckoff', en: 'WYCKOFF', signal: 'neutral', label: 'خطأ', detail: 'فشل التحليل', weight: 0 }); }

    // 6. Markov HMM (Multiplier: 1.0x)
    try {
      const returns = [];
      for (let i = 1; i < closes.length; i++) returns.push(Math.abs((closes[i] - closes[i-1]) / closes[i-1]));
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const recentReturns = returns.slice(-5);
      const recentAvg = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
      const ratio = recentAvg / (avgReturn || 0.001);

      let pSideways = 0, pTrend = 0, pVolatile = 0;
      if (ratio > 1.3) { pVolatile = 80; pTrend = 10; pSideways = 10; } 
      else if (ratio < 0.7) { pSideways = 80; pTrend = 10; pVolatile = 10; } 
      else { pTrend = 80; pSideways = 10; pVolatile = 10; }

      let hmmSignal = 'neutral', hmmLabel = '', hmmDetail = '';
      if (pTrend > 50) {
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        if (currentPrice > sma20) { hmmSignal = 'bullish'; hmmDetail = 'نظام اتجاهي صاعد'; }
        else { hmmSignal = 'bearish'; hmmDetail = 'نظام اتجاهي هابط'; }
        hmmLabel = 'اتجاهي ' + pTrend + '%';
      } else if (pVolatile > 50) { hmmLabel = 'تقلبات ' + pVolatile + '%'; hmmDetail = 'خطورة عالية'; }
      else { hmmLabel = 'عرضي ' + pSideways + '%'; hmmDetail = 'تذبذب عرضي'; }

      toolResults.push({ name: 'HMM', en: 'MARKOV', signal: hmmSignal, label: hmmLabel, detail: hmmDetail, weight: Math.max(pTrend, pSideways, pVolatile) * 1.0 });
    } catch(e) { toolResults.push({ name: 'HMM', en: 'MARKOV', signal: 'neutral', label: 'خطأ', detail: 'فشل التحليل', weight: 0 }); }

    render6ToolsDashboard(symbol, currentPrice, toolResults);
    document.getElementById('st-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function render6ToolsDashboard(symbol, price, tools) {
  document.getElementById('st-pair').textContent = symbol;
  document.getElementById('st-price').textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });

  const bull = tools.filter(t => t.signal === 'bullish').length;
  const bear = tools.filter(t => t.signal === 'bearish').length;
  const neut = tools.filter(t => t.signal === 'neutral').length;
  const total = tools.length;
  const dom = bull > bear ? 'bullish' : bear > bull ? 'bearish' : 'neutral';
  const domColor = dom === 'bullish' ? '#ffffff' : dom === 'bearish' ? 'var(--o)' : '#555';
  const domLabel = dom === 'bullish' ? 'صعود' : dom === 'bearish' ? 'هبوط' : 'محايد';
  const domCount = Math.max(bull, bear);

  // حساب الإجماع باستخدام فلترة الحياد (Neutral Filtering)
  let wBull = 0, wBear = 0;
  tools.forEach(t => {
    if (t.signal === 'bullish') wBull += t.weight;
    else if (t.signal === 'bearish') wBear += t.weight;
  });
  
  const activeWeight = wBull + wBear; // تهميش الإشارات المحايدة من المقام
  const wPct = activeWeight > 0 ? Math.round((Math.max(wBull, wBear) / activeWeight) * 100) : 0;

  const ring = document.getElementById('st-ring');
  ring.setAttribute('stroke', domColor);
  ring.setAttribute('stroke-dashoffset', (452 - (wPct / 100 * 452)).toString());

  document.getElementById('st-pct').textContent = wPct + '%';
  document.getElementById('st-pct').style.color = domColor;
  document.getElementById('st-dominant').textContent = domLabel;
  document.getElementById('st-dominant').style.color = domColor;
  document.getElementById('st-vote-count').textContent = domCount + ' محركات';

  let barsHtml = '';
  if (bull > 0) barsHtml += `<div style="flex:${bull}; height:6px; border-radius:3px; background:linear-gradient(90deg,#ffffff,#ffffffcc); transition:flex 1s;"></div>`;
  if (neut > 0) barsHtml += `<div style="flex:${neut}; height:6px; border-radius:3px; background:#333; transition:flex 1s;"></div>`;
  if (bear > 0) barsHtml += `<div style="flex:${bear}; height:6px; border-radius:3px; background:linear-gradient(90deg,var(--o),var(--od)); transition:flex 1s;"></div>`;
  document.getElementById('st-vote-bars').innerHTML = barsHtml;

  document.getElementById('st-vote-labels').innerHTML = `<span style="color:#fff">BUY ${bull}</span><span style="color:#555">WAIT ${neut}</span><span style="color:var(--o)">SELL ${bear}</span>`;

  const sigColor = s => s === 'bullish' ? '#ffffff' : s === 'bearish' ? 'var(--o)' : '#555';
  const sigBg = s => s === 'bullish' ? 'rgba(255,255,255,0.04)' : s === 'bearish' ? 'var(--od)' : 'rgba(80,80,80,0.04)';
  const sigBorder = s => s === 'bullish' ? 'rgba(255,255,255,0.15)' : s === 'bearish' ? 'rgba(255,106,0,0.3)' : '#1a1a1a';
  const voteTag = s => s === 'bullish' ? 'BUY' : s === 'bearish' ? 'SELL' : 'WAIT';

  let cardsHtml = '';
  tools.forEach((tool, idx) => {
    const c = sigColor(tool.signal);
    cardsHtml += `<div style="background:${sigBg(tool.signal)}; border:1px solid ${sigBorder(tool.signal)}; border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:12px; border-right:3px solid ${c}; animation:fadeUp 0.4s ease forwards; opacity:0; animation-delay:${idx*0.05}s;">
      <div style="width:8px; height:8px; border-radius:50%; flex-shrink:0; background:${c}; ${tool.signal !== 'neutral' ? 'animation:pulseSoft 2s ease infinite;' : ''}"></div>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div>
            <span style="font-family:'Share Tech Mono',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">${tool.name}</span>
            <span style="font-family:'Share Tech Mono',monospace; font-size:0.5rem; color:#555; margin-right:6px;">${tool.en}</span>
          </div>
          <span style="font-family:'Share Tech Mono',monospace; font-size:0.55rem; font-weight:600; padding:2px 8px; border-radius:10px; color:${c}; background:${sigBg(tool.signal)}; border:1px solid ${sigBorder(tool.signal)};">${voteTag(tool.signal)}</span>
        </div>
        <div style="font-size:0.7rem; color:${c}; font-weight:600; margin-bottom:2px;">${tool.label}</div>
        <div style="font-size:0.6rem; color:#888;">${tool.detail}</div>
      </div>
    </div>`;
  });
  document.getElementById('st-tools-cards').innerHTML = cardsHtml;

  let verdict = '';
  if (wPct >= 80 && bull > bear) verdict = `إجماع شرائي قوي (${wPct}%). ترجيح عالي للصعود مدعوم بالسيولة وهيكل السوق. بيئة مواتية جداً للبحث عن صفقات Long.`;
  else if (wPct >= 80 && bear > bull) verdict = `إجماع بيعي قوي (${wPct}%). ترجيح عالي للهبوط مدعوم بضغط التفريغ. يُنصح بالابتعاد أو البحث عن صفقات Short.`;
  else if (wPct >= 65 && bull > bear) verdict = `ميل صعودي متزن (${wPct}%). الإشارات إيجابية لكن تتطلب إدارة مخاطر جيدة نظراً لبعض التحذيرات الفرعية.`;
  else if (wPct >= 65 && bear > bull) verdict = `ميل هبوطي متزن (${wPct}%). الإشارات تميل للسلبية، من الأفضل تجنب الشراء أو تأمين الصفقات الحالية.`;
  else verdict = `تضارب وتباين في الإشارات (إجماع ضعيف ${wPct}%). المحركات متضادة ولا يوجد اتجاه صريح مسيطر. القرار الأفضل هو الانتظار.`;

  document.getElementById('st-verdict').textContent = verdict;
}

if (!document.getElementById('st-pulse-style')) {
  var stStyle = document.createElement('style');
  stStyle.id = 'st-pulse-style';
  stStyle.textContent = '@keyframes pulseSoft{0%,100%{opacity:0.6}50%{opacity:1}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(stStyle);
}

// ==========================================
// محرك Fibonacci Time Zones (المحدث - Macro Extension)
// اكتشاف نقطة الارتكاز + حساب المناطق حتى مستوى 233
// الاعتماد على التوقيت العالمي UTC
// ==========================================

async function runFibTime() {
  const coinInput = document.getElementById('ft-symbol').value.trim().toUpperCase();
  const tfInput = document.getElementById('ft-tf').value.toLowerCase();
  const btn = document.getElementById('ft-btn');

  if (!coinInput) return;

  const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري تحليل المحور الزمني...';
  btn.disabled = true;

  try {
    // التمديد الماكرو-زمني: جلب 300 شمعة
    const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tfInput}&limit=500`);
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    const raw = await res.json();

    if (raw.length < 50) throw new Error('بيانات غير كافية للتحليل التاريخي.');

    const candles = raw.map(k => ({
      time: parseInt(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    const currentPrice = candles[candles.length - 1].close;
    const result = calcFibTimeZones(candles, tfInput);

    renderFibTimeDashboard(symbol, currentPrice, tfInput.toUpperCase(), result);
    document.getElementById('ft-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'حساب المناطق الزمنية';
    btn.disabled = false;
  }
}

function calcFibTimeZones(candles, tf) {
  const n = candles.length;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  
  // استخدام دوال الدايفرجنس لاكتشاف القمم والقيعان
  const peaks = findPeaks(highs, 0, n);
  const troughs = findTroughs(lows, 0, n);

  const lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : -1;
  const lastTrough = troughs.length > 0 ? troughs[troughs.length - 1] : -1;

  let swingIndex, swingType, swingPrice;

  if (lastPeak < 0 && lastTrough < 0) {
    const recent = lows.slice(-80);
    const minIdx = recent.indexOf(Math.min(...recent));
    swingIndex = n - 80 + minIdx;
    swingType = 'قاع';
    swingPrice = lows[swingIndex];
  } else if (lastPeak > lastTrough) {
    swingIndex = lastPeak;
    swingType = 'قمة';
    swingPrice = highs[lastPeak];
  } else {
    swingIndex = lastTrough;
    swingType = 'قاع';
    swingPrice = lows[lastTrough];
  }

  const candlesFromSwing = n - 1 - swingIndex;
  const swingTime = candles[swingIndex].time;
  const swingDate = formatFibDate(swingTime);
  const candleDuration = candles.length >= 2 ? candles[1].time - candles[0].time : 86400000;

  // الامتداد الماكرو-زمني: متتالية فيبوناتشي حتى 233
  const fibSequence = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  const majorFibs = [5, 8, 13, 21, 34, 55, 89, 144, 233];

  const zones = fibSequence.map(fib => {
    const targetTime = swingTime + (fib * candleDuration);
    const date = formatFibDate(targetTime);
    const isMajor = majorFibs.includes(fib);

    let status = 'upcoming';
    if (fib < candlesFromSwing) status = 'passed';
    else if (fib === candlesFromSwing || (fib >= candlesFromSwing - 1 && fib <= candlesFromSwing + 1)) status = 'active';

    return { fib, candles: fib, date, status, type: isMajor ? 'رئيسية' : 'فرعية', targetTime };
  });

  const clusters = [];
  for (let i = 0; i < zones.length - 1; i++) {
    const diff = zones[i + 1].fib - zones[i].fib;
    if (diff <= 2 && zones[i].status !== 'passed') {
      clusters.push({ zone1: zones[i].fib, zone2: zones[i + 1].fib, date: zones[i].date });
    }
  }

  return { swingIndex, swingType, swingPrice, swingDate, candlesFromSwing, zones, clusters, candleDuration };
}

// الاعتماد على التوقيت العالمي (UTC) كما طلبت
function formatFibDate(timestamp) {
  const d = new Date(timestamp);
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return d.getUTCDate() + ' ' + months[d.getUTCMonth()];
}

function renderFibTimeDashboard(symbol, price, tf, result) {
  const { swingType, swingPrice, swingDate, candlesFromSwing, zones, clusters } = result;

  document.getElementById('ft-pair').textContent = symbol;
  document.getElementById('ft-price').textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  document.getElementById('ft-tf-label').textContent = tf;

  document.getElementById('ft-swing-card').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <span style="font-family:'Share Tech Mono',monospace; font-size:0.6rem; color:var(--o); letter-spacing:1px;">SWING POINT DETECTED</span>
      <span style="font-size:0.65rem; color:#fff; font-weight:600; padding:2px 8px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15);">${swingType}</span>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
      <div><div style="font-size:0.6rem; color:#555; margin-bottom:2px;">السعر</div><div style="font-family:'Share Tech Mono',monospace; font-size:0.9rem; color:#fff; font-weight:bold;">$${swingPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div></div>
      <div><div style="font-size:0.6rem; color:#555; margin-bottom:2px;">التاريخ</div><div style="font-family:'Share Tech Mono',monospace; font-size:0.8rem; color:#888; font-weight:bold;">${swingDate}</div></div>
      <div><div style="font-size:0.6rem; color:#555; margin-bottom:2px;">الشموع منذ الارتكاز</div><div style="font-family:'Share Tech Mono',monospace; font-size:0.9rem; color:var(--o); font-weight:bold;">${candlesFromSwing}</div></div>
    </div>`;

  // تعديل المحور البصري ليتوافق مع أقصى قيمة (233)
  const maxFib = 233;
  let timelineHtml = '';
  const nowPct = Math.min(95, (candlesFromSwing / maxFib) * 100);
  
  timelineHtml += `<div style="position:absolute; left:${nowPct}%; top:-14px; font-family:'Share Tech Mono',monospace; font-size:0.5rem; color:var(--o); transform:translateX(-50%);">NOW</div>`;

  zones.forEach(z => {
    const pct = Math.min(95, (z.fib / maxFib) * 100);
    const isPassed = z.status === 'passed';
    const isActive = z.status === 'active';
    const color = isActive ? 'var(--o)' : isPassed ? '#333' : '#fff';
    const size = z.type === 'رئيسية' ? '10px' : '6px';
    timelineHtml += `<div style="position:absolute; left:${pct}%; top:50%; transform:translate(-50%,-50%); width:${size}; height:${size}; border-radius:50%; background:${color}; ${isActive ? 'border:2px solid var(--o); animation:activePulse 2s ease infinite;' : ''} z-index:${isActive ? 10 : 1};"></div>`;
  });

  document.getElementById('ft-timeline').innerHTML = timelineHtml;

  const activeZone = zones.find(z => z.status === 'active');
  const activeBox = document.getElementById('ft-active-zone');
  if (activeZone) {
    activeBox.style.display = 'block';
    activeBox.innerHTML = `
      <div style="background:var(--od); border:1px solid rgba(255,106,0,0.2); border-radius:10px; padding:14px; border-right:3px solid var(--o);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-family:'Share Tech Mono',monospace; font-size:0.7rem; color:var(--o); font-weight:bold; letter-spacing:1px;">ACTIVE ZONE</span>
          <span style="font-family:'Share Tech Mono',monospace; font-size:0.85rem; color:var(--o); font-weight:bold;">Fib ${activeZone.fib}</span>
        </div>
        <div style="font-size:0.75rem; color:#ccc; line-height:1.5;">المنطقة الزمنية الحالية عند الشمعة ${activeZone.candles} من نقطة الارتكاز (${activeZone.date}). منطقة ${activeZone.type} — احتمالية انعكاس أو تسارع مرتفعة.</div>
      </div>`;
  } else {
    activeBox.style.display = 'none';
  }

  let tableHtml = '';
  zones.forEach((z, i) => {
    if (i === 0) return; // إخفاء Fib 1 المتكرر للتنسيق
    const isActive = z.status === 'active';
    const isPassed = z.status === 'passed';
    const isMajor = z.type === 'رئيسية';
    const statusColor = isActive ? 'var(--o)' : isPassed ? '#444' : '#fff';
    const statusBg = isActive ? 'rgba(255,106,0,0.12)' : isPassed ? 'rgba(80,80,80,0.1)' : 'rgba(255,255,255,0.06)';
    const statusBorder = isActive ? 'rgba(255,106,0,0.25)' : isPassed ? '#1a1a1a' : 'rgba(255,255,255,0.12)';
    
    tableHtml += `<tr style="border-bottom:1px solid #111; ${isActive ? 'background:rgba(255,106,0,0.06);' : ''}">
      <td style="padding:8px 4px; font-family:'Share Tech Mono',monospace; font-size:0.8rem; color:${isMajor ? 'var(--o)' : '#666'}; font-weight:${isMajor ? 'bold' : 'normal'};">${z.fib}</td>
      <td style="padding:8px 4px; font-family:'Share Tech Mono',monospace; font-size:0.75rem; color:#888;">${z.candles}</td>
      <td style="padding:8px 4px; font-size:0.7rem; color:${isActive ? 'var(--o)' : isPassed ? '#444' : '#fff'}; font-weight:${isActive ? 'bold' : 'normal'};">${z.date}</td>
      <td style="padding:8px 4px; font-size:0.65rem; color:${isMajor ? 'var(--o)' : '#555'};">${z.type}</td>
      <td style="padding:8px 4px;"><span style="font-size:0.55rem; font-weight:600; padding:2px 6px; border-radius:8px; color:${statusColor}; background:${statusBg}; border:1px solid ${statusBorder};">${isActive ? 'نشطة' : isPassed ? 'مرّت' : 'قادمة'}</span></td>
    </tr>`;
  });
  document.getElementById('ft-table-body').innerHTML = tableHtml;

  const upcomingZones = zones.filter(z => z.status === 'upcoming');
  let conclusion = `نقطة الارتكاز: ${swingType} عند $${swingPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} بتاريخ ${swingDate}. `;
  if (activeZone) conclusion += `المنطقة النشطة حالياً: Fib ${activeZone.fib} (${activeZone.date}). `;
  if (upcomingZones.length > 0) conclusion += `المنطقة القادمة: Fib ${upcomingZones[0].fib} بتاريخ ${upcomingZones[0].date}. `;
  if (clusters.length > 0) conclusion += `رصد كلاستر زمني (Fib ${clusters[0].zone1} و ${clusters[0].zone2}) — احتمالية انعكاس استثنائية. `;
  
  document.getElementById('ft-conclusion').textContent = conclusion;
}

if (!document.getElementById('ft-pulse-style')) {
  var ftStyle = document.createElement('style');
  ftStyle.id = 'ft-pulse-style';
  ftStyle.textContent = '@keyframes activePulse{0%,100%{box-shadow:0 0 0 rgba(255,106,0,0)}50%{box-shadow:0 0 12px rgba(255,106,0,0.3)}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(ftStyle);
}
// ==========================================
// محرك Cycle Confluence — توافق 3 أنظمة دورية
// تحديث: حساب دورة كاملة (قمة-لقمة/قاع-لقاع) + 500 شمعة
// ==========================================

async function runCycleConfluence() {
  const coinInput = document.getElementById('cc-symbol').value.trim().toUpperCase();
  const tfInput = document.getElementById('cc-tf').value.toLowerCase();
  const btn = document.getElementById('cc-btn');

  if (!coinInput) return;

  const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري تحليل توافق الدورات...';
  btn.disabled = true;

  try {
    // زيادة عمق البيانات إلى 500 شمعة لاستيعاب دورات جان الكاملة والدورة الإحصائية
    const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tfInput}&limit=500`);
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    const raw = await res.json();

    if (raw.length < 50) throw new Error('بيانات غير كافية للتحليل التاريخي.');

    const candles = raw.map(k => ({
      time: parseInt(k[0]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4])
    }));

    const result = calcCycleConfluence(candles);
    renderConfluenceDashboard(symbol, candles[candles.length - 1].close, tfInput.toUpperCase(), result);
    document.getElementById('cc-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'تحليل توافق الدورات';
    btn.disabled = false;
  }
}

function calcCycleConfluence(candles) {
  const n = candles.length;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const peaks = findPeaks(highs, 0, n);
  const troughs = findTroughs(lows, 0, n);

  const lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : -1;
  const lastTrough = troughs.length > 0 ? troughs[troughs.length - 1] : -1;

  let swingIndex, swingType, swingPrice;
  if (lastPeak < 0 && lastTrough < 0) {
    const recent = lows.slice(-80);
    swingIndex = n - 80 + recent.indexOf(Math.min(...recent));
    swingType = 'قاع'; swingPrice = lows[swingIndex];
  } else if (lastPeak > lastTrough) {
    swingIndex = lastPeak; swingType = 'قمة'; swingPrice = highs[lastPeak];
  } else {
    swingIndex = lastTrough; swingType = 'قاع'; swingPrice = lows[lastTrough];
  }

  const candlesFromSwing = n - 1 - swingIndex;
  const swingTime = candles[swingIndex].time;
  const candleDuration = candles.length >= 2 ? candles[1].time - candles[0].time : 86400000;

  // توقيت UTC
  function fmtDate(ts) {
    const d = new Date(ts);
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return d.getUTCDate() + ' ' + months[d.getUTCMonth()];
  }
  const swingDate = fmtDate(swingTime);

  // 1. النظام الأول: فيبوناتشي הזمني
  const fibSeq = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
  const fibZones = fibSeq.map(f => {
    const targetTime = swingTime + (f * candleDuration);
    let status = 'upcoming';
    if (f < candlesFromSwing - 1) status = 'passed';
    else if (f >= candlesFromSwing - 1 && f <= candlesFromSwing + 1) status = 'active';
    return { system: 'fib', value: f, label: 'Fib ' + f, date: fmtDate(targetTime), candles: f, status: status, targetTime: targetTime };
  });

  // 2. النظام الثاني: زوايا جان
  const gannAngles = [30, 45, 60, 90, 120, 144, 180, 270, 360];
  const gannZones = gannAngles.map(a => {
    const targetTime = swingTime + (a * candleDuration);
    let status = 'upcoming';
    if (a < candlesFromSwing - 1) status = 'passed';
    else if (a >= candlesFromSwing - 1 && a <= candlesFromSwing + 1) status = 'active';
    return { system: 'gann', value: a, label: 'Gann ' + a + '°', date: fmtDate(targetTime), candles: a, status: status, targetTime: targetTime };
  });

  // 3. النظام الثالث: الدورة الإحصائية المهيمنة (Full Cycle Calculation)
  let peakIntervals = [];
  for (let i = 1; i < peaks.length; i++) peakIntervals.push(peaks[i] - peaks[i - 1]);
  
  let troughIntervals = [];
  for (let i = 1; i < troughs.length; i++) troughIntervals.push(troughs[i] - troughs[i - 1]);

  let allIntervals = peakIntervals.concat(troughIntervals);
  let dominantCycle = 20; 
  if (allIntervals.length >= 2) {
    dominantCycle = Math.round(allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length);
    if (dominantCycle < 5) dominantCycle = 5; // منع الدورات العشوائية القصيرة جداً
  }

  const statMultiples = [1, 2, 3, 4, 5];
  const statZones = statMultiples.map(m => {
    const cycleLen = dominantCycle * m;
    const targetTime = swingTime + (cycleLen * candleDuration);
    let status = 'upcoming';
    if (cycleLen < candlesFromSwing - 1) status = 'passed';
    else if (cycleLen >= candlesFromSwing - 1 && cycleLen <= candlesFromSwing + 1) status = 'active';
    const labels = ['دورة أساسية', 'دورة مزدوجة', 'دورة ثلاثية', 'دورة رباعية', 'دورة خماسية'];
    return { system: 'stat', value: cycleLen, label: 'Stat ' + cycleLen, date: fmtDate(targetTime), candles: cycleLen, status: status, targetTime: targetTime, desc: labels[m - 1] + ' (' + dominantCycle + 'x' + m + ')' };
  });

  // دمج وتحليل التوافق (Tolerance = ±2 Candles)
  let allZones = fibZones.concat(gannZones).concat(statZones);
  let upcomingAndActive = allZones.filter(z => z.status !== 'passed').sort((a, b) => a.candles - b.candles);
  
  let confluences = [];
  const tolerance = 2;

  for (let i = 0; i < upcomingAndActive.length; i++) {
    let cluster = [upcomingAndActive[i]];
    for (let j = i + 1; j < upcomingAndActive.length; j++) {
      if (Math.abs(upcomingAndActive[j].candles - upcomingAndActive[i].candles) <= tolerance) {
        let alreadyHasSystem = cluster.some(c => c.system === upcomingAndActive[j].system);
        if (!alreadyHasSystem) cluster.push(upcomingAndActive[j]);
      }
    }
    if (cluster.length >= 2) {
      let clusterKey = cluster.map(c => c.label).sort().join('+');
      if (!confluences.some(c => c.key === clusterKey)) {
        let systems = cluster.map(c => c.label);
        let avgCandles = Math.round(cluster.reduce((a, c) => a + c.candles, 0) / cluster.length);
        let desc = 'توافق ' + (cluster.length === 3 ? 'ثلاثي قوي' : 'ثنائي') + ' بين ' + systems.join(' و ');
        confluences.push({ key: clusterKey, date: cluster[0].date, systems: systems, strength: cluster.length, desc: desc, avgCandles: avgCandles });
      }
    }
  }

  confluences.sort((a, b) => a.avgCandles - b.avgCandles);

  return { swingType, swingPrice, swingDate, candlesFromSwing, dominantCycle, fibZones, gannZones, statZones, confluences };
}

function renderConfluenceDashboard(symbol, price, tf, r) {
  document.getElementById('cc-pair').textContent = symbol;
  document.getElementById('cc-swing').textContent = r.swingType + ' $' + r.swingPrice.toLocaleString('en-US', { maximumFractionDigits: 2 });

  const SYS_COLORS = { fib: 'var(--o)', gann: '#ffffff', stat: '#888888' };
  const SYS_NAMES = { fib: 'Fibonacci', gann: 'Gann', stat: 'Statistical' };

  let timelinesHtml = '';
  const systems = { fib: r.fibZones, gann: r.gannZones, stat: r.statZones };
  const maxCandle = 360; // توافق مع أقصى زاوية لجان

  for (let sysKey in systems) {
    let zones = systems[sysKey];
    let color = SYS_COLORS[sysKey];

    timelinesHtml += `<div style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-family:'Share Tech Mono',monospace; font-size:0.6rem; color:${color}; font-weight:bold; letter-spacing:0.5px;">${SYS_NAMES[sysKey]}</span>
        <span style="font-family:'Share Tech Mono',monospace; font-size:0.5rem; color:#333;">${zones.length} zones</span>
      </div>
      <div style="position:relative; height:6px; background:#111; border-radius:3px; overflow:hidden;">`;

    zones.forEach(z => {
      let pct = Math.min(95, (z.candles / maxCandle) * 100);
      let isPassed = z.status === 'passed';
      let isActive = z.status === 'active';
      let size = isActive ? '10px' : isPassed ? '5px' : '7px';
      timelinesHtml += `<div style="position:absolute; left:${pct}%; top:50%; transform:translate(-50%,-50%); width:${size}; height:${size}; border-radius:50%; background:${isPassed ? '#222' : color}; opacity:${isPassed ? '0.4' : '1'}; ${isActive ? 'border:2px solid '+color+'; animation:pulseSoft 2s infinite;' : ''}"></div>`;
    });
    timelinesHtml += `</div></div>`;
  }
  document.getElementById('cc-timelines').innerHTML = timelinesHtml;

  let confWrap = document.getElementById('cc-confluences-wrap');
  if (r.confluences.length === 0) {
    confWrap.innerHTML = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:16px; text-align:center; color:#555; font-size:0.8rem;">لم يتم رصد توافقات زمنية قريبة.</div>';
  } else {
    let confHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <span style="font-size:0.85rem; color:var(--o); font-weight:700;">مناطق التوافق المكتشفة</span>
      <span style="font-family:'Share Tech Mono',monospace; font-size:0.7rem; color:var(--o); font-weight:bold;">${r.confluences.length}</span>
    </div>`;

    r.confluences.forEach(conf => {
      let isTriple = conf.strength >= 3;
      let borderColor = isTriple ? 'rgba(255,106,0,0.25)' : '#1a1a1a';
      let bgColor = isTriple ? 'rgba(255,106,0,0.08)' : 'rgba(255,255,255,0.02)';
      let rightBorder = isTriple ? 'var(--o)' : '#fff';

      confHtml += `<div style="background:${bgColor}; border:1px solid ${borderColor}; border-radius:10px; padding:14px; margin-bottom:8px; border-right:3px solid ${rightBorder};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-family:'Share Tech Mono',monospace; font-size:0.85rem; color:${isTriple ? 'var(--o)' : '#fff'}; font-weight:bold;">${conf.date}</span>
          <div style="display:flex; gap:4px;">`;

      conf.systems.forEach(sys => {
        let sKey = sys.toLowerCase().includes('fib') ? 'fib' : sys.toLowerCase().includes('gann') ? 'gann' : 'stat';
        confHtml += `<span style="font-family:'Share Tech Mono',monospace; font-size:0.5rem; font-weight:600; padding:2px 6px; border-radius:8px; color:${SYS_COLORS[sKey]}; background:${SYS_COLORS[sKey]}15; border:1px solid ${SYS_COLORS[sKey]}33;">${sys}</span>`;
      });

      confHtml += `</div></div><div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:0.65rem; color:#666; line-height:1.4;">${conf.desc}</span>
        <div style="display:flex; gap:3px; flex-shrink:0; margin-right:8px;">`;
      
      for (let s = 1; s <= 3; s++) {
        confHtml += `<div style="width:14px; height:4px; border-radius:2px; background:${s <= conf.strength ? 'var(--o)' : '#1a1a1a'};"></div>`;
      }
      confHtml += `</div></div></div>`;
    });
    confWrap.innerHTML = confHtml;
  }

  let tableHtml = '';
  let allForTable = r.fibZones.concat(r.gannZones).concat(r.statZones);
  allForTable.sort((a, b) => a.candles - b.candles);

  allForTable.forEach(z => {
    let sysColor = SYS_COLORS[z.system];
    let sysName = z.system === 'fib' ? 'FIB' : z.system === 'gann' ? 'GANN' : 'STAT';
    let isActive = z.status === 'active';
    let isPassed = z.status === 'passed';
    let statusText = isActive ? 'نشطة' : isPassed ? 'مرّت' : 'قادمة';
    let statusColor = isActive ? 'var(--o)' : isPassed ? '#444' : '#fff';
    let statusBg = isActive ? 'rgba(255,106,0,0.12)' : 'rgba(80,80,80,0.1)';
    let statusBorder = isActive ? 'rgba(255,106,0,0.25)' : '#1a1a1a';
    let valueDisplay = z.system === 'gann' ? z.value + '°' : z.value;

    tableHtml += `<tr style="border-bottom:1px solid #111; ${isActive ? 'background:rgba(255,106,0,0.06);' : ''}">
      <td style="padding:6px 4px;"><span style="font-family:'Share Tech Mono',monospace; font-size:0.6rem; color:${sysColor}; font-weight:bold;">${sysName}</span></td>
      <td style="padding:6px 4px; font-family:'Share Tech Mono',monospace; font-size:0.75rem; color:${isPassed ? '#444' : sysColor};">${valueDisplay}</td>
      <td style="padding:6px 4px; font-size:0.7rem; color:${isPassed ? '#444' : '#fff'};">${z.date}</td>
      <td style="padding:6px 4px;"><span style="font-size:0.5rem; padding:2px 5px; border-radius:6px; color:${statusColor}; background:${statusBg}; border:1px solid ${statusBorder};">${statusText}</span></td>
    </tr>`;
  });
  document.getElementById('cc-table-body').innerHTML = tableHtml;

  let conclusion = `نقطة الارتكاز المكتشفة: ${r.swingType} عند $${r.swingPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${r.swingDate}). `;
  conclusion += `الدورة الإحصائية الكاملة (قمة لقمة / قاع لقاع) المهيمنة حالياً: ${r.dominantCycle} شمعة. `;
  conclusion += `تم رصد ${r.confluences.length} منطقة توافق زمني. `;

  if (r.confluences.length > 0) {
    conclusion += `أقرب توافق قادم: ${r.confluences[0].date} (${r.confluences[0].systems.join(' + ')}). `;
    let tripleConf = r.confluences.filter(c => c.strength >= 3).length;
    if (tripleConf > 0) conclusion += `يوجد ${tripleConf} كلاستر زمني ثلاثي — احتمالية انعكاس عالية جداً. `;
  }
  conclusion += 'يُنصح بمراقبة حركة السعر بالتزامن مع تواريخ الكلاسترات الموضحة أعلاه.';
  document.getElementById('cc-conclusion').textContent = conclusion;
}

if (!document.getElementById('cc-pulse-style')) {
  var ccStyle = document.createElement('style');
  ccStyle.id = 'cc-pulse-style';
  ccStyle.textContent = '@keyframes pulseSoft{0%,100%{opacity:0.6}50%{opacity:1}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(ccStyle);
}
// ==========================================
// محرك Moon Correlation — ارتباط أطوار القمر بالسعر
// تحديث: إضافة فلتر منع التداخل الإحصائي (Cooldown)
// ==========================================

async function runMoonCorrelation() {
  var coinInput = document.getElementById('mc2-symbol').value.trim().toUpperCase();
  var btn = document.getElementById('mc2-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري تحليل 365 يوم من البيانات القمرية...';
  btn.disabled = true;

  try {
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=1d&limit=365');
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    var raw = await res.json();

    if (raw.length < 90) throw new Error('بيانات غير كافية (90 يوم على الأقل).');

    var candles = raw.map(function(k) {
      return {
        time: parseInt(k[0]),
        close: parseFloat(k[4])
      };
    });

    var currentPrice = candles[candles.length - 1].close;
    var result = analyzeMoonCorrelation(candles);

    renderMoonDashboard(symbol, currentPrice, result);
    document.getElementById('mc2-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'تحليل الارتباط القمري';
    btn.disabled = false;
  }
}

function analyzeMoonCorrelation(candles) {
  var phaseStats = {
    newMoon:   { bull: 0, bear: 0, total: 0, returns: [] },
    firstQ:    { bull: 0, bear: 0, total: 0, returns: [] },
    fullMoon:  { bull: 0, bear: 0, total: 0, returns: [] },
    lastQ:     { bull: 0, bear: 0, total: 0, returns: [] }
  };

  var lastPhaseKey = null;
  var lastPhaseTime = 0;

  for (var i = 0; i < candles.length - 3; i++) {
    var d = new Date(candles[i].time);
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
    var day = d.getUTCDate();

    var info = getPhaseInfo(year, month, day);
    var phase = info.phase;

    var phaseKey = null;
    if (phase < 0.03 || phase > 0.97) phaseKey = 'newMoon';
    else if (phase > 0.22 && phase < 0.28) phaseKey = 'firstQ';
    else if (phase > 0.47 && phase < 0.53) phaseKey = 'fullMoon';
    else if (phase > 0.72 && phase < 0.78) phaseKey = 'lastQ';

    if (phaseKey === null) continue;

    // فلتر منع التداخل (Cooldown 5 أيام) لضمان تسجيل الطور مرة واحدة لكل دورة
    if (phaseKey === lastPhaseKey && (candles[i].time - lastPhaseTime) < 5 * 86400000) {
      continue;
    }
    
    lastPhaseKey = phaseKey;
    lastPhaseTime = candles[i].time;

    var priceAtPhase = candles[i].close;
    var priceAfter3 = candles[i + 3].close;
    var returnPct = ((priceAfter3 - priceAtPhase) / priceAtPhase) * 100;

    phaseStats[phaseKey].total++;
    phaseStats[phaseKey].returns.push(returnPct);

    if (returnPct > 0) phaseStats[phaseKey].bull++;
    else phaseStats[phaseKey].bear++;
  }

  var phaseNames = {
    newMoon:  { name: 'المحاق',       en: 'NEW MOON',  icon: 'dark' },
    firstQ:   { name: 'الربع الأول',  en: 'FIRST Q.',  icon: 'firstq' },
    fullMoon: { name: 'البدر',        en: 'FULL MOON', icon: 'full' },
    lastQ:    { name: 'الربع الأخير', en: 'LAST Q.',   icon: 'lastq' }
  };

  var phases = [];
  for (var key in phaseStats) {
    var s = phaseStats[key];
    var n = phaseNames[key];
    var total = s.total || 1;
    var bullPct = Math.round((s.bull / total) * 100);
    var bearPct = 100 - bullPct;
    var avgReturn = s.returns.length > 0
      ? (s.returns.reduce(function(a, b) { return a + b; }, 0) / s.returns.length).toFixed(1)
      : '0.0';

    var signal = 'neutral';
    if (bullPct >= 58) signal = 'bullish';
    else if (bearPct >= 58) signal = 'bearish';

    var insight = '';
    if (signal === 'bullish') insight = 'تاريخياً يميل السعر للصعود عند هذا الطور';
    else if (signal === 'bearish') insight = 'تاريخياً يميل السعر للتراجع عند هذا الطور';
    else insight = 'أداء محايد — لا ميل واضح تاريخياً';

    phases.push({
      key: key,
      name: n.name,
      en: n.en,
      icon: n.icon,
      bullPct: bullPct,
      bearPct: bearPct,
      avgReturn: (parseFloat(avgReturn) >= 0 ? '+' : '') + avgReturn + '%',
      occurrences: s.total,
      signal: signal,
      insight: insight
    });
  }

  var sorted = phases.slice().sort(function(a, b) { return b.bullPct - a.bullPct; });
  var strongest = sorted[0];
  var weakest = sorted[sorted.length - 1];
  var nextPhase = findNextMoonPhase();

  return { phases: phases, strongest: strongest, weakest: weakest, nextPhase: nextPhase };
}

function findNextMoonPhase() {
  var today = new Date();
  var phaseNames = {
    newMoon:  { name: 'المحاق',       en: 'NEW MOON',  icon: 'dark' },
    firstQ:   { name: 'الربع الأول',  en: 'FIRST Q.',  icon: 'firstq' },
    fullMoon: { name: 'البدر',        en: 'FULL MOON', icon: 'full' },
    lastQ:    { name: 'الربع الأخير', en: 'LAST Q.',   icon: 'lastq' }
  };
  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  for (var d = 1; d <= 30; d++) {
    var checkDate = new Date(today.getTime() + d * 86400000);
    var year = checkDate.getUTCFullYear();
    var month = checkDate.getUTCMonth();
    var day = checkDate.getUTCDate();

    var info = getPhaseInfo(year, month, day);
    var phase = info.phase;

    var phaseKey = null;
    if (phase < 0.03 || phase > 0.97) phaseKey = 'newMoon';
    else if (phase > 0.22 && phase < 0.28) phaseKey = 'firstQ';
    else if (phase > 0.47 && phase < 0.53) phaseKey = 'fullMoon';
    else if (phase > 0.72 && phase < 0.78) phaseKey = 'lastQ';

    if (phaseKey !== null) {
      var n = phaseNames[phaseKey];
      var dateStr = day + ' ' + months[month] + ' ' + year;
      return { key: phaseKey, name: n.name, en: n.en, icon: n.icon, date: dateStr, daysLeft: d };
    }
  }
  return { key: 'newMoon', name: 'المحاق', en: 'NEW MOON', icon: 'dark', date: '--', daysLeft: 0 };
}

function moonIconSVG(icon, size) {
  size = size || 28;
  if (icon === 'full') return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="var(--o)"/><circle cx="10" cy="10" r="9" fill="none" stroke="var(--o)" stroke-width="1"/></svg>';
  if (icon === 'dark') return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="none" stroke="var(--o)" stroke-width="1.5"/></svg>';
  if (icon === 'firstq') return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="none" stroke="var(--o)" stroke-width="1"/><path d="M10 1 A9 9 0 0 1 10 19 A4 9 0 0 0 10 1 Z" fill="var(--o)"/></svg>';
  if (icon === 'lastq') return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="none" stroke="var(--o)" stroke-width="1"/><path d="M10 1 A9 9 0 0 0 10 19 A4 9 0 0 0 10 1 Z" fill="var(--o)"/></svg>';
  return '';
}

function renderMoonDashboard(symbol, price, result) {
  var r = result;
  document.getElementById('mc2-pair').textContent = symbol;
  document.getElementById('mc2-price').textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });

  var sigColor = function(s) { return s === 'bullish' ? '#fff' : s === 'bearish' ? 'var(--o)' : '#555'; };

  var nextBias = 'neutral';
  var nextPrediction = '';
  r.phases.forEach(function(p) {
    if (p.key === r.nextPhase.key) {
      nextBias = p.signal;
      nextPrediction = 'بناءً على ' + p.occurrences + ' حالة سابقة، ' + (p.signal === 'bullish' ? p.bullPct + '% صعود' : p.signal === 'bearish' ? p.bearPct + '% هبوط' : '50/50 محايد') + ' خلال 3 أيام بعد ' + r.nextPhase.name;
    }
  });

  var nextColor = nextBias === 'bearish' ? 'var(--o)' : '#fff';
  var nextBg = nextBias === 'bearish' ? 'rgba(255,106,0,0.06)' : 'rgba(255,255,255,0.03)';
  var nextBorder = nextBias === 'bearish' ? 'rgba(255,106,0,0.2)' : 'rgba(255,255,255,0.1)';

  document.getElementById('mc2-next-phase').innerHTML = '<div style="background:' + nextBg + '; border:1px solid ' + nextBorder + '; border-radius:10px; padding:16px; border-right:3px solid ' + nextColor + ';">' +
    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
    '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); letter-spacing:1px;">NEXT PHASE</span>' +
    '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#888;">بعد ' + r.nextPhase.daysLeft + ' أيام</span>' +
    '</div>' +
    '<div style="display:flex; align-items:center; gap:14px; margin-bottom:10px;">' +
    moonIconSVG(r.nextPhase.icon, 36) +
    '<div><div style="font-size:1rem; color:#fff; font-weight:700;">' + r.nextPhase.name + '</div>' +
    '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#888;">' + r.nextPhase.date + '</div></div>' +
    '</div>' +
    '<div style="font-size:0.72rem; color:#999; line-height:1.5;">' + nextPrediction + '</div>' +
    '</div>';

  var gridHtml = '';
  r.phases.forEach(function(phase) {
    var sc = sigColor(phase.signal);
    gridHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-top:2px solid ' + sc + ';">';
    gridHtml += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
    gridHtml += moonIconSVG(phase.icon, 22);
    gridHtml += '<div><div style="font-size:0.75rem; color:#fff; font-weight:700;">' + phase.name + '</div>';
    gridHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444;">' + phase.en + '</div></div></div>';
    gridHtml += '<div style="margin-bottom:8px;">';
    gridHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:3px;">';
    gridHtml += '<span style="font-size:0.55rem; color:#888;">صعود</span>';
    gridHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold;">' + phase.bullPct + '%</span></div>';
    gridHtml += '<div style="height:4px; background:#111; border-radius:2px; overflow:hidden;">';
    gridHtml += '<div style="width:' + phase.bullPct + '%; height:100%; background:#fff; border-radius:2px; transition:width 1.5s ease;"></div></div></div>';
    gridHtml += '<div style="margin-bottom:8px;">';
    gridHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:3px;">';
    gridHtml += '<span style="font-size:0.55rem; color:#888;">هبوط</span>';
    gridHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); font-weight:bold;">' + phase.bearPct + '%</span></div>';
    gridHtml += '<div style="height:4px; background:#111; border-radius:2px; overflow:hidden;">';
    gridHtml += '<div style="width:' + phase.bearPct + '%; height:100%; background:var(--o); border-radius:2px; transition:width 1.5s ease;"></div></div></div>';
    gridHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid #1a1a1a;">';
    gridHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + sc + '; font-weight:bold;">' + phase.avgReturn + '</span>';
    gridHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444;">' + phase.occurrences + 'x</span>';
    gridHtml += '</div></div>';
  });
  document.getElementById('mc2-phases-grid').innerHTML = gridHtml;

  var summaryHtml = '';
  summaryHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center;">';
  summaryHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">STRONGEST PHASE</div>';
  summaryHtml += '<div style="font-size:0.8rem; color:#fff; font-weight:700;">' + r.strongest.name + '</div>';
  summaryHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; margin-top:2px;">صعود ' + r.strongest.bullPct + '%</div></div>';

  summaryHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center;">';
  summaryHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">WEAKEST PHASE</div>';
  summaryHtml += '<div style="font-size:0.8rem; color:var(--o); font-weight:700;">' + r.weakest.name + '</div>';
  summaryHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:var(--o); margin-top:2px;">هبوط ' + r.weakest.bearPct + '%</div></div>';
  document.getElementById('mc2-summary').innerHTML = summaryHtml;

  var biasText = nextBias === 'bullish' ? 'صعودي' : nextBias === 'bearish' ? 'هبوطي' : 'محايد';
  var conclusion = 'تحليل 365 يوم من بيانات ' + symbol + ' يكشف ارتباطاً تاريخياً بين أطوار القمر وحركة السعر. ';
  conclusion += 'الطور الأقوى: ' + r.strongest.name + ' بنسبة صعود ' + r.strongest.bullPct + '%. ';
  conclusion += 'الطور الأضعف: ' + r.weakest.name + ' بنسبة هبوط ' + r.weakest.bearPct + '%. ';
  conclusion += 'الطور القادم: ' + r.nextPhase.name + ' بعد ' + r.nextPhase.daysLeft + ' أيام (' + r.nextPhase.date + ') — الميل التاريخي المتوقع (' + biasText + '). ';
  conclusion += 'هذا التحليل إحصائي ولا يُعتبر إشارة تداول منفردة بل عامل تأكيد رياضي.';

  document.getElementById('mc2-conclusion').textContent = conclusion;
}
