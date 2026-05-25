
// ==========================================
// محرك EMA Ribbon — شريط 8 متوسطات متحركة
// الدقة الرياضية: جلب 1000 شمعة لحساب EMA200 الصحيح
// ==========================================

async function runEMARibbon() {
  var coinInput = document.getElementById('er-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('er-tf').value.toLowerCase();
  var btn = document.getElementById('er-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري حساب البيانات المؤسسية...';
  btn.disabled = true;

  try {
    // رفع الـ limit إلى 500 لتوفير فترة إحماء (Burn-in) كافية للـ EMA
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    var raw = await res.json();

    if (raw.length < 200) throw new Error('بيانات غير كافية (يتطلب 200 شمعة على الأقل لحساب EMA200).');

    var closes = raw.map(function(k) { return parseFloat(k[4]); });
    var currentPrice = closes[closes.length - 1];

    var result = analyzeEMARibbon(closes, currentPrice);
    renderEMARibbonDashboard(symbol, currentPrice, tfInput.toUpperCase(), result);
    document.getElementById('er-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'تحليل شريط المتوسطات';
    btn.disabled = false;
  }
}

function analyzeEMARibbon(closes, currentPrice) {
  var periods = [8, 13, 21, 34, 55, 89, 100, 200];
  var colors = ['var(--o)', '#ff8533', '#ffaa66', '#ffffff', '#cccccc', '#888888', '#666666', '#444444'];
  var n = closes.length;

  var emaArrays = periods.map(function(p) {
    return calcEMAArray(closes, p);
  });

  var emas = periods.map(function(p, i) {
    return {
      period: p,
      value: emaArrays[i][n - 1],
      prevValue: emaArrays[i][n - 2],
      color: colors[i]
    };
  });

  var bullishOrder = 0;
  var bearishOrder = 0;
  var totalPairs = 0;

  for (var i = 0; i < emas.length - 1; i++) {
    totalPairs++;
    if (emas[i].value > emas[i + 1].value) bullishOrder++;
    else bearishOrder++;
  }

  var orderPct = Math.round((Math.max(bullishOrder, bearishOrder) / totalPairs) * 100);
  var order = 'tangled';
  if (bullishOrder === totalPairs) order = 'bullish';
  else if (bearishOrder === totalPairs) order = 'bearish';
  else if (bullishOrder >= totalPairs - 1) order = 'mostly_bullish';
  else if (bearishOrder >= totalPairs - 1) order = 'mostly_bearish';

  var fastEMA = emas[0].value; 
  var slowEMA = emas[emas.length - 1].value; 
  var spread = Math.abs((fastEMA - slowEMA) / slowEMA * 100);

  var spreadStatus = '';
  if (spread > 10) spreadStatus = 'واسع جداً';
  else if (spread > 5) spreadStatus = 'واسع';
  else if (spread > 2) spreadStatus = 'معتدل';
  else spreadStatus = 'ضيق';

  var aboveCount = 0;
  emas.forEach(function(e) { if (currentPrice > e.value) aboveCount++; });

  var pricePosition = '';
  var posSignal = 'neutral';
  if (aboveCount === emas.length) { pricePosition = 'فوق الشريط'; posSignal = 'bullish'; }
  else if (aboveCount === 0) { pricePosition = 'تحت الشريط'; posSignal = 'bearish'; }
  else if (aboveCount >= emas.length - 2) { pricePosition = 'فوق أغلب المتوسطات'; posSignal = 'bullish'; }
  else if (aboveCount <= 2) { pricePosition = 'تحت أغلب المتوسطات'; posSignal = 'bearish'; }
  else { pricePosition = 'داخل الشريط'; posSignal = 'neutral'; }

  var ema8 = emaArrays[0];   
  var ema21 = emaArrays[2];  
  var ema100 = emaArrays[6]; 
  var ema200 = emaArrays[7]; 

  var recentCross = null;

  for (var j = n - 1; j >= n - 30 && j >= 1; j--) {
    var curr8above21 = ema8[j] > ema21[j];
    var prev8above21 = ema8[j - 1] > ema21[j - 1];

    if (curr8above21 && !prev8above21) {
      recentCross = { type: 'golden', pair: 'EMA8 × EMA21', candles: n - 1 - j };
      break;
    }
    if (!curr8above21 && prev8above21) {
      recentCross = { type: 'death', pair: 'EMA8 × EMA21', candles: n - 1 - j };
      break;
    }
  }

  if (!recentCross) {
    for (var k = n - 1; k >= n - 50 && k >= 1; k--) {
      var curr100above200 = ema100[k] > ema200[k];
      var prev100above200 = ema100[k - 1] > ema200[k - 1];

      if (curr100above200 && !prev100above200) {
        recentCross = { type: 'golden', pair: 'EMA100 × EMA200', candles: n - 1 - k };
        break;
      }
      if (!curr100above200 && prev100above200) {
        recentCross = { type: 'death', pair: 'EMA100 × EMA200', candles: n - 1 - k };
        break;
      }
    }
  }

  return {
    emas: emas,
    order: order,
    orderPct: orderPct,
    spread: spread.toFixed(2),
    spreadStatus: spreadStatus,
    pricePosition: pricePosition,
    posSignal: posSignal,
    aboveCount: aboveCount,
    recentCross: recentCross
  };
}

function renderEMARibbonDashboard(symbol, price, tf, r) {
  document.getElementById('er-pair').textContent = symbol;
  document.getElementById('er-price').textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  document.getElementById('er-tf-label').textContent = tf;

  var allValues = r.emas.map(function(e) { return e.value; });
  allValues.push(price);
  var minVal = Math.min.apply(null, allValues) * 0.998;
  var maxVal = Math.max.apply(null, allValues) * 1.002;
  var range = maxVal - minVal;

  var ribbonHtml = '';
  var pricePct = ((price - minVal) / range) * 100;
  ribbonHtml += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">';
  ribbonHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); font-weight:bold; min-width:50px;">PRICE</span>';
  ribbonHtml += '<div style="flex:1; position:relative; height:8px;">';
  ribbonHtml += '<div style="position:absolute; left:0; right:0; top:50%; height:1px; background:var(--o); opacity:0.3; transform:translateY(-50%);"></div>';
  ribbonHtml += '<div style="position:absolute; left:' + pricePct + '%; top:50%; transform:translate(-50%,-50%); width:8px; height:8px; background:var(--o); border-radius:50%; border:2px solid var(--o); z-index:5;"></div>';
  ribbonHtml += '</div>';
  ribbonHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); font-weight:bold; min-width:70px; text-align:left; direction:ltr;">$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</span></div>';

  r.emas.forEach(function(ema, i) {
    var emaPct = ((ema.value - minVal) / range) * 100;
    ribbonHtml += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">';
    ribbonHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + ema.color + '; font-weight:bold; min-width:50px;">EMA' + ema.period + '</span>';
    ribbonHtml += '<div style="flex:1; position:relative; height:6px; background:#111; border-radius:3px;">';
    ribbonHtml += '<div style="position:absolute; left:0; height:100%; border-radius:3px; width:' + emaPct + '%; background:linear-gradient(90deg, transparent, ' + ema.color + '88); animation:slideIn 1.5s ease ' + (i * 0.1) + 's forwards;"></div>';
    ribbonHtml += '<div style="position:absolute; left:' + emaPct + '%; top:50%; transform:translate(-50%,-50%); width:6px; height:6px; background:' + ema.color + '; border-radius:50%;"></div>';
    ribbonHtml += '</div>';
    ribbonHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + ema.color + '; min-width:70px; text-align:left; direction:ltr;">$' + ema.value.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</span></div>';
  });

  document.getElementById('er-ribbon-visual').innerHTML = ribbonHtml;

  var orderLabel = '';
  var orderColor = '#555';
  if (r.order === 'bullish') { orderLabel = 'صعودي'; orderColor = '#fff'; }
  else if (r.order === 'bearish') { orderLabel = 'هبوطي'; orderColor = 'var(--o)'; }
  else if (r.order === 'mostly_bullish') { orderLabel = 'أغلبه صعودي'; orderColor = 'rgba(255,255,255,0.7)'; }
  else if (r.order === 'mostly_bearish') { orderLabel = 'أغلبه هبوطي'; orderColor = 'rgba(255,106,0,0.7)'; }
  else { orderLabel = 'متشابك'; orderColor = '#555'; }

  var posColor = r.posSignal === 'bullish' ? '#fff' : r.posSignal === 'bearish' ? 'var(--o)' : '#888';

  var cardsHtml = '';
  cardsHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center; border-top:2px solid ' + orderColor + ';">';
  cardsHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">ORDER</div>';
  cardsHtml += '<div style="font-size:0.75rem; color:' + orderColor + '; font-weight:700;">' + orderLabel + '</div>';
  cardsHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#444; margin-top:2px;">' + r.orderPct + '%</div></div>';

  cardsHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center; border-top:2px solid #888;">';
  cardsHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">SPREAD</div>';
  cardsHtml += '<div style="font-size:0.75rem; color:#fff; font-weight:700;">' + r.spread + '%</div>';
  cardsHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#888; margin-top:2px;">' + r.spreadStatus + '</div></div>';

  cardsHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center; border-top:2px solid ' + posColor + ';">';
  cardsHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">POSITION</div>';
  cardsHtml += '<div style="font-size:0.65rem; color:' + posColor + '; font-weight:700; line-height:1.3;">' + r.pricePosition + '</div>';
  cardsHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#444; margin-top:2px;">' + r.aboveCount + '/8</div></div>';

  document.getElementById('er-cards').innerHTML = cardsHtml;

  var crossDiv = document.getElementById('er-crossover');
  if (r.recentCross) {
    var crossColor = r.recentCross.type === 'golden' ? '#fff' : 'var(--o)';
    var crossBg = r.recentCross.type === 'golden' ? 'rgba(255,255,255,0.03)' : 'rgba(255,106,0,0.06)';
    var crossBorder = r.recentCross.type === 'golden' ? 'rgba(255,255,255,0.1)' : 'rgba(255,106,0,0.2)';
    var crossLabel = r.recentCross.type === 'golden' ? 'GOLDEN CROSS' : 'DEATH CROSS';
    var crossDesc = r.recentCross.type === 'golden'
      ? 'تقاطع إيجابي (' + r.recentCross.pair + ') قبل ' + r.recentCross.candles + ' شموع — إشارة صعودية'
      : 'تقاطع سلبي (' + r.recentCross.pair + ') قبل ' + r.recentCross.candles + ' شموع — إشارة هبوطية';

    crossDiv.innerHTML = '<div style="background:' + crossBg + '; border:1px solid ' + crossBorder + '; border-radius:10px; padding:14px; border-right:3px solid ' + crossColor + ';">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
      '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + crossColor + '; letter-spacing:1px; font-weight:bold;">' + crossLabel + '</span>' +
      '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#888;">قبل ' + r.recentCross.candles + ' شموع</span>' +
      '</div>' +
      '<div style="font-size:0.72rem; color:#999; line-height:1.5;">' + crossDesc + '</div></div>';
  } else {
    crossDiv.innerHTML = '';
  }

  var tableHtml = '';
  r.emas.forEach(function(ema) {
    var diff = ((price - ema.value) / ema.value * 100).toFixed(2);
    var isAbove = price > ema.value;
    var diffColor = isAbove ? '#fff' : 'var(--o)';
    var tagColor = isAbove ? '#fff' : 'var(--o)';
    var tagBg = isAbove ? 'rgba(255,255,255,0.06)' : 'rgba(255,106,0,0.1)';
    var tagBorder = isAbove ? 'rgba(255,255,255,0.12)' : 'rgba(255,106,0,0.2)';
    var tagText = isAbove ? 'فوق' : 'تحت';

    tableHtml += '<tr style="border-bottom:1px solid #111;">';
    tableHtml += '<td style="padding:6px 4px; font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:' + ema.color + '; font-weight:bold;">EMA ' + ema.period + '</td>';
    tableHtml += '<td style="padding:6px 4px; font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#fff;">$' + ema.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</td>';
    tableHtml += '<td style="padding:6px 4px; font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:' + diffColor + '; direction:ltr;">' + (isAbove ? '+' : '') + diff + '%</td>';
    tableHtml += '<td style="padding:6px 4px;"><span style="font-size:0.5rem; padding:2px 6px; border-radius:6px; color:' + tagColor + '; background:' + tagBg + '; border:1px solid ' + tagBorder + ';">' + tagText + '</span></td>';
    tableHtml += '</tr>';
  });
  document.getElementById('er-table-body').innerHTML = tableHtml;

  var conclusion = '';
  if (r.order === 'bullish') conclusion += 'شريط المتوسطات مرتب بانتظام صعودي — تدفق سيولة إيجابي وهيكل صحي. ';
  else if (r.order === 'bearish') conclusion += 'شريط المتوسطات مرتب بانتظام هبوطي — ضغط بيعي مهيمن. ';
  else if (r.order === 'mostly_bullish') conclusion += 'أغلب المتوسطات بترتيب صعودي مع تداخل طفيف — الاتجاه يميل للإيجابية. ';
  else if (r.order === 'mostly_bearish') conclusion += 'أغلب المتوسطات بترتيب هبوطي — ميل للضغط السلبي. ';
  else conclusion += 'المتوسطات متشابكة بشكل معقد — السوق في مرحلة تذبذب عرضي وغياب اتجاه. ';

  if (r.posSignal === 'bullish') conclusion += 'السعر أعلى الشريط (' + r.aboveCount + '/8). ';
  else if (r.posSignal === 'bearish') conclusion += 'السعر أسفل الشريط (' + (8 - r.aboveCount) + '/8). ';
  else conclusion += 'السعر يتداول داخل الشريط — مرحلة اختبار للسيولة. ';

  conclusion += 'انتشار النطاق ' + r.spreadStatus + ' (' + r.spread + '%). ';

  if (r.recentCross) {
    if (r.recentCross.type === 'golden') conclusion += 'تقاطع إيجابي رُصد مؤخراً يدعم الزخم الصاعد. ';
    else conclusion += 'تقاطع سلبي رُصد مؤخراً يفرض الحذر. ';
  }

  document.getElementById('er-conclusion').textContent = conclusion;
}

// ==========================================
// محرك Trend Compass — بوصلة الاتجاه
// 5 مؤشرات كلاسيكية (مع جلب 500 شمعة للضبط الرياضي)
// ==========================================

async function runTrendCompass() {
  var coinInput = document.getElementById('tc-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('tc-tf').value.toLowerCase();
  var btn = document.getElementById('tc-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري تحليل 5 مؤشرات...';
  btn.disabled = true;

  try {
    // رفع limit إلى 1000 لضمان دقة EMA200 وتراكم ADX الرياضي
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    var raw = await res.json();

    if (raw.length < 250) throw new Error('بيانات غير كافية (يتطلب 250 شمعة على الأقل كحد أدنى رياضي).');

    var candles = raw.map(function(k) {
      return {
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4])
      };
    });

    var closes = candles.map(function(c) { return c.close; });
    var highs = candles.map(function(c) { return c.high; });
    var lows = candles.map(function(c) { return c.low; });
    var currentPrice = closes[closes.length - 1];

    var result = analyzeTrendCompass(candles, closes, highs, lows, currentPrice);
    renderTrendCompassDashboard(symbol, currentPrice, tfInput.toUpperCase(), result);
    document.getElementById('tc-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'تحديد الاتجاه';
    btn.disabled = false;
  }
}

function analyzeTrendCompass(candles, closes, highs, lows, currentPrice) {
  var n = closes.length;
  var indicators = [];

  // 1. Price vs EMA200
  var ema200 = calcEMAArray(closes, 200);
  var ema200Val = ema200[n - 1];
  var ema200Diff = ((currentPrice - ema200Val) / ema200Val * 100).toFixed(1);
  var ema200Above = currentPrice > ema200Val;

  indicators.push({
    name: 'EMA200',
    signal: ema200Above ? 'bullish' : 'bearish',
    label: ema200Above ? 'السعر فوق EMA200' : 'السعر تحت EMA200',
    value: (ema200Above ? '+' : '') + ema200Diff + '%',
    detail: '$' + currentPrice.toLocaleString('en-US', {maximumFractionDigits: 0}) + (ema200Above ? ' فوق ' : ' تحت ') + '$' + ema200Val.toLocaleString('en-US', {maximumFractionDigits: 0})
  });

  // 2. ADX + DI
  var adxResult = calcADX(highs, lows, closes, 14);
  var adxSignal = 'neutral';
  var adxLabel = '';
  var adxDetail = '';

  if (adxResult.adx > 25) {
    if (adxResult.pdi > adxResult.mdi) { adxSignal = 'bullish'; adxLabel = 'اتجاه صاعد قوي'; } 
    else { adxSignal = 'bearish'; adxLabel = 'اتجاه هابط قوي'; }
  } else if (adxResult.adx > 20) {
    if (adxResult.pdi > adxResult.mdi) { adxSignal = 'bullish'; adxLabel = 'اتجاه صاعد معتدل'; } 
    else { adxSignal = 'bearish'; adxLabel = 'اتجاه هابط معتدل'; }
  } else {
    adxLabel = 'لا اتجاه واضح (تذبذب)';
  }
  adxDetail = 'ADX ' + adxResult.adx.toFixed(1) + ' | +DI ' + adxResult.pdi.toFixed(1) + ' | -DI ' + adxResult.mdi.toFixed(1);

  indicators.push({ name: 'ADX', signal: adxSignal, label: adxLabel, value: adxResult.adx.toFixed(1), detail: adxDetail });

  // 3. SuperTrend
  var stResult = calcSuperTrend(highs, lows, closes, 10, 3);
  indicators.push({
    name: 'SuperTrend',
    signal: stResult.signal,
    label: stResult.signal === 'bullish' ? 'صعود نشط' : 'هبوط نشط',
    value: '$' + stResult.value.toLocaleString('en-US', {maximumFractionDigits: 0}),
    detail: (stResult.signal === 'bullish' ? 'دعم' : 'مقاومة') + ' ديناميكي | ATR $' + stResult.atr.toLocaleString('en-US', {maximumFractionDigits: 0})
  });

  // 4. هيكل السعر
  var peaks = findPeaks(highs, n - 60, n);
  var troughsList = findTroughs(lows, n - 60, n);

  var structSignal = 'neutral';
  var structLabel = 'غير محدد';
  var structDetail = '';

  if (peaks.length >= 2 && troughsList.length >= 2) {
    var lastPeak = peaks[peaks.length - 1];
    var prevPeak = peaks[peaks.length - 2];
    var lastTrough = troughsList[troughsList.length - 1];
    var prevTrough = troughsList[troughsList.length - 2];

    var hh = highs[lastPeak] > highs[prevPeak];
    var hl = lows[lastTrough] > lows[prevTrough];
    var lh = highs[lastPeak] < highs[prevPeak];
    var ll = lows[lastTrough] < lows[prevTrough];

    if (hh && hl) { structSignal = 'bullish'; structLabel = 'قمم وقيعان أعلى'; structDetail = 'HH + HL — هيكل صاعد مؤكد'; } 
    else if (lh && ll) { structSignal = 'bearish'; structLabel = 'قمم وقيعان أدنى'; structDetail = 'LH + LL — هيكل هابط مؤكد'; } 
    else if (hh && !hl) { structSignal = 'bullish'; structLabel = 'قمم أعلى'; structDetail = 'HH — ميل صعودي غير مكتمل'; } 
    else if (hl && !hh) { structSignal = 'bullish'; structLabel = 'قيعان أعلى'; structDetail = 'HL — تجميع صعودي'; } 
    else if (lh && !ll) { structSignal = 'bearish'; structLabel = 'قمم أدنى'; structDetail = 'LH — ميل هبوطي'; } 
    else if (ll && !lh) { structSignal = 'bearish'; structLabel = 'قيعان أدنى'; structDetail = 'LL — ضغط بيعي'; } 
    else { structLabel = 'هيكل عرضي'; structDetail = 'لا قمم/قيعان واضحة الاتجاه'; }
  } else {
    structLabel = 'بيانات غير كافية'; structDetail = 'لم يتم رصد قمم/قيعان ضمن النطاق';
  }

  indicators.push({ name: 'هيكل السعر', signal: structSignal, label: structLabel, value: structSignal === 'bullish' ? 'HH+HL' : structSignal === 'bearish' ? 'LH+LL' : '--', detail: structDetail });

  // 5. EMA8 × EMA21
  var ema8 = calcEMAArray(closes, 8);
  var ema21 = calcEMAArray(closes, 21);
  var ema8Val = ema8[n - 1];
  var ema21Val = ema21[n - 1];
  var ema8Prev = ema8[n - 2];
  var ema21Prev = ema21[n - 2];

  var crossSignal = 'neutral';
  var crossLabel = '';
  var crossValue = '';
  var crossDetail = '';

  if (ema8Val > ema21Val && ema8Prev <= ema21Prev) {
    crossSignal = 'bullish'; crossLabel = 'تقاطع إيجابي حديث'; crossValue = '8 > 21'; crossDetail = 'EMA8 عبرت فوق EMA21 — زخم صاعد';
  } else if (ema8Val < ema21Val && ema8Prev >= ema21Prev) {
    crossSignal = 'bearish'; crossLabel = 'تقاطع سلبي حديث'; crossValue = '8 < 21'; crossDetail = 'EMA8 عبرت تحت EMA21 — زخم هابط';
  } else if (ema8Val > ema21Val) {
    var gap = Math.abs(ema8Val - ema21Val);
    var gapPct = (gap / ema21Val * 100).toFixed(2);
    if (parseFloat(gapPct) < 0.5) {
      crossLabel = 'تقارب'; crossValue = '8 ≈ 21'; crossDetail = 'EMA8 قريب من EMA21 — تقاطع وشيك';
    } else {
      crossSignal = 'bullish'; crossLabel = 'صاعد'; crossValue = '8 > 21'; crossDetail = 'EMA8 فوق EMA21 بنسبة ' + gapPct + '%';
    }
  } else {
    var gap2 = Math.abs(ema8Val - ema21Val);
    var gapPct2 = (gap2 / ema21Val * 100).toFixed(2);
    if (parseFloat(gapPct2) < 0.5) {
      crossLabel = 'تقارب'; crossValue = '8 ≈ 21'; crossDetail = 'EMA8 قريب من EMA21 — تقاطع وشيك';
    } else {
      crossSignal = 'bearish'; crossLabel = 'هابط'; crossValue = '8 < 21'; crossDetail = 'EMA8 تحت EMA21 بنسبة ' + gapPct2 + '%';
    }
  }

  indicators.push({ name: 'EMA Cross', signal: crossSignal, label: crossLabel, value: crossValue, detail: crossDetail });

  // حساب الثقة المجمعة
  var bullCount = indicators.filter(function(i) { return i.signal === 'bullish'; }).length;
  var bearCount = indicators.filter(function(i) { return i.signal === 'bearish'; }).length;
  var direction = 'neutral';
  var confidence = 50;

  if (bullCount >= 4) { direction = 'bullish'; confidence = 80 + (bullCount === 5 ? 15 : 0); }
  else if (bullCount === 3) { direction = 'bullish'; confidence = 65; }
  else if (bearCount >= 4) { direction = 'bearish'; confidence = 80 + (bearCount === 5 ? 15 : 0); }
  else if (bearCount === 3) { direction = 'bearish'; confidence = 65; }
  else { confidence = 40; }

  if (adxResult.adx > 30) confidence = Math.min(95, confidence + 5);
  else if (adxResult.adx < 20) confidence = Math.max(20, confidence - 10);

  return { indicators: indicators, direction: direction, confidence: confidence, bullCount: bullCount, bearCount: bearCount };
}

function calcADX(highs, lows, closes, period) {
  var n = highs.length;
  if (n < period * 2) return { adx: 0, pdi: 0, mdi: 0 };
  var tr = [], plusDM = [], minusDM = [];
  for (var i = 1; i < n; i++) {
    var h = highs[i], l = lows[i], pc = closes[i - 1];
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    var upMove = highs[i] - highs[i - 1];
    var downMove = lows[i - 1] - lows[i];
    if (upMove > downMove && upMove > 0) { plusDM.push(upMove); } else { plusDM.push(0); }
    if (downMove > upMove && downMove > 0) { minusDM.push(downMove); } else { minusDM.push(0); }
  }
  var atr = tr.slice(0, period).reduce(function(a, b) { return a + b; }, 0) / period;
  var smoothPDM = plusDM.slice(0, period).reduce(function(a, b) { return a + b; }, 0) / period;
  var smoothMDM = minusDM.slice(0, period).reduce(function(a, b) { return a + b; }, 0) / period;
  var dxValues = [];
  for (var j = period; j < tr.length; j++) {
    atr = ((atr * (period - 1)) + tr[j]) / period;
    smoothPDM = ((smoothPDM * (period - 1)) + plusDM[j]) / period;
    smoothMDM = ((smoothMDM * (period - 1)) + minusDM[j]) / period;
    var pdi = atr > 0 ? (smoothPDM / atr) * 100 : 0;
    var mdi = atr > 0 ? (smoothMDM / atr) * 100 : 0;
    var diSum = pdi + mdi;
    var dx = diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0;
    dxValues.push({ dx: dx, pdi: pdi, mdi: mdi });
  }
  if (dxValues.length < period) return { adx: 0, pdi: 0, mdi: 0 };
  var adx = dxValues.slice(0, period).reduce(function(a, b) { return a + b.dx; }, 0) / period;
  for (var k = period; k < dxValues.length; k++) {
    adx = ((adx * (period - 1)) + dxValues[k].dx) / period;
  }
  var lastDX = dxValues[dxValues.length - 1];
  return { adx: adx, pdi: lastDX.pdi, mdi: lastDX.mdi };
}

function calcSuperTrend(highs, lows, closes, atrPeriod, multiplier) {
  var n = highs.length;
  if (n < atrPeriod + 1) return { signal: 'neutral', value: 0, atr: 0 };
  var trArr = [];
  for (var i = 1; i < n; i++) {
    trArr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  var atr = trArr.slice(0, atrPeriod).reduce(function(a, b) { return a + b; }, 0) / atrPeriod;
  for (var j = atrPeriod; j < trArr.length; j++) {
    atr = ((atr * (atrPeriod - 1)) + trArr[j]) / atrPeriod;
  }
  var upperBand = [], lowerBand = [], superTrend = [], direction = [];
  for (var k = 0; k < n; k++) {
    var hl2 = (highs[k] + lows[k]) / 2;
    var up = hl2 + multiplier * atr;
    var dn = hl2 - multiplier * atr;
    if (k === 0) {
      upperBand.push(up); lowerBand.push(dn); superTrend.push(dn); direction.push(1); continue;
    }
    if (up < upperBand[k - 1] || closes[k - 1] > upperBand[k - 1]) upperBand.push(up); else upperBand.push(upperBand[k - 1]);
    if (dn > lowerBand[k - 1] || closes[k - 1] < lowerBand[k - 1]) lowerBand.push(dn); else lowerBand.push(lowerBand[k - 1]);
    if (direction[k - 1] === 1) {
      if (closes[k] < lowerBand[k]) { direction.push(-1); superTrend.push(upperBand[k]); } else { direction.push(1); superTrend.push(lowerBand[k]); }
    } else {
      if (closes[k] > upperBand[k]) { direction.push(1); superTrend.push(lowerBand[k]); } else { direction.push(-1); superTrend.push(upperBand[k]); }
    }
  }
  return { signal: direction[n - 1] === 1 ? 'bullish' : 'bearish', value: superTrend[n - 1], atr: atr };
}

function renderTrendCompassDashboard(symbol, price, tf, r) {
  document.getElementById('tc-pair').textContent = symbol;
  document.getElementById('tc-price').textContent = '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  document.getElementById('tc-tf-label').textContent = tf;

  var dirColor = r.direction === 'bullish' ? '#ffffff' : r.direction === 'bearish' ? 'var(--o)' : '#555';
  var dirLabel = r.direction === 'bullish' ? 'صاعد' : r.direction === 'bearish' ? 'هابط' : 'محايد';
  var dirEn = r.direction === 'bullish' ? 'BULLISH' : r.direction === 'bearish' ? 'BEARISH' : 'NEUTRAL';

  var centralHtml = '<div style="display:flex; justify-content:center; margin-bottom:20px;">' +
    '<div style="position:relative; width:140px; height:140px;">' +
    '<svg width="140" height="140" viewBox="0 0 140 140" style="transform:rotate(-90deg);">' +
    '<circle cx="70" cy="70" r="60" fill="none" stroke="#111" stroke-width="5"/>' +
    '<circle cx="70" cy="70" r="60" fill="none" stroke="' + dirColor + '" stroke-width="5" stroke-dasharray="377" stroke-dashoffset="' + (377 - (r.confidence / 100 * 377)) + '" stroke-linecap="round" style="transition:stroke-dashoffset 2s cubic-bezier(0.4,0,0.2,1); animation:glowRing 4s ease infinite;"/>' +
    '</svg>' +
    '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">' +
    '<div style="font-family:\'Share Tech Mono\',monospace; font-size:2.2rem; font-weight:bold; color:' + dirColor + '; line-height:1;">' + r.confidence + '%</div>' +
    '</div></div></div>' +
    '<div style="margin-bottom:16px;">' +
    '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444; letter-spacing:3px; margin-bottom:6px;">DIRECTION</div>' +
    '<div style="font-size:1.3rem; font-weight:900; color:' + dirColor + '; letter-spacing:1px;">' + dirLabel + '</div>' +
    '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#333; margin-top:2px; letter-spacing:2px;">' + dirEn + '</div>' +
    '</div>' +
    '<div style="display:flex; justify-content:center; gap:8px; margin-bottom:12px;">';

  r.indicators.forEach(function(ind) {
    var c = ind.signal === 'bullish' ? '#fff' : ind.signal === 'bearish' ? 'var(--o)' : '#333';
    centralHtml += '<div style="width:10px; height:10px; border-radius:50%; background:' + c + ';"></div>';
  });
  
  centralHtml += '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#555;">' + r.bullCount + ' صعود / ' + r.bearCount + ' هبوط / ' + (5 - r.bullCount - r.bearCount) + ' محايد</div>';
  document.getElementById('tc-central').innerHTML = centralHtml;

  var cardsHtml = '';
  r.indicators.forEach(function(ind, i) {
    var c = ind.signal === 'bullish' ? '#fff' : ind.signal === 'bearish' ? 'var(--o)' : '#555';
    var bg = ind.signal === 'bullish' ? 'rgba(255,255,255,0.03)' : ind.signal === 'bearish' ? 'rgba(255,106,0,0.05)' : 'transparent';
    var border = ind.signal === 'bullish' ? 'rgba(255,255,255,0.1)' : ind.signal === 'bearish' ? 'rgba(255,106,0,0.15)' : '#1a1a1a';
    var tag = ind.signal === 'bullish' ? 'BULL' : ind.signal === 'bearish' ? 'BEAR' : 'WAIT';
    var tagColor = ind.signal === 'neutral' ? '#555' : '#000';

    cardsHtml += '<div style="background:' + bg + '; border:1px solid ' + border + '; border-radius:10px; padding:12px 14px; border-right:3px solid ' + c + '; animation:fadeUp 0.4s ease ' + (0.4 + i * 0.08) + 's both;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
      '<div style="display:flex; align-items:center; gap:8px;">' +
      '<div style="width:6px; height:6px; border-radius:50%; background:' + c + ';"></div>' +
      '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#fff; font-weight:bold;">' + ind.name + '</span>' +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:8px;">' +
      '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:' + c + '; font-weight:bold;">' + ind.value + '</span>' +
      '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; font-weight:700; padding:2px 7px; border-radius:8px; letter-spacing:0.5px; color:' + tagColor + '; background:' + c + ';">' + tag + '</span>' +
      '</div></div>' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
      '<span style="font-size:0.68rem; color:' + c + '; font-weight:600;">' + ind.label + '</span>' +
      '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#444;">' + ind.detail + '</span>' +
      '</div></div>';
  });
  document.getElementById('tc-cards').innerHTML = cardsHtml;

  var conclusion = 'البوصلة تشير نحو الاتجاه ' + (r.direction === 'bullish' ? 'الصاعد' : r.direction === 'bearish' ? 'الهابط' : 'العرضي') + ' بمستوى ثقة ' + r.confidence + '%. ';
  conclusion += 'هناك ' + r.bullCount + ' من 5 مؤشرات تدعم الصعود، بينما ' + r.bearCount + ' من 5 تدعم الهبوط. ';

  r.indicators.forEach(function(ind) {
    if (ind.name === 'ADX' && parseFloat(ind.value) > 25) conclusion += 'مؤشر ADX يؤكد وجود قوة فعلية في الزخم الحالي. ';
    if (ind.name === 'هيكل السعر' && ind.signal !== 'neutral') conclusion += 'هيكل قمم/قيعان السعر يطابق اتجاه البوصلة. ';
  });

  if (r.confidence >= 80) conclusion += 'يُنصح بالبقاء مع الاتجاه المرجّح بثقة تامة مع الالتزام بوقف الخسارة الميكانيكي.';
  else if (r.confidence >= 60) conclusion += 'الإشارة جيدة لكن تفتقر للدعم الجماعي من المؤشرات، يُفضل الحذر أو تخفيض أحجام التداول.';
  else conclusion += 'يُنصح بشدة بالانتظار حتى يحدث توافق بين مؤشرات الزخم والهيكل السعري.';

  document.getElementById('tc-conclusion').textContent = conclusion;
}

if (!document.getElementById('tc-pulse-style')) {
  var tcStyle = document.createElement('style');
  tcStyle.id = 'tc-pulse-style';
  tcStyle.textContent = '@keyframes glowRing{0%,100%{filter:drop-shadow(0 0 2px rgba(255,106,0,0.1))}50%{filter:drop-shadow(0 0 10px rgba(255,106,0,0.3))}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(tcStyle);
}

// ==========================================
// محرك Triple Lens — العدسة الثلاثية
// إيشيموكو + بولنجر + Volume Profile
// التحسين: تم تصحيح خطأ (null object) وتوسيع بيانات الحجم
// ==========================================

async function runTripleLens() {
  var coinInput = document.getElementById('tl-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('tl-tf').value.toLowerCase();
  var btn = document.getElementById('tl-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING...';
  btn.disabled = true;

  try {
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    var raw = await res.json();

    if (raw.length < 100) throw new Error('بيانات غير كافية (100 شمعة على الأقل مطلوبة).');

    var candles = raw.map(function(k) {
      return {
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      };
    });

    var currentPrice = candles[candles.length - 1].close;
    var result = analyzeTripleLens(candles, currentPrice);

    renderTripleLensDashboard(symbol, currentPrice, tfInput.toUpperCase(), result);
    document.getElementById('tl-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function analyzeTripleLens(candles, currentPrice) {
  var closes = candles.map(function(c) { return c.close; });
  var highs = candles.map(function(c) { return c.high; });
  var lows = candles.map(function(c) { return c.low; });
  var n = closes.length;

  var lenses = [];

  var ichiResult = calcIchimoku(highs, lows, closes, n);
  lenses.push(ichiResult);

  var bbResult = calcBollingerLens(closes, n, currentPrice);
  lenses.push(bbResult);

  var vpResult = calcVolumeProfile(candles, currentPrice);
  lenses.push(vpResult);

  var bullCount = lenses.filter(function(l) { return l.signal === 'bullish'; }).length;
  var bearCount = lenses.filter(function(l) { return l.signal === 'bearish'; }).length;
  var neutCount = lenses.filter(function(l) { return l.signal === 'neutral'; }).length;

  var direction = 'neutral';
  var confidence = 50;

  if (bullCount >= 2) {
    direction = 'bullish';
    var totalScore = 0, totalMax = 0;
    lenses.forEach(function(l) { totalScore += l.score; totalMax += l.maxScore; });
    confidence = Math.round((totalScore / totalMax) * 100);
  } else if (bearCount >= 2) {
    direction = 'bearish';
    var totalScore2 = 0, totalMax2 = 0;
    lenses.forEach(function(l) { totalScore2 += l.score; totalMax2 += l.maxScore; });
    confidence = Math.round((totalScore2 / totalMax2) * 100);
  } else {
    var totalScore3 = 0, totalMax3 = 0;
    lenses.forEach(function(l) { totalScore3 += l.score; totalMax3 += l.maxScore; });
    confidence = Math.round((totalScore3 / totalMax3) * 100);
  }

  return { lenses: lenses, direction: direction, confidence: confidence, bullCount: bullCount, bearCount: bearCount, neutCount: neutCount };
}

function calcIchimoku(highs, lows, closes, n) {
  function periodHL(h, l, start, period) {
    var hSlice = h.slice(start, start + period);
    var lSlice = l.slice(start, start + period);
    return (Math.max.apply(null, hSlice) + Math.min.apply(null, lSlice)) / 2;
  }

  var tenkan = []; 
  var kijun = [];  
  for (var i = 0; i < n; i++) {
    tenkan.push(i >= 8 ? periodHL(highs, lows, i - 8, 9) : null);
    kijun.push(i >= 25 ? periodHL(highs, lows, i - 25, 26) : null);
  }

  var currentTenkan = tenkan[n - 1];
  var currentKijun = kijun[n - 1];
  
  var senkouA = (tenkan[n - 26] !== null && kijun[n - 26] !== null) ? (tenkan[n - 26] + kijun[n - 26]) / 2 : null;
  var senkouB = n >= 52 ? periodHL(highs, lows, n - 52, 52) : null;
  
  if (senkouA === null) senkouA = currentTenkan && currentKijun ? (currentTenkan + currentKijun) / 2 : null;
  if (senkouB === null && n >= 52) senkouB = periodHL(highs, lows, n - 52, 52);

  var cloudTop = senkouA !== null && senkouB !== null ? Math.max(senkouA, senkouB) : null;
  var cloudBottom = senkouA !== null && senkouB !== null ? Math.min(senkouA, senkouB) : null;

  var futureSenkouA = currentTenkan && currentKijun ? (currentTenkan + currentKijun) / 2 : null;
  var futureSenkouB = n >= 52 ? periodHL(highs, lows, n - 52, 52) : null;
  var futureCloudBullish = futureSenkouA !== null && futureSenkouB !== null ? futureSenkouA > futureSenkouB : null;

  var chikouAbove = n > 26 ? closes[n - 1] > closes[n - 27] : null;
  var currentClose = closes[n - 1];

  var details = [];
  var score = 0;

  if (cloudTop !== null) {
    if (currentClose > cloudTop) { details.push({ label: 'السعر vs السحابة', value: 'فوق السحابة', signal: 'bullish' }); score++; }
    else if (currentClose < cloudBottom) { details.push({ label: 'السعر vs السحابة', value: 'تحت السحابة', signal: 'bearish' }); }
    else { details.push({ label: 'السعر vs السحابة', value: 'داخل السحابة', signal: 'neutral' }); score += 0.5; }
  } else { details.push({ label: 'السعر vs السحابة', value: 'بيانات غير كافية', signal: 'neutral' }); }

  if (currentTenkan && currentKijun) {
    if (currentTenkan > currentKijun) { details.push({ label: 'Tenkan vs Kijun', value: 'Tenkan فوق Kijun', signal: 'bullish' }); score++; }
    else if (currentTenkan < currentKijun) { details.push({ label: 'Tenkan vs Kijun', value: 'Tenkan تحت Kijun', signal: 'bearish' }); }
    else { details.push({ label: 'Tenkan vs Kijun', value: 'متساويان', signal: 'neutral' }); score += 0.5; }
  } else { details.push({ label: 'Tenkan vs Kijun', value: '--', signal: 'neutral' }); }

  if (chikouAbove !== null) {
    if (chikouAbove) { details.push({ label: 'Chikou Span', value: 'فوق السعر', signal: 'bullish' }); score++; }
    else { details.push({ label: 'Chikou Span', value: 'تحت السعر', signal: 'bearish' }); }
  } else { details.push({ label: 'Chikou Span', value: '--', signal: 'neutral' }); }

  if (futureCloudBullish !== null) {
    if (futureCloudBullish) { details.push({ label: 'السحابة المستقبلية', value: 'صاعدة', signal: 'bullish' }); score++; }
    else { details.push({ label: 'السحابة المستقبلية', value: 'هابطة', signal: 'bearish' }); }
  } else { details.push({ label: 'السحابة المستقبلية', value: '--', signal: 'neutral' }); }

  if (cloudTop !== null && cloudBottom !== null) {
    var midCloud = (cloudTop + cloudBottom) / 2;
    var distPct = ((currentClose - midCloud) / midCloud * 100).toFixed(1);
    var distSignal = 'neutral';
    if (parseFloat(distPct) > 3) { distSignal = 'bullish'; score++; }
    else if (parseFloat(distPct) < -3) distSignal = 'bearish';
    else score += 0.5;
    details.push({ label: 'المسافة عن السحابة', value: (parseFloat(distPct) > 0 ? '+' : '') + distPct + '%', signal: distSignal });
  } else { details.push({ label: 'المسافة عن السحابة', value: '--', signal: 'neutral' }); }

  var maxScore = 5;
  var signal = score >= 3.5 ? 'bullish' : score <= 1.5 ? 'bearish' : 'neutral';

  var conclusion = '';
  if (signal === 'bullish') conclusion = 'إيشيموكو يؤكد الصعود: السعر فوق السحابة مع تأكيدات صريحة من الخطوط الديناميكية.';
  else if (signal === 'bearish') conclusion = 'إيشيموكو يشير للهبوط: السعر تحت السحابة والخطوط تظهر ضعفاً فنياً واضحاً.';
  else conclusion = 'إيشيموكو محايد — إشارات متضاربة داخل أو حول السحابة.';

  return { name: 'Ichimoku Cloud', nameAr: 'سحابة إيشيموكو', signal: signal, score: Math.round(score), maxScore: maxScore, details: details, conclusion: conclusion };
}

function calcBollingerLens(closes, n, currentPrice) {
  var period = 20;
  var mult = 2;

  var sum = 0;
  for (var i = n - period; i < n; i++) sum += closes[i];
  var sma = sum / period;

  var sqDiffSum = 0;
  for (var j = n - period; j < n; j++) sqDiffSum += Math.pow(closes[j] - sma, 2);
  var stdDev = Math.sqrt(sqDiffSum / period);

  var upperBand = sma + (mult * stdDev);
  var lowerBand = sma - (mult * stdDev);
  var bandwidth = ((upperBand - lowerBand) / sma * 100);
  var percentB = (currentPrice - lowerBand) / (upperBand - lowerBand);

  var bbwHistory = [];
  for (var k = Math.max(period, n - 50); k <= n; k++) {
    var s2 = 0;
    for (var m = k - period; m < k; m++) s2 += closes[m];
    var sm = s2 / period;
    var sq2 = 0;
    for (var p = k - period; p < k; p++) sq2 += Math.pow(closes[p] - sm, 2);
    var sd2 = Math.sqrt(sq2 / period);
    bbwHistory.push(((sm + mult * sd2) - (sm - mult * sd2)) / sm * 100);
  }
  var avgBBW = bbwHistory.reduce(function(a, b) { return a + b; }, 0) / bbwHistory.length;
  var isSqueeze = bandwidth < avgBBW * 0.7;

  var details = [];
  var score = 0;

  var pbLabel = '', pbSignal = 'neutral';
  if (percentB > 0.8) { pbLabel = percentB.toFixed(2) + ' (قرب الحد العلوي)'; pbSignal = 'bearish'; }
  else if (percentB < 0.2) { pbLabel = percentB.toFixed(2) + ' (قرب الحد السفلي)'; pbSignal = 'bullish'; score++; }
  else if (percentB > 0.5) { pbLabel = percentB.toFixed(2) + ' (الربع العلوي)'; pbSignal = 'neutral'; score += 0.5; }
  else { pbLabel = percentB.toFixed(2) + ' (الربع السفلي)'; pbSignal = 'neutral'; score += 0.5; }
  details.push({ label: 'موقع السعر (%B)', value: pbLabel, signal: pbSignal });

  var bwLabel = bandwidth.toFixed(1) + '%';
  var bwSignal = 'neutral';
  if (bandwidth > 10) { bwLabel += ' (واسع)'; bwSignal = 'neutral'; score += 0.5; }
  else if (bandwidth < 4) { bwLabel += ' (ضيق جداً)'; bwSignal = 'neutral'; score += 0.5; }
  else { bwLabel += ' (معتدل)'; score += 0.5; }
  details.push({ label: 'عرض النطاق (BBW)', value: bwLabel, signal: bwSignal });

  if (currentPrice > sma) { details.push({ label: 'السعر vs SMA20', value: 'فوق المتوسط', signal: 'bullish' }); score++; }
  else { details.push({ label: 'السعر vs SMA20', value: 'تحت المتوسط', signal: 'bearish' }); }

  if (isSqueeze) { details.push({ label: 'حالة الضغط', value: 'ضغط نشط — انفجار وشيك', signal: 'bullish' }); score++; }
  else { details.push({ label: 'حالة الضغط', value: 'لا ضغط حالياً', signal: 'neutral' }); score += 0.5; }

  var maxScore = 4;
  var signal = score >= 3 ? 'bullish' : score <= 1 ? 'bearish' : 'neutral';

  var conclusion = '';
  if (signal === 'bullish') conclusion = 'بولنجر يدعم الزخم: السعر يحافظ على مستوياته الإيجابية' + (isSqueeze ? ' مع تشكل ضغط ينذر بانفجار سعري وشيك.' : '.');
  else if (signal === 'bearish') conclusion = 'بولنجر يشير لضعف: ضغط بيعي ودفع نحو الحد السفلي للنطاق.';
  else conclusion = 'بولنجر محايد — السعر يتداول ضمن النطاق الطبيعي بلا اختراقات.';

  return { name: 'Bollinger Bands', nameAr: 'نطاقات بولنجر', signal: signal, score: Math.round(score), maxScore: maxScore, details: details, conclusion: conclusion };
}

function calcVolumeProfile(candles, currentPrice) {
  var recent = candles; 
  var allHighs = recent.map(function(c) { return c.high; });
  var allLows = recent.map(function(c) { return c.low; });
  var rangeHigh = Math.max.apply(null, allHighs);
  var rangeLow = Math.min.apply(null, allLows);
  var binSize = (rangeHigh - rangeLow) / 50;

  if (binSize <= 0) {
    return { name: 'Volume Profile', nameAr: 'خريطة الحجم', signal: 'neutral', score: 0, maxScore: 4, details: [{ label: 'الحالة', value: 'نطاق غير كافٍ', signal: 'neutral' }], conclusion: 'بيانات غير كافية.' };
  }

  var bins = [];
  for (var b = 0; b < 50; b++) {
    bins.push({ low: rangeLow + b * binSize, high: rangeLow + (b + 1) * binSize, volume: 0, mid: rangeLow + (b + 0.5) * binSize });
  }

  recent.forEach(function(c) {
    var typicalPrice = (c.high + c.low + c.close) / 3;
    var binIndex = Math.floor((typicalPrice - rangeLow) / binSize);
    if (binIndex >= 0 && binIndex < 50) bins[binIndex].volume += c.volume;
  });

  var pocBin = bins[0];
  bins.forEach(function(b) { if (b.volume > pocBin.volume) pocBin = b; });
  var poc = pocBin.mid;

  var totalVolume = bins.reduce(function(a, b) { return a + b.volume; }, 0);
  var targetVol = totalVolume * 0.70;

  var pocIndex = bins.indexOf(pocBin);
  var vaVolume = pocBin.volume;
  var vaLow = pocIndex, vaHigh = pocIndex;

  while (vaVolume < targetVol && (vaLow > 0 || vaHigh < 49)) {
    var nextLow = vaLow > 0 ? bins[vaLow - 1].volume : 0;
    var nextHigh = vaHigh < 49 ? bins[vaHigh + 1].volume : 0;
    if (nextHigh >= nextLow && vaHigh < 49) { vaHigh++; vaVolume += bins[vaHigh].volume; }
    else if (vaLow > 0) { vaLow--; vaVolume += bins[vaLow].volume; }
    else break;
  }

  var vaLowPrice = bins[vaLow].low;
  var vaHighPrice = bins[vaHigh].high;

  var avgBinVol = totalVolume / 50;
  var lvnAbove = null, lvnBelow = null;
  for (var g = pocIndex + 1; g < 50; g++) {
    if (bins[g].volume < avgBinVol * 0.3 && bins[g].mid > currentPrice) { lvnAbove = bins[g].mid; break; }
  }
  for (var h = pocIndex - 1; h >= 0; h--) {
    if (bins[h].volume < avgBinVol * 0.3 && bins[h].mid < currentPrice) { lvnBelow = bins[h].mid; break; }
  }

  var details = [];
  var score = 0;

  details.push({ label: 'نقطة التحكم (POC)', value: '$' + poc.toLocaleString('en-US', { maximumFractionDigits: 0 }), signal: currentPrice > poc ? 'bullish' : 'bearish' });
  if (currentPrice > poc) score++;

  var pocDiff = ((currentPrice - poc) / poc * 100).toFixed(1);
  var pocSignal = currentPrice > poc ? 'bullish' : 'bearish';
  details.push({ label: 'السعر vs POC', value: (parseFloat(pocDiff) > 0 ? '+' : '') + pocDiff + '%', signal: pocSignal });
  if (currentPrice > poc) score++;

  var vaSignal = 'neutral';
  if (currentPrice > vaHighPrice) { vaSignal = 'bullish'; score++; }
  else if (currentPrice < vaLowPrice) { vaSignal = 'bearish'; }
  else { vaSignal = 'neutral'; score += 0.5; }
  details.push({ label: 'منطقة القيمة (VA)', value: '$' + vaLowPrice.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' — $' + vaHighPrice.toLocaleString('en-US', { maximumFractionDigits: 0 }), signal: vaSignal });

  var lvnText = '';
  var lvnSignal = 'neutral';
  if (lvnAbove) { lvnText = 'فجوة فوق $' + lvnAbove.toLocaleString('en-US', { maximumFractionDigits: 0 }); lvnSignal = 'neutral'; score += 0.5; } 
  else if (lvnBelow) { lvnText = 'فجوة تحت $' + lvnBelow.toLocaleString('en-US', { maximumFractionDigits: 0 }); lvnSignal = 'neutral'; score += 0.5; } 
  else { lvnText = 'لا فجوات قريبة'; score += 0.5; }
  details.push({ label: 'فجوات حجمية', value: lvnText, signal: lvnSignal });

  var maxScore = 4;
  var signal = score >= 3 ? 'bullish' : score <= 1 ? 'bearish' : 'neutral';

  var conclusion = '';
  if (signal === 'bullish') conclusion = 'تمركزات الحجم تدعم الصعود: السعر يتحرر من نقطة التحكم ومنطقة القيمة.';
  else if (signal === 'bearish') conclusion = 'تمركزات الحجم تضغط للسفل: السعر يفشل في اختراق نقطة التحكم ويتداول دونها.';
  else conclusion = 'السعر يتقاطع مع نقطة التحكم القوية — منطقة توازن سيولة.';

  return { name: 'Volume Profile', nameAr: 'خريطة الحجم', signal: signal, score: Math.round(score), maxScore: maxScore, details: details, conclusion: conclusion };
}

function renderTripleLensDashboard(symbol, price, tf, r) {
  // تم إزالة سطري getElementById('tl-pair') و ('tl-price') المسببة للخطأ
  
  var dirColor = r.direction === 'bullish' ? '#ffffff' : r.direction === 'bearish' ? '#ff6a00' : '#555';
  var dirEn = r.direction === 'bullish' ? 'BULLISH' : r.direction === 'bearish' ? 'BEARISH' : 'NEUTRAL';
  var powerPos = r.direction === 'bullish' ? 50 + (r.confidence / 2) : r.direction === 'bearish' ? 50 - (r.confidence / 2) : 50;

  var sigColor = function(s) { return s === 'bullish' ? '#ffffff' : s === 'bearish' ? '#ff6a00' : '#555'; };

  var termHtml = '';
  termHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#0a0a0a; border-bottom:1px solid #111;">';
  termHtml += '<div style="display:flex; align-items:center; gap:10px;">';
  termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:var(--o); font-weight:bold;">' + symbol + '</div>';
  termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff;">$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</div></div>';
  termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#333;">' + tf + ' | LIVE</div></div>';

  termHtml += '<div style="padding:20px 14px 16px; border-bottom:1px solid #111;">';
  termHtml += '<div style="display:flex; align-items:baseline; gap:12px; margin-bottom:4px;">';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:2.4rem; font-weight:bold; color:' + dirColor + '; line-height:1; letter-spacing:1px;">' + dirEn + '</span>';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:1.4rem; color:' + dirColor + '; opacity:0.6;">' + r.confidence + '%</span></div>';
  termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#333; letter-spacing:1px;">CONSENSUS: ' + r.bullCount + ' BULL / ' + r.neutCount + ' WAIT / ' + r.bearCount + ' BEAR</div></div>';

  r.lenses.forEach(function(lens, i) {
    var lc = sigColor(lens.signal);
    var pct = (lens.score / lens.maxScore) * 100;
    var tag = lens.signal === 'bullish' ? 'BULL' : lens.signal === 'bearish' ? 'BEAR' : '---';

    termHtml += '<div style="display:grid; grid-template-columns:110px 1fr 50px 44px; align-items:center; gap:10px; padding:10px 14px; border-bottom:' + (i < 2 ? '1px solid #0d0d0d' : 'none') + ';">';
    termHtml += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#ccc; font-weight:bold; line-height:1.2;">' + lens.name.split(' ')[0] + '</div>';
    termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#333;">' + lens.name.split(' ').slice(1).join(' ') + '</div></div>';
    termHtml += '<div style="position:relative; height:6px; background:#111; border-radius:3px;"><div style="height:100%; border-radius:3px; background:' + lc + '; width:' + pct + '%; opacity:' + (lens.signal === 'neutral' ? '0.4' : '0.8') + '; transition:width 1.2s ease ' + (0.3 + i * 0.15) + 's;"></div></div>';
    termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:' + lc + '; font-weight:bold; text-align:center;">' + lens.score + '/' + lens.maxScore + '</div>';
    termHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; font-weight:700; padding:3px 0; border-radius:4px; text-align:center; letter-spacing:0.5px; color:' + (lens.signal === 'neutral' ? '#444' : '#000') + '; background:' + lc + '; opacity:' + (lens.signal === 'neutral' ? '0.5' : '1') + ';">' + tag + '</div></div>';
  });

  termHtml += '<div style="padding:14px 14px 16px; border-top:1px solid #111;">';
  termHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ff6a00; font-weight:bold;">BEARISH</span>';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#222; letter-spacing:1px;">POWER METER</span>';
  termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold;">BULLISH</span></div>';
  termHtml += '<div style="position:relative; height:10px; background:#0d0d0d; border-radius:5px; border:1px solid #1a1a1a;">';
  termHtml += '<div style="position:absolute; left:0; top:0; width:50%; height:100%; border-radius:5px 0 0 5px; background:linear-gradient(to right, rgba(255,106,0,0.15), transparent);"></div>';
  termHtml += '<div style="position:absolute; right:0; top:0; width:50%; height:100%; border-radius:0 5px 5px 0; background:linear-gradient(to left, rgba(255,255,255,0.1), transparent);"></div>';
  termHtml += '<div style="position:absolute; left:50%; top:-2px; width:1px; height:calc(100% + 4px); background:#333;"></div>';
  termHtml += '<div style="position:absolute; top:50%; transform:translate(-50%,-50%); left:' + powerPos + '%; width:14px; height:14px; border-radius:50%; background:' + dirColor + '; box-shadow:0 0 10px ' + dirColor + '44, 0 0 3px ' + dirColor + '88; border:2px solid #000; transition:left 2s cubic-bezier(0.25,0.46,0.45,0.94);"></div></div>';
  termHtml += '<div style="display:flex; justify-content:space-between; margin-top:5px; padding:0 2px;">';
  [100,75,50,25,0,25,50,75,100].forEach(function(num, i) {
    termHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.4rem; color:' + (i === 4 ? '#444' : '#1a1a1a') + ';">' + num + '</span>';
  });
  termHtml += '</div></div>';

  document.getElementById('tl-terminal').innerHTML = termHtml;

  var cardsHtml = '';
  r.lenses.forEach(function(lens, li) {
    var lc = sigColor(lens.signal);
    cardsHtml += '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; border-right:3px solid ' + lc + '; overflow:hidden; animation:fadeUp 0.4s ease ' + (0.6 + li * 0.12) + 's both;">';
    cardsHtml += '<div style="padding:12px 14px 10px; display:flex; justify-content:space-between; align-items:center;">';
    cardsHtml += '<div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#fff; font-weight:bold;">' + lens.name + '</div>';
    cardsHtml += '<div style="font-size:0.6rem; color:#555; margin-top:1px;">' + lens.nameAr + '</div></div>';
    cardsHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + lc + '; font-weight:bold;">' + lens.score + '/' + lens.maxScore + '</span></div>';
    cardsHtml += '<div style="padding:0 14px 10px;">';
    lens.details.forEach(function(det, di) {
      cardsHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:' + (di < lens.details.length - 1 ? '1px solid #0d0d0d' : 'none') + ';">';
      cardsHtml += '<span style="font-size:0.62rem; color:#666;">' + det.label + '</span>';
      cardsHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.62rem; color:' + sigColor(det.signal) + '; font-weight:bold;">' + det.value + '</span></div>';
    });
    cardsHtml += '</div><div style="padding:8px 14px; background:#050505; border-top:1px solid #0d0d0d;">';
    cardsHtml += '<div style="font-size:0.62rem; color:#777; line-height:1.5;">' + lens.conclusion + '</div></div></div>';
  });
  document.getElementById('tl-detail-cards').innerHTML = cardsHtml;

  var conclusion = 'العدسة الثلاثية تشير نحو الاتجاه ' + (r.direction === 'bullish' ? 'الصاعد' : r.direction === 'bearish' ? 'الهابط' : 'العرضي') + ' بثقة ' + r.confidence + '%. ';
  r.lenses.forEach(function(l) {
    var lDir = l.signal === 'bullish' ? 'يدعم الاتجاه' : l.signal === 'bearish' ? 'يقاوم الاتجاه' : 'إشارته محايدة';
    conclusion += l.name.split(' ')[0] + ' ' + lDir + ' (' + l.score + '/' + l.maxScore + '). ';
  });
  
  if (r.direction !== 'neutral') {
    conclusion += 'تتلاقى السيولة المؤسسية مع الزخم التقني لترجيح هذا المسار.';
  } else {
    conclusion += 'هناك تضارب بين معطيات السيولة والزخم، يُنصح بانتظار استقرار الأبعاد الثلاثة.';
  }

  document.getElementById('tl-conclusion').textContent = conclusion;
}

// ==========================================
// أداة Candles — 4 طبقات تحليلية
// التحسين: رفع limit إلى 500 لضمان دقة التطابق النمطي
// ==========================================

async function runCandles() {
  var coinInput = document.getElementById('cd-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('cd-tf').value.toLowerCase();
  var btn = document.getElementById('cd-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING PATTERNS...';
  btn.disabled = true;

  try {
    // رفع الـ limit إلى 1000 لمنح خوارزمية التطابق مساحة كافية للعثور على البصمة
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    var raw = await res.json();

    if (raw.length < 50) throw new Error('بيانات غير كافية للتحليل (يتطلب 50 شمعة على الأقل).');

    var candles = raw.map(function(k) {
      return { o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) };
    });

    var currentPrice = candles[candles.length - 1].c;
    var result = analyzeCandles(candles);

    renderCandlesDashboard(symbol, currentPrice, tfInput.toUpperCase(), candles, result);
    document.getElementById('cd-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function analyzeCandles(candles) {
  var phantom = calcPhantomCandle(candles);
  var patterns = scanCandlePatterns(candles);
  var dna = calcCandleDNA(candles);
  var flow = calcOrderFlow(candles);

  var bullVotes = 0, bearVotes = 0;
  if (phantom.type === 'bullish') bullVotes++; else if (phantom.type === 'bearish') bearVotes++;
  if (patterns.bias === 'bullish') bullVotes++; else if (patterns.bias === 'bearish') bearVotes++;
  if (dna.bias === 'bullish') bullVotes++; else if (dna.bias === 'bearish') bearVotes++;
  if (flow.bias === 'bullish') bullVotes++; else if (flow.bias === 'bearish') bearVotes++;

  var direction = bullVotes > bearVotes ? 'bullish' : bearVotes > bullVotes ? 'bearish' : 'neutral';
  var confidence = Math.round((Math.max(bullVotes, bearVotes) / 4) * 100);

  return { phantom: phantom, patterns: patterns, dna: dna, flow: flow, direction: direction, confidence: confidence, bullVotes: bullVotes, bearVotes: bearVotes };
}

function calcPhantomCandle(candles) {
  var n = candles.length;

  function fingerprint(c) {
    var body = Math.abs(c.c - c.o);
    var fullRange = c.h - c.l;
    if (fullRange === 0) fullRange = 0.001;
    var bodyRatio = body / fullRange;
    var upperWick = c.h - Math.max(c.o, c.c);
    var lowerWick = Math.min(c.o, c.c) - c.l;
    var upperRatio = upperWick / fullRange;
    var lowerRatio = lowerWick / fullRange;
    return { dir: c.c >= c.o ? 1 : 0, bigBody: bodyRatio > 0.5 ? 1 : 0, longUpper: upperRatio > 0.3 ? 1 : 0, longLower: lowerRatio > 0.3 ? 1 : 0 };
  }

  var patternLen = 5;
  var currentPattern = [];
  for (var i = n - patternLen; i < n; i++) {
    currentPattern.push(fingerprint(candles[i]));
  }

  var matches = [];
  for (var j = patternLen; j < n - patternLen - 1; j++) {
    var histPattern = [];
    for (var k = 0; k < patternLen; k++) { histPattern.push(fingerprint(candles[j + k])); }
    
    var matchScore = 0;
    for (var m = 0; m < patternLen; m++) {
      if (currentPattern[m].dir === histPattern[m].dir) matchScore++;
      if (currentPattern[m].bigBody === histPattern[m].bigBody) matchScore++;
      if (currentPattern[m].longUpper === histPattern[m].longUpper) matchScore++;
      if (currentPattern[m].longLower === histPattern[m].longLower) matchScore++;
    }

    if (matchScore >= 14) {
      matches.push({ score: matchScore, next: candles[j + patternLen] });
    }
  }

  if (matches.length === 0) {
    var recent = candles.slice(-20);
    var avgBody = 0, bullCount = 0;
    recent.forEach(function(c) { avgBody += Math.abs(c.c - c.o); if (c.c > c.o) bullCount++; });
    avgBody /= recent.length;
    var isBull = bullCount > recent.length / 2;
    var lastClose = candles[n - 1].c;
    return { open: lastClose, close: isBull ? lastClose + avgBody : lastClose - avgBody, high: isBull ? lastClose + avgBody * 1.3 : lastClose + avgBody * 0.3, low: isBull ? lastClose - avgBody * 0.3 : lastClose - avgBody * 1.3, type: isBull ? 'bullish' : 'bearish', probability: 45, matchCount: 0 };
  }

  var sumO = 0, sumC = 0, sumH = 0, sumL = 0, bullMatches = 0;
  var lastClose = candles[n - 1].c;

  matches.forEach(function(m) {
    var nc = m.next;
    sumC += (nc.c - nc.o) / nc.o;
    sumH += (nc.h - nc.o) / nc.o;
    sumL += (nc.l - nc.o) / nc.o;
    if (nc.c > nc.o) bullMatches++;
  });

  var count = matches.length;
  var phantomOpen = lastClose;
  var phantomClose = lastClose * (1 + (sumC / count));
  var phantomHigh = lastClose * (1 + (sumH / count));
  var phantomLow = lastClose * (1 + (sumL / count));

  phantomHigh = Math.max(phantomHigh, phantomOpen, phantomClose);
  phantomLow = Math.min(phantomLow, phantomOpen, phantomClose);

  var probability = Math.min(90, Math.round(40 + (count * 5) + (bullMatches > count / 2 ? 10 : 0)));

  return { open: Math.round(phantomOpen * 100) / 100, close: Math.round(phantomClose * 100) / 100, high: Math.round(phantomHigh * 100) / 100, low: Math.round(phantomLow * 100) / 100, type: phantomClose > phantomOpen ? 'bullish' : 'bearish', probability: probability, matchCount: count };
}

function scanCandlePatterns(candles) {
  var n = candles.length;
  var detected = [];
  var c0 = candles[n - 1], c1 = candles[n - 2], c2 = candles[n - 3];
  var body0 = Math.abs(c0.c - c0.o), body1 = Math.abs(c1.c - c1.o);
  var range0 = c0.h - c0.l, range1 = c1.h - c1.l;

  if (c1.c < c1.o && c0.c > c0.o && c0.o <= c1.c && c0.c >= c1.o) detected.push({ name: 'Bullish Engulfing', nameAr: 'ابتلاع صاعد', type: 'انعكاسي صعودي', bias: 'bullish', strength: 80 });
  if (c1.c > c1.o && c0.c < c0.o && c0.o >= c1.c && c0.c <= c1.o) detected.push({ name: 'Bearish Engulfing', nameAr: 'ابتلاع هبوطي', type: 'انعكاسي هبوطي', bias: 'bearish', strength: 80 });

  if (range0 > 0) {
    if ((Math.min(c0.o, c0.c) - c0.l) > body0 * 2 && (c0.h - Math.max(c0.o, c0.c)) < body0 * 0.5 && body0 < range0 * 0.4) detected.push({ name: 'Hammer', nameAr: 'مطرقة', type: 'انعكاسي صعودي', bias: 'bullish', strength: 70 });
    if ((c0.h - Math.max(c0.o, c0.c)) > body0 * 2 && (Math.min(c0.o, c0.c) - c0.l) < body0 * 0.5 && body0 < range0 * 0.4) detected.push({ name: 'Shooting Star', nameAr: 'نجمة ساقطة', type: 'انعكاسي هبوطي', bias: 'bearish', strength: 70 });
    if (body0 / range0 < 0.1) detected.push({ name: 'Doji', nameAr: 'دوجي (تردد)', type: 'محايد — ترقب', bias: 'neutral', strength: 55 });
  }

  if (c2.c > c2.o && c1.c > c1.o && c0.c > c0.o && c1.o > c2.o && c0.o > c1.o && c1.c > c2.c && c0.c > c1.c) detected.push({ name: 'Three White Soldiers', nameAr: 'ثلاثة جنود بيض', type: 'استمراري صعودي', bias: 'bullish', strength: 85 });
  if (c2.c < c2.o && c1.c < c1.o && c0.c < c0.o && c1.o < c2.o && c0.o < c1.o && c1.c < c2.c && c0.c < c1.c) detected.push({ name: 'Three Black Crows', nameAr: 'ثلاثة غربان سود', type: 'استمراري هبوطي', bias: 'bearish', strength: 85 });
  if (c2.c < c2.o && body1 / (range1 || 1) < 0.3 && c0.c > c0.o && c0.c > (c2.o + c2.c) / 2) detected.push({ name: 'Morning Star', nameAr: 'نجمة الصباح', type: 'انعكاسي صعودي', bias: 'bullish', strength: 75 });
  if (c2.c > c2.o && body1 / (range1 || 1) < 0.3 && c0.c < c0.o && c0.c < (c2.o + c2.c) / 2) detected.push({ name: 'Evening Star', nameAr: 'نجمة المساء', type: 'انعكاسي هبوطي', bias: 'bearish', strength: 75 });

  var bullP = detected.filter(function(p) { return p.bias === 'bullish'; }).length;
  var bearP = detected.filter(function(p) { return p.bias === 'bearish'; }).length;
  return { detected: detected, bias: bullP > bearP ? 'bullish' : bearP > bullP ? 'bearish' : 'neutral' };
}

function calcCandleDNA(candles) {
  var recent = candles.slice(-100);
  var bullCount = 0, totalBody = 0, totalUpperWick = 0, totalLowerWick = 0;
  var streak = 0, maxBullStreak = 0, maxBearStreak = 0, currentStreakDir = 0;

  recent.forEach(function(c) {
    var isBull = c.c >= c.o;
    if (isBull) bullCount++;
    var range = c.h - c.l;
    if (range > 0) {
      totalBody += (Math.abs(c.c - c.o) / range);
      totalUpperWick += ((c.h - Math.max(c.o, c.c)) / range);
      totalLowerWick += ((Math.min(c.o, c.c) - c.l) / range);
    }
    if (isBull) {
      if (currentStreakDir === 1) streak++; else { streak = 1; currentStreakDir = 1; }
      if (streak > maxBullStreak) maxBullStreak = streak;
    } else {
      if (currentStreakDir === -1) streak++; else { streak = 1; currentStreakDir = -1; }
      if (streak > maxBearStreak) maxBearStreak = streak;
    }
  });

  var bullPct = Math.round((bullCount / recent.length) * 100);
  var bias = bullPct >= 55 ? 'bullish' : bullPct <= 45 ? 'bearish' : 'neutral';
  var pers = bias === 'bullish' ? 'زخم صعودي — سيطرة للشموع الشرائية.' : bias === 'bearish' ? 'ضغط بيعي — الشموع الهابطة تسيطر.' : 'توازن نسبي في هيكل الشموع — تذبذب.';

  return { bullPct: bullPct, bearPct: 100 - bullPct, avgBody: ((totalBody / recent.length) * 100).toFixed(1) + '%', avgUpperWick: ((totalUpperWick / recent.length) * 100).toFixed(1) + '%', avgLowerWick: ((totalLowerWick / recent.length) * 100).toFixed(1) + '%', longestStreak: maxBullStreak >= maxBearStreak ? maxBullStreak + ' صاعدة' : maxBearStreak + ' هابطة', bias: bias, personality: pers };
}

function calcOrderFlow(candles) {
  var recent = candles.slice(-20);
  var buyAggressive = 0, sellAggressive = 0;

  recent.forEach(function(c) {
    var range = c.h - c.l;
    if (range === 0) return;
    var closePosition = (c.c - c.l) / range;
    if (closePosition > 0.6) buyAggressive++;
    else if (closePosition < 0.4) sellAggressive++;
  });

  var buyPct = Math.round((buyAggressive / recent.length) * 100);
  var sellPct = Math.round((sellAggressive / recent.length) * 100);
  var bias = buyPct > sellPct + 10 ? 'bullish' : sellPct > buyPct + 10 ? 'bearish' : 'neutral';
  var verdict = bias === 'bullish' ? 'ضغط شرائي — ' + buyPct + '% أغلقت قرب القمة.' : bias === 'bearish' ? 'ضغط بيعي — ' + sellPct + '% أغلقت قرب القاع.' : 'توازن بين ضغط الشراء والبيع.';

  return { buyPct: buyPct, sellPct: sellPct, ratio: sellAggressive > 0 ? (buyAggressive / sellAggressive).toFixed(2) + 'x' : '1.00x', bias: bias, verdict: verdict };
}

function renderCandlesDashboard(symbol, price, tf, candles, r) {
  var dirColor = r.direction === 'bullish' ? '#ffffff' : r.direction === 'bearish' ? '#ff6a00' : '#555';
  var powerPos = r.direction === 'bullish' ? 50 + (r.confidence / 2) : r.direction === 'bearish' ? 50 - (r.confidence / 2) : 50;
  var sigColor = function(s) { return s === 'bullish' ? '#ffffff' : s === 'bearish' ? '#ff6a00' : '#555'; };

  var last5 = candles.slice(-5);
  var allC = last5.map(function(c) { return { o: c.o, h: c.h, l: c.l, c: c.c }; });
  allC.push({ o: r.phantom.open, h: r.phantom.high, l: r.phantom.low, c: r.phantom.close });

  var allPrices = [];
  allC.forEach(function(c) { allPrices.push(c.o, c.h, c.l, c.c); });
  var minP = Math.min.apply(null, allPrices);
  var maxP = Math.max.apply(null, allPrices);
  var range = maxP - minP || 1;
  var toY = function(p) { return 140 - ((p - minP) / range) * 120 + 10; };
  var candleW = 28, gap = 12, startX = 20;
  var svgW = startX + 6 * (candleW + gap);

  var chartHtml = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden; margin-bottom:16px;">';
  chartHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#0a0a0a; border-bottom:1px solid #111;">';
  chartHtml += '<div style="display:flex; align-items:center; gap:10px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:var(--o); font-weight:bold;">' + symbol + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff;">$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</span></div>';
  chartHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#333;">' + tf + ' | PHANTOM</span></div>';
  chartHtml += '<div style="padding:10px 6px;"><svg width="100%" height="160" viewBox="0 0 ' + svgW + ' 160" style="direction:ltr;">';

  [0.25, 0.5, 0.75].forEach(function(pct) {
    var y = 10 + pct * 120;
    var pLine = maxP - pct * range;
    chartHtml += '<line x1="0" y1="' + y + '" x2="100%" y2="' + y + '" stroke="#0d0d0d" stroke-width="1"/><text x="2" y="' + (y - 3) + '" fill="#222" font-size="7" font-family="Share Tech Mono">$' + Math.round(pLine).toLocaleString() + '</text>';
  });

  last5.forEach(function(c, i) {
    var x = startX + i * (candleW + gap);
    var isBull = c.c >= c.o;
    var bTop = toY(Math.max(c.o, c.c)), bBot = toY(Math.min(c.o, c.c));
    var bH = Math.max(bBot - bTop, 2);
    var color = isBull ? '#ffffff' : '#ff6a00';
    chartHtml += '<line x1="' + (x + candleW / 2) + '" y1="' + toY(c.h) + '" x2="' + (x + candleW / 2) + '" y2="' + toY(c.l) + '" stroke="' + color + '" stroke-width="1.5" opacity="0.6"/>';
    chartHtml += '<rect x="' + x + '" y="' + bTop + '" width="' + candleW + '" height="' + bH + '" fill="' + color + '" fill-opacity="' + (isBull ? '0.15' : '0.25') + '" stroke="' + color + '" stroke-width="1.5" rx="2"/>';
  });

  var px = startX + 5 * (candleW + gap);
  var pc = r.phantom;
  var pColor = pc.close >= pc.open ? '#ffffff' : '#ff6a00';
  var pTop = toY(Math.max(pc.open, pc.close)), pBot = toY(Math.min(pc.open, pc.close));
  var pH = Math.max(pBot - pTop, 2);

  chartHtml += '<g style="animation:phantomGlow 3s ease infinite;">';
  chartHtml += '<rect x="' + (px - 4) + '" y="' + (toY(pc.high) - 4) + '" width="' + (candleW + 8) + '" height="' + (toY(pc.low) - toY(pc.high) + 8) + '" fill="' + pColor + '" fill-opacity="0.03" rx="4"/>';
  chartHtml += '<line x1="' + (px + candleW / 2) + '" y1="' + toY(pc.high) + '" x2="' + (px + candleW / 2) + '" y2="' + toY(pc.low) + '" stroke="' + pColor + '" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.5" style="animation:phantomDash 2s linear infinite;"/>';
  chartHtml += '<rect x="' + px + '" y="' + pTop + '" width="' + candleW + '" height="' + pH + '" fill="' + pColor + '" fill-opacity="0.08" stroke="' + pColor + '" stroke-width="2" stroke-dasharray="6 4" rx="2" style="animation:phantomDash 3s linear infinite;"/>';
  chartHtml += '<text x="' + (px + candleW / 2) + '" y="' + (pTop + pH / 2 + 4) + '" text-anchor="middle" fill="' + pColor + '" font-size="11" font-family="Share Tech Mono" font-weight="bold" opacity="0.7">?</text>';
  chartHtml += '<text x="' + (px + candleW / 2) + '" y="155" text-anchor="middle" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="bold">PHANTOM</text></g></svg></div>';

  chartHtml += '<div style="padding:10px 14px 14px; border-top:1px solid #111;">';
  chartHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:var(--o); letter-spacing:1px; font-weight:bold;">PHANTOM CANDLE — الشمعة المخفية</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:' + dirColor + '; font-weight:bold;">' + pc.probability + '% (' + pc.matchCount + ' تطابق)</span></div>';
  chartHtml += '<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px;">';
  [{ l: 'O', v: pc.open }, { l: 'H', v: pc.high }, { l: 'L', v: pc.low }, { l: 'C', v: pc.close }].forEach(function(item) {
    chartHtml += '<div style="background:#0a0a0a; border:1px solid #111; border-radius:6px; padding:6px 4px; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444; margin-bottom:2px;">' + item.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#fff; font-weight:bold;">$' + item.v.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</div></div>';
  });
  chartHtml += '</div></div></div>';
  document.getElementById('cd-chart-panel').innerHTML = chartHtml;

  var pmHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;">';
  pmHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ff6a00; font-weight:bold;">BEARISH</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#222; letter-spacing:1px;">CANDLE BIAS</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold;">BULLISH</span></div>';
  pmHtml += '<div style="position:relative; height:10px; background:#0d0d0d; border-radius:5px; border:1px solid #1a1a1a;">';
  pmHtml += '<div style="position:absolute; left:0; top:0; width:50%; height:100%; border-radius:5px 0 0 5px; background:linear-gradient(to right, rgba(255,106,0,0.15), transparent);"></div><div style="position:absolute; right:0; top:0; width:50%; height:100%; border-radius:0 5px 5px 0; background:linear-gradient(to left, rgba(255,255,255,0.1), transparent);"></div><div style="position:absolute; left:50%; top:-2px; width:1px; height:calc(100% + 4px); background:#333;"></div>';
  pmHtml += '<div style="position:absolute; top:50%; transform:translate(-50%,-50%); left:' + powerPos + '%; width:14px; height:14px; border-radius:50%; background:' + dirColor + '; box-shadow:0 0 10px ' + dirColor + '44; border:2px solid #000; transition:left 2s cubic-bezier(0.25,0.46,0.45,0.94);"></div>';
  pmHtml += '</div></div>';
  document.getElementById('cd-power-meter').innerHTML = pmHtml;

  var patHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid ' + sigColor(r.patterns.bias) + ';">';
  patHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Pattern Scanner</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#333;">LAYER 2</span></div>';
  if (r.patterns.detected.length > 0) {
    r.patterns.detected.forEach(function(p) {
      patHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #111;"><div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">' + p.name + '</div><div style="font-size:0.6rem; color:#888;">' + p.nameAr + ' — ' + p.type + '</div></div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:' + sigColor(p.bias) + '; font-weight:bold;">' + p.strength + '%</div></div>';
    });
  } else { patHtml += '<div style="font-size:0.7rem; color:#555; text-align:center; padding:8px 0;">لا أنماط مكتشفة حالياً</div>'; }
  patHtml += '</div>';
  document.getElementById('cd-patterns-card').innerHTML = patHtml;

  var dnaHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid ' + sigColor(r.dna.bias) + ';">';
  dnaHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Candle DNA</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#333;">LAYER 3</span></div>';
  dnaHtml += '<div style="display:flex; gap:4px; height:8px; margin-bottom:8px; border-radius:4px; overflow:hidden;"><div style="width:' + r.dna.bullPct + '%; background:#fff; border-radius:4px 0 0 4px;"></div><div style="width:' + r.dna.bearPct + '%; background:#ff6a00; border-radius:0 4px 4px 0;"></div></div>';
  dnaHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:10px; font-family:\'Share Tech Mono\',monospace; font-size:0.6rem;"><span style="color:#fff;">' + r.dna.bullPct + '% صاعدة</span><span style="color:#ff6a00;">' + r.dna.bearPct + '% هابطة</span></div>';
  dnaHtml += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:10px;">';
  [{ l: 'متوسط الجسم', v: r.dna.avgBody }, { l: 'ظل علوي', v: r.dna.avgUpperWick }, { l: 'ظل سفلي', v: r.dna.avgLowerWick }].forEach(function(item) {
    dnaHtml += '<div style="background:#080808; border:1px solid #111; border-radius:6px; padding:6px; text-align:center;"><div style="font-size:0.5rem; color:#555; margin-bottom:2px;">' + item.l + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#ccc; font-weight:bold;">' + item.v + '</div></div>';
  });
  dnaHtml += '</div><div style="font-size:0.62rem; color:#777; line-height:1.5;">' + r.dna.personality + '</div></div>';
  document.getElementById('cd-dna-card').innerHTML = dnaHtml;

  var flowHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid ' + sigColor(r.flow.bias) + ';">';
  flowHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Order Flow</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#333;">LAYER 4</span></div>';
  flowHtml += '<div style="display:flex; gap:10px; margin-bottom:10px;">';
  flowHtml += '<div style="flex:1;"><div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:0.6rem; color:#888;">ضغط شرائي</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#fff; font-weight:bold;">' + r.flow.buyPct + '%</span></div><div style="height:5px; background:#111; border-radius:3px;"><div style="width:' + r.flow.buyPct + '%; height:100%; background:#fff; border-radius:3px;"></div></div></div>';
  flowHtml += '<div style="flex:1;"><div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-size:0.6rem; color:#888;">ضغط بيعي</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#ff6a00; font-weight:bold;">' + r.flow.sellPct + '%</span></div><div style="height:5px; background:#111; border-radius:3px;"><div style="width:' + r.flow.sellPct + '%; height:100%; background:#ff6a00; border-radius:3px;"></div></div></div></div>';
  flowHtml += '<div style="font-size:0.62rem; color:#777; line-height:1.5;">' + r.flow.verdict + '</div></div>';
  document.getElementById('cd-flow-card').innerHTML = flowHtml;

  var conc = 'الشمعة المخفية تتوقع إغلاقاً ' + (r.phantom.type === 'bullish' ? 'إيجابياً' : 'سلبياً') + ' باحتمالية ' + r.phantom.probability + '% (مرتكزة على ' + r.phantom.matchCount + ' تطابق تاريخي). ';
  if (r.patterns.detected.length > 0) conc += 'نمط ' + r.patterns.detected[0].nameAr + ' يدعم التحليل. ';
  conc += 'البصمة الهيكلية للسوق تؤكد سيطرة بنسبة ' + r.dna.bullPct + '% للشموع الصاعدة. ';
  conc += 'وتدفق الأوامر يظهر خللاً لصالح ' + (r.flow.bias === 'bullish' ? 'المشترين.' : r.flow.bias === 'bearish' ? 'البائعين.' : 'التوازن المستقر.');
  document.getElementById('cd-conclusion').textContent = conc;
}

// حقن تأثيرات التحريك (CSS Keyframes) الخاصة بالشمعة المتوهجة
if (!document.getElementById('cd-custom-styles')) {
  var cdStyles = document.createElement('style');
  cdStyles.id = 'cd-custom-styles';
  cdStyles.textContent = '@keyframes phantomGlow{0%,100%{opacity:0.4;filter:drop-shadow(0 0 0 transparent)}50%{opacity:0.9;filter:drop-shadow(0 0 8px rgba(255,255,255,0.3))}} @keyframes phantomDash{0%{stroke-dashoffset:0}100%{stroke-dashoffset:20}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(cdStyles);
}

// ==========================================
// Fractal Detector — كاشف فراكتلات Bill Williams
// التحسين: جلب 500 شمعة لضبط الإحصائيات (Break Rate) ونسب الكسر
// ==========================================

async function runFractalDetector() {
  var coinInput = document.getElementById('fr-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('fr-tf').value.toLowerCase();
  var btn = document.getElementById('fr-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'SCANNING FRACTALS...';
  btn.disabled = true;

  try {
    // رفع limit إلى 250 لضمان دقة إحصائيات الكسر والمستويات التاريخية
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    var raw = await res.json();

    if (raw.length < 30) throw new Error('بيانات غير كافية للتحليل (30 شمعة على الأقل).');

    var candles = raw.map(function(k) {
      return { time: parseInt(k[0]), o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]) };
    });

    var currentPrice = candles[candles.length - 1].c;
    var result = analyzeFractals(candles, currentPrice);

    renderFractalDashboard(symbol, currentPrice, tfInput.toUpperCase(), candles, result);
    document.getElementById('fr-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function analyzeFractals(candles, currentPrice) {
  var n = candles.length;
  var fractals = [];
  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  function fmtDate(ts) { var d = new Date(ts); return d.getUTCDate() + ' ' + months[d.getUTCMonth()]; }

  for (var i = 2; i < n - 2; i++) {
    // قمة (Fractal High)
    if (candles[i].h > candles[i - 1].h && candles[i].h > candles[i - 2].h && candles[i].h > candles[i + 1].h && candles[i].h > candles[i + 2].h) {
      var brokenUp = false;
      for (var j = i + 3; j < n; j++) { if (candles[j].h > candles[i].h) { brokenUp = true; break; } }
      fractals.push({ type: 'up', price: candles[i].h, date: fmtDate(candles[i].time), idx: i, status: brokenUp ? 'broken' : 'holding' });
    }
    // قاع (Fractal Low)
    if (candles[i].l < candles[i - 1].l && candles[i].l < candles[i - 2].l && candles[i].l < candles[i + 1].l && candles[i].l < candles[i + 2].l) {
      var brokenDown = false;
      for (var k = i + 3; k < n; k++) { if (candles[k].l < candles[i].l) { brokenDown = true; break; } }
      fractals.push({ type: 'down', price: candles[i].l, date: fmtDate(candles[i].time), idx: i, status: brokenDown ? 'broken' : 'holding' });
    }
  }

  fractals.sort(function(a, b) { return b.idx - a.idx; });

  var nearestResistance = null, nearestSupport = null;
  for (var r = 0; r < fractals.length; r++) {
    if (!nearestResistance && fractals[r].type === 'up' && fractals[r].status === 'holding' && fractals[r].price > currentPrice) nearestResistance = fractals[r];
    if (!nearestSupport && fractals[r].type === 'down' && fractals[r].status === 'holding' && fractals[r].price < currentPrice) nearestSupport = fractals[r];
    if (nearestResistance && nearestSupport) break;
  }

  if (!nearestResistance) {
    for (var r2 = 0; r2 < fractals.length; r2++) {
      if (fractals[r2].type === 'up' && fractals[r2].price > currentPrice) { nearestResistance = fractals[r2]; break; }
    }
  }
  if (!nearestSupport) {
    for (var s2 = 0; s2 < fractals.length; s2++) {
      if (fractals[s2].type === 'down' && fractals[s2].price < currentPrice) { nearestSupport = fractals[s2]; break; }
    }
  }

  if (nearestResistance) nearestResistance.distance = '+' + ((nearestResistance.price - currentPrice) / currentPrice * 100).toFixed(2) + '%';
  if (nearestSupport) nearestSupport.distance = '-' + ((currentPrice - nearestSupport.price) / currentPrice * 100).toFixed(2) + '%';

  var totalUp = fractals.filter(function(f) { return f.type === 'up'; }).length;
  var totalDown = fractals.filter(function(f) { return f.type === 'down'; }).length;
  var brokenUpCount = fractals.filter(function(f) { return f.type === 'up' && f.status === 'broken'; }).length;
  var brokenDownCount = fractals.filter(function(f) { return f.type === 'down' && f.status === 'broken'; }).length;
  
  var holdingUp = totalUp - brokenUpCount;
  var holdingDown = totalDown - brokenDownCount;
  var totalFractals = totalUp + totalDown;
  var totalBroken = brokenUpCount + brokenDownCount;
  var breakRate = totalFractals > 0 ? Math.round((totalBroken / totalFractals) * 100) : 0;

  return { fractals: fractals, nearestResistance: nearestResistance, nearestSupport: nearestSupport, stats: { totalUp: totalUp, totalDown: totalDown, holdingUp: holdingUp, holdingDown: holdingDown, breakRate: breakRate, total: totalFractals } };
}

function renderFractalDashboard(symbol, price, tf, candles, r) {
  var n = candles.length;
  var chartCandles = candles.slice(-30);
  var chartCloses = chartCandles.map(function(c) { return c.c; });
  var chartStartIdx = n - 30;

  var allPrices = [];
  chartCandles.forEach(function(c) { allPrices.push(c.h, c.l); });
  if (r.nearestResistance) allPrices.push(r.nearestResistance.price);
  if (r.nearestSupport) allPrices.push(r.nearestSupport.price);

  var minP = Math.min.apply(null, allPrices) * 0.998;
  var maxP = Math.max.apply(null, allPrices) * 1.002;
  var range = maxP - minP || 1;
  var toY = function(p) { return 90 - ((p - minP) / range) * 70 + 10; };
  var chartW = 320;
  var step = chartW / (chartCandles.length - 1);

  var html = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden;">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#0a0a0a; border-bottom:1px solid #111;"><div style="display:flex; align-items:center; gap:10px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:var(--o); font-weight:bold;">' + symbol + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff;">$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</span></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#333;">' + tf + ' | FRACTALS</span></div>';
  
  html += '<div style="padding:10px 14px;"><svg width="100%" height="110" viewBox="0 0 ' + chartW + ' 110" style="direction:ltr;">';
  html += '<defs><linearGradient id="frGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(255,106,0,0.2)"/><stop offset="100%" stop-color="rgba(255,106,0,0)"/></linearGradient></defs>';
  
  var points = chartCloses.map(function(p, i) { return (i * step) + ',' + toY(p); }).join(' ');
  html += '<polygon points="0,100 ' + points + ' ' + chartW + ',100" fill="url(#frGrad)" opacity="0.3"/>';
  html += '<polyline points="' + points + '" fill="none" stroke="#444" stroke-width="1.5"/>';

  if (r.nearestResistance) html += '<line x1="0" y1="' + toY(r.nearestResistance.price) + '" x2="' + chartW + '" y2="' + toY(r.nearestResistance.price) + '" stroke="#fff" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.3"/>';
  if (r.nearestSupport) html += '<line x1="0" y1="' + toY(r.nearestSupport.price) + '" x2="' + chartW + '" y2="' + toY(r.nearestSupport.price) + '" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.3"/>';

  r.fractals.forEach(function(f) {
    var chartIdx = f.idx - chartStartIdx;
    if (chartIdx < 0 || chartIdx >= chartCandles.length) return;
    var x = chartIdx * step, isUp = f.type === 'up', isHolding = f.status === 'holding';
    var color = isUp ? (isHolding ? '#fff' : '#333') : (isHolding ? '#ff6a00' : '#333');
    var pulse = isHolding ? 'style="animation:fractalPulse 2s ease infinite;"' : '';
    if (isUp) {
      var y = toY(f.price);
      html += '<polygon points="' + x + ',' + (y - 8) + ' ' + (x - 4) + ',' + (y - 2) + ' ' + (x + 4) + ',' + (y - 2) + '" fill="' + color + '" opacity="' + (isHolding ? '1' : '0.3') + '"/>';
      if (isHolding) html += '<circle cx="' + x + '" cy="' + (y - 5) + '" r="4" fill="none" stroke="#fff" stroke-width="1" ' + pulse + '/>';
    } else {
      var y2 = toY(f.price);
      html += '<polygon points="' + x + ',' + (y2 + 8) + ' ' + (x - 4) + ',' + (y2 + 2) + ' ' + (x + 4) + ',' + (y2 + 2) + '" fill="' + color + '" opacity="' + (isHolding ? '1' : '0.3') + '"/>';
      if (isHolding) html += '<circle cx="' + x + '" cy="' + (y2 + 5) + '" r="4" fill="none" stroke="#ff6a00" stroke-width="1" ' + pulse + '/>';
    }
  });

  html += '<circle cx="' + ((chartCandles.length - 1) * step) + '" cy="' + toY(price) + '" r="4" fill="#ff6a00"/></svg></div>';

  html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:0; border-top:1px solid #111;">';
  html += '<div style="padding:12px 14px; border-left:1px solid #111;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444; letter-spacing:1px; margin-bottom:4px;">NEAREST RESISTANCE</div>';
  if (r.nearestResistance) {
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:#fff; font-weight:bold;">$' + r.nearestResistance.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</div><div style="display:flex; justify-content:space-between; margin-top:4px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#888;">' + r.nearestResistance.date + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold;">' + r.nearestResistance.distance + '</span></div><div style="margin-top:6px;"><span style="font-size:0.5rem; padding:2px 5px; border-radius:4px; color:' + (r.nearestResistance.status === 'holding' ? '#fff' : '#444') + '; background:' + (r.nearestResistance.status === 'holding' ? 'rgba(255,255,255,0.06)' : 'rgba(80,80,80,0.1)') + '; border:1px solid ' + (r.nearestResistance.status === 'holding' ? 'rgba(255,255,255,0.12)' : '#1a1a1a') + ';">' + (r.nearestResistance.status === 'holding' ? 'صامد' : 'مكسور') + '</span></div>';
  } else { html += '<div style="font-size:0.7rem; color:#555;">لا مقاومة</div>'; }
  html += '</div><div style="padding:12px 14px;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#444; letter-spacing:1px; margin-bottom:4px;">NEAREST SUPPORT</div>';
  if (r.nearestSupport) {
    html += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1.1rem; color:#ff6a00; font-weight:bold;">$' + r.nearestSupport.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</div><div style="display:flex; justify-content:space-between; margin-top:4px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#888;">' + r.nearestSupport.date + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ff6a00; font-weight:bold;">' + r.nearestSupport.distance + '</span></div><div style="margin-top:6px;"><span style="font-size:0.5rem; padding:2px 5px; border-radius:4px; color:' + (r.nearestSupport.status === 'holding' ? '#ff6a00' : '#444') + '; background:' + (r.nearestSupport.status === 'holding' ? 'rgba(255,106,0,0.08)' : 'rgba(80,80,80,0.1)') + '; border:1px solid ' + (r.nearestSupport.status === 'holding' ? 'rgba(255,106,0,0.2)' : '#1a1a1a') + ';">' + (r.nearestSupport.status === 'holding' ? 'صامد' : 'مكسور') + '</span></div>';
  } else { html += '<div style="font-size:0.7rem; color:#555;">لا دعم</div>'; }
  html += '</div></div></div>';
  document.getElementById('fr-chart-panel').innerHTML = html;

  var statsHtml = '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;"><div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">TOTAL</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.3rem; color:#fff; font-weight:bold;">' + r.stats.total + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#555;">' + r.stats.totalUp + ' قمم / ' + r.stats.totalDown + ' قيعان</div></div><div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">HOLDING</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.3rem; color:#fff; font-weight:bold;">' + (r.stats.holdingUp + r.stats.holdingDown) + '</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#555;">صامدة (لم تُكسر)</div></div><div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:12px; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:var(--o); letter-spacing:1px; margin-bottom:6px;">BREAK RATE</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:1.3rem; color:var(--o); font-weight:bold;">' + r.stats.breakRate + '%</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#555;">نسبة الكسر التاريخية</div></div></div>';
  document.getElementById('fr-stats').innerHTML = statsHtml;

  var tblHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;"><span style="font-size:0.8rem; color:var(--o); font-weight:700;">آخر الفراكتلات المكتشفة</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#333; letter-spacing:1px;">FRACTAL LOG</span></div><table style="width:100%; border-collapse:collapse; text-align:center;"><thead><tr style="border-bottom:1px solid #222;"><th style="padding:8px 4px; font-size:0.65rem; color:#888;">النوع</th><th style="padding:8px 4px; font-size:0.65rem; color:#888;">السعر</th><th style="padding:8px 4px; font-size:0.65rem; color:#888;">التاريخ</th><th style="padding:8px 4px; font-size:0.65rem; color:#888;">الحالة</th></tr></thead><tbody>';
  r.fractals.slice(0, 10).forEach(function(f) {
    var isUp = f.type === 'up', isHolding = f.status === 'holding';
    var typeColor = isUp ? '#fff' : '#ff6a00', typeLabel = isUp ? '▲ قمة' : '▼ قاع';
    var statusColor = isHolding ? (isUp ? '#fff' : '#ff6a00') : '#444';
    var statusBg = isHolding ? (isUp ? 'rgba(255,255,255,0.06)' : 'rgba(255,106,0,0.08)') : 'rgba(80,80,80,0.1)';
    var statusBorder = isHolding ? (isUp ? 'rgba(255,255,255,0.12)' : 'rgba(255,106,0,0.2)') : '#1a1a1a';
    tblHtml += '<tr style="border-bottom:1px solid #111; background:' + (isHolding ? 'rgba(255,255,255,0.02)' : 'transparent') + ';"><td style="padding:6px 4px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + typeColor + '; font-weight:bold;">' + typeLabel + '</span></td><td style="padding:6px 4px; font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:' + (isHolding ? typeColor : '#555') + '; font-weight:bold;">$' + f.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</td><td style="padding:6px 4px; font-size:0.65rem; color:#888;">' + f.date + '</td><td style="padding:6px 4px;"><span style="font-size:0.5rem; padding:2px 6px; border-radius:6px; color:' + statusColor + '; background:' + statusBg + '; border:1px solid ' + statusBorder + ';">' + (isHolding ? 'صامد' : 'مكسور') + '</span></td></tr>';
  });
  tblHtml += '</tbody></table></div>';
  document.getElementById('fr-table-wrap').innerHTML = tblHtml;

  var conc = 'تم رصد ' + r.stats.total + ' فراكتل في آخر ' + n + ' شمعة (' + r.stats.totalUp + ' قمم + ' + r.stats.totalDown + ' قيعان). ';
  if (r.nearestResistance) conc += 'أقرب مقاومة فراكتلية ' + (r.nearestResistance.status === 'holding' ? 'صامدة' : 'مكسورة') + ' تتمركز عند $' + r.nearestResistance.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' (' + r.nearestResistance.distance + '). ';
  if (r.nearestSupport) conc += 'وأقرب دعم فراكتلي ' + (r.nearestSupport.status === 'holding' ? 'صامد' : 'مكسور') + ' يتمركز عند $' + r.nearestSupport.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' (' + r.nearestSupport.distance + '). ';
  conc += 'نسبة الكسر التاريخية تعادل ' + r.stats.breakRate + '%. الفراكتلات الصامدة (' + (r.stats.holdingUp + r.stats.holdingDown) + ' مستويات) تمثل مناطق جذب حقيقية للسيولة يجب مراقبتها لتوقع الانعكاس القادم.';
  document.getElementById('fr-conclusion').textContent = conc;
}

if (!document.getElementById('fr-pulse-style')) {
  var frStyle = document.createElement('style');
  frStyle.id = 'fr-pulse-style';
  frStyle.textContent = '@keyframes fractalPulse{0%,100%{r:4;opacity:0.8}50%{r:7;opacity:0}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(frStyle);
}

// ==========================================
// Fib Circles — دوائر فيبوناتشي (تقاطع السعر والزمن)
// التحسين: اكتشاف الارتكاز الماكرو الديناميكي (أعلى قمة vs أدنى قاع) لـ 500 شمعة
// ==========================================

async function runFibCircles() {
  var coinInput = document.getElementById('fc-symbol').value.trim().toUpperCase();
  var tfInput = document.getElementById('fc-tf').value.toLowerCase();
  var btn = document.getElementById('fc-btn');

  if (!coinInput) return;

  var symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'CALCULATING PROJECTIONS...';
  btn.disabled = true;

  try {
    // جلب 300 شمعة — الرقم الذهبي لتحديد دورة سعرية رئيسية ومؤثرة
    var res = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tfInput + '&limit=500');
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    var raw = await res.json();

    if (raw.length < 50) throw new Error('بيانات غير كافية للتحليل الزمني.');

    var candles = raw.map(function(k) {
      return { time: parseInt(k[0]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]) };
    });

    var currentPrice = candles[candles.length - 1].c;
    var result = calcFibCircles(candles, currentPrice);

    renderFibCirclesDashboard(symbol, currentPrice, tfInput.toUpperCase(), result);
    document.getElementById('fc-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'START';
    btn.disabled = false;
  }
}

function calcFibCircles(candles, currentPrice) {
  var n = candles.length;
  var highs = candles.map(function(c) { return c.h; });
  var lows = candles.map(function(c) { return c.l; });
  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  function fmtDate(ts) { var d = new Date(ts); return d.getUTCDate() + ' ' + months[d.getUTCMonth()]; }

  // خوارزمية اكتشاف القطب الأحدث (Absolute High vs Absolute Low)
  var maxHigh = -1, maxHighIdx = -1;
  var minLow = Infinity, minLowIdx = -1;

  // نتجاهل آخر شمعة جارية لضمان أن الارتكاز تاريخي ومغلق
  for (var i = 0; i < n - 1; i++) {
    if (highs[i] > maxHigh) { maxHigh = highs[i]; maxHighIdx = i; }
    if (lows[i] < minLow) { minLow = lows[i]; minLowIdx = i; }
  }

  var swingIdx, swingPrice, swingType;

  // نقارن أيهما أحدث زمنياً (الـ Index الأكبر يعني أقرب للوقت الحالي)
  if (maxHighIdx > minLowIdx) {
    swingIdx = maxHighIdx; swingPrice = maxHigh; swingType = 'قمة محورية';
  } else {
    swingIdx = minLowIdx; swingPrice = minLow; swingType = 'قاع محوري';
  }

  var swingDate = fmtDate(candles[swingIdx].time);
  var candlesFromSwing = n - 1 - swingIdx;
  if (candlesFromSwing === 0) candlesFromSwing = 1; // حماية من القسمة على صفر

  // نطاق الحركة (Price & Time Delta)
  var priceRange = Math.abs(currentPrice - swingPrice);
  var timeRange = candlesFromSwing;

  var ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618];
  var ratioLabels = ['23.6%', '38.2%', '50.0%', '61.8%', '78.6%', '100%', '161.8%'];
  var ratioTypes = ['فرعية', 'رئيسية', 'فرعية', 'رئيسية', 'فرعية', 'رئيسية', 'رئيسية'];

  var circles = [];
  for (var j = 0; j < ratios.length; j++) {
    var r = ratios[j];
    var priceDelta = priceRange * r;
    var timeDelta = Math.round(timeRange * r);

    var priceUp = swingPrice + priceDelta;
    var priceDown = swingPrice - priceDelta;

    var status = 'upcoming';
    if (swingType.includes('قاع')) {
      if (currentPrice >= priceUp) status = 'passed';
      else if (Math.abs(currentPrice - priceUp) / priceUp < 0.015) status = 'active'; // التفاوت 1.5% لتفعيل الدائرة
      else if (candlesFromSwing >= timeDelta && currentPrice < priceUp) status = 'active';
    } else {
      if (currentPrice <= priceDown) status = 'passed';
      else if (Math.abs(currentPrice - priceDown) / priceDown < 0.015) status = 'active';
      else if (candlesFromSwing >= timeDelta && currentPrice > priceDown) status = 'active';
    }

    if (candlesFromSwing > timeDelta && status === 'upcoming') status = 'passed';

    var circleTime = candles[swingIdx].time + timeDelta * (candles[1].time - candles[0].time);
    var circleDate = fmtDate(circleTime);

    circles.push({ ratio: r, label: ratioLabels[j], type: ratioTypes[j], priceUp: Math.round(priceUp * 100) / 100, priceDown: Math.round(priceDown * 100) / 100, timeFwd: timeDelta, date: circleDate, status: status });
  }

  var hasActive = circles.some(function(c) { return c.status === 'active'; });
  if (!hasActive) {
    for (var k = 0; k < circles.length; k++) {
      if (circles[k].status === 'upcoming') { circles[k].status = 'active'; break; }
    }
  }

  return { swing: { type: swingType, price: swingPrice, date: swingDate, candlesAgo: candlesFromSwing }, circles: circles };
}

function renderFibCirclesDashboard(symbol, price, tf, r) {
  var activeCircle = null, nextCircle = null;
  for (var i = 0; i < r.circles.length; i++) {
    if (r.circles[i].status === 'active' && !activeCircle) activeCircle = r.circles[i];
    if (r.circles[i].status === 'upcoming' && !nextCircle) nextCircle = r.circles[i];
  }

  var infoHtml = '<div style="display:flex; justify-content:center; align-items:center; gap:20px; padding:10px 0; border-top:1px solid #111; border-bottom:1px solid #111;">';
  infoHtml += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; margin-bottom:2px;">PAIR</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:var(--o); font-weight:bold;">' + symbol + '</div></div>';
  infoHtml += '<div style="width:1px; height:24px; background:#222;"></div>';
  infoHtml += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; margin-bottom:2px;">PRICE</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:#fff; font-weight:bold;">$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</div></div>';
  infoHtml += '<div style="width:1px; height:24px; background:#222;"></div>';
  infoHtml += '<div style="text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; margin-bottom:2px;">SWING</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.85rem; color:#ddd;">' + r.swing.type + '</div></div></div>';
  document.getElementById('fc-info-bar').innerHTML = infoHtml;

  var radii = [19, 33, 43, 53, 67, 86, 138];
  var showPriceAt = [3, 5, 6];

  var svgHtml = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; padding:12px;">';
  svgHtml += '<div style="display:flex; justify-content:space-between; align-items:center; padding:0 4px 10px; border-bottom:1px solid #111; margin-bottom:10px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:var(--o); font-weight:bold;">FIB CIRCLES</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">PRICE × TIME</span></div>';
  svgHtml += '<div style="display:flex; justify-content:center;"><svg width="300" height="300" viewBox="0 0 300 300" style="direction:ltr;">';
  svgHtml += '<line x1="150" y1="10" x2="150" y2="290" stroke="#1a1a1a" stroke-width="0.5"/><line x1="10" y1="150" x2="290" y2="150" stroke="#1a1a1a" stroke-width="0.5"/>';

  for (var ci = 0; ci < r.circles.length; ci++) {
    var c = r.circles[ci], rad = radii[ci];
    var isAct = c.status === 'active', isUp = c.status === 'upcoming';
    var circleColor = isAct ? 'var(--o)' : isUp ? '#ffffff' : c.type === 'رئيسية' ? 'rgba(255,106,0,0.4)' : 'rgba(255,255,255,0.1)';
    var sw = isAct ? 1.5 : c.type === 'رئيسية' ? 1 : 0.5;
    var dashArr = isUp ? '5 3' : 'none';
    var glow = isAct ? 'style="animation:circleGlow 3s ease infinite;"' : '';

    svgHtml += '<circle cx="150" cy="150" r="' + rad + '" fill="' + (isAct ? 'var(--o)' : 'transparent') + '" fill-opacity="' + (isAct ? '0.05' : '0') + '" stroke="' + circleColor + '" stroke-width="' + sw + '" stroke-dasharray="' + dashArr + '" ' + glow + '/>';

    if (showPriceAt.indexOf(ci) >= 0) {
      var prUpColor = isAct ? '#fff' : isUp ? '#ccc' : '#aaa';
      var prDnColor = isAct ? 'var(--o)' : isUp ? 'var(--o)' : '#888';
      svgHtml += '<rect x="128" y="' + (150 - rad - 11) + '" width="44" height="10" rx="2" fill="#000" fill-opacity="0.9"/><text x="150" y="' + (150 - rad - 3.5) + '" text-anchor="middle" fill="' + prUpColor + '" font-size="5.5" font-family="Share Tech Mono" font-weight="bold">$' + c.priceUp.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</text>';
      svgHtml += '<rect x="128" y="' + (150 + rad + 2) + '" width="44" height="10" rx="2" fill="#000" fill-opacity="0.9"/><text x="150" y="' + (150 + rad + 9.5) + '" text-anchor="middle" fill="' + prDnColor + '" font-size="5.5" font-family="Share Tech Mono" font-weight="bold">$' + c.priceDown.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</text>';
    }
  }

  svgHtml += '<circle cx="150" cy="150" r="3" fill="var(--o)"/><circle cx="' + (150 + radii[5]) + '" cy="150" r="3" fill="#fff"/></svg></div>';
  
  svgHtml += '<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:6px; padding:10px 4px 0;">';
  r.circles.forEach(function(c) {
    var a = c.status === 'active', u = c.status === 'upcoming';
    var clr = a ? 'var(--o)' : u ? '#fff' : '#ccc';
    var bg = a ? 'rgba(255,106,0,0.1)' : 'rgba(255,255,255,0.03)';
    var bdr = a ? 'rgba(255,106,0,0.3)' : '#1a1a1a';
    svgHtml += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; font-weight:bold; padding:3px 8px; border-radius:6px; color:' + clr + '; background:' + bg + '; border:1px solid ' + bdr + ';">' + c.label + '</span>';
  });
  svgHtml += '</div></div>';
  document.getElementById('fc-chart-panel').innerHTML = svgHtml;

  var actHtml = '';
  if (activeCircle) {
    actHtml += '<div style="background:rgba(255,106,0,0.06); border:1px solid rgba(255,106,0,0.2); border-radius:10px; padding:14px; border-right:3px solid var(--o);">';
    actHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:var(--o); font-weight:bold; letter-spacing:1px;">ACTIVE CIRCLE — ' + activeCircle.label + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#ddd;">' + activeCircle.date + '</span></div>';
    actHtml += '<div style="font-size:0.75rem; color:#ccc; line-height:1.6;">السعر يختبر حالياً حدود الدائرة الزمنية (' + activeCircle.label + '). يُشكل مستوى $' + activeCircle.priceUp.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' مقاومة علوية، بينما يتمركز الدعم عند $' + activeCircle.priceDown.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '.</div></div>';
  }
  document.getElementById('fc-active-panel').innerHTML = actHtml;

  var tblHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;"><span style="font-size:0.8rem; color:var(--o); font-weight:700;">مستويات الدوائر الفلكية</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; letter-spacing:1px;">CIRCLE LEVELS</span></div><div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; text-align:center;"><thead><tr style="border-bottom:1px solid #222;"><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">Fib</th><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">مقاومة</th><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">دعم</th><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">التاريخ</th><th style="padding:8px 3px; font-size:0.6rem; color:#ddd;">الحالة</th></tr></thead><tbody>';
  r.circles.forEach(function(c) {
    var a = c.status === 'active', p = c.status === 'passed', m = c.type === 'رئيسية';
    var rBg = a ? 'rgba(255,106,0,0.06)' : 'transparent';
    var fibC = m ? 'var(--o)' : '#555';
    var prC = p ? '#444' : a ? 'var(--o)' : '#fff';
    var dnC = p ? '#444' : 'var(--o)';
    var sC = a ? 'var(--o)' : p ? '#444' : '#fff';
    var sBg = a ? 'rgba(255,106,0,0.12)' : p ? 'rgba(80,80,80,0.1)' : 'rgba(255,255,255,0.06)';
    var sBdr = a ? 'rgba(255,106,0,0.25)' : p ? '#1a1a1a' : 'rgba(255,255,255,0.12)';
    var sTxt = a ? 'نشطة' : p ? 'مرّت' : 'قادمة';

    tblHtml += '<tr style="border-bottom:1px solid #111; background:' + rBg + ';"><td style="padding:7px 3px; font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:' + fibC + '; font-weight:' + (m ? 'bold' : 'normal') + ';">' + c.label + '</td><td style="padding:7px 3px; font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + prC + '; font-weight:bold;">$' + c.priceUp.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</td><td style="padding:7px 3px; font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + dnC + ';">$' + c.priceDown.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</td><td style="padding:7px 3px; font-size:0.6rem; color:' + (p ? '#444' : '#ccc') + ';">' + c.date + '</td><td style="padding:7px 3px;"><span style="font-size:0.5rem; padding:2px 5px; border-radius:6px; color:' + sC + '; background:' + sBg + '; border:1px solid ' + sBdr + ';">' + sTxt + '</span></td></tr>';
  });
  tblHtml += '</tbody></table></div></div>';
  document.getElementById('fc-table-panel').innerHTML = tblHtml;

  var swHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid var(--o);"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); letter-spacing:1px; margin-bottom:8px;">SWING POINT</div><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;"><div style="text-align:center;"><div style="font-size:0.55rem; color:#ccc; margin-bottom:2px;">النوع</div><div style="font-size:0.8rem; color:#fff; font-weight:700;">' + r.swing.type + '</div></div><div style="text-align:center;"><div style="font-size:0.55rem; color:#ccc; margin-bottom:2px;">السعر</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.8rem; color:var(--o); font-weight:bold;">$' + r.swing.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</div></div><div style="text-align:center;"><div style="font-size:0.55rem; color:#ccc; margin-bottom:2px;">التاريخ</div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.75rem; color:#ddd; font-weight:bold;">' + r.swing.date + '</div></div></div></div>';
  document.getElementById('fc-swing-panel').innerHTML = swHtml;

  var conc = 'اكتشفت الخوارزمية ارتكازاً ماكرو (' + r.swing.type + ') عند $' + r.swing.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '. ';
  if (activeCircle) conc += 'السعر يشتبك زمنياً وسعرياً مع الدائرة (' + activeCircle.label + ') صانعاً مقاومات ودعوم مفصلية. ';
  if (nextCircle) conc += 'الدورة الزمنية القادمة (' + nextCircle.label + ') يُتوقع نضوجها بحلول (' + nextCircle.date + ') مستهدفة مستويات $' + nextCircle.priceUp.toLocaleString('en-US', { maximumFractionDigits: 0 }) + '. ';
  conc += 'الدوائر تدمج السعر والزمن معاً — تواجد السعر عند أطراف الدوائر الرئيسية يرفع احتمالات الانعكاس الرياضي أو الانفجار السعري.';
  document.getElementById('fc-conclusion').textContent = conc;
}

if (!document.getElementById('fc-pulse-style')) {
  var fcStyle = document.createElement('style');
  fcStyle.id = 'fc-pulse-style';
  fcStyle.textContent = '@keyframes circleGlow{0%,100%{opacity:0.3;filter:drop-shadow(0 0 2px rgba(255,106,0,0.5))}50%{opacity:0.8;filter:drop-shadow(0 0 8px rgba(255,106,0,0.8))}} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(fcStyle);
}

// ==========================================
// Astro Engine — المحرك الفلكي الماكرو (Geocentric + Correlation)
// ==========================================

async function loadAstroEngine() {
  var loading = document.getElementById('ae-loading');
  var dashboard = document.getElementById('ae-dashboard');
  loading.style.display = 'block'; dashboard.style.display = 'none';

  try {
    var nowDate = new Date();
    var planets = calcGeocentricPositions(nowDate);
    var mercury = checkDynamicRetrograde(nowDate);
    var aspects = findAspects(planets);
    if (mercury.retrograde) planets[0].retrograde = true;
    var upcoming = findUpcomingEvents(nowDate);

    // جلب 1000 شمعة للربط الإحصائي العميق من الكاش
    var res = await fetch('/api/astro-btc');
    if (!res.ok) throw new Error('Network error');
    var raw = await res.json();
    var candles = raw.map(function(k) { return { time: parseInt(k[0]), c: parseFloat(k[4]) }; });
    
    var price = candles[candles.length - 1].c;
    var correlation = calcAstroCorrelation(candles);

    var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    var dateStr = nowDate.getUTCDate() + ' ' + months[nowDate.getUTCMonth()] + ' ' + nowDate.getUTCFullYear();

    var bullish = 0, bearish = 0;
    aspects.forEach(function(a) { if (a.signal === 'bullish') bullish++; else if (a.signal === 'bearish') bearish++; });
    if (mercury.retrograde) bearish++; else bullish++;

    var moonInfo = getPhaseInfo ? getPhaseInfo(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()) : {phase: 0.5};
    if (moonInfo.phase > 0.4 && moonInfo.phase < 0.6) bearish++; else if (moonInfo.phase < 0.1 || moonInfo.phase > 0.9) bullish++;

    var total = bullish + bearish;
    var direction = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';
    var confidence = total > 0 ? Math.round(Math.max(bullish, bearish) / total * 100) : 50;

    var result = { date: dateStr, planets: planets, aspects: aspects, mercury: mercury, upcoming: upcoming, correlation: correlation, moon: moonInfo, score: { bullish: bullish, bearish: bearish, neutral: total - bullish - bearish, direction: direction, confidence: confidence } };

    renderAstroDashboard(price, result);
    loading.style.display = 'none'; dashboard.style.display = 'block';
  } catch (e) {
    loading.innerHTML = '<div style="color:var(--o);">تعذر الاتصال بالمحرك الفلكي.</div>';
  }
}

function toJulianCenturies(now) {
  var y = now.getUTCFullYear(), m = now.getUTCMonth() + 1, d = now.getUTCDate() + now.getUTCHours() / 24;
  if (m <= 2) { y--; m += 12; }
  var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  var jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  return (jd - 2451545.0) / 36525.0;
}

function normDeg(deg) { var d = deg % 360; return d < 0 ? d + 360 : d; }

// خوارزمية التحويل لمركزية الأرض (Geocentric Transformation)
function calcGeocentricPositions(now) {
  var T = toJulianCenturies(now);
  
  // Heliocentric Mean Longitudes
  var L_sun = normDeg(280.466 + 36000.77 * T);
  var L_merc = normDeg(252.25 + 149474.07 * T + 6.7 * Math.sin((174.79 + 149472.51 * T) * Math.PI / 180));
  var L_ven = normDeg(181.98 + 58519.21 * T + 0.77 * Math.sin((50.41 + 58517.80 * T) * Math.PI / 180));
  var L_earth = normDeg(L_sun + 180);
  var L_mars = normDeg(355.43 + 19141.70 * T + 10.69 * Math.sin((19.37 + 19139.86 * T) * Math.PI / 180));
  var L_jup = normDeg(34.35 + 3036.30 * T + 5.55 * Math.sin((20.02 + 3034.69 * T) * Math.PI / 180));
  var L_sat = normDeg(50.08 + 1223.51 * T + 6.40 * Math.sin((317.02 + 1222.11 * T) * Math.PI / 180));
  var L_moon = normDeg(218.32 + 481267.88 * T);

  // Mean Distances (AU)
  var R_merc = 0.387, R_ven = 0.723, R_earth = 1.0, R_mars = 1.524, R_jup = 5.203, R_sat = 9.537;

  // تحويل أي كوكب من Heliocentric إلى Geocentric باستخدام Math.atan2
  function toGeo(L_planet, R_planet) {
    var X = R_planet * Math.cos(L_planet * Math.PI / 180) - R_earth * Math.cos(L_earth * Math.PI / 180);
    var Y = R_planet * Math.sin(L_planet * Math.PI / 180) - R_earth * Math.sin(L_earth * Math.PI / 180);
    return normDeg(Math.atan2(Y, X) * 180 / Math.PI);
  }

  return [
    { name: 'Mercury', nameAr: 'عطارد', color: '#A0A0A0', degree: Math.round(toGeo(L_merc, R_merc)), helio: L_merc },
    { name: 'Venus', nameAr: 'الزهرة', color: '#E8C87A', degree: Math.round(toGeo(L_ven, R_ven)), helio: L_ven },
    { name: 'Earth', nameAr: 'الأرض', color: '#4488ff', degree: Math.round(L_earth) }, // المرجع
    { name: 'Moon', nameAr: 'القمر', color: '#C0C0C0', degree: Math.round(L_moon), isMoon: true }, // Geocentric أصلاً
    { name: 'Mars', nameAr: 'المريخ', color: '#C1440E', degree: Math.round(toGeo(L_mars, R_mars)), helio: L_mars },
    { name: 'Jupiter', nameAr: 'المشتري', color: '#C88B3A', degree: Math.round(toGeo(L_jup, R_jup)), helio: L_jup },
    { name: 'Saturn', nameAr: 'زحل', color: '#D4B896', degree: Math.round(toGeo(L_sat, R_sat)), helio: L_sat }
  ];
}

// محرك الاستشراف الزمني لتراجع عطارد (Time-Stepper)
function checkDynamicRetrograde(now) {
  var currentGeo = calcGeocentricPositions(now)[0].degree;
  var tomorrow = new Date(now.getTime() + 86400000);
  var tomorrowGeo = calcGeocentricPositions(tomorrow)[0].degree;
  
  // معالجة تقاطع الصفر (Zero-Crossover Fix)
  var motion = tomorrowGeo - currentGeo;
  if (motion > 180) motion -= 360;
  if (motion < -180) motion += 360;
  
  var isRetro = motion < 0;
  var nextRetro = null, nextDirect = null;
  var state = isRetro;
  
  // استشراف المستقبل حتى 150 يوم
  for (var d = 1; d <= 150; d++) {
    var check1 = new Date(now.getTime() + d * 86400000);
    var check2 = new Date(check1.getTime() + 86400000);
    var g1 = calcGeocentricPositions(check1)[0].degree;
    var g2 = calcGeocentricPositions(check2)[0].degree;
    var m = g2 - g1;
    if (m > 180) m -= 360; if (m < -180) m += 360;
    var dayRetro = m < 0;
    
    if (!state && dayRetro && !nextRetro) { nextRetro = check1; state = true; }
    if (state && !dayRetro && !nextDirect) { nextDirect = check1; state = false; }
    if (nextRetro && nextDirect && (!isRetro || (isRetro && nextDirect))) break;
  }

  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var fmtD = function(dObj) { return dObj ? dObj.getUTCDate() + ' ' + months[dObj.getUTCMonth()] : '--'; };
  var daysTo = nextRetro ? Math.round((nextRetro - now) / 86400000) : 0;

  return { retrograde: isRetro, nextRetro: fmtD(nextRetro), nextDirect: fmtD(nextDirect), daysToRetro: isRetro ? 0 : daysTo };
}

function findAspects(planets) {
  var types = [{n: 'اقتران', a: 0, o: 8, e: 'تركيز طاقة'}, {n: 'تسديس', a: 60, o: 6, e: 'فرصة إيجابية'}, {n: 'تربيع', a: 90, o: 8, e: 'توتر وصراع'}, {n: 'تثليث', a: 120, o: 8, e: 'تدفق واندفاع'}, {n: 'مقابلة', a: 180, o: 8, e: 'تعارض وانعكاس'}];
  var bull = ['تثليث', 'تسديس'], bear = ['تربيع', 'مقابلة'], detected = [];
  var outP = planets.filter(function(p) { return p.name !== 'Earth' && p.name !== 'Moon'; });

  for (var i = 0; i < outP.length; i++) {
    for (var j = i + 1; j < outP.length; j++) {
      var diff = Math.abs(outP[i].degree - outP[j].degree);
      if (diff > 180) diff = 360 - diff;
      for (var k = 0; k < types.length; k++) {
        if (Math.abs(diff - types[k].a) <= types[k].o) {
          var sig = bull.indexOf(types[k].n) >= 0 ? 'bullish' : bear.indexOf(types[k].n) >= 0 ? 'bearish' : 'neutral';
          detected.push({ p1Ar: outP[i].nameAr, p1C: outP[i].color, p2Ar: outP[j].nameAr, p2C: outP[j].color, type: types[k].n, angle: types[k].a + '°', effect: types[k].e, signal: sig });
          break;
        }
      }
    }
  }
  return detected;
}

function findUpcomingEvents(now) {
  var evs = [], months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  for (var d = 1; d <= 60; d++) {
    var checkD = new Date(now.getTime() + d * 86400000);
    var dStr = checkD.getUTCDate() + ' ' + months[checkD.getUTCMonth()];
    var pPhase = getPhaseInfo ? getPhaseInfo(checkD.getUTCFullYear(), checkD.getUTCMonth(), checkD.getUTCDate()).phase : 0.5;
    if (pPhase < 0.02 || pPhase > 0.98) evs.push({ date: dStr, event: 'محاق (New Moon)', effect: 'طاقة انعكاس إيجابية' });
    else if (pPhase > 0.48 && pPhase < 0.52) evs.push({ date: dStr, event: 'بدر (Full Moon)', effect: 'طاقة تفريغ وجني أرباح' });
    if (evs.length >= 5) break;
  }
  return evs;
}

// محرك الارتباط الديناميكي 1000 شمعة
function calcAstroCorrelation(candles) {
  var retro = [], normal = [], fullR = [], newR = [];
  var l = candles.length;
  
  // Backtesting Retrograde dynamically
  for (var i = 0; i < l; i++) {
    var cTime = new Date(candles[i].time);
    var isR = checkDynamicRetrograde(cTime).retrograde;
    if (isR) retro.push(candles[i]); else normal.push(candles[i]);
    
    if (i < l - 3 && getPhaseInfo) {
      var ph = getPhaseInfo(cTime.getUTCFullYear(), cTime.getUTCMonth(), cTime.getUTCDate()).phase;
      var r3d = (candles[i+3].c - candles[i].c) / candles[i].c * 100;
      if (ph > 0.48 && ph < 0.52) fullR.push(r3d);
      if (ph < 0.02 || ph > 0.98) newR.push(r3d);
    }
  }

  function stats(arr) {
    if (arr.length < 2) return { avg: 0, vol: 0, bull: 50 };
    var rets = [], b = 0;
    for (var j = 1; j < arr.length; j++) { var r = (arr[j].c - arr[j-1].c)/arr[j-1].c*100; rets.push(r); if (r > 0) b++; }
    var avg = rets.reduce(function(a,v){return a+v},0)/rets.length;
    var vol = Math.sqrt(rets.reduce(function(a,v){return a+Math.pow(v-avg,2)},0)/rets.length);
    return { avg: avg, vol: vol, bull: Math.round(b/rets.length*100) };
  }
  
  var rs = stats(retro), ns = stats(normal);
  var vInc = ns.vol > 0 ? Math.round((rs.vol/ns.vol - 1)*100) : 0;
  var avgA = function(a) { return a.length ? a.reduce(function(acc,v){return acc+v},0)/a.length : 0; };
  var bullA = function(a) { return a.length ? Math.round(a.filter(function(v){return v>0}).length/a.length*100) : 50; };

  return {
    mercury: { p: Math.round(retro.length/22), v: (vInc>=0?'+':'')+vInc+'%', r: (rs.avg>=0?'+':'')+rs.avg.toFixed(1)+'%', b: rs.bull },
    fullM: { c: fullR.length, r: (avgA(fullR)>=0?'+':'')+avgA(fullR).toFixed(1)+'%', b: bullA(fullR) },
    newM: { c: newR.length, r: (avgA(newR)>=0?'+':'')+avgA(newR).toFixed(1)+'%', b: bullA(newR) }
  };
}

function renderAstroDashboard(price, r) {
  var dCol = r.score.direction === 'bullish' ? '#fff' : r.score.direction === 'bearish' ? 'var(--o)' : '#888';
  document.getElementById('ae-date').textContent = r.date;

  // ==========================================
  // 1. الخريطة الفلكية العلمية (Heliocentric System)
  // المركز: الشمس | الترتيب: فلكي فيزيائي | بدون أبراج
  // ==========================================
  var mH = '<div style="background:#050510; border:1px solid #1a1a2a; border-radius:14px; padding:12px;">';
  mH += '<div style="display:flex; justify-content:space-between; align-items:center; padding:0 4px 10px; border-bottom:1px solid #111; margin-bottom:8px;">';
  mH += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:var(--o); font-weight:bold;">HELIOCENTRIC MAP</span>';
  mH += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">ASTRONOMICAL ALIGNMENT</span>';
  mH += '</div>';
  mH += '<div style="display:flex; justify-content:center;">';
  mH += '<svg width="310" height="310" viewBox="0 0 310 310" style="direction:ltr;">';
  
  // توهج الشمس
  mH += '<defs>';
  mH += '<radialGradient id="sunG" cx="50%" cy="50%" r="50%">';
  mH += '<stop offset="0%" stop-color="#FFD700" stop-opacity="0.6"/>';
  mH += '<stop offset="100%" stop-color="#FFD700" stop-opacity="0"/>';
  mH += '</radialGradient>';
  mH += '</defs>';
  mH += '<rect width="310" height="310" fill="#020208" rx="8"/>';
  
  // النجوم (خلفية فضاء حقيقية)
  for (var si = 0; si < 60; si++) { 
    var sX = 5 + (si * 97) % 300;
    var sY = 5 + (si * 131) % 300;
    var sR = ((si % 3) + 1) * 0.3;
    var sOp = 0.1 + (si % 5) * 0.06;
    mH += '<circle cx="' + sX + '" cy="' + sY + '" r="' + sR + '" fill="#fff" opacity="' + sOp + '"/>'; 
  }

  // المدارات الفلكية الصحيحة (ترتيب بعد الكواكب عن الشمس)
  var helioOrbs = { 'Mercury': 35, 'Venus': 55, 'Earth': 78, 'Mars': 100, 'Jupiter': 125, 'Saturn': 145 };
  Object.values(helioOrbs).forEach(function(o) {
    mH += '<circle cx="155" cy="155" r="' + o + '" fill="none" stroke="#ffffff18" stroke-width="0.5"/>';
  });

  // الشمس في المركز
  mH += '<circle cx="155" cy="155" r="22" fill="url(#sunG)"/>';
  mH += '<circle cx="155" cy="155" r="9" fill="#FFD700"/>';

  // رسم الكواكب بناءً على الإحداثيات الشمسية (Heliocentric Longitude)
  var earthPos = { x: 155, y: 155 }; // لتثبيت القمر لاحقاً
  
  for (var pi = 0; pi < r.planets.length; pi++) {
    var p = r.planets[pi];
    if (p.name === 'Sun' || p.name === 'Moon') continue; // تجاوز الشمس والقمر هنا
    
    // استخدام الزاوية الفلكية المركزية
    var angleDeg = p.helio !== undefined ? p.helio : p.degree;
    if (p.name === 'Earth') angleDeg = p.degree; 
    
    var a = (angleDeg - 90) * Math.PI / 180;
    var orb = helioOrbs[p.name] || 0;
    var px = 155 + orb * Math.cos(a);
    var py = 155 + orb * Math.sin(a);
    
    // حفظ موقع الأرض لربط مدار القمر بها
    if (p.name === 'Earth') { earthPos.x = px; earthPos.y = py; }
    
    // أحجام نسبية للكواكب
    var pR = p.name === 'Jupiter' ? 6 : p.name === 'Saturn' ? 5 : p.name === 'Earth' ? 4 : p.name === 'Venus' ? 3.5 : 2.5;
    
    mH += '<circle cx="' + px + '" cy="' + py + '" r="' + (pR + 4) + '" fill="' + p.color + '" fill-opacity="0.1"/>';
    mH += '<circle cx="' + px + '" cy="' + py + '" r="' + pR + '" fill="' + p.color + '"/>';
    mH += '<text x="' + px + '" y="' + (py - pR - 3) + '" text-anchor="middle" fill="' + p.color + '" font-size="4.5" font-family="Share Tech Mono" font-weight="bold">' + p.nameAr + '</text>';
  }

  // رسم القمر في مداره حول الأرض
  var moon = r.planets.find(function(p) { return p.name === 'Moon'; });
  if (moon) {
    // مدار القمر الوهمي
    mH += '<circle cx="' + earthPos.x + '" cy="' + earthPos.y + '" r="8" fill="none" stroke="#ffffff33" stroke-width="0.4" stroke-dasharray="1.5 1.5"/>';
    var mA = (moon.degree - 90) * Math.PI / 180;
    var mX = earthPos.x + 8 * Math.cos(mA);
    var mY = earthPos.y + 8 * Math.sin(mA);
    mH += '<circle cx="' + mX + '" cy="' + mY + '" r="1.5" fill="#ccc"/>';
  }

  // خطوط الزوايا الهندسية
  for (var ai = 0; ai < r.aspects.length; ai++) {
    var asp = r.aspects[ai];
    var p1 = r.planets.find(function(p) { return p.nameAr === asp.p1Ar; });
    var p2 = r.planets.find(function(p) { return p.nameAr === asp.p2Ar; });
    if (!p1 || !p2 || p1.name === 'Sun' || p2.name === 'Sun') continue;
    
    var a1 = ((p1.helio !== undefined ? p1.helio : p1.degree) - 90) * Math.PI / 180;
    var a2 = ((p2.helio !== undefined ? p2.helio : p2.degree) - 90) * Math.PI / 180;
    if (p1.name === 'Earth') a1 = (p1.degree - 90) * Math.PI / 180;
    if (p2.name === 'Earth') a2 = (p2.degree - 90) * Math.PI / 180;
    
    var x1 = 155 + (helioOrbs[p1.name] || 0) * Math.cos(a1);
    var y1 = 155 + (helioOrbs[p1.name] || 0) * Math.sin(a1);
    var x2 = 155 + (helioOrbs[p2.name] || 0) * Math.cos(a2);
    var y2 = 155 + (helioOrbs[p2.name] || 0) * Math.sin(a2);
    
    var lineColor = asp.signal === 'bullish' ? '#ffffff44' : 'var(--o)44';
    mH += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + lineColor + '" stroke-width="0.6" stroke-dasharray="3 3"/>';
  }
  
  mH += '</svg></div></div>';
  document.getElementById('ae-map-panel').innerHTML = mH;

  // ==========================================
  // 2. Power Meter
  // ==========================================
  var pmH = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;">';
  pmH += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">';
  pmH += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); font-weight:bold;">BEARISH</span>';
  pmH += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc;">ASTRO BIAS</span>';
  pmH += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold;">BULLISH</span>';
  pmH += '</div>';
  pmH += '<div style="position:relative; height:10px; background:#0d0d0d; border-radius:5px; border:1px solid #1a1a1a;">';
  pmH += '<div style="position:absolute; left:0; top:0; width:50%; height:100%; border-radius:5px 0 0 5px; background:linear-gradient(to right, rgba(255,106,0,0.15), transparent);"></div>';
  pmH += '<div style="position:absolute; right:0; top:0; width:50%; height:100%; border-radius:0 5px 5px 0; background:linear-gradient(to left, rgba(255,255,255,0.1), transparent);"></div>';
  pmH += '<div style="position:absolute; left:50%; top:-2px; width:1px; height:calc(100% + 4px); background:#333;"></div>';
  pmH += '<div style="position:absolute; top:50%; transform:translate(-50%,-50%); left:' + r.score.confidence + '%; width:14px; height:14px; border-radius:50%; background:' + dCol + '; box-shadow:0 0 10px ' + dCol + '44; border:2px solid #000;"></div>';
  pmH += '</div>';
  pmH += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; text-align:center; margin-top:6px;">' + r.score.bullish + ' BULL / ' + r.score.bearish + ' BEAR</div>';
  pmH += '</div>';
  document.getElementById('ae-power-meter').innerHTML = pmH;

  // ==========================================
  // 3. الزوايا
  // ==========================================
  var aH = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; border-right:3px solid var(--o);">';
  aH += '<div style="display:flex; justify-content:space-between; margin-bottom:10px;">';
  aH += '<span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Planetary Aspects</span>';
  aH += '<span style="font-size:0.55rem; color:#ccc;">' + r.aspects.length + ' angles</span>';
  aH += '</div>';
  for (var i = 0; i < r.aspects.length; i++) {
    var a = r.aspects[i];
    var bdr = i < r.aspects.length - 1 ? 'border-bottom:1px solid #111;' : '';
    var sigBg = a.signal === 'bullish' ? '#fff' : 'var(--o)';
    var sigTxt = a.signal === 'bullish' ? 'BULL' : 'BEAR';
    aH += '<div style="display:flex; justify-content:space-between; padding:8px 0; ' + bdr + '">';
    aH += '<div style="display:flex; align-items:center; gap:6px;">';
    aH += '<div style="width:6px; height:6px; border-radius:50%; background:' + a.p1C + ';"></div>';
    aH += '<span style="font-size:0.65rem; color:#fff;">' + a.p1Ar + '</span>';
    aH += '<span style="font-size:0.55rem; color:var(--o);">' + a.type + ' ' + a.angle + '</span>';
    aH += '<div style="width:6px; height:6px; border-radius:50%; background:' + a.p2C + ';"></div>';
    aH += '<span style="font-size:0.65rem; color:#fff;">' + a.p2Ar + '</span>';
    aH += '</div>';
    aH += '<span style="font-size:0.5rem; padding:2px 6px; border-radius:6px; color:#000; background:' + sigBg + '; font-weight:bold;">' + sigTxt + '</span>';
    aH += '</div>';
  }
  aH += '</div>';
  document.getElementById('ae-aspects-panel').innerHTML = aH;

  // ==========================================
  // 4. تراجع عطارد
  // ==========================================
  var me = r.mercury;
  var cM = me.retrograde ? 'var(--o)' : '#A0A0A0';
  var merH = '<div style="background:' + (me.retrograde ? 'rgba(255,106,0,0.06)' : '#0a0a0a') + '; border:1px solid ' + (me.retrograde ? 'rgba(255,106,0,0.2)' : '#1a1a1a') + '; border-radius:10px; padding:14px; border-right:3px solid ' + cM + ';">';
  merH += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">';
  merH += '<span style="font-size:0.7rem; color:#fff; font-weight:bold;">Mercury Retrograde</span>';
  merH += '<span style="font-size:0.5rem; padding:2px 8px; border-radius:6px; font-weight:bold; color:' + (me.retrograde ? '#000' : '#fff') + '; background:' + (me.retrograde ? 'var(--o)' : 'rgba(255,255,255,0.06)') + ';">' + (me.retrograde ? 'ACTIVE' : 'CLEAR') + '</span>';
  merH += '</div>';
  merH += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; text-align:center;">';
  merH += '<div><div style="font-size:0.5rem; color:#ccc;">تراجع قادم</div><div style="font-size:0.65rem; color:var(--o); font-weight:bold;">' + me.nextRetro + '</div></div>';
  merH += '<div><div style="font-size:0.5rem; color:#ccc;">عودة مباشرة</div><div style="font-size:0.65rem; color:#fff; font-weight:bold;">' + me.nextDirect + '</div></div>';
  merH += '<div><div style="font-size:0.5rem; color:#ccc;">أيام</div><div style="font-size:0.65rem; color:#A0A0A0; font-weight:bold;">' + me.daysToRetro + '</div></div>';
  merH += '</div></div>';
  document.getElementById('ae-mercury-panel').innerHTML = merH;

  // ==========================================
  // 5. الأحداث القادمة
  // ==========================================
  var uH = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;">';
  uH += '<div style="display:flex; justify-content:space-between; margin-bottom:12px;">';
  uH += '<span style="font-size:0.7rem; color:#fff; font-weight:bold;">Upcoming Moon Phases</span>';
  uH += '<span style="font-size:0.55rem; color:#ccc;">60 DAYS</span>';
  uH += '</div>';
  for (var ui = 0; ui < r.upcoming.length; ui++) {
    var u = r.upcoming[ui];
    uH += '<div style="display:flex; gap:10px; padding:8px 0; ' + (ui < r.upcoming.length - 1 ? 'border-bottom:1px solid #111;' : '') + '">';
    uH += '<div style="font-size:0.6rem; color:var(--o); font-weight:bold; min-width:55px;">' + u.date + '</div>';
    uH += '<div><div style="font-size:0.65rem; color:#fff; font-weight:600;">' + u.event + '</div><div style="font-size:0.55rem; color:#ccc;">' + u.effect + '</div></div></div>';
  }
  uH += '</div>';
  document.getElementById('ae-upcoming-panel').innerHTML = uH;

  // ==========================================
  // 6. Correlation Engine
  // ==========================================
  var c = r.correlation;
  var crH = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden;">';
  crH += '<div style="display:flex; justify-content:space-between; padding:10px 14px; background:#0a0a0a; border-bottom:1px solid #111;">';
  crH += '<span style="font-size:0.7rem; color:#fff; font-weight:bold;">Correlation Engine</span>';
  crH += '<span style="font-size:0.55rem; color:#ccc;">1000 DAYS BTC</span>';
  crH += '</div>';
  
  crH += '<div style="padding:12px 14px; border-bottom:1px solid #111;">';
  crH += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">';
  crH += '<span style="font-size:0.65rem; color:#fff; font-weight:bold;">Mercury Retrograde (' + c.mercury.p + 'x)</span>';
  crH += '<span style="font-size:0.55rem; color:var(--o);">' + c.mercury.v + ' تقلب</span>';
  crH += '</div>';
  crH += '<div style="display:flex; height:5px; border-radius:3px; overflow:hidden; margin-bottom:4px;">';
  crH += '<div style="width:' + c.mercury.b + '%; background:#fff;"></div>';
  crH += '<div style="width:' + (100 - c.mercury.b) + '%; background:var(--o);"></div>';
  crH += '</div>';
  crH += '<div style="text-align:center; font-size:0.5rem; color:#ccc;">' + c.mercury.b + '% صعود / متوسط العائد: ' + c.mercury.r + '</div>';
  crH += '</div>';
  
  crH += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:12px 14px;">';
  crH += '<div style="background:#0a0a0a; border-radius:8px; padding:10px; border-top:2px solid var(--o);">';
  crH += '<div style="font-size:0.6rem; color:#ccc; font-weight:bold; margin-bottom:6px;">Full Moon (' + c.fullM.c + ')</div>';
  crH += '<div style="display:flex; height:4px; border-radius:2px; overflow:hidden; margin-bottom:4px;">';
  crH += '<div style="width:' + c.fullM.b + '%; background:#fff;"></div>';
  crH += '<div style="width:' + (100 - c.fullM.b) + '%; background:var(--o);"></div>';
  crH += '</div>';
  crH += '<div style="font-size:0.5rem; color:#ccc; text-align:center;">عائد ' + c.fullM.r + '</div>';
  crH += '</div>';
  
  crH += '<div style="background:#0a0a0a; border-radius:8px; padding:10px; border-top:2px solid #fff;">';
  crH += '<div style="font-size:0.6rem; color:#ccc; font-weight:bold; margin-bottom:6px;">New Moon (' + c.newM.c + ')</div>';
  crH += '<div style="display:flex; height:4px; border-radius:2px; overflow:hidden; margin-bottom:4px;">';
  crH += '<div style="width:' + c.newM.b + '%; background:#fff;"></div>';
  crH += '<div style="width:' + (100 - c.newM.b) + '%; background:var(--o);"></div>';
  crH += '</div>';
  crH += '<div style="font-size:0.5rem; color:#ccc; text-align:center;">عائد ' + c.newM.r + '</div>';
  crH += '</div>';
  crH += '</div></div>';
  document.getElementById('ae-correlation-panel').innerHTML = crH;

  // ==========================================
  // 7. الخلاصة
  // ==========================================
  var verdictTxt = 'المحرك استخرج ' + r.aspects.length + ' زوايا فلكية تعتمد على الإحداثيات الشمسية العلمية. عطارد ';
  verdictTxt += (r.mercury.retrograde ? 'في مرحلة تراجع ظاهري (يجب الحذر من التقلبات)' : 'في تقدم مباشر') + '. ';
  verdictTxt += 'محرك الارتباط (1000 شمعة) يؤكد أن الاتجاه العام هو ';
  verdictTxt += (r.score.direction === 'bullish' ? 'داعم للثيران' : r.score.direction === 'bearish' ? 'ضاغط للدببة' : 'محايد') + ' بنسبة ثقة ' + r.score.confidence + '%.';
  
  document.getElementById('ae-conclusion').textContent = verdictTxt;
}

// ==========================================
// Astro Pro — التحليل الفلكي المتقدم (Gann Lines + Cycles)
// ==========================================

async function loadAstroPro() {
  var loading = document.getElementById('ap-loading');
  var dashboard = document.getElementById('ap-dashboard');
  loading.style.display = 'block'; dashboard.style.display = 'none';

  try {
    var res = await fetch('/api/astro-btc');
    if (!res.ok) throw new Error('فشل جلب الأسعار');
    var raw = await res.json();
    var price = parseFloat(raw[raw.length - 1][4]); // إغلاق آخر شمعة
    var now = new Date();
    
    // الحسابات
    var planets = calcGeocentricPositions(now); // نستخدم دالة Astro Engine السابقة
    var priceLines = calcPlanetaryPriceLines(planets, price);
    var cycles = calcPlanetaryCycles(planets);
    
    // التصويت والقرار
    var bullish = 0, bearish = 0, neutral = 0;
    var aboveCount = priceLines.lines.filter(function(l) { return l.position === 'فوق'; }).length;
    if (aboveCount >= 3) bullish++; else if (aboveCount <= 1) bearish++; else neutral++;
    
    var cycBull = cycles.filter(function(c) { return c.signal === 'bullish'; }).length;
    var cycBear = cycles.filter(function(c) { return c.signal === 'bearish'; }).length;
    if (cycBull > cycBear) bullish++; else if (cycBear > cycBull) bearish++; else neutral++;
    
    var total = bullish + bearish + neutral;
    var direction = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';
    var confidence = total > 0 ? Math.round(Math.max(bullish, bearish) / total * 100) : 50;
    
    var result = {
      date: now.getUTCDate() + ' ' + ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][now.getUTCMonth()] + ' ' + now.getUTCFullYear(),
      priceLines: priceLines,
      cycles: cycles,
      score: { bullish: bullish, bearish: bearish, neutral: neutral, direction: direction, confidence: confidence }
    };
    
    renderAstroPro(price, result);
    loading.style.display = 'none'; dashboard.style.display = 'block';
  } catch (e) {
    loading.innerHTML = '<div style="color:var(--o);">تعذر تحميل البيانات الفلكية المتقدمة.</div>';
  }
}

// حساب خطوط الكواكب السعرية (Gann Modulo)
function calcPlanetaryPriceLines(planets, currentPrice) {
  var sf = currentPrice / 360; // معامل التحويل الافتراضي
  var tradingPlanets = planets.filter(function(p) { return p.name !== 'Earth' && p.name !== 'Moon' && p.name !== 'Sun'; });
  var lines = [];
  
  tradingPlanets.forEach(function(p) {
    var bestPrice = p.degree * sf;
    var bestDiff = Math.abs(bestPrice - currentPrice);
    var limit = Math.ceil(currentPrice / (360 * sf)) + 2;
    
    for (var mult = 0; mult <= limit; mult++) {
      var candidate = (p.degree + mult * 360) * sf;
      var diff = Math.abs(candidate - currentPrice);
      if (diff < bestDiff) { bestDiff = diff; bestPrice = candidate; }
    }
    
    var distance = ((bestPrice - currentPrice) / currentPrice * 100).toFixed(2);
    lines.push({ planet: p.nameAr, color: p.color, degree: p.degree, price: Math.round(bestPrice), distance: (parseFloat(distance) >= 0 ? '+' : '') + distance + '%', position: bestPrice > currentPrice ? 'فوق' : 'تحت' });
  });
  
  lines.sort(function(a, b) { return Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice); });
  var nearestRes = null, nearestSup = null;
  lines.forEach(function(l) {
    if (l.position === 'فوق' && !nearestRes) nearestRes = l;
    if (l.position === 'تحت' && !nearestSup) nearestSup = l;
  });
  
  return { lines: lines, nearestResistance: nearestRes, nearestSupport: nearestSup };
}

// حساب دورات الكواكب بالدرجات (0 إلى 360)
function calcPlanetaryCycles(planets) {
  var results = [];
  var periods = { 'عطارد': '88 يوم', 'الزهرة': '225 يوم', 'المريخ': '687 يوم', 'المشتري': '11.86 سنة', 'زحل': '29.46 سنة' };
  
  planets.forEach(function(p) {
    if (p.name === 'Earth' || p.name === 'Moon' || p.name === 'Sun') return;
    
    var progressPct = Math.round((p.degree / 360) * 100);
    var phase = '', effect = '', signal = 'neutral';
    
    if (progressPct < 15) { phase = 'بداية الدورة'; effect = 'تأسيس الدورة'; signal = 'neutral'; }
    else if (progressPct < 35) { phase = 'ربع أول'; effect = 'بناء زخم'; signal = 'bullish'; }
    else if (progressPct < 50) { phase = 'منتصف الدورة'; effect = 'ذروة النشاط'; signal = 'bullish'; }
    else if (progressPct < 65) { phase = 'ما بعد المنتصف'; effect = 'استقرار'; signal = 'neutral'; }
    else if (progressPct < 80) { phase = 'نهاية الدورة'; effect = 'تسارع زخم'; signal = 'bullish'; }
    else { phase = 'تراجع الدورة'; effect = 'تصحيح سعري'; signal = 'bearish'; }
    
    results.push({ planet: p.nameAr, color: p.color, period: periods[p.nameAr] || '--', progress: progressPct, phase: phase, effect: effect, signal: signal });
  });
  return results;
}

// دالة العرض في الواجهة
function renderAstroPro(price, r) {
  var dCol = r.score.direction === 'bullish' ? '#fff' : r.score.direction === 'bearish' ? 'var(--o)' : '#888';
  document.getElementById('ap-date').textContent = r.date + ' | BTCUSDT $' + price.toLocaleString();

  // 1. Power Meter
  var pmHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;"><div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:var(--o); font-weight:bold;">BEARISH</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc; letter-spacing:1px;">ASTRO PRO BIAS</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#fff; font-weight:bold;">BULLISH</span></div><div style="position:relative; height:10px; background:#0d0d0d; border-radius:5px; border:1px solid #1a1a1a;"><div style="position:absolute; left:0; top:0; width:50%; height:100%; border-radius:5px 0 0 5px; background:linear-gradient(to right, rgba(255,106,0,0.15), transparent);"></div><div style="position:absolute; right:0; top:0; width:50%; height:100%; border-radius:0 5px 5px 0; background:linear-gradient(to left, rgba(255,255,255,0.1), transparent);"></div><div style="position:absolute; left:50%; top:-2px; width:1px; height:calc(100% + 4px); background:#333;"></div><div style="position:absolute; top:50%; transform:translate(-50%,-50%); left:' + r.score.confidence + '%; width:14px; height:14px; border-radius:50%; background:' + dCol + '; box-shadow:0 0 10px ' + dCol + '44; border:2px solid #000;"></div></div><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:#ccc; text-align:center; margin-top:6px;">' + r.score.bullish + ' BULL / ' + r.score.neutral + ' WAIT / ' + r.score.bearish + ' BEAR — ' + r.score.confidence + '%</div></div>';
  document.getElementById('ap-power-meter').innerHTML = pmHtml;

  // 2. خطوط الكواكب
  var plHtml = '<div style="background:#060606; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden;"><div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#0a0a0a; border-bottom:1px solid #111;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Planetary Price Lines</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">SECTION 1</span></div>';
  plHtml += '<div style="display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid #111;">';
  // مقاومة
  plHtml += '<div style="padding:12px 14px; border-left:1px solid #111; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc; letter-spacing:1px; margin-bottom:4px;">NEAREST RESISTANCE</div>';
  if (r.priceLines.nearestResistance) {
    var nr = r.priceLines.nearestResistance;
    plHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:#fff; font-weight:bold;">$' + nr.price.toLocaleString() + '</div><div style="display:flex; justify-content:center; align-items:center; gap:4px; margin-top:4px;"><div style="width:6px; height:6px; border-radius:50%; background:' + nr.color + ';"></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + nr.color + ';">' + nr.planet + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#fff;">' + nr.distance + '</span></div>';
  } else { plHtml += '<div style="color:#888; font-size:0.7rem;">--</div>'; }
  plHtml += '</div>';
  // دعم
  plHtml += '<div style="padding:12px 14px; text-align:center;"><div style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc; letter-spacing:1px; margin-bottom:4px;">NEAREST SUPPORT</div>';
  if (r.priceLines.nearestSupport) {
    var ns = r.priceLines.nearestSupport;
    plHtml += '<div style="font-family:\'Share Tech Mono\',monospace; font-size:1rem; color:var(--o); font-weight:bold;">$' + ns.price.toLocaleString() + '</div><div style="display:flex; justify-content:center; align-items:center; gap:4px; margin-top:4px;"><div style="width:6px; height:6px; border-radius:50%; background:' + ns.color + ';"></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.6rem; color:' + ns.color + ';">' + ns.planet + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:var(--o);">' + ns.distance + '</span></div>';
  } else { plHtml += '<div style="color:#888; font-size:0.7rem;">--</div>'; }
  plHtml += '</div></div><div style="padding:10px 14px;">';
  
  r.priceLines.lines.forEach(function(line, i) {
    var isAbove = line.position === 'فوق';
    var pc = isAbove ? '#fff' : 'var(--o)';
    plHtml += '<div style="display:flex; align-items:center; gap:8px; padding:7px 0; border-bottom:' + (i < r.priceLines.lines.length - 1 ? '1px solid #0d0d0d' : 'none') + ';"><div style="width:6px; height:6px; border-radius:50%; background:' + line.color + '; flex-shrink:0;"></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:' + line.color + '; font-weight:bold; min-width:50px;">' + line.planet + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc; min-width:30px;">' + line.degree + '°</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:' + pc + '; font-weight:bold; flex:1; text-align:left; direction:ltr;">$' + line.price.toLocaleString() + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:' + pc + ';">' + line.distance + '</span></div>';
  });
  plHtml += '</div></div>';
  document.getElementById('ap-pricelines').innerHTML = plHtml;

  // 3. دورات الكواكب
  var cyHtml = '<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:#fff; font-weight:bold;">Planetary Cycles</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.55rem; color:#ccc;">SECTION 2</span></div>';
  r.cycles.forEach(function(cyc, i) {
    var sc = cyc.signal === 'bullish' ? '#fff' : cyc.signal === 'bearish' ? 'var(--o)' : '#888';
    var tag = cyc.signal === 'bullish' ? 'BULL' : cyc.signal === 'bearish' ? 'BEAR' : 'WAIT';
    cyHtml += '<div style="margin-bottom:' + (i < r.cycles.length - 1 ? '14px' : '0') + ';"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;"><div style="display:flex; align-items:center; gap:6px;"><div style="width:6px; height:6px; border-radius:50%; background:' + cyc.color + ';"></div><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.7rem; color:' + cyc.color + '; font-weight:bold;">' + cyc.planet + '</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.5rem; color:#ccc;">' + cyc.period + '</span></div><div style="display:flex; align-items:center; gap:6px;"><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.65rem; color:#fff; font-weight:bold;">' + cyc.progress + '%</span><span style="font-family:\'Share Tech Mono\',monospace; font-size:0.45rem; font-weight:700; padding:2px 5px; border-radius:6px; color:' + (cyc.signal === 'neutral' ? '#888' : '#000') + '; background:' + sc + ';">' + tag + '</span></div></div><div style="position:relative; height:6px; background:#111; border-radius:3px; margin-bottom:4px;"><div style="height:100%; border-radius:3px; background:' + cyc.color + '; width:' + cyc.progress + '%; opacity:0.7;"></div><div style="position:absolute; left:50%; top:-1px; width:1px; height:8px; background:#333;"></div></div><div style="display:flex; justify-content:space-between;"><span style="font-size:0.5rem; color:#ccc;">' + cyc.phase + '</span><span style="font-size:0.5rem; color:' + sc + ';">' + cyc.effect + '</span></div></div>';
  });
  cyHtml += '</div>';
  document.getElementById('ap-cycles').innerHTML = cyHtml;

  // 4. الخلاصة
  var conc = 'خطوط الكواكب: ';
  if (r.priceLines.nearestResistance) conc += 'أقرب مقاومة كوكبية (' + r.priceLines.nearestResistance.planet + ') عند $' + r.priceLines.nearestResistance.price.toLocaleString() + '. ';
  if (r.priceLines.nearestSupport) conc += 'أقرب دعم كوكبي (' + r.priceLines.nearestSupport.planet + ') عند $' + r.priceLines.nearestSupport.price.toLocaleString() + '. ';
  var bullCycles = r.cycles.filter(function(c) { return c.signal === 'bullish'; });
  if (bullCycles.length > 0) conc += 'الدورات: ' + bullCycles.length + ' كواكب في مراحل صعودية داعمة. ';
  conc += 'هذا تحليل فني متقدم ولا يُعتبر توصية شراء أو بيع.';
  document.getElementById('ap-conclusion').textContent = conc;
}

// ============================================================
// 🚀 محرك TRIPLE ANALYSIS SUITE (VP + S/R + Trends)
// ============================================================

async function runTripleSuite() {
  const coinInput = document.getElementById('trip-sym').value.trim().toUpperCase();
  const tf = document.getElementById('trip-tf').value;
  const btn = document.getElementById('trip-btn');
  const loading = document.getElementById('trip-loading');
  const dash = document.getElementById('trip-dashboard');

  if (!coinInput) return;
  const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';

  btn.innerText = 'ANALYZING...';
  btn.disabled = true;
  loading.style.display = 'block';
  dash.style.display = 'none';

  try {
    // 1. طلب واحد للبيانات لحفظ الموارد ومنع الحظر (عبر سيرفر الكاش الخاص بك)
    const limit = tf === '1h' ? 500 : tf === '4h' ? 300 : 250;
    const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=${limit}`);
    if (!res.ok) throw new Error('تعذر جلب البيانات. تأكد من صحة الرمز.');
    
    const raw = await res.json();
    if (raw.length < 50) throw new Error('بيانات غير كافية للتحليل.');

    const candles = raw.map(k => ({
      o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5])
    }));
    
    const highs = candles.map(c => c.h);
    const lows = candles.map(c => c.l);
    const closes = candles.map(c => c.c);
    const volumes = candles.map(c => c.v);
    const currentPrice = closes[closes.length - 1];
    
    // استخدام دالة الفورمات الذكية لحل مشكلة العملات الصفرية
    const fmt = typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice : (p => '$'+p.toFixed(2));

    // 2. تحديث التيكر
    document.getElementById('trip-ticker').innerHTML = `
      <div style="background:#060606; border:1px solid #111; border-radius:4px; padding:8px 12px; display:flex; justify-content:space-between; align-items:baseline;">
        <div style="display:flex; align-items:baseline; gap:10px;">
          <span style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.65rem; font-weight:bold;">${symbol.replace('USDT','')}</span>
          <span style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:1.6rem; font-weight:bold; letter-spacing:1px; direction:ltr;">${fmt(currentPrice)}</span>
        </div>
        <span style="color:#888; font-family:'Share Tech Mono',monospace; font-size:0.6rem;">${tf.toUpperCase()}</span>
      </div>`;

    // 3. تحليل ورسم الأقسام الثلاثة بالتوازي (Zero Delay)
    renderTripVP(currentPrice, highs, lows, volumes, fmt);
    
    // للرسم نستخدم آخر 60 شمعة فقط ليكون الشارت واضحاً للمتداول
    const chartCandles = closes.slice(-60); 
    renderTripSR(currentPrice, highs, lows, closes, chartCandles, fmt);
    renderTripTL(currentPrice, highs, lows, closes, chartCandles, fmt);

    loading.style.display = 'none';
    dash.style.display = 'block';

  } catch (e) {
    loading.innerHTML = `<div style="color:var(--o); font-family:'Cairo', sans-serif;">${e.message}</div>`;
  } finally {
    btn.innerText = 'ANALYZE ALL';
    btn.disabled = false;
  }
}

// ---------------------------------------------------------
// Engine 1: Volume Profile (دقيق ومتطابق مع TradingView)
// ---------------------------------------------------------
function renderTripVP(price, highs, lows, volumes, fmt) {
  const maxP = Math.max(...highs), minP = Math.min(...lows);
  const numBins = 30, binSize = (maxP - minP) / numBins;
  if (binSize <= 0) return;

  let bins = Array.from({length: numBins}, (_, i) => ({ low: minP + i*binSize, high: minP + (i+1)*binSize, vol: 0 }));

  for (let i = 0; i < highs.length; i++) {
    const range = highs[i] - lows[i] || binSize * 0.1;
    for (let j = 0; j < numBins; j++) {
      const overlap = Math.max(0, Math.min(highs[i], bins[j].high) - Math.max(lows[i], bins[j].low));
      if (overlap > 0) bins[j].vol += volumes[i] * (overlap / range);
    }
  }

  const maxVol = Math.max(...bins.map(b => b.vol));
  bins.forEach(b => b.pct = maxVol > 0 ? Math.round((b.vol / maxVol) * 100) : 0);

  let pocIdx = 0;
  bins.forEach((b, i) => { if (b.vol > bins[pocIdx].vol) pocIdx = i; });
  const pocPrice = (bins[pocIdx].low + bins[pocIdx].high) / 2;

  const totalVol = bins.reduce((a, b) => a + b.vol, 0);
  const targetVA = totalVol * 0.70; // 70% Value Area
  let vaVol = bins[pocIdx].vol, vaLow = pocIdx, vaHigh = pocIdx;

  while (vaVol < targetVA && (vaLow > 0 || vaHigh < numBins - 1)) {
    const addL = vaLow > 0 ? bins[vaLow - 1].vol : 0;
    const addH = vaHigh < numBins - 1 ? bins[vaHigh + 1].vol : 0;
    if (addL >= addH && vaLow > 0) { vaLow--; vaVol += bins[vaLow].vol; }
    else if (vaHigh < numBins - 1) { vaHigh++; vaVol += bins[vaHigh].vol; }
    else break;
  }

  const vahPrice = bins[vaHigh].high;
  const valPrice = bins[vaLow].low;

  const svgW = 340, chartH = 220;
  const vpToY = p => 10 + (1 - (p - minP) / (maxP - minP)) * (chartH - 20);

  let svgHtml = `<svg width="100%" height="${chartH}" viewBox="0 0 ${svgW} ${chartH}" style="direction:ltr;">`;
  svgHtml += `<rect x="0" y="${vpToY(vahPrice)}" width="${svgW}" height="${Math.abs(vpToY(valPrice) - vpToY(vahPrice))}" fill="#ffffff" fill-opacity="0.03" />`;

  bins.forEach(bar => {
    const y = vpToY(bar.high), h = Math.max(Math.abs(vpToY(bar.low) - vpToY(bar.high)), 2);
    const w = (bar.pct / 100) * (svgW * 0.55);
    const isPOC = bar.pct === 100;
    const isVA = bar.low >= valPrice && bar.high <= vahPrice;
    const color = isPOC ? "var(--o)" : isVA ? "#fff" : bar.pct < 30 ? "#333" : "#888";
    const op = isPOC ? 0.8 : isVA ? 0.4 : bar.pct < 30 ? 0.15 : 0.25;

    svgHtml += `<rect x="8" y="${y}" width="${w}" height="${Math.max(h-0.5, 1)}" rx="1" fill="${color}" opacity="${op}" />`;
    if (isPOC) svgHtml += `<rect x="8" y="${y}" width="${w}" height="${Math.max(h-0.5, 1)}" rx="1" fill="none" stroke="var(--o)" stroke-width="1.5" />`;
    if (bar.pct > 60) svgHtml += `<text x="${w + 14}" y="${y + h/2 + 2}" fill="#888" font-size="4.5" font-family="Share Tech Mono">${bar.pct}%</text>`;
  });

  const pocY = vpToY(pocPrice);
  svgHtml += `<line x1="0" y1="${pocY}" x2="${svgW}" y2="${pocY}" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.8" />
    <rect x="0" y="${pocY - 12}" width="28" height="11" rx="2" fill="var(--o)" />
    <text x="14" y="${pocY - 3.5}" text-anchor="middle" fill="#000" font-size="6" font-weight="bold" font-family="Share Tech Mono">POC</text>
    <text x="${svgW - 5}" y="${pocY + 4}" text-anchor="end" fill="var(--o)" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">${fmt(pocPrice)}</text>
    
    <line x1="0" y1="${vpToY(vahPrice)}" x2="${svgW}" y2="${vpToY(vahPrice)}" stroke="#fff" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.3" />
    <text x="2" y="${vpToY(vahPrice) - 3}" fill="#ccc" font-size="5" font-weight="bold" font-family="Share Tech Mono">VAH ${fmt(vahPrice)}</text>
    
    <line x1="0" y1="${vpToY(valPrice)}" x2="${svgW}" y2="${vpToY(valPrice)}" stroke="#fff" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.3" />
    <text x="2" y="${vpToY(valPrice) + 10}" fill="#ccc" font-size="5" font-weight="bold" font-family="Share Tech Mono">VAL ${fmt(valPrice)}</text>

    <line x1="0" y1="${vpToY(price)}" x2="${svgW}" y2="${vpToY(price)}" stroke="var(--o)" stroke-width="0.5" opacity="0.6" />
    <circle cx="${svgW - 30}" cy="${vpToY(price)}" r="3" fill="var(--o)" />
  </svg>`;

  let html = `
    <div class="trip-anim" style="animation-delay:0.15s; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:6px 12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="width:3px; height:14px; background:var(--o); border-radius:2px;"></div>
        <span style="color:var(--o); font-size:0.7rem; font-weight:bold; font-family:'Share Tech Mono',monospace;">1. VOLUME PROFILE</span>
      </div>
      <span style="color:#888; font-size:0.45rem; font-family:'Share Tech Mono',monospace;">POC ${fmt(pocPrice)}</span>
    </div>

    <div class="trip-anim" style="animation-delay:0.2s; background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px;">
      <div style="padding:4px 2px; background:#020208;">${svgHtml}</div>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid #111;">
        ${[{l:"POC",v:fmt(pocPrice),c:"var(--o)"},{l:"VAH",v:fmt(vahPrice),c:"#fff"},{l:"VAL",v:fmt(valPrice),c:"#fff"},{l:"VA",v:"70%",c:"#ccc"}].map((it,i)=>`
          <div style="padding:5px 2px; text-align:center; border-left:${i>0?'1px solid #111':'none'};">
            <div style="font-size:0.35rem; color:#888; font-family:'Share Tech Mono',monospace;">${it.l}</div>
            <div style="font-size:0.55rem; color:${it.c}; font-weight:bold; font-family:'Share Tech Mono',monospace; direction:ltr;">${it.v.replace('$','')}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="trip-anim" style="animation-delay:0.25s; background:#080808; border:1px solid #1a1a1a; border-right:3px solid var(--o); border-radius:4px; padding:12px; margin-bottom:14px;">
      <div style="color:var(--o); font-size:0.5rem; font-weight:bold; letter-spacing:2px; margin-bottom:6px; font-family:'Share Tech Mono',monospace;">VP VERDICT</div>
      <div style="font-size:0.7rem; line-height:1.8; color:#ccc; font-family:'Cairo',sans-serif;">
        تتمركز السيولة (POC) عند ${fmt(pocPrice)}. منطقة القيمة (70% من الحجم) تمتد من ${fmt(valPrice)} إلى ${fmt(vahPrice)}. 
        السعر حالياً ${price > pocPrice ? 'أعلى الـ POC، مما يدل على سيطرة شرائية وزخم إيجابي.' : 'أسفل الـ POC، مما يدل على ضغط بيعي.'}
      </div>
    </div>
  `;
  document.getElementById('trip-vp-sec').innerHTML = html;
}

// ---------------------------------------------------------
// Engine 2: Support & Resistance (Clustering)
// ---------------------------------------------------------
function renderTripSR(price, highs, lows, closes, chartCandles, fmt) {
  const n = closes.length;
  const peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, n) : [];
  const troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, n) : [];
  
  let rawLevels = [...peakIdxs.map(i => ({ p: highs[i], t: 'resistance' })), ...troughIdxs.map(i => ({ p: lows[i], t: 'support' }))];
  rawLevels.sort((a, b) => b.p - a.p);

  let clusters = [];
  const tolerance = price * 0.015; // 1.5%

  rawLevels.forEach(lvl => {
    let found = false;
    for (let c of clusters) {
      if (Math.abs(c.price - lvl.p) < tolerance && c.type === lvl.t) {
        c.touches++;
        c.type = lvl.t === 'resistance' ? 'resistance' : c.type; 
        found = true;
        break;
      }
    }
    if (!found) clusters.push({ price: lvl.p, type: lvl.t, touches: 1 });
  });

  // تصفية الارتكازات الموثوقة
  clusters = clusters.filter(c => c.touches > 1); 
  clusters.forEach(c => {
    c.strength = c.touches >= 4 ? 'STRONG' : c.touches >= 2 ? 'MEDIUM' : 'WEAK';
  });

  let resLevels = clusters.filter(c => c.price > price).sort((a,b) => a.price - b.price).slice(0,3);
  let supLevels = clusters.filter(c => c.price < price).sort((a,b) => b.price - a.price).slice(0,3);
  
  resLevels.reverse().forEach((l, i) => l.label = `R${3-i}`);
  supLevels.forEach((l, i) => l.label = `S${i+1}`);
  
  const srLevels = [...resLevels, ...supLevels];
  if(srLevels.length === 0) { document.getElementById('trip-sr-sec').innerHTML = ''; return; }

  const chartN = chartCandles.length;
  const allP = [...chartCandles, ...srLevels.map(l => l.price)];
  const minP = Math.min(...allP) * 0.997, maxP = Math.max(...allP) * 1.003, range = maxP - minP || 1;
  const svgW = 340, chartH = 180;
  const srToX = i => 15 + (i / (chartN - 1)) * (svgW - 30);
  const srToY = p => 10 + (1 - (p - minP) / range) * (chartH - 20);

  let svgHtml = `<svg width="100%" height="${chartH}" viewBox="0 0 ${svgW} ${chartH}" style="direction:ltr;">
    <polyline points="${chartCandles.map((p,i) => `${srToX(i)},${srToY(p)}`).join(' ')}" fill="none" stroke="#555" stroke-width="1.5" stroke-linejoin="round" />`;

  srLevels.forEach(lv => {
    const y = srToY(lv.price), isRes = lv.type === "resistance", color = isRes ? "var(--o)" : "#fff";
    const thick = lv.strength === "STRONG" ? 1.5 : lv.strength === "MEDIUM" ? 1 : 0.6;
    const op = lv.strength === "STRONG" ? 0.6 : lv.strength === "MEDIUM" ? 0.4 : 0.2;
    
    svgHtml += `
      <line x1="5" y1="${y}" x2="${svgW-5}" y2="${y}" stroke="${color}" stroke-width="${thick}" opacity="${op}" />
      <rect x="5" y="${y - (isRes?8:0)}" width="${svgW-10}" height="8" fill="${color}" fill-opacity="${op*0.08}" />
      <rect x="5" y="${y - (isRes?16:4)}" width="18" height="10" rx="2" fill="${color}" fill-opacity="0.2" />
      <text x="14" y="${y - (isRes?8:-2)}" text-anchor="middle" fill="${color}" font-size="6" font-weight="bold" font-family="Share Tech Mono">${lv.label}</text>
      <text x="${svgW-8}" y="${y - (isRes?3:-7)}" text-anchor="end" fill="${color}" font-size="5.5" opacity="0.8" font-family="Share Tech Mono">${fmt(lv.price).replace('$','')}</text>
    `;
    for (let di = 0; di < Math.min(lv.touches, 8); di++) {
      svgHtml += `<circle cx="${30 + di*8}" cy="${y}" r="2" fill="${color}" opacity="${op*0.8}" />`;
    }
  });

  svgHtml += `<circle cx="${srToX(chartN-1)}" cy="${srToY(price)}" r="3.5" fill="var(--o)" /></svg>`;

  let html = `
    <div class="trip-anim" style="animation-delay:0.3s; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:6px 12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="width:3px; height:14px; background:#fff; border-radius:2px;"></div>
        <span style="color:#fff; font-size:0.7rem; font-weight:bold; font-family:'Share Tech Mono',monospace;">2. SUPPORT & RESISTANCE</span>
      </div>
      <span style="color:#888; font-size:0.45rem; font-family:'Share Tech Mono',monospace;">${srLevels.length} LEVELS</span>
    </div>

    <div class="trip-anim" style="animation-delay:0.35s; background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px;">
      <div style="padding:4px 2px; background:#020208;">${svgHtml}</div>
      <table style="width:100%; border-collapse:collapse; font-size:0.55rem; font-family:'Share Tech Mono',monospace; border-top:1px solid #111;">
        <thead><tr style="border-bottom:1px solid #1a1a1a;">
          ${["LEVEL","PRICE","TOUCHES","STRENGTH"].map(h => `<th style="padding:5px 4px; color:#888; text-align:center; font-weight:normal;">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${srLevels.map(lv => {
            const isRes = lv.type === 'resistance', color = isRes ? 'var(--o)' : '#fff';
            return `<tr style="border-bottom:1px solid #0d0d0d;">
              <td style="padding:4px; color:${color}; font-weight:bold; text-align:center;">${lv.label}</td>
              <td style="padding:4px; color:#fff; text-align:center; font-weight:bold; direction:ltr;">${fmt(lv.price)}</td>
              <td style="padding:4px; color:#ccc; text-align:center;">${lv.touches}</td>
              <td style="padding:4px; text-align:center;"><span style="font-size:0.45rem; font-weight:900; padding:1px 4px; border-radius:2px; color:#000; background:${lv.strength==='STRONG'?color:lv.strength==='MEDIUM'?'#888':'#333'};">${lv.strength}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="trip-anim" style="animation-delay:0.4s; background:#080808; border:1px solid #1a1a1a; border-right:3px solid #fff; border-radius:4px; padding:12px; margin-bottom:14px;">
      <div style="color:var(--o); font-size:0.5rem; font-weight:bold; letter-spacing:2px; margin-bottom:6px; font-family:'Share Tech Mono',monospace;">S/R VERDICT</div>
      <div style="font-size:0.7rem; line-height:1.8; color:#ccc; font-family:'Cairo',sans-serif;">
        اكتشف المحرك ${srLevels.length} مستويات ارتكاز. 
        ${resLevels.length ? `أقرب مقاومة تواجه السعر هي ${fmt(resLevels[resLevels.length-1].price)} (${resLevels[resLevels.length-1].strength}). ` : ''}
        ${supLevels.length ? `وأقرب دعم يحمي السعر هو ${fmt(supLevels[0].price)} (${supLevels[0].strength}).` : ''}
      </div>
    </div>
  `;
  document.getElementById('trip-sr-sec').innerHTML = html;
}

// ---------------------------------------------------------
// Engine 3: Dynamic Trendlines
// ---------------------------------------------------------
function renderTripTL(price, highs, lows, closes, chartCandles, fmt) {
  const n = closes.length;
  // أخذ آخر 120 شمعة لحساب تريند واقعي وحديث
  const lookback = Math.min(n, 120);
  const startIdx = n - lookback;
  
  const pks = typeof findPeaks === 'function' ? findPeaks(highs, startIdx, n) : [];
  const trs = typeof findTroughs === 'function' ? findTroughs(lows, startIdx, n) : [];

  let lines = [];

  // 1. خط المقاومة الهابط
  if (pks.length >= 2) {
    let bestRes = null;
    for (let i=0; i<pks.length-1; i++) {
      for (let j=i+1; j<pks.length; j++) {
        let slope = (highs[pks[j]] - highs[pks[i]]) / (pks[j] - pks[i]);
        if (slope >= 0) continue; 
        
        let intercept = highs[pks[i]] - slope * pks[i];
        let valid = true, touches = 0;
        for (let k=startIdx; k<n; k++) {
          let lineY = slope * k + intercept;
          if (highs[k] > lineY + (highs[k]*0.005)) { valid = false; break; }
          if (Math.abs(highs[k] - lineY) / lineY <= 0.005) touches++;
        }
        if (valid && (!bestRes || touches > bestRes.touches)) {
          bestRes = { type: 'resistance', startIdx: pks[i], startPrice: highs[pks[i]], endIdx: pks[j], endPrice: highs[pks[j]], slope, touches };
        }
      }
    }
    if (bestRes) lines.push(bestRes);
  }

  // 2. خط الدعم الصاعد
  if (trs.length >= 2) {
    let bestSup = null;
    for (let i=0; i<trs.length-1; i++) {
      for (let j=i+1; j<trs.length; j++) {
        let slope = (lows[trs[j]] - lows[trs[i]]) / (trs[j] - trs[i]);
        if (slope <= 0) continue; 
        
        let intercept = lows[trs[i]] - slope * trs[i];
        let valid = true, touches = 0;
        for (let k=startIdx; k<n; k++) {
          let lineY = slope * k + intercept;
          if (lows[k] < lineY - (lows[k]*0.005)) { valid = false; break; }
          if (Math.abs(lows[k] - lineY) / lineY <= 0.005) touches++;
        }
        if (valid && (!bestSup || touches > bestSup.touches)) {
          bestSup = { type: 'support', startIdx: trs[i], startPrice: lows[trs[i]], endIdx: trs[j], endPrice: lows[trs[j]], slope, touches };
        }
      }
    }
    if (bestSup) lines.push(bestSup);
  }

  lines.forEach(l => {
    l.strength = l.touches >= 4 ? 'STRONG' : 'MEDIUM';
    const ext = l.startPrice + l.slope * (n - 1 - l.startIdx);
    l.status = (l.type === 'resistance' ? price > ext : price < ext) ? 'BROKEN' : 'ACTIVE';
    l.slopeStr = (l.slope > 0 ? '+' : '') + ((l.slope / price) * 100).toFixed(2) + '%/b';
    l.angle = Math.abs(Math.atan(l.slope / (price*0.01)) * 180 / Math.PI).toFixed(0) + '°';
  });

  if (lines.length === 0) { document.getElementById('trip-tl-sec').innerHTML = ''; return; }

  const chartN = chartCandles.length;
  const svgW = 340, chartH = 170;
  const minP = Math.min(...chartCandles)*0.995, maxP = Math.max(...chartCandles)*1.005, range = maxP - minP || 1;
  const toX = i => 15 + ((i) / (chartN - 1)) * (svgW - 30);
  const toY = p => 10 + (1 - (p - minP) / range) * (chartH - 20);

  const viewStartIdx = n - chartN;

  let svgHtml = `<svg width="100%" height="${chartH}" viewBox="0 0 ${svgW} ${chartH}" style="direction:ltr;">
    <defs><filter id="tGl3"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <polyline points="${chartCandles.map((p,i) => `${toX(i)},${toY(p)}`).join(' ')}" fill="none" stroke="#555" stroke-width="1.5" stroke-linejoin="round" />`;

  lines.forEach(tl => {
    const isSup = tl.type === "support", color = isSup ? "#fff" : "var(--o)";
    const localStartIdx = Math.max(0, tl.startIdx - viewStartIdx);
    const x1 = toX(localStartIdx), y1 = toY(tl.startPrice + tl.slope * (localStartIdx - (tl.startIdx - viewStartIdx)));
    
    const extX = svgW - 10;
    const extY = toY(tl.startPrice + tl.slope * ((n - 1) - tl.startIdx));
    
    svgHtml += `
      <line x1="${x1}" y1="${y1}" x2="${extX}" y2="${extY}" stroke="${color}" stroke-width="2" stroke-dasharray="8 4" filter="url(#tGl3)" opacity="0.7" />
      <circle cx="${x1}" cy="${y1}" r="4" fill="${color}" />
      <rect x="${x1+4}" y="${y1+(isSup?4:-16)}" width="48" height="10" rx="2" fill="${color}" fill-opacity="0.15" />
      <text x="${x1+28}" y="${y1+(isSup?11:-8)}" text-anchor="middle" fill="${color}" font-size="5" font-weight="bold" font-family="Share Tech Mono">${isSup?"SUPPORT":"RESIST"}</text>
    `;
  });
  
  svgHtml += `<circle cx="${toX(chartN-1)}" cy="${toY(price)}" r="3.5" fill="var(--o)" /></svg>`;

  let html = `
    <div class="trip-anim" style="animation-delay:0.45s; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:6px 12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="width:3px; height:14px; background:#ccc; border-radius:2px;"></div>
        <span style="color:#ccc; font-size:0.7rem; font-weight:bold; font-family:'Share Tech Mono', monospace;">3. DYNAMIC TRENDLINES</span>
      </div>
      <span style="color:#888; font-size:0.45rem; font-family:'Share Tech Mono', monospace;">${lines.length} LINES</span>
    </div>

    <div class="trip-anim" style="animation-delay:0.5s; background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px;">
      <div style="padding:4px 2px; background:#020208;">${svgHtml}</div>
      <table style="width:100%; border-collapse:collapse; font-size:0.55rem; border-top:1px solid #111; font-family:'Share Tech Mono', monospace;">
        <thead><tr style="border-bottom:1px solid #1a1a1a;">
          ${["TYPE","SLOPE","ANGLE","TOUCHES","STATUS"].map(h => `<th style="padding:5px 4px; color:#888; text-align:center; font-weight:normal;">${h}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${lines.map(tl => {
            const isSup = tl.type === "support", color = isSup ? "#fff" : "var(--o)";
            return `<tr style="border-bottom:1px solid #0d0d0d;">
              <td style="padding:4px; color:${color}; font-weight:bold; text-align:center;">${isSup?"SUPPORT":"RESIST"}</td>
              <td style="padding:4px; color:#fff; text-align:center; direction:ltr;">${tl.slopeStr}</td>
              <td style="padding:4px; color:#ccc; text-align:center; direction:ltr;">${tl.angle}</td>
              <td style="padding:4px; color:#ccc; text-align:center;">${tl.touches}</td>
              <td style="padding:4px; text-align:center; color:${tl.status==="ACTIVE"?"#fff":"#ff4444"}; font-weight:bold;">${tl.status}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="trip-anim" style="animation-delay:0.55s; background:#080808; border:1px solid #1a1a1a; border-right:3px solid #ccc; border-radius:4px; padding:12px; margin-bottom:14px;">
      <div style="color:var(--o); font-size:0.5rem; font-weight:bold; letter-spacing:2px; margin-bottom:6px; font-family:'Share Tech Mono', monospace;">TRENDLINE VERDICT</div>
      <div style="font-size:0.7rem; line-height:1.8; color:#ccc; font-family:'Cairo', sans-serif;">
        تم رسم ${lines.length} خطوط اتجاه ديناميكية. خطوط الاتجاه تعكس مسار السيولة المستقبلي وهي صالحة للاستخدام كدعم ومقاومة مائلة. اختراق المقاومة الهابطة يعكس قوة، وكسر الدعم الصاعد يعكس ضعف.
      </div>
    </div>
  `;
  document.getElementById('trip-tl-sec').innerHTML = html;
}
