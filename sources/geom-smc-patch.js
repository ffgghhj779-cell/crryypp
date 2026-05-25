
// ==========================================
// Harmonic Scanner — ماسح الهارمونيك
// ==========================================

async function runHarmonicScanner() {
  var coinInput = document.getElementById('hm-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('hm-tf').value;
  var btn = document.getElementById('hm-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING PATTERNS...';
  btn.disabled = true;

  try {
  var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات.');
    var raw = await res.json();


    if (raw.length < 50) throw new Error('بيانات غير كافية.');

    var candles = raw.map(function(k) {
      return { h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]) };
    });

    var closes = candles.map(function(c) { return c.c; });
    var highs = candles.map(function(c) { return c.h; });
    var lows = candles.map(function(c) { return c.l; });
    var price = closes[closes.length - 1];

    var result = detectHarmonicPattern(highs, lows, closes, price);
    renderHarmonicDashboard(symbol, price, tfInput.toUpperCase(), closes, result);
    document.getElementById('hm-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START SCAN';
    btn.disabled = false;
  }
}

// تعريف أنماط الهارمونيك والمعايير المثالية
var HARMONIC_PATTERNS = {
  'Bullish Gartley':   { nameAr: 'جارتلي صاعد',     dir: 'bullish', AB_XA: [0.55, 0.68], BC_AB: [0.38, 0.89], CD_BC: [1.13, 1.62], D_XA: [0.74, 0.82], ideal_D: 0.786 },
  'Bearish Gartley':   { nameAr: 'جارتلي هابط',      dir: 'bearish', AB_XA: [0.55, 0.68], BC_AB: [0.38, 0.89], CD_BC: [1.13, 1.62], D_XA: [0.74, 0.82], ideal_D: 0.786 },
  'Bullish Butterfly': { nameAr: 'فراشة صاعدة',      dir: 'bullish', AB_XA: [0.73, 0.83], BC_AB: [0.38, 0.89], CD_BC: [1.62, 2.62], D_XA: [1.20, 1.38], ideal_D: 1.272 },
  'Bearish Butterfly': { nameAr: 'فراشة هابطة',      dir: 'bearish', AB_XA: [0.73, 0.83], BC_AB: [0.38, 0.89], CD_BC: [1.62, 2.62], D_XA: [1.20, 1.38], ideal_D: 1.272 },
  'Bullish Bat':       { nameAr: 'خفاش صاعد',        dir: 'bullish', AB_XA: [0.35, 0.55], BC_AB: [0.38, 0.89], CD_BC: [1.62, 2.62], D_XA: [0.83, 0.92], ideal_D: 0.886 },
  'Bearish Bat':       { nameAr: 'خفاش هابط',        dir: 'bearish', AB_XA: [0.35, 0.55], BC_AB: [0.38, 0.89], CD_BC: [1.62, 2.62], D_XA: [0.83, 0.92], ideal_D: 0.886 },
  'Bullish Crab':      { nameAr: 'سلطعون صاعد',      dir: 'bullish', AB_XA: [0.35, 0.65], BC_AB: [0.38, 0.89], CD_BC: [2.24, 3.62], D_XA: [1.55, 1.68], ideal_D: 1.618 },
  'Bearish Crab':      { nameAr: 'سلطعون هابط',      dir: 'bearish', AB_XA: [0.35, 0.65], BC_AB: [0.38, 0.89], CD_BC: [2.24, 3.62], D_XA: [1.55, 1.68], ideal_D: 1.618 }
};

// معادلة حساب دقة النسبة (Variance)
function calcAccuracy(actual, min, max) {
  if (actual >= min && actual <= max) return 100;
  var mid = (min + max) / 2;
  var range = (max - min) / 2;
  var diff = Math.abs(actual - mid);
  var pct = 100 - (((diff - range) / mid) * 100);
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function detectHarmonicPattern(highs, lows, closes, currentPrice) {
  var n = closes.length;
  var swingPoints = [];

  // استخدام دوال البحث الموجودة في النظام
  var peaks = findPeaks(highs, 0, n);
  var troughs = findTroughs(lows, 0, n);

  peaks.forEach(function(idx) { swingPoints.push({ idx: idx, price: highs[idx], type: 'high' }); });
  troughs.forEach(function(idx) { swingPoints.push({ idx: idx, price: lows[idx], type: 'low' }); });

  swingPoints.sort(function(a, b) { return a.idx - b.idx; });

  // تصفية النطاقات المتقاربة
  var filtered = [swingPoints[0]];
  for (var f = 1; f < swingPoints.length; f++) {
    if (swingPoints[f].idx - filtered[filtered.length - 1].idx >= 3) {
      if (swingPoints[f].type !== filtered[filtered.length - 1].type) {
        filtered.push(swingPoints[f]);
      } else if (swingPoints[f].type === 'high' && swingPoints[f].price > filtered[filtered.length - 1].price) {
        filtered[filtered.length - 1] = swingPoints[f];
      } else if (swingPoints[f].type === 'low' && swingPoints[f].price < filtered[filtered.length - 1].price) {
        filtered[filtered.length - 1] = swingPoints[f];
      }
    }
  }

  if (filtered.length < 5) return { found: false, message: 'لا توجد قمم وقيعان كافية لتشكيل نموذج هارمونيك.' };

  var bestPattern = null;
  var bestOverallAccuracy = 0;

  for (var start = Math.max(0, filtered.length - 10); start <= filtered.length - 5; start++) {
    var X = filtered[start];
    var A = filtered[start + 1];
    var B = filtered[start + 2];
    var C = filtered[start + 3];
    var D = filtered[start + 4];

    var isBullish = (X.type === 'low' && A.type === 'high' && B.type === 'low' && C.type === 'high' && D.type === 'low');
    var isBearish = (X.type === 'high' && A.type === 'low' && B.type === 'high' && C.type === 'low' && D.type === 'high');

    if (!isBullish && !isBearish) continue;

    var XA = Math.abs(A.price - X.price);
    var AB = Math.abs(B.price - A.price);
    var BC = Math.abs(C.price - B.price);
    var CD = Math.abs(D.price - C.price);

    if (XA === 0 || AB === 0 || BC === 0) continue;

    var ratioAB_XA = AB / XA;
    var ratioBC_AB = BC / AB;
    var ratioCD_BC = CD / BC;
    var ratioD_XA = Math.abs(D.price - X.price) / XA;

    for (var patternName in HARMONIC_PATTERNS) {
      var pat = HARMONIC_PATTERNS[patternName];

      if (isBullish && pat.dir !== 'bullish') continue;
      if (isBearish && pat.dir !== 'bearish') continue;

      var matchCount = 0;
      var accSum = 0;

      var acc1 = calcAccuracy(ratioAB_XA, pat.AB_XA[0], pat.AB_XA[1]);
      var acc2 = calcAccuracy(ratioBC_AB, pat.BC_AB[0], pat.BC_AB[1]);
      var acc3 = calcAccuracy(ratioCD_BC, pat.CD_BC[0], pat.CD_BC[1]);
      var acc4 = calcAccuracy(ratioD_XA, pat.D_XA[0], pat.D_XA[1]);

      if (acc1 >= 85) matchCount++;
      if (acc2 >= 85) matchCount++;
      if (acc3 >= 85) matchCount++;
      if (acc4 >= 85) matchCount++;

      accSum = (acc1 + acc2 + acc3 + acc4) / 4;

      if (matchCount >= 3 && accSum > bestOverallAccuracy) {
        bestOverallAccuracy = Math.round(accSum);
        bestPattern = {
          found: true,
          name: patternName,
          nameAr: pat.nameAr,
          dir: pat.dir,
          type: pat.dir === 'bullish' ? 'انعكاسي صعودي' : 'انعكاسي هبوطي',
          accuracy: bestOverallAccuracy,
          ideal_D: pat.ideal_D,
          points: { X: X, A: A, B: B, C: C, D: D },
          ratios: {
            AB_XA: { actual: Math.round(ratioAB_XA * 1000) / 1000, ideal: pat.AB_XA[0] + '-' + pat.AB_XA[1], valid: acc1 >= 85 },
            BC_AB: { actual: Math.round(ratioBC_AB * 1000) / 1000, ideal: pat.BC_AB[0] + '-' + pat.BC_AB[1], valid: acc2 >= 85 },
            CD_BC: { actual: Math.round(ratioCD_BC * 1000) / 1000, ideal: pat.CD_BC[0] + '-' + pat.CD_BC[1], valid: acc3 >= 85 },
            D_XA: { actual: Math.round(ratioD_XA * 1000) / 1000, ideal: pat.D_XA[0] + '-' + pat.D_XA[1], valid: acc4 >= 85 }
          }
        };
      }
    }
  }

  if (!bestPattern) return { found: false, message: 'لا أنماط هارمونيك واضحة حالياً. الأداة فحصت آخر 200 شمعة.' };

  // حساب منطقة PRZ الدقيقة (التقاء ارتداد XA مع امتداد BC)
  var pts = bestPattern.points;
  var XA_range = Math.abs(pts.A.price - pts.X.price);
  var BC_range = Math.abs(pts.C.price - pts.B.price);
  
  var prz_level_1 = bestPattern.dir === 'bullish' ? pts.X.price + (XA_range * (1 - bestPattern.ideal_D)) : pts.X.price - (XA_range * (1 - bestPattern.ideal_D));
  var prz_level_2 = bestPattern.dir === 'bullish' ? pts.C.price - (BC_range * 1.272) : pts.C.price + (BC_range * 1.272);
  
  bestPattern.prz = {
    high: Math.max(prz_level_1, prz_level_2),
    low: Math.min(prz_level_1, prz_level_2)
  };

  // حساب الأهداف بناءً على الضلع CD
  var CD_range = Math.abs(pts.D.price - pts.C.price);
  if (bestPattern.dir === 'bullish') {
    bestPattern.target1 = Math.round(pts.D.price + (CD_range * 0.382));
    bestPattern.target2 = Math.round(pts.D.price + (CD_range * 0.618));
  } else {
    bestPattern.target1 = Math.round(pts.D.price - (CD_range * 0.382));
    bestPattern.target2 = Math.round(pts.D.price - (CD_range * 0.618));
  }

  return bestPattern;
}

function renderHarmonicDashboard(symbol, price, tf, closes, result) {
  if (!result.found) {
    document.getElementById('hm-pattern-card').innerHTML = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:30px; text-align:center; margin-bottom:16px; color:#ccc; font-size:0.85rem;">' + result.message + '</div>';
    document.getElementById('hm-ratios-card').innerHTML = '';
    document.getElementById('hm-zones-card').innerHTML = '';
    document.getElementById('hm-conclusion').textContent = 'لم يتم اكتشاف أنماط هارمونيك. جرّب إطار زمني مختلف.';
    return;
  }

  var r = result;
  var pts = r.points;
  var isBullish = r.dir === 'bullish';
  var patternColor = isBullish ? '#ffffff' : 'var(--o)';
  var n = closes.length;

  var chartStart = Math.max(0, pts.X.idx - 3);
  var chartEnd = Math.min(n - 1, pts.D.idx + 8);
  var chartCloses = closes.slice(chartStart, chartEnd + 1);
  var allP = chartCloses.slice();
  
  [pts.X, pts.A, pts.B, pts.C, pts.D].forEach(function(p) { allP.push(p.price); });
  if (r.target1) allP.push(r.target1);
  if (r.target2) allP.push(r.target2);

  var minP = Math.min.apply(null, allP) * 0.997;
  var maxP = Math.max.apply(null, allP) * 1.003;
  var range = maxP - minP || 1;
  var svgW = 320, svgH = 200;
  var toX = function(idx) { return ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 20) + 10; };
  var toY = function(pr) { return svgH - 10 - ((pr - minP) / range) * (svgH - 20); };

  var ptCoords = {};
  ['X', 'A', 'B', 'C', 'D'].forEach(function(label) { ptCoords[label] = { x: toX(pts[label].idx), y: toY(pts[label].price) }; });

  var html = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden; margin-bottom:16px; border-top:2px solid ' + patternColor + ';">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#0a0a0a; border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:' + patternColor + '; font-weight:bold;">' + r.name + '</div>';
  html += '<div style="font-size:0.65rem; color:#ccc;">' + r.nameAr + ' — ' + r.type + '</div></div>';
  html += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.2rem; color:' + patternColor + '; font-weight:bold;">' + r.accuracy + '%</div>';
  html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; color:#ccc;">ACCURACY</div></div></div>';

  html += '<div style="padding:8px 6px; background:#030308;">';
  html += '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';

  html += '<line x1="0" y1="' + (svgH * 0.25) + '" x2="' + svgW + '" y2="' + (svgH * 0.25) + '" stroke="#0d0d0d" stroke-width="0.5"/>';
  html += '<line x1="0" y1="' + (svgH * 0.5) + '" x2="' + svgW + '" y2="' + (svgH * 0.5) + '" stroke="#0d0d0d" stroke-width="0.5"/>';
  html += '<line x1="0" y1="' + (svgH * 0.75) + '" x2="' + svgW + '" y2="' + (svgH * 0.75) + '" stroke="#0d0d0d" stroke-width="0.5"/>';

  var polyPoints = chartCloses.map(function(pr, i) { return toX(chartStart + i) + ',' + toY(pr); }).join(' ');
  html += '<polyline points="' + polyPoints + '" fill="none" stroke="#333" stroke-width="1.2"/>';

  if (r.prz) {
    html += '<rect x="' + (ptCoords.D.x - 15) + '" y="' + toY(r.prz.high) + '" width="30" height="' + Math.abs(toY(r.prz.low) - toY(r.prz.high)) + '" fill="' + patternColor + '" fill-opacity="0.1" rx="3"/>';
    html += '<text x="' + ptCoords.D.x + '" y="' + (toY(r.prz.high) - 5) + '" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="bold">PRZ</text>';
  }

  html += '<polyline points="' + ptCoords.X.x + ',' + ptCoords.X.y + ' ' + ptCoords.A.x + ',' + ptCoords.A.y + ' ' + ptCoords.B.x + ',' + ptCoords.B.y + ' ' + ptCoords.C.x + ',' + ptCoords.C.y + ' ' + ptCoords.D.x + ',' + ptCoords.D.y + '" fill="none" stroke="' + patternColor + '" stroke-width="1.5" stroke-linejoin="round"/>';

  html += '<line x1="' + ptCoords.X.x + '" y1="' + ptCoords.X.y + '" x2="' + ptCoords.D.x + '" y2="' + ptCoords.D.y + '" stroke="' + patternColor + '" stroke-width="0.5" stroke-dasharray="4 3" opacity="0.3"/>';
  html += '<line x1="' + ptCoords.A.x + '" y1="' + ptCoords.A.y + '" x2="' + ptCoords.C.x + '" y2="' + ptCoords.C.y + '" stroke="' + patternColor + '" stroke-width="0.5" stroke-dasharray="4 3" opacity="0.3"/>';
  html += '<line x1="' + ptCoords.B.x + '" y1="' + ptCoords.B.y + '" x2="' + ptCoords.D.x + '" y2="' + ptCoords.D.y + '" stroke="' + patternColor + '" stroke-width="0.5" stroke-dasharray="4 3" opacity="0.3"/>';

  var ratioColor = 'var(--o)';
  var midAB = { x: (ptCoords.A.x + ptCoords.B.x) / 2 + 8, y: (ptCoords.A.y + ptCoords.B.y) / 2 };
  var midBC = { x: (ptCoords.B.x + ptCoords.C.x) / 2 + 8, y: (ptCoords.B.y + ptCoords.C.y) / 2 };
  var midCD = { x: (ptCoords.C.x + ptCoords.D.x) / 2 + 8, y: (ptCoords.C.y + ptCoords.D.y) / 2 };

  html += '<text x="' + midAB.x + '" y="' + midAB.y + '" fill="' + ratioColor + '" font-size="6" font-family="Share Tech Mono" font-weight="bold">' + r.ratios.AB_XA.actual + '</text>';
  html += '<text x="' + midBC.x + '" y="' + midBC.y + '" fill="' + ratioColor + '" font-size="6" font-family="Share Tech Mono" font-weight="bold">' + r.ratios.BC_AB.actual + '</text>';
  html += '<text x="' + midCD.x + '" y="' + midCD.y + '" fill="' + ratioColor + '" font-size="6" font-family="Share Tech Mono" font-weight="bold">' + r.ratios.CD_BC.actual + '</text>';
  html += '<text x="' + (ptCoords.D.x + 10) + '" y="' + (ptCoords.D.y - 5) + '" fill="' + ratioColor + '" font-size="6" font-family="Share Tech Mono" font-weight="bold">' + r.ratios.D_XA.actual + '</text>';

  if (r.target1) {
    html += '<line x1="' + ptCoords.D.x + '" y1="' + toY(r.target1) + '" x2="' + (svgW - 5) + '" y2="' + toY(r.target1) + '" stroke="#fff" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.3"/>';
    html += '<text x="' + (svgW - 3) + '" y="' + (toY(r.target1) - 3) + '" text-anchor="end" fill="#fff" font-size="5" font-family="Share Tech Mono">T1 $' + r.target1.toLocaleString() + '</text>';
  }
  if (r.target2) {
    html += '<line x1="' + ptCoords.D.x + '" y1="' + toY(r.target2) + '" x2="' + (svgW - 5) + '" y2="' + toY(r.target2) + '" stroke="#fff" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.2"/>';
    html += '<text x="' + (svgW - 3) + '" y="' + (toY(r.target2) - 3) + '" text-anchor="end" fill="#fff" font-size="5" font-family="Share Tech Mono">T2 $' + r.target2.toLocaleString() + '</text>';
  }

  ['X', 'A', 'B', 'C', 'D'].forEach(function(label) {
    var coord = ptCoords[label];
    var ptPrice = pts[label].price;
    var isD = label === 'D';
    var isBottom = (label === 'X' || label === 'B' || label === 'D');
    var labelY = isBottom ? coord.y + 18 : coord.y - 10;
    var priceY = isBottom ? coord.y + 26 : coord.y - 18;

    html += '<circle cx="' + coord.x + '" cy="' + coord.y + '" r="' + (isD ? 5 : 4) + '" fill="' + (isD ? 'var(--o)' : patternColor) + '"/>';
    if (isD) html += '<circle cx="' + coord.x + '" cy="' + coord.y + '" r="8" fill="none" stroke="var(--o)" stroke-width="1" opacity="0.4"/>';

    html += '<rect x="' + (coord.x - 6) + '" y="' + (labelY - 8) + '" width="12" height="10" rx="2" fill="#000" fill-opacity="0.9"/>';
    html += '<text x="' + coord.x + '" y="' + labelY + '" text-anchor="middle" fill="' + (isD ? 'var(--o)' : patternColor) + '" font-size="7" font-family="Share Tech Mono" font-weight="bold">' + label + '</text>';
    html += '<text x="' + coord.x + '" y="' + priceY + '" text-anchor="middle" fill="#ccc" font-size="5" font-family="Share Tech Mono">$' + ptPrice.toLocaleString() + '</text>';
  });

  html += '</svg></div>';

  html += '<div style="display:grid; grid-template-columns:repeat(5,1fr); border-top:1px solid #111;">';
  ['X', 'A', 'B', 'C', 'D'].forEach(function(label, i) {
    html += '<div style="padding:8px 4px; text-align:center; border-left:' + (i > 0 ? '1px solid #111' : 'none') + ';">';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:' + (label === 'D' ? 'var(--o)' : patternColor) + '; font-weight:bold;">' + label + '</div>';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">$' + pts[label].price.toLocaleString() + '</div></div>';
  });
  html += '</div></div>';

  document.getElementById('hm-pattern-card').innerHTML = html;

  var ratHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;">';
  ratHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
  ratHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Fibonacci Ratios</span>';
  ratHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">VALIDATION</span></div>';

  [
    { label: 'AB / XA', r: r.ratios.AB_XA },
    { label: 'BC / AB', r: r.ratios.BC_AB },
    { label: 'CD / BC', r: r.ratios.CD_BC },
    { label: 'D / XA', r: r.ratios.D_XA }
  ].forEach(function(item, i) {
    ratHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:' + (i < 3 ? '1px solid #111' : 'none') + ';">';
    ratHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#ccc; font-weight:bold; min-width:60px;">' + item.label + '</span>';
    ratHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">' + item.r.actual + '</span>';
    ratHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">' + item.r.ideal + '</span>';
    ratHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; font-weight:700; padding:2px 6px; border-radius:6px; color:' + (item.r.valid ? '#000' : 'var(--o)') + '; background:' + (item.r.valid ? '#fff' : 'transparent') + '; border:' + (item.r.valid ? 'none' : '1px solid var(--o)') + ';">' + (item.r.valid ? 'PASS' : 'FAIL') + '</span>';
    ratHtml += '</div>';
  });
  ratHtml += '</div>';
  document.getElementById('hm-ratios-card').innerHTML = ratHtml;

  var zHtml = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
  zHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center; border-top:2px solid var(--o);">';
  zHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">PRZ (REVERSAL ZONE)</div>';
  zHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:var(--o); font-weight:bold;">$' + Math.round(r.prz.high).toLocaleString() + ' — $' + Math.round(r.prz.low).toLocaleString() + '</div></div>';
  zHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center; border-top:2px solid #fff;">';
  zHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">TARGETS</div>';
  zHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#fff; font-weight:bold;">T1: $' + r.target1.toLocaleString() + '</div>';
  zHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#ccc; margin-top:2px;">T2: $' + r.target2.toLocaleString() + '</div></div>';
  zHtml += '</div>';
  document.getElementById('hm-zones-card').innerHTML = zHtml;

  var validCount = [r.ratios.AB_XA, r.ratios.BC_AB, r.ratios.CD_BC, r.ratios.D_XA].filter(function(rt) { return rt.valid; }).length;
  var conc = 'تم اكتشاف نموذج ' + r.nameAr + ' (' + r.name + ') بدقة إجمالية ' + r.accuracy + '%. ';
  conc += validCount + ' من أصل 4 نسب فيبوناتشي متطابقة بقوة. ';
  conc += 'منطقة الانعكاس (PRZ) الناتجة عن التقاء الامتداد مع الارتداد: $' + Math.round(r.prz.high).toLocaleString() + ' — $' + Math.round(r.prz.low).toLocaleString() + '. ';
  conc += 'الهدف الأول (38.2% من CD): $' + r.target1.toLocaleString() + ' | الهدف الثاني (61.8% من CD): $' + r.target2.toLocaleString() + '. ';
  conc += 'النموذج ' + r.type + ' مما يعطي أفضلية للتداول من نقطة D.';
  document.getElementById('hm-conclusion').textContent = conc;
}

// ==========================================
// Fib Spiral — حلزون فيبوناتشي
// ==========================================

async function runFibSpiral() {
  var coinInput = document.getElementById('fs-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('fs-tf').value;
  var btn = document.getElementById('fs-btn');

  if (!coinInput) return;
  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  
  btn.innerText = 'CALCULATING SPIRAL...';
  btn.disabled = true;

  try {
    // استخدام الاتصال المباشر بمنصة بينانس لضمان أسعار لحظية
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=120');
    if (!res.ok) throw new Error('تعذر جلب البيانات.');
    var raw = await res.json();

    if (raw.length < 30) throw new Error('بيانات غير كافية.');

    var candles = raw.map(function(k) {
      return { time: parseInt(k[0]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]) };
    });

    var n = candles.length;
    var currentPrice = candles[n - 1].c;
    var result = calcFibSpiral(candles, currentPrice);

    renderFibSpiralDashboard(symbol, currentPrice, tfInput.toUpperCase(), result);
    document.getElementById('fs-dashboard').style.display = 'block';
  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START SPIRAL';
    btn.disabled = false;
  }
}

function calcFibSpiral(candles, currentPrice) {
  var n = candles.length;
  var highs = candles.map(function(c) { return c.h; });
  var lows = candles.map(function(c) { return c.l; });
  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  function fmtDate(ts) {
    var d = new Date(ts);
    return d.getUTCDate() + ' ' + months[d.getUTCMonth()];
  }

  // اكتشاف القمم والقيعان
  var peaks = findPeaks(highs, 0, n);
  var troughs = findTroughs(lows, 0, n);

  var lastPeak = peaks.length > 0 ? peaks[peaks.length - 1] : null;
  var lastTrough = troughs.length > 0 ? troughs[troughs.length - 1] : null;

  var swingIdx, swingPrice, swingType;
  var baseRadius = currentPrice * 0.02; // قيمة افتراضية

  // استخراج الموجة السابقة (Vector) لتثبيت نصف قطر الحلزون رياضياً
  if (lastPeak !== null && lastTrough !== null) {
    baseRadius = Math.abs(highs[lastPeak] - lows[lastTrough]); // المسافة بين القمة والقاع
    if (lastTrough > lastPeak) {
      swingIdx = lastTrough; swingPrice = lows[lastTrough]; swingType = 'قاع';
    } else {
      swingIdx = lastPeak; swingPrice = highs[lastPeak]; swingType = 'قمة';
    }
  } else if (lastTrough !== null) {
    swingIdx = lastTrough; swingPrice = lows[lastTrough]; swingType = 'قاع';
  } else if (lastPeak !== null) {
    swingIdx = lastPeak; swingPrice = highs[lastPeak]; swingType = 'قمة';
  } else {
    var minIdx = 0;
    for (var m = 1; m < n; m++) { if (lows[m] < lows[minIdx]) minIdx = m; }
    swingIdx = minIdx; swingPrice = lows[minIdx]; swingType = 'قاع';
  }

  var swingDate = fmtDate(candles[swingIdx].time);
  var candlesFromSwing = n - 1 - swingIdx;
  var phi = 1.618; 

  // حساب مستويات الحلزون بناءً على الموجة المكتشفة (Vector)
  var spiralLevels = [];
  var multipliers = [
    { mult: 1, label: '1.000', turns: '0.25' },
    { mult: phi, label: '1.618', turns: '0.50' },
    { mult: phi * phi, label: '2.618', turns: '0.75' },
    { mult: Math.pow(phi, 3), label: '4.236', turns: '1.00' },
    { mult: Math.pow(phi, 4), label: '6.854', turns: '1.25' },
    { mult: Math.pow(phi, 5), label: '11.09', turns: '1.50' }
  ];

  multipliers.forEach(function(m) {
    var radiusPrice = baseRadius * m.mult;
    var priceUp = swingPrice + radiusPrice;
    var priceDown = swingPrice - radiusPrice;
    var timeFwd = Math.round(candlesFromSwing * m.mult);

    var status = 'upcoming';
    if (swingType === 'قاع') {
      if (currentPrice >= priceUp || candlesFromSwing >= timeFwd) status = 'passed';
      else if (Math.abs(currentPrice - priceUp) / priceUp < 0.015) status = 'active';
    } else {
      if (currentPrice <= priceDown || candlesFromSwing >= timeFwd) status = 'passed';
      else if (Math.abs(currentPrice - priceDown) / priceDown < 0.015) status = 'active';
    }

    var candleInterval = candles.length > 1 ? candles[1].time - candles[0].time : 86400000;
    var targetTime = candles[swingIdx].time + timeFwd * candleInterval;
    
    spiralLevels.push({
      multiplier: m.mult,
      label: m.label,
      turns: m.turns,
      priceUp: Math.round(priceUp * 100) / 100,
      priceDown: Math.round(priceDown * 100) / 100,
      timeFwd: timeFwd,
      date: fmtDate(targetTime),
      status: status
    });
  });

  var hasActive = spiralLevels.some(function(l) { return l.status === 'active'; });
  if (!hasActive) {
    for (var j = 0; j < spiralLevels.length; j++) {
      if (spiralLevels[j].status === 'upcoming') { spiralLevels[j].status = 'active'; break; }
    }
  }

  return { swing: { type: swingType, price: swingPrice, date: swingDate, candlesAgo: candlesFromSwing }, levels: spiralLevels, baseRadius: baseRadius, phi: phi };
}

function renderFibSpiralDashboard(symbol, price, tf, result) {
  var r = result;
  var infoHtml = '<div style="display:flex; justify-content:center; align-items:center; gap:20px; padding:10px 0; border-top:1px solid #111; border-bottom:1px solid #111;"><div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; margin-bottom:2px;">PAIR</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:var(--o); font-weight:bold;">' + symbol + '</div></div><div style="width:1px; height:24px; background:#222;"></div><div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; margin-bottom:2px;">PRICE</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:#fff; font-weight:bold;">$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</div></div><div style="width:1px; height:24px; background:#222;"></div><div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; margin-bottom:2px;">SWING</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:#ddd;">' + r.swing.type + '</div></div></div>';
  document.getElementById('fs-info-bar').innerHTML = infoHtml;

  var svgW = 300, svgH = 300, cx = 150, cy = 150, maxVisualR = 140;
  var maxMult = r.levels[r.levels.length - 1].multiplier;

  var spiralHtml = '<div style="background:#050510; border:1px solid #1a1a2a; border-radius:14px; padding:12px;"><div style="display:flex; justify-content:space-between; align-items:center; padding:0 4px 10px; border-bottom:1px solid #111; margin-bottom:8px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:var(--o); font-weight:bold;">GOLDEN SPIRAL</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">φ = 1.618</span></div><div style="display:flex; justify-content:center;"><svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  spiralHtml += '<defs><radialGradient id="spBg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#0a0a18"/><stop offset="100%" stop-color="#020208"/></radialGradient></defs><rect width="' + svgW + '" height="' + svgH + '" fill="url(#spBg)" rx="8"/>';
  
  for (var si = 0; si < 40; si++) { spiralHtml += '<circle cx="' + (5 + (si * 97) % 290) + '" cy="' + (5 + (si * 131) % 290) + '" r="' + (((si % 3) + 1) * 0.25) + '" fill="#fff" opacity="' + (0.08 + (si % 5) * 0.04) + '"/>'; }
  spiralHtml += '<line x1="' + cx + '" y1="10" x2="' + cx + '" y2="290" stroke="#ffffff10" stroke-width="0.5"/><line x1="10" y1="' + cy + '" x2="290" y2="' + cy + '" stroke="#ffffff10" stroke-width="0.5"/>';

  r.levels.forEach(function(lv) {
    var visualR = (lv.multiplier / maxMult) * maxVisualR;
    var isActive = lv.status === 'active';
    spiralHtml += '<circle cx="' + cx + '" cy="' + cy + '" r="' + visualR + '" fill="none" stroke="' + (isActive ? 'var(--o)' : '#ffffff') + '" stroke-width="' + (isActive ? '1' : '0.3') + '" opacity="' + (isActive ? '0.2' : '0.05') + '"/>';
  });

  var fibSeq = [1, 1, 2, 3, 5, 8, 13, 21, 34];
  var scaleFactor = maxVisualR / 55; 
  var spiralPath = '';
  var currentX = cx, currentY = cy;

  for (var q = 0; q < 8; q++) {
    var radius = fibSeq[q + 1] * scaleFactor;
    var direction = q % 4; 
    var endX, endY;
    if (direction === 0) { endX = currentX + radius; endY = currentY + radius; }
    else if (direction === 1) { endX = currentX - radius; endY = currentY + radius; }
    else if (direction === 2) { endX = currentX - radius; endY = currentY - radius; }
    else { endX = currentX + radius; endY = currentY - radius; }

    if (q === 0) spiralPath += 'M ' + currentX + ' ' + currentY + ' ';
    spiralPath += 'A ' + radius + ' ' + radius + ' 0 0 1 ' + endX + ' ' + endY + ' ';
    currentX = endX; currentY = endY;
  }

  spiralHtml += '<path d="' + spiralPath + '" fill="none" stroke="var(--o)" stroke-width="1.5" opacity="0.6"/>';
  spiralHtml += '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="var(--o)"/><circle cx="' + cx + '" cy="' + cy + '" r="8" fill="none" stroke="var(--o)" stroke-width="0.7" opacity="0.3"/>';

  r.levels.forEach(function(lv) {
    var visualR = (lv.multiplier / maxMult) * maxVisualR;
    var isActive = lv.status === 'active';
    spiralHtml += '<text x="' + (cx + visualR + 3) + '" y="' + (cy + 3) + '" text-anchor="start" fill="' + (isActive ? 'var(--o)' : '#ccc') + '" font-size="5" font-family="Share Tech Mono" font-weight="bold">' + lv.label + '</text>';
  });

  spiralHtml += '</svg></div><div style="display:flex; justify-content:center; gap:12px; padding:8px 0 0;"><div style="display:flex; align-items:center; gap:3px;"><div style="width:12px; height:2px; background:var(--o); border-radius:1px;"></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc;">الحلزون الذهبي</span></div><div style="display:flex; align-items:center; gap:3px;"><div style="width:6px; height:6px; border-radius:50%; background:var(--o);"></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc;">نقطة الارتكاز</span></div></div></div>';
  document.getElementById('fs-spiral-panel').innerHTML = spiralHtml;

  var activeLevel = null, nextLevel = null;
  r.levels.forEach(function(lv) {
    if (lv.status === 'active' && !activeLevel) activeLevel = lv;
    if (lv.status === 'upcoming' && !nextLevel) nextLevel = lv;
  });

  var tblHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;"><span style="font-size:0.8rem; color:var(--o); font-weight:700;">مستويات الحلزون</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; letter-spacing:1px;">SPIRAL LEVELS</span></div><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; text-align:center;"><thead><tr style="border-bottom:1px solid #222;"><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">φ</th><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">مقاومة</th><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">دعم</th><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">الحالة</th></tr></thead><tbody>';

  r.levels.forEach(function(lv) {
    var isAct = lv.status === 'active';
    var isPassed = lv.status === 'passed';
    var rowBg = isAct ? 'rgba(255,106,0,0.06)' : 'transparent';
    tblHtml += '<tr style="border-bottom:1px solid #111; background:' + rowBg + ';"><td style="padding:7px 3px; font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:var(--o); font-weight:bold;">' + lv.label + '</td><td style="padding:7px 3px; font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + (isPassed ? '#aaa' : '#fff') + '; font-weight:bold;">$' + lv.priceUp.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</td><td style="padding:7px 3px; font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + (isPassed ? '#aaa' : 'var(--o)') + ';">$' + lv.priceDown.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</td><td style="padding:7px 3px;"><span style="font-size:0.5rem; padding:2px 5px; border-radius:6px; color:' + (isAct ? 'var(--o)' : isPassed ? '#aaa' : '#fff') + '; background:' + (isAct ? 'rgba(255,106,0,0.12)' : isPassed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)') + '; border:1px solid ' + (isAct ? 'rgba(255,106,0,0.25)' : '#1a1a1a') + ';">' + (isAct ? 'نشطة' : isPassed ? 'مرّت' : 'قادمة') + '</span></td></tr>';
  });

  tblHtml += '</tbody></table></div></div>';
  document.getElementById('fs-levels-panel').innerHTML = tblHtml;

  var swHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid var(--o);"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); letter-spacing:1px; margin-bottom:8px;">SWING POINT</div><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;"><div style="text-align:center;"><div style="font-size:0.55rem; color:#ccc; margin-bottom:2px;">النوع</div><div style="font-size:0.8rem; color:#fff; font-weight:700;">' + r.swing.type + '</div></div><div style="text-align:center;"><div style="font-size:0.55rem; color:#ccc; margin-bottom:2px;">السعر</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:var(--o); font-weight:bold;">$' + r.swing.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</div></div><div style="text-align:center;"><div style="font-size:0.55rem; color:#ccc; margin-bottom:2px;">التاريخ</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#ddd; font-weight:bold;">' + r.swing.date + '</div></div></div></div>';
  document.getElementById('fs-swing-panel').innerHTML = swHtml;

  var conc = 'نقطة الارتكاز المرجعية للموجة: ' + r.swing.type + ' عند $' + r.swing.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' بتاريخ (' + r.swing.date + '). ';
  conc += 'تم بناء الحلزون الذهبي هندسياً ليتوسع بنسبة φ = 1.618 من هذه النقطة. ';
  if (activeLevel) {
    conc += 'المستوى النشط حالياً: (φ × ' + activeLevel.label + ') يشكل مقاومة عند $' + activeLevel.priceUp.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ودعم عند $' + activeLevel.priceDown.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '. ';
  }
  if (nextLevel) {
    conc += 'المستوى الزمني القادم: (φ × ' + nextLevel.label + ') المتوقع تقاطعه بتاريخ ' + nextLevel.date + '. ';
  }
  conc += 'هذا تحليل فني متقدم ولا يُعتبر توصية شراء أو بيع.';
  document.getElementById('fs-conclusion').textContent = conc;
}

// ==========================================
// Multi-Scale Fractal — فراكتل متعدد المقاييس
// 3 أطر زمنية بالتوازي + كشف الكلاستر
// ==========================================

async function runMultiScaleFractal() {
  var coinInput = document.getElementById('msf-symbol').value.trim().toUpperCase();
  var btn = document.getElementById('msf-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING 3 TIMEFRAMES...';
  btn.disabled = true;

  try {
    var tfList = ['1h', '4h', '1d'];
    var responses = await Promise.all(
      tfList.map(function(tf) {
        return fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tf + '&limit=120').then(function(r) {
          if (!r.ok) throw new Error('فشل جلب ' + tf);
          return r.json();
        });
      })
    );

    var allData = {};
    tfList.forEach(function(tf, i) {
      allData[tf] = responses[i].map(function(k) {
        return { time: parseInt(k[0]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]) };
      });
    });

    var currentPrice = allData['1d'][allData['1d'].length - 1].c;
    var result = analyzeMultiScaleFractals(allData, currentPrice);

    renderMSFDashboard(symbol, currentPrice, result);
    document.getElementById('msf-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message || 'تعذر جلب البيانات. تأكد من صحة الرمز.');
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function analyzeMultiScaleFractals(allData, currentPrice) {
  var TF_LABELS = { '1h': '1H', '4h': '4H', '1d': '1D' };
  var allFractals = {};
  var tfList = ['1h', '4h', '1d'];

  tfList.forEach(function(tf) {
    var candles = allData[tf];
    var n = candles.length;
    var fractals = [];

    for (var i = 2; i < n - 2; i++) {
      if (candles[i].h > candles[i-1].h && candles[i].h > candles[i-2].h &&
          candles[i].h > candles[i+1].h && candles[i].h > candles[i+2].h) {
        var brokenUp = false;
        for (var j = i + 3; j < n; j++) {
          if (candles[j].h > candles[i].h) { brokenUp = true; break; }
        }
        fractals.push({ type: 'up', price: candles[i].h, status: brokenUp ? 'broken' : 'holding', tf: tf, idx: i });
      }

      if (candles[i].l < candles[i-1].l && candles[i].l < candles[i-2].l &&
          candles[i].l < candles[i+1].l && candles[i].l < candles[i+2].l) {
        var brokenDown = false;
        for (var k = i + 3; k < n; k++) {
          if (candles[k].l < candles[i].l) { brokenDown = true; break; }
        }
        fractals.push({ type: 'down', price: candles[i].l, status: brokenDown ? 'broken' : 'holding', tf: tf, idx: i });
      }
    }
    allFractals[tf] = fractals;
  });

  var confluences = [];
  var tolerance = 0.005; // 0.5%
  var holdingFractals = [];
  
  tfList.forEach(function(tf) {
    allFractals[tf].forEach(function(f) {
      if (f.status === 'holding') {
        holdingFractals.push(f);
      }
    });
  });

  var used = {};
  for (var a = 0; a < holdingFractals.length; a++) {
    if (used[a]) continue;
    var cluster = [holdingFractals[a]];
    var clusterTFs = [holdingFractals[a].tf];

    for (var b = a + 1; b < holdingFractals.length; b++) {
      if (used[b]) continue;
      if (holdingFractals[b].type !== holdingFractals[a].type) continue;
      if (clusterTFs.indexOf(holdingFractals[b].tf) >= 0) continue;
      
      var priceDiff = Math.abs(holdingFractals[b].price - holdingFractals[a].price) / holdingFractals[a].price;
      if (priceDiff <= tolerance) {
        cluster.push(holdingFractals[b]);
        clusterTFs.push(holdingFractals[b].tf);
        used[b] = true;
      }
    }

    if (cluster.length >= 2) {
      used[a] = true;
      var avgPrice = cluster.reduce(function(s, f) { return s + f.price; }, 0) / cluster.length;
      var type = cluster[0].type;
      var tfs = cluster.map(function(f) { return TF_LABELS[f.tf]; });
      var strength = cluster.length; 
      var distance = ((avgPrice - currentPrice) / currentPrice * 100).toFixed(2);
      var distLabel = parseFloat(distance) >= 0 ? '+' + distance + '%' : distance + '%';

      confluences.push({
        price: parseFloat(avgPrice.toFixed(8)),
        type: type,
        typeLabel: type === 'up' ? 'مقاومة' : 'دعم',
        tfs: tfs,
        strength: strength,
        strengthLabel: strength === 3 ? 'ثلاثي' : 'ثنائي',
        distance: distLabel,
        isAbove: avgPrice > currentPrice
      });
    }
  }

  confluences.sort(function(a, b) {
    return Math.abs(parseFloat(a.distance)) - Math.abs(parseFloat(b.distance));
  });

  var stats = { 
    total1h: allFractals['1h'].length, total4h: allFractals['4h'].length, total1d: allFractals['1d'].length,
    holding1h: allFractals['1h'].filter(function(f) { return f.status === 'holding'; }).length,
    holding4h: allFractals['4h'].filter(function(f) { return f.status === 'holding'; }).length,
    holding1d: allFractals['1d'].filter(function(f) { return f.status === 'holding'; }).length,
    tripleConf: confluences.filter(function(c) { return c.strength === 3; }).length,
    doubleConf: confluences.filter(function(c) { return c.strength === 2; }).length
  };

  var nearestRes = null, nearestSup = null;
  confluences.forEach(function(c) {
    if (c.isAbove && !nearestRes) nearestRes = c;
    if (!c.isAbove && !nearestSup) nearestSup = c;
  });

  return {
    allFractals: allFractals,
    confluences: confluences,
    stats: stats,
    nearestRes: nearestRes,
    nearestSup: nearestSup
  };
}

function renderMSFDashboard(symbol, price, result) {
  var r = result;
  var TF_COLORS = { '1h': '#ff6a00', '4h': '#ffffff', '1d': '#888888' };

  // محرك الفواصل العشرية الديناميكي
  var fmt = function(p) {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
  };

  var termHtml = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden;">';
  termHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#0a0a0a; border-bottom:1px solid #111;">';
  termHtml += '<div style="display:flex; align-items:center; gap:10px;">';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:var(--o); font-weight:bold;">' + symbol + '</span>';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff;">$' + fmt(price) + '</span></div>';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#333;">3-TF FRACTAL</span></div>';

  termHtml += '<div style="display:grid; grid-template-columns:1fr 1fr; border-top:1px solid #111;">';
  termHtml += '<div style="padding:14px; border-left:1px solid #111; text-align:center;">';
  termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444; letter-spacing:1px; margin-bottom:6px;">CLUSTER RESISTANCE</div>';
  if (r.nearestRes) {
    termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:#fff; font-weight:bold;">$' + fmt(r.nearestRes.price) + '</div>';
    termHtml += '<div style="display:flex; justify-content:center; gap:4px; margin-top:4px;">';
    r.nearestRes.tfs.forEach(function(tf) { termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; padding:1px 5px; border-radius:4px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#ccc;">' + tf + '</span>'; });
    termHtml += '</div>';
    termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; margin-top:4px;">' + r.nearestRes.distance + ' | ' + r.nearestRes.strengthLabel + '</div>';
  } else {
    termHtml += '<div style="font-size:0.7rem; color:#555;">لا كلاستر</div>';
  }
  termHtml += '</div>';
  termHtml += '<div style="padding:14px; text-align:center;">';
  termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444; letter-spacing:1px; margin-bottom:6px;">CLUSTER SUPPORT</div>';
  if (r.nearestSup) {
    termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:#ff6a00; font-weight:bold;">$' + fmt(r.nearestSup.price) + '</div>';
    termHtml += '<div style="display:flex; justify-content:center; gap:4px; margin-top:4px;">';
    r.nearestSup.tfs.forEach(function(tf) { termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; padding:1px 5px; border-radius:4px; background:rgba(255,106,0,0.08); border:1px solid rgba(255,106,0,0.2); color:#ff6a00;">' + tf + '</span>'; });
    termHtml += '</div>';
    termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ff6a00; margin-top:4px;">' + r.nearestSup.distance + ' | ' + r.nearestSup.strengthLabel + '</div>';
  } else {
    termHtml += '<div style="font-size:0.7rem; color:#555;">لا كلاستر</div>';
  }
  termHtml += '</div></div></div>';
  document.getElementById('msf-terminal').innerHTML = termHtml;

  var tlHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:16px;">';
  tlHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
  tlHtml += '<span style="font-size:0.8rem; color:var(--o); font-weight:700;">المحاور الثلاثة</span>';
  tlHtml += '<div style="display:flex; gap:10px;">';
  ['1h', '4h', '1d'].forEach(function(tf) {
    tlHtml += '<div style="display:flex; align-items:center; gap:4px;"><div style="width:6px; height:6px; border-radius:50%; background:' + TF_COLORS[tf] + ';"></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#888;">' + tf.toUpperCase() + '</span></div>';
  });
  tlHtml += '</div></div>';

  var allPrices = [price];
  ['1h', '4h', '1d'].forEach(function(tf) {
    r.allFractals[tf].forEach(function(f) { if (f.status === 'holding') allPrices.push(f.price); });
  });
  var minP = Math.min.apply(null, allPrices) * 0.995;
  var maxP = Math.max.apply(null, allPrices) * 1.005;
  var range = maxP - minP || 1;

  ['1h', '4h', '1d'].forEach(function(tf) {
    var color = TF_COLORS[tf];
    var holding = r.allFractals[tf].filter(function(f) { return f.status === 'holding'; });
    tlHtml += '<div style="margin-bottom:10px;">';
    tlHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;">';
    tlHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + color + '; font-weight:bold;">' + tf.toUpperCase() + '</span>';
    tlHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#333;">' + holding.length + ' صامد</span></div>';
    tlHtml += '<div style="position:relative; height:8px; background:#111; border-radius:4px;">';
    var pricePct = ((price - minP) / range) * 100;
    tlHtml += '<div style="position:absolute; left:' + Math.min(96, Math.max(2, pricePct)) + '%; top:50%; transform:translate(-50%,-50%); width:2px; height:14px; background:#ff6a00; opacity:0.3;"></div>';
    holding.forEach(function(f) {
      var pct = ((f.price - minP) / range) * 100;
      tlHtml += '<div style="position:absolute; left:' + Math.min(96, Math.max(2, pct)) + '%; top:50%; transform:translate(-50%,-50%); width:7px; height:7px; border-radius:50%; background:' + color + '; opacity:0.8;" title="$' + fmt(f.price) + '"></div>';
    });
    tlHtml += '</div></div>';
  });
  tlHtml += '</div>';
  document.getElementById('msf-timelines').innerHTML = tlHtml;

  var confHtml = '';
  if (r.confluences.length === 0) {
    confHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:20px; text-align:center; color:#555; font-size:0.8rem;">لم يتم رصد تطابقات فراكتلية بين الأطر الثلاثة.</div>';
  } else {
    confHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">';
    confHtml += '<span style="font-size:0.85rem; color:var(--o); font-weight:700;">الكلاسترات الفراكتلية</span>';
    confHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:var(--o); font-weight:bold;">' + r.confluences.length + '</span></div>';

    r.confluences.forEach(function(c) {
      var isTriple = c.strength === 3;
      var isRes = c.type === 'up';
      var borderColor = isTriple ? 'rgba(255,106,0,0.25)' : '#1a1a1a';
      var bgColor = isTriple ? 'rgba(255,106,0,0.06)' : '#0a0a0a';
      var rightBorder = isRes ? '#fff' : '#ff6a00';

      confHtml += '<div style="background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:10px; padding:14px; margin-bottom:8px; border-right:3px solid ' + rightBorder + ';">';
      confHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">';
      confHtml += '<div style="display:flex; align-items:center; gap:8px;">';
      confHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + (isRes ? '#fff' : '#ff6a00') + '; font-weight:bold;">$' + fmt(c.price) + '</span>';
      confHtml += '<span style="font-size:0.6rem; color:' + (isRes ? '#ccc' : '#ff6a00') + '; font-weight:600;">' + c.typeLabel + '</span></div>';
      confHtml += '<div style="display:flex; align-items:center; gap:6px;">';
      confHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + (isRes ? '#fff' : '#ff6a00') + ';">' + c.distance + '</span>';
      confHtml += '<div style="display:flex; gap:2px;">';
      for (var s = 1; s <= 3; s++) {
        confHtml += '<div style="width:12px; height:4px; border-radius:2px; background:' + (s <= c.strength ? '#ff6a00' : '#1a1a1a') + ';"></div>';
      }
      confHtml += '</div></div></div>';
      confHtml += '<div style="display:flex; gap:4px;">';
      c.tfs.forEach(function(tf) {
        var tfKey = tf.toLowerCase();
        var tc = TF_COLORS[tfKey] || '#888';
        confHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; padding:2px 6px; border-radius:6px; color:' + tc + '; background:' + tc + '12; border:1px solid ' + tc + '33; font-weight:bold;">' + tf + '</span>';
      });
      confHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; padding:2px 6px; border-radius:6px; color:' + (isTriple ? '#ff6a00' : '#888') + '; background:' + (isTriple ? 'rgba(255,106,0,0.08)' : 'rgba(80,80,80,0.1)') + '; border:1px solid ' + (isTriple ? 'rgba(255,106,0,0.2)' : '#1a1a1a') + '; font-weight:bold;">' + c.strengthLabel + '</span>';
      confHtml += '</div></div>';
    });
  }
  document.getElementById('msf-confluences').innerHTML = confHtml;

  var tblHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;">';
  tblHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">';
  tblHtml += '<span style="font-size:0.8rem; color:var(--o); font-weight:700;">إحصائيات الفراكتلات</span>';
  tblHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#333;">STATS</span></div>';

  tblHtml += '<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:14px;">';
  ['1h', '4h', '1d'].forEach(function(tf) {
    var color = TF_COLORS[tf];
    var totalKey = tf === '1h' ? 'total1h' : tf === '4h' ? 'total4h' : 'total1d';
    var holdKey = tf === '1h' ? 'holding1h' : tf === '4h' ? 'holding4h' : 'holding1d';
    tblHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px; text-align:center; border-top:2px solid ' + color + ';">';
    tblHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + color + '; font-weight:bold;">' + tf.toUpperCase() + '</div>';
    tblHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:#fff; font-weight:bold; margin:4px 0;">' + r.stats[holdKey] + '</div>';
    tblHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#555;">صامد من ' + r.stats[totalKey] + '</div></div>';
  });
  tblHtml += '</div>';

  tblHtml += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">';
  tblHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px; text-align:center;">';
  tblHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); margin-bottom:4px;">TRIPLE CLUSTER</div>';
  tblHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.3rem; color:#ff6a00; font-weight:bold;">' + r.stats.tripleConf + '</div></div>';
  tblHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px; text-align:center;">';
  tblHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); margin-bottom:4px;">DOUBLE CLUSTER</div>';
  tblHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.3rem; color:#fff; font-weight:bold;">' + r.stats.doubleConf + '</div></div>';
  tblHtml += '</div></div>';

  document.getElementById('msf-table-wrap').innerHTML = tblHtml;

  var conc = 'تم مسح فراكتلات 3 أطر زمنية (1H: ' + r.stats.holding1h + ' صامد, 4H: ' + r.stats.holding4h + ', 1D: ' + r.stats.holding1d + '). ';
  conc += 'تم اكتشاف ' + r.confluences.length + ' كلاستر فراكتلي';
  if (r.stats.tripleConf > 0) conc += ' منها ' + r.stats.tripleConf + ' ثلاثي (الأقوى)';
  conc += '. ';

  if (r.nearestRes) conc += 'أقرب كلاستر مقاومة عند $' + fmt(r.nearestRes.price) + ' (' + r.nearestRes.distance + ' — ' + r.nearestRes.strengthLabel + '). ';
  if (r.nearestSup) conc += 'أقرب كلاستر دعم عند $' + fmt(r.nearestSup.price) + ' (' + r.nearestSup.distance + ' — ' + r.nearestSup.strengthLabel + '). ';

  if (r.stats.tripleConf > 0) conc += 'الكلاسترات الثلاثية تمثل مستويات مؤسسية ثقيلة. ';
  conc += 'هذا تحليل فني ولا يُعتبر توصية شراء أو بيع.';

  document.getElementById('msf-conclusion').textContent = conc;
}

// ==========================================
// Triangle Breakout Predictor — Bulkowski
// ==========================================

var TRIANGLE_STATS = {
  ascending: {
    typeAr: 'مثلث صاعد', typeEn: 'Ascending Triangle',
    avgRise: '47%', avgDecline: '16%', failRate: '7%',
    breakUpPct: 64, breakDownPct: 36, pullbackRate: '57%', avgDays: '23 شمعة'
  },
  descending: {
    typeAr: 'مثلث هابط', typeEn: 'Descending Triangle',
    avgRise: '47%', avgDecline: '16%', failRate: '7%',
    breakUpPct: 47, breakDownPct: 53, pullbackRate: '54%', avgDays: '25 شمعة'
  },
  symmetrical: {
    typeAr: 'مثلث متماثل', typeEn: 'Symmetrical Triangle',
    avgRise: '31%', avgDecline: '17%', failRate: '9%',
    breakUpPct: 54, breakDownPct: 46, pullbackRate: '59%', avgDays: '21 شمعة'
  }
};

async function runTrianglePredictor() {
  var coinInput = document.getElementById('tri-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('tri-tf').value;
  var btn = document.getElementById('tri-btn');

  if (!coinInput) return;
  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING TRIANGLES...';
  btn.disabled = true;

  try {
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات.');
    var raw = await res.json();
    if (raw.length < 50) throw new Error('بيانات غير كافية.');

    var candles = raw.map(function(k) {
      return { h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) };
    });

    var closes = candles.map(function(c) { return c.c; });
    var highs = candles.map(function(c) { return c.h; });
    var lows = candles.map(function(c) { return c.l; });
    var volumes = candles.map(function(c) { return c.v; });
    var price = closes[closes.length - 1];

    var result = detectTriangle(highs, lows, closes, volumes, price);
    renderTriangleDashboard(symbol, price, tfInput.toUpperCase(), closes, volumes, result);
    document.getElementById('tri-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function detectTriangle(highs, lows, closes, volumes, price) {
  var n = closes.length;
  var peakIdxs = findPeaks(highs, 0, n);
  var troughIdxs = findTroughs(lows, 0, n);

  var recentPeaks = peakIdxs.slice(-5);
  var recentTroughs = troughIdxs.slice(-5);

  if (recentPeaks.length < 2 || recentTroughs.length < 2) {
    return { found: false, message: 'لا توجد قمم وقيعان كافية لتشكيل مثلث.' };
  }

  var topLine = fitTrendline(recentPeaks, highs);
  var botLine = fitTrendline(recentTroughs, lows);

  var topSlope = topLine.slope;
  var botSlope = botLine.slope;

  var isConverging = (topSlope < botSlope) || (Math.abs(topSlope) < 0.0001 && botSlope > 0) || (Math.abs(botSlope) < 0.0001 && topSlope < 0);
  if (!isConverging) return { found: false, message: 'لا يوجد مثلث يتشكّل حالياً — الخطوط غير متقاربة.' };

  var type = 'symmetrical';
  var flatThreshold = 0.15; 
  var topRange = Math.abs(highs[recentPeaks[recentPeaks.length - 1]] - highs[recentPeaks[0]]) / highs[recentPeaks[0]] * 100;
  var botRange = Math.abs(lows[recentTroughs[recentTroughs.length - 1]] - lows[recentTroughs[0]]) / lows[recentTroughs[0]] * 100;

  if (topRange < flatThreshold && botSlope > 0) type = 'ascending';
  else if (botRange < flatThreshold && topSlope < 0) type = 'descending';

  var stats = TRIANGLE_STATS[type];
  var resistanceLevel = type === 'ascending' ? Math.max.apply(null, recentPeaks.map(function(i) { return highs[i]; })) : null;
  var supportLevel = type === 'descending' ? Math.min.apply(null, recentTroughs.map(function(i) { return lows[i]; })) : null;

  var peakPoints = recentPeaks.map(function(i) { return { idx: i, price: highs[i] }; });
  var troughPoints = recentTroughs.map(function(i) { return { idx: i, price: lows[i] }; });

  var apexIdx = 0;
  if (Math.abs(topSlope - botSlope) > 0.0001) {
    apexIdx = Math.round((botLine.intercept - topLine.intercept) / (topSlope - botSlope));
  }
  var firstSwingIdx = Math.min(recentPeaks[0], recentTroughs[0]);
  var totalWidth = Math.max(apexIdx - firstSwingIdx, 1);
  var currentProgress = n - 1 - firstSwingIdx;
  var completion = Math.min(Math.round((currentProgress / totalWidth) * 100), 95);

  var breakoutDir = stats.breakUpPct > 50 ? 'up' : 'down';
  var patternHeight = 0;

  if (type === 'ascending') {
    patternHeight = resistanceLevel - Math.min.apply(null, troughPoints.map(function(p) { return p.price; }));
  } else if (type === 'descending') {
    patternHeight = Math.max.apply(null, peakPoints.map(function(p) { return p.price; })) - supportLevel;
  } else {
    patternHeight = Math.max.apply(null, peakPoints.map(function(p) { return p.price; })) - Math.min.apply(null, troughPoints.map(function(p) { return p.price; }));
  }

  var breakoutPrice = type === 'ascending' ? resistanceLevel : type === 'descending' ? supportLevel : price;
  // إزالة Math.round للحفاظ على الكسور العشرية الدقيقة
  var target = breakoutDir === 'up' ? breakoutPrice + patternHeight : breakoutPrice - patternHeight;
  var targetPct = ((target - price) / price * 100).toFixed(2);

  return {
    found: true, type: type, stats: stats, breakoutDir: breakoutDir, completion: completion,
    resistanceLevel: resistanceLevel, supportLevel: supportLevel, peakPoints: peakPoints,
    troughPoints: troughPoints, topLine: topLine, botLine: botLine, patternHeight: patternHeight,
    target: parseFloat(target.toFixed(8)), targetPct: (parseFloat(targetPct) >= 0 ? '+' : '') + targetPct + '%', apexIdx: apexIdx
  };
}

function fitTrendline(indices, values) {
  var n = indices.length;
  if (n < 2) return { slope: 0, intercept: values[indices[0]] || 0 };
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (var i = 0; i < n; i++) {
    var x = indices[i], y = values[indices[i]];
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  var denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 0.0001) return { slope: 0, intercept: sumY / n };
  var slope = (n * sumXY - sumX * sumY) / denom;
  var intercept = (sumY - slope * sumX) / n;
  return { slope: slope, intercept: intercept };
}

function renderTriangleDashboard(symbol, price, tf, closes, volumes, result) {
  if (!result.found) {
    document.getElementById('tri-pattern-card').innerHTML = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:30px; text-align:center; margin-bottom:16px; color:#ccc; font-size:0.85rem;">' + result.message + '</div>';
    document.getElementById('tri-stats-card').innerHTML = '';
    document.getElementById('tri-measure-card').innerHTML = '';
    document.getElementById('tri-conclusion').textContent = result.message + ' جرّب إطار زمني أو عملة مختلفة.';
    return;
  }

  var fmt = function(p) {
    if(p >= 1000) return p.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if(p >= 1) return p.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 4});
    return p.toLocaleString('en-US', {minimumFractionDigits: 4, maximumFractionDigits: 8});
  };

  var r = result;
  var st = r.stats;
  var isBullish = r.breakoutDir === 'up';
  var dirColor = isBullish ? '#fff' : '#ff6a00';
  var n = closes.length;

  var chartStart = Math.max(0, (r.peakPoints[0] ? r.peakPoints[0].idx : 0) - 5);
  var chartEnd = n - 1;
  var chartCloses = closes.slice(chartStart, chartEnd + 1);
  var chartVols = volumes.slice(chartStart, chartEnd + 1);

  var allP = chartCloses.slice();
  r.peakPoints.forEach(function(p) { allP.push(p.price); });
  r.troughPoints.forEach(function(p) { allP.push(p.price); });
  if (r.target) allP.push(r.target);

  var minP = Math.min.apply(null, allP) * 0.996;
  var maxP = Math.max.apply(null, allP) * 1.004;
  var range = maxP - minP || 1;
  var svgW = 340, chartH = 160, volH = 40, svgH = chartH + volH + 10;
  var toX = function(idx) { return ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 30) + 15; };
  var toY = function(pr) { return 10 + (1 - (pr - minP) / range) * (chartH - 20); };
  var maxVol = Math.max.apply(null, chartVols);

  var html = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden; margin-bottom:16px; border-top:2px solid ' + dirColor + ';">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#0a0a0a; border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:' + dirColor + '; font-weight:bold;">' + st.typeEn + '</div>';
  html += '<div style="font-size:0.65rem; color:#ccc;">' + st.typeAr + ' — كسر متوقع ' + (isBullish ? 'صعودي' : 'هبوطي') + '</div></div>';
  html += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:' + dirColor + '; font-weight:bold;">' + r.completion + '%</div>';
  html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#ccc; letter-spacing:1px;">COMPLETE</div></div></div>';

  html += '<div style="padding:6px 4px 0; background:#020208;">';
  html += '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  html += '<defs><linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + dirColor + '" stop-opacity="0.08"/><stop offset="100%" stop-color="' + dirColor + '" stop-opacity="0.01"/></linearGradient>';
  html += '<linearGradient id="vGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6a00" stop-opacity="0.6"/><stop offset="100%" stop-color="#ff6a00" stop-opacity="0.1"/></linearGradient></defs>';

  for (var gi = 1; gi <= 3; gi++) {
    html += '<line x1="0" y1="' + (gi * chartH / 4) + '" x2="' + svgW + '" y2="' + (gi * chartH / 4) + '" stroke="#0a0a0a" stroke-width="0.5"/>';
  }

  var polyStr = '';
  for (var ci = 0; ci < chartCloses.length; ci++) { polyStr += toX(chartStart + ci) + ',' + toY(chartCloses[ci]) + ' '; }
  html += '<polyline points="' + polyStr.trim() + '" fill="none" stroke="#555" stroke-width="1.5" stroke-linejoin="round"/>';

  var firstIdx = Math.min(r.peakPoints.length > 0 ? r.peakPoints[0].idx : n, r.troughPoints.length > 0 ? r.troughPoints[0].idx : n);
  var lastIdx = chartEnd;

  var topY1 = toY(r.topLine.intercept + r.topLine.slope * firstIdx);
  var topY2 = toY(r.topLine.intercept + r.topLine.slope * (lastIdx + 10));
  html += '<line x1="' + toX(firstIdx) + '" y1="' + topY1 + '" x2="' + toX(lastIdx + 10) + '" y2="' + topY2 + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 3"/>';

  var botY1 = toY(r.botLine.intercept + r.botLine.slope * firstIdx);
  var botY2 = toY(r.botLine.intercept + r.botLine.slope * (lastIdx + 10));
  html += '<line x1="' + toX(firstIdx) + '" y1="' + botY1 + '" x2="' + toX(lastIdx + 10) + '" y2="' + botY2 + '" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="6 3"/>';

  html += '<polygon points="' + toX(firstIdx) + ',' + topY1 + ' ' + toX(lastIdx) + ',' + toY(r.topLine.intercept + r.topLine.slope * lastIdx) + ' ' + toX(lastIdx) + ',' + toY(r.botLine.intercept + r.botLine.slope * lastIdx) + ' ' + toX(firstIdx) + ',' + botY1 + '" fill="url(#tGrad)"/>';

  r.peakPoints.forEach(function(p) { html += '<circle cx="' + toX(p.idx) + '" cy="' + toY(p.price) + '" r="3.5" fill="#fff"/>'; });
  r.troughPoints.forEach(function(p) {
    html += '<circle cx="' + toX(p.idx) + '" cy="' + toY(p.price) + '" r="4" fill="#ff6a00"/>';
    html += '<text x="' + toX(p.idx) + '" y="' + (toY(p.price) + 12) + '" text-anchor="middle" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">$' + fmt(p.price) + '</text>';
  });

  var arrowX = toX(lastIdx) + 15;
  var arrowBaseY = toY(r.topLine.intercept + r.topLine.slope * lastIdx);
  if (isBullish) {
    html += '<line x1="' + arrowX + '" y1="' + arrowBaseY + '" x2="' + arrowX + '" y2="' + (arrowBaseY - 25) + '" stroke="#fff" stroke-width="2"/>';
    html += '<polygon points="' + arrowX + ',' + (arrowBaseY - 30) + ' ' + (arrowX - 5) + ',' + (arrowBaseY - 20) + ' ' + (arrowX + 5) + ',' + (arrowBaseY - 20) + '" fill="#fff"/>';
  } else {
    var arrowBotY = toY(r.botLine.intercept + r.botLine.slope * lastIdx);
    html += '<line x1="' + arrowX + '" y1="' + arrowBotY + '" x2="' + arrowX + '" y2="' + (arrowBotY + 25) + '" stroke="#ff6a00" stroke-width="2"/>';
    html += '<polygon points="' + arrowX + ',' + (arrowBotY + 30) + ' ' + (arrowX - 5) + ',' + (arrowBotY + 20) + ' ' + (arrowX + 5) + ',' + (arrowBotY + 20) + '" fill="#ff6a00"/>';
  }

  if (r.target) {
    var tgtY = toY(r.target);
    if (tgtY > 5 && tgtY < chartH) {
      html += '<line x1="' + toX(lastIdx - 5) + '" y1="' + tgtY + '" x2="' + (svgW - 5) + '" y2="' + tgtY + '" stroke="' + dirColor + '" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.4"/>';
      html += '<rect x="' + (svgW - 62) + '" y="' + (tgtY - 12) + '" width="58" height="11" rx="2" fill="#000" fill-opacity="0.9"/>';
      html += '<text x="' + (svgW - 33) + '" y="' + (tgtY - 3.5) + '" text-anchor="middle" fill="' + dirColor + '" font-size="6" font-family="Share Tech Mono" font-weight="bold">T $' + fmt(r.target) + '</text>';
    }
  }

  html += '<circle cx="' + toX(chartEnd) + '" cy="' + toY(price) + '" r="4" fill="#ff6a00"/>';

  for (var vi = 0; vi < chartVols.length; vi++) {
    var barH = (chartVols[vi] / maxVol) * (volH - 5);
    var barY = chartH + volH - barH + 5;
    html += '<rect x="' + (toX(chartStart + vi) - 4) + '" y="' + barY + '" width="8" height="' + barH + '" rx="1" fill="url(#vGrad2)" opacity="0.5"/>';
  }

  html += '<line x1="0" y1="' + (chartH + 3) + '" x2="' + svgW + '" y2="' + (chartH + 3) + '" stroke="#1a1a1a" stroke-width="0.5"/>';
  html += '<text x="8" y="' + (chartH + 14) + '" fill="#ccc" font-size="5" font-family="Share Tech Mono">VOL</text>';
  html += '</svg></div>';

  html += '<div style="display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid #111;">';
  var infoItems = [
    { label: 'PAIR', value: symbol, color: '#ff6a00' },
    { label: 'PRICE', value: '$' + fmt(price), color: '#fff' },
    { label: 'TYPE', value: st.typeEn.split(' ')[0], color: dirColor },
    { label: 'BREAK', value: isBullish ? 'BULLISH' : 'BEARISH', color: dirColor }
  ];
  infoItems.forEach(function(item, i) {
    html += '<div style="padding:8px 4px; text-align:center; border-left:' + (i > 0 ? '1px solid #111' : 'none') + ';">';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#ccc; letter-spacing:1px; margin-bottom:2px;">' + item.label + '</div>';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + item.color + '; font-weight:bold;">' + item.value + '</div></div>';
  });
  html += '</div></div>';
  document.getElementById('tri-pattern-card').innerHTML = html;

  var stHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;">';
  stHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
  stHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Bulkowski Statistics</span>';
  stHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc;">38,500+ SAMPLES</span></div>';

  stHtml += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:10px;">';
  var statItems = [
    { label: 'AVG RISE', value: st.avgRise, color: '#fff' },
    { label: 'FAIL RATE', value: st.failRate, color: '#ff6a00' },
    { label: 'PULLBACK', value: st.pullbackRate, color: '#ccc' }
  ];
  statItems.forEach(function(s) {
    stHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px; text-align:center;">';
    stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; color:#ccc; letter-spacing:1px; margin-bottom:4px;">' + s.label + '</div>';
    stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + s.color + '; font-weight:bold;">' + s.value + '</div></div>';
  });
  stHtml += '</div>';

  stHtml += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">';
  stHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px;">';
  stHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="font-size:0.6rem; color:#ccc;">كسر صعودي</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#fff; font-weight:bold;">' + st.breakUpPct + '%</span></div>';
  stHtml += '<div style="display:flex; height:5px; border-radius:3px; overflow:hidden;"><div style="width:' + st.breakUpPct + '%; background:#fff;"></div><div style="width:' + st.breakDownPct + '%; background:#ff6a00;"></div></div>';
  stHtml += '<div style="display:flex; justify-content:space-between; margin-top:4px;"><span style="font-size:0.5rem; color:#ccc;">كسر هبوطي</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ff6a00;">' + st.breakDownPct + '%</span></div></div>';
  stHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px; text-align:center;">';
  stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; color:#ccc; letter-spacing:1px; margin-bottom:4px;">TARGET</div>';
  stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + dirColor + '; font-weight:bold;">$' + fmt(r.target) + '</div>';
  stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:' + dirColor + '; margin-top:2px;">' + r.targetPct + '</div></div>';
  stHtml += '</div></div>';
  document.getElementById('tri-stats-card').innerHTML = stHtml;

  var lowestTrough = Math.min.apply(null, r.troughPoints.map(function(p) { return p.price; }));
  var highestPeak = Math.max.apply(null, r.peakPoints.map(function(p) { return p.price; }));

  var mrHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid #ff6a00;">';
  mrHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ff6a00; letter-spacing:1px; margin-bottom:8px;">MEASURE RULE</div>';
  mrHtml += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">';
  mrHtml += '<div style="text-align:center;"><div style="font-size:0.5rem; color:#ccc; margin-bottom:2px;">أعلى قمة</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:#fff; font-weight:bold;">$' + fmt(highestPeak) + '</div></div>';
  mrHtml += '<div style="text-align:center;"><div style="font-size:0.5rem; color:#ccc; margin-bottom:2px;">أدنى قاع</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:#ff6a00; font-weight:bold;">$' + fmt(lowestTrough) + '</div></div>';
  mrHtml += '<div style="text-align:center;"><div style="font-size:0.5rem; color:#ccc; margin-bottom:2px;">الهدف</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:' + dirColor + '; font-weight:bold;">$' + fmt(r.target) + '</div></div>';
  mrHtml += '</div>';
  mrHtml += '<div style="font-size:0.55rem; color:#ccc; text-align:center; margin-top:8px; font-family:\'Share Tech Mono\',monospace;">الهدف = نقطة الكسر ' + (isBullish ? '+' : '-') + ' ارتفاع المثلث ($' + fmt(r.patternHeight) + ')</div></div>';
  document.getElementById('tri-measure-card').innerHTML = mrHtml;

  var conc = 'تم اكتشاف ' + st.typeAr + ' (' + st.typeEn + ') مكتمل بنسبة ' + r.completion + '%. ';
  if (r.type === 'ascending') conc += 'مقاومة أفقية مع قيعان صاعدة — ضغط شرائي متزايد. ';
  else if (r.type === 'descending') conc += 'دعم أفقي مع قمم هابطة — ضغط بيعي متزايد. ';
  else conc += 'قمم هابطة وقيعان صاعدة — تردد بين القوتين. ';
  conc += 'إحصائيات Bulkowski: متوسط ' + (isBullish ? 'الصعود' : 'الهبوط') + ' ' + (isBullish ? st.avgRise : st.avgDecline) + ' مع نسبة فشل ' + st.failRate + '. ';
  conc += 'الكسر ' + (isBullish ? 'الصعودي' : 'الهبوطي') + ' أكثر احتمالاً (' + (isBullish ? st.breakUpPct : st.breakDownPct) + '%). ';
  conc += 'الهدف: $' + fmt(r.target) + ' (' + r.targetPct + '). ';
  conc += 'تحذير: Pullback في ' + st.pullbackRate + ' من الحالات. ';
  conc += 'هذا تحليل فني ولا يُعتبر توصية شراء أو بيع.';
  document.getElementById('tri-conclusion').textContent = conc;
}
// ==========================================
// Triangle Breakout Predictor — Adam Theory
// ==========================================

var TRIANGLE_STATS = {
  ascending: {
    typeAr: 'مثلث صاعد', typeEn: 'Ascending Triangle',
    avgRise: '47%', avgDecline: '16%', failRate: '7%',
    breakUpPct: 64, breakDownPct: 36, pullbackRate: '57%', avgDays: '23 شمعة'
  },
  descending: {
    typeAr: 'مثلث هابط', typeEn: 'Descending Triangle',
    avgRise: '47%', avgDecline: '16%', failRate: '7%',
    breakUpPct: 47, breakDownPct: 53, pullbackRate: '54%', avgDays: '25 شمعة'
  },
  symmetrical: {
    typeAr: 'مثلث متماثل', typeEn: 'Symmetrical Triangle',
    avgRise: '31%', avgDecline: '17%', failRate: '9%',
    breakUpPct: 54, breakDownPct: 46, pullbackRate: '59%', avgDays: '21 شمعة'
  }
};

async function runTrianglePredictor() {
  var coinInput = document.getElementById('tri-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('tri-tf').value;
  var btn = document.getElementById('tri-btn');

  if (!coinInput) return;
  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING TRIANGLES...';
  btn.disabled = true;

  try {
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات.');
    var raw = await res.json();
    if (raw.length < 50) throw new Error('بيانات غير كافية.');

    var candles = raw.map(function(k) {
      return { h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) };
    });

    var closes = candles.map(function(c) { return c.c; });
    var highs = candles.map(function(c) { return c.h; });
    var lows = candles.map(function(c) { return c.l; });
    var volumes = candles.map(function(c) { return c.v; });
    var price = closes[closes.length - 1];

    var result = detectTriangle(highs, lows, closes, volumes, price);
    renderTriangleDashboard(symbol, price, tfInput.toUpperCase(), closes, volumes, result);
    document.getElementById('tri-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function detectTriangle(highs, lows, closes, volumes, price) {
  var n = closes.length;
  var peakIdxs = findPeaks(highs, 0, n);
  var troughIdxs = findTroughs(lows, 0, n);

  var recentPeaks = peakIdxs.slice(-5);
  var recentTroughs = troughIdxs.slice(-5);

  if (recentPeaks.length < 2 || recentTroughs.length < 2) {
    return { found: false, message: 'لا توجد قمم وقيعان كافية لتشكيل مثلث.' };
  }

  var topLine = fitTrendline(recentPeaks, highs);
  var botLine = fitTrendline(recentTroughs, lows);

  var topSlope = topLine.slope;
  var botSlope = botLine.slope;

  var isConverging = (topSlope < botSlope) || (Math.abs(topSlope) < 0.0001 && botSlope > 0) || (Math.abs(botSlope) < 0.0001 && topSlope < 0);
  if (!isConverging) return { found: false, message: 'لا يوجد مثلث يتشكّل حالياً — الخطوط غير متقاربة.' };

  var type = 'symmetrical';
  var flatThreshold = 2.5; 

  var topMax = Math.max.apply(null, recentPeaks.map(function(i) { return highs[i]; }));
  var topMin = Math.min.apply(null, recentPeaks.map(function(i) { return highs[i]; }));
  var topRange = ((topMax - topMin) / topMin) * 100;

  var botMax = Math.max.apply(null, recentTroughs.map(function(i) { return lows[i]; }));
  var botMin = Math.min.apply(null, recentTroughs.map(function(i) { return lows[i]; }));
  var botRange = ((botMax - botMin) / botMin) * 100;

  var isTopFlat = topRange < flatThreshold || Math.abs(topSlope) < Math.abs(botSlope) * 0.25;
  var isBotFlat = botRange < flatThreshold || Math.abs(botSlope) < Math.abs(topSlope) * 0.25;

  if (isTopFlat && botSlope > 0) type = 'ascending';
  else if (isBotFlat && topSlope < 0) type = 'descending';

  var stats = TRIANGLE_STATS[type];
  var resistanceLevel = type === 'ascending' ? Math.max.apply(null, recentPeaks.map(function(i) { return highs[i]; })) : null;
  var supportLevel = type === 'descending' ? Math.min.apply(null, recentTroughs.map(function(i) { return lows[i]; })) : null;

  var peakPoints = recentPeaks.map(function(i) { return { idx: i, price: highs[i] }; });
  var troughPoints = recentTroughs.map(function(i) { return { idx: i, price: lows[i] }; });

  var apexIdx = 0;
  if (Math.abs(topSlope - botSlope) > 0.0001) {
    apexIdx = Math.round((botLine.intercept - topLine.intercept) / (topSlope - botSlope));
  }
  var firstSwingIdx = Math.min(recentPeaks[0], recentTroughs[0]);
  var totalWidth = Math.max(apexIdx - firstSwingIdx, 1);
  var currentProgress = n - 1 - firstSwingIdx;
  var completion = Math.min(Math.round((currentProgress / totalWidth) * 100), 95);

  var breakoutDir = stats.breakUpPct > 50 ? 'up' : 'down';
  var patternHeight = 0;

  if (type === 'ascending') {
    patternHeight = resistanceLevel - Math.min.apply(null, troughPoints.map(function(p) { return p.price; }));
  } else if (type === 'descending') {
    patternHeight = Math.max.apply(null, peakPoints.map(function(p) { return p.price; })) - supportLevel;
  } else {
    patternHeight = Math.max.apply(null, peakPoints.map(function(p) { return p.price; })) - Math.min.apply(null, troughPoints.map(function(p) { return p.price; }));
  }

  var breakoutPrice = type === 'ascending' ? resistanceLevel : type === 'descending' ? supportLevel : price;
  var target = breakoutDir === 'up' ? breakoutPrice + patternHeight : breakoutPrice - patternHeight;
  var targetPct = ((target - price) / price * 100).toFixed(2);

  return {
    found: true, type: type, stats: stats, breakoutDir: breakoutDir, completion: completion,
    resistanceLevel: resistanceLevel, supportLevel: supportLevel, peakPoints: peakPoints,
    troughPoints: troughPoints, topLine: topLine, botLine: botLine, patternHeight: patternHeight,
    target: parseFloat(target.toFixed(8)), targetPct: (parseFloat(targetPct) >= 0 ? '+' : '') + targetPct + '%', apexIdx: apexIdx
  };
}

function fitTrendline(indices, values) {
  var n = indices.length;
  if (n < 2) return { slope: 0, intercept: values[indices[0]] || 0 };
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (var i = 0; i < n; i++) {
    var x = indices[i], y = values[indices[i]];
    sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
  }
  var denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 0.0001) return { slope: 0, intercept: sumY / n };
  var slope = (n * sumXY - sumX * sumY) / denom;
  var intercept = (sumY - slope * sumX) / n;
  return { slope: slope, intercept: intercept };
}

function renderTriangleDashboard(symbol, price, tf, closes, volumes, result) {
  if (!result.found) {
    document.getElementById('tri-pattern-card').innerHTML = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:30px; text-align:center; margin-bottom:16px; color:#ccc; font-size:0.85rem;">' + result.message + '</div>';
    document.getElementById('tri-stats-card').innerHTML = '';
    document.getElementById('tri-measure-card').innerHTML = '';
    document.getElementById('tri-conclusion').textContent = result.message + ' جرّب إطار زمني أو عملة مختلفة.';
    return;
  }

  var fmt = function(p) {
    if(p >= 1000) return p.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if(p >= 1) return p.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 4});
    return p.toLocaleString('en-US', {minimumFractionDigits: 4, maximumFractionDigits: 8});
  };

  var r = result;
  var st = r.stats;
  var isBullish = r.breakoutDir === 'up';
  var dirColor = isBullish ? '#fff' : '#ff6a00';
  var n = closes.length;

  var chartStart = Math.max(0, (r.peakPoints[0] ? r.peakPoints[0].idx : 0) - 5);
  var chartEnd = n - 1;
  var chartCloses = closes.slice(chartStart, chartEnd + 1);
  var chartVols = volumes.slice(chartStart, chartEnd + 1);

  var allP = chartCloses.slice();
  r.peakPoints.forEach(function(p) { allP.push(p.price); });
  r.troughPoints.forEach(function(p) { allP.push(p.price); });
  if (r.target) allP.push(r.target);

  var minP = Math.min.apply(null, allP) * 0.996;
  var maxP = Math.max.apply(null, allP) * 1.004;
  var range = maxP - minP || 1;
  var svgW = 340, chartH = 160, volH = 40, svgH = chartH + volH + 10;
  var toX = function(idx) { return ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 30) + 15; };
  var toY = function(pr) { return 10 + (1 - (pr - minP) / range) * (chartH - 20); };
  var maxVol = Math.max.apply(null, chartVols);

  var html = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden; margin-bottom:16px; border-top:2px solid ' + dirColor + ';">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#0a0a0a; border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:' + dirColor + '; font-weight:bold;">' + st.typeEn + '</div>';
  html += '<div style="font-size:0.65rem; color:#ccc;">' + st.typeAr + ' — كسر متوقع ' + (isBullish ? 'صعودي' : 'هبوطي') + '</div></div>';
  html += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:' + dirColor + '; font-weight:bold;">' + r.completion + '%</div>';
  html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#ccc; letter-spacing:1px;">COMPLETE</div></div></div>';

  html += '<div style="padding:6px 4px 0; background:#020208;">';
  html += '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  html += '<defs><linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + dirColor + '" stop-opacity="0.08"/><stop offset="100%" stop-color="' + dirColor + '" stop-opacity="0.01"/></linearGradient>';
  html += '<linearGradient id="vGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6a00" stop-opacity="0.6"/><stop offset="100%" stop-color="#ff6a00" stop-opacity="0.1"/></linearGradient></defs>';

  for (var gi = 1; gi <= 3; gi++) {
    html += '<line x1="0" y1="' + (gi * chartH / 4) + '" x2="' + svgW + '" y2="' + (gi * chartH / 4) + '" stroke="#0a0a0a" stroke-width="0.5"/>';
  }

  var polyStr = '';
  for (var ci = 0; ci < chartCloses.length; ci++) { polyStr += toX(chartStart + ci) + ',' + toY(chartCloses[ci]) + ' '; }
  html += '<polyline points="' + polyStr.trim() + '" fill="none" stroke="#555" stroke-width="1.5" stroke-linejoin="round"/>';

  var firstIdx = Math.min(r.peakPoints.length > 0 ? r.peakPoints[0].idx : n, r.troughPoints.length > 0 ? r.troughPoints[0].idx : n);
  var lastIdx = chartEnd;

  var topY1 = toY(r.topLine.intercept + r.topLine.slope * firstIdx);
  var topY2 = toY(r.topLine.intercept + r.topLine.slope * (lastIdx + 10));
  html += '<line x1="' + toX(firstIdx) + '" y1="' + topY1 + '" x2="' + toX(lastIdx + 10) + '" y2="' + topY2 + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 3"/>';

  var botY1 = toY(r.botLine.intercept + r.botLine.slope * firstIdx);
  var botY2 = toY(r.botLine.intercept + r.botLine.slope * (lastIdx + 10));
  html += '<line x1="' + toX(firstIdx) + '" y1="' + botY1 + '" x2="' + toX(lastIdx + 10) + '" y2="' + botY2 + '" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="6 3"/>';

  html += '<polygon points="' + toX(firstIdx) + ',' + topY1 + ' ' + toX(lastIdx) + ',' + toY(r.topLine.intercept + r.topLine.slope * lastIdx) + ' ' + toX(lastIdx) + ',' + toY(r.botLine.intercept + r.botLine.slope * lastIdx) + ' ' + toX(firstIdx) + ',' + botY1 + '" fill="url(#tGrad)"/>';

  r.peakPoints.forEach(function(p) { html += '<circle cx="' + toX(p.idx) + '" cy="' + toY(p.price) + '" r="3.5" fill="#fff"/>'; });
  r.troughPoints.forEach(function(p) {
    html += '<circle cx="' + toX(p.idx) + '" cy="' + toY(p.price) + '" r="4" fill="#ff6a00"/>';
    html += '<text x="' + toX(p.idx) + '" y="' + (toY(p.price) + 12) + '" text-anchor="middle" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">$' + fmt(p.price) + '</text>';
  });

  var arrowX = toX(lastIdx) + 15;
  var arrowBaseY = toY(r.topLine.intercept + r.topLine.slope * lastIdx);
  if (isBullish) {
    html += '<line x1="' + arrowX + '" y1="' + arrowBaseY + '" x2="' + arrowX + '" y2="' + (arrowBaseY - 25) + '" stroke="#fff" stroke-width="2"/>';
    html += '<polygon points="' + arrowX + ',' + (arrowBaseY - 30) + ' ' + (arrowX - 5) + ',' + (arrowBaseY - 20) + ' ' + (arrowX + 5) + ',' + (arrowBaseY - 20) + '" fill="#fff"/>';
  } else {
    var arrowBotY = toY(r.botLine.intercept + r.botLine.slope * lastIdx);
    html += '<line x1="' + arrowX + '" y1="' + arrowBotY + '" x2="' + arrowX + '" y2="' + (arrowBotY + 25) + '" stroke="#ff6a00" stroke-width="2"/>';
    html += '<polygon points="' + arrowX + ',' + (arrowBotY + 30) + ' ' + (arrowX - 5) + ',' + (arrowBotY + 20) + ' ' + (arrowX + 5) + ',' + (arrowBotY + 20) + '" fill="#ff6a00"/>';
  }

  if (r.target) {
    var tgtY = toY(r.target);
    if (tgtY > 5 && tgtY < chartH) {
      html += '<line x1="' + toX(lastIdx - 5) + '" y1="' + tgtY + '" x2="' + (svgW - 5) + '" y2="' + tgtY + '" stroke="' + dirColor + '" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.4"/>';
      html += '<rect x="' + (svgW - 62) + '" y="' + (tgtY - 12) + '" width="58" height="11" rx="2" fill="#000" fill-opacity="0.9"/>';
      html += '<text x="' + (svgW - 33) + '" y="' + (tgtY - 3.5) + '" text-anchor="middle" fill="' + dirColor + '" font-size="6" font-family="Share Tech Mono" font-weight="bold">T $' + fmt(r.target) + '</text>';
    }
  }

  html += '<circle cx="' + toX(chartEnd) + '" cy="' + toY(price) + '" r="4" fill="#ff6a00"/>';

  for (var vi = 0; vi < chartVols.length; vi++) {
    var barH = (chartVols[vi] / maxVol) * (volH - 5);
    var barY = chartH + volH - barH + 5;
    html += '<rect x="' + (toX(chartStart + vi) - 4) + '" y="' + barY + '" width="8" height="' + barH + '" rx="1" fill="url(#vGrad2)" opacity="0.5"/>';
  }

  html += '<line x1="0" y1="' + (chartH + 3) + '" x2="' + svgW + '" y2="' + (chartH + 3) + '" stroke="#1a1a1a" stroke-width="0.5"/>';
  html += '<text x="8" y="' + (chartH + 14) + '" fill="#ccc" font-size="5" font-family="Share Tech Mono">VOL</text>';
  html += '</svg></div>';

  html += '<div style="display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid #111;">';
  var infoItems = [
    { label: 'PAIR', value: symbol, color: '#ff6a00' },
    { label: 'PRICE', value: '$' + fmt(price), color: '#fff' },
    { label: 'TYPE', value: st.typeEn.split(' ')[0], color: dirColor },
    { label: 'BREAK', value: isBullish ? 'BULLISH' : 'BEARISH', color: dirColor }
  ];
  infoItems.forEach(function(item, i) {
    html += '<div style="padding:8px 4px; text-align:center; border-left:' + (i > 0 ? '1px solid #111' : 'none') + ';">';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#ccc; letter-spacing:1px; margin-bottom:2px;">' + item.label + '</div>';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + item.color + '; font-weight:bold;">' + item.value + '</div></div>';
  });
  html += '</div></div>';
  document.getElementById('tri-pattern-card').innerHTML = html;

  var stHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;">';
  stHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">';
  stHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Adam & Encyclopedia Stats</span>';
  stHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc;">SAMPLES ANALYZED</span></div>';

  stHtml += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:10px;">';
  var statItems = [
    { label: 'AVG RISE', value: st.avgRise, color: '#fff' },
    { label: 'FAIL RATE', value: st.failRate, color: '#ff6a00' },
    { label: 'PULLBACK', value: st.pullbackRate, color: '#ccc' }
  ];
  statItems.forEach(function(s) {
    stHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px; text-align:center;">';
    stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; color:#ccc; letter-spacing:1px; margin-bottom:4px;">' + s.label + '</div>';
    stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + s.color + '; font-weight:bold;">' + s.value + '</div></div>';
  });
  stHtml += '</div>';

  stHtml += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">';
  stHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px;">';
  stHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="font-size:0.6rem; color:#ccc;">كسر صعودي</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#fff; font-weight:bold;">' + st.breakUpPct + '%</span></div>';
  stHtml += '<div style="display:flex; height:5px; border-radius:3px; overflow:hidden;"><div style="width:' + st.breakUpPct + '%; background:#fff;"></div><div style="width:' + st.breakDownPct + '%; background:#ff6a00;"></div></div>';
  stHtml += '<div style="display:flex; justify-content:space-between; margin-top:4px;"><span style="font-size:0.5rem; color:#ccc;">كسر هبوطي</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ff6a00;">' + st.breakDownPct + '%</span></div></div>';
  stHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:10px; text-align:center;">';
  stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; color:#ccc; letter-spacing:1px; margin-bottom:4px;">TARGET</div>';
  stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + dirColor + '; font-weight:bold;">$' + fmt(r.target) + '</div>';
  stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:' + dirColor + '; margin-top:2px;">' + r.targetPct + '</div></div>';
  stHtml += '</div></div>';
  document.getElementById('tri-stats-card').innerHTML = stHtml;

  var lowestTrough = Math.min.apply(null, r.troughPoints.map(function(p) { return p.price; }));
  var highestPeak = Math.max.apply(null, r.peakPoints.map(function(p) { return p.price; }));

  var mrHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid #ff6a00;">';
  mrHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ff6a00; letter-spacing:1px; margin-bottom:8px;">MEASURE RULE</div>';
  mrHtml += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">';
  mrHtml += '<div style="text-align:center;"><div style="font-size:0.5rem; color:#ccc; margin-bottom:2px;">أعلى قمة</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:#fff; font-weight:bold;">$' + fmt(highestPeak) + '</div></div>';
  mrHtml += '<div style="text-align:center;"><div style="font-size:0.5rem; color:#ccc; margin-bottom:2px;">أدنى قاع</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:#ff6a00; font-weight:bold;">$' + fmt(lowestTrough) + '</div></div>';
  mrHtml += '<div style="text-align:center;"><div style="font-size:0.5rem; color:#ccc; margin-bottom:2px;">الهدف</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:' + dirColor + '; font-weight:bold;">$' + fmt(r.target) + '</div></div>';
  mrHtml += '</div>';
  mrHtml += '<div style="font-size:0.55rem; color:#ccc; text-align:center; margin-top:8px; font-family:\'Share Tech Mono\',monospace;">الهدف = نقطة الكسر ' + (isBullish ? '+' : '-') + ' ارتفاع المثلث ($' + fmt(r.patternHeight) + ')</div></div>';
  document.getElementById('tri-measure-card').innerHTML = mrHtml;

  var conc = 'تم اكتشاف ' + st.typeAr + ' (' + st.typeEn + ') مكتمل بنسبة ' + r.completion + '%. ';
  if (r.type === 'ascending') conc += 'مقاومة أفقية مع قيعان صاعدة — ضغط شرائي متزايد. ';
  else if (r.type === 'descending') conc += 'دعم أفقي مع قمم هابطة — ضغط بيعي متزايد. ';
  else conc += 'قمم هابطة وقيعان صاعدة — تردد بين القوتين. ';
  
  conc += 'إحصائيات كتاب Adam (موسوعة النماذج): متوسط ' + (isBullish ? 'الصعود' : 'الهبوط') + ' ' + (isBullish ? st.avgRise : st.avgDecline) + ' بنسبة فشل ' + st.failRate + '. ';
  conc += 'الكسر ' + (isBullish ? 'الصعودي' : 'الهبوطي') + ' أكثر احتمالاً (' + (isBullish ? st.breakUpPct : st.breakDownPct) + '%). ';
  conc += 'الهدف: $' + fmt(r.target) + ' (' + r.targetPct + '). ';
  conc += 'تحذير: Pullback في ' + st.pullbackRate + ' من الحالات. ';
  conc += 'هذا تحليل فني ولا يُعتبر توصية شراء أو بيع.';
  document.getElementById('tri-conclusion').textContent = conc;
}

// ============================================================
// أداة التقرير اليومي التلقائي (Daily Briefing)
// ============================================================

async function loadDailyBriefing() {
  var loading = document.getElementById('br-loading');
  var dashboard = document.getElementById('br-dashboard');
  if(!loading || !dashboard) return;
  
  loading.style.display = 'block';
  dashboard.style.display = 'none';

  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var now = new Date();
  var timestampEl = document.getElementById('br-timestamp');
  if(timestampEl) {
    timestampEl.textContent = now.getUTCDate() + ' ' + months[now.getUTCMonth()] + ' ' + now.getUTCFullYear() + ' — ' + String(now.getUTCHours()).padStart(2,'0') + ':' + String(now.getUTCMinutes()).padStart(2,'0') + ' UTC';
  }

  try {
    var res = await fetch('/api/binance-klines?symbol=BTCUSDT&interval=1d&limit=500');
    if (!res.ok) throw new Error('فشل');
    var raw = await res.json();
    var candles = raw.map(function(k) { return { h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]) }; });
    var n = candles.length;
    var closes = candles.map(function(c) { return c.c; });
    var highs = candles.map(function(c) { return c.h; });
    var lows = candles.map(function(c) { return c.l; });
    var price = closes[n-1];
    var change24h = ((price - closes[n-2]) / closes[n-2] * 100);

    var b = buildBriefing(candles, closes, highs, lows, price, change24h, now);
    renderBriefingDashboard(b);
    loading.style.display = 'none';
    dashboard.style.display = 'flex'; 
  } catch(e) {
    loading.innerHTML = '<div style="color:#ff6a00;">تعذر تحميل البيانات. تأكد من اتصال الخادم.</div>';
  }
}

function buildBriefing(candles, closes, highs, lows, price, change24h, now) {
  var n = closes.length;

  // EMA
  function calcEMA(data, period) {
    var k = 2/(period+1); var ema = [data[0]];
    for (var i=1; i<data.length; i++) ema.push(data[i]*k + ema[i-1]*(1-k));
    return ema;
  }
  var ema8 = calcEMA(closes,8), ema21 = calcEMA(closes,21), ema200 = calcEMA(closes,200);
  var e8 = ema8[n-1], e21 = ema21[n-1], e200 = ema200[n-1];
  var trendDir = 'NEUTRAL', trendStr = 'متذبذب حول المتوسطات';
  if (price>e8 && price>e21 && price>e200 && e8>e21 && e21>e200) { trendDir='BULLISH'; trendStr='قوي — ترتيب صعودي كامل'; }
  else if (price<e8 && price<e21 && price<e200 && e8<e21 && e21<e200) { trendDir='BEARISH'; trendStr='قوي — ترتيب هبوطي كامل'; }
  else if (price>e200) { trendDir='BULLISH'; trendStr='فوق EMA200 — اتجاه عام صاعد'; }
  else if (price<e200) { trendDir='BEARISH'; trendStr='تحت EMA200 — اتجاه عام هابط'; }

  // RSI (14)
  var gains=[], losses=[];
  for (var ri=1; ri<n; ri++) { var d=closes[ri]-closes[ri-1]; gains.push(d>0?d:0); losses.push(d<0?Math.abs(d):0); }
  var avgG=0, avgL=0;
  for (var ag=0; ag<14; ag++) { avgG+=gains[ag]; avgL+=losses[ag]; }
  avgG/=14; avgL/=14;
  for (var rs=14; rs<gains.length; rs++) { avgG=(avgG*13+gains[rs])/14; avgL=(avgL*13+losses[rs])/14; }
  var rsi = avgL===0 ? 100 : 100-(100/(1+avgG/avgL));
  rsi = Math.round(rsi*10)/10;
  var rsiZone='', rsiSig='WAIT';
  if (rsi>=70) { rsiZone='تشبع شرائي'; rsiSig='BEAR'; }
  else if (rsi>=55) { rsiZone='محايد صعودي'; rsiSig='BULL'; }
  else if (rsi>=45) { rsiZone='محايد'; rsiSig='WAIT'; }
  else if (rsi>=30) { rsiZone='محايد هبوطي'; rsiSig='BEAR'; }
  else { rsiZone='تشبع بيعي'; rsiSig='BULL'; }

  // CHOP (14)
  var atr14=0;
  for (var ci=n-14; ci<n; ci++) { atr14+=Math.max(highs[ci]-lows[ci], Math.abs(highs[ci]-closes[ci-1]), Math.abs(lows[ci]-closes[ci-1])); }
  var hh=-Infinity, ll=Infinity;
  for (var chi=n-14; chi<n; chi++) { if(highs[chi]>hh)hh=highs[chi]; if(lows[chi]<ll)ll=lows[chi]; }
  var hlD=hh-ll;
  var chop = hlD>0 ? 100*Math.log10(atr14/hlD)/Math.log10(14) : 50;
  chop = Math.round(chop*10)/10;
  var chopSt = chop<38.2?'TRENDING':chop>61.8?'CHOPPY':'MIXED';
  var chopAr = chop<38.2?'اتجاه قوي':chop>61.8?'تذبذب عالي':'مختلط';

  // Fractals
  var peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs,0,n) : [];
  var troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows,0,n) : [];
  var nRes=null, nSup=null;
  if (peakIdxs.length > 0) {
    for (var pi=peakIdxs.length-1; pi>=0; pi--) { if(highs[peakIdxs[pi]]>price) { nRes={price:highs[peakIdxs[pi]], candles:n-1-peakIdxs[pi], status:price<highs[peakIdxs[pi]]?'HOLDING':'BROKEN'}; break; } }
  }
  if (troughIdxs.length > 0) {
    for (var ti=troughIdxs.length-1; ti>=0; ti--) { if(lows[troughIdxs[ti]]<price) { nSup={price:lows[troughIdxs[ti]], candles:n-1-troughIdxs[ti], status:price>lows[troughIdxs[ti]]?'HOLDING':'BROKEN'}; break; } }
  }

  // Moon
  var moonInfo = typeof getPhaseInfo === 'function' ? getPhaseInfo(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) : {phase: 0.28};
  var mp = moonInfo.phase || 0.28, mName='', mEffect='';
  if (mp<0.03||mp>0.97) { mName='محاق (New Moon)'; mEffect='بدايات — قيعان محتملة'; }
  else if (mp<0.22) { mName='هلال متزايد'; mEffect='بناء زخم صعودي'; }
  else if (mp<0.28) { mName='تربيع أول'; mEffect='محايد — نشاط متزايد'; }
  else if (mp<0.47) { mName='أحدب متزايد'; mEffect='ذروة نشاط'; }
  else if (mp<0.53) { mName='بدر (Full Moon)'; mEffect='قمم محتملة — جني أرباح'; }
  else if (mp<0.72) { mName='أحدب متناقص'; mEffect='تراجع تدريجي'; }
  else if (mp<0.78) { mName='تربيع أخير'; mEffect='محايد — هدوء'; }
  else { mName='هلال متناقص'; mEffect='نهاية دورة — ترقب'; }
  var illum = Math.round(mp<=0.5 ? mp*2*100 : (1-mp)*2*100);

  // Session
  var utcH = now.getUTCHours();
  var sess='OFF', sessSt='', sessNext='';
  if (utcH>=0&&utcH<8) { sess='Tokyo / Sydney'; sessSt='نشطة'; sessNext='London في '+(8-utcH)+' ساعات'; }
  else if (utcH>=8&&utcH<13) { sess='London'; sessSt='نشطة'; sessNext='New York في '+(13-utcH)+' ساعات'; }
  else if (utcH>=13&&utcH<17) { sess='London / New York'; sessSt='تداخل — أعلى سيولة'; sessNext='إغلاق London في '+(17-utcH)+' ساعات'; }
  else if (utcH>=17&&utcH<21) { sess='New York'; sessSt='نشطة'; sessNext='Tokyo في '+(24-utcH)+' ساعات'; }
  else { sess='OFF'; sessSt='فترة هدوء'; sessNext='Tokyo في '+(24-utcH)+' ساعات'; }

  return {
    price:price, change24h:change24h, high24h:candles[n-1].h, low24h:candles[n-1].l,
    trend:{ema8:Math.round(e8),ema21:Math.round(e21),ema200:Math.round(e200),direction:trendDir,strength:trendStr},
    rsi:{value:rsi,zone:rsiZone,signal:rsiSig},
    chop:{value:chop,state:chopSt,stateAr:chopAr},
    fractal:{nearestRes:nRes,nearestSup:nSup},
    moon:{name:mName,effect:mEffect,illumination:illum+'%'},
    session:{active:sess,status:sessSt,next:sessNext}
  };
}

function renderBriefingDashboard(b) {
  var tc = b.trend.direction==='BULLISH'?'#fff':b.trend.direction==='BEARISH'?'#ff6a00':'#888';
  var rc = b.rsi.signal==='BULL'?'#fff':b.rsi.signal==='BEAR'?'#ff6a00':'#888';
  var cc = b.chop.state==='TRENDING'?'#fff':b.chop.state==='CHOPPY'?'#ff6a00':'#888';
  var chgC = b.change24h>=0?'#fff':'#ff6a00';
  var chgS = (b.change24h>=0?'+':'')+b.change24h.toFixed(2)+'%';

  var p='<div style="background:#060606;border:1px solid #1a1a1a;border-radius:4px;padding:16px 12px;margin-bottom:6px;position:relative;overflow:hidden;">';
  p+='<div style="position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#ff6a0022,transparent);opacity:0.5;"></div>';
  p+='<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">';
  p+='<span style="color:#ff6a00;font-size:0.65rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">BTCUSDT</span>';
  p+='<span style="color:'+chgC+';font-size:1rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">'+chgS+'</span></div>';
  p+='<div style="color:#fff;font-size:2.4rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;letter-spacing:2px;direction:ltr;text-align:left;line-height:1;">$'+b.price.toLocaleString('en-US',{maximumFractionDigits:2})+'</div>';
  p+='<div style="display:flex;gap:16px;margin-top:8px;font-family:\'Share Tech Mono\',monospace;">';
  p+='<span style="color:#888;font-size:0.55rem;">H <span style="color:#fff;">$'+b.high24h.toLocaleString('en-US',{maximumFractionDigits:0})+'</span></span>';
  p+='<span style="color:#888;font-size:0.55rem;">L <span style="color:#ff6a00;">$'+b.low24h.toLocaleString('en-US',{maximumFractionDigits:0})+'</span></span></div></div>';
  document.getElementById('br-price').innerHTML = p;

  var g='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">';
  g+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;border-top:2px solid '+tc+';">';
  g+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:#ff6a00;font-size:0.55rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">TREND</span><span style="font-size:0.45rem;font-weight:900;padding:2px 5px;border-radius:3px;color:#000;background:'+tc+';font-family:\'Share Tech Mono\',monospace;">'+b.trend.direction+'</span></div>';
  g+='<div style="display:flex;gap:6px;margin-bottom:6px;">';
  [{l:'EMA8',v:b.trend.ema8},{l:'EMA21',v:b.trend.ema21},{l:'EMA200',v:b.trend.ema200}].forEach(function(e,i){
    g+='<div style="flex:1;background:#080808;border-radius:3px;padding:4px;text-align:center;"><div style="font-size:0.35rem;color:#666;font-family:\'Share Tech Mono\',monospace;">'+e.l+'</div><div style="font-size:0.6rem;color:'+(i<2?'#fff':'#ccc')+';font-family:\'Share Tech Mono\',monospace;font-weight:bold;direction:ltr;">'+e.v.toLocaleString()+'</div></div>';
  });
  g+='</div><div style="font-size:0.5rem;color:#ccc;font-family:\'Cairo\',sans-serif;">'+b.trend.strength+'</div></div>';
  g+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;border-top:2px solid '+rc+';">';
  g+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:#ff6a00;font-size:0.55rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">RSI (14)</span><span style="font-size:0.45rem;font-weight:900;padding:2px 5px;border-radius:3px;color:#000;background:'+rc+';font-family:\'Share Tech Mono\',monospace;">'+b.rsi.signal+'</span></div>';
  g+='<div style="color:#fff;font-size:2rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;line-height:1;margin-bottom:6px;direction:ltr;text-align:left;">'+b.rsi.value+'</div>';
  g+='<div style="position:relative;height:6px;background:#080808;border-radius:3px;margin-bottom:6px;"><div style="position:absolute;left:70%;top:-1px;width:1px;height:8px;background:#ff6a0044;"></div><div style="position:absolute;left:30%;top:-1px;width:1px;height:8px;background:#ffffff22;"></div><div style="height:100%;width:'+b.rsi.value+'%;background:'+rc+';border-radius:3px;opacity:0.6;"></div></div>';
  g+='<div style="font-size:0.5rem;color:#ccc;font-family:\'Cairo\',sans-serif;">'+b.rsi.zone+'</div></div>';
  g+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;border-top:2px solid '+cc+';">';
  g+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:#ff6a00;font-size:0.55rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">CHOP</span><span style="font-size:0.45rem;font-weight:900;padding:2px 5px;border-radius:3px;color:#000;background:'+cc+';font-family:\'Share Tech Mono\',monospace;">'+b.chop.state+'</span></div>';
  g+='<div style="color:#fff;font-size:2rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;line-height:1;margin-bottom:6px;direction:ltr;text-align:left;">'+b.chop.value+'</div>';
  g+='<div style="position:relative;height:6px;background:#080808;border-radius:3px;margin-bottom:6px;"><div style="position:absolute;left:38.2%;top:-1px;width:1px;height:8px;background:#ffffff22;"></div><div style="position:absolute;left:61.8%;top:-1px;width:1px;height:8px;background:#ff6a0044;"></div><div style="height:100%;width:'+b.chop.value+'%;background:'+cc+';border-radius:3px;opacity:0.6;"></div></div>';
  g+='<div style="font-size:0.5rem;color:#ccc;font-family:\'Cairo\',sans-serif;">'+b.chop.stateAr+'</div></div>';
  g+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;border-top:2px solid #ff6a00;">';
  g+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:#ff6a00;font-size:0.55rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">SESSION</span><div style="display:flex;align-items:center;gap:4px;"><div style="width:4px;height:4px;border-radius:50%;background:#ff6a00;"></div><span style="font-size:0.45rem;color:#ff6a00;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">LIVE</span></div></div>';
  g+='<div style="color:#fff;font-size:1.2rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;margin-bottom:4px;">'+b.session.active+'</div>';
  g+='<div style="font-size:0.5rem;color:#ccc;margin-bottom:4px;font-family:\'Cairo\',sans-serif;">'+b.session.status+'</div>';
  g+='<div style="font-size:0.45rem;color:#888;font-family:\'Cairo\',sans-serif;">'+b.session.next+'</div></div>';
  g+='</div>';
  document.getElementById('br-grid').innerHTML = g;

  var f='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">';
  if(b.fractal.nearestRes){
    f+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;">';
    f+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="color:#ff6a00;font-size:0.5rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">RESISTANCE</span><span style="font-size:0.4rem;color:#888;font-family:\'Share Tech Mono\',monospace;">'+b.fractal.nearestRes.candles+' candles</span></div>';
    f+='<div style="color:#fff;font-size:1.2rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;direction:ltr;text-align:left;">$'+b.fractal.nearestRes.price.toLocaleString('en-US',{maximumFractionDigits:0})+'</div>';
    f+='<div style="font-size:0.45rem;color:'+(b.fractal.nearestRes.status==='HOLDING'?'#fff':'#ff6a00')+';font-family:\'Share Tech Mono\',monospace;margin-top:4px;">'+b.fractal.nearestRes.status+'</div></div>';
  } else { f+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;text-align:center;color:#888;font-size:0.6rem;">--</div>'; }
  if(b.fractal.nearestSup){
    f+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;">';
    f+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="color:#ff6a00;font-size:0.5rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">SUPPORT</span><span style="font-size:0.4rem;color:#888;font-family:\'Share Tech Mono\',monospace;">'+b.fractal.nearestSup.candles+' candles</span></div>';
    f+='<div style="color:#ff6a00;font-size:1.2rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;direction:ltr;text-align:left;">$'+b.fractal.nearestSup.price.toLocaleString('en-US',{maximumFractionDigits:0})+'</div>';
    f+='<div style="font-size:0.45rem;color:'+(b.fractal.nearestSup.status==='HOLDING'?'#fff':'#ff6a00')+';font-family:\'Share Tech Mono\',monospace;margin-top:4px;">'+b.fractal.nearestSup.status+'</div></div>';
  } else { f+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;text-align:center;color:#888;font-size:0.6rem;">--</div>'; }
  f+='</div>';
  document.getElementById('br-fractals').innerHTML = f;

  var m='<div style="background:#060606;border:1px solid #1a1a1a;border-radius:4px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">';
  m+='<div style="display:flex;align-items:center;gap:8px;"><span style="color:#ff6a00;font-size:0.55rem;font-family:\'Share Tech Mono\',monospace;font-weight:bold;">MOON</span><span style="color:#fff;font-size:0.7rem;font-family:\'Cairo\',sans-serif;font-weight:bold;">'+b.moon.name+'</span></div>';
  m+='<div style="display:flex;align-items:center;gap:10px;"><span style="color:#888;font-size:0.5rem;font-family:\'Share Tech Mono\',monospace;">'+b.moon.illumination+'</span><span style="color:#ccc;font-size:0.5rem;font-family:\'Cairo\',sans-serif;">'+b.moon.effect+'</span></div></div>';
  document.getElementById('br-moon').innerHTML = m;

  var tAr = b.trend.direction==='BULLISH'?'صاعد':b.trend.direction==='BEARISH'?'هابط':'محايد';
  var s = 'BTC عند $'+b.price.toLocaleString('en-US',{maximumFractionDigits:0})+' — ';
  s += 'اتجاه '+tAr+' ('+b.trend.strength+'). ';
  s += 'RSI عند '+b.rsi.value+' ('+b.rsi.zone+'). ';
  s += 'CHOP عند '+b.chop.value+' ('+b.chop.stateAr+'). ';
  if(b.fractal.nearestRes) s += 'مقاومة $'+b.fractal.nearestRes.price.toLocaleString('en-US',{maximumFractionDigits:0})+'. ';
  if(b.fractal.nearestSup) s += 'دعم $'+b.fractal.nearestSup.price.toLocaleString('en-US',{maximumFractionDigits:0})+'. ';
  s += 'القمر: '+b.moon.name+'. ';
  s += 'جلسة '+b.session.active+' '+b.session.status+'.';
  document.getElementById('br-summary').textContent = s;
}


// ============================================================
// أداة مؤشر التدفق (Flow Index) - تباين الأموال الذكية
// ============================================================

async function loadFlow() {
  var loading = document.getElementById('flow-loading');
  var dashboard = document.getElementById('flow-dashboard');
  if(!loading || !dashboard) return;
  
  loading.style.display = 'block';
  dashboard.style.display = 'none';

  try {
    // 1. جلب بيانات السعر لتشكيل الشارت
    var resBinance = await fetch('/api/binance-klines?symbol=BTCUSDT&interval=1d&limit=15');
    if (!resBinance.ok) throw new Error('Network Error');
    var rawKlines = await resBinance.json();
    
    var btcCandles = rawKlines.map(function(k) { return { time: parseInt(k[0]), c: parseFloat(k[4]), o: parseFloat(k[1]) }; });
    var price = btcCandles[btcCandles.length - 1].c;
    var btcChange24h = ((price - btcCandles[btcCandles.length - 2].c) / btcCandles[btcCandles.length - 2].c) * 100;
    var btcDir = btcChange24h >= 0 ? 'up' : 'down';

    // 2. قراءة البيانات اللحظية من الشريط المتحرك
    var domVal = 54.2, usdtDomVal = 4.5, altVal = 1.12; 
    var domChg = -0.5, usdtDomChg = -0.2, altChg = 2.1;
    
    try {
      var tickerEl = document.getElementById('macro-radar-track');
      if(tickerEl) {
        var text = tickerEl.innerText || tickerEl.textContent;
        
        // استخراج استحواذ البيتكوين
        var domMatch = text.match(/(?:استحواذ|BTC)[^\d]*(\d+(\.\d+)?)[^\d]*([+-]?\d+(\.\d+)?)/i);
        if(domMatch) { domVal = parseFloat(domMatch[1]); domChg = parseFloat(domMatch[3]); }
        
        // استخراج استحواذ التيثر (USDT Dominance) بدلاً من الماركت كاب
        var usdtMatch = text.match(/(?:USDT|تيثر)[^\d]*(\d+(\.\d+)?)[^\d]*([+-]?\d+(\.\d+)?)/i);
        if(usdtMatch) { usdtDomVal = parseFloat(usdtMatch[1]); usdtDomChg = parseFloat(usdtMatch[3]); }
        
        // استخراج القيمة السوقية
        var altMatch = text.match(/(?:القيمة|سوق|TOTAL)[^\d]*(\d+(\.\d+)?)[^\d]*([+-]?\d+(\.\d+)?)/i);
        if(altMatch) { altVal = parseFloat(altMatch[1]); altChg = parseFloat(altMatch[3]); }
      }
    } catch(e) {
      console.warn("Scraping minor issue, using safe fallbacks.");
    }

    // 3. بناء مصفوفة المؤشرات
    var indicators = [
      {
        name: 'BTC.D', full: 'BTC Dominance',
        value: domVal.toFixed(2) + '%',
        change: (domChg >= 0 ? '+' : '') + domChg.toFixed(2) + '%',
        dir: domChg >= 0 ? 'up' : 'down',
        btcDir: btcDir,
        divergence: (btcDir === 'up' && domChg < -0.2) || (btcDir === 'down' && domChg > 0.2),
        signal: ''
      },
      {
        name: 'USDT.D', full: 'USDT Dominance',
        value: usdtDomVal.toFixed(2) + '%',
        change: (usdtDomChg >= 0 ? '+' : '') + usdtDomChg.toFixed(2) + '%',
        dir: usdtDomChg >= 0 ? 'up' : 'down',
        btcDir: btcDir,
        // الدايفرجنس: الطبيعي أن السعر عكس استحواذ التيثر. التباين يحدث إذا تحركا في نفس الاتجاه
        divergence: (btcDir === 'up' && usdtDomChg > 0.1) || (btcDir === 'down' && usdtDomChg < -0.1),
        signal: ''
      },
      {
        name: 'TOTAL', full: 'Total Market Cap',
        value: '$' + altVal.toFixed(2) + 'T',
        change: (altChg >= 0 ? '+' : '') + altChg.toFixed(2) + '%',
        dir: altChg >= 0 ? 'up' : 'down',
        btcDir: btcDir,
        divergence: (btcDir === 'up' && altChg < -0.5) || (btcDir === 'down' && altChg > 0.5),
        signal: ''
      }
    ];

    // فلترة الإشارات الاستثمارية (تم عكس إشارة USDT لأن هبوط الاستحواذ إيجابي)
    indicators[0].signal = indicators[0].divergence ? 'BEAR' : (indicators[0].dir === 'down' && btcDir === 'up' ? 'BEAR' : 'BULL');
    indicators[1].signal = indicators[1].dir === 'down' ? 'BULL' : 'BEAR'; // انخفاض استحواذ التيثر = BULL
    indicators[2].signal = indicators[2].dir === 'up' ? 'BULL' : (indicators[2].divergence ? 'BEAR' : 'BULL');

    var bullCount = indicators.filter(function(ind) { return ind.signal === 'BULL'; }).length;
    var bearCount = indicators.filter(function(ind) { return ind.signal === 'BEAR'; }).length;
    var direction = bullCount > bearCount ? 'bullish' : bearCount > bullCount ? 'bearish' : 'neutral';
    var confidence = Math.round(Math.max(bullCount, bearCount) / 3 * 100);

    var closes = btcCandles.map(function(c) { return c.c; });

    // 4. العرض
    renderFlowDashboard(price, btcChange24h, indicators, closes, direction, confidence, bullCount, bearCount);
    
    loading.style.display = 'none';
    dashboard.style.display = 'flex';

  } catch(e) {
    loading.innerHTML = '<div style="color:#ff6a00;">تعذر قراءة التدفق اللحظي. تأكد من توفر البيانات.</div>';
  }
}

function renderFlowDashboard(price, btcChange24h, indicators, closes, direction, confidence, bullCount, bearCount) {
  var dirColor = direction === 'bullish' ? '#fff' : '#ff6a00';

  var tkHtml = '<div style="background:#060606; border:1px solid #111; border-radius:4px; padding:10px 12px; display:flex; justify-content:space-between; align-items:baseline;">';
  tkHtml += '<div style="display:flex; align-items:baseline; gap:10px;">';
  tkHtml += '<span style="color:#ff6a00; font-size:0.65rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">BTCUSDT</span>';
  tkHtml += '<span style="color:#fff; font-size:1.8rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold; letter-spacing:1px; direction:ltr;">$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</span></div>';
  tkHtml += '<span style="color:' + (btcChange24h >= 0 ? '#fff' : '#ff6a00') + '; font-size:0.85rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">' + (btcChange24h >= 0 ? '+' : '') + btcChange24h.toFixed(2) + '%</span></div>';
  document.getElementById('flow-ticker').innerHTML = tkHtml;

  var gHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
  indicators.forEach(function(ind) {
    var isBull = ind.signal === 'BULL';
    var sc = isBull ? '#fff' : '#ff6a00';
    var hasDv = ind.divergence;
    gHtml += '<div style="background:' + (hasDv ? '#0d0805' : '#0a0a0a') + '; border:1px solid ' + (hasDv ? '#2a1a0a' : '#1a1a1a') + '; border-radius:4px; padding:10px 8px; border-top:2px solid ' + sc + ';">';
    gHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
    gHtml += '<span style="color:#ff6a00; font-size:0.65rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">' + ind.name + '</span>';
    gHtml += '<span style="font-size:0.45rem; font-weight:900; padding:2px 5px; border-radius:3px; color:#000; background:' + sc + '; font-family:\'Share Tech Mono\',monospace;">' + ind.signal + '</span></div>';
    gHtml += '<div style="color:#fff; font-size:1.1rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold; margin-bottom:4px; direction:ltr; text-align:left;">' + ind.value + '</div>';
    gHtml += '<div style="font-size:0.7rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold; margin-bottom:8px; direction:ltr; text-align:left; color:' + (ind.change.charAt(0) === '+' ? '#fff' : '#ff6a00') + ';">' + ind.change + '</div>';
    gHtml += '<div style="display:flex; gap:4px; margin-bottom:6px;">';
    gHtml += '<div style="flex:1; background:#080808; border-radius:3px; padding:4px; text-align:center;"><div style="font-size:0.4rem; color:#666; font-family:\'Share Tech Mono\',monospace; margin-bottom:2px;">BTC</div><div style="font-size:0.6rem; color:' + (ind.btcDir === 'up' ? '#fff' : '#ff6a00') + '; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">' + (ind.btcDir === 'up' ? 'UP' : 'DN') + '</div></div>';
    gHtml += '<div style="flex:1; background:#080808; border-radius:3px; padding:4px; text-align:center;"><div style="font-size:0.4rem; color:#666; font-family:\'Share Tech Mono\',monospace; margin-bottom:2px;">IND</div><div style="font-size:0.6rem; color:' + (ind.dir === 'up' ? '#fff' : '#ff6a00') + '; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">' + (ind.dir === 'up' ? 'UP' : 'DN') + '</div></div></div>';
    if (hasDv) {
      gHtml += '<div style="background:rgba(255,106,0,0.1); border:1px solid rgba(255,106,0,0.2); border-radius:3px; padding:4px; text-align:center;"><span style="color:#ff6a00; font-size:0.5rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold; letter-spacing:1px;">DIVERGENCE</span></div>';
    } else {
      gHtml += '<div style="background:rgba(255,255,255,0.03); border-radius:3px; padding:4px; text-align:center;"><span style="color:#555; font-size:0.5rem; font-family:\'Share Tech Mono\',monospace;">ALIGNED</span></div>';
    }
    gHtml += '</div>';
  });
  gHtml += '</div>';
  document.getElementById('flow-grid').innerHTML = gHtml;

  var last14 = closes.slice(-14);
  var cW = 310, topH = 90, botH = 50, gapH = 8, totalH = topH + gapH + botH;
  var pad = 12;
  var bMin = Math.min.apply(null, last14), bMax = Math.max.apply(null, last14), bR = bMax - bMin || 1;

  var chartHtml = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; padding:10px 8px;">';
  chartHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:0 4px 8px; border-bottom:1px solid #111; margin-bottom:8px;">';
  chartHtml += '<div style="display:flex; align-items:center; gap:12px;"><span style="color:#ff6a00; font-size:0.6rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">BTC vs DOMINANCE</span><span style="color:#333; font-size:0.5rem; font-family:\'Share Tech Mono\',monospace;">14D FLOW</span></div>';
  chartHtml += '<div style="display:flex; gap:10px;">';
  chartHtml += '<div style="display:flex; align-items:center; gap:3px;"><div style="width:10px; height:6px; background:#ff6a00; border-radius:1px; opacity:0.6;"></div><span style="color:#888; font-size:0.45rem; font-family:\'Share Tech Mono\',monospace;">BTC PRICE</span></div>';
  chartHtml += '<div style="display:flex; align-items:center; gap:3px;"><div style="width:10px; height:6px; background:#fff; border-radius:1px; opacity:0.4;"></div><span style="color:#888; font-size:0.45rem; font-family:\'Share Tech Mono\',monospace;">FLOW OUT</span></div></div></div>';

  chartHtml += '<svg width="100%" height="' + totalH + '" viewBox="0 0 ' + cW + ' ' + totalH + '" style="direction:ltr;">';
  chartHtml += '<defs><linearGradient id="flowAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6a00" stop-opacity="0.25"/><stop offset="50%" stop-color="#ff6a00" stop-opacity="0.08"/><stop offset="100%" stop-color="#ff6a00" stop-opacity="0"/></linearGradient>';
  chartHtml += '<filter id="flowGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';

  for (var gi = 1; gi <= 3; gi++) {
    chartHtml += '<line x1="' + pad + '" y1="' + (gi * topH / 4) + '" x2="' + (cW - pad) + '" y2="' + (gi * topH / 4) + '" stroke="#0d0d0d" stroke-width="0.5"/>';
  }

  var bPts = [];
  for (var bi = 0; bi < last14.length; bi++) {
    bPts.push({ x: pad + (bi / (last14.length - 1)) * (cW - pad * 2), y: 8 + (1 - (last14[bi] - bMin) / bR) * (topH - 16) });
  }

  var areaPoints = bPts[0].x + ',' + topH;
  for (var ai = 0; ai < bPts.length; ai++) areaPoints += ' ' + bPts[ai].x + ',' + bPts[ai].y;
  areaPoints += ' ' + bPts[bPts.length - 1].x + ',' + topH;
  chartHtml += '<polygon points="' + areaPoints + '" fill="url(#flowAreaGrad)"/>';

  var linePoints = '';
  for (var li = 0; li < bPts.length; li++) linePoints += bPts[li].x + ',' + bPts[li].y + ' ';
  chartHtml += '<polyline points="' + linePoints.trim() + '" fill="none" stroke="#ff6a00" stroke-width="2" stroke-linejoin="round" filter="url(#flowGlow)"/>';

  for (var di = 0; di < bPts.length; di++) {
    var isLast = di === bPts.length - 1;
    chartHtml += '<circle cx="' + bPts[di].x + '" cy="' + bPts[di].y + '" r="' + (isLast ? 3.5 : 1.5) + '" fill="' + (isLast ? '#ff6a00' : '#ff6a0066') + '"/>';
  }

  var lastPt = bPts[bPts.length - 1];
  chartHtml += '<rect x="' + (lastPt.x + 4) + '" y="' + (lastPt.y - 7) + '" width="42" height="13" rx="2" fill="#ff6a00"/>';
  chartHtml += '<text x="' + (lastPt.x + 25) + '" y="' + (lastPt.y + 3) + '" text-anchor="middle" fill="#000" font-size="6.5" font-weight="bold" font-family="Share Tech Mono">' + (last14[last14.length - 1] / 1000).toFixed(1) + 'K</text>';

  chartHtml += '<line x1="' + pad + '" y1="' + (topH + gapH / 2) + '" x2="' + (cW - pad) + '" y2="' + (topH + gapH / 2) + '" stroke="#1a1a1a" stroke-width="0.5"/>';

  var centerY = topH + gapH + botH / 2;
  chartHtml += '<line x1="' + pad + '" y1="' + centerY + '" x2="' + (cW - pad) + '" y2="' + centerY + '" stroke="#222" stroke-width="0.5" stroke-dasharray="3 3"/>';

  var flowDeltas = [];
  for (var fi = 0; fi < last14.length; fi++) {
    if (fi === 0) { flowDeltas.push(0); continue; }
    flowDeltas.push((last14[fi] - last14[fi - 1]) / last14[fi - 1]);
  }
  var maxDelta = 0.01;
  for (var mi = 0; mi < flowDeltas.length; mi++) {
    if (Math.abs(flowDeltas[mi]) > maxDelta) maxDelta = Math.abs(flowDeltas[mi]);
  }

  var barW = (cW - pad * 2) / last14.length * 0.7;

  for (var fbi = 1; fbi < flowDeltas.length; fbi++) {
    var delta = flowDeltas[fbi];
    var barX = pad + (fbi / (last14.length - 1)) * (cW - pad * 2) - barW / 2;
    var barHeight = Math.abs(delta) / maxDelta * (botH / 2 - 4);
    var isUp = delta > 0;
    var opacity = Math.abs(delta) / maxDelta * 0.6 + 0.2;

    chartHtml += '<rect x="' + barX + '" y="' + (isUp ? '#ff6a00' : '#ffffff') + '" width="' + barW + '" height="' + Math.max(barHeight, 1) + '" rx="1.5" fill="' + (isUp ? '#ff6a00' : '#ffffff') + '" opacity="' + opacity.toFixed(2) + '"/>';
  }

  chartHtml += '<text x="' + (pad + 2) + '" y="' + (topH + gapH + 8) + '" fill="#ff6a00" font-size="4.5" font-family="Share Tech Mono" font-weight="bold">BTC OUTFLOW</text>';
  chartHtml += '<text x="' + (pad + 2) + '" y="' + (topH + gapH + botH - 3) + '" fill="#fff" font-size="4.5" font-family="Share Tech Mono" font-weight="bold" opacity="0.5">DOM OUTFLOW</text>';
  chartHtml += '</svg></div>';
  document.getElementById('flow-chart').innerHTML = chartHtml;

  var powerPos = direction === 'bullish' ? 50 + confidence / 2 : direction === 'bearish' ? 50 - confidence / 2 : 50;
  var mHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:10px 12px;">';
  mHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:6px;">';
  mHtml += '<span style="color:#ff6a00; font-size:0.55rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">BEARISH</span>';
  mHtml += '<span style="color:#444; font-size:0.45rem; font-family:\'Share Tech Mono\',monospace; letter-spacing:2px;">FLOW BIAS</span>';
  mHtml += '<span style="color:#fff; font-size:0.55rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold;">BULLISH</span></div>';
  mHtml += '<div style="position:relative; height:8px; background:#080808; border-radius:4px; border:1px solid #151515;">';
  mHtml += '<div style="position:absolute; left:0; top:0; width:50%; height:100%; background:linear-gradient(to right, rgba(255,106,0,0.12), transparent);"></div>';
  mHtml += '<div style="position:absolute; right:0; top:0; width:50%; height:100%; background:linear-gradient(to left, rgba(255,255,255,0.08), transparent);"></div>';
  mHtml += '<div style="position:absolute; left:50%; top:-1px; width:1px; height:calc(100% + 2px); background:#222;"></div>';
  mHtml += '<div style="position:absolute; top:50%; transform:translate(-50%,-50%); left:' + powerPos + '%; width:12px; height:12px; border-radius:50%; background:' + dirColor + '; box-shadow:0 0 8px ' + dirColor + '44; border:2px solid #000;"></div></div>';
  mHtml += '<div style="display:flex; justify-content:center; gap:16px; margin-top:6px; font-family:\'Share Tech Mono\',monospace;">';
  mHtml += '<span style="color:#ccc; font-size:0.6rem;">' + bullCount + ' BULL</span><span style="color:#333;">|</span>';
  mHtml += '<span style="color:#ccc; font-size:0.6rem;">' + bearCount + ' BEAR</span><span style="color:#333;">|</span>';
  mHtml += '<span style="color:' + dirColor + '; font-size:0.65rem; font-weight:bold;">' + confidence + '%</span></div></div>';
  document.getElementById('flow-meter').innerHTML = mHtml;

  var matHtml = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden;">';
  matHtml += '<div style="background:#0a0a0a; padding:6px 10px; border-bottom:1px solid #111; display:flex; gap:8px;">';
  matHtml += '<span style="color:#ff6a00; font-size:0.55rem; font-family:\'Share Tech Mono\',monospace; font-weight:bold; letter-spacing:1px;">MATRIX</span>';
  matHtml += '<span style="color:#444; font-size:0.45rem; font-family:\'Share Tech Mono\',monospace;">INDICATOR ALIGNMENT</span></div>';
  matHtml += '<table style="width:100%; border-collapse:collapse; font-size:0.6rem; font-family:\'Share Tech Mono\',monospace;">';
  matHtml += '<thead><tr style="border-bottom:1px solid #1a1a1a;">';
  ['INDICATOR','VALUE','CHG','BTC','IND','DIV','SIGNAL'].forEach(function(h, i) {
    matHtml += '<th style="padding:7px 6px; color:#888; text-align:' + (i === 0 ? 'right' : 'center') + '; font-weight:normal;">' + h + '</th>';
  });
  matHtml += '</tr></thead><tbody>';

  indicators.forEach(function(ind) {
    var isBull = ind.signal === 'BULL';
    matHtml += '<tr style="border-bottom:1px solid #0d0d0d; background:' + (ind.divergence ? 'rgba(255,106,0,0.03)' : 'transparent') + ';">';
    matHtml += '<td style="padding:7px 6px; color:#ff6a00; font-weight:bold; text-align:right;">' + ind.name + '</td>';
    matHtml += '<td style="padding:7px 6px; color:#fff; text-align:center; font-weight:bold;">' + ind.value + '</td>';
    matHtml += '<td style="padding:7px 6px; color:' + (ind.change.charAt(0) === '+' ? '#fff' : '#ff6a00') + '; text-align:center; font-weight:bold;">' + ind.change + '</td>';
    matHtml += '<td style="padding:7px 6px; text-align:center; color:' + (ind.btcDir === 'up' ? '#fff' : '#ff6a00') + '; font-weight:bold;">' + (ind.btcDir === 'up' ? 'UP' : 'DN') + '</td>';
    matHtml += '<td style="padding:7px 6px; text-align:center; color:' + (ind.dir === 'up' ? '#fff' : '#ff6a00') + '; font-weight:bold;">' + (ind.dir === 'up' ? 'UP' : 'DN') + '</td>';
    matHtml += '<td style="padding:7px 6px; text-align:center; color:' + (ind.divergence ? '#ff6a00' : '#333') + '; font-weight:bold;">' + (ind.divergence ? 'YES' : '---') + '</td>';
    matHtml += '<td style="padding:7px 6px; text-align:center;"><span style="font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:3px; color:#000; background:' + (isBull ? '#fff' : '#ff6a00') + ';">' + ind.signal + '</span></td>';
    matHtml += '</tr>';
  });
  matHtml += '</tbody></table></div>';
  document.getElementById('flow-matrix').innerHTML = matHtml;

  var conc = bullCount + ' من 3 مؤشرات تدعم ' + (direction === 'bullish' ? 'الصعود' : direction === 'bearish' ? 'الهبوط' : 'الحياد') + ' (' + confidence + '%). ';
  if (indicators[1].dir === 'down') conc += 'استحواذ التيثر (USDT.D) ينخفض، مما يدل على ضخ الأموال في السوق. ';
  else conc += 'ارتفاع في استحواذ التيثر (USDT.D) يشير إلى تخارج السيولة وهرباً للملاذ الآمن. ';
  if (indicators[0].divergence) conc += 'تباين واضح: السعر يتحرك عكس سيطرة البتكوين، مما قد يمهد لتحول السيولة للعملات البديلة. ';
  
  document.getElementById('flow-verdict').textContent = conc;
}

// ============================================================
// أداة Head & Shoulders Scanner — Quant Level Logic (Active Only)
// ============================================================

var HS_STATS = {
  top: {
    name: 'Head & Shoulders Top', nameAr: 'رأس وكتفين قمّة', type: 'انعكاسي هبوطي',
    failRate: '4%', avgDecline: '22%', pullbackRate: '45%', avgDays: '45 يوم'
  },
  bottom: {
    name: 'Head & Shoulders Bottom', nameAr: 'رأس وكتفين قاع', type: 'انعكاسي صعودي',
    failRate: '5%', avgRise: '38%', pullbackRate: '47%', avgDays: '40 يوم'
  }
};

function formatPx(p) {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + p.toFixed(8);
}

async function runHSScanner() {
  var coinInput = document.getElementById('hs-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('hs-tf').value;
  var btn = document.getElementById('hs-btn');

  if (!coinInput) return;
  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING H&S...';
  btn.disabled = true;

  try {
    var limit = tfInput === '1h' ? 500 : tfInput === '4h' ? 400 : 200;
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=' + limit);
    if (!res.ok) throw new Error('تعذر جلب البيانات السعرية.');
    var raw = await res.json();
    if (raw.length < 100) throw new Error('بيانات غير كافية للتحليل الهيكلي.');

    var candles = raw.map(function(k) { return { h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) }; });
    var closes = candles.map(function(c) { return c.c; });
    var highs = candles.map(function(c) { return c.h; });
    var lows = candles.map(function(c) { return c.l; });
    var volumes = candles.map(function(c) { return c.v; });
    var price = closes[closes.length - 1];

    var result = detectHeadShoulders(highs, lows, closes, volumes, price);
    renderHSDashboard(symbol, price, tfInput.toUpperCase(), closes, volumes, result);
    document.getElementById('hs-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function detectHeadShoulders(highs, lows, closes, volumes, price) {
  var n = closes.length;
  var peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, n) : [];
  var troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, n) : [];

  if (peakIdxs.length < 3 || troughIdxs.length < 2) return { found: false, message: 'معطيات الانعكاس غير مكتملة لتشكيل هيكل H&S.' };

  var bestPattern = null;
  var bestScore = 0;

  var startP = Math.max(0, peakIdxs.length - 10);
  var startT = Math.max(0, troughIdxs.length - 10);

  // === البحث عن H&S Top ===
  for (var pi = startP; pi <= peakIdxs.length - 3; pi++) {
    var p1Idx = peakIdxs[pi], p2Idx = peakIdxs[pi + 1], p3Idx = peakIdxs[pi + 2];
    var p1 = highs[p1Idx], p2 = highs[p2Idx], p3 = highs[p3Idx];

    if (p2 <= p1 || p2 <= p3) continue;

    var shoulderDiff = Math.abs(p1 - p3) / p2;
    if (shoulderDiff > 0.05) continue;

    var t1Idx = null, t2Idx = null;
    var t1Price = Infinity, t2Price = Infinity;

    for (var ti = 0; ti < troughIdxs.length; ti++) {
      var tIdx = troughIdxs[ti];
      if (tIdx > p1Idx && tIdx < p2Idx && lows[tIdx] < t1Price) { t1Idx = tIdx; t1Price = lows[tIdx]; }
      if (tIdx > p2Idx && tIdx < p3Idx && lows[tIdx] < t2Price) { t2Idx = tIdx; t2Price = lows[tIdx]; }
    }

    if (t1Idx === null || t2Idx === null) continue;
    if (t1Price >= p1 || t2Price >= p3) continue;

    var necklineSlope = (t2Price - t1Price) / (t2Idx - t1Idx);
    var necklineAtCurrent = t1Price + necklineSlope * (n - 1 - t1Idx);
    var necklineAtHead = t1Price + necklineSlope * (p2Idx - t1Idx);
    var headHeight = p2 - necklineAtHead;
    if (headHeight / p2 < 0.02) continue;

    // حساب الأهداف والوقف (Fibonacci Extensions)
    var t1 = necklineAtCurrent - (headHeight * 0.618);
    var t2 = necklineAtCurrent - (headHeight * 1.000);
    var t3 = necklineAtCurrent - (headHeight * 1.618);
    var sl = Math.max(p1, p3) * 1.005; // 0.5% فوق أعلى كتف

    // فلتر النماذج النشطة (Active Only)
    if (n - 1 - p3Idx > 60) continue; // مهلة التفعيل انتهت
    if (price > sl) continue;         // فشل الهيكل
    if (price < t3) continue;         // الأهداف تحققت بالكامل

    var score = 0;
    score += (1 - shoulderDiff) * 30;
    var necklineDiff = Math.abs(t1Price - t2Price) / ((t1Price + t2Price) / 2);
    score += (1 - Math.min(necklineDiff * 10, 1)) * 20;
    var headProminence = (p2 - Math.max(p1, p3)) / p2;
    score += Math.min(headProminence * 100, 30);

    var volLS = 0, volHD = 0, volRS = 0, volCount = 0;
    for (var vi = Math.max(0, p1Idx - 2); vi <= Math.min(n - 1, p1Idx + 2); vi++) { volLS += volumes[vi]; volCount++; }
    volLS /= volCount || 1; volCount = 0;
    for (var vi2 = Math.max(0, p2Idx - 2); vi2 <= Math.min(n - 1, p2Idx + 2); vi2++) { volHD += volumes[vi2]; volCount++; }
    volHD /= volCount || 1; volCount = 0;
    for (var vi3 = Math.max(0, p3Idx - 2); vi3 <= Math.min(n - 1, p3Idx + 2); vi3++) { volRS += volumes[vi3]; volCount++; }
    volRS /= volCount || 1;

    if (volHD < volLS) score += 10;
    if (volRS < volHD) score += 10;

    if (score > bestScore && score >= 40) {
      bestScore = score;
      var isBroken = price < necklineAtCurrent;
      var completion = isBroken ? 100 : Math.round(90 + (necklineAtCurrent - price) / (p2 - necklineAtCurrent) * 10);
      var neckDesc = necklineDiff < 0.005 ? 'أفقي' : t2Price > t1Price ? 'صاعد قليلاً' : 'هابط قليلاً';

      bestPattern = {
        found: true, patternType: 'top', stats: HS_STATS.top, accuracy: Math.round(100 - parseFloat(HS_STATS.top.failRate)), completion: Math.min(completion, 99),
        points: { LS: { price: p1, idx: p1Idx }, T1: { price: t1Price, idx: t1Idx }, HD: { price: p2, idx: p2Idx }, T2: { price: t2Price, idx: t2Idx }, RS: { price: p3, idx: p3Idx } },
        necklinePrice: necklineAtCurrent, necklineSlope: necklineSlope, necklineDesc: neckDesc, headHeight: headHeight, 
        target1: t1, target1Pct: ((t1 - price) / price * 100).toFixed(1) + '%',
        target2: t2, target2Pct: ((t2 - price) / price * 100).toFixed(1) + '%',
        target3: t3, target3Pct: ((t3 - price) / price * 100).toFixed(1) + '%',
        stopLoss: sl, stopPct: '+' + ((sl - price) / price * 100).toFixed(1) + '%',
        isBroken: isBroken, volumePattern: { ls: volLS, hd: volHD, rs: volRS, diminishing: volHD < volLS && volRS < volHD }
      };
    }
  }

  // === البحث عن H&S Bottom ===
  if (!bestPattern) {
    for (var bi = startT; bi <= troughIdxs.length - 3; bi++) {
      var b1Idx = troughIdxs[bi], b2Idx = troughIdxs[bi + 1], b3Idx = troughIdxs[bi + 2];
      var b1 = lows[b1Idx], b2 = lows[b2Idx], b3 = lows[b3Idx];

      if (b2 >= b1 || b2 >= b3) continue;
      var bShDiff = Math.abs(b1 - b3) / b2;
      if (bShDiff > 0.05) continue;

      var bt1Idx = null, bt2Idx = null;
      var bt1Price = -Infinity, bt2Price = -Infinity;

      for (var bti = 0; bti < peakIdxs.length; bti++) {
        var btIdx = peakIdxs[bti];
        if (btIdx > b1Idx && btIdx < b2Idx && highs[btIdx] > bt1Price) { bt1Idx = btIdx; bt1Price = highs[btIdx]; }
        if (btIdx > b2Idx && btIdx < b3Idx && highs[btIdx] > bt2Price) { bt2Idx = btIdx; bt2Price = highs[btIdx]; }
      }

      if (bt1Idx === null || bt2Idx === null) continue;

      var bNeckSlope = (bt2Price - bt1Price) / (bt2Idx - bt1Idx);
      var bNeckAtCurrent = bt1Price + bNeckSlope * (n - 1 - bt1Idx);
      var bNeckAtHead = bt1Price + bNeckSlope * (b2Idx - bt1Idx);
      var bHeadHeight = bNeckAtHead - b2;
      if (bHeadHeight / bNeckAtCurrent < 0.02) continue;

      var bt1 = bNeckAtCurrent + (bHeadHeight * 0.618);
      var bt2 = bNeckAtCurrent + (bHeadHeight * 1.000);
      var bt3 = bNeckAtCurrent + (bHeadHeight * 1.618);
      var bsl = Math.min(b1, b3) * 0.995;

      if (n - 1 - b3Idx > 60) continue; 
      if (price < bsl) continue;         
      if (price > bt3) continue;         

      var bNeckDiff = Math.abs(bt1Price - bt2Price) / ((bt1Price + bt2Price) / 2);
      var bScore = 0;
      bScore += (1 - bShDiff) * 30;
      bScore += (1 - Math.min(bNeckDiff * 10, 1)) * 20;
      bScore += Math.min(((bNeckAtHead - b2) / bNeckAtHead) * 100, 30);
      
      if (bScore > bestScore && bScore >= 40) {
        bestScore = bScore;
        var bIsBroken = price > bNeckAtCurrent;
        var bNeckDesc = bNeckDiff < 0.005 ? 'أفقي' : bt2Price > bt1Price ? 'صاعد قليلاً' : 'هابط قليلاً';

        bestPattern = {
          found: true, patternType: 'bottom', stats: HS_STATS.bottom, accuracy: Math.round(100 - parseFloat(HS_STATS.bottom.failRate)), completion: bIsBroken ? 100 : 90,
          points: { LS: { price: b1, idx: b1Idx }, T1: { price: bt1Price, idx: bt1Idx }, HD: { price: b2, idx: b2Idx }, T2: { price: bt2Price, idx: bt2Idx }, RS: { price: b3, idx: b3Idx } },
          necklinePrice: bNeckAtCurrent, necklineSlope: bNeckSlope, necklineDesc: bNeckDesc, headHeight: bHeadHeight, 
          target1: bt1, target1Pct: '+' + ((bt1 - price) / price * 100).toFixed(1) + '%',
          target2: bt2, target2Pct: '+' + ((bt2 - price) / price * 100).toFixed(1) + '%',
          target3: bt3, target3Pct: '+' + ((bt3 - price) / price * 100).toFixed(1) + '%',
          stopLoss: bsl, stopPct: ((bsl - price) / price * 100).toFixed(1) + '%',
          isBroken: bIsBroken, volumePattern: { ls: 0, hd: 0, rs: 0, diminishing: false }
        };
      }
    }
  }

  if (!bestPattern) return { found: false, message: 'المنظومة لم ترصد نماذج Head & Shoulders (نشطة وقابلة للتداول) في الوقت الحالي.' };
  return bestPattern;
}

function renderHSDashboard(symbol, price, tf, closes, volumes, result) {
  if (!result.found) {
    document.getElementById('hs-pattern-card').innerHTML = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:30px; text-align:center; color:#ccc; font-size:0.8rem; font-family:\'Cairo\',sans-serif;">' + result.message + '</div>';
    document.getElementById('hs-stats-card').innerHTML = '';
    document.getElementById('hs-measure-card').innerHTML = '';
    document.getElementById('hs-conclusion').textContent = result.message;
    return;
  }

  var r = result, st = r.stats, pts = r.points, isTop = r.patternType === 'top', n = closes.length;
  
  // معالجة الضغط البصري: التركيز على نطاق النموذج الحالي فقط
  var chartStart = Math.max(0, pts.LS.idx - 8), chartEnd = n - 1;
  var chartCloses = closes.slice(chartStart, chartEnd + 1), chartVols = volumes.slice(chartStart, chartEnd + 1);

  var allP = chartCloses.slice();
  ['LS','T1','HD','T2','RS'].forEach(function(k) { allP.push(pts[k].price); });
  allP.push(r.target1, r.target2, r.target3, r.stopLoss);

  var minP = Math.min.apply(null, allP) * 0.995, maxP = Math.max.apply(null, allP) * 1.005, range = maxP - minP || Math.min.apply(null, allP) * 0.01;
  var svgW = 340, chartH = 180, volH = 45, svgH = chartH + volH + 10;
  var toX = function(idx) { return ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 30) + 15; };
  var toY = function(pr) { return 12 + (1 - (pr - minP) / range) * (chartH - 24); };
  var maxVol = Math.max.apply(null, chartVols);

  var ptC = {};
  ['LS','T1','HD','T2','RS'].forEach(function(k) { ptC[k] = { x: toX(pts[k].idx), y: toY(pts[k].price) }; });

  var nkSlope = (ptC.T2.y - ptC.T1.y) / (ptC.T2.x - ptC.T1.x || 1);
  var nkY_left = ptC.T1.y - nkSlope * (ptC.T1.x - 10), nkY_right = ptC.T2.y + nkSlope * (svgW - 10 - ptC.T2.x);

  var html = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; border-top:2px solid #ff6a00;">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#0a0a0a; border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:#ff6a00; font-weight:bold;">' + st.name + '</div><div style="font-size:0.55rem; color:#ccc; font-family:\'Cairo\',sans-serif;">' + st.nameAr + ' — ' + st.type + '</div></div>';
  html += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:#ff6a00; font-weight:bold;">' + r.accuracy + '%</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:1px;">SUCCESS</div></div></div>';

  html += '<div style="padding:4px 2px 0; background:#020208;">';
  html += '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  html += '<defs><linearGradient id="hsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6a00" stop-opacity="0.12"/><stop offset="100%" stop-color="#ff6a00" stop-opacity="0"/></linearGradient>';
  html += '<filter id="hsGl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';

  for (var gi = 1; gi <= 3; gi++) html += '<line x1="0" y1="' + (gi * chartH / 4) + '" x2="' + svgW + '" y2="' + (gi * chartH / 4) + '" stroke="#0a0a0a" stroke-width="0.5"/>';

  var areaStr = toX(chartStart) + ',' + chartH;
  for (var ai = 0; ai < chartCloses.length; ai++) areaStr += ' ' + toX(chartStart + ai) + ',' + toY(chartCloses[ai]);
  areaStr += ' ' + toX(chartEnd) + ',' + chartH;
  html += '<polygon points="' + areaStr + '" fill="url(#hsArea)"/>';

  var lineStr = '';
  for (var li = 0; li < chartCloses.length; li++) lineStr += toX(chartStart + li) + ',' + toY(chartCloses[li]) + ' ';
  html += '<polyline points="' + lineStr.trim() + '" fill="none" stroke="#555" stroke-width="1.8" stroke-linejoin="round"/>';

  html += '<polyline points="' + ptC.LS.x + ',' + ptC.LS.y + ' ' + ptC.T1.x + ',' + ptC.T1.y + ' ' + ptC.HD.x + ',' + ptC.HD.y + ' ' + ptC.T2.x + ',' + ptC.T2.y + ' ' + ptC.RS.x + ',' + ptC.RS.y + '" fill="none" stroke="#ff6a00" stroke-width="2" stroke-linejoin="round" filter="url(#hsGl)"/>';
  html += '<polygon points="' + ptC.LS.x + ',' + ptC.LS.y + ' ' + ptC.T1.x + ',' + ptC.T1.y + ' ' + ptC.HD.x + ',' + ptC.HD.y + '" fill="#ff6a00" fill-opacity="0.04"/>';
  html += '<polygon points="' + ptC.HD.x + ',' + ptC.HD.y + ' ' + ptC.T2.x + ',' + ptC.T2.y + ' ' + ptC.RS.x + ',' + ptC.RS.y + '" fill="#ff6a00" fill-opacity="0.04"/>';

  html += '<line x1="10" y1="' + nkY_left + '" x2="' + (svgW - 10) + '" y2="' + nkY_right + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.6"/>';
  html += '<rect x="' + (svgW - 70) + '" y="' + (nkY_right - 14) + '" width="58" height="12" rx="2" fill="#000" fill-opacity="0.9"/>';
  html += '<text x="' + (svgW - 41) + '" y="' + (nkY_right - 5) + '" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold" font-family="Share Tech Mono">NECKLINE</text>';

  var neckAtHead = toY(r.necklinePrice);
  html += '<line x1="' + ptC.HD.x + '" y1="' + ptC.HD.y + '" x2="' + ptC.HD.x + '" y2="' + neckAtHead + '" stroke="#ff6a0044" stroke-width="1" stroke-dasharray="3 3"/>';

  // رسم وتحديد الأهداف بوضوح على الشارت
  [ { y: toY(r.target1), l: 'T1', v: r.target1, c: '#fff' }, 
    { y: toY(r.target2), l: 'T2', v: r.target2, c: '#ccc' }, 
    { y: toY(r.target3), l: 'T3', v: r.target3, c: '#888' } ].forEach(function(t) {
    if (t.y > 5 && t.y < chartH) {
      html += '<line x1="' + ptC.RS.x + '" y1="' + t.y + '" x2="' + (svgW - 5) + '" y2="' + t.y + '" stroke="' + t.c + '" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6"/>';
      var txt = t.l + ' ' + formatPx(t.v);
      html += '<rect x="' + (svgW - 48) + '" y="' + (t.y - 7) + '" width="46" height="10" rx="2" fill="#000" opacity="0.8"/>';
      html += '<text x="' + (svgW - 5) + '" y="' + (t.y + 1) + '" text-anchor="end" fill="' + t.c + '" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">' + txt + '</text>';
    }
  });

  // رسم وقف الخسارة الهيكلي
  var slY = toY(r.stopLoss);
  if(slY > 5 && slY < chartH){
    html += '<line x1="' + toX(chartStart) + '" y1="' + slY + '" x2="' + (svgW - 5) + '" y2="' + slY + '" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.9"/>';
    html += '<rect x="' + (svgW - 50) + '" y="' + (slY - 7) + '" width="48" height="11" rx="2" fill="#000" opacity="0.9" stroke="#ff6a00" stroke-width="0.5"/>';
    html += '<text x="' + (svgW - 5) + '" y="' + (slY + 1.5) + '" text-anchor="end" fill="#ff6a00" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">SL ' + formatPx(r.stopLoss) + '</text>';
  }

  if (isTop) {
    html += '<line x1="' + (ptC.RS.x + 15) + '" y1="' + (ptC.RS.y + 5) + '" x2="' + (ptC.RS.x + 15) + '" y2="' + (ptC.RS.y + 30) + '" stroke="#ff6a00" stroke-width="2"/>';
    html += '<polygon points="' + (ptC.RS.x + 15) + ',' + (ptC.RS.y + 35) + ' ' + (ptC.RS.x + 10) + ',' + (ptC.RS.y + 25) + ' ' + (ptC.RS.x + 20) + ',' + (ptC.RS.y + 25) + '" fill="#ff6a00"/>';
  } else {
    html += '<line x1="' + (ptC.RS.x + 15) + '" y1="' + (ptC.RS.y - 5) + '" x2="' + (ptC.RS.x + 15) + '" y2="' + (ptC.RS.y - 30) + '" stroke="#fff" stroke-width="2"/>';
    html += '<polygon points="' + (ptC.RS.x + 15) + ',' + (ptC.RS.y - 35) + ' ' + (ptC.RS.x + 10) + ',' + (ptC.RS.y - 25) + ' ' + (ptC.RS.x + 20) + ',' + (ptC.RS.y - 25) + '" fill="#fff"/>';
  }

  var pointDefs = [
    { k: 'LS', label: 'LS', color: '#ff6a00' }, { k: 'T1', label: 'T1', color: '#fff' },
    { k: 'HD', label: 'HD', color: '#ff6a00' }, { k: 'T2', label: 'T2', color: '#fff' },
    { k: 'RS', label: 'RS', color: '#ff6a00' }
  ];

  pointDefs.forEach(function(pd) {
    var c = ptC[pd.k], isHead = pd.k === 'HD';
    var isPeak = isTop ? (pd.k === 'LS' || pd.k === 'HD' || pd.k === 'RS') : (pd.k === 'T1' || pd.k === 'T2');
    var isTopPoint = isTop ? isPeak : !isPeak;

    html += '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + (isHead ? 5 : 4) + '" fill="' + pd.color + '"/>';
    if (isHead) html += '<circle cx="' + c.x + '" cy="' + c.y + '" r="8" fill="none" stroke="#ff6a00" stroke-width="1" opacity="0.3"/>';

    var ly = isTopPoint ? c.y - 15 : c.y + 10;
    html += '<rect x="' + (c.x - 8) + '" y="' + (ly - 5) + '" width="16" height="10" rx="2" fill="#000" fill-opacity="0.9"/>';
    html += '<text x="' + c.x + '" y="' + (ly + 3) + '" text-anchor="middle" fill="' + pd.color + '" font-size="7" font-weight="bold" font-family="Share Tech Mono">' + pd.label + '</text>';
  });

  html += '<circle cx="' + toX(chartEnd) + '" cy="' + toY(price) + '" r="3.5" fill="#ff6a00"/>';

  for (var vi = 0; vi < chartVols.length; vi++) {
    var barH = (chartVols[vi] / maxVol) * (volH - 5), barY = chartH + volH - barH + 8;
    var realIdx = chartStart + vi;
    var isLSZone = Math.abs(realIdx - pts.LS.idx) <= 2, isHDZone = Math.abs(realIdx - pts.HD.idx) <= 2, isRSZone = Math.abs(realIdx - pts.RS.idx) <= 2;
    var barColor = isHDZone ? '#ff6a00' : isLSZone ? '#888' : isRSZone ? '#444' : '#ffffff';
    var barOp = isHDZone ? 0.7 : isLSZone ? 0.5 : isRSZone ? 0.4 : 0.08;
    html += '<rect x="' + (toX(realIdx) - 4) + '" y="' + barY + '" width="8" height="' + barH + '" rx="1" fill="' + barColor + '" opacity="' + barOp + '"/>';
  }

  html += '<line x1="0" y1="' + (chartH + 5) + '" x2="' + svgW + '" y2="' + (chartH + 5) + '" stroke="#1a1a1a" stroke-width="0.5"/>';
  html += '<text x="8" y="' + (chartH + 16) + '" fill="#888" font-size="5" font-family="Share Tech Mono">VOL</text>';
  html += '</svg></div>';

  html += '<div style="display:grid; grid-template-columns:repeat(5,1fr); border-top:1px solid #111;">';
  var stripLabels = isTop ?
    [{ k:'LS', l:'L.SHOULDER' },{ k:'T1', l:'TROUGH 1' },{ k:'HD', l:'HEAD' },{ k:'T2', l:'TROUGH 2' },{ k:'RS', l:'R.SHOULDER' }] :
    [{ k:'LS', l:'L.SHOULDER' },{ k:'T1', l:'PEAK 1' },{ k:'HD', l:'HEAD' },{ k:'T2', l:'PEAK 2' },{ k:'RS', l:'R.SHOULDER' }];

  stripLabels.forEach(function(item, i) {
    var isPrimary = item.k === 'LS' || item.k === 'HD' || item.k === 'RS';
    html += '<div style="padding:6px 2px; text-align:center; border-left:' + (i > 0 ? '1px solid #111' : 'none') + ';">';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:0.5px;">' + item.l + '</div>';
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + (isPrimary ? '#ff6a00' : '#fff') + '; font-weight:bold; direction:ltr;">' + formatPx(pts[item.k].price) + '</div></div>';
  });
  html += '</div></div>';
  document.getElementById('hs-pattern-card').innerHTML = html;

  var stHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
  var statItems = [ { label: 'FAIL RATE', value: st.failRate, color: '#ff6a00' }, { label: isTop ? 'AVG DECLINE' : 'AVG RISE', value: isTop ? st.avgDecline : st.avgRise, color: '#fff' }, { label: 'PULLBACK', value: st.pullbackRate, color: '#ccc' } ];
  statItems.forEach(function(s) {
    stHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:8px; text-align:center;">';
    stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#888; letter-spacing:1px; margin-bottom:4px;">' + s.label + '</div>';
    stHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + s.color + '; font-weight:bold;">' + s.value + '</div></div>';
  });
  stHtml += '</div>';
  document.getElementById('hs-stats-card').innerHTML = stHtml;

  // استبدال لوحة القياسات السابقة بلوحة الأهداف الشاملة (للتوافق مع التعديلات الجديدة)
  var tHtml = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;">';
  [{l:'TP1 (61.8%)',v:formatPx(r.target1),p:r.target1Pct,c:'#fff',bc:'#888'},{l:'TP2 (100%)',v:formatPx(r.target2),p:r.target2Pct,c:'#ccc',bc:'#ccc'},{l:'TP3 (161.8%)',v:formatPx(r.target3),p:r.target3Pct,c:'#888',bc:'#fff'},{l:'STOP LOSS',v:formatPx(r.stopLoss),p:r.stopPct,c:'#ff6a00',bc:'#ff6a00'}].forEach(function(t){
    tHtml += '<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:8px 4px;text-align:center;border-top:2px solid ' + t.bc + ';"><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.35rem;color:#888;letter-spacing:0.5px;margin-bottom:3px;">' + t.l + '</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.7rem;color:' + t.c + ';font-weight:bold;">' + t.v + '</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.5rem;color:' + t.c + ';margin-top:2px;">' + t.p + '</div></div>';
  });
  tHtml += '</div>';
  document.getElementById('hs-measure-card').innerHTML = tHtml;

  var conc = 'تم استكشاف ' + st.nameAr + ' (' + st.name + ') بمعدل نجاح إحصائي ' + r.accuracy + '% وفق معطيات Bulkowski. ';
  conc += 'تمركز الرأس عند ' + formatPx(pts.HD.price) + '، الكتف الأيسر ' + formatPx(pts.LS.price) + '، الكتف الأيمن ' + formatPx(pts.RS.price) + '. ';
  conc += 'قاعدة خط العنق الفاصل عند ' + formatPx(r.necklinePrice) + ' (' + r.necklineDesc + '). ';
  conc += r.isBroken ? 'أكدت الأسعار كسر خط العنق، وتفاعلت الأهداف السعرية. ' : 'يظل النموذج قيد التشكل بانتظار الإغلاق متجاوزاً خط العنق. ';
  conc += 'أهداف جني الأرباح المتدرجة: ' + formatPx(r.target1) + ' (TP1)، ' + formatPx(r.target2) + ' (TP2)، و ' + formatPx(r.target3) + ' (TP3). ';
  conc += 'يُنصح بالالتزام بالوقف الهيكلي الصارم عند ' + formatPx(r.stopLoss) + '.';
  document.getElementById('hs-conclusion').textContent = conc;
}



// ============================================================
// أداة Cup & Handle Scanner — Bulkowski Method (Fibonacci Adjusted)
// ============================================================

function fmtCryptoPrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + p.toFixed(8);
}

var CUP_DURATION_LIMITS = {
  '1h':  { min: 48, max: 720 },
  '4h':  { min: 30, max: 360 },
  '1d':  { min: 14, max: 182 },
  '1w':  { min: 7, max: 65 }
};

var CUP_STATS = {
  failRate: '5%', avgRise: '34%', throwbackRate: '58%',
  targetHitFull: '50%', targetHitHalf: '76%', targetHitExt: '25%',
  avgDays: '167 شمعة'
};

async function runCupHandle() {
  var coinInput = document.getElementById('cup-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('cup-tf').value;
  var btn = document.getElementById('cup-btn');

  if (!coinInput) return;
  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING CUP...';
  btn.disabled = true;

  try {
    var limit = tfInput === '1h' ? 500 : tfInput === '4h' ? 400 : 200;
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=' + limit);
    if (!res.ok) throw new Error('تعذر جلب البيانات.');
    var raw = await res.json();
    if (raw.length < 50) throw new Error('بيانات غير كافية للتحليل الهيكلي.');

    var candles = raw.map(function(k) {
      return { h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) };
    });

    var closes = candles.map(function(c) { return c.c; });
    var highs = candles.map(function(c) { return c.h; });
    var lows = candles.map(function(c) { return c.l; });
    var volumes = candles.map(function(c) { return c.v; });
    var price = closes[closes.length - 1];

    var result = detectCupHandle(highs, lows, closes, volumes, price, tfInput);
    renderCupDashboard(symbol, price, tfInput.toUpperCase(), closes, volumes, result);
    document.getElementById('cup-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function detectCupHandle(highs, lows, closes, volumes, price, tf) {
  var n = closes.length;
  var limits = CUP_DURATION_LIMITS[tf] || CUP_DURATION_LIMITS['1d'];

  var peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, n) : [];
  var troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, n) : [];

  if (peakIdxs.length < 2 || troughIdxs.length < 1) {
    return { found: false, message: 'لا توجد نقاط انعكاس كافية لتشكيل النموذج.' };
  }

  var bestCup = null;
  var bestScore = 0;

  for (var li = 0; li < peakIdxs.length - 1; li++) {
    for (var ri = li + 1; ri < peakIdxs.length; ri++) {
      var leftIdx = peakIdxs[li], rightIdx = peakIdxs[ri];
      var leftPrice = highs[leftIdx], rightPrice = highs[rightIdx];

      var cupWidth = rightIdx - leftIdx;
      if (cupWidth < limits.min || cupWidth > limits.max) continue;

      var lipDiff = Math.abs(leftPrice - rightPrice) / Math.max(leftPrice, rightPrice);
      if (lipDiff > 0.05) continue;

      var cupLowIdx = leftIdx, cupLowPrice = Infinity;
      for (var ci = leftIdx + 1; ci < rightIdx; ci++) {
        if (lows[ci] < cupLowPrice) { cupLowPrice = lows[ci]; cupLowIdx = ci; }
      }

      var cupDepth = (Math.max(leftPrice, rightPrice) - cupLowPrice) / Math.max(leftPrice, rightPrice);
      if (cupDepth < 0.10) continue;

      var thirdWidth = cupWidth / 3;
      var lowPosition = cupLowIdx - leftIdx;
      var isUShape = lowPosition > thirdWidth * 0.7 && lowPosition < thirdWidth * 2.3;
      if (!isUShape) continue;

      var minRise = (tf === '1h' || tf === '4h') ? 0.15 : 0.30;
      var priorLowIdx = 0, priorLow = closes[0];
      for (var pi = 1; pi < leftIdx; pi++) {
        if (closes[pi] < priorLow) { priorLow = closes[pi]; priorLowIdx = pi; }
      }
      var priorRise = (leftPrice - priorLow) / priorLow;
      if (priorRise < minRise) continue;

      var handleLowIdx = rightIdx, handleLowPrice = rightPrice;
      for (var hi = rightIdx + 1; hi < n; hi++) {
        if (lows[hi] < handleLowPrice) { handleLowPrice = lows[hi]; handleLowIdx = hi; }
      }

      var minHandleLen = (tf === '1h') ? 5 : (tf === '4h') ? 5 : (tf === '1d') ? 7 : 2;
      var handleLength = n - 1 - rightIdx;
      if (handleLength < minHandleLen) continue;

      var cupMidPrice = cupLowPrice + (Math.max(leftPrice, rightPrice) - cupLowPrice) / 2;
      if (handleLowPrice < cupMidPrice) continue; 

      var cupHeight = rightPrice - cupLowPrice;
      var handleDepth = rightPrice - handleLowPrice;
      var handleDepthPct = cupHeight > 0 ? handleDepth / cupHeight : 1;
      if (handleDepthPct > 0.50) continue; 

      var score = 0;
      score += isUShape ? 25 : 0;
      score += (1 - lipDiff * 20) * 20;
      if (cupDepth >= 0.15 && cupDepth <= 0.35) score += 20; else score += 10;
      
      var handleRatio = handleLength / cupWidth;
      if (handleRatio < 0.3) score += 15; else if (handleRatio < 0.5) score += 10;

      var volLeft = 0, volMid = 0, volRight = 0, segLen = Math.floor(cupWidth / 3);
      for (var vl = leftIdx; vl < leftIdx + segLen; vl++) volLeft += volumes[vl] || 0;
      for (var vm = leftIdx + segLen; vm < leftIdx + segLen * 2; vm++) volMid += volumes[vm] || 0;
      for (var vr = leftIdx + segLen * 2; vr <= rightIdx; vr++) volRight += volumes[vr] || 0;
      volLeft /= segLen || 1; volMid /= segLen || 1; volRight /= segLen || 1;
      if (volMid < volLeft && volRight > volMid) score += 10;
      if (leftPrice > rightPrice) score += 5;

      if (score > bestScore) {
        bestScore = score;
        var breakoutPrice = rightPrice;
        var target1 = rightPrice + (cupHeight * 0.618); // 61.8% Fibonacci
        var target2 = rightPrice + cupHeight;           // 100% Measured Move
        var target3 = rightPrice + (cupHeight * 1.618); // 161.8% Fibonacci Extension
        var stopLoss = handleLowPrice * 0.985;

        bestCup = {
          found: true, name: 'Cup with Handle', nameAr: 'كوب وعروة', type: 'استمراري صعودي', accuracy: 95,
          leftLip: { price: leftPrice, idx: leftIdx }, cupLow: { price: cupLowPrice, idx: cupLowIdx },
          rightLip: { price: rightPrice, idx: rightIdx }, handleLow: { price: handleLowPrice, idx: handleLowIdx }, handleEnd: { price: price, idx: n - 1 },
          cupWidth: cupWidth, cupHeight: cupHeight, cupHeightPct: (cupDepth * 100).toFixed(1) + '%', cupDepth: cupDepth,
          handleLength: handleLength, handleDepthPct: (handleDepthPct * 100).toFixed(0) + '%',
          lipDiff: ((rightPrice - leftPrice) / leftPrice * 100).toFixed(1) + '%', lipDiffSign: rightPrice >= leftPrice ? '+' : '',
          breakoutPrice: breakoutPrice, 
          target1: target1, target1Pct: '+' + ((target1 - price) / price * 100).toFixed(1) + '%',
          target2: target2, target2Pct: '+' + ((target2 - price) / price * 100).toFixed(1) + '%', 
          target3: target3, target3Pct: '+' + ((target3 - price) / price * 100).toFixed(1) + '%', 
          stopLoss: stopLoss,
          isBroken: price > breakoutPrice,
          validation: {
            priorRise: { value: (priorRise * 100).toFixed(0) + '%', pass: priorRise >= minRise, rule: 'صعود ' + (minRise * 100) + '% قبل الكوب' },
            cupShape: { value: 'U-Shape', pass: isUShape, rule: 'شكل U وليس V' },
            cupDuration: { value: cupWidth + ' شمعة', pass: true, rule: 'مدة مناسبة للفريم' },
            handlePosition: { value: Math.round((1 - handleDepthPct) * 100) + '%', pass: handleDepthPct < 0.5, rule: 'العروة في النصف العلوي' },
            lipBalance: { value: (lipDiff * 100).toFixed(1) + '%', pass: lipDiff < 0.05, rule: 'توازن الحواف (<5%)' }
          }
        };
      }
    }
  }

  if (!bestCup) return { found: false, message: 'لا أنماط Cup & Handle مكتشفة ضمن النطاق الزمني المحدد. يُرجى تغيير الفريم الزمني.' };
  return bestCup;
}

function renderCupDashboard(symbol, price, tf, closes, volumes, result) {
  if (!result.found) {
    document.getElementById('cup-pattern-card').innerHTML = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:30px; text-align:center; margin-bottom:6px; color:#ccc; font-size:0.8rem; font-family:\'Cairo\',sans-serif;">' + result.message + '</div>';
    ['cup-breakout-card','cup-validation-card','cup-stats-card','cup-targets-card','cup-measure-card'].forEach(id => document.getElementById(id).innerHTML = '');
    document.getElementById('cup-conclusion').textContent = result.message;
    return;
  }

  var r = result, n = closes.length;
  var chartStart = Math.max(0, r.leftLip.idx - 5), chartEnd = n - 1;
  var chartCloses = closes.slice(chartStart, chartEnd + 1), chartVols = volumes.slice(chartStart, chartEnd + 1);

  var allP = chartCloses.slice();
  allP.push(r.target1, r.target2, r.target3, r.cupLow.price);
  var minP = Math.min.apply(null, allP) * 0.995, maxP = Math.max.apply(null, allP) * 1.005, range = maxP - minP || 1;
  var svgW = 340, chartH = 190, volH = 40, svgH = chartH + volH + 10;
  var toX = function(idx) { return 15 + ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 30); };
  var toY = function(pr) { return 12 + (1 - (pr - minP) / range) * (chartH - 24); };
  var maxVol = Math.max.apply(null, chartVols);

  var html = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px; border-top:2px solid #fff;">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#0a0a0a; border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:#fff; font-weight:bold;">' + r.name + '</div><div style="font-size:0.55rem; color:#ccc; font-family:\'Cairo\',sans-serif;">' + r.nameAr + ' — ' + r.type + '</div></div>';
  html += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:#fff; font-weight:bold;">' + r.accuracy + '%</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:1px;">SUCCESS</div></div></div>';

  html += '<div style="padding:4px 2px 0; background:#020208;">';
  html += '<svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  html += '<defs><linearGradient id="cupArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff6a00" stop-opacity="0.15"/><stop offset="100%" stop-color="#ff6a00" stop-opacity="0.02"/></linearGradient>';
  html += '<linearGradient id="hndArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0.02"/></linearGradient>';
  html += '<filter id="cupGl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';

  for (var gi = 1; gi <= 3; gi++) html += '<line x1="0" y1="' + (gi * chartH / 4) + '" x2="' + svgW + '" y2="' + (gi * chartH / 4) + '" stroke="#0a0a0a" stroke-width="0.5"/>';

  var cupAreaPts = '';
  for (var ca = r.leftLip.idx; ca <= r.rightLip.idx; ca++) cupAreaPts += toX(ca) + ',' + toY(closes[ca]) + ' ';
  cupAreaPts += toX(r.rightLip.idx) + ',' + toY(r.rightLip.price) + ' ' + toX(r.leftLip.idx) + ',' + toY(r.leftLip.price);
  html += '<polygon points="' + cupAreaPts + '" fill="url(#cupArea)"/>';

  if (r.rightLip.idx < n - 1) {
    var hndAreaPts = '';
    for (var ha = r.rightLip.idx; ha < n; ha++) hndAreaPts += toX(ha) + ',' + toY(closes[ha]) + ' ';
    hndAreaPts += toX(n - 1) + ',' + toY(r.rightLip.price) + ' ' + toX(r.rightLip.idx) + ',' + toY(r.rightLip.price);
    html += '<polygon points="' + hndAreaPts + '" fill="url(#hndArea)"/>';
  }

  var lineStr = '';
  for (var li = 0; li < chartCloses.length; li++) lineStr += toX(chartStart + li) + ',' + toY(chartCloses[li]) + ' ';
  html += '<polyline points="' + lineStr.trim() + '" fill="none" stroke="#555" stroke-width="1.8" stroke-linejoin="round"/>';

  var cupLineStr = '';
  for (var cli = r.leftLip.idx; cli <= r.rightLip.idx; cli++) cupLineStr += toX(cli) + ',' + toY(closes[cli]) + ' ';
  html += '<polyline points="' + cupLineStr.trim() + '" fill="none" stroke="#ff6a00" stroke-width="2.5" stroke-linejoin="round" filter="url(#cupGl)"/>';

  if (r.rightLip.idx < n - 1) {
    var hndLineStr = '';
    for (var hli = r.rightLip.idx; hli < n; hli++) hndLineStr += toX(hli) + ',' + toY(closes[hli]) + ' ';
    html += '<polyline points="' + hndLineStr.trim() + '" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" opacity="0.7"/>';
  }

  var bpY = toY(r.breakoutPrice);
  html += '<line x1="' + toX(r.rightLip.idx) + '" y1="' + bpY + '" x2="' + (svgW - 5) + '" y2="' + bpY + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.6"/>';
  html += '<rect x="' + (svgW - 68) + '" y="' + (bpY - 13) + '" width="64" height="13" rx="2" fill="#fff"/>';
  html += '<text x="' + (svgW - 36) + '" y="' + (bpY - 3) + '" text-anchor="middle" fill="#000" font-size="6.5" font-weight="bold" font-family="Share Tech Mono">BREAKOUT</text>';

  html += '<line x1="' + toX(r.cupLow.idx) + '" y1="' + toY(r.rightLip.price) + '" x2="' + toX(r.cupLow.idx) + '" y2="' + toY(r.cupLow.price) + '" stroke="#ff6a0044" stroke-width="1" stroke-dasharray="3 3"/>';
  html += '<text x="' + (toX(r.cupLow.idx) - 6) + '" y="' + ((toY(r.rightLip.price) + toY(r.cupLow.price)) / 2) + '" fill="#ff6a00" font-size="5" font-weight="bold" font-family="Share Tech Mono" text-anchor="end">' + r.cupHeightPct + '</text>';

  // رسم خطوط الأهداف الثلاثة
  var t1Y = toY(r.target1), t2Y = toY(r.target2), t3Y = toY(r.target3);
  
  if (t1Y > 5 && t1Y < chartH) {
    html += '<line x1="' + toX(r.rightLip.idx) + '" y1="' + t1Y + '" x2="' + (svgW - 5) + '" y2="' + t1Y + '" stroke="#888" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.4"/>';
    html += '<text x="' + (svgW - 5) + '" y="' + (t1Y - 3) + '" text-anchor="end" fill="#888" font-size="5" font-family="Share Tech Mono">T1 ' + fmtCryptoPrice(r.target1) + '</text>';
  }
  if (t2Y > 5 && t2Y < chartH) {
    html += '<line x1="' + toX(r.rightLip.idx) + '" y1="' + t2Y + '" x2="' + (svgW - 5) + '" y2="' + t2Y + '" stroke="#ccc" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.6"/>';
    html += '<text x="' + (svgW - 5) + '" y="' + (t2Y - 3) + '" text-anchor="end" fill="#ccc" font-size="5" font-family="Share Tech Mono">T2 ' + fmtCryptoPrice(r.target2) + '</text>';
  }
  if (t3Y > 5 && t3Y < chartH) {
    html += '<line x1="' + toX(r.rightLip.idx) + '" y1="' + t3Y + '" x2="' + (svgW - 5) + '" y2="' + t3Y + '" stroke="#fff" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.8"/>';
    html += '<text x="' + (svgW - 5) + '" y="' + (t3Y - 3) + '" text-anchor="end" fill="#fff" font-size="5" font-family="Share Tech Mono">T3 ' + fmtCryptoPrice(r.target3) + '</text>';
  }

  var arrowX = toX(n - 1) + 12;
  html += '<line x1="' + arrowX + '" y1="' + (bpY - 2) + '" x2="' + arrowX + '" y2="' + (bpY - 22) + '" stroke="#fff" stroke-width="2"/>';
  html += '<polygon points="' + arrowX + ',' + (bpY - 26) + ' ' + (arrowX - 5) + ',' + (bpY - 18) + ' ' + (arrowX + 5) + ',' + (bpY - 18) + '" fill="#fff"/>';

  html += '<text x="' + ((toX(r.leftLip.idx) + toX(r.rightLip.idx)) / 2) + '" y="' + (toY(r.cupLow.price) + 16) + '" text-anchor="middle" fill="#ff6a00" font-size="8" font-weight="bold" opacity="0.35" font-family="Share Tech Mono">CUP</text>';
  if (r.rightLip.idx < n - 3) html += '<text x="' + ((toX(r.rightLip.idx) + toX(n - 1)) / 2) + '" y="' + (toY(r.handleLow.price) + 14) + '" text-anchor="middle" fill="#fff" font-size="7" font-weight="bold" opacity="0.25" font-family="Share Tech Mono">HANDLE</text>';

  var keyPoints = [
    { k: 'leftLip', label: 'L.LIP', color: '#ff6a00', top: true }, { k: 'cupLow', label: 'LOW', color: '#ff6a00', top: false },
    { k: 'rightLip', label: 'R.LIP', color: '#fff', top: true }, { k: 'handleLow', label: 'H.LOW', color: '#fff', top: false }
  ];

  keyPoints.forEach(function(kp) {
    var pt = r[kp.k], cx = toX(pt.idx), cy = toY(pt.price), isLow = kp.k === 'cupLow';
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (isLow ? 5 : 4) + '" fill="' + kp.color + '"/>';
    if (isLow) html += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="none" stroke="#ff6a00" stroke-width="1" opacity="0.3"/>';
    var ly = kp.top ? cy - 15 : cy + 10;
    html += '<rect x="' + (cx - 14) + '" y="' + (ly - 5) + '" width="28" height="10" rx="2" fill="#000" fill-opacity="0.9"/>';
    html += '<text x="' + cx + '" y="' + (ly + 3) + '" text-anchor="middle" fill="' + kp.color + '" font-size="6" font-weight="bold" font-family="Share Tech Mono">' + kp.label + '</text>';
    var py = kp.top ? cy - 26 : cy + 22;
    html += '<text x="' + cx + '" y="' + py + '" text-anchor="middle" fill="#ccc" font-size="5" font-family="Share Tech Mono">' + fmtCryptoPrice(pt.price) + '</text>';
  });

  html += '<circle cx="' + toX(n - 1) + '" cy="' + toY(price) + '" r="3.5" fill="#ff6a00"/>';

  for (var vi = 0; vi < chartVols.length; vi++) {
    var barH = (chartVols[vi] / maxVol) * (volH - 5), barY = chartH + volH - barH + 8, realIdx = chartStart + vi;
    var isCupZone = realIdx >= r.leftLip.idx && realIdx <= r.rightLip.idx, isHandleZone = realIdx > r.rightLip.idx;
    var barColor = isCupZone ? '#ff6a00' : isHandleZone ? '#fff' : '#fff';
    var barOp = isCupZone ? 0.4 : isHandleZone ? 0.2 : 0.06;
    html += '<rect x="' + (toX(realIdx) - 3) + '" y="' + barY + '" width="6" height="' + barH + '" rx="1" fill="' + barColor + '" opacity="' + barOp + '"/>';
  }

  html += '<line x1="0" y1="' + (chartH + 5) + '" x2="' + svgW + '" y2="' + (chartH + 5) + '" stroke="#1a1a1a" stroke-width="0.5"/>';
  html += '<text x="8" y="' + (chartH + 16) + '" fill="#888" font-size="5" font-family="Share Tech Mono">VOL</text></svg></div>';

  html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; border-top:1px solid #111;">';
  [{ l:'PAIR',v:symbol.replace('USDT',''),c:'#ff6a00' },{ l:'PRICE',v:fmtCryptoPrice(price),c:'#fff' },{ l:'CUP',v:r.cupWidth+' bars',c:'#ff6a00' },{ l:'HANDLE',v:r.handleLength+' bars',c:'#fff' }].forEach(function(item,i) {
    html += '<div style="padding:6px 2px; text-align:center; border-left:' + (i > 0 ? '1px solid #111' : 'none') + ';"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:0.5px;">' + item.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + item.c + '; font-weight:bold;">' + item.v + '</div></div>';
  });
  html += '</div></div>';
  document.getElementById('cup-pattern-card').innerHTML = html;

  var brkStatus = r.isBroken ? 'CONFIRMED' : 'PENDING', brkColor = r.isBroken ? '#fff' : '#ff6a00';
  var brkBg = r.isBroken ? 'rgba(255,255,255,0.04)' : 'rgba(255,106,0,0.04)';
  var bHtml = '<div style="background:' + brkBg + '; border:1px solid ' + (r.isBroken ? 'rgba(255,255,255,0.1)' : 'rgba(255,106,0,0.15)') + '; border-radius:4px; padding:12px; border-right:3px solid ' + brkColor + ';">';
  bHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + brkColor + '; font-weight:bold; letter-spacing:1px;">BREAKOUT PRICE</div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:3px; color:#000; background:' + brkColor + ';">' + brkStatus + '</span></div>';
  bHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.6rem; color:' + brkColor + '; font-weight:bold; direction:ltr; text-align:left;">' + fmtCryptoPrice(r.breakoutPrice) + '</div>';
  bHtml += '<div style="font-size:0.6rem; color:#ccc; margin-top:6px; font-family:\'Cairo\',sans-serif;">' + (r.isBroken ? 'اخترق السعر مستوى الكسر — النموذج مؤكّد. الهدف نشط.' : 'لم يتم الاختراق بعد. الإغلاق فوق ' + fmtCryptoPrice(r.breakoutPrice) + ' يؤكد النموذج ويفعّل الهدف.') + '</div>';
  bHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#888; margin-top:4px;">وقف الخسارة المقترح: ' + fmtCryptoPrice(r.stopLoss) + ' (تحت قاع العروة)</div></div>';
  document.getElementById('cup-breakout-card').innerHTML = bHtml;

  var vHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:10px;">';
  vHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><span style="color:#ff6a00; font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; font-weight:bold; letter-spacing:1px;">VALIDATION</span><span style="color:#888; font-family:\'Share Tech Mono\',monospace; font-size:0.45rem;">BULKOWSKI CRITERIA</span></div>';
  for (var vk in r.validation) {
    var vv = r.validation[vk];
    vHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #0d0d0d;">';
    vHtml += '<span style="font-size:0.55rem; color:#ccc; flex:1; font-family:\'Cairo\',sans-serif;">' + vv.rule + '</span>';
    vHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold; margin:0 8px;">' + vv.value + '</span>';
    vHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; font-weight:900; padding:2px 5px; border-radius:3px; color:' + (vv.pass ? '#000' : '#ff6a00') + '; background:' + (vv.pass ? '#fff' : 'transparent') + '; border:' + (vv.pass ? 'none' : '1px solid #ff6a00') + ';">' + (vv.pass ? 'PASS' : 'FAIL') + '</span></div>';
  }
  vHtml += '</div>';
  document.getElementById('cup-validation-card').innerHTML = vHtml;

  var sHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
  [{ l:'FAIL RATE',v:CUP_STATS.failRate,c:'#ff6a00' },{ l:'AVG RISE',v:CUP_STATS.avgRise,c:'#fff' },{ l:'THROWBACK',v:CUP_STATS.throwbackRate,c:'#ccc' }].forEach(function(s) {
    sHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:8px; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#888; letter-spacing:1px; margin-bottom:4px;">' + s.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + s.c + '; font-weight:bold;">' + s.v + '</div></div>';
  });
  sHtml += '</div>';
  document.getElementById('cup-stats-card').innerHTML = sHtml;

  var tHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
  tHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:8px; text-align:center; border-top:2px solid #888;">';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:1px; margin-bottom:4px;">TARGET 1 (61.8%)</div>';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#fff; font-weight:bold;">' + fmtCryptoPrice(r.target1) + '</div>';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#fff; margin-top:2px;">' + r.target1Pct + '</div></div>';
  
  tHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:8px; text-align:center; border-top:2px solid #ccc;">';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:1px; margin-bottom:4px;">TARGET 2 (100%)</div>';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#ccc; font-weight:bold;">' + fmtCryptoPrice(r.target2) + '</div>';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc; margin-top:2px;">' + r.target2Pct + '</div></div>';

  tHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:8px; text-align:center; border-top:2px solid #fff;">';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:1px; margin-bottom:4px;">TARGET 3 (161.8%)</div>';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#fff; font-weight:bold;">' + fmtCryptoPrice(r.target3) + '</div>';
  tHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#fff; margin-top:2px;">' + r.target3Pct + '</div></div></div>';
  document.getElementById('cup-targets-card').innerHTML = tHtml;

  var mHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:10px 12px; border-right:3px solid #ff6a00;">';
  mHtml += '<div style="color:#ff6a00; font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; font-weight:bold; letter-spacing:1px; margin-bottom:8px;">FIBONACCI MEASURE RULE</div>';
  mHtml += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">';
  [{ l:'R.LIP',v:fmtCryptoPrice(r.rightLip.price),c:'#fff' },{ l:'CUP LOW',v:fmtCryptoPrice(r.cupLow.price),c:'#ff6a00' },{ l:'HEIGHT',v:fmtCryptoPrice(r.cupHeight),c:'#ccc' }].forEach(function(m) {
    mHtml += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888;">' + m.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + m.c + '; font-weight:bold;">' + m.v + '</div></div>';
  });
  mHtml += '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; color:#888; text-align:center; margin-top:6px;">T1 (61.8%) | T2 (100%) | T3 (161.8%)</div></div>';
  document.getElementById('cup-measure-card').innerHTML = mHtml;

  var conc = 'تم استكشاف نموذج الكوب والعروة (Cup with Handle). ';
  conc += 'اتساع الكوب ' + r.cupWidth + ' شمعة وعمقه ' + r.cupHeightPct + '. ';
  conc += 'الحافة اليسرى عند ' + fmtCryptoPrice(r.leftLip.price) + ' مقابل ' + fmtCryptoPrice(r.rightLip.price) + ' للحافة اليمنى (فارق ' + r.lipDiffSign + r.lipDiff + '). ';
  conc += 'مستوى التأكيد (BREAKOUT): ' + fmtCryptoPrice(r.breakoutPrice) + ' — ';
  if (r.isBroken) conc += 'الأسعار تتداول أعلى مستوى الكسر، مما يؤكد تفعيل النموذج. ';
  else conc += 'النموذج قيد التشكيل، يشترط الإغلاق أعلى مستوى الكسر لتأكيده. ';
  conc += 'الهدف السعري الأول (T1): ' + fmtCryptoPrice(r.target1) + ' (' + r.target1Pct + '). ';
  conc += 'الهدف السعري الأخير (T3): ' + fmtCryptoPrice(r.target3) + ' (' + r.target3Pct + '). ';
  conc += 'يُنصح بوقف الخسارة أسفل ' + fmtCryptoPrice(r.stopLoss) + ' لتجنب الانعكاسات المفاجئة.';
  document.getElementById('cup-conclusion').textContent = conc;
}

// ============================================================
// أداة Wedge Pattern Scanner — Quant Level Logic (Convex Hull Bounds)
// ============================================================

function fmtWedgePrice(p) {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(3);
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + p.toFixed(8);
}

async function runWedgeScanner() {
  var coinInput = document.getElementById('wedge-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('wedge-tf').value;
  var btn = document.getElementById('wedge-btn');
  if (!coinInput) return;
  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING WEDGE...';
  btn.disabled = true;

  try {
    var limit = tfInput === '1h' ? 500 : tfInput === '4h' ? 400 : 250;
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=' + limit);
    if (!res.ok) throw new Error('تعذر جلب البيانات السعرية.');
    var raw = await res.json();
    if (raw.length < 40) throw new Error('عمق البيانات غير كافٍ للتحليل الهيكلي.');

    var candles = raw.map(function(k) { return { h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) }; });
    var closes = candles.map(function(c) { return c.c; });
    var highs = candles.map(function(c) { return c.h; });
    var lows = candles.map(function(c) { return c.l; });
    var volumes = candles.map(function(c) { return c.v; });
    var price = closes[closes.length - 1];

    var result = detectWedge(highs, lows, closes, volumes, price);
    renderWedgeDashboard(symbol, price, tfInput.toUpperCase(), closes, volumes, result);
    document.getElementById('wedge-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function detectWedge(highs, lows, closes, volumes, price) {
  var n = closes.length;
  var peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, n) : [];
  var troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, n) : [];

  if (peakIdxs.length < 3 || troughIdxs.length < 2) return { found: false, message: 'المعطيات السعرية لا تشكل هيكلاً هندسياً صالحاً.' };

  var bestWedge = null, bestScore = 0;
  var startSearch = Math.max(0, peakIdxs.length - 8);

  for (var ui = startSearch; ui <= peakIdxs.length - 2; ui++) {
    var upperPivots = [];
    for (var uj = ui; uj < Math.min(ui + 4, peakIdxs.length); uj++) upperPivots.push({ idx: peakIdxs[uj], price: highs[peakIdxs[uj]] });
    if (upperPivots.length < 2) continue;

    var wStart = upperPivots[0].idx, wEnd = upperPivots[upperPivots.length - 1].idx;
    var lowerPivots = [];
    for (var li = 0; li < troughIdxs.length; li++) {
      if (troughIdxs[li] >= wStart - 5 && troughIdxs[li] <= wEnd + 5) lowerPivots.push({ idx: troughIdxs[li], price: lows[troughIdxs[li]] });
    }
    if (lowerPivots.length < 2) continue;

    var allIdxs = upperPivots.concat(lowerPivots);
    var wedgeStart = Math.min.apply(null, allIdxs.map(function(p) { return p.idx; }));
    var wedgeEnd = Math.max.apply(null, allIdxs.map(function(p) { return p.idx; }));
    var wedgeWidth = wedgeEnd - wedgeStart;
    if (wedgeWidth < 15 || wedgeWidth > 150) continue;

    // استخراج خط المقاومة (المماس الخارجي للقمم)
    var bestUpperLine = null;
    for (var i = 0; i < upperPivots.length - 1; i++) {
      for (var j = i + 1; j < upperPivots.length; j++) {
        var mU = (upperPivots[j].price - upperPivots[i].price) / (upperPivots[j].idx - upperPivots[i].idx);
        var bU = upperPivots[i].price - mU * upperPivots[i].idx;
        var validU = true;
        for (var k = 0; k < upperPivots.length; k++) {
          if (upperPivots[k].price > mU * upperPivots[k].idx + bU + 0.000001) { validU = false; break; }
        }
        if (validU) { bestUpperLine = { slope: mU, intercept: bU }; break; }
      }
      if (bestUpperLine) break;
    }
    if (!bestUpperLine) {
      var mfU = (upperPivots[upperPivots.length - 1].price - upperPivots[0].price) / (upperPivots[upperPivots.length - 1].idx - upperPivots[0].idx);
      var bfU = Math.max.apply(null, upperPivots.map(function(p) { return p.price - mfU * p.idx; }));
      bestUpperLine = { slope: mfU, intercept: bfU };
    }
    var upperLine = bestUpperLine;

    // استخراج خط الدعم (المماس الخارجي للقيعان)
    var bestLowerLine = null;
    for (var x = 0; x < lowerPivots.length - 1; x++) {
      for (var y = x + 1; y < lowerPivots.length; y++) {
        var mL = (lowerPivots[y].price - lowerPivots[x].price) / (lowerPivots[y].idx - lowerPivots[x].idx);
        var bL = lowerPivots[x].price - mL * lowerPivots[x].idx;
        var validL = true;
        for (var z = 0; z < lowerPivots.length; z++) {
          if (lowerPivots[z].price < mL * lowerPivots[z].idx + bL - 0.000001) { validL = false; break; }
        }
        if (validL) { bestLowerLine = { slope: mL, intercept: bL }; break; }
      }
      if (bestLowerLine) break;
    }
    if (!bestLowerLine) {
      var mfL = (lowerPivots[lowerPivots.length - 1].price - lowerPivots[0].price) / (lowerPivots[lowerPivots.length - 1].idx - lowerPivots[0].idx);
      var bfL = Math.min.apply(null, lowerPivots.map(function(p) { return p.price - mfL * p.idx; }));
      bestLowerLine = { slope: mfL, intercept: bfL };
    }
    var lowerLine = bestLowerLine;

    var bothRising = upperLine.slope > 0 && lowerLine.slope > 0;
    var bothFalling = upperLine.slope < 0 && lowerLine.slope < 0;
    if (!bothRising && !bothFalling) continue;

    var apexIdx = (lowerLine.intercept - upperLine.intercept) / (upperLine.slope - lowerLine.slope);
    if (apexIdx < wedgeEnd) continue; 

    var heightAtStart = (upperLine.intercept + upperLine.slope * wedgeStart) - (lowerLine.intercept + lowerLine.slope * wedgeStart);
    var heightAtEnd = (upperLine.intercept + upperLine.slope * wedgeEnd) - (lowerLine.intercept + lowerLine.slope * wedgeEnd);
    
    if (heightAtStart <= 0 || heightAtEnd <= 0 || heightAtEnd >= heightAtStart) continue;

    var convergenceRate = (heightAtStart - heightAtEnd) / heightAtStart;
    if (convergenceRate < 0.05) continue;

    var insideCount = 0;
    for (var ci = wedgeStart; ci <= wedgeEnd; ci++) {
      var upperVal = upperLine.intercept + upperLine.slope * ci;
      var lowerVal = lowerLine.intercept + lowerLine.slope * ci;
      var tolerance = (upperVal - lowerVal) * 0.15;
      if (closes[ci] <= upperVal + tolerance && closes[ci] >= lowerVal - tolerance) insideCount++;
    }
    var insideRatio = insideCount / (wedgeWidth + 1);
    if (insideRatio < 0.75) continue;

    var volFirst = 0, volLast = 0, halfW = Math.floor(wedgeWidth / 2);
    for (var vf = wedgeStart; vf < wedgeStart + halfW; vf++) volFirst += volumes[vf] || 0;
    for (var vl = wedgeEnd - halfW; vl <= wedgeEnd; vl++) volLast += volumes[vl] || 0;
    volFirst /= halfW || 1; volLast /= halfW || 1;
    var volumeDecay = volFirst > 0 ? (volFirst - volLast) / volFirst : 0;

    var score = 0;
    score += (upperPivots.length + lowerPivots.length >= 5) ? 25 : 10;
    score += Math.min(convergenceRate * 100, 20);
    score += insideRatio * 20;
    if (volumeDecay > 0.1) score += 20; else if (volumeDecay > 0) score += 10;
    if (wedgeWidth >= 20 && wedgeWidth <= 90) score += 15; else score += 5;
    score = Math.min(Math.round(score), 98);

    if (score > bestScore && score >= 50) {
      bestScore = score;
      var isRising = bothRising;
      var confirmLine = isRising ? lowerLine : upperLine;
      var confirmPrice = confirmLine.intercept + confirmLine.slope * (n - 1);
      
      var wedgeBaseHeight = Math.abs(heightAtStart);
      var t1, t2, t3, stopLoss, stopDesc;
      
      if (isRising) {
        t1 = confirmPrice - (wedgeBaseHeight * 0.618);
        t2 = confirmPrice - (wedgeBaseHeight * 1.000);
        t3 = confirmPrice - (wedgeBaseHeight * 1.618);
        stopLoss = Math.max.apply(null, upperPivots.map(function(p){return p.price;})) * 1.005;
        stopDesc = "إغلاق أعلى خط المقاومة أو تجاوز " + fmtWedgePrice(stopLoss);
      } else {
        t1 = confirmPrice + (wedgeBaseHeight * 0.618);
        t2 = confirmPrice + (wedgeBaseHeight * 1.000);
        t3 = confirmPrice + (wedgeBaseHeight * 1.618);
        stopLoss = Math.min.apply(null, lowerPivots.map(function(p){return p.price;})) * 0.995;
        stopDesc = "إغلاق أسفل خط الدعم أو كسر " + fmtWedgePrice(stopLoss);
      }

      var isBroken = isRising ? (price < confirmPrice) : (price > confirmPrice);
      var angleDeg = Math.abs(Math.atan2(heightAtStart - heightAtEnd, wedgeWidth) * 180 / Math.PI);

      bestWedge = {
        found: true, type: isRising ? 'rising' : 'falling', typeEn: isRising ? 'Rising Wedge' : 'Falling Wedge',
        typeAr: isRising ? 'وتد صاعد' : 'وتد هابط', signal: isRising ? 'BEARISH' : 'BULLISH', signalAr: isRising ? 'انعكاسي هبوطي' : 'انعكاسي صعودي',
        score: score, upperPivots: upperPivots, lowerPivots: lowerPivots, upperLine: upperLine, lowerLine: lowerLine,
        wedgeStart: wedgeStart, wedgeEnd: wedgeEnd, wedgeWidth: wedgeWidth, convergenceAngle: angleDeg.toFixed(1) + '°',
        confirmPrice: confirmPrice, isBroken: isBroken, breakoutStatus: isBroken ? 'CONFIRMED' : 'PENDING',
        target1: t1, target1Pct: ((t1 - price) / price * 100).toFixed(1) + '%',
        target2: t2, target2Pct: ((t2 - price) / price * 100).toFixed(1) + '%',
        target3: t3, target3Pct: ((t3 - price) / price * 100).toFixed(1) + '%',
        stopLoss: stopLoss, stopDesc: stopDesc, apexIdx: apexIdx,
        heightAtStart: heightAtStart, heightAtEnd: heightAtEnd,
        convergenceRate: (convergenceRate * 100).toFixed(1) + '%',
        volumeDecay: volumeDecay > 0.1, volumeDecayPct: (volumeDecay * 100).toFixed(0) + '%', insideRatio: (insideRatio * 100).toFixed(0) + '%'
      };
    }
  }

  if (!bestWedge) return { found: false, message: 'التحليل الخوارزمي لم يرصد نموذج وتد مستقر حالياً. اختبر إطاراً زمنياً مختلفاً.' };
  return bestWedge;
}

function renderWedgeDashboard(symbol, price, tf, closes, volumes, result) {
  if (!result.found) {
    document.getElementById('wedge-pattern-card').innerHTML = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:30px; text-align:center; color:#ccc; font-size:0.8rem; font-family:\'Cairo\',sans-serif;">' + result.message + '</div>';
    ['wedge-breakout-card','wedge-measurements','wedge-stats-card','wedge-targets-card'].forEach(id => document.getElementById(id).innerHTML = '');
    document.getElementById('wedge-conclusion').textContent = result.message;
    return;
  }

  var r = result, isRising = r.type === 'rising', sigColor = isRising ? '#ff6a00' : '#fff', n = closes.length;
  var chartStart = Math.max(0, r.wedgeStart - 5), chartEnd = n - 1;
  var chartCloses = closes.slice(chartStart, chartEnd + 1), chartVols = volumes.slice(chartStart, chartEnd + 1);

  var allP = chartCloses.slice();
  allP.push(r.target1, r.target2, r.target3, r.stopLoss, r.upperPivots[0].price, r.lowerPivots[0].price);
  var minP = Math.min.apply(null, allP) * 0.995, maxP = Math.max.apply(null, allP) * 1.005, range = maxP - minP || 1;
  var svgW = 340, chartH = 180, volH = 40, svgH = chartH + volH + 10;
  var toX = function(idx) { return 15 + ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 30); };
  var toY = function(pr) { return 12 + (1 - (pr - minP) / range) * (chartH - 24); };
  var maxVol = Math.max.apply(null, chartVols);

  var drawEndIdx = Math.min(chartEnd + 10, r.apexIdx);
  var extX = toX(drawEndIdx);
  
  var uLineStartX = toX(r.wedgeStart);
  var uLineStartY = toY(r.upperLine.intercept + r.upperLine.slope * r.wedgeStart);
  var lLineStartX = toX(r.wedgeStart);
  var lLineStartY = toY(r.lowerLine.intercept + r.lowerLine.slope * r.wedgeStart);
  var uExtY = toY(r.upperLine.intercept + r.upperLine.slope * drawEndIdx);
  var lExtY = toY(r.lowerLine.intercept + r.lowerLine.slope * drawEndIdx);

  var html = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px; border-top:2px solid ' + sigColor + ';">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#0a0a0a; border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:' + sigColor + '; font-weight:bold;">' + r.typeEn + '</div><div style="font-size:0.55rem; color:#ccc; font-family:\'Cairo\',sans-serif;">' + r.typeAr + ' — ' + r.signalAr + '</div></div>';
  html += '<div style="display:flex; align-items:center; gap:10px;"><div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:' + sigColor + '; font-weight:bold;">' + r.score + '%</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:1px;">SCORE</div></div>';
  html += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; font-weight:900; padding:3px 8px; border-radius:3px; color:#000; background:' + sigColor + ';">' + r.signal + '</span></div></div>';

  html += '<div style="padding:4px 2px 0; background:#020208;"><svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  html += '<defs><linearGradient id="wdgFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + sigColor + '" stop-opacity="0.08"/><stop offset="100%" stop-color="' + sigColor + '" stop-opacity="0.01"/></linearGradient>';
  html += '<filter id="wdgGl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';

  for (var gi = 1; gi <= 3; gi++) html += '<line x1="0" y1="' + (gi * chartH / 4) + '" x2="' + svgW + '" y2="' + (gi * chartH / 4) + '" stroke="#0a0a0a" stroke-width="0.5"/>';

  html += '<polygon points="' + uLineStartX + ',' + uLineStartY + ' ' + extX + ',' + uExtY + ' ' + extX + ',' + lExtY + ' ' + lLineStartX + ',' + lLineStartY + '" fill="url(#wdgFill)"/>';

  var lineStr = '';
  for (var li = 0; li < chartCloses.length; li++) lineStr += toX(chartStart + li) + ',' + toY(chartCloses[li]) + ' ';
  html += '<polyline points="' + lineStr.trim() + '" fill="none" stroke="#555" stroke-width="1.8" stroke-linejoin="round"/>';

  html += '<line x1="' + uLineStartX + '" y1="' + uLineStartY + '" x2="' + extX + '" y2="' + uExtY + '" stroke="' + sigColor + '" stroke-width="2" stroke-dasharray="6 3" filter="url(#wdgGl)"/>';
  html += '<line x1="' + lLineStartX + '" y1="' + lLineStartY + '" x2="' + extX + '" y2="' + lExtY + '" stroke="' + sigColor + '" stroke-width="2" stroke-dasharray="6 3" opacity="0.7"/>';

  r.upperPivots.forEach(function(pt, i) {
    html += '<circle cx="' + toX(pt.idx) + '" cy="' + toY(pt.price) + '" r="4" fill="' + sigColor + '"/>';
    html += '<text x="' + toX(pt.idx) + '" y="' + (toY(pt.price) - 10) + '" text-anchor="middle" fill="' + sigColor + '" font-size="5" font-weight="bold" font-family="Share Tech Mono">U' + (i + 1) + '</text>';
  });
  r.lowerPivots.forEach(function(pt, i) {
    html += '<circle cx="' + toX(pt.idx) + '" cy="' + toY(pt.price) + '" r="4" fill="#fff"/>';
    html += '<text x="' + toX(pt.idx) + '" y="' + (toY(pt.price) + 14) + '" text-anchor="middle" fill="#fff" font-size="5" font-weight="bold" font-family="Share Tech Mono">L' + (i + 1) + '</text>';
  });

  var cpY = toY(r.confirmPrice);
  if (cpY > 5 && cpY < chartH) {
    html += '<line x1="' + toX(r.wedgeEnd) + '" y1="' + cpY + '" x2="' + (svgW - 5) + '" y2="' + cpY + '" stroke="' + sigColor + '" stroke-width="1.5" stroke-dasharray="5 3" opacity="0.6"/>';
    html += '<rect x="' + (svgW - 72) + '" y="' + (cpY + (isRising ? 3 : -14)) + '" width="68" height="12" rx="2" fill="' + sigColor + '"/>';
    html += '<text x="' + (svgW - 38) + '" y="' + (cpY + (isRising ? 11 : -5)) + '" text-anchor="middle" fill="#000" font-size="6" font-weight="bold" font-family="Share Tech Mono">CONFIRM</text>';
  }

  [ { y: toY(r.target1), l: 'T1', v: r.target1, c: '#888' }, 
    { y: toY(r.target2), l: 'T2', v: r.target2, c: '#ccc' }, 
    { y: toY(r.target3), l: 'T3', v: r.target3, c: '#fff' } ].forEach(function(t) {
    if (t.y > 5 && t.y < chartH) {
      html += '<line x1="' + toX(r.wedgeEnd) + '" y1="' + t.y + '" x2="' + (svgW - 5) + '" y2="' + t.y + '" stroke="' + t.c + '" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6"/>';
      var txt = t.l + ' ' + fmtWedgePrice(t.v);
      html += '<rect x="' + (svgW - 48) + '" y="' + (t.y - 7) + '" width="46" height="10" rx="2" fill="#000" opacity="0.8"/>';
      html += '<text x="' + (svgW - 5) + '" y="' + (t.y + 1) + '" text-anchor="end" fill="' + t.c + '" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">' + txt + '</text>';
    }
  });

  var arrowX = toX(n - 1) + 14;
  if (isRising) {
    html += '<line x1="' + arrowX + '" y1="' + (cpY + 3) + '" x2="' + arrowX + '" y2="' + (cpY + 25) + '" stroke="#ff6a00" stroke-width="2"/>';
    html += '<polygon points="' + arrowX + ',' + (cpY + 30) + ' ' + (arrowX - 5) + ',' + (cpY + 22) + ' ' + (arrowX + 5) + ',' + (cpY + 22) + '" fill="#ff6a00"/>';
  } else {
    html += '<line x1="' + arrowX + '" y1="' + (cpY - 3) + '" x2="' + arrowX + '" y2="' + (cpY - 25) + '" stroke="#fff" stroke-width="2"/>';
    html += '<polygon points="' + arrowX + ',' + (cpY - 30) + ' ' + (arrowX - 5) + ',' + (cpY - 22) + ' ' + (arrowX + 5) + ',' + (cpY - 22) + '" fill="#fff"/>';
  }

  html += '<circle cx="' + toX(n - 1) + '" cy="' + toY(price) + '" r="3.5" fill="#ff6a00"/>';

  for (var vi = 0; vi < chartVols.length; vi++) {
    var barH = (chartVols[vi] / maxVol) * (volH - 5), barY = chartH + volH - barH + 8, realIdx = chartStart + vi;
    var inWedge = realIdx >= r.wedgeStart && realIdx <= r.wedgeEnd;
    html += '<rect x="' + (toX(realIdx) - 3) + '" y="' + barY + '" width="6" height="' + barH + '" rx="1" fill="' + (inWedge ? '#ff6a00' : '#fff') + '" opacity="' + (inWedge ? 0.4 : 0.06) + '"/>';
  }
  html += '<line x1="0" y1="' + (chartH + 5) + '" x2="' + svgW + '" y2="' + (chartH + 5) + '" stroke="#1a1a1a" stroke-width="0.5"/>';
  html += '<text x="8" y="' + (chartH + 16) + '" fill="#888" font-size="5" font-family="Share Tech Mono">VOL</text></svg></div>';

  html += '<div style="display:grid; grid-template-columns:repeat(5,1fr); border-top:1px solid #111;">';
  [{ l:'PAIR',v:symbol.replace('USDT',''),c:'#ff6a00' },{ l:'PRICE',v:fmtWedgePrice(price),c:'#fff' },{ l:'TYPE',v:isRising?'RISING':'FALLING',c:sigColor },{ l:'WIDTH',v:r.wedgeWidth+' bars',c:'#ccc' },{ l:'CONV',v:r.convergenceAngle,c:'#888' }].forEach(function(item,i) {
    html += '<div style="padding:6px 2px; text-align:center; border-left:' + (i > 0 ? '1px solid #111' : 'none') + ';"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.35rem; color:#888; letter-spacing:0.5px;">' + item.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:' + item.c + '; font-weight:bold;">' + item.v + '</div></div>';
  });
  html += '</div></div>';
  document.getElementById('wedge-pattern-card').innerHTML = html;

  var bHtml = '<div style="background:' + (r.isBroken ? 'rgba(255,255,255,0.03)' : 'rgba(255,106,0,0.03)') + '; border:1px solid ' + (r.isBroken ? 'rgba(255,255,255,0.1)' : 'rgba(255,106,0,0.15)') + '; border-radius:4px; padding:12px; border-right:3px solid ' + (r.isBroken ? '#fff' : '#ff6a00') + ';">';
  bHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><span style="color:' + sigColor + '; font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; font-weight:bold; letter-spacing:1px;">BREAKOUT PRICE</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; font-weight:900; padding:2px 6px; border-radius:3px; color:#000; background:' + (r.isBroken ? '#fff' : '#ff6a00') + ';">' + r.breakoutStatus + '</span></div>';
  bHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.4rem; color:' + sigColor + '; font-weight:bold; direction:ltr; text-align:left;">' + fmtWedgePrice(r.confirmPrice) + '</div>';
  bHtml += '<div style="font-size:0.6rem; color:#ccc; margin-top:6px; font-family:\'Cairo\',sans-serif;">' + (isRising ? 'الإغلاق تحت ' + fmtWedgePrice(r.confirmPrice) + ' يؤكد كسر خط الدعم — النموذج يتفعّل هبوطياً.' : 'الإغلاق فوق ' + fmtWedgePrice(r.confirmPrice) + ' يؤكد اختراق خط المقاومة — النموذج يتفعّل صعودياً.') + '</div>';
  bHtml += '<div style="font-family:\'Cairo\',sans-serif; font-size:0.55rem; color:#888; margin-top:8px; border-top:1px solid #1a1a1a; padding-top:6px;">إبطال النموذج (Stop Loss): ' + r.stopDesc + '</div></div>';
  document.getElementById('wedge-breakout-card').innerHTML = bHtml;

  var mHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:10px;">';
  mHtml += '<div style="color:#ff6a00; font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; font-weight:bold; letter-spacing:1px; margin-bottom:8px;">STRUCTURAL MEASUREMENTS</div>';
  [ { l: 'ارتفاع بداية النموذج', v: fmtWedgePrice(r.heightAtStart) }, { l: 'نسبة التقارب الهندسية', v: r.convergenceRate }, { l: 'معدل انكماش الحجم', v: r.volumeDecayPct }, { l: 'كثافة الأسعار داخل النطاق', v: r.insideRatio }, { l: 'نقاط الارتكاز المكتشفة', v: (r.upperPivots.length + r.lowerPivots.length) + ' نقاط' } ].forEach(function(m, i) {
    mHtml += '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:' + (i < 4 ? '1px solid #0d0d0d' : 'none') + ';"><span style="font-size:0.55rem; color:#ccc; font-family:\'Cairo\',sans-serif;">' + m.l + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold;">' + m.v + '</span></div>';
  });
  mHtml += '</div>';
  document.getElementById('wedge-measurements').innerHTML = mHtml;

  var sHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
  [{ l:'FAIL RATE',v:'8%',c:'#ff6a00' },{ l:'AVG MOVE',v:'29%',c:'#fff' },{ l:'PULLBACK',v:'53%',c:'#ccc' }].forEach(function(s) {
    sHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:8px; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#888; letter-spacing:1px; margin-bottom:4px;">' + s.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:' + s.c + '; font-weight:bold;">' + s.v + '</div></div>';
  });
  sHtml += '</div>';
  document.getElementById('wedge-stats-card').innerHTML = sHtml;

  var tHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
  [{ l:'T1 (61.8%)',v:fmtWedgePrice(r.target1),p:r.target1Pct,c:'#fff',bc:'#888' },
   { l:'T2 (100%)',v:fmtWedgePrice(r.target2),p:r.target2Pct,c:'#ccc',bc:'#ccc' },
   { l:'T3 (161.8%)',v:fmtWedgePrice(r.target3),p:r.target3Pct,c:'#ff6a00',bc:'#fff' }].forEach(function(t) {
    tHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:10px; text-align:center; border-top:2px solid ' + t.bc + ';"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:#888; letter-spacing:1px; margin-bottom:4px;">' + t.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:' + t.c + '; font-weight:bold;">' + t.v + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:' + t.c + '; margin-top:2px;">' + t.p + '</div></div>';
  });
  tHtml += '</div>';
  document.getElementById('wedge-targets-card').innerHTML = tHtml;

  var conc = 'تم استكشاف ' + r.typeAr + ' (' + r.typeEn + ') بدرجة يقين خوارزمية تبلغ ' + r.score + '%. ';
  conc += 'تم رصد تقارب هندسي في خطوط الاتجاه بزاوية ' + r.convergenceAngle + ' مع انكماش السيولة، مما يرفع من موثوقية الانعكاس. ';
  conc += 'مستوى تفعيل النموذج يقع عند ' + fmtWedgePrice(r.confirmPrice) + ' — ';
  if (r.isBroken) conc += 'تشير المعطيات الحالية إلى نجاح الكسر وتفعيل الموجة السعرية. ';
  else conc += (isRising ? 'يشترط إغلاق شمعة أسفل هذا المستوى لتأكيد الهبوط.' : 'يشترط إغلاق شمعة أعلى هذا المستوى لتأكيد الصعود.') + ' ';
  conc += 'تتمركز مستويات جني الأرباح المتدرجة عند ' + fmtWedgePrice(r.target1) + ' (T1) لتأمين الصفقة، ووصولاً لامتداد ' + fmtWedgePrice(r.target3) + ' (T3) للموجات الزخمة. ';
  conc += 'الالتزام بوقف الخسارة الهيكلي (' + fmtWedgePrice(r.stopLoss) + ') ضروري لإدارة المخاطر.';
  document.getElementById('wedge-conclusion').textContent = conc;
}

// ============================================================
// أداة Double Top / Bottom Scanner — Quant Level Logic (Active Only)
// ============================================================

async function runDoublePattern() {
  var coin = document.getElementById('dbl-symbol').value.trim().toUpperCase();
  var tf = document.getElementById('dbl-tf').value;
  var btn = document.getElementById('dbl-btn');
  if (!coin) return;
  var symbol = coin.includes('USDT') ? coin : coin + 'USDT';
  btn.innerText = 'SCANNING...'; btn.disabled = true;

  try {
    var limit = tf === '1h' ? 500 : tf === '4h' ? 300 : 200;
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tf + '&limit=' + limit);
    if (!res.ok) throw new Error('تعذر جلب البيانات السعرية.');
    var raw = await res.json();
    if (raw.length < 40) throw new Error('بيانات غير كافية.');
    
    var candles = raw.map(function(k) { return { h:parseFloat(k[2]), l:parseFloat(k[3]), c:parseFloat(k[4]), v:parseFloat(k[5]) }; });
    var closes=candles.map(function(c){return c.c;}), highs=candles.map(function(c){return c.h;});
    var lows=candles.map(function(c){return c.l;}), volumes=candles.map(function(c){return c.v;});
    var price = closes[closes.length-1];

    var result = detectDoublePattern(highs, lows, closes, volumes, price);
    renderDblDashboard(symbol, price, tf.toUpperCase(), closes, volumes, result);
    document.getElementById('dbl-dashboard').style.display = 'block';
  } catch(e) { 
    alert(e.message); 
  } finally { 
    btn.innerText = 'START'; btn.disabled = false; 
  }
}

function calcRSIat(closes, idx, period) {
  if (idx < period) return 50;
  var gains = 0, losses = 0;
  for (var i = idx - period + 1; i <= idx; i++) {
    var d = closes[i] - closes[i-1];
    if(d > 0) gains += d; else losses += Math.abs(d);
  }
  gains /= period; losses /= period;
  if(losses === 0) return 100;
  return Math.round((100 - 100 / (1 + gains / losses)) * 10) / 10;
}

function detectDoublePattern(highs, lows, closes, volumes, price) {
  var n = closes.length;
  var peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, n) : [];
  var troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, n) : [];

  var bestPattern = null;
  var bestScore = 0;

  var startP = Math.max(0, peakIdxs.length - 8);
  var startT = Math.max(0, troughIdxs.length - 8);

  // === Double Top ===
  for (var pi = startP; pi < peakIdxs.length - 1; pi++) {
    var p1Idx = peakIdxs[pi], p2Idx = peakIdxs[pi+1];
    var p1 = highs[p1Idx], p2 = highs[p2Idx];

    var spacing = p2Idx - p1Idx;
    if (spacing < 10 || spacing > 80) continue;

    var peakDiff = Math.abs(p1 - p2) / Math.max(p1, p2);
    if (peakDiff > 0.03) continue;
    if (p2 > p1 * 1.005) continue;

    var nkIdx = p1Idx, nkPrice = Infinity;
    for (var ni = p1Idx + 1; ni < p2Idx; ni++) {
      if (lows[ni] < nkPrice) { nkPrice = lows[ni]; nkIdx = ni; }
    }
    
    var patternHeight = Math.max(p1, p2) - nkPrice;
    if (patternHeight / Math.max(p1, p2) < 0.02) continue;

    // حساب الأهداف والوقف مسبقاً لاستخدامها في فلتر الحداثة
    var tp1 = nkPrice - patternHeight * 0.5;
    var tp2 = nkPrice - patternHeight;
    var tp3 = nkPrice - patternHeight * 1.618;
    var sl = Math.max(p1, p2) * 1.005;

    // فلتر النماذج النشطة (Active Only Filter)
    if (n - 1 - p2Idx > 60) continue; // النموذج قديم جداً
    if (price > sl) continue;         // النموذج فشل وضرب الوقف
    if (price < tp3) continue;        // النموذج حقق أهدافه وانتهى

    var isBroken = false, confirmCandle = -1, volSpike = false;
    for (var bi = p2Idx + 1; bi < n; bi++) {
      if (closes[bi] < nkPrice) {
        isBroken = true; confirmCandle = bi;
        var avgVol = 0;
        for (var av = Math.max(0, bi - 20); av < bi; av++) avgVol += volumes[av];
        avgVol /= Math.min(20, bi);
        volSpike = volumes[bi] > avgVol * 1.3;
        break;
      }
    }

    var volP1 = 0, volP2 = 0, vc = 0;
    for(var v1 = Math.max(0, p1Idx - 2); v1 <= Math.min(n - 1, p1Idx + 2); v1++){volP1 += volumes[v1]; vc++;}
    volP1 /= vc || 1; vc = 0;
    for(var v2 = Math.max(0, p2Idx - 2); v2 <= Math.min(n - 1, p2Idx + 2); v2++){volP2 += volumes[v2]; vc++;}
    volP2 /= vc || 1;
    var volDecayPct = volP1 > 0 ? ((volP1 - volP2) / volP1 * 100) : 0;

    var rsi1 = calcRSIat(closes, p1Idx, 14);
    var rsi2 = calcRSIat(closes, p2Idx, 14);
    var rsiDivergence = rsi2 < rsi1;

    var score = 0;
    var symScore = Math.round((1 - peakDiff / 0.03) * 30); score += Math.max(0, symScore);
    var timeScore = 0;
    if (spacing >= 15 && spacing <= 60) timeScore = 20; else if (spacing >= 10 && spacing <= 80) timeScore = 12;
    score += timeScore;
    var momScore = 0;
    if (rsiDivergence) momScore = 15;
    if (rsi1 > 65) momScore += 5;
    score += Math.min(momScore, 20);
    var volScore = 0;
    if (volDecayPct > 15) volScore = 15; else if (volDecayPct > 5) volScore = 10; else if (volDecayPct > 0) volScore = 5;
    score += volScore;
    var rejScore = 0;
    var p2Candle = highs[p2Idx] - closes[p2Idx];
    var p2Body = Math.abs(closes[p2Idx] - (p2Idx > 0 ? closes[p2Idx - 1] : closes[p2Idx]));
    if (p2Body > 0 && p2Candle / p2Body > 1.5) rejScore = 15; else if (p2 >= p1 * 0.997 && p2 <= p1 * 1.003) rejScore = 10; else rejScore = 5;
    score += rejScore;
    score = Math.min(score, 100);

    if (score > bestScore && score >= 40) {
      bestScore = score;
      bestPattern = {
        found: true, type: 'double_top', typeEn: 'Double Top', typeAr: 'قمة مزدوجة',
        signal: 'BEARISH', signalAr: 'انعكاسي هبوطي', score: score,
        peak1: {price: p1, idx: p1Idx}, neckline: {price: nkPrice, idx: nkIdx}, peak2: {price: p2, idx: p2Idx},
        peakDiff: (peakDiff * 100).toFixed(2) + '%', peakSpacing: spacing,
        patternHeight: patternHeight, patternHeightPct: (patternHeight / Math.max(p1, p2) * 100).toFixed(1) + '%',
        breakout: {price: nkPrice, confirmed: isBroken, confirmCandle: confirmCandle, volumeSpike: volSpike, status: isBroken ? 'CONFIRMED' : 'PENDING'},
        targets: {tp1: tp1, tp1Pct: ((tp1 - price) / price * 100).toFixed(1) + '%', tp2: tp2, tp2Pct: ((tp2 - price) / price * 100).toFixed(1) + '%', tp3: tp3, tp3Pct: ((tp3 - price) / price * 100).toFixed(1) + '%', stopLoss: sl, stopPct: '+' + ((sl - price) / price * 100).toFixed(1) + '%'},
        scoring: {
          symmetry: {score: symScore, max: 30, detail: 'فارق ' + ((peakDiff * 100).toFixed(2)) + '% بين القمتين'},
          timing: {score: timeScore, max: 20, detail: spacing + ' شمعة بين القمتين'},
          momentum: {score: Math.min(momScore, 20), max: 20, detail: 'RSI ' + (rsiDivergence ? 'تباعد سلبي' : 'بدون تباعد') + ' (' + rsi1 + '→' + rsi2 + ')'},
          volume: {score: volScore, max: 15, detail: 'حجم القمة الثانية ' + (volDecayPct > 0 ? 'أقل ' + Math.round(volDecayPct) + '%' : 'مماثل')},
          rejection: {score: rejScore, max: 15, detail: rejScore >= 10 ? 'رفض سعري واضح' : 'رفض سعري ضعيف'}
        },
        rsiDivergence: {peak1RSI: rsi1, peak2RSI: rsi2, type: rsiDivergence ? 'سلبي' : 'بدون'}
      };
    }
  }

  // === Double Bottom ===
  for (var bi2 = startT; bi2 < troughIdxs.length - 1; bi2++) {
    var b1Idx = troughIdxs[bi2], b2Idx = troughIdxs[bi2+1];
    var b1 = lows[b1Idx], b2 = lows[b2Idx];
    var bSpacing = b2Idx - b1Idx;
    
    if (bSpacing < 10 || bSpacing > 80) continue;
    var bDiff = Math.abs(b1 - b2) / Math.min(b1, b2);
    if (bDiff > 0.03) continue;
    if (b2 < b1 * 0.995) continue;

    var bNkIdx = b1Idx, bNkPrice = -Infinity;
    for (var bni = b1Idx + 1; bni < b2Idx; bni++) {
      if (highs[bni] > bNkPrice) { bNkPrice = highs[bni]; bNkIdx = bni; }
    }
    var bHeight = bNkPrice - Math.min(b1, b2);
    if (bHeight / bNkPrice < 0.02) continue;

    var bTp1 = bNkPrice + bHeight * 0.5;
    var bTp2 = bNkPrice + bHeight;
    var bTp3 = bNkPrice + bHeight * 1.618;
    var bSl = Math.min(b1, b2) * 0.995;

    // فلتر النماذج النشطة للقاع المزدوج
    if (n - 1 - b2Idx > 60) continue; 
    if (price < bSl) continue;         
    if (price > bTp3) continue;        

    var bIsBroken = false, bConfirm = -1, bVolSpike = false;
    for (var bbi = b2Idx + 1; bbi < n; bbi++) {
      if (closes[bbi] > bNkPrice) {
        bIsBroken = true; bConfirm = bbi;
        var bAvgVol = 0;
        for(var bav = Math.max(0, bbi - 20); bav < bbi; bav++) bAvgVol += volumes[bav];
        bAvgVol /= Math.min(20, bbi);
        bVolSpike = volumes[bbi] > bAvgVol * 1.3;
        break;
      }
    }

    var bVolP1 = 0, bVolP2 = 0, bvc = 0;
    for(var bv1 = Math.max(0, b1Idx - 2); bv1 <= Math.min(n - 1, b1Idx + 2); bv1++){bVolP1 += volumes[bv1]; bvc++;}
    bVolP1 /= bvc || 1; bvc = 0;
    for(var bv2 = Math.max(0, b2Idx - 2); bv2 <= Math.min(n - 1, b2Idx + 2); bv2++){bVolP2 += volumes[bv2]; bvc++;}
    bVolP2 /= bvc || 1;
    var bVolDecay = bVolP1 > 0 ? ((bVolP1 - bVolP2) / bVolP1 * 100) : 0;

    var bRsi1 = calcRSIat(closes, b1Idx, 14);
    var bRsi2 = calcRSIat(closes, b2Idx, 14);
    var bRsiDiv = bRsi2 > bRsi1;

    var bScore = 0;
    var bSym = Math.round((1 - bDiff / 0.03) * 30); bScore += Math.max(0, bSym);
    var bTime = (bSpacing >= 15 && bSpacing <= 60) ? 20 : 12; bScore += bTime;
    var bMom = bRsiDiv ? 15 : 0; if(bRsi1 < 35) bMom += 5; bScore += Math.min(bMom, 20);
    var bVol = bVolDecay > 15 ? 15 : bVolDecay > 5 ? 10 : bVolDecay > 0 ? 5 : 0; bScore += bVol;
    var bRej = 10; bScore += bRej;
    bScore = Math.min(bScore, 100);

    if (bScore > bestScore && bScore >= 40) {
      bestScore = bScore;
      bestPattern = {
        found: true, type: 'double_bottom', typeEn: 'Double Bottom', typeAr: 'قاع مزدوج',
        signal: 'BULLISH', signalAr: 'انعكاسي صعودي', score: bScore,
        peak1: {price: b1, idx: b1Idx}, neckline: {price: bNkPrice, idx: bNkIdx}, peak2: {price: b2, idx: b2Idx},
        peakDiff: (bDiff * 100).toFixed(2) + '%', peakSpacing: bSpacing,
        patternHeight: bHeight, patternHeightPct: (bHeight / bNkPrice * 100).toFixed(1) + '%',
        breakout: {price: bNkPrice, confirmed: bIsBroken, confirmCandle: bConfirm, volumeSpike: bVolSpike, status: bIsBroken ? 'CONFIRMED' : 'PENDING'},
        targets: {tp1: bTp1, tp1Pct: '+' + ((bTp1 - price) / price * 100).toFixed(1) + '%', tp2: bTp2, tp2Pct: '+' + ((bTp2 - price) / price * 100).toFixed(1) + '%', tp3: bTp3, tp3Pct: '+' + ((bTp3 - price) / price * 100).toFixed(1) + '%', stopLoss: bSl, stopPct: ((bSl - price) / price * 100).toFixed(1) + '%'},
        scoring: {
          symmetry: {score: bSym, max: 30, detail: 'فارق ' + (bDiff * 100).toFixed(2) + '% بين القاعين'},
          timing: {score: bTime, max: 20, detail: bSpacing + ' شمعة بين القاعين'},
          momentum: {score: Math.min(bMom, 20), max: 20, detail: 'RSI ' + (bRsiDiv ? 'تباعد إيجابي' : 'بدون تباعد') + ' (' + bRsi1 + '→' + bRsi2 + ')'},
          volume: {score: bVol, max: 15, detail: 'حجم القاع الثاني ' + (bVolDecay > 0 ? 'أقل ' + Math.round(bVolDecay) + '%' : 'مماثل')},
          rejection: {score: bRej, max: 15, detail: 'رفض سعري عند القاع الثاني'}
        },
        rsiDivergence: {peak1RSI: bRsi1, peak2RSI: bRsi2, type: bRsiDiv ? 'إيجابي' : 'بدون'}
      };
    }
  }

  if (!bestPattern) return { found: false, message: 'المنظومة لم ترصد نماذج Double Top/Bottom (نشطة وقابلة للتداول) في الوقت الحالي.' };
  return bestPattern;
}

function renderDblDashboard(symbol, price, tf, closes, volumes, result) {
  if (!result.found) {
    document.getElementById('dbl-chart-card').innerHTML = '<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:30px;text-align:center;margin-bottom:6px;color:#ccc;font-size:0.8rem;font-family:\'Cairo\',sans-serif;">' + result.message + '</div>';
    ['dbl-breakout-card', 'dbl-score-card', 'dbl-targets-card'].forEach(id => document.getElementById(id).innerHTML = '');
    document.getElementById('dbl-conclusion').textContent = result.message;
    return;
  }

  var r = result, n = closes.length, isTop = r.type === 'double_top';
  var sigColor = isTop ? '#ff6a00' : '#fff';
  var pts = r.peak1, nk = r.neckline, pts2 = r.peak2;

  var chartStart = Math.max(0, pts.idx - Math.floor(r.peakSpacing * 0.5));
  var chartEnd = n - 1;
  var chartCloses = closes.slice(chartStart, chartEnd + 1);
  var chartVols = volumes.slice(chartStart, chartEnd + 1);
  
  var allP = chartCloses.slice(); 
  allP.push(r.targets.tp1, r.targets.tp2, r.targets.tp3, r.targets.stopLoss, nk.price);
  
  var minP = Math.min.apply(null, allP) * 0.995, maxP = Math.max.apply(null, allP) * 1.005, range = maxP - minP || 1;
  var svgW = 340, chartH = 185, volH = 40, svgH = chartH + volH + 10;
  
  var toX = function(idx) { return 15 + ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 30); };
  var toY = function(pr) { return 12 + (1 - (pr - minP) / range) * (chartH - 24); };
  var maxVol = Math.max.apply(null, chartVols);

  var html = '<div style="background:#060606;border:1px solid #1a1a1a;border-radius:4px;overflow:hidden;margin-bottom:6px;border-top:2px solid ' + sigColor + ';">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#0a0a0a;border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.8rem;color:' + sigColor + ';font-weight:bold;">' + r.typeEn + '</div><div style="font-size:0.55rem;color:#ccc;font-family:\'Cairo\',sans-serif;">' + r.typeAr + ' — ' + r.signalAr + '</div></div>';
  html += '<div style="display:flex;align-items:center;gap:10px;"><div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace;font-size:1.1rem;color:' + sigColor + ';font-weight:bold;">' + r.score + '%</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.35rem;color:#888;letter-spacing:1px;">SCORE</div></div>';
  html += '<span style="font-family:\'Share Tech Mono\',monospace;font-size:0.5rem;font-weight:900;padding:3px 8px;border-radius:3px;color:#000;background:' + sigColor + ';">' + r.signal + '</span></div></div>';

  html += '<div style="padding:4px 2px 0;background:#020208;"><svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  html += '<defs><filter id="dGl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';

  for(var gi = 1; gi <= 3; gi++) html += '<line x1="0" y1="' + (gi * chartH / 4) + '" x2="' + svgW + '" y2="' + (gi * chartH / 4) + '" stroke="#0a0a0a" stroke-width="0.5"/>';

  var lStr = '';
  for(var li = 0; li < chartCloses.length; li++) lStr += toX(chartStart + li) + ',' + toY(chartCloses[li]) + ' ';
  html += '<polyline points="' + lStr.trim() + '" fill="none" stroke="#555" stroke-width="1.8" stroke-linejoin="round"/>';

  var polyPts = toX(pts.idx) + ',' + toY(nk.price) + ' ' + toX(pts.idx) + ',' + toY(pts.price) + ' ' + toX(nk.idx) + ',' + toY(nk.price) + ' ' + toX(pts2.idx) + ',' + toY(pts2.price) + ' ' + toX(pts2.idx) + ',' + toY(nk.price);
  html += '<polygon points="' + polyPts + '" fill="' + sigColor + '" fill-opacity="0.08"/>';

  html += '<polyline points="' + toX(pts.idx) + ',' + toY(pts.price) + ' ' + toX(nk.idx) + ',' + toY(nk.price) + ' ' + toX(pts2.idx) + ',' + toY(pts2.price) + '" fill="none" stroke="' + sigColor + '" stroke-width="2.5" stroke-linejoin="round" filter="url(#dGl)"/>';

  html += '<line x1="5" y1="' + toY(nk.price) + '" x2="' + (svgW - 5) + '" y2="' + toY(nk.price) + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>';
  html += '<rect x="' + (svgW - 68) + '" y="' + (toY(nk.price) - 13) + '" width="62" height="12" rx="2" fill="#000" fill-opacity="0.9"/>';
  html += '<text x="' + (svgW - 37) + '" y="' + (toY(nk.price) - 4) + '" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold" font-family="Share Tech Mono">NECKLINE</text>';

  var midX = (toX(pts.idx) + toX(pts2.idx)) / 2;
  html += '<line x1="' + midX + '" y1="' + toY(pts.price) + '" x2="' + midX + '" y2="' + toY(nk.price) + '" stroke="#ff6a0033" stroke-width="1" stroke-dasharray="3 3"/>';
  html += '<text x="' + (midX + 6) + '" y="' + ((toY(pts.price) + toY(nk.price)) / 2) + '" fill="#ff6a00" font-size="5" font-weight="bold" font-family="Share Tech Mono">' + r.patternHeightPct + '</text>';

  [[pts, 'P1', true], [nk, 'NK', !isTop], [pts2, 'P2', true]].forEach(function(def){
    var pt = def[0], lab = def[1], isTopPt = def[2], isPrimary = lab !== 'NK';
    var cx = toX(pt.idx), cy = toY(pt.price);
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (isPrimary ? 5 : 4) + '" fill="' + (isPrimary ? sigColor : '#fff') + '"/>';
    if(isPrimary) html += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="none" stroke="' + sigColor + '" stroke-width="1" opacity="0.3"/>';
    var ly = isTopPt ? cy - 15 : cy + 10;
    html += '<rect x="' + (cx - 10) + '" y="' + (ly - 5) + '" width="20" height="10" rx="2" fill="#000" fill-opacity="0.9"/>';
    html += '<text x="' + cx + '" y="' + (ly + 3) + '" text-anchor="middle" fill="' + (isPrimary ? sigColor : '#fff') + '" font-size="7" font-weight="bold" font-family="Share Tech Mono">' + lab + '</text>';
    html += '<text x="' + cx + '" y="' + (isTopPt ? cy - 26 : cy + 22) + '" text-anchor="middle" fill="#ccc" font-size="5" font-family="Share Tech Mono">' + (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(pt.price) : pt.price) + '</text>';
  });

  html += '<text x="' + toX(pts.idx) + '" y="' + (isTop ? toY(pts.price) - 36 : toY(pts.price) + 32) + '" text-anchor="middle" fill="#888" font-size="4.5" font-family="Share Tech Mono">RSI ' + r.rsiDivergence.peak1RSI + '</text>';
  html += '<text x="' + toX(pts2.idx) + '" y="' + (isTop ? toY(pts2.price) - 36 : toY(pts2.price) + 32) + '" text-anchor="middle" fill="#ff6a00" font-size="4.5" font-weight="bold" font-family="Share Tech Mono">RSI ' + r.rsiDivergence.peak2RSI + '</text>';

  [['tp1', 'TP1', '#fff'], ['tp2', 'TP2', '#ccc'], ['tp3', 'TP3', '#888']].forEach(function(t) {
    var tY = toY(r.targets[t[0]]);
    if (tY > 5 && tY < chartH) {
      html += '<line x1="' + toX(nk.idx) + '" y1="' + tY + '" x2="' + (svgW - 5) + '" y2="' + tY + '" stroke="' + t[2] + '" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6"/>';
      var txt = t[1] + ' ' + (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(r.targets[t[0]]) : r.targets[t[0]]);
      html += '<rect x="' + (svgW - 48) + '" y="' + (tY - 7) + '" width="46" height="10" rx="2" fill="#000" opacity="0.8"/>';
      html += '<text x="' + (svgW - 5) + '" y="' + (tY + 1) + '" text-anchor="end" fill="' + t[2] + '" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">' + txt + '</text>';
    }
  });

  var slY = toY(r.targets.stopLoss);
  if(slY > 5 && slY < chartH){
    html += '<line x1="' + toX(chartStart) + '" y1="' + slY + '" x2="' + (svgW - 5) + '" y2="' + slY + '" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.9"/>';
    html += '<rect x="' + (svgW - 50) + '" y="' + (slY - 7) + '" width="48" height="11" rx="2" fill="#000" opacity="0.9" stroke="#ff6a00" stroke-width="0.5"/>';
    html += '<text x="' + (svgW - 5) + '" y="' + (slY + 1.5) + '" text-anchor="end" fill="#ff6a00" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">SL ' + (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(r.targets.stopLoss) : r.targets.stopLoss) + '</text>';
  }

  var arX = toX(r.breakout.confirmCandle > 0 ? r.breakout.confirmCandle : n - 1) + 12;
  if(isTop){
    html += '<line x1="' + arX + '" y1="' + (toY(nk.price) + 5) + '" x2="' + arX + '" y2="' + (toY(nk.price) + 28) + '" stroke="#ff6a00" stroke-width="2"/>';
    html += '<polygon points="' + arX + ',' + (toY(nk.price) + 33) + ' ' + (arX - 5) + ',' + (toY(nk.price) + 25) + ' ' + (arX + 5) + ',' + (toY(nk.price) + 25) + '" fill="#ff6a00"/>';
  } else {
    html += '<line x1="' + arX + '" y1="' + (toY(nk.price) - 5) + '" x2="' + arX + '" y2="' + (toY(nk.price) - 28) + '" stroke="#fff" stroke-width="2"/>';
    html += '<polygon points="' + arX + ',' + (toY(nk.price) - 33) + ' ' + (arX - 5) + ',' + (toY(nk.price) - 25) + ' ' + (arX + 5) + ',' + (toY(nk.price) - 25) + '" fill="#fff"/>';
  }

  html += '<circle cx="' + toX(n - 1) + '" cy="' + toY(price) + '" r="3.5" fill="#ff6a00"/>';

  for(var vi = 0; vi < chartVols.length; vi++){
    var bH = (chartVols[vi] / maxVol) * (volH - 5); var bY = chartH + volH - bH + 8; var rIdx = chartStart + vi;
    var isP1z = Math.abs(rIdx - pts.idx) <= 2, isP2z = Math.abs(rIdx - pts2.idx) <= 2, isBrkz = r.breakout.confirmed && r.breakout.confirmCandle > 0 && Math.abs(rIdx - r.breakout.confirmCandle) <= 1;
    var bC = isBrkz ? '#fff' : isP1z ? sigColor : isP2z ? sigColor : '#fff';
    var bO = isBrkz ? 0.7 : isP1z ? 0.5 : isP2z ? 0.35 : 0.06;
    html += '<rect x="' + (toX(rIdx) - 3) + '" y="' + bY + '" width="6" height="' + bH + '" rx="1" fill="' + bC + '" opacity="' + bO + '"/>';
  }
  html += '<line x1="0" y1="' + (chartH + 5) + '" x2="' + svgW + '" y2="' + (chartH + 5) + '" stroke="#1a1a1a" stroke-width="0.5"/>';
  html += '<text x="8" y="' + (chartH + 16) + '" fill="#888" font-size="5" font-family="Share Tech Mono">VOL</text></svg></div>';

  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #111;">';
  [{l:'PAIR',v:symbol.replace('USDT',''),c:'#ff6a00'},{l:'PRICE',v:fmtCryptoPrice(price),c:'#fff'},{l:'TYPE',v:isTop?'DBL TOP':'DBL BOT',c:sigColor},{l:'DIFF',v:r.peakDiff,c:'#ccc'},{l:'SPACE',v:r.peakSpacing+' bars',c:'#888'}].forEach(function(it,i){
    html += '<div style="padding:6px 2px;text-align:center;border-left:' + (i > 0 ? '1px solid #111' : 'none') + ';"><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.35rem;color:#888;letter-spacing:0.5px;">' + it.l + '</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.55rem;color:' + it.c + ';font-weight:bold;">' + it.v + '</div></div>';
  });
  html += '</div></div>';
  document.getElementById('dbl-chart-card').innerHTML = html;

  var bH2 = '<div style="background:' + (r.breakout.confirmed ? 'rgba(255,106,0,0.04)' : 'rgba(255,255,255,0.02)') + ';border:1px solid ' + (r.breakout.confirmed ? 'rgba(255,106,0,0.15)' : '#1a1a1a') + ';border-radius:4px;padding:12px;border-right:3px solid ' + (r.breakout.confirmed ? sigColor : '#333') + '">';
  bH2 += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="color:' + sigColor + ';font-family:\'Share Tech Mono\',monospace;font-size:0.6rem;font-weight:bold;letter-spacing:1px;">BREAKOUT — NECKLINE</span>';
  bH2 += '<span style="font-family:\'Share Tech Mono\',monospace;font-size:0.5rem;font-weight:900;padding:2px 6px;border-radius:3px;color:#000;background:' + (r.breakout.confirmed ? sigColor : '#333') + ';">' + r.breakout.status + '</span></div>';
  bH2 += '<div style="font-family:\'Share Tech Mono\',monospace;font-size:1.5rem;color:' + sigColor + ';font-weight:bold;direction:ltr;text-align:left;">' + fmtCryptoPrice(r.breakout.price) + '</div>';
  bH2 += '<div style="font-size:0.6rem;color:#ccc;margin-top:6px;font-family:\'Cairo\',sans-serif;">' + (r.breakout.confirmed ? (isTop ? 'تم كسر خط العنق — النموذج مؤكّد هبوطياً. الأهداف نشطة.' : 'تم اختراق خط العنق — النموذج مؤكّد صعودياً. الأهداف نشطة.') : (isTop ? 'الإغلاق تحت ' + fmtCryptoPrice(nk.price) + ' يؤكد النموذج الهبوطي.' : 'الإغلاق فوق ' + fmtCryptoPrice(nk.price) + ' يؤكد النموذج الصعودي.')) + '</div>';
  if(r.breakout.volumeSpike) bH2 += '<div style="font-size:0.5rem;color:#ff6a00;margin-top:4px;font-family:\'Cairo\',sans-serif;">Volume Spike عند الاختراق — تأكيد إضافي للقوة</div>';
  bH2 += '</div>';
  document.getElementById('dbl-breakout-card').innerHTML = bH2;

  var sH = '<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;">';
  sH += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:#ff6a00;font-family:\'Share Tech Mono\',monospace;font-size:0.55rem;font-weight:bold;letter-spacing:1px;">QUALITY SCORE</span><span style="color:' + sigColor + ';font-family:\'Share Tech Mono\',monospace;font-size:0.8rem;font-weight:bold;">' + r.score + '/100</span></div>';
  for(var sk in r.scoring){
    var sv = r.scoring[sk];
    sH += '<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-size:0.5rem;color:#ccc;text-transform:uppercase;font-family:\'Share Tech Mono\',monospace;">' + sk + '</span><span style="font-size:0.5rem;color:#fff;font-weight:bold;font-family:\'Share Tech Mono\',monospace;">' + sv.score + '/' + sv.max + '</span></div>';
    sH += '<div style="position:relative;height:4px;background:#111;border-radius:2px;"><div style="height:100%;width:' + ((sv.score / sv.max) * 100) + '%;background:' + sigColor + ';border-radius:2px;opacity:0.6;"></div></div>';
    sH += '<div style="font-size:0.45rem;color:#888;margin-top:2px;font-family:\'Cairo\',sans-serif;">' + sv.detail + '</div></div>';
  }
  sH += '</div>';
  document.getElementById('dbl-score-card').innerHTML = sH;

  var tH = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;">';
  [{l:'TP1 (50%)',v:fmtCryptoPrice(r.targets.tp1),p:r.targets.tp1Pct,c:'#fff'},{l:'TP2 (100%)',v:fmtCryptoPrice(r.targets.tp2),p:r.targets.tp2Pct,c:'#ccc'},{l:'TP3 (161.8%)',v:fmtCryptoPrice(r.targets.tp3),p:r.targets.tp3Pct,c:'#888'},{l:'STOP LOSS',v:fmtCryptoPrice(r.targets.stopLoss),p:r.targets.stopPct,c:'#ff6a00'}].forEach(function(t){
    tH += '<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:8px 4px;text-align:center;border-top:2px solid ' + t.c + ';"><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.35rem;color:#888;letter-spacing:0.5px;margin-bottom:3px;">' + t.l + '</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.7rem;color:' + t.c + ';font-weight:bold;">' + t.v + '</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.5rem;color:' + t.c + ';margin-top:2px;">' + t.p + '</div></div>';
  });
  tH += '</div>';
  document.getElementById('dbl-targets-card').innerHTML = tH;

  var conc = r.typeAr + ' (' + r.typeEn + ') تم تقييمها بدرجة يقين خوارزمية تبلغ ' + r.score + '%. ';
  conc += 'تم رصد ' + (isTop ? 'قمة' : 'قاع') + ' أولى عند ' + fmtCryptoPrice(pts.price) + ' وثانية عند ' + fmtCryptoPrice(pts2.price) + ' (بفارق التزام هندسي ' + r.peakDiff + '). ';
  conc += 'يستقر خط العنق الفاصل عند ' + fmtCryptoPrice(nk.price) + '. ';
  if (r.rsiDivergence.type !== 'بدون') conc += 'يُظهر مؤشر القوة النسبية تباعداً ' + r.rsiDivergence.type + ' (' + r.rsiDivergence.peak1RSI + '→' + r.rsiDivergence.peak2RSI + ')، مما يعزز من موثوقية الانعكاس. ';
  conc += r.breakout.confirmed ? 'أكدت الأسعار كسر خط العنق، وتفاعلت الأهداف السعرية. ' : 'يظل النموذج قيد التشكل بانتظار الإغلاق متجاوزاً خط العنق. ';
  conc += 'أهداف جني الأرباح المتدرجة: ' + fmtCryptoPrice(r.targets.tp1) + ' (TP1)، ' + fmtCryptoPrice(r.targets.tp2) + ' (TP2)، و ' + fmtCryptoPrice(r.targets.tp3) + ' (TP3). ';
  conc += 'يُنصح بالالتزام بالوقف الهيكلي الصارم عند ' + fmtCryptoPrice(r.targets.stopLoss) + '.';
  document.getElementById('dbl-conclusion').textContent = conc;
}

// ==========================================
// دعم العملات متناهية الصغر (أقل من السنت)
// ==========================================
function fmtCryptoPrice(p) {
  if (p >= 1000) return "$" + p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return "$" + p.toFixed(3);
  if (p >= 0.01) return "$" + p.toFixed(4);
  if (p >= 0.0001) return "$" + p.toFixed(6);
  return "$" + p.toFixed(10);
}

// ==========================================
// 1. detectStructure — تحديد هيكل السوق
// ==========================================
function detectStructure(highs, lows, closes) {
  var n = closes.length;
  var swingHighs = findPeaks(highs, 0, n);
  var swingLows = findTroughs(lows, 0, n);

  var structure = { trend: 'NEUTRAL', swingHighs: [], swingLows: [], bosEvents: [], chochEvents: [] };
  if (swingHighs.length < 2 || swingLows.length < 2) return structure;

  var lastSH = swingHighs.slice(-4);
  var lastSL = swingLows.slice(-4);

  var hhCount = 0, llCount = 0, lhCount = 0, hlCount = 0;
  for (var i = 1; i < lastSH.length; i++) {
    if (highs[lastSH[i]] > highs[lastSH[i-1]]) hhCount++; else lhCount++;
  }
  for (var j = 1; j < lastSL.length; j++) {
    if (lows[lastSL[j]] > lows[lastSL[j-1]]) hlCount++; else llCount++;
  }

  if (hhCount >= lhCount && hlCount >= llCount) structure.trend = 'BULLISH';
  else if (lhCount >= hhCount && llCount >= hlCount) structure.trend = 'BEARISH';

  structure.swingHighs = lastSH.map(function(idx) { return { idx: idx, price: highs[idx] }; });
  structure.swingLows = lastSL.map(function(idx) { return { idx: idx, price: lows[idx] }; });

  return structure;
}

// ==========================================
// 2. detectBOS — كسر الهيكل
// ==========================================
function detectBOS(highs, lows, closes, structure) {
  var n = closes.length;
  var events = [];
  var shs = structure.swingHighs;
  var sls = structure.swingLows;

  for (var i = 0; i < shs.length; i++) {
    var shPrice = shs[i].price;
    var shIdx = shs[i].idx;
    for (var ci = shIdx + 1; ci < n; ci++) {
      if (closes[ci] > shPrice) {
        events.push({ type: 'BOS', direction: 'up', price: shPrice, idx: ci, brokenIdx: shIdx });
        break;
      }
    }
  }
  for (var j = 0; j < sls.length; j++) {
    var slPrice = sls[j].price;
    var slIdx = sls[j].idx;
    for (var cj = slIdx + 1; cj < n; cj++) {
      if (closes[cj] < slPrice) {
        events.push({ type: 'BOS', direction: 'down', price: slPrice, idx: cj, brokenIdx: slIdx });
        break;
      }
    }
  }
  return events;
}

// ==========================================
// 3. detectCHOCH — تغيّر الشخصية
// ==========================================
function detectCHOCH(highs, lows, closes, structure) {
  var events = [];
  var trend = structure.trend;
  var shs = structure.swingHighs;
  var sls = structure.swingLows;
  var n = closes.length;

  if (trend === 'BULLISH' && sls.length >= 2) {
    var lastSL = sls[sls.length - 1];
    for (var i = lastSL.idx + 1; i < n; i++) {
      if (closes[i] < lastSL.price) {
        events.push({ type: 'CHOCH', direction: 'down', price: lastSL.price, idx: i });
        break;
      }
    }
  }
  if (trend === 'BEARISH' && shs.length >= 2) {
    var lastSH = shs[shs.length - 1];
    for (var j = lastSH.idx + 1; j < n; j++) {
      if (closes[j] > lastSH.price) {
        events.push({ type: 'CHOCH', direction: 'up', price: lastSH.price, idx: j });
        break;
      }
    }
  }
  return events;
}

// ==========================================
// 4. detectFVG — فجوة القيمة العادلة
// ==========================================
function detectFVG(highs, lows, n) {
  var fvgs = [];
  for (var i = 2; i < n; i++) {
    if (lows[i] > highs[i - 2]) {
      fvgs.push({ type: 'bullish', high: lows[i], low: highs[i - 2], idx: i - 1 });
    }
    if (highs[i] < lows[i - 2]) {
      fvgs.push({ type: 'bearish', high: lows[i - 2], low: highs[i], idx: i - 1 });
    }
  }
  return fvgs;
}

// ==========================================
// 5. findOrderBlocks — اكتشاف كتل الأوامر
// ==========================================
function findOrderBlocks(highs, lows, closes, opens, volumes, bosEvents) {
  var n = closes.length;
  var obs = [];

  for (var bi = 0; bi < bosEvents.length; bi++) {
    var bos = bosEvents[bi];
    if (bos.direction === 'up') {
      for (var oi = bos.brokenIdx; oi >= Math.max(0, bos.brokenIdx - 10); oi--) {
        if (closes[oi] < (opens ? opens[oi] : closes[Math.max(0, oi - 1)])) {
          var impulseSize = (bos.price - lows[oi]) / lows[oi];
          if (impulseSize < 0.01) continue; 
          var impulseCandles = bos.idx - oi;
          if (impulseCandles > 8) continue; 

          obs.push({
            type: 'bullish',
            zone: { high: highs[oi], low: lows[oi], bodyHigh: Math.max(closes[oi], opens ? opens[oi] : closes[Math.max(0, oi - 1)]), bodyLow: Math.min(closes[oi], opens ? opens[oi] : closes[Math.max(0, oi - 1)]), startIdx: oi, endIdx: oi },
            impulse: { from: lows[oi], to: bos.price, magnitude: (impulseSize * 100).toFixed(1) + '%', candles: impulseCandles },
            bos: bos, fvg: null, status: 'FRESH', touches: 0, idx: oi
          });
          break;
        }
      }
    } else {
      for (var oj = bos.brokenIdx; oj >= Math.max(0, bos.brokenIdx - 10); oj--) {
        if (closes[oj] > (opens ? opens[oj] : closes[Math.max(0, oj - 1)])) {
          var impSize = (highs[oj] - bos.price) / highs[oj];
          if (impSize < 0.01) continue;
          var impCandles = bos.idx - oj;
          if (impCandles > 8) continue;

          obs.push({
            type: 'bearish',
            zone: { high: highs[oj], low: lows[oj], bodyHigh: Math.max(closes[oj], opens ? opens[oj] : closes[Math.max(0, oj - 1)]), bodyLow: Math.min(closes[oj], opens ? opens[oj] : closes[Math.max(0, oj - 1)]), startIdx: oj, endIdx: oj },
            impulse: { from: highs[oj], to: bos.price, magnitude: (impSize * 100).toFixed(1) + '%', candles: impCandles },
            bos: bos, fvg: null, status: 'FRESH', touches: 0, idx: oj
          });
          break;
        }
      }
    }
  }
  return obs;
}

// ==========================================
// 6. validateOrderBlock — التحقق والفلترة
// ==========================================
function validateOrderBlock(ob, highs, lows, closes, volumes, fvgs, n) {
  for (var fi = 0; fi < fvgs.length; fi++) {
    var fvg = fvgs[fi];
    if (Math.abs(fvg.idx - ob.idx) <= 3) {
      if ((ob.type === 'bullish' && fvg.type === 'bullish') || (ob.type === 'bearish' && fvg.type === 'bearish')) {
        ob.fvg = fvg; break;
      }
    }
  }

  for (var mi = ob.zone.endIdx + 5; mi < n; mi++) {
    if (ob.type === 'bullish') {
      if (lows[mi] <= ob.zone.bodyHigh && lows[mi] >= ob.zone.low) {
        ob.touches++;
        if (ob.touches === 1) ob.status = 'MITIGATED';
      }
      if (closes[mi] < ob.zone.low) { ob.status = 'BROKEN'; break; }
    } else {
      if (highs[mi] >= ob.zone.bodyLow && highs[mi] <= ob.zone.high) {
        ob.touches++;
        if (ob.touches === 1) ob.status = 'MITIGATED';
      }
      if (closes[mi] > ob.zone.high) { ob.status = 'BROKEN'; break; }
    }
  }
  return ob;
}

// ==========================================
// 7. scoreOrderBlock — تسجيل الجودة
// ==========================================
function scoreOrderBlock(ob, volumes) {
  var score = 0;
  var scoring = {};

  var impMag = parseFloat(ob.impulse.magnitude);
  var dispScore = Math.min(Math.round(impMag / 0.12 * 1), 25);
  if (ob.impulse.candles <= 3) dispScore = Math.min(dispScore + 5, 25);
  scoring.displacement = { score: dispScore, max: 25, detail: ob.impulse.magnitude + ' في ' + ob.impulse.candles + ' شموع' };
  score += dispScore;

  var structScore = ob.bos.type === 'BOS' ? 22 : 15;
  scoring.structure = { score: structScore, max: 25, detail: ob.bos.type + (ob.bos.direction === 'up' ? ' صعودي' : ' هبوطي') + ' مؤكّد' };
  score += structScore;

  var fvgScore = ob.fvg ? 18 : 0;
  scoring.fvg = { score: fvgScore, max: 20, detail: ob.fvg ? 'FVG موجودة' : 'لا FVG' };
  score += fvgScore;

  var avgVol = 0, impVol = 0, count = 0;
  for (var av = Math.max(0, ob.idx - 20); av < ob.idx; av++) { avgVol += volumes[av]; count++; }
  avgVol /= count || 1;
  for (var iv = ob.idx; iv <= Math.min(volumes.length - 1, ob.idx + ob.impulse.candles); iv++) impVol += volumes[iv];
  impVol /= (ob.impulse.candles + 1) || 1;
  var volSpikePct = avgVol > 0 ? ((impVol - avgVol) / avgVol * 100) : 0;
  var volScore = volSpikePct > 40 ? 15 : volSpikePct > 20 ? 10 : volSpikePct > 0 ? 5 : 0;
  scoring.volume = { score: volScore, max: 15, detail: 'Volume ' + (volSpikePct > 0 ? '+' + Math.round(volSpikePct) + '%' : 'طبيعي') };
  score += volScore;

  var cleanScore = ob.status === 'FRESH' ? 12 : ob.status === 'MITIGATED' ? 6 : 0;
  if (ob.touches === 0) cleanScore = 15;
  scoring.clean = { score: cleanScore, max: 15, detail: ob.status === 'FRESH' ? 'نظيفة — لم تُلمس' : ob.touches + ' لمسة' };
  score += cleanScore;

  ob.score = Math.min(score, 100);
  ob.scoring = scoring;
  return ob;
}

// ==========================================
// 8. الدالة الرئيسية وتنسيق العرض
// ==========================================
async function runSMCScanner() {
  var coin = document.getElementById('smc-symbol').value.trim().toUpperCase();
  var tf = document.getElementById('smc-tf').value;
  var btn = document.getElementById('smc-btn');
  if (!coin) return;
  var symbol = coin.includes('USDT') ? coin : coin + 'USDT';
  btn.innerText = 'SCANNING...'; btn.disabled = true;

  try {
    var limit = tf === '1h' ? 500 : tf === '4h' ? 300 : 200;
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tf + '&limit=' + limit);
    if (!res.ok) throw new Error('تعذر جلب البيانات.');
    var raw = await res.json();
    if (raw.length < 40) throw new Error('بيانات غير كافية.');

    var candles = raw.map(function(k) {
      return { o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) };
    });
    var opens = candles.map(function(c){return c.o;});
    var highs = candles.map(function(c){return c.h;});
    var lows = candles.map(function(c){return c.l;});
    var closes = candles.map(function(c){return c.c;});
    var volumes = candles.map(function(c){return c.v;});
    var price = closes[closes.length - 1];
    var n = closes.length;

    var structure = detectStructure(highs, lows, closes);
    var bosEvents = detectBOS(highs, lows, closes, structure);
    var chochEvents = detectCHOCH(highs, lows, closes, structure);
    structure.bosEvents = bosEvents;
    structure.chochEvents = chochEvents;

    var fvgs = detectFVG(highs, lows, n);
    var allOBs = findOrderBlocks(highs, lows, closes, opens, volumes, bosEvents);

    var validOBs = [];
    for (var oi = 0; oi < allOBs.length; oi++) {
      var validated = validateOrderBlock(allOBs[oi], highs, lows, closes, volumes, fvgs, n);
      if (validated.status === 'BROKEN') continue; 
      var scored = scoreOrderBlock(validated, volumes);
      if (scored.score >= 40) validOBs.push(scored);
    }
    validOBs.sort(function(a, b) { return b.score - a.score; });

    var bestOB = validOBs.length > 0 ? validOBs[0] : null;
    if (bestOB) {
      if (bestOB.type === 'bullish') {
        bestOB.entry = { price: bestOB.zone.bodyHigh, type: 'Limit Buy' };
        bestOB.stopLoss = bestOB.zone.low * 0.995;
        bestOB.takeProfit1 = bestOB.bos.price;
        bestOB.takeProfit2 = bestOB.bos.price + (bestOB.bos.price - bestOB.zone.low);
      } else {
        bestOB.entry = { price: bestOB.zone.bodyLow, type: 'Limit Sell' };
        bestOB.stopLoss = bestOB.zone.high * 1.005;
        bestOB.takeProfit1 = bestOB.bos.price;
        bestOB.takeProfit2 = bestOB.bos.price - (bestOB.zone.high - bestOB.bos.price);
      }
      var risk = Math.abs(bestOB.entry.price - bestOB.stopLoss);
      var reward = Math.abs(bestOB.takeProfit2 - bestOB.entry.price);
      bestOB.riskReward = risk > 0 ? '1:' + (reward / risk).toFixed(1) : 'N/A';
    }

    renderSMCDashboard(symbol, price, tf.toUpperCase(), closes, volumes, structure, bestOB, fvgs);
    document.getElementById('smc-dashboard').style.display = 'block';

  } catch (e) { alert(e.message); }
  finally { btn.innerText = 'START'; btn.disabled = false; }
}

function renderSMCDashboard(symbol, price, tf, closes, volumes, structure, ob, fvgs) {
  var lastBOS = structure.bosEvents.length > 0 ? structure.bosEvents[structure.bosEvents.length - 1] : null;
  var stHtml = '<div style="background:#060606;border:1px solid #1a1a1a;border-radius:4px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">';
  stHtml += '<div style="display:flex;align-items:center;gap:8px;"><span style="color:#ff6a00;font-family:\'Share Tech Mono\',monospace;font-size:0.65rem;font-weight:bold;">STRUCTURE</span>';
  stHtml += '<span style="font-family:\'Share Tech Mono\',monospace;font-size:0.6rem;font-weight:900;padding:2px 6px;border-radius:3px;color:#000;background:' + (structure.trend === 'BULLISH' ? '#fff' : structure.trend === 'BEARISH' ? '#ff6a00' : '#ffffff') + ';">' + structure.trend + '</span></div>';
  if (lastBOS) stHtml += '<div style="display:flex;align-items:center;gap:8px;"><span style="color:#ffffff;font-family:\'Share Tech Mono\',monospace;font-size:0.6rem;">Last BOS:</span><span style="color:#fff;font-family:\'Share Tech Mono\',monospace;font-size:0.65rem;font-weight:bold;">' + fmtCryptoPrice(lastBOS.price) + '</span></div>';
  stHtml += '</div>';
  document.getElementById('smc-structure-bar').innerHTML = stHtml;

  if (!ob) {
    document.getElementById('smc-chart-card').innerHTML = '<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:30px;text-align:center;margin-bottom:6px;color:#ffffff;font-size:0.9rem;">لا Order Blocks نشطة مكتشفة. جرّب إطار زمني مختلف.</div>';
    document.getElementById('smc-details-card').innerHTML = '';
    document.getElementById('smc-score-card').innerHTML = '';
    document.getElementById('smc-trade-card').innerHTML = '';
    document.getElementById('smc-conclusion').textContent = 'لا Order Blocks نشطة.';
    return;
  }

  var isBull = ob.type === 'bullish';
  var sigColor = isBull ? '#fff' : '#ff6a00';
  var n = closes.length;
  var chartStart = Math.max(0, ob.idx - 10);
  var chartEnd = n - 1;
  var chartCloses = closes.slice(chartStart, chartEnd + 1);
  var chartVols = volumes.slice(chartStart, chartEnd + 1);
  var allP = chartCloses.slice();
  allP.push(ob.zone.high, ob.zone.low, ob.takeProfit1, ob.takeProfit2, ob.stopLoss);
  var minP = Math.min.apply(null, allP) * 0.996;
  var maxP = Math.max.apply(null, allP) * 1.004;
  var range = maxP - minP || 1;
  var svgW = 340, chartH = 200, volH = 40, svgH = chartH + volH + 10;
  var toX = function(idx) { return 15 + ((idx - chartStart) / (chartEnd - chartStart)) * (svgW - 30); };
  var toY = function(pr) { return 12 + (1 - (pr - minP) / range) * (chartH - 24); };
  var maxVol = Math.max.apply(null, chartVols);

  var html = '<div style="background:#060606;border:1px solid #1a1a1a;border-radius:4px;overflow:hidden;margin-bottom:6px;border-top:2px solid ' + sigColor + ';">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#0a0a0a;border-bottom:1px solid #111;">';
  html += '<div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.9rem;color:' + sigColor + ';font-weight:bold;">' + (isBull ? 'Bullish Order Block' : 'Bearish Order Block') + '</div>';
  html += '<div style="font-size:0.65rem;color:#ffffff;">' + (isBull ? 'كتلة أوامر شرائية' : 'كتلة أوامر بيعية') + '</div></div>';
  html += '<div style="display:flex;align-items:center;gap:10px;"><div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace;font-size:1.2rem;color:' + sigColor + ';font-weight:bold;">' + ob.score + '%</div>';
  html += '<div style="font-family:\'Share Tech Mono\',monospace;font-size:0.45rem;color:#ffffff;letter-spacing:1px;">SCORE</div></div>';
  html += '<span style="font-family:\'Share Tech Mono\',monospace;font-size:0.55rem;font-weight:900;padding:2px 6px;border-radius:3px;color:#000;background:' + sigColor + ';">' + (isBull ? 'BULL' : 'BEAR') + '</span></div></div>';

  html += '<div style="padding:4px 2px 0;background:#020208;"><svg width="100%" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="direction:ltr;">';
  html += '<defs><filter id="smGl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';

  for (var gi = 1; gi <= 4; gi++) html += '<line x1="0" y1="' + (gi * chartH / 5) + '" x2="' + svgW + '" y2="' + (gi * chartH / 5) + '" stroke="#080808" stroke-width="0.5"/>';

  var obX = toX(ob.zone.startIdx);
  html += '<rect x="' + obX + '" y="' + toY(ob.zone.high) + '" width="' + (svgW - obX - 10) + '" height="' + (toY(ob.zone.low) - toY(ob.zone.high)) + '" fill="' + sigColor + '" opacity="0.06"/>';
  html += '<rect x="' + obX + '" y="' + toY(ob.zone.bodyHigh) + '" width="' + (svgW - obX - 10) + '" height="' + (toY(ob.zone.bodyLow) - toY(ob.zone.bodyHigh)) + '" fill="' + sigColor + '" opacity="0.12"/>';
  html += '<line x1="' + obX + '" y1="' + toY(ob.zone.high) + '" x2="' + (svgW - 10) + '" y2="' + toY(ob.zone.high) + '" stroke="' + sigColor + '" stroke-width="1" stroke-dasharray="4 3" opacity="0.4"/>';
  html += '<line x1="' + obX + '" y1="' + toY(ob.zone.low) + '" x2="' + (svgW - 10) + '" y2="' + toY(ob.zone.low) + '" stroke="' + sigColor + '" stroke-width="1" stroke-dasharray="4 3" opacity="0.4"/>';
  html += '<rect x="' + (obX + 2) + '" y="' + (toY(ob.zone.high) + 3) + '" width="20" height="10" rx="2" fill="' + sigColor + '"/>';
  html += '<text x="' + (obX + 12) + '" y="' + (toY(ob.zone.high) + 11) + '" text-anchor="middle" fill="#000" font-size="6" font-weight="bold" font-family="Share Tech Mono">OB</text>';

  if (ob.fvg) {
    var fvgX1 = toX(ob.fvg.idx - 1);
    var fvgX2 = toX(ob.fvg.idx + 1);
    html += '<rect x="' + fvgX1 + '" y="' + toY(ob.fvg.high) + '" width="' + (fvgX2 - fvgX1) + '" height="' + (toY(ob.fvg.low) - toY(ob.fvg.high)) + '" fill="#ff6a00" opacity="0.06"/>';
    html += '<text x="' + ((fvgX1 + fvgX2) / 2) + '" y="' + (toY(ob.fvg.high) - 3) + '" text-anchor="middle" fill="#ff6a00" font-size="5" font-weight="bold" opacity="0.5" font-family="Share Tech Mono">FVG</text>';
  }

  var lStr = '';
  for (var li = 0; li < chartCloses.length; li++) lStr += toX(chartStart + li) + ',' + toY(chartCloses[li]) + ' ';
  html += '<polyline points="' + lStr.trim() + '" fill="none" stroke="#555" stroke-width="1.8" stroke-linejoin="round"/>';

  var impStr = '';
  for (var ii = ob.zone.endIdx; ii <= Math.min(ob.zone.endIdx + ob.impulse.candles, n - 1); ii++) impStr += toX(ii) + ',' + toY(closes[ii]) + ' ';
  if (impStr) html += '<polyline points="' + impStr.trim() + '" fill="none" stroke="' + sigColor + '" stroke-width="3" stroke-linejoin="round" filter="url(#smGl)"/>';

  if (ob.entry) {
    html += '<line x1="' + obX + '" y1="' + toY(ob.entry.price) + '" x2="' + (svgW - 10) + '" y2="' + toY(ob.entry.price) + '" stroke="#fff" stroke-width="1" opacity="0.5"/>';
    html += '<rect x="' + (svgW - 50) + '" y="' + (toY(ob.entry.price) - 6) + '" width="40" height="11" rx="2" fill="#fff"/>';
    html += '<text x="' + (svgW - 30) + '" y="' + (toY(ob.entry.price) + 3) + '" text-anchor="middle" fill="#000" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">ENTRY</text>';
  }
  html += '<line x1="' + obX + '" y1="' + toY(ob.stopLoss) + '" x2="' + (svgW - 10) + '" y2="' + toY(ob.stopLoss) + '" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.4"/>';
  html += '<line x1="' + toX(ob.zone.endIdx) + '" y1="' + toY(ob.takeProfit1) + '" x2="' + (svgW - 10) + '" y2="' + toY(ob.takeProfit1) + '" stroke="#ffffff" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.3"/>';
  html += '<line x1="' + toX(ob.zone.endIdx) + '" y1="' + toY(ob.takeProfit2) + '" x2="' + (svgW - 10) + '" y2="' + toY(ob.takeProfit2) + '" stroke="#ffffff" stroke-width="0.6" stroke-dasharray="3 3" opacity="0.2"/>';

  html += '<circle cx="' + toX(n - 1) + '" cy="' + toY(price) + '" r="3.5" fill="#ff6a00"/>';
  html += '<rect x="' + (toX(n - 1) + 5) + '" y="' + (toY(price) - 6) + '" width="38" height="11" rx="2" fill="#ff6a00"/>';
  html += '<text x="' + (toX(n - 1) + 24) + '" y="' + (toY(price) + 3) + '" text-anchor="middle" fill="#000" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">' + fmtCryptoPrice(price).replace('$', '') + '</text>';

  for (var vi = 0; vi < chartVols.length; vi++) {
    var bH = (chartVols[vi] / maxVol) * (volH - 5);
    var bY = chartH + volH - bH + 8;
    var rIdx = chartStart + vi;
    var isImp = rIdx >= ob.zone.endIdx && rIdx <= ob.zone.endIdx + ob.impulse.candles;
    var isOBz = rIdx >= ob.zone.startIdx && rIdx <= ob.zone.endIdx;
    html += '<rect x="' + (toX(rIdx) - 3) + '" y="' + bY + '" width="6" height="' + bH + '" rx="1" fill="' + (isImp ? '#fff' : isOBz ? '#ff6a00' : '#fff') + '" opacity="' + (isImp ? 0.6 : isOBz ? 0.4 : 0.06) + '"/>';
  }
  html += '</svg></div>';

  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid #111;">';
  [{l:'PAIR',v:symbol.replace('USDT',''),c:'#ff6a00'},{l:'PRICE',v:fmtCryptoPrice(price),c:'#fff'},{l:'OB',v:isBull?'BULL':'BEAR',c:sigColor},{l:'STATUS',v:ob.status,c:ob.status==='FRESH'?'#fff':'#ff6a00'},{l:'R:R',v:ob.riskReward,c:'#ffffff'}].forEach(function(it,i){
    html+='<div style="padding:6px 2px;text-align:center;border-left:'+(i>0?'1px solid #111':'none')+';"><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.45rem;color:#ffffff;letter-spacing:0.5px;">'+it.l+'</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.65rem;color:'+it.c+';font-weight:bold;">'+it.v+'</div></div>';
  });
  html+='</div></div>';
  document.getElementById('smc-chart-card').innerHTML = html;

  var dHtml = '<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;">';
  dHtml += '<div style="color:#ff6a00;font-family:\'Share Tech Mono\',monospace;font-size:0.65rem;font-weight:bold;letter-spacing:1px;margin-bottom:8px;">ORDER BLOCK DETAILS</div>';
  [{l:'المنطقة',v:fmtCryptoPrice(ob.zone.high)+' → '+fmtCryptoPrice(ob.zone.low)},{l:'الجسم',v:fmtCryptoPrice(ob.zone.bodyHigh)+' → '+fmtCryptoPrice(ob.zone.bodyLow)},{l:'الحركة القوية',v:ob.impulse.magnitude+' في '+ob.impulse.candles+' شموع'},{l:'FVG',v:ob.fvg?fmtCryptoPrice(ob.fvg.low)+' → '+fmtCryptoPrice(ob.fvg.high):'لا يوجد'},{l:'BOS',v:ob.bos?fmtCryptoPrice(ob.bos.price)+' مؤكّد':'—'},{l:'اللمسات',v:ob.touches===0?'FRESH — لم تُلمس':ob.touches+' مرة'}].forEach(function(m,i){
    dHtml+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:'+(i<5?'1px solid #0d0d0d':'none')+';"><span style="font-size:0.65rem;color:#ffffff;">'+m.l+'</span><span style="font-family:\'Share Tech Mono\',monospace;font-size:0.65rem;color:#fff;font-weight:bold;">'+m.v+'</span></div>';
  });
  dHtml+='</div>';
  document.getElementById('smc-details-card').innerHTML = dHtml;

  var scHtml = '<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:10px;">';
  scHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="color:#ff6a00;font-family:\'Share Tech Mono\',monospace;font-size:0.65rem;font-weight:bold;letter-spacing:1px;">QUALITY SCORE</span><span style="color:'+sigColor+';font-family:\'Share Tech Mono\',monospace;font-size:0.9rem;font-weight:bold;">'+ob.score+'/100</span></div>';
  for (var sk in ob.scoring) { var sv=ob.scoring[sk];
    scHtml+='<div style="margin-bottom:6px;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-family:\'Share Tech Mono\',monospace;font-size:0.6rem;color:#ffffff;text-transform:uppercase;">'+sk+'</span><span style="font-family:\'Share Tech Mono\',monospace;font-size:0.6rem;color:#fff;font-weight:bold;">'+sv.score+'/'+sv.max+'</span></div>';
    scHtml+='<div style="position:relative;height:4px;background:#111;border-radius:2px;"><div style="height:100%;width:'+((sv.score/sv.max)*100)+'%;background:'+sigColor+';border-radius:2px;opacity:0.6;"></div></div>';
    scHtml+='<div style="font-size:0.55rem;color:#ffffff;margin-top:2px;">'+sv.detail+'</div></div>';
  }
  scHtml+='</div>';
  document.getElementById('smc-score-card').innerHTML = scHtml;

  var trHtml = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;">';
  [{l:'ENTRY',v:fmtCryptoPrice(ob.entry.price),c:'#fff'},{l:'TP1',v:fmtCryptoPrice(ob.takeProfit1),c:'#ffffff'},{l:'TP2',v:fmtCryptoPrice(ob.takeProfit2),c:'#ffffff'},{l:'STOP LOSS',v:fmtCryptoPrice(ob.stopLoss),c:'#ff6a00'}].forEach(function(t){
    trHtml+='<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:8px 4px;text-align:center;border-top:2px solid '+t.c+';"><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.45rem;color:#ffffff;letter-spacing:0.5px;margin-bottom:3px;">'+t.l+'</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:0.8rem;color:'+t.c+';font-weight:bold;">'+t.v+'</div></div>';
  });
  trHtml+='</div>';
  document.getElementById('smc-trade-card').innerHTML = trHtml;

  var conc = (isBull ? 'كتلة أوامر شرائية' : 'كتلة أوامر بيعية') + ' عند ' + fmtCryptoPrice(ob.zone.high) + '-' + fmtCryptoPrice(ob.zone.low) + ' — ثقة ' + ob.score + '%. ';
  conc += 'حركة قوية ' + ob.impulse.magnitude + ' في ' + ob.impulse.candles + ' شموع. ';
  conc += 'BOS ' + (ob.bos.direction === 'up' ? 'صعودي' : 'هبوطي') + ' مؤكّد. ';
  conc += ob.fvg ? 'FVG موجودة — تأكيد إضافي. ' : '';
  conc += 'الحالة: ' + ob.status + '. الهيكل العام: ' + structure.trend + '. ';
  conc += 'دخول: ' + fmtCryptoPrice(ob.entry.price) + '. SL: ' + fmtCryptoPrice(ob.stopLoss) + '. ';
  conc += 'TP1: ' + fmtCryptoPrice(ob.takeProfit1) + ' | TP2: ' + fmtCryptoPrice(ob.takeProfit2) + '. R:R ' + ob.riskReward + '. ';
  conc += 'هذا تحليل فني للاتجاه الفوري ولا يُعتبر توصية تداول.';
  document.getElementById('smc-conclusion').textContent = conc;
}

// ==========================================
// 🚀 محرك الشارت الحي للبيتكوين (1H Timeframe) - معالج مشاكل Telegram Desktop
// ==========================================
const HeroChartEngine = (function() {
    let prices = [];
    const MAX_POINTS = 60; // فريم ساعة: آخر 60 ساعة
    let ws = null;
    let basePrice24h = 0;
    
    let chartMin = 0, chartMax = 0, chartRange = 1, chartW = 0, chartH = 0, chartPad = 0;
    let isHovering = false;
    let lastUiUpdate = 0; 

    async function init() {
        const svg = document.getElementById('hbc-svg');
        const container = document.getElementById('hbc-chart-container');
        if(!svg || !container) return;

        // 1. جلب البيانات الأولية بمعزل لمنع إيقاف السكريبت في حالة الخطأ
        try {
            const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
            const tickData = await res.json();
            basePrice24h = parseFloat(tickData.openPrice);
            updateUI(parseFloat(tickData.lastPrice), parseFloat(tickData.highPrice), parseFloat(tickData.lowPrice), parseFloat(tickData.priceChangePercent));
        } catch(e) {
            console.warn("Ticker API failed");
        }

        // 2. جلب الشموع التاريخية (1H) بمعزل
        try {
            const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=${MAX_POINTS}`);
            const data = await res.json();
            prices = data.map(k => parseFloat(k[4])); 
        } catch(e) {
            console.warn("Klines API failed");
        }
            
        // 3. محاولة الرسم المتكررة (للتعامل مع بطء متصفح تليجرام ديسكتوب)
        let retryCount = 0;
        const forceDraw = () => {
            if(!container) return;
            const w = container.clientWidth || container.getBoundingClientRect().width;
            if (w > 0 && prices.length > 0) {
                safeDrawChart(false);
            } else if (retryCount < 50) {
                retryCount++;
                setTimeout(forceDraw, 100); 
            } else {
                // إذا استمر الفشل (متصفح معند)، ارسم بأبعاد الكمبيوتر الافتراضية
                safeDrawChart(true);
            }
        };
        forceDraw();

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                if(!isHovering && prices.length > 0) safeDrawChart(false);
            });
            ro.observe(container);
        }
            
        setupInteractivity();
        connectStream();

        // 4. تحديث الشارت التاريخي (1H) ليتناغم الشارت مع الزمن
        setInterval(async () => {
            try {
                const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=2`);
                const d = await r.json();
                // تحديث آخر نقطتين لضمان استمرارية الشارت التاريخي
                prices[prices.length - 2] = parseFloat(d[0][4]);
                prices[prices.length - 1] = parseFloat(d[1][4]);
                if(!isHovering) safeDrawChart(false);
            } catch(e) {}
        }, 300000); // تحديث الهيكل كل 5 دقائق
    }
    
    function safeDrawChart(useFallback = false) {
        const container = document.getElementById('hbc-chart-container');
        if (!container || prices.length < 2) return;
        
        let w = container.clientWidth || container.getBoundingClientRect().width;
        let h = container.clientHeight || container.getBoundingClientRect().height;
        
        if (useFallback || w === 0) {
            w = window.innerWidth > 600 ? 600 : window.innerWidth - 40;
            h = 140; 
        }
        
        if (w > 0 && h > 0) drawChart(w, h);
    }

    function updateUI(currentPrice, high, low, priceChangePercent) {
        const now = Date.now();
        // صمام أمان لمنع الرعشة: التحديث للواجهة يحدث مرة كل 300 مللي ثانية فقط
        if (now - lastUiUpdate < 300) return;
        lastUiUpdate = now;

        const priceEl = document.getElementById('hbc-price');
        const changeEl = document.getElementById('hbc-change');
        
        if (priceEl && !isHovering) {
            const oldStr = priceEl.innerText.replace(/[^0-9.-]+/g,"");
            const oldPrice = parseFloat(oldStr);
            
            if (!isNaN(oldPrice) && currentPrice !== oldPrice) {
                priceEl.style.color = currentPrice >= oldPrice ? '#ffffff' : 'var(--o)';
                setTimeout(() => { if(!isHovering && priceEl) priceEl.style.color = '#ffffff'; }, 200); 
            }
            priceEl.innerText = '$' + currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        
        if (changeEl && priceChangePercent !== undefined && priceChangePercent !== null && !isHovering) {
            const chg = parseFloat(priceChangePercent);
            const isUp = chg >= 0;
            
            changeEl.innerText = (isUp ? '▲ +' : '▼ ') + Math.abs(chg).toFixed(2) + '%';
            
            if (isUp) {
                changeEl.style.color = '#ffffff';
                changeEl.style.background = 'rgba(255, 255, 255, 0.1)';
                changeEl.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            } else {
                changeEl.style.color = 'var(--o)';
                changeEl.style.background = 'rgba(255, 106, 0, 0.15)';
                changeEl.style.border = '1px solid rgba(255, 106, 0, 0.3)';
            }
        }
        
        // تحديث إجباري للـ 24H HIGH و LOW مباشرة من البث اللحظي
        if (high) {
            const hEl = document.getElementById('hbc-high');
            if(hEl) hEl.innerText = '$' + parseFloat(high).toLocaleString('en-US', {maximumFractionDigits:0});
        }
        if (low) {
            const lEl = document.getElementById('hbc-low');
            if(lEl) lEl.innerText = '$' + parseFloat(low).toLocaleString('en-US', {maximumFractionDigits:0});
        }
    }
    
    function drawChart(w, h) {
        chartW = w; chartH = h;
        chartMin = Math.min(...prices); chartMax = Math.max(...prices);
        
        const priceDiff = chartMax - chartMin;
        chartMin -= priceDiff * 0.05; chartMax += priceDiff * 0.05;
        
        chartPad = chartH * 0.15; 
        chartRange = (chartMax - chartMin) || 1;
        const drawH = chartH - (chartPad * 2);
        
        const stepX = chartW / (prices.length - 1);
        const toX = (i) => i * stepX;
        const toY = (p) => chartPad + drawH - (((p - chartMin) / chartRange) * drawH);
        
        let pathD = `M ${toX(0)},${toY(prices[0])} `;
        for (let i = 0; i < prices.length - 1; i++) {
            const x1 = toX(i), y1 = toY(prices[i]);
            const x2 = toX(i+1), y2 = toY(prices[i+1]);
            const cpX = (x1 + x2) / 2;
            pathD += `C ${cpX} ${y1}, ${cpX} ${y2}, ${x2} ${y2} `;
        }
        
        document.getElementById('hbc-line').setAttribute('d', pathD);
        
        let areaPts = `0,${chartH} `;
        for(let i=0; i<prices.length; i++) areaPts += `${toX(i)},${toY(prices[i])} `;
        areaPts += `${chartW},${chartH}`;
        document.getElementById('hbc-area').setAttribute('points', areaPts);
        
        if (!isHovering) {
            const lastX = toX(prices.length - 1);
            const lastY = toY(prices[prices.length - 1]);
            const dot = document.getElementById('hbc-dot');
            const pulse = document.getElementById('hbc-pulse');
            if(dot && pulse) {
                dot.style.display = 'block'; pulse.style.display = 'block';
                dot.setAttribute('cx', lastX); dot.setAttribute('cy', lastY);
                pulse.setAttribute('cx', lastX); pulse.setAttribute('cy', lastY);
            }
        }
    }

    function setupInteractivity() {
        const container = document.getElementById('hbc-chart-container');
        const svg = document.getElementById('hbc-svg');
        const interactiveGroup = document.getElementById('hbc-crosshair');
        const vline = document.getElementById('hbc-vline');
        const hoverDot = document.getElementById('hbc-hover-dot');
        const tooltip = document.getElementById('hbc-tooltip');
        const liveDot = document.getElementById('hbc-dot');
        const livePulse = document.getElementById('hbc-pulse');

        let moveTimer = null;

        function onMove(e) {
            if (prices.length < 2 || chartW === 0) return;
            isHovering = true;
            
            if(liveDot) liveDot.style.display = 'none'; 
            if(livePulse) livePulse.style.display = 'none';
            if(interactiveGroup) interactiveGroup.style.display = 'block';
            if(tooltip) tooltip.style.display = 'block';
            
            if(moveTimer) cancelAnimationFrame(moveTimer);
            moveTimer = requestAnimationFrame(() => {
                const rect = svg.getBoundingClientRect();
                let clientX = e.touches ? e.touches[0].clientX : e.clientX;
                let x = clientX - rect.left;
                x = Math.max(0, Math.min(x, rect.width));
                
                const stepX = rect.width / (prices.length - 1);
                let idx = Math.round(x / stepX);
                idx = Math.max(0, Math.min(idx, prices.length - 1));
                
                const exactX = idx * stepX;
                const hoveredPrice = prices[idx];
                const drawH = rect.height - (chartPad * 2);
                const exactY = chartPad + drawH - (((hoveredPrice - chartMin) / chartRange) * drawH);
                
                if(vline) { vline.setAttribute('x1', exactX); vline.setAttribute('x2', exactX); }
                if(hoverDot) { hoverDot.setAttribute('cx', exactX); hoverDot.setAttribute('cy', exactY); }
                
                if(tooltip) {
                    tooltip.innerText = '$' + hoveredPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    let toolX = exactX;
                    if (toolX < 45) toolX = 45;
                    if (toolX > rect.width - 45) toolX = rect.width - 45;
                    tooltip.style.left = toolX + 'px';
                    tooltip.style.top = (exactY - 25 < 0 ? exactY + 15 : exactY - 25) + 'px';
                }
            });
        }

        function onLeave() {
            isHovering = false;
            if(interactiveGroup) interactiveGroup.style.display = 'none';
            if(tooltip) tooltip.style.display = 'none';
            safeDrawChart(false); 
        }

        container.addEventListener('mousemove', onMove);
        container.addEventListener('touchmove', onMove, {passive: true});
        container.addEventListener('mouseleave', onLeave);
        container.addEventListener('touchend', onLeave);
    }
    
    function connectStream() {
        if(ws) { ws.close(); ws = null; }
        
        ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
        
        ws.onmessage = (e) => {
            const d = JSON.parse(e.data);
            const livePrice = parseFloat(d.c);
            const priceChangePercent = d.P;
            const high24 = d.h;
            const low24 = d.l;
            
            updateUI(livePrice, high24, low24, priceChangePercent);
            
            if(prices.length > 0) {
                prices[prices.length - 1] = livePrice;
                if(!isHovering) safeDrawChart(false);
            }
        };
        
        ws.onerror = () => setTimeout(connectStream, 3000);
        ws.onclose = () => setTimeout(connectStream, 3000);
    }
    
    return { init };
})();

window.addEventListener('DOMContentLoaded', () => {
    HeroChartEngine.init();
});

// ==========================================
// 🚀 محرك مساحة العمل والمفضلة (Favorites Workspace Manager)
// ==========================================
const FavoritesManager = (function() {
    let favorites = JSON.parse(localStorage.getItem('360_fav_tools')) || [];

    function init() {
        injectStarsIntoCards();
        renderDropdown();
        
        // إغلاق القائمة الذكي عند النقر خارجها
        document.addEventListener('click', (e) => {
            const favMenu = document.getElementById('favMenu');
            const favBtn = document.getElementById('favDropdown');
            if (favMenu && favMenu.classList.contains('open') && (!favBtn || !favBtn.contains(e.target))) {
                favMenu.classList.remove('open');
            }
        });
    }

    // الحقن الديناميكي للنجوم داخل جميع الكروت أوتوماتيكياً
    function injectStarsIntoCards() {
        const cards = document.querySelectorAll('.hstrip .tc');
        cards.forEach(card => {
            const onclickAttr = card.getAttribute('onclick');
            if (!onclickAttr) return;
            
            const match = onclickAttr.match(/nav\('([^']+)'\)/);
            if (!match) return;
            const toolId = match[1];
            
            const nameEl = card.querySelector('.tc-n');
            const toolName = nameEl ? nameEl.innerText.trim() : toolId;

            if (card.querySelector('.tc-star-btn')) return; // منع التكرار

            const starBtn = document.createElement('div');
            starBtn.className = `tc-star-btn ${favorites.some(f => f.id === toolId) ? 'is-fav' : ''}`;
            starBtn.setAttribute('data-id', toolId);
            starBtn.innerHTML = `<svg class="tc-star-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
            
            // --- معالجة نقرة الماوس (الكمبيوتر) ---
            starBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // منع فتح الأداة
                toggleFavorite(toolId, toolName, starBtn);
            });

            // --- معالجة الضغط المطول (للهاتف المحمول) ---
            let pressTimer;
            let isPressing = false;
            
            const startPress = (e) => {
                isPressing = true;
                pressTimer = setTimeout(() => {
                    if(isPressing) {
                        e.stopPropagation();
                        toggleFavorite(toolId, toolName, starBtn);
                        if (navigator.vibrate) navigator.vibrate(50); // اهتزاز الهاتف للتأكيد
                    }
                }, 500); // 500 مللي ثانية للضغط المطول
            };
            
            const cancelPress = () => {
                isPressing = false;
                clearTimeout(pressTimer);
            };

            card.addEventListener('touchstart', startPress, {passive: true});
            card.addEventListener('touchend', cancelPress);
            card.addEventListener('touchmove', cancelPress, {passive: true});

            card.appendChild(starBtn);
        });
    }

    // دالة الإضافة والحذف من الذاكرة
    function toggleFavorite(id, name, starEl) {
        const index = favorites.findIndex(f => f.id === id);
        
        // تأثير النبض الحركي
        if (starEl) {
            starEl.classList.remove('star-pop');
            void starEl.offsetWidth; 
            starEl.classList.add('star-pop');
        }

        if (index > -1) {
            favorites.splice(index, 1);
            if(starEl) starEl.classList.remove('is-fav');
        } else {
            favorites.push({ id, name });
            if(starEl) starEl.classList.add('is-fav');
        }

        saveAndRender();
    }

    // دالة الحذف من داخل القائمة المنسدلة
    function removeFavorite(e, id) {
        if(e) e.stopPropagation();
        favorites = favorites.filter(f => f.id !== id);
        
        // تحديث وإطفاء النجمة في الواجهة الرئيسية فوراً
        const starEl = document.querySelector(`.tc-star-btn[data-id="${id}"]`);
        if(starEl) starEl.classList.remove('is-fav');
        
        saveAndRender();
    }

    // حفظ في المتصفح وتحديث القائمة
    function saveAndRender() {
        localStorage.setItem('360_fav_tools', JSON.stringify(favorites));
        renderDropdown();
    }

    // البناء البرمجي للقائمة المنسدلة العلوية
    function renderDropdown() {
        const container = document.getElementById('fav-list-container');
        const topIcon = document.getElementById('top-star-icon');
        if (!container) return;

        if (favorites.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px 10px; color:var(--t3); font-size:0.75rem; font-family:\'Cairo\',sans-serif; line-height:1.6;">لم تقم بإضافة أدوات للمفضلة بعد.<br><span style="font-size:0.65rem; color:#666; margin-top:5px; display:inline-block;">اضغط مطولاً على أي أداة لإضافتها.</span></div>';
            if(topIcon) {
                topIcon.style.fill = 'none';
                topIcon.style.stroke = '#ffffff';
            }
            return;
        }

        let html = '';
        favorites.forEach(f => {
            html += `
            <div class="fav-item">
                <div class="fav-item-link" onclick="nav('${f.id}'); document.getElementById('favMenu').classList.remove('open');">
                    ${f.name}
                </div>
                <div class="fav-item-del" onclick="FavoritesManager.remove(event, '${f.id}')" title="إزالة من المفضلة">×</div>
            </div>`;
        });
        container.innerHTML = html;
        
        // إضاءة النجمة العلوية وجعلها صلبة بيضاء لوجود أدوات مفضلة
        if(topIcon) {
            topIcon.style.fill = '#ffffff';
            topIcon.style.stroke = '#ffffff';
        }
    }

    return { init, remove: removeFavorite };
})();

// وظيفة لفتح وإغلاق القائمة (تم ربطها بالزر العلوي)
window.toggleFavMenu = function(e) {
    if(e) e.stopPropagation();
    const menu = document.getElementById('favMenu');
    if(menu) menu.classList.toggle('open');
};

// تفعيل محرك المفضلة فور تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    FavoritesManager.init();
});

// =========================================================================
// 🛠️ الترقيع البرمجي الشامل (Auto-Patch) - مخصص للهاتف
// انسخ هذا المربع بالكامل والصقه في آخر سطر في ملفك 
// ليحل مشكلة العملات الصفرية والقسمة على صفر آلياً!
// =========================================================================

// 1. نظام فورمات الأسعار العالمي (يدعم حتى 8 أصفار عشرية لعملات الميم)
function smartFormat(p) {
  if (p === undefined || p === null || isNaN(p) || p === 0) return '0.00';
  let val = parseFloat(p), absVal = Math.abs(val);
  if (absVal >= 1000) return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (absVal >= 1) return val.toFixed(3);
  if (absVal >= 0.01) return val.toFixed(4);
  if (absVal >= 0.0001) return val.toFixed(6);
  return val.toFixed(8);
}

// 2. توحيد جميع دوال التنسيق وربطها بالدالة الذكية
window.fm = function(p) { return smartFormat(p); };
window.fmtCryptoPrice = function(p) { return '$' + smartFormat(p); };
window.fmtWedgePrice = function(p) { return '$' + smartFormat(p); };
window.sq9Format = function(p) { return smartFormat(p); };
window.formatPx = function(p) { return '$' + smartFormat(p); };

// 3. منع التقريب العنيف في دوال العرض المدمجة (toLocaleString)
const origToLocaleString = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function(locales, options) {
    let val = this.valueOf();
    let opt = options ? Object.assign({}, options) : {};
    if (Math.abs(val) > 0 && Math.abs(val) < 10) {
        if (opt.maximumFractionDigits === 0 || opt.maximumFractionDigits === 2) {
            if (Math.abs(val) < 0.0001) { opt.minimumFractionDigits = 8; opt.maximumFractionDigits = 8; }
            else if (Math.abs(val) < 0.01) { opt.minimumFractionDigits = 6; opt.maximumFractionDigits = 6; }
            else if (Math.abs(val) < 1) { opt.minimumFractionDigits = 4; opt.maximumFractionDigits = 4; }
            else { opt.minimumFractionDigits = 3; opt.maximumFractionDigits = 3; }
        }
    }
    return origToLocaleString.call(val, locales, opt);
};

// 4. إصلاح محرك الهارمونيك (إلغاء تقريب الأهداف السعرية للصفر)
const oldDetectHarmonicPattern = detectHarmonicPattern;
window.detectHarmonicPattern = function(highs, lows, closes, currentPrice) {
  let result = oldDetectHarmonicPattern(highs, lows, closes, currentPrice);
  if (result && result.found && result.points) {
    var pts = result.points;
    var CD_range = Math.abs(pts.D.price - pts.C.price);
    if (result.dir === 'bullish') {
      result.target1 = pts.D.price + (CD_range * 0.382);
      result.target2 = pts.D.price + (CD_range * 0.618);
    } else {
      result.target1 = pts.D.price - (CD_range * 0.382);
      result.target2 = pts.D.price - (CD_range * 0.618);
    }
  }
  return result;
};

// 5. إصلاح خطوط الكواكب (Astro Pro) 
window.calcPlanetaryPriceLines = function(planets, currentPrice) {
  var sf = currentPrice / 360; 
  var tradingPlanets = planets.filter(function(p) { return p.name !== 'Earth' && p.name !== 'Moon' && p.name !== 'Sun'; });
  var lines = [];
  tradingPlanets.forEach(function(p) {
    var bestPrice = p.degree * sf, bestDiff = Math.abs(bestPrice - currentPrice), limit = Math.ceil(currentPrice / (360 * sf)) + 2;
    for (var mult = 0; mult <= limit; mult++) {
      var candidate = (p.degree + mult * 360) * sf;
      if (Math.abs(candidate - currentPrice) < bestDiff) { bestDiff = Math.abs(candidate - currentPrice); bestPrice = candidate; }
    }
    lines.push({ planet: p.nameAr, color: p.color, degree: p.degree, price: bestPrice, distance: (((bestPrice - currentPrice) / currentPrice * 100) >= 0 ? '+' : '') + ((bestPrice - currentPrice) / currentPrice * 100).toFixed(2) + '%', position: bestPrice > currentPrice ? 'فوق' : 'تحت' });
  });
  lines.sort(function(a, b) { return Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice); });
  var nR = null, nS = null;
  lines.forEach(function(l) { if (l.position === 'فوق' && !nR) nR = l; if (l.position === 'تحت' && !nS) nS = l; });
  return { lines: lines, nearestResistance: nR, nearestSupport: nS };
};

// 6. تضمين التعديل الخاص بك لإصلاح قسمة Wedge على صفر وحمايته
window.detectWedge = function(highs, lows, closes, volumes, price) {
  var n = closes.length;
  var peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, n) : [];
  var troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, n) : [];
  if (peakIdxs.length < 3 || troughIdxs.length < 2) return { found: false, message: 'المعطيات غير كافية للنموذج.' };
  var bestWedge = null, bestScore = 0, startSearch = Math.max(0, peakIdxs.length - 8);
  for (var ui = startSearch; ui <= peakIdxs.length - 2; ui++) {
    var upperPivots = [];
    for (var uj = ui; uj < Math.min(ui + 4, peakIdxs.length); uj++) upperPivots.push({ idx: peakIdxs[uj], price: highs[peakIdxs[uj]] });
    if (upperPivots.length < 2) continue;
    var wStart = upperPivots[0].idx, wEnd = upperPivots[upperPivots.length - 1].idx;
    var lowerPivots = [];
    for (var li = 0; li < troughIdxs.length; li++) {
      if (troughIdxs[li] >= wStart - 5 && troughIdxs[li] <= wEnd + 5) lowerPivots.push({ idx: troughIdxs[li], price: lows[troughIdxs[li]] });
    }
    if (lowerPivots.length < 2) continue;
    var wedgeWidth = wEnd - wStart;
    if (wedgeWidth < 15 || wedgeWidth > 150) continue;
    var bestUpperLine = null;
    for (var i = 0; i < upperPivots.length - 1; i++) {
      for (var j = i + 1; j < upperPivots.length; j++) {
        var mU = (upperPivots[j].price - upperPivots[i].price) / (upperPivots[j].idx - upperPivots[i].idx || 1); 
        var bU = upperPivots[i].price - mU * upperPivots[i].idx;
        var validU = true;
        for (var k = 0; k < upperPivots.length; k++) {
          if (upperPivots[k].price > mU * upperPivots[k].idx + bU + 0.000001) { validU = false; break; }
        }
        if (validU) { bestUpperLine = { slope: mU, intercept: bU }; break; }
      }
      if (bestUpperLine) break;
    }
    if (!bestUpperLine) {
      var den2 = upperPivots[upperPivots.length - 1].idx - upperPivots[0].idx;
      var mfU = (upperPivots[upperPivots.length - 1].price - upperPivots[0].price) / (den2 === 0 ? 1 : den2);
      bestUpperLine = { slope: mfU, intercept: Math.max.apply(null, upperPivots.map(function(p) { return p.price - mfU * p.idx; })) };
    }
    var upperLine = bestUpperLine;
    var bestLowerLine = null;
    for (var x = 0; x < lowerPivots.length - 1; x++) {
      for (var y = x + 1; y < lowerPivots.length; y++) {
        var mL = (lowerPivots[y].price - lowerPivots[x].price) / (lowerPivots[y].idx - lowerPivots[x].idx || 1); 
        var bL = lowerPivots[x].price - mL * lowerPivots[x].idx;
        var validL = true;
        for (var z = 0; z < lowerPivots.length; z++) {
          if (lowerPivots[z].price < mL * lowerPivots[z].idx + bL - 0.000001) { validL = false; break; }
        }
        if (validL) { bestLowerLine = { slope: mL, intercept: bL }; break; }
      }
      if (bestLowerLine) break;
    }
    if (!bestLowerLine) {
      var den4 = lowerPivots[lowerPivots.length - 1].idx - lowerPivots[0].idx;
      var mfL = (lowerPivots[lowerPivots.length - 1].price - lowerPivots[0].price) / (den4 === 0 ? 1 : den4);
      bestLowerLine = { slope: mfL, intercept: Math.min.apply(null, lowerPivots.map(function(p) { return p.price - mfL * p.idx; })) };
    }
    var lowerLine = bestLowerLine;
    var bothRising = upperLine.slope > 0 && lowerLine.slope > 0;
    var bothFalling = upperLine.slope < 0 && lowerLine.slope < 0;
    if (!bothRising && !bothFalling) continue;
    var slopeDiff = upperLine.slope - lowerLine.slope;
    var apexIdx = (lowerLine.intercept - upperLine.intercept) / (slopeDiff === 0 ? 0.00001 : slopeDiff); 
    if (apexIdx < wEnd) continue; 
    var heightAtStart = (upperLine.intercept + upperLine.slope * wStart) - (lowerLine.intercept + lowerLine.slope * wStart);
    var heightAtEnd = (upperLine.intercept + upperLine.slope * wEnd) - (lowerLine.intercept + lowerLine.slope * wEnd);
    if (heightAtStart <= 0 || heightAtEnd <= 0 || heightAtEnd >= heightAtStart) continue;
    var convergenceRate = (heightAtStart - heightAtEnd) / heightAtStart;
    if (convergenceRate < 0.05) continue;
    var insideCount = 0;
    for (var ci = wStart; ci <= wEnd; ci++) {
      var upperVal = upperLine.intercept + upperLine.slope * ci, lowerVal = lowerLine.intercept + lowerLine.slope * ci, tol = (upperVal - lowerVal) * 0.15;
      if (closes[ci] <= upperVal + tol && closes[ci] >= lowerVal - tol) insideCount++;
    }
    var insideRatio = insideCount / (wedgeWidth + 1);
    if (insideRatio < 0.75) continue;
    var score = 50 + Math.min(convergenceRate * 100, 20) + insideRatio * 20;
    if (score > bestScore) {
      bestScore = score;
      var confirmLine = bothRising ? lowerLine : upperLine;
      var confirmPrice = confirmLine.intercept + confirmLine.slope * (n - 1);
      var wedgeBaseHeight = Math.abs(heightAtStart);
      var t1 = bothRising ? confirmPrice - (wedgeBaseHeight * 0.618) : confirmPrice + (wedgeBaseHeight * 0.618);
      var t2 = bothRising ? confirmPrice - (wedgeBaseHeight * 1.000) : confirmPrice + (wedgeBaseHeight * 1.000);
      var t3 = bothRising ? confirmPrice - (wedgeBaseHeight * 1.618) : confirmPrice + (wedgeBaseHeight * 1.618);
      var sl = bothRising ? Math.max.apply(null, upperPivots.map(function(p){return p.price;})) * 1.005 : Math.min.apply(null, lowerPivots.map(function(p){return p.price;})) * 0.995;
      bestWedge = {
        found: true, type: bothRising ? 'rising' : 'falling', typeEn: bothRising ? 'Rising Wedge' : 'Falling Wedge', typeAr: bothRising ? 'وتد صاعد' : 'وتد هابط',
        signal: bothRising ? 'BEARISH' : 'BULLISH', signalAr: bothRising ? 'انعكاسي هبوطي' : 'انعكاسي صعودي', score: Math.round(score),
        upperPivots: upperPivots, lowerPivots: lowerPivots, upperLine: upperLine, lowerLine: lowerLine, wedgeStart: wStart, wedgeEnd: wEnd,
        wedgeWidth: wedgeWidth, convergenceAngle: Math.abs(Math.atan2(heightAtStart - heightAtEnd, wedgeWidth) * 180 / Math.PI).toFixed(1) + '°',
        confirmPrice: confirmPrice, isBroken: bothRising ? (price < confirmPrice) : (price > confirmPrice), breakoutStatus: (bothRising ? (price < confirmPrice) : (price > confirmPrice)) ? 'CONFIRMED' : 'PENDING',
        target1: t1, target1Pct: ((t1 - price) / price * 100).toFixed(1) + '%', target2: t2, target2Pct: ((t2 - price) / price * 100).toFixed(1) + '%', target3: t3, target3Pct: ((t3 - price) / price * 100).toFixed(1) + '%',
        stopLoss: sl, stopDesc: bothRising ? "إغلاق أعلى مقاومة" : "إغلاق أسفل دعم", apexIdx: apexIdx, heightAtStart: heightAtStart, heightAtEnd: heightAtEnd,
        convergenceRate: (convergenceRate * 100).toFixed(1) + '%', volumeDecay: false, volumeDecayPct: '0%', insideRatio: (insideRatio * 100).toFixed(0) + '%'
      };
    }
  }
  return bestWedge || { found: false, message: 'لم يرصد وتد.' };
};

// ============================================================
// 🛡️ الجدار الناري الشامل (Global Security Firewall)
// ابتكار ذكي لحماية جميع أدوات المنصة (40+ أداة) بكتلة واحدة
// ============================================================
document.addEventListener('input', function(e) {
    // 1. نتحقق أولاً أن العنصر الذي يكتب فيه المستخدم هو حقل إدخال
    if (e.target && e.target.tagName === 'INPUT') {
        
        // 2. نجلب المعرّف (ID) الخاص بالحقل لنعرف هل هو حقل مخصص لاسم العملة أم لا
        const fieldId = (e.target.id || '').toLowerCase();
        
        // 3. نتحقق مما إذا كان المعرف يحتوي على كلمات تدل على أنه حقل عملة
        // بناءً على كودك، حقول العملات تحتوي على: symbol, coin, sym, cust
        if (fieldId.includes('symbol') || fieldId.includes('coin') || fieldId.includes('sym') || fieldId.includes('cust')) {
            
            let currentValue = e.target.value;
            
            // 4. التنظيف الآلي: السماح بالحروف الإنجليزية والأرقام فقط + تحويلها لحروف كبيرة
            let sanitizedValue = currentValue.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            
            // 5. تقييد الطول: السماح بـ 8 حروف كحد أقصى لحماية الذاكرة ومنع الحقن الطويل
            if (sanitizedValue.length > 8) {
                sanitizedValue = sanitizedValue.substring(0, 8);
            }
            
            // 6. تحديث الحقل فوراً أمام عين المستخدم (إذا حاول كتابة رمز مثل @ أو مسافة، سيختفي فوراً)
            if (currentValue !== sanitizedValue) {
                e.target.value = sanitizedValue;
            }
        }
    }
});
