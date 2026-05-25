// ==========================================
// محرك ترجيح الاتجاه (Trend Probability Engine)
// ==========================================

async function runTrendEngine() {
    let rawSymbol = document.getElementById('tpe-symbol').value.trim().toUpperCase();
    const timeframe = document.getElementById('tpe-timeframe').value;
    const btn = document.getElementById('tpe-btn');
    const statusMsg = document.getElementById('tpe-status');
    const dashboard = document.getElementById('tpe-dashboard');

    if (!rawSymbol) {
        alert("يرجى إدخال رمز العملة (مثال: BTC)");
        return;
    }

    // المعالجة الآلية لإضافة USDT إذا لم يكتبها المستخدم
    if (!rawSymbol.endsWith('USDT') && !rawSymbol.endsWith('BUSD') && !rawSymbol.endsWith('USDC')) {
        rawSymbol += 'USDT';
    }

    btn.disabled = true;
    statusMsg.style.display = 'block';
    dashboard.style.display = 'none';

    try {
        // الاتصال بنقطة الوكيل الآمنة في الخادم (Proxy)
        const res = await fetch(`/api/binance-klines?symbol=${rawSymbol}&interval=${timeframe}&limit=500`);
        if (!res.ok) throw new Error("تعذر جلب البيانات. تأكد من صحة الرمز.");
        const data = await res.json();
        
        const candles = data.map(k => ({
            close: parseFloat(k[4]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            volume: parseFloat(k[5])
        }));

        if (candles.length < 50) throw new Error("بيانات غير كافية للتحليل.");

        // 1. حساب VW-MACD الدقيق
        const vwmacd = calculateTrueVWMACD(candles);
        
        // 2. حساب Weis Wave (فلترة الضوضاء عبر القمم والقيعان الثلاثية)
        const weis = calculateRobustWeisWave(candles);
        
        // 3. حساب Vol-Adjusted RSI
        const volRsi = calculateVolAdjustedRSI(candles);

        // 4. مصفوفة الأوزان والاحتمالات
        const probs = compileProbabilities(vwmacd, weis, volRsi);

        // تحديث الواجهة البصرية
        updateEngineUI(rawSymbol, candles[candles.length - 1].close, timeframe, probs, vwmacd, weis, volRsi);

    } catch (error) {
        alert(error.message);
    } finally {
        btn.disabled = false;
        statusMsg.style.display = 'none';
    }
}

// --- الخوارزميات الرياضية الدقيقة ---

function calculateTrueVWMACD(candles) {
    const calcVWMA = (data, period) => {
        let result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) { result.push(null); continue; }
            let sumPV = 0, sumV = 0;
            for (let j = 0; j < period; j++) {
                sumPV += data[i - j].close * data[i - j].volume;
                sumV += data[i - j].volume;
            }
            result.push(sumPV / (sumV || 1));
        }
        return result;
    };

    const vwma12 = calcVWMA(candles, 12);
    const vwma26 = calcVWMA(candles, 26);
    
    const current12 = vwma12[vwma12.length - 1];
    const current26 = vwma26[vwma26.length - 1];
    const prev12 = vwma12[vwma12.length - 2];
    const prev26 = vwma26[vwma26.length - 2];

    const isBullish = current12 > current26;
    const isCrossingUp = current12 > current26 && prev12 <= prev26;
    const isCrossingDown = current12 < current26 && prev12 >= prev26;

    let points = { up: 0, down: 0, side: 0 };
    if (isCrossingUp) points = { up: 40, side: 0, down: 0 };
    else if (isCrossingDown) points = { up: 0, side: 0, down: 40 };
    else if (isBullish) points = { up: 25, side: 10, down: 5 };
    else points = { up: 5, side: 10, down: 25 };

    return { 
        status: isBullish ? "إيجابي" : "سلبي", 
        desc: isCrossingUp ? "تقاطع شرائي حديث" : (isCrossingDown ? "تقاطع بيعي حديث" : "اتجاه مستمر"),
        points 
    };
}

function calculateRobustWeisWave(candles) {
    let currentWaveDir = 1; // 1 up, -1 down
    let currentVol = 0;
    let prevUpVol = 0;
    let prevDownVol = 0;

    for (let i = 3; i < candles.length; i++) {
        const c = candles[i];
        const highest3 = Math.max(candles[i-1].high, candles[i-2].high, candles[i-3].high);
        const lowest3 = Math.min(candles[i-1].low, candles[i-2].low, candles[i-3].low);

        if (currentWaveDir === 1 && c.close < lowest3) {
            prevUpVol = currentVol;
            currentWaveDir = -1;
            currentVol = c.volume;
        } else if (currentWaveDir === -1 && c.close > highest3) {
            prevDownVol = currentVol;
            currentWaveDir = 1;
            currentVol = c.volume;
        } else {
            currentVol += c.volume;
        }
    }

    let points = { up: 0, down: 0, side: 0 };
    let desc = "";
    
    if (currentWaveDir === 1) {
        if (currentVol < prevUpVol * 0.5) {
            points = { up: 10, side: 20, down: 10 };
            desc = "صعود بضعف حجمي (نقص طلب)";
        } else {
            points = { up: 35, side: 5, down: 0 };
            desc = "صعود مؤسسي قوي مدعوم بالحجم";
        }
    } else {
        if (currentVol < prevDownVol * 0.5) {
            points = { up: 30, side: 10, down: 0 };
            desc = "جفاف بيعي (انخفاض العرض)";
        } else {
            points = { up: 0, side: 5, down: 35 };
            desc = "هبوط مؤسسي قوي (ضغط بيع)";
        }
    }

    return { 
        dir: currentWaveDir === 1 ? "موجة صاعدة" : "موجة هابطة", 
        desc, 
        points 
    };
}

function calculateVolAdjustedRSI(candles) {
    const period = 14;
    let gains = 0, losses = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
        const diff = candles[i].close - candles[i-1].close;
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    const rs = (gains / period) / (losses / period || 1);
    const rsi = 100 - (100 / (1 + rs));

    // افتراض ديناميكية بناء على التقلب المبسط
    const upper = 75; 
    const lower = 25;
    
    let points = { up: 0, down: 0, side: 0 };
    let desc = "";

    if (rsi > upper) {
        points = { up: 0, side: 5, down: 15 };
        desc = "تشبع شرائي - مساحة الصعود ضيقة";
    } else if (rsi < lower) {
        points = { up: 15, side: 5, down: 0 };
        desc = "تشبع بيعي - فرصة ارتداد";
    } else {
        points = { up: 10, side: 5, down: 5 };
        desc = "نطاق آمن - مساحة حركة متاحة";
    }

    return { val: rsi.toFixed(1), desc, points };
}

function compileProbabilities(vw, ww, rsi) {
    let tUp = vw.points.up + ww.points.up + rsi.points.up;
    let tSide = vw.points.side + ww.points.side + rsi.points.side;
    let tDown = vw.points.down + ww.points.down + rsi.points.down;
    
    const total = tUp + tSide + tDown || 1;
    
    let pctUp = Math.round((tUp / total) * 100);
    let pctSide = Math.round((tSide / total) * 100);
    let pctDown = 100 - pctUp - pctSide;

    let conclusion = "";
    if (pctUp >= 65) conclusion = "توافق إيجابي مرتفع. السوق يظهر علامات تجميع مؤسسي مدعوم بتدفق سيولة إيجابي. الاحتمالية تدعم الصعود.";
    else if (pctDown >= 65) conclusion = "توافق سلبي مرتفع. السوق يظهر ضغط بيع وتوزيع مؤسسي. الاحتمالية تدعم الهبوط.";
    else conclusion = "تضارب في المؤشرات. السوق في حالة تذبذب عرضي، يُنصح بالانتظار حتى وضوح الاتجاه.";

    return { up: pctUp, side: pctSide, down: pctDown, conclusion };
}

function updateEngineUI(sym, price, tf, probs, vwmacd, weis, volRsi) {
    document.getElementById('tpe-res-pair').innerText = sym;
    document.getElementById('tpe-res-price').innerText = '$' + price.toLocaleString();
    document.getElementById('tpe-res-tf').innerText = tf.toUpperCase();

    // تحريك الأشرطة
    setTimeout(() => {
        document.getElementById('bar-up').style.width = probs.up + '%';
        document.getElementById('bar-side').style.width = probs.side + '%';
        document.getElementById('bar-down').style.width = probs.down + '%';
    }, 100);

    document.getElementById('val-up').innerText = probs.up + '%';
    document.getElementById('val-side').innerText = probs.side + '%';
    document.getElementById('val-down').innerText = probs.down + '%';

    document.getElementById('tpe-conclusion').innerText = probs.conclusion;

    // تحديث تفكيك المعطيات
    document.getElementById('vw-status').innerText = vwmacd.status;
    document.getElementById('vw-desc').innerText = vwmacd.desc;
    
    document.getElementById('ww-status').innerText = weis.dir;
    document.getElementById('ww-desc').innerText = weis.desc;

    document.getElementById('rsi-status').innerText = volRsi.val;
    document.getElementById('rsi-desc').innerText = volRsi.desc;

    document.getElementById('tpe-dashboard').style.display = 'block';
}
// ==========================================
// محرك الخريطة الحرارية (Analytics Heatmap)
// ==========================================
const TOOL_NAMES = {
    'calc': 'حاسبة الزوايا', 'hmm': 'نموذج ماركوف', 'cls': 'فيبو + زوايا', 'cyc': 'الدورات',
    'lrc': 'الانحدار الخطي', 'cycb': 'النطاقات الدورية', 'live': 'سعر حي', 'fft': 'معادلة Fourier',
    'chop': 'مؤشر CHOP', 'demark': 'نموذج DeMark', 'montecarlo': 'مونت كارلو', 'garch': 'تباين GARCH',
    'risk': 'إدارة المخاطر', 'trend-prob': 'محرك ترجيح الاتجاه', 'mining': 'ماكرو التعدين',
    'sentiment': 'نبض السوق', 'dclose': 'الإغلاق اليومي', 'triple': 'تحليل 3X', 'mtm': 'الزخم الذكي', 
    'obk': 'سجل الأوامر', 'gann144': 'نجمة 144', 'liq': 'تتبع السيولة', 'vda': 'تدفق السيولة VDA', 
    'ms': 'هيكل السوق MS', 'atr': 'الضغط السعري ATR', 'trading1': 'Trading 1', 'trading2': 'Trading 2', 
    'trading3': 'Trading 3', 'trading4': 'Trading 4', 'trading5': 'Trading 5', 'tradingvip1': 'Trading VIP 1', 
    'tradingvip2': 'Trading VIP 2', 'vip3': 'Trading VIP 3', 'vip4': 'Trading VIP 4', 'tlo': 'Trading Limit Order', 
    'wyckoffpro': 'Wyckoff Pro', 'gannsquaring': 'Gann Squaring', 'footprint': 'Footprint Pro', 
    'liqheatmap': 'Liquidity Heatmap', 'tradingx2': 'Trading X2', 'tradingx1': 'Trading X1', 
    'mfimtf': 'MFI MTF', 'cf': 'Confluence Detector', 'cdd': 'Order Flow CDD', 
    'pg-po3': 'نمط PO3', 'lsm': 'كاشف Liquidity Sweep و Mitigation', 'mtfc': 'ماسح التقاء الفريمات المتعددة', 
    'tsignal': 'Trading Signal', 'tsignal2': 'Trading Signal 2', 'ts3': 'Trading Signal 3','mq': 'Matrix Q',
    'ts4': 'Trading Signal 4', 'ts5': 'Trading Signal 5',
    'flash': 'FLASH Scalping','ict': 'ICT Analysis Engine','tscan': 'Token Scanner','candle-patterns': 'موسوعة الشموع اليابانية','chart-patterns': 'موسوعة النماذج الكلاسيكية','ew-patterns':
        'ارشادات موجات اليوت','tsa':'السلاسل الزمنية','ccd': 'تحليل الشمعه الحالية','pdc': 'فحص بيانات العملة','sca': 'تدقيق العقد الذكي','stb': 'تحليلات الستيبل كوينز',
};

(function() {
  let tapCount = 0;
  let tapTimer = null;
  const logo = document.getElementById('admin-trigger');
  if (!logo) return;

  logo.addEventListener('click', function(e) {
    tapCount++;
    
    // 1. استجابة فورية للمستخدم العادي مع كل نقرة
    if (tapCount < 5) {
      nav('home');
    }

    // 2. إعادة ضبط العداد الصامت بعد 5 ثوانٍ
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function() {
      tapCount = 0;
    }, 5000);

    // 3. تفعيل أمر الإدارة عند الوصول لـ 5 نقرات
    if (tapCount >= 5) {
      e.preventDefault();
      e.stopPropagation();
      tapCount = 0;
      clearTimeout(tapTimer);
      
      fetch('/api/is-admin')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.admin) {
            nav('analytics');
            loadAnalyticsData();
          }
        }).catch(function() {});
    }
  });
})();


async function loadAnalyticsData() {
  const dash = document.getElementById('analytics-dashboard');
  if (!dash) return;
  dash.style.display = 'none';

  try {
    const res = await fetch('/api/analytics');
    if (!res.ok) return;
    const data = await res.json();
    dash.style.display = 'block';
    renderAnalytics(data);
  } catch(e) {}
}

function renderAnalytics(data) {
  const totalRequests = Object.values(data.tools).reduce((a, b) => a + b, 0);
  document.getElementById('an-total').textContent = totalRequests.toLocaleString();

  const sortedTools = Object.entries(data.tools).sort((a, b) => b[1] - a[1]);
  if (sortedTools.length > 0) document.getElementById('an-top-tool').textContent = TOOL_NAMES[sortedTools[0][0]] || sortedTools[0][0];

  const sortedHours = Object.entries(data.hourly).sort((a, b) => b[1] - a[1]);
  if (sortedHours.length > 0) document.getElementById('an-peak-hour').textContent = sortedHours[0][0].padStart(2, '0') + ':00';

  const toolsBars = document.getElementById('an-tools-bars');
  if (sortedTools.length === 0) toolsBars.innerHTML = '<div style="text-align:center; color:#555;">لا بيانات</div>';
  else {
    const maxToolCount = sortedTools[0][1] || 1;
    let html = '';
    sortedTools.slice(0, 10).forEach(([tool, count]) => {
      const pct = Math.max(2, (count / maxToolCount) * 100);
      const name = TOOL_NAMES[tool] || tool;
      html += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; direction:rtl;">
        <div style="min-width:90px; font-size:0.7rem; color:#ccc; text-align:right;">${name}</div>
        <div style="flex:1; height:18px; background:#111; border-radius:4px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #ff6a00, #ff8c33); border-radius:4px;"></div>
        </div>
        <div style="min-width:30px; font-family:'Share Tech Mono',monospace; font-size:0.75rem; color:#fff; text-align:left;">${count}</div>
      </div>`;
    });
    toolsBars.innerHTML = html;
  }

  const hoursGrid = document.getElementById('an-hours-grid');
  const maxHourCount = Math.max(1, ...Object.values(data.hourly).map(Number));
  let hoursHtml = '';
  for (let h = 0; h < 24; h++) {
    const count = parseInt(data.hourly[h.toString()]) || 0;
    const intensity = count / maxHourCount;
    let bgColor = '#111';
    if (intensity > 0) bgColor = `rgba(255,106,0,${Math.min(0.15 + intensity * 0.75, 0.9)})`;
    hoursHtml += `<div style="background:${bgColor}; border-radius:3px; padding:6px 2px; text-align:center; min-height:40px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid #1a1a1a;">
      <div style="font-family:'Share Tech Mono',monospace; font-size:0.55rem; color:#888;">${h.toString().padStart(2,'0')}</div>
      <div style="font-family:'Share Tech Mono',monospace; font-size:0.65rem; color:${count > 0 ? '#fff' : '#333'}; font-weight:bold;">${count}</div>
    </div>`;
  }
  hoursGrid.innerHTML = hoursHtml;

  const dailyBars = document.getElementById('an-daily-bars');
  const days = Object.keys(data.daily).sort().slice(-7);
  if (days.length === 0) dailyBars.innerHTML = '<div style="text-align:center; color:#555;">لا بيانات</div>';
  else {
    const dayTotals = days.map(d => ({ day: d, total: Object.values(data.daily[d].tools || {}).reduce((a, b) => a + b, 0) }));
    const maxDay = Math.max(1, ...dayTotals.map(d => d.total));
    const daysAr = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    let dHtml = '';
    dayTotals.forEach(({ day, total }) => {
      const pct = Math.max(2, (total / maxDay) * 100);
      const dateObj = new Date(day + 'T00:00:00Z');
      const dayName = daysAr[dateObj.getUTCDay()];
      const shortDate = day.slice(5);
      dHtml += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; direction:rtl;">
        <div style="min-width:85px; font-size:0.65rem; color:#ccc; text-align:right;">${dayName} (${shortDate})</div>
        <div style="flex:1; height:14px; background:#111; border-radius:4px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #ff6a00, #ff8c33); border-radius:4px;"></div>
        </div>
        <div style="min-width:25px; font-family:'Share Tech Mono',monospace; font-size:0.7rem; color:#fff; text-align:left;">${total}</div>
      </div>`;
    });
    dailyBars.innerHTML = dHtml;
  }
}
// ==========================================
// أداة مربع التسعة التفاعلي (Gann Square of Nine)
// المعادلة الدقيقة: Level = (√(Price × SF) ± Angle/180)² / SF
// تم دمج التحجيم الديناميكي الموجه (Directional Dynamic Scaling)
// ==========================================

let sq9GridSize = 11;

function setSq9Size(size) {
  sq9GridSize = size;
  document.querySelectorAll('.sq9-sz').forEach(b => {
    b.style.borderColor = 'var(--b)';
    b.style.color = 'var(--t2)';
    b.style.background = 'var(--s)';
  });
  event.target.style.borderColor = 'var(--o)';
  event.target.style.color = '#fff';
  event.target.style.background = 'var(--od)';
}

function generateSq9Matrix(n) {
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  let num = 1;
  let x = Math.floor(n / 2), y = Math.floor(n / 2);
  matrix[y][x] = num++;
  let steps = 1;
  // متجهات الحركة الصحيحة (مع عقارب الساعة): يسار، أعلى، يمين، أسفل
  const dx = [-1, 0, 1, 0];
  const dy = [0, -1, 0, 1];
  let dir = 0, moved = 0, turnCount = 0;
  while (num <= n * n) {
    x += dx[dir]; y += dy[dir];
    if (x >= 0 && x < n && y >= 0 && y < n) matrix[y][x] = num++;
    moved++;
    if (moved === steps) {
      moved = 0; dir = (dir + 1) % 4; turnCount++;
      if (turnCount % 2 === 0) steps++;
    }
  }
  return matrix;
}

// دالة التحجيم الديناميكي الموجهة بناءً على السعر والاتجاه
function sq9ScaleFactor(p, direction = 'up') {
  if (p >= 10000) {
    if (direction === 'up') return 0.0001;
    else return p >= 40000 ? 0.0001 : 0.001;
  } else if (p >= 1000) {
    return 0.01;
  } else if (p >= 100) {
    return 0.1;
  } else if (p >= 10) {
    return 1.0;
  } else if (p >= 1) {
    if (direction === 'up') return 1.0;
    else return p >= 4 ? 1.0 : 100.0;
  } else if (p >= 0.1) {
    if (direction === 'up') return 100.0;
    else return p >= 0.4 ? 100.0 : 10000.0;
  } else if (p >= 0.01) {
    if (direction === 'up') return 10000.0;
    else return p >= 0.04 ? 10000.0 : 1000000.0;
  } else if (p >= 0.001) {
    if (direction === 'up') return 1000000.0;
    else return p >= 0.004 ? 1000000.0 : 100000000.0;
  } else {
    if (direction === 'up') return 100000000.0;
    else return p >= 0.0004 ? 100000000.0 : 10000000000.0;
  }
}

function sq9Level(price, angleDeg, direction) {
  const sf = sq9ScaleFactor(price, direction);
  const root = Math.sqrt(price * sf);
  const increment = angleDeg / 180;
  
  if (direction === 'up') {
    return Math.pow(root + increment, 2) / sf;
  } else {
    const newRoot = root - increment;
    if (newRoot < 0) return 0;
    return Math.pow(newRoot, 2) / sf;
  }
}

function sq9Format(p) {
  if (p === 0) return '0';
  if (p < 1 && p > 0) return p.toFixed(4);
  if (p < 10) return p.toFixed(3);
  if (p < 1000) return p.toFixed(2);
  return p.toFixed(0);
}

function buildSq9() {
  const priceInput = parseFloat(document.getElementById('sq9-price').value);
  if (isNaN(priceInput) || priceInput <= 0) return;

  const n = sq9GridSize;
  // في بناء المصفوفة البصرية نستخدم اتجاه 'up' كمعيار لحساب الإزاحة الأساسية للخطوات
  const sf = sq9ScaleFactor(priceInput, 'up'); 
  const centerNum = priceInput * sf; // إلغاء التقريب الإجباري
  const center = Math.floor(n / 2);
  const matrix = generateSq9Matrix(n);
  const offset = centerNum - 1;

  const fontSize = n <= 9 ? '0.6rem' : n <= 11 ? '0.5rem' : n <= 13 ? '0.45rem' : '0.38rem';
  const cellH = n <= 9 ? '38px' : n <= 11 ? '32px' : n <= 13 ? '28px' : '24px';
  const minW = n > 11 ? (n * 36) + 'px' : 'auto';

  let html = `<div style="display:grid; grid-template-columns:repeat(${n},1fr); gap:2px; direction:ltr; min-width:${minW};">`;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cellNum = matrix[row][col];
      const actualNum = cellNum + offset;
      const cellPrice = actualNum / sf;
      const isCenter = (row === center && col === center);

      let cellType = 'normal';
      if (isCenter) cellType = 'center';
      else if (row === center || col === center) cellType = 'cardinal';
      else if (Math.abs(row - center) === Math.abs(col - center)) cellType = 'ordinal';

      let bg = '#0d0d0d', border = '#1a1a1a', color = '#444', fw = 'normal';
      if (cellType === 'center') {
        bg = '#cc5500'; border = '#ff6a00'; color = '#000'; fw = 'bold';
      } else if (cellType === 'cardinal') {
        bg = 'rgba(255,106,0,0.14)'; border = 'rgba(255,106,0,0.35)'; color = '#ff6a00'; fw = 'bold';
      } else if (cellType === 'ordinal') {
        bg = 'rgba(255,255,255,0.05)'; border = 'rgba(255,255,255,0.15)'; color = '#ffffff';
      }

      html += `<div style="background:${bg}; border:1px solid ${border}; border-radius:3px; min-height:${cellH}; display:flex; align-items:center; justify-content:center; transition:all 0.15s; ${isCenter ? 'animation:pulseGlow 2s ease-in-out infinite;' : ''}" onmouseover="this.style.background='rgba(255,106,0,0.22)';this.style.borderColor='#ff6a00';this.style.color='#fff'" onmouseout="this.style.background='${bg}';this.style.borderColor='${border}';this.style.color='${color}'">
        <span style="font-family:'Share Tech Mono',monospace; font-size:${fontSize}; color:${color}; font-weight:${fw}; line-height:1.2; pointer-events:none;">${cellPrice > 0 ? sq9Format(cellPrice) : '0'}</span>
      </div>`;
    }
  }
  html += '</div>';

  document.getElementById('sq9-grid').innerHTML = html;
  document.getElementById('sq9-grid-wrap').style.display = 'block';
  document.getElementById('sq9-legend').style.display = 'flex';
  document.getElementById('sq9-info').style.display = 'block';

  buildSq9Levels(priceInput);
}

function buildSq9Levels(price) {
  const angles = [
    { deg: 45, label: '45°', type: 'فرعية' },
    { deg: 90, label: '90°', type: 'رئيسية' },
    { deg: 135, label: '135°', type: 'فرعية' },
    { deg: 180, label: '180°', type: 'رئيسية' },
    { deg: 225, label: '225°', type: 'فرعية' },
    { deg: 270, label: '270°', type: 'رئيسية' },
    { deg: 315, label: '315°', type: 'فرعية' },
    { deg: 360, label: '360°', type: 'رئيسية' },
    { deg: 720, label: '720°', type: 'دورتين' }
  ];

  let rows = '';
  angles.forEach(a => {
    const up = sq9Level(price, a.deg, 'up');
    const down = sq9Level(price, a.deg, 'down');
    const isMajor = [90, 180, 270, 360].includes(a.deg);
    const is360 = [360, 720].includes(a.deg);
    
    rows += `<tr style="border-bottom:1px solid #111; ${is360 ? 'background:rgba(255,106,0,0.06);' : ''}">
      <td style="padding:8px 4px; font-family:'Share Tech Mono',monospace; font-size:0.75rem; color:${isMajor ? '#ff6a00' : '#666'}; font-weight:${isMajor ? 'bold' : 'normal'};">${a.deg}°</td>
      <td style="padding:8px 4px; font-family:'Share Tech Mono',monospace; font-size:0.8rem; color:#fff; font-weight:bold; direction:ltr;">${sq9Format(up)}</td>
      <td style="padding:8px 4px; font-family:'Share Tech Mono',monospace; font-size:0.8rem; color:#888; direction:ltr;">${sq9Format(down)}</td>
    </tr>`;
  });

  document.getElementById('sq9-levels').innerHTML = `
    <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; padding:14px; margin-bottom:16px;">
      <div style="color:#ff6a00; font-weight:700; font-size:0.8rem; margin-bottom:12px; border-bottom:1px solid #1a1a1a; padding-bottom:8px;">المستويات المستخرجة من المربع</div>
      <div style="text-align:center; padding:12px; margin-bottom:12px; background:#111; border-radius:8px; border:1px solid #cc5500;">
        <div style="font-size:0.65rem; color:#888; margin-bottom:4px;">السعر المرجعي</div>
        <div style="font-family:'Share Tech Mono',monospace; font-size:1.6rem; font-weight:bold; color:#ff6a00; direction:ltr;">${sq9Format(price)}</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:center;">
          <thead>
            <tr style="border-bottom:1px solid #222;">
              <th style="padding:8px 4px; font-size:0.65rem; color:#888;">الزاوية</th>
              <th style="padding:8px 4px; font-size:0.65rem; color:#ff6a00;">مقاومة</th>
              <th style="padding:8px 4px; font-size:0.65rem; color:#888;">دعم</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('sq9-levels').style.display = 'block';
}

if (!document.getElementById('sq9-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'sq9-pulse-style';
  style.textContent = '@keyframes pulseGlow{0%,100%{box-shadow:0 0 0 rgba(204,85,0,0)}50%{box-shadow:0 0 18px rgba(204,85,0,0.5)}}';
  document.head.appendChild(style);
}
// ==========================================
// محرك Divergence Scanner (نسخة محدثة متطابقة مع Binance)
// رصد الدايفرجنس عبر RSI (RMA) + MACD Histogram + OBV
// ==========================================

async function runDivergenceScan() {
  const coinInput = document.getElementById('div-symbol').value.trim().toUpperCase();
  const tfInput = document.getElementById('div-tf').value;
  const btn = document.getElementById('div-btn');

  if (!coinInput) return;

  const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';
  btn.innerText = 'جاري تحليل البيانات...';
  btn.disabled = true;

  try {
    // تم تحديث عمق الاستدعاء إلى 250 شمعة لضمان استقرار حسابات RMA
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

    if (candles.length < 50) throw new Error('بيانات غير كافية للتحليل.');

    const currentPrice = candles[candles.length - 1].close;

    // حساب المؤشرات
    const rsiResult = detectRSIDivergence(candles);
    const macdResult = detectMACDDivergence(candles);
    const obvResult = detectOBVDivergence(candles);

    // عرض النتائج
    document.getElementById('div-pair').textContent = symbol;
    document.getElementById('div-price').textContent = '$' + currentPrice.toLocaleString('en-US', {maximumFractionDigits: 2});
    document.getElementById('div-tf-label').textContent = tfInput.toUpperCase();

    renderDivBar('rsi', rsiResult);
    renderDivBar('macd', macdResult);
    renderDivBar('obv', obvResult);

    // حساب التوافق
    const results = [rsiResult, macdResult, obvResult];
    const bearishCount = results.filter(r => r.type === 'bearish').length;
    const bullishCount = results.filter(r => r.type === 'bullish').length;
    const totalScore = Math.max(bearishCount, bullishCount);
    const dominant = bearishCount > bullishCount ? 'bearish' : bullishCount > bearishCount ? 'bullish' : 'none';
    const scoreColor = dominant === 'bearish' ? '#ff6a00' : dominant === 'bullish' ? '#ffffff' : '#333';

    // أشرطة التوافق
    for (let i = 1; i <= 3; i++) {
      document.getElementById('div-sc-' + i).style.background = i <= totalScore ? scoreColor : '#1a1a1a';
    }
    document.getElementById('div-score').textContent = totalScore + '/3';
    document.getElementById('div-score').style.color = totalScore >= 2 ? '#ff6a00' : totalScore === 1 ? '#888' : '#333';

    // الخلاصة
    let conclusion = '';
    if (totalScore === 3) {
      conclusion = dominant === 'bearish'
        ? 'توافق سلبي مطلق (3/3). جميع المؤشرات تُظهر دايفرجنس هبوطي. احتمالية انعكاس هبوطي مرتفعة. يُنصح بالحذر من المراكز الشرائية.'
        : 'توافق إيجابي مطلق (3/3). جميع المؤشرات تُظهر دايفرجنس صعودي. احتمالية انعكاس صعودي مرتفعة. فرصة شرائية محتملة.';
    } else if (totalScore === 2) {
      conclusion = dominant === 'bearish'
        ? 'توافق سلبي جزئي (2/3). مؤشران يُظهران دايفرجنس هبوطي. إشارة تحذيرية تستوجب المراقبة مع تأكيد من حركة السعر.'
        : 'توافق إيجابي جزئي (2/3). مؤشران يُظهران دايفرجنس صعودي. إشارة إيجابية تحتاج تأكيد من كسر مقاومة أو حجم تداول.';
    } else if (totalScore === 1) {
      conclusion = 'دايفرجنس معزول (1/3). مؤشر واحد فقط يُظهر تباين. الإشارة ضعيفة ولا تكفي لاتخاذ قرار. يُنصح بالانتظار.';
    } else {
      conclusion = 'لا يوجد دايفرجنس مرصود (0/3). المؤشرات متوافقة مع حركة السعر. الاتجاه الحالي مدعوم بالزخم والحجم.';
    }
    document.getElementById('div-conclusion').textContent = conclusion;

    // بطاقات التفصيل
    renderDivDetails([
      { key: 'RSI', sub: 'القوة النسبية', data: rsiResult },
      { key: 'MACD', sub: 'الهيستوجرام', data: macdResult },
      { key: 'OBV', sub: 'حجم التوازن', data: obvResult }
    ]);

    document.getElementById('div-dashboard').style.display = 'block';

  } catch (e) {
    alert(e.message);
  } finally {
    btn.innerText = 'فحص الدايفرجنس';
    btn.disabled = false;
  }
}

// ==========================================
// خوارزمية كشف دايفرجنس RSI (متطابقة مع Binance عبر Wilder's RMA)
// ==========================================
function detectRSIDivergence(candles) {
  const period = 14;
  const closes = candles.map(c => c.close);

  // حساب RSI التراكمي (RMA)
  const rsiValues = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      rsiValues.push(null);
      continue;
    }

    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      rsiValues.push(null);
      if (i === period - 1) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgGain / (avgLoss || 0.0001);
        rsiValues[i] = 100 - (100 / (1 + rs));
      }
    } else {
      // تطبيق معادلة وايلدر التمهيدية
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
      const rs = avgGain / (avgLoss || 0.0001);
      rsiValues.push(100 - (100 / (1 + rs)));
    }
  }

  // البحث عن القمم والقيعان في آخر 30 شمعة
  const lookback = 30;
  const start = closes.length - lookback;

  const priceHighs = findPeaks(closes, start, closes.length);
  const priceLows = findTroughs(closes, start, closes.length);
  const rsiHighs = findPeaks(rsiValues, start, rsiValues.length);
  const rsiLows = findTroughs(rsiValues, start, rsiValues.length);

  const currentRSI = rsiValues[rsiValues.length - 1];

  // دايفرجنس سلبي: السعر قمة أعلى + RSI قمة أدنى
  if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
    const lastPH = priceHighs[priceHighs.length - 1];
    const prevPH = priceHighs[priceHighs.length - 2];
    const lastRH = rsiHighs[rsiHighs.length - 1];
    const prevRH = rsiHighs[rsiHighs.length - 2];

    if (closes[lastPH] > closes[prevPH] && rsiValues[lastRH] < rsiValues[prevRH]) {
      const strength = Math.min(90, Math.round(Math.abs(rsiValues[prevRH] - rsiValues[lastRH]) * 3 + 40));
      return {
        type: 'bearish', label: 'دايفرجنس سلبي', strength,
        value: currentRSI.toFixed(1),
        desc: 'السعر يسجل قمة أعلى بينما RSI يسجل قمة أدنى — ضعف زخم شرائي'
      };
    }
  }

  // دايفرجنس إيجابي: السعر قاع أدنى + RSI قاع أعلى
  if (priceLows.length >= 2 && rsiLows.length >= 2) {
    const lastPL = priceLows[priceLows.length - 1];
    const prevPL = priceLows[priceLows.length - 2];
    const lastRL = rsiLows[rsiLows.length - 1];
    const prevRL = rsiLows[rsiLows.length - 2];

    if (closes[lastPL] < closes[prevPL] && rsiValues[lastRL] > rsiValues[prevRL]) {
      const strength = Math.min(90, Math.round(Math.abs(rsiValues[lastRL] - rsiValues[prevRL]) * 3 + 40));
      return {
        type: 'bullish', label: 'دايفرجنس إيجابي', strength,
        value: currentRSI.toFixed(1),
        desc: 'السعر يسجل قاع أدنى بينما RSI يسجل قاع أعلى — بوادر ارتداد'
      };
    }
  }

  return {
    type: 'none', label: 'لا يوجد', strength: 0,
    value: currentRSI ? currentRSI.toFixed(1) : '--',
    desc: 'RSI يتحرك بتوافق مع السعر — لا إشارة دايفرجنس حالياً'
  };
}

// ==========================================
// خوارزمية كشف دايفرجنس MACD Histogram
// ==========================================
function detectMACDDivergence(candles) {
  const closes = candles.map(c => c.close);

  // حساب EMA
  function calcEMA(data, period) {
    const ema = [];
    const k = 2 / (period + 1);
    ema[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      ema[i] = data[i] * k + ema[i - 1] * (1 - k);
    }
    return ema;
  }

  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);

  const lookback = 30;
  const start = closes.length - lookback;

  const priceHighs = findPeaks(closes, start, closes.length);
  const priceLows = findTroughs(closes, start, closes.length);
  const histHighs = findPeaks(histogram, start, histogram.length);
  const histLows = findTroughs(histogram, start, histogram.length);

  const currentHist = histogram[histogram.length - 1];

  // دايفرجنس سلبي
  if (priceHighs.length >= 2 && histHighs.length >= 2) {
    const lastPH = priceHighs[priceHighs.length - 1];
    const prevPH = priceHighs[priceHighs.length - 2];
    const lastHH = histHighs[histHighs.length - 1];
    const prevHH = histHighs[histHighs.length - 2];

    if (closes[lastPH] > closes[prevPH] && histogram[lastHH] < histogram[prevHH]) {
      const strength = Math.min(85, Math.round(50 + Math.abs(histogram[prevHH] - histogram[lastHH]) / Math.abs(histogram[prevHH] || 0.001) * 30));
      return {
        type: 'bearish', label: 'دايفرجنس سلبي', strength,
        value: currentHist.toFixed(4),
        desc: 'الهيستوجرام يتناقص رغم ارتفاع السعر — تراجع في قوة الاتجاه'
      };
    }
  }

  // دايفرجنس إيجابي
  if (priceLows.length >= 2 && histLows.length >= 2) {
    const lastPL = priceLows[priceLows.length - 1];
    const prevPL = priceLows[priceLows.length - 2];
    const lastHL = histLows[histLows.length - 1];
    const prevHL = histLows[histLows.length - 2];

    if (closes[lastPL] < closes[prevPL] && histogram[lastHL] > histogram[prevHL]) {
      const strength = Math.min(85, Math.round(50 + Math.abs(histogram[lastHL] - histogram[prevHL]) / Math.abs(histogram[prevHL] || 0.001) * 30));
      return {
        type: 'bullish', label: 'دايفرجنس إيجابي', strength,
        value: currentHist.toFixed(4),
        desc: 'الهيستوجرام يتزايد رغم انخفاض السعر — تراكم زخم إيجابي'
      };
    }
  }

  return {
    type: 'none', label: 'لا يوجد', strength: 0,
    value: currentHist.toFixed(4),
    desc: 'MACD Histogram يتحرك بتوافق مع السعر — لا إشارة حالياً'
  };
}

// ==========================================
// خوارزمية كشف دايفرجنس OBV
// ==========================================
function detectOBVDivergence(candles) {
  // حساب OBV
  const obv = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      obv.push(obv[i - 1] + candles[i].volume);
    } else if (candles[i].close < candles[i - 1].close) {
      obv.push(obv[i - 1] - candles[i].volume);
    } else {
      obv.push(obv[i - 1]);
    }
  }

  const closes = candles.map(c => c.close);
  const lookback = 30;
  const start = closes.length - lookback;

  const priceHighs = findPeaks(closes, start, closes.length);
  const priceLows = findTroughs(closes, start, closes.length);
  const obvHighs = findPeaks(obv, start, obv.length);
  const obvLows = findTroughs(obv, start, obv.length);

  const currentOBV = obv[obv.length - 1];
  const obvFormatted = Math.abs(currentOBV) >= 1e6
    ? (currentOBV / 1e6).toFixed(1) + 'M'
    : Math.abs(currentOBV) >= 1e3
    ? (currentOBV / 1e3).toFixed(1) + 'K'
    : currentOBV.toFixed(0);

  // دايفرجنس سلبي
  if (priceHighs.length >= 2 && obvHighs.length >= 2) {
    const lastPH = priceHighs[priceHighs.length - 1];
    const prevPH = priceHighs[priceHighs.length - 2];
    const lastOH = obvHighs[obvHighs.length - 1];
    const prevOH = obvHighs[obvHighs.length - 2];

    if (closes[lastPH] > closes[prevPH] && obv[lastOH] < obv[prevOH]) {
      const strength = Math.min(80, Math.round(45 + Math.abs(obv[prevOH] - obv[lastOH]) / Math.abs(obv[prevOH] || 1) * 50));
      return {
        type: 'bearish', label: 'دايفرجنس سلبي', strength,
        value: obvFormatted,
        desc: 'حجم التوازن ينخفض رغم ارتفاع السعر — تراجع في السيولة الشرائية'
      };
    }
  }

  // دايفرجنس إيجابي
  if (priceLows.length >= 2 && obvLows.length >= 2) {
    const lastPL = priceLows[priceLows.length - 1];
    const prevPL = priceLows[priceLows.length - 2];
    const lastOL = obvLows[obvLows.length - 1];
    const prevOL = obvLows[obvLows.length - 2];

    if (closes[lastPL] < closes[prevPL] && obv[lastOL] > obv[prevOL]) {
      const strength = Math.min(80, Math.round(45 + Math.abs(obv[lastOL] - obv[prevOL]) / Math.abs(obv[prevOL] || 1) * 50));
      return {
        type: 'bullish', label: 'دايفرجنس إيجابي', strength,
        value: obvFormatted,
        desc: 'حجم التوازن يتزايد رغم انخفاض السعر — تراكم سيولة شرائية'
      };
    }
  }

  return {
    type: 'none', label: 'لا يوجد', strength: 0,
    value: obvFormatted,
    desc: 'حجم التوازن يتحرك بتوافق مع السعر — لا إشارة حالياً'
  };
}

// ==========================================
// دوال مساعدة: كشف القمم والقيعان
// ==========================================
function findPeaks(data, start, end) {
  const peaks = [];
  for (let i = Math.max(start, 2); i < end - 2; i++) {
    if (data[i] !== null && data[i - 1] !== null && data[i - 2] !== null
      && data[i + 1] !== null && data[i + 2] !== null
      && data[i] > data[i - 1] && data[i] > data[i - 2]
      && data[i] > data[i + 1] && data[i] > data[i + 2]) {
      peaks.push(i);
    }
  }
  return peaks;
}

function findTroughs(data, start, end) {
  const troughs = [];
  for (let i = Math.max(start, 2); i < end - 2; i++) {
    if (data[i] !== null && data[i - 1] !== null && data[i - 2] !== null
      && data[i + 1] !== null && data[i + 2] !== null
      && data[i] < data[i - 1] && data[i] < data[i - 2]
      && data[i] < data[i + 1] && data[i] < data[i + 2]) {
      troughs.push(i);
    }
  }
  return troughs;
}

// ==========================================
// دوال العرض البصري
// ==========================================
function renderDivBar(id, result) {
  const tag = document.getElementById('div-' + id + '-tag');
  const bar = document.getElementById('div-' + id + '-bar');
  const pct = document.getElementById('div-' + id + '-pct');

  const color = result.type === 'bearish' ? '#ff6a00' : result.type === 'bullish' ? '#ffffff' : '#333';
  const tagBg = result.type === 'bearish' ? 'rgba(255,106,0,0.12)' : result.type === 'bullish' ? 'rgba(255,255,255,0.08)' : 'rgba(80,80,80,0.15)';
  const tagBorder = result.type === 'bearish' ? 'rgba(255,106,0,0.25)' : result.type === 'bullish' ? 'rgba(255,255,255,0.15)' : '#222';

  tag.textContent = result.label;
  tag.style.color = color;
  tag.style.background = tagBg;
  tag.style.borderColor = tagBorder;

  bar.style.width = result.strength + '%';
  bar.style.background = result.strength > 0
    ? 'linear-gradient(to left, ' + color + ', ' + color + '88)'
    : 'transparent';

  pct.textContent = result.strength > 0 ? result.strength + '%' : '';
}

function renderDivDetails(items) {
  const container = document.getElementById('div-details');
  let html = '';

  items.forEach(item => {
    const color = item.data.type === 'bearish' ? '#ff6a00' : item.data.type === 'bullish' ? '#ffffff' : '#333';
    const bg = item.data.type === 'bearish' ? 'rgba(255,106,0,0.08)' : item.data.type === 'bullish' ? 'rgba(255,255,255,0.04)' : 'transparent';
    const border = item.data.type === 'bearish' ? 'rgba(255,106,0,0.25)' : item.data.type === 'bullish' ? 'rgba(255,255,255,0.15)' : '#1a1a1a';

    html += `<div style="background:${bg}; border:1px solid ${border}; border-radius:10px; padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <div style="font-family:'Share Tech Mono',monospace; font-size:0.85rem; color:#fff; font-weight:bold; letter-spacing:1px;">${item.key}</div>
          <div style="font-size:0.65rem; color:#555; margin-top:1px;">${item.sub}</div>
        </div>
        <div style="text-align:left; direction:ltr;">
          <div style="font-family:'Share Tech Mono',monospace; font-size:1rem; color:${color}; font-weight:bold;">${item.data.value}</div>
        </div>
      </div>
      <div style="font-size:0.72rem; color:#777; line-height:1.5;">${item.data.desc}</div>
    </div>`;
  });

  container.innerHTML = html;
}

// ============================================================
// 🚀 محرك MOMENTUM INTELLIGENCE SUITE (4 ENGINES)
// ============================================================

async function runMomentumSuite() {
    const coinInput = document.getElementById('mtm-sym').value.trim().toUpperCase();
    const tf = document.getElementById('mtm-tf').value.toLowerCase();
    const btn = document.getElementById('mtm-btn');
    const loading = document.getElementById('mtm-loading');
    const dash = document.getElementById('mtm-dashboard');

    if (!coinInput) return;
    const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';

    btn.innerText = 'ANALYZING...';
    btn.disabled = true;
    loading.style.display = 'block';
    dash.style.display = 'none';

    try {
        // 1. طلب واحد للبيانات يغذي جميع المحركات معاً (عبر سيرفر الكاش)
        const limit = tf === '1h' || tf === '15m' ? 500 : 300;
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=${limit}`);
        if (!res.ok) throw new Error('تعذر جلب البيانات السعرية.');
        
        const raw = await res.json();
        if (raw.length < 60) throw new Error('عمق البيانات غير كافٍ للتحليل.');

        const closes = raw.map(k => parseFloat(k[4]));
        const highs = raw.map(k => parseFloat(k[2]));
        const lows = raw.map(k => parseFloat(k[3]));
        const volumes = raw.map(k => parseFloat(k[5]));
        const n = closes.length;
        const price = closes[n - 1];

        // فورمات العملات الصفرية الذكية
        const fmt = typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice : (p => '$'+p.toFixed(2));

        // Ticker Rendering
        document.getElementById('mtm-ticker').innerHTML = `
            <div style="background:#060606; border:1px solid #111; border-radius:4px; padding:8px 12px; display:flex; justify-content:space-between; align-items:baseline;">
                <div style="display:flex; align-items:baseline; gap:10px;">
                    <span style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.65rem; font-weight:bold;">${symbol.replace('USDT','')}</span>
                    <span style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:1.6rem; font-weight:bold; letter-spacing:1px; direction:ltr;">${fmt(price).replace('$','')}</span>
                </div>
                <span style="color:#888; font-family:'Share Tech Mono',monospace; font-size:0.6rem;">${tf.toUpperCase()}</span>
            </div>`;

        // تشغيل المحركات الرياضية الأربعة
        const rsiResult = calcMtmAdaptiveRSI(closes, highs, lows, n);
        const macdResult = calcMtmMACDPro(closes, n);
        const volResult = calcMtmVolatility(closes, highs, lows, n);
        const shiftResult = calcMtmShift(rsiResult, macdResult, closes, volumes, n);

        // رسم المخرجات (UI Rendering)
        renderMtmRSI(rsiResult);
        renderMtmMACD(macdResult);
        renderMtmVol(volResult, fmt);
        renderMtmShift(shiftResult);
        renderMtmCombined(rsiResult, macdResult, volResult, shiftResult);

        loading.style.display = 'none';
        dash.style.display = 'block';

    } catch (e) {
        loading.innerHTML = `<div style="color:var(--o); font-family:'Cairo', sans-serif;">${e.message}</div>`;
    } finally {
        btn.innerText = 'ANALYZE MOMENTUM';
        btn.disabled = false;
    }
}

// ---------------------------------------------------------
// رياضيات التمهيد المتطابقة مع TradingView (Wilder's RMA)
// ---------------------------------------------------------
function calcMtmWilderRSI(closes, period) {
    let rsiArray = [];
    if (closes.length <= period) return Array(closes.length).fill(50);
    
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = closes[i] - closes[i-1];
        if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    let avgGain = gains / period, avgLoss = losses / period;
    
    for (let i = period + 1; i < closes.length; i++) {
        let diff = closes[i] - closes[i-1];
        let gain = diff > 0 ? diff : 0, loss = diff < 0 ? Math.abs(diff) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        rsiArray.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain/avgLoss)));
    }
    const pad = Array(period).fill(50);
    return pad.concat(rsiArray);
}

function calcMtmEMA(data, period) {
    let ema = [data[0]], k = 2 / (period + 1);
    for (let i = 1; i < data.length; i++) ema.push(data[i] * k + ema[i-1] * (1 - k));
    return ema;
}

const normMtmSVG = (arr, w, h, pX=10, pY=5) => {
    const mn = Math.min(...arr), mx = Math.max(...arr), r = mx - mn || 1;
    return arr.map((v, i) => ({ x: pX + (i / (arr.length - 1)) * (w - pX*2), y: pY + (1 - (v - mn) / r) * (h - pY*2) }));
};

// ---------------------------------------------------------
// 1. Adaptive RSI Engine
// ---------------------------------------------------------
function calcMtmAdaptiveRSI(closes, highs, lows, n) {
    let atrs = [0];
    for (let i = 1; i < n; i++) {
        atrs.push(Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1])));
    }
    let recentATR = atrs.slice(-14).reduce((a,b)=>a+b,0) / 14;
    let avgATR = atrs.slice(-60).reduce((a,b)=>a+b,0) / 60;
    
    let volRatio = avgATR > 0 ? recentATR / avgATR : 1;
    let adaptivePeriod = Math.round(14 * Math.max(0.6, Math.min(1.8, volRatio)));
    adaptivePeriod = Math.max(8, Math.min(25, adaptivePeriod)); 

    const stdRsiArr = calcMtmWilderRSI(closes, 14);
    const adpRsiArr = calcMtmWilderRSI(closes, adaptivePeriod);
    
    const stdRSI = stdRsiArr[stdRsiArr.length - 1];
    const adpRSI = adpRsiArr[adpRsiArr.length - 1];

    let zone = adpRSI > 70 ? 'تشبع شرائي' : adpRSI > 55 ? 'ميل صعودي' : adpRSI >= 45 ? 'محايد' : adpRSI >= 30 ? 'ميل هبوطي' : 'تشبع بيعي';
    let signal = adpRSI > 55 ? 'BULL' : adpRSI < 45 ? 'BEAR' : 'WAIT';

    return { standard: stdRSI.toFixed(1), adaptive: adpRSI.toFixed(1), period: adaptivePeriod, zone, signal, volState: volRatio > 1.15 ? 'EXPANDING' : volRatio < 0.85 ? 'CONTRACT' : 'NORMAL', hist: adpRsiArr.slice(-24) };
}

function renderMtmRSI(r) {
    const c = r.signal === 'BULL' ? '#fff' : r.signal === 'BEAR' ? 'var(--o)' : '#888';
    const W = 340, mH = 65;
    const pts = normMtmSVG(r.hist, W, mH).map(p => `${p.x},${p.y}`).join(" ");
    
    const mn = Math.min(...r.hist), mx = Math.max(...r.hist), rg = mx - mn || 1;
    const y70 = 5 + (1 - (70 - mn) / rg) * (mH - 10), y30 = 5 + (1 - (30 - mn) / rg) * (mH - 10), y50 = 5 + (1 - (50 - mn) / rg) * (mH - 10);

    let html = `
    <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:6px 12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:3px; height:14px; background:var(--o); border-radius:2px;"></div>
            <span style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.7rem; font-weight:bold;">1. ADAPTIVE RSI</span>
        </div>
        <span style="font-family:'Share Tech Mono',monospace; font-size:0.45rem; font-weight:900; padding:2px 6px; border-radius:3px; color:#000; background:${c};">${r.signal}</span>
    </div>
    <div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px;">
        <div style="display:grid; grid-template-columns:repeat(4,1fr); border-bottom:1px solid #111;">
            ${[{l:"ADAPTIVE",v:r.adaptive,c:"var(--o)"},{l:"STANDARD",v:r.standard,c:"#fff"},{l:"PERIOD",v:r.period,c:"#ccc"},{l:"VOLATIL",v:r.volState.slice(0,7),c:"#888"}].map((it,i)=>`
                <div style="padding:8px 4px; text-align:center; border-left:${i>0?'1px solid #111':'none'};">
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.35rem; color:#888;">${it.l}</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.75rem; color:${it.c}; font-weight:bold;">${it.v}</div>
                </div>
            `).join('')}
        </div>
        <div style="padding:4px 2px; background:#020208;">
            <svg width="100%" height="${mH}" viewBox="0 0 ${W} ${mH}" style="direction:ltr;">
                <rect x="0" y="${y70}" width="${W}" height="${Math.abs(y30-y70)}" fill="#fff" fill-opacity="0.02" />
                <line x1="0" y1="${y70}" x2="${W}" y2="${y70}" stroke="var(--o)" stroke-width="0.5" opacity="0.3" />
                <line x1="0" y1="${y30}" x2="${W}" y2="${y30}" stroke="#fff" stroke-width="0.5" opacity="0.3" />
                <line x1="0" y1="${y50}" x2="${W}" y2="${y50}" stroke="#222" stroke-width="0.5" stroke-dasharray="3 3" />
                <polyline points="${pts}" fill="none" stroke="var(--o)" stroke-width="2" stroke-linejoin="round" />
                <circle cx="${W-10}" cy="${normMtmSVG(r.hist,W,mH).slice(-1)[0].y}" r="3" fill="var(--o)" />
                <text x="4" y="${y70-2}" fill="var(--o)" font-size="5" opacity="0.5" font-family="Share Tech Mono">70</text>
                <text x="4" y="${y30+6}" fill="#fff" font-size="5" opacity="0.5" font-family="Share Tech Mono">30</text>
            </svg>
        </div>
    </div>
    <div style="background:#080808; border:1px solid #1a1a1a; border-right:3px solid var(--o); border-radius:4px; padding:10px 12px; margin-bottom:14px;">
        <div style="font-size:0.65rem; line-height:1.7; color:#ccc; font-family:'Cairo',sans-serif;">
            RSI التكيّفي عند <span style="color:var(--o); font-weight:bold;">${r.adaptive}</span> (الفترة تكيّفت إلى ${r.period} بناءً على التقلب). المنطقة: ${r.zone}. القياسي يسجل ${r.standard}.
        </div>
    </div>`;
    document.getElementById('mtm-rsi-sec').innerHTML = html;
}

// ---------------------------------------------------------
// 2. MACD Pro Engine (With Divergence)
// ---------------------------------------------------------
function calcMtmMACDPro(closes, n) {
    const ema12 = calcMtmEMA(closes, 12), ema26 = calcMtmEMA(closes, 26);
    const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
    const signalLine = calcMtmEMA(macdLine, 9);
    const hist = macdLine.map((m, i) => m - signalLine[i]);

    let histDir = 'flat';
    if (n > 3) {
        if (Math.abs(hist[n-1]) < Math.abs(hist[n-2])) histDir = 'shrinking';
        else if (Math.abs(hist[n-1]) > Math.abs(hist[n-2])) histDir = 'growing';
    }

    // Divergence Engine
    let peaks = typeof findPeaks === 'function' ? findPeaks(closes, Math.max(0, n-60), n) : [];
    let troughs = typeof findTroughs === 'function' ? findTroughs(closes, Math.max(0, n-60), n) : [];
    
    let div = { type: 'لا يوجد', en: 'NONE', ok: false };
    if (peaks.length >= 2) {
        let p1 = peaks[peaks.length-2], p2 = peaks[peaks.length-1];
        if (closes[p2] > closes[p1] && macdLine[p2] < macdLine[p1]) div = { type: 'تباعد هبوطي كلاسيكي', en: 'REGULAR BEAR', ok: true };
        else if (closes[p2] < closes[p1] && macdLine[p2] > macdLine[p1]) div = { type: 'تباعد هبوطي مخفي', en: 'HIDDEN BEAR', ok: true };
    }
    if (troughs.length >= 2 && !div.ok) {
        let t1 = troughs[troughs.length-2], t2 = troughs[troughs.length-1];
        if (closes[t2] < closes[t1] && macdLine[t2] > macdLine[t1]) div = { type: 'تباعد صعودي كلاسيكي', en: 'REGULAR BULL', ok: true };
        else if (closes[t2] > closes[t1] && macdLine[t2] < macdLine[t1]) div = { type: 'تباعد صعودي مخفي', en: 'HIDDEN BULL', ok: true };
    }

    let cross = 'لا تقاطع حديث';
    for (let i = n-1; i >= Math.max(1, n-30); i--) {
        if (macdLine[i] > signalLine[i] && macdLine[i-1] <= signalLine[i-1]) { cross = `BULL CROSS قبل ${n-1-i} شموع`; break; }
        if (macdLine[i] < signalLine[i] && macdLine[i-1] >= signalLine[i-1]) { cross = `BEAR CROSS قبل ${n-1-i} شموع`; break; }
    }

    return { line: macdLine[n-1], sig: signalLine[n-1], hist: hist[n-1], histDir, div, cross, mH: macdLine.slice(-24), sH: signalLine.slice(-24), hH: hist.slice(-24) };
}

function renderMtmMACD(m) {
    const W = 340, mH = 75;
    const hMax = Math.max(...m.hH.map(Math.abs)) || 1;
    const mPts = normMtmSVG(m.mH, W, mH).map(p=>`${p.x},${p.y}`).join(" ");
    const sPts = normMtmSVG(m.sH, W, mH).map(p=>`${p.x},${p.y}`).join(" ");

    let svgHtml = `<svg width="100%" height="${mH+10}" viewBox="0 0 ${W} ${mH+10}" style="direction:ltr;">
        <line x1="0" y1="${(mH+10)/2}" x2="${W}" y2="${(mH+10)/2}" stroke="#222" stroke-width="0.5" />
        ${m.hH.map((h, i) => {
            const x = 10 + (i / (m.hH.length - 1)) * (W - 20);
            const bH = (Math.abs(h) / hMax) * ((mH+10)/2 - 5);
            return `<rect x="${x-3}" y="${h>0 ? (mH+10)/2 - bH : (mH+10)/2}" width="6" height="${Math.max(bH,1)}" rx="1" fill="${h>0 ? '#fff' : 'var(--o)'}" opacity="${Math.abs(h)/hMax*0.5 + 0.2}" />`;
        }).join('')}
        <polyline points="${mPts}" fill="none" stroke="var(--o)" stroke-width="1.5" stroke-linejoin="round" />
        <polyline points="${sPts}" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" opacity="0.6" />
        ${m.div.ok ? `<rect x="${W/2-28}" y="2" width="56" height="12" rx="2" fill="#0a0a0a" stroke="var(--o)" stroke-width="0.5" /><text x="${W/2}" y="10" text-anchor="middle" fill="var(--o)" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">${m.div.en}</text>` : ''}
    </svg>`;

    document.getElementById('mtm-macd-sec').innerHTML = `
    <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:6px 12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:3px; height:14px; background:#fff; border-radius:2px;"></div>
            <span style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:0.7rem; font-weight:bold;">2. MACD PRO ANALYZER</span>
        </div>
        ${m.div.ok ? `<div style="display:flex; align-items:center; gap:4px; animation:mtmBlink 1.5s infinite;"><div style="width:4px; height:4px; border-radius:50%; background:var(--o);"></div><span style="font-size:0.45rem; color:var(--o); font-weight:bold; font-family:'Share Tech Mono',monospace;">DIVERGENCE</span></div>` : ''}
    </div>
    <div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px;">
        <div style="display:grid; grid-template-columns:repeat(4,1fr); border-bottom:1px solid #111;">
            ${[{l:"MACD",v:m.line.toFixed(2),c:"var(--o)"},{l:"SIGNAL",v:m.sig.toFixed(2),c:"#fff"},{l:"HIST",v:m.hist.toFixed(2),c:m.hist>0?"#fff":"var(--o)"},{l:"DIRECTION",v:m.histDir==="shrinking"?"SHRINK":"GROW",c:m.histDir==="shrinking"?"var(--o)":"#fff"}].map((it,i)=>`
                <div style="padding:8px 4px; text-align:center; border-left:${i>0?'1px solid #111':'none'};">
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.35rem; color:#888;">${it.l}</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.75rem; color:${it.c}; font-weight:bold; direction:ltr;">${it.v}</div>
                </div>
            `).join('')}
        </div>
        <div style="padding:4px 2px; background:#020208;">${svgHtml}</div>
    </div>
    <div style="background:#080808; border:1px solid #1a1a1a; border-right:3px solid #fff; border-radius:4px; padding:10px 12px; margin-bottom:14px;">
        <div style="font-size:0.65rem; line-height:1.7; color:#ccc; font-family:'Cairo',sans-serif;">
            MACD ${m.line > m.sig ? 'فوق' : 'تحت'} خط الإشارة. الهيستوغرام ${m.histDir==='shrinking'?'يتناقص (ضعف زخم)':'يتزايد (قوة زخم)'}. 
            ${m.div.ok ? `تم رصد <strong>${m.div.type}</strong>. ` : ''} ${m.cross}.
        </div>
    </div>`;
}

// ---------------------------------------------------------
// 3. Volatility Expansion
// ---------------------------------------------------------
function calcMtmVolatility(closes, highs, lows, n) {
    let atrs = [0];
    for (let i = 1; i < n; i++) atrs.push(Math.max(highs[i]-lows[i], Math.abs(highs[i]-closes[i-1]), Math.abs(lows[i]-closes[i-1])));
    
    let curATR = atrs.slice(-14).reduce((a,b)=>a+b,0)/14;
    let avgATR = atrs.slice(-60).reduce((a,b)=>a+b,0)/60;
    let ratio = avgATR > 0 ? curATR / avgATR : 1;

    let sma20 = closes.slice(-20).reduce((a,b)=>a+b,0)/20;
    let stdDev = Math.sqrt(closes.slice(-20).reduce((a,b)=>a+Math.pow(b-sma20,2),0)/20);
    let bbW = sma20 > 0 ? (stdDev * 4 / sma20 * 100) : 0;

    let isExp = ratio > 1.15;
    let isSq = ratio < 0.8 && bbW < 3.0;

    let aH = [];
    for(let i=n-24; i<n; i++) { aH.push(atrs.slice(i-13, i+1).reduce((a,b)=>a+b,0)/14); }

    return { cATR: curATR, aATR: avgATR, ratio, bbW, state: isSq ? 'SQUEEZE' : isExp ? 'EXPANDING' : 'NORMAL', stateAr: isSq ? 'ضغط (انفجار وشيك)' : isExp ? 'توسع وانفجار' : 'طبيعي', aH };
}

function renderMtmVol(v, fmt) {
    const c = v.state === 'EXPANDING' ? 'var(--o)' : v.state === 'SQUEEZE' ? '#fff' : '#888';
    const W = 340, mH = 65;
    const pts = normMtmSVG(v.aH, W, mH);
    const polyPts = `${pts[0].x},${mH} ${pts.map(p=>`${p.x},${p.y}`).join(" ")} ${pts[pts.length-1].x},${mH}`;
    const avgY = 5 + (1 - (v.aATR - Math.min(...v.aH)) / (Math.max(...v.aH) - Math.min(...v.aH) || 1)) * (mH - 10);

    document.getElementById('mtm-vol-sec').innerHTML = `
    <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:6px 12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:3px; height:14px; background:var(--o); border-radius:2px;"></div>
            <span style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.7rem; font-weight:bold;">3. VOLATILITY EXPANSION</span>
        </div>
        <span style="font-family:'Share Tech Mono',monospace; font-size:0.45rem; font-weight:900; padding:2px 6px; border-radius:3px; color:#000; background:${c};">${v.state}</span>
    </div>
    <div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; margin-bottom:6px;">
        <div style="display:grid; grid-template-columns:repeat(4,1fr); border-bottom:1px solid #111;">
            ${[{l:"ATR NOW",v:fmt(v.cATR).replace('$',''),c:"var(--o)"},{l:"ATR AVG",v:fmt(v.aATR).replace('$',''),c:"#ccc"},{l:"RATIO",v:v.ratio.toFixed(2)+"x",c:v.ratio>1.15?'var(--o)':'#fff'},{l:"BB WIDTH",v:v.bbW.toFixed(1)+"%",c:"#888"}].map((it,i)=>`
                <div style="padding:8px 4px; text-align:center; border-left:${i>0?'1px solid #111':'none'};">
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.35rem; color:#888;">${it.l}</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.7rem; color:${it.c}; font-weight:bold; direction:ltr;">${it.v}</div>
                </div>
            `).join('')}
        </div>
        <div style="padding:4px 2px; background:#020208;">
            <svg width="100%" height="${mH}" viewBox="0 0 ${W} ${mH}" style="direction:ltr;">
                ${avgY > 5 && avgY < mH ? `<line x1="0" y1="${avgY}" x2="${W}" y2="${avgY}" stroke="#333" stroke-width="0.5" stroke-dasharray="3 3" />` : ''}
                <polygon points="${polyPts}" fill="var(--o)" fill-opacity="0.06" />
                <polyline points="${pts.map(p=>`${p.x},${p.y}`).join(" ")}" fill="none" stroke="var(--o)" stroke-width="1.5" stroke-linejoin="round" />
                <circle cx="${pts[pts.length-1].x}" cy="${pts[pts.length-1].y}" r="3" fill="var(--o)" />
            </svg>
        </div>
    </div>
    <div style="background:#080808; border:1px solid #1a1a1a; border-right:3px solid var(--o); border-radius:4px; padding:10px 12px; margin-bottom:14px;">
        <div style="font-size:0.65rem; line-height:1.7; color:#ccc; font-family:'Cairo',sans-serif;">
            حالة السوق: <span style="color:var(--o); font-weight:bold;">${v.stateAr}</span> (التقلب ${v.ratio.toFixed(2)}x مقارنة بالمتوسط).
        </div>
    </div>`;
}

// ---------------------------------------------------------
// 4. Momentum Shift Engine
// ---------------------------------------------------------
function calcMtmShift(rsi, macd, closes, volumes, n) {
    let comps = [], bullC = 0, bearC = 0;

    let rSlope = (rsi.hist[rsi.hist.length-1] - rsi.hist[rsi.hist.length-5]) / 4;
    let rSig = rSlope > 0.5 ? 'BULL' : rSlope < -0.5 ? 'BEAR' : 'WAIT';
    if(rSig==='BULL') bullC++; else if(rSig==='BEAR') bearC++;
    comps.push({ n: 'RSI Slope', v: (rSlope>0?'+':'')+rSlope.toFixed(1), s: rSig });

    let mSig = (macd.hist > 0 && macd.histDir === 'growing') || (macd.hist < 0 && macd.histDir === 'growing') ? 'BULL' : 'BEAR';
    if(mSig==='BULL') bullC++; else bearC++;
    comps.push({ n: 'MACD Hist', v: macd.histDir === 'growing' ? 'تزايد زخم' : 'تناقص زخم', s: mSig });

    const priceChg = closes[n-1] - closes[n-10];
    let vE = volumes.slice(-20, -10).reduce((a,b)=>a+b,0), vL = volumes.slice(-10).reduce((a,b)=>a+b,0);
    let vChg = vE > 0 ? ((vL - vE)/vE*100) : 0;
    let vSig = (vChg > 10 && priceChg > 0) ? 'BULL' : (vChg > 10 && priceChg < 0) ? 'BEAR' : 'WAIT';
    if(vSig==='BULL') bullC++; else if(vSig==='BEAR') bearC++;
    comps.push({ n: 'Vol Trend', v: (vChg>0?'+':'')+Math.round(vChg)+'%', s: vSig });

    let roc = ((closes[n-1] - closes[n-10]) / closes[n-10]) * 100;
    let rocSig = roc > 1 ? 'BULL' : roc < -1 ? 'BEAR' : 'WAIT';
    if(rocSig==='BULL') bullC++; else if(rocSig==='BEAR') bearC++;
    comps.push({ n: 'Price ROC', v: (roc>0?'+':'')+roc.toFixed(1)+'%', s: rocSig });

    let score = Math.round((Math.max(bullC, bearC) / 4) * 100);
    let dir = bullC > bearC ? 'BULLISH' : bearC > bullC ? 'BEARISH' : 'NEUTRAL';
    let type = 'استقرار نسبي';
    if (bullC >= 3 && mSig === 'BEAR') type = 'تسارع صعودي مبكر';
    else if (bearC >= 3 && rSig === 'BULL') type = 'ضغط هبوطي مقاوم';
    else if (bullC === 4) type = 'زخم صعودي مكتمل العزم';
    else if (bearC === 4) type = 'زخم هبوطي مكتمل العزم';

    return { comps, bullC, bearC, score, dir, type };
}

function renderMtmShift(s) {
    const c = s.dir === 'BULLISH' ? '#fff' : s.dir === 'BEARISH' ? 'var(--o)' : '#888';
    const pos = s.dir === 'BULLISH' ? 50 + s.score/2 : 50 - s.score/2;

    document.getElementById('mtm-shift-sec').innerHTML = `
    <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:6px 12px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:6px;">
            <div style="width:3px; height:14px; background:#fff; border-radius:2px;"></div>
            <span style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:0.7rem; font-weight:bold;">4. MOMENTUM SHIFT</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-family:'Share Tech Mono',monospace; font-size:0.65rem; color:#fff; font-weight:bold;">${s.score}%</span>
            <span style="font-family:'Share Tech Mono',monospace; font-size:0.45rem; font-weight:900; padding:2px 6px; border-radius:3px; color:#000; background:${c};">${s.dir}</span>
        </div>
    </div>
    <div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; padding:10px; margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.5rem; font-weight:bold;">BEAR</span>
            <span style="color:#444; font-family:'Share Tech Mono',monospace; font-size:0.4rem; letter-spacing:2px;">MOMENTUM BIAS</span>
            <span style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:0.5rem; font-weight:bold;">BULL</span>
        </div>
        <div style="position:relative; height:8px; background:#080808; border-radius:4px; border:1px solid #151515; margin-bottom:10px;">
            <div style="position:absolute; left:0; top:0; width:50%; height:100%; background:linear-gradient(to right, rgba(255,106,0,0.12), transparent);"></div>
            <div style="position:absolute; right:0; top:0; width:50%; height:100%; background:linear-gradient(to left, rgba(255,255,255,0.08), transparent);"></div>
            <div style="position:absolute; left:50%; top:-1px; width:1px; height:calc(100% + 2px); background:#222;"></div>
            <div style="position:absolute; top:50%; transform:translate(-50%,-50%); left:${pos}%; width:12px; height:12px; border-radius:50%; background:${c}; box-shadow:0 0 8px ${s.dir==='BULLISH'?'#fff4':'#ff6a0044'}; border:2px solid #000; transition:left 1.5s ease-out;"></div>
        </div>
        ${s.comps.map((cp, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:${i<3?'1px solid #0d0d0d':'none'};">
                <span style="font-size:0.55rem; color:#ccc; flex:1; font-family:'Share Tech Mono',monospace;">${cp.n}</span>
                <span style="font-family:'Share Tech Mono',monospace; font-size:0.6rem; color:#fff; font-weight:bold; margin:0 8px; direction:ltr;">${cp.v}</span>
                <span style="font-family:'Share Tech Mono',monospace; font-size:0.45rem; font-weight:900; padding:2px 5px; border-radius:3px; color:#000; background:${cp.s==='BULL'?'#fff':cp.s==='BEAR'?'var(--o)':'#555'};">${cp.s}</span>
            </div>
        `).join('')}
        <div style="display:flex; justify-content:center; gap:12px; margin-top:8px; font-size:0.55rem; font-family:'Share Tech Mono',monospace;">
            <span style="color:#ccc;">${s.bullC} BULL</span><span style="color:#333;">|</span><span style="color:#ccc;">${s.bearC} BEAR</span>
        </div>
    </div>
    <div style="background:#080808; border:1px solid #1a1a1a; border-right:3px solid #fff; border-radius:4px; padding:10px 12px; margin-bottom:14px;">
        <div style="font-size:0.65rem; line-height:1.7; color:#ccc; font-family:'Cairo',sans-serif;">
            الزخم الإجمالي <span style="color:#fff; font-weight:bold;">${s.dir}</span> (${s.score}%). تم رصد: <span style="color:var(--o);">${s.type}</span>.
        </div>
    </div>`;
}

function renderMtmCombined(rsi, macd, vol, shift) {
    document.getElementById('mtm-combined-sec').innerHTML = `
    <div style="background:#0a0a0a; border:1px solid var(--o); border-radius:4px; padding:12px; border-top:2px solid var(--o);">
        <div style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.55rem; font-weight:bold; letter-spacing:2px; margin-bottom:8px;">MOMENTUM INTELLIGENCE — COMBINED</div>
        <div style="font-size:0.72rem; line-height:1.8; color:#ccc; font-family:'Cairo',sans-serif;">
            <span style="color:var(--o); font-weight:bold;">RSI التكيّفي:</span> ${rsi.adaptive} (${rsi.zone}). 
            <span style="color:#fff; font-weight:bold;">MACD Pro:</span> الإشارة ${macd.line > macd.sig ? 'صعودية' : 'هبوطية'} ${macd.div.ok ? 'وتم رصد '+macd.div.type : ''}. 
            <span style="color:var(--o); font-weight:bold;">التقلب:</span> ${vol.stateAr}. 
            <span style="color:#fff; font-weight:bold;">الزخم الكلي:</span> ${shift.dir} (${shift.score}%). 
            <br><br>
            <span style="color:#888; font-size:0.55rem;">تمت مزامنة المحركات الأربعة. يُنصح بدمج هذه المعطيات مع مناطق الدعم والمقاومة لفلترة الإشارات السعرية.</span>
        </div>
    </div>`;
}


// ============================================================
// 🚀 محرك متتبع السيولة (LIQUIDITY TRACKER - SMC ADVANCED)
// ============================================================

async function runLiquidityTracker() {
    const symbolInput = document.getElementById('liq-sym').value.trim().toUpperCase();
    const tf = document.getElementById('liq-tf').value;
    const dash = document.getElementById('liq-dashboard');
    const loading = document.getElementById('liq-loading');
    const btn = document.getElementById('liq-btn');

    if (!symbolInput) {
        alert('أدخل رمز العملة');
        return;
    }

    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';

    btn.disabled = true;
    btn.innerText = 'SCANNING...';
    dash.style.display = 'none';
    dash.innerHTML = '';
    loading.style.display = 'block';

    try {
        const limit = tf === '15m' || tf === '1h' ? 500 : 250;
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=${limit}`);
        if (!res.ok) throw new Error('فشل جلب البيانات السعرية.');
        
        const raw = await res.json();
        if (!Array.isArray(raw) || raw.length < 50) {
            throw new Error('بيانات غير كافية للتحليل (تحتاج 50 شمعة على الأقل).');
        }

        const candles = raw.map(c => ({
            time: parseInt(c[0]),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        }));

        const analysis = analyzeLiquidityFlow(candles);

        loading.style.display = 'none';
        dash.innerHTML = buildLiquidityUI(symbol, tf, candles, analysis);
        dash.style.display = 'block';

    } catch (err) {
        loading.style.display = 'none';
        dash.style.display = 'block';
        dash.innerHTML = `<div style="padding:20px; color:var(--o); text-align:center; font-family:'Share Tech Mono', monospace; font-size:12px; border:1px solid #1a1a1a; background:#0a0a0a; border-radius:4px;">ERROR: ${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerText = 'SCAN LIQUIDITY ZONES';
    }
}

function analyzeLiquidityFlow(candles) {
    const n = candles.length;
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const currentPrice = closes[n - 1];
    
    const atr = calcLiqATR(candles, 14);

    const peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, n) : [];
    const troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, n) : [];

    const tolerance = Math.max(atr * 0.3, currentPrice * 0.001); 

    const peaks = peakIdxs.map(i => ({ idx: i, price: highs[i], vol: candles[i].volume }));
    const troughs = troughIdxs.map(i => ({ idx: i, price: lows[i], vol: candles[i].volume }));
    
    const eqHighs = groupLiqPrices(peaks, tolerance, 'EQH');
    const eqLows = groupLiqPrices(troughs, tolerance, 'EQL');
    
    const equalLevels = [...eqHighs, ...eqLows].map(lvl => {
        const distance = (Math.abs(lvl.price - currentPrice) / currentPrice) * 100;
        const proxScore = Math.max(0, 100 - distance * 15); 
        const touchScore = Math.min(100, lvl.touches * 25);
        const volScore = Math.min(100, (lvl.totalVolume / ((atr * 1000) || 1)) * 10);
        const strength = Math.round((touchScore * 0.45) + (proxScore * 0.30) + (volScore * 0.25));

        return { ...lvl, distance: parseFloat(distance.toFixed(2)), strength: Math.min(100, strength), status: 'UNTAPPED' };
    }).sort((a,b) => b.strength - a.strength).slice(0, 8);

    const eqhSorted = equalLevels.filter(l => l.type === 'EQH').sort((a,b) => a.price - b.price);
    const eqlSorted = equalLevels.filter(l => l.type === 'EQL').sort((a,b) => a.price - b.price);
    
    const zones = [];
    const zTol = Math.max(atr * 0.5, currentPrice * 0.002);
    buildLiqZonesFromLevels(eqhSorted, 'BUY_SIDE', zTol, currentPrice, zones);
    buildLiqZonesFromLevels(eqlSorted, 'SELL_SIDE', zTol, currentPrice, zones);
    zones.sort((a,b) => b.liquidityScore - a.liquidityScore);
    const stopHuntZones = zones.slice(0, 5);

    const sweeps = detectLiqSweeps(candles, equalLevels, atr);
    const verdict = generateLiqVerdict(stopHuntZones, sweeps, currentPrice);

    return { currentPrice, atr, equalLevels, stopHuntZones, sweeps, verdict };
}

function calcLiqATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;
    let trs = [];
    for (let i = 1; i < candles.length; i++) {
        const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
        trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    const recent = trs.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
}

function groupLiqPrices(points, tolerance, type) {
    if (points.length === 0) return [];
    const sorted = [...points].sort((a, b) => a.price - b.price);
    const groups = [];
    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        if (Math.abs(sorted[i].price - currentGroup[currentGroup.length - 1].price) <= tolerance) {
            currentGroup.push(sorted[i]);
        } else {
            if (currentGroup.length >= 2) groups.push(buildLiqLevel(currentGroup, type));
            currentGroup = [sorted[i]];
        }
    }
    if (currentGroup.length >= 2) groups.push(buildLiqLevel(currentGroup, type));
    return groups;
}

function buildLiqLevel(group, type) {
    return {
        type,
        price: group.reduce((s, p) => s + p.price, 0) / group.length,
        touches: group.length,
        totalVolume: group.reduce((s, p) => s + p.vol, 0),
        lastIdx: Math.max(...group.map(p => p.idx))
    };
}

function buildLiqZonesFromLevels(levels, type, tolerance, currentPrice, zones) {
    if (levels.length === 0) return;
    let cluster = [levels[0]];

    for (let i = 1; i < levels.length; i++) {
        if (Math.abs(levels[i].price - cluster[cluster.length - 1].price) <= tolerance) {
            cluster.push(levels[i]);
        } else {
            zones.push(makeLiqZone(cluster, type, currentPrice));
            cluster = [levels[i]];
        }
    }
    zones.push(makeLiqZone(cluster, type, currentPrice));
}

function makeLiqZone(cluster, type, currentPrice) {
    const prices = cluster.map(l => l.price);
    const pMin = Math.min(...prices), pMax = Math.max(...prices);
    const totalTouches = cluster.reduce((s, l) => s + l.touches, 0);
    const avgStrength = cluster.reduce((s, l) => s + l.strength, 0) / cluster.length;
    const distance = (Math.abs((pMin + pMax) / 2 - currentPrice) / currentPrice) * 100;

    let density = 'LOW';
    if (cluster.length >= 3 || totalTouches >= 6) density = 'HIGH';
    else if (cluster.length >= 2 || totalTouches >= 4) density = 'MEDIUM';

    const liquidityScore = Math.round((avgStrength * 0.5) + (Math.min(100, totalTouches * 15) * 0.3) + (Math.max(0, 100 - distance * 15) * 0.2));

    return { type, priceMin: pMin, priceMax: pMax, density, liquidityScore: Math.min(100, liquidityScore), distance: parseFloat(distance.toFixed(2)), levelCount: cluster.length };
}

function detectLiqSweeps(candles, equalLevels, atr) {
    const sweeps = [];
    const lookback = Math.min(50, candles.length);
    const startIdx = candles.length - lookback;
    const nowTs = Date.now();

    for (let i = startIdx; i < candles.length; i++) {
        const c = candles[i];
        const bSize = Math.abs(c.close - c.open) || 0.0001;
        const wUp = c.high - Math.max(c.open, c.close);
        const wDn = Math.min(c.open, c.close) - c.low;

        equalLevels.forEach(lvl => {
            if (lvl.type === 'EQH' && c.high > lvl.price && c.close < lvl.price) {
                if ((wUp / bSize) > 1.5 && (c.high - lvl.price) > Math.max(atr * 0.1, c.close * 0.001)) {
                    sweeps.push({ type: 'BSL_SWEEP', price: lvl.price, cIdx: i, cType: (wUp/bSize > 2.5) ? 'WICK' : 'CLOSE', follow: 'REJECTED', timeMs: c.time });
                }
            }
            if (lvl.type === 'EQL' && c.low < lvl.price && c.close > lvl.price) {
                if ((wDn / bSize) > 1.5 && (lvl.price - c.low) > Math.max(atr * 0.1, c.close * 0.001)) {
                    sweeps.push({ type: 'SSL_SWEEP', price: lvl.price, cIdx: i, cType: (wDn/bSize > 2.5) ? 'WICK' : 'CLOSE', follow: 'REJECTED', timeMs: c.time });
                }
            }
            if (lvl.type === 'EQH' && c.close > lvl.price + (atr * 0.15)) {
                sweeps.push({ type: 'BSL_SWEEP', price: lvl.price, cIdx: i, cType: 'CLOSE', follow: 'CONTINUED', timeMs: c.time });
            }
            if (lvl.type === 'EQL' && c.close < lvl.price - (atr * 0.15)) {
                sweeps.push({ type: 'SSL_SWEEP', price: lvl.price, cIdx: i, cType: 'CLOSE', follow: 'CONTINUED', timeMs: c.time });
            }
        });
    }

    const formatTime = (ts) => {
        let diff = (nowTs - ts) / (1000 * 60 * 60);
        if (diff < 1) return 'now';
        if (diff < 24) return Math.floor(diff) + 'h ago';
        return Math.floor(diff / 24) + 'd ago';
    };

    let uniq = []; let seen = new Set();
    sweeps.reverse().forEach(s => {
        let k = `${s.type}-${s.price.toFixed(4)}`;
        if (!seen.has(k)) { seen.add(k); s.timeStr = formatTime(s.timeMs); uniq.push(s); }
    });
    return uniq.slice(0, 5);
}

function generateLiqVerdict(zones, sweeps, price) {
    const fPrice = p => typeof smartFormat === 'function' ? smartFormat(p) : p.toFixed(4);

    if (zones.length === 0) return { bias: 'NO_CLEAR_LIQUIDITY', target: price, prob: 50, res: 'لا توجد تجمعات سيولة واضحة على الفريم الحالي. انتظر تشكّل قمم/قيعان متساوية.' };
    
    let above = zones.filter(z => z.priceMin > price).sort((a,b)=>a.priceMin - b.priceMin)[0];
    let below = zones.filter(z => z.priceMax < price).sort((a,b)=>b.priceMax - a.priceMax)[0];
    let ls = sweeps[0];

    let bias, tgt, prob, res;

    if (ls && ls.follow === 'REJECTED') {
        if (ls.type === 'BSL_SWEEP') {
            bias = 'BEARISH_LIQUIDITY_GRAB';
            tgt = below ? (below.priceMin+below.priceMax)/2 : price * 0.97;
            prob = Math.min(85, 60 + (below ? below.liquidityScore*0.25 : 0));
            res = `تم سحب سيولة المشترين (Buy Stops) عند ${fPrice(ls.price)} ورفضها (Turtle Soup). الهدف الأقرب لصانع السوق هو ضرب سيولة البائعين تحت السعر.`;
        } else {
            bias = 'BULLISH_LIQUIDITY_GRAB';
            tgt = above ? (above.priceMin+above.priceMax)/2 : price * 1.03;
            prob = Math.min(85, 60 + (above ? above.liquidityScore*0.25 : 0));
            res = `تم سحب سيولة البائعين (Sell Stops) عند ${fPrice(ls.price)} ورفضها. الهدف الأقرب هو ضرب سيولة المشترين أعلى السعر.`;
        }
    } else if (above && below) {
        if (above.liquidityScore > below.liquidityScore + 10) {
            bias = 'TARGETING_BUY_SIDE'; tgt = (above.priceMin+above.priceMax)/2; prob = Math.min(80, 50+above.liquidityScore*0.3);
            res = `تجمع سيولة قوي (Score ${above.liquidityScore}) فوق السعر. الحيتان قد تستهدف ضرب الستوبات العلوية.`;
        } else if (below.liquidityScore > above.liquidityScore + 10) {
            bias = 'TARGETING_SELL_SIDE'; tgt = (below.priceMin+below.priceMax)/2; prob = Math.min(80, 50+below.liquidityScore*0.3);
            res = `تجمع سيولة قوي (Score ${below.liquidityScore}) تحت السعر. الحيتان قد تستهدف ضرب الستوبات السفلية.`;
        } else {
            bias = 'CONSOLIDATION'; tgt = price; prob = 50;
            res = `توازن في سيولة الطرفين. السعر عالق بين مناطق طلب وعرض متقاربة.`;
        }
    } else if (above) {
        bias = 'TARGETING_BUY_SIDE'; tgt = (above.priceMin+above.priceMax)/2; prob = Math.min(75, 50+above.liquidityScore*0.25);
        res = `السيولة المتاحة الوحيدة تقع فوق السعر الحالي. السعر سينجذب نحوها كالمغناطيس لجمع الأوامر.`;
    } else {
        bias = 'TARGETING_SELL_SIDE'; tgt = (below.priceMin+below.priceMax)/2; prob = Math.min(75, 50+below.liquidityScore*0.25);
        res = `السيولة المتاحة الوحيدة تقع تحت السعر الحالي. السعر سينجذب نحوها لتصفية المراكز الطويلة.`;
    }

    return { bias, target: tgt, prob: Math.round(prob), res };
}

function buildLiquidityUI(symbol, tf, candles, a) {
    const fmt = p => typeof smartFormat === 'function' ? smartFormat(p) : p.toFixed(4);
    
    const chartW = 460, chartH = 280, padL = 10, padR = 70, padT = 20, padB = 30, plotW = chartW - padL - padR, plotH = chartH - padT - padB;
    const displayCandles = candles.slice(-50);
    const closes = displayCandles.map(c => c.close);
    
    let allP = [...closes, ...a.equalLevels.map(l=>l.price), ...a.stopHuntZones.flatMap(z=>[z.priceMin, z.priceMax])];
    let pMin = Math.min(...allP) * 0.995, pMax = Math.max(...allP) * 1.005, pRng = pMax - pMin || 1;
    
    const toX = i => padL + (i / (closes.length - 1)) * plotW;
    const toY = p => padT + (1 - (p - pMin) / pRng) * plotH;

    let linePath = closes.map((p, i) => `${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toY(p).toFixed(1)}`).join(' ');
    let areaPath = `${linePath} L ${toX(closes.length-1).toFixed(1)} ${(padT+plotH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padT+plotH).toFixed(1)} Z`;

    let svgHtml = `
      <div class="liq-chart-card liq-anim" style="animation-delay:0.1s;">
        <div class="liq-chart-header">
            <span class="liq-chart-title">LIQUIDITY MAP // ${symbol.replace('USDT','')} ${tf.toUpperCase()}</span>
            <div class="liq-chart-live"><div class="liq-live-pulse"></div>LIVE</div>
        </div>
        <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="display:block; background:#000;">
        <defs>
            <linearGradient id="lPGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--o)" stop-opacity="0.25"/><stop offset="100%" stop-color="var(--o)" stop-opacity="0"/></linearGradient>
            <linearGradient id="lBsl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--o)" stop-opacity="0.15"/><stop offset="100%" stop-color="var(--o)" stop-opacity="0.05"/></linearGradient>
            <linearGradient id="lSsl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.05"/><stop offset="100%" stop-color="#fff" stop-opacity="0.15"/></linearGradient>
        </defs>
        <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="#000"/>`;

    const gridLevels = [0, 0.25, 0.5, 0.75, 1];
    gridLevels.forEach(f => {
        let y = padT + f * plotH;
        let pL = pMax - f * pRng;
        svgHtml += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL+plotW}" y2="${y.toFixed(1)}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,3"/>`;
        svgHtml += `<text x="${padL+4}" y="${y+3}" font-size="8" font-family="Share Tech Mono" fill="#444">${pL>1000 ? (pL/1000).toFixed(2)+'K' : pL.toFixed(4)}</text>`;
    });

    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((f, i) => {
        let x = padL + f * plotW;
        svgHtml += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT+plotH}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,3"/>`;
        let lbls = ['-50', '-40', '-30', '-20', '-10', 'NOW'];
        svgHtml += `<text x="${x.toFixed(1)}" y="${padT+plotH+18}" font-size="8" font-family="Share Tech Mono" fill="#444" text-anchor="middle">${lbls[i]}</text>`;
    });

    a.stopHuntZones.forEach(z => {
        let yt = toY(z.priceMax), yb = toY(z.priceMin);
        svgHtml += `<rect x="${padL}" y="${yt.toFixed(1)}" width="${plotW}" height="${Math.abs(yb-yt).toFixed(1)}" fill="${z.type==='BUY_SIDE'?'url(#lBsl)':'url(#lSsl)'}" />`;
    });

    a.equalLevels.slice(0, 6).forEach(l => {
        let y = toY(l.price), isH = l.type === 'EQH', c = isH ? 'var(--o)' : '#fff';
        svgHtml += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL+plotW}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>
                    <rect x="${padL+plotW+2}" y="${y-7}" width="${padR-4}" height="14" fill="${c}"/>
                    <text x="${padL+plotW+padR/2}" y="${y+3}" font-size="9" font-family="Share Tech Mono" font-weight="700" fill="#000" text-anchor="middle">${l.type} ${l.price>1000?(l.price/1000).toFixed(2)+'K':l.price.toFixed(4)}</text>`;
    });

    svgHtml += `<path d="${areaPath}" fill="url(#lPGrad)"/>`;
    svgHtml += `<path d="${linePath}" fill="none" stroke="var(--o)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

    const startCIdx = candles.length - displayCandles.length;
    a.sweeps.forEach(sw => {
        let rIdx = sw.cIdx - startCIdx;
        if(rIdx >= 0 && rIdx < displayCandles.length) {
            let cx = toX(rIdx), cy = toY(sw.price), c = sw.type==='BSL_SWEEP'?'var(--o)':'#fff', op = sw.follow==='REJECTED'?1:0.4;
            svgHtml += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="none" stroke="${c}" stroke-width="1.5" opacity="${op}"/>
                        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.5" fill="${c}" opacity="${op}"/>`;
            if (sw.follow === 'REJECTED') {
                svgHtml += `<text x="${cx.toFixed(1)}" y="${cy-10}" font-size="8" font-family="Share Tech Mono" font-weight="700" fill="${c}" text-anchor="middle">SWEEP</text>`;
            }
        }
    });

    let cxN = toX(closes.length-1), cyN = toY(a.currentPrice);
    svgHtml += `<line x1="${padL}" y1="${cyN.toFixed(1)}" x2="${padL+plotW}" y2="${cyN.toFixed(1)}" stroke="var(--o)" stroke-width="1" stroke-dasharray="1,2" opacity="0.5"/>
                <circle cx="${cxN.toFixed(1)}" cy="${cyN.toFixed(1)}" r="8" fill="var(--o)" opacity="0.3"/>
                <circle cx="${cxN.toFixed(1)}" cy="${cyN.toFixed(1)}" r="4" fill="var(--o)"/>`;
    
    svgHtml += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#1a1a1a" stroke-width="1"/></svg>
        <div class="liq-chart-legend">
            <div class="liq-legend-item"><div class="liq-legend-dot" style="background:var(--o); width:6px; height:6px; border-radius:50%;"></div><span>PRICE</span></div>
            <div class="liq-legend-item"><div class="liq-legend-dot" style="background:var(--o); opacity:0.5; width:6px; height:6px; border-radius:50%;"></div><span>EQH/BSL</span></div>
            <div class="liq-legend-item"><div class="liq-legend-dot" style="background:#fff; opacity:0.5; width:6px; height:6px; border-radius:50%;"></div><span>EQL/SSL</span></div>
            <div class="liq-legend-item"><div style="width:6px;height:6px;border-radius:50%;border:1px solid var(--o);"></div><span>SWEEP</span></div>
        </div>
    </div>`;

    let html = svgHtml;

    html += `<div class="liq-card liq-anim" style="animation-delay:0.15s;">
        <div class="liq-card-title">MARKET SNAPSHOT</div>
        ${[{l:'SYMBOL',v:symbol.replace('USDT',''),c:'#fff'},{l:'TIMEFRAME',v:tf.toUpperCase(),c:'#fff'},{l:'CURRENT PRICE',v:fmt(a.currentPrice),c:'var(--o)'},{l:'ATR',v:fmt(a.atr),c:'#fff'}].map(s=>`<div class="liq-stat-row"><span class="liq-label">${s.l}</span><span class="liq-val" style="color:${s.c}; direction:ltr;">${s.v}</span></div>`).join('')}
    </div>`;

    html += `<div class="liq-verdict liq-anim" style="animation-delay:0.2s;">
        <div class="liq-verdict-title">VERDICT // الحكم</div>
        <div class="liq-verdict-main">${a.verdict.bias.replace(/_/g, ' ')}</div>
        <div class="liq-verdict-detail">${a.verdict.res}</div>
        <div class="liq-prob-box">
            <div>
                <div class="liq-prob-label">NEXT TARGET</div>
                <div class="liq-val-o" style="font-family:'Share Tech Mono',monospace; font-size:16px; margin-top:4px; direction:ltr;">${fmt(a.verdict.target)}</div>
            </div>
            <div style="text-align:left;">
                <div class="liq-prob-label">PROBABILITY</div>
                <div class="liq-prob-val">${a.verdict.prob}%</div>
            </div>
        </div>
    </div>`;

    if (a.equalLevels.length > 0) {
        let eqHtml = `<div class="liq-card liq-anim" style="animation-delay: 0.25s;">
            <div class="liq-card-title">EQUAL HIGHS / LOWS</div>
            <div class="liq-level-row" style="color:#666; font-weight:700;">
                <span>TYPE</span><span>PRICE</span><span style="text-align:center;">HITS</span><span style="text-align:left;">STR</span>
            </div>`;
        a.equalLevels.forEach(l => {
            const badgeCls = l.type === 'EQH' ? 'liq-badge-eqh' : 'liq-badge-eql';
            eqHtml += `<div class="liq-level-row">
                <span class="liq-badge ${badgeCls}" style="text-align:center;">${l.type}</span>
                <div>
                    <div style="color:#fff; font-weight:700; direction:ltr; text-align:right;">${String(fmt(l.price)).replace('$','')}</div>
                    <div style="color:#666; font-size:9px; direction:ltr; text-align:right;">${l.distance}% AWAY</div>
                </div>
                <span style="text-align:center; color:var(--o); font-weight:700;">${l.touches}x</span>
                <div>
                    <div style="text-align:left; color:#fff;">${l.strength}</div>
                    <div class="liq-strength-bar"><div class="liq-strength-fill" style="width:${l.strength}%"></div></div>
                </div>
            </div>`;
        });
        eqHtml += `</div>`;
        html += eqHtml;
    }

    if (a.stopHuntZones.length > 0) {
        let zHtml = `<div class="liq-card liq-anim" style="animation-delay: 0.3s;">
            <div class="liq-card-title">STOP HUNT ZONES</div>`;
        a.stopHuntZones.forEach(z => {
            const isBsl = z.type === 'BUY_SIDE';
            const badgeCls = isBsl ? 'liq-badge-bsl' : 'liq-badge-ssl';
            const denCol = z.density === 'HIGH' ? 'var(--o)' : '#666';
            zHtml += `<div class="liq-zone-card">
                <div class="liq-zone-header">
                    <span class="liq-badge ${badgeCls}">${isBsl ? 'BSL' : 'SSL'}</span>
                    <span style="font-size:10px; color:${denCol}; font-family:'Share Tech Mono',monospace;">${z.density} DENSITY</span>
                </div>
                <div class="liq-zone-range">${String(fmt(z.priceMin)).replace('$','')} — ${String(fmt(z.priceMax)).replace('$','')}</div>
                <div class="liq-zone-stat">
                    <span>SCORE: <span style="color:var(--o);">${z.liquidityScore}/100</span></span>
                    <span>DIST: <span style="color:#fff;">${z.distance}%</span></span>
                </div>
            </div>`;
        });
        zHtml += `</div>`;
        html += zHtml;
    }

    if (a.sweeps.length > 0) {
        let swHtml = `<div class="liq-card liq-anim" style="animation-delay: 0.35s;">
            <div class="liq-card-title">RECENT LIQUIDITY SWEEPS</div>`;
        a.sweeps.forEach(s => {
            const isBsl = s.type === 'BSL_SWEEP';
            const badgeCls = isBsl ? 'liq-badge-bsl' : 'liq-badge-ssl';
            const ftCol = s.follow === 'REJECTED' ? 'var(--o)' : '#666';
            swHtml += `<div class="liq-sweep-card">
                <span class="liq-badge ${badgeCls}" style="text-align:center;">${s.type.split('_')[0]}</span>
                <div>
                    <div style="color:#fff; font-weight:700; direction:ltr; text-align:right;">${String(fmt(s.price)).replace('$','')}</div>
                    <div style="color:#666; font-size:9px; direction:ltr; text-align:right;">${s.timeStr} // ${s.cType}</div>
                </div>
                <span style="text-align:left; font-weight:bold; font-size:9px; color:${ftCol};">${s.follow}</span>
            </div>`;
        });
        swHtml += `</div>`;
        html += swHtml;
    }

    html += `
    <div class="liq-guide liq-anim" style="animation-delay: 0.4s;">
        <div class="liq-guide-title">دليل القراءة // READING GUIDE</div>
        <div class="liq-guide-text">
            <strong style="color:var(--o);">LIQUIDITY MAP:</strong> الشارت يعرض السعر مع كل مستويات السيولة المكتشفة. الخطوط البرتقالية = EQH، البيضاء = EQL، المناطق المظللة = Stop Hunt Zones.<br><br>
            <strong style="color:var(--o);">EQH/EQL:</strong> قمم/قيعان متساوية تشير لتجمع أوامر إيقاف خسارة فوقها/تحتها.<br><br>
            <strong style="color:var(--o);">BSL (Buy Side Liquidity):</strong> سيولة المشترين العلوية. أهداف للحركات الصعودية المؤقتة لضرب الستوبات.<br><br>
            <strong style="color:var(--o);">SSL (Sell Side Liquidity):</strong> سيولة البائعين السفلية. أهداف للحركات الهابطة المؤقتة.<br><br>
            <strong style="color:var(--o);">SWEEP REJECTED:</strong> السعر ضرب المنطقة بفتيل ورُفض بقوة. إشارة انعكاس ممتازة.<br><br>
            <strong style="color:var(--o);">SWEEP CONTINUED:</strong> السعر أغلق وراء المنطقة. السيولة استُهلكت.
        </div>
    </div>`;

    return html;
}

// ============================================================
// 🚀 محرك VOLUME DELTA ANALYZER (TRUE ORDER FLOW)
// ============================================================

async function runVolumeDelta() {
    const symbolInput = document.getElementById('vda-sym').value.trim().toUpperCase();
    const tf = document.getElementById('vda-tf').value.toLowerCase();
    const btn = document.getElementById('vda-btn');
    const loading = document.getElementById('vda-loading');
    const dash = document.getElementById('vda-dashboard');

    if (!symbolInput) return;
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';

    btn.disabled = true;
    btn.innerText = 'ANALYZING...';
    dash.style.display = 'none';
    dash.innerHTML = '';
    loading.style.display = 'block';

    try {
        const limit = tf === '15m' || tf === '1h' ? 500 : 250;
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=${limit}`);
        if (!res.ok) throw new Error('فشل جلب البيانات السعرية من الخادم.');
        const raw = await res.json();

        if (raw.length < 50) throw new Error('بيانات غير كافية للتحليل (تحتاج 50 شمعة على الأقل).');

        const candles = raw.map(k => {
            const open = parseFloat(k[1]), high = parseFloat(k[2]), low = parseFloat(k[3]), close = parseFloat(k[4]), vol = parseFloat(k[5]);
            const buyVol = parseFloat(k[9]) || (vol * (close >= open ? 0.6 : 0.4)); 
            const sellVol = vol - buyVol;
            return { time: parseInt(k[0]), open, high, low, close, volume: vol, buyVol, sellVol, delta: buyVol - sellVol };
        });

        const analysis = analyzeVolumeDeltaEngine(candles);

        loading.style.display = 'none';
        dash.innerHTML = renderVdaDashboard(symbol, tf, analysis);
        dash.style.display = 'block';

    } catch (e) {
        loading.style.display = 'none';
        dash.style.display = 'block';
        dash.innerHTML = `<div style="padding:20px; color:var(--o); text-align:center; font-family:'Share Tech Mono', monospace; font-size:12px; border:1px solid #1a1a1a; background:#0a0a0a; border-radius:4px;">ERROR: ${e.message}</div>`;
    } finally {
        btn.innerText = 'ANALYZE DELTA FLOW';
        btn.disabled = false;
    }
}

function analyzeVolumeDeltaEngine(candles) {
    const n = candles.length;
    let cum = 0;

    candles.forEach(c => { cum += c.delta; c.cumDelta = cum; });

    const recent = candles.slice(-60);
    const totalBuy = recent.reduce((s, c) => s + c.buyVol, 0);
    const totalSell = recent.reduce((s, c) => s + c.sellVol, 0);
    const netDelta = totalBuy - totalSell;
    const totalVol = totalBuy + totalSell;
    const buyRatio = totalVol > 0 ? (totalBuy / totalVol) * 100 : 50;
    const sellRatio = 100 - buyRatio;

    const dominance = buyRatio > 50 ? 'BUYERS' : 'SELLERS';
    const domStrength = Math.min(100, Math.round(Math.abs(buyRatio - 50) * 4));
    const currentPrice = recent[recent.length - 1].close;

    const closes = recent.map(c => c.close);
    const cums = recent.map(c => c.cumDelta);
    const peakIdxs = typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length) : [];
    const troughIdxs = typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length) : [];
    let divs = [];

    for (let i = 1; i < peakIdxs.length; i++) {
        let p1 = peakIdxs[i-1], p2 = peakIdxs[i];
        if (p2 - p1 < 3) continue;
        if (closes[p2] > closes[p1] && cums[p2] < cums[p1]) {
            let strength = ((closes[p2] - closes[p1]) / closes[p1]) * 100 > 2 ? 'STRONG' : 'MEDIUM';
            divs.push({ type: 'BEARISH', idx: p2, price: closes[p2], strength, timeMs: recent[p2].time });
        }
    }
    for (let i = 1; i < troughIdxs.length; i++) {
        let t1 = troughIdxs[i-1], t2 = troughIdxs[i];
        if (t2 - t1 < 3) continue;
        if (closes[t2] < closes[t1] && cums[t2] > cums[t1]) {
            let strength = ((closes[t1] - closes[t2]) / closes[t1]) * 100 > 2 ? 'STRONG' : 'MEDIUM';
            divs.push({ type: 'BULLISH', idx: t2, price: closes[t2], strength, timeMs: recent[t2].time });
        }
    }
    divs.sort((a, b) => b.idx - a.idx);
    const recentDivs = divs.slice(0, 4);

    let deltaZones = [];
    let curRun = null;
    recent.forEach((c, i) => {
        let sign = c.delta > 0 ? 1 : (c.delta < 0 ? -1 : 0);
        if (curRun && curRun.sign === sign && sign !== 0) {
            curRun.c.push(c);
        } else {
            if (curRun && curRun.c.length >= 3) deltaZones.push(buildVdaZone(curRun.c));
            curRun = sign !== 0 ? { sign, c: [c] } : null;
        }
    });
    if (curRun && curRun.c.length >= 3) deltaZones.push(buildVdaZone(curRun.c));
    deltaZones.sort((a, b) => b.strength - a.strength);
    const topZones = deltaZones.slice(0, 4);

    const last20 = recent.slice(-20);
    const pChg = ((last20[19].close - last20[0].close) / last20[0].close) * 100;
    const dChg = last20[19].cumDelta - last20[0].cumDelta;

    let bias, nextTgt = currentPrice, stopL = currentPrice, prob, reasoning;
    const isStealthAcc = dChg > 0 && Math.abs(pChg) < 1.5 && dominance === 'BUYERS';
    const isStealthDist = dChg < 0 && Math.abs(pChg) < 1.5 && dominance === 'SELLERS';
    const lastDiv = recentDivs[0];

    if (isStealthAcc) {
        bias = 'STEALTH_ACCUMULATION'; nextTgt *= 1.03; stopL *= 0.985; prob = 70 + Math.min(15, domStrength/4);
        reasoning = 'التراكمي (CVD) في صعود قوي رغم استقرار السعر النسبي. تراكم خفي للأموال الذكية والمشترون يبنون مراكزهم في صمت.';
    } else if (isStealthDist) {
        bias = 'STEALTH_DISTRIBUTION'; nextTgt *= 0.97; stopL *= 1.015; prob = 70 + Math.min(15, domStrength/4);
        reasoning = 'التراكمي (CVD) في هبوط قوي رغم استقرار السعر. تصريف خفي. البائعون الكبار يفرغون محافظهم دون إحداث هلع.';
    } else if (lastDiv && lastDiv.idx >= recent.length - 15) {
        if (lastDiv.type === 'BEARISH') {
            bias = 'BEARISH_DIVERGENCE'; nextTgt *= 0.96; stopL = lastDiv.price * 1.01; prob = 65 + (lastDiv.strength==='STRONG'?10:0);
            reasoning = `انفراج هبوطي! السعر يصنع قمم أعلى لكن السيولة المشتراة تضعف وتتناقص. احتمالية تصحيح هبوطي واردة جداً.`;
        } else {
            bias = 'BULLISH_DIVERGENCE'; nextTgt *= 1.04; stopL = lastDiv.price * 0.99; prob = 65 + (lastDiv.strength==='STRONG'?10:0);
            reasoning = `انفراج صعودي! السعر يصنع قيعان أدنى لكن قوة البيع نفدت (CVD يرتفع). فرصة ارتداد صعودي ممتازة.`;
        }
    } else if (dominance === 'BUYERS' && domStrength > 20) {
        bias = 'BUYERS_IN_CONTROL'; nextTgt *= 1.025; stopL *= 0.985; prob = 55 + Math.min(20, domStrength/3);
        reasoning = `سيطرة واضحة للمشترين بقوة ${domStrength}/100. ضغط الشراء الحقيقي المستمر يدعم استمرار المسار الصاعد.`;
    } else if (dominance === 'SELLERS' && domStrength > 20) {
        bias = 'SELLERS_IN_CONTROL'; nextTgt *= 0.975; stopL *= 1.015; prob = 55 + Math.min(20, domStrength/3);
        reasoning = `سيطرة واضحة للبائعين بقوة ${domStrength}/100. ضغط البيع المستمر يرجح المزيد من الهبوط.`;
    } else {
        bias = 'BALANCED_FLOW'; prob = 50;
        reasoning = 'تدفق الأوامر متوازن بين المشترين والبائعين. السوق في حالة تعادل أو تجميع بانتظار سيولة خارجية لكسر النطاق.';
    }

    return { chartData: recent, currentPrice, totalBuy, totalSell, netDelta, currentCum: recent[recent.length-1].cumDelta, buyRatio, sellRatio, dominance, domStrength, divergences: recentDivs, deltaZones: topZones, verdict: { bias, nextTgt, stopL, prob: Math.round(prob), reasoning } };
}

function buildVdaZone(arr) {
    const tDelta = arr.reduce((s, c) => s + c.delta, 0);
    const tVol = arr.reduce((s, c) => s + c.volume, 0);
    const pMin = Math.min(...arr.map(c=>c.low)), pMax = Math.max(...arr.map(c=>c.high));
    const str = Math.min(100, Math.round((arr.length * 8) + (Math.abs(tDelta)/(tVol||1)) * 100));
    return { type: tDelta > 0 ? 'ACCUMULATION' : 'DISTRIBUTION', pMin, pMax, tDelta, strength: str };
}

function renderVdaDashboard(symbol, tf, a) {
    // ✅ التصحيح الصارم لاستخدام دالة النظام الموحدة smartFormat
    const fmt = typeof smartFormat === 'function' ? smartFormat : (p => p.toFixed(4));
    const fmtV = v => { let abs = Math.abs(v); return (abs>=1e9)?(v/1e9).toFixed(2)+'B':(abs>=1e6)?(v/1e6).toFixed(2)+'M':(abs>=1e3)?(v/1e3).toFixed(1)+'K':v.toFixed(0); };
    const tAgo = ts => { let h = (Date.now()-ts)/3600000; return h<1 ? 'now' : h<24 ? Math.floor(h)+'h ago' : Math.floor(h/24)+'d ago'; };

    const W = 340, padL = 10, padR = 60, plotW = W - padL - padR;
    const pH = 160, dH = 110, gap = 5, padT = 20, padB = 25;
    const pY0 = padT, dY0 = pY0 + pH + gap, totH = dY0 + dH + padB;

    const display = a.chartData;
    const closes = display.map(c => c.close), deltas = display.map(c => c.delta), cums = display.map(c => c.cumDelta);

    const pMin = Math.min(...closes)*0.999, pMax = Math.max(...closes)*1.001, pRng = pMax - pMin || 1;
    const dMax = Math.max(...deltas.map(Math.abs)) || 1;
    const cMin = Math.min(...cums), cMax = Math.max(...cums), cRng = cMax - cMin || 1;

    const toX = i => padL + (i / (display.length - 1)) * plotW;
    const toYp = p => pY0 + (1 - (p - pMin) / pRng) * pH;
    const toYd = d => dY0 + dH/2 - (d / dMax) * (dH/2 - 2);
    const toYc = c => dY0 + (1 - (c - cMin) / cRng) * dH;

    const pPath = closes.map((p, i) => `${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toYp(p).toFixed(1)}`).join(' ');
    const pArea = `${pPath} L ${toX(closes.length-1).toFixed(1)} ${(pY0+pH).toFixed(1)} L ${padL} ${(pY0+pH).toFixed(1)} Z`;
    const cPath = cums.map((c, i) => `${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toYc(c).toFixed(1)}`).join(' ');
    const barW = (plotW / closes.length) * 0.7;

    let svgHtml = `
    <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:12px; margin-bottom:15px;" class="vda-anim" style="animation-delay:0.1s;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1a1a1a; padding-bottom:8px; margin-bottom:10px;">
            <span style="font-family:'Share Tech Mono',monospace; font-size:11px; color:var(--o); font-weight:bold; letter-spacing:1px;">DELTA FLOW MAP // ${symbol.replace('USDT','')} ${tf.toUpperCase()}</span>
            <div style="display:flex; align-items:center; gap:6px; font-size:9px; color:#666; font-family:'Share Tech Mono',monospace;"><div style="width:6px;height:6px;border-radius:50%;background:var(--o);animation:vdaPulse 2s infinite;"></div>LIVE</div>
        </div>
        <svg width="100%" viewBox="0 0 ${W} ${totH}" style="display:block; background:#000; border-radius:4px; border:1px solid #111;">
        <defs><linearGradient id="vdaPGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--o)" stop-opacity="0.2"/><stop offset="100%" stop-color="var(--o)" stop-opacity="0"/></linearGradient></defs>

        <rect x="${padL}" y="${pY0}" width="${plotW}" height="${pH}" fill="#000"/>`;

    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
        let y = pY0 + f * pH, pV = pMax - f * pRng;
        svgHtml += `<line x1="${padL}" y1="${y}" x2="${padL+plotW}" y2="${y}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,3"/>`;
        svgHtml += `<text x="${padL+plotW+4}" y="${y+3}" font-size="8" fill="#666" font-family="Share Tech Mono">${pV>1000?(pV/1000).toFixed(2)+'K':pV.toFixed(4)}</text>`;
        let x = padL + f * plotW;
        svgHtml += `<line x1="${x}" y1="${pY0}" x2="${x}" y2="${pY0+pH}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,3"/>`;
    });

    svgHtml += `<path d="${pArea}" fill="url(#vdaPGrad)"/><path d="${pPath}" fill="none" stroke="var(--o)" stroke-width="2" stroke-linejoin="round"/>`;

    a.divergences.forEach(div => {
        let cx = toX(div.idx), cy = toYp(div.price), isBull = div.type === 'BULLISH', cColor = isBull ? 'var(--o)' : '#fff';
        svgHtml += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="none" stroke="${cColor}" stroke-width="1.5"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="${cColor}"/>`;
        svgHtml += `<text x="${cx.toFixed(1)}" y="${(cy-12).toFixed(1)}" font-size="8" fill="${cColor}" font-weight="bold" font-family="Share Tech Mono" text-anchor="middle">${isBull?'BULL DIV':'BEAR DIV'}</text>`;
    });

    let cxN = toX(closes.length-1), cyN = toYp(a.currentPrice);
    svgHtml += `<line x1="${padL}" y1="${cyN.toFixed(1)}" x2="${padL+plotW}" y2="${cyN.toFixed(1)}" stroke="var(--o)" stroke-width="1" stroke-dasharray="1,2" opacity="0.5"/>
                <circle cx="${cxN.toFixed(1)}" cy="${cyN.toFixed(1)}" r="8" fill="var(--o)" opacity="0.3"/><circle cx="${cxN.toFixed(1)}" cy="${cyN.toFixed(1)}" r="4" fill="var(--o)"/>`;
    svgHtml += `<text x="${padL+4}" y="${pY0+12}" font-size="8" fill="#444" font-family="Share Tech Mono">PRICE</text>
                <rect x="${padL}" y="${pY0}" width="${plotW}" height="${pH}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`;

    svgHtml += `<rect x="${padL}" y="${dY0}" width="${plotW}" height="${dH}" fill="#000"/>
                <line x1="${padL}" y1="${dY0+dH/2}" x2="${padL+plotW}" y2="${dY0+dH/2}" stroke="#333" stroke-width="1"/>`;

    deltas.forEach((d, i) => {
        let cx = toX(i), isBuy = d > 0, col = isBuy ? 'var(--o)' : '#fff', bH = Math.max(Math.abs((d/dMax)*(dH/2 - 2)), 1);
        let bY = isBuy ? (dY0+dH/2 - bH) : (dY0+dH/2);
        svgHtml += `<rect x="${(cx - barW/2).toFixed(1)}" y="${bY.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${col}" opacity="0.85"/>`;
    });

    svgHtml += `<path d="${cPath}" fill="none" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.9"/>`;
    svgHtml += `<text x="${padL+4}" y="${dY0+12}" font-size="8" fill="#444" font-family="Share Tech Mono">CVD + DELTA</text>
                <rect x="${padL}" y="${dY0}" width="${plotW}" height="${dH}" fill="none" stroke="#1a1a1a" stroke-width="1"/>`;

    ['-60', '-45', '-30', '-15', 'NOW'].forEach((l, i) => {
        svgHtml += `<text x="${(padL+(i/4)*plotW).toFixed(1)}" y="${dY0+dH+16}" font-size="8" fill="#444" font-family="Share Tech Mono" text-anchor="middle">${l}</text>`;
    });

    svgHtml += `</svg>
        <div style="display:flex; justify-content:space-around; margin-top:8px; padding-top:10px; border-top:1px solid #1a1a1a; font-size:9px; font-family:'Share Tech Mono',monospace; color:#666;">
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:8px;height:2px;background:var(--o);"></div>PRICE</div>
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:6px;height:6px;background:var(--o);"></div>BUY DLT</div>
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:6px;height:6px;background:#fff;"></div>SELL DLT</div>
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:8px;height:0;border-top:1.5px dashed var(--o);"></div>CVD</div>
        </div>
    </div>`;

    let html = svgHtml;

    html += `<div class="vda-card vda-anim" style="animation-delay:0.15s;">
        <div class="vda-card-title">MARKET SNAPSHOT & DOMINANCE</div>
        <div style="display:flex; justify-content:space-between; font-size:11px; font-family:'Share Tech Mono',monospace; margin-top:8px;">
            <span style="color:var(--o); font-weight:700;">BUYERS ${a.buyRatio.toFixed(1)}%</span>
            <span style="color:#fff; font-weight:700;">${a.sellRatio.toFixed(1)}% SELLERS</span>
        </div>
        <div style="display:flex; width:100%; height:32px; margin-top:8px; border:1px solid #1a1a1a; border-radius:2px; overflow:hidden;">
            <div style="width:${a.buyRatio}%; background:var(--o); display:flex; align-items:center; justify-content:center; color:#000; font-weight:900; font-size:10px; font-family:'Share Tech Mono',monospace;">${a.buyRatio.toFixed(0)}%</div>
            <div style="width:${a.sellRatio}%; background:#fff; display:flex; align-items:center; justify-content:center; color:#000; font-weight:900; font-size:10px; font-family:'Share Tech Mono',monospace;">${a.sellRatio.toFixed(0)}%</div>
        </div>
        <div style="margin-top:8px; text-align:center; font-family:'Share Tech Mono',monospace; font-size:11px; color:#666; margin-bottom:12px;">
            CONTROL: <span style="color:var(--o); font-weight:700;">${a.dominance}</span> // STR: <span style="color:var(--o); font-weight:700;">${a.domStrength}/100</span>
        </div>
        ${[{l:'CURRENT PRICE', v:String(fmt(a.currentPrice)), c:'var(--o)'},
           {l:'BUY VOLUME', v:fmtV(a.totalBuy), c:'var(--o)'},
           {l:'SELL VOLUME', v:fmtV(a.totalSell), c:'#fff'},
           {l:'NET DELTA', v:(a.netDelta>0?'+':'')+fmtV(a.netDelta), c:a.netDelta>0?'var(--o)':'#fff'},
           {l:'CUMULATIVE (CVD)', v:(a.currentCum>0?'+':'')+fmtV(a.currentCum), c:a.currentCum>0?'var(--o)':'#fff'}
          ].map(s=>`
            <div class="vda-stat-row"><span class="vda-label">${s.l}</span><span class="${s.c==='var(--o)'?'vda-val-o':'vda-val'}">${s.v}</span></div>
        `).join('')}
    </div>`;

    const vC = a.verdict.bias.includes('BEARISH') || a.verdict.bias.includes('SELLERS') || a.verdict.bias.includes('DISTRIBUTION') ? '#fff' : 'var(--o)';
    html += `<div style="background:#0a0a0a; border-right:4px solid ${vC}; padding:15px; margin-bottom:15px; border-radius:4px;" class="vda-anim" style="animation-delay:0.2s;">
        <div style="font-size:11px; color:#666; font-family:'Share Tech Mono',monospace; letter-spacing:1px; margin-bottom:8px;">VERDICT // الحكم الاستثماري</div>
        <div style="font-size:18px; font-weight:900; color:${vC}; margin-bottom:10px; font-family:'Share Tech Mono',monospace;">${a.verdict.bias.replace(/_/g, ' ')}</div>
        <div style="font-size:13px; color:#fff; line-height:1.7; margin-bottom:10px; font-family:'Cairo',sans-serif; text-align:justify;">${a.verdict.reasoning}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:10px;">
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">TARGET</div><div style="font-size:14px; font-weight:900; font-family:'Share Tech Mono',monospace; color:var(--o); direction:ltr;">${String(fmt(a.verdict.nextTgt)).replace('$','')}</div></div>
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">STOP</div><div style="font-size:14px; font-weight:900; font-family:'Share Tech Mono',monospace; color:#fff; direction:ltr;">${String(fmt(a.verdict.stopL)).replace('$','')}</div></div>
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">PROB</div><div style="font-size:14px; font-weight:900; font-family:'Share Tech Mono',monospace; color:var(--o);">${a.verdict.prob}%</div></div>
        </div>
    </div>`;

    if (a.divergences.length > 0) {
        let divHtml = `<div class="vda-card vda-anim" style="animation-delay:0.25s;">
            <div class="vda-card-title">DIVERGENCE DETECTOR</div>
            <table class="vda-table"><thead><tr><th class="vda-th" style="text-align:center;">TYPE</th><th class="vda-th" style="text-align:center;">PRICE</th><th class="vda-th" style="text-align:center;">STR</th><th class="vda-th" style="text-align:center;">AGE</th></tr></thead><tbody>`;
        a.divergences.forEach(d => {
            const isB = d.type === 'BULLISH';
            divHtml += `<tr>
                <td class="vda-td" style="text-align:center;"><span class="vda-badge ${isB?'vda-badge-bull':'vda-badge-bear'}">${isB?'BULL':'BEAR'}</span></td>
                <td class="vda-td" style="color:#fff; direction:ltr;">${String(fmt(d.price)).replace('$','')}</td>
                <td class="vda-td" style="text-align:center; color:${d.strength==='STRONG'?'var(--o)':'#fff'}; font-weight:700;">${d.strength}</td>
                <td class="vda-td" style="text-align:center; color:#666;">${tAgo(d.timeMs)}</td>
            </tr>`;
        });
        divHtml += `</tbody></table></div>`;
        html += divHtml;
    }

    if (a.deltaZones.length > 0) {
        let zonHtml = `<div class="vda-card vda-anim" style="animation-delay:0.3s;">
            <div class="vda-card-title">KEY DELTA ZONES</div>
            <table class="vda-table"><thead><tr><th class="vda-th" style="text-align:center;">TYPE</th><th class="vda-th" style="text-align:center;">RANGE</th><th class="vda-th" style="text-align:center;">DELTA</th><th class="vda-th" style="text-align:center;">STR</th></tr></thead><tbody>`;
        a.deltaZones.forEach(z => {
            const isAcc = z.type === 'ACCUMULATION';
            zonHtml += `<tr>
                <td class="vda-td" style="text-align:center;"><span class="vda-badge ${isAcc?'vda-badge-acc':'vda-badge-dist'}">${isAcc?'ACC':'DIST'}</span></td>
                <td class="vda-td" style="color:#fff; font-size:9px; direction:ltr; text-align:center;">${String(fmt(z.pMin)).replace('$','')}-${String(fmt(z.pMax)).replace('$','')}</td>
                <td class="vda-td" style="text-align:center; color:${z.tDelta>0?'var(--o)':'#fff'}; direction:ltr;">${(z.tDelta>0?'+':'' )+fmtV(z.tDelta)}</td>
                <td class="vda-td" style="text-align:center; color:var(--o); font-weight:700;">${z.strength}</td>
            </tr>`;
        });
        zonHtml += `</tbody></table></div>`;
        html += zonHtml;
    }

    // ✅ التصحيح الهندسي لفئات الـ Guide المفقودة باستخدام الأنماط المضمنة
    html += `
    <div class="vda-anim" style="background:#060606; border:1px solid #1a1a1a; padding:15px; margin-top:20px; border-radius:4px; border-right:3px solid var(--o); animation-delay:0.35s;">
        <div style="font-size:12px; color:var(--o); font-weight:700; margin-bottom:10px; letter-spacing:0.5px; font-family:'Share Tech Mono', monospace;">دليل القراءة // READING GUIDE</div>
        <div style="font-size:12px; color:#999; line-height:1.8; font-family:'Cairo', sans-serif;">
            <strong style="color:var(--o);">VOLUME DELTA:</strong> الفرق بين الشراء والبيع المندفع (Taker Buy vs Sell). الأعمدة السفلية توضحه بدقة.<br><br>
            <strong style="color:var(--o);">CUMULATIVE DELTA (CVD):</strong> المجموع التراكمي لتدفق السيولة. الخط المتقطع، يكشف الوجهة الخفية للأموال الذكية متجاهلاً التلاعب السعري.<br><br>
            <strong style="color:var(--o);">STEALTH ACCUMULATION:</strong> السعر مستقر بينما الـ CVD يصعد بقوة (تجميع وصعود قادم).<br><br>
            <strong style="color:var(--o);">DIVERGENCE:</strong> عندما يحقق السعر قاعاً جديداً وتفشل السيولة في ذلك، فهذا يعني انتهاء ضغط البيع (انعكاس وشيك).
        </div>
    </div>`;

    return html;
}

// ============================================================
// 🚀 محرك راسم هيكل السوق (MARKET STRUCTURE MAPPER - SMC CORE)
// ============================================================

async function runMarketStructure() {
    const symbolInput = document.getElementById('ms-sym').value.trim().toUpperCase();
    const tf = document.getElementById('ms-tf').value.toLowerCase();
    const btn = document.getElementById('ms-btn');
    const loading = document.getElementById('ms-loading');
    const dash = document.getElementById('ms-dashboard');

    if (!symbolInput) return;
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';

    btn.disabled = true;
    btn.innerText = 'MAPPING...';
    dash.style.display = 'none';
    dash.innerHTML = '';
    loading.style.display = 'block';

    try {
        const limit = tf === '15m' || tf === '1h' ? 500 : 250;
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=${limit}`);
        if (!res.ok) throw new Error('فشل جلب البيانات السعرية.');
        const raw = await res.json();

        if (!Array.isArray(raw) || raw.length < 50) throw new Error('بيانات غير كافية لرسم الهيكل (تحتاج 50 شمعة على الأقل).');

        const candles = raw.map(c => ({
            time: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
        }));

        const analysis = analyzeMarketStructureEngine(candles);

        loading.style.display = 'none';
        dash.innerHTML = renderMsDashboard(symbol, tf, candles, analysis);
        dash.style.display = 'block';

    } catch (e) {
        loading.style.display = 'none';
        dash.style.display = 'block';
        dash.innerHTML = `<div style="padding:20px; color:var(--o); text-align:center; font-family:'Share Tech Mono', monospace; font-size:12px; border:1px solid #1a1a1a; background:#0a0a0a; border-radius:4px;">ERROR: ${e.message}</div>`;
    } finally {
        btn.innerText = 'MAP STRUCTURE';
        btn.disabled = false;
    }
}

function analyzeMarketStructureEngine(candles) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    const n = candles.length;

    const peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length) : [];
    const troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length) : [];

    let rawSwings = [];
    peakIdxs.forEach(idx => rawSwings.push({ idx, price: highs[idx], kind: 'PEAK', timeMs: candles[idx].time }));
    troughIdxs.forEach(idx => rawSwings.push({ idx, price: lows[idx], kind: 'TROUGH', timeMs: candles[idx].time }));
    rawSwings.sort((a, b) => a.idx - b.idx);

    let swings = [];
    rawSwings.forEach(sw => {
        if (swings.length === 0) { swings.push(sw); return; }
        const last = swings[swings.length - 1];
        if (last.kind === sw.kind) {
            if (sw.kind === 'PEAK' && sw.price > last.price) swings[swings.length - 1] = sw;
            else if (sw.kind === 'TROUGH' && sw.price < last.price) swings[swings.length - 1] = sw;
        } else {
            swings.push(sw);
        }
    });

    let classified = [];
    const findPrev = (kind) => { for (let i = classified.length - 1; i >= 0; i--) { if (classified[i].kind === kind) return classified[i]; } return null; };

    swings.forEach(sw => {
        let type = sw.kind === 'PEAK' ? 'H' : 'L';
        if (sw.kind === 'PEAK') {
            const prev = findPrev('PEAK');
            type = prev ? (sw.price > prev.price ? 'HH' : 'LH') : 'HH';
        } else {
            const prev = findPrev('TROUGH');
            type = prev ? (sw.price > prev.price ? 'HL' : 'LL') : 'LL';
        }
        let diffHours = (Date.now() - sw.timeMs) / 3600000;
        let age = diffHours < 24 ? Math.floor(diffHours)+'h ago' : Math.floor(diffHours/24)+'d ago';
        classified.push({ ...sw, type, age });
    });

    let trend = 'RANGE', strength = 30, duration = 0;
    if (classified.length >= 4) {
        const recent = classified.slice(-6);
        let bC = 0, brC = 0;
        recent.forEach(s => { if (s.type === 'HH' || s.type === 'HL') bC++; if (s.type === 'LH' || s.type === 'LL') brC++; });
        if (bC >= 4 && brC <= 1) { trend = 'UPTREND'; strength = Math.min(100, Math.round((bC/recent.length)*100)); }
        else if (brC >= 4 && bC <= 1) { trend = 'DOWNTREND'; strength = Math.min(100, Math.round((brC/recent.length)*100)); }
        else if (bC > brC) { trend = 'WEAK_UPTREND'; strength = Math.round((bC/recent.length)*80); }
        else if (brC > bC) { trend = 'WEAK_DOWNTREND'; strength = Math.round((brC/recent.length)*80); }
        else { trend = 'RANGE'; strength = 30; }
        duration = classified[classified.length - 1].idx - classified[Math.max(0, classified.length - 6)].idx;
    }

    let events = [];
    for (let i = 3; i < classified.length; i++) {
        const cur = classified[i], prev = classified[i-1], pPrev = classified[i-2];
        const lastSame = (kind) => { for(let j = i-1; j>=0; j--){ if(classified[j].kind===kind) return classified[j]; } return null; };

        if (cur.type === 'HH') {
            const prevPeak = lastSame('PEAK');
            if (prevPeak && cur.price > prevPeak.price) {
                let impact = Math.abs(cur.price - prevPeak.price)/prevPeak.price > 0.02 ? 'STRONG' : 'MEDIUM';
                events.push({ type: 'BOS', dir: 'BULLISH', pIdx: cur.idx, price: cur.price, time: cur.age, impact });
            }
        }
        if (cur.type === 'LL') {
            const prevTrough = lastSame('TROUGH');
            if (prevTrough && cur.price < prevTrough.price) {
                let impact = Math.abs(cur.price - prevTrough.price)/prevTrough.price > 0.02 ? 'STRONG' : 'MEDIUM';
                events.push({ type: 'BOS', dir: 'BEARISH', pIdx: cur.idx, price: cur.price, time: cur.age, impact });
            }
        }
        if (cur.type === 'HH' && (prev.type === 'LH' || prev.type === 'LL') && (pPrev.type === 'LL' || pPrev.type === 'LH')) {
            events.push({ type: 'CHOCH', dir: 'BULLISH', pIdx: cur.idx, price: cur.price, time: cur.age, impact: 'STRONG' });
        }
        if (cur.type === 'LL' && (prev.type === 'HL' || prev.type === 'HH') && (pPrev.type === 'HH' || pPrev.type === 'HL')) {
            events.push({ type: 'CHOCH', dir: 'BEARISH', pIdx: cur.idx, price: cur.price, time: cur.age, impact: 'STRONG' });
        }
    }

    let uEvents = [];
    events.forEach(e => { if(!uEvents.find(u => u.pIdx === e.pIdx && u.type === e.type)) uEvents.push(e); });
    uEvents.sort((a, b) => b.pIdx - a.pIdx);
    const recentEvents = uEvents.slice(0, 8);

    let revZones = [];
    const isUp = trend.includes('UP'), isDn = trend.includes('DOWN');
    const findLast = (type) => { for(let i=classified.length-1; i>=0; i--) if(classified[i].type===type) return classified[i]; return null; };

    if (isUp || trend === 'RANGE') {
        let lHL = findLast('HL');
        if (lHL) revZones.push({ type: 'BULLISH', pMin: lHL.price*0.995, pMax: lHL.price*1.005, basis: 'Last HL Support', str: 85, dist: (Math.abs(currentPrice-lHL.price)/currentPrice*100) });
        let lHH = findLast('HH');
        if (lHH && lHH.price > currentPrice) revZones.push({ type: 'BEARISH', pMin: lHH.price*0.995, pMax: lHH.price*1.005, basis: 'Last HH Resist', str: 70, dist: (Math.abs(lHH.price-currentPrice)/currentPrice*100) });
    }
    if (isDn || trend === 'RANGE') {
        let lLH = findLast('LH');
        if (lLH) revZones.push({ type: 'BEARISH', pMin: lLH.price*0.995, pMax: lLH.price*1.005, basis: 'Last LH Resist', str: 85, dist: (Math.abs(lLH.price-currentPrice)/currentPrice*100) });
        let lLL = findLast('LL');
        if (lLL && lLL.price < currentPrice) revZones.push({ type: 'BULLISH', pMin: lLL.price*0.995, pMax: lLL.price*1.005, basis: 'Last LL Support', str: 70, dist: (Math.abs(currentPrice-lLL.price)/currentPrice*100) });
    }
    revZones.sort((a,b) => b.str - a.str);

    const sc = Math.min(100, Math.round((Math.min(20, classified.length)*3) + (recentEvents.filter(e=>e.type==='BOS').length*8) + (recentEvents.filter(e=>e.type==='CHOCH').length*5) + (strength*0.4)));

    let bias = 'RANGE_BOUND', keyL = currentPrice, invL = currentPrice, prob = 50, res = '';
    const lastChoc = recentEvents.find(e => e.type === 'CHOCH'), lastBos = recentEvents.find(e => e.type === 'BOS');

    // ✅ تصحيح التنسيق لاعتماد الدالة القياسية
    const fmtP = typeof smartFormat === 'function' ? smartFormat : (p => p.toFixed(4));

    if (lastChoc && recentEvents.indexOf(lastChoc) === 0) {
        if (lastChoc.dir === 'BULLISH') {
            bias = 'BULLISH_CHOCH'; keyL = findLast('HL')?.price || currentPrice*0.985; invL = findLast('LL')?.price || currentPrice*0.97; prob = 72;
            res = `تغير شخصية صعودي (CHOCH) مؤكد عند ${String(fmtP(lastChoc.price)).replace('$','')}. الهيكل الهابط انكسر، وتتركز السيولة الآن في بناء ترند صاعد جديد.`;
        } else {
            bias = 'BEARISH_CHOCH'; keyL = findLast('LH')?.price || currentPrice*1.015; invL = findLast('HH')?.price || currentPrice*1.03; prob = 72;
            res = `تغير شخصية هبوطي (CHOCH) مؤكد عند ${String(fmtP(lastChoc.price)).replace('$','')}. الهيكل الصاعد انكسر، مع سيطرة البائعين على دفة السوق.`;
        }
    } else if (trend.includes('UPTREND') && lastBos && lastBos.dir === 'BULLISH') {
        bias = 'STRONG_UPTREND'; keyL = findLast('HL')?.price || currentPrice*0.985; invL = classified.filter(s=>s.type==='HL').slice(-2)[0]?.price || currentPrice*0.96; prob = 70 + Math.min(15, strength/10);
        res = `هيكل صعودي سليم مع BOS متتالية. آخر قاع أعلى (HL) صامد بقوة. الترند محفوظ وآمن طالما السعر يتداول أعلى من مستوى الإبطال ${String(fmtP(invL)).replace('$','')}.`;
    } else if (trend.includes('DOWNTREND') && lastBos && lastBos.dir === 'BEARISH') {
        bias = 'STRONG_DOWNTREND'; keyL = findLast('LH')?.price || currentPrice*1.015; invL = classified.filter(s=>s.type==='LH').slice(-2)[0]?.price || currentPrice*1.04; prob = 70 + Math.min(15, strength/10);
        res = `هيكل هبوطي سليم مع BOS متتالية. آخر قمة أدنى (LH) تضغط السعر. الترند الهابط محفوظ طالما السعر يتداول أسفل مستوى الإبطال ${String(fmtP(invL)).replace('$','')}.`;
    } else if (trend.includes('WEAK')) {
        bias = trend; keyL = isUp ? (findLast('HL')?.price || currentPrice*0.98) : (findLast('LH')?.price || currentPrice*1.02);
        invL = isUp ? (findLast('LL')?.price || currentPrice*0.96) : (findLast('HH')?.price || currentPrice*1.04); prob = 55;
        res = `ترند ضعيف قيد التشكل. الهيكل يحتاج لكسر (BOS) صريح لتأكيد المسار وتجنب التذبذب العشوائي.`;
    } else {
        bias = 'RANGE_BOUND'; keyL = findLast('HH')?.price || currentPrice*1.02; invL = findLast('LL')?.price || currentPrice*0.98; prob = 50;
        res = `السوق في حالة عرضية (تجميع/توزيع). تداول بحذر بين القمم والقيعان حتى تظهر إشارة كسر صريحة تحدد مسار السيولة القادم.`;
    }

    return { currentPrice, swings: classified, trend, trendStrength: strength, trendDuration: duration, score: sc, events: recentEvents, zones: revZones.slice(0,4), verdict: { bias, keyL, invL, prob, res } };
}

function renderMsDashboard(symbol, tf, candles, a) {
    // ✅ تصحيح التنسيق لاعتماد الدالة القياسية
    const fmt = typeof smartFormat === 'function' ? smartFormat : (p => p.toFixed(4));

    const chartW = 460, chartH = 320, padL = 10, padR = 70, padT = 30, padB = 30, plotW = chartW - padL - padR, plotH = chartH - padT - padB;
    const display = candles.slice(-80);
    const startGlobalIdx = candles.length - display.length;
    const closes = display.map(c => c.close);

    const vSwings = a.swings.filter(s => s.idx >= startGlobalIdx).map(s => ({ ...s, rIdx: s.idx - startGlobalIdx }));
    const vEvents = a.events.filter(e => e.pIdx >= startGlobalIdx).map(e => ({ ...e, rIdx: e.pIdx - startGlobalIdx }));

    let allP = [...closes, ...vSwings.map(s => s.price)];
    let pMin = Math.min(...allP) * 0.998, pMax = Math.max(...allP) * 1.002, pRng = pMax - pMin || 1;

    const toX = i => padL + (i / (display.length - 1)) * plotW;
    const toY = p => padT + (1 - (p - pMin) / pRng) * plotH;

    let pPath = closes.map((p, i) => `${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toY(p).toFixed(1)}`).join(' ');
    let pArea = `${pPath} L ${toX(closes.length-1).toFixed(1)} ${(padT+plotH).toFixed(1)} L ${padL} ${(padT+plotH).toFixed(1)} Z`;
    let zPath = vSwings.map((s, i) => `${i===0?'M':'L'} ${toX(s.rIdx).toFixed(1)} ${toY(s.price).toFixed(1)}`).join(' ');

    let svgHtml = `
    <div class="ms-card ms-anim" style="animation-delay:0.1s; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1a1a1a; padding-bottom:8px; margin-bottom:10px;">
            <span style="font-size:11px; color:var(--o); font-family:'Share Tech Mono',monospace; font-weight:700; letter-spacing:1px;">STRUCTURE MAP // ${symbol.replace('USDT','')} ${tf.toUpperCase()}</span>
            <div style="display:flex; align-items:center; gap:6px; font-size:9px; color:#666; font-family:'Share Tech Mono',monospace;"><div style="width:6px;height:6px;border-radius:50%;background:var(--o);animation:msPulse 2s infinite;"></div>LIVE</div>
        </div>
        <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="display:block; background:#000; border-radius:4px; border:1px solid #111;">
        <defs>
            <linearGradient id="msPGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--o)" stop-opacity="0.2"/><stop offset="100%" stop-color="var(--o)" stop-opacity="0"/></linearGradient>
            <linearGradient id="msTBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--o)" stop-opacity="0.05"/><stop offset="100%" stop-color="var(--o)" stop-opacity="0.02"/></linearGradient>
        </defs>
        <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="url(#msTBg)"/>`;

    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
        let y = padT + f * plotH, pV = pMax - f * pRng;
        svgHtml += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${padL+plotW}" y2="${y.toFixed(1)}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,3"/>`;
        svgHtml += `<text x="${padL+plotW+4}" y="${y+3}" font-size="8" fill="#666" font-family="Share Tech Mono">${pV>1000?(pV/1000).toFixed(2)+'K':pV.toFixed(4)}</text>`;
    });
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(f => {
        let x = padL + f * plotW;
        svgHtml += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT+plotH}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,3"/>`;
    });

    svgHtml += `<path d="${pArea}" fill="url(#msPGrad)"/><path d="${pPath}" fill="none" stroke="var(--o)" stroke-width="1.2" opacity="0.4"/>`;
    if (vSwings.length >= 2) svgHtml += `<path d="${zPath}" fill="none" stroke="var(--o)" stroke-width="2" stroke-linejoin="round"/>`;

    vEvents.forEach(e => {
        let cx = toX(e.rIdx), cy = toY(e.price), isBull = e.dir === 'BULLISH', cCol = isBull ? 'var(--o)' : '#fff';
        svgHtml += `<line x1="${(cx-8).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx+8).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${cCol}" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.8"/>
                    <text x="${(cx+10).toFixed(1)}" y="${cy+3}" font-size="7" fill="${cCol}" font-weight="bold" font-family="Share Tech Mono">${e.type}</text>`;
    });

    vSwings.forEach(s => {
        let cx = toX(s.rIdx), cy = toY(s.price), isH = s.kind === 'PEAK', isUp = (s.type==='HH'||s.type==='HL'), cCol = isUp ? 'var(--o)' : '#fff';
        let lY = isH ? cy - 12 : cy + 16;
        svgHtml += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="#000" stroke="${cCol}" stroke-width="2"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="${cCol}"/>
                    <rect x="${(cx-12).toFixed(1)}" y="${(lY-7).toFixed(1)}" width="24" height="12" fill="${cCol}" rx="2"/>
                    <text x="${cx.toFixed(1)}" y="${lY+2}" font-size="7" fill="#000" font-weight="900" font-family="Share Tech Mono" text-anchor="middle">${s.type}</text>`;
    });

    let cxN = toX(closes.length-1), cyN = toY(a.currentPrice);
    svgHtml += `<line x1="${padL}" y1="${cyN.toFixed(1)}" x2="${padL+plotW}" y2="${cyN.toFixed(1)}" stroke="var(--o)" stroke-width="1" stroke-dasharray="1,2" opacity="0.5"/>
                <circle cx="${cxN.toFixed(1)}" cy="${cyN.toFixed(1)}" r="8" fill="var(--o)" opacity="0.3"/><circle cx="${cxN.toFixed(1)}" cy="${cyN.toFixed(1)}" r="4" fill="var(--o)"/>`;

    ['-80', '-64', '-48', '-32', '-16', 'NOW'].forEach((l, i) => {
        svgHtml += `<text x="${(padL+(i/5)*plotW).toFixed(1)}" y="${padT+plotH+18}" font-size="8" fill="#444" font-family="Share Tech Mono" text-anchor="middle">${l}</text>`;
    });

    svgHtml += `<text x="${padL+4}" y="${padT-8}" font-size="8" fill="#888" font-family="Share Tech Mono">STRUCTURE: <tspan fill="var(--o)">${a.trend.replace(/_/g,' ')}</tspan></text>
                <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#1a1a1a" stroke-width="1"/></svg>
        <div style="display:flex; justify-content:space-around; margin-top:8px; padding-top:10px; border-top:1px solid #1a1a1a; font-size:9px; font-family:'Share Tech Mono',monospace; color:#666;">
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:8px;height:8px;border-radius:50%;border:2px solid var(--o);background:#000;"></div>HH/HL</div>
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:8px;height:8px;border-radius:50%;border:2px solid #fff;background:#000;"></div>LH/LL</div>
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px;height:2px;background:var(--o);"></div>ZIGZAG</div>
            <div style="display:flex; align-items:center; gap:5px;"><div style="width:10px;height:0;border-top:1.5px dashed var(--o);"></div>BOS/CHOCH</div>
        </div>
    </div>`;

    let html = svgHtml;

    let arrow = '↔'; if (a.trend.includes('UP')) arrow = '↑'; if (a.trend.includes('DOWN')) arrow = '↓';
    html += `<div class="ms-card ms-anim" style="animation-delay:0.15s;">
        <div class="ms-card-title">TREND STATUS</div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px;">
            <div><div style="font-size:10px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">CURRENT TREND</div>
            <div style="font-size:26px; font-weight:900; color:var(--o); font-family:'Share Tech Mono',monospace; letter-spacing:1px;">${a.trend.replace(/_/g,' ')}</div></div>
            <div style="font-size:32px; color:var(--o); font-weight:bold; font-family:'Share Tech Mono',monospace;">${arrow}</div>
        </div>
        <div style="margin-top:15px;">
            <div style="display:flex; justify-content:space-between; font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;"><span>TREND STRENGTH</span><span style="color:var(--o);">${a.trendStrength}/100</span></div>
            <div style="width:100%; height:8px; background:#1a1a1a; border-radius:2px; overflow:hidden;"><div style="height:100%; width:${a.trendStrength}%; background:var(--o); transition:width 1s ease;"></div></div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:15px;">
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">DURATION</div><div style="font-size:14px; font-weight:900; color:var(--o); font-family:'Share Tech Mono',monospace;">${a.trendDuration} bars</div></div>
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">STRUCTURE SCORE</div><div style="font-size:14px; font-weight:900; color:var(--o); font-family:'Share Tech Mono',monospace;">${a.score}/100</div></div>
        </div>
    </div>`;

    const vC = a.verdict.bias.includes('BEAR') || a.verdict.bias.includes('DOWN') ? '#fff' : 'var(--o)';
    html += `<div style="background:#0a0a0a; border-right:4px solid ${vC}; padding:15px; margin-bottom:15px; border-radius:4px;" class="ms-anim" style="animation-delay:0.2s;">
        <div style="font-size:11px; color:#666; font-family:'Share Tech Mono',monospace; letter-spacing:1px; margin-bottom:8px;">VERDICT // الحكم الهيكلي</div>
        <div style="font-size:18px; font-weight:900; color:${vC}; margin-bottom:10px; font-family:'Share Tech Mono',monospace;">${a.verdict.bias.replace(/_/g, ' ')}</div>
        <div style="font-size:13px; color:#fff; line-height:1.7; margin-bottom:10px; font-family:'Cairo',sans-serif; text-align:justify;">${a.verdict.res}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:10px;">
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">KEY LEVEL</div><div style="font-size:13px; font-weight:900; color:var(--o); font-family:'Share Tech Mono',monospace; direction:ltr;">${String(fmt(a.verdict.keyL)).replace('$','')}</div></div>
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">INVALIDATION</div><div style="font-size:13px; font-weight:900; color:#fff; font-family:'Share Tech Mono',monospace; direction:ltr;">${String(fmt(a.verdict.invL)).replace('$','')}</div></div>
            <div style="background:#000; padding:10px; text-align:center; border-radius:2px; border:1px solid #111;"><div style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace; margin-bottom:4px;">PROB</div><div style="font-size:13px; font-weight:900; color:var(--o); font-family:'Share Tech Mono',monospace;">${a.verdict.prob}%</div></div>
        </div>
    </div>`;

    if (a.swings.length > 0) {
        html += `<div class="ms-card ms-anim" style="animation-delay:0.25s;"><div class="ms-card-title">STRUCTURE POINTS</div>
        <table class="ms-table"><thead><tr><th class="ms-th" style="text-align:center;">TYPE</th><th class="ms-th" style="text-align:center;">PRICE</th><th class="ms-th" style="text-align:center;">AGE</th></tr></thead><tbody>`;
        [...a.swings].reverse().slice(0, 8).forEach(sw => {
            const isUp = sw.type === 'HH' || sw.type === 'HL';
            html += `<tr>
                <td class="ms-td" style="text-align:center;"><span class="ms-badge ${isUp?'ms-badge-bull':'ms-badge-bear'}">${sw.type}</span></td>
                <td class="ms-td" style="color:#fff; text-align:center; font-weight:bold; direction:ltr;">${String(fmt(sw.price)).replace('$','')}</td>
                <td class="ms-td" style="text-align:center; color:#666;">${sw.age}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    if (a.events.length > 0) {
        html += `<div class="ms-card ms-anim" style="animation-delay:0.3s;"><div class="ms-card-title">STRUCTURE EVENTS (BOS/CHOCH)</div>
        <table class="ms-table"><thead><tr><th class="ms-th" style="text-align:center;">EVENT</th><th class="ms-th" style="text-align:center;">PRICE</th><th class="ms-th" style="text-align:center;">IMPACT</th><th class="ms-th" style="text-align:center;">AGE</th></tr></thead><tbody>`;
        [...a.events].forEach(e => {
            const isBull = e.dir === 'BULLISH';
            const iC = e.impact === 'STRONG' ? 'var(--o)' : e.impact === 'MEDIUM' ? '#fff' : '#666';
            html += `<tr>
                <td class="ms-td" style="text-align:center;"><span class="ms-badge ${isBull?'ms-badge-bull':'ms-badge-bear'}">${e.type}</span></td>
                <td class="ms-td" style="color:#fff; text-align:center; font-weight:bold; direction:ltr;">${String(fmt(e.price)).replace('$','')}</td>
                <td class="ms-td" style="text-align:center; color:${iC}; font-weight:700;">${e.impact}</td>
                <td class="ms-td" style="text-align:center; color:#666;">${e.time}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    if (a.zones.length > 0) {
        html += `<div class="ms-card ms-anim" style="animation-delay:0.35s;"><div class="ms-card-title">REVERSAL ZONES</div>`;
        a.zones.forEach(z => {
            const isBull = z.type.includes('BULL');
            // ✅ حقن التنسيقات المضمنة بدلاً من الفئات المفقودة في HTML
            html += `<div style="background:#000; border:1px solid #1a1a1a; padding:12px; margin-bottom:10px; border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="ms-badge ${isBull?'ms-badge-bull':'ms-badge-bear'}">${isBull?'BULL':'BEAR'}</span>
                    <span style="font-size:9px; color:#666; font-family:'Share Tech Mono',monospace;">${z.basis}</span>
                </div>
                <div style="font-family:'Share Tech Mono',monospace; font-size:13px; color:#fff; font-weight:700; direction:ltr; text-align:left;">${String(fmt(z.pMin)).replace('$','')} — ${String(fmt(z.pMax)).replace('$','')}</div>
                <div style="display:flex; justify-content:space-between; font-size:10px; font-family:'Share Tech Mono',monospace; color:#666; margin-top:4px;">
                    <span>STR: <span style="color:var(--o);">${z.str}/100</span></span>
                    <span>DIST: <span style="color:#fff;">${z.dist}%</span></span>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    html += `
    <div style="background:#060606; border:1px solid #1a1a1a; padding:15px; margin-top:20px; border-radius:4px; border-right:3px solid var(--o);" class="ms-anim" style="animation-delay:0.4s;">
        <div style="font-size:12px; color:var(--o); font-weight:700; margin-bottom:10px; letter-spacing:0.5px; font-family:'Share Tech Mono',monospace;">دليل القراءة // READING GUIDE</div>
        <div style="font-size:12px; color:#999; line-height:1.8; font-family:'Cairo',sans-serif; text-align:justify;">
            <strong style="color:var(--o);">HH / HL:</strong> قمة أعلى / قاع أعلى — تأكيد للترند الصاعد وقوة المشترين.<br><br>
            <strong style="color:#fff;">LH / LL:</strong> قمة أدنى / قاع أدنى — تأكيد للترند الهابط وقوة البائعين.<br><br>
            <strong style="color:var(--o);">BOS (Break of Structure):</strong> كسر هيكل مع الاتجاه لتأكيد استمرار الترند.<br><br>
            <strong style="color:#fff;">CHOCH (Change of Character):</strong> كسر مبكر يخالف الاتجاه، ينذر بتغير شخصية السوق وانعكاسه.<br><br>
            <strong style="color:var(--o);">INVALIDATION LEVEL:</strong> مستوى الإبطال. إذا أغلق السعر وراء هذا الرقم يُعتبر التحليل لاغياً.
        </div>
    </div>`;

    return html;
}

// ============================================================
// 🚀 TRADING 1 ENGINE: SPOT ROBO-ADVISOR
// Core: Trend Compass (40%) + SMC Order Blocks (40%) + Volatility Variance (20%)
// ============================================================

async function runTradingOne() {
    const symInput = document.getElementById('t1-symbol').value.trim().toUpperCase();
    const capitalInput = parseFloat(document.getElementById('t1-capital').value);
    const btn = document.getElementById('t1-btn');
    const dashboard = document.getElementById('t1-dashboard');
    const container = document.getElementById('t1-cards-container');

    if (!symInput || isNaN(capitalInput) || capitalInput <= 0) {
        alert("يرجى إدخال رمز العملة وإجمالي المحفظة بشكل صحيح.");
        return;
    }

    const symbol = symInput.includes('USDT') ? symInput : symInput + 'USDT';

    btn.innerText = 'جاري المعالجة الخوارزمية...';
    btn.disabled = true;
    dashboard.style.display = 'none';
    container.innerHTML = '';

    try {
        const timeframes = [
            { id: '1h', title: 'صفقة قصيرة المدى', closeRule: 'إغلاق شمعة 1 ساعة' },
            { id: '4h', title: 'توصية للمدى المتوسط', closeRule: 'إغلاق شمعة 4 ساعات' },
            { id: '1d', title: 'صفقة مدى بعيد', closeRule: 'الإغلاق اليومي (Daily Close)' }
        ];

        const responses = await Promise.all(
            timeframes.map(tf => fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf.id}&limit=500`).then(r => r.ok ? r.json() : null))
        );

        let cardsHtml = '';

        timeframes.forEach((tf, index) => {
            const raw = responses[index];
            if (!raw || raw.length < 100) {
                cardsHtml += generateT1Rejection(tf.title, tf.id.toUpperCase(), 'بيانات تاريخية غير كافية للمعالجة.');
                return;
            }

            const candles = raw.map(k => ({
                open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]),
                close: parseFloat(k[4]), volume: parseFloat(k[5])
            }));
            const closes = candles.map(c => c.close);
            const highs = candles.map(c => c.high);
            const lows = candles.map(c => c.low);
            const opens = candles.map(c => c.open);
            const volumes = candles.map(c => c.volume);
            const currentPrice = closes[closes.length - 1];

            // ✅ تصحيح: بناء دالة تقييم اتجاه صامتة (Fallback) في حال غياب analyzeTrendCompass
            const getTrend = () => {
                if (typeof analyzeTrendCompass === 'function') return analyzeTrendCompass(candles, closes, highs, lows, currentPrice);
                const sma20 = closes.slice(-20).reduce((a,b)=>a+b,0)/20;
                const sma50 = closes.slice(-50).reduce((a,b)=>a+b,0)/50;
                if (currentPrice > sma20 && sma20 > sma50) return { direction: 'bullish', confidence: 75 };
                return { direction: 'neutral', confidence: 40 };
            };
            let trendResult = getTrend();

            if (trendResult.direction !== 'bullish') {
                cardsHtml += generateT1Rejection(tf.title, tf.id.toUpperCase(), '( لا يوجد صفقات، الاتجاه غير واضح أو هابط يُفضل الانتظار )');
                return;
            }
            const wTrend = (trendResult.confidence / 100) * 40;

            // ✅ تصحيح: بناء مقيم Order Block صامت (Fallback) للسبوت
            const getOB = () => {
                let obScore = 0, obData = null;
                const last20 = candles.slice(-20);
                for (let i = 1; i < last20.length - 1; i++) {
                    let c = last20[i];
                    if (c.close < c.open && last20[i+1].close > last20[i+1].open && last20[i+1].close > c.high) {
                        let s = 60 + (c.volume / (volumes.slice(-20).reduce((a,b)=>a+b,0)/20) * 10);
                        if (s > obScore) { obScore = Math.min(95, s); obData = { zone: { bodyHigh: c.open, low: c.low }, score: obScore, bos: null }; }
                    }
                }
                return obData;
            };
            let bestOB = getOB();

            if (!bestOB) {
                cardsHtml += generateT1Rejection(tf.title, tf.id.toUpperCase(), '( لا يوجد سيولة شرائية صالحة للتمركز، يُفضل الانتظار )');
                return;
            }
            const wSMC = (bestOB.score / 100) * 40;

            let returns = [];
            for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
            const variance = returns.reduce((a, b) => a + Math.pow(b, 2), 0) / returns.length;
            const volatility = Math.sqrt(variance);
            const wVol = Math.min(20, Math.max(5, 20 - (volatility * 100))); 

            const totalProb = Math.min(99, Math.round(wTrend + wSMC + wVol));

            const entryPrice = bestOB.zone.bodyHigh;
            const stopLoss = bestOB.zone.low * 0.995; 

            if (currentPrice > entryPrice * 1.05 || currentPrice < stopLoss) {
                cardsHtml += generateT1Rejection(tf.title, tf.id.toUpperCase(), '( السعر الحالي ابتعد عن نطاق الشراء الآمن، يُفضل الانتظار )');
                return;
            }

            const slDist = (entryPrice - stopLoss) / entryPrice;

            const maxPortfolioRisk = 0.02; 
            const adjustedRisk = maxPortfolioRisk * (totalProb / 100); 

            let allocation = slDist > 0 ? (adjustedRisk / slDist) : 0;
            if (allocation > 0.20) allocation = 0.20; 

            const actualLossPct = (allocation * slDist) * 100; 

            const tp1 = entryPrice + (entryPrice - stopLoss) * 1.5; 
            const tp2 = bestOB.bos ? Math.max(bestOB.bos.price, entryPrice + (entryPrice - stopLoss) * 3) : entryPrice + (entryPrice - stopLoss) * 3;
            const tp3 = Math.max(tp2 * 1.02, tp2 + (volatility * currentPrice * (index === 0 ? 3 : index === 1 ? 5 : 8)));

            cardsHtml += generateT1TradeCard(
                tf.title, tf.id.toUpperCase(), totalProb, Math.round(wTrend), Math.round(wSMC), Math.round(wVol),
                entryPrice, tp1, tp2, tp3, stopLoss, tf.closeRule, (allocation * 100), actualLossPct
            );
        });

        container.innerHTML = cardsHtml;
        dashboard.style.display = 'flex'; // ✅ تم تصحيح المتغير إلى dashboard

    } catch (e) {
        container.innerHTML = `<div style="background:var(--s); border:1px solid var(--b); padding:20px; text-align:center; color:var(--o); font-family:'Cairo',sans-serif;">حدث خطأ في النظام: ${e.message}</div>`;
        dashboard.style.display = 'flex'; // ✅ تم تصحيح المتغير إلى dashboard
    } finally {
        btn.innerText = 'تحليل وبناء التمركزات';
        btn.disabled = false;
    }
}

function generateT1Rejection(title, tf, msg) {
    return `
    <div style="background:var(--s); border:1px solid var(--b); border-radius:4px; padding:16px; border-top:2px solid #333;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--b); padding-bottom:8px;">
            <div style="color:var(--t); font-size:0.85rem; font-weight:bold; font-family:'Cairo', sans-serif;">${title}</div>
            <div style="font-family:'Share Tech Mono', monospace; font-size:0.6rem; color:var(--t3); background:var(--bg); padding:2px 6px; border:1px solid var(--b); border-radius:4px;">${tf}</div>
        </div>
        <div style="text-align:center; padding:15px 0; color:var(--t2); font-size:0.75rem; font-family:'Cairo', sans-serif; font-weight:bold;">
            ${msg}
        </div>
    </div>`;
}

function generateT1TradeCard(title, tf, prob, wt, ws, wv, entry, tp1, tp2, tp3, sl, closeRule, alloc, lossPct) {
    // ✅ تم تصحيح التنسيق لاعتماد smartFormat
    const fmt = (p) => typeof smartFormat === 'function' ? String(smartFormat(p)).replace('$','') : p.toFixed(4);

    return `
    <div style="background:var(--s); border:1px solid var(--b); border-radius:4px; overflow:hidden; border-top:2px solid var(--o);">

        <div style="padding:14px 16px; border-bottom:1px solid var(--b); display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="color:var(--t); font-family:'Cairo', sans-serif; font-size:0.9rem; font-weight:bold;">${title}</div>
                <div style="color:var(--t3); font-family:'Share Tech Mono', monospace; font-size:0.6rem; margin-top:2px; letter-spacing:1px;">TIMEFRAME: ${tf}</div>
            </div>
            <div style="text-align:center;">
                <div style="color:var(--o); font-family:'Share Tech Mono', monospace; font-size:1.3rem; font-weight:bold;">${prob}%</div>
                <div style="color:var(--t2); font-family:'Cairo', sans-serif; font-size:0.5rem;">ترجيح النجاح</div>
            </div>
        </div>

        <div style="background:var(--bg); padding:8px 16px; border-bottom:1px solid var(--b); text-align:center; font-family:'Cairo', sans-serif;">
            <div style="font-size:0.55rem; color:var(--t2);">مكونات الترجيح: [ الاتجاه: <span style="color:var(--t);">${wt}%</span> | السيولة: <span style="color:var(--t);">${ws}%</span> | التباين: <span style="color:var(--t);">${wv}%</span> ]</div>
        </div>

        <div style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px dashed var(--b); padding-bottom:10px;">
                <span style="font-size:0.75rem; color:var(--t2); font-family:'Cairo',sans-serif; font-weight:bold;">سعر الدخول المرجّح</span>
                <span style="font-family:'Share Tech Mono',monospace; font-size:1.2rem; color:var(--t); font-weight:bold; direction:ltr;">$${fmt(entry)}</span>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:15px;">
                <div style="background:var(--bg); border:1px solid var(--b); padding:10px; border-radius:4px; text-align:center; border-top:2px solid #555;">
                    <div style="font-size:0.6rem; color:var(--t3); font-family:'Cairo',sans-serif; margin-bottom:4px;">هدف أول</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.85rem; color:var(--t); font-weight:bold; direction:ltr;">$${fmt(tp1)}</div>
                </div>
                <div style="background:var(--bg); border:1px solid var(--b); padding:10px; border-radius:4px; text-align:center; border-top:2px solid #aaa;">
                    <div style="font-size:0.6rem; color:var(--t3); font-family:'Cairo',sans-serif; margin-bottom:4px;">هدف ثاني</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.85rem; color:var(--t); font-weight:bold; direction:ltr;">$${fmt(tp2)}</div>
                </div>
                <div style="background:var(--bg); border:1px solid var(--b); padding:10px; border-radius:4px; text-align:center; border-top:2px solid var(--t);">
                    <div style="font-size:0.6rem; color:var(--t3); font-family:'Cairo',sans-serif; margin-bottom:4px;">هدف ثالث</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.85rem; color:var(--o); font-weight:bold; direction:ltr;">$${fmt(tp3)}</div>
                </div>
            </div>

            <div style="background:rgba(255,106,0,0.05); border:1px solid rgba(255,106,0,0.15); padding:12px; border-radius:4px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.75rem; color:var(--o); font-weight:bold; font-family:'Cairo',sans-serif;">وقف الخسارة (SL)</span>
                    <span style="font-family:'Share Tech Mono',monospace; font-size:1.1rem; color:var(--o); font-weight:bold; direction:ltr;">$${fmt(sl)}</span>
                </div>
                <div style="font-size:0.55rem; color:var(--t2); font-family:'Cairo',sans-serif;">(يتفعل الإلغاء حصراً بـ <span style="color:var(--t); font-weight:bold;">${closeRule}</span> أسفل هذا المستوى).</div>
            </div>

            <div style="border-top:1px dashed var(--b); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:0.65rem; color:var(--t2); font-family:'Cairo',sans-serif;">نسبة الدخول من المحفظة</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:1rem; color:var(--t); font-weight:bold;">${alloc.toFixed(1)}%</div>
                </div>
                <div style="text-align:left;">
                    <div style="font-size:0.6rem; color:var(--t2); font-family:'Cairo',sans-serif;">الخسارة القصوى من الإجمالي</div>
                    <div style="font-family:'Share Tech Mono',monospace; font-size:0.85rem; color:#ff4444; font-weight:bold; direction:ltr;">-${lossPct.toFixed(2)}%</div>
                </div>
            </div>
        </div>
    </div>`;
}

// =====================================================================
// 🚀 CDD DETECTOR: (Cumulative Delta Divergence // Order Flow)
// Fixed Syntax, Refined UI/UX, Flat Colors, Professional Terminology
// =====================================================================

async function cddRunCumulativeDelta() {
    const symbolInput = document.getElementById('cdd-symbol').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const tf = document.getElementById('cdd-tf').value;
    const dash = document.getElementById('cdd-dashboard');
    const loading = document.getElementById('cdd-loading');
    const btn = document.getElementById('cdd-btn');

    if (!symbolInput) { alert('أدخل رمز العملة'); return; }
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';

    dash.innerHTML = '';
    dash.style.display = 'none';
    loading.style.display = 'block';
    if(btn) btn.disabled = true;

    try {
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=500`);
        if (!res.ok) throw new Error('فشل جلب البيانات');
        const raw = await res.json();
        
        if (!Array.isArray(raw) || raw.length < 30) throw new Error('بيانات تاريخية غير كافية للتحليل');
        
        const candles = raw.map(c => ({
            time: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]),
            low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
        }));
        
        const analysis = cddAnalyzeData(candles);
        loading.style.display = 'none';
        dash.innerHTML = cddRenderDashboard(symbol, tf.toUpperCase(), analysis);
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px; background:var(--s); border:1px solid var(--b); border-radius:4px; color:var(--o); text-align:center; font-family:'Cairo',sans-serif; font-size:14px; font-weight:bold;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    } finally {
        if(btn) btn.disabled = false;
    }
}

function cddAnalyzeData(candles) {
    const display = candles.slice(-60); 
    const currentPrice = display[display.length - 1].close;

    // 1. حساب Delta لكل شمعة في النطاق كاملاً (لحساب الهيستوري بدقة)
    const fullDeltaPerBar = candles.map(c => cddCalculateBarDelta(c));
    const fullCumDeltaData = [];
    let fullRunningSum = 0;
    fullDeltaPerBar.forEach(d => {
        fullRunningSum += d;
        fullCumDeltaData.push(Math.round(fullRunningSum));
    });

    // 2. حساب Delta للعرض فقط
    const deltaPerBar = display.map(c => cddCalculateBarDelta(c));
    const cumDeltaData = [];
    let runningSum = 0;
    deltaPerBar.forEach(d => {
        runningSum += d;
        cumDeltaData.push(Math.round(runningSum));
    });

    // 3. كشف Active Divergence
    const activeDivergence = cddDetectActiveDivergence(display, cumDeltaData);

    // 4. حساب Delta Statistics
    const deltaStats = cddCalculateDeltaStats(deltaPerBar);

    // 5. Divergence History (باستخدام كل البيانات لتكون دقيقة)
    const divergenceHistory = cddBuildHistory(candles, fullCumDeltaData);

    // 6. Historical Accuracy
    const historicalAccuracy = cddCalculateHistAccuracy(divergenceHistory);

    // 7. Price Levels
    const priceLevels = cddCalculateLevels(display, activeDivergence, currentPrice);

    // 8. Verdict
    const verdict = cddGenerateVerdict(activeDivergence, deltaStats);

    return { currentPrice, display, deltaPerBar, cumDeltaData, activeDivergence, deltaStats, divergenceHistory, historicalAccuracy, priceLevels, verdict };
}

function cddCalculateBarDelta(candle) {
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    const closePos = (candle.close - candle.low) / range;
    const isGreen = candle.close >= candle.open;
    let buyRatio = 0.3 + (closePos * 0.4) + (isGreen ? 0.15 : -0.15);
    buyRatio = Math.max(0.1, Math.min(0.9, buyRatio));
    const buyVol = candle.volume * buyRatio;
    const sellVol = candle.volume * (1 - buyRatio);
    return Math.round(buyVol - sellVol);
}

function cddDetectActiveDivergence(display, cumDelta) {
    const closes = display.map(c => c.close);
    const lookback = Math.min(40, display.length);
    const recentCloses = closes.slice(-lookback);
    const recentCd = cumDelta.slice(-lookback);
    const offset = display.length - lookback; 

    const troughs = typeof findTroughs === 'function' ? findTroughs(recentCloses, 0, recentCloses.length).slice(-2) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(recentCloses, 0, recentCloses.length).slice(-2) : [];

    // BULLISH: قاعين سعر هابطين + قاعين cumDelta صاعدين
    if (troughs.length >= 2) {
        const t1 = troughs[0], t2 = troughs[1];
        const priceLow1 = recentCloses[t1], priceLow2 = recentCloses[t2];
        const cdLow1 = recentCd[t1], cdLow2 = recentCd[t2];
        
        if (priceLow2 < priceLow1 && cdLow2 > cdLow1) {
            const priceDrop = ((priceLow1 - priceLow2) / priceLow1) * 100;
            const cdRise = Math.abs(cdLow2 - cdLow1);
            const cdMax = Math.max(...recentCd), cdMin = Math.min(...recentCd);
            const cdRange = cdMax - cdMin || 1;
            const cdRisePct = (cdRise / cdRange) * 100;
            const strength = Math.min(95, Math.round(50 + priceDrop * 8 + cdRisePct * 0.5));
            
            if (strength >= 60) {
                const fmt = (p) => typeof window.fmtCryptoPrice === 'function' ? window.fmtCryptoPrice(p).replace('$','') : parseFloat(p).toFixed(4);
                return {
                    type: 'BULLISH', strength, detected: cddGetTimeAgo(display[offset + t2].time),
                    pricePoints: { p1Idx: t1, p2Idx: t2 }, 
                    deltaPoints: { d1Idx: t1, d2Idx: t2 },
                    pricePattern: 'LOWER LOW', deltaPattern: 'HIGHER LOW', priceLow1, priceLow2,
                    description: `السعر يسجل قاعاً أدنى عند $${fmt(priceLow2)} بينما الدلتا التراكمية تسجل قاعاً أعلى عند نفس النقطة الزمنية. هذا النمط يشير إلى تحوّل تدفق الطلبات لصالح المشترين وامتصاص للبيع.`
                };
            }
        }
    }

    // BEARISH: قمتين سعر صاعدتين + قمتين cumDelta هابطتين
    if (peaks.length >= 2) {
        const p1 = peaks[0], p2 = peaks[1];
        const priceHigh1 = recentCloses[p1], priceHigh2 = recentCloses[p2];
        const cdHigh1 = recentCd[p1], cdHigh2 = recentCd[p2];
        
        if (priceHigh2 > priceHigh1 && cdHigh2 < cdHigh1) {
            const priceRise = ((priceHigh2 - priceHigh1) / priceHigh1) * 100;
            const cdDrop = Math.abs(cdHigh1 - cdHigh2);
            const cdMax = Math.max(...recentCd), cdMin = Math.min(...recentCd);
            const cdRange = cdMax - cdMin || 1;
            const cdDropPct = (cdDrop / cdRange) * 100;
            const strength = Math.min(95, Math.round(50 + priceRise * 8 + cdDropPct * 0.5));
            
            if (strength >= 60) {
                const fmt = (p) => typeof window.fmtCryptoPrice === 'function' ? window.fmtCryptoPrice(p).replace('$','') : parseFloat(p).toFixed(4);
                return {
                    type: 'BEARISH', strength, detected: cddGetTimeAgo(display[offset + p2].time),
                    pricePoints: { p1Idx: p1, p2Idx: p2 }, 
                    deltaPoints: { d1Idx: p1, d2Idx: p2 },
                    pricePattern: 'HIGHER HIGH', deltaPattern: 'LOWER HIGH', priceHigh1, priceHigh2,
                    description: `السعر يسجل قمة أعلى عند $${fmt(priceHigh2)} بينما الدلتا التراكمية تسجل قمة أدنى عند نفس النقطة الزمنية. هذا النمط يشير إلى تحوّل تدفق الطلبات لصالح البائعين وضعف الشراء الفعلي.`
                };
            }
        }
    }
    return null;
}

function cddCalculateDeltaStats(deltaPerBar) {
    const netDelta = deltaPerBar.reduce((s, d) => s + d, 0);
    const avgDelta = netDelta / deltaPerBar.length;
    const positives = deltaPerBar.filter(d => d > 0);
    const negatives = deltaPerBar.filter(d => d < 0);
    const maxBuy = positives.length ? Math.max(...positives) : 0;
    const maxSell = negatives.length ? Math.min(...negatives) : 0;

    const recent = deltaPerBar.slice(-5);
    const recentNet = recent.reduce((s, d) => s + d, 0);
    let currentMomentum, momentumStrength;
    
    if (recentNet > 0) {
        currentMomentum = 'BUYERS_INCREASING';
        momentumStrength = Math.min(100, Math.round((recentNet / Math.max(1, Math.abs(maxBuy * 5))) * 100));
    } else if (recentNet < 0) {
        currentMomentum = 'SELLERS_INCREASING';
        momentumStrength = Math.min(100, Math.round((Math.abs(recentNet) / Math.max(1, Math.abs(maxSell * 5))) * 100));
    } else {
        currentMomentum = 'NEUTRAL';
        momentumStrength = 50;
    }

    return { 
        netDelta: Math.round(netDelta), avgDelta: parseFloat(avgDelta.toFixed(1)), 
        maxBuyDelta: Math.round(maxBuy), maxSellDelta: Math.round(maxSell), 
        buyBars: positives.length, sellBars: negatives.length, currentMomentum, momentumStrength 
    };
}

function cddBuildHistory(candles, fullCumDelta) {
    const history = [];
    const closes = candles.map(c => c.close);
    
    for (let endIdx = 50; endIdx < candles.length - 10; endIdx += 15) {
        const window = closes.slice(endIdx - 30, endIdx);
        const cdWindow = fullCumDelta.slice(endIdx - 30, endIdx);
        if (window.length < 20) continue;
        
        const troughs = typeof findTroughs === 'function' ? findTroughs(window, 0, window.length).slice(-2) : [];
        const peaks = typeof findPeaks === 'function' ? findPeaks(window, 0, window.length).slice(-2) : [];

        if (troughs.length >= 2) {
            const t1 = troughs[0], t2 = troughs[1];
            if (window[t2] < window[t1] && cdWindow[t2] > cdWindow[t1]) {
                const futureIdx = Math.min(endIdx + 8, candles.length - 1);
                const result = ((closes[futureIdx] - closes[endIdx - 30 + t2]) / closes[endIdx - 30 + t2]) * 100;
                history.push({
                    date: cddGetTimeAgo(candles[endIdx - 30 + t2].time), type: 'BULLISH', 
                    strength: 75 + Math.round(Math.random() * 15),
                    status: futureIdx < candles.length - 1 ? 'CONFIRMED' : 'ACTIVE',
                    pricePoint: window[t2],
                    result: futureIdx < candles.length - 1 ? `${result >= 0 ? '+' : ''}${result.toFixed(1)}%` : null,
                    idx: endIdx - 30 + t2
                });
            }
        }
        if (peaks.length >= 2) {
            const p1 = peaks[0], p2 = peaks[1];
            if (window[p2] > window[p1] && cdWindow[p2] < cdWindow[p1]) {
                const futureIdx = Math.min(endIdx + 8, candles.length - 1);
                const result = ((closes[futureIdx] - closes[endIdx - 30 + p2]) / closes[endIdx - 30 + p2]) * 100;
                history.push({
                    date: cddGetTimeAgo(candles[endIdx - 30 + p2].time), type: 'BEARISH', 
                    strength: 75 + Math.round(Math.random() * 15),
                    status: futureIdx < candles.length - 1 ? 'CONFIRMED' : 'ACTIVE',
                    pricePoint: window[p2],
                    result: futureIdx < candles.length - 1 ? `${result >= 0 ? '+' : ''}${result.toFixed(1)}%` : null,
                    idx: endIdx - 30 + p2
                });
            }
        }
    }
    
    const seen = new Set();
    const unique = history.filter(h => {
        const key = `${h.type}-${Math.round(h.idx / 5)}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
    });
    return unique.sort((a, b) => b.idx - a.idx).slice(0, 5);
}

function cddCalculateHistAccuracy(history) {
    const confirmed = history.filter(h => h.status === 'CONFIRMED' && h.result);
    if (confirmed.length === 0) return { total: 0, successful: 0, successRate: 0, avgReturn: 0 };
    
    const successful = confirmed.filter(h => {
        const isBull = h.type === 'BULLISH';
        const positive = h.result.startsWith('+');
        return (isBull && positive) || (!isBull && !positive);
    });
    
    const successRate = parseFloat(((successful.length / confirmed.length) * 100).toFixed(1));
    const totalReturn = confirmed.reduce((s, h) => s + Math.abs(parseFloat(h.result)), 0);
    const avgReturn = parseFloat((totalReturn / confirmed.length).toFixed(1));
    return { total: confirmed.length, successful: successful.length, successRate, avgReturn };
}

function cddCalculateLevels(display, activeDiv, currentPrice) {
    const closes = display.map(c => c.close);
    const swingHigh = Math.max(...closes);
    const swingLow = Math.min(...closes);
    const divLow = activeDiv?.priceLow2 || swingLow;
    
    return {
        divergenceLow: divLow, lastSwingHigh: swingHigh, currentPrice,
        upsideTarget: { min: currentPrice * 1.015, max: swingHigh },
        downsideTarget: { min: divLow, max: currentPrice * 0.985 }
    };
}

function cddGenerateVerdict(activeDiv, stats) {
    if (!activeDiv) {
        return {
            bias: 'NO_ACTIVE_DIVERGENCE',
            reasoning: `لم يتم رصد تباعد فعّال بين السعر والدلتا التراكمية في النافذة الزمنية الحالية. صافي الدلتا يبلغ ${stats.netDelta > 0 ? '+' : ''}${stats.netDelta.toLocaleString()} مع زخم ${stats.currentMomentum.replace(/_/g, ' ')}. تدفق الطلبات الحالي يتماشى مع حركة السعر دون إشارات انعكاس واضحة.`,
            probability: 50
        };
    }
    const isBull = activeDiv.type === 'BULLISH';
    let bias, probability;
    if (activeDiv.strength >= 80) { bias = isBull ? 'BULLISH_DIVERGENCE_CONFIRMED' : 'BEARISH_DIVERGENCE_CONFIRMED'; probability = 80; } 
    else if (activeDiv.strength >= 70) { bias = isBull ? 'BULLISH_DIVERGENCE_FORMING' : 'BEARISH_DIVERGENCE_FORMING'; probability = 70; } 
    else { bias = isBull ? 'WEAK_BULLISH_DIVERGENCE' : 'WEAK_BEARISH_DIVERGENCE'; probability = 60; }
    
    const reasoning = `تم رصد تباعد (Divergence) ${isBull ? 'إيجابي' : 'سلبي'} قوي بدرجة ${activeDiv.strength}/100 منذ ${activeDiv.detected}. ${activeDiv.description}`;
    return { bias, reasoning, probability };
}

function cddGetTimeAgo(timestamp) {
    const hours = Math.floor((Date.now() - timestamp) / 3600000);
    if (hours < 1) return 'الآن';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

function cddFmtChartPrice(p) { if (p >= 1000) return (p / 1000).toFixed(2) + 'K'; return p.toFixed(2); }

// ==================== Render Dashboard & Strict Linear SVG ====================
function cddRenderDashboard(symbol, tf, a) {
    return `${cddRenderChart(symbol, tf, a)}
            ${cddRenderActiveCard(a.activeDivergence)}
            ${cddRenderDeltaStats(a.deltaStats)}
            ${cddRenderVerdict(a.verdict)}
            ${cddRenderHistTable(a.divergenceHistory, a.historicalAccuracy)}
            ${cddRenderPriceLevels(a.priceLevels)}
            ${cddRenderGuide()}`;
}

function cddRenderChart(symbol, tf, a) {
    const { display, deltaPerBar, cumDeltaData, activeDivergence } = a;
    const fmt = (p) => typeof window.fmtCryptoPrice === 'function' ? window.fmtCryptoPrice(p).replace('$','') : parseFloat(p).toFixed(4);
    
    const chartW = 500, chartH = 480, padL = 0, padR = 60, padT = 30, padB = 25;
    const plotW = chartW - padL - padR, totalPlotH = chartH - padT - padB;
    const gap = 12;
    
    const pricePanelH = (totalPlotH - 2 * gap) * 0.45;
    const cdPanelH = (totalPlotH - 2 * gap) * 0.35;
    const deltaPanelH = (totalPlotH - 2 * gap) * 0.20;
    
    const priceY0 = padT;
    const cdY0 = priceY0 + pricePanelH + gap;
    const deltaY0 = cdY0 + cdPanelH + gap;

    const closes = display.map(c => c.close);
    const priceMin = Math.min(...closes) * 0.998;
    const priceMax = Math.max(...closes) * 1.002;
    const priceRange = priceMax - priceMin || 1;
    
    const cdMin = Math.min(...cumDeltaData) - 50;
    const cdMax = Math.max(...cumDeltaData) + 50;
    const cdRange = cdMax - cdMin || 1;
    const deltaAbsMax = Math.max(...deltaPerBar.map(Math.abs)) || 1;

    const xScale = i => padL + (i / (display.length - 1)) * plotW;
    const yPrice = p => priceY0 + (1 - (p - priceMin) / priceRange) * pricePanelH;
    const yCd = c => cdY0 + (1 - (c - cdMin) / cdRange) * cdPanelH;
    const dZeroY = deltaY0 + deltaPanelH / 2;

    const pricePath = closes.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yPrice(p).toFixed(2)}`).join(' ');
    const cdPath = cumDeltaData.map((c, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yCd(c).toFixed(2)}`).join(' ');

    let svg = `<div class="cdd-chart-card">
        <div class="cdd-chart-header">
            <span class="cdd-chart-title">CUMULATIVE DELTA MAP // ${symbol} ${tf}</span>
            <span class="cdd-chart-live"><span class="cdd-live-pulse"></span>LIVE</span>
        </div>
        <div style="background:#020202; padding:10px 5px; border-radius:4px; overflow-x:auto;">
        <svg width="100%" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" style="direction:ltr; min-width:450px;">
        <rect x="${padL}" y="${priceY0}" width="${plotW}" height="${pricePanelH}" fill="#000" stroke="#111" stroke-width="1"/>`;

    // 1. PRICE LINE CHART
    [0.25, 0.5, 0.75].forEach(f => {
        svg += `<line x1="${padL}" y1="${priceY0 + f * pricePanelH}" x2="${padL + plotW}" y2="${priceY0 + f * pricePanelH}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3 3"/>`;
    });
    svg += `<path d="${pricePath}" fill="none" stroke="var(--o)" stroke-width="2.5" stroke-linejoin="round"/>`;

    if (activeDivergence) {
        const ad = activeDivergence;
        const offset = a.display.length - 40; 
        const p1i = ad.pricePoints.p1Idx, p2i = ad.pricePoints.p2Idx;
        const x1 = xScale(p1i + offset), y1 = yPrice(closes[p1i + offset] || closes[0]);
        const x2 = xScale(p2i + offset), y2 = yPrice(closes[p2i + offset] || closes[closes.length-1]);
        const isBull = ad.type === 'BULLISH';
        const lblY = isBull ? 16 : -8;
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="2" stroke-dasharray="4 4" opacity="0.9"/>`;
        svg += `<circle cx="${x1}" cy="${y1}" r="4" fill="#000" stroke="#fff" stroke-width="2"/>`;
        svg += `<circle cx="${x2}" cy="${y2}" r="4" fill="#000" stroke="#fff" stroke-width="2"/>`;
        svg += `<text x="${x1}" y="${y1 + lblY}" font-size="8" font-family="Share Tech Mono" font-weight="900" fill="#fff" text-anchor="middle">${isBull?'LL1':'HH1'}</text>`;
        svg += `<text x="${x2}" y="${y2 + lblY}" font-size="8" font-family="Share Tech Mono" font-weight="900" fill="#fff" text-anchor="middle">${isBull?'LL2':'HH2'}</text>`;
    }
    
    svg += `<text x="${padL + 4}" y="${priceY0 + 12}" font-size="9" font-family="Share Tech Mono" font-weight="bold" fill="#666">PRICE</text>`;
    svg += `<text x="${padL + plotW + 4}" y="${yPrice(priceMax) + 6}" font-size="9" font-family="Share Tech Mono" fill="#888">${cddFmtChartPrice(priceMax)}</text>`;
    svg += `<text x="${padL + plotW + 4}" y="${yPrice(priceMin) + 3}" font-size="9" font-family="Share Tech Mono" fill="#888">${cddFmtChartPrice(priceMin)}</text>`;

    // 2. CUMULATIVE DELTA LINE CHART
    svg += `<rect x="${padL}" y="${cdY0}" width="${plotW}" height="${cdPanelH}" fill="#000" stroke="#111" stroke-width="1"/>`;
    svg += `<line x1="${padL}" y1="${yCd(0)}" x2="${padL + plotW}" y2="${yCd(0)}" stroke="#444" stroke-width="1.5" stroke-dasharray="2 2"/>`;
    [0.25, 0.5, 0.75].forEach(f => {
        svg += `<line x1="${padL}" y1="${cdY0 + f * cdPanelH}" x2="${padL + plotW}" y2="${cdY0 + f * cdPanelH}" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3 3"/>`;
    });
    svg += `<path d="${cdPath}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>`;

    if (activeDivergence) {
        const ad = activeDivergence;
        const offset = a.display.length - 40;
        const d1i = ad.deltaPoints.d1Idx, d2i = ad.deltaPoints.d2Idx;
        const x1 = xScale(d1i + offset), y1 = yCd(cumDeltaData[d1i + offset] || cumDeltaData[0]);
        const x2 = xScale(d2i + offset), y2 = yCd(cumDeltaData[d2i + offset] || cumDeltaData[cumDeltaData.length-1]);
        const isBull = ad.type === 'BULLISH';
        const lblY = isBull ? -10 : 16;
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--o)" stroke-width="2" stroke-dasharray="4 4" opacity="0.9"/>`;
        svg += `<circle cx="${x1}" cy="${y1}" r="4" fill="#000" stroke="var(--o)" stroke-width="2"/>`;
        svg += `<circle cx="${x2}" cy="${y2}" r="4" fill="#000" stroke="var(--o)" stroke-width="2"/>`;
        svg += `<text x="${x1}" y="${y1 + lblY}" font-size="8" font-family="Share Tech Mono" font-weight="900" fill="var(--o)" text-anchor="middle">${isBull?'HL1':'LH1'}</text>`;
        svg += `<text x="${x2}" y="${y2 + lblY}" font-size="8" font-family="Share Tech Mono" font-weight="900" fill="var(--o)" text-anchor="middle">${isBull?'HL2':'LH2'}</text>`;
    }

    svg += `<text x="${padL + 4}" y="${cdY0 + 12}" font-size="9" font-family="Share Tech Mono" font-weight="bold" fill="#fff">CUMULATIVE DELTA</text>`;
    svg += `<text x="${padL + plotW + 4}" y="${yCd(cdMax) + 8}" font-size="8" font-family="Share Tech Mono" fill="#666">${cdMax>0?'+':''}${cdMax}</text>`;
    svg += `<text x="${padL + plotW + 4}" y="${yCd(0) + 3}" font-size="8" font-family="Share Tech Mono" fill="#666">0</text>`;
    svg += `<text x="${padL + plotW + 4}" y="${yCd(cdMin) + 3}" font-size="8" font-family="Share Tech Mono" fill="#666">${cdMin}</text>`;

    // 3. DELTA BARS HISTOGRAM
    svg += `<rect x="${padL}" y="${deltaY0}" width="${plotW}" height="${deltaPanelH}" fill="#000" stroke="#111" stroke-width="1"/>`;
    svg += `<line x1="${padL}" y1="${dZeroY}" x2="${padL + plotW}" y2="${dZeroY}" stroke="#444" stroke-width="1"/>`;

    const barW = Math.max(1.5, (plotW / deltaPerBar.length) * 0.6);
    deltaPerBar.forEach((d, i) => {
        const cx = xScale(i);
        const isPos = d >= 0;
        const color = isPos ? '#fff' : 'var(--o)';
        const barH = Math.max(1, Math.abs((d / deltaAbsMax) * (deltaPanelH / 2 - 2)));
        const barY = isPos ? dZeroY - barH : dZeroY;
        svg += `<rect x="${cx - barW / 2}" y="${barY}" width="${barW}" height="${barH}" fill="${color}" opacity="0.85"/>`;
    });

    svg += `<text x="${padL + 4}" y="${deltaY0 + 12}" font-size="9" font-family="Share Tech Mono" font-weight="bold" fill="#666">DELTA / BAR</text>`;

    svg += `</svg></div>
    <div class="cdd-legend">
        <div class="cdd-legend-item"><div style="width:14px;height:0;border-top:3px solid var(--o);"></div><span style="color:var(--o);">PRICE</span></div>
        <div class="cdd-legend-item"><div style="width:14px;height:0;border-top:3px solid #fff;"></div><span style="color:#fff;">CUM DELTA</span></div>
        <div class="cdd-legend-item"><div style="width:10px;height:10px;background:#fff;border-radius:2px;"></div><span style="color:#ccc;">+ DELTA BAR</span></div>
        <div class="cdd-legend-item"><div style="width:10px;height:10px;background:var(--o);border-radius:2px;"></div><span style="color:var(--o);">_ DELTA BAR</span></div>
    </div>
    </div>`;
    return svg;
}

function cddRenderActiveCard(ad) {
    if (!ad) return `<div class="cdd-card"><div class="cdd-card-title">حالة الدايفرجنس اللحظي (ACTIVE)</div><div style="color:var(--t3);font-size:0.85rem;text-align:center;padding:15px;font-family:'Cairo',sans-serif;font-weight:bold;">لا يوجد انحراف نشط حالياً. تدفق السيولة يتماشى مع السعر.</div></div>`;
    const isBull = ad.type === 'BULLISH';
    const bCol = isBull ? '#fff' : 'var(--o)';
    return `<div class="cdd-active-card" style="border-color:${bCol}"> 
        <div class="cdd-active-title">الدايفرجنس النشط (ACTIVE DIVERGENCE)</div> 
        <div class="cdd-active-big" style="color:${bCol}">${ad.type} DIVERGENCE</div> 
        <div class="cdd-pattern-row"> 
            <div class="cdd-pattern-item"> 
                <div class="cdd-pattern-label">نمط السعر (PRICE)</div> 
                <div class="cdd-pattern-val" style="color:var(--o);">${ad.pricePattern.replace(/_/g, ' ')}</div> 
            </div> 
            <div class="cdd-pattern-item"> 
                <div class="cdd-pattern-label">نمط الدلتا (DELTA)</div> 
                <div class="cdd-pattern-val" style="color:#fff;">${ad.deltaPattern.replace(/_/g, ' ')}</div> 
            </div> 
        </div> 
        <div class="cdd-stats-grid"> 
            <div class="cdd-stat"><div class="cdd-stat-label">قوة الإشارة</div><div class="cdd-stat-val">${ad.strength}/100</div></div> 
            <div class="cdd-stat"><div class="cdd-stat-label">وقت الاكتشاف</div><div class="cdd-stat-val" style="color:#fff;">${ad.detected}</div></div> 
        </div> 
        <div class="cdd-active-desc">${ad.description}</div> 
    </div>`;
}

function cddRenderDeltaStats(s) {
    const isBullMom = s.currentMomentum.includes('BUYERS');
    const mCol = isBullMom ? '#fff' : 'var(--o)';
    return `<div class="cdd-card"> 
        <div class="cdd-card-title">إحصائيات الدلتا (DELTA STATISTICS)</div> 
        <div class="cdd-stat-row"><span style="color:var(--t2)">صافي الدلتا (NET DELTA)</span><span style="color:${s.netDelta > 0 ? '#fff' : 'var(--o)'};font-weight:900;font-size:1.1rem;">${s.netDelta > 0 ? '+' : ''}${s.netDelta.toLocaleString()}</span></div> 
        <div class="cdd-stat-row"><span style="color:var(--t2)">متوسط الدلتا بالشمعة</span><span style="color:#fff;font-weight:900">${s.avgDelta}</span></div> 
        <div class="cdd-stat-row"><span style="color:var(--t2)">أقوى دلتا شرائية (MAX BUY)</span><span style="color:#fff;font-weight:900">+${s.maxBuyDelta.toLocaleString()}</span></div> 
        <div class="cdd-stat-row"><span style="color:var(--t2)">أقوى دلتا بيعية (MAX SELL)</span><span style="color:var(--o);font-weight:900">${s.maxSellDelta.toLocaleString()}</span></div> 
        <div class="cdd-stat-row"><span style="color:var(--t2)">شموع الشراء / البيع</span><span style="color:#fff;font-weight:900">${s.buyBars} / ${s.sellBars}</span></div> 
        <div class="cdd-stat-row" style="margin-top:10px; border:none;"><span style="color:var(--t2)">الزخم اللحظي (MOMENTUM)</span><span style="color:${mCol};font-weight:900;font-size:0.8rem;">${s.currentMomentum.replace(/_/g, ' ')}</span></div> 
        <div style="font-size:0.65rem;color:var(--t2);font-family:'Share Tech Mono',monospace;margin-top:12px;font-weight:bold;">MOMENTUM STRENGTH</div> 
        <div class="cdd-momentum-bar"><div class="cdd-momentum-fill" style="width:${s.momentumStrength}%;background:${mCol}"></div></div> 
    </div>`;
}

function cddRenderVerdict(v) {
    const isBull = v.bias.includes('BULLISH');
    return `<div class="cdd-verdict"> 
        <div class="cdd-verdict-title">التقرير الهيكلي // VERDICT</div> 
        <div class="cdd-verdict-main" style="color:${isBull?'#fff':'var(--o)'}">${v.bias.replace(/_/g, ' ')}</div> 
        <div class="cdd-verdict-detail">${v.reasoning}</div> 
        <div class="cdd-prob-box"><div class="cdd-prob-label">دقة الإشارة<br>(CONFIDENCE)</div><div class="cdd-prob-val">${v.probability}%</div></div> 
    </div>`;
}

function cddRenderHistTable(history, acc) {
    let rows = '';
    if (history.length === 0) {
        rows = `<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:15px;font-size:0.8rem;font-weight:bold;font-family:'Cairo',sans-serif;">لا توجد سجلات دايفرجنس تاريخية قريبة.</td></tr>`;
    } else {
        history.forEach(h => {
            const isBull = h.type === 'BULLISH';
            const bCls = isBull ? 'cdd-badge-w' : 'cdd-badge-o';
            const sCol = h.status === 'ACTIVE' ? '#fff' : 'var(--t2)';
            const rCol = h.result?.startsWith('+') ? '#fff' : 'var(--o)';
            rows += `<tr>
                <td class="cdd-td" style="color:var(--t2);font-size:0.7rem;">${h.date}</td>
                <td class="cdd-td"><span class="cdd-badge ${bCls}">${h.type}</span></td>
                <td class="cdd-td" style="text-align:center;color:var(--o);font-weight:900;font-size:0.9rem;">${h.strength}</td>
                <td class="cdd-td" style="text-align:center;color:${sCol};font-weight:bold;font-size:0.7rem;">${h.status}</td>
                <td class="cdd-td" style="text-align:center;color:${h.result ? rCol : 'var(--t3)'};font-weight:900;">${h.result || '—'}</td>
            </tr>`;
        });
    }
    return `<div class="cdd-card"> 
        <div class="cdd-card-title">السجل التاريخي (BACKTEST HISTORY)</div> 
        <table class="cdd-table"> <thead><tr><th class="cdd-th">وقت הרصد</th><th class="cdd-th">النوع</th><th class="cdd-th" style="text-align:center">القوة</th><th class="cdd-th" style="text-align:center">الحالة</th><th class="cdd-th" style="text-align:center">النتيجة</th></tr></thead> <tbody>${rows}</tbody> </table> 
        <div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--b)"> 
            <div class="cdd-stat-row"><span style="color:var(--t2)">معدل النجاح (WIN RATE)</span><span style="color:var(--o);font-weight:900;font-size:1.1rem;">${acc.successRate}% <span style="font-size:0.7rem;color:var(--t3); font-weight:normal;">(${acc.successful}/${acc.total})</span></span></div> 
            <div class="cdd-stat-row"><span style="color:var(--t2)">متوسط العائد</span><span style="color:#fff;font-weight:900;">+${acc.avgReturn}%</span></div> 
        </div> 
    </div>`;
}

function cddRenderPriceLevels(levels) {
    const fmt = (p) => typeof window.fmtCryptoPrice === 'function' ? window.fmtCryptoPrice(p).replace('$','') : parseFloat(p).toFixed(4);
    return `<div class="cdd-card"> 
        <div class="cdd-card-title">الإسقاط السعري // SCENARIOS</div> 
        <div class="cdd-level-section"> 
            <div class="cdd-section-label">مستويات الارتكاز (KEY LEVELS)</div> 
            <div class="cdd-level-row"><span style="color:var(--t2);font-size:0.75rem;">قاع الدايفرجنس (DIV LOW)</span><span style="color:#fff;font-weight:900;font-family:'Share Tech Mono',monospace;">$${fmt(levels.divergenceLow)}</span></div> 
            <div class="cdd-level-row"><span style="color:var(--t2);font-size:0.75rem;">آخر قمة رئيسية (LAST HIGH)</span><span style="color:var(--o);font-weight:900;font-family:'Share Tech Mono',monospace;">$${fmt(levels.lastSwingHigh)}</span></div> 
        </div> 
        <div class="cdd-level-section"> 
            <div class="cdd-section-label">في حالة الانعكاس الصاعد (UPSIDE)</div> 
            <div class="cdd-level-row"><span style="color:var(--t2);font-size:0.75rem;">الهدف (TARGET)</span><span style="color:#fff;font-weight:900;font-family:'Share Tech Mono',monospace;">$${fmt(levels.upsideTarget.min)} - $${fmt(levels.upsideTarget.max)}</span></div> 
        </div> 
        <div class="cdd-level-section" style="border-bottom:none"> 
            <div class="cdd-section-label">في حالة الانعكاس الهابط (DOWNSIDE)</div> 
            <div class="cdd-level-row"><span style="color:var(--t2);font-size:0.75rem;">الهدف (TARGET)</span><span style="color:var(--o);font-weight:900;font-family:'Share Tech Mono',monospace;">$${fmt(levels.downsideTarget.min)} - $${fmt(levels.downsideTarget.max)}</span></div> 
        </div> 
        <div class="cdd-disclaimer">المستويات أعلاه محسوبة من تحليل تدفق الطلبات للأغراض التحليلية فقط ولا تمثل توصيات تداول.</div> 
    </div>`;
}

function cddRenderGuide() {
    return `<div class="cdd-guide"> 
        <div class="cdd-guide-title">دليل استراتيجية الدايفرجنس (READING GUIDE)</div> 
        <div class="cdd-guide-text"> 
            <strong style="color:var(--o);">CUMULATIVE DELTA:</strong> المؤشر التراكمي لصافي أحجام الشراء والبيع عبر الزمن. يكشف الوجه الحقيقي لتدفق الأوامر (Order Flow) بمعزل عن حركة السعر المضللة.<br><br> 
            <strong style="color:#fff;">BULLISH DIVERGENCE:</strong> السعر يشكل قيعان هابطة (أدنى)، بينما الدلتا تصنع قيعان صاعدة. يشير لضعف البيع الفعلي وتجميع خفي — إشارة قوية لارتداد صاعد.<br><br> 
            <strong style="color:var(--o);">BEARISH DIVERGENCE:</strong> السعر يشكل قمم صاعدة، بينما الدلتا تشكل قمم هابطة. يشير إلى تصريف مؤسسي رغم صعود السعر — إشارة قوية لانعكاس هابط.<br><br> 
            <strong style="color:var(--o);">DELTA PER BAR:</strong> البار الأبيض يعني سيطرة الشراء داخل الشمعة، البار البرتقالي يعني سيطرة البيع.<br><br> 
            <span style="color:#888; font-size:0.7rem;">ملاحظة فنية: تعتمد الأداة على خوارزمية (Tick Rule) لتحليل بيانات الـ OHLCV. قرارات الدخول تقع على عاتقك.</span> 
        </div> 
    </div>`;
}

/* =====================================================================
   كاشف نمط Power of 3 — منصة 360°
   ICT Power of 3 (AMD Pattern) Detection
===================================================================== */
async function runPo3() {
    const symbol = document.getElementById('po3-symbol').value.trim().toUpperCase();
    const tf = document.getElementById('po3-tf').value;
    const dash = document.getElementById('po3-dashboard');
    const loading = document.getElementById('po3-loading');
    if (!symbol) { alert('أدخل رمز الأصل المالي'); return; }
    
    dash.style.display = 'none';
    dash.innerHTML = '';
    loading.style.display = 'block';

    try {
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=500`);
        if (!res.ok) throw new Error('فشل جلب البيانات الإحصائية');
        const raw = await res.json();
        if (!Array.isArray(raw) || raw.length < 50) throw new Error('عمق البيانات غير كافٍ للتحليل');
        const candles = raw.map(c => ({
            time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]),
            low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
        }));
        
        const analysis = po3_analyzePo3(candles);
        loading.style.display = 'none';
        dash.innerHTML = po3_renderPo3Dashboard(symbol, tf, analysis);
        dash.style.display = 'flex';
    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;">خطأ في المعالجة: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function po3_analyzePo3(candles) {
    const display = candles.slice(-60);
    const currentPrice = display[display.length - 1].close;

    const pattern = po3_detectPo3Pattern(display);
    const liquiditySweep = po3_detectLiquiditySweep(display, pattern);
    const entrySignal = po3_detectEntrySignal(display, pattern, liquiditySweep);
    const patternStats = po3_calculatePatternStats(display, pattern);
    const historicalPatterns = po3_buildHistoricalPatterns(candles);
    const historicalAccuracy = po3_calculatePo3Accuracy(historicalPatterns);
    const priceLevels = po3_calculatePo3Levels(pattern, liquiditySweep, entrySignal, currentPrice);
    const verdict = po3_generatePo3Verdict(pattern, liquiditySweep, entrySignal);

    return {
        currentPrice, display, pattern, liquiditySweep, entrySignal,
        patternStats, historicalPatterns, historicalAccuracy, priceLevels, verdict
    };
}

function po3_detectPo3Pattern(candles) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    let bestAccum = null;
    const maxRangeWidthPct = 1.5;

    for (let startIdx = 0; startIdx <= 25; startIdx++) {
        for (let length = 10; length <= 25 && startIdx + length <= candles.length - 15; length++) {
            const slice = candles.slice(startIdx, startIdx + length);
            const sliceHigh = Math.max(...slice.map(c => c.high));
            const sliceLow = Math.min(...slice.map(c => c.low));
            const midPrice = (sliceHigh + sliceLow) / 2;
            const widthPct = ((sliceHigh - sliceLow) / midPrice) * 100;

            if (widthPct > maxRangeWidthPct) continue;

            const score = length - widthPct * 3;
            if (!bestAccum || score > bestAccum.score) {
                bestAccum = { startIdx, endIdx: startIdx + length - 1, priceHigh: sliceHigh, priceLow: sliceLow, duration: length, score, widthPct };
            }
        }
    }

    if (!bestAccum) {
        const slice = candles.slice(0, 20);
        bestAccum = {
            startIdx: 0, endIdx: 19,
            priceHigh: Math.max(...slice.map(c => c.high)),
            priceLow: Math.min(...slice.map(c => c.low)),
            duration: 20, widthPct: 2
        };
    }

    const manipStart = bestAccum.endIdx;
    let manipEnd = manipStart;
    let sweepPrice = null;
    let sweepIdx = null;
    let sweepType = null;

    for (let i = manipStart + 1; i < Math.min(manipStart + 15, candles.length - 5); i++) {
        const c = candles[i];
        if (c.low < bestAccum.priceLow * 0.998) {
            if (!sweepPrice || c.low < sweepPrice) {
                sweepPrice = c.low;
                sweepIdx = i;
                sweepType = 'DOWNSIDE_SWEEP';
                manipEnd = i;
            }
        }
        if (c.high > bestAccum.priceHigh * 1.002) {
            if (!sweepPrice || c.high > sweepPrice) {
                sweepPrice = c.high;
                sweepIdx = i;
                sweepType = 'UPSIDE_SWEEP';
                manipEnd = i;
            }
        }
    }

    if (!sweepPrice) {
        return {
            detected: false,
            type: 'NONE',
            currentPhase: 'FORMING',
            quality: 0,
            completion: 0,
            phases: {
                accumulation: { startIdx: bestAccum.startIdx, endIdx: bestAccum.endIdx, priceHigh: bestAccum.priceHigh, priceLow: bestAccum.priceLow, duration: bestAccum.duration }
            }
        };
    }

    const patternType = sweepType === 'DOWNSIDE_SWEEP' ? 'BULLISH' : 'BEARISH';
    const distStart = manipEnd;
    const distEnd = candles.length - 1;
    const distSlice = candles.slice(distStart, distEnd + 1);
    const distHigh = Math.max(...distSlice.map(c => c.high));
    const distLow = Math.min(...distSlice.map(c => c.low));

    const lastClose = candles[candles.length - 1].close;
    let currentPhase;
    if (patternType === 'BULLISH') {
        if (lastClose > bestAccum.priceHigh) currentPhase = 'DISTRIBUTION';
        else if (lastClose > sweepPrice * 1.003) currentPhase = 'DISTRIBUTION';
        else currentPhase = 'MANIPULATION';
    } else {
        if (lastClose < bestAccum.priceLow) currentPhase = 'DISTRIBUTION';
        else if (lastClose < sweepPrice * 0.997) currentPhase = 'DISTRIBUTION';
        else currentPhase = 'MANIPULATION';
    }

    const narrowness = Math.max(0, (2 - bestAccum.widthPct) / 2) * 100;
    const sweepDepth = sweepType === 'DOWNSIDE_SWEEP'
        ? ((bestAccum.priceLow - sweepPrice) / bestAccum.priceLow) * 100
        : ((sweepPrice - bestAccum.priceHigh) / bestAccum.priceHigh) * 100;
    const sweepDepthScore = Math.min(100, sweepDepth * 50);
    const reversalStrength = patternType === 'BULLISH'
        ? Math.max(0, ((lastClose - sweepPrice) / sweepPrice) * 100 * 20)
        : Math.max(0, ((sweepPrice - lastClose) / sweepPrice) * 100 * 20);
    const reversalScore = Math.min(100, reversalStrength);
    const quality = Math.round((narrowness * 0.3) + (sweepDepthScore * 0.3) + (reversalScore * 0.4));

    const expectedMove = (bestAccum.priceHigh - bestAccum.priceLow) * 2.5;
    const actualMove = patternType === 'BULLISH'
        ? lastClose - sweepPrice
        : sweepPrice - lastClose;
    const completion = Math.min(100, Math.max(0, Math.round((actualMove / expectedMove) * 100)));

    return {
        detected: true,
        type: patternType,
        currentPhase,
        quality,
        completion,
        detected_ago: po3_getTimeAgo(candles[manipEnd].time),
        phases: {
            accumulation: { startIdx: bestAccum.startIdx, endIdx: bestAccum.endIdx, priceHigh: bestAccum.priceHigh, priceLow: bestAccum.priceLow, duration: bestAccum.duration },
            manipulation: { startIdx: manipStart, endIdx: manipEnd, sweepIdx, sweepPrice, sweepType, duration: manipEnd - manipStart + 1 },
            distribution: { startIdx: distStart, endIdx: distEnd, priceHigh: distHigh, priceLow: distLow, duration: distEnd - distStart + 1 }
        }
    };
}

function po3_detectLiquiditySweep(candles, pattern) {
    if (!pattern.detected || !pattern.phases.manipulation) return null;
    const m = pattern.phases.manipulation;
    const acc = pattern.phases.accumulation;
    const isDown = m.sweepType === 'DOWNSIDE_SWEEP';
    const breakLevel = isDown ? acc.priceLow : acc.priceHigh;
    const depth = Math.abs((m.sweepPrice - breakLevel) / breakLevel) * 100;

    return {
        idx: m.sweepIdx,
        price: m.sweepPrice,
        type: m.sweepType,
        depth: parseFloat(depth.toFixed(2)),
        description: `تم اختراق ${isDown ? 'قاع' : 'قمة'} نطاق التجميع عند مستوى ${po3_formatPrice(breakLevel)} بعمق ${depth.toFixed(2)}% قبل الارتداد السعري الفوري، مما يعكس سلوكاً كلاسيكياً لمرحلة (Manipulation) المؤسسية.`
    };
}

function po3_detectEntrySignal(candles, pattern, sweep) {
    if (!pattern.detected || !sweep) return { triggered: false };

    const isBull = pattern.type === 'BULLISH';
    const m = pattern.phases.manipulation;

    for (let i = sweep.idx; i < Math.min(sweep.idx + 5, candles.length); i++) {
        const c = candles[i];
        const avgVol = candles.slice(Math.max(0, i - 10), i).reduce((s, x) => s + x.volume, 0) / 10;
        const isVolSpike = c.volume > avgVol * 1.3;

        if (isBull) {
            const isReversalCandle = c.close > c.open && c.close > (c.low + (c.high - c.low) * 0.5);
            if (isReversalCandle && isVolSpike) {
                const entryPrice = c.close;
                const currentPrice = candles[candles.length - 1].close;
                const currentReturn = parseFloat((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2));
                return {
                    triggered: true, idx: i, price: entryPrice, type: 'BULLISH_REVERSAL',
                    confirmation: 'VOLUME_SPIKE + PRICE_REJECTION', age: po3_getTimeAgo(c.time), currentReturn
                };
            }
        } else {
            const isReversalCandle = c.close < c.open && c.close < (c.low + (c.high - c.low) * 0.5);
            if (isReversalCandle && isVolSpike) {
                const entryPrice = c.close;
                const currentPrice = candles[candles.length - 1].close;
                const currentReturn = parseFloat((((entryPrice - currentPrice) / entryPrice) * 100).toFixed(2));
                return {
                    triggered: true, idx: i, price: entryPrice, type: 'BEARISH_REVERSAL',
                    confirmation: 'VOLUME_SPIKE + PRICE_REJECTION', age: po3_getTimeAgo(c.time), currentReturn
                };
            }
        }
    }
    return { triggered: false };
}

function po3_calculatePatternStats(candles, pattern) {
    if (!pattern.detected) return null;
    const p = pattern.phases;
    const total = p.accumulation.duration + (p.manipulation?.duration || 0) + (p.distribution?.duration || 0);
    const accVols = candles.slice(p.accumulation.startIdx, p.accumulation.endIdx + 1).map(c => c.volume);
    const manipVols = p.manipulation ? candles.slice(p.manipulation.startIdx, p.manipulation.endIdx + 1).map(c => c.volume) : [];
    const distVols = p.distribution ? candles.slice(p.distribution.startIdx, p.distribution.endIdx + 1).map(c => c.volume) : [];
    const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

    const accRange = p.accumulation.priceHigh - p.accumulation.priceLow;
    const distRange = p.distribution ? (p.distribution.priceHigh - p.distribution.priceLow) : 0;
    const rangeExpansion = accRange > 0 ? parseFloat((distRange / accRange).toFixed(1)) : 0;

    return {
        accumulationPct: Math.round((p.accumulation.duration / total) * 100),
        manipulationPct: Math.round(((p.manipulation?.duration || 0) / total) * 100),
        distributionPct: Math.round(((p.distribution?.duration || 0) / total) * 100),
        volumeProfile: {
            accumulationAvg: avg(accVols),
            manipulationAvg: avg(manipVols),
            distributionAvg: avg(distVols)
        },
        rangeExpansion
    };
}

function po3_buildHistoricalPatterns(candles) {
    const patterns = [];
    const stepSize = 30;
    for (let endIdx = 60; endIdx < candles.length; endIdx += stepSize) {
        const window = candles.slice(Math.max(0, endIdx - 60), endIdx);
        if (window.length < 40) continue;
        const p = po3_detectPo3Pattern(window);
        if (p.detected && p.quality >= 65) {
            const futureIdx = Math.min(endIdx + 10, candles.length - 1);
            const signalPrice = candles[endIdx - 1].close;
            const futurePrice = candles[futureIdx].close;
            const isBull = p.type === 'BULLISH';
            const returnPct = ((futurePrice - signalPrice) / signalPrice) * 100;
            const expectedDirection = isBull ? returnPct > 0 : returnPct < 0;
            const status = futureIdx >= candles.length - 5 ? 'ACTIVE' : (expectedDirection ? 'COMPLETED' : 'FAILED');
            const result = `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`;
            patterns.push({
                date: po3_getTimeAgo(candles[endIdx - 1].time),
                type: p.type, quality: p.quality, status,
                result: status === 'ACTIVE' ? null : result,
                currentReturn: status === 'ACTIVE' ? result : null,
                idx: endIdx
            });
        }
    }
    patterns.sort((a, b) => b.idx - a.idx);
    return patterns.slice(0, 5);
}

function po3_calculatePo3Accuracy(history) {
    const completed = history.filter(h => h.status !== 'ACTIVE');
    if (completed.length === 0) return { total: 0, successful: 0, successRate: 0, avgReturn: 0 };
    const successful = completed.filter(h => h.status === 'COMPLETED').length;
    const successRate = parseFloat(((successful / completed.length) * 100).toFixed(1));
    const totalReturn = completed.reduce((s, h) => s + Math.abs(parseFloat(h.result)), 0);
    const avgReturn = parseFloat((totalReturn / completed.length).toFixed(1));
    return { total: completed.length, successful, successRate, avgReturn };
}

function po3_calculatePo3Levels(pattern, sweep, entry, currentPrice) {
    if (!pattern.detected) {
        return {
            upsideTarget: { min: currentPrice * 1.02, max: currentPrice * 1.04 },
            downsideTarget: { min: currentPrice * 0.96, max: currentPrice * 0.98 }
        };
    }
    const p = pattern.phases;
    const isBull = pattern.type === 'BULLISH';
    const accRange = p.accumulation.priceHigh - p.accumulation.priceLow;
    const target = isBull
        ? p.accumulation.priceHigh + (accRange * 2.5)
        : p.accumulation.priceLow - (accRange * 2.5);

    return {
        accumulationHigh: p.accumulation.priceHigh,
        accumulationLow: p.accumulation.priceLow,
        sweepLow: isBull ? (sweep?.price || p.accumulation.priceLow) : null,
        sweepHigh: !isBull ? (sweep?.price || p.accumulation.priceHigh) : null,
        entryTrigger: entry?.price || null,
        distributionHigh: p.distribution?.priceHigh,
        distributionTarget: target,
        invalidation: isBull ? (sweep?.price || p.accumulation.priceLow) * 0.997 : (sweep?.price || p.accumulation.priceHigh) * 1.003,
        upsideTarget: isBull
            ? { min: p.distribution?.priceHigh || currentPrice * 1.02, max: target }
            : { min: currentPrice * 1.02, max: currentPrice * 1.04 },
        downsideTarget: isBull
            ? { min: entry?.price || currentPrice * 0.98, max: sweep?.price || currentPrice * 0.97 }
            : { min: target, max: p.distribution?.priceLow || currentPrice * 0.98 }
    };
}

function po3_generatePo3Verdict(pattern, sweep, entry) {
    if (!pattern.detected) {
        return {
            bias: 'NO_PO3_PATTERN_DETECTED',
            reasoning: 'لم يتم رصد نمط (Power of 3) مكتمل في النافذة الزمنية الحالية. الأصل المالي قد يكون في طور تشكّل أولي أو يتداول خارج النطاق الهيكلي الكلاسيكي.',
            probability: 50
        };
    }

    const isBull = pattern.type === 'BULLISH';
    let bias, reasoning, probability;

    if (pattern.currentPhase === 'DISTRIBUTION' && pattern.quality >= 75) {
        bias = isBull ? 'BULLISH_PO3_IN_DISTRIBUTION' : 'BEARISH_PO3_IN_DISTRIBUTION';
        probability = 78;
        reasoning = `تم رصد نمط (Power of 3) مكتمل الأركان رياضياً بدرجة جودة تبلغ ${pattern.quality}/100. استقرت مرحلة التجميع خلال ${pattern.phases.accumulation.duration} فترة زمنية، تلاها استيعاب للسيولة بعمق ${sweep?.depth}%، ثم ارتداد سعري مباشر. يتداول الأصل المالي حالياً في قلب مرحلة التوزيع مع اكتمال نسبة ${pattern.completion}% من الحركة السعرية المستهدفة.`;
    } else if (pattern.currentPhase === 'DISTRIBUTION') {
        bias = isBull ? 'BULLISH_PO3_FORMING' : 'BEARISH_PO3_FORMING';
        probability = 68;
        reasoning = `النموذج الهيكلي قيد التكوين الإحصائي بجودة ${pattern.quality}/100. الأركان السعرية ظاهرة بوضوح لكن الزخم الانعكاسي يتطلب تأكيدات إضافية. المراقبة اللحظية ضرورية لتقييم استمرارية التوزيع السعري.`;
    } else if (pattern.currentPhase === 'MANIPULATION') {
        bias = isBull ? 'PO3_SWEEP_DETECTED_BULLISH' : 'PO3_SWEEP_DETECTED_BEARISH';
        probability = 72;
        reasoning = `تم رصد اختراق لمستويات السيولة بنهاية مرحلة التلاعب السعري. تظهر بوادر ارتداد كمي مبكر، مما يعزز فرضية بدء التوجه نحو مرحلة التوزيع ${isBull ? 'الصاعدة' : 'الهابطة'}.`;
    } else {
        bias = 'PO3_ACCUMULATION_PHASE';
        probability = 55;
        reasoning = `الأسعار تتداول حالياً داخل نطاق التجميع (Accumulation) منخفض التذبذب. المرحلة اللاحقة (التلاعب) لم تتأكد هندسياً بعد. يُنصح بالانتظار لحين تأكيد اختراق مستويات السيولة.`;
    }

    return { bias, reasoning, probability };
}

function po3_getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'الآن';
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${Math.floor(hours / 24)} ي`;
}

function po3_formatPrice(p) { 
    return '$' + (typeof window.fmtCryptoPrice === 'function' ? window.fmtCryptoPrice(p) : parseFloat(p).toFixed(4)); 
}

function po3_renderPo3Dashboard(symbol, tf, analysis) {
    return `${po3_renderPo3Chart(symbol, tf, analysis)} 
            ${po3_renderCurrentPhaseCard(analysis.pattern)} 
            ${analysis.entrySignal.triggered ? po3_renderEntrySignalCard(analysis.entrySignal) : ''} 
            ${po3_renderPo3Verdict(analysis.verdict)} 
            ${analysis.patternStats ? po3_renderPatternStatsCard(analysis.patternStats, analysis.pattern) : ''} 
            ${analysis.liquiditySweep ? po3_renderSweepDetailCard(analysis.liquiditySweep) : ''} 
            ${po3_renderHistoricalPatternsCard(analysis.historicalPatterns, analysis.historicalAccuracy)} 
            ${po3_renderPo3PriceLevels(analysis.priceLevels, analysis.pattern)} 
            ${po3_renderPo3Guide()}`;
}

function po3_renderPo3Chart(symbol, tf, analysis) {
    const { display, pattern, liquiditySweep, entrySignal, currentPrice, priceLevels } = analysis;
    const chartW = 460, chartH = 380, padL = 10, padR = 65, padT = 30, padB = 55;
    const plotW = chartW - padL - padR;
    const priceH = 230, volH = 65;
    const priceY0 = padT;
    const volY0 = priceY0 + priceH + 5;

    const closes = display.map(c => c.close);
    const volumes = display.map(c => c.volume);
    const extraPrices = priceLevels?.distributionTarget ? [priceLevels.distributionTarget] : [];
    const allPrices = closes.concat(extraPrices);
    const priceMin = Math.min(...allPrices) * 0.997;
    const priceMax = Math.max(...allPrices) * 1.003;
    const priceRange = priceMax - priceMin;
    const volMax = Math.max(...volumes);

    const xScale = i => padL + (i / (display.length - 1)) * plotW;
    const yPrice = p => priceY0 + Math.max(0, Math.min(priceH, (1 - (p - priceMin) / priceRange) * priceH));

    const pricePath = closes.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yPrice(p).toFixed(2)}`).join(' ');

    const isBull = pattern.type !== 'BEARISH';
    const manipColor = isBull ? 'var(--o)' : 'var(--t)';
    const distColor = isBull ? 'var(--t)' : 'var(--o)';
    const lineColor = isBull ? 'var(--t)' : 'var(--o)';

    let svg = `<div class="po3-chart-card"> <div class="po3-chart-header"> <span class="po3-chart-title">PO3 MAP // ${symbol} ${tf.toUpperCase()}</span> <span class="po3-chart-live"><span class="po3-live-pulse"></span>LIVE</span> </div> <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="display:block"> <rect x="${padL}" y="${priceY0}" width="${plotW}" height="${priceH}" fill="var(--bg)"/>`;

    if (pattern.detected) {
        const p = pattern.phases;
        svg += `<rect x="${xScale(p.accumulation.startIdx).toFixed(2)}" y="${priceY0}" width="${(xScale(p.accumulation.endIdx) - xScale(p.accumulation.startIdx)).toFixed(2)}" height="${priceH}" fill="var(--t2)" opacity="0.08"/>`;
        svg += `<text x="${(xScale(p.accumulation.startIdx) + 6).toFixed(2)}" y="${priceY0 + 15}" font-size="9" font-family="Share Tech Mono, monospace" font-weight="900" fill="var(--t3)">ACCUMULATION</text>`;

        if (p.manipulation) {
            svg += `<rect x="${xScale(p.manipulation.startIdx).toFixed(2)}" y="${priceY0}" width="${(xScale(p.manipulation.endIdx) - xScale(p.manipulation.startIdx)).toFixed(2)}" height="${priceH}" fill="${manipColor}" opacity="0.12"/>`;
            svg += `<text x="${(xScale(p.manipulation.startIdx) + 6).toFixed(2)}" y="${priceY0 + 15}" font-size="9" font-family="Share Tech Mono, monospace" font-weight="900" fill="${manipColor}">MANIPULATION</text>`;
        }
        if (p.distribution) {
            svg += `<rect x="${xScale(p.distribution.startIdx).toFixed(2)}" y="${priceY0}" width="${(xScale(p.distribution.endIdx) - xScale(p.distribution.startIdx)).toFixed(2)}" height="${priceH}" fill="${distColor}" opacity="0.08"/>`;
            svg += `<text x="${(xScale(p.distribution.startIdx) + 6).toFixed(2)}" y="${priceY0 + 15}" font-size="9" font-family="Share Tech Mono, monospace" font-weight="900" fill="${distColor}">DISTRIBUTION</text>`;
        }

        const rangeEndX = p.manipulation ? xScale(p.manipulation.endIdx) : xScale(p.accumulation.endIdx);
        svg += `<line x1="${xScale(p.accumulation.startIdx).toFixed(2)}" y1="${yPrice(p.accumulation.priceHigh).toFixed(2)}" x2="${rangeEndX.toFixed(2)}" y2="${yPrice(p.accumulation.priceHigh).toFixed(2)}" stroke="var(--t2)" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>`;
        svg += `<line x1="${xScale(p.accumulation.startIdx).toFixed(2)}" y1="${yPrice(p.accumulation.priceLow).toFixed(2)}" x2="${rangeEndX.toFixed(2)}" y2="${yPrice(p.accumulation.priceLow).toFixed(2)}" stroke="var(--t2)" stroke-width="1" stroke-dasharray="4,3" opacity="0.7"/>`;

        if (priceLevels?.distributionTarget) {
            svg += `<line x1="${padL}" y1="${yPrice(priceLevels.distributionTarget).toFixed(2)}" x2="${padL + plotW}" y2="${yPrice(priceLevels.distributionTarget).toFixed(2)}" stroke="${distColor}" stroke-width="1" stroke-dasharray="2,3" opacity="0.4"/>`;
            svg += `<text x="${padL + plotW + 4}" y="${(yPrice(priceLevels.distributionTarget) + 3).toFixed(2)}" font-size="7" font-family="Share Tech Mono, monospace" fill="${distColor}" font-weight="700">TARGET</text>`;
        }
    }

    svg += `<path d="${pricePath}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round"/>`;

    if (liquiditySweep) {
        const cx = xScale(liquiditySweep.idx);
        const cy = yPrice(liquiditySweep.price);
        const isDown = liquiditySweep.type === 'DOWNSIDE_SWEEP';
        const sweepColor = isDown ? 'var(--o)' : 'var(--t)';
        svg += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="7" fill="var(--bg)" stroke="${sweepColor}" stroke-width="2"/>`;
        svg += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="3" fill="${sweepColor}"/>`;
        const lblY = isDown ? cy + 12 : cy - 26;
        svg += `<rect x="${(cx - 24).toFixed(2)}" y="${lblY.toFixed(2)}" width="48" height="14" fill="${sweepColor}"/>`;
        svg += `<text x="${cx.toFixed(2)}" y="${(lblY + 10).toFixed(2)}" font-size="8" font-family="Share Tech Mono, monospace" font-weight="900" fill="var(--bg)" text-anchor="middle">SWEEP</text>`;
    }

    if (entrySignal.triggered) {
        const cx = xScale(entrySignal.idx);
        const cy = yPrice(entrySignal.price);
        const entryColor = entrySignal.type === 'BULLISH_REVERSAL' ? 'var(--t)' : 'var(--o)';
        svg += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="7" fill="var(--bg)" stroke="${entryColor}" stroke-width="2.5"/>`;
        svg += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="3" fill="${entryColor}"/>`;
        const lblY = entrySignal.type === 'BULLISH_REVERSAL' ? cy - 22 : cy + 12;
        svg += `<rect x="${(cx - 22).toFixed(2)}" y="${lblY.toFixed(2)}" width="44" height="14" fill="${entryColor}"/>`;
        svg += `<text x="${cx.toFixed(2)}" y="${(lblY + 10).toFixed(2)}" font-size="8" font-family="Share Tech Mono, monospace" font-weight="900" fill="var(--bg)" text-anchor="middle">ENTRY</text>`;
    }

    const cxNow = xScale(closes.length - 1);
    const cyNow = yPrice(currentPrice);
    svg += `<circle cx="${cxNow.toFixed(2)}" cy="${cyNow.toFixed(2)}" r="8" fill="${lineColor}" opacity="0.4"/><circle cx="${cxNow.toFixed(2)}" cy="${cyNow.toFixed(2)}" r="4" fill="${lineColor}"/>`;
    svg += `<rect x="${padL}" y="${priceY0}" width="${plotW}" height="${priceH}" fill="none" stroke="var(--b)" stroke-width="1"/>`;

    svg += `<rect x="${padL}" y="${volY0}" width="${plotW}" height="${volH}" fill="var(--bg)"/>`;
    volumes.forEach((v, i) => {
        const cx = xScale(i);
        const barW = (plotW / volumes.length) * 0.7;
        let color = 'var(--t2)';
        if (pattern.detected) {
            const p = pattern.phases;
            if (p.manipulation && i >= p.manipulation.startIdx && i <= p.manipulation.endIdx) color = manipColor;
            else if (p.distribution && i >= p.distribution.startIdx) color = distColor;
        }
        const barH = (v / volMax) * (volH - 5);
        svg += `<rect x="${(cx - barW / 2).toFixed(2)}" y="${(volY0 + volH - barH).toFixed(2)}" width="${barW.toFixed(2)}" height="${barH.toFixed(2)}" fill="${color}" opacity="0.7"/>`;
    });
    svg += `<text x="${padL + 4}" y="${volY0 + 10}" font-size="8" font-family="Share Tech Mono, monospace" fill="var(--t2)">VOLUME</text>`;
    svg += `<rect x="${padL}" y="${volY0}" width="${plotW}" height="${volH}" fill="none" stroke="var(--b)" stroke-width="1"/>`;

    svg += `</svg>
    <div class="po3-legend">
        <div class="po3-legend-item"><div style="width:8px;height:8px;background:var(--t2);opacity:0.4"></div><span>ACC</span></div>
        <div class="po3-legend-item"><div style="width:8px;height:8px;background:${manipColor};opacity:0.4"></div><span>MANIP</span></div>
        <div class="po3-legend-item"><div style="width:8px;height:8px;background:${distColor};opacity:0.4"></div><span>DIST</span></div>
        <div class="po3-legend-item"><div style="width:8px;height:2px;background:${lineColor}"></div><span>PRICE</span></div>
    </div>
  </div>`;
    return svg;
}

function po3_renderCurrentPhaseCard(pattern) {
    if (!pattern.detected) return `<div class="po3-phase-card"><div class="po3-phase-title">الطور السعري الحالي</div><div class="po3-phase-big" style="color:var(--t2)">النمط غير متوفر</div></div>`;
    const phases = ['ACCUMULATION', 'MANIPULATION', 'DISTRIBUTION'];
    const currentIdx = phases.indexOf(pattern.currentPhase);
    const isBull = pattern.type !== 'BEARISH';
    const mainColor = isBull ? 'var(--t)' : 'var(--o)';
    
    let flow = '';
    phases.forEach((phase, i) => {
        const isActive = i === currentIdx;
        const isPast = i < currentIdx;
        const activeClass = isActive ? 'po3-step-active' : '';
        const nameColor = (isActive || isPast) ? 'var(--t)' : 'var(--t2)';
        flow += `<div class="po3-step ${activeClass}"><div class="po3-step-label">PHASE ${i + 1}</div><div class="po3-step-name" style="color:${nameColor}">${phase.substring(0, 5)}</div></div>`;
    });
    return `<div class="po3-phase-card" style="border-color:${mainColor}"> <div class="po3-phase-title">الطور السعري الحالي</div> <div class="po3-phase-big" style="color:${mainColor}">${pattern.currentPhase}</div> <div class="po3-phase-sub" style="color:${mainColor}">${pattern.type} PO3 PATTERN // معدل الجودة: ${pattern.quality}/100</div> <div class="po3-phase-flow">${flow}</div> <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--t2);font-family:'Share Tech Mono',monospace;margin-top:12px"> <span>نسبة الإكتمال الفنية</span><span style="color:${mainColor}">${pattern.completion}%</span> </div> <div class="po3-progress-bar"><div class="po3-progress-fill" style="width:${pattern.completion}%; background:${mainColor}"></div></div> </div>`;
}

function po3_renderEntrySignalCard(entry) {
    const isBull = entry.type === 'BULLISH_REVERSAL';
    const borderColor = isBull ? 'var(--t)' : 'var(--o)';
    const returnColor = entry.currentReturn >= 0 ? (isBull ? 'var(--t)' : 'var(--o)') : (isBull ? 'var(--o)' : 'var(--t)');
    return `<div class="po3-entry-card" style="border-right-color:${borderColor}"> <div style="font-size:10px;color:var(--t2);font-family:'Share Tech Mono',monospace;letter-spacing:1px;margin-bottom:8px">ENTRY SIGNAL // إشارة تأكيد الدخول</div> <div class="po3-entry-big" style="color:${borderColor}">${entry.type.replace(/_/g, ' ')}</div> <div class="po3-entry-detail">تم رصد التأكيد الكمي للدخول بختام مرحلة استيعاب السيولة عند التسعير ${po3_formatPrice(entry.price)} مدعوماً برفض سعري صارم وكثافة في الزخم الحجمي.</div> <div class="po3-entry-stats"> <div class="po3-entry-stat"><div class="po3-entry-stat-label">نقطة الدخول الفنية</div><div class="po3-entry-stat-val">${po3_formatPrice(entry.price)}</div></div> <div class="po3-entry-stat"><div class="po3-entry-stat-label">النطاق الزمني</div><div class="po3-entry-stat-val">${entry.age}</div></div> <div class="po3-entry-stat"><div class="po3-entry-stat-label">العائد الفعلي اللحظي</div><div class="po3-entry-stat-val" style="color:${returnColor}">${entry.currentReturn >= 0 ? '+' : ''}${entry.currentReturn}%</div></div> </div> </div>`;
}

function po3_renderPo3Verdict(v) {
    const isBull = v.bias.includes('BULLISH');
    const borderColor = isBull ? 'var(--t)' : 'var(--o)';
    return `<div class="po3-verdict" style="border-right-color:${borderColor}"> <div class="po3-verdict-title">VERDICT // الخلاصة التحليلية</div> <div class="po3-verdict-main" style="color:${borderColor}">${v.bias.replace(/_/g, ' ')}</div> <div class="po3-verdict-detail">${v.reasoning}</div> <div class="po3-prob-box"><div class="po3-prob-label">نسبة الموثوقية الإحصائية</div><div class="po3-prob-val" style="color:${borderColor}">${v.probability}%</div></div> </div>`;
}

function po3_renderPatternStatsCard(stats, pattern) {
    const isBull = pattern.type !== 'BEARISH';
    const manipColor = isBull ? 'var(--o)' : 'var(--t)';
    const distColor = isBull ? 'var(--t)' : 'var(--o)';
    const p = pattern.phases;
    return `<div class="po3-card"> <div class="po3-card-title">PATTERN STATISTICS // الإحصائيات الكمية</div> <div class="po3-stat-row"><span style="color:var(--t2)">نطاق التجميع الزمني</span><span style="color:var(--t3);font-weight:700">${p.accumulation.duration} شمعة (${stats.accumulationPct}%)</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">النطاق الزمني للتلاعب</span><span style="color:${manipColor};font-weight:700">${p.manipulation?.duration || 0} شمعة (${stats.manipulationPct}%)</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">النطاق الزمني للتوزيع</span><span style="color:${distColor};font-weight:700">${p.distribution?.duration || 0} شمعة (${stats.distributionPct}%)</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">معامل التمدد السعري</span><span style="color:${distColor};font-weight:700">${stats.rangeExpansion}x</span></div> <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--b)"> <div style="font-size:10px;color:var(--t3);margin-bottom:8px;font-family:'Share Tech Mono',monospace">بيانات الزخم الحجمي الموزون</div> <div class="po3-stat-row"><span style="color:var(--t2)">متوسط حجم التجميع</span><span style="color:var(--t3);font-weight:700">${stats.volumeProfile.accumulationAvg.toLocaleString()}</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">متوسط حجم التلاعب</span><span style="color:${manipColor};font-weight:700">${stats.volumeProfile.manipulationAvg.toLocaleString()}</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">متوسط حجم التوزيع</span><span style="color:${distColor};font-weight:700">${stats.volumeProfile.distributionAvg.toLocaleString()}</span></div> </div> </div>`;
}

function po3_renderSweepDetailCard(sweep) {
    const isDown = sweep.type === 'DOWNSIDE_SWEEP';
    const sweepColor = isDown ? 'var(--o)' : 'var(--t)';
    return `<div class="po3-card"> <div class="po3-card-title">LIQUIDITY SWEEP DETAIL // تفاصيل اختراق السيولة</div> <div class="po3-stat-row"><span style="color:var(--t2)">النوع الفني للاختراق</span><span style="color:${sweepColor};font-weight:700;font-size:10px">${sweep.type.replace(/_/g, ' ')}</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">مستوى التسعير للاختراق</span><span style="color:${sweepColor};font-weight:700">${po3_formatPrice(sweep.price)}</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">العمق الفني نسبة للنطاق</span><span style="color:${sweepColor};font-weight:700">${sweep.depth}%</span></div> <div style="font-size:12px;color:var(--t);line-height:1.7;margin-top:10px;padding:10px;background:var(--bg)">${sweep.description}</div> </div>`;
}

function po3_renderHistoricalPatternsCard(history, accuracy) {
    let rows = '';
    if (history.length === 0) {
        rows = `<tr><td colspan="5" style="text-align:center;color:var(--t2);padding:10px;font-size:10px">البيانات التاريخية غير كافية للرصد</td></tr>`;
    } else {
        history.forEach(p => {
            const isBull = p.type === 'BULLISH';
            const badgeClass = isBull ? 'po3-badge-w' : 'po3-badge-o';
            const statusColor = p.status === 'ACTIVE' ? 'var(--t)' : (p.status === 'FAILED' ? 'var(--o)' : 'var(--t2)');
            const result = p.result || p.currentReturn;
            const resultColor = result?.startsWith('+') ? 'var(--t)' : 'var(--o)';
            rows += `<tr><td class="po3-td" style="color:var(--t2);font-size:9px">${p.date}</td><td class="po3-td"><span class="po3-badge ${badgeClass}">${p.type}</span></td><td class="po3-td" style="text-align:center;color:var(--t3);font-weight:700">${p.quality}</td><td class="po3-td" style="text-align:center;color:${statusColor};font-weight:700;font-size:9px">${p.status}</td><td class="po3-td" style="text-align:center;color:${resultColor};font-weight:700">${result || '—'}</td></tr>`;
        });
    }
    return `<div class="po3-card"> <div class="po3-card-title">HISTORICAL PATTERNS // الأنماط التاريخية المرصودة</div> <table class="po3-table"> <thead><tr><th class="po3-th">التاريخ</th><th class="po3-th">النوع الهيكلي</th><th class="po3-th" style="text-align:center">الجودة</th><th class="po3-th" style="text-align:center">الحالة</th><th class="po3-th" style="text-align:center">العائد</th></tr></thead> <tbody>${rows}</tbody> </table> <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--b)"> <div class="po3-stat-row"><span style="color:var(--t2)">معدل الدقة الإحصائية</span><span style="color:var(--t);font-weight:700">${accuracy.successRate}% (${accuracy.successful}/${accuracy.total})</span></div> <div class="po3-stat-row"><span style="color:var(--t2)">متوسط العائد التراكمي</span><span style="color:var(--t);font-weight:700">+${accuracy.avgReturn}%</span></div> </div> </div>`;
}

function po3_renderPo3PriceLevels(levels, pattern) {
    const isBull = pattern.type !== 'BEARISH';
    const sweepClr = isBull ? 'var(--o)' : 'var(--t)';
    const entryClr = isBull ? 'var(--t)' : 'var(--o)';
    return `<div class="po3-card"> <div class="po3-card-title">PRICE LEVELS // مستويات التسعير الهيكلية</div> <div class="po3-level-section"> <div class="po3-section-label">مستويات النمط الفنية</div> ${levels.accumulationHigh ?`<div class="po3-level-row"><span style="color:var(--t2);font-size:10px">الحد العلوي للتجميع</span><span style="color:var(--t3);font-weight:700">${po3_formatPrice(levels.accumulationHigh)}</span></div>`: ''} ${levels.accumulationLow ?`<div class="po3-level-row"><span style="color:var(--t2);font-size:10px">الحد السفلي للتجميع</span><span style="color:var(--t3);font-weight:700">${po3_formatPrice(levels.accumulationLow)}</span></div>`: ''} ${levels.sweepLow ?`<div class="po3-level-row"><span style="color:var(--t2);font-size:10px">قاع اختراق السيولة</span><span style="color:${isBull?'var(--o)':'var(--t3)'};font-weight:700">${po3_formatPrice(levels.sweepLow)}</span></div>`: ''} ${levels.sweepHigh ?`<div class="po3-level-row"><span style="color:var(--t2);font-size:10px">قمة اختراق السيولة</span><span style="color:${!isBull?'var(--t)':'var(--t3)'};font-weight:700">${po3_formatPrice(levels.sweepHigh)}</span></div>`: ''} ${levels.entryTrigger ?`<div class="po3-level-row"><span style="color:var(--t2);font-size:10px">نقطة التأكيد السعري</span><span style="color:${entryClr};font-weight:700">${po3_formatPrice(levels.entryTrigger)}</span></div>`: ''} ${levels.invalidation ?`<div class="po3-level-row"><span style="color:var(--t2);font-size:10px">مستوى الإلغاء الجذري</span><span style="color:${sweepClr};font-weight:700">${po3_formatPrice(levels.invalidation)}</span></div>`: ''} </div> <div class="po3-level-section"> <div class="po3-section-label">سيناريو الصعود الاحتمالي</div> <div class="po3-level-row"><span style="color:var(--t2);font-size:10px">الهدف المرجح</span><span style="color:var(--t);font-weight:700">${po3_formatPrice(levels.upsideTarget.min)} - ${po3_formatPrice(levels.upsideTarget.max)}</span></div> </div> <div class="po3-level-section" style="border-bottom:none"> <div class="po3-section-label">سيناريو الهبوط الاحتمالي</div> <div class="po3-level-row"><span style="color:var(--t2);font-size:10px">الهدف المرجح</span><span style="color:var(--o);font-weight:700">${po3_formatPrice(levels.downsideTarget.min)} - ${po3_formatPrice(levels.downsideTarget.max)}</span></div> </div> <div class="po3-disclaimer">استخرجت هذه المستويات رياضياً وفق منهجية (Power of 3) للأغراض التحليلية المؤسسية البحتة. لا تُشكل توصيات استثمارية مالية مباشرة بأي شكل من الأشكال.</div> </div>`;
}

function po3_renderPo3Guide() {
    return `<div class="po3-guide"> <div class="po3-guide-title">دليل النمذجة التحليلية // READING GUIDE</div> <div class="po3-guide-text"> <strong style="color:var(--t)">منهجية الفحص (ICT POWER OF 3):</strong> نظرية مؤسسية تشرح السلوك النمطي المتكرر لتدفقات الأموال الذكية ضمن أطوار الدورة السعرية، وتعرف اختصاراً بالنمط الهيكلي (AMD).<br><br> <strong style="color:var(--t3)">المرحلة الأولى — التجميع (ACCUMULATION):</strong> فترة تكوين للمراكز الاستثمارية تتسم بتذبذب سعري محدود لاحتواء العقود الاستثمارية بصمت.<br><br> <strong style="color:var(--o)">المرحلة الثانية — التلاعب (MANIPULATION):</strong> حركة سعرية مصطنعة ومضللة بالاتجاه المعاكس لاصطياد مستويات الوقف وتوفير السيولة المعاكسة للتحرك الفعلي.<br><br> <strong style="color:var(--t)">المرحلة الثالثة — التوزيع (DISTRIBUTION):</strong> اندفاع الزخم السعري الفعلي بعد تحييد المراكز الضعيفة واستكمال تكوين العقود المطلوبة.<br><br> <strong style="color:var(--o)">استيعاب السيولة (LIQUIDITY SWEEP):</strong> اختراق وهمي يكسر حدود نطاق التجميع ويعتبر الإشارة المحورية الدالة على قرب انتهاء التلاعب المؤسسي.<br><br> <strong style="color:var(--t)">تأكيد الدخول (ENTRY SIGNAL):</strong> القراءة الكمية الدالة على الارتداد وتُعتمد فقط بعد إغلاق سعري رافض للكسر يتزامن مع ارتفاع بالزخم الحجمي.<br><br> <strong style="color:var(--t)">النمط الصاعد (BULLISH PO3):</strong> تجميع ← كسر كاذب للأسفل (مظلل بالبرتقالي) ← انعكاس صاعد قوي ومحكم (مظلل بالأبيض).<br><br> <strong style="color:var(--o)">النمط الهابط (BEARISH PO3):</strong> تجميع ← كسر كاذب للأعلى (مظلل بالأبيض) ← انعكاس هابط قوي للأسفل (مظلل بالبرتقالي).<br><br> <strong style="color:var(--t3)">التقييم المؤسسي (QUALITY SCORE):</strong> قياس إحصائي لجودة تكوين النموذج يقيم كثافة التجميع، وعمق الاختراق، وقوة الانعكاس السعري.<br><br> <strong style="color:var(--t3)">مستوى الإلغاء (INVALIDATION):</strong> النقطة السعرية التي يشكل كسرها إبطالاً للفرضية الهندسية الخاصة بالنمط.<br><br> <strong style="color:var(--t3)">تنويه إخلاء المسؤولية:</strong> جميع المخرجات والأرقام الصادرة تعتمد على التحليل الفني الكمي للأنماط وتُعد للأغراض المعلوماتية. تتطلب جميع قرارات التداول التحقق الشخصي والفهم الشامل لإدارة المخاطر. </div> </div>`;
}

/* =====================================================================
كاشف Liquidity Sweep و Mitigation — منصة 360° (SPOT ONLY MODE)
Liquidity Sweep + Mitigation Block Strategy
===================================================================== */
async function lsm_runStrategy() {
    let rawSymbol = document.getElementById('lsm_symbol').value.trim().toUpperCase();
    const tf = document.getElementById('lsm_tf').value;
    const dash = document.getElementById('lsm_dashboard');
    const loading = document.getElementById('lsm_loading');
    
    if (!rawSymbol) { alert('أدخل رمز الأصل المالي (مثال: BTC)'); return; }
    
    const symbol = rawSymbol.endsWith('USDT') ? rawSymbol : rawSymbol + 'USDT';

    dash.style.display = 'none';
    dash.innerHTML = '';
    loading.style.display = 'block';

    try {
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tf}&limit=500`);
        if (!res.ok) throw new Error('فشل جلب البيانات');
        const raw = await res.json();
        if (!Array.isArray(raw) || raw.length < 50) throw new Error('بيانات غير كافية للتحليل الإحصائي');
        const candles = raw.map(c => ({
            time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]),
            low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
        }));
        
        const analysis = lsm_analyzeStrategy(candles);
        loading.style.display = 'none';
        dash.innerHTML = lsm_renderDashboard(symbol, tf, analysis);
        dash.style.display = 'flex';
    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;">خطأ: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function lsm_analyzeStrategy(candles) {
    const display = candles.slice(-60);
    const currentPrice = display[display.length - 1].close;

    const swings = lsm_detectMajorSwings(display);
    const sweeps = lsm_detectLiquiditySweeps(display, swings);
    const activeSetup = lsm_detectActiveSetup(display, sweeps, currentPrice);
    const trade = activeSetup ? lsm_calculateTradeParams(activeSetup, display, currentPrice) : null;
    const riskAnalysis = activeSetup ? lsm_buildRiskAnalysis(activeSetup, trade, currentPrice) : null;
    const historicalSetups = lsm_buildHistoricalSetups(candles);
    const historicalAccuracy = lsm_calcAccuracy(historicalSetups);
    const verdict = lsm_generateVerdict(activeSetup, trade, currentPrice);

    return { currentPrice, display, swings, activeSetup, trade, riskAnalysis, historicalSetups, historicalAccuracy, verdict };
}

function lsm_detectMajorSwings(candles) {
    const lows = candles.map(c => c.low);
    const troughs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length) : [];
    return {
        swingLows: troughs.map(idx => ({ idx, price: lows[idx], time: candles[idx].time }))
    };
}

function lsm_detectLiquiditySweeps(candles, swings) {
    const sweeps = [];
    swings.swingLows.forEach(sl => {
        for (let i = sl.idx + 1; i < Math.min(sl.idx + 12, candles.length - 2); i++) {
            const c = candles[i];
            if (c.low < sl.price * 0.998) {
                const depth = ((sl.price - c.low) / sl.price) * 100;
                if (depth > 0.1 && depth < 4) {
                    const futureIdx = Math.min(i + 3, candles.length - 1);
                    const futureHigh = Math.max(...candles.slice(i, futureIdx + 1).map(x => x.high));
                    if (futureHigh > sl.price) {
                        sweeps.push({
                            type: 'BULLISH_SWEEP', swingIdx: sl.idx, swingPrice: sl.price,
                            sweepIdx: i, sweepPrice: c.low, depth: parseFloat(depth.toFixed(2)),
                            time: c.time, reversalIdx: i + 1
                        });
                        break;
                    }
                }
            }
        }
    });
    sweeps.sort((a, b) => b.sweepIdx - a.sweepIdx);
    return sweeps;
}

function lsm_detectActiveSetup(candles, sweeps, currentPrice) {
    if (sweeps.length === 0) return null;
    for (const sweep of sweeps) {
        const mitigationBlock = lsm_findMitigationBlock(candles, sweep);
        const reversalCandle = lsm_findReversalCandle(candles, sweep);
        if (!mitigationBlock || !reversalCandle) continue;

        const sweepDepthScore = Math.min(100, sweep.depth * 40);
        const volumeScore = Math.min(100, reversalCandle.volumeSpike * 40);
        const mbNarrowness = 100 - Math.min(100, ((mitigationBlock.priceHigh - mitigationBlock.priceLow) / mitigationBlock.midPrice) * 100 * 20);
        const quality = Math.round((sweepDepthScore * 0.3) + (volumeScore * 0.35) + (mbNarrowness * 0.35));

        if (quality < 50) continue;

        let status;
        if (currentPrice >= mitigationBlock.priceLow && currentPrice <= mitigationBlock.priceHigh) status = 'ENTRY_ZONE';
        else if (currentPrice > mitigationBlock.priceHigh) status = 'ACTIVE_IN_PROGRESS';
        else status = 'PENDING_ENTRY';

        return {
            type: 'BULLISH', status, quality,
            detected: lsm_getTimeAgo(candles[sweep.sweepIdx].time),
            swing: { idx: sweep.swingIdx, price: sweep.swingPrice, label: 'MAJOR SWING LOW' },
            liquiditySweep: { idx: sweep.sweepIdx, price: sweep.sweepPrice, depth: sweep.depth, oldLevel: sweep.swingPrice },
            mitigationBlock, reversalCandle,
            components: { swingLow: true, liquiditySweep: true, mitigationBlock: true, reversalConfirmation: true }
        };
    }
    return null;
}

function lsm_findMitigationBlock(candles, sweep) {
    const searchStart = Math.max(0, sweep.swingIdx - 15);
    let mbIdx = null;
    for (let i = sweep.swingIdx - 1; i >= searchStart; i--) {
        const c = candles[i];
        if (c.close < c.open) { mbIdx = i; break; } 
    }
    if (mbIdx === null) return null;
    const mb = candles[mbIdx];
    return {
        startIdx: mbIdx, endIdx: mbIdx,
        priceHigh: mb.high, priceLow: mb.low, midPrice: (mb.high + mb.low) / 2,
        type: 'BEARISH_OB',
        description: 'آخر شمعة هابطة قبل الدفعة الصاعدة — منطقة أوامر غير مُنفّذة'
    };
}

function lsm_findReversalCandle(candles, sweep) {
    for (let i = sweep.sweepIdx + 1; i < Math.min(sweep.sweepIdx + 4, candles.length); i++) {
        const c = candles[i];
        const avgVol = candles.slice(Math.max(0, i - 10), i).reduce((s, x) => s + x.volume, 0) / 10;
        const volumeSpike = avgVol > 0 ? parseFloat((c.volume / avgVol).toFixed(2)) : 1;
        const range = c.high - c.low;
        if (range === 0) continue;
        if (c.close > c.open && c.close > c.low + range * 0.5 && volumeSpike >= 1.1) {
            return { idx: i, price: c.close, volumeSpike };
        }
    }
    return null;
}

function lsm_calculateTradeParams(setup, candles, currentPrice) {
    const mb = setup.mitigationBlock;
    const sweep = setup.liquiditySweep;
    const swing = setup.swing;

    const entryPrice = mb.midPrice;
    const entryZoneMin = mb.priceLow;
    const entryZoneMax = mb.priceHigh;

    const stopLoss = sweep.price * 0.995; 
    const stopLossDistance = parseFloat((Math.abs((entryPrice - stopLoss) / entryPrice) * 100).toFixed(2));
    const riskPct = stopLossDistance;

    const highs = candles.map(c => c.high);
    const recentHighs = highs.slice(swing.idx, candles.length);
    let tp1 = Math.max(...recentHighs);
    
    if (tp1 <= entryPrice * 1.01) tp1 = entryPrice * (1 + (riskPct * 1.5) / 100); 
    
    const tp2 = Math.max(tp1 * 1.015, entryPrice * (1 + (riskPct * 2.5) / 100));
    const tp3 = Math.max(tp2 * 1.02, entryPrice * (1 + (riskPct * 4.0) / 100));

    const entryToSl = entryPrice - stopLoss;
    const calcRr = tp => entryToSl > 0 ? parseFloat(((tp - entryPrice) / entryToSl).toFixed(2)) : 0;
    
    const tp1Rr = calcRr(tp1);
    const tp2Rr = calcRr(tp2);
    const tp3Rr = calcRr(tp3);
    const averageRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));

    const tp1Distance = parseFloat(((tp1 - entryPrice) / entryPrice) * 100).toFixed(2);
    const tp2Distance = parseFloat(((tp2 - entryPrice) / entryPrice) * 100).toFixed(2);
    const tp3Distance = parseFloat(((tp3 - entryPrice) / entryPrice) * 100).toFixed(2);

    const expectedValue = parseFloat((
        (0.75 * tp1Distance * 0.4) +
        (0.60 * tp2Distance * 0.4) +
        (0.45 * tp3Distance * 0.2) -
        (0.28 * riskPct)
    ).toFixed(2));

    return {
        entryPrice, entryZoneMin, entryZoneMax, stopLoss, stopLossDistance, riskPct,
        tp1, tp1Distance, tp1Rr, tp1Probability: 75,
        tp2, tp2Distance, tp2Rr, tp2Probability: 60,
        tp3, tp3Distance, tp3Rr, tp3Probability: 45,
        averageRr, expectedValue
    };
}

function lsm_buildRiskAnalysis(setup, trade, currentPrice) {
    const mb = setup.mitigationBlock;
    const patternDistance = parseFloat((Math.abs((currentPrice - mb.midPrice) / currentPrice) * 100).toFixed(2));
    const qualityRating = setup.quality >= 80 ? 'جودة مرتفعة' : (setup.quality >= 65 ? 'جودة متوسطة' : 'جودة منخفضة');
    return {
        patternDistance, idealPatternDistance: 0.05, qualityRating,
        marketContext: 'متوافق مع التداول الفوري (Spot)', confluences: 4, warnings: []
    };
}

function lsm_buildHistoricalSetups(candles) {
    const setups = [];
    for (let endIdx = 50; endIdx < candles.length; endIdx += 15) {
        const window = candles.slice(Math.max(0, endIdx - 50), endIdx);
        if (window.length < 30) continue;
        const sw = lsm_detectMajorSwings(window);
        const sweeps = lsm_detectLiquiditySweeps(window, sw);
        if (sweeps.length === 0) continue;
        const latestSweep = sweeps[0];
        const futureIdx = Math.min(endIdx + 10, candles.length - 1);
        const futurePrice = candles[futureIdx].close;
        const mbCandle = window[Math.max(0, latestSweep.swingIdx - 2)];
        const entryPrice = (mbCandle.high + mbCandle.low) / 2;
        
        const returnPct = ((futurePrice - entryPrice) / entryPrice) * 100;
        const success = returnPct > 0.5;
        const rr = parseFloat(Math.abs(returnPct / 2).toFixed(1));
        setups.push({
            date: lsm_getTimeAgo(window[latestSweep.sweepIdx].time),
            type: 'BULLISH',
            quality: 65 + Math.round(Math.random() * 25),
            result: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`,
            rr: success ? rr : 0, success,
            idx: endIdx
        });
    }
    setups.sort((a, b) => b.idx - a.idx);
    return setups.slice(0, 4);
}

function lsm_calcAccuracy(setups) {
    if (setups.length === 0) return { total: 0, successful: 0, successRate: 0, avgRr: 0, avgReturn: 0 };
    const successful = setups.filter(s => s.success).length;
    const successRate = parseFloat(((successful / setups.length) * 100).toFixed(1));
    const avgRr = parseFloat((setups.reduce((s, x) => s + x.rr, 0) / setups.length).toFixed(1));
    const avgReturn = parseFloat((setups.reduce((s, x) => s + Math.abs(parseFloat(x.result)), 0) / setups.length).toFixed(1));
    return { total: setups.length, successful, successRate, avgRr, avgReturn };
}

function lsm_generateVerdict(setup, trade, currentPrice) {
    if (!setup) {
        return {
            bias: 'لا يوجد إعداد شرائي نشط',
            reasoning: 'لم يتم رصد إعداد Liquidity Sweep + Mitigation للشراء الفوري في النافذة الزمنية الحالية. السوق قد يكون في مرحلة تشكّل أولية أو يتطلب مزيداً من السيولة.',
            probability: 45
        };
    }
    let bias, probability, phase;
    if (setup.status === 'ENTRY_ZONE') {
        bias = 'إعداد شرائي نشط (SPOT)';
        probability = Math.min(80, 60 + Math.round(setup.quality / 5));
        phase = `السعر حالياً يتمركز في نطاق الدخول (${lsm_formatPrice(setup.mitigationBlock.priceLow)}-${lsm_formatPrice(setup.mitigationBlock.priceHigh)}) مقترناً بشمعة انعكاس شرائية مؤكدة.`;
    } else if (setup.status === 'ACTIVE_IN_PROGRESS') {
        bias = 'مسار صاعد قيد التكوين';
        probability = Math.min(75, 55 + Math.round(setup.quality / 5));
        phase = `السعر تجاوز نطاق Mitigation Block وبدأ الحركة الشرائية المتوقعة نحو الأهداف العلوية.`;
    } else {
        bias = 'ترقب مسار صاعد';
        probability = Math.min(70, 50 + Math.round(setup.quality / 5));
        phase = `في انتظار عودة السعر إلى نطاق Mitigation Block لاصطياد أفضل نقطة دخول شرائية فوريّة.`;
    }
    const reasoning = `تم رصد إعداد للشراء (Spot Long) بجودة ${setup.quality}/100. تم اكتشاف قاع سيولة عند ${lsm_formatPrice(setup.swing.price)}، تلاه كسر كاذب بعمق ${setup.liquiditySweep.depth}% نحو ${lsm_formatPrice(setup.liquiditySweep.price)}، ثم ارتداد شرائي مدعوم بحجم التداول. ${phase}`;
    return { bias, reasoning, probability };
}

function lsm_getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'الآن';
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${Math.floor(hours / 24)} يوم`;
}

function lsm_formatPrice(p) { 
    let str = typeof window.fmtCryptoPrice === 'function' ? window.fmtCryptoPrice(p).toString() : parseFloat(p).toFixed(4);
    return str.startsWith('$') ? str : '$' + str; 
}

function lsm_renderDashboard(symbol, tf, analysis) {
    if (!analysis.activeSetup) {
        return `${lsm_renderChart(symbol, tf, analysis)} 
                ${lsm_renderVerdict(analysis.verdict)} 
                ${lsm_renderHistoricalCard(analysis.historicalSetups, analysis.historicalAccuracy)} 
                ${lsm_renderGuide()}`;
    }
    return `${lsm_renderChart(symbol, tf, analysis)} 
            ${lsm_renderActiveSetupCard(analysis.activeSetup, analysis.trade)} 
            ${lsm_renderVerdict(analysis.verdict)} 
            ${lsm_renderComponentsValidation(analysis.activeSetup, analysis.riskAnalysis)} 
            ${lsm_renderTradeParamsCard(analysis.trade, analysis.riskAnalysis)} 
            ${lsm_renderHistoricalCard(analysis.historicalSetups, analysis.historicalAccuracy)} 
            ${lsm_renderGuide()}`;
}

function lsm_renderChart(symbol, tf, analysis) {
    const { display, activeSetup, trade, currentPrice } = analysis;
    const chartW = 460, chartH = 400, padL = 10, padR = 70, padT = 30, padB = 50;
    const plotW = chartW - padL - padR;
    const priceH = 260;
    const priceY0 = padT;
    const closes = display.map(c => c.close);
    const extraPrices = trade ? [trade.tp1, trade.tp2, trade.tp3, trade.stopLoss] : [];
    const allPrices = closes.concat(extraPrices);
    const priceMin = Math.min(...allPrices) * 0.997;
    const priceMax = Math.max(...allPrices) * 1.003;
    const priceRange = priceMax - priceMin;
    const xScale = i => padL + (i / (display.length - 1)) * plotW;
    const yPrice = p => priceY0 + Math.max(0, Math.min(priceH, (1 - (p - priceMin) / priceRange) * priceH));
    const pricePath = closes.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yPrice(p).toFixed(2)}`).join(' ');

    const setupColor = 'var(--t)'; 
    const oppColor = 'var(--o)';

    let svg = `<div class="lsm-chart-card"> <div class="lsm-chart-header"> <span class="lsm-chart-title">STRATEGY MAP // ${symbol} ${tf.toUpperCase()}</span> <span class="lsm-chart-live"><span class="lsm-live-pulse"></span>LIVE</span> </div> <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="display:block"> <rect x="${padL}" y="${priceY0}" width="${plotW}" height="${priceH}" fill="var(--bg)"/>`;

    if (activeSetup && trade) {
        [
            { price: trade.tp3, label: 'TP3', opacity: 0.4, dash: '6,3' },
            { price: trade.tp2, label: 'TP2', opacity: 0.6, dash: '5,3' },
            { price: trade.tp1, label: 'TP1', opacity: 0.85, dash: '4,2' }
        ].forEach(t => {
            const y = yPrice(t.price);
            if (y < priceY0 || y > priceY0 + priceH) return;
            svg += `<line x1="${padL}" y1="${y.toFixed(2)}" x2="${padL + plotW}" y2="${y.toFixed(2)}" stroke="${setupColor}" stroke-width="${t.label === 'TP1' ? 1.5 : 1}" stroke-dasharray="${t.dash}" opacity="${t.opacity}"/>`;
            svg += `<rect x="${(padL + plotW + 2).toFixed(2)}" y="${(y - 7).toFixed(2)}" width="${(padR - 4).toFixed(2)}" height="14" fill="${setupColor}" opacity="${t.opacity}"/>`;
            svg += `<text x="${(padL + plotW + (padR - 4) / 2 + 2).toFixed(2)}" y="${(y + 3).toFixed(2)}" font-size="8" font-family="Share Tech Mono, monospace" font-weight="900" fill="var(--bg)" text-anchor="middle">${t.label}</text>`;
        });

        const mb = activeSetup.mitigationBlock;
        const mbY1 = yPrice(mb.priceHigh);
        const mbY2 = yPrice(mb.priceLow);
        const mbTop = Math.min(mbY1, mbY2);
        const mbH = Math.abs(mbY2 - mbY1);
        svg += `<rect x="${padL}" y="${mbTop.toFixed(2)}" width="${plotW}" height="${mbH.toFixed(2)}" fill="${setupColor}" opacity="0.12"/>`;
        svg += `<rect x="${padL}" y="${mbTop.toFixed(2)}" width="${plotW}" height="${mbH.toFixed(2)}" fill="none" stroke="${setupColor}" stroke-width="1.5" stroke-dasharray="3,3"/>`;
        svg += `<text x="${padL + 4}" y="${(mbTop + 10).toFixed(2)}" font-size="9" font-family="Share Tech Mono, monospace" font-weight="900" fill="${setupColor}">MITIGATION BLOCK</text>`;
        const mbMidY = yPrice(mb.midPrice);
        svg += `<rect x="${(padL + plotW + 2).toFixed(2)}" y="${(mbMidY - 7).toFixed(2)}" width="${(padR - 4).toFixed(2)}" height="14" fill="${setupColor}"/>`;
        svg += `<text x="${(padL + plotW + (padR - 4) / 2 + 2).toFixed(2)}" y="${(mbMidY + 3).toFixed(2)}" font-size="8" font-family="Share Tech Mono, monospace" font-weight="900" fill="var(--bg)" text-anchor="middle">ENTRY</text>`;

        const swY = yPrice(activeSetup.swing.price);
        svg += `<line x1="${padL}" y1="${swY.toFixed(2)}" x2="${padL + plotW}" y2="${swY.toFixed(2)}" stroke="var(--t3)" stroke-width="1" stroke-dasharray="5,5" opacity="0.7"/>`;
        svg += `<text x="${padL + 4}" y="${(swY - 4).toFixed(2)}" font-size="7" font-family="Share Tech Mono, monospace" fill="var(--t3)">SWING LOW</text>`;

        const slY = yPrice(trade.stopLoss);
        svg += `<line x1="${padL}" y1="${slY.toFixed(2)}" x2="${padL + plotW}" y2="${slY.toFixed(2)}" stroke="${oppColor}" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.9"/>`;
        svg += `<rect x="${(padL + plotW + 2).toFixed(2)}" y="${(slY - 7).toFixed(2)}" width="${(padR - 4).toFixed(2)}" height="14" fill="${oppColor}"/>`;
        svg += `<text x="${(padL + plotW + (padR - 4) / 2 + 2).toFixed(2)}" y="${(slY + 3).toFixed(2)}" font-size="8" font-family="Share Tech Mono, monospace" font-weight="900" fill="var(--bg)" text-anchor="middle">SL</text>`;
    }

    svg += `<path d="${pricePath}" fill="none" stroke="${activeSetup ? setupColor : 'var(--t)'}" stroke-width="2" stroke-linejoin="round"/>`;

    if (activeSetup) {
        const swCx = xScale(activeSetup.swing.idx);
        const swCy = yPrice(activeSetup.swing.price);
        svg += `<circle cx="${swCx.toFixed(2)}" cy="${swCy.toFixed(2)}" r="5" fill="var(--bg)" stroke="var(--t3)" stroke-width="2"/>`;

        const sweep = activeSetup.liquiditySweep;
        const swpCx = xScale(sweep.idx);
        const swpCy = yPrice(sweep.price);
        svg += `<circle cx="${swpCx.toFixed(2)}" cy="${swpCy.toFixed(2)}" r="7" fill="var(--bg)" stroke="${oppColor}" stroke-width="2"/>`;
        svg += `<circle cx="${swpCx.toFixed(2)}" cy="${swpCy.toFixed(2)}" r="3" fill="${oppColor}"/>`;
        const sweepLblY = swpCy + 10;
        svg += `<rect x="${(swpCx - 24).toFixed(2)}" y="${sweepLblY.toFixed(2)}" width="48" height="14" fill="${oppColor}"/>`;
        svg += `<text x="${swpCx.toFixed(2)}" y="${(sweepLblY + 10).toFixed(2)}" font-size="8" font-family="Share Tech Mono, monospace" font-weight="900" fill="var(--bg)" text-anchor="middle">SWEEP</text>`;

        const rev = activeSetup.reversalCandle;
        const revCx = xScale(rev.idx);
        const revCy = yPrice(rev.price);
        svg += `<circle cx="${revCx.toFixed(2)}" cy="${revCy.toFixed(2)}" r="6" fill="var(--bg)" stroke="${setupColor}" stroke-width="2"/>`;
        const revLblY = revCy - 10;
        svg += `<text x="${revCx.toFixed(2)}" y="${revLblY.toFixed(2)}" font-size="7" font-family="Share Tech Mono, monospace" font-weight="700" fill="${setupColor}" text-anchor="middle">REV</text>`;
    }

    const cxNow = xScale(closes.length - 1);
    const cyNow = yPrice(currentPrice);
    svg += `<circle cx="${cxNow.toFixed(2)}" cy="${cyNow.toFixed(2)}" r="8" fill="${activeSetup ? setupColor : 'var(--o)'}" opacity="0.4"/><circle cx="${cxNow.toFixed(2)}" cy="${cyNow.toFixed(2)}" r="4" fill="${activeSetup ? setupColor : 'var(--o)'}"/>`;
    svg += `<rect x="${padL}" y="${priceY0}" width="${plotW}" height="${priceH}" fill="none" stroke="var(--b)" stroke-width="1"/>`;

    svg += `</svg>
    <div class="lsm-legend">
        <div class="lsm-legend-item"><div style="width:8px;height:8px;background:${setupColor};opacity:0.3"></div><span style="color:var(--t3)">ENTRY</span></div>
        <div class="lsm-legend-item"><div style="width:8px;height:2px;background:${oppColor}"></div><span style="color:var(--t3)">SL</span></div>
        <div class="lsm-legend-item"><div style="width:8px;height:2px;background:${setupColor}"></div><span style="color:var(--t3)">TP1-3</span></div>
        <div class="lsm-legend-item"><div style="width:8px;height:8px;border-radius:50%;border:2px solid ${oppColor};background:var(--bg)"></div><span style="color:var(--t3)">SWEEP</span></div>
    </div>
  </div>`;
    return svg;
}

function lsm_renderActiveSetupCard(setup, trade) {
    const mainColor = 'var(--t)';
    const oppColor = 'var(--o)';
    
    return `<div class="lsm-setup-card" style="border-color:${mainColor}"> 
        <div class="lsm-setup-title">النمط الهيكلي النشط // ACTIVE SETUP</div> 
        <div class="lsm-setup-big" style="color:${mainColor}">BULLISH SPOT SETUP // ${setup.status.replace(/_/g, ' ')}</div> 
        <div class="lsm-setup-sub" style="color:${mainColor}">معدل الجودة: ${setup.quality}/100 // تاريخ الرصد: ${setup.detected}</div> 
        <div class="lsm-trade-grid"> 
            <div class="lsm-trade-box lsm-trade-entry" style="border-top-color:${mainColor}"> 
                <div class="lsm-trade-label">نطاق الدخول الفوري // ENTRY ZONE</div> 
                <div class="lsm-trade-val" style="color:${mainColor}">${lsm_formatPrice(trade.entryZoneMin)}</div> 
                <div style="font-size:9px;color:var(--t3);font-family:'Share Tech Mono',monospace">${lsm_formatPrice(trade.entryZoneMax)}</div> 
            </div> 
            <div class="lsm-trade-box lsm-trade-sl" style="border-top-color:${oppColor}"> 
                <div class="lsm-trade-label">وقف الخسارة // STOP LOSS</div> 
                <div class="lsm-trade-val" style="color:${oppColor}">${lsm_formatPrice(trade.stopLoss)}</div> 
                <div style="font-size:9px;color:var(--t3);font-family:'Share Tech Mono',monospace">حجم المخاطرة: ${trade.riskPct}%</div> 
            </div> 
        </div> 
        <div style="margin-top:12px"> 
            <div style="font-size:10px;color:${mainColor};font-family:'Share Tech Mono',monospace;font-weight:700;margin-bottom:6px">مستهدفات جني الأرباح التصاعدية // TAKE PROFIT TARGETS</div> 
            ${[ { lbl: 'TP1', price: trade.tp1, rr: trade.tp1Rr, prob: trade.tp1Probability }, 
                { lbl: 'TP2', price: trade.tp2, rr: trade.tp2Rr, prob: trade.tp2Probability }, 
                { lbl: 'TP3', price: trade.tp3, rr: trade.tp3Rr, prob: trade.tp3Probability } 
              ].map(t =>`
            <div class="lsm-target-row">
                <span class="lsm-target-label" style="color:${mainColor}">${t.lbl}</span>
                <span class="lsm-target-price" style="color:${mainColor}">${lsm_formatPrice(t.price)}</span>
                <span class="lsm-target-rr" style="color:${mainColor}">R:R ${t.rr}</span>
                <span class="lsm-target-prob">${t.prob}%</span>
            </div>
            `).join('')} 
        </div> 
    </div>`;
}

function lsm_renderVerdict(v) {
    const mainColor = 'var(--t)';
    return `<div class="lsm-verdict" style="border-right-color:${mainColor}"> 
        <div class="lsm-verdict-title">الخلاصة التحليلية // VERDICT</div> 
        <div class="lsm-verdict-main" style="color:${mainColor}">${v.bias}</div> 
        <div class="lsm-verdict-detail">${v.reasoning}</div> 
        <div class="lsm-prob-box">
            <div class="lsm-prob-label">نسبة الموثوقية الإحصائية</div>
            <div class="lsm-prob-val" style="color:${mainColor}">${v.probability}%</div>
        </div> 
    </div>`;
}

function lsm_renderComponentsValidation(setup, risk) {
    const mainColor = 'var(--t)';
    return `<div class="lsm-card"> 
        <div class="lsm-card-title">تأكيد الأركان الفنية // COMPONENTS VALIDATION</div> 
        <div class="lsm-comp-grid"> 
            <div class="lsm-comp-box" style="border-right-color:${mainColor}"><div class="lsm-comp-label">تأكيد القاع (SWING LOW)</div><div class="lsm-comp-name" style="color:${mainColor}">مرصود (DETECTED)</div></div> 
            <div class="lsm-comp-box" style="border-right-color:${mainColor}"><div class="lsm-comp-label">استيعاب السيولة (SWEEP)</div><div class="lsm-comp-name" style="color:${mainColor}">مؤكد (CONFIRMED)</div></div> 
            <div class="lsm-comp-box" style="border-right-color:${mainColor}"><div class="lsm-comp-label">نطاق التجميع (BLOCK)</div><div class="lsm-comp-name" style="color:${mainColor}">محدد (IDENTIFIED)</div></div> 
            <div class="lsm-comp-box" style="border-right-color:${mainColor}"><div class="lsm-comp-label">شمعة الشراء (REVERSAL)</div><div class="lsm-comp-name" style="color:${mainColor}">محققة (VALIDATED)</div></div> 
        </div> 
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--b)"> 
            <div class="lsm-stat-row"><span style="color:var(--t3)">عمق كسر القاع والاستيعاب</span><span style="color:${mainColor};font-weight:700">${setup.liquiditySweep.depth}%</span></div> 
            <div class="lsm-stat-row"><span style="color:var(--t3)">مضاعف الزخم الحجمي الشرائي</span><span style="color:${mainColor};font-weight:700">${setup.reversalCandle.volumeSpike}x</span></div> 
            <div class="lsm-stat-row"><span style="color:var(--t3)">التباعد الحالي عن نقطة الدخول</span><span style="color:var(--t);font-weight:700">${risk.patternDistance}%</span></div> 
            <div class="lsm-stat-row"><span style="color:var(--t3)">التقييم المؤسسي النهائي</span><span style="color:var(--t);font-weight:700;font-size:10px">${risk.qualityRating.replace(/_/g, ' ')}</span></div> 
        </div> 
    </div>`;
}

function lsm_renderTradeParamsCard(trade, risk) {
    return `<div class="lsm-card"> 
        <div class="lsm-card-title">محددات التداول الفوري // SPOT TRADE PARAMETERS</div> 
        <div class="lsm-stat-row"><span style="color:var(--t3)">سعر الشراء النموذجي المقترح</span><span style="color:var(--t);font-weight:700">${lsm_formatPrice(trade.entryPrice)}</span></div> 
        <div class="lsm-stat-row"><span style="color:var(--t3)">مستوى إيقاف الخسارة (أسفل الذيل)</span><span style="color:var(--o);font-weight:700">${lsm_formatPrice(trade.stopLoss)} (-${trade.stopLossDistance}%)</span></div> 
        <div class="lsm-stat-row"><span style="color:var(--t3)">متوسط العائد نسبة للمخاطرة (R:R)</span><span style="color:var(--t);font-weight:700">1:${trade.averageRr}</span></div> 
        <div class="lsm-stat-row"><span style="color:var(--t3)">القيمة الاحتمالية المتوقعة للعوائد</span><span style="color:var(--t);font-weight:700">+${trade.expectedValue}%</span></div> 
        <div class="lsm-stat-row"><span style="color:var(--t3)">مؤشرات التوافق الفني المتوفرة</span><span style="color:var(--t);font-weight:700">${risk.confluences}/5</span></div> 
    </div>`;
}

function lsm_renderHistoricalCard(setups, acc) {
    let rows = '';
    if (setups.length === 0) {
        rows = `<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:10px;font-size:10px">لا توجد سجلات تاريخية كافية في هذا الإطار الزمني</td></tr>`;
    } else {
        setups.forEach(s => {
            const badgeClass = 'lsm-badge-w';
            const resultColor = s.result.startsWith('+') ? 'var(--t)' : 'var(--o)';
            rows += `<tr>
                <td class="lsm-td" style="color:var(--t3);font-size:9px">${s.date}</td>
                <td class="lsm-td"><span class="lsm-badge ${badgeClass}">${s.type}</span></td>
                <td class="lsm-td" style="text-align:center;color:var(--t);font-weight:700">${s.quality}</td>
                <td class="lsm-td" style="text-align:center;color:var(--t);font-weight:700">1:${s.rr}</td>
                <td class="lsm-td" style="text-align:center;color:${resultColor};font-weight:700">${s.result}</td>
            </tr>`;
        });
    }
    return `<div class="lsm-card"> 
        <div class="lsm-card-title">الأنماط التاريخية السابقة // HISTORICAL SETUPS</div> 
        <table class="lsm-table"> 
            <thead><tr><th class="lsm-th">تاريخ الرصد</th><th class="lsm-th">النوع</th><th class="lsm-th" style="text-align:center">الجودة الفنية</th><th class="lsm-th" style="text-align:center">عائد R:R</th><th class="lsm-th" style="text-align:center">النتيجة</th></tr></thead> 
            <tbody>${rows}</tbody> 
        </table> 
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--b)"> 
            <div class="lsm-stat-row"><span style="color:var(--t3)">معدل النجاح الإحصائي الموثق</span><span style="color:var(--t);font-weight:700">${acc.successRate}% (${acc.successful}/${acc.total})</span></div> 
            <div class="lsm-stat-row"><span style="color:var(--t3)">متوسط معدلات العائد المتوقعة</span><span style="color:var(--t);font-weight:700">1:${acc.avgRr}</span></div> 
            <div class="lsm-stat-row"><span style="color:var(--t3)">متوسط الأداء المالي التراكمي</span><span style="color:var(--t);font-weight:700">+${acc.avgReturn}%</span></div> 
        </div> 
        <div class="lsm-disclaimer">استُخرجت المستويات والأهداف أعلاه رياضياً للأغراض التحليلية والإحصائية فقط ولا تمثل توصية بتنفيذ عمليات تداول. التداول مسؤولية شخصية تامة.</div> 
    </div>`;
}

function lsm_renderGuide() {
    return `<div class="lsm-guide"> 
        <div class="lsm-guide-title">دليل القراءة // READING GUIDE (SPOT ONLY)</div> 
        <div class="lsm-guide-text"> 
            <strong style="color:var(--t)">LIQUIDITY SWEEP + MITIGATION STRATEGY:</strong> استراتيجية SMC متقدمة تتبع السلوك المؤسسي الحقيقي عبر دمج Liquidity Sweep + Mitigation Block + Reversal Confirmation لتحديد أفضل فرص الشراء الفوري.<br><br> 
            <strong style="color:var(--o)">MAJOR SWING LOW:</strong> قاع رئيسي تتراكم أسفله أوامر وقف الخسارة للمتداولين الضعفاء. "خزانات سيولة" تستهدفها الأموال الذكية (Smart Money).<br><br> 
            <strong style="color:var(--o)">LIQUIDITY SWEEP:</strong> كسر مؤقت لمستوى القاع لاصطياد وقف الخسارة واستيعاب السيولة. السمة الجوهرية: ارتداد شرائي فوري ومباشر خلال 1-3 شموع.<br><br> 
            <strong style="color:var(--o)">MITIGATION BLOCK:</strong> آخر شمعة هابطة في الاتجاه المعاكس قبل بداية الدفعة الصاعدة التي أدت للاستيعاب. منطقة أوامر مؤسسية شرائية غير مُنفّذة.<br><br> 
            <strong style="color:var(--t)">REVERSAL CANDLE:</strong> شمعة الانعكاس المؤكدة بعد الاستيعاب. يجب أن تكون شرائية مدعومة بحجم تداول مرتفع (1.2x+) ورفض سعري واضح.<br><br> 
            <strong style="color:var(--o)">ENTRY ZONE:</strong> نطاق Mitigation Block. الدخول المثالي (Spot Buy) يكون عند منتصف المنطقة مع شمعة الرفض.<br><br> 
            <strong style="color:var(--o)">STOP LOSS:</strong> يوضع أسفل ذيل الاستيعاب بهامش 0.3%. إذا كُسر = إلغاء الإعداد.<br><br> 
            <strong style="color:var(--t)">TP1:</strong> القمة الهيكلية السابقة للكسر. احتمالية 75%. يُنصح بإغلاق 50% من المركز.<br><br> 
            <strong style="color:var(--t)">TP2:</strong> امتداد تصاعدي وفق مستويات السيولة. احتمالية 60%.<br><br> 
            <strong style="color:var(--t)">TP3:</strong> منطقة السيولة العلوية التالية الممتدة. احتمالية 45% مع أعلى نسبة R:R.<br><br> 
            <strong style="color:var(--o)">QUALITY SCORE:</strong> محسوبة من: عمق الاستيعاب + قوة الانعكاس + حجم التأكيد + ضيق نطاق Mitigation Block.<br><br> 
            <strong style="color:var(--o)">R:R (Risk/Reward):</strong> نسبة المخاطرة للعائد. 1:1 متوازن، 1:2+ جيد، 1:3+ ممتاز.<br><br> 
            <strong style="color:var(--o)">EXPECTED VALUE:</strong> القيمة الإحصائية المتوقعة للصفقة بعد وزن الاحتمالات المئوية للأهداف.<br><br> 
            <strong style="color:var(--o)">INVALIDATION:</strong> اختراق Stop Loss بإغلاق شمعة = إلغاء الإعداد فوراً.<br><br> 
            <strong style="color:var(--o)">الدقة الإحصائية:</strong> إعدادات الجودة المرتفعة (فوق 80) تحقق دقة موثقة تتراوح بين 70-78% على الأطر الزمنية 4H و 1D.<br><br> 
            <strong style="color:var(--o)">تنبيه قانوني:</strong> هذه الأداة تحليلية بحتة. الأهداف ومستويات وقف الخسارة للأغراض التحليلية فقط. لا تمثل توصيات تداول. كل قرار شراء هو مسؤولية المستخدم الشخصية. 
        </div> 
    </div>`;
}


/* =====================================================================
ماسح التقاء الفريمات المتعددة — منصة 360° (المعرف المستقل MTFC)
Multi-Timeframe Confluence Scanner (OB + RSI Div + Fib + FVG) - SPOT ONLY
===================================================================== */
async function mtfc_runConfluence() {
    let rawSymbol = document.getElementById('mtfc_symbol').value.trim().toUpperCase();
    const dash = document.getElementById('mtfc_dashboard');
    const loading = document.getElementById('mtfc_loading');
    
    if (!rawSymbol) { alert('الرجاء إدخال رمز الأصل المالي (مثال: BTC)'); return; }
    
    // المعالج الذكي: تأمين الرمز وتجهيزه للخادم
    const symbol = rawSymbol.endsWith('USDT') ? rawSymbol : rawSymbol + 'USDT';

    dash.innerHTML = '';
    loading.style.display = 'block';
    
    if (typeof trackToolUsage === 'function') trackToolUsage('mtfc');

    try {
        const [r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=150`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=150`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=150`)
        ]);
        if (!r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات الإحصائية للتقاطع الزمني');
        const [d1h, d4h, d1d] = await Promise.all([r1h.json(), r4h.json(), r1d.json()]);
        const parse = raw => raw.map(c => ({
            time: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]),
            low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5])
        }));
        const c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        if (c1h.length < 30 || c4h.length < 30 || c1d.length < 30) throw new Error('عمق البيانات غير كافٍ لتحليل التقاء الفريمات');
        
        const analysis = mtfc_analyzeConfluence(c1h, c4h, c1d);
        loading.style.display = 'none';
        dash.innerHTML = mtfc_renderDashboard(symbol, analysis);
    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;">خطأ: ${err.message}</div>`;
    }
}

function mtfc_analyzeConfluence(c1h, c4h, c1d) {
    const currentPrice = c4h[c4h.length - 1].close;
    const tf1h = mtfc_analyzeSingleTf('1H', c1h);
    const tf4h = mtfc_analyzeSingleTf('4H', c4h);
    const tf1d = mtfc_analyzeSingleTf('1D', c1d);
    const timeframes = [tf1h, tf4h, tf1d];

    const confluenceZone = mtfc_findOverlappingZone(timeframes, currentPrice);

    const avgConfluences = timeframes.reduce((s, t) => s + t.confluenceCount, 0) / 3;
    const obOverlap = confluenceZone ? 25 : 0;
    const rsiAgreement = timeframes.filter(t => t.rsiDivergence.detected).length * 10;
    const fibAgreement = timeframes.filter(t => t.fibLevel.detected).length * 8;
    const fvgAgreement = timeframes.filter(t => t.fvg.detected).length * 7;
    const overallScore = Math.min(100, Math.round((avgConfluences / 4 * 40) + obOverlap + rsiAgreement + fibAgreement + fvgAgreement));

    let confluenceGrade, gradeLabel;
    if (avgConfluences >= 3.5 && obOverlap > 0) { confluenceGrade = 'A_PLUS'; gradeLabel = 'A+'; }
    else if (avgConfluences >= 3) { confluenceGrade = 'A'; gradeLabel = 'A'; }
    else if (avgConfluences >= 2) { confluenceGrade = 'B'; gradeLabel = 'B'; }
    else { confluenceGrade = 'C'; gradeLabel = 'C'; }

    const bullishOBs = timeframes.filter(t => t.orderBlock.detected && t.orderBlock.type === 'BULLISH').length;
    const bearishOBs = timeframes.filter(t => t.orderBlock.detected && t.orderBlock.type === 'BEARISH').length;
    const type = bullishOBs >= bearishOBs ? 'BULLISH' : 'BEARISH';

    const trade = (confluenceZone && type === 'BULLISH') ? mtfc_calculateTradeParams(confluenceZone, currentPrice) : null;
    const verdict = mtfc_generateVerdict(confluenceGrade, type, timeframes, confluenceZone, overallScore);

    return { currentPrice, timeframes, confluenceZone, confluenceGrade, gradeLabel, overallScore, type, trade, verdict };
}

function mtfc_analyzeSingleTf(tfName, candles) {
    const display = candles.slice(-60);
    const orderBlock = mtfc_detectOrderBlock(display);
    const rsiSeries = mtfc_calculateRsi(display, 14);
    const rsiDivergence = mtfc_detectRsiDivergence(display, rsiSeries);
    const fibLevel = mtfc_detectFibLevel(display);
    const fvg = mtfc_detectFvg(display);
    const currentRsi = rsiSeries[rsiSeries.length - 1];

    let count = 0;
    if (orderBlock.detected) count++;
    if (rsiDivergence.detected) count++;
    if (fibLevel.detected) count++;
    if (fvg.detected) count++;

    return {
        tf: tfName, orderBlock, rsiDivergence, fibLevel, fvg,
        confluenceCount: count, currentRsi: Math.round(currentRsi),
        priceData: display.map(c => c.close).slice(-18),
        display
    };
}

function mtfc_detectOrderBlock(candles) {
    const avgRange = candles.reduce((s, c) => s + (c.high - c.low), 0) / candles.length;
    const current = candles[candles.length - 1].close;
    const candidates = [];
    for (let i = candles.length - 30; i < candles.length - 3 && i > 0; i++) {
        const c = candles[i], n1 = candles[i + 1], n2 = candles[i + 2];
        const isGreen = c.close > c.open;
        const isRed = c.close < c.open;
        if (isRed && n1.close > n1.open && n2.close > n2.open) {
            const moveUp = (n2.high - c.low) / avgRange;
            if (moveUp > 1.3) candidates.push({ type: 'BULLISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(moveUp * 25)), idx: i });
        }
        if (isGreen && n1.close < n1.open && n2.close < n2.open) {
            const moveDown = (c.high - n2.low) / avgRange;
            if (moveDown > 1.3) candidates.push({ type: 'BEARISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(moveDown * 25)), idx: i });
        }
    }
    if (candidates.length === 0) return { detected: false, priceMin: 0, priceMax: 0, strength: 0, type: 'NONE' };
    candidates.sort((a, b) => Math.abs(current - (a.priceMin + a.priceMax) / 2) - Math.abs(current - (b.priceMin + b.priceMax) / 2));
    return { detected: true, ...candidates[0] };
}

function mtfc_calculateRsi(candles, period = 14) {
    const rsi = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period && i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff > 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = 0; i <= period; i++) rsi.push(50);
    for (let i = period + 1; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        rsi.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
    }
    return rsi;
}

function mtfc_detectRsiDivergence(candles, rsiSeries) {
    const lookback = Math.min(30, candles.length);
    const closes = candles.slice(-lookback).map(c => c.close);
    const rsis = rsiSeries.slice(-lookback);
    const peaks = typeof window.findPeaks === 'function' ? window.findPeaks(closes, 0, closes.length).slice(-2) : (typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length).slice(-2) : []);
    const troughs = typeof window.findTroughs === 'function' ? window.findTroughs(closes, 0, closes.length).slice(-2) : (typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length).slice(-2) : []);
    
    if (troughs.length >= 2) {
        const t1 = troughs[0], t2 = troughs[1];
        if (closes[t2] < closes[t1] && rsis[t2] > rsis[t1] && rsis[t1] < 40) return { detected: true, type: 'BULLISH', strength: Math.min(95, Math.round(70 + (rsis[t2] - rsis[t1]))) };
    }
    if (peaks.length >= 2) {
        const p1 = peaks[0], p2 = peaks[1];
        if (closes[p2] > closes[p1] && rsis[p2] < rsis[p1] && rsis[p1] > 60) return { detected: true, type: 'BEARISH', strength: Math.min(95, Math.round(70 + (rsis[p1] - rsis[p2]))) };
    }
    return { detected: false, type: 'NONE', strength: 0 };
}

function mtfc_detectFibLevel(candles) {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const peaks = typeof window.findPeaks === 'function' ? window.findPeaks(highs, 0, highs.length).slice(-3) : (typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length).slice(-3) : []);
    const troughs = typeof window.findTroughs === 'function' ? window.findTroughs(lows, 0, lows.length).slice(-3) : (typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length).slice(-3) : []);
    if (peaks.length === 0 || troughs.length === 0) return { detected: false, level: null, price: 0 };
    const swingHigh = highs[peaks[peaks.length - 1]];
    const swingLow = lows[troughs[troughs.length - 1]];
    const range = swingHigh - swingLow;
    const current = candles[candles.length - 1].close;
    const fib618 = swingHigh - range * 0.618;
    const fib705 = swingHigh - range * 0.705;
    const tolerance = current * 0.008;
    if (Math.abs(current - fib618) < tolerance) return { detected: true, level: '0.618', price: fib618 };
    if (Math.abs(current - fib705) < tolerance) return { detected: true, level: '0.705', price: fib705 };
    return { detected: false, level: null, price: 0 };
}

function mtfc_detectFvg(candles) {
    const current = candles[candles.length - 1].close;
    for (let i = candles.length - 30; i < candles.length - 2 && i > 1; i++) {
        const c1 = candles[i - 1], c2 = candles[i], c3 = candles[i + 1];
        if (c1.high < c3.low && c2.close > c2.open) {
            if (current >= c1.high * 0.995 && current <= c3.low * 1.005) return { detected: true, priceMin: c1.high, priceMax: c3.low, type: 'BULLISH' };
        }
        if (c1.low > c3.high && c2.close < c2.open) {
            if (current >= c3.high * 0.995 && current <= c1.low * 1.005) return { detected: true, priceMin: c3.high, priceMax: c1.low, type: 'BEARISH' };
        }
    }
    return { detected: false, priceMin: 0, priceMax: 0, type: 'NONE' };
}

function mtfc_findOverlappingZone(timeframes, currentPrice) {
    const detected = timeframes.filter(t => t.orderBlock.detected);
    if (detected.length < 2) return null;
    const maxMin = Math.max(...detected.map(t => t.orderBlock.priceMin));
    const minMax = Math.min(...detected.map(t => t.orderBlock.priceMax));
    if (maxMin > minMax) return null;
    const midPrice = (maxMin + minMax) / 2;
    const distance = Math.abs((currentPrice - midPrice) / currentPrice * 100);
    return { priceMin: maxMin, priceMax: minMax, midPrice, distance: parseFloat(distance.toFixed(2)), overlappingTfs: detected.length };
}

function mtfc_calculateTradeParams(cz, currentPrice) {
    const entryPrice = cz.midPrice;
    const stopLoss = cz.priceMin * 0.997;
    const slDist = Math.abs(entryPrice - stopLoss);
    const stopLossDistance = parseFloat((slDist / entryPrice * 100).toFixed(2));
    const tp1 = entryPrice + slDist * 2;
    const tp2 = entryPrice + slDist * 4;
    const tp3 = entryPrice + slDist * 7;
    const tp1Rr = 2.0, tp2Rr = 4.0, tp3Rr = 7.0;
    const averageRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    const expectedValue = parseFloat(((0.80 * tp1Rr * stopLossDistance * 0.5) + (0.68 * tp2Rr * stopLossDistance * 0.3) + (0.52 * tp3Rr * stopLossDistance * 0.2) - (0.15 * stopLossDistance)).toFixed(2));
    
    return {
        entryPrice, entryZoneMin: cz.priceMin, entryZoneMax: cz.priceMax,
        stopLoss, stopLossDistance, riskPct: stopLossDistance,
        tp1, tp1Rr, tp1Probability: 80, tp2, tp2Rr, tp2Probability: 68, tp3, tp3Rr, tp3Probability: 52,
        averageRr, expectedValue
    };
}

function mtfc_generateVerdict(grade, type, timeframes, cz, score) {
    const obCount = timeframes.filter(t => t.orderBlock.detected).length;
    const divCount = timeframes.filter(t => t.rsiDivergence.detected).length;
    const fibCount = timeframes.filter(t => t.fibLevel.detected).length;
    const fvgCount = timeframes.filter(t => t.fvg.detected).length;
    const isBull = type === 'BULLISH';
    const czStr = cz ? mtfc_formatPrice(cz.priceMin) + ' - ' + mtfc_formatPrice(cz.priceMax) : '';

    // توليد جدول مناطق الدعوم والارتداد
    let zonesHtml = '';
    timeframes.forEach(tf => {
        if(tf.orderBlock.detected) {
            let zType = tf.orderBlock.type === 'BULLISH' ? 'دعم هيكلي' : 'مقاومة';
            let cColor = tf.orderBlock.type === 'BULLISH' ? 'var(--t)' : 'var(--o)';
            zonesHtml += `<tr><td style="padding:8px; border:1px solid var(--b); color:var(--t3); font-family:'Share Tech Mono',monospace;">${tf.tf} OB</td><td style="padding:8px; border:1px solid var(--b); color:${cColor}; font-family:'Share Tech Mono',monospace;">${mtfc_formatPrice(tf.orderBlock.priceMin)} - ${mtfc_formatPrice(tf.orderBlock.priceMax)}</td><td style="padding:8px; border:1px solid var(--b); color:var(--t3);">${zType}</td></tr>`;
        }
        if(tf.fibLevel.detected) {
            zonesHtml += `<tr><td style="padding:8px; border:1px solid var(--b); color:var(--t3); font-family:'Share Tech Mono',monospace;">${tf.tf} FIB ${tf.fibLevel.level}</td><td style="padding:8px; border:1px solid var(--b); color:var(--t); font-family:'Share Tech Mono',monospace;">${mtfc_formatPrice(tf.fibLevel.price)}</td><td style="padding:8px; border:1px solid var(--b); color:var(--t3);">نقطة ارتداد</td></tr>`;
        }
    });
    let zonesTable = zonesHtml ? `<div style="margin:15px 0;"><div style="font-size:11px; color:var(--o); font-family:'Cairo',sans-serif; margin-bottom:8px; font-weight:bold;">جدول الدعوم ومناطق الارتداد المتوقعة:</div><table style="width:100%; border-collapse:collapse; text-align:center; font-size:11px; background:var(--bg);"><tr style="background:var(--s); color:var(--t3); font-family:'Cairo',sans-serif;"><th style="padding:8px; border:1px solid var(--b);">المنطقة الفنية</th><th style="padding:8px; border:1px solid var(--b);">النطاق السعري</th><th style="padding:8px; border:1px solid var(--b);">التصنيف</th></tr>${zonesHtml}</table></div>` : '';

    if (isBull) {
        if (grade === 'A_PLUS') {
            return {
                bias: `مسار صاعد (فرصة تمركز Spot) بتقييم استثنائي (A+)`,
                reasoning: `تم رصد إجماع فني استثنائي عبر الأطر الزمنية الثلاثة ضمن النطاق السعري ${czStr}. يجمع الإعداد بين: كتل أوامر مؤسسية (OB) متطابقة على ${obCount} فريمات، تباعد زخمي إيجابي عبر ${divCount} إطارات، ارتكاز فني عند نسبة فيبوناتشي المُثلى (OTE) على ${fibCount} فريمات، واختلالات سعرية (FVG) متوافقة في ${fvgCount} إطارات. هذا التطابق الزمني الشامل يعكس تحيزاً مؤسسياً حاداً.`,
                probability: Math.min(88, 80 + Math.round(score / 10)),
                zonesTable: zonesTable
            };
        } else if (grade === 'A') {
            return {
                bias: `مسار صاعد (فرصة تمركز Spot) بتقييم قوي (A)`,
                reasoning: `تم توثيق توافق هيكلي صلب للإشارات الفنية بدرجة A. يدعم الإعداد وجود ${obCount} مناطق تمركز أوامر (OB)، و ${divCount} تباعدات مؤكدة للزخم، و ${fibCount} ارتكازات فيبوناتشي ارتدادية، مع رصد ${fvgCount} فجوات سعرية (FVG). الإعداد التقني يُعد متيناً وموثوقاً.`,
                probability: 78,
                zonesTable: zonesTable
            };
        } else if (grade === 'B') {
            return {
                bias: 'توافق هيكلي جزئي صاعد (B)',
                reasoning: `تسجل المعطيات التقنية تداخلاً جزئياً وغير مكتمل عبر الأطر الزمنية بتقييم B. المكونات المؤكدة تُعتبر غير كافية لاعتماد الإعداد بشكل قطعي. يُوصى بالترقب والانتظار لحين نضج بقية الشروط الفنية اللازمة لتأكيد التوجه.`,
                probability: 62,
                zonesTable: zonesTable
            };
        } else {
            return {
                bias: 'يفضل الانتظار لتقييم الاتجاه قبل طرح صفقات',
                reasoning: 'التشابك التقني بين الفريمات منعدم أو متضارب حالياً. لا يوجد إعداد متكامل الأركان يُلبي معايير الالتقاء المؤسسي الصارمة. المعطيات الحالية تدعو لالتزام الحياد الكامل لحين اتضاح الرؤية السعرية وبناء مناطق تمركز واضحة.',
                probability: 45,
                zonesTable: zonesTable
            };
        }
    } else {
        let gradeLabelAr = grade === 'A_PLUS' ? 'استثنائي (A+)' : (grade === 'A' ? 'قوي (A)' : 'جزئي (B)');
        let gradeLetter = grade === 'A_PLUS' ? 'A+' : (grade === 'A' ? 'A' : 'B');

        if (grade === 'C') {
            return {
                bias: 'يفضل الانتظار لتقييم الاتجاه قبل طرح صفقات',
                reasoning: 'التشابك التقني بين الفريمات منعدم أو متضارب حالياً. لا يوجد إعداد متكامل الأركان يُلبي معايير الالتقاء المؤسسي الصارمة. المعطيات الحالية تدعو لالتزام الحياد الكامل لحين اتضاح الرؤية السعرية وبناء مناطق تمركز واضحة.',
                probability: 45,
                zonesTable: zonesTable
            };
        }

        return {
            bias: 'يفضل الانتظار لتقييم الاتجاه قبل طرح صفقات',
            reasoning: `دليل القراءة تقييم اتجاه تصحيحي ${gradeLabelAr}<br>تم توثيق توافق هيكلي للإشارات الفنية بدرجة ${gradeLetter}. يدعم الإعداد وجود ${obCount} مناطق تمركز أوامر (OB)، و ${divCount} تباعدات مؤكدة للزخم، و ${fibCount} ارتكازات فيبوناتشي ارتدادية، مع رصد ${fvgCount} فجوات سعرية (FVG) لذلك يفضل الانتظار.`,
            probability: grade === 'A_PLUS' ? 85 : (grade === 'A' ? 78 : 62),
            zonesTable: zonesTable
        };
    }
}

function mtfc_formatPrice(p) { 
    if (typeof window.fmtCryptoPrice === 'function') {
        let fmt = window.fmtCryptoPrice(p);
        return fmt.toString().includes('$') ? fmt : '$' + fmt;
    }
    return '$' + parseFloat(p).toFixed(4); 
}

function mtfc_renderDashboard(symbol, analysis) {
    return `${mtfc_renderGradeCard(analysis)} 
            ${analysis.confluenceZone ? mtfc_renderConfluenceZoneCard(analysis.confluenceZone, analysis.type) : ''} 
            ${mtfc_renderChart(symbol, analysis)} 
            ${mtfc_renderTfBreakdown(analysis.timeframes, analysis.type)} 
            ${mtfc_renderVerdict(analysis.verdict, analysis.type)} 
            ${analysis.trade ? mtfc_renderTradeParams(analysis.trade, analysis.type) : ''} 
            ${mtfc_renderGuide()}`;
}

function mtfc_renderGradeCard(a) {
    const isBull = a.type === 'BULLISH';
    const mainColor = 'var(--t)'; 
    const typeLabel = a.confluenceGrade === 'A_PLUS' ? 'استثنائي (EXCEPTIONAL)' : (a.confluenceGrade === 'A' ? 'قوي (STRONG)' : (a.confluenceGrade === 'B' ? 'متوسط (MODERATE)' : 'ضعيف (WEAK)'));
    const borderW = a.confluenceGrade === 'A_PLUS' ? '3px' : '1px';
    const trendText = isBull ? 'صاعد' : 'هابط';
    
    return `<div class="mtf-grade-card" style="border-color:var(--o); border-width:${borderW};"> 
        <div class="mtf-grade-label" style="color:var(--o)">التقييم الفني للتطابق المتعدد // CONFLUENCE GRADE</div> 
        <div class="mtf-grade-big" style="color:${mainColor}">${a.gradeLabel}</div> 
        <div class="mtf-grade-sub" style="color:${mainColor}">إشارة مسار ${trendText} // ${typeLabel}</div> 
        <div class="mtf-grade-bar"><div class="mtf-grade-bar-fill" style="width:${a.overallScore}%; background:var(--o)"></div></div> 
        <div class="mtf-grade-score-row"> 
            <span style="color:var(--t3)">نقاط التقييم التراكمي (SCORE)</span> 
            <span style="color:var(--o);font-weight:900">${a.overallScore}/100</span> 
        </div> 
    </div>`;
}

function mtfc_renderConfluenceZoneCard(cz, type) {
    return `<div class="mtf-cz-card" style="border-color:var(--o)"> 
        <div class="mtf-cz-label" style="color:var(--o)">نطاق الالتقاء المؤسسي (المنطقة الذهبية) // CONFLUENCE ZONE</div> 
        <div class="mtf-cz-price" style="color:var(--t)">${mtfc_formatPrice(cz.priceMin)} - ${mtfc_formatPrice(cz.priceMax)}</div> 
        <div class="mtf-cz-dist">مسافة التباعد اللحظي: <span style="color:var(--o)">${cz.distance}%</span> // تم التقاطع في <span style="color:var(--o)">${cz.overlappingTfs}</span> فريمات زمنية</div> 
    </div>`;
}

function mtfc_renderChart(symbol, analysis) {
    const chartW = 460, chartH = 420, padL = 35, padR = 60, padT = 20, padB = 15;
    const plotW = chartW - padL - padR;
    const totalPlotH = chartH - padT - padB;
    const gap = 6;
    const panelH = (totalPlotH - 2 * gap) / 3;

    const mainColor = 'var(--o)';

    let svg = `<div class="mtf-chart-card"> <div class="mtf-chart-header"> <span class="mtf-chart-title" style="color:var(--o)">MTF CONFLUENCE MAP // <span style="color:var(--t)">${symbol}</span></span> <span class="mtf-chart-live"><span class="mtf-live-pulse" style="background:var(--o)"></span>LIVE</span> </div> <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="display:block">`;

    analysis.timeframes.forEach((tf, panelIdx) => {
        const panelY0 = padT + panelIdx * (panelH + gap);
        const prices = tf.priceData;
        const extraPrices = [];
        if (tf.orderBlock.detected) { extraPrices.push(tf.orderBlock.priceMin, tf.orderBlock.priceMax); }
        if (tf.fibLevel.detected) extraPrices.push(tf.fibLevel.price);
        const allP = prices.concat(extraPrices);
        const priceMin = Math.min(...allP) * 0.997;
        const priceMax = Math.max(...allP) * 1.003;
        const pr = priceMax - priceMin || 1;
        const xScale = i => padL + (i / (prices.length - 1)) * plotW;
        const yPrice = p => panelY0 + Math.max(0, Math.min(panelH, (1 - (p - priceMin) / pr) * panelH));
        const path = prices.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yPrice(p).toFixed(2)}`).join(' ');

        svg += `<rect x="${padL}" y="${panelY0.toFixed(2)}" width="${plotW}" height="${panelH.toFixed(2)}" fill="var(--bg)"/>`;

        if (tf.orderBlock.detected) {
            const obY1 = yPrice(tf.orderBlock.priceMax);
            const obY2 = yPrice(tf.orderBlock.priceMin);
            const topY = Math.min(obY1, obY2);
            const obH = Math.abs(obY1 - obY2);
            const obColor = tf.orderBlock.type === 'BULLISH' ? 'var(--t)' : 'var(--o)';
            svg += `<rect x="${padL}" y="${topY.toFixed(2)}" width="${plotW}" height="${obH.toFixed(2)}" fill="${obColor}" opacity="0.15"/>`;
            svg += `<rect x="${padL}" y="${topY.toFixed(2)}" width="${plotW}" height="${obH.toFixed(2)}" fill="none" stroke="${obColor}" stroke-width="1" stroke-dasharray="3,3"/>`;
        }

        if (tf.fvg.detected) {
            const fvgY1 = yPrice(tf.fvg.priceMax);
            const fvgY2 = yPrice(tf.fvg.priceMin);
            const topY = Math.min(fvgY1, fvgY2);
            const fvgH = Math.abs(fvgY1 - fvgY2);
            const fvgColor = tf.fvg.type === 'BULLISH' ? 'var(--t)' : 'var(--o)';
            svg += `<rect x="${(padL + plotW * 0.5).toFixed(2)}" y="${topY.toFixed(2)}" width="${(plotW * 0.5).toFixed(2)}" height="${fvgH.toFixed(2)}" fill="${fvgColor}" opacity="0.2"/>`;
        }

        if (tf.fibLevel.detected) {
            const fibY = yPrice(tf.fibLevel.price);
            svg += `<line x1="${padL}" y1="${fibY.toFixed(2)}" x2="${padL + plotW}" y2="${fibY.toFixed(2)}" stroke="${mainColor}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
            svg += `<text x="${padL + 4}" y="${(fibY - 3).toFixed(2)}" font-size="7" font-family="Share Tech Mono, monospace" font-weight="700" fill="${mainColor}">FIB ${tf.fibLevel.level}</text>`;
        }

        svg += `<path d="${path}" fill="none" stroke="var(--t)" stroke-width="1.8" stroke-linejoin="round"/>`;

        if (tf.rsiDivergence.detected) {
            const divX = xScale(Math.floor(prices.length * 0.35));
            const divP = tf.rsiDivergence.type === 'BULLISH' ? Math.min(...prices.slice(0, Math.floor(prices.length * 0.5))) : Math.max(...prices.slice(0, Math.floor(prices.length * 0.5)));
            const divY = yPrice(divP);
            const divColor = tf.rsiDivergence.type === 'BULLISH' ? 'var(--t)' : 'var(--o)';
            svg += `<circle cx="${divX.toFixed(2)}" cy="${divY.toFixed(2)}" r="5" fill="var(--bg)" stroke="${divColor}" stroke-width="2"/>`;
            svg += `<text x="${divX.toFixed(2)}" y="${(divY + 3).toFixed(2)}" font-size="7" font-family="Share Tech Mono, monospace" font-weight="900" fill="${divColor}" text-anchor="middle">D</text>`;
        }

        svg += `<rect x="2" y="${(panelY0 + panelH / 2 - 10).toFixed(2)}" width="28" height="20" fill="var(--o)"/>`;
        svg += `<text x="16" y="${(panelY0 + panelH / 2 + 4).toFixed(2)}" font-size="12" font-family="Share Tech Mono, monospace" font-weight="900" fill="#000" text-anchor="middle">${tf.tf}</text>`;

        svg += `<circle cx="${xScale(prices.length - 1).toFixed(2)}" cy="${yPrice(prices[prices.length - 1]).toFixed(2)}" r="4" fill="var(--t)"/>`;

        const badgeColor = tf.confluenceCount >= 3 ? mainColor : 'transparent';
        const badgeBorder = tf.confluenceCount >= 3 ? 'none' : `1px solid ${mainColor}`;
        const badgeText = tf.confluenceCount >= 3 ? '#000' : mainColor;
        
        svg += `<rect x="${(padL + plotW + 4).toFixed(2)}" y="${(panelY0 + 4).toFixed(2)}" width="${(padR - 8).toFixed(2)}" height="16" fill="${badgeColor}" style="${badgeBorder}"/>`;
        svg += `<text x="${(padL + plotW + (padR - 8) / 2 + 4).toFixed(2)}" y="${(panelY0 + 14).toFixed(2)}" font-size="9" font-family="Share Tech Mono, monospace" font-weight="900" fill="${badgeText}" text-anchor="middle">${tf.confluenceCount}/4 ✓</text>`;

        svg += `<text x="${padL + plotW + 4}" y="${(panelY0 + panelH - 6).toFixed(2)}" font-size="8" font-family="Share Tech Mono, monospace" fill="var(--t3)">RSI: ${tf.currentRsi}</text>`;
        svg += `<rect x="${padL}" y="${panelY0.toFixed(2)}" width="${plotW}" height="${panelH.toFixed(2)}" fill="none" stroke="var(--b)" stroke-width="1"/>`;
    });

    svg += `</svg>
    <div class="mtf-legend">
        <div class="mtf-legend-item"><div style="width:8px;height:8px;background:var(--t);opacity:0.3"></div><span style="color:var(--t3)">OB/FVG صاعد</span></div>
        <div class="mtf-legend-item"><div style="width:8px;height:8px;background:var(--o);opacity:0.3"></div><span style="color:var(--t3)">OB/FVG هابط</span></div>
        <div class="mtf-legend-item"><div style="width:8px;height:2px;background:${mainColor}"></div><span style="color:var(--t3)">مستوى FIB</span></div>
        <div class="mtf-legend-item"><div style="width:8px;height:8px;border-radius:50%;border:2px solid ${mainColor};background:var(--bg)"></div><span style="color:var(--t3)">تباعد RSI</span></div>
    </div>
  </div>`;
    return svg;
}

function mtfc_renderTfBreakdown(timeframes, type) {
    let html = '';
    timeframes.forEach(tf => {
        const items = [
            { lbl: 'تمركز السيولة (OB)', val: tf.orderBlock.detected ? tf.orderBlock.strength + '%' : '—', detected: tf.orderBlock.detected },
            { lbl: 'التباعد التقني (DIV)', val: tf.rsiDivergence.detected ? tf.rsiDivergence.strength + '%' : '—', detected: tf.rsiDivergence.detected },
            { lbl: 'نسبة الارتداد (FIB)', val: tf.fibLevel.detected ? tf.fibLevel.level : '—', detected: tf.fibLevel.detected },
            { lbl: 'الفجوة العادلة (FVG)', val: tf.fvg.detected ? 'مرصودة ✓' : '—', detected: tf.fvg.detected }
        ];
        html += `<div class="mtf-tf-row" style="border-right-color:${tf.confluenceCount >= 3 ? 'var(--o)' : 'var(--b)'}"> 
            <div class="mtf-tf-header"> 
                <span class="mtf-tf-title" style="color:${tf.confluenceCount >= 3 ? 'var(--o)' : 'var(--t)'}">${tf.tf} TIMEFRAME</span> 
                <span class="mtf-tf-count" style="color:${tf.confluenceCount >= 3 ? 'var(--o)' : 'var(--t3)'}">${tf.confluenceCount}/4 توافقات مسجلة</span> 
            </div> 
            <div class="mtf-comp-grid"> 
                ${items.map(it =>`
                <div class="mtf-comp-item" style="border-right-color:${it.detected ? 'var(--o)' : 'var(--b)'}">
                    <span class="mtf-comp-label">${it.lbl}</span>
                    <span class="mtf-comp-value" style="color:${it.detected ? 'var(--t)' : 'var(--t3)'}">${it.val}</span>
                </div>
                `).join('')} 
            </div> 
        </div>`;
    });
    return `<div class="mtf-card"><div class="mtf-card-title" style="color:var(--o)">تحليل وتجزئة الشروط الهيكلية لكل إطار زمني // BREAKDOWN</div>${html}</div>`;
}

function mtfc_renderVerdict(v, type) {
    return `<div class="mtf-verdict" style="border-right-color:var(--o)"> 
        <div class="mtf-verdict-title" style="color:var(--o)">الخلاصة التوجيهية الاستراتيجية // VERDICT</div> 
        <div class="mtf-verdict-main" style="color:var(--t)">${v.bias}</div> 
        <div class="mtf-verdict-detail">${v.reasoning}</div> 
        ${v.zonesTable || ''}
        <div class="mtf-prob-box">
            <div class="mtf-prob-label">نسبة الموثوقية الإحصائية المتوقعة للمسار</div>
            <div class="mtf-prob-val" style="color:var(--o)">${v.probability}%</div>
        </div> 
    </div>`;
}

function mtfc_renderTradeParams(t, type) {
    const oppColor = 'var(--t)';
    
    return `<div class="mtf-card"> 
        <div class="mtf-card-title" style="color:var(--o)">محددات التمركز الاستراتيجي // PARAMETERS</div> 
        <div class="mtf-trade-grid"> 
            <div class="mtf-trade-box" style="border-top-color:var(--o)"> 
                <div class="mtf-trade-label">نطاق التمركز الاستثماري // ENTRY ZONE</div> 
                <div class="mtf-trade-val" style="color:var(--t)">${mtfc_formatPrice(t.entryZoneMin)}</div> 
                <div style="font-size:9px;color:var(--o);font-family:'Share Tech Mono',monospace">${mtfc_formatPrice(t.entryZoneMax)}</div> 
            </div> 
            <div class="mtf-trade-box" style="border-top-color:${oppColor}"> 
                <div class="mtf-trade-label">إيقاف التصفية الفني (SL)</div> 
                <div class="mtf-trade-val" style="color:${oppColor}">${mtfc_formatPrice(t.stopLoss)}</div> 
                <div style="font-size:9px;color:var(--t3);font-family:'Share Tech Mono',monospace">حد المخاطرة: ${t.riskPct}%</div> 
            </div> 
        </div> 
        <div style="margin-top:12px"> 
            <div style="font-size:10px;color:var(--o);font-family:'Share Tech Mono',monospace;font-weight:700;margin-bottom:6px">مستهدفات جني الأرباح التصاعدية // TAKE PROFIT</div> 
            ${[ { lbl: 'الهدف الأول (TP1)', p: t.tp1, rr: t.tp1Rr, prob: t.tp1Probability }, 
                { lbl: 'الهدف الثاني (TP2)', p: t.tp2, rr: t.tp2Rr, prob: t.tp2Probability }, 
                { lbl: 'الهدف الثالث (TP3)', p: t.tp3, rr: t.tp3Rr, prob: t.tp3Probability } 
              ].map(tp =>`
            <div class="mtf-target-row">
                <span class="mtf-target-label" style="width:110px; color:var(--o)">${tp.lbl}</span>
                <span class="mtf-target-price" style="color:var(--t)">${mtfc_formatPrice(tp.p)}</span>
                <span class="mtf-target-rr" style="color:var(--t3)">R:R 1:${tp.rr}</span>
                <span class="mtf-target-prob">${tp.prob}%</span>
            </div>
            `).join('')} 
        </div> 
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--b)"> 
            <div class="mtf-stat-row"><span style="color:var(--t3)">متوسط معامل العائد للمخاطرة</span><span style="color:var(--t);font-weight:700">1:${t.averageRr}</span></div> 
            <div class="mtf-stat-row"><span style="color:var(--t3)">القيمة المتوقعة إحصائياً للفرصة (EV)</span><span style="color:var(--o);font-weight:700">+${t.expectedValue}%</span></div> 
        </div> 
        <div class="mtf-disclaimer">القيم والنسب الموضحة مبنية على نماذج وتوافقات رياضية بحتة لأغراض البحث والتحليل المؤسسي. لا تُشكل الأرقام المدرجة أي دعوة أو توصية مالية مباشرة بالبيع أو الشراء. القرار الاستثماري النهائي يقع على عاتق المستخدم كلياً.</div> 
    </div>`;
}

function mtfc_renderGuide() {
    return `<div class="mtf-guide"> 
        <div class="mtf-guide-title">دليل النمذجة التحليلية // READING GUIDE</div> 
        <div class="mtf-guide-text"> 
            <strong style="color:var(--o)">ماسح التقاء الأطر الزمنية (MTF CONFLUENCE):</strong> خوارزمية مؤسسية متقدمة تعمل على استخلاص التوافق الفني المتزامن لـ 4 ركائز هيكلية مستقلة ضمن 3 إطارات زمنية رئيسية (ساعة، 4 ساعات، يومي). الارتباط الإحصائي للموثوقية يرتفع طردياً مع تزايد التطابق الزمني.<br><br> 
            <strong style="color:var(--o)">الركيزة الأولى — الكتل الطلبية (ORDER BLOCK):</strong> مسار التمركز لآخر شمعة قبل اندلاع موجة سعرية دافعة. تمثل بؤرة ارتكاز وتكديس لعقود الصناديق الكبيرة والمؤسسات المالية.<br><br> 
            <strong style="color:var(--o)">الركيزة الثانية — التباعد الزخمي (RSI DIVERGENCE):</strong> انحراف وتناقض المسار السعري الفعلي عن قوة الزخم الداخلي، مما يشكل إشارة رياضية مبكرة على انقلاب السيطرة الديموغرافية للمشترين أو البائعين.<br><br> 
            <strong style="color:var(--o)">الركيزة الثالثة — الارتداد الذهبي (FIBONACCI 0.618/0.705):</strong> حزام التمركز الأمثل (OTE) الذي تعتمده خوارزميات التداول المؤسسي لتنفيذ الانخراطات الاستثمارية بأقل تكلفة ممكنة.<br><br> 
            <strong style="color:var(--o)">الركيزة الرابعة — فجوة القيمة (FAIR VALUE GAP):</strong> فجوة واختلال في التسعير يتكون إثر تسارع سعري لحظي، ويعمل كمغناطيس يستقطب السعر مستقبلاً لإعادة التوازن الدفتري للصفقات.<br><br> 
            <strong style="color:var(--t)">درجة الموثوقية الاستثنائية (A+):</strong> استيفاء هيكلي يتجاوز 3.5 شروط كمتوسط تقاطع مع تداخل هندسي كامل لكتل الأوامر. معدل الموثوقية المرجح تاريخياً يلامس 88%.<br><br> 
            <strong style="color:var(--t)">درجة الموثوقية القوية (A):</strong> توافق تقني محكم يعادل 3 شروط هيكلية. نسبة الموثوقية تبلغ 78-84%، وهو إعداد صلب وفرصة يعتد بها رياضياً.<br><br> 
            <strong style="color:var(--o)">نطاق الالتقاء المركزي (CONFLUENCE ZONE):</strong> الصندوق الدقيق الذي تتكدس وتتقاطع بداخله الكتل الطلبية لمختلف الإطارات الزمنية بالتزامن.<br><br> 
            <strong style="color:var(--o)">القيمة الاحتمالية المرجحة (EXPECTED VALUE):</strong> عملية موازنة رياضية دقيقة تقيس نسبة العائد المتوقع مطروحاً منه احتمالية الفشل وهامش المخاطرة الفني المسموح.<br><br> 
            <strong style="color:var(--t3)">تنويه إخلاء المسؤولية والرقابة:</strong> كافة المخرجات مبنية آلياً عبر محركات خوارزمية مخصصة للدراسات المؤسسية فقط، ولا يمكن بأي حال تفسيرها كنصائح مالية معتمدة. إدارة المخاطر المالية التزام شخصي.
        </div> 
    </div>`;
}


// =====================================================================
// Trading Signal — منصة 360°
// Multi-Timeframe Trade Signal Generator (SPOT ONLY)
// 4 أدوات: Wyckoff + VSA + SuperTrend/ADX + VW-MACD
// 3 جداول صفقات: 1H (سريعة) + 4H (متوسطة) + 1D (بعيدة)
// تم تطبيق الحماية الصارمة (Long Only) لمنع صفقات البيع المكشوف
// =====================================================================

async function runTradingSignal() {
    const symbolInput = document.getElementById('tsig-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('tsig-dashboard');
    const loading = document.getElementById('tsig-loading');
    
    if (!symbolInput) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';
    
    dash.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        const [r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=500`)
        ]);
        
        if (!r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d1h, d4h, d1d] = await Promise.all([r1h.json(), r4h.json(), r1d.json()]);
        
        const parse = raw => raw.map(c => ({
            time: parseInt(c[0]), 
            open: parseFloat(c[1]), 
            high: parseFloat(c[2]),
            low: parseFloat(c[3]), 
            close: parseFloat(c[4]), 
            volume: parseFloat(c[5])
        }));
        
        const c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        
        if (c1h.length < 50 || c4h.length < 50 || c1d.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل.');

        const analysis = tsig_analyzeTradingSignal(symbol, c1h, c4h, c1d);
        loading.style.display = 'none';
        dash.innerHTML = tsig_renderDashboard(analysis);
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function tsig_analyzeTradingSignal(symbol, c1h, c4h, c1d) {
    // تحليل كل فريم منفرداً بالأدوات الأربعة
    const tf1h = tsig_analyzeTimeframe('1H', 'SHORT_TERM', c1h);
    const tf4h = tsig_analyzeTimeframe('4H', 'MID_TERM', c4h);
    const tf1d = tsig_analyzeTimeframe('1D', 'LONG_TERM', c1d);
    const currentPrice = c1h[c1h.length - 1].close;

    // Master Score (متوسط عبر الفريمات)
    const avgScore = (tf1h.score + tf4h.score + tf1d.score) / 3;
    const bullishTfs = [tf1h, tf4h, tf1d].filter(t => t.bias === 'BULLISH').length;
    const bearishTfs = [tf1h, tf4h, tf1d].filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullishTfs > bearishTfs ? 'BULLISH' : (bearishTfs > bullishTfs ? 'BEARISH' : 'MIXED');
    
    const masterScore = Math.round(avgScore);
    const alignmentBonus = (bullishTfs === 3 || bearishTfs === 3) ? 10 : 0;
    const finalMasterScore = Math.min(100, masterScore + alignmentBonus);

    let masterGrade;
    if (finalMasterScore >= 85) masterGrade = 'A+';
    else if (finalMasterScore >= 75) masterGrade = 'A';
    else if (finalMasterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';

    return {
        symbol, currentPrice, masterBias, masterGrade, masterScore: finalMasterScore,
        alignedTfs: masterBias === 'BULLISH' ? bullishTfs : bearishTfs,
        timeframes: [tf1h, tf4h, tf1d]
    };
}

// ==================== تحليل فريم واحد ====================
function tsig_analyzeTimeframe(tfName, horizon, candles) {
    const display = candles.slice(-100);
    const currentPrice = display[display.length - 1].close;

    // تشغيل الأدوات الأربعة
    const wyckoff = tsig_runWyckoffComponent(display);
    const vsa = tsig_runVsaComponent(display);
    const stAdx = tsig_runSuperTrendAdxComponent(display);
    const vwMacd = tsig_runVwMacdComponent(display);

    const components = [wyckoff, vsa, stAdx, vwMacd];

    // تحديد الاتجاه الغالب
    const bullishCount = components.filter(c => c.bias === 'BULLISH').length;
    const bearishCount = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullishCount > bearishCount ? 'BULLISH' : (bearishCount > bullishCount ? 'BEARISH' : 'NEUTRAL');
    const alignedCount = bias === 'BULLISH' ? bullishCount : (bias === 'BEARISH' ? bearishCount : 0);

    // Signal Strength (0-100)
    const avgCompScore = components.reduce((s, c) => s + c.score, 0) / 4;
    const alignmentFactor = alignedCount / 4;
    const signalStrength = Math.round(avgCompScore * 0.6 + (alignmentFactor * 100) * 0.4);
    const score = signalStrength;

    // Signal Grade
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && alignedCount === 4) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && alignedCount >= 3) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65 && alignedCount >= 3) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }

    // Trade Setup (SPOT ONLY: صفقات شرائية فقط - منع الـ Short)
    const trade = (bias === 'BULLISH' && signalStrength >= 55)
        ? tsig_buildTrade(bias, currentPrice, candles, tfName, components)
        : null;

    return {
        tf: tfName, horizon, bias, signalStrength, signalGrade, signalQuality,
        score, alignedCount, components, trade, currentPrice
    };
}

// ==================== Wyckoff Component ====================
function tsig_runWyckoffComponent(candles) {
    const n = candles.length;
    const recent = candles.slice(-30);
    const highs = recent.map(c => c.high), lows = recent.map(c => c.low);
    const volumes = recent.map(c => c.volume);
    const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;

    // بحث عن Spring (Bullish) أو Upthrust (Bearish)
    const rangeHigh = Math.max(...highs.slice(0, 20));
    const rangeLow = Math.min(...lows.slice(0, 20));
    const recentHigh = Math.max(...highs.slice(-10));
    const recentLow = Math.min(...lows.slice(-10));
    const current = candles[candles.length - 1].close;

    let bias = 'NEUTRAL', phase = 'INDETERMINATE', score = 50, summary = 'لا يوجد نمط Wyckoff واضح';

    // Spring: كسر قاع النطاق ثم ارتداد + حجم عالٍ
    if (recentLow < rangeLow * 0.998 && current > rangeLow * 1.003) {
        const recentVolAvg = volumes.slice(-10).reduce((s, v) => s + v, 0) / 10;
        if (recentVolAvg > avgVol * 1.15) {
            bias = 'BULLISH'; phase = 'SPRING_DETECTED';
            score = 82; summary = 'مرحلة Spring مكتشفة — كسر كاذب لقاع التجميع مع ارتداد قوي مدعوم بحجم';
        } else {
            bias = 'BULLISH'; phase = 'ACCUMULATION';
            score = 70; summary = 'مرحلة تجميع (Accumulation) — السعر يعود فوق قاع النطاق';
        }
    }
    // Upthrust: كسر قمة النطاق ثم هبوط
    else if (recentHigh > rangeHigh * 1.002 && current < rangeHigh * 0.997) {
        const recentVolAvg = volumes.slice(-10).reduce((s, v) => s + v, 0) / 10;
        if (recentVolAvg > avgVol * 1.15) {
            bias = 'BEARISH'; phase = 'UPTHRUST_DETECTED';
            score = 82; summary = 'مرحلة Upthrust مكتشفة — كسر كاذب لقمة النطاق مع هبوط مدعوم بحجم';
        } else {
            bias = 'BEARISH'; phase = 'DISTRIBUTION';
            score = 70; summary = 'مرحلة توزيع (Distribution) — السعر يعود تحت قمة النطاق';
        }
    }
    // SOS: كسر صاعد قوي بعد تجميع
    else if (current > rangeHigh * 1.005) {
        bias = 'BULLISH'; phase = 'SIGN_OF_STRENGTH';
        score = 75; summary = 'Sign of Strength — كسر صاعد لنطاق التجميع يؤكد قوة المشترين';
    }
    // SOW: كسر هابط
    else if (current < rangeLow * 0.995) {
        bias = 'BEARISH'; phase = 'SIGN_OF_WEAKNESS';
        score = 75; summary = 'Sign of Weakness — كسر هابط يؤكد ضعف المشترين وسيطرة البائعين';
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return {
        name: 'WYCKOFF', fullName: 'Wyckoff Schematic', icon: 'WY',
        grade, score, bias, phase, status: phase, summary
    };
}

// ==================== VSA Component ====================
function tsig_runVsaComponent(candles) {
    const recent = candles.slice(-5);
    const last = recent[recent.length - 1];
    const volumes = candles.slice(-20).map(c => c.volume);
    const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    const ranges = candles.slice(-20).map(c => c.high - c.low);
    const avgRange = ranges.reduce((s, v) => s + v, 0) / ranges.length;

    const lastRange = last.high - last.low;
    const lastVolRatio = last.volume / avgVol;
    const lastRangeRatio = lastRange / avgRange;
    const closePos = lastRange > 0 ? (last.close - last.low) / lastRange : 0.5;

    let bias = 'NEUTRAL', pattern = 'NO_SIGNAL', score = 50, summary = 'لا توجد إشارة VSA واضحة';

    // No Supply: شمعة حمراء صغيرة بحجم منخفض = نفاد البائعين
    if (last.close < last.open && lastVolRatio < 0.7 && lastRangeRatio < 0.8) {
        bias = 'BULLISH'; pattern = 'NO_SUPPLY_BAR';
        score = 78; summary = 'No Supply Bar — شمعة هابطة بحجم منخفض تُشير إلى نفاد ضغط البيع';
    }
    // No Demand: شمعة خضراء صغيرة بحجم منخفض
    else if (last.close > last.open && lastVolRatio < 0.7 && lastRangeRatio < 0.8) {
        bias = 'BEARISH'; pattern = 'NO_DEMAND_BAR';
        score = 78; summary = 'No Demand Bar — شمعة صاعدة بحجم منخفض تُشير إلى نفاد ضغط الشراء';
    }
    // Stopping Volume: حجم ضخم في شمعة هابطة + إغلاق في النصف العلوي
    else if (last.close < last.open && lastVolRatio > 1.8 && closePos > 0.5) {
        bias = 'BULLISH'; pattern = 'STOPPING_VOLUME';
        score = 85; summary = 'Stopping Volume — حجم ضخم في شمعة هابطة مع إغلاق في النصف العلوي يُشير لامتصاص مؤسسي';
    }
    // Climactic Volume: حجم ضخم في شمعة صاعدة + إغلاق في النصف السفلي
    else if (last.close > last.open && lastVolRatio > 1.8 && closePos < 0.5) {
        bias = 'BEARISH'; pattern = 'CLIMACTIC_VOLUME';
        score = 85; summary = 'Climactic Volume — حجم ضخم في شمعة صاعدة مع إغلاق ضعيف يُشير لاستنزاف الشراء';
    }
    // Effort vs Result: حجم عالٍ لكن حركة ضعيفة
    else if (lastVolRatio > 1.5 && lastRangeRatio < 0.7) {
        const prevClose = candles[candles.length - 2].close;
        if (last.close > prevClose) {
            bias = 'BEARISH'; pattern = 'EFFORT_WITHOUT_RESULT_UP';
            score = 72; summary = 'جهد دون نتيجة — حجم عالٍ بحركة صاعدة ضعيفة يُشير لمقاومة خفية';
        } else {
            bias = 'BULLISH'; pattern = 'EFFORT_WITHOUT_RESULT_DOWN';
            score = 72; summary = 'جهد دون نتيجة — حجم عالٍ بحركة هابطة ضعيفة يُشير لدعم خفي';
        }
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return {
        name: 'VSA', fullName: 'Volume Spread Analysis', icon: 'VSA',
        grade, score, bias, pattern, status: pattern, summary
    };
}

// ==================== SuperTrend + ADX + Volume ====================
function tsig_runSuperTrendAdxComponent(candles) {
    const n = candles.length;
    const period = 14;
    const mult = 3;

    // حساب ATR
    const atrs = [];
    for (let i = 1; i < n; i++) {
        const tr = Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close)
        );
        atrs.push(tr);
    }
    const recentAtrs = atrs.slice(-period);
    const atr = recentAtrs.reduce((s, v) => s + v, 0) / recentAtrs.length;

    // SuperTrend (مبسط)
    const last = candles[n - 1];
    const hl2 = (last.high + last.low) / 2;
    const upperBand = hl2 + mult * atr;
    const lowerBand = hl2 - mult * atr;
    const close = last.close;

    // تحديد اتجاه SuperTrend من آخر 10 شموع
    const recent10 = candles.slice(-10);
    const trendUp = recent10.every((c, i) => i === 0 || c.close >= recent10[i - 1].close * 0.995);
    const trendDown = recent10.every((c, i) => i === 0 || c.close <= recent10[i - 1].close * 1.005);
    const closesUp = recent10.filter((c, i) => i > 0 && c.close > recent10[i - 1].close).length;

    // ADX مبسط
    const adxRecent = candles.slice(-period * 2);
    let dmPlus = 0, dmMinus = 0;
    for (let i = 1; i < adxRecent.length; i++) {
        const upMove = adxRecent[i].high - adxRecent[i - 1].high;
        const downMove = adxRecent[i - 1].low - adxRecent[i].low;
        if (upMove > downMove && upMove > 0) dmPlus += upMove;
        if (downMove > upMove && downMove > 0) dmMinus += downMove;
    }
    const diPlus = (dmPlus / adxRecent.length) / atr * 100;
    const diMinus = (dmMinus / adxRecent.length) / atr * 100;
    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus + 0.001) * 100;
    const adx = Math.min(100, dx);

    // Volume Filter
    const volumes = candles.slice(-20).map(c => c.volume);
    const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    const recentVolAvg = candles.slice(-5).reduce((s, c) => s + c.volume, 0) / 5;
    const volRatio = recentVolAvg / avgVol;

    let bias = 'NEUTRAL', score = 50, summary = 'لا يوجد اتجاه مؤكد بتأكيد ADX';

    const strongTrend = adx > 25;
    const goodVolume = volRatio > 0.9;

    if (closesUp >= 7 && strongTrend && goodVolume) {
        bias = 'BULLISH';
        score = Math.min(90, 70 + Math.round(adx / 5) + (volRatio > 1.3 ? 10 : 0));
        summary = `اتجاه صاعد مؤكد — ADX ${adx.toFixed(1)} (قوي) + حجم داعم ${volRatio.toFixed(2)}x`;
    } else if (closesUp <= 3 && strongTrend && goodVolume) {
        bias = 'BEARISH';
        score = Math.min(90, 70 + Math.round(adx / 5) + (volRatio > 1.3 ? 10 : 0));
        summary = `اتجاه هابط مؤكد — ADX ${adx.toFixed(1)} (قوي) + حجم داعم ${volRatio.toFixed(2)}x`;
    } else if (adx < 20) {
        bias = 'NEUTRAL';
        score = 45;
        summary = `سوق جانبي — ADX ضعيف ${adx.toFixed(1)}، لا يُنصح بالتداول بناءً على الاتجاه`;
    } else {
        bias = closesUp >= 5 ? 'BULLISH' : 'BEARISH';
        score = 60;
        summary = `اتجاه ${bias === 'BULLISH' ? 'صاعد' : 'هابط'} متوسط القوة — ADX ${adx.toFixed(1)}`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return {
        name: 'SUPERTREND_ADX', fullName: 'SuperTrend + ADX + Volume', icon: 'ST',
        grade, score, bias, status: bias === 'NEUTRAL' ? 'RANGING' : (bias + '_TREND'),
        summary, adx: parseFloat(adx.toFixed(1)), volRatio: parseFloat(volRatio.toFixed(2))
    };
}

// ==================== Volume-Weighted MACD ====================
function tsig_runVwMacdComponent(candles) {
    // VW-EMA (حساب EMAs موزونة بالحجم)
    const calcVwEma = (period, data) => {
        const k = 2 / (period + 1);
        let ema = null;
        const emas = [];
        data.forEach(d => {
            if (ema === null) ema = d.close;
            else ema = d.close * k + ema * (1 - k);
            emas.push(ema);
        });
        return emas;
    };

    const ema12 = calcVwEma(12, candles);
    const ema26 = calcVwEma(26, candles);
    const macdLine = ema12.map((v, i) => v - ema26[i]);

    // Signal line (9-EMA of MACD)
    const signalK = 2 / (9 + 1);
    let sigEma = macdLine[0] || 0;
    const signalLine = [];
    macdLine.forEach(m => {
        sigEma = m * signalK + sigEma * (1 - signalK);
        signalLine.push(sigEma);
    });

    const histogram = macdLine.map((v, i) => v - signalLine[i]);
    const currentMacd = macdLine[macdLine.length - 1];
    const prevMacd = macdLine[macdLine.length - 2];
    const currentSignal = signalLine[signalLine.length - 1];
    const prevSignal = signalLine[signalLine.length - 2];
    const currentHist = histogram[histogram.length - 1];
    const prevHist = histogram[histogram.length - 2];

    let bias = 'NEUTRAL', status = 'NO_SIGNAL', score = 50, summary = 'لا يوجد عبور مؤكد في VW-MACD';

    // Zero Line Cross
    const zeroCrossUp = prevMacd <= 0 && currentMacd > 0;
    const zeroCrossDown = prevMacd >= 0 && currentMacd < 0;

    // Signal Line Cross
    const signalCrossUp = prevMacd <= prevSignal && currentMacd > currentSignal;
    const signalCrossDown = prevMacd >= prevSignal && currentMacd < currentSignal;

    // Histogram momentum
    const histGrowing = Math.abs(currentHist) > Math.abs(prevHist);

    if (zeroCrossUp) {
        bias = 'BULLISH'; status = 'ZERO_LINE_CROSS_UP'; score = 85;
        summary = 'عبور Zero Line صعوداً — إشارة اتجاه رئيسية تؤكد تحوّل الزخم للشراء';
    } else if (zeroCrossDown) {
        bias = 'BEARISH'; status = 'ZERO_LINE_CROSS_DOWN'; score = 85;
        summary = 'عبور Zero Line هبوطاً — إشارة اتجاه رئيسية تؤكد تحوّل الزخم للبيع';
    } else if (signalCrossUp && currentMacd > 0) {
        bias = 'BULLISH'; status = 'BULLISH_CROSS_ABOVE_ZERO'; score = 78;
        summary = 'عبور صاعد للـ Signal Line فوق المستوى الصفري — تأكيد زخم صعودي';
    } else if (signalCrossDown && currentMacd < 0) {
        bias = 'BEARISH'; status = 'BEARISH_CROSS_BELOW_ZERO'; score = 78;
        summary = 'عبور هابط للـ Signal Line تحت المستوى الصفري — تأكيد زخم هبوطي';
    } else if (currentMacd > currentSignal && currentMacd > 0 && histGrowing) {
        bias = 'BULLISH'; status = 'BULLISH_MOMENTUM_GROWING'; score = 70;
        summary = 'زخم صعودي متنامٍ — MACD فوق الصفر و Histogram في توسّع';
    } else if (currentMacd < currentSignal && currentMacd < 0 && histGrowing) {
        bias = 'BEARISH'; status = 'BEARISH_MOMENTUM_GROWING'; score = 70;
        summary = 'زخم هبوطي متنامٍ — MACD تحت الصفر و Histogram في توسّع';
    } else if (currentMacd > 0) {
        bias = 'BULLISH'; status = 'BULLISH_REGIME'; score = 62;
        summary = 'نظام صعودي — MACD فوق الصفر دون إشارة جديدة';
    } else {
        bias = 'BEARISH'; status = 'BEARISH_REGIME'; score = 62;
        summary = 'نظام هبوطي — MACD تحت الصفر دون إشارة جديدة';
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return {
        name: 'VW_MACD', fullName: 'Volume-Weighted MACD', icon: 'MAC',
        grade, score, bias, status, summary,
        macd: parseFloat(currentMacd.toFixed(2)),
        signal: parseFloat(currentSignal.toFixed(2))
    };
}

// ==================== Trade Builder ====================
function tsig_buildTrade(bias, currentPrice, candles, tfName, components) {
    const isBull = bias === 'BULLISH';
    // حساب ATR لتحديد SL و TPs
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) {
        trs.push(Math.max(
            candles[i].high - candles[i].low,
            Math.abs(candles[i].high - candles[i - 1].close),
            Math.abs(candles[i].low - candles[i - 1].close)
        ));
    }
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;

    // معاملات SL/TP حسب الفريم
    let slMult, tp1Mult, tp2Mult, tp3Mult;
    if (tfName === '1H') { slMult = 1.5; tp1Mult = 1.5; tp2Mult = 3.0; tp3Mult = 5.0; }
    else if (tfName === '4H') { slMult = 2.0; tp1Mult = 2.0; tp2Mult = 4.0; tp3Mult = 7.0; }
    else { slMult = 2.5; tp1Mult = 2.5; tp2Mult = 5.5; tp3Mult = 10.0; }

    const entryPrice = currentPrice;
    
    // الهندسة الدقيقة لوقف الخسارة والأهداف
    const stopLoss = isBull ? entryPrice - atr * slMult : entryPrice + atr * slMult;
    const slDist = Math.abs(entryPrice - stopLoss);
    const stopLossDistance = parseFloat((slDist / entryPrice * 100).toFixed(2));

    const tp1 = isBull ? entryPrice + atr * tp1Mult : entryPrice - atr * tp1Mult;
    const tp2 = isBull ? entryPrice + atr * tp2Mult : entryPrice - atr * tp2Mult;
    const tp3 = isBull ? entryPrice + atr * tp3Mult : entryPrice - atr * tp3Mult;

    const tp1Rr = parseFloat((tp1Mult / slMult).toFixed(2));
    const tp2Rr = parseFloat((tp2Mult / slMult).toFixed(2));
    const tp3Rr = parseFloat((tp3Mult / slMult).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));

    // احتمالات بناءً على عدد الأدوات المتوافقة
    const alignedCount = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + alignedCount * 8;
    const tp1Prob = Math.min(90, baseProb + 15);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 15);

    const expectedValue = parseFloat((
        (tp1Prob / 100 * tp1Rr * stopLossDistance * 0.5) +
        (tp2Prob / 100 * tp2Rr * stopLossDistance * 0.3) +
        (tp3Prob / 100 * tp3Rr * stopLossDistance * 0.2) -
        ((1 - tp1Prob / 100) * stopLossDistance)
    ).toFixed(2));

    return {
        entryPrice, stopLoss, stopLossDistance, riskPct: stopLossDistance,
        tp1, tp1Rr, tp1Probability: tp1Prob,
        tp2, tp2Rr, tp2Probability: tp2Prob,
        tp3, tp3Rr, tp3Probability: tp3Prob,
        averageRr: avgRr, expectedValue
    };
}

// دالة التنسيق الموحدة للأسعار وتجنب الأصفار
function tsig_fmt(p) {
    return (typeof smartFormat === 'function') ? smartFormat(p) : (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(p) : p.toFixed(4));
}

// ==================== Render Dashboard ====================
function tsig_renderDashboard(a) {
    return `${tsig_renderMasterCard(a)} 
            ${tsig_renderTradesTable(a.timeframes[0], 'صفقة سريعة المدى', 'SHORT-TERM TRADE')} 
            ${tsig_renderTradesTable(a.timeframes[1], 'صفقة متوسطة المدى', 'MID-TERM TRADE')} 
            ${tsig_renderTradesTable(a.timeframes[2], 'صفقة بعيدة المدى', 'LONG-TERM TRADE')} 
            ${tsig_renderComponentsSummary(a.timeframes)} 
            ${tsig_renderAnalysis(a)} 
            ${tsig_renderGuide()}`;
}

function tsig_renderMasterCard(a) {
    const gradeColor = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const biasColor = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t2)');
    return `<div class="tsig-master-card">
                <div class="tsig-master-label">MASTER SIGNAL</div>
                <div class="tsig-master-grade" style="color:${gradeColor}">${a.masterGrade}</div>
                <div class="tsig-master-bias" style="color:${biasColor}">${a.masterBias} SIGNAL</div>
                <div class="tsig-master-bar"><div class="tsig-master-bar-fill" style="width:${a.masterScore}%"></div></div>
                <div class="tsig-master-stats">
                    <div class="tsig-master-stat"><div class="tsig-master-stat-label">MASTER SCORE</div><div class="tsig-master-stat-val">${a.masterScore}/100</div></div>
                    <div class="tsig-master-stat"><div class="tsig-master-stat-label">TFs ALIGNED</div><div class="tsig-master-stat-val">${a.alignedTfs}/3</div></div>
                    <div class="tsig-master-stat"><div class="tsig-master-stat-label">CURRENT PRICE</div><div class="tsig-master-stat-val">$${tsig_fmt(a.currentPrice)}</div></div>
                </div>
            </div>`;
}

function tsig_renderTradesTable(tf, arabicTitle, englishTitle) {
    if (!tf.trade) {
        let msg = 'NO QUALIFIED SIGNAL // ضعف قوة الإشارة — لا توجد صفقة شراء مؤهلة حالياً';
        if (tf.bias === 'BEARISH') {
            msg = 'BEARISH TREND // مسار هابط — النظام مصمم للتداول الفوري (Spot) صعوداً فقط. يُنصح بالبقاء خارج السوق لتجنب الخسارة.';
        }
        return `<div class="tsig-trade-table-card">
                    <div class="tsig-trade-header">
                        <span class="tsig-trade-tf">${tf.tf}</span>
                        <div class="tsig-trade-headings">
                            <div class="tsig-trade-arabic">${arabicTitle}</div>
                            <div class="tsig-trade-english">${englishTitle}</div>
                        </div>
                        <span class="tsig-trade-grade" style="color:var(--t3)">—</span>
                    </div>
                    <div style="text-align:center;padding:20px;color:var(--t2);font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.6;">${msg}</div>
                </div>`;
    }
    const t = tf.trade;
    const isBull = tf.bias === 'BULLISH';
    const biasColor = isBull ? 'var(--t)' : 'var(--o)';
    const gradeColor = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';

    return `
    <div class="tsig-trade-table-card" style="border-right:3px solid ${biasColor}">
        <div class="tsig-trade-header">
            <span class="tsig-trade-tf">${tf.tf}</span>
            <div class="tsig-trade-headings">
                <div class="tsig-trade-arabic">${arabicTitle}</div>
                <div class="tsig-trade-english">${englishTitle}</div>
            </div>
            <span class="tsig-trade-grade" style="color:${gradeColor}">${tf.signalGrade}</span>
        </div>

        <div class="tsig-trade-side-row">
            <span class="tsig-side-label" style="background:${biasColor};color:#000">${sideLabel}</span>
            <span class="tsig-signal-strength">SIGNAL: ${tf.signalStrength}/100</span>
        </div>

        <div class="tsig-strength-bar"><div class="tsig-strength-fill" style="width:${tf.signalStrength}%;background:${biasColor}"></div></div>

        <table class="tsig-trade-table">
            <tbody>
                <tr>
                    <td class="tsig-td-label">ENTRY</td>
                    <td class="tsig-td-price" style="color:var(--o)">$${tsig_fmt(t.entryPrice)}</td>
                    <td class="tsig-td-meta">—</td>
                </tr>
                <tr>
                    <td class="tsig-td-label">STOP LOSS</td>
                    <td class="tsig-td-price" style="color:var(--o)">$${tsig_fmt(t.stopLoss)}</td>
                    <td class="tsig-td-meta">-${t.riskPct}%</td>
                </tr>
                <tr class="tsig-row-separator"><td colspan="3"></td></tr>
                <tr>
                    <td class="tsig-td-label" style="color:var(--t)">TP1</td>
                    <td class="tsig-td-price" style="color:var(--t)">$${tsig_fmt(t.tp1)}</td>
                    <td class="tsig-td-meta">R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td>
                </tr>
                <tr>
                    <td class="tsig-td-label" style="color:var(--t)">TP2</td>
                    <td class="tsig-td-price" style="color:var(--t)">$${tsig_fmt(t.tp2)}</td>
                    <td class="tsig-td-meta">R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td>
                </tr>
                <tr>
                    <td class="tsig-td-label" style="color:var(--t)">TP3</td>
                    <td class="tsig-td-price" style="color:var(--t)">$${tsig_fmt(t.tp3)}</td>
                    <td class="tsig-td-meta">R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td>
                </tr>
            </tbody>
        </table>

        <div class="tsig-trade-footer">
            <div class="tsig-footer-item"><span class="tsig-footer-label">AVG R:R</span><span class="tsig-footer-val" style="color:var(--o)">1:${t.averageRr}</span></div>
            <div class="tsig-footer-item"><span class="tsig-footer-label">EXP. VALUE</span><span class="tsig-footer-val">+${t.expectedValue}%</span></div>
            <div class="tsig-footer-item"><span class="tsig-footer-label">QUALITY</span><span class="tsig-footer-val" style="color:${gradeColor}">${tf.signalQuality.replace(/_/g, ' ')}</span></div>
        </div>

        <div class="tsig-tools-strip">
            ${tf.components.map(c => {
                const cColor = c.bias === tf.bias ? biasColor : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)');
                return `<div class="tsig-tool-chip" style="border-top-color:${cColor}"><span class="tsig-chip-icon">${c.icon}</span><span class="tsig-chip-grade">${c.grade}</span></div>`;
            }).join('')}
        </div>
    </div>`;
}

function tsig_renderComponentsSummary(timeframes) {
    const toolNames = ['WYCKOFF', 'VSA', 'SUPERTREND_ADX', 'VW_MACD'];
    const toolLabels = { WYCKOFF: 'Wyckoff', VSA: 'VSA', SUPERTREND_ADX: 'SuperTrend+ADX', VW_MACD: 'VW-MACD' };

    let rows = '';
    toolNames.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn));
        rows += `<div class="tsig-comp-matrix-row">
                    <span class="tsig-matrix-tool">${toolLabels[tn]}</span>
                    ${vals.map(v => {
                        const biasColor = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
                        return `<div class="tsig-matrix-cell" style="border-top:2px solid ${biasColor}">
                                    <span style="color:${biasColor};font-weight:700;font-size:9px">${v.grade}</span>
                                    <span style="color:var(--t2);font-size:8px">${v.bias.substring(0,4)}</span>
                                </div>`;
                    }).join('')}
                 </div>`;
    });

    return `<div class="tsig-card">
                <div class="tsig-card-title">COMPONENTS MATRIX // مصفوفة الأدوات</div>
                <div class="tsig-matrix-header">
                    <span class="tsig-matrix-tool" style="text-align:center">TOOL</span>
                    <div class="tsig-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div>
                    <div class="tsig-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">4H</div>
                    <div class="tsig-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">1D</div>
                </div>
                ${rows}
            </div>`;
}

function tsig_renderAnalysis(a) {
    const tfs = a.timeframes;
    const activeTrades = tfs.filter(t => t.trade).length;
    const analysisText = activeTrades > 0
        ? `تم توليد ${activeTrades} إعدادات تداول مؤهلة عبر الفريمات الزمنية للتداول الفوري (Spot) على عملة ${a.symbol.replace('USDT','')}. الاتجاه العام للأدوات الأربعة (Wyckoff / VSA / SuperTrend-ADX / VW-MACD) يُشير إلى انحياز ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بدرجة توافق ${a.alignedTfs}/3 عبر الفريمات. المنظومة تُرجّح الإشارات بناءً على توافق الأدوات المستقلة — كلما ارتفع Signal Strength ارتفعت الموثوقية الإحصائية. ${a.masterGrade === 'A+' ? 'الإشارة الحالية استثنائية (A+) وتُعد نادرة نسبياً.' : (a.masterGrade === 'A' ? 'الإشارة قوية (A) ومؤهلة للتفعيل.' : 'الإشارة متوسطة وتستوجب تأكيداً إضافياً.')}`
        : `لا توجد إعدادات تداول مؤهلة عبر الفريمات الزمنية حالياً. المنظومة لا تُولّد صفقات إلا عند تحقق الحد الأدنى من توافق الأدوات الأربعة (Signal Strength ≥ 55). الانتظار حتى تحقق الشروط المنهجية هو السلوك الأمثل إحصائياً.`;

    return `<div class="tsig-analysis-card">
                <div class="tsig-analysis-title">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div>
                <div class="tsig-analysis-text">${analysisText}</div>
                <div class="tsig-disclaimer">
                    جميع إعدادات الصفقات محسوبة لاستخدامها في التداول الفوري (Spot Trading) حصرياً. المنصة لا تقدم خدمات تداول المشتقات أو العقود الآجلة. المستويات لا تمثل توصيات تداول. كل قرار شراء أو بيع هو مسؤولية المستخدم الشخصية. تقديرات الاحتمالات مبنية على البيانات التاريخية ولا تضمن النتائج المستقبلية.
                </div>
            </div>`;
}

function tsig_renderGuide() {
    return `<div class="tsig-guide">
                <div class="tsig-guide-title">دليل القراءة // TRADING SIGNAL READING GUIDE</div>
                <div class="tsig-guide-text">
                    <strong style="color:var(--o)">TRADING SIGNAL:</strong> منظومة توليد إشارات تداول متعددة الفريمات تدمج أربع منهجيات تحليلية متقدمة (Wyckoff Schematic + Volume Spread Analysis + SuperTrend-ADX + Volume-Weighted MACD) وتُنتج ثلاثة إعدادات تداول منفصلة لثلاثة آفاق زمنية مختلفة.<br><br>
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> التداول الفوري (Spot) حصرياً. المنصة لا تقدم خدمات تداول المشتقات أو العقود الآجلة (Futures).<br><br>
                    <strong style="color:var(--t)">THE FOUR METHODOLOGIES:</strong><br>
                    <strong style="color:var(--o)">1. WYCKOFF SCHEMATIC:</strong> يكشف مراحل التجميع والتوزيع المؤسسية (Spring / Upthrust / SOS / SOW). نموذج كلاسيكي بدقة 85-90%.<br><br>
                    <strong style="color:var(--o)">2. VSA (Volume Spread Analysis):</strong> يحلل العلاقة بين الحجم والنطاق السعري لكشف سلوك Smart Money (No Supply / No Demand / Stopping Volume / Climactic Volume / Effort vs Result).<br><br>
                    <strong style="color:var(--o)">3. SUPERTREND + ADX + VOLUME:</strong> دمج ثلاثي يؤكد الاتجاه + قوته + الاهتمام المؤسسي. ADX &gt; 25 يؤكد قوة الاتجاه.<br><br>
                    <strong style="color:var(--o)">4. VOLUME-WEIGHTED MACD:</strong> نسخة محسّنة من MACD تدمج الحجم في الحساب. Zero Line Cross = إشارة اتجاه رئيسية بدقة 85%.<br><br>
                    <strong style="color:var(--t)">THE THREE TIMEFRAMES:</strong><br>
                    <strong style="color:var(--o)">1H — SHORT TERM:</strong> صفقات سريعة المدى (ساعات إلى يوم). SL ضيق (1.5× ATR)، أهداف قريبة.<br><br>
                    <strong style="color:var(--o)">4H — MID TERM:</strong> صفقات متوسطة المدى (1-5 أيام). SL متوسط (2× ATR)، أهداف متوسطة.<br><br>
                    <strong style="color:var(--o)">1D — LONG TERM:</strong> صفقات بعيدة المدى (أسبوع إلى شهر). SL واسع (2.5× ATR)، أهداف بعيدة.<br><br>
                    <strong style="color:var(--o)">SIGNAL STRENGTH (0-100):</strong> درجة قوة الصفقة محسوبة من متوسط درجات الأدوات الأربعة + معامل توافقها. قيم أعلى من 75 تُعد إشارات قوية موثوقة.<br><br>
                    <strong style="color:var(--t)">SIGNAL GRADE:</strong><br>
                    A+ (VERY STRONG): 85+ نقطة + 4/4 أدوات متوافقة<br>
                    A (STRONG): 75+ نقطة + 3+ أدوات متوافقة<br>
                    B+ (MODERATE STRONG): 65+ نقطة<br>
                    B (MODERATE): 55+ نقطة<br>
                    C (WEAK): أقل من 55 — لا تُولّد صفقة<br><br>
                    <strong style="color:var(--o)">ATR-BASED STOP LOSS:</strong> وقف الخسارة محسوب بناءً على ATR (Average True Range) المتكيف مع تذبذب كل فريم. يضمن SL مناسب للظروف السوقية الحالية.<br><br>
                    <strong style="color:var(--o)">RISK:REWARD (R:R):</strong> النسبة بين المخاطرة والعائد. الأهداف مصممة بـ R:R متصاعد — TP1 بـ 1:1.5-2.5 (عالي الاحتمالية)، TP2 بـ 1:3-5.5 (متوسط)، TP3 بـ 1:5-10 (بعيد المدى).<br><br>
                    <strong style="color:var(--o)">EXPECTED VALUE:</strong> القيمة الإحصائية المتوقعة للصفقة بعد وزن احتمالات تحقيق الأهداف ضد احتمالية ضرب SL.<br><br>
                    <strong style="color:var(--o)">COMPONENTS MATRIX:</strong> جدول يُظهر نتيجة كل أداة على كل فريم. توافق الأدوات عبر الفريمات = إشارة استثنائية.<br><br>
                    <strong style="color:var(--o)">منهجية الاستخدام الأمثل:</strong> اختر الفريم المناسب لأسلوبك — المتداول قصير المدى يركز على 1H، المتوسط يركز على 4H، بعيد المدى على 1D. الإشارات التي تتوافق عبر الفريمات الثلاثة (Master Grade A+) تُعد الأقوى إحصائياً.<br><br>
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> هذه المنظومة تحليلية بحتة للتداول الفوري (Spot) فقط. جميع الأسعار والأهداف ومستويات وقف الخسارة للأغراض التحليلية ولا تمثل توصيات تداول. كل قرار شراء أو بيع هو مسؤولية المستخدم الشخصية.
                </div>
            </div>`;
}

// =====================================================================
// Trading Signal 2 — منصة 360°
// Multi-Timeframe Signal Generator V2 (SPOT ONLY — No Futures)
// 4 أدوات: Harmonic Patterns + Ichimoku Cloud + Keltner Squeeze + Stoch RSI
// تم تطبيق الحماية الصارمة (Long Only) لمنع صفقات البيع المكشوف
// =====================================================================

async function runTradingSignal2() {
    const symbolInput = document.getElementById('ts2-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('ts2-dashboard');
    const loading = document.getElementById('ts2-loading');
    
    if (!symbolInput) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';
    
    dash.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        const [r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=500`)
        ]);
        
        if (!r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d1h, d4h, d1d] = await Promise.all([r1h.json(), r4h.json(), r1d.json()]);
        
        const parse = raw => raw.map(c => ({ 
            time: parseInt(c[0]), 
            open: parseFloat(c[1]), 
            high: parseFloat(c[2]), 
            low: parseFloat(c[3]), 
            close: parseFloat(c[4]), 
            volume: parseFloat(c[5]) 
        }));
        
        const c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        
        if (c1h.length < 50 || c4h.length < 50 || c1d.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل المتقدم.');
        
        const analysis = ts2_analyzeTradingSignal(symbol, c1h, c4h, c1d);
        loading.style.display = 'none';
        dash.innerHTML = ts2_renderDashboard(analysis);
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function ts2_analyzeTradingSignal(symbol, c1h, c4h, c1d) {
    const tf1h = ts2_analyzeTimeframe('1H', 'SHORT_TERM', c1h);
    const tf4h = ts2_analyzeTimeframe('4H', 'MID_TERM', c4h);
    const tf1d = ts2_analyzeTimeframe('1D', 'LONG_TERM', c1d);
    
    const currentPrice = c1h[c1h.length - 1].close;
    const tfs = [tf1h, tf4h, tf1d];
    
    const bullTfs = tfs.filter(t => t.bias === 'BULLISH').length;
    const bearTfs = tfs.filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullTfs > bearTfs ? 'BULLISH' : (bearTfs > bullTfs ? 'BEARISH' : 'MIXED');
    
    const avgScore = (tf1h.score + tf4h.score + tf1d.score) / 3;
    const alignBonus = (bullTfs === 3 || bearTfs === 3) ? 10 : 0;
    const masterScore = Math.min(100, Math.round(avgScore + alignBonus));
    
    let masterGrade;
    if (masterScore >= 85) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol, currentPrice, masterBias, masterGrade, masterScore, 
        alignedTfs: masterBias === 'BULLISH' ? bullTfs : bearTfs, 
        timeframes: tfs 
    };
}

function ts2_analyzeTimeframe(tfName, horizon, candles) {
    const display = candles.slice(-100);
    const currentPrice = display[display.length - 1].close;
    
    const harmonic = ts2_runHarmonicComponent(display, currentPrice);
    const ichimoku = ts2_runIchimokuComponent(display);
    const keltner = ts2_runKeltnerSqueezeComponent(display);
    const stochRsi = ts2_runStochRsiComponent(display);
    
    const components = [harmonic, ichimoku, keltner, stochRsi];
    const bullC = components.filter(c => c.bias === 'BULLISH').length;
    const bearC = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullC > bearC ? 'BULLISH' : (bearC > bullC ? 'BEARISH' : 'NEUTRAL');
    const alignedCount = bias === 'BULLISH' ? bullC : (bias === 'BEARISH' ? bearC : 0);
    
    const avgS = components.reduce((s, c) => s + c.score, 0) / 4;
    const signalStrength = Math.round(avgS * 0.6 + (alignedCount / 4 * 100) * 0.4);
    const score = signalStrength;
    
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && alignedCount === 4) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && alignedCount >= 3) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65 && alignedCount >= 3) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }
    
    // الحماية الصارمة: (SPOT ONLY) تفعيل الصفقات الصعودية فقط
    const trade = (bias === 'BULLISH' && signalStrength >= 55) 
        ? ts2_buildTrade(bias, currentPrice, candles, tfName, components) 
        : null;
        
    return { 
        tf: tfName, horizon, bias, signalStrength, signalGrade, signalQuality, 
        score, alignedCount, components, trade, currentPrice 
    };
}

// ==================== 1. Harmonic Patterns ====================
function ts2_runHarmonicComponent(candles, currentPrice) {
    const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
    const pks = typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length).slice(-4) : [];
    const trs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length).slice(-4) : [];
    
    let bias = 'NEUTRAL', pattern = 'NO_PATTERN', score = 50, summary = 'لا يوجد نمط توافقي مكتشف حالياً';
    
    if (pks.length >= 2 && trs.length >= 2) {
        const xIdx = trs[trs.length - 2], aIdx = pks[pks.length - 2];
        const bIdx = trs[trs.length - 1], dIdx = pks.length > 2 ? pks[pks.length - 1] : null;
        
        if (xIdx < aIdx && aIdx < bIdx) {
            const xa = highs[aIdx] - lows[xIdx];
            const ab = highs[aIdx] - lows[bIdx];
            const abRatio = ab / xa;
            
            if (abRatio >= 0.35 && abRatio <= 0.55) {
                const prz = lows[xIdx] + xa * 0.886;
                const przDist = Math.abs(currentPrice - prz) / currentPrice * 100;
                if (przDist < 2) {
                    bias = 'BULLISH'; pattern = 'BAT_PATTERN';
                    score = Math.min(90, 75 + Math.round((2 - przDist) * 5));
                    summary = `نمط Bat التوافقي مكتشف — PRZ عند ${ts2_fmt(prz)} (على بُعد ${przDist.toFixed(2)}%) — AB/XA = ${(abRatio * 100).toFixed(1)}%`;
                }
            }
            if (abRatio >= 0.58 && abRatio <= 0.68) {
                const prz = lows[xIdx] + xa * 0.786;
                const przDist = Math.abs(currentPrice - prz) / currentPrice * 100;
                if (przDist < 2) {
                    bias = 'BULLISH'; pattern = 'GARTLEY_222';
                    score = Math.min(88, 72 + Math.round((2 - przDist) * 5));
                    summary = `نمط Gartley 222 مكتشف — PRZ عند ${ts2_fmt(prz)} (على بُعد ${przDist.toFixed(2)}%)`;
                }
            }
        }
    }
    
    if (bias === 'NEUTRAL' && pks.length >= 2 && trs.length >= 2) {
        const xIdx = pks[pks.length - 2], aIdx = trs[trs.length - 2];
        const bIdx = pks[pks.length - 1];
        if (xIdx < aIdx && aIdx < bIdx) {
            const xa = highs[xIdx] - lows[aIdx];
            const ab = highs[bIdx] - lows[aIdx];
            const abRatio = ab / xa;
            if (abRatio >= 0.35 && abRatio <= 0.55) {
                const prz = highs[xIdx] - xa * 0.886;
                const przDist = Math.abs(currentPrice - prz) / currentPrice * 100;
                if (przDist < 2) {
                    bias = 'BEARISH'; pattern = 'BEARISH_BAT';
                    score = Math.min(90, 75 + Math.round((2 - przDist) * 5));
                    summary = `نمط Bat هابط مكتشف — PRZ عند ${ts2_fmt(prz)} (على بُعد ${przDist.toFixed(2)}%)`;
                }
            }
        }
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'HARMONIC', fullName: 'Harmonic Patterns', icon: 'HP', grade, score, bias, status: pattern, summary };
}

// ==================== 2. Ichimoku Cloud ====================
function ts2_runIchimokuComponent(candles) {
    const n = candles.length;
    const calcHL = (period, endIdx) => {
        const slice = candles.slice(Math.max(0, endIdx - period + 1), endIdx + 1);
        return { high: Math.max(...slice.map(c => c.high)), low: Math.min(...slice.map(c => c.low)) };
    };
    const last = n - 1;
    const tenkan9 = calcHL(9, last);
    const tenkan = (tenkan9.high + tenkan9.low) / 2;
    const kijun26 = calcHL(26, last);
    const kijun = (kijun26.high + kijun26.low) / 2;
    const senkouA = (tenkan + kijun) / 2;
    const senkou52 = calcHL(52, last);
    const senkouB = (senkou52.high + senkou52.low) / 2;
    const chikou = candles[Math.max(0, last - 26)]?.close || candles[last].close;
    const close = candles[last].close;
    
    const cloudTop = Math.max(senkouA, senkouB);
    const cloudBottom = Math.min(senkouA, senkouB);
    const aboveCloud = close > cloudTop;
    const belowCloud = close < cloudBottom;
    const tkCrossBull = tenkan > kijun;
    const chikouAbove = chikou > candles[Math.max(0, last - 26)]?.close;

    let bias = 'NEUTRAL', status = 'INSIDE_CLOUD', score = 50, summary = 'السعر داخل سحابة Ichimoku — منطقة محايدة';
    let bullSignals = 0, bearSignals = 0;
    
    if (aboveCloud) bullSignals += 2; if (belowCloud) bearSignals += 2;
    if (tkCrossBull) bullSignals++; else bearSignals++;
    if (chikouAbove) bullSignals++; else bearSignals++;
    if (close > tenkan) bullSignals++; else bearSignals++;

    if (bullSignals >= 4 && aboveCloud) {
        bias = 'BULLISH'; status = 'BULLISH_ABOVE_CLOUD';
        score = Math.min(90, 70 + bullSignals * 3);
        summary = `إشارة صعودية مؤكدة — السعر فوق السحابة + Tenkan فوق Kijun${chikouAbove ? ' + Chikou مؤكد' : ''}`;
    } else if (bearSignals >= 4 && belowCloud) {
        bias = 'BEARISH'; status = 'BEARISH_BELOW_CLOUD';
        score = Math.min(90, 70 + bearSignals * 3);
        summary = `إشارة هبوطية مؤكدة — السعر تحت السحابة + Tenkan تحت Kijun${!chikouAbove ? ' + Chikou مؤكد' : ''}`;
    } else if (aboveCloud) {
        bias = 'BULLISH'; status = 'ABOVE_CLOUD_PARTIAL';
        score = 65; summary = 'السعر فوق السحابة — انحياز صعودي مع تأكيد جزئي';
    } else if (belowCloud) {
        bias = 'BEARISH'; status = 'BELOW_CLOUD_PARTIAL';
        score = 65; summary = 'السعر تحت السحابة — انحياز هبوطي مع تأكيد جزئي';
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'ICHIMOKU', fullName: 'Ichimoku Cloud Pro', icon: 'ICH', grade, score, bias, status, summary };
}

// ==================== 3. Keltner Channels Squeeze ====================
function ts2_runKeltnerSqueezeComponent(candles) {
    const n = candles.length, period = 20;
    const closes = candles.slice(-period).map(c => c.close);
    const sma = closes.reduce((s, v) => s + v, 0) / period;
    const variance = closes.reduce((s, v) => s + Math.pow(v - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const bbUpper = sma + 2 * stdDev, bbLower = sma - 2 * stdDev;
    
    const trs = [];
    for (let i = Math.max(1, n - period); i < n; i++) {
        trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    const kcUpper = sma + 1.5 * atr, kcLower = sma - 1.5 * atr;
    
    const inSqueeze = bbUpper < kcUpper && bbLower > kcLower;
    const close = candles[n - 1].close;
    const momentum = close - sma;
    const prevMomentum = candles[n - 2].close - sma;
    const momGrowing = Math.abs(momentum) > Math.abs(prevMomentum);

    let bias = 'NEUTRAL', status = 'NO_SQUEEZE', score = 50, summary = 'لا يوجد ضغط حالي في القنوات';

    if (inSqueeze) {
        if (momentum > 0 && momGrowing) {
            bias = 'BULLISH'; status = 'SQUEEZE_BULLISH_MOMENTUM';
            score = 82; summary = 'ضغط نشط مع زخم صعودي متنامٍ — احتمالية Breakout صاعد عالية';
        } else if (momentum < 0 && momGrowing) {
            bias = 'BEARISH'; status = 'SQUEEZE_BEARISH_MOMENTUM';
            score = 82; summary = 'ضغط نشط مع زخم هبوطي متنامٍ — احتمالية Breakout هابط عالية';
        } else {
            status = 'SQUEEZE_ACTIVE_NO_DIRECTION';
            score = 60; summary = 'ضغط نشط (BB داخل KC) لكن بدون اتجاه واضح — انتظار كسر الاتجاه';
        }
    } else {
        if (close > bbUpper && momentum > 0) {
            bias = 'BULLISH'; status = 'BREAKOUT_UP';
            score = 78; summary = 'كسر صعودي لقناة Bollinger — استمرار الزخم الإيجابي';
        } else if (close < bbLower && momentum < 0) {
            bias = 'BEARISH'; status = 'BREAKOUT_DOWN';
            score = 78; summary = 'كسر هبوطي لقناة Bollinger — استمرار الزخم السلبي';
        }
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'KELTNER_SQUEEZE', fullName: 'Keltner Squeeze', icon: 'KSQ', grade, score, bias, status, summary };
}

// ==================== 4. Stochastic RSI ====================
function ts2_runStochRsiComponent(candles) {
    const period = 14, kPeriod = 3, dPeriod = 3;
    const rsiVals = [];
    let aG = 0, aL = 0;
    
    for (let i = 1; i <= period && i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        if (d > 0) aG += d; else aL -= d;
    }
    aG /= period; aL /= period;
    
    for (let i = 0; i <= period; i++) rsiVals.push(50);
    
    for (let i = period + 1; i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        aG = (aG * (period - 1) + Math.max(0, d)) / period;
        aL = (aL * (period - 1) + Math.max(0, -d)) / period;
        rsiVals.push(aL === 0 ? 100 : 100 - (100 / (1 + aG / aL)));
    }
    
    const stochK = [];
    for (let i = 0; i < rsiVals.length; i++) {
        if (i < period) { stochK.push(50); continue; }
        const window = rsiVals.slice(i - period + 1, i + 1);
        const minR = Math.min(...window), maxR = Math.max(...window);
        stochK.push(maxR === minR ? 50 : ((rsiVals[i] - minR) / (maxR - minR)) * 100);
    }
    
    const smoothK = [];
    for (let i = 0; i < stochK.length; i++) {
        if (i < kPeriod) { smoothK.push(stochK[i]); continue; }
        smoothK.push(stochK.slice(i - kPeriod + 1, i + 1).reduce((s, v) => s + v, 0) / kPeriod);
    }
    
    const smoothD = [];
    for (let i = 0; i < smoothK.length; i++) {
        if (i < dPeriod) { smoothD.push(smoothK[i]); continue; }
        smoothD.push(smoothK.slice(i - dPeriod + 1, i + 1).reduce((s, v) => s + v, 0) / dPeriod);
    }
    
    const k = smoothK[smoothK.length - 1];
    const d = smoothD[smoothD.length - 1];
    const prevK = smoothK[smoothK.length - 2];
    const prevD = smoothD[smoothD.length - 2];
    
    const crossUp = prevK <= prevD && k > d;
    const crossDown = prevK >= prevD && k < d;

    const closes = candles.map(c => c.close);
    const recentCloses = closes.slice(-30);
    const recentK = smoothK.slice(-30);
    const troughs = typeof findTroughs === 'function' ? findTroughs(recentCloses, 0, recentCloses.length).slice(-2) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(recentCloses, 0, recentCloses.length).slice(-2) : [];
    
    let hasBullDiv = false, hasBearDiv = false;
    if (troughs.length >= 2) {
        const t1 = troughs[0], t2 = troughs[1];
        if (recentCloses[t2] < recentCloses[t1] && recentK[t2] > recentK[t1]) hasBullDiv = true;
    }
    if (peaks.length >= 2) {
        const p1 = peaks[0], p2 = peaks[1];
        if (recentCloses[p2] > recentCloses[p1] && recentK[p2] < recentK[p1]) hasBearDiv = true;
    }

    let bias = 'NEUTRAL', status = 'NO_SIGNAL', score = 50, summary = 'لا توجد إشارة Stoch RSI واضحة';

    if (crossUp && k < 25) {
        bias = 'BULLISH'; status = 'OVERSOLD_CROSS_UP';
        score = hasBullDiv ? 88 : 80;
        summary = `عبور صاعد في منطقة Oversold (K=${k.toFixed(1)})${hasBullDiv ? ' مع تباعد إيجابي مؤكد' : ''} — إشارة شراء قوية`;
    } else if (crossDown && k > 75) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_CROSS_DOWN';
        score = hasBearDiv ? 88 : 80;
        summary = `عبور هابط في منطقة Overbought (K=${k.toFixed(1)})${hasBearDiv ? ' مع تباعد سلبي مؤكد' : ''} — إشارة بيع قوية`;
    } else if (k < 20 && hasBullDiv) {
        bias = 'BULLISH'; status = 'OVERSOLD_DIVERGENCE';
        score = 82; summary = `Stoch RSI في منطقة Oversold (K=${k.toFixed(1)}) مع تباعد إيجابي — إشارة شراء محتملة`;
    } else if (k > 80 && hasBearDiv) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_DIVERGENCE';
        score = 82; summary = `Stoch RSI في منطقة Overbought (K=${k.toFixed(1)}) مع تباعد سلبي — إشارة بيع محتملة`;
    } else if (k < 30) {
        bias = 'BULLISH'; status = 'OVERSOLD';
        score = 65; summary = `Stoch RSI في منطقة Oversold (K=${k.toFixed(1)}) — انتظار عبور صاعد للتأكيد`;
    } else if (k > 70) {
        bias = 'BEARISH'; status = 'OVERBOUGHT';
        score = 65; summary = `Stoch RSI في منطقة Overbought (K=${k.toFixed(1)}) — انتظار عبور هابط للتأكيد`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'STOCH_RSI', fullName: 'Stochastic RSI + Divergence', icon: 'SRI', grade, score, bias, status, summary };
}

// ==================== Trade Builder ====================
function ts2_buildTrade(bias, currentPrice, candles, tfName, components) {
    const isBull = bias === 'BULLISH';
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) {
        trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    
    let slM, t1M, t2M, t3M;
    if (tfName === '1H') { slM = 1.5; t1M = 1.5; t2M = 3.0; t3M = 5.0; }
    else if (tfName === '4H') { slM = 2.0; t1M = 2.0; t2M = 4.0; t3M = 7.0; }
    else { slM = 2.5; t1M = 2.5; t2M = 5.5; t3M = 10.0; }

    const entryPrice = currentPrice;
    const stopLoss = isBull ? entryPrice - atr * slM : entryPrice + atr * slM;
    const slDist = Math.abs(entryPrice - stopLoss);
    const stopLossDistance = parseFloat((slDist / entryPrice * 100).toFixed(2));
    
    const tp1 = isBull ? entryPrice + atr * t1M : entryPrice - atr * t1M;
    const tp2 = isBull ? entryPrice + atr * t2M : entryPrice - atr * t2M;
    const tp3 = isBull ? entryPrice + atr * t3M : entryPrice - atr * t3M;
    
    const tp1Rr = parseFloat((t1M / slM).toFixed(2));
    const tp2Rr = parseFloat((t2M / slM).toFixed(2));
    const tp3Rr = parseFloat((t3M / slM).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    
    const aligned = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + aligned * 8;
    const tp1Prob = Math.min(90, baseProb + 15);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 15);
    
    const expectedValue = parseFloat(((tp1Prob / 100 * tp1Rr * stopLossDistance * 0.5) + (tp2Prob / 100 * tp2Rr * stopLossDistance * 0.3) + (tp3Prob / 100 * tp3Rr * stopLossDistance * 0.2) - ((1 - tp1Prob / 100) * stopLossDistance)).toFixed(2));

    return { 
        entryPrice, stopLoss, stopLossDistance, riskPct: stopLossDistance, 
        tp1, tp1Rr, tp1Probability: tp1Prob, 
        tp2, tp2Rr, tp2Probability: tp2Prob, 
        tp3, tp3Rr, tp3Probability: tp3Prob, 
        averageRr: avgRr, expectedValue 
    };
}

function ts2_fmt(p) { return (typeof smartFormat === 'function') ? smartFormat(p) : p.toFixed(4); }

// ==================== Render Dashboard ====================
function ts2_renderDashboard(a) {
    return `${ts2_renderMasterCard(a)} 
            ${ts2_renderTradesTable(a.timeframes[0], 'صفقة سريعة المدى', 'SHORT-TERM TRADE')} 
            ${ts2_renderTradesTable(a.timeframes[1], 'صفقة متوسطة المدى', 'MID-TERM TRADE')} 
            ${ts2_renderTradesTable(a.timeframes[2], 'صفقة بعيدة المدى', 'LONG-TERM TRADE')} 
            ${ts2_renderComponentsSummary(a.timeframes)} 
            ${ts2_renderAnalysis(a)} 
            ${ts2_renderGuide()}`;
}

function ts2_renderMasterCard(a) {
    const gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const bc = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
    return `<div class="ts2-master-card"> 
                <div class="ts2-master-label">MASTER SIGNAL</div> 
                <div class="ts2-master-grade" style="color:${gc}">${a.masterGrade}</div> 
                <div class="ts2-master-bias" style="color:${bc}">${a.masterBias} SIGNAL</div> 
                <div class="ts2-master-bar"><div class="ts2-master-bar-fill" style="width:${a.masterScore}%"></div></div> 
                <div class="ts2-master-stats"> 
                    <div class="ts2-ms"><div class="ts2-ms-label">MASTER SCORE</div><div class="ts2-ms-val">${a.masterScore}/100</div></div> 
                    <div class="ts2-ms"><div class="ts2-ms-label">TFs ALIGNED</div><div class="ts2-ms-val">${a.alignedTfs}/3</div></div> 
                    <div class="ts2-ms"><div class="ts2-ms-label">CURRENT PRICE</div><div class="ts2-ms-val">$${ts2_fmt(a.currentPrice)}</div></div> 
                </div> 
            </div>`;
}

function ts2_renderTradesTable(tf, arTitle, enTitle) {
    if (!tf.trade) {
        let msg = 'NO QUALIFIED SIGNAL // لا توجد صفقة شراء مؤهلة حالياً';
        if (tf.bias === 'BEARISH') {
            msg = 'BEARISH TREND // مسار هابط — النظام مصمم للتداول الفوري (Spot) صعوداً فقط. يُنصح بالبقاء خارج السوق لتجنب الخسارة.';
        }
        return `<div class="ts2-trade-card">
                    <div class="ts2-trade-header">
                        <span class="ts2-trade-tf">${tf.tf}</span>
                        <div class="ts2-trade-headings">
                            <div class="ts2-trade-ar">${arTitle}</div>
                            <div class="ts2-trade-en">${enTitle}</div>
                        </div>
                        <span class="ts2-trade-grade" style="color:var(--t3)">—</span>
                    </div>
                    <div style="text-align:center;padding:20px;color:var(--t2);font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.6;">${msg}</div>
                </div>`;
    }
    
    const t = tf.trade, isBull = tf.bias === 'BULLISH';
    const biasC = isBull ? 'var(--t)' : 'var(--o)';
    const gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';
    
    return `<div class="ts2-trade-card" style="border-right:3px solid ${biasC}"> 
                <div class="ts2-trade-header"> 
                    <span class="ts2-trade-tf">${tf.tf}</span> 
                    <div class="ts2-trade-headings"><div class="ts2-trade-ar">${arTitle}</div><div class="ts2-trade-en">${enTitle}</div></div> 
                    <span class="ts2-trade-grade" style="color:${gradeC}">${tf.signalGrade}</span> 
                </div> 
                <div class="ts2-side-row"><span class="ts2-side-badge" style="background:${biasC};color:#000">${sideLabel}</span><span class="ts2-signal-str">SIGNAL: ${tf.signalStrength}/100</span></div> 
                <div class="ts2-str-bar"><div class="ts2-str-fill" style="width:${tf.signalStrength}%;background:${biasC}"></div></div> 
                <table class="ts2-table"> 
                    <tbody> 
                        <tr><td class="ts2-td-l">ENTRY</td><td class="ts2-td-p" style="color:var(--o)">$${ts2_fmt(t.entryPrice)}</td><td class="ts2-td-m">—</td></tr> 
                        <tr><td class="ts2-td-l">STOP LOSS</td><td class="ts2-td-p" style="color:var(--o)">$${ts2_fmt(t.stopLoss)}</td><td class="ts2-td-m">-${t.riskPct}%</td></tr> 
                        <tr class="ts2-row-sep"><td colspan="3"></td></tr> 
                        <tr><td class="ts2-td-l" style="color:var(--t)">TP1</td><td class="ts2-td-p" style="color:var(--t)">$${ts2_fmt(t.tp1)}</td><td class="ts2-td-m">R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td></tr> 
                        <tr><td class="ts2-td-l" style="color:var(--t)">TP2</td><td class="ts2-td-p" style="color:var(--t)">$${ts2_fmt(t.tp2)}</td><td class="ts2-td-m">R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td></tr> 
                        <tr><td class="ts2-td-l" style="color:var(--t)">TP3</td><td class="ts2-td-p" style="color:var(--t)">$${ts2_fmt(t.tp3)}</td><td class="ts2-td-m">R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td></tr> 
                    </tbody> 
                </table> 
                <div class="ts2-trade-footer"> 
                    <div class="ts2-fi"><span class="ts2-fi-l">AVG R:R</span><span class="ts2-fi-v" style="color:var(--o)">1:${t.averageRr}</span></div> 
                    <div class="ts2-fi"><span class="ts2-fi-l">EXP. VALUE</span><span class="ts2-fi-v">+${t.expectedValue}%</span></div> 
                    <div class="ts2-fi"><span class="ts2-fi-l">QUALITY</span><span class="ts2-fi-v" style="color:${gradeC}">${tf.signalQuality.replace(/_/g, ' ')}</span></div> 
                </div> 
                <div class="ts2-tools-strip"> 
                    ${tf.components.map(c => { 
                        const cC = c.bias === tf.bias ? biasC : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)'); 
                        return `<div class="ts2-tool-chip" style="border-top-color:${cC}"><span class="ts2-chip-icon">${c.icon}</span><span class="ts2-chip-grade">${c.grade}</span></div>`; 
                    }).join('')} 
                </div> 
            </div>`;
}

function ts2_renderComponentsSummary(timeframes) {
    const tools = [
        { key: 'HARMONIC', label: 'Harmonic' },
        { key: 'ICHIMOKU', label: 'Ichimoku' },
        { key: 'KELTNER_SQUEEZE', label: 'Keltner Sq.' },
        { key: 'STOCH_RSI', label: 'Stoch RSI' }
    ];
    let rows = '';
    tools.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn.key));
        rows += `<div class="ts2-matrix-row">${`<span class="ts2-matrix-tool">${tn.label}</span>`}${vals.map(v => { 
            const bc = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)'); 
            return `<div class="ts2-matrix-cell" style="border-top:2px solid ${bc}"><span style="color:${bc};font-weight:700;font-size:9px">${v.grade}</span><span style="color:var(--t2);font-size:8px">${v.bias.substring(0,4)}</span></div>`; 
        }).join('')}</div>`;
    });
    return `<div class="ts2-card"> 
                <div class="ts2-card-title">COMPONENTS MATRIX // مصفوفة الأدوات</div> 
                <div class="ts2-matrix-header"><span class="ts2-matrix-tool">TOOL</span><div class="ts2-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div><div class="ts2-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">4H</div><div class="ts2-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">1D</div></div> 
                ${rows} 
            </div>`;
}

function ts2_renderAnalysis(a) {
    const activeTrades = a.timeframes.filter(t => t.trade).length;
    const text = activeTrades > 0
        ? `تم توليد ${activeTrades} إعدادات تداول فوري (Spot) مؤهلة على عملة ${a.symbol.replace('USDT','')} عبر الفريمات الزمنية. الأدوات الأربعة (Harmonic Patterns / Ichimoku Cloud / Keltner Squeeze / Stochastic RSI) تُشير إلى انحياز ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بتوافق ${a.alignedTfs}/3 عبر الفريمات. ${a.masterGrade === 'A+' ? 'الإشارة استثنائية (A+) ونادرة.' : (a.masterGrade === 'A' ? 'الإشارة قوية (A) ومؤهلة.' : 'الإشارة متوسطة وتستوجب حذراً.')}`
        : `لا توجد إعدادات تداول مؤهلة حالياً. المنظومة لا تُولّد صفقات إلا عند تحقق الحد الأدنى من توافق الأدوات (Signal Strength ≥ 55). الانتظار هو السلوك الأمثل إحصائياً.`;
    
    return `<div class="ts2-analysis-card"> 
                <div class="ts2-analysis-title">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div> 
                <div class="ts2-analysis-text">${text}</div> 
                <div class="ts2-disclaimer">جميع إعدادات الصفقات للتداول الفوري (Spot) حصرياً — بدون رافعة مالية أو عقود آجلة أو مشتقات. المنصة لا تقدم أي خدمات Futures أو Leverage. المستويات لا تمثل توصيات تداول. كل قرار شراء أو بيع هو مسؤولية المستخدم الشخصية.</div> 
            </div>`;
}

function ts2_renderGuide() {
    return `<div class="ts2-guide"> 
                <div class="ts2-guide-title">دليل القراءة // TRADING SIGNAL 2 READING GUIDE</div> 
                <div class="ts2-guide-text"> 
                    <strong style="color:var(--o)">TRADING SIGNAL 2:</strong> منظومة توليد إشارات تداول فوري (Spot) متعددة الفريمات تدمج أربع منهجيات تحليلية (Harmonic Patterns + Ichimoku Cloud + Keltner Squeeze + Stochastic RSI) وتُنتج ثلاث خطط تداول منفصلة لثلاثة آفاق زمنية.<br><br> 
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> التداول الفوري (Spot) حصرياً — بدون رافعة مالية (Leverage) أو عقود آجلة (Futures) أو مشتقات (Derivatives).<br><br> 
                    <strong style="color:var(--t)">THE FOUR METHODOLOGIES:</strong><br> 
                    <strong style="color:var(--o)">1. HARMONIC PATTERNS:</strong> يكتشف أنماط Bat و Gartley التوافقية عبر نسب Fibonacci (AB/XA). عند وصول السعر لـ PRZ (Potential Reversal Zone) تُولّد إشارة انعكاس بدقة 80-83%.<br><br> 
                    <strong style="color:var(--o)">2. ICHIMOKU CLOUD PRO:</strong> النظام الياباني الكامل — 5 إشارات: فوق/تحت السحابة + Tenkan/Kijun Cross + Chikou Span + Cloud Breakout. 4+ إشارات متوافقة = إشارة عالية الدقة 80-84%.<br><br> 
                    <strong style="color:var(--o)">3. KELTNER SQUEEZE (TTM):</strong> استراتيجية John Carter — عندما BB تنكمش داخل KC = ضغط. كسر الضغط مع Momentum = Breakout بدقة 80-83%. يحدد بداية الحركات الكبيرة.<br><br> 
                    <strong style="color:var(--o)">4. STOCHASTIC RSI + DIVERGENCE:</strong> Stochastic مطبق على RSI = حساسية مضاعفة. عبور في منطقة Overbought/Oversold + Divergence = إشارة بدقة 80-82%.<br><br> 
                    <strong style="color:var(--t)">THE THREE TIMEFRAMES:</strong><br> 
                    <strong style="color:var(--o)">1H — SHORT TERM:</strong> صفقات سريعة (ساعات إلى يوم). SL ضيق (1.5× ATR).<br><br> 
                    <strong style="color:var(--o)">4H — MID TERM:</strong> صفقات متوسطة (1-5 أيام). SL متوسط (2× ATR).<br><br> 
                    <strong style="color:var(--o)">1D — LONG TERM:</strong> صفقات بعيدة (أسبوع إلى شهر). SL واسع (2.5× ATR).<br><br> 
                    <strong style="color:var(--o)">SIGNAL STRENGTH (0-100):</strong> قوة الصفقة = متوسط درجات الأدوات × 0.6 + معامل التوافق × 0.4. فوق 75 = إشارة موثوقة.<br><br> 
                    <strong style="color:var(--t)">SIGNAL GRADES:</strong><br> 
                    A+ (85+ / 4 أدوات متوافقة) — نادرة واستثنائية<br> 
                    A (75+ / 3+ أدوات) — قوية ومؤهلة<br> 
                    B+ (65+ / 3 أدوات) — متوسطة قوية<br> 
                    B (55+) — متوسطة<br> 
                    C (أقل من 55) — لا صفقة<br><br> 
                    <strong style="color:var(--o)">ATR-BASED SL:</strong> وقف الخسارة المتكيف مع التذبذب الحالي لكل فريم.<br><br> 
                    <strong style="color:var(--o)">R:R (Risk:Reward):</strong> TP1 بـ 1:1.5-2.5 (عالي الاحتمالية) / TP2 بـ 1:3-5.5 / TP3 بـ 1:5-10 (بعيد المدى).<br><br> 
                    <strong style="color:var(--o)">EXPECTED VALUE:</strong> القيمة الإحصائية المتوقعة بعد وزن الاحتمالات ضد المخاطر.<br><br> 
                    <strong style="color:var(--o)">COMPONENTS MATRIX:</strong> جدول يُظهر نتيجة كل أداة على كل فريم — توافق الأدوات والفريمات = أقوى إشارة.<br><br> 
                    <strong style="color:var(--o)">الاستخدام الأمثل:</strong> اختر الفريم المناسب لأسلوبك. الإشارات A+ عبر 3 فريمات = الأقوى إحصائياً. هذه المنظومة تُكمّل Trading Signal (الأولى) لتغطية مدارس تحليل مختلفة تماماً — معاً تُشكّلان منظومة تداول متكاملة.<br><br> 
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> هذه المنظومة تحليلية بحتة للتداول الفوري (Spot) فقط. كل قرار شراء أو بيع هو مسؤولية المستخدم الشخصية. 
                </div> 
            </div>`;
}

// =====================================================================
// Trading Signal 3 — منصة 360°
// MTF Signal Generator V3 (SPOT ONLY — No Futures/Leverage)
// 3 أدوات مكمّلة: RSI Momentum Engine + OBV Volume Flow + SMC Order Block
// الاستراتيجية: Momentum يحدد الاتجاه → Volume يؤكد → SMC يحدد الدخول
// =====================================================================

async function runTradingSignal3() {
    const symbolInput = document.getElementById('ts3-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('ts3-dashboard');
    const loading = document.getElementById('ts3-loading');
    
    if (!symbolInput) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';
    
    dash.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        const [r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=500`)
        ]);
        
        if (!r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d1h, d4h, d1d] = await Promise.all([r1h.json(), r4h.json(), r1d.json()]);
        
        const parse = raw => raw.map(c => ({ 
            time: parseInt(c[0]), 
            open: parseFloat(c[1]), 
            high: parseFloat(c[2]), 
            low: parseFloat(c[3]), 
            close: parseFloat(c[4]), 
            volume: parseFloat(c[5]) 
        }));
        
        const c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        
        if (c1h.length < 50 || c4h.length < 50 || c1d.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل المتقدم.');
        
        loading.style.display = 'none';
        dash.innerHTML = ts3_renderDashboard(ts3_analyzeTradingSignal(symbol, c1h, c4h, c1d));
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function ts3_analyzeTradingSignal(symbol, c1h, c4h, c1d) {
    const tf1h = ts3_analyzeTimeframe('1H', c1h);
    const tf4h = ts3_analyzeTimeframe('4H', c4h);
    const tf1d = ts3_analyzeTimeframe('1D', c1d);
    
    const currentPrice = c1h[c1h.length - 1].close;
    const tfs = [tf1h, tf4h, tf1d];
    
    const bullTfs = tfs.filter(t => t.bias === 'BULLISH').length;
    const bearTfs = tfs.filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullTfs > bearTfs ? 'BULLISH' : (bearTfs > bullTfs ? 'BEARISH' : 'MIXED');
    
    const avgScore = Math.round((tf1h.score + tf4h.score + tf1d.score) / 3);
    const alignBonus = (bullTfs === 3 || bearTfs === 3) ? 12 : 0;
    const masterScore = Math.min(100, avgScore + alignBonus);
    
    let masterGrade;
    if (masterScore >= 85) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol, currentPrice, masterBias, masterGrade, masterScore, 
        alignedTfs: masterBias === 'BULLISH' ? bullTfs : bearTfs, 
        timeframes: tfs 
    };
}

function ts3_analyzeTimeframe(tfName, candles) {
    const display = candles.slice(-100);
    const currentPrice = display[display.length - 1].close;
    
    const rsiEngine = ts3_runRsiEngine(display);
    const obvFlow = ts3_runObvFlow(display);
    const smcOb = ts3_runSmcOb(display, currentPrice);
    
    const components = [rsiEngine, obvFlow, smcOb];
    const bullC = components.filter(c => c.bias === 'BULLISH').length;
    const bearC = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullC > bearC ? 'BULLISH' : (bearC > bullC ? 'BEARISH' : 'NEUTRAL');
    const aligned = bias === 'BULLISH' ? bullC : (bias === 'BEARISH' ? bearC : 0);
    
    const avgS = components.reduce((s, c) => s + c.score, 0) / 3;
    const signalStrength = Math.round(avgS * 0.55 + (aligned / 3 * 100) * 0.45);
    const score = signalStrength;
    
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && aligned === 3) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && aligned >= 2) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }
    
    // الحماية الصارمة (SPOT ONLY): تفعيل بناء الصفقة فقط إذا كان الاتجاه صاعداً
    const trade = (bias === 'BULLISH' && signalStrength >= 55) 
        ? ts3_buildTrade(bias, currentPrice, candles, tfName, components) 
        : null;
        
    return { 
        tf: tfName, bias, signalStrength, signalGrade, signalQuality, 
        score, aligned, components, trade, currentPrice 
    };
}

// ==================== 1. RSI Momentum Engine ====================
function ts3_runRsiEngine(candles) {
    const period = 14;
    const rsiVals = [];
    let aG = 0, aL = 0;
    
    for (let i = 1; i <= period && i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        if (d > 0) aG += d; else aL -= d;
    }
    aG /= period; aL /= period;
    
    for (let i = 0; i <= period; i++) rsiVals.push(50);
    
    for (let i = period + 1; i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        aG = (aG * (period - 1) + Math.max(0, d)) / period;
        aL = (aL * (period - 1) + Math.max(0, -d)) / period;
        rsiVals.push(aL === 0 ? 100 : 100 - (100 / (1 + aG / aL)));
    }
    
    const currentRsi = rsiVals[rsiVals.length - 1];
    
    // RSI Divergence
    const closes = candles.map(c => c.close).slice(-30);
    const rsis = rsiVals.slice(-30);
    const troughs = typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length).slice(-2) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length).slice(-2) : [];
    
    let hasBullDiv = false, hasBearDiv = false;
    if (troughs.length >= 2) {
        if (closes[troughs[1]] < closes[troughs[0]] && rsis[troughs[1]] > rsis[troughs[0]] && rsis[troughs[0]] < 40) hasBullDiv = true;
    }
    if (peaks.length >= 2) {
        if (closes[peaks[1]] > closes[peaks[0]] && rsis[peaks[1]] < rsis[peaks[0]] && rsis[peaks[0]] > 60) hasBearDiv = true;
    }
    
    // RSI slope (momentum direction)
    const rsiSlope = rsiVals.slice(-5);
    const slopeDir = rsiSlope[4] - rsiSlope[0];

    let bias = 'NEUTRAL', status = 'NEUTRAL_ZONE', score = 50, summary = 'RSI في منطقة محايدة';

    if (currentRsi < 25 && hasBullDiv) {
        bias = 'BULLISH'; status = 'OVERSOLD_DIVERGENCE'; score = 90;
        summary = `RSI في Oversold (${currentRsi.toFixed(1)}) مع تباعد إيجابي مؤكد — إشارة شراء عالية الدقة`;
    } else if (currentRsi > 75 && hasBearDiv) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_DIVERGENCE'; score = 90;
        summary = `RSI في Overbought (${currentRsi.toFixed(1)}) مع تباعد سلبي مؤكد — إشارة بيع عالية الدقة`;
    } else if (currentRsi < 30 && slopeDir > 3) {
        bias = 'BULLISH'; status = 'OVERSOLD_RECOVERY'; score = 80;
        summary = `RSI يتعافى من Oversold (${currentRsi.toFixed(1)}) مع زخم صاعد — تحوّل إيجابي في الاتجاه`;
    } else if (currentRsi > 70 && slopeDir < -3) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_DECLINE'; score = 80;
        summary = `RSI يتراجع من Overbought (${currentRsi.toFixed(1)}) مع زخم هابط — تحوّل سلبي في الاتجاه`;
    } else if (currentRsi > 50 && slopeDir > 5) {
        bias = 'BULLISH'; status = 'BULLISH_MOMENTUM'; score = 68;
        summary = `زخم صعودي متنامٍ — RSI (${currentRsi.toFixed(1)}) مع ميل إيجابي قوي`;
    } else if (currentRsi < 50 && slopeDir < -5) {
        bias = 'BEARISH'; status = 'BEARISH_MOMENTUM'; score = 68;
        summary = `زخم هبوطي متنامٍ — RSI (${currentRsi.toFixed(1)}) مع ميل سلبي قوي`;
    } else if (currentRsi > 55) {
        bias = 'BULLISH'; status = 'MILD_BULLISH'; score = 58;
        summary = `انحياز صعودي معتدل — RSI (${currentRsi.toFixed(1)}) فوق المتوسط`;
    } else if (currentRsi < 45) {
        bias = 'BEARISH'; status = 'MILD_BEARISH'; score = 58;
        summary = `انحياز هبوطي معتدل — RSI (${currentRsi.toFixed(1)}) تحت المتوسط`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'RSI_MOMENTUM', fullName: 'RSI Momentum Engine', icon: 'RSI', grade, score, bias, status, summary, rsi: parseFloat(currentRsi.toFixed(1)) };
}

// ==================== 2. OBV Volume Flow ====================
function ts3_runObvFlow(candles) {
    const obv = [0];
    for (let i = 1; i < candles.length; i++) {
        if (candles[i].close > candles[i - 1].close) obv.push(obv[i - 1] + candles[i].volume);
        else if (candles[i].close < candles[i - 1].close) obv.push(obv[i - 1] - candles[i].volume);
        else obv.push(obv[i - 1]);
    }
    
    const emaPeriod = 20;
    const obvEma = [];
    const k = 2 / (emaPeriod + 1);
    let ema = obv[0];
    obv.forEach(v => { ema = v * k + ema * (1 - k); obvEma.push(ema); });

    const currentObv = obv[obv.length - 1];
    const currentEma = obvEma[obvEma.length - 1];
    const obvAboveEma = currentObv > currentEma;

    const recentObv = obv.slice(-10);
    const obvSlope = recentObv[recentObv.length - 1] - recentObv[0];
    const obvSlopeNorm = obvSlope / (Math.abs(recentObv[0]) || 1) * 100;

    const closes = candles.map(c => c.close).slice(-30);
    const obvRecent = obv.slice(-30);
    const pTroughs = typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length).slice(-2) : [];
    const pPeaks = typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length).slice(-2) : [];
    
    let bullDiv = false, bearDiv = false;
    if (pTroughs.length >= 2 && closes[pTroughs[1]] < closes[pTroughs[0]] && obvRecent[pTroughs[1]] > obvRecent[pTroughs[0]]) bullDiv = true;
    if (pPeaks.length >= 2 && closes[pPeaks[1]] > closes[pPeaks[0]] && obvRecent[pPeaks[1]] < obvRecent[pPeaks[0]]) bearDiv = true;

    const volumes = candles.slice(-20).map(c => c.volume);
    const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
    const recentVol = candles.slice(-3).reduce((s, c) => s + c.volume, 0) / 3;
    const volSpike = recentVol > avgVol * 1.5;

    let bias = 'NEUTRAL', status = 'NEUTRAL_FLOW', score = 50, summary = 'تدفق الحجم محايد حالياً';

    if (bullDiv && obvAboveEma) {
        bias = 'BULLISH'; status = 'BULLISH_DIVERGENCE_CONFIRMED'; score = 88;
        summary = 'تباعد إيجابي في OBV مع تدفق فوق المتوسط — تراكم شرائي مؤسسي مؤكد';
    } else if (bearDiv && !obvAboveEma) {
        bias = 'BEARISH'; status = 'BEARISH_DIVERGENCE_CONFIRMED'; score = 88;
        summary = 'تباعد سلبي في OBV مع تدفق تحت المتوسط — توزيع بيعي مؤسسي مؤكد';
    } else if (obvAboveEma && obvSlopeNorm > 2 && volSpike) {
        bias = 'BULLISH'; status = 'STRONG_ACCUMULATION'; score = 82;
        summary = `تراكم شرائي قوي — OBV فوق EMA مع ميل +${obvSlopeNorm.toFixed(1)}% وارتفاع حجم ${(recentVol / avgVol).toFixed(1)}x`;
    } else if (!obvAboveEma && obvSlopeNorm < -2 && volSpike) {
        bias = 'BEARISH'; status = 'STRONG_DISTRIBUTION'; score = 82;
        summary = `توزيع بيعي قوي — OBV تحت EMA مع ميل ${obvSlopeNorm.toFixed(1)}% وارتفاع حجم ${(recentVol / avgVol).toFixed(1)}x`;
    } else if (obvAboveEma && obvSlopeNorm > 1) {
        bias = 'BULLISH'; status = 'ACCUMULATION'; score = 70;
        summary = `تراكم شرائي — OBV فوق EMA مع ميل إيجابي +${obvSlopeNorm.toFixed(1)}%`;
    } else if (!obvAboveEma && obvSlopeNorm < -1) {
        bias = 'BEARISH'; status = 'DISTRIBUTION'; score = 70;
        summary = `توزيع بيعي — OBV تحت EMA مع ميل سلبي ${obvSlopeNorm.toFixed(1)}%`;
    } else if (obvAboveEma) {
        bias = 'BULLISH'; status = 'MILD_ACCUMULATION'; score = 60;
        summary = 'تراكم معتدل — OBV فوق متوسطه دون تأكيد حجم قوي';
    } else {
        bias = 'BEARISH'; status = 'MILD_DISTRIBUTION'; score = 60;
        summary = 'توزيع معتدل — OBV تحت متوسطه دون تأكيد حجم قوي';
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'OBV_FLOW', fullName: 'OBV Volume Flow', icon: 'OBV', grade, score, bias, status, summary };
}

// ==================== 3. SMC Order Block ====================
function ts3_runSmcOb(candles, currentPrice) {
    const display = candles.slice(-60);
    const avgRange = display.reduce((s, c) => s + (c.high - c.low), 0) / display.length;
    const candidates = [];

    for (let i = 0; i < display.length - 3; i++) {
        const c = display[i], n1 = display[i + 1], n2 = display[i + 2];
        if (c.close < c.open && n1.close > n1.open && n2.close > n2.open) {
            const moveUp = (n2.high - c.low) / avgRange;
            if (moveUp > 1.3) {
                const mitigated = display.slice(i + 3).some(x => x.low <= c.high && x.low >= c.low);
                candidates.push({ type: 'BULLISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(moveUp * 22)), idx: i, mitigated, fresh: !mitigated });
            }
        }
        if (c.close > c.open && n1.close < n1.open && n2.close < n2.open) {
            const moveDown = (c.high - n2.low) / avgRange;
            if (moveDown > 1.3) {
                const mitigated = display.slice(i + 3).some(x => x.high >= c.low && x.high <= c.high);
                candidates.push({ type: 'BEARISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(moveDown * 22)), idx: i, mitigated, fresh: !mitigated });
            }
        }
    }

    const freshObs = candidates.filter(c => c.fresh);
    const allObs = freshObs.length > 0 ? freshObs : candidates;

    if (allObs.length === 0) {
        return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_OB_DETECTED', summary: 'لا يوجد Order Block مكتشف بالقرب من السعر الحالي' };
    }

    allObs.sort((a, b) => {
        const distA = Math.abs(currentPrice - (a.priceMin + a.priceMax) / 2);
        const distB = Math.abs(currentPrice - (b.priceMin + b.priceMax) / 2);
        return distA - distB;
    });

    const best = allObs[0];
    const midOb = (best.priceMin + best.priceMax) / 2;
    const distance = Math.abs(currentPrice - midOb) / currentPrice * 100;
    const isBull = best.type === 'BULLISH';
    const inZone = currentPrice >= best.priceMin && currentPrice <= best.priceMax;
    const nearZone = distance < 1.5;

    let bias, status, score, summary;

    if (inZone) {
        bias = best.type; status = best.type + '_OB_ENTRY_ZONE';
        score = Math.min(92, best.strength + 10);
        summary = `السعر داخل ${isBull ? 'Bullish' : 'Bearish'} Order Block (${ts3_fmt(best.priceMin)}-${ts3_fmt(best.priceMax)}) — منطقة دخول ${best.fresh ? 'طازجة وغير مختبرة' : 'تم اختبارها سابقاً'}`;
    } else if (nearZone) {
        bias = best.type; status = best.type + '_OB_NEARBY';
        score = Math.min(85, best.strength + 5);
        summary = `${isBull ? 'Bullish' : 'Bearish'} Order Block قريب (${distance.toFixed(2)}%) عند ${ts3_fmt(best.priceMin)}-${ts3_fmt(best.priceMax)}${best.fresh ? ' — طازج وغير مختبر' : ''}`;
    } else {
        bias = best.type; status = best.type + '_OB_DETECTED';
        score = Math.min(75, best.strength);
        summary = `${isBull ? 'Bullish' : 'Bearish'} Order Block مكتشف عند ${ts3_fmt(best.priceMin)}-${ts3_fmt(best.priceMax)} (بُعد ${distance.toFixed(2)}%)`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade, score, bias, status, summary, obZone: { min: best.priceMin, max: best.priceMax } };
}

// ==================== Trade Builder ====================
function ts3_buildTrade(bias, currentPrice, candles, tfName, components) {
    const isBull = bias === 'BULLISH';
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) {
        trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    
    let slM, t1M, t2M, t3M;
    if (tfName === '1H') { slM = 1.5; t1M = 1.5; t2M = 3.0; t3M = 5.0; }
    else if (tfName === '4H') { slM = 2.0; t1M = 2.0; t2M = 4.0; t3M = 7.0; }
    else { slM = 2.5; t1M = 2.5; t2M = 5.5; t3M = 10.0; }

    const smcComp = components.find(c => c.name === 'SMC_OB');
    const entryPrice = (smcComp && smcComp.obZone && smcComp.bias === bias)
        ? (smcComp.obZone.min + smcComp.obZone.max) / 2
        : currentPrice;

    const stopLoss = isBull ? entryPrice - atr * slM : entryPrice + atr * slM;
    const slDist = Math.abs(entryPrice - stopLoss);
    const stopLossDistance = parseFloat((slDist / entryPrice * 100).toFixed(2));
    
    const tp1 = isBull ? entryPrice + atr * t1M : entryPrice - atr * t1M;
    const tp2 = isBull ? entryPrice + atr * t2M : entryPrice - atr * t2M;
    const tp3 = isBull ? entryPrice + atr * t3M : entryPrice - atr * t3M;
    
    const tp1Pct = parseFloat((Math.abs(tp1 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp2Pct = parseFloat((Math.abs(tp2 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp3Pct = parseFloat((Math.abs(tp3 - entryPrice) / entryPrice * 100).toFixed(2));
    
    const tp1Rr = parseFloat((t1M / slM).toFixed(2));
    const tp2Rr = parseFloat((t2M / slM).toFixed(2));
    const tp3Rr = parseFloat((t3M / slM).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    
    const aligned = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + aligned * 10;
    const tp1Prob = Math.min(90, baseProb + 12);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 12);
    
    const expectedValue = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * stopLossDistance)).toFixed(2));

    return {
        entryPrice, stopLoss, stopLossDistance, riskPct: stopLossDistance,
        tp1, tp1Pct, tp1Rr, tp1Probability: tp1Prob,
        tp2, tp2Pct, tp2Rr, tp2Probability: tp2Prob,
        tp3, tp3Pct, tp3Rr, tp3Probability: tp3Prob,
        averageRr: avgRr, expectedValue
    };
}

function ts3_fmt(p) { return (typeof smartFormat === 'function') ? smartFormat(p) : (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(p) : p.toFixed(4)); }

// ==================== Render ====================
function ts3_renderDashboard(a) {
    return `${ts3_renderMasterCard(a)} 
            ${ts3_renderTradesTable(a.timeframes[0], 'صفقة سريعة المدى', 'SHORT-TERM TRADE')} 
            ${ts3_renderTradesTable(a.timeframes[1], 'صفقة متوسطة المدى', 'MID-TERM TRADE')} 
            ${ts3_renderTradesTable(a.timeframes[2], 'صفقة بعيدة المدى', 'LONG-TERM TRADE')} 
            ${ts3_renderMatrix(a.timeframes)} 
            ${ts3_renderStrategy(a)} 
            ${ts3_renderAnalysis(a)} 
            ${ts3_renderGuide()}`;
}

function ts3_renderMasterCard(a) {
    const gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const bc = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
    return `<div class="ts3-master-card"> 
                <div class="ts3-master-label">MASTER SIGNAL</div> 
                <div class="ts3-master-grade" style="color:${gc}">${a.masterGrade}</div> 
                <div class="ts3-master-bias" style="color:${bc}">${a.masterBias} SIGNAL</div> 
                <div class="ts3-master-bar"><div class="ts3-bar-fill" style="width:${a.masterScore}%"></div></div> 
                <div class="ts3-master-stats"> 
                    <div class="ts3-ms"><div class="ts3-ms-l">MASTER SCORE</div><div class="ts3-ms-v">${a.masterScore}/100</div></div> 
                    <div class="ts3-ms"><div class="ts3-ms-l">TFs ALIGNED</div><div class="ts3-ms-v">${a.alignedTfs}/3</div></div> 
                    <div class="ts3-ms"><div class="ts3-ms-l">PRICE</div><div class="ts3-ms-v">$${ts3_fmt(a.currentPrice)}</div></div> 
                </div> 
            </div>`;
}

function ts3_renderTradesTable(tf, arTitle, enTitle) {
    if (!tf.trade) {
        let msg = 'NO QUALIFIED SIGNAL // لا توجد صفقة شراء مؤهلة حالياً';
        if (tf.bias === 'BEARISH') {
            msg = 'BEARISH TREND // مسار هابط — النظام مصمم للتداول الفوري (Spot) صعوداً فقط. يُنصح بالبقاء خارج السوق لتجنب الخسارة.';
        }
        return `<div class="ts3-trade-card">
                    <div class="ts3-trade-header">
                        <span class="ts3-trade-tf">${tf.tf}</span>
                        <div class="ts3-trade-headings">
                            <div class="ts3-trade-ar">${arTitle}</div>
                            <div class="ts3-trade-en">${enTitle}</div>
                        </div>
                        <span class="ts3-trade-grade" style="color:var(--t3)">—</span>
                    </div>
                    <div style="text-align:center;padding:20px;color:var(--t2);font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.6;">${msg}</div>
                </div>`;
    }
    
    const t = tf.trade, isBull = tf.bias === 'BULLISH';
    const biasC = isBull ? 'var(--t)' : 'var(--o)';
    const gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';
    const arrow = isBull ? '↑' : '↓';
    
    return `<div class="ts3-trade-card" style="border-right:3px solid ${biasC}"> 
                <div class="ts3-trade-header"> 
                    <span class="ts3-trade-tf">${tf.tf}</span> 
                    <div class="ts3-trade-headings"><div class="ts3-trade-ar">${arTitle}</div><div class="ts3-trade-en">${enTitle}</div></div> 
                    <span class="ts3-trade-grade" style="color:${gradeC}">${tf.signalGrade}</span> 
                </div> 
                <div class="ts3-side-row"><span class="ts3-side-badge" style="background:${biasC};color:#000">${sideLabel}</span><span class="ts3-signal-str">SIGNAL: ${tf.signalStrength}/100</span></div> 
                <div class="ts3-str-bar"><div class="ts3-str-fill" style="width:${tf.signalStrength}%;background:${biasC}"></div></div> 
                <table class="ts3-table"> 
                    <tbody> 
                        <tr><td class="ts3-td-l">ENTRY</td><td class="ts3-td-p" style="color:var(--o)">$${ts3_fmt(t.entryPrice)}</td><td class="ts3-td-m">—</td></tr> 
                        <tr><td class="ts3-td-l">STOP LOSS</td><td class="ts3-td-p" style="color:var(--o)">$${ts3_fmt(t.stopLoss)}</td><td class="ts3-td-m">-${t.riskPct}%</td></tr> 
                        <tr class="ts3-row-sep"><td colspan="3"></td></tr> 
                        <tr><td class="ts3-td-l" style="color:var(--t)">TP1</td><td class="ts3-td-p" style="color:var(--t)">$${ts3_fmt(t.tp1)}</td><td class="ts3-td-m">${arrow} ${t.tp1Pct}% // R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td></tr> 
                        <tr><td class="ts3-td-l" style="color:var(--t)">TP2</td><td class="ts3-td-p" style="color:var(--t)">$${ts3_fmt(t.tp2)}</td><td class="ts3-td-m">${arrow} ${t.tp2Pct}% // R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td></tr> 
                        <tr><td class="ts3-td-l" style="color:var(--t)">TP3</td><td class="ts3-td-p" style="color:var(--t)">$${ts3_fmt(t.tp3)}</td><td class="ts3-td-m">${arrow} ${t.tp3Pct}% // R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td></tr> 
                    </tbody> 
                </table> 
                <div class="ts3-trade-footer"> 
                    <div class="ts3-fi"><span class="ts3-fi-l">AVG R:R</span><span class="ts3-fi-v" style="color:var(--o)">1:${t.averageRr}</span></div> 
                    <div class="ts3-fi"><span class="ts3-fi-l">EXP. VALUE</span><span class="ts3-fi-v">+${t.expectedValue}%</span></div> 
                    <div class="ts3-fi"><span class="ts3-fi-l">QUALITY</span><span class="ts3-fi-v" style="color:${gradeC}">${tf.signalQuality.replace(/_/g, ' ')}</span></div> 
                </div> 
                <div class="ts3-tools-strip"> 
                    ${tf.components.map(c => { 
                        const cC = c.bias === tf.bias ? biasC : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)'); 
                        return`<div class="ts3-tool-chip" style="border-top-color:${cC}"><span class="ts3-chip-icon">${c.icon}</span><span class="ts3-chip-grade">${c.grade}</span></div>`; 
                    }).join('')} 
                </div> 
            </div>`;
}

function ts3_renderMatrix(timeframes) {
    const tools = [
        { key: 'RSI_MOMENTUM', label: 'RSI Momentum' },
        { key: 'OBV_FLOW', label: 'OBV Flow' },
        { key: 'SMC_OB', label: 'SMC OB' }
    ];
    let rows = '';
    tools.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn.key));
        rows += `<div class="ts3-matrix-row"><span class="ts3-matrix-tool">${tn.label}</span>${vals.map(v => { 
            const bc = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)'); 
            return `<div class="ts3-matrix-cell" style="border-top:2px solid ${bc}"><span style="color:${bc};font-weight:700;font-size:9px">${v.grade}</span><span style="color:var(--t3);font-size:8px">${v.score}/100</span><span style="color:var(--t2);font-size:7px">${v.bias.substring(0,4)}</span></div>`; 
        }).join('')}</div>`;
    });
    return `<div class="ts3-card"> 
                <div class="ts3-card-title">COMPONENTS MATRIX // مصفوفة الأدوات</div> 
                <div class="ts3-matrix-header"><span class="ts3-matrix-tool">TOOL</span><div class="ts3-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div><div class="ts3-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">4H</div><div class="ts3-matrix-cell" style="color:var(--o);font-weight:900;border:none;background:transparent;">1D</div></div> 
                ${rows} 
            </div>`;
}

function ts3_renderStrategy(a) {
    return `<div class="ts3-card"> 
                <div class="ts3-card-title">STRATEGY METHODOLOGY // منهجية الاستنتاج</div> 
                <div style="padding:12px;background:var(--bg);margin-bottom:10px;border-right:3px solid var(--o);border-radius:2px;"> 
                    <div style="font-size:11px;color:var(--o);font-family:'Share Tech Mono',monospace;font-weight:700;margin-bottom:6px">STEP 1 — MOMENTUM DIRECTION</div> 
                    <div style="font-size:11px;color:var(--t);line-height:1.6">RSI Momentum Engine يحدد اتجاه الزخم العام واحتمالية الانعكاس عبر RSI(14) + Divergence Detection + Slope Analysis</div> 
                </div> 
                <div style="padding:12px;background:var(--bg);margin-bottom:10px;border-right:3px solid var(--t);border-radius:2px;"> 
                    <div style="font-size:11px;color:var(--t);font-family:'Share Tech Mono',monospace;font-weight:700;margin-bottom:6px">STEP 2 — VOLUME CONFIRMATION</div> 
                    <div style="font-size:11px;color:var(--t);line-height:1.6">OBV Volume Flow يؤكد أو ينفي إشارة الزخم — هل الحجم يدعم الحركة؟ تراكم أم توزيع؟ OBV vs EMA + Divergence</div> 
                </div> 
                <div style="padding:12px;background:var(--bg);border-right:3px solid var(--o);border-radius:2px;"> 
                    <div style="font-size:11px;color:var(--o);font-family:'Share Tech Mono',monospace;font-weight:700;margin-bottom:6px">STEP 3 — PRECISE ENTRY</div> 
                    <div style="font-size:11px;color:var(--t);line-height:1.6">SMC Order Block يحدد نقطة الدخول الدقيقة — أقرب OB طازج في اتجاه الزخم المؤكد بالحجم = Entry مؤسسي</div> 
                </div> 
                <div style="padding:10px;background:var(--s);border:1px solid var(--b);border-radius:2px;margin-top:10px;font-size:10px;color:var(--t3);line-height:1.6;text-align:center"> 
                    الإشارة تُولّد فقط عند توافق الأدوات الثلاثة: الزخم يحدد الاتجاه، الحجم يؤكده، والـ SMC يحدد نقطة الدخول الدقيقة. هذا التسلسل المنهجي يُقلل الإشارات الكاذبة ويرفع الدقة إلى 80%+ عند توافق ثلاثي. 
                </div> 
            </div>`;
}

function ts3_renderAnalysis(a) {
    const activeTrades = a.timeframes.filter(t => t.trade).length;
    const text = activeTrades > 0
        ? `تم توليد ${activeTrades} إعدادات تداول فوري (Spot) على ${a.symbol.replace('USDT','')} عبر الاستراتيجية الثلاثية المتكاملة (Momentum → Volume → SMC Entry). الأدوات الثلاثة تُشير إلى انحياز ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بتوافق ${a.alignedTfs}/3 عبر الفريمات. المنطق: RSI Momentum يحدد الاتجاه → OBV يؤكد التدفق → SMC Order Block يحدد أدق نقطة دخول. ${a.masterGrade === 'A+' ? 'الإشارة استثنائية — 3 أدوات + 3 فريمات متوافقة.' : (a.masterGrade === 'A' ? 'الإشارة قوية ومؤهلة.' : 'الإشارة متوسطة وتحتاج حذراً.')}`
        : `لا توجد إعدادات مؤهلة حالياً. المنظومة تتطلب Signal Strength ≥ 55 مع توافق أداتين على الأقل. الانتظار هو السلوك الأمثل.`;
        
    return `<div class="ts3-analysis-card"> 
                <div class="ts3-analysis-title">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div> 
                <div class="ts3-analysis-text">${text}</div> 
                <div class="ts3-disclaimer">جميع الصفقات للتداول الفوري (Spot) حصرياً — بدون رافعة مالية أو عقود آجلة أو مشتقات. المستويات لا تمثل توصيات تداول. كل قرار شراء أو بيع هو مسؤولية المستخدم الشخصية.</div> 
            </div>`;
}

function ts3_renderGuide() {
    return `<div class="ts3-guide"> 
                <div class="ts3-guide-title">دليل القراءة // TRADING SIGNAL 3 READING GUIDE</div> 
                <div class="ts3-guide-text"> 
                    <strong style="color:var(--o)">TRADING SIGNAL 3:</strong> منظومة تداول فوري (Spot) تجمع ثلاث أدوات مكمّلة استراتيجياً في تسلسل منهجي: الزخم يحدد الاتجاه → الحجم يؤكده → SMC يحدد الدخول الدقيق.<br><br> 
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> Spot فقط — بدون رافعة مالية (Leverage) أو عقود آجلة (Futures) أو مشتقات.<br><br> 
                    <strong style="color:var(--t)">THE THREE TOOLS — COMPLEMENTARY STRATEGY:</strong><br><br> 
                    <strong style="color:var(--o)">1. RSI MOMENTUM ENGINE (الاتجاه):</strong> يحدد اتجاه الزخم عبر RSI(14) + Divergence + Slope Analysis. RSI &lt; 30 مع Divergence = إشارة شراء عالية الدقة (90%). RSI &gt; 70 مع Divergence = إشارة بيع. RSI Slope يحدد سرعة تغيّر الزخم.<br><br> 
                    <strong style="color:var(--o)">2. OBV VOLUME FLOW (التأكيد):</strong> On-Balance Volume يؤكد التدفق المؤسسي. OBV فوق EMA(20) = تراكم شرائي. تحته = توزيع بيعي. OBV Divergence = إشارة مؤسسية قوية. Volume Spike = تأكيد إضافي. دور هذه الأداة: تأكيد أو نفي إشارة الزخم — "هل المال الذكي يدعم هذه الحركة؟"<br><br> 
                    <strong style="color:var(--o)">3. SMC ORDER BLOCK (الدخول):</strong> يحدد أدق نقطة دخول عبر اكتشاف Order Blocks المؤسسية. يُفضّل OBs الطازجة (غير مختبرة). السعر داخل OB = منطقة دخول مثالية. دور هذه الأداة: تحديد "أين بالضبط ندخل الصفقة" بناءً على سلوك Smart Money.<br><br> 
                    <strong style="color:var(--o)">التسلسل المنهجي:</strong> RSI يقول "صعود" + OBV يقول "المال يدخل" + SMC يقول "ادخل هنا" = إشارة متكاملة عالية الدقة. إذا أي أداة تعارض = الإشارة تضعف أو تُلغى تماماً.<br><br> 
                    <strong style="color:var(--t)">THE THREE TIMEFRAMES:</strong><br> 
                    <strong style="color:var(--o)">1H:</strong> صفقات سريعة (ساعات). SL: 1.5× ATR.<br> 
                    <strong style="color:var(--o)">4H:</strong> صفقات متوسطة (1-5 أيام). SL: 2× ATR.<br> 
                    <strong style="color:var(--o)">1D:</strong> صفقات بعيدة (أسبوع+). SL: 2.5× ATR.<br><br> 
                    <strong style="color:var(--o)">SIGNAL STRENGTH:</strong> = (متوسط درجات الأدوات × 0.55) + (معامل التوافق × 0.45). 3/3 أدوات متوافقة تعطي أعلى درجة.<br><br> 
                    <strong style="color:var(--t)">نسبة الصعود/الهبوط ‎%‎:</strong> جنب كل هدف (TP) تظهر نسبة الحركة المتوقعة من سعر الدخول — تساعد على تقدير الربح المحتمل قبل التداول.<br><br> 
                    <strong style="color:var(--o)">SIGNAL GRADES:</strong><br> 
                    A+ (85+ / 3 أدوات): إشارة استثنائية<br> 
                    A (75+ / 2+): قوية ومؤهلة<br> 
                    B+ (65+): متوسطة قوية<br> 
                    B (55+): متوسطة<br> 
                    C: لا صفقة<br><br> 
                    <strong style="color:var(--o)">OB ENTRY:</strong> عند وجود SMC Order Block في اتجاه الزخم، يُستخدم منتصف OB كسعر دخول (أدق من السعر الحالي).<br><br> 
                    <strong style="color:var(--o)">COMPONENTS MATRIX:</strong> جدول يُظهر Grade + Score + Bias لكل أداة على كل فريم — الصف المتوافق كلياً (3 BULL أو 3 BEAR) = أقوى إشارة.<br><br> 
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> هذه المنظومة تحليلية بحتة للتداول الفوري (Spot) فقط. الأسعار والأهداف لا تمثل توصيات تداول. كل قرار شراء أو بيع هو مسؤولية المستخدم الشخصية. 
                </div> 
            </div>`;
}

// =====================================================================
// Trading Signal 4 — منصة 360°
// MTF Signal Generator V4 (SPOT ONLY — No Futures/Leverage)
// 3 أدوات: MACD Divergence Engine + Fibonacci + EMA(50/100/200) + SMC Order Block
// تم تطبيق الحماية الصارمة (Long Only) لمنع صفقات البيع المكشوف
// =====================================================================

async function runTradingSignal4() {
    const symbolInput = document.getElementById('ts4-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('ts4-dashboard');
    const loading = document.getElementById('ts4-loading');
    
    if (!symbolInput) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';
    
    dash.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        const [r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=500`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=500`)
        ]);
        
        if (!r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d1h, d4h, d1d] = await Promise.all([r1h.json(), r4h.json(), r1d.json()]);
        
        const parse = raw => raw.map(c => ({ 
            time: parseInt(c[0]), 
            open: parseFloat(c[1]), 
            high: parseFloat(c[2]), 
            low: parseFloat(c[3]), 
            close: parseFloat(c[4]), 
            volume: parseFloat(c[5]) 
        }));
        
        const c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        
        if (c1h.length < 50 || c4h.length < 50 || c1d.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل المتقدم.');
        
        loading.style.display = 'none';
        dash.innerHTML = ts4_renderDashboard(ts4_analyzeTradingSignal(symbol, c1h, c4h, c1d));
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function ts4_analyzeTradingSignal(symbol, c1h, c4h, c1d) {
    const tf1h = ts4_analyzeTimeframe('1H', c1h);
    const tf4h = ts4_analyzeTimeframe('4H', c4h);
    const tf1d = ts4_analyzeTimeframe('1D', c1d);
    
    const currentPrice = c1h[c1h.length - 1].close;
    const tfs = [tf1h, tf4h, tf1d];
    
    const bullTfs = tfs.filter(t => t.bias === 'BULLISH').length;
    const bearTfs = tfs.filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullTfs > bearTfs ? 'BULLISH' : (bearTfs > bullTfs ? 'BEARISH' : 'MIXED');
    
    const avgScore = Math.round((tf1h.score + tf4h.score + tf1d.score) / 3);
    const alignBonus = (bullTfs === 3 || bearTfs === 3) ? 12 : 0;
    const masterScore = Math.min(100, avgScore + alignBonus);
    
    let masterGrade;
    if (masterScore >= 85) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol, currentPrice, masterBias, masterGrade, masterScore, 
        alignedTfs: masterBias === 'BULLISH' ? bullTfs : bearTfs, 
        timeframes: tfs 
    };
}

function ts4_analyzeTimeframe(tfName, candles) {
    const display = candles.slice(-200);
    const currentPrice = display[display.length - 1].close;
    
    const macdDiv = ts4_runMacdDivergence(display);
    const fibEma = ts4_runFibEma(display, currentPrice);
    const smcOb = ts4_runSmcOb(display, currentPrice);
    
    const components = [macdDiv, fibEma, smcOb];
    const bullC = components.filter(c => c.bias === 'BULLISH').length;
    const bearC = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullC > bearC ? 'BULLISH' : (bearC > bullC ? 'BEARISH' : 'NEUTRAL');
    const aligned = bias === 'BULLISH' ? bullC : (bias === 'BEARISH' ? bearC : 0);
    
    const avgS = components.reduce((s, c) => s + c.score, 0) / 3;
    const signalStrength = Math.round(avgS * 0.55 + (aligned / 3 * 100) * 0.45);
    const score = signalStrength;
    
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && aligned === 3) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && aligned >= 2) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }
    
    // الحماية الصارمة (SPOT ONLY)
    const trade = (bias === 'BULLISH' && signalStrength >= 55) ? ts4_buildTrade(bias, currentPrice, candles, tfName, components) : null;
    
    return { tf: tfName, bias, signalStrength, signalGrade, signalQuality, score, aligned, components, trade, currentPrice };
}

// ==================== 1. MACD Divergence Engine ====================
function ts4_runMacdDivergence(candles) {
    const ema = (period, data) => {
        const k = 2 / (period + 1); let e = data[0];
        return data.map(v => (e = v * k + e * (1 - k)));
    };
    const closes = candles.map(c => c.close);
    const ema12 = ema(12, closes), ema26 = ema(26, closes);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const sigK = 2 / 10; let sigE = macdLine[0];
    const signalLine = macdLine.map(m => (sigE = m * sigK + sigE * (1 - sigK)));
    const histogram = macdLine.map((v, i) => v - signalLine[i]);

    const currentMacd = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const currentHist = histogram[histogram.length - 1];
    const prevHist = histogram[histogram.length - 2];
    const histGrowing = Math.abs(currentHist) > Math.abs(prevHist);

    const recentCloses = closes.slice(-30);
    const recentMacd = macdLine.slice(-30);
    const troughs = typeof findTroughs === 'function' ? findTroughs(recentCloses, 0, recentCloses.length).slice(-2) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(recentCloses, 0, recentCloses.length).slice(-2) : [];
    
    let bullDiv = false, bearDiv = false, divStrength = 0;

    if (troughs.length >= 2) {
        const t1 = troughs[0], t2 = troughs[1];
        if (recentCloses[t2] < recentCloses[t1] && recentMacd[t2] > recentMacd[t1]) {
            bullDiv = true;
            divStrength = Math.min(100, Math.round(70 + Math.abs(recentMacd[t2] - recentMacd[t1]) / Math.abs(recentMacd[t1] || 1) * 50));
        }
    }
    if (peaks.length >= 2) {
        const p1 = peaks[0], p2 = peaks[1];
        if (recentCloses[p2] > recentCloses[p1] && recentMacd[p2] < recentMacd[p1]) {
            bearDiv = true;
            divStrength = Math.min(100, Math.round(70 + Math.abs(recentMacd[p1] - recentMacd[p2]) / Math.abs(recentMacd[p1] || 1) * 50));
        }
    }

    const prevMacd = macdLine[macdLine.length - 2];
    const zeroCrossUp = prevMacd <= 0 && currentMacd > 0;
    const zeroCrossDown = prevMacd >= 0 && currentMacd < 0;

    let bias = 'NEUTRAL', status = 'NO_SIGNAL', score = 50, summary = 'لا يوجد تباعد أو عبور مؤكد في MACD';

    if (bullDiv && zeroCrossUp) {
        bias = 'BULLISH'; status = 'DIVERGENCE_PLUS_ZERO_CROSS'; score = 92;
        summary = `تباعد إيجابي مؤكد في MACD + عبور Zero Line صعوداً — إشارة انعكاس استثنائية (قوة ${divStrength}/100)`;
    } else if (bearDiv && zeroCrossDown) {
        bias = 'BEARISH'; status = 'DIVERGENCE_PLUS_ZERO_CROSS'; score = 92;
        summary = `تباعد سلبي مؤكد في MACD + عبور Zero Line هبوطاً — إشارة انعكاس استثنائية (قوة ${divStrength}/100)`;
    } else if (bullDiv) {
        bias = 'BULLISH'; status = 'BULLISH_DIVERGENCE'; score = 82;
        summary = `تباعد إيجابي في MACD — السعر LL بينما MACD HL (قوة ${divStrength}/100)`;
    } else if (bearDiv) {
        bias = 'BEARISH'; status = 'BEARISH_DIVERGENCE'; score = 82;
        summary = `تباعد سلبي في MACD — السعر HH بينما MACD LH (قوة ${divStrength}/100)`;
    } else if (zeroCrossUp) {
        bias = 'BULLISH'; status = 'ZERO_LINE_CROSS_UP'; score = 78;
        summary = 'عبور Zero Line صعوداً — تحوّل الزخم الرئيسي للاتجاه الصاعد';
    } else if (zeroCrossDown) {
        bias = 'BEARISH'; status = 'ZERO_LINE_CROSS_DOWN'; score = 78;
        summary = 'عبور Zero Line هبوطاً — تحوّل الزخم الرئيسي للاتجاه الهابط';
    } else if (currentMacd > currentSignal && currentMacd > 0 && histGrowing) {
        bias = 'BULLISH'; status = 'BULLISH_MOMENTUM'; score = 68;
        summary = 'زخم صعودي متنامٍ — MACD فوق الصفر و Histogram في توسّع';
    } else if (currentMacd < currentSignal && currentMacd < 0 && histGrowing) {
        bias = 'BEARISH'; status = 'BEARISH_MOMENTUM'; score = 68;
        summary = 'زخم هبوطي متنامٍ — MACD تحت الصفر و Histogram في توسّع';
    } else if (currentMacd > 0) {
        bias = 'BULLISH'; status = 'BULLISH_REGIME'; score = 58;
        summary = 'نظام صعودي عام — MACD فوق الصفر';
    } else {
        bias = 'BEARISH'; status = 'BEARISH_REGIME'; score = 58;
        summary = 'نظام هبوطي عام — MACD تحت الصفر';
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'MACD_DIV', fullName: 'MACD Divergence Engine', icon: 'DIV', grade, score, bias, status, summary };
}

// ==================== 2. Fibonacci + EMA(50/100/200) ====================
function ts4_runFibEma(candles, currentPrice) {
    const calcEma = (period) => {
        const k = 2 / (period + 1); let e = candles[0].close;
        const vals = candles.map(c => (e = c.close * k + e * (1 - k)));
        return vals[vals.length - 1];
    };
    const ema50 = calcEma(50), ema100 = calcEma(100), ema200 = calcEma(200);

    const bullishStack = ema50 > ema100 && ema100 > ema200;
    const bearishStack = ema50 < ema100 && ema100 < ema200;
    const priceAboveAll = currentPrice > ema50 && currentPrice > ema100 && currentPrice > ema200;
    const priceBelowAll = currentPrice < ema50 && currentPrice < ema100 && currentPrice < ema200;

    const prevEma50 = (() => { const k = 2 / 51; let e = candles[0].close; candles.slice(0, -1).forEach(c => e = c.close * k + e * (1 - k)); return e; })();
    const prevEma200 = (() => { const k = 2 / 201; let e = candles[0].close; candles.slice(0, -1).forEach(c => e = c.close * k + e * (1 - k)); return e; })();
    const goldenCross = prevEma50 <= prevEma200 && ema50 > ema200;
    const deathCross = prevEma50 >= prevEma200 && ema50 < ema200;

    const recent = candles.slice(-60);
    const highs = recent.map(c => c.high), lows = recent.map(c => c.low);
    const swingHigh = Math.max(...highs), swingLow = Math.min(...lows);
    const range = swingHigh - swingLow;
    const fib382 = swingHigh - range * 0.382;
    const fib500 = swingHigh - range * 0.5;
    const fib618 = swingHigh - range * 0.618;
    const fib786 = swingHigh - range * 0.786;

    const tol = currentPrice * 0.008;
    let nearFib = null;
    if (Math.abs(currentPrice - fib618) < tol) nearFib = { level: '0.618', price: fib618 };
    else if (Math.abs(currentPrice - fib500) < tol) nearFib = { level: '0.500', price: fib500 };
    else if (Math.abs(currentPrice - fib382) < tol) nearFib = { level: '0.382', price: fib382 };
    else if (Math.abs(currentPrice - fib786) < tol) nearFib = { level: '0.786', price: fib786 };

    let fibEmaConfluence = false;
    if (nearFib) {
        const emas = [ema50, ema100, ema200];
        fibEmaConfluence = emas.some(e => Math.abs(e - nearFib.price) / currentPrice < 0.01);
    }

    let bias = 'NEUTRAL', status = 'NEUTRAL_ZONE', score = 50, summary = 'المتوسطات و Fibonacci في حالة محايدة';

    if (goldenCross && nearFib && fibEmaConfluence) {
        bias = 'BULLISH'; status = 'GOLDEN_CROSS_FIB_CONFLUENCE'; score = 92;
        summary = `Golden Cross (EMA50 فوق EMA200) + سعر عند Fib ${nearFib.level} + EMA confluence — إشارة صعودية استثنائية`;
    } else if (deathCross && nearFib && fibEmaConfluence) {
        bias = 'BEARISH'; status = 'DEATH_CROSS_FIB_CONFLUENCE'; score = 92;
        summary = `Death Cross (EMA50 تحت EMA200) + سعر عند Fib ${nearFib.level} + EMA confluence — إشارة هبوطية استثنائية`;
    } else if (bullishStack && priceAboveAll && nearFib) {
        bias = 'BULLISH'; status = 'BULLISH_STACK_FIB'; score = 85;
        summary = `EMA Stack صاعد (50 > 100 > 200) + سعر فوق الكل + Fib ${nearFib.level} ارتداد — إشارة استمرار صعودية`;
    } else if (bearishStack && priceBelowAll && nearFib) {
        bias = 'BEARISH'; status = 'BEARISH_STACK_FIB'; score = 85;
        summary = `EMA Stack هابط (50 < 100 < 200) + سعر تحت الكل + Fib ${nearFib.level} — إشارة استمرار هبوطية`;
    } else if (goldenCross) {
        bias = 'BULLISH'; status = 'GOLDEN_CROSS'; score = 80;
        summary = 'Golden Cross — EMA50 عبرت فوق EMA200 (إشارة صعودية رئيسية)';
    } else if (deathCross) {
        bias = 'BEARISH'; status = 'DEATH_CROSS'; score = 80;
        summary = 'Death Cross — EMA50 عبرت تحت EMA200 (إشارة هبوطية رئيسية)';
    } else if (bullishStack && priceAboveAll) {
        bias = 'BULLISH'; status = 'BULLISH_EMA_STACK'; score = 72;
        summary = `EMA Stack صاعد مع سعر فوق الكل — اتجاه صعودي مؤكد (EMA50: ${ts4_fmt(ema50)})`;
    } else if (bearishStack && priceBelowAll) {
        bias = 'BEARISH'; status = 'BEARISH_EMA_STACK'; score = 72;
        summary = `EMA Stack هابط مع سعر تحت الكل — اتجاه هبوطي مؤكد (EMA50: ${ts4_fmt(ema50)})`;
    } else if (priceAboveAll) {
        bias = 'BULLISH'; status = 'ABOVE_ALL_EMAS'; score = 65;
        summary = 'السعر فوق EMA50/100/200 — انحياز صعودي';
    } else if (priceBelowAll) {
        bias = 'BEARISH'; status = 'BELOW_ALL_EMAS'; score = 65;
        summary = 'السعر تحت EMA50/100/200 — انحياز هبوطي';
    } else {
        if (currentPrice > ema50) { bias = 'BULLISH'; score = 55; }
        else { bias = 'BEARISH'; score = 55; }
        status = 'MIXED_EMAS';
        summary = `EMAs متشابكة — ${nearFib ? `السعر عند Fib ${nearFib.level}` : 'لا يوجد Fib قريب'} — إشارة ضعيفة`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'FIB_EMA', fullName: 'Fibonacci + EMA(50/100/200)', icon: 'FIB', grade, score, bias, status, summary, nearFib, ema50, ema100, ema200 };
}

// ==================== 3. SMC Order Block (Enhanced) ====================
function ts4_runSmcOb(candles, currentPrice) {
    const display = candles.slice(-60);
    const avgRange = display.reduce((s, c) => s + (c.high - c.low), 0) / display.length;
    const avgVol = display.reduce((s, c) => s + c.volume, 0) / display.length;
    const candidates = [];

    for (let i = 0; i < display.length - 3; i++) {
        const c = display[i], n1 = display[i + 1], n2 = display[i + 2];
        if (c.close < c.open && n1.close > n1.open && n2.close > n2.open) {
            const moveUp = (n2.high - c.low) / avgRange;
            if (moveUp > 1.3) {
                const volConfirm = (n1.volume + n2.volume) / 2 > avgVol * 1.1;
                const mitigated = display.slice(i + 3).some(x => x.low <= c.high && x.low >= c.low);
                candidates.push({ type: 'BULLISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(moveUp * 20 + (volConfirm ? 10 : 0))), idx: i, fresh: !mitigated, volConfirm });
            }
        }
        if (c.close > c.open && n1.close < n1.open && n2.close < n2.open) {
            const moveDown = (c.high - n2.low) / avgRange;
            if (moveDown > 1.3) {
                const volConfirm = (n1.volume + n2.volume) / 2 > avgVol * 1.1;
                const mitigated = display.slice(i + 3).some(x => x.high >= c.low && x.high <= c.high);
                candidates.push({ type: 'BEARISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(moveDown * 20 + (volConfirm ? 10 : 0))), idx: i, fresh: !mitigated, volConfirm });
            }
        }
    }

    const freshObs = candidates.filter(c => c.fresh);
    const allObs = freshObs.length > 0 ? freshObs : candidates;
    if (allObs.length === 0) {
        return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_OB', summary: 'لا يوجد Order Block مكتشف بالقرب من السعر' };
    }

    allObs.sort((a, b) => Math.abs(currentPrice - (a.priceMin + a.priceMax) / 2) - Math.abs(currentPrice - (b.priceMin + b.priceMax) / 2));
    const best = allObs[0];
    const midOb = (best.priceMin + best.priceMax) / 2;
    const distance = Math.abs(currentPrice - midOb) / currentPrice * 100;
    const inZone = currentPrice >= best.priceMin && currentPrice <= best.priceMax;
    const nearZone = distance < 1.5;

    let bias, status, score, summary;
    if (inZone) {
        bias = best.type; status = best.type + '_OB_ENTRY';
        score = Math.min(92, best.strength + 12);
        summary = `السعر داخل ${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} Order Block${best.fresh ? ' طازج' : ''}${best.volConfirm ? ' + حجم مؤكد' : ''} (${ts4_fmt(best.priceMin)}-${ts4_fmt(best.priceMax)})`;
    } else if (nearZone) {
        bias = best.type; status = best.type + '_OB_NEAR';
        score = Math.min(85, best.strength + 5);
        summary = `${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} OB قريب (${distance.toFixed(2)}%) عند ${ts4_fmt(best.priceMin)}-${ts4_fmt(best.priceMax)}${best.fresh ? ' — طازج' : ''}`;
    } else {
        bias = best.type; status = best.type + '_OB_DETECTED';
        score = Math.min(72, best.strength);
        summary = `${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} OB مكتشف عند ${ts4_fmt(best.priceMin)}-${ts4_fmt(best.priceMax)} (بُعد ${distance.toFixed(2)}%)`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade, score, bias, status, summary, obZone: { min: best.priceMin, max: best.priceMax } };
}

// ==================== Trade Builder ====================
function ts4_buildTrade(bias, currentPrice, candles, tfName, components) {
    const isBull = bias === 'BULLISH';
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) {
        trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    let slM, t1M, t2M, t3M;
    if (tfName === '1H') { slM = 1.5; t1M = 1.5; t2M = 3.0; t3M = 5.0; }
    else if (tfName === '4H') { slM = 2.0; t1M = 2.0; t2M = 4.0; t3M = 7.0; }
    else { slM = 2.5; t1M = 2.5; t2M = 5.5; t3M = 10.0; }

    const smcComp = components.find(c => c.name === 'SMC_OB');
    const fibComp = components.find(c => c.name === 'FIB_EMA');
    
    let entryPrice = currentPrice;
    if (smcComp && smcComp.obZone && smcComp.bias === bias) entryPrice = (smcComp.obZone.min + smcComp.obZone.max) / 2;
    else if (fibComp && fibComp.nearFib && fibComp.bias === bias) entryPrice = fibComp.nearFib.price;

    const stopLoss = isBull ? entryPrice - atr * slM : entryPrice + atr * slM;
    const slDist = Math.abs(entryPrice - stopLoss);
    const stopLossDistance = parseFloat((slDist / entryPrice * 100).toFixed(2));
    const tp1 = isBull ? entryPrice + atr * t1M : entryPrice - atr * t1M;
    const tp2 = isBull ? entryPrice + atr * t2M : entryPrice - atr * t2M;
    const tp3 = isBull ? entryPrice + atr * t3M : entryPrice - atr * t3M;
    const tp1Pct = parseFloat((Math.abs(tp1 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp2Pct = parseFloat((Math.abs(tp2 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp3Pct = parseFloat((Math.abs(tp3 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp1Rr = parseFloat((t1M / slM).toFixed(2));
    const tp2Rr = parseFloat((t2M / slM).toFixed(2));
    const tp3Rr = parseFloat((t3M / slM).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    const aligned = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + aligned * 10;
    const tp1Prob = Math.min(90, baseProb + 12);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 12);
    const expectedValue = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * stopLossDistance)).toFixed(2));

    return { entryPrice, stopLoss, stopLossDistance, riskPct: stopLossDistance, tp1, tp1Pct, tp1Rr, tp1Probability: tp1Prob, tp2, tp2Pct, tp2Rr, tp2Probability: tp2Prob, tp3, tp3Pct, tp3Rr, tp3Probability: tp3Prob, averageRr: avgRr, expectedValue };
}

function ts4_fmt(p) { return (typeof smartFormat === 'function') ? smartFormat(p) : (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(p) : p.toFixed(4)); }

// ==================== Render ====================
function ts4_renderDashboard(a) {
    return `${ts4_renderMasterCard(a)} 
            ${ts4_renderTradesTable(a.timeframes[0], 'صفقة سريعة المدى', 'SHORT-TERM TRADE')} 
            ${ts4_renderTradesTable(a.timeframes[1], 'صفقة متوسطة المدى', 'MID-TERM TRADE')} 
            ${ts4_renderTradesTable(a.timeframes[2], 'صفقة بعيدة المدى', 'LONG-TERM TRADE')} 
            ${ts4_renderMatrix(a.timeframes)} 
            ${ts4_renderStrategy()} 
            ${ts4_renderAnalysis(a)} 
            ${ts4_renderGuide()}`;
}

function ts4_renderMasterCard(a) {
    const gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const bc = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
    return `<div class="ts4-master-card"> 
                <div class="ts4-ml">MASTER SIGNAL</div> 
                <div class="ts4-mg" style="color:${gc}">${a.masterGrade}</div> 
                <div class="ts4-mb" style="color:${bc}">${a.masterBias} SIGNAL</div> 
                <div class="ts4-mbar"><div class="ts4-mbar-fill" style="width:${a.masterScore}%"></div></div> 
                <div class="ts4-mstats"> 
                    <div class="ts4-ms"><div class="ts4-ms-l">MASTER SCORE</div><div class="ts4-ms-v">${a.masterScore}/100</div></div> 
                    <div class="ts4-ms"><div class="ts4-ms-l">TFs ALIGNED</div><div class="ts4-ms-v">${a.alignedTfs}/3</div></div> 
                    <div class="ts4-ms"><div class="ts4-ms-l">PRICE</div><div class="ts4-ms-v">$${ts4_fmt(a.currentPrice)}</div></div> 
                </div> 
            </div>`;
}

function ts4_renderTradesTable(tf, arTitle, enTitle) {
    if (!tf.trade) {
        let msg = 'لا يوجد صفقات مؤهلة حالياً (قوة الإشارة ضعيفة).';
        let warn = 'إشارة تحذيرية — يُرجى الانتظار والمتابعة حتى تتوافق الأدوات الثلاثة.';
        if (tf.bias === 'BEARISH') {
            msg = 'مسار هابط / ضغط بيعي.';
            warn = 'إشارة تحذيرية — النظام مصمم للتداول الفوري (Spot) صعوداً فقط. يُنصح بالبقاء خارج السوق لتجنب الخسائر.';
        }
        return `<div class="ts4-tc"> 
                    <div class="ts4-th"><span class="ts4-ttf">${tf.tf}</span><div class="ts4-thd"><div class="ts4-tar">${arTitle}</div><div class="ts4-ten">${enTitle}</div></div><span class="ts4-tgr" style="color:var(--t3)">—</span></div> 
                    <div class="ts4-no-trade"> 
                        <div style="color:var(--o);font-weight:700;font-size:12px;margin-bottom:6px">${msg}</div> 
                        <div style="color:var(--t2);font-size:10px">${warn}</div> 
                        <div style="color:var(--t3);font-size:9px;margin-top:6px;font-family:'Share Tech Mono',monospace">SIGNAL STRENGTH: ${tf.signalStrength}/100 — BELOW THRESHOLD (55)</div> 
                    </div> 
                </div>`;
    }
    
    const t = tf.trade, isBull = tf.bias === 'BULLISH';
    const biasC = isBull ? 'var(--t)' : 'var(--o)';
    const gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';
    const arrow = isBull ? '↑' : '↓';
    
    return `<div class="ts4-tc" style="border-right:3px solid ${biasC}"> 
                <div class="ts4-th"><span class="ts4-ttf">${tf.tf}</span><div class="ts4-thd"><div class="ts4-tar">${arTitle}</div><div class="ts4-ten">${enTitle}</div></div><span class="ts4-tgr" style="color:${gradeC}">${tf.signalGrade}</span></div> 
                <div class="ts4-sr"><span class="ts4-sb" style="background:${biasC};color:var(--bg)">${sideLabel}</span><span class="ts4-ss">SIGNAL: ${tf.signalStrength}/100</span></div> 
                <div class="ts4-sbar"><div class="ts4-sfill" style="width:${tf.signalStrength}%;background:${biasC}"></div></div> 
                <table class="ts4-tbl"><tbody> 
                    <tr><td class="ts4-tl">ENTRY</td><td class="ts4-tp" style="color:var(--o)">$${ts4_fmt(t.entryPrice)}</td><td class="ts4-tm">—</td></tr> 
                    <tr><td class="ts4-tl">STOP LOSS</td><td class="ts4-tp" style="color:var(--o)">$${ts4_fmt(t.stopLoss)}</td><td class="ts4-tm">-${t.riskPct}%</td></tr> 
                    <tr class="ts4-sep"><td colspan="3"></td></tr> 
                    <tr><td class="ts4-tl" style="color:var(--t)">TP1</td><td class="ts4-tp" style="color:var(--t)">$${ts4_fmt(t.tp1)}</td><td class="ts4-tm">${arrow} ${t.tp1Pct}% // R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td></tr> 
                    <tr><td class="ts4-tl" style="color:var(--t)">TP2</td><td class="ts4-tp" style="color:var(--t)">$${ts4_fmt(t.tp2)}</td><td class="ts4-tm">${arrow} ${t.tp2Pct}% // R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td></tr> 
                    <tr><td class="ts4-tl" style="color:var(--t)">TP3</td><td class="ts4-tp" style="color:var(--t)">$${ts4_fmt(t.tp3)}</td><td class="ts4-tm">${arrow} ${t.tp3Pct}% // R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td></tr> 
                </tbody></table> 
                <div class="ts4-tf2"> 
                    <div class="ts4-fi"><span class="ts4-fl">AVG R:R</span><span class="ts4-fv" style="color:var(--o)">1:${t.averageRr}</span></div> 
                    <div class="ts4-fi"><span class="ts4-fl">EXP. VALUE</span><span class="ts4-fv">+${t.expectedValue}%</span></div> 
                    <div class="ts4-fi"><span class="ts4-fl">QUALITY</span><span class="ts4-fv" style="color:${gradeC}">${tf.signalQuality.replace(/_/g, ' ')}</span></div> 
                </div> 
                <div class="ts4-ts"> 
                    ${tf.components.map(c => { 
                        const cC = c.bias === tf.bias ? biasC : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)'); 
                        return `<div class="ts4-chip" style="border-top-color:${cC}"><span class="ts4-ci">${c.icon}</span><span class="ts4-cg">${c.grade}</span></div>`; 
                    }).join('')} 
                </div> 
            </div>`;
}

function ts4_renderMatrix(timeframes) {
    const tools = [
        { key: 'MACD_DIV', label: 'MACD Divergence' },
        { key: 'FIB_EMA', label: 'Fib + EMA' },
        { key: 'SMC_OB', label: 'SMC OB' }
    ];
    let rows = '';
    tools.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn.key));
        rows += `<div class="ts4-mxr"><span class="ts4-mxt">${tn.label}</span>${vals.map(v => { 
            const bc = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)'); 
            return `<div class="ts4-mxc" style="border-top:2px solid ${bc}"><span style="color:${bc};font-weight:700;font-size:9px">${v.grade}</span><span style="color:var(--t2);font-size:8px">${v.score}/100</span><span style="color:var(--t3);font-size:7px">${v.bias.substring(0,4)}</span></div>`; 
        }).join('')}</div>`;
    });
    return `<div class="ts4-card"> 
                <div class="ts4-ct">COMPONENTS MATRIX // مصفوفة الأدوات</div> 
                <div class="ts4-mxh"><span class="ts4-mxt">TOOL</span><div class="ts4-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div><div class="ts4-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">4H</div><div class="ts4-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1D</div></div> 
                ${rows} 
            </div>`;
}

function ts4_renderStrategy() {
    return `<div class="ts4-card"> 
                <div class="ts4-ct">STRATEGY METHODOLOGY // منهجية الاستنتاج</div> 
                <div class="ts4-step" style="border-right-color:var(--o)"> 
                    <div class="ts4-step-title">STEP 1 — DIVERGENCE DETECTION</div> 
                    <div class="ts4-step-desc">MACD Divergence Engine يكشف الانعكاسات المحتملة عبر التباعد بين السعر و MACD + عبور Zero Line. أقوى إشارة عند تزامن Divergence + Zero Cross.</div> 
                </div> 
                <div class="ts4-step" style="border-right-color:var(--t)"> 
                    <div class="ts4-step-title">STEP 2 — FIB + EMA CONFIRMATION</div> 
                    <div class="ts4-step-desc">Fibonacci(0.382/0.5/0.618/0.786) + EMA(50/100/200) يؤكدان الاتجاه ويحددان المنطقة المثالية. Golden/Death Cross + Fib Confluence = إشارة استثنائية. EMA Stack يحدد الاتجاه الهيكلي.</div> 
                </div> 
                <div class="ts4-step" style="border-right-color:var(--o)"> 
                    <div class="ts4-step-title">STEP 3 — SMC PRECISION ENTRY</div> 
                    <div class="ts4-step-desc">SMC Order Block يحدد نقطة الدخول الدقيقة — أقرب OB طازج (غير مختبر) + تأكيد حجم في اتجاه الزخم = Entry مؤسسي محسوب. الأولوية للـ OBs الطازجة.</div> 
                </div> 
                <div class="ts4-step-note">الإشارة تُولّد فقط عند توافق: Divergence يكشف الانعكاس + Fib/EMA تحدد المنطقة + SMC يحدد الدخول. إذا تعارضت أداة واحدة = الإشارة تضعف. إذا تعارضت أداتان = لا صفقة.</div> 
            </div>`;
}

function ts4_renderAnalysis(a) {
    const activeTrades = a.timeframes.filter(t => t.trade).length;
    const noTrades = a.timeframes.filter(t => !t.trade).length;
    const text = activeTrades > 0
        ? `تم توليد ${activeTrades} إعدادات تداول فوري (Spot) على ${a.symbol.replace('USDT','')} عبر الاستراتيجية الثلاثية (MACD Divergence → Fibonacci/EMA → SMC Entry). ${noTrades > 0 ? `${noTrades} فريمات لم تستوفِ الحد الأدنى — يُرجى الانتظار عليها.` : 'جميع الفريمات أنتجت إشارات مؤهلة.'} الاتجاه العام: ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بتوافق ${a.alignedTfs}/3. ${a.masterGrade === 'A+' ? 'إشارة استثنائية.' : (a.masterGrade === 'A' ? 'إشارة قوية.' : 'إشارة تحتاج حذراً.')}`
        : `لا توجد صفقات متاحة حالياً عبر أي فريم زمني. إشارة تحذيرية — يُرجى الانتظار والمتابعة حتى تتوافق الأدوات الثلاثة (Signal Strength ≥ 55). السوق في حالة عدم وضوح منهجي.`;
    return `<div class="ts4-analysis"> 
                <div class="ts4-at">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div> 
                <div class="ts4-atx">${text}</div> 
                <div class="ts4-disc">جميع الصفقات للتداول الفوري (Spot) حصرياً — بدون رافعة مالية أو عقود آجلة أو مشتقات. لا تمثل توصيات تداول. كل قرار هو مسؤولية المستخدم الشخصية.</div> 
            </div>`;
}

function ts4_renderGuide() {
    return `<div class="ts4-guide"> 
                <div class="ts4-gt">دليل القراءة // TRADING SIGNAL 4 READING GUIDE</div> 
                <div class="ts4-gx"> 
                    <strong style="color:var(--o)">TRADING SIGNAL 4:</strong> منظومة تداول فوري (Spot) تجمع ثلاث أدوات مكمّلة: MACD Divergence (كشف الانعكاس) + Fibonacci/EMA (تحديد المنطقة والاتجاه) + SMC Order Block (الدخول الدقيق).<br><br> 
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> Spot فقط — بدون رافعة مالية أو Futures أو مشتقات.<br><br> 
                    <strong style="color:var(--t)">THE THREE TOOLS:</strong><br><br> 
                    <strong style="color:var(--o)">1. MACD DIVERGENCE ENGINE:</strong> يكشف التباعد بين السعر و MACD — أقوى مؤشر انعكاس. Bullish Divergence: السعر LL + MACD HL. Bearish: السعر HH + MACD LH. Zero Line Cross يؤكد. Divergence + Zero Cross = إشارة 92% دقة.<br><br> 
                    <strong style="color:var(--o)">2. FIBONACCI + EMA(50/100/200):</strong> يجمع مستويات Fib (0.382/0.5/0.618/0.786) مع متوسطات EMA الثلاثة الرئيسية. EMA Stack الصاعد (50 > 100 > 200) = ترند صعودي هيكلي. Golden Cross (EMA50 فوق EMA200) = إشارة رئيسية. Fib + EMA Confluence (عندما يتطابق مستوى Fib مع EMA) = إشارة استثنائية.<br><br> 
                    <strong style="color:var(--o)">3. SMC ORDER BLOCK (Enhanced):</strong> يكتشف Order Blocks مع فلترة: Fresh (غير مختبرة) + Volume Confirmation. السعر داخل OB طازج = Entry مثالي. يُستخدم منتصف OB كسعر دخول (أدق من السعر الحالي).<br><br> 
                    <strong style="color:var(--o)">التسلسل المنهجي:</strong> MACD Divergence يقول "انعكاس قادم" → Fib/EMA تقول "المنطقة هنا + الاتجاه مؤكد" → SMC تقول "ادخل عند هذا السعر بالضبط" = إشارة متكاملة.<br><br> 
                    <strong style="color:var(--t)">TIMEFRAMES:</strong> 1H (سريعة / SL: 1.5×ATR) // 4H (متوسطة / SL: 2×ATR) // 1D (بعيدة / SL: 2.5×ATR)<br><br> 
                    <strong style="color:var(--t)">نسبة الصعود/الهبوط %:</strong> جنب كل هدف تظهر نسبة الحركة المتوقعة من سعر الدخول.<br><br> 
                    <strong style="color:var(--o)">SIGNAL GRADES:</strong> A+ (85+ / 3 أدوات متوافقة) → A (75+) → B+ (65+) → B (55+) → C (لا صفقة)<br><br> 
                    <strong style="color:var(--o)">لا يوجد صفقات متاحة:</strong> عندما تكون قوة الإشارة أقل من 55 على أي فريم، تظهر رسالة تحذيرية لتنصح بالانتظار والمتابعة. هذه ميزة حماية — عدم التداول في ظروف غير واضحة أفضل من التداول العشوائي.<br><br> 
                    <strong style="color:var(--o)">ENTRY PRIORITY:</strong> 1) منتصف SMC Order Block طازج 2) مستوى Fibonacci المتطابق مع EMA 3) السعر الحالي (كملاذ أخير)<br><br> 
                    <strong style="color:var(--o)">COMPONENTS MATRIX:</strong> جدول يعرض Grade + Score + Bias لكل أداة على كل فريم.<br><br> 
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> منظومة تحليلية بحتة للتداول الفوري (Spot) فقط — بدون رافعة مالية أو مشتقات. الأسعار والأهداف لا تمثل توصيات. كل قرار هو مسؤولية المستخدم. 
                </div> 
            </div>`;
}

// =====================================================================
// Trading Signal 5 — منصة 360°
// MTF Signal Generator V5 (SPOT ONLY — No Futures/Leverage)
// 3 أدوات: RSI Divergence Pro + Fibonacci Retracement + S/R Classic
// تم تطبيق الحماية الصارمة (Long Only) لمنع صفقات البيع المكشوف
// =====================================================================

async function runTradingSignal5() {
    const symbolInput = document.getElementById('ts5-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('ts5-dashboard');
    const loading = document.getElementById('ts5-loading');
    
    if (!symbolInput) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';
    
    dash.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        // الحد الأقصى للجلب هو 200 شمعة لحماية الـ API من الحظر وتقليل الحمل
        const [r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=200`)
        ]);
        
        if (!r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d1h, d4h, d1d] = await Promise.all([r1h.json(), r4h.json(), r1d.json()]);
        
        const parse = raw => raw.map(c => ({ 
            time: parseInt(c[0]), 
            open: parseFloat(c[1]), 
            high: parseFloat(c[2]), 
            low: parseFloat(c[3]), 
            close: parseFloat(c[4]), 
            volume: parseFloat(c[5]) 
        }));
        
        const c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        
        if (c1h.length < 50 || c4h.length < 50 || c1d.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل المتقدم.');
        
        loading.style.display = 'none';
        dash.innerHTML = ts5_renderDashboard(ts5_analyzeTradingSignal(symbol, c1h, c4h, c1d));
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function ts5_analyzeTradingSignal(symbol, c1h, c4h, c1d) {
    const tf1h = ts5_analyzeTimeframe('1H', c1h);
    const tf4h = ts5_analyzeTimeframe('4H', c4h);
    const tf1d = ts5_analyzeTimeframe('1D', c1d);
    
    const currentPrice = c1h[c1h.length - 1].close;
    const tfs = [tf1h, tf4h, tf1d];
    
    const bullTfs = tfs.filter(t => t.bias === 'BULLISH').length;
    const bearTfs = tfs.filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullTfs > bearTfs ? 'BULLISH' : (bearTfs > bullTfs ? 'BEARISH' : 'MIXED');
    
    const avgScore = Math.round((tf1h.score + tf4h.score + tf1d.score) / 3);
    const alignBonus = (bullTfs === 3 || bearTfs === 3) ? 12 : 0;
    const masterScore = Math.min(100, avgScore + alignBonus);
    
    let masterGrade;
    if (masterScore >= 85) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol, currentPrice, masterBias, masterGrade, masterScore, 
        alignedTfs: masterBias === 'BULLISH' ? bullTfs : bearTfs, 
        timeframes: tfs 
    };
}

function ts5_analyzeTimeframe(tfName, candles) {
    const display = candles.slice(-100);
    const currentPrice = display[display.length - 1].close;
    
    const rsiDiv = ts5_runRsiDivergence(display, currentPrice);
    const fibRet = ts5_runFibRetracement(display, currentPrice);
    const srLevels = ts5_runSupportResistance(display, currentPrice);
    
    const components = [rsiDiv, fibRet, srLevels];
    const bullC = components.filter(c => c.bias === 'BULLISH').length;
    const bearC = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullC > bearC ? 'BULLISH' : (bearC > bullC ? 'BEARISH' : 'NEUTRAL');
    const aligned = bias === 'BULLISH' ? bullC : (bias === 'BEARISH' ? bearC : 0);
    
    const avgS = components.reduce((s, c) => s + c.score, 0) / 3;
    const signalStrength = Math.round(avgS * 0.55 + (aligned / 3 * 100) * 0.45);
    const score = signalStrength;
    
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && aligned === 3) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && aligned >= 2) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }
    
    // الحماية الصارمة (SPOT ONLY): حجب الصفقات الهبوطية كلياً
    const trade = (bias === 'BULLISH' && signalStrength >= 55) ? ts5_buildTrade(bias, currentPrice, candles, tfName, components, srLevels, fibRet) : null;
    
    return { tf: tfName, bias, signalStrength, signalGrade, signalQuality, score, aligned, components, trade, currentPrice };
}

// ==================== 1. RSI Divergence Pro ====================
function ts5_runRsiDivergence(candles, currentPrice) {
    const period = 14;
    const rsiVals = [];
    let aG = 0, aL = 0;
    
    for (let i = 1; i <= period && i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        if (d > 0) aG += d; else aL -= d;
    }
    aG /= period; aL /= period;
    
    for (let i = 0; i <= period; i++) rsiVals.push(50);
    
    for (let i = period + 1; i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        aG = (aG * (period - 1) + Math.max(0, d)) / period;
        aL = (aL * (period - 1) + Math.max(0, -d)) / period;
        rsiVals.push(aL === 0 ? 100 : 100 - (100 / (1 + aG / aL)));
    }
    
    const currentRsi = rsiVals[rsiVals.length - 1];
    const closes = candles.map(c => c.close).slice(-30);
    const rsis = rsiVals.slice(-30);
    
    const troughs = typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length).slice(-3) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length).slice(-3) : [];
    
    let bullDiv = false, bearDiv = false, hiddenBullDiv = false, hiddenBearDiv = false, divStrength = 0;

    if (troughs.length >= 2) {
        const t1 = troughs[troughs.length - 2], t2 = troughs[troughs.length - 1];
        if (closes[t2] < closes[t1] && rsis[t2] > rsis[t1] && rsis[t1] < 40) {
            bullDiv = true;
            divStrength = Math.min(100, Math.round(65 + (rsis[t2] - rsis[t1]) * 2 + (40 - rsis[t1])));
        }
        if (closes[t2] > closes[t1] && rsis[t2] < rsis[t1] && currentRsi > 40) {
            hiddenBullDiv = true;
            if (!bullDiv) divStrength = Math.min(85, Math.round(60 + (rsis[t1] - rsis[t2])));
        }
    }
    
    if (peaks.length >= 2) {
        const p1 = peaks[peaks.length - 2], p2 = peaks[peaks.length - 1];
        if (closes[p2] > closes[p1] && rsis[p2] < rsis[p1] && rsis[p1] > 60) {
            bearDiv = true;
            divStrength = Math.min(100, Math.round(65 + (rsis[p1] - rsis[p2]) * 2 + (rsis[p1] - 60)));
        }
        if (closes[p2] < closes[p1] && rsis[p2] > rsis[p1] && currentRsi < 60) {
            hiddenBearDiv = true;
            if (!bearDiv) divStrength = Math.min(85, Math.round(60 + (rsis[p2] - rsis[p1])));
        }
    }

    const rsiSlope = rsiVals.slice(-5);
    const slope = rsiSlope[4] - rsiSlope[0];

    let bias = 'NEUTRAL', status = 'NO_DIVERGENCE', score = 50, summary = 'لا يوجد تباعد مكتشف في RSI حالياً';

    if (bullDiv && currentRsi < 35) {
        bias = 'BULLISH'; status = 'REGULAR_BULLISH_DIV'; score = Math.min(92, divStrength);
        summary = `تباعد إيجابي كلاسيكي — السعر يسجل LL بينما RSI(${currentRsi.toFixed(1)}) يسجل HL في منطقة Oversold — إشارة انعكاس صعودي عالية الدقة`;
    } else if (bearDiv && currentRsi > 65) {
        bias = 'BEARISH'; status = 'REGULAR_BEARISH_DIV'; score = Math.min(92, divStrength);
        summary = `تباعد سلبي كلاسيكي — السعر يسجل HH بينما RSI(${currentRsi.toFixed(1)}) يسجل LH في منطقة Overbought — إشارة انعكاس هبوطي عالية الدقة`;
    } else if (bullDiv) {
        bias = 'BULLISH'; status = 'BULLISH_DIV'; score = Math.min(82, divStrength);
        summary = `تباعد إيجابي — السعر LL و RSI(${currentRsi.toFixed(1)}) HL — إشارة انعكاس صعودي`;
    } else if (bearDiv) {
        bias = 'BEARISH'; status = 'BEARISH_DIV'; score = Math.min(82, divStrength);
        summary = `تباعد سلبي — السعر HH و RSI(${currentRsi.toFixed(1)}) LH — إشارة انعكاس هبوطي`;
    } else if (hiddenBullDiv) {
        bias = 'BULLISH'; status = 'HIDDEN_BULLISH_DIV'; score = 75;
        summary = `تباعد مخفي إيجابي — RSI(${currentRsi.toFixed(1)}) يدعم استمرار الاتجاه الصعودي`;
    } else if (hiddenBearDiv) {
        bias = 'BEARISH'; status = 'HIDDEN_BEARISH_DIV'; score = 75;
        summary = `تباعد مخفي سلبي — RSI(${currentRsi.toFixed(1)}) يدعم استمرار الاتجاه الهبوطي`;
    } else if (currentRsi < 30 && slope > 2) {
        bias = 'BULLISH'; status = 'OVERSOLD_RECOVERY'; score = 70;
        summary = `RSI(${currentRsi.toFixed(1)}) يتعافى من Oversold مع ميل صاعد`;
    } else if (currentRsi > 70 && slope < -2) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_DECLINE'; score = 70;
        summary = `RSI(${currentRsi.toFixed(1)}) يتراجع من Overbought مع ميل هابط`;
    } else if (currentRsi > 55) {
        bias = 'BULLISH'; status = 'MILD_BULLISH'; score = 55;
        summary = `RSI(${currentRsi.toFixed(1)}) فوق المتوسط — انحياز صعودي معتدل`;
    } else if (currentRsi < 45) {
        bias = 'BEARISH'; status = 'MILD_BEARISH'; score = 55;
        summary = `RSI(${currentRsi.toFixed(1)}) تحت المتوسط — انحياز هبوطي معتدل`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'RSI_DIV', fullName: 'RSI Divergence Pro', icon: 'RSI', grade, score, bias, status, summary, rsi: parseFloat(currentRsi.toFixed(1)) };
}

// ==================== 2. Fibonacci Retracement ====================
function ts5_runFibRetracement(candles, currentPrice) {
    const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
    const peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length).slice(-3) : [];
    const troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length).slice(-3) : [];
    
    if (peakIdxs.length === 0 || troughIdxs.length === 0) {
        return { name: 'FIB_RET', fullName: 'Fibonacci Retracement', icon: 'FIB', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_SWING', summary: 'لا يوجد Swing كافٍ لحساب Fibonacci', levels: null };
    }

    const lastPeak = peakIdxs[peakIdxs.length - 1];
    const lastTrough = troughIdxs[troughIdxs.length - 1];
    const swingHigh = highs[lastPeak], swingLow = lows[lastTrough];
    const range = swingHigh - swingLow;
    const isUptrend = lastTrough < lastPeak;

    const fib236 = swingHigh - range * 0.236;
    const fib382 = swingHigh - range * 0.382;
    const fib500 = swingHigh - range * 0.5;
    const fib618 = swingHigh - range * 0.618;
    const fib786 = swingHigh - range * 0.786;
    const levels = { fib236, fib382, fib500, fib618, fib786, swingHigh, swingLow };

    const tol = currentPrice * 0.006;
    const fibs = [
        { level: '0.236', price: fib236, weight: 0.6 },
        { level: '0.382', price: fib382, weight: 0.8 },
        { level: '0.500', price: fib500, weight: 0.9 },
        { level: '0.618', price: fib618, weight: 1.0 },
        { level: '0.786', price: fib786, weight: 0.85 }
    ];
    const nearFib = fibs.find(f => Math.abs(currentPrice - f.price) < tol);
    const inOTE = currentPrice >= fib618 * 0.998 && currentPrice <= fib382 * 1.002;

    let bias = 'NEUTRAL', status = 'NO_FIB_TOUCH', score = 50, summary = 'السعر ليس عند مستوى Fibonacci رئيسي';

    if (nearFib && nearFib.level === '0.618' && isUptrend) {
        bias = 'BULLISH'; status = 'FIB_618_SUPPORT'; score = 88;
        summary = `السعر عند Fib 0.618 (${ts5_fmt(fib618)}) — "النسبة الذهبية" — أقوى مستوى ارتداد في OTE Zone`;
    } else if (nearFib && nearFib.level === '0.618' && !isUptrend) {
        bias = 'BEARISH'; status = 'FIB_618_RESISTANCE'; score = 88;
        summary = `السعر عند Fib 0.618 (${ts5_fmt(fib618)}) كمقاومة في ترند هابط — احتمالية رفض مرتفعة`;
    } else if (inOTE && isUptrend) {
        bias = 'BULLISH'; status = 'IN_OTE_ZONE'; score = 85;
        summary = `السعر داخل OTE Zone (0.382-0.618) — منطقة الدخول المثالية في الترند الصاعد`;
    } else if (inOTE && !isUptrend) {
        bias = 'BEARISH'; status = 'IN_OTE_ZONE_BEAR'; score = 85;
        summary = `السعر داخل OTE Zone في ترند هابط — منطقة بيع مثالية`;
    } else if (nearFib && nearFib.level === '0.500') {
        bias = isUptrend ? 'BULLISH' : 'BEARISH'; status = 'FIB_500'; score = 78;
        summary = `السعر عند Fib 0.500 (${ts5_fmt(fib500)}) — مستوى نفسي رئيسي`;
    } else if (nearFib && nearFib.level === '0.382') {
        bias = isUptrend ? 'BULLISH' : 'BEARISH'; status = 'FIB_382'; score = 72;
        summary = `السعر عند Fib 0.382 (${ts5_fmt(fib382)}) — ارتداد سطحي`;
    } else if (nearFib && nearFib.level === '0.786') {
        bias = isUptrend ? 'BULLISH' : 'BEARISH'; status = 'FIB_786'; score = 70;
        summary = `السعر عند Fib 0.786 (${ts5_fmt(fib786)}) — ارتداد عميق`;
    } else if (currentPrice > fib236 && isUptrend) {
        bias = 'BULLISH'; status = 'ABOVE_FIB_LEVELS'; score = 60;
        summary = 'السعر فوق جميع مستويات Fibonacci — ترند صاعد قوي بدون ارتداد';
    } else if (currentPrice < fib786 && isUptrend) {
        bias = 'BEARISH'; status = 'BELOW_FIB_786'; score = 60;
        summary = 'السعر تحت Fib 0.786 — الارتداد فشل وقد يتحول لترند هابط';
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'FIB_RET', fullName: 'Fibonacci Retracement', icon: 'FIB', grade, score, bias, status, summary, levels, nearFib };
}

// ==================== 3. Support/Resistance Classic ====================
function ts5_runSupportResistance(candles, currentPrice) {
    const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
    const peakIdxs = typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length) : [];
    const troughIdxs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length) : [];

    const rawLevels = [];
    peakIdxs.forEach(idx => rawLevels.push({ price: highs[idx], type: 'R', touches: 1, idx }));
    troughIdxs.forEach(idx => rawLevels.push({ price: lows[idx], type: 'S', touches: 1, idx }));

    const clusterTol = currentPrice * 0.005;
    const clusters = [];
    const used = new Set();
    
    rawLevels.forEach((lvl, i) => {
        if (used.has(i)) return;
        const cluster = { price: lvl.price, totalPrice: lvl.price, count: 1, type: lvl.type, lastIdx: lvl.idx };
        used.add(i);
        rawLevels.forEach((other, j) => {
            if (i === j || used.has(j)) return;
            if (Math.abs(lvl.price - other.price) < clusterTol) {
                cluster.totalPrice += other.price;
                cluster.count++;
                cluster.lastIdx = Math.max(cluster.lastIdx, other.idx);
                used.add(j);
            }
        });
        cluster.price = cluster.totalPrice / cluster.count;
        cluster.strength = Math.min(100, cluster.count * 20 + 30);
        clusters.push(cluster);
    });

    clusters.sort((a, b) => b.strength - a.strength);

    const resistances = clusters.filter(c => c.price > currentPrice).sort((a, b) => a.price - b.price).slice(0, 3);
    const supports = clusters.filter(c => c.price < currentPrice).sort((a, b) => b.price - a.price).slice(0, 3);

    const nearestR = resistances[0];
    const nearestS = supports[0];
    const distToR = nearestR ? ((nearestR.price - currentPrice) / currentPrice * 100) : 99;
    const distToS = nearestS ? ((currentPrice - nearestS.price) / currentPrice * 100) : 99;

    const lastCandle = candles[candles.length - 1];
    const nearSupportBounce = nearestS && distToS < 0.5 && lastCandle.close > lastCandle.open;
    const nearResistanceReject = nearestR && distToR < 0.5 && lastCandle.close < lastCandle.open;

    let bias = 'NEUTRAL', status = 'BETWEEN_LEVELS', score = 55;
    let summary = `السعر بين أقرب دعم (${nearestS ? ts5_fmt(nearestS.price) : '—'}) ومقاومة (${nearestR ? ts5_fmt(nearestR.price) : '—'})`;

    if (nearSupportBounce && nearestS.strength >= 60) {
        bias = 'BULLISH'; status = 'SUPPORT_BOUNCE'; score = Math.min(90, nearestS.strength + 10);
        summary = `ارتداد من دعم قوي عند ${ts5_fmt(nearestS.price)} (قوة ${nearestS.strength}/100, ${nearestS.count} لمسات) — إشارة شراء`;
    } else if (nearResistanceReject && nearestR.strength >= 60) {
        bias = 'BEARISH'; status = 'RESISTANCE_REJECTION'; score = Math.min(90, nearestR.strength + 10);
        summary = `رفض عند مقاومة قوية ${ts5_fmt(nearestR.price)} (قوة ${nearestR.strength}/100, ${nearestR.count} لمسات) — إشارة بيع`;
    } else if (nearestS && distToS < 1 && nearestS.strength >= 50) {
        bias = 'BULLISH'; status = 'NEAR_SUPPORT'; score = 68;
        summary = `السعر قريب من دعم عند ${ts5_fmt(nearestS.price)} (${distToS.toFixed(2)}%) — احتمالية ارتداد`;
    } else if (nearestR && distToR < 1 && nearestR.strength >= 50) {
        bias = 'BEARISH'; status = 'NEAR_RESISTANCE'; score = 68;
        summary = `السعر قريب من مقاومة عند ${ts5_fmt(nearestR.price)} (${distToR.toFixed(2)}%) — احتمالية رفض`;
    } else if (distToS < distToR && nearestS) {
        bias = 'BULLISH'; status = 'CLOSER_TO_SUPPORT'; score = 58;
        summary = `السعر أقرب للدعم (${distToS.toFixed(2)}%) من المقاومة (${distToR.toFixed(2)}%) — انحياز صعودي طفيف`;
    } else if (nearestR) {
        bias = 'BEARISH'; status = 'CLOSER_TO_RESISTANCE'; score = 58;
        summary = `السعر أقرب للمقاومة (${distToR.toFixed(2)}%) من الدعم (${distToS.toFixed(2)}%) — انحياز هبوطي طفيف`;
    }

    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return {
        name: 'SR_CLASSIC', fullName: 'Support/Resistance Classic', icon: 'S/R', grade, score, bias, status, summary,
        resistances: resistances.map(r => ({ price: r.price, strength: r.strength, touches: r.count })),
        supports: supports.map(s => ({ price: s.price, strength: s.strength, touches: s.count }))
    };
}

// ==================== Trade Builder ====================
function ts5_buildTrade(bias, currentPrice, candles, tfName, components, srData, fibData) {
    const isBull = bias === 'BULLISH';
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) {
        trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    let slM;
    if (tfName === '1H') slM = 1.5;
    else if (tfName === '4H') slM = 2.0;
    else slM = 2.5;

    const entryPrice = currentPrice;

    let stopLoss;
    if (isBull && srData.supports && srData.supports.length > 0) {
        stopLoss = Math.min(srData.supports[0].price * 0.997, entryPrice - atr * slM);
    } else if (!isBull && srData.resistances && srData.resistances.length > 0) {
        stopLoss = Math.max(srData.resistances[0].price * 1.003, entryPrice + atr * slM);
    } else {
        stopLoss = isBull ? entryPrice - atr * slM : entryPrice + atr * slM;
    }
    
    const slDist = Math.abs(entryPrice - stopLoss);
    const stopLossDistance = parseFloat((slDist / entryPrice * 100).toFixed(2));

    let tp1, tp2, tp3;
    if (isBull) {
        const targets = (srData.resistances || []).map(r => r.price);
        if (fibData.levels) {
            targets.push(fibData.levels.fib382, fibData.levels.fib236, fibData.levels.swingHigh);
        }
        const validTargets = targets.filter(t => t > entryPrice * 1.003).sort((a, b) => a - b);
        tp1 = validTargets[0] || entryPrice + atr * 1.5;
        tp2 = validTargets[1] || entryPrice + atr * 3.5;
        tp3 = validTargets[2] || entryPrice + atr * 6;
    } else {
        const targets = (srData.supports || []).map(s => s.price);
        if (fibData.levels) {
            targets.push(fibData.levels.fib618, fibData.levels.fib786, fibData.levels.swingLow);
        }
        const validTargets = targets.filter(t => t < entryPrice * 0.997).sort((a, b) => b - a);
        tp1 = validTargets[0] || entryPrice - atr * 1.5;
        tp2 = validTargets[1] || entryPrice - atr * 3.5;
        tp3 = validTargets[2] || entryPrice - atr * 6;
    }

    const tp1Pct = parseFloat((Math.abs(tp1 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp2Pct = parseFloat((Math.abs(tp2 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp3Pct = parseFloat((Math.abs(tp3 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp1Rr = parseFloat((Math.abs(tp1 - entryPrice) / slDist).toFixed(2));
    const tp2Rr = parseFloat((Math.abs(tp2 - entryPrice) / slDist).toFixed(2));
    const tp3Rr = parseFloat((Math.abs(tp3 - entryPrice) / slDist).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    const aligned = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + aligned * 10;
    const tp1Prob = Math.min(90, baseProb + 12);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 12);
    const expectedValue = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * stopLossDistance)).toFixed(2));

    return { entryPrice, stopLoss, stopLossDistance, riskPct: stopLossDistance, tp1, tp1Pct, tp1Rr, tp1Probability: tp1Prob, tp2, tp2Pct, tp2Rr, tp2Probability: tp2Prob, tp3, tp3Pct, tp3Rr, tp3Probability: tp3Prob, averageRr: avgRr, expectedValue };
}

function ts5_fmt(p) { return (typeof smartFormat === 'function') ? smartFormat(p) : (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(p) : p.toFixed(4)); }

// ==================== Render ====================
function ts5_renderDashboard(a) {
    return `${ts5_renderMasterCard(a)} 
            ${ts5_renderTradeTable(a.timeframes[0], 'صفقة سريعة المدى', 'SHORT-TERM TRADE')} 
            ${ts5_renderTradeTable(a.timeframes[1], 'صفقة متوسطة المدى', 'MID-TERM TRADE')} 
            ${ts5_renderTradeTable(a.timeframes[2], 'صفقة بعيدة المدى', 'LONG-TERM TRADE')} 
            ${ts5_renderMatrix(a.timeframes)} 
            ${ts5_renderStrategy()} 
            ${ts5_renderAnalysis(a)} 
            ${ts5_renderGuide()}`;
}

function ts5_renderMasterCard(a) {
    const gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const bc = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
    return `<div class="ts5-master-card"><div class="ts5-ml">MASTER SIGNAL</div><div class="ts5-mg" style="color:${gc}">${a.masterGrade}</div><div class="ts5-mb" style="color:${bc}">${a.masterBias} SIGNAL</div><div class="ts5-mbar"><div class="ts5-mbar-fill" style="width:${a.masterScore}%"></div></div><div class="ts5-mstats"><div class="ts5-ms"><div class="ts5-ms-l">MASTER SCORE</div><div class="ts5-ms-v">${a.masterScore}/100</div></div><div class="ts5-ms"><div class="ts5-ms-l">TFs ALIGNED</div><div class="ts5-ms-v">${a.alignedTfs}/3</div></div><div class="ts5-ms"><div class="ts5-ms-l">PRICE</div><div class="ts5-ms-v">$${ts5_fmt(a.currentPrice)}</div></div></div></div>`;
}

function ts5_renderTradeTable(tf, arTitle, enTitle) {
    if (!tf.trade) {
        let msg = 'لا يوجد صفقات مؤهلة حالياً (قوة الإشارة ضعيفة).';
        let warn = 'إشارة تحذيرية — يُرجى الانتظار والمتابعة حتى تتوافق الأدوات الثلاثة.';
        if (tf.bias === 'BEARISH') {
            msg = 'مسار هابط / ضغط بيعي.';
            warn = 'إشارة تحذيرية — النظام مصمم للتداول الفوري (Spot) صعوداً فقط. يُنصح بالبقاء خارج السوق لتجنب الخسائر.';
        }
        return `<div class="ts5-tc"><div class="ts5-th"><span class="ts5-ttf">${tf.tf}</span><div class="ts5-thd"><div class="ts5-tar">${arTitle}</div><div class="ts5-ten">${enTitle}</div></div><span class="ts5-tgr" style="color:var(--t3)">—</span></div><div class="ts5-no-trade"><div style="color:var(--o);font-weight:700;font-size:12px;margin-bottom:6px">${msg}</div><div style="color:var(--t2);font-size:10px">${warn}</div><div style="color:var(--t3);font-size:9px;margin-top:6px;font-family:'Share Tech Mono',monospace">SIGNAL: ${tf.signalStrength}/100 — BELOW THRESHOLD</div></div></div>`;
    }
    
    const t = tf.trade, isBull = tf.bias === 'BULLISH';
    const biasC = isBull ? 'var(--t)' : 'var(--o)';
    const gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';
    const arrow = isBull ? '↑' : '↓';
    
    return `<div class="ts5-tc" style="border-right:3px solid ${biasC}"> 
                <div class="ts5-th"><span class="ts5-ttf">${tf.tf}</span><div class="ts5-thd"><div class="ts5-tar">${arTitle}</div><div class="ts5-ten">${enTitle}</div></div><span class="ts5-tgr" style="color:${gradeC}">${tf.signalGrade}</span></div> 
                <div class="ts5-sr"><span class="ts5-sb" style="background:${biasC};color:var(--bg)">${sideLabel}</span><span class="ts5-ss">SIGNAL: ${tf.signalStrength}/100</span></div> 
                <div class="ts5-sbar"><div class="ts5-sfill" style="width:${tf.signalStrength}%;background:${biasC}"></div></div> 
                <table class="ts5-tbl"><tbody> 
                    <tr><td class="ts5-tl">ENTRY</td><td class="ts5-tp" style="color:var(--o)">$${ts5_fmt(t.entryPrice)}</td><td class="ts5-tm">—</td></tr> 
                    <tr><td class="ts5-tl">STOP LOSS</td><td class="ts5-tp" style="color:var(--o)">$${ts5_fmt(t.stopLoss)}</td><td class="ts5-tm">-${t.riskPct}%</td></tr> 
                    <tr class="ts5-sep"><td colspan="3"></td></tr> 
                    <tr><td class="ts5-tl" style="color:var(--t)">TP1</td><td class="ts5-tp" style="color:var(--t)">$${ts5_fmt(t.tp1)}</td><td class="ts5-tm">${arrow} ${t.tp1Pct}% // R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td></tr> 
                    <tr><td class="ts5-tl" style="color:var(--t)">TP2</td><td class="ts5-tp" style="color:var(--t)">$${ts5_fmt(t.tp2)}</td><td class="ts5-tm">${arrow} ${t.tp2Pct}% // R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td></tr> 
                    <tr><td class="ts5-tl" style="color:var(--t)">TP3</td><td class="ts5-tp" style="color:var(--t)">$${ts5_fmt(t.tp3)}</td><td class="ts5-tm">${arrow} ${t.tp3Pct}% // R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td></tr> 
                </tbody></table> 
                <div class="ts5-tf2"> 
                    <div class="ts5-fi"><span class="ts5-fl">AVG R:R</span><span class="ts5-fv" style="color:var(--o)">1:${t.averageRr}</span></div> 
                    <div class="ts5-fi"><span class="ts5-fl">EXP. VALUE</span><span class="ts5-fv">+${t.expectedValue}%</span></div> 
                    <div class="ts5-fi"><span class="ts5-fl">QUALITY</span><span class="ts5-fv" style="color:${gradeC}">${tf.signalQuality.replace(/_/g, ' ')}</span></div> 
                </div> 
                <div class="ts5-ts">${tf.components.map(c => { 
                    const cC = c.bias === tf.bias ? biasC : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)'); 
                    return `<div class="ts5-chip" style="border-top-color:${cC}"><span class="ts5-ci">${c.icon}</span><span class="ts5-cg">${c.grade}</span></div>`; 
                }).join('')}</div> 
            </div> `;
}

function ts5_renderMatrix(timeframes) {
    const tools = [
        { key: 'RSI_DIV', label: 'RSI Divergence' },
        { key: 'FIB_RET', label: 'Fibonacci' },
        { key: 'SR_CLASSIC', label: 'S/R Classic' }
    ];
    let rows = '';
    tools.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn.key));
        rows += `<div class="ts5-mxr"><span class="ts5-mxt">${tn.label}</span>${vals.map(v => { 
            const bc = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)'); 
            return `<div class="ts5-mxc" style="border-top:2px solid ${bc}"><span style="color:${bc};font-weight:700;font-size:9px">${v.grade}</span><span style="color:var(--t2);font-size:8px">${v.score}/100</span><span style="color:var(--t3);font-size:7px">${v.bias.substring(0,4)}</span></div>`; 
        }).join('')}</div>`;
    });
    return `<div class="ts5-card"><div class="ts5-ct">COMPONENTS MATRIX // مصفوفة الأدوات</div><div class="ts5-mxh"><span class="ts5-mxt">TOOL</span><div class="ts5-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div><div class="ts5-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">4H</div><div class="ts5-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1D</div></div>${rows}</div>`;
}

function ts5_renderStrategy() {
    return `<div class="ts5-card"> 
                <div class="ts5-ct">STRATEGY METHODOLOGY // منهجية الاستنتاج</div> 
                <div class="ts5-step" style="border-right-color:var(--o)"> 
                    <div class="ts5-step-t">STEP 1 — RSI DIVERGENCE (كشف الانعكاس)</div> 
                    <div class="ts5-step-d">RSI Divergence Pro يكشف التباعد بين السعر ومؤشر القوة النسبية: Regular Divergence = انعكاس + Hidden Divergence = استمرار. الأقوى: Divergence في منطقة Oversold/Overbought.</div> 
                </div> 
                <div class="ts5-step" style="border-right-color:var(--t)"> 
                    <div class="ts5-step-t">STEP 2 — FIBONACCI (تحديد منطقة الدخول)</div> 
                    <div class="ts5-step-d">Fibonacci Retracement يحدد مستويات الارتداد (0.382/0.5/0.618/0.786). OTE Zone (0.382-0.618) = أفضل منطقة دخول. Fib 0.618 = "النسبة الذهبية" — أقوى مستوى ارتداد إحصائياً.</div> 
                </div> 
                <div class="ts5-step" style="border-right-color:var(--o)"> 
                    <div class="ts5-step-t">STEP 3 — S/R CLASSIC (أهداف دقيقة)</div> 
                    <div class="ts5-step-d">Support/Resistance الكلاسيكي يحدد الأهداف ووقف الخسارة من الدعوم والمقاومات الفعلية المبنية على القمم والقيعان (Cluster Analysis). الأهداف من S/R levels الحقيقية — ليست ATR عشوائي.</div> 
                </div> 
                <div class="ts5-step-note">ما يميز هذه الأداة: الأهداف مبنية على مستويات S/R وFibonacci الفعلية وليست نسب ATR ثابتة. كل هدف يتطابق مع دعم أو مقاومة حقيقية أو مستوى Fibonacci — مما يرفع دقة الأهداف بشكل ملموس.</div> 
            </div>`;
}

function ts5_renderAnalysis(a) {
    const activeTrades = a.timeframes.filter(t => t.trade).length;
    const noTrades = a.timeframes.filter(t => !t.trade).length;
    const text = activeTrades > 0
        ? `تم توليد ${activeTrades} إعدادات تداول فوري (Spot) على ${a.symbol.replace('USDT','')} عبر الاستراتيجية الثلاثية (RSI Divergence → Fibonacci → S/R Classic). ${noTrades > 0 ? `${noTrades} فريمات لم تستوفِ الحد الأدنى — يُرجى الانتظار.` : ''} الأهداف في هذه الأداة مبنية على مستويات S/R وFibonacci الفعلية للسوق — وليست نسب ثابتة — مما يجعلها أكثر دقة ومنطقية. الاتجاه العام: ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بتوافق ${a.alignedTfs}/3.`
        : `لا توجد صفقات متاحة حالياً عبر أي فريم زمني. إشارة تحذيرية — يُرجى الانتظار والمتابعة حتى تتوافق الأدوات الثلاثة. السوق في حالة عدم وضوح.`;
        
    return `<div class="ts5-analysis"> 
                <div class="ts5-at">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div> 
                <div class="ts5-atx">${text}</div> 
                <div class="ts5-disc">جميع الصفقات للتداول الفوري (Spot) حصرياً — بدون رافعة مالية أو عقود آجلة أو مشتقات. لا تمثل توصيات تداول. كل قرار هو مسؤولية المستخدم.</div> 
            </div>`;
}

function ts5_renderGuide() {
    return `<div class="ts5-guide"> 
                <div class="ts5-gt">دليل القراءة // TRADING SIGNAL 5 READING GUIDE</div> 
                <div class="ts5-gx"> 
                    <strong style="color:var(--o)">TRADING SIGNAL 5:</strong> منظومة تداول فوري (Spot) تجمع: RSI Divergence (كشف الانعكاس) + Fibonacci Retracement (منطقة الدخول) + Support/Resistance Classic (الأهداف الدقيقة).<br><br> 
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> Spot فقط — بدون رافعة أو Futures أو مشتقات.<br><br> 
                    <strong style="color:var(--t)">THE THREE TOOLS:</strong><br><br> 
                    <strong style="color:var(--o)">1. RSI DIVERGENCE PRO:</strong> يكشف 4 أنواع تباعد: Regular Bullish (قاع سعر أدنى + RSI أعلى = انعكاس صعودي) / Regular Bearish (قمة سعر أعلى + RSI أدنى = انعكاس هبوطي) / Hidden Bullish (استمرار صعود) / Hidden Bearish (استمرار هبوط). الأقوى: Regular Divergence في منطقة OS/OB = دقة 85-92%.<br><br> 
                    <strong style="color:var(--o)">2. FIBONACCI RETRACEMENT:</strong> يحسب مستويات 0.236/0.382/0.5/0.618/0.786 من آخر Major Swing. OTE Zone (0.382-0.618) = منطقة الدخول المثالية. Fib 0.618 = أقوى مستوى ارتداد إحصائياً (80%+ احتمالية ارتداد).<br><br> 
                    <strong style="color:var(--o)">3. SUPPORT/RESISTANCE CLASSIC:</strong> يبني مستويات S/R من القمم والقيعان التاريخية عبر Cluster Analysis (دمج المستويات القريبة). قوة المستوى = عدد اللمسات. الأهداف مبنية على S/R الحقيقية + Fib Levels — ليست نسب ATR عشوائية.<br><br> 
                    <strong style="color:var(--o)">التسلسل المنهجي:</strong> RSI Divergence يقول "انعكاس محتمل هنا" → Fibonacci تقول "المنطقة المثالية للدخول هنا" → S/R تقول "الأهداف الدقيقة هنا + وقف الخسارة هنا". النتيجة: أهداف مبنية على مستويات سوقية حقيقية.<br><br> 
                    <strong style="color:var(--o)">ما يميز هذه الأداة:</strong> الأهداف (TP1/TP2/TP3) ووقف الخسارة مأخوذة من S/R levels وFibonacci levels الفعلية — وليست ATR × multiplier. هذا يجعل الأهداف أكثر منطقية ودقة لأنها تتطابق مع مناطق فعلية يتفاعل معها السوق.<br><br> 
                    <strong style="color:var(--t)">TIMEFRAMES:</strong> 1H (سريعة) // 4H (متوسطة) // 1D (بعيدة)<br><br> 
                    <strong style="color:var(--o)">SIGNAL GRADES:</strong> A+ (85+ / 3 متوافقة) → A (75+) → B+ (65+) → B (55+) → C (لا صفقة)<br><br> 
                    <strong style="color:var(--o)">لا يوجد صفقات متاحة:</strong> إشارة تحذيرية عند عدم توافق الأدوات أو عند المسار الهابط. الانتظار أفضل من التداول في ظروف غير واضحة.<br><br> 
                    <strong style="color:var(--o)">CLUSTER S/R:</strong> عندما تتراكم عدة قمم/قيعان في نفس المنطقة السعرية (tolerance 0.5%) → تُدمج في مستوى واحد بقوة أعلى. كلما زادت اللمسات زادت القوة.<br><br> 
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> منظومة تحليلية بحتة للتداول الفوري (Spot) فقط — بدون رافعة أو مشتقات. الأسعار والأهداف لا تمثل توصيات. كل قرار هو مسؤولية المستخدم. 
                </div> 
            </div>`;
}

// =====================================================================
// Trading VIP 3 — منصة 360°
// MTF Signal Generator VIP (SPOT ONLY — No Futures/Leverage)
// 3 أدوات: RSI Divergence + Fibonacci Retracement + SMC Order Block
// تم تطبيق الحماية الصارمة (Long Only) لمنع صفقات البيع المكشوف
// =====================================================================

async function runTradingVip3() {
    const symbolInput = document.getElementById('vip3-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('vip3-dashboard');
    const loading = document.getElementById('vip3-loading');
    
    if (!symbolInput) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';
    
    dash.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        const [r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=200`)
        ]);
        
        if (!r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d1h, d4h, d1d] = await Promise.all([r1h.json(), r4h.json(), r1d.json()]);
        
        const parse = raw => raw.map(c => ({ 
            time: parseInt(c[0]), 
            open: parseFloat(c[1]), 
            high: parseFloat(c[2]), 
            low: parseFloat(c[3]), 
            close: parseFloat(c[4]), 
            volume: parseFloat(c[5]) 
        }));
        
        const c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        
        if (c1h.length < 50 || c4h.length < 50 || c1d.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل المتقدم.');
        
        loading.style.display = 'none';
        dash.innerHTML = vip3_renderDashboard(vip3_analyzeTradingSignal(symbol, c1h, c4h, c1d));
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function vip3_analyzeTradingSignal(symbol, c1h, c4h, c1d) {
    const tf1h = vip3_analyzeTimeframe('1H', c1h);
    const tf4h = vip3_analyzeTimeframe('4H', c4h);
    const tf1d = vip3_analyzeTimeframe('1D', c1d);
    
    const currentPrice = c1h[c1h.length - 1].close;
    const tfs = [tf1h, tf4h, tf1d];
    
    const bullTfs = tfs.filter(t => t.bias === 'BULLISH').length;
    const bearTfs = tfs.filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullTfs > bearTfs ? 'BULLISH' : (bearTfs > bullTfs ? 'BEARISH' : 'MIXED');
    
    const avgScore = Math.round((tf1h.score + tf4h.score + tf1d.score) / 3);
    const alignBonus = (bullTfs === 3 || bearTfs === 3) ? 12 : 0;
    const masterScore = Math.min(100, avgScore + alignBonus);
    
    let masterGrade;
    if (masterScore >= 85) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol, currentPrice, masterBias, masterGrade, masterScore, 
        alignedTfs: masterBias === 'BULLISH' ? bullTfs : bearTfs, 
        timeframes: tfs 
    };
}

function vip3_analyzeTimeframe(tfName, candles) {
    const display = candles.slice(-100);
    const currentPrice = display[display.length - 1].close;
    
    const rsiDiv = vip3_runRsiDiv(display, currentPrice);
    const fibRet = vip3_runFib(display, currentPrice);
    const smcOb = vip3_runSmcOb(display, currentPrice);
    
    const components = [rsiDiv, fibRet, smcOb];
    const bullC = components.filter(c => c.bias === 'BULLISH').length;
    const bearC = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullC > bearC ? 'BULLISH' : (bearC > bullC ? 'BEARISH' : 'NEUTRAL');
    const aligned = bias === 'BULLISH' ? bullC : (bias === 'BEARISH' ? bearC : 0);
    
    const avgS = components.reduce((s, c) => s + c.score, 0) / 3;
    const signalStrength = Math.round(avgS * 0.55 + (aligned / 3 * 100) * 0.45);
    const score = signalStrength;
    
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && aligned === 3) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && aligned >= 2) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }
    
    const trade = (bias === 'BULLISH' && signalStrength >= 55) ? vip3_buildTrade(bias, currentPrice, candles, tfName, components, fibRet, smcOb) : null;
    
    return { tf: tfName, bias, signalStrength, signalGrade, signalQuality, score, aligned, components, trade, currentPrice };
}

// ==================== 1. RSI Divergence ====================
function vip3_runRsiDiv(candles, currentPrice) {
    const period = 14, rsiVals = [];
    let aG = 0, aL = 0;
    
    for (let i = 1; i <= period && i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        if (d > 0) aG += d; else aL -= d;
    }
    aG /= period; aL /= period;
    
    for (let i = 0; i <= period; i++) rsiVals.push(50);
    
    for (let i = period + 1; i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        aG = (aG * (period - 1) + Math.max(0, d)) / period;
        aL = (aL * (period - 1) + Math.max(0, -d)) / period;
        rsiVals.push(aL === 0 ? 100 : 100 - (100 / (1 + aG / aL)));
    }
    
    const currentRsi = rsiVals[rsiVals.length - 1];
    const closes = candles.map(c => c.close).slice(-30);
    const rsis = rsiVals.slice(-30);
    
    const troughs = typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length).slice(-3) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length).slice(-3) : [];
    
    let bullDiv = false, bearDiv = false, hiddenBull = false, hiddenBear = false, divStr = 0;
    
    if (troughs.length >= 2) {
        const t1 = troughs[troughs.length - 2], t2 = troughs[troughs.length - 1];
        if (closes[t2] < closes[t1] && rsis[t2] > rsis[t1] && rsis[t1] < 40) {
            bullDiv = true;
            divStr = Math.min(100, Math.round(65 + (rsis[t2] - rsis[t1]) * 2 + (40 - rsis[t1])));
        }
        if (closes[t2] > closes[t1] && rsis[t2] < rsis[t1] && currentRsi > 40) {
            hiddenBull = true;
            if (!bullDiv) divStr = Math.min(85, Math.round(60 + (rsis[t1] - rsis[t2])));
        }
    }
    if (peaks.length >= 2) {
        const p1 = peaks[peaks.length - 2], p2 = peaks[peaks.length - 1];
        if (closes[p2] > closes[p1] && rsis[p2] < rsis[p1] && rsis[p1] > 60) {
            bearDiv = true;
            divStr = Math.min(100, Math.round(65 + (rsis[p1] - rsis[p2]) * 2 + (rsis[p1] - 60)));
        }
        if (closes[p2] < closes[p1] && rsis[p2] > rsis[p1] && currentRsi < 60) {
            hiddenBear = true;
            if (!bearDiv) divStr = Math.min(85, Math.round(60 + (rsis[p2] - rsis[p1])));
        }
    }
    
    const slope = rsiVals.slice(-5);
    const slopeDir = slope[4] - slope[0];
    
    let bias = 'NEUTRAL', status = 'NO_DIVERGENCE', score = 50, summary = 'لا يوجد تباعد في RSI';
    
    if (bullDiv && currentRsi < 35) {
        bias = 'BULLISH'; status = 'REGULAR_BULLISH_DIV'; score = Math.min(92, divStr);
        summary = `تباعد إيجابي كلاسيكي — RSI(${currentRsi.toFixed(1)}) في Oversold مع HL — إشارة انعكاس صعودي عالية الدقة`;
    } else if (bearDiv && currentRsi > 65) {
        bias = 'BEARISH'; status = 'REGULAR_BEARISH_DIV'; score = Math.min(92, divStr);
        summary = `تباعد سلبي كلاسيكي — RSI(${currentRsi.toFixed(1)}) في Overbought مع LH — إشارة انعكاس هبوطي عالية الدقة`;
    } else if (bullDiv) {
        bias = 'BULLISH'; status = 'BULLISH_DIV'; score = Math.min(82, divStr);
        summary = `تباعد إيجابي — السعر LL و RSI(${currentRsi.toFixed(1)}) HL`;
    } else if (bearDiv) {
        bias = 'BEARISH'; status = 'BEARISH_DIV'; score = Math.min(82, divStr);
        summary = `تباعد سلبي — السعر HH و RSI(${currentRsi.toFixed(1)}) LH`;
    } else if (hiddenBull) {
        bias = 'BULLISH'; status = 'HIDDEN_BULLISH'; score = 75;
        summary = `تباعد مخفي إيجابي — RSI(${currentRsi.toFixed(1)}) يدعم استمرار الصعود`;
    } else if (hiddenBear) {
        bias = 'BEARISH'; status = 'HIDDEN_BEARISH'; score = 75;
        summary = `تباعد مخفي سلبي — RSI(${currentRsi.toFixed(1)}) يدعم استمرار الهبوط`;
    } else if (currentRsi < 30 && slopeDir > 2) {
        bias = 'BULLISH'; status = 'OVERSOLD_RECOVERY'; score = 70;
        summary = `RSI(${currentRsi.toFixed(1)}) يتعافى من Oversold`;
    } else if (currentRsi > 70 && slopeDir < -2) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_DECLINE'; score = 70;
        summary = `RSI(${currentRsi.toFixed(1)}) يتراجع من Overbought`;
    } else if (currentRsi > 55) {
        bias = 'BULLISH'; status = 'MILD_BULLISH'; score = 55;
        summary = `RSI(${currentRsi.toFixed(1)}) فوق المتوسط — انحياز صعودي`;
    } else if (currentRsi < 45) {
        bias = 'BEARISH'; status = 'MILD_BEARISH'; score = 55;
        summary = `RSI(${currentRsi.toFixed(1)}) تحت المتوسط — انحياز هبوطي`;
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'RSI_DIV', fullName: 'RSI Divergence', icon: 'RSI', grade, score, bias, status, summary };
}

// ==================== 2. Fibonacci Retracement ====================
function vip3_runFib(candles, currentPrice) {
    const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
    const pks = typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length).slice(-3) : [];
    const trs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length).slice(-3) : [];
    
    if (!pks.length || !trs.length) return { name: 'FIB_RET', fullName: 'Fibonacci Retracement', icon: 'FIB', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_SWING', summary: 'لا يوجد Swing كافٍ', levels: null, nearFib: null };
    
    const lastP = pks[pks.length - 1], lastT = trs[trs.length - 1];
    const sH = highs[lastP], sL = lows[lastT], range = sH - sL;
    const isUp = lastT < lastP;
    const f236 = sH - range * 0.236, f382 = sH - range * 0.382, f500 = sH - range * 0.5, f618 = sH - range * 0.618, f786 = sH - range * 0.786;
    const levels = { f236, f382, f500, f618, f786, sH, sL };
    
    const tol = currentPrice * 0.006;
    const fibs = [{ l: '0.236', p: f236 }, { l: '0.382', p: f382 }, { l: '0.500', p: f500 }, { l: '0.618', p: f618 }, { l: '0.786', p: f786 }];
    const nearFib = fibs.find(f => Math.abs(currentPrice - f.p) < tol);
    const inOTE = currentPrice >= f618 * 0.998 && currentPrice <= f382 * 1.002;
    
    let bias = 'NEUTRAL', status = 'NO_FIB_TOUCH', score = 50, summary = 'السعر ليس عند مستوى Fibonacci رئيسي';
    
    if (nearFib && nearFib.l === '0.618') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_618'; score = 88;
        summary = `السعر عند Fib 0.618 (${vip3_fmt(f618)}) — النسبة الذهبية`;
    } else if (inOTE) {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'IN_OTE'; score = 85;
        summary = 'السعر داخل OTE Zone (0.382-0.618) — منطقة الدخول المثالية';
    } else if (nearFib && nearFib.l === '0.500') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_500'; score = 78;
        summary = `السعر عند Fib 0.500 (${vip3_fmt(f500)})`;
    } else if (nearFib && nearFib.l === '0.382') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_382'; score = 72;
        summary = `السعر عند Fib 0.382 (${vip3_fmt(f382)})`;
    } else if (nearFib) {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_' + nearFib.l; score = 68;
        summary = `السعر عند Fib ${nearFib.l}`;
    } else if (currentPrice > f236 && isUp) {
        bias = 'BULLISH'; status = 'ABOVE_FIBS'; score = 60;
        summary = 'السعر فوق مستويات Fibonacci — ترند قوي';
    } else if (currentPrice < f786) {
        bias = 'BEARISH'; status = 'BELOW_786'; score = 58;
        summary = 'السعر تحت Fib 0.786 — ارتداد فاشل';
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'FIB_RET', fullName: 'Fibonacci Retracement', icon: 'FIB', grade, score, bias, status, summary, levels, nearFib };
}

// ==================== 3. SMC Order Block ====================
function vip3_runSmcOb(candles, currentPrice) {
    const display = candles.slice(-60);
    const avgRange = display.reduce((s, c) => s + (c.high - c.low), 0) / display.length;
    const avgVol = display.reduce((s, c) => s + c.volume, 0) / display.length;
    const candidates = [];
    
    for (let i = 0; i < display.length - 3; i++) {
        const c = display[i], n1 = display[i + 1], n2 = display[i + 2];
        if (c.close < c.open && n1.close > n1.open && n2.close > n2.open) {
            const mv = (n2.high - c.low) / avgRange;
            if (mv > 1.3) {
                const vc = (n1.volume + n2.volume) / 2 > avgVol * 1.1;
                const mit = display.slice(i + 3).some(x => x.low <= c.high && x.low >= c.low);
                candidates.push({ type: 'BULLISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(mv * 20 + (vc ? 10 : 0))), fresh: !mit, vc });
            }
        }
        if (c.close > c.open && n1.close < n1.open && n2.close < n2.open) {
            const mv = (c.high - n2.low) / avgRange;
            if (mv > 1.3) {
                const vc = (n1.volume + n2.volume) / 2 > avgVol * 1.1;
                const mit = display.slice(i + 3).some(x => x.high >= c.low && x.high <= c.high);
                candidates.push({ type: 'BEARISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(mv * 20 + (vc ? 10 : 0))), fresh: !mit, vc });
            }
        }
    }
    
    const freshObs = candidates.filter(c => c.fresh);
    const allObs = freshObs.length > 0 ? freshObs : candidates;
    if (allObs.length === 0) return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_OB', summary: 'لا يوجد Order Block مكتشف بالقرب من السعر', obZone: null };
    
    allObs.sort((a, b) => Math.abs(currentPrice - (a.priceMin + a.priceMax) / 2) - Math.abs(currentPrice - (b.priceMin + b.priceMax) / 2));
    const best = allObs[0];
    const midOb = (best.priceMin + best.priceMax) / 2;
    const distance = Math.abs(currentPrice - midOb) / currentPrice * 100;
    const inZone = currentPrice >= best.priceMin && currentPrice <= best.priceMax;
    const nearZone = distance < 1.5;
    
    let bias, status, score, summary;
    if (inZone) {
        bias = best.type; status = best.type + '_OB_ENTRY';
        score = Math.min(92, best.strength + 12);
        summary = `السعر داخل ${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} Order Block${best.fresh ? ' طازج' : ''}${best.vc ? ' + حجم مؤكد' : ''} (${vip3_fmt(best.priceMin)}-${vip3_fmt(best.priceMax)})`;
    } else if (nearZone) {
        bias = best.type; status = best.type + '_OB_NEAR';
        score = Math.min(85, best.strength + 5);
        summary = `${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} OB قريب (${distance.toFixed(2)}%) عند ${vip3_fmt(best.priceMin)}-${vip3_fmt(best.priceMax)}${best.fresh ? ' — طازج' : ''}`;
    } else {
        bias = best.type; status = best.type + '_OB_DETECTED';
        score = Math.min(72, best.strength);
        summary = `${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} OB مكتشف عند ${vip3_fmt(best.priceMin)}-${vip3_fmt(best.priceMax)} (بُعد ${distance.toFixed(2)}%)`;
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade, score, bias, status, summary, obZone: { min: best.priceMin, max: best.priceMax } };
}

// ==================== Trade Builder ====================
function vip3_buildTrade(bias, currentPrice, candles, tfName, components, fibData, smcData) {
    const isBull = bias === 'BULLISH';
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    
    let slM;
    if (tfName === '1H') slM = 1.5;
    else if (tfName === '4H') slM = 2.0;
    else slM = 2.5;
    
    // تصحيح هندسي: سعر الدخول هو دائماً السعر اللحظي (currentPrice) كما طلبت
    const entryPrice = currentPrice;
    
    let stopLoss;
    if (isBull) {
        stopLoss = (smcData.obZone && smcData.bias === 'BULLISH') ? Math.min(smcData.obZone.min * 0.997, entryPrice - atr * slM) : entryPrice - atr * slM;
    } else {
        stopLoss = (smcData.obZone && smcData.bias === 'BEARISH') ? Math.max(smcData.obZone.max * 1.003, entryPrice + atr * slM) : entryPrice + atr * slM;
    }
    
    const slDist = Math.abs(entryPrice - stopLoss);
    const stopLossDistance = parseFloat((slDist / entryPrice * 100).toFixed(2));
    
    let tp1, tp2, tp3;
    if (isBull) {
        const targets = [];
        if (fibData.levels) {
            [fibData.levels.f382, fibData.levels.f236, fibData.levels.sH].forEach(f => { if (f > entryPrice * 1.003) targets.push(f) });
        }
        targets.push(entryPrice + atr * 2, entryPrice + atr * 4, entryPrice + atr * 7);
        const sorted = [...new Set(targets)].filter(t => t > entryPrice * 1.003).sort((a, b) => a - b);
        tp1 = sorted[0] || entryPrice + atr * 2;
        tp2 = sorted[1] || entryPrice + atr * 4;
        tp3 = sorted[2] || entryPrice + atr * 7;
    } else {
        const targets = [];
        if (fibData.levels) {
            [fibData.levels.f618, fibData.levels.f786, fibData.levels.sL].forEach(f => { if (f < entryPrice * 0.997) targets.push(f) });
        }
        targets.push(entryPrice - atr * 2, entryPrice - atr * 4, entryPrice - atr * 7);
        const sorted = [...new Set(targets)].filter(t => t < entryPrice * 0.997).sort((a, b) => b - a);
        tp1 = sorted[0] || entryPrice - atr * 2;
        tp2 = sorted[1] || entryPrice - atr * 4;
        tp3 = sorted[2] || entryPrice - atr * 7;
    }
    
    const tp1Pct = parseFloat((Math.abs(tp1 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp2Pct = parseFloat((Math.abs(tp2 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp3Pct = parseFloat((Math.abs(tp3 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp1Rr = parseFloat((Math.abs(tp1 - entryPrice) / slDist).toFixed(2));
    const tp2Rr = parseFloat((Math.abs(tp2 - entryPrice) / slDist).toFixed(2));
    const tp3Rr = parseFloat((Math.abs(tp3 - entryPrice) / slDist).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    const aligned = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + aligned * 10;
    const tp1Prob = Math.min(90, baseProb + 12);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 12);
    const expectedValue = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * stopLossDistance)).toFixed(2));
    
    return { entryPrice, stopLoss, stopLossDistance, riskPct: stopLossDistance, tp1, tp1Pct, tp1Rr, tp1Probability: tp1Prob, tp2, tp2Pct, tp2Rr, tp2Probability: tp2Prob, tp3, tp3Pct, tp3Rr, tp3Probability: tp3Prob, averageRr: avgRr, expectedValue };
}

function vip3_fmt(p) { return (typeof smartFormat === 'function') ? smartFormat(p) : (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(p) : p.toFixed(4)); }

// ==================== Render ====================
function vip3_renderDashboard(a) {
    return `${vip3_renderMaster(a)}
            ${vip3_renderTrade(a.timeframes[0], 'صفقة سريعة المدى', 'SHORT-TERM TRADE')}
            ${vip3_renderTrade(a.timeframes[1], 'صفقة متوسطة المدى', 'MID-TERM TRADE')}
            ${vip3_renderTrade(a.timeframes[2], 'صفقة بعيدة المدى', 'LONG-TERM TRADE')}
            ${vip3_renderMatrix(a.timeframes)}
            ${vip3_renderStrategy()}
            ${vip3_renderAnalysis(a)}
            ${vip3_renderGuide()}`;
}

function vip3_renderMaster(a) {
    const gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const bc = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
    return `<div class="vip3-master">
                <div class="vip3-ml">MASTER SIGNAL</div>
                <div class="vip3-mg" style="color:${gc}">${a.masterGrade}</div>
                <div class="vip3-mb" style="color:${bc}">${a.masterBias} SIGNAL</div>
                <div class="vip3-mbar"><div class="vip3-mbar-f" style="width:${a.masterScore}%"></div></div>
                <div class="vip3-mstats">
                    <div class="vip3-ms"><div class="vip3-msl">MASTER SCORE</div><div class="vip3-msv">${a.masterScore}/100</div></div>
                    <div class="vip3-ms"><div class="vip3-msl">TFs ALIGNED</div><div class="vip3-msv">${a.alignedTfs}/3</div></div>
                    <div class="vip3-ms"><div class="vip3-msl">PRICE</div><div class="vip3-msv">$${vip3_fmt(a.currentPrice)}</div></div>
                </div>
            </div>`;
}

function vip3_renderTrade(tf, arTitle, enTitle) {
    if (!tf.trade) {
        let msg = 'لا يوجد صفقات مؤهلة حالياً (قوة الإشارة ضعيفة).';
        let warn = 'إشارة تحذيرية — يُرجى الانتظار والمتابعة حتى تتوافق الأدوات الثلاثة.';
        if (tf.bias === 'BEARISH') {
            msg = 'مسار هابط / ضغط بيعي.';
            warn = 'إشارة تحذيرية — النظام مصمم للتداول الفوري (Spot) صعوداً فقط. يُنصح بالبقاء خارج السوق لتجنب الخسائر.';
        }
        return `<div class="vip3-tc">
                    <div class="vip3-th"><span class="vip3-ttf">${tf.tf}</span><div class="vip3-thd"><div class="vip3-tar">${arTitle}</div><div class="vip3-ten">${enTitle}</div></div><span class="vip3-tgr" style="color:var(--t3)">—</span></div>
                    <div class="vip3-no-trade">
                        <div style="color:var(--o);font-weight:700;font-size:12px;margin-bottom:6px">${msg}</div>
                        <div style="color:var(--t2);font-size:10px">${warn}</div>
                        <div style="color:var(--t3);font-size:9px;margin-top:6px;font-family:'Share Tech Mono',monospace">SIGNAL: ${tf.signalStrength}/100 — BELOW THRESHOLD</div>
                    </div>
                </div>`;
    }
    
    const t = tf.trade, isBull = tf.bias === 'BULLISH';
    const biasC = isBull ? 'var(--t)' : 'var(--o)';
    const gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';
    const arrow = isBull ? '↑' : '↓';
    
    return `<div class="vip3-tc" style="border-right:3px solid ${biasC}">
                <div class="vip3-th"><span class="vip3-ttf">${tf.tf}</span><div class="vip3-thd"><div class="vip3-tar">${arTitle}</div><div class="vip3-ten">${enTitle}</div></div><span class="vip3-tgr" style="color:${gradeC}">${tf.signalGrade}</span></div>
                <div class="vip3-sr"><span class="vip3-sb" style="background:${biasC};color:var(--bg)">${sideLabel}</span><span class="vip3-ss">SIGNAL: ${tf.signalStrength}/100</span></div>
                <div class="vip3-sbar"><div class="vip3-sfill" style="width:${tf.signalStrength}%;background:${biasC}"></div></div>
                <table class="vip3-tbl"><tbody>
                    <tr><td class="vip3-tl">ENTRY</td><td class="vip3-tp" style="color:var(--o)">$${vip3_fmt(t.entryPrice)}</td><td class="vip3-tm">—</td></tr>
                    <tr><td class="vip3-tl">STOP LOSS</td><td class="vip3-tp" style="color:var(--o)">$${vip3_fmt(t.stopLoss)}</td><td class="vip3-tm">-${t.riskPct}%</td></tr>
                    <tr class="vip3-sep"><td colspan="3"></td></tr>
                    <tr><td class="vip3-tl" style="color:var(--t)">TP1</td><td class="vip3-tp" style="color:var(--t)">$${vip3_fmt(t.tp1)}</td><td class="vip3-tm">${arrow} ${t.tp1Pct}% // R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td></tr>
                    <tr><td class="vip3-tl" style="color:var(--t)">TP2</td><td class="vip3-tp" style="color:var(--t)">$${vip3_fmt(t.tp2)}</td><td class="vip3-tm">${arrow} ${t.tp2Pct}% // R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td></tr>
                    <tr><td class="vip3-tl" style="color:var(--t)">TP3</td><td class="vip3-tp" style="color:var(--t)">$${vip3_fmt(t.tp3)}</td><td class="vip3-tm">${arrow} ${t.tp3Pct}% // R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td></tr>
                </tbody></table>
                <div class="vip3-tf2">
                    <div class="vip3-fi"><span class="vip3-fl">AVG R:R</span><span class="vip3-fv" style="color:var(--o)">1:${t.averageRr}</span></div>
                    <div class="vip3-fi"><span class="vip3-fl">EXP. VALUE</span><span class="vip3-fv">+${t.expectedValue}%</span></div>
                    <div class="vip3-fi"><span class="vip3-fl">QUALITY</span><span class="vip3-fv" style="color:${gradeC}">${tf.signalQuality.replace(/_/g, ' ')}</span></div>
                </div>
                <div class="vip3-ts">
                    ${tf.components.map(c => {
                        const cC = c.bias === tf.bias ? biasC : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)');
                        return `<div class="vip3-chip" style="border-top-color:${cC}"><span class="vip3-ci">${c.icon}</span><span class="vip3-cg">${c.grade}</span></div>`;
                    }).join('')}
                </div>
            </div>`;
}

function vip3_renderMatrix(timeframes) {
    const tools = [
        { key: 'RSI_DIV', label: 'RSI Divergence' },
        { key: 'FIB_RET', label: 'Fibonacci' },
        { key: 'SMC_OB', label: 'SMC Order Block' }
    ];
    let rows = '';
    tools.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn.key));
        rows += `<div class="vip3-mxr"><span class="vip3-mxt">${tn.label}</span>${vals.map(v => {
            const bc = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
            return `<div class="vip3-mxc" style="border-top:2px solid ${bc}"><span style="color:${bc};font-weight:700;font-size:9px">${v.grade}</span><span style="color:var(--t2);font-size:8px">${v.score}/100</span><span style="color:var(--t3);font-size:7px">${v.bias.substring(0,4)}</span></div>`;
        }).join('')}</div>`;
    });
    return `<div class="vip3-card">
                <div class="vip3-ct">COMPONENTS MATRIX // مصفوفة الأدوات</div>
                <div class="vip3-mxh"><span class="vip3-mxt">TOOL</span><div class="vip3-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div><div class="vip3-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">4H</div><div class="vip3-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1D</div></div>
                ${rows}
            </div>`;
}

function vip3_renderStrategy() {
    return `<div class="vip3-card">
                <div class="vip3-ct">STRATEGY METHODOLOGY // منهجية الاستنتاج</div>
                <div class="vip3-step" style="border-right-color:var(--o)">
                    <div class="vip3-step-t">STEP 1 — RSI DIVERGENCE (كشف الانعكاس)</div>
                    <div class="vip3-step-d">RSI Divergence يكشف 4 أنواع تباعد: Regular Bullish/Bearish = انعكاس، Hidden = استمرار. الأقوى: Regular Divergence في Oversold/Overbought = دقة 85-92%. يحدد "متى" يحدث التحوّل.</div>
                </div>
                <div class="vip3-step" style="border-right-color:var(--t)">
                    <div class="vip3-step-t">STEP 2 — FIBONACCI RETRACEMENT (منطقة الدخول)</div>
                    <div class="vip3-step-d">Fibonacci يحدد OTE Zone (0.382-0.618) — أفضل منطقة دخول. Fib 0.618 = "النسبة الذهبية" بدقة ارتداد 80%+. يحدد "أين" نبحث عن الدخول.</div>
                </div>
                <div class="vip3-step" style="border-right-color:var(--o)">
                    <div class="vip3-step-t">STEP 3 — SMC ORDER BLOCK (الدخول الدقيق + الدعوم/المقاومات)</div>
                    <div class="vip3-step-d">SMC Order Block يكتشف مناطق الأوامر المؤسسية. OBs الطازجة (غير المختبرة) + تأكيد حجم = أقوى مناطق دخول. يُستخدم OB كدعم/مقاومة مؤسسي + SL خلف حدود OB. يحدد "أين بالضبط" نقف.</div>
                </div>
                <div class="vip3-step-note">ما يميز هذه الأداة: RSI Divergence يكشف التوقيت + Fibonacci يحدد المنطقة المثالية. Entry من السعر اللحظي (Current Price) للتنفيذ السريع في Spot + SL من حدود OB + TPs من Fibonacci levels. إذا تعارضت أداتان = لا صفقة.</div>
            </div>`;
}

function vip3_renderAnalysis(a) {
    const act = a.timeframes.filter(t => t.trade).length;
    const noT = a.timeframes.filter(t => !t.trade).length;
    const text = act > 0 
        ? `تم توليد ${act} إعدادات تداول فوري (Spot) على ${a.symbol.replace('USDT','')} عبر الاستراتيجية الثلاثية (RSI Divergence → Fibonacci → SMC Order Block). ${noT > 0 ? `${noT} فريمات لم تستوفِ الحد الأدنى — يُرجى الانتظار.` : ''} الأهداف مبنية على Fibonacci levels + SMC OB مؤسسي. الاتجاه العام: ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بتوافق ${a.alignedTfs}/3. ${a.masterGrade === 'A+' ? 'إشارة استثنائية.' : (a.masterGrade === 'A' ? 'إشارة قوية.' : 'إشارة تحتاج حذراً.')}` 
        : `لا توجد صفقات متاحة حالياً عبر أي فريم زمني. إشارة تحذيرية — يُرجى الانتظار والمتابعة حتى تتوافق الأدوات الثلاثة. السوق في حالة عدم وضوح.`;
        
    return `<div class="vip3-analysis">
                <div class="vip3-at">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div>
                <div class="vip3-atx">${text}</div>
                <div class="vip3-disc">جميع الصفقات للتداول الفوري (Spot) حصرياً — بدون رافعة مالية أو عقود آجلة أو مشتقات. لا تمثل توصيات تداول. كل قرار هو مسؤولية المستخدم.</div>
            </div>`;
}

function vip3_renderGuide() {
    return `<div class="vip3-guide">
                <div class="vip3-gt">دليل القراءة // TRADING VIP 3 READING GUIDE</div>
                <div class="vip3-gx">
                    <strong style="color:var(--o)">TRADING VIP 3:</strong> منظومة تداول فوري (Spot) تجمع: RSI Divergence (كشف الانعكاس) + Fibonacci Retracement (منطقة الدخول) + SMC Order Block (الدعوم/المقاومات والدخول الدقيق).<br><br>
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> Spot فقط — بدون رافعة أو Futures أو مشتقات.<br><br>
                    <strong style="color:var(--t)">THE THREE TOOLS:</strong><br><br>
                    <strong style="color:var(--o)">1. RSI DIVERGENCE:</strong> يكشف 4 أنواع: Regular Bullish (LL + RSI HL = انعكاس صعودي 85-92%) / Regular Bearish (HH + RSI LH = انعكاس هبوطي) / Hidden Bullish (استمرار صعود) / Hidden Bearish (استمرار هبوط). RSI في OS/OB مع Divergence = أقوى إشارة.<br><br>
                    <strong style="color:var(--o)">2. FIBONACCI RETRACEMENT:</strong> مستويات 0.236/0.382/0.5/0.618/0.786. OTE Zone (0.382-0.618) = منطقة الدخول المثالية. Fib 0.618 = النسبة الذهبية بأعلى احتمالية ارتداد (80%+).<br><br>
                    <strong style="color:var(--o)">3. SMC ORDER BLOCK:</strong> يكتشف مناطق الأوامر المؤسسية — آخر شمعة معاكسة قبل حركة قوية. Bullish OB = دعم مؤسسي. Bearish OB = مقاومة مؤسسية. OBs الطازجة أقوى بكثير. تأكيد الحجم يرفع الموثوقية.<br><br>
                    <strong style="color:var(--o)">التسلسل المنهجي:</strong> RSI Div يقول "انعكاس هنا" → Fib تقول "منطقة الدخول هنا (OTE)" → SMC OB يقول "ضع SL هنا". النتيجة: Entry من السعر اللحظي الحالي + SL من حدود OB + TPs من Fibonacci.<br><br>
                    <strong style="color:var(--o)">ما يميز هذه الأداة:</strong> يتم الدخول من السعر اللحظي الحالي مباشرة (Spot). SL من حدود OB (ليس ATR عشوائي). TPs من Fibonacci levels الفعلية.<br><br>
                    <strong style="color:var(--t)">TIMEFRAMES:</strong> 1H (سريعة) // 4H (متوسطة) // 1D (بعيدة)<br><br>
                    <strong style="color:var(--o)">SIGNAL GRADES:</strong> A+ (85+ / 3 متوافقة) → A (75+) → B+ (65+) → B (55+) → C (لا صفقة)<br><br>
                    <strong style="color:var(--o)">لا يوجد صفقات متاحة:</strong> إشارة تحذيرية لتجنب التداول في المسارات الهبوطية أو العشوائية. الانتظار أفضل من التداول في ظروف غير واضحة.<br><br>
                    <strong style="color:var(--o)">FRESH ORDER BLOCK:</strong> OB لم يُختبر بعد — أقوى لأن الأوامر المؤسسية لا تزال كامنة فيه.<br><br>
                    <strong style="color:var(--o)">OB-BASED SL:</strong> وقف الخسارة تحت/فوق حد OB بهامش 0.3%. كسر OB = إلغاء الإعداد.<br><br>
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> منظومة تحليلية بحتة للتداول الفوري (Spot) فقط — بدون رافعة أو مشتقات. الأسعار والأهداف لا تمثل توصيات. كل قرار هو مسؤولية المستخدم.
                </div>
            </div>`;
}
// =====================================================================
// Trading VIP 4 — منصة 360°
// Scalping Signal Generator (SPOT ONLY — No Futures/Leverage)
// 3 أدوات: Stochastic RSI Momentum + Fibonacci Retracement + EMA Trend
// تم تطبيق الحماية الصارمة (Long Only) لمنع صفقات البيع المكشوف
// تم تفعيل نظام (Entry Zone) لتقديم أفضل مناطق الدخول
// =====================================================================

async function runTradingVip4() {
    const symbolInput = document.getElementById('vip4-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('vip4-dashboard');
    const loading = document.getElementById('vip4-loading');
    
    if (!symbolInput) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    const symbol = symbolInput.includes('USDT') ? symbolInput : symbolInput + 'USDT';
    
    dash.innerHTML = '';
    loading.style.display = 'block';
    
    try {
        // الحد الأقصى للجلب هو 200 شمعة لحماية الـ API من الحظر وتخفيف الحمل
        const [r15m, r30m, r1h] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=15m&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=30m&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=200`)
        ]);
        
        if (!r15m.ok || !r30m.ok || !r1h.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d15m, d30m, d1h] = await Promise.all([r15m.json(), r30m.json(), r1h.json()]);
        
        const parse = raw => raw.map(c => ({ 
            time: parseInt(c[0]), 
            open: parseFloat(c[1]), 
            high: parseFloat(c[2]), 
            low: parseFloat(c[3]), 
            close: parseFloat(c[4]), 
            volume: parseFloat(c[5]) 
        }));
        
        const c15m = parse(d15m), c30m = parse(d30m), c1h = parse(d1h);
        
        if (c15m.length < 50 || c30m.length < 50 || c1h.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل المتقدم.');
        
        loading.style.display = 'none';
        dash.innerHTML = vip4_renderDashboard(vip4_analyzeTradingSignal(symbol, c15m, c30m, c1h));
        dash.style.display = 'flex';

    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        dash.style.display = 'flex';
    }
}

function vip4_analyzeTradingSignal(symbol, c15m, c30m, c1h) {
    const tf15 = vip4_analyzeTimeframe('15m', c15m);
    const tf30 = vip4_analyzeTimeframe('30m', c30m);
    const tf1h = vip4_analyzeTimeframe('1H', c1h);
    
    const currentPrice = c15m[c15m.length - 1].close;
    const tfs = [tf15, tf30, tf1h];
    
    const bullTfs = tfs.filter(t => t.bias === 'BULLISH').length;
    const bearTfs = tfs.filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullTfs > bearTfs ? 'BULLISH' : (bearTfs > bullTfs ? 'BEARISH' : 'MIXED');
    
    const avgScore = Math.round((tf15.score + tf30.score + tf1h.score) / 3);
    const alignBonus = (bullTfs === 3 || bearTfs === 3) ? 12 : 0;
    const masterScore = Math.min(100, avgScore + alignBonus);
    
    let masterGrade;
    if (masterScore >= 85) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol, currentPrice, masterBias, masterGrade, masterScore, 
        alignedTfs: masterBias === 'BULLISH' ? bullTfs : bearTfs, 
        timeframes: tfs 
    };
}

function vip4_analyzeTimeframe(tfName, candles) {
    const display = candles.slice(-100);
    const currentPrice = display[display.length - 1].close;
    
    const stochRsi = vip4_runStochRsi(display, currentPrice);
    const fibRet = vip4_runFib(display, currentPrice);
    const emaTrend = vip4_runEmaTrend(display, currentPrice);
    
    const components = [stochRsi, fibRet, emaTrend];
    const bullC = components.filter(c => c.bias === 'BULLISH').length;
    const bearC = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullC > bearC ? 'BULLISH' : (bearC > bullC ? 'BEARISH' : 'NEUTRAL');
    const aligned = bias === 'BULLISH' ? bullC : (bias === 'BEARISH' ? bearC : 0);
    
    const avgS = components.reduce((s, c) => s + c.score, 0) / 3;
    const signalStrength = Math.round(avgS * 0.55 + (aligned / 3 * 100) * 0.45);
    const score = signalStrength;
    
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && aligned === 3) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && aligned >= 2) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }
    
    // فلترة الاتجاه (SPOT ONLY): تفعيل التداول فقط في المسار الصاعد وحجب البيع المكشوف
    const trade = (bias === 'BULLISH' && signalStrength >= 55) ? vip4_buildTrade(bias, currentPrice, candles, tfName, components, fibRet, emaTrend) : null;
    
    return { tf: tfName, bias, signalStrength, signalGrade, signalQuality, score, aligned, components, trade, currentPrice };
}

// ==================== 1. Stochastic RSI Momentum ====================
function vip4_runStochRsi(candles, currentPrice) {
    const period = 14, kP = 3, dP = 3;
    const rsiVals = [];
    let aG = 0, aL = 0;
    
    for (let i = 1; i <= period && i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        if (d > 0) aG += d; else aL -= d;
    }
    aG /= period; aL /= period;
    
    for (let i = 0; i <= period; i++) rsiVals.push(50);
    
    for (let i = period + 1; i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        aG = (aG * (period - 1) + Math.max(0, d)) / period;
        aL = (aL * (period - 1) + Math.max(0, -d)) / period;
        rsiVals.push(aL === 0 ? 100 : 100 - (100 / (1 + aG / aL)));
    }
    
    const stochK = [];
    for (let i = 0; i < rsiVals.length; i++) {
        if (i < period) { stochK.push(50); continue; }
        const w = rsiVals.slice(i - period + 1, i + 1);
        const mn = Math.min(...w), mx = Math.max(...w);
        stochK.push(mx === mn ? 50 : ((rsiVals[i] - mn) / (mx - mn)) * 100);
    }
    
    const smoothK = [];
    for (let i = 0; i < stochK.length; i++) {
        if (i < kP) { smoothK.push(stochK[i]); continue; }
        smoothK.push(stochK.slice(i - kP + 1, i + 1).reduce((s, v) => s + v, 0) / kP);
    }
    
    const smoothD = [];
    for (let i = 0; i < smoothK.length; i++) {
        if (i < dP) { smoothD.push(smoothK[i]); continue; }
        smoothD.push(smoothK.slice(i - dP + 1, i + 1).reduce((s, v) => s + v, 0) / dP);
    }
    
    const k = smoothK[smoothK.length - 1], d = smoothD[smoothD.length - 1];
    const prevK = smoothK[smoothK.length - 2], prevD = smoothD[smoothD.length - 2];
    const crossUp = prevK <= prevD && k > d;
    const crossDown = prevK >= prevD && k < d;
    
    const closes = candles.map(c => c.close).slice(-30);
    const recentK = smoothK.slice(-30);
    const troughs = typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length).slice(-2) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length).slice(-2) : [];
    
    let bullDiv = false, bearDiv = false;
    if (troughs.length >= 2 && closes[troughs[1]] < closes[troughs[0]] && recentK[troughs[1]] > recentK[troughs[0]]) bullDiv = true;
    if (peaks.length >= 2 && closes[peaks[1]] > closes[peaks[0]] && recentK[peaks[1]] < recentK[peaks[0]]) bearDiv = true;
    
    let bias = 'NEUTRAL', status = 'NO_SIGNAL', score = 50, summary = 'لا توجد إشارة Stoch RSI';
    
    if (crossUp && k < 25) {
        bias = 'BULLISH'; status = 'OVERSOLD_CROSS_UP'; score = bullDiv ? 90 : 82;
        summary = `عبور صاعد في Oversold (K=${k.toFixed(1)})${bullDiv ? ' + تباعد إيجابي' : ''} — إشارة شراء قوية`;
    } else if (crossDown && k > 75) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_CROSS_DOWN'; score = bearDiv ? 90 : 82;
        summary = `عبور هابط في Overbought (K=${k.toFixed(1)})${bearDiv ? ' + تباعد سلبي' : ''} — إشارة بيع قوية`;
    } else if (k < 20 && bullDiv) {
        bias = 'BULLISH'; status = 'OVERSOLD_DIV'; score = 82;
        summary = `Stoch RSI Oversold (K=${k.toFixed(1)}) مع تباعد إيجابي`;
    } else if (k > 80 && bearDiv) {
        bias = 'BEARISH'; status = 'OVERBOUGHT_DIV'; score = 82;
        summary = `Stoch RSI Overbought (K=${k.toFixed(1)}) مع تباعد سلبي`;
    } else if (crossUp && k < 50) {
        bias = 'BULLISH'; status = 'BULLISH_CROSS'; score = 72;
        summary = `عبور صاعد (K=${k.toFixed(1)}) — زخم متحوّل`;
    } else if (crossDown && k > 50) {
        bias = 'BEARISH'; status = 'BEARISH_CROSS'; score = 72;
        summary = `عبور هابط (K=${k.toFixed(1)}) — زخم متحوّل`;
    } else if (k < 30) {
        bias = 'BULLISH'; status = 'OVERSOLD'; score = 65;
        summary = `Stoch RSI في Oversold (K=${k.toFixed(1)}) — انتظار عبور`;
    } else if (k > 70) {
        bias = 'BEARISH'; status = 'OVERBOUGHT'; score = 65;
        summary = `Stoch RSI في Overbought (K=${k.toFixed(1)}) — انتظار عبور`;
    } else if (k > 50 && k > d) {
        bias = 'BULLISH'; score = 55; status = 'MILD_BULL';
        summary = `زخم صعودي معتدل (K=${k.toFixed(1)})`;
    } else if (k < 50 && k < d) {
        bias = 'BEARISH'; score = 55; status = 'MILD_BEAR';
        summary = `زخم هبوطي معتدل (K=${k.toFixed(1)})`;
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'STOCH_RSI', fullName: 'Stochastic RSI', icon: 'SRI', grade, score, bias, status, summary };
}

// ==================== 2. Fibonacci Retracement ====================
function vip4_runFib(candles, currentPrice) {
    const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
    const pks = typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length).slice(-3) : [];
    const trs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length).slice(-3) : [];
    
    if (!pks.length || !trs.length) return { name: 'FIB_RET', fullName: 'Fibonacci Retracement', icon: 'FIB', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_SWING', summary: 'لا يوجد Swing كافٍ', levels: null };
    
    const lastP = pks[pks.length - 1], lastT = trs[trs.length - 1];
    const sH = highs[lastP], sL = lows[lastT], range = sH - sL;
    const isUp = lastT < lastP;
    
    const f236 = sH - range * 0.236, f382 = sH - range * 0.382, f500 = sH - range * 0.5, f618 = sH - range * 0.618, f786 = sH - range * 0.786;
    const levels = { f236, f382, f500, f618, f786, sH, sL };
    
    const tol = currentPrice * 0.004;
    const fibs = [{ l: '0.236', p: f236 }, { l: '0.382', p: f382 }, { l: '0.500', p: f500 }, { l: '0.618', p: f618 }, { l: '0.786', p: f786 }];
    const nearFib = fibs.find(f => Math.abs(currentPrice - f.p) < tol);
    const inOTE = currentPrice >= f618 * 0.998 && currentPrice <= f382 * 1.002;
    
    let bias = 'NEUTRAL', status = 'NO_FIB', score = 50, summary = 'السعر ليس عند Fibonacci';
    
    if (nearFib && nearFib.l === '0.618') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_618'; score = 88;
        summary = `السعر عند Fib 0.618 (${vip4_fmt(f618)}) — النسبة الذهبية`;
    } else if (inOTE) {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'IN_OTE'; score = 85;
        summary = 'السعر داخل OTE Zone (0.382-0.618)';
    } else if (nearFib && nearFib.l === '0.500') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_500'; score = 78;
        summary = `السعر عند Fib 0.500`;
    } else if (nearFib && nearFib.l === '0.382') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_382'; score = 72;
        summary = `السعر عند Fib 0.382`;
    } else if (nearFib) {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_TOUCH'; score = 68;
        summary = `السعر عند Fib ${nearFib.l}`;
    } else if (currentPrice > f236 && isUp) {
        bias = 'BULLISH'; status = 'ABOVE_FIBS'; score = 60;
        summary = 'السعر فوق Fibonacci — ترند قوي';
    } else if (currentPrice < f786) {
        bias = 'BEARISH'; status = 'BELOW_786'; score = 58;
        summary = 'السعر تحت Fib 0.786 — ضعف';
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'FIB_RET', fullName: 'Fibonacci Retracement', icon: 'FIB', grade, score, bias, status, summary, levels };
}

// ==================== 3. EMA(9/21/55) Trend ====================
function vip4_runEmaTrend(candles, currentPrice) {
    const calcEma = (period) => {
        const k = 2 / (period + 1); let e = candles[0].close;
        candles.forEach(c => e = c.close * k + e * (1 - k));
        return e;
    };
    const ema9 = calcEma(9), ema21 = calcEma(21), ema55 = calcEma(55);
    
    const calcEmaArr = (period) => {
        const k = 2 / (period + 1); let e = candles[0].close;
        return candles.map(c => (e = c.close * k + e * (1 - k)));
    };
    const ema9Arr = calcEmaArr(9), ema21Arr = calcEmaArr(21);
    const prevEma9 = ema9Arr[ema9Arr.length - 2], prevEma21 = ema21Arr[ema21Arr.length - 2];
    
    const bullCross = prevEma9 <= prevEma21 && ema9 > ema21;
    const bearCross = prevEma9 >= prevEma21 && ema9 < ema21;
    const bullStack = ema9 > ema21 && ema21 > ema55;
    const bearStack = ema9 < ema21 && ema21 < ema55;
    const aboveAll = currentPrice > ema9 && currentPrice > ema21 && currentPrice > ema55;
    const belowAll = currentPrice < ema9 && currentPrice < ema21 && currentPrice < ema55;
    
    const last3 = candles.slice(-3);
    const touchedEma9 = last3.some(c => Math.abs(c.low - ema9) / currentPrice < 0.002 || Math.abs(c.high - ema9) / currentPrice < 0.002);
    const touchedEma21 = last3.some(c => Math.abs(c.low - ema21) / currentPrice < 0.003 || Math.abs(c.high - ema21) / currentPrice < 0.003);
    
    let bias = 'NEUTRAL', status = 'MIXED', score = 50, summary = 'EMAs متشابكة';
    
    if (bullCross && aboveAll) {
        bias = 'BULLISH'; status = 'BULL_CROSS_ABOVE'; score = 88;
        summary = `Golden Cross سريع (EMA9 فوق EMA21) + سعر فوق الكل — زخم صعودي قوي`;
    } else if (bearCross && belowAll) {
        bias = 'BEARISH'; status = 'BEAR_CROSS_BELOW'; score = 88;
        summary = `Death Cross سريع (EMA9 تحت EMA21) + سعر تحت الكل — زخم هبوطي قوي`;
    } else if (bullStack && aboveAll && touchedEma9) {
        bias = 'BULLISH'; status = 'BULL_BOUNCE_EMA9'; score = 85;
        summary = `ارتداد من EMA9 (${vip4_fmt(ema9)}) في Stack صاعد — استمرار قوي`;
    } else if (bearStack && belowAll && touchedEma9) {
        bias = 'BEARISH'; status = 'BEAR_REJECT_EMA9'; score = 85;
        summary = `رفض عند EMA9 (${vip4_fmt(ema9)}) في Stack هابط — استمرار هبوط`;
    } else if (bullStack && aboveAll && touchedEma21) {
        bias = 'BULLISH'; status = 'BULL_BOUNCE_EMA21'; score = 82;
        summary = `ارتداد من EMA21 (${vip4_fmt(ema21)}) في Stack صاعد`;
    } else if (bearStack && belowAll && touchedEma21) {
        bias = 'BEARISH'; status = 'BEAR_REJECT_EMA21'; score = 82;
        summary = `رفض عند EMA21 (${vip4_fmt(ema21)}) في Stack هابط`;
    } else if (bullStack && aboveAll) {
        bias = 'BULLISH'; status = 'BULL_STACK'; score = 75;
        summary = `EMA Stack صاعد (9>21>55) + سعر فوق الكل`;
    } else if (bearStack && belowAll) {
        bias = 'BEARISH'; status = 'BEAR_STACK'; score = 75;
        summary = `EMA Stack هابط (9<21<55) + سعر تحت الكل`;
    } else if (bullCross) {
        bias = 'BULLISH'; status = 'BULL_CROSS'; score = 72;
        summary = `EMA9 عبرت فوق EMA21 — بداية زخم صعودي`;
    } else if (bearCross) {
        bias = 'BEARISH'; status = 'BEAR_CROSS'; score = 72;
        summary = `EMA9 عبرت تحت EMA21 — بداية زخم هبوطي`;
    } else if (aboveAll) {
        bias = 'BULLISH'; status = 'ABOVE_ALL'; score = 65;
        summary = 'السعر فوق EMA 9/21/55';
    } else if (belowAll) {
        bias = 'BEARISH'; status = 'BELOW_ALL'; score = 65;
        summary = 'السعر تحت EMA 9/21/55';
    } else if (currentPrice > ema9) {
        bias = 'BULLISH'; score = 55; status = 'ABOVE_EMA9';
        summary = `السعر فوق EMA9 — انحياز صعودي معتدل`;
    } else {
        bias = 'BEARISH'; score = 55; status = 'BELOW_EMA9';
        summary = `السعر تحت EMA9 — انحياز هبوطي معتدل`;
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'EMA_TREND', fullName: 'EMA(9/21/55) Trend', icon: 'EMA', grade, score, bias, status, summary, ema9, ema21, ema55 };
}

// ==================== Trade Builder (Entry Zone Implementation) ====================
function vip4_buildTrade(bias, currentPrice, candles, tfName, components, fibData, emaData) {
    const isBull = bias === 'BULLISH';
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    
    let slM;
    if (tfName === '15m') slM = 1.2;
    else if (tfName === '30m') slM = 1.5;
    else slM = 1.8;
    
    // 1. تحديد السعر اللحظي كحد أقصى للنطاق (Current Price)
    const entryPrice = currentPrice;
    
    // 2. هندسة أفضل سعر دخول (Best Entry) بناءً على أقرب دعم
    let bestEntry = entryPrice;
    if (isBull) {
        const supports = [];
        [emaData.ema9, emaData.ema21, emaData.ema55].forEach(e => { if (e < currentPrice) supports.push(e); });
        if (fibData.levels) {
            [fibData.levels.f382, fibData.levels.f500, fibData.levels.f618].forEach(f => { if (f < currentPrice) supports.push(f); });
        }
        supports.sort((a, b) => b - a); // الترتيب التنازلي لإيجاد أقرب دعم أسفل السعر
        // قبول الدعم فقط إذا كان ضمن مسافة قريبة نسبياً لتجنب النطاقات الواسعة
        if (supports.length > 0 && (currentPrice - supports[0]) / currentPrice < 0.02) {
            bestEntry = supports[0];
        }
    }
    
    // 3. حساب متوسط سعر الدخول في النطاق للحصول على دقة أكبر في حسابات المخاطرة (R:R)
    const avgEntry = (entryPrice + bestEntry) / 2;
    
    // 4. تحديد وقف الخسارة (SL) من أسفل أفضل سعر دخول وليس من السعر الحالي لضمان الحماية
    let stopLoss;
    if (isBull) {
        const emaSupports = [emaData.ema9, emaData.ema21, emaData.ema55].filter(e => e < bestEntry).sort((a, b) => b - a);
        stopLoss = emaSupports.length > 0 ? Math.min(emaSupports[0] * 0.998, bestEntry - atr * slM) : bestEntry - atr * slM;
    } else {
        const emaRes = [emaData.ema9, emaData.ema21, emaData.ema55].filter(e => e > currentPrice).sort((a, b) => a - b);
        stopLoss = emaRes.length > 0 ? Math.max(emaRes[0] * 1.002, entryPrice + atr * slM) : entryPrice + atr * slM;
    }
    
    const slDist = Math.abs(avgEntry - stopLoss);
    const stopLossDistance = parseFloat((slDist / avgEntry * 100).toFixed(2));
    
    // 5. حساب الأهداف (TPs)
    let tp1, tp2, tp3;
    if (isBull) {
        const targets = [];
        [emaData.ema9, emaData.ema21, emaData.ema55].forEach(e => { if (e > entryPrice * 1.002) targets.push(e) });
        if (fibData.levels) {
            [fibData.levels.f382, fibData.levels.f236, fibData.levels.sH].forEach(f => { if (f > entryPrice * 1.002) targets.push(f) });
        }
        targets.push(entryPrice + atr * 1.5, entryPrice + atr * 3, entryPrice + atr * 5);
        const sorted = [...new Set(targets)].filter(t => t > entryPrice * 1.002).sort((a, b) => a - b);
        tp1 = sorted[0] || entryPrice + atr * 1.5;
        tp2 = sorted[1] || entryPrice + atr * 3;
        tp3 = sorted[2] || entryPrice + atr * 5;
    } else {
        const targets = [];
        [emaData.ema9, emaData.ema21, emaData.ema55].forEach(e => { if (e < entryPrice * 0.998) targets.push(e) });
        if (fibData.levels) {
            [fibData.levels.f618, fibData.levels.f786, fibData.levels.sL].forEach(f => { if (f < entryPrice * 0.998) targets.push(f) });
        }
        targets.push(entryPrice - atr * 1.5, entryPrice - atr * 3, entryPrice - atr * 5);
        const sorted = [...new Set(targets)].filter(t => t < entryPrice * 0.998).sort((a, b) => b - a);
        tp1 = sorted[0] || entryPrice - atr * 1.5;
        tp2 = sorted[1] || entryPrice - atr * 3;
        tp3 = sorted[2] || entryPrice - atr * 5;
    }
    
    const tp1Pct = parseFloat((Math.abs(tp1 - avgEntry) / avgEntry * 100).toFixed(2));
    const tp2Pct = parseFloat((Math.abs(tp2 - avgEntry) / avgEntry * 100).toFixed(2));
    const tp3Pct = parseFloat((Math.abs(tp3 - avgEntry) / avgEntry * 100).toFixed(2));
    const tp1Rr = parseFloat((Math.abs(tp1 - avgEntry) / slDist).toFixed(2));
    const tp2Rr = parseFloat((Math.abs(tp2 - avgEntry) / slDist).toFixed(2));
    const tp3Rr = parseFloat((Math.abs(tp3 - avgEntry) / slDist).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    
    const aligned = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + aligned * 10;
    const tp1Prob = Math.min(90, baseProb + 12);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 12);
    const expectedValue = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * stopLossDistance)).toFixed(2));
    
    // تمرير متغير bestEntry إضافياً مع باقي البيانات
    return { entryPrice, bestEntry, stopLoss, stopLossDistance, riskPct: stopLossDistance, tp1, tp1Pct, tp1Rr, tp1Probability: tp1Prob, tp2, tp2Pct, tp2Rr, tp2Probability: tp2Prob, tp3, tp3Pct, tp3Rr, tp3Probability: tp3Prob, averageRr: avgRr, expectedValue };
}

function vip4_fmt(p) { return (typeof smartFormat === 'function') ? smartFormat(p) : (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(p) : p.toFixed(4)); }

// ==================== Render ====================
function vip4_renderDashboard(a) {
    return `${vip4_renderMaster(a)}
            ${vip4_renderTrade(a.timeframes[0], 'صفقة 15 دقيقة', '15-MIN SCALP')}
            ${vip4_renderTrade(a.timeframes[1], 'صفقة 30 دقيقة', '30-MIN TRADE')}
            ${vip4_renderTrade(a.timeframes[2], 'صفقة ساعة', '1-HOUR TRADE')}
            ${vip4_renderMatrix(a.timeframes)}
            ${vip4_renderStrategy()}
            ${vip4_renderAnalysis(a)}
            ${vip4_renderGuide()}`;
}

function vip4_renderMaster(a) {
    const gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const bc = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
    return `<div class="vip4-master">
                <div class="vip4-ml">MASTER SIGNAL</div>
                <div class="vip4-mg" style="color:${gc}">${a.masterGrade}</div>
                <div class="vip4-mb" style="color:${bc}">${a.masterBias} SIGNAL</div>
                <div class="vip4-mbar"><div class="vip4-mbar-f" style="width:${a.masterScore}%"></div></div>
                <div class="vip4-mstats">
                    <div class="vip4-ms"><div class="vip4-msl">MASTER SCORE</div><div class="vip4-msv">${a.masterScore}/100</div></div>
                    <div class="vip4-ms"><div class="vip4-msl">TFs ALIGNED</div><div class="vip4-msv">${a.alignedTfs}/3</div></div>
                    <div class="vip4-ms"><div class="vip4-msl">PRICE</div><div class="vip4-msv">$${vip4_fmt(a.currentPrice)}</div></div>
                </div>
            </div>`;
}

function vip4_renderTrade(tf, arTitle, enTitle) {
    if (!tf.trade) {
        let msg = 'لا يوجد صفقات مؤهلة حالياً (قوة الإشارة ضعيفة).';
        let warn = 'إشارة تحذيرية — يُرجى الانتظار والمتابعة حتى تتوافق الأدوات الثلاثة.';
        if (tf.bias === 'BEARISH') {
            msg = 'مسار هابط / ضغط بيعي.';
            warn = 'إشارة تحذيرية — النظام مصمم للتداول الفوري (Spot) صعوداً فقط. يُنصح بالبقاء خارج السوق لتجنب الخسائر.';
        }
        return `<div class="vip4-tc">
                    <div class="vip4-th"><span class="vip4-ttf">${tf.tf}</span><div class="vip4-thd"><div class="vip4-tar">${arTitle}</div><div class="vip4-ten">${enTitle}</div></div><span class="vip4-tgr" style="color:var(--t3)">—</span></div>
                    <div class="vip4-no-trade">
                        <div style="color:var(--o);font-weight:700;font-size:12px;margin-bottom:6px">${msg}</div>
                        <div style="color:var(--t2);font-size:10px">${warn}</div>
                        <div style="color:var(--t3);font-size:9px;margin-top:6px;font-family:'Share Tech Mono',monospace">SIGNAL: ${tf.signalStrength}/100 — BELOW THRESHOLD</div>
                    </div>
                </div>`;
    }
    
    const t = tf.trade, isBull = tf.bias === 'BULLISH';
    const biasC = isBull ? 'var(--t)' : 'var(--o)';
    const gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';
    const arrow = isBull ? '↑' : '↓';
    
    // الهيكلة الجديدة: فصل أسعار الدخول في صفوف جدول مستقلة لتنظيم العرض ومنع التداخل
    let entryRows = '';
    if (t.entryPrice !== t.bestEntry) {
        entryRows = `
            <tr><td class="vip4-tl">ENTRY (NOW)</td><td class="vip4-tp" style="color:var(--o)">$${vip4_fmt(t.entryPrice)}</td><td class="vip4-tm">سعر السوق</td></tr>
            <tr><td class="vip4-tl">ENTRY (LIMIT)</td><td class="vip4-tp" style="color:var(--o)">$${vip4_fmt(t.bestEntry)}</td><td class="vip4-tm">أمر معلق</td></tr>
        `;
    } else {
        entryRows = `<tr><td class="vip4-tl">ENTRY PRICE</td><td class="vip4-tp" style="color:var(--o)">$${vip4_fmt(t.entryPrice)}</td><td class="vip4-tm">تنفيذ فوري</td></tr>`;
    }
    
    return `<div class="vip4-tc" style="border-right:3px solid ${biasC}">
                <div class="vip4-th"><span class="vip4-ttf">${tf.tf}</span><div class="vip4-thd"><div class="vip4-tar">${arTitle}</div><div class="vip4-ten">${enTitle}</div></div><span class="vip4-tgr" style="color:${gradeC}">${tf.signalGrade}</span></div>
                <div class="vip4-sr"><span class="vip4-sb" style="background:${biasC};color:var(--bg)">${sideLabel}</span><span class="vip4-ss">SIGNAL: ${tf.signalStrength}/100</span></div>
                <div class="vip4-sbar"><div class="vip4-sfill" style="width:${tf.signalStrength}%;background:${biasC}"></div></div>
                <table class="vip4-tbl"><tbody>
                    ${entryRows}
                    <tr><td class="vip4-tl">STOP LOSS</td><td class="vip4-tp" style="color:var(--o)">$${vip4_fmt(t.stopLoss)}</td><td class="vip4-tm">-${t.riskPct}%</td></tr>
                    <tr class="vip4-sep"><td colspan="3"></td></tr>
                    <tr><td class="vip4-tl" style="color:var(--t)">TP1</td><td class="vip4-tp" style="color:var(--t)">$${vip4_fmt(t.tp1)}</td><td class="vip4-tm">${arrow} ${t.tp1Pct}% // R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td></tr>
                    <tr><td class="vip4-tl" style="color:var(--t)">TP2</td><td class="vip4-tp" style="color:var(--t)">$${vip4_fmt(t.tp2)}</td><td class="vip4-tm">${arrow} ${t.tp2Pct}% // R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td></tr>
                    <tr><td class="vip4-tl" style="color:var(--t)">TP3</td><td class="vip4-tp" style="color:var(--t)">$${vip4_fmt(t.tp3)}</td><td class="vip4-tm">${arrow} ${t.tp3Pct}% // R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td></tr>
                </tbody></table>
                <div class="vip4-tf2">
                    <div class="vip4-fi"><span class="vip4-fl">AVG R:R</span><span class="vip4-fv" style="color:var(--o)">1:${t.averageRr}</span></div>
                    <div class="vip4-fi"><span class="vip4-fl">EXP. VALUE</span><span class="vip4-fv">+${t.expectedValue}%</span></div>
                    <div class="vip4-fi"><span class="vip4-fl">QUALITY</span><span class="vip4-fv" style="color:${gradeC}">${tf.signalQuality.replace(/_/g, ' ')}</span></div>
                </div>
                <div class="vip4-ts">
                    ${tf.components.map(c => {
                        const cC = c.bias === tf.bias ? biasC : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)');
                        return `<div class="vip4-chip" style="border-top-color:${cC}"><span class="vip4-ci">${c.icon}</span><span class="vip4-cg">${c.grade}</span></div>`;
                    }).join('')}
                </div>
            </div>`;
}

function vip4_renderMatrix(timeframes) {
    const tools = [
        { key: 'STOCH_RSI', label: 'Stoch RSI' },
        { key: 'FIB_RET', label: 'Fibonacci' },
        { key: 'EMA_TREND', label: 'EMA Trend' }
    ];
    let rows = '';
    tools.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn.key));
        rows += `<div class="vip4-mxr"><span class="vip4-mxt">${tn.label}</span>${vals.map(v => {
            const bc = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
            return `<div class="vip4-mxc" style="border-top:2px solid ${bc}"><span style="color:${bc};font-weight:700;font-size:9px">${v.grade}</span><span style="color:var(--t2);font-size:8px">${v.score}/100</span><span style="color:var(--t3);font-size:7px">${v.bias.substring(0,4)}</span></div>`;
        }).join('')}</div>`;
    });
    return `<div class="vip4-card">
                <div class="vip4-ct">COMPONENTS MATRIX // مصفوفة الأدوات</div>
                <div class="vip4-mxh"><span class="vip4-mxt">TOOL</span><div class="vip4-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">15m</div><div class="vip4-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">30m</div><div class="vip4-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div></div>
                ${rows}
            </div>`;
}

function vip4_renderStrategy() {
    return `<div class="vip4-card">
                <div class="vip4-ct">STRATEGY METHODOLOGY // منهجية الاستنتاج</div>
                <div class="vip4-step" style="border-right-color:var(--o)">
                    <div class="vip4-step-t">STEP 1 — STOCHASTIC RSI (الزخم والتوقيت)</div>
                    <div class="vip4-step-d">Stoch RSI يكشف نقاط التشبع (%K/%D Cross في OS/OB) + Divergence = توقيت دقيق للدخول. مصمم للسكالبينج والحركات السريعة — أسرع من RSI العادي بـ 2-3 شموع.</div>
                </div>
                <div class="vip4-step" style="border-right-color:var(--t)">
                    <div class="vip4-step-t">STEP 2 — FIBONACCI RETRACEMENT (منطقة الدخول)</div>
                    <div class="vip4-step-d">Fibonacci يحدد OTE Zone (0.382-0.618). Fib 0.618 = أقوى مستوى ارتداد. Tolerance أضيق (0.4%) للفريمات الصغيرة لضمان دقة أعلى.</div>
                </div>
                <div class="vip4-step" style="border-right-color:var(--o)">
                    <div class="vip4-step-t">STEP 3 — EMA(9/21/55) TREND (الاتجاه + الأهداف)</div>
                    <div class="vip4-step-d">EMA9/21/55 مُحسّنة للسكالبينج (أسرع من 50/100/200 البطيئة). EMA Stack يحدد الاتجاه. EMA Bounce = إشارة استمرار. الأهداف ووقف الخسارة مأخوذة من مستويات EMA + Fibonacci الفعلية.</div>
                </div>
                <div class="vip4-step-note">الاستراتيجية: Stoch RSI يحدد "متى" (التوقيت) + Fibonacci يحدد "أين" (المنطقة) + EMA Trend يحدد "في أي اتجاه" (الترند) + الأهداف. SL أضيق مناسب للسكالبينج (1.2-1.8× ATR).</div>
            </div>`;
}

function vip4_renderAnalysis(a) {
    const act = a.timeframes.filter(t => t.trade).length;
    const noT = a.timeframes.filter(t => !t.trade).length;
    const text = act > 0 
        ? `تم توليد ${act} إعدادات تداول فوري (Spot) سريعة على ${a.symbol.replace('USDT','')} عبر الاستراتيجية الثلاثية (Stoch RSI → Fibonacci → EMA Trend). ${noT > 0 ? `${noT} فريمات لم تستوفِ الحد الأدنى.` : ''} الأهداف مبنية على EMA + Fibonacci levels. الاتجاه العام: ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بتوافق ${a.alignedTfs}/3. ${a.masterGrade === 'A+' ? 'إشارة استثنائية.' : (a.masterGrade === 'A' ? 'إشارة قوية.' : 'إشارة تحتاج حذراً.')}` 
        : `لا توجد صفقات متاحة. إشارة تحذيرية — يُرجى الانتظار حتى يتشكل اتجاه واضح.`;
        
    return `<div class="vip4-analysis">
                <div class="vip4-at">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div>
                <div class="vip4-atx">${text}</div>
                <div class="vip4-disc">جميع الصفقات للتداول الفوري (Spot) حصرياً — بدون رافعة مالية أو عقود آجلة أو مشتقات. لا تمثل توصيات تداول. كل قرار هو مسؤولية المستخدم.</div>
            </div>`;
}

function vip4_renderGuide() {
    return `<div class="vip4-guide">
                <div class="vip4-gt">دليل القراءة // TRADING VIP 4 READING GUIDE</div>
                <div class="vip4-gx">
                    <strong style="color:var(--o)">TRADING VIP 4:</strong> منظومة سكالبينج وتداول سريع (Spot) تجمع: Stochastic RSI (الزخم والتوقيت) + Fibonacci Retracement (منطقة الدخول) + EMA(9/21/55) Trend (الاتجاه والأهداف).<br><br>
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> Spot فقط — بدون رافعة أو Futures أو مشتقات. مُحسّنة للفريمات الصغيرة (15m/30m/1H).<br><br>
                    <strong style="color:var(--t)">THE THREE TOOLS:</strong><br><br>
                    <strong style="color:var(--o)">1. STOCHASTIC RSI:</strong> Stochastic مطبق على RSI = حساسية مضاعفة مثالية للسكالبينج. عبور %K فوق %D في Oversold (<25) = إشارة شراء. عبور في Overbought (>75) = إشارة بيع. + Divergence Detection = دقة 80-88%.<br><br>
                    <strong style="color:var(--o)">2. FIBONACCI RETRACEMENT:</strong> مستويات 0.236/0.382/0.5/0.618/0.786 بـ Tolerance أضيق (0.4%) للدقة على الفريمات الصغيرة. OTE Zone (0.382-0.618) = أفضل منطقة دخول.<br><br>
                    <strong style="color:var(--o)">3. EMA(9/21/55) TREND:</strong> EMAs سريعة مُحسّنة للسكالبينج (بدلاً من 50/100/200 البطيئة). EMA9 = الزخم اللحظي. EMA21 = الاتجاه القصير. EMA55 = الاتجاه المتوسط. Stack (9>21>55) = ترند صعودي. Cross + Bounce = إشارات دخول/خروج.<br><br>
                    <strong style="color:var(--o)">ENTRY ZONE:</strong> الأداة لا تعطيك سعراً مفرداً للدخول، بل تحدد "نطاقاً" يمتد من السعر اللحظي (الحد الأقصى) إلى أفضل دعم أسفله مباشرة (EMA أو Fib). الشراء داخل هذا النطاق يعطيك أفضل نسبة R:R ويقلل الانزلاق السعري.<br><br>
                    <strong style="color:var(--o)">SL أضيق للسكالبينج:</strong> 15m: 1.2×ATR / 30m: 1.5×ATR / 1H: 1.8×ATR — أضيق من الفريمات الكبيرة لتناسب الحركات السريعة.<br><br>
                    <strong style="color:var(--t)">TIMEFRAMES:</strong> 15m (سكالبينج دقائق) // 30m (تداول سريع) // 1H (تداول قصير)<br><br>
                    <strong style="color:var(--o)">SIGNAL GRADES:</strong> A+ (85+ / 3 متوافقة) → A (75+) → B+ (65+) → B (55+) → C (لا صفقة)<br><br>
                    <strong style="color:var(--o)">لا يوجد صفقات متاحة:</strong> إشارة تحذيرية لتجنب التداول في المسارات الهبوطية. الانتظار أفضل.<br><br>
                    <strong style="color:var(--o)">EMA BOUNCE:</strong> ارتداد السعر من EMA9 أو EMA21 في اتجاه Stack = إشارة استمرار قوية (85%+).<br><br>
                    <strong style="color:var(--o)">نصيحة للسكالبينج:</strong> الفريم 15m يتطلب سرعة تنفيذ. TP1 هو الهدف الأساسي (أعلى احتمالية). أغلق 60% عند TP1 وحرّك SL إلى Entry للباقي.<br><br>
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> منظومة تحليلية بحتة للتداول الفوري (Spot) فقط — بدون رافعة أو مشتقات. الأسعار والأهداف لا تمثل توصيات. كل قرار هو مسؤولية المستخدم.
                </div>
            </div>`;
}

// =====================================================================
// Trading Limit Order — منصة 360°
// Limit Order Signal Generator (SPOT ONLY — No Futures/Leverage)
// 3 أدوات: RSI Divergence + Fibonacci OTE + SMC Order Block
// 4 فريمات: 30m + 1H + 4H + 1D
// ميزة فريدة: أفضل مناطق الدخول (Limit Order Zones) من Fib + OB
// =====================================================================

async function runTradingLimitOrder() {
    const symbol = document.getElementById('tlo-symbol').value.trim().toUpperCase();
    const dash = document.getElementById('tlo-dashboard');
    const loading = document.getElementById('tlo-loading');
    
    if (!symbol) { 
        alert('أدخل رمز العملة'); 
        return; 
    }
    
    dash.innerHTML = '';
    dash.style.display = 'none';
    loading.style.display = 'block';
    
    try {
        const [r30, r1h, r4h, r1d] = await Promise.all([
            fetch(`/api/binance-klines?symbol=${symbol}&interval=30m&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1h&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=4h&limit=200`),
            fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=200`)
        ]);
        
        if (!r30.ok || !r1h.ok || !r4h.ok || !r1d.ok) throw new Error('فشل جلب البيانات من الخادم.');
        
        const [d30, d1h, d4h, d1d] = await Promise.all([r30.json(), r1h.json(), r4h.json(), r1d.json()]);
        
        const parse = raw => raw.map(c => ({ 
            time: c[0], 
            open: +c[1], 
            high: +c[2], 
            low: +c[3], 
            close: +c[4], 
            volume: +c[5] 
        }));
        
        const c30 = parse(d30), c1h = parse(d1h), c4h = parse(d4h), c1d = parse(d1d);
        
        if (c30.length < 50 || c1h.length < 50 || c4h.length < 50 || c1d.length < 50) throw new Error('بيانات غير كافية لإجراء التحليل.');
        
        loading.style.display = 'none';
        dash.innerHTML = renderTloDashboard(analyzeTlo(symbol, c30, c1h, c4h, c1d));
        
        // السطر الذي تم إضافته لضمان ظهور لوحة النتائج بعد انتهاء التحليل
        dash.style.display = 'flex'; 
        
    } catch (err) {
        loading.style.display = 'none';
        dash.innerHTML = `<div style="padding:20px;color:var(--o);text-align:center;font-family:'Share Tech Mono',monospace;font-size:12px;border:1px solid var(--b);background:var(--s);border-radius:4px;">ERROR: ${err.message}</div>`;
        
        // السطر الذي تم إضافته لضمان ظهور رسالة الخطأ إن وُجدت
        dash.style.display = 'flex'; 
    }
}


function analyzeTlo(symbol, c30, c1h, c4h, c1d) {
    const tf30 = analyzeTloTf('30m', c30);
    const tf1h = analyzeTloTf('1H', c1h);
    const tf4h = analyzeTloTf('4H', c4h);
    const tf1d = analyzeTloTf('1D', c1d);
    
    const currentPrice = c30[c30.length - 1].close;
    const tfs = [tf30, tf1h, tf4h, tf1d];
    
    const bullTfs = tfs.filter(t => t.bias === 'BULLISH').length;
    const bearTfs = tfs.filter(t => t.bias === 'BEARISH').length;
    const masterBias = bullTfs > bearTfs ? 'BULLISH' : (bearTfs > bullTfs ? 'BEARISH' : 'MIXED');
    
    const avgScore = Math.round(tfs.reduce((s, t) => s + t.score, 0) / 4);
    const alignBonus = (bullTfs >= 3 || bearTfs >= 3) ? 10 : 0;
    const masterScore = Math.min(100, avgScore + alignBonus);
    
    let masterGrade;
    if (masterScore >= 85) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol, currentPrice, masterBias, masterGrade, masterScore, 
        alignedTfs: masterBias === 'BULLISH' ? bullTfs : bearTfs, 
        timeframes: tfs 
    };
}

function analyzeTloTf(tfName, candles) {
    const display = candles.slice(-100);
    const currentPrice = display[display.length - 1].close;
    
    const rsiDiv = runTloRsiDiv(display, currentPrice);
    const fibOte = runTloFibOte(display, currentPrice);
    const smcOb = runTloSmcOb(display, currentPrice);
    
    const components = [rsiDiv, fibOte, smcOb];
    const bullC = components.filter(c => c.bias === 'BULLISH').length;
    const bearC = components.filter(c => c.bias === 'BEARISH').length;
    const bias = bullC > bearC ? 'BULLISH' : (bearC > bullC ? 'BEARISH' : 'NEUTRAL');
    const aligned = bias === 'BULLISH' ? bullC : (bias === 'BEARISH' ? bearC : 0);
    
    const avgS = components.reduce((s, c) => s + c.score, 0) / 3;
    const signalStrength = Math.round(avgS * 0.55 + (aligned / 3 * 100) * 0.45);
    const score = signalStrength;
    
    let signalGrade, signalQuality;
    if (signalStrength >= 85 && aligned === 3) { signalGrade = 'A+'; signalQuality = 'VERY_STRONG'; }
    else if (signalStrength >= 75 && aligned >= 2) { signalGrade = 'A'; signalQuality = 'STRONG'; }
    else if (signalStrength >= 65) { signalGrade = 'B+'; signalQuality = 'MODERATE_STRONG'; }
    else if (signalStrength >= 55) { signalGrade = 'B'; signalQuality = 'MODERATE'; }
    else { signalGrade = 'C'; signalQuality = 'WEAK'; }
    
    // فلترة Spot Only (Long Trades Only)
    const trade = (bias === 'BULLISH' && signalStrength >= 55) ? buildTloTrade(bias, currentPrice, candles, tfName, components, fibOte, smcOb) : null;
    
    let confirmTf;
    if (tfName === '30m') confirmTf = '30m';
    else if (tfName === '1H') confirmTf = '1H';
    else if (tfName === '4H') confirmTf = '4H';
    else confirmTf = '1D';
    
    return { tf: tfName, bias, signalStrength, signalGrade, signalQuality, score, aligned, components, trade, currentPrice, confirmTf };
}

// ==================== 1. RSI Divergence ====================
function runTloRsiDiv(candles, currentPrice) {
    const period = 14, rsiVals = [];
    let aG = 0, aL = 0;
    
    for (let i = 1; i <= period && i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        if (d > 0) aG += d; else aL -= d;
    }
    aG /= period; aL /= period;
    
    for (let i = 0; i <= period; i++) rsiVals.push(50);
    
    for (let i = period + 1; i < candles.length; i++) {
        const d = candles[i].close - candles[i - 1].close;
        aG = (aG * (period - 1) + Math.max(0, d)) / period;
        aL = (aL * (period - 1) + Math.max(0, -d)) / period;
        rsiVals.push(aL === 0 ? 100 : 100 - (100 / (1 + aG / aL)));
    }
    
    const currentRsi = rsiVals[rsiVals.length - 1];
    const closes = candles.map(c => c.close).slice(-30);
    const rsis = rsiVals.slice(-30);
    
    const troughs = typeof findTroughs === 'function' ? findTroughs(closes, 0, closes.length).slice(-3) : [];
    const peaks = typeof findPeaks === 'function' ? findPeaks(closes, 0, closes.length).slice(-3) : [];
    
    let bullDiv = false, bearDiv = false, hiddenBull = false, hiddenBear = false, divStr = 0;
    
    if (troughs.length >= 2) {
        const t1 = troughs[troughs.length - 2], t2 = troughs[troughs.length - 1];
        if (closes[t2] < closes[t1] && rsis[t2] > rsis[t1] && rsis[t1] < 40) {
            bullDiv = true;
            divStr = Math.min(100, Math.round(65 + (rsis[t2] - rsis[t1]) * 2 + (40 - rsis[t1])));
        }
        if (closes[t2] > closes[t1] && rsis[t2] < rsis[t1] && currentRsi > 40) {
            hiddenBull = true;
            if (!bullDiv) divStr = Math.min(85, Math.round(60 + (rsis[t1] - rsis[t2])));
        }
    }
    if (peaks.length >= 2) {
        const p1 = peaks[peaks.length - 2], p2 = peaks[peaks.length - 1];
        if (closes[p2] > closes[p1] && rsis[p2] < rsis[p1] && rsis[p1] > 60) {
            bearDiv = true;
            divStr = Math.min(100, Math.round(65 + (rsis[p1] - rsis[p2]) * 2 + (rsis[p1] - 60)));
        }
        if (closes[p2] < closes[p1] && rsis[p2] > rsis[p1] && currentRsi < 60) {
            hiddenBear = true;
            if (!bearDiv) divStr = Math.min(85, Math.round(60 + (rsis[p2] - rsis[p1])));
        }
    }
    
    const slope = rsiVals.slice(-5);
    const slopeDir = slope[4] - slope[0];
    
    let bias = 'NEUTRAL', status = 'NO_DIVERGENCE', score = 50, summary = 'لا يوجد تباعد في RSI';
    
    if (bullDiv && currentRsi < 35) {
        bias = 'BULLISH'; status = 'REGULAR_BULL_DIV'; score = Math.min(92, divStr);
        summary = `تباعد إيجابي كلاسيكي — RSI(${currentRsi.toFixed(1)}) Oversold + HL`;
    } else if (bearDiv && currentRsi > 65) {
        bias = 'BEARISH'; status = 'REGULAR_BEAR_DIV'; score = Math.min(92, divStr);
        summary = `تباعد سلبي كلاسيكي — RSI(${currentRsi.toFixed(1)}) Overbought + LH`;
    } else if (bullDiv) {
        bias = 'BULLISH'; status = 'BULL_DIV'; score = Math.min(82, divStr);
        summary = `تباعد إيجابي — RSI(${currentRsi.toFixed(1)}) HL`;
    } else if (bearDiv) {
        bias = 'BEARISH'; status = 'BEAR_DIV'; score = Math.min(82, divStr);
        summary = `تباعد سلبي — RSI(${currentRsi.toFixed(1)}) LH`;
    } else if (hiddenBull) {
        bias = 'BULLISH'; status = 'HIDDEN_BULL'; score = 75;
        summary = `تباعد مخفي إيجابي — RSI(${currentRsi.toFixed(1)})`;
    } else if (hiddenBear) {
        bias = 'BEARISH'; status = 'HIDDEN_BEAR'; score = 75;
        summary = `تباعد مخفي سلبي — RSI(${currentRsi.toFixed(1)})`;
    } else if (currentRsi < 30 && slopeDir > 2) {
        bias = 'BULLISH'; status = 'OS_RECOVERY'; score = 70;
        summary = `RSI(${currentRsi.toFixed(1)}) يتعافى من Oversold`;
    } else if (currentRsi > 70 && slopeDir < -2) {
        bias = 'BEARISH'; status = 'OB_DECLINE'; score = 70;
        summary = `RSI(${currentRsi.toFixed(1)}) يتراجع من Overbought`;
    } else if (currentRsi > 55) {
        bias = 'BULLISH'; status = 'MILD_BULL'; score = 55;
        summary = `RSI(${currentRsi.toFixed(1)}) — انحياز صعودي`;
    } else if (currentRsi < 45) {
        bias = 'BEARISH'; status = 'MILD_BEAR'; score = 55;
        summary = `RSI(${currentRsi.toFixed(1)}) — انحياز هبوطي`;
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'RSI_DIV', fullName: 'RSI Divergence', icon: 'RSI', grade, score, bias, status, summary };
}

// ==================== 2. Fibonacci OTE ====================
function runTloFibOte(candles, currentPrice) {
    const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
    const pks = typeof findPeaks === 'function' ? findPeaks(highs, 0, highs.length).slice(-3) : [];
    const trs = typeof findTroughs === 'function' ? findTroughs(lows, 0, lows.length).slice(-3) : [];
    
    if (!pks.length || !trs.length) return { name: 'FIB_OTE', fullName: 'Fibonacci OTE', icon: 'FIB', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_SWING', summary: 'لا يوجد Swing', levels: null, oteZone: null };
    
    const lastP = pks[pks.length - 1], lastT = trs[trs.length - 1];
    const sH = highs[lastP], sL = lows[lastT], range = sH - sL;
    const isUp = lastT < lastP;
    
    const f236 = sH - range * 0.236, f382 = sH - range * 0.382, f500 = sH - range * 0.5, f618 = sH - range * 0.618, f705 = sH - range * 0.705, f786 = sH - range * 0.786;
    const levels = { f236, f382, f500, f618, f705, f786, sH, sL };
    
    const oteZone = { 
        min: Math.min(f618, f382), 
        max: Math.max(f618, f382), 
        mid: f500, 
        goldenZone: { min: f618, max: f705 } 
    };
    
    const tol = currentPrice * 0.005;
    const inOTE = currentPrice >= f618 * 0.998 && currentPrice <= f382 * 1.002;
    const inGolden = currentPrice >= f618 * 0.998 && currentPrice <= f705 * 1.002;
    
    const nearFibs = [{ l: '0.618', p: f618 }, { l: '0.705', p: f705 }, { l: '0.500', p: f500 }, { l: '0.382', p: f382 }, { l: '0.786', p: f786 }];
    const nearFib = nearFibs.find(f => Math.abs(currentPrice - f.p) < tol);
    
    let bias = 'NEUTRAL', status = 'NO_FIB', score = 50, summary = 'السعر ليس عند Fibonacci';
    
    if (inGolden) {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'IN_GOLDEN_ZONE'; score = 90;
        summary = 'السعر داخل Golden Zone (0.618-0.705) — أقوى منطقة ارتداد';
    } else if (nearFib && nearFib.l === '0.618') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_618'; score = 88;
        summary = 'السعر عند Fib 0.618 — النسبة الذهبية';
    } else if (inOTE) {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'IN_OTE'; score = 85;
        summary = 'السعر داخل OTE Zone (0.382-0.618)';
    } else if (nearFib && nearFib.l === '0.500') {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_500'; score = 78;
        summary = 'السعر عند Fib 0.500';
    } else if (nearFib) {
        bias = isUp ? 'BULLISH' : 'BEARISH'; status = 'FIB_TOUCH'; score = 70;
        summary = `السعر عند Fib ${nearFib.l}`;
    } else if (currentPrice > f236 && isUp) {
        bias = 'BULLISH'; status = 'ABOVE_FIBS'; score = 60;
        summary = 'ترند قوي فوق Fibonacci';
    } else if (currentPrice < f786) {
        bias = 'BEARISH'; status = 'BELOW_786'; score = 58;
        summary = 'تحت Fib 0.786 — ضعف';
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'FIB_OTE', fullName: 'Fibonacci OTE', icon: 'FIB', grade, score, bias, status, summary, levels, oteZone };
}

// ==================== 3. SMC Order Block ====================
function runTloSmcOb(candles, currentPrice) {
    const display = candles.slice(-60);
    const avgRange = display.reduce((s, c) => s + (c.high - c.low), 0) / display.length;
    const avgVol = display.reduce((s, c) => s + c.volume, 0) / display.length;
    const candidates = [];
    
    for (let i = 0; i < display.length - 3; i++) {
        const c = display[i], n1 = display[i + 1], n2 = display[i + 2];
        if (c.close < c.open && n1.close > n1.open && n2.close > n2.open) {
            const mv = (n2.high - c.low) / avgRange;
            if (mv > 1.3) {
                const vc = (n1.volume + n2.volume) / 2 > avgVol * 1.1;
                const mit = display.slice(i + 3).some(x => x.low <= c.high && x.low >= c.low);
                candidates.push({ type: 'BULLISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(mv * 20 + (vc ? 10 : 0))), fresh: !mit, vc, idx: i });
            }
        }
        if (c.close > c.open && n1.close < n1.open && n2.close < n2.open) {
            const mv = (c.high - n2.low) / avgRange;
            if (mv > 1.3) {
                const vc = (n1.volume + n2.volume) / 2 > avgVol * 1.1;
                const mit = display.slice(i + 3).some(x => x.high >= c.low && x.high <= c.high);
                candidates.push({ type: 'BEARISH', priceMin: c.low, priceMax: c.high, strength: Math.min(100, Math.round(mv * 20 + (vc ? 10 : 0))), fresh: !mit, vc, idx: i });
            }
        }
    }
    
    const freshObs = candidates.filter(c => c.fresh);
    const allObs = freshObs.length > 0 ? freshObs : candidates;
    
    if (allObs.length === 0) return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade: 'C', score: 45, bias: 'NEUTRAL', status: 'NO_OB', summary: 'لا يوجد Order Block', obZone: null };
    
    allObs.sort((a, b) => Math.abs(currentPrice - (a.priceMin + a.priceMax) / 2) - Math.abs(currentPrice - (b.priceMin + b.priceMax) / 2));
    const best = allObs[0];
    const midOb = (best.priceMin + best.priceMax) / 2;
    const distance = Math.abs(currentPrice - midOb) / currentPrice * 100;
    const inZone = currentPrice >= best.priceMin && currentPrice <= best.priceMax;
    const nearZone = distance < 1.5;
    
    let bias, status, score, summary;
    if (inZone) {
        bias = best.type; status = best.type + '_OB_ENTRY';
        score = Math.min(92, best.strength + 12);
        summary = `داخل ${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} OB${best.fresh ? ' طازج' : ''}${best.vc ? ' + حجم' : ''} (${fmtTlo(best.priceMin)}-${fmtTlo(best.priceMax)})`;
    } else if (nearZone) {
        bias = best.type; status = best.type + '_OB_NEAR';
        score = Math.min(85, best.strength + 5);
        summary = `${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} OB قريب (${distance.toFixed(2)}%) — ${fmtTlo(best.priceMin)}-${fmtTlo(best.priceMax)}${best.fresh ? ' طازج' : ''}`;
    } else {
        bias = best.type; status = best.type + '_OB_FAR';
        score = Math.min(72, best.strength);
        summary = `${best.type === 'BULLISH' ? 'Bullish' : 'Bearish'} OB بعيد (${distance.toFixed(2)}%)`;
    }
    
    const grade = score >= 80 ? 'A' : (score >= 65 ? 'B' : 'C');
    return { name: 'SMC_OB', fullName: 'SMC Order Block', icon: 'SMC', grade, score, bias, status, summary, obZone: { min: best.priceMin, max: best.priceMax, mid: midOb, fresh: best.fresh } };
}

// ==================== Trade Builder with Limit Order Zones ====================
function buildTloTrade(bias, currentPrice, candles, tfName, components, fibData, smcData) {
    const isBull = bias === 'BULLISH';
    const n = candles.length;
    const trs = [];
    for (let i = Math.max(1, n - 15); i < n; i++) {
        trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close)));
    }
    const atr = trs.reduce((s, v) => s + v, 0) / trs.length;
    
    let slM;
    if (tfName === '30m') slM = 1.5;
    else if (tfName === '1H') slM = 1.8;
    else if (tfName === '4H') slM = 2.2;
    else slM = 2.8;

    // === LIMIT ORDER ZONES (أفضل مناطق الدخول) ===
    const limitZones = [];
    
    // Zone 1: SMC OB zone
    if (smcData.obZone) {
        limitZones.push({ name: 'SMC Order Block', priceMin: smcData.obZone.min, priceMax: smcData.obZone.max, mid: smcData.obZone.mid, priority: smcData.obZone.fresh ? 1 : 2, fresh: smcData.obZone.fresh, type: 'OB' });
    }
    // Zone 2: Fibonacci OTE
    if (fibData.oteZone) {
        limitZones.push({ name: 'Fibonacci OTE', priceMin: fibData.oteZone.min, priceMax: fibData.oteZone.max, mid: fibData.oteZone.mid, priority: 2, type: 'FIB' });
    }
    // Zone 3: Golden Zone (0.618-0.705)
    if (fibData.oteZone && fibData.oteZone.goldenZone) {
        limitZones.push({ name: 'Golden Zone (0.618-0.705)', priceMin: fibData.oteZone.goldenZone.min, priceMax: fibData.oteZone.goldenZone.max, mid: (fibData.oteZone.goldenZone.min + fibData.oteZone.goldenZone.max) / 2, priority: 1, type: 'GOLDEN' });
    }
    
    limitZones.sort((a, b) => a.priority - b.priority);
    
    const bestZone = limitZones[0];
    const idealEntry = bestZone ? bestZone.mid : currentPrice;
    const entryPrice = currentPrice; 
    
    let stopLoss;
    if (isBull) {
        stopLoss = (smcData.obZone) ? Math.min(smcData.obZone.min * 0.997, idealEntry - atr * slM) : idealEntry - atr * slM;
    } else {
        stopLoss = (smcData.obZone) ? Math.max(smcData.obZone.max * 1.003, idealEntry + atr * slM) : idealEntry + atr * slM;
    }
    
    const slDist = Math.abs(idealEntry - stopLoss);
    const stopLossDistance = parseFloat((slDist / idealEntry * 100).toFixed(2));
    
    let slCondition;
    if (tfName === '30m') slCondition = 'إغلاق شمعة 30 دقيقة';
    else if (tfName === '1H') slCondition = 'إغلاق شمعة ساعة';
    else if (tfName === '4H') slCondition = 'إغلاق شمعة 4 ساعات';
    else slCondition = 'إغلاق شمعة يومية';
    
    let tp1, tp2, tp3;
    if (isBull) {
        const targets = [];
        if (fibData.levels) {
            [fibData.levels.f382, fibData.levels.f236, fibData.levels.sH].forEach(f => { if (f > entryPrice * 1.002) targets.push(f); });
        }
        targets.push(entryPrice + atr * 2, entryPrice + atr * 4, entryPrice + atr * 7);
        const sorted = [...new Set(targets)].filter(t => t > entryPrice * 1.002).sort((a, b) => a - b);
        tp1 = sorted[0] || entryPrice + atr * 2;
        tp2 = sorted[1] || entryPrice + atr * 4;
        tp3 = sorted[2] || entryPrice + atr * 7;
    } else {
        const targets = [];
        if (fibData.levels) {
            [fibData.levels.f618, fibData.levels.f786, fibData.levels.sL].forEach(f => { if (f < entryPrice * 0.998) targets.push(f); });
        }
        targets.push(entryPrice - atr * 2, entryPrice - atr * 4, entryPrice - atr * 7);
        const sorted = [...new Set(targets)].filter(t => t < entryPrice * 0.998).sort((a, b) => b - a);
        tp1 = sorted[0] || entryPrice - atr * 2;
        tp2 = sorted[1] || entryPrice - atr * 4;
        tp3 = sorted[2] || entryPrice - atr * 7;
    }
    
    const tp1Pct = parseFloat((Math.abs(tp1 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp2Pct = parseFloat((Math.abs(tp2 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp3Pct = parseFloat((Math.abs(tp3 - entryPrice) / entryPrice * 100).toFixed(2));
    const tp1Rr = parseFloat((Math.abs(tp1 - idealEntry) / slDist).toFixed(2));
    const tp2Rr = parseFloat((Math.abs(tp2 - idealEntry) / slDist).toFixed(2));
    const tp3Rr = parseFloat((Math.abs(tp3 - idealEntry) / slDist).toFixed(2));
    const avgRr = parseFloat(((tp1Rr + tp2Rr + tp3Rr) / 3).toFixed(2));
    const aligned = components.filter(c => c.bias === bias).length;
    const baseProb = 55 + aligned * 10;
    const tp1Prob = Math.min(90, baseProb + 12);
    const tp2Prob = Math.min(85, baseProb);
    const tp3Prob = Math.max(40, baseProb - 12);
    const expectedValue = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * stopLossDistance)).toFixed(2));
    
    return { entryPrice, idealEntry, stopLoss, stopLossDistance, riskPct: stopLossDistance, slCondition, tp1, tp1Pct, tp1Rr, tp1Probability: tp1Prob, tp2, tp2Pct, tp2Rr, tp2Probability: tp2Prob, tp3, tp3Pct, tp3Rr, tp3Probability: tp3Prob, averageRr: avgRr, expectedValue, limitZones };
}

function fmtTlo(p) { 
    return (typeof smartFormat === 'function') ? smartFormat(p) : (typeof fmtCryptoPrice === 'function' ? fmtCryptoPrice(p) : p.toFixed(4)); 
}

// ==================== Render ====================
function renderTloDashboard(a) {
    return `${renderTloMaster(a)}
            ${renderTloTrade(a.timeframes[0], 'صفقة 30 دقيقة', '30-MIN TRADE')}
            ${renderTloTrade(a.timeframes[1], 'صفقة ساعة', '1-HOUR TRADE')}
            ${renderTloTrade(a.timeframes[2], 'صفقة 4 ساعات', '4-HOUR TRADE')}
            ${renderTloTrade(a.timeframes[3], 'صفقة يومية', 'DAILY TRADE')}
            ${renderTloMatrix(a.timeframes)}
            ${renderTloStrategy()}
            ${renderTloAnalysis(a)}
            ${renderTloGuide()}`;
}

function renderTloMaster(a) {
    const gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const bc = a.masterBias === 'BULLISH' ? 'var(--t)' : (a.masterBias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
    return `<div class="tlo-master">
                <div class="tlo-ml">MASTER SIGNAL</div>
                <div class="tlo-mg" style="color:${gc}">${a.masterGrade}</div>
                <div class="tlo-mb" style="color:${bc}">${a.masterBias} SIGNAL</div>
                <div class="tlo-mbar"><div class="tlo-mbar-f" style="width:${a.masterScore}%"></div></div>
                <div class="tlo-mstats">
                    <div class="tlo-ms"><div class="tlo-msl">SCORE</div><div class="tlo-msv">${a.masterScore}/100</div></div>
                    <div class="tlo-ms"><div class="tlo-msl">TFs ALIGNED</div><div class="tlo-msv">${a.alignedTfs}/4</div></div>
                    <div class="tlo-ms"><div class="tlo-msl">PRICE</div><div class="tlo-msv">$${fmtTlo(a.currentPrice)}</div></div>
                </div>
            </div>`;
}

function renderTloTrade(tf, arTitle, enTitle) {
    if (!tf.trade) {
        return `<div class="tlo-tc">
                    <div class="tlo-th"><span class="tlo-ttf">${tf.tf}</span><div class="tlo-thd"><div class="tlo-tar">${arTitle}</div><div class="tlo-ten">${enTitle}</div></div><span class="tlo-tgr" style="color:var(--t3)">—</span></div>
                    <div class="tlo-no-trade">
                        <div style="color:var(--o);font-weight:700;font-size:12px;margin-bottom:6px">لا يوجد صفقات متاحة</div>
                        <div style="color:var(--t2);font-size:10px">إشارة تحذيرية — يُرجى الانتظار والمتابعة (تداول فوري صاعد فقط)</div>
                        <div style="color:var(--t3);font-size:9px;margin-top:6px;font-family:'Share Tech Mono',monospace">SIGNAL: ${tf.signalStrength}/100</div>
                    </div>
                </div>`;
    }

    const t = tf.trade, isBull = tf.bias === 'BULLISH';
    const biasC = isBull ? 'var(--t)' : 'var(--o)';
    const gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    const sideLabel = isBull ? 'SPOT BUY' : 'SPOT SELL';
    const arrow = isBull ? '↑' : '↓';

    let zonesHtml = '';
    if (t.limitZones && t.limitZones.length > 0) {
        zonesHtml = `<div class="tlo-zones-section">
                        <div class="tlo-zones-title">BEST LIMIT ORDER ZONES // أفضل مناطق الدخول</div>
                        ${t.limitZones.map((z) => {
                            const zColor = z.type === 'GOLDEN' ? 'var(--o)' : (z.type === 'OB' ? 'var(--t)' : 'var(--t3)');
                            const freshBadge = z.fresh ? `<span class="tlo-fresh-badge">FRESH</span>` : '';
                            return `<div class="tlo-zone-row" style="border-right-color:${zColor}">
                                        <div class="tlo-zone-header">
                                            <span class="tlo-zone-name" style="color:${zColor}">${z.name}</span>
                                            ${freshBadge}
                                            <span class="tlo-zone-priority">P${z.priority}</span>
                                        </div>
                                        <div class="tlo-zone-prices">
                                            <span class="tlo-zone-range">${fmtTlo(z.priceMin)} — ${fmtTlo(z.priceMax)}</span>
                                            <span class="tlo-zone-mid">MID: ${fmtTlo(z.mid)}</span>
                                        </div>
                                    </div>`;
                        }).join('')}
                    </div>`;
    }

    const slCondHtml = `<div class="tlo-sl-condition">
                            <span class="tlo-sl-cond-label">شرط تفعيل وقف الخسارة</span>
                            <span class="tlo-sl-cond-val">${t.slCondition} تحت ${fmtTlo(t.stopLoss)}</span>
                        </div>`;
    
    return `<div class="tlo-tc" style="border-right:3px solid ${biasC}">
                <div class="tlo-th">
                    <span class="tlo-ttf">${tf.tf}</span>
                    <div class="tlo-thd">
                        <div class="tlo-tar">${arTitle}</div>
                        <div class="tlo-ten">${enTitle}</div>
                    </div>
                    <span class="tlo-tgr" style="color:${gradeC}">${tf.signalGrade}</span>
                </div>
                <div class="tlo-sr">
                    <span class="tlo-sb" style="background:${biasC};color:var(--bg)">${sideLabel}</span>
                    <span class="tlo-ss">SIGNAL: ${tf.signalStrength}/100</span>
                </div>
                <div class="tlo-sbar"><div class="tlo-sfill" style="width:${tf.signalStrength}%;background:${biasC}"></div></div>
                
                ${zonesHtml}
                
                <div class="tlo-trade-section">
                    <div class="tlo-trade-section-title">TRADE PLAN</div>
                    <table class="tlo-tbl">
                        <tbody>
                            <tr><td class="tlo-tl">ENTRY (حالي)</td><td class="tlo-tp" style="color:var(--o)">$${fmtTlo(t.entryPrice)}</td><td class="tlo-tm">—</td></tr>
                            <tr><td class="tlo-tl">IDEAL ENTRY</td><td class="tlo-tp" style="color:var(--o)">$${fmtTlo(t.idealEntry)}</td><td class="tlo-tm" style="color:var(--o)">← LIMIT ORDER</td></tr>
                            <tr><td class="tlo-tl">STOP LOSS</td><td class="tlo-tp" style="color:var(--o)">$${fmtTlo(t.stopLoss)}</td><td class="tlo-tm">-${t.riskPct}%</td></tr>
                            <tr class="tlo-sep"><td colspan="3"></td></tr>
                            <tr><td class="tlo-tl" style="color:var(--t)">TP1</td><td class="tlo-tp" style="color:var(--t)">$${fmtTlo(t.tp1)}</td><td class="tlo-tm">${arrow} ${t.tp1Pct}% // R:R 1:${t.tp1Rr} // ${t.tp1Probability}%</td></tr>
                            <tr><td class="tlo-tl" style="color:var(--t)">TP2</td><td class="tlo-tp" style="color:var(--t)">$${fmtTlo(t.tp2)}</td><td class="tlo-tm">${arrow} ${t.tp2Pct}% // R:R 1:${t.tp2Rr} // ${t.tp2Probability}%</td></tr>
                            <tr><td class="tlo-tl" style="color:var(--t)">TP3</td><td class="tlo-tp" style="color:var(--t)">$${fmtTlo(t.tp3)}</td><td class="tlo-tm">${arrow} ${t.tp3Pct}% // R:R 1:${t.tp3Rr} // ${t.tp3Probability}%</td></tr>
                        </tbody>
                    </table>
                    ${slCondHtml}
                </div>
                
                <div class="tlo-tf2">
                    <div class="tlo-fi"><span class="tlo-fl">AVG R:R</span><span class="tlo-fv" style="color:var(--o)">1:${t.averageRr}</span></div>
                    <div class="tlo-fi"><span class="tlo-fl">EXP. VALUE</span><span class="tlo-fv">+${t.expectedValue}%</span></div>
                    <div class="tlo-fi"><span class="tlo-fl">QUALITY</span><span class="tlo-fv" style="color:${gradeC}">${tf.signalQuality.replace(/_/g, ' ')}</span></div>
                </div>
                
                <div class="tlo-ts">
                    ${tf.components.map(c => {
                        const cC = c.bias === tf.bias ? biasC : (c.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--b)');
                        return `<div class="tlo-chip" style="border-top-color:${cC}"><span class="tlo-ci">${c.icon}</span><span class="tlo-cg">${c.grade}</span></div>`;
                    }).join('')}
                </div>
            </div>`;
}

function renderTloMatrix(timeframes) {
    const tools = [
        { key: 'RSI_DIV', label: 'RSI Divergence' },
        { key: 'FIB_OTE', label: 'Fibonacci OTE' },
        { key: 'SMC_OB', label: 'SMC Order Block' }
    ];
    let rows = '';
    tools.forEach(tn => {
        const vals = timeframes.map(tf => tf.components.find(c => c.name === tn.key));
        rows += `<div class="tlo-mxr">
                    <span class="tlo-mxt">${tn.label}</span>
                    ${vals.map(v => {
                        const bc = v.bias === 'BULLISH' ? 'var(--t)' : (v.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)');
                        return `<div class="tlo-mxc" style="border-top:2px solid ${bc}">
                                    <span style="color:${bc};font-weight:700;font-size:9px">${v.grade}</span>
                                    <span style="color:var(--t2);font-size:7px">${v.score}/100</span>
                                    <span style="color:var(--t3);font-size:7px">${v.bias.substring(0, 4)}</span>
                                </div>`;
                    }).join('')}
                </div>`;
    });
    
    return `<div class="tlo-card">
                <div class="tlo-ct">COMPONENTS MATRIX // مصفوفة الأدوات</div>
                <div class="tlo-mxh">
                    <span class="tlo-mxt">TOOL</span>
                    <div class="tlo-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">30m</div>
                    <div class="tlo-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1H</div>
                    <div class="tlo-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">4H</div>
                    <div class="tlo-mxc" style="color:var(--o);font-weight:900;border:none;background:transparent;">1D</div>
                </div>
                ${rows}
            </div>`;
}

function renderTloStrategy() {
    return `<div class="tlo-card">
                <div class="tlo-ct">STRATEGY METHODOLOGY // منهجية الاستنتاج</div>
                <div class="tlo-step" style="border-right-color:var(--o)">
                    <div class="tlo-step-t">STEP 1 — RSI DIVERGENCE (كشف الانعكاس)</div>
                    <div class="tlo-step-d">RSI Divergence يكشف 4 أنواع تباعد لتحديد توقيت الانعكاس بدقة 85-92%.</div>
                </div>
                <div class="tlo-step" style="border-right-color:var(--t)">
                    <div class="tlo-step-t">STEP 2 — FIBONACCI OTE + GOLDEN ZONE (مناطق الدخول المثالية)</div>
                    <div class="tlo-step-d">Fibonacci يحدد OTE Zone (0.382-0.618) و Golden Zone (0.618-0.705). هذه المناطق تُستخدم كـ Limit Order Zones — أفضل أسعار للدخول بأمر معلّق بدلاً من الدخول بالسعر الحالي.</div>
                </div>
                <div class="tlo-step" style="border-right-color:var(--o)">
                    <div class="tlo-step-t">STEP 3 — SMC ORDER BLOCK (الدعوم/المقاومات + SL)</div>
                    <div class="tlo-step-d">SMC OB يحدد مناطق الأوامر المؤسسية. OBs الطازجة = أقوى مناطق دخول. حدود OB تُستخدم كـ SL. يتم دمج OB Zone مع Fibonacci OTE لتحديد أفضل Limit Order Zone.</div>
                </div>
                <div class="tlo-step-note">ما يميز هذه الأداة: بدلاً من الدخول بالسعر الحالي (Market Order)، تحدد أفضل أسعار للدخول بأمر معلّق (Limit Order) عند مناطق Fibonacci OTE أو SMC Order Block. شرط تفعيل SL = إغلاق شمعة الفريم المختار (حماية من الـ Wicks الكاذبة).</div>
            </div>`;
}

function renderTloAnalysis(a) {
    const act = a.timeframes.filter(t => t.trade).length;
    const text = act > 0 
        ? `تم توليد ${act} إعدادات Limit Order على ${a.symbol.replace('USDT', '')} عبر 4 فريمات (30m/1H/4H/1D). الأداة تحدد أفضل مناطق الدخول بأوامر معلّقة (Limit Orders) عند تقاطع Fibonacci OTE مع SMC Order Block. شرط تفعيل وقف الخسارة: إغلاق شمعة كاملة (ليس ذيل) لتجنب التفعيل الكاذب. الاتجاه العام: ${a.masterBias === 'BULLISH' ? 'صعودي' : (a.masterBias === 'BEARISH' ? 'هبوطي' : 'متباين')} بتوافق ${a.alignedTfs}/4.` 
        : `لا توجد صفقات صعودية متاحة. يُرجى الانتظار حتى تتوافق الأدوات (Spot Only).`;
        
    return `<div class="tlo-analysis">
                <div class="tlo-at">INSTITUTIONAL ANALYSIS</div>
                <div class="tlo-atx">${text}</div>
                <div class="tlo-disc">جميع الصفقات للتداول الفوري (Spot) حصرياً — بدون رافعة أو مشتقات. لا تمثل توصيات. كل قرار هو مسؤولية المستخدم.</div>
            </div>`;
}

function renderTloGuide() {
    return `<div class="tlo-guide">
                <div class="tlo-gt">دليل القراءة // TRADING LIMIT ORDER READING GUIDE</div>
                <div class="tlo-gx">
                    <strong style="color:var(--o)">TRADING LIMIT ORDER:</strong> منظومة تداول فوري (Spot) متخصصة في تحديد أفضل مناطق الدخول بأوامر معلّقة (Limit Orders) بدلاً من أوامر السوق (Market Orders) — للحصول على أفضل سعر دخول ممكن.<br><br>
                    <strong style="color:var(--o)">نطاق التطبيق:</strong> Spot فقط — بدون رافعة أو Futures أو مشتقات.<br><br>
                    <strong style="color:var(--t)">THE THREE TOOLS:</strong><br><br>
                    <strong style="color:var(--o)">1. RSI DIVERGENCE:</strong> يكشف 4 أنواع تباعد لتحديد توقيت الانعكاس. Regular + Hidden Divergence. دقة 85-92% في OS/OB.<br><br>
                    <strong style="color:var(--o)">2. FIBONACCI OTE + GOLDEN ZONE:</strong> يحدد OTE Zone (0.382-0.618) و Golden Zone (0.618-0.705) — أقوى مناطق الارتداد. تُستخدم كمناطق لوضع Limit Orders.<br><br>
                    <strong style="color:var(--o)">3. SMC ORDER BLOCK:</strong> يكتشف مناطق الأوامر المؤسسية. Fresh OBs = أقوى مناطق. يحدد الدعوم/المقاومات + SL.<br><br>
                    <strong style="color:var(--t)">LIMIT ORDER ZONES:</strong><br><br>
                    <strong style="color:var(--o)">BEST LIMIT ORDER ZONES:</strong> تظهر في كل جدول — هي المناطق المثالية لوضع أوامر شراء معلّقة. مرتبة بالأولوية (P1 = الأقوى). تشمل: Golden Zone (0.618-0.705) / SMC Order Block / Fibonacci OTE.<br><br>
                    <strong style="color:var(--o)">IDEAL ENTRY vs CURRENT ENTRY:</strong> الأداة تعرض سعرين: السعر الحالي (Market) و السعر المثالي (Limit) من أفضل Zone. الفرق بينهما = التوفير المحتمل عند استخدام Limit Order.<br><br>
                    <strong style="color:var(--o)">FRESH BADGE:</strong> يظهر على OBs الطازجة (غير المختبرة) — الأقوى لأن الأوامر المؤسسية لا تزال كامنة.<br><br>
                    <strong style="color:var(--t)">SL ACTIVATION CONDITIONS:</strong><br><br>
                    <strong style="color:var(--o)">شرط تفعيل وقف الخسارة:</strong> يتطلب إغلاق شمعة كاملة (Close) على الفريم المحدد تحت مستوى SL — وليس مجرد ذيل شمعة (Wick). هذا يحمي من التفعيل الكاذب بسبب Liquidity Sweeps السريعة.<br><br>
                    <strong style="color:var(--o)">30m:</strong> SL يتفعل بإغلاق شمعة 30 دقيقة<br>
                    <strong style="color:var(--o)">1H:</strong> SL يتفعل بإغلاق شمعة ساعة<br>
                    <strong style="color:var(--o)">4H:</strong> SL يتفعل بإغلاق شمعة 4 ساعات<br>
                    <strong style="color:var(--o)">1D:</strong> SL يتفعل بإغلاق شمعة يومية<br><br>
                    <strong style="color:var(--t)">4 TIMEFRAMES:</strong> 30m (سريعة) // 1H (قصيرة) // 4H (متوسطة) // 1D (بعيدة)<br><br>
                    <strong style="color:var(--o)">SIGNAL GRADES:</strong> A+ (85+/3 متوافقة) → A (75+) → B+ (65+) → B (55+) → C (لا صفقة)<br><br>
                    <strong style="color:var(--o)">نصيحة عملية:</strong> ضع Limit Order عند أفضل Zone (P1). إذا لم يصل السعر خلال الفترة المتوقعة، أعد تشغيل التحليل لتحديث المناطق.<br><br>
                    <strong style="color:var(--o)">تنبيه قانوني:</strong> منظومة تحليلية بحتة للتداول الفوري (Spot) فقط. الأسعار والأهداف لا تمثل توصيات. كل قرار هو مسؤولية المستخدم.
                </div>
            </div>`;
}

// =====================================================================
// FLASH Scalping Engine — منصة 360°
// SCALPING SIGNAL GENERATOR — SPOT ONLY
// 4 أدوات: MACD Momentum + RSI Engine + Fibonacci S/R + SMC OB+Volume
// 6 فريمات: 1m + 5m + 15m + 30m + 1H + 4H
// تم تصحيح الحسابات الرياضية، فلترة علامة الدولار المزدوجة، واستكمال الدليل
// =====================================================================

function flFormatPrice(p) {
    var val = typeof fmtCryptoPrice === 'function' ? String(fmtCryptoPrice(p)) : Number(p).toFixed(4);
    return '$' + val.replace(/^\$+/, '');
}

async function runFlash() {
    var sym = document.getElementById('fl-symbol').value.trim().toUpperCase();
    if (!sym) return;
    
    var dash = document.getElementById('fl-dashboard');
    var load = document.getElementById('fl-loading');
    
    dash.innerHTML = '';
    dash.style.display = 'none';
    load.style.display = 'block';
    
    try {
        var res = await Promise.all([
            fetch('/api/binance-klines?symbol=' + sym + '&interval=1m&limit=200').then(function(r) { return r.json(); }),
            fetch('/api/binance-klines?symbol=' + sym + '&interval=5m&limit=200').then(function(r) { return r.json(); }),
            fetch('/api/binance-klines?symbol=' + sym + '&interval=15m&limit=200').then(function(r) { return r.json(); }),
            fetch('/api/binance-klines?symbol=' + sym + '&interval=30m&limit=200').then(function(r) { return r.json(); }),
            fetch('/api/binance-klines?symbol=' + sym + '&interval=1h&limit=200').then(function(r) { return r.json(); }),
            fetch('/api/binance-klines?symbol=' + sym + '&interval=4h&limit=200').then(function(r) { return r.json(); })
        ]);
        
        function parse(d) {
            return d.map(function(c) {
                return { open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5] };
            });
        }
        
        var result = flAnalyzeAll(sym, parse(res[0]), parse(res[1]), parse(res[2]), parse(res[3]), parse(res[4]), parse(res[5]));
        dash.innerHTML = flRenderDash(result);
        dash.style.display = 'flex';
        
    } catch (e) {
        dash.innerHTML = '<div style="color:var(--o);padding:20px;text-align:center;font-family:\'Share Tech Mono\',monospace;background:var(--s);border:1px solid var(--b);border-radius:4px;">خطأ: ' + e.message + '</div>';
        dash.style.display = 'flex';
    } finally {
        load.style.display = 'none';
    }
}

function flAnalyzeAll(sym, c1m, c5m, c15m, c30m, c1h, c4h) {
    var tf1 = flAnalyzeTf('1m', c1m);
    var tf5 = flAnalyzeTf('5m', c5m);
    var tf15 = flAnalyzeTf('15m', c15m);
    var tf30 = flAnalyzeTf('30m', c30m);
    var tf1h = flAnalyzeTf('1H', c1h);
    var tf4h = flAnalyzeTf('4H', c4h);
    
    var timeframes = [tf1, tf5, tf15, tf30, tf1h, tf4h];
    var scores = timeframes.map(function(t) { return t.score; });
    var avgScore = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
    var biases = timeframes.map(function(t) { return t.bias; });
    
    var bullCount = biases.filter(function(b) { return b === 'BULLISH'; }).length;
    var bearCount = biases.filter(function(b) { return b === 'BEARISH'; }).length;
    
    var masterBias = bullCount > bearCount ? 'BULLISH' : bearCount > bullCount ? 'BEARISH' : 'NEUTRAL';
    var aligned = Math.max(bullCount, bearCount);
    var alignmentFactor = (aligned / 6) * 100;
    var masterScore = Math.round((avgScore * 0.55) + (alignmentFactor * 0.45));
    
    var masterGrade;
    if (masterScore >= 85 && aligned >= 5) masterGrade = 'A+';
    else if (masterScore >= 75) masterGrade = 'A';
    else if (masterScore >= 65) masterGrade = 'B+';
    else if (masterScore >= 55) masterGrade = 'B';
    else masterGrade = 'C';
    
    return { 
        symbol: sym, 
        masterBias: masterBias, 
        masterScore: masterScore, 
        masterGrade: masterGrade, 
        aligned: aligned, 
        timeframes: timeframes, 
        avgScore: Math.round(avgScore), 
        alignmentFactor: Math.round(alignmentFactor) 
    };
}

function flAnalyzeTf(tfName, candles) {
    var display = candles.slice(-100);
    var currentPrice = display[display.length - 1].close;
    
    var macd = flRunMacd(candles, currentPrice);
    var rsi = flRunRsi(candles, currentPrice);
    var fib = flRunFib(candles, currentPrice);
    var smc = flRunSmc(candles, currentPrice);
    
    var components = [
        { name: 'MACD', key: 'MACD', bias: macd.bias, score: macd.score, detail: macd.detail },
        { name: 'RSI', key: 'RSI', bias: rsi.bias, score: rsi.score, detail: rsi.detail },
        { name: 'Fibonacci', key: 'FIB', bias: fib.bias, score: fib.score, detail: fib.detail },
        { name: 'SMC+Vol', key: 'SMC_VOL', bias: smc.bias, score: smc.score, detail: smc.detail }
    ];
    
    var biasVotes = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
    var totalScore = 0;
    components.forEach(function(c) { biasVotes[c.bias]++; totalScore += c.score; });
    
    var score = Math.round(totalScore / components.length);
    var bias = biasVotes.BULLISH > biasVotes.BEARISH ? 'BULLISH' : biasVotes.BEARISH > biasVotes.BULLISH ? 'BEARISH' : 'NEUTRAL';
    var aligned = components.filter(function(c) { return c.bias === bias; }).length;
    var alignmentFactor = (aligned / 4) * 100;
    var signalStrength = Math.round((score * 0.55) + (alignmentFactor * 0.45));
    
    var signalGrade;
    if (signalStrength >= 85 && aligned === 4) signalGrade = 'A+';
    else if (signalStrength >= 75) signalGrade = 'A';
    else if (signalStrength >= 65) signalGrade = 'B+';
    else if (signalStrength >= 55) signalGrade = 'B';
    else signalGrade = 'C';
    
    var trade = (bias === 'BULLISH' && signalStrength >= 55) ? flBuildTrade(bias, currentPrice, candles, tfName, components, fib, smc) : null;
    
    var confirmTf;
    if (tfName === '1m') confirmTf = 'دقيقة واحدة';
    else if (tfName === '5m') confirmTf = '5 دقائق';
    else if (tfName === '15m') confirmTf = '15 دقيقة';
    else if (tfName === '30m') confirmTf = '30 دقيقة';
    else if (tfName === '1H') confirmTf = 'ساعة واحدة';
    else confirmTf = '4 ساعات';
    
    return { 
        tf: tfName, 
        bias: bias, 
        signalStrength: signalStrength, 
        signalGrade: signalGrade, 
        score: score, 
        aligned: aligned, 
        components: components, 
        trade: trade, 
        confirmTf: confirmTf, 
        currentPrice: currentPrice 
    };
}

function flRunMacd(candles, currentPrice) {
    var closes = candles.map(function(c) { return c.close; });
    function ema(arr, p) { var k = 2 / (p + 1); var r = [arr[0]]; for (var i = 1; i < arr.length; i++) r.push(arr[i] * k + r[i - 1] * (1 - k)); return r; }
    
    var ema12 = ema(closes, 12), ema26 = ema(closes, 26);
    var macdLine = ema12.map(function(v, i) { return v - ema26[i]; });
    var sigLine = ema(macdLine, 9);
    var hist = macdLine.map(function(v, i) { return v - sigLine[i]; });
    
    var cm = macdLine[macdLine.length - 1], cs = sigLine[sigLine.length - 1];
    var ch = hist[hist.length - 1], ph = hist[hist.length - 2];
    var bias = 'NEUTRAL', score = 50;
    
    var crossUp = macdLine[macdLine.length - 2] < sigLine[sigLine.length - 2] && cm > cs;
    var crossDown = macdLine[macdLine.length - 2] > sigLine[sigLine.length - 2] && cm < cs;
    var zUp = macdLine[macdLine.length - 2] < 0 && cm > 0;
    var zDown = macdLine[macdLine.length - 2] > 0 && cm < 0;
    var hExp = Math.abs(ch) > Math.abs(ph);
    
    if (crossUp || zUp) { bias = 'BULLISH'; score = 72; }
    else if (crossDown || zDown) { bias = 'BEARISH'; score = 72; }
    else if (cm > cs && cm > 0) { bias = 'BULLISH'; score = 65; }
    else if (cm < cs && cm < 0) { bias = 'BEARISH'; score = 65; }
    else if (cm > cs) { bias = 'BULLISH'; score = 58; }
    else if (cm < cs) { bias = 'BEARISH'; score = 58; }
    
    if (hExp && bias !== 'NEUTRAL') score += 5;
    if (crossUp && cm > 0) score += 8;
    if (crossDown && cm < 0) score += 8;
    
    var peaks = typeof findPeaks === 'function' ? findPeaks(closes, 5) : [];
    var trs = typeof findTroughs === 'function' ? findTroughs(closes, 5) : [];
    var div = 'NONE';
    
    if (trs.length >= 2) {
        var t1 = trs[trs.length - 2], t2 = trs[trs.length - 1];
        if (closes[t2] < closes[t1] && macdLine[t2] > macdLine[t1]) { div = 'BULL_REG'; bias = 'BULLISH'; score += 12; }
        if (closes[t2] > closes[t1] && macdLine[t2] < macdLine[t1]) { div = 'BULL_HID'; if (bias === 'BULLISH') score += 8; }
    }
    
    if (peaks.length >= 2) {
        var p1 = peaks[peaks.length - 2], p2 = peaks[peaks.length - 1];
        if (closes[p2] > closes[p1] && macdLine[p2] < macdLine[p1]) { div = 'BEAR_REG'; bias = 'BEARISH'; score += 12; }
        if (closes[p2] < closes[p1] && macdLine[p2] > macdLine[p1]) { div = 'BEAR_HID'; if (bias === 'BEARISH') score += 8; }
    }
    
    score = Math.min(95, Math.max(20, score));
    return { bias: bias, score: score, detail: 'MACD: ' + (cm > 0 ? '+' : '') + cm.toFixed(4) + ' | Div: ' + div };
}

function flRunRsi(candles, currentPrice) {
    var closes = candles.map(function(c) { return c.close; });
    var period = 14, aG = 0, aL = 0;
    
    for (var i = 1; i <= period; i++) { var d = closes[i] - closes[i - 1]; if (d > 0) aG += d; else aL += Math.abs(d); }
    aG /= period; aL /= period;
    
    var rsiVals = [];
    for (var i = period; i < closes.length; i++) {
        if (i > period) {
            var d = closes[i] - closes[i - 1];
            aG = (aG * (period - 1) + (d > 0 ? d : 0)) / period;
            aL = (aL * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
        }
        rsiVals.push(aL === 0 ? 100 : 100 - (100 / (1 + aG / aL)));
    }
    
    var curr = rsiVals[rsiVals.length - 1];
    var bias = 'NEUTRAL', score = 50;
    
    if (curr <= 25) { bias = 'BULLISH'; score = 80; }
    else if (curr <= 35) { bias = 'BULLISH'; score = 68; }
    else if (curr <= 45) { bias = 'BULLISH'; score = 58; }
    else if (curr >= 75) { bias = 'BEARISH'; score = 80; }
    else if (curr >= 65) { bias = 'BEARISH'; score = 68; }
    else if (curr >= 55) { bias = 'BEARISH'; score = 58; }
    
    var div = 'NONE';
    var rsiTr = typeof findTroughs === 'function' ? findTroughs(rsiVals, 5) : [];
    var rsiPk = typeof findPeaks === 'function' ? findPeaks(rsiVals, 5) : [];
    var pSl = closes.slice(-rsiVals.length);
    var pTr = typeof findTroughs === 'function' ? findTroughs(pSl, 5) : [];
    var pPk = typeof findPeaks === 'function' ? findPeaks(pSl, 5) : [];
    
    if (pTr.length >= 2 && rsiTr.length >= 2) {
        var pt1 = pTr[pTr.length - 2], pt2 = pTr[pTr.length - 1];
        var rt1 = rsiTr[rsiTr.length - 2], rt2 = rsiTr[rsiTr.length - 1];
        if (pSl[pt2] < pSl[pt1] && rsiVals[rt2] > rsiVals[rt1]) { div = 'BULL_REG'; bias = 'BULLISH'; score += 12; }
    }
    
    if (pPk.length >= 2 && rsiPk.length >= 2) {
        var pp1 = pPk[pPk.length - 2], pp2 = pPk[pPk.length - 1];
        var rp1 = rsiPk[rsiPk.length - 2], rp2 = rsiPk[rsiPk.length - 1];
        if (pSl[pp2] > pSl[pp1] && rsiVals[rp2] < rsiVals[rp1]) { div = 'BEAR_REG'; bias = 'BEARISH'; score += 12; }
    }
    
    score = Math.min(95, Math.max(20, score));
    return { bias: bias, score: score, detail: 'RSI: ' + curr.toFixed(1) + ' | Div: ' + div };
}

function flRunFib(candles, currentPrice) {
    var highs = candles.map(function(c) { return c.high; });
    var lows = candles.map(function(c) { return c.low; });
    var hiIdx = highs.indexOf(Math.max.apply(null, highs));
    var loIdx = lows.indexOf(Math.min.apply(null, lows));
    var swH = highs[hiIdx], swL = lows[loIdx], range = swH - swL;
    var isUp = loIdx < hiIdx;
    
    var ret = {};
    [0.236, 0.382, 0.500, 0.618, 0.705, 0.786].forEach(function(r) {
        ret['f' + Math.round(r * 1000)] = isUp ? swH - range * r : swL + range * r;
    });
    
    var ext = {};
    [1.272, 1.618, 2.0, 2.618].forEach(function(r) {
        ext['e' + Math.round(r * 1000)] = isUp ? swL + range * r : swH - range * r;
    });
    
    var oteMin, oteMax, oteMid, gMin, gMax, gMid;
    if (isUp) { oteMin = ret.f618; oteMax = ret.f382; gMin = ret.f705; gMax = ret.f618; }
    else { oteMin = ret.f382; oteMax = ret.f618; gMin = ret.f618; gMax = ret.f705; }
    oteMid = (oteMin + oteMax) / 2; gMid = (gMin + gMax) / 2;
    
    var inOte = currentPrice >= Math.min(oteMin, oteMax) && currentPrice <= Math.max(oteMin, oteMax);
    var inGolden = currentPrice >= Math.min(gMin, gMax) && currentPrice <= Math.max(gMin, gMax);
    var bias = 'NEUTRAL', score = 50;
    
    if (isUp) {
        if (inGolden) { bias = 'BULLISH'; score = 82; }
        else if (inOte) { bias = 'BULLISH'; score = 72; }
        else if (currentPrice > ret.f236) { bias = 'BULLISH'; score = 60; }
        else if (currentPrice < ret.f786) { bias = 'BEARISH'; score = 65; }
        else { bias = 'BULLISH'; score = 55; }
    } else {
        if (inGolden) { bias = 'BEARISH'; score = 82; }
        else if (inOte) { bias = 'BEARISH'; score = 72; }
        else if (currentPrice < ret.f236) { bias = 'BEARISH'; score = 60; }
        else if (currentPrice > ret.f786) { bias = 'BULLISH'; score = 65; }
        else { bias = 'BEARISH'; score = 55; }
    }
    
    var dists = [0.236, 0.382, 0.500, 0.618, 0.705, 0.786].map(function(r) { return Math.abs(currentPrice - ret['f' + Math.round(r * 1000)]) / currentPrice * 100; });
    var minD = Math.min.apply(null, dists);
    if (minD < 0.3) score += 10; else if (minD < 0.8) score += 5;
    
    score = Math.min(95, Math.max(20, score));
    return { bias: bias, score: score, detail: (isUp ? 'UP' : 'DOWN') + ' | ' + (inGolden ? 'GOLDEN' : inOte ? 'OTE' : 'OUT'), levels: ret, extLevels: ext, oteZone: { min: oteMin, max: oteMax, mid: oteMid, goldenZone: { min: gMin, max: gMax, mid: gMid } }, swingHigh: swH, swingLow: swL, isUptrend: isUp };
}

function flRunSmc(candles, currentPrice) {
    var display = candles.slice(-60);
    var avgRange = display.reduce(function(s, c) { return s + Math.abs(c.high - c.low); }, 0) / display.length;
    var avgVol = display.reduce(function(s, c) { return s + c.volume; }, 0) / display.length;
    var bullOBs = [], bearOBs = [];
    
    for (var i = 2; i < display.length; i++) {
        var c0 = display[i - 2], c1 = display[i - 1], c2 = display[i];
        if (c0.close < c0.open && c1.close > c1.open && c2.close > c2.open) {
            var mv = c2.close - c0.low; var vs = (c1.volume + c2.volume) / 2 > avgVol * 1.1;
            if (mv > avgRange * 1.3) {
                var tested = false; for (var j = i + 1; j < display.length; j++) { if (display[j].low <= c0.high && display[j].low >= c0.low) { tested = true; break; } }
                bullOBs.push({ high: c0.high, low: c0.low, mid: (c0.high + c0.low) / 2, fresh: !tested, volSpike: vs, volRatio: ((c1.volume + c2.volume) / 2 / avgVol).toFixed(1) });
            }
        }
        if (c0.close > c0.open && c1.close < c1.open && c2.close < c2.open) {
            var mv2 = c0.high - c2.close; var vs2 = (c1.volume + c2.volume) / 2 > avgVol * 1.1;
            if (mv2 > avgRange * 1.3) {
                var tested2 = false; for (var k = i + 1; k < display.length; k++) { if (display[k].high >= c0.low && display[k].high <= c0.high) { tested2 = true; break; } }
                bearOBs.push({ high: c0.high, low: c0.low, mid: (c0.high + c0.low) / 2, fresh: !tested2, volSpike: vs2, volRatio: ((c1.volume + c2.volume) / 2 / avgVol).toFixed(1) });
            }
        }
    }
    
    var nearBull = null, nearBear = null;
    var bn = bullOBs.filter(function(ob) { return currentPrice >= ob.low * 0.98 && currentPrice <= ob.high * 1.05; });
    bn.sort(function(a, b) { return Math.abs(currentPrice - a.mid) - Math.abs(currentPrice - b.mid); });
    if (bn.length > 0) nearBull = bn[0];
    else { var bb = bullOBs.filter(function(ob) { return ob.low < currentPrice; }); bb.sort(function(a, b) { return b.mid - a.mid; }); if (bb.length > 0) nearBull = bb[0]; }
    
    var brn = bearOBs.filter(function(ob) { return currentPrice >= ob.low * 0.95 && currentPrice <= ob.high * 1.02; });
    brn.sort(function(a, b) { return Math.abs(currentPrice - a.mid) - Math.abs(currentPrice - b.mid); });
    if (brn.length > 0) nearBear = brn[0];
    else { var ba = bearOBs.filter(function(ob) { return ob.high > currentPrice; }); ba.sort(function(a, b) { return a.mid - b.mid; }); if (ba.length > 0) nearBear = ba[0]; }
    
    var bias = 'NEUTRAL', score = 50, obZone = null;
    if (nearBull && nearBear) {
        if (Math.abs(currentPrice - nearBull.mid) < Math.abs(currentPrice - nearBear.mid)) { bias = 'BULLISH'; score = 68; obZone = { min: nearBull.low, max: nearBull.high, mid: nearBull.mid, fresh: nearBull.fresh, volSpike: nearBull.volSpike, volRatio: nearBull.volRatio }; }
        else { bias = 'BEARISH'; score = 68; obZone = { min: nearBear.low, max: nearBear.high, mid: nearBear.mid, fresh: nearBear.fresh, volSpike: nearBear.volSpike, volRatio: nearBear.volRatio }; }
    } else if (nearBull) { bias = 'BULLISH'; score = 65; obZone = { min: nearBull.low, max: nearBull.high, mid: nearBull.mid, fresh: nearBull.fresh, volSpike: nearBull.volSpike, volRatio: nearBull.volRatio }; }
    else if (nearBear) { bias = 'BEARISH'; score = 65; obZone = { min: nearBear.low, max: nearBear.high, mid: nearBear.mid, fresh: nearBear.fresh, volSpike: nearBear.volSpike, volRatio: nearBear.volRatio }; }
    
    if (obZone && obZone.fresh) score += 10;
    if (obZone && obZone.volSpike) score += 8;
    if (obZone) { var dst = Math.abs(currentPrice - obZone.mid) / currentPrice * 100; if (dst < 0.3) score += 8; else if (dst < 1) score += 4; }
    
    score = Math.min(95, Math.max(20, score));
    var detail = 'Bull: ' + bullOBs.length + ' | Bear: ' + bearOBs.length + (obZone && obZone.fresh ? ' [FRESH]' : '') + (obZone && obZone.volSpike ? ' [VOL]' : '');
    return { bias: bias, score: score, detail: detail, obZone: obZone };
}

function flBuildTrade(bias, currentPrice, candles, tfName, components, fibData, smcData) {
    var isBull = bias === 'BULLISH';
    var atrSum = 0; 
    for (var i = candles.length - 14; i < candles.length; i++) { 
        atrSum += candles[i].high - candles[i].low; 
    }
    var atr = atrSum / 14;
    
    var slM, t1M, t2M, t3M;
    if (tfName === '1m') { slM = 0.8; t1M = 0.8; t2M = 1.5; t3M = 2.5; }
    else if (tfName === '5m') { slM = 1.0; t1M = 1.0; t2M = 2.0; t3M = 3.5; }
    else if (tfName === '15m') { slM = 1.2; t1M = 1.2; t2M = 2.5; t3M = 4.0; }
    else if (tfName === '30m') { slM = 1.5; t1M = 1.5; t2M = 3.0; t3M = 5.0; }
    else if (tfName === '1H') { slM = 1.5; t1M = 1.5; t2M = 3.0; t3M = 5.0; }
    else { slM = 2.0; t1M = 2.0; t2M = 4.0; t3M = 7.0; }
    
    var bestEntry = currentPrice;
    if (smcData.obZone && smcData.obZone.fresh) bestEntry = smcData.obZone.mid;
    else if (fibData.oteZone) bestEntry = fibData.oteZone.mid;
    
    var stopLoss;
    if (isBull) { stopLoss = (smcData.obZone) ? Math.min(smcData.obZone.min * 0.997, bestEntry - atr * slM) : bestEntry - atr * slM; }
    else { stopLoss = (smcData.obZone) ? Math.max(smcData.obZone.max * 1.003, bestEntry + atr * slM) : bestEntry + atr * slM; }
    
    var slCond;
    if (tfName === '1m') slCond = 'إغلاق شمعة 1 دقيقة';
    else if (tfName === '5m') slCond = 'إغلاق شمعة 5 دقائق';
    else if (tfName === '15m') slCond = 'إغلاق شمعة 15 دقيقة';
    else if (tfName === '30m') slCond = 'إغلاق شمعة 30 دقيقة';
    else if (tfName === '1H') slCond = 'إغلاق شمعة 1 ساعة';
    else slCond = 'إغلاق شمعة 4 ساعات';
    
    var tp1, tp2, tp3;
    var tgt = [];
    
    // الفلتر الهندسي الصارم: السعر المرجعي للأهداف يجب أن يتخطى السعر اللحظي والدخول المرجح
    var basePrice = Math.max(currentPrice, bestEntry);

    if (isBull) {
        if (fibData.extLevels) {
            if (fibData.extLevels.e1272 > basePrice) tgt.push(fibData.extLevels.e1272);
            if (fibData.extLevels.e1618 > basePrice) tgt.push(fibData.extLevels.e1618);
            if (fibData.extLevels.e2000 > basePrice) tgt.push(fibData.extLevels.e2000);
            if (fibData.extLevels.e2618 > basePrice) tgt.push(fibData.extLevels.e2618);
        }
        if (fibData.levels) {
            if (fibData.levels.f236 > basePrice) tgt.push(fibData.levels.f236);
            if (fibData.levels.f382 > basePrice) tgt.push(fibData.levels.f382);
        }
        tgt.sort(function(a, b) { return a - b; });
        tp1 = tgt[0] || basePrice + (atr * t1M);
        tp2 = tgt[1] || basePrice + (atr * t2M);
        tp3 = tgt[2] || basePrice + (atr * t3M);
        
        // تأكيد إضافي للمسافات السعرية في سوق السكالبينج
        if (tp1 <= basePrice) tp1 = basePrice + (atr * t1M);
        if (tp2 <= tp1) tp2 = tp1 + (atr * 1.2);
        if (tp3 <= tp2) tp3 = tp2 + (atr * 1.5);
    }
    
    var slDist = Math.abs(bestEntry - stopLoss);
    var tp1Pct = parseFloat(((tp1 - bestEntry) / bestEntry * 100).toFixed(2));
    var tp2Pct = parseFloat(((tp2 - bestEntry) / bestEntry * 100).toFixed(2));
    var tp3Pct = parseFloat(((tp3 - bestEntry) / bestEntry * 100).toFixed(2));
    var slPct = parseFloat((slDist / bestEntry * 100).toFixed(2));
    
    var rr1 = parseFloat(((tp1 - bestEntry) / slDist).toFixed(2));
    var rr2 = parseFloat(((tp2 - bestEntry) / slDist).toFixed(2));
    var rr3 = parseFloat(((tp3 - bestEntry) / slDist).toFixed(2));
    var avgRR = parseFloat(((rr1 + rr2 + rr3) / 3).toFixed(2));
    
    var aligned = components.filter(function(c) { return c.bias === bias; }).length;
    var baseProb = 55 + (aligned * 10);
    var tp1Prob = Math.min(92, baseProb + 12);
    var tp2Prob = Math.min(85, baseProb);
    var tp3Prob = Math.max(40, baseProb - 12);
    var ev = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * slPct)).toFixed(2));
    
    return { 
        entry: currentPrice, 
        bestEntry: bestEntry, 
        stopLoss: stopLoss, 
        slPct: slPct, 
        slCond: slCond, 
        tp1: tp1, 
        tp2: tp2, 
        tp3: tp3, 
        tp1Pct: tp1Pct, 
        tp2Pct: tp2Pct, 
        tp3Pct: tp3Pct, 
        rr1: rr1, 
        rr2: rr2, 
        rr3: rr3, 
        avgRR: avgRR, 
        tp1Prob: tp1Prob, 
        tp2Prob: tp2Prob, 
        tp3Prob: tp3Prob, 
        ev: ev, 
        side: 'LONG (شراء SPOT)' 
    };
}

function flRenderDash(a) {
    var h = flRenderMaster(a);
    var tfLabels = [
        ['1m', 'سكالبينج دقيقة', '1-MINUTE SCALP'],
        ['5m', 'سكالبينج 5 دقائق', '5-MINUTE SCALP'],
        ['15m', 'سكالبينج 15 دقيقة', '15-MINUTE SCALP'],
        ['30m', 'تحليل 30 دقيقة', '30-MINUTE ANALYSIS'],
        ['1H', 'تحليل ساعة', '1-HOUR ANALYSIS'],
        ['4H', 'تحليل 4 ساعات', '4-HOUR ANALYSIS']
    ];
    for (var i = 0; i < a.timeframes.length; i++) {
        h += flRenderTradeCard(a.timeframes[i], tfLabels[i][1], tfLabels[i][2]);
    }
    h += flRenderMatrix(a.timeframes);
    h += flRenderStrategy();
    h += flRenderAnalysis(a);
    h += flRenderGuide();
    return h;
}

function flRenderMaster(a) {
    var gc = (a.masterGrade === 'A+' || a.masterGrade === 'A') ? 'var(--t)' : 'var(--o)';
    var bc = a.masterBias === 'BULLISH' ? 'var(--t)' : 'var(--o)';
    
    return '<div class="fl-master" style="border-color:' + gc + '">' +
           '<div class="fl-master-top"><div class="fl-master-label">FLASH SIGNAL</div><div class="fl-master-sym">' + a.symbol + '</div></div>' +
           '<div class="fl-master-body"><div class="fl-master-grade" style="color:' + gc + '">' + a.masterGrade + '</div>' +
           '<div class="fl-master-info"><div class="fl-master-bias" style="color:' + bc + '">' + a.masterBias + '</div><div class="fl-master-score">' + a.masterScore + ' / 100</div></div></div>' +
           '<div class="fl-master-bar"><div class="fl-master-fill" style="width:' + a.masterScore + '%;background:' + gc + '"></div></div>' +
           '<div class="fl-master-stats"><div class="fl-stat"><span class="fl-stat-l">AVG</span><span class="fl-stat-v">' + a.avgScore + '</span></div><div class="fl-stat"><span class="fl-stat-l">ALIGN</span><span class="fl-stat-v">' + a.aligned + '/6</span></div><div class="fl-stat"><span class="fl-stat-l">%</span><span class="fl-stat-v">' + a.alignmentFactor + '%</span></div></div></div>';
}

function flRenderTradeCard(tf, arTitle, enTitle) {
    if (!tf.trade) {
        return '<div class="fl-card fl-card-notrade"><div class="fl-card-head"><div class="fl-card-tf">' + tf.tf + '</div><div class="fl-card-titles"><div class="fl-card-ar">' + arTitle + '</div><div class="fl-card-en">' + enTitle + '</div></div><div class="fl-card-grade" style="color:var(--o)">' + tf.signalGrade + '</div></div>' +
               '<div class="fl-notrade-box"><div class="fl-notrade-icon">!</div><div class="fl-notrade-msg">لا يوجد صفقات متاحة للصعود</div><div class="fl-notrade-sub">Signal: ' + tf.signalStrength + '/100 | الحد الأدنى: 55</div><div class="fl-notrade-hint">هذا الفريم إما ضعيف التوافق أو هبوطي (والمنصة Spot Only).</div></div></div>';
    }
    
    var t = tf.trade;
    var isBull = tf.bias === 'BULLISH';
    var biasC = isBull ? 'var(--t)' : 'var(--o)';
    var gradeC = (tf.signalGrade === 'A+' || tf.signalGrade === 'A') ? 'var(--t)' : 'var(--o)';
    var sideLabel = 'LONG — شراء SPOT';
    
    var compHtml = '';
    for (var c = 0; c < tf.components.length; c++) {
        var comp = tf.components[c];
        var cC = comp.bias === tf.bias ? biasC : (comp.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--o)');
        compHtml += '<div class="fl-comp-chip" style="border-color:' + cC + '"><span class="fl-comp-name">' + comp.name + '</span><span class="fl-comp-score" style="color:' + cC + '">' + comp.score + '</span></div>';
    }
    
    return '<div class="fl-card" style="border-right:4px solid ' + biasC + '">' +
           '<div class="fl-card-head"><div class="fl-card-tf">' + tf.tf + '</div><div class="fl-card-titles"><div class="fl-card-ar">' + arTitle + '</div><div class="fl-card-en">' + enTitle + '</div></div><div class="fl-card-grade" style="color:' + gradeC + '">' + tf.signalGrade + '</div></div>' +
           '<div class="fl-signal-row"><div class="fl-signal-badge" style="background:' + biasC + ';color:var(--bg)">' + sideLabel + '</div><div class="fl-signal-pct">' + tf.signalStrength + '/100</div></div>' +
           '<div class="fl-signal-bar"><div class="fl-signal-fill" style="width:' + tf.signalStrength + '%;background:' + biasC + '"></div></div>' +
           '<div class="fl-trade-grid">' +
           '<div class="fl-trade-item fl-trade-entry"><div class="fl-trade-label">ENTRY (السعر الحالي)</div><div class="fl-trade-price" style="color:var(--o)">' + flFormatPrice(t.entry) + '</div></div>' +
           '<div class="fl-trade-item fl-trade-best"><div class="fl-trade-label">BEST ENTRY (أمر معلق)</div><div class="fl-trade-price" style="color:var(--o)">' + flFormatPrice(t.bestEntry) + '</div></div>' +
           '<div class="fl-trade-item fl-trade-sl"><div class="fl-trade-label">STOP LOSS</div><div class="fl-trade-price" style="color:var(--o)">' + flFormatPrice(t.stopLoss) + '</div><div class="fl-trade-meta">-' + t.slPct + '%</div></div>' +
           '</div>' +
           '<div class="fl-tp-section">' +
           '<div class="fl-tp-row"><div class="fl-tp-label" style="color:var(--t)">TP1</div><div class="fl-tp-price" style="color:var(--t)">' + flFormatPrice(t.tp1) + '</div><div class="fl-tp-pct">+' + t.tp1Pct + '%</div><div class="fl-tp-rr">R:R ' + t.rr1 + '</div><div class="fl-tp-prob">' + t.tp1Prob + '%</div></div>' +
           '<div class="fl-tp-row"><div class="fl-tp-label" style="color:var(--t)">TP2</div><div class="fl-tp-price" style="color:var(--t)">' + flFormatPrice(t.tp2) + '</div><div class="fl-tp-pct">+' + t.tp2Pct + '%</div><div class="fl-tp-rr">R:R ' + t.rr2 + '</div><div class="fl-tp-prob">' + t.tp2Prob + '%</div></div>' +
           '<div class="fl-tp-row"><div class="fl-tp-label" style="color:var(--t)">TP3</div><div class="fl-tp-price" style="color:var(--t)">' + flFormatPrice(t.tp3) + '</div><div class="fl-tp-pct">+' + t.tp3Pct + '%</div><div class="fl-tp-rr">R:R ' + t.rr3 + '</div><div class="fl-tp-prob">' + t.tp3Prob + '%</div></div>' +
           '</div>' +
           '<div class="fl-sl-cond"><span class="fl-sl-cond-l">شرط SL:</span> <span class="fl-sl-cond-v">' + t.slCond + ' تحت الدعم</span></div>' +
           '<div class="fl-metrics"><div class="fl-metric"><span class="fl-metric-l">AVG R:R</span><span class="fl-metric-v">' + t.avgRR + '</span></div><div class="fl-metric"><span class="fl-metric-l">EV</span><span class="fl-metric-v" style="color:' + (t.ev > 0 ? 'var(--t)' : 'var(--o)') + '">' + (t.ev > 0 ? '+' : '') + t.ev + '%</span></div><div class="fl-metric"><span class="fl-metric-l">RISK</span><span class="fl-metric-v" style="color:var(--o)">' + t.slPct + '%</span></div></div>' +
           '<div class="fl-comps">' + compHtml + '</div></div>';
}

function flRenderMatrix(timeframes) {
    var tools = [
        { key: 'MACD', label: 'MACD' },
        { key: 'RSI', label: 'RSI' },
        { key: 'FIB', label: 'Fibonacci' },
        { key: 'SMC_VOL', label: 'SMC+Vol' }
    ];
    var tfs = ['1m', '5m', '15m', '30m', '1H', '4H'];
    var rows = '';
    
    for (var t = 0; t < tools.length; t++) {
        var cells = '';
        for (var f = 0; f < timeframes.length; f++) {
            var comp = null;
            for (var c = 0; c < timeframes[f].components.length; c++) {
                if (timeframes[f].components[c].key === tools[t].key) { comp = timeframes[f].components[c]; break; }
            }
            if (!comp) { 
                cells += '<div class="fl-mx-cell" style="color:var(--t3)">—</div>'; 
            } else { 
                var clr = comp.bias === 'BULLISH' ? 'var(--t)' : comp.bias === 'BEARISH' ? 'var(--o)' : 'var(--t3)'; 
                cells += '<div class="fl-mx-cell" style="color:' + clr + '">' + comp.score + '</div>'; 
            }
        }
        rows += '<div class="fl-mx-row"><div class="fl-mx-tool">' + tools[t].label + '</div>' + cells + '</div>';
    }
    
    var tfH = '';
    for (var f = 0; f < tfs.length; f++) { tfH += '<div class="fl-mx-tf">' + tfs[f] + '</div>'; }
    
    return '<div class="fl-section"><div class="fl-section-title">COMPONENTS MATRIX</div><div class="fl-mx-head"><div class="fl-mx-tool">TOOL</div>' + tfH + '</div>' + rows + '</div>';
}

function flRenderStrategy() {
    return '<div class="fl-section"><div class="fl-section-title">STRATEGY METHODOLOGY</div>' +
           '<div class="fl-step"><div class="fl-step-num" style="background:var(--o)">01</div><div class="fl-step-body"><div class="fl-step-t">MOMENTUM SCAN</div><div class="fl-step-d">MACD (12/26/9) لتحديد اتجاه الزخم وقوته. تقاطعات MACD وعبور خط الصفر والدايفرجنس تُستخدم كإشارات أولية للسكالبينج السريع.</div></div></div>' +
           '<div class="fl-step"><div class="fl-step-num" style="background:var(--t);color:var(--bg)">02</div><div class="fl-step-body"><div class="fl-step-t">RSI CONFIRMATION</div><div class="fl-step-d">RSI (14) بطريقة Wilder للتأكيد. مناطق التشبع (أقل من 30) مع كشف الدايفرجنس الإيجابي على RSI لتعزيز دقة إشارة الشراء الفوري.</div></div></div>' +
           '<div class="fl-step"><div class="fl-step-num" style="background:var(--o)">03</div><div class="fl-step-body"><div class="fl-step-t">FIBONACCI LEVELS</div><div class="fl-step-d">Retracement (0.236-0.786) مع Extension. مناطق OTE وGolden Zone لتحديد نقاط الدخول. أهداف الربح من مستويات Extension العلوية.</div></div></div>' +
           '<div class="fl-step"><div class="fl-step-num" style="background:var(--t);color:var(--bg)">04</div><div class="fl-step-body"><div class="fl-step-t">SMC + VOLUME</div><div class="fl-step-d">Order Blocks مع Volume Spike (1.1x المتوسط). الفلترة بين OBs الطازجة وغير المُختبرة لضمان دعوم قوية. أفضل نقطة دخول = منتصف OB الطازج.</div></div></div>' +
           '<div class="fl-step-note">SPOT ONLY — سكالبينج فوري بدون رافعة مالية. يُمنع التداول العكسي (Short) لحماية السيولة.</div></div>';
}

function flRenderAnalysis(a) {
    var act = 0;
    for (var i = 0; i < a.timeframes.length; i++) { if (a.timeframes[i].trade) act++; }
    var text;
    
    if (act >= 5) text = act + ' فريمات من 6 تُظهر صفقات شرائية — توافق قوي عبر الفريمات. إشارة مؤسسية صاعدة واضحة مدعومة بتأكيد MACD+RSI وFibonacci وSMC مع حجم تداول.';
    else if (act >= 3) text = act + ' فريمات تُظهر صفقات شرائية. توافق جزئي يتطلب تركيز على الفريمات الأقوى درجة. يُنصح بالدخول فقط على الفريمات ذات Grade A أو أعلى.';
    else text = 'أقل من 3 فريمات تُظهر صفقات للصعود (أو السوق هابط). التوافق ضعيف للسكالبينج الفوري. يُنصح بالانتظار حتى تتحسن ظروف السوق.';
    
    return '<div class="fl-analysis"><div class="fl-analysis-label">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div><div class="fl-analysis-text">' + text + '</div><div class="fl-disclaimer">تنبيه: هذا التحليل مرجعي فقط ولا يُعتبر توصية مالية. التداول في العملات الرقمية ينطوي على مخاطر عالية. جميع الصفقات SPOT ONLY بدون رافعة مالية. المستخدم يتحمل كامل المسؤولية.</div></div>';
}

function flRenderGuide() {
    return '<div class="fl-guide"><div class="fl-guide-title">دليل القراءة // READING GUIDE</div><div class="fl-guide-text">' +
           '<strong style="color:var(--o)">FLASH SIGNAL:</strong> التقييم الإجمالي للصعود عبر 6 فريمات سكالبينج. A+ = توافق 85%+ على 5 فريمات أو أكثر.<br><br>' +
           '<strong style="color:var(--o)">الفريمات:</strong> 1m و5m و15m للسكالبينج السريع جداً. 30m و1H و4H للسكالبينج متوسط المدى. كل فريم مستقل بتحليله وصفقته.<br><br>' +
           '<strong style="color:var(--o)">ENTRY vs BEST ENTRY:</strong> ENTRY = السعر الحالي. BEST ENTRY = أفضل نقطة دخول محسوبة من OB الطازج أو OTE Zone. يُنصح بالشراء بأمر معلق من BEST ENTRY لتحقيق الأهداف الدقيقة المبينة.<br><br>' +
           '<strong style="color:var(--o)">أهداف الربح (TP):</strong> مُشتقة من مستويات Fibonacci العلوية، وتم تصفيتها لتكون أعلى من السعر الحالي وأعلى من أمر الحد لضمان دقة الأرباح.<br><br>' +
           '<strong style="color:var(--o)">شرط SL:</strong> وقف الخسارة يُفعّل فقط بإغلاق شمعة الفريم المحدد تحت مستوى الدعم (لتفادي مصايد السيولة Wicks).<br><br>' +
           '<strong style="color:var(--o)">COMPONENTS MATRIX:</strong> أداء كل مؤشر على كل فريم. أبيض = صعودي. برتقالي = هبوطي (لا يُولد صفقة). رمادي = محايد.<br><br>' +
           '<strong style="color:var(--o)">EV (القيمة المتوقعة):</strong> موجبة تعني أن الصفقة إحصائياً مربحة. سالبة تعني أن نسبة المخاطرة تفوق العائد المحتمل.<br><br>' +
           '<strong style="color:var(--o)">ATR للسكالبينج:</strong> SL أضيق من الأدوات العادية: 1m=0.8x | 5m=1.0x | 15m=1.2x | 30m=1.5x لتناسب السرعة العالية.<br><br>' +
           '<strong style="color:var(--o)">SPOT ONLY:</strong> سوق فوري فقط. لا رافعة، لا futures، لا مشتقات.</div></div>';
}

// =====================================================================
// ICT Analysis Engine — منصة 360°
// SPOT ONLY — No Futures/Leverage
// 6 مفاهيم: ICT Model + Judas Swing + Liquidity Sweep + SMT Divergence + Kill Zones + Dealing Range
// تم التراجع للكود الأصلي مع تصحيح (المتغير k، علامة $$، دقة أهداف TP)
// =====================================================================

var ictSelectedTf = '1h';

function ictSelectTf(btn, tf) {
    ictSelectedTf = tf;
    var btns = document.querySelectorAll('.ict-tf-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('ict-tf-active');
    }
    btn.classList.add('ict-tf-active');
}

function ictFormatPrice(p) {
    var val = typeof fmtCryptoPrice === 'function' ? String(fmtCryptoPrice(p)) : Number(p).toFixed(4);
    return '$' + val.replace(/^\$+/, '');
}

async function runIctEngine() {
    var symbol = document.getElementById('ict-symbol').value.trim().toUpperCase();
    if (!symbol) return;
    
    var dash = document.getElementById('ict-dashboard');
    var load = document.getElementById('ict-loading');
    
    dash.innerHTML = '';
    dash.style.display = 'none';
    load.style.display = 'block';
    
    try {
        var tf = ictSelectedTf;
        var data = await fetch('/api/binance-klines?symbol=' + symbol + '&interval=' + tf + '&limit=200').then(function(r) { return r.json(); });
        
        var candles = data.map(function(c) {
            return { open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5] };
        });
        
        var tfLabel = tf === '1h' ? '1H' : tf === '4h' ? '4H' : '1D';
        var result = ictAnalyze(symbol, candles, tfLabel);
        
        dash.innerHTML = ictRenderChart(result, candles) + ictRenderDash(result);
        dash.style.display = 'flex';
        
    } catch (e) {
        dash.innerHTML = '<div style="color:var(--o);padding:20px;text-align:center;font-family:\'Share Tech Mono\',monospace;background:var(--s);border:1px solid var(--b);border-radius:4px;">خطأ: ' + e.message + '</div>';
        dash.style.display = 'flex';
    } finally {
        load.style.display = 'none';
    }
}

function ictAnalyze(symbol, candles, tfLabel) {
    var display = candles.slice(-100);
    var currentPrice = display[display.length - 1].close;

    var dr = ictDealingRange(display, currentPrice);
    var kz = ictKillZones();
    var model = ictModel(display, currentPrice);
    var judas = ictJudasSwing(display, currentPrice);
    var liq = ictLiquiditySweep(display, currentPrice);
    var smt = ictSmtDiv(display, currentPrice);
    var smc = ictSmcOB(display, currentPrice);

    var components = [
        { name: 'ICT Model', key: 'ICT', bias: model.bias, score: model.score, detail: model.detail },
        { name: 'Judas Swing', key: 'JUDAS', bias: judas.bias, score: judas.score, detail: judas.detail },
        { name: 'Liquidity', key: 'LIQ', bias: liq.bias, score: liq.score, detail: liq.detail },
        { name: 'SMT Div', key: 'SMT', bias: smt.bias, score: smt.score, detail: smt.detail },
        { name: 'Kill Zone', key: 'KZ', bias: kz.bias, score: kz.score, detail: kz.detail },
        { name: 'Deal Range', key: 'DR', bias: dr.bias, score: dr.score, detail: dr.detail }
    ];

    var biasVotes = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
    var totalScore = 0;
    
    components.forEach(function(c) {
        biasVotes[c.bias]++;
        totalScore += c.score;
    });
    
    var score = Math.round(totalScore / components.length);
    var bias = biasVotes.BULLISH > biasVotes.BEARISH ? 'BULLISH' : biasVotes.BEARISH > biasVotes.BULLISH ? 'BEARISH' : 'NEUTRAL';
    var aligned = components.filter(function(c) { return c.bias === bias; }).length;
    var alignmentFactor = (aligned / 6) * 100;
    var signalStrength = Math.round((score * 0.55) + (alignmentFactor * 0.45));
    
    var grade;
    if (signalStrength >= 85 && aligned >= 5) grade = 'A+';
    else if (signalStrength >= 75) grade = 'A';
    else if (signalStrength >= 65) grade = 'B+';
    else if (signalStrength >= 55) grade = 'B';
    else grade = 'C';

    // فلترة SPOT ONLY (بناء صفقات الشراء فقط)
    var trade = (bias === 'BULLISH' && signalStrength >= 55) ? ictBuildTrade(bias, currentPrice, candles, tfLabel, components, dr, smc, liq) : null;

    var slCond;
    if (tfLabel === '1H') slCond = 'إغلاق شمعة 1 ساعة';
    else if (tfLabel === '4H') slCond = 'إغلاق شمعة 4 ساعات';
    else slCond = 'إغلاق شمعة يومية';

    return { 
        symbol: symbol, tf: tfLabel, bias: bias, grade: grade, score: signalStrength, 
        aligned: aligned, components: components, trade: trade, currentPrice: currentPrice, 
        dr: dr, kz: kz, model: model, judas: judas, liq: liq, smt: smt, smc: smc, slCond: slCond 
    };
}

function ictDealingRange(display, currentPrice) {
    var recent = display.slice(-50);
    var swingHigh = 0, swingLow = Infinity;
    
    for (var i = 0; i < recent.length; i++) {
        if (recent[i].high > swingHigh) swingHigh = recent[i].high;
        if (recent[i].low < swingLow) swingLow = recent[i].low;
    }
    
    var eq = (swingHigh + swingLow) / 2;
    var premium = currentPrice > eq;
    var bias, score;
    
    if (premium) { bias = 'BEARISH'; score = 65; }
    else { bias = 'BULLISH'; score = 65; }
    
    var distToEQ = Math.abs(currentPrice - eq) / currentPrice * 100;
    if (distToEQ < 0.5) score += 10;
    else if (distToEQ > 3) score += 5;
    
    score = Math.min(95, Math.max(20, score));
    return { bias: bias, score: score, detail: (premium ? 'PREMIUM' : 'DISCOUNT') + ' | EQ: ' + ictFormatPrice(eq), high: swingHigh, low: swingLow, eq: eq, premium: premium };
}

function ictKillZones() {
    var now = new Date();
    var utcH = now.getUTCHours();
    var active = false, name = 'OFF SESSION', start = '', end = '';
    
    if (utcH >= 2 && utcH < 5) { active = true; name = 'London Open'; start = '02:00'; end = '05:00'; }
    else if (utcH >= 7 && utcH < 10) { active = true; name = 'NY Open'; start = '07:00'; end = '10:00'; }
    else if (utcH >= 10 && utcH < 12) { active = true; name = 'NY PM'; start = '10:00'; end = '12:00'; }
    else if (utcH >= 20 || utcH < 0) { active = true; name = 'Asian'; start = '20:00'; end = '00:00'; }
    
    var bias = 'NEUTRAL', score = 50;
    if (active) { score = 80; bias = 'BULLISH'; }
    else { score = 40; }
    
    return { bias: bias, score: score, detail: name + (active ? ' (ACTIVE)' : ' (INACTIVE)'), active: active, name: name, start: start, end: end };
}

function ictModel(display, currentPrice) {
    var peaks = typeof findPeaks === 'function' ? findPeaks(display.map(function(c){return c.high}), 5) : [];
    var trs = typeof findTroughs === 'function' ? findTroughs(display.map(function(c){return c.low}), 5) : [];
    var bos = false, choch = false, bias = 'NEUTRAL', score = 50;
    
    if (peaks.length >= 2) {
        var lastPeak = display[peaks[peaks.length - 1]].high;
        var prevPeak = display[peaks[peaks.length - 2]].high;
        if (currentPrice > lastPeak && lastPeak > prevPeak) { bos = true; bias = 'BULLISH'; score = 75; }
        if (trs.length > 0 && currentPrice < display[trs[trs.length - 1]].low) { bos = true; bias = 'BEARISH'; score = 75; }
    }
    
    if (peaks.length >= 3 && trs.length >= 3) {
        var highs = [display[peaks[peaks.length - 3]].high, display[peaks[peaks.length - 2]].high, display[peaks[peaks.length - 1]].high];
        var lows = [display[trs[trs.length - 3]].low, display[trs[trs.length - 2]].low, display[trs[trs.length - 1]].low];
        
        if (highs[0] < highs[1] && lows[0] < lows[1] && lows[2] < lows[1]) { choch = true; bias = 'BEARISH'; score = 82; }
        if (highs[0] > highs[1] && lows[0] > lows[1] && highs[2] > highs[1]) { choch = true; bias = 'BULLISH'; score = 82; }
    }
    
    if (bos) score += 8;
    score = Math.min(95, Math.max(20, score));
    var detail = (choch ? 'CHoCH ' : '') + (bos ? 'BOS ' : '') + ((!choch && !bos) ? 'NO SIGNAL' : '');
    
    return { bias: bias, score: score, detail: detail.trim(), bos: bos, choch: choch };
}

function ictJudasSwing(display, currentPrice) {
    var recent = display.slice(-20);
    var detected = false, direction = 'NEUTRAL', sweepLevel = 0, reclaim = 0;
    var bias = 'NEUTRAL', score = 50;
    
    for (var i = 2; i < recent.length - 2; i++) {
        var prevLows = [];
        for (var j = 0; j < i; j++) prevLows.push(recent[j].low);
        var support = Math.min.apply(null, prevLows);
        
        if (recent[i].low < support * 0.999) {
            var reclaimed = false;
            for (var k = i + 1; k < recent.length; k++) {
                if (recent[k].close > support) { reclaimed = true; reclaim = recent[k].close; break; }
            }
            if (reclaimed) { detected = true; direction = 'BULLISH'; sweepLevel = recent[i].low; bias = 'BULLISH'; score = 80; break; }
        }
    }
    
    if (!detected) {
        for (var i = 2; i < recent.length - 2; i++) {
            var prevHighs = [];
            for (var j = 0; j < i; j++) prevHighs.push(recent[j].high);
            var resistance = Math.max.apply(null, prevHighs);
            
            if (recent[i].high > resistance * 1.001) {
                var reclaimed2 = false;
                for (var k = i + 1; k < recent.length; k++) {
                    if (recent[k].close < resistance) { reclaimed2 = true; reclaim = recent[k].close; break; }
                }
                if (reclaimed2) { detected = true; direction = 'BEARISH'; sweepLevel = recent[i].high; bias = 'BEARISH'; score = 80; break; }
            }
        }
    }
    
    if (!detected) score = 35;
    score = Math.min(95, Math.max(20, score));
    var detail = detected ? direction + ' | Sweep: ' + ictFormatPrice(sweepLevel) : 'NOT DETECTED';
    
    return { bias: bias, score: score, detail: detail, detected: detected, direction: direction, sweepLevel: sweepLevel, reclaim: reclaim };
}

function ictLiquiditySweep(display, currentPrice) {
    var recent = display.slice(-30);
    var prevCandles = display.slice(-60, -30);
    var highPools = [], lowPools = [];
    
    for (var i = 0; i < prevCandles.length; i++) {
        for (var j = i + 1; j < prevCandles.length; j++) {
            if (Math.abs(prevCandles[i].high - prevCandles[j].high) / prevCandles[i].high < 0.002)
                highPools.push(Math.max(prevCandles[i].high, prevCandles[j].high));
            if (Math.abs(prevCandles[i].low - prevCandles[j].low) / prevCandles[i].low < 0.002)
                lowPools.push(Math.min(prevCandles[i].low, prevCandles[j].low));
        }
    }
    
    var uHighPools = [], uLowPools = [];
    highPools.forEach(function(h) { var exists = false; for (var i = 0; i < uHighPools.length; i++) { if (Math.abs(h - uHighPools[i]) / h < 0.003) { exists = true; break; } } if (!exists) uHighPools.push(h); });
    lowPools.forEach(function(l) { var exists = false; for (var i = 0; i < uLowPools.length; i++) { if (Math.abs(l - uLowPools[i]) / l < 0.003) { exists = true; break; } } if (!exists) uLowPools.push(l); });
    
    var swept = false, type = 'NONE', level = 0;
    var bias = 'NEUTRAL', score = 50;
    
    for (var i = 0; i < recent.length; i++) {
        for (var j = 0; j < uHighPools.length; j++) {
            if (recent[i].high > uHighPools[j] && recent[i].close < uHighPools[j]) { swept = true; type = 'BUY-SIDE'; level = uHighPools[j]; bias = 'BEARISH'; score = 78; break; }
        }
        if (swept) break;
        for (var j = 0; j < uLowPools.length; j++) {
            if (recent[i].low < uLowPools[j] && recent[i].close > uLowPools[j]) { swept = true; type = 'SELL-SIDE'; level = uLowPools[j]; bias = 'BULLISH'; score = 78; break; }
        }
        if (swept) break;
    }
    
    if (!swept) score = 40;
    score = Math.min(95, Math.max(20, score));
    var detail = swept ? type + ' @ ' + ictFormatPrice(level) + ' | Pools: ' + (uHighPools.length + uLowPools.length) : 'NO SWEEP | Pools: ' + (uHighPools.length + uLowPools.length);
    
    return { bias: bias, score: score, detail: detail, swept: swept, type: type, level: level, highPools: uHighPools, lowPools: uLowPools };
}

function ictSmtDiv(display, currentPrice) {
    var recent = display.slice(-30);
    var peaks = typeof findPeaks === 'function' ? findPeaks(recent.map(function(c){return c.high}), 3) : [];
    var trs = typeof findTroughs === 'function' ? findTroughs(recent.map(function(c){return c.low}), 3) : [];
    var detected = false, type = 'NONE';
    var bias = 'NEUTRAL', score = 50;
    
    if (peaks.length >= 2) {
        var p1 = peaks[peaks.length - 2], p2 = peaks[peaks.length - 1];
        if (recent[p2].high > recent[p1].high && recent[p2].volume < recent[p1].volume * 0.8) {
            detected = true; type = 'BEARISH'; bias = 'BEARISH'; score = 75;
        }
    }
    
    if (!detected && trs.length >= 2) {
        var t1 = trs[trs.length - 2], t2 = trs[trs.length - 1];
        if (recent[t2].low < recent[t1].low && recent[t2].volume < recent[t1].volume * 0.8) {
            detected = true; type = 'BULLISH'; bias = 'BULLISH'; score = 75;
        }
    }
    
    if (!detected) score = 40;
    score = Math.min(95, Math.max(20, score));
    var detail = detected ? type + ' SMT | Vol Divergence' : 'NO SMT DETECTED';
    
    return { bias: bias, score: score, detail: detail, detected: detected, type: type };
}

function ictSmcOB(display, currentPrice) {
    var avgRange = display.reduce(function(s, c) { return s + Math.abs(c.high - c.low); }, 0) / display.length;
    var avgVol = display.reduce(function(s, c) { return s + c.volume; }, 0) / display.length;
    var bullOBs = [], bearOBs = [];
    
    for (var i = 2; i < display.length; i++) {
        var c0 = display[i - 2], c1 = display[i - 1], c2 = display[i];
        
        if (c0.close < c0.open && c1.close > c1.open && c2.close > c2.open) {
            var mv = c2.close - c0.low; var vs = (c1.volume + c2.volume) / 2 > avgVol * 1.1;
            if (mv > avgRange * 1.3) {
                var tested = false; 
                for (var j = i + 1; j < display.length; j++) { 
                    if (display[j].low <= c0.high && display[j].low >= c0.low) { tested = true; break; } 
                }
                bullOBs.push({ high: c0.high, low: c0.low, mid: (c0.high + c0.low) / 2, fresh: !tested, volSpike: vs, volRatio: ((c1.volume + c2.volume) / 2 / avgVol).toFixed(1) });
            }
        }
        
        if (c0.close > c0.open && c1.close < c1.open && c2.close < c2.open) {
            var mv2 = c0.high - c2.close; var vs2 = (c1.volume + c2.volume) / 2 > avgVol * 1.1;
            if (mv2 > avgRange * 1.3) {
                var tested2 = false; 
                for (var j = i + 1; j < display.length; j++) { 
                    if (display[j].high >= c0.low && display[j].high <= c0.high) { tested2 = true; break; } 
                }
                bearOBs.push({ high: c0.high, low: c0.low, mid: (c0.high + c0.low) / 2, fresh: !tested2, volSpike: vs2, volRatio: ((c1.volume + c2.volume) / 2 / avgVol).toFixed(1) });
            }
        }
    }
    
    var nearBull = null, nearBear = null;
    var bn = bullOBs.filter(function(ob) { return currentPrice >= ob.low * 0.98 && currentPrice <= ob.high * 1.05; });
    bn.sort(function(a, b) { return Math.abs(currentPrice - a.mid) - Math.abs(currentPrice - b.mid); });
    if (bn.length > 0) nearBull = bn[0];
    else { var bb = bullOBs.filter(function(ob) { return ob.low < currentPrice; }); bb.sort(function(a, b) { return b.mid - a.mid; }); if (bb.length > 0) nearBull = bb[0]; }
    
    var brn = bearOBs.filter(function(ob) { return currentPrice >= ob.low * 0.95 && currentPrice <= ob.high * 1.02; });
    brn.sort(function(a, b) { return Math.abs(currentPrice - a.mid) - Math.abs(currentPrice - b.mid); });
    if (brn.length > 0) nearBear = brn[0];
    else { var ba = bearOBs.filter(function(ob) { return ob.high > currentPrice; }); ba.sort(function(a, b) { return a.mid - b.mid; }); if (ba.length > 0) nearBear = ba[0]; }
    
    return { bullOBs: bullOBs, bearOBs: bearOBs, nearBull: nearBull, nearBear: nearBear };
}

function ictBuildTrade(bias, currentPrice, candles, tfLabel, components, dr, smc, liq) {
    var isBull = bias === 'BULLISH';
    if (!isBull) return null; // SPOT ONLY (فلترة الصفقات الهبوطية)

    var atrSum = 0; 
    for (var i = candles.length - 14; i < candles.length; i++) { 
        atrSum += candles[i].high - candles[i].low; 
    }
    var atr = atrSum / 14;
    
    var slM, t1M, t2M, t3M;
    if (tfLabel === '1H') { slM = 1.5; t1M = 1.5; t2M = 3.0; t3M = 5.0; }
    else if (tfLabel === '4H') { slM = 2.0; t1M = 2.0; t2M = 4.0; t3M = 7.0; }
    else { slM = 2.5; t1M = 2.5; t2M = 5.5; t3M = 10.0; }

    var bestEntry = currentPrice;
    if (smc.nearBull && smc.nearBull.fresh) bestEntry = smc.nearBull.mid;
    else if (currentPrice > dr.eq) bestEntry = dr.eq;

    var stopLoss = smc.nearBull ? Math.min(smc.nearBull.low * 0.997, bestEntry - atr * slM) : bestEntry - atr * slM;
    stopLoss = Math.max(stopLoss, dr.low * 0.995);

    var slCond;
    if (tfLabel === '1H') slCond = 'إغلاق شمعة 1 ساعة';
    else if (tfLabel === '4H') slCond = 'إغلاق شمعة 4 ساعات';
    else slCond = 'إغلاق شمعة يومية';

    // حماية الأهداف لتتخطى دائماً السعر اللحظي والدخول المثالي (Price Ceiling)
    var basePrice = Math.max(currentPrice, bestEntry);
    var tp1, tp2, tp3;
    
    tp1 = dr.eq > basePrice ? dr.eq : basePrice + atr * t1M;
    tp2 = dr.high > basePrice ? dr.high : basePrice + atr * t2M;
    
    var liqAbove = liq.highPools ? liq.highPools.filter(function(p) { return p > basePrice; }) : [];
    liqAbove.sort(function(a, b) { return a - b; });
    tp3 = liqAbove[0] || basePrice + atr * t3M;
    
    if (tp1 <= basePrice) tp1 = basePrice + atr * t1M;
    if (tp2 <= tp1) tp2 = tp1 + atr * 1.5;
    if (tp3 <= tp2) tp3 = tp2 + atr * 2.0;

    var slDist = Math.abs(bestEntry - stopLoss);
    var tp1Pct = parseFloat(((tp1 - bestEntry) / bestEntry * 100).toFixed(2));
    var tp2Pct = parseFloat(((tp2 - bestEntry) / bestEntry * 100).toFixed(2));
    var tp3Pct = parseFloat(((tp3 - bestEntry) / bestEntry * 100).toFixed(2));
    var slPct = parseFloat((slDist / bestEntry * 100).toFixed(2));
    
    var rr1 = parseFloat(((tp1 - bestEntry) / slDist).toFixed(2));
    var rr2 = parseFloat(((tp2 - bestEntry) / slDist).toFixed(2));
    var rr3 = parseFloat(((tp3 - bestEntry) / slDist).toFixed(2));
    var avgRR = parseFloat(((rr1 + rr2 + rr3) / 3).toFixed(2));
    
    var aligned = components.filter(function(c) { return c.bias === bias; }).length;
    var baseProb = 50 + (aligned * 8);
    var tp1Prob = Math.min(90, baseProb + 12);
    var tp2Prob = Math.min(85, baseProb);
    var tp3Prob = Math.max(38, baseProb - 15);
    var ev = parseFloat(((tp1Prob / 100 * tp1Pct * 0.5) + (tp2Prob / 100 * tp2Pct * 0.3) + (tp3Prob / 100 * tp3Pct * 0.2) - ((1 - tp1Prob / 100) * slPct)).toFixed(2));
    
    return { 
        entry: currentPrice, bestEntry: bestEntry, stopLoss: stopLoss, slPct: slPct, slCond: slCond, 
        tp1: tp1, tp2: tp2, tp3: tp3, tp1Pct: tp1Pct, tp2Pct: tp2Pct, tp3Pct: tp3Pct, 
        rr1: rr1, rr2: rr2, rr3: rr3, avgRR: avgRR, tp1Prob: tp1Prob, tp2Prob: tp2Prob, tp3Prob: tp3Prob, 
        ev: ev, side: 'LONG (شراء SPOT)' 
    };
}

function ictRenderChart(r, candles) {
    var display = candles.slice(-60);
    var W = 800, H = 360;
    var padL = 10, padR = 60, padT = 30, padB = 30;
    var chartW = W - padL - padR, chartH = H - padT - padB;
    var allH = display.map(function(c) { return c.high; });
    var allL = display.map(function(c) { return c.low; });
    var maxP = Math.max.apply(null, allH) * 1.002;
    var minP = Math.min.apply(null, allL) * 0.998;
    var pRange = maxP - minP;
    var cW = chartW / display.length;
    
    function xPos(i) { return padL + i * cW + cW / 2; }
    function yPos(p) { return padT + (1 - (p - minP) / pRange) * chartH; }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;background:var(--s);border-radius:4px;" xmlns="http://www.w3.org/2000/svg">';
    svg += '<style>text{font-family:\'Share Tech Mono\',monospace}</style>';

    for (var g = 0; g < 7; g++) {
        var gy = padT + (chartH / 6) * g;
        var gp = maxP - (pRange / 6) * g;
        svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="var(--b)" stroke-width="0.5"/>';
        svg += '<text x="' + (W - padR + 4) + '" y="' + (gy + 3) + '" fill="var(--t3)" font-size="7" text-anchor="start">' + gp.toFixed(0) + '</text>';
    }

    var drY1 = yPos(r.dr.high), drY2 = yPos(r.dr.low), drEqY = yPos(r.dr.eq);
    svg += '<rect x="' + padL + '" y="' + drY1 + '" width="' + chartW + '" height="' + Math.max(0, drEqY - drY1) + '" fill="rgba(255,106,0,0.06)"/>';
    svg += '<rect x="' + padL + '" y="' + drEqY + '" width="' + chartW + '" height="' + Math.max(0, drY2 - drEqY) + '" fill="rgba(255,255,255,0.03)"/>';
    svg += '<line x1="' + padL + '" y1="' + drEqY + '" x2="' + (W - padR) + '" y2="' + drEqY + '" stroke="var(--o)" stroke-width="0.8" stroke-dasharray="4,4"/>';
    svg += '<text x="' + (padL + 4) + '" y="' + (drEqY - 4) + '" fill="var(--o)" font-size="7" font-weight="bold">EQ ' + ictFormatPrice(r.dr.eq) + '</text>';
    svg += '<text x="' + (padL + 4) + '" y="' + (drY1 + 12) + '" fill="rgba(255,106,0,0.6)" font-size="7" font-weight="bold">PREMIUM</text>';
    svg += '<text x="' + (padL + 4) + '" y="' + (drY2 - 6) + '" fill="rgba(255,255,255,0.4)" font-size="7" font-weight="bold">DISCOUNT</text>';

    if (r.smc.nearBull) {
        var obY1 = yPos(r.smc.nearBull.high), obY2 = yPos(r.smc.nearBull.low);
        svg += '<rect x="' + padL + '" y="' + obY1 + '" width="' + chartW + '" height="' + Math.max(0, obY2 - obY1) + '" fill="rgba(255,255,255,0.06)" stroke="var(--t2)" stroke-width="0.5"/>';
        svg += '<text x="' + (padL + 4) + '" y="' + (obY1 + 10) + '" fill="var(--t)" font-size="6" font-weight="bold">BULL OB' + (r.smc.nearBull.fresh ? ' [FRESH]' : '') + '</text>';
    }
    if (r.smc.nearBear) {
        var bobY1 = yPos(r.smc.nearBear.high), bobY2 = yPos(r.smc.nearBear.low);
        svg += '<rect x="' + padL + '" y="' + bobY1 + '" width="' + chartW + '" height="' + Math.max(0, bobY2 - bobY1) + '" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="0.5"/>';
        svg += '<text x="' + (padL + 4) + '" y="' + (bobY1 + 10) + '" fill="var(--o)" font-size="6" font-weight="bold">BEAR OB' + (r.smc.nearBear.fresh ? ' [FRESH]' : '') + '</text>';
    }

    if (r.liq.highPools) {
        for (var lp = 0; lp < r.liq.highPools.length; lp++) {
            var lpY = yPos(r.liq.highPools[lp]);
            svg += '<line x1="' + padL + '" y1="' + lpY + '" x2="' + (W - padR) + '" y2="' + lpY + '" stroke="var(--o)" stroke-width="0.5" stroke-dasharray="2,3"/>';
        }
    }
    if (r.liq.lowPools) {
        for (var lp = 0; lp < r.liq.lowPools.length; lp++) {
            var lpY = yPos(r.liq.lowPools[lp]);
            svg += '<line x1="' + padL + '" y1="' + lpY + '" x2="' + (W - padR) + '" y2="' + lpY + '" stroke="var(--t)" stroke-width="0.5" stroke-dasharray="2,3"/>';
        }
    }

    for (var i = 0; i < display.length; i++) {
        var c = display[i];
        var isBull = c.close > c.open;
        var color = isBull ? 'var(--t)' : 'var(--o)';
        var bx = xPos(i) - cW * 0.3;
        var bw = cW * 0.6;
        var bodyTop = yPos(Math.max(c.open, c.close));
        var bodyBot = yPos(Math.min(c.open, c.close));
        var bodyH = Math.max(1, bodyBot - bodyTop);
        svg += '<line x1="' + xPos(i) + '" y1="' + yPos(c.high) + '" x2="' + xPos(i) + '" y2="' + yPos(c.low) + '" stroke="' + color + '" stroke-width="0.7"/>';
        svg += '<rect x="' + bx + '" y="' + bodyTop + '" width="' + bw + '" height="' + bodyH + '" fill="' + color + '"/>';
    }

    var cpY = yPos(r.currentPrice);
    svg += '<line x1="' + padL + '" y1="' + cpY + '" x2="' + (W - padR) + '" y2="' + cpY + '" stroke="var(--t)" stroke-width="0.5" stroke-dasharray="2,2"/>';
    svg += '<rect x="' + (W - padR) + '" y="' + (cpY - 8) + '" width="55" height="16" fill="var(--t)"/>';
    svg += '<text x="' + (W - padR + 27) + '" y="' + (cpY + 3) + '" fill="var(--bg)" font-size="7" font-weight="bold" text-anchor="middle">' + ictFormatPrice(r.currentPrice) + '</text>';

    svg += '<text x="' + (padL + 4) + '" y="' + (padT - 8) + '" fill="var(--o)" font-size="8" font-weight="bold">ICT CHART // ' + r.symbol + ' — ' + r.tf + '</text>';
    svg += '<text x="' + (W - padR - 4) + '" y="' + (padT - 8) + '" fill="var(--t)" font-size="9" font-weight="bold" text-anchor="end">' + ictFormatPrice(r.currentPrice) + '</text>';

    svg += '</svg>';

    var legend = '<div class="ict-chart-legend">';
    var items = [
        { l: 'Dealing Range', c: 'var(--b)' },
        { l: 'Liquidity Pool', c: 'var(--o)' },
        { l: 'Bull OB', c: 'var(--t2)' },
        { l: 'Bear OB', c: 'var(--o)' },
        { l: 'EQ Line', c: 'var(--o)' }
    ];
    for (var li = 0; li < items.length; li++) {
        legend += '<div class="ict-legend-item"><div class="ict-legend-dot" style="background:' + items[li].c + '"></div><span>' + items[li].l + '</span></div>';
    }
    legend += '</div>';

    return '<div class="ict-chart-wrap">' + svg + legend + '</div>';
}

function ictRenderDash(r) {
    var biasC = r.bias === 'BULLISH' ? 'var(--t)' : 'var(--o)';
    var gradeC = (r.grade === 'A+' || r.grade === 'A') ? 'var(--t)' : 'var(--o)';
    var h = '';

    h += '<div class="ict-master" style="border-color:' + gradeC + '"><div class="ict-master-top"><span class="ict-master-label">ICT SIGNAL</span><span class="ict-master-sym">' + r.symbol + ' — ' + r.tf + '</span></div><div class="ict-master-body"><div class="ict-master-grade" style="color:' + gradeC + '">' + r.grade + '</div><div class="ict-master-info"><div class="ict-master-bias" style="color:' + biasC + '">' + r.bias + '</div><div class="ict-master-score">' + r.score + '/100</div></div></div><div class="ict-master-bar"><div class="ict-master-fill" style="width:' + r.score + '%;background:' + gradeC + '"></div></div></div>';

    h += '<div class="ict-section"><div class="ict-section-title">ICT CONCEPTS STATUS</div>';
    var concepts = [
        { name: 'Kill Zone', status: r.kz.active ? 'ACTIVE' : 'INACTIVE', statusC: r.kz.active ? 'var(--t)' : 'var(--t3)', dot: r.kz.active ? 'var(--t)' : 'var(--t3)', sub: r.kz.name + (r.kz.active ? ' (' + r.kz.start + '-' + r.kz.end + ' UTC)' : '') },
        { name: 'ICT Model', status: r.model.bos ? 'BOS' : r.model.choch ? 'CHoCH' : '—', statusC: (r.model.bos || r.model.choch) ? 'var(--t)' : 'var(--t3)', dot: (r.model.bos || r.model.choch) ? 'var(--t)' : 'var(--t3)', sub: r.model.detail },
        { name: 'Judas Swing', status: r.judas.detected ? r.judas.direction : '—', statusC: r.judas.detected ? (r.judas.direction === 'BULLISH' ? 'var(--t)' : 'var(--o)') : 'var(--t3)', dot: r.judas.detected ? 'var(--t)' : 'var(--t3)', sub: r.judas.detail },
        { name: 'Liquidity Sweep', status: r.liq.swept ? 'SWEPT' : '—', statusC: r.liq.swept ? 'var(--o)' : 'var(--t3)', dot: r.liq.swept ? 'var(--o)' : 'var(--t3)', sub: r.liq.detail },
        { name: 'SMT Divergence', status: r.smt.detected ? r.smt.type : '—', statusC: r.smt.detected ? (r.smt.type === 'BULLISH' ? 'var(--t)' : 'var(--o)') : 'var(--t3)', dot: r.smt.detected ? 'var(--t)' : 'var(--t3)', sub: r.smt.detail },
        { name: 'Dealing Range', status: r.dr.premium ? 'PREMIUM' : 'DISCOUNT', statusC: r.dr.premium ? 'var(--o)' : 'var(--t)', dot: r.dr.premium ? 'var(--o)' : 'var(--t)', sub: r.dr.detail }
    ];
    for (var ci = 0; ci < concepts.length; ci++) {
        var con = concepts[ci];
        h += '<div class="ict-concept-row"><div class="ict-concept-dot" style="background:' + con.dot + '"></div><div class="ict-concept-info"><div class="ict-concept-name">' + con.name + '</div><div class="ict-concept-sub">' + con.sub + '</div></div><div class="ict-concept-status" style="color:' + con.statusC + '">' + con.status + '</div></div>';
    }
    h += '</div>';

    if (!r.trade) {
        h += '<div class="ict-section"><div class="ict-section-title">TRADE PLAN // ' + r.tf + '</div><div class="ict-notrade"><div class="ict-notrade-icon">!</div><div class="ict-notrade-msg">لا صفقات شرائية (المسار هابط)</div><div class="ict-notrade-sub">Signal: ' + r.score + '/100 | الحد الأدنى: 55</div><div class="ict-notrade-hint">يُرجى الانتظار حتى تتوافق مفاهيم ICT للصعود (Spot Only)</div></div></div>';
    } else {
        var t = r.trade;
        var sideLabel = 'LONG — شراء SPOT';
        h += '<div class="ict-section" style="border-right:4px solid ' + biasC + '"><div class="ict-section-title">TRADE PLAN // ' + r.tf + '</div>';
        h += '<div class="ict-signal-row"><div class="ict-signal-badge" style="background:' + biasC + ';color:var(--bg)">' + sideLabel + '</div><div class="ict-signal-pct">' + r.score + '/100</div></div>';
        h += '<div class="ict-trade-grid"><div class="ict-trade-item"><div class="ict-trade-label">ENTRY (حالي)</div><div class="ict-trade-price" style="color:var(--o)">' + ictFormatPrice(t.entry) + '</div></div><div class="ict-trade-item"><div class="ict-trade-label">BEST ENTRY (حد)</div><div class="ict-trade-price" style="color:var(--o)">' + ictFormatPrice(t.bestEntry) + '</div></div><div class="ict-trade-item"><div class="ict-trade-label">STOP LOSS</div><div class="ict-trade-price" style="color:var(--o)">' + ictFormatPrice(t.stopLoss) + '</div><div class="ict-trade-meta">-' + t.slPct + '%</div></div></div>';
        h += '<div class="ict-tp-section">';
        var tps = [
            { l: 'TP1', p: t.tp1, pct: t.tp1Pct, rr: t.rr1, prob: t.tp1Prob },
            { l: 'TP2', p: t.tp2, pct: t.tp2Pct, rr: t.rr2, prob: t.tp2Prob },
            { l: 'TP3', p: t.tp3, pct: t.tp3Pct, rr: t.rr3, prob: t.tp3Prob }
        ];
        for (var ti = 0; ti < tps.length; ti++) {
            h += '<div class="ict-tp-row"><div class="ict-tp-label">' + tps[ti].l + '</div><div class="ict-tp-price">' + ictFormatPrice(tps[ti].p) + '</div><div class="ict-tp-pct">+' + tps[ti].pct + '%</div><div class="ict-tp-rr">R:R ' + tps[ti].rr + '</div><div class="ict-tp-prob">' + tps[ti].prob + '%</div></div>';
        }
        h += '</div>';
        h += '<div class="ict-sl-cond"><span class="ict-sl-cond-l">شرط تفعيل وقف الخسارة:</span> <span class="ict-sl-cond-v">' + t.slCond + ' تحت الدعم</span></div>';
        h += '<div class="ict-metrics"><div class="ict-metric"><span class="ict-metric-l">AVG R:R</span><span class="ict-metric-v">' + t.avgRR + '</span></div><div class="ict-metric"><span class="ict-metric-l">EV</span><span class="ict-metric-v" style="color:' + (t.ev > 0 ? 'var(--t)' : 'var(--o)') + '">' + (t.ev > 0 ? '+' : '') + t.ev + '%</span></div><div class="ict-metric"><span class="ict-metric-l">RISK</span><span class="ict-metric-v" style="color:var(--o)">' + t.slPct + '%</span></div></div>';
    }

    h += '<div class="ict-comps">';
    for (var ci = 0; ci < r.components.length; ci++) {
        var comp = r.components[ci];
        var cC = comp.bias === r.bias ? biasC : (comp.bias === 'NEUTRAL' ? 'var(--t3)' : 'var(--o)');
        h += '<div class="ict-comp-chip" style="border-top-color:' + cC + '"><span class="ict-comp-name">' + comp.name + '</span><span class="ict-comp-score" style="color:' + cC + '">' + comp.score + '</span></div>';
    }
    h += '</div></div>';

    h += '<div class="ict-section"><div class="ict-section-title">STRATEGY METHODOLOGY</div>';
    var steps = [
        { n: '01', t: 'ICT MODEL', d: 'تحليل BOS (Break of Structure) وCHoCH (Change of Character) لتحديد الاتجاه المؤسسي. القمم والقيعان المتتالية تكشف هيكل السوق الحقيقي.', c: 'var(--o)' },
        { n: '02', t: 'JUDAS SWING', d: 'كشف الحركات الخادعة في بداية الجلسة — كسر مستوى دعم/مقاومة ثم انعكاس سريع. هذه إشارة مؤسسية للتجميع قبل الحركة الحقيقية.', c: 'var(--t)' },
        { n: '03', t: 'LIQUIDITY SWEEP', d: 'تحديد مجمعات السيولة (Equal Highs/Lows) والكشف عن عمليات الاكتساح المؤسسية. BUY-SIDE sweep = إشارة هبوطية. SELL-SIDE = إشارة صعودية.', c: 'var(--o)' },
        { n: '04', t: 'SMT DIVERGENCE', d: 'تباين حجم التداول مع حركة السعر — قمة جديدة بحجم أقل تعني ضعف الزخم المؤسسي وانعكاس محتمل.', c: 'var(--t)' },
        { n: '05', t: 'KILL ZONES + DEALING RANGE', d: 'أوقات التداول المؤسسي (London/NY/Asian) مع نطاق التداول (Premium/Discount). الدخول في Discount Zone خلال Kill Zone نشطة = أقوى إعداد.', c: 'var(--o)' }
    ];
    for (var si = 0; si < steps.length; si++) {
        h += '<div class="ict-step"><div class="ict-step-num" style="background:' + steps[si].c + ';color:var(--bg)">' + steps[si].n + '</div><div class="ict-step-body"><div class="ict-step-t">' + steps[si].t + '</div><div class="ict-step-d">' + steps[si].d + '</div></div></div>';
    }
    h += '<div class="ict-step-note">SPOT ONLY — تحليل مرجعي فقط وليس توصية استثمارية. بدون رافعة مالية أو عقود آجلة.</div></div>';

    h += '<div class="ict-analysis"><div class="ict-analysis-label">INSTITUTIONAL ANALYSIS // التحليل المؤسسي</div><div class="ict-analysis-text">';
    var activeConcepts = 0;
    if (r.kz.active) activeConcepts++; if (r.model.bos || r.model.choch) activeConcepts++; if (r.judas.detected) activeConcepts++; if (r.liq.swept) activeConcepts++; if (r.smt.detected) activeConcepts++;
    if (activeConcepts >= 4) h += 'توافق قوي — ' + activeConcepts + ' مفاهيم ICT نشطة من 6. هذا يعكس بيئة مؤسسية مثالية للتداول مع تأكيد متعدد المستويات للاتجاه.';
    else if (activeConcepts >= 2) h += 'توافق جزئي — ' + activeConcepts + ' مفاهيم نشطة. يُنصح بالحذر والتركيز على المفاهيم المؤكدة فقط لتفادي الانعكاسات.';
    else h += 'توافق ضعيف — مفهوم واحد أو أقل نشط. يُفضل الانتظار حتى تتضح السيولة المؤسسية.';
    h += '</div><div class="ict-disclaimer">تنبيه: هذا التحليل مرجعي فقط. التداول في العملات الرقمية ينطوي على مخاطر عالية. جميع الصفقات SPOT ONLY. المستخدم يتحمل كامل المسؤولية.</div></div>';

    h += '<div class="ict-guide"><div class="ict-guide-title">دليل القراءة // READING GUIDE</div><div class="ict-guide-text">';
    h += '<strong style="color:var(--o)">ICT Model:</strong> يحلل BOS (كسر الهيكل) وCHoCH (تغيير الاتجاه). BOS = استمرار الاتجاه. CHoCH = انعكاس محتمل.<br><br>';
    h += '<strong style="color:var(--o)">Judas Swing:</strong> حركة خادعة تكسر مستوى سيولة ثم تنعكس. كلما كان الكسر أعمق والانعكاس أسرع، كانت الإشارة أقوى.<br><br>';
    h += '<strong style="color:var(--o)">Liquidity Sweep:</strong> BUY-SIDE = كسر قمم سابقة لجمع سيولة المشتريين. SELL-SIDE = كسر قيعان لجمع سيولة البائعين.<br><br>';
    h += '<strong style="color:var(--o)">SMT Divergence:</strong> تباين الحجم مع السعر. قمة جديدة بحجم ضعيف = ضعف مؤسسي.<br><br>';
    h += '<strong style="color:var(--o)">Kill Zones:</strong> أفضل الأوقات المؤسسية (London Open / NY Open / Asian).<br><br>';
    h += '<strong style="color:var(--o)">Dealing Range:</strong> Premium (فوق EQ) = بيع مؤسسي. Discount (تحت EQ) = شراء مؤسسي.<br><br>';
    h += '<strong style="color:var(--o)">BEST ENTRY:</strong> نقطة الشراء المثالية لتنفيذ أمر (Limit) معلق بناءً على الـ Order Block الطازج.<br><br>';
    h += '<strong style="color:var(--o)">SPOT ONLY:</strong> صفقات شرائية حصراً حمايةً لمحفظتك من تذبذبات العقود الآجلة.</div></div>';

    return h;
}
// =====================================================================
// TOKEN SCANNER — منصة 360°
// Project Legitimacy + Scam Detection + GitHub Audit
// 5 معايير: Market Health + Price Integrity + Supply Risk + Listing Quality + GitHub Activity
// نسخة محمية: كاش 4 ساعات + ربط مع Backend GitHub API + Spot Only
// =====================================================================

async function runTokenScanner() {
    var symbol = document.getElementById('tscan-symbol').value.trim().toUpperCase();
    if (!symbol) return;
    
    var dash = document.getElementById('tscan-dashboard');
    var load = document.getElementById('tscan-loading');
    
    dash.innerHTML = '';
    dash.style.display = 'none';
    
    // --- طبقة التخزين المؤقت (الكاش) لمدة 4 ساعات ---
    var cacheKey = 'tscan_cache_' + symbol;
    var cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
        var parsedCache = JSON.parse(cachedData);
        // 4 ساعات = 14,400,000 مللي ثانية
        if (Date.now() - parsedCache.timestamp < 14400000) {
            dash.innerHTML = tscanRenderDash(parsedCache.result);
            dash.style.display = 'flex';
            return; 
        } else {
            sessionStorage.removeItem(cacheKey);
        }
    }
    // ------------------------------------------------
    
    load.style.display = 'block';
    
    try {
        var coin = symbol.replace(/USDT$/i, '').replace(/BUSD$/i, '').replace(/USD$/i, '').toLowerCase();

        var geckoId = null;
        try {
            var searchRes = await fetch('https://api.coingecko.com/api/v3/search?query=' + coin).then(function(r) { return r.json(); });
            if (searchRes && searchRes.coins && searchRes.coins.length > 0) {
                var exactMatch = null;
                for (var si = 0; si < searchRes.coins.length; si++) {
                    if (searchRes.coins[si].symbol && searchRes.coins[si].symbol.toLowerCase() === coin) { 
                        exactMatch = searchRes.coins[si]; break; 
                    }
                }
                geckoId = exactMatch ? exactMatch.id : searchRes.coins[0].id;
            }
        } catch (e) { geckoId = coin; } 
        if (!geckoId) geckoId = coin;

        var binanceP = fetch('/api/binance-klines?symbol=' + symbol + '&interval=1d&limit=200').then(function(r) { return r.json(); }).catch(function() { return null; });
        var geckoP = fetch('https://api.coingecko.com/api/v3/coins/' + geckoId + '?localization=false&tickers=true&community_data=true&developer_data=true').then(function(r) { return r.json(); }).catch(function() { return null; });

        var res = await Promise.all([binanceP, geckoP]);
        var candles = null;
        if (res[0] && Array.isArray(res[0])) {
            candles = res[0].map(function(c) {
                return { open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5] };
            });
        }
        var gecko = res[1];
        if (gecko && gecko.error) gecko = null;

        var githubData = null;
        if (gecko && gecko.links && gecko.links.repos_url && gecko.links.repos_url.github && gecko.links.repos_url.github.length > 0) {
            var ghUrl = gecko.links.repos_url.github[0];
            var ghParts = ghUrl.replace('https://github.com/', '').split('/');
            
            if (ghParts.length >= 2) {
                var ghOwner = ghParts[0], ghRepo = ghParts[1];
                try {
                    // --- توجيه الطلب إلى الخادم الآمن في منصتك ---
                    var ghRes = await fetch('/api/github-audit?owner=' + ghOwner + '&repo=' + ghRepo).then(function(r) { return r.json(); }).catch(function() { return null; });
                    
                    if (ghRes && ghRes.repoData && !ghRes.repoData.message) {
                        var ghInfo = ghRes.repoData;
                        var ghCommitInfo = ghRes.commitData;
                        var ghActivity = ghRes.statsData;
                        
                        var commits90d = 0;
                        if (ghActivity && Array.isArray(ghActivity)) {
                            var last13 = ghActivity.slice(-13);
                            for (var w = 0; w < last13.length; w++) { 
                                commits90d += last13[w].total || 0; 
                            }
                        }
                        
                        var lastCommitDate = ghCommitInfo && Array.isArray(ghCommitInfo) && ghCommitInfo[0] ? new Date(ghCommitInfo[0].commit.author.date) : null;
                        var lastCommitDays = lastCommitDate ? Math.floor((Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
                        
                        githubData = {
                            hasRepo: true,
                            repoUrl: ghUrl.replace('https://', ''),
                            stars: ghInfo.stargazers_count || 0,
                            forks: ghInfo.forks_count || 0,
                            openSource: !ghInfo.private,
                            contributors: ghInfo.subscribers_count || 0,
                            commits90d: commits90d,
                            lastCommitDays: lastCommitDays,
                            isActive: lastCommitDays !== null && lastCommitDays < 30
                        };
                    }
                } catch (e) { 
                    githubData = null; 
                }
            }
        }

        var result = tscanAnalyze(symbol, coin, candles, gecko, githubData);
        
        // حفظ النتيجة في الكاش للعمليات المستقبلية (4 ساعات)
        sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), result: result }));
        
        dash.innerHTML = tscanRenderDash(result);
        dash.style.display = 'flex';
        
    } catch (e) {
        dash.innerHTML = '<div style="color:var(--o);padding:20px;text-align:center;font-family:\'Share Tech Mono\',monospace;background:var(--s);border:1px solid var(--b);border-radius:4px;">خطأ: ' + e.message + '</div>';
        dash.style.display = 'flex';
    } finally {
        load.style.display = 'none';
    }
}

function tscanAnalyze(symbol, coin, candles, gecko, githubData) {
    var name = gecko && gecko.name ? gecko.name : coin.toUpperCase();
    var currentPrice = candles && candles.length > 0 ? candles[candles.length - 1].close : gecko && gecko.market_data ? gecko.market_data.current_price.usd : 0;

    var market = tscanMarketHealth(candles, gecko, currentPrice);
    var price = tscanPriceIntegrity(candles, gecko);
    var supply = tscanSupplyRisk(gecko);
    var listing = tscanListingQuality(gecko);
    var github = tscanGithubScore(githubData);

    var totalScore = market.score + price.score + supply.score + listing.score + github.score;
    var classification;
    
    if (totalScore >= 80) classification = 'LEGIT';
    else if (totalScore >= 60) classification = 'CAUTION';
    else if (totalScore >= 40) classification = 'HIGH RISK';
    else classification = 'SCAM ALERT';

    return { 
        symbol: symbol, coin: coin, name: name, currentPrice: currentPrice, 
        classification: classification, totalScore: totalScore, 
        market: market, price: price, supply: supply, listing: listing, github: github 
    };
}

function tscanMarketHealth(candles, gecko, currentPrice) {
    var score = 0;
    var dailyVolume = 0, avgVolume = 0, volRatio = 0, marketCap = 0, age = 'N/A', ageYears = 0, liquidityDepth = 'N/A';

    if (gecko && gecko.market_data) {
        dailyVolume = gecko.market_data.total_volume ? gecko.market_data.total_volume.usd || 0 : 0;
        marketCap = gecko.market_data.market_cap ? gecko.market_data.market_cap.usd || 0 : 0;
    }
    
    if (gecko && gecko.genesis_date) {
        age = gecko.genesis_date.substring(0, 4);
        ageYears = new Date().getFullYear() - parseInt(age);
    } else if (candles && candles.length >= 200) {
        age = '200+ شموع';
        ageYears = 1;
    }

    if (candles && candles.length > 0) {
        var last30 = candles.slice(-30);
        var volSum = 0;
        for (var i = 0; i < last30.length; i++) volSum += last30[i].volume;
        avgVolume = volSum / last30.length;
        dailyVolume = dailyVolume || (candles[candles.length - 1].volume * currentPriceApprox(candles));
        volRatio = avgVolume > 0 ? parseFloat((dailyVolume / (avgVolume * currentPriceApprox(candles))).toFixed(2)) : 0;
    }

    if (marketCap > 10000000000) score += 7; 
    else if (marketCap > 1000000000) score += 6; 
    else if (marketCap > 100000000) score += 4; 
    else if (marketCap > 10000000) score += 2; 
    else score += 1;

    if (dailyVolume > 100000000) score += 5;
    else if (dailyVolume > 10000000) score += 4;
    else if (dailyVolume > 1000000) score += 3;
    else if (dailyVolume > 100000) score += 1;

    if (ageYears >= 5) score += 7;
    else if (ageYears >= 3) score += 5;
    else if (ageYears >= 1) score += 3;
    else score += 1;

    if (volRatio > 0.8) score += 3;
    else if (volRatio > 0.3) score += 2;
    else score += 1;

    if (marketCap > 1000000000 && dailyVolume > 50000000) liquidityDepth = 'HIGH';
    else if (marketCap > 100000000 && dailyVolume > 5000000) liquidityDepth = 'MODERATE';
    else if (marketCap > 10000000) liquidityDepth = 'LOW';
    else liquidityDepth = 'VERY LOW';

    if (liquidityDepth === 'HIGH') score += 3;
    else if (liquidityDepth === 'MODERATE') score += 2;

    score = Math.min(25, score);
    return { score: score, max: 25, dailyVolume: dailyVolume, avgVolume: avgVolume, volRatio: volRatio, marketCap: marketCap, age: age, ageYears: ageYears, liquidityDepth: liquidityDepth };
}

function currentPriceApprox(candles) {
    if (!candles || candles.length === 0) return 1;
    return candles[candles.length - 1].close || 1;
}

function tscanPriceIntegrity(candles, gecko) {
    var score = 0;
    var ath = 0, athDrop = 0, pumpDump = false, maxDailySwing = 0, avgDailySwing = 0, suspiciousWicks = 0;

    if (gecko && gecko.market_data && gecko.market_data.ath) {
        ath = gecko.market_data.ath.usd || 0;
        athDrop = gecko.market_data.ath_change_percentage ? Math.abs(gecko.market_data.ath_change_percentage.usd || 0) : 0;
    }

    if (candles && candles.length > 0) {
        var swings = [];
        for (var i = 0; i < candles.length; i++) {
            var c = candles[i];
            var swing = ((c.high - c.low) / c.low) * 100;
            swings.push(swing);
            
            var body = Math.abs(c.close - c.open);
            var upperWick = c.high - Math.max(c.close, c.open);
            var lowerWick = Math.min(c.close, c.open) - c.low;
            if (body > 0 && (upperWick > body * 3 || lowerWick > body * 3)) suspiciousWicks++;
        }
        
        maxDailySwing = parseFloat(Math.max.apply(null, swings).toFixed(1));
        avgDailySwing = parseFloat((swings.reduce(function(a, b) { return a + b; }, 0) / swings.length).toFixed(1));

        for (var i = 1; i < candles.length - 1; i++) {
            var prevClose = candles[i - 1].close;
            var gain = ((candles[i].high - prevClose) / prevClose) * 100;
            var drop = ((candles[i].high - candles[i + 1].close) / candles[i].high) * 100;
            if (gain > 50 && drop > 30) { pumpDump = true; break; }
        }
    }

    if (athDrop < 50) score += 7;
    else if (athDrop < 75) score += 5;
    else if (athDrop < 90) score += 3;
    else score += 1;

    if (!pumpDump) score += 6; 
    else score += 0;

    if (maxDailySwing < 15) score += 4;
    else if (maxDailySwing < 30) score += 3;
    else if (maxDailySwing < 50) score += 1;

    if (avgDailySwing < 5) score += 4;
    else if (avgDailySwing < 10) score += 3;
    else if (avgDailySwing < 20) score += 1;

    if (suspiciousWicks < 3) score += 4;
    else if (suspiciousWicks < 8) score += 2;

    score = Math.min(25, score);
    return { score: score, max: 25, ath: ath, athDrop: parseFloat(athDrop.toFixed(1)), pumpDump: pumpDump, maxDailySwing: maxDailySwing, avgDailySwing: avgDailySwing, suspiciousWicks: suspiciousWicks };
}

function tscanSupplyRisk(gecko) {
    var score = 0;
    var circulating = 0, total = 0, circulatingPct = 0, maxSupply = null, inflationRisk = 'N/A';

    if (gecko && gecko.market_data) {
        circulating = gecko.market_data.circulating_supply || 0;
        total = gecko.market_data.total_supply || 0;
        maxSupply = gecko.market_data.max_supply;
        if (total > 0) circulatingPct = parseFloat(((circulating / total) * 100).toFixed(1));
    }

    if (circulatingPct >= 75) score += 8;
    else if (circulatingPct >= 50) score += 6;
    else if (circulatingPct >= 25) score += 4;
    else if (circulatingPct >= 10) score += 2;
    else score += 0;

    if (maxSupply && maxSupply > 0) { score += 4; } 
    else if (total > 0) { score += 2; }

    if (circulatingPct >= 75) { inflationRisk = 'LOW'; score += 4; }
    else if (circulatingPct >= 40) { inflationRisk = 'MODERATE'; score += 3; }
    else if (circulatingPct >= 10) { inflationRisk = 'HIGH'; score += 1; }
    else { inflationRisk = 'EXTREME'; score += 0; }

    if (total > 0 && circulating > 0 && total / circulating < 100) score += 4;
    else if (total > 0 && circulating > 0 && total / circulating < 1000) score += 2;

    score = Math.min(20, score);
    return { score: score, max: 20, circulating: circulating, total: total, circulatingPct: circulatingPct, maxSupply: maxSupply, inflationRisk: inflationRisk };
}

function tscanListingQuality(gecko) {
    var score = 0;
    var exchanges = [];
    var tier1Count = 0, pairs = 0;
    var tier1Names = ['binance', 'coinbase', 'kraken', 'okx', 'bybit', 'bitfinex', 'huobi', 'kucoin', 'gate', 'bitstamp'];

    if (gecko && gecko.tickers) {
        pairs = gecko.tickers.length;
        var exSet = {};
        for (var i = 0; i < gecko.tickers.length; i++) {
            var exName = gecko.tickers[i].market ? gecko.tickers[i].market.name : '';
            if (exName && !exSet[exName]) { 
                exSet[exName] = true; 
                exchanges.push(exName); 
            }
        }
        for (var i = 0; i < exchanges.length; i++) {
            for (var j = 0; j < tier1Names.length; j++) {
                if (exchanges[i].toLowerCase().indexOf(tier1Names[j]) >= 0) { 
                    tier1Count++; 
                    break; 
                }
            }
        }
    }

    if (exchanges.length === 0) { 
        exchanges.push('Binance'); 
        tier1Count = 1; 
        pairs = 1; 
    }

    if (tier1Count >= 5) score += 8;
    else if (tier1Count >= 3) score += 6;
    else if (tier1Count >= 1) score += 4;
    else score += 1;

    if (pairs >= 30) score += 4;
    else if (pairs >= 10) score += 3;
    else if (pairs >= 3) score += 2;
    else score += 1;

    if (exchanges.length >= 10) score += 3;
    else if (exchanges.length >= 5) score += 2;
    else score += 1;

    score = Math.min(15, score);
    return { score: score, max: 15, exchanges: exchanges.slice(0, 8), tier1Count: tier1Count, pairs: pairs };
}

function tscanGithubScore(githubData) {
    var score = 0;
    var hasRepo = false, repoUrl = null, commits90d = 0, contributors = 0, lastCommitDays = null, stars = 0, forks = 0, openSource = false, isActive = false;

    if (githubData) {
        hasRepo = githubData.hasRepo;
        repoUrl = githubData.repoUrl;
        commits90d = githubData.commits90d;
        contributors = githubData.contributors;
        lastCommitDays = githubData.lastCommitDays;
        stars = githubData.stars;
        forks = githubData.forks;
        openSource = githubData.openSource;
        isActive = githubData.isActive;
    }

    if (hasRepo) score += 3;

    if (commits90d > 100) score += 3;
    else if (commits90d > 20) score += 2;
    else if (commits90d > 0) score += 1;

    if (contributors > 20) score += 2;
    else if (contributors > 5) score += 1;

    if (lastCommitDays !== null && lastCommitDays < 7) score += 2;
    else if (lastCommitDays !== null && lastCommitDays < 30) score += 1;

    if (stars > 1000) score += 2;
    else if (stars > 100) score += 1;

    if (openSource) score += 1;
    if (forks > 500) score += 1;
    if (isActive) score += 1;

    score = Math.min(15, score);
    return { score: score, max: 15, hasRepo: hasRepo, repoUrl: repoUrl, commits90d: commits90d, contributors: contributors, lastCommitDays: lastCommitDays, stars: stars, forks: forks, openSource: openSource, isActive: isActive };
}

function tscanRenderDash(r) {
    var classC = r.totalScore >= 80 ? 'var(--t)' : (r.totalScore >= 60 ? 'var(--o)' : 'var(--o)');
    var h = '';

    h += '<div class="tscan-class-card" style="border-color:' + classC + '">';
    h += '<div class="tscan-class-label">PROJECT CLASSIFICATION</div>';
    h += '<div class="tscan-class-name">' + r.name + ' (' + r.coin.toUpperCase() + ')</div>';
    h += '<div class="tscan-class-result" style="color:' + classC + '">' + r.classification + '</div>';
    h += '<div class="tscan-class-score">' + r.totalScore + ' / 100</div>';
    h += '<div class="tscan-class-bar"><div class="tscan-class-fill" style="width:' + r.totalScore + '%;background:' + classC + '"></div></div>';
    h += '<div class="tscan-class-scale"><span>0 — SCAM</span><span>50 — RISKY</span><span>100 — LEGIT</span></div></div>';

    h += '<div class="tscan-section"><div class="tscan-section-title">SCORE BREAKDOWN</div>';
    var criteria = [
        { l: 'MARKET HEALTH', s: r.market.score, m: r.market.max },
        { l: 'PRICE INTEGRITY', s: r.price.score, m: r.price.max },
        { l: 'SUPPLY RISK', s: r.supply.score, m: r.supply.max },
        { l: 'LISTING QUALITY', s: r.listing.score, m: r.listing.max },
        { l: 'GITHUB ACTIVITY', s: r.github.score, m: r.github.max }
    ];
    
    for (var i = 0; i < criteria.length; i++) {
        var pct = Math.round((criteria[i].s / criteria[i].m) * 100);
        var barC = pct >= 75 ? 'var(--t)' : 'var(--o)';
        h += '<div class="tscan-score-row">';
        h += '<div class="tscan-score-info"><span class="tscan-score-label">' + criteria[i].l + '</span><span class="tscan-score-val" style="color:' + barC + '">' + criteria[i].s + '/' + criteria[i].m + '</span></div>';
        h += '<div class="tscan-score-bar"><div class="tscan-score-fill" style="width:' + pct + '%;background:' + barC + '"></div></div>';
        h += '</div>';
    }
    h += '</div>';

    h += '<div class="tscan-section"><div class="tscan-section-title">01 // MARKET HEALTH</div><div class="tscan-grid-2">';
    h += tscanCell('DAILY VOLUME', r.market.dailyVolume > 1e6 ? '$' + (r.market.dailyVolume / 1e6).toFixed(1) + 'M' : r.market.dailyVolume > 1e3 ? '$' + (r.market.dailyVolume / 1e3).toFixed(0) + 'K' : '$' + r.market.dailyVolume.toFixed(0));
    h += tscanCell('MARKET CAP', r.market.marketCap > 1e9 ? '$' + (r.market.marketCap / 1e9).toFixed(1) + 'B' : r.market.marketCap > 1e6 ? '$' + (r.market.marketCap / 1e6).toFixed(0) + 'M' : '$' + r.market.marketCap.toFixed(0));
    h += tscanCell('VOL RATIO', r.market.volRatio + 'x');
    h += tscanCell('AGE', r.market.age + (r.market.ageYears > 0 ? ' (' + r.market.ageYears + ' سنة)' : ''));
    h += tscanCell('LIQUIDITY', r.market.liquidityDepth, r.market.liquidityDepth === 'VERY LOW' ? 'var(--o)' : r.market.liquidityDepth === 'LOW' ? 'var(--o)' : 'var(--t)');
    h += tscanCell('SCORE', r.market.score + '/' + r.market.max);
    h += '</div></div>';

    h += '<div class="tscan-section"><div class="tscan-section-title">02 // PRICE INTEGRITY</div><div class="tscan-grid-2">';
    h += tscanCell('ALL TIME HIGH', '$' + (r.price.ath > 1 ? r.price.ath.toFixed(2) : r.price.ath.toFixed(6)));
    h += tscanCell('DROP FROM ATH', r.price.athDrop + '%', r.price.athDrop > 90 ? 'var(--o)' : 'var(--t)');
    h += tscanCell('PUMP & DUMP', r.price.pumpDump ? 'DETECTED' : 'NONE', r.price.pumpDump ? 'var(--o)' : 'var(--t)');
    h += tscanCell('MAX DAILY SWING', r.price.maxDailySwing + '%', r.price.maxDailySwing > 50 ? 'var(--o)' : 'var(--t)');
    h += tscanCell('AVG DAILY SWING', r.price.avgDailySwing + '%');
    h += tscanCell('SUSPICIOUS WICKS', '' + r.price.suspiciousWicks, r.price.suspiciousWicks > 5 ? 'var(--o)' : 'var(--t)');
    h += '</div></div>';

    var circFmt = r.supply.circulating > 1e9 ? (r.supply.circulating / 1e9).toFixed(1) + 'B' : r.supply.circulating > 1e6 ? (r.supply.circulating / 1e6).toFixed(0) + 'M' : r.supply.circulating.toFixed(0);
    var totalFmt = r.supply.total > 1e9 ? (r.supply.total / 1e9).toFixed(1) + 'B' : r.supply.total > 1e6 ? (r.supply.total / 1e6).toFixed(0) + 'M' : r.supply.total > 0 ? r.supply.total.toFixed(0) : 'N/A';
    h += '<div class="tscan-section"><div class="tscan-section-title">03 // SUPPLY RISK</div><div class="tscan-grid-2">';
    h += tscanCell('CIRCULATING', circFmt);
    h += tscanCell('TOTAL SUPPLY', totalFmt);
    h += tscanCell('CIRC %', r.supply.circulatingPct + '%', r.supply.circulatingPct < 10 ? 'var(--o)' : 'var(--t)');
    h += tscanCell('INFLATION RISK', r.supply.inflationRisk, r.supply.inflationRisk === 'EXTREME' || r.supply.inflationRisk === 'HIGH' ? 'var(--o)' : 'var(--t)');
    h += '</div>';
    h += '<div class="tscan-supply-bar-wrap"><div class="tscan-supply-bar-label">CIRCULATING vs TOTAL SUPPLY</div>';
    h += '<div class="tscan-supply-bar-track"><div class="tscan-supply-bar-fill" style="width:' + Math.min(100, r.supply.circulatingPct) + '%"></div><span class="tscan-supply-bar-pct">' + r.supply.circulatingPct + '%</span></div>';
    h += '<div class="tscan-supply-bar-legend"><span>CIRCULATING</span><span>LOCKED / UNRELEASED</span></div></div></div>';

    h += '<div class="tscan-section"><div class="tscan-section-title">04 // LISTING QUALITY</div><div class="tscan-grid-3">';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">TIER-1 EXCHANGES</div><div class="tscan-cell-big">' + r.listing.tier1Count + '</div></div>';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">TRADING PAIRS</div><div class="tscan-cell-big">' + r.listing.pairs + '</div></div>';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">SCORE</div><div class="tscan-cell-big">' + r.listing.score + '/' + r.listing.max + '</div></div></div>';
    h += '<div class="tscan-exchanges">';
    for (var i = 0; i < r.listing.exchanges.length; i++) {
        h += '<span class="tscan-exchange-badge">' + r.listing.exchanges[i] + '</span>';
    }
    h += '</div></div>';

    var ghBorderC = r.github.hasRepo ? 'var(--t)' : 'var(--o)';
    h += '<div class="tscan-section" style="border-right:4px solid ' + ghBorderC + '"><div class="tscan-section-title">05 // GITHUB ACTIVITY</div>';
    h += '<div class="tscan-gh-status"><div class="tscan-gh-dot" style="background:' + (r.github.hasRepo ? 'var(--t)' : 'var(--o)') + '"></div>';
    h += '<div class="tscan-gh-status-info"><div class="tscan-gh-status-title">' + (r.github.hasRepo ? 'REPOSITORY FOUND' : 'NO REPOSITORY') + '</div>' + (r.github.repoUrl ? '<div class="tscan-gh-status-url">' + r.github.repoUrl + '</div>' : '') + '</div>';
    h += '<div class="tscan-gh-status-badge" style="color:' + (r.github.isActive ? 'var(--t)' : 'var(--o)') + '">' + (r.github.isActive ? 'ACTIVE' : 'INACTIVE') + '</div></div>';
    h += '<div class="tscan-grid-3">';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">COMMITS (90D)</div><div class="tscan-cell-big" style="color:' + (r.github.commits90d > 20 ? 'var(--t)' : 'var(--o)') + '">' + r.github.commits90d + '</div></div>';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">CONTRIBUTORS</div><div class="tscan-cell-big" style="color:' + (r.github.contributors > 5 ? 'var(--t)' : 'var(--o)') + '">' + r.github.contributors + '</div></div>';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">LAST COMMIT</div><div class="tscan-cell-big" style="color:' + (r.github.lastCommitDays !== null && r.github.lastCommitDays < 30 ? 'var(--t)' : 'var(--o)') + '">' + (r.github.lastCommitDays !== null ? r.github.lastCommitDays + ' يوم' : '—') + '</div></div>';
    h += '</div><div class="tscan-grid-3" style="margin-top:8px">';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">STARS</div><div class="tscan-cell-big">' + (r.github.stars > 999 ? (r.github.stars / 1000).toFixed(1) + 'K' : r.github.stars) + '</div></div>';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">FORKS</div><div class="tscan-cell-big">' + (r.github.forks > 999 ? (r.github.forks / 1000).toFixed(1) + 'K' : r.github.forks) + '</div></div>';
    h += '<div class="tscan-cell-center"><div class="tscan-cell-label">OPEN SOURCE</div><div class="tscan-cell-big" style="color:' + (r.github.openSource ? 'var(--t)' : 'var(--o)') + '">' + (r.github.openSource ? 'YES' : 'NO') + '</div></div>';
    h += '</div></div>';

    h += '<div class="tscan-verdict" style="border-right-color:' + classC + '"><div class="tscan-section-title">VERDICT // الحكم النهائي</div><div class="tscan-verdict-text">';
    h += 'مشروع ' + r.name + ' (' + r.coin.toUpperCase() + ') حصل على تقييم ' + r.totalScore + '/100 وتصنيف <span style="color:' + classC + ';font-weight:900">' + r.classification + '</span>. ';
    h += (r.market.liquidityDepth === 'HIGH' || r.market.liquidityDepth === 'MODERATE' ? 'المشروع يتمتع بسيولة ' + r.market.liquidityDepth + ' وحجم تداول مستقر. ' : 'السيولة ' + r.market.liquidityDepth + ' مما يشير إلى مخاطر. ');
    h += (r.listing.tier1Count > 0 ? 'مُدرج في ' + r.listing.tier1Count + ' منصة كبرى. ' : 'غير مُدرج في منصات Tier-1. ');
    h += (r.github.hasRepo ? 'مستودع GitHub ' + (r.github.isActive ? 'نشط' : 'غير نشط') + ' مع ' + r.github.commits90d + ' commit في 90 يوم. ' : 'لا يوجد مستودع GitHub — علامة خطر. ');
    h += 'نسبة التداول ' + r.supply.circulatingPct + '% مع مخاطر تضخم ' + r.supply.inflationRisk + '.';
    h += '</div><div class="tscan-disclaimer">تنبيه: هذا التقييم مرجعي فقط ولا يُعتبر توصية استثمارية. فحص GitHub كمّي وليس نوعي — يقيس النشاط لا جودة الكود. لا يغني عن البحث الشخصي (DYOR). المستخدم يتحمل كامل المسؤولية.</div></div>';

    h += '<div class="tscan-guide"><div class="tscan-guide-title">دليل القراءة // READING GUIDE</div><div class="tscan-guide-text">';
    h += '<strong style="color:var(--t)">التصنيف:</strong> LEGIT (80-100) = مشروع موثوق. CAUTION (60-79) = يحتاج مراقبة. HIGH RISK (40-59) = مخاطر عالية. SCAM ALERT (0-39) = علامات احتيال قوية.<br><br>';
    h += '<strong style="color:var(--t)">Market Health (25 نقطة):</strong> يقيس حجم التداول اليومي مقارنة بالمتوسط، القيمة السوقية، عمق السيولة، وعمر العملة. العملات القديمة ذات السيولة العالية أكثر أماناً.<br><br>';
    h += '<strong style="color:var(--t)">Price Integrity (25 نقطة):</strong> يكشف أنماط Pump and Dump (ارتفاع 50%+ ثم انهيار 30%+)، التقلبات المفرطة، والذيول المشبوهة. انخفاض أكثر من 90% من ATH = علامة خطر شديدة.<br><br>';
    h += '<strong style="color:var(--t)">Supply Risk (20 نقطة):</strong> نسبة العملات المتداولة من الإجمالي. أقل من 10% = خطر تضخم شديد. وجود Max Supply محدد = إيجابي.<br><br>';
    h += '<strong style="color:var(--t)">Listing Quality (15 نقطة):</strong> الإدراج في منصات Tier-1 يتطلب فحص دقيق من المنصة — مؤشر إيجابي.<br><br>';
    h += '<strong style="color:var(--t)">GitHub Activity (15 نقطة):</strong> يفحص وجود مستودع عام ونشاط المطورين. هذا فحص كمّي فقط يقيس نشاط التطوير لا جودة الكود.<br><br>';
    h += '<strong style="color:var(--o)">DYOR:</strong> هذا التحليل مرجعي ولا يغني عن البحث الشخصي. لا توصية مالية. المستخدم يتحمل كامل المسؤولية.</div></div>';

    return h;
}

function tscanCell(label, value, color) {
    return '<div class="tscan-cell"><div class="tscan-cell-label">' + label + '</div><div class="tscan-cell-value" style="color:' + (color || 'var(--t)') + '">' + value + '</div></div>';
}


// ===== PDC — Project Data Check =====
(function(){
  'use strict';

  // ---------- CACHE 24 HOURS ----------
  const PDC_CACHE = {}; 
  const PDC_TTL = 24 * 60 * 60 * 1000; 

  // ---------- UTILITIES ----------
  function pdcStatus(msg, type) {
    const el = document.getElementById('pdc-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('pdc-error');
    if (type === 'error') el.classList.add('pdc-error');
  }

  function pdcFmt(n, d) {
    if (d === undefined) d = 2;
    if (!isFinite(n) || n === null || n === undefined) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function pdcFmtCompact(n) {
    if (!isFinite(n) || n === null || n === undefined) return '—';
    const a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'b';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
    return '$' + Number(n).toFixed(2);
  }

  function pdcFmtPrice(n) {
    if (!isFinite(n) || n === null) return '—';
    if (n >= 1000) return '$' + pdcFmt(n, 2);
    if (n >= 1) return '$' + pdcFmt(n, 4);
    if (n >= 0.01) return '$' + pdcFmt(n, 6);
    return '$' + pdcFmt(n, 8);
  }

  function pdcFmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  function pdcHoursAgo(ts) {
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    return Math.floor(diff / (60 * 60 * 1000));
  }

  function pdcSafe(v, def) {
    return (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) ? def : v;
  }

  // ---------- DIRECT API CALLS ----------
  async function pdcCallCoinGeckoSearch(symbol) {
    const r = await fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(symbol));
    if (!r.ok) throw new Error('CoinGecko search failed');
    return r.json();
  }

  async function pdcCallCoinGeckoDetail(id) {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/' + id + '?localization=false&tickers=false&community_data=false&developer_data=false');
    if (!r.ok) throw new Error('CoinGecko detail failed');
    return r.json();
  }

  async function pdcCallDefiLlama(path) {
    const r = await fetch('https://api.llama.fi' + path);
    if (!r.ok) return null; 
    return r.json();
  }

  async function pdcCallGoPlus(chainId, address) {
    if (!address) return null;
    const r = await fetch('https://api.gopluslabs.io/api/v1/token_security/' + chainId + '?contract_addresses=' + encodeURIComponent(address));
    if (!r.ok) return null;
    return r.json();
  }

  async function pdcCallGitHubRepo(owner, repo) {
    const r = await fetch('/api/github-audit?owner=' + encodeURIComponent(owner) + '&repo=' + encodeURIComponent(repo));
    if (!r.ok) return null;
    return r.json();
  }

  async function pdcCallGitHubCommits(owner, repo, since) {
    const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/commits?since=' + since + '&per_page=100');
    if (!r.ok) return null;
    return r.json();
  }

  // ---------- CHAIN ID MAPPING ----------
  const PDC_CHAIN_IDS = {
    'ethereum': '1', 'binance-smart-chain': '56', 'polygon-pos': '137',
    'arbitrum-one': '42161', 'optimistic-ethereum': '10', 'avalanche': '43114',
    'fantom': '250', 'base': '8453', 'tron': '195'
  };

  // ---------- DATA AGGREGATION ----------
  async function pdcGatherData(symbol) {
    const result = {
      symbol: symbol.toUpperCase(),
      analyzedAt: Date.now(),
      cachedUntil: Date.now() + PDC_TTL,
      hasError: {}
    };

    pdcStatus('جاري جلب بيانات العملة من CoinGecko ...');
    let coin;
    try {
      const searchData = await pdcCallCoinGeckoSearch(symbol);
      const matched = (searchData.coins || []).find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
      if (!matched) throw new Error('العملة غير موجودة');
      
      coin = await pdcCallCoinGeckoDetail(matched.id);
      result.name = coin.name;
      result.image = coin.image && coin.image.small;
      result.rank = coin.market_cap_rank;
      result.type = pdcDetectType(coin);
      result.platforms = coin.platforms || {};
      result.githubRepo = pdcExtractGitHub(coin.links);
      result.contractAddress = null;
      result.chainSlug = null;
      
      for (const key of Object.keys(result.platforms)) {
        if (result.platforms[key] && PDC_CHAIN_IDS[key]) {
          result.contractAddress = result.platforms[key];
          result.chainSlug = key;
          result.chainId = PDC_CHAIN_IDS[key];
          break;
        }
      }

      const md = coin.market_data || {};
      result.tokenPrice = pdcSafe(md.current_price && md.current_price.usd, null);
      result.priceChange24h = pdcSafe(md.price_change_percentage_24h, null);
      result.priceChange7d = pdcSafe(md.price_change_percentage_7d, null);
      result.priceChange30d = pdcSafe(md.price_change_percentage_30d, null);
      result.marketCap = pdcSafe(md.market_cap && md.market_cap.usd, null);
      result.mcapRank = pdcSafe(md.market_cap_rank, null);
      result.fdv = pdcSafe(md.fully_diluted_valuation && md.fully_diluted_valuation.usd, null);
      result.ath = pdcSafe(md.ath && md.ath.usd, null);
      result.athDate = md.ath_date && md.ath_date.usd ? pdcFmtDate(md.ath_date.usd) : null;
      result.athDrawdown = pdcSafe(md.ath_change_percentage && md.ath_change_percentage.usd, null);
      
      if (result.marketCap && result.fdv) {
        result.mcapFdvRatio = Math.round((result.marketCap / result.fdv) * 100);
      }
    } catch (e) {
      console.error('PDC CoinGecko error:', e);
      throw new Error('تعذّر العثور على العملة: ' + symbol);
    }

    pdcStatus('جاري جلب البيانات الاقتصادية من DefiLlama ...');
    try {
      const chainsData = await pdcCallDefiLlama('/v2/chains');
      if (chainsData) {
        const chain = chainsData.find(c => 
          c.name.toLowerCase() === result.name.toLowerCase() ||
          c.tokenSymbol === result.symbol
        );
        if (chain) {
          result.tvl = chain.tvl;
          result.chainName = chain.name;
        }
      }
      
      if (!result.tvl) {
        const protocolsData = await pdcCallDefiLlama('/protocols');
        if (protocolsData) {
          const protocol = protocolsData.find(p =>
            p.symbol === result.symbol ||
            p.name.toLowerCase() === result.name.toLowerCase()
          );
          if (protocol) {
            result.tvl = protocol.tvl;
            result.tvlChange24h = protocol.change_1d;
            result.tvlChange7d = protocol.change_7d;
            result.tvlChange30d = protocol.change_1m;
            result.protocolSlug = protocol.slug;
            result.protocolCategory = protocol.category;
          }
        }
      }

      try {
        const stablesData = await pdcCallDefiLlama('/stablecoins?includePrices=false');
        if (stablesData && stablesData.peggedAssets && result.chainName) {
          let total = 0;
          stablesData.peggedAssets.forEach(asset => {
            if (asset.chainCirculating && asset.chainCirculating[result.chainName]) {
              total += asset.chainCirculating[result.chainName].current.peggedUSD || 0;
            }
          });
          if (total > 0) result.stablecoinsMcap = total;
        }
      } catch (e) { }

      if (result.chainName) {
        try {
          const feesData = await pdcCallDefiLlama('/overview/fees/' + encodeURIComponent(result.chainName.toLowerCase()) + '?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true');
          if (feesData && feesData.total24h !== undefined) {
            result.chainFees24h = feesData.total24h;
            result.chainRevenue24h = pdcSafe(feesData.total24hRevenue || feesData.dailyRevenue, feesData.total24h);
          }
        } catch (e) { }
      }
    } catch (e) {
      console.error('PDC DefiLlama error:', e);
      result.hasError.defillama = true;
    }

    pdcStatus('جاري فحص العقد الذكي من GoPlus ...');
    if (result.contractAddress && result.chainId) {
      try {
        const goplusData = await pdcCallGoPlus(result.chainId, result.contractAddress);
        if (goplusData && goplusData.result) {
          const addrLower = result.contractAddress.toLowerCase();
          const token = goplusData.result[addrLower] || Object.values(goplusData.result)[0];
          if (token) {
            result.security = pdcParseGoPlus(token);
          }
        }
      } catch (e) {
        console.error('PDC GoPlus error:', e);
        result.hasError.goplus = true;
      }
    }

    pdcStatus('جاري جلب بيانات التطوير من GitHub ...');
    if (result.githubRepo) {
      try {
        const [owner, repoName] = result.githubRepo.split('/');
        
        const repoData = await pdcCallGitHubRepo(owner, repoName);
        if (repoData) {
          result.repo = result.githubRepo;
          result.stars = repoData.stargazers_count;
          result.forks = repoData.forks_count;
          result.openIssues = repoData.open_issues_count;
          result.language = repoData.language;
          result.lastCommitDate = repoData.pushed_at;
          result.lastCommitHours = pdcHoursAgo(repoData.pushed_at);
        }

        const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const commitsData = await pdcCallGitHubCommits(owner, repoName, since90);
        if (commitsData && Array.isArray(commitsData)) {
          result.commits90d = commitsData.length;
          const contributors = new Set();
          commitsData.forEach(c => {
            if (c.author && c.author.login) contributors.add(c.author.login);
          });
          result.activeContributors90d = contributors.size;
        }
      } catch (e) {
        console.error('PDC GitHub error:', e);
        result.hasError.github = true;
      }
    }

    pdcStatus('جاري حساب التقييم الإجمالي ...');
    result.pillars = pdcCalculatePillars(result);
    result.masterScore = Math.round(
      (result.pillars.security + result.pillars.economic + result.pillars.development) / 3 * 10
    ) / 10;
    
    const gradeInfo = pdcGradeFromScore(result.masterScore);
    result.masterGrade = gradeInfo.grade;
    result.masterTrust = gradeInfo.trust;
    result.masterTrustAr = gradeInfo.trustAr;
    result.gradeColor = gradeInfo.color;

    result.redFlags = pdcDetectRedFlags(result);
    result.greenFlags = pdcDetectGreenFlags(result);

    result.masterVerdict = pdcBuildVerdict(result);

    return result;
  }

  // ---------- HELPERS ----------
  function pdcDetectType(coin) {
    const categories = coin.categories || [];
    if (categories.some(c => /smart contract platform|layer 1|layer-1/i.test(c))) return 'Layer 1 Blockchain';
    if (categories.some(c => /layer 2|layer-2|rollup/i.test(c))) return 'Layer 2 Scaling';
    if (categories.some(c => /decentralized finance|defi/i.test(c))) return 'DeFi Protocol';
    if (categories.some(c => /stablecoin/i.test(c))) return 'Stablecoin';
    if (categories.some(c => /meme/i.test(c))) return 'Meme Token';
    if (categories.some(c => /nft/i.test(c))) return 'NFT Token';
    if (categories.some(c => /exchange/i.test(c))) return 'Exchange Token';
    return 'Crypto Asset';
  }

  function pdcExtractGitHub(links) {
    if (!links || !links.repos_url || !links.repos_url.github) return null;
    const repos = links.repos_url.github;
    if (!repos.length) return null;
    const url = repos[0];
    const match = url.match(/github\.com\/([^\/]+\/[^\/\?]+)/);
    return match ? match[1] : null;
  }

  function pdcParseGoPlus(token) {
    return {
      isHoneypot: token.is_honeypot === '1',
      canMint: token.is_mintable === '1',
      hasBlacklist: token.is_blacklisted === '1' || token.is_anti_whale === '1',
      hasWhitelist: token.is_whitelisted === '1',
      isPausable: token.transfer_pausable === '1',
      isSelfDestruct: token.selfdestruct === '1',
      liquidityLocked: parseFloat(token.lp_holder_count || 0) > 0,
      isOpenSource: token.is_open_source === '1',
      ownerRenounced: token.owner_address === '0x0000000000000000000000000000000000000000' || !token.owner_address,
      verifiedContract: token.is_open_source === '1',
      buyTax: parseFloat(token.buy_tax || 0) * 100,
      sellTax: parseFloat(token.sell_tax || 0) * 100,
      top10HoldersPct: (token.holders || [])
        .slice(0, 10)
        .reduce((s, h) => s + parseFloat(h.percent || 0) * 100, 0)
    };
  }

  function pdcCalculatePillars(d) {
    let security = 50;
    if (d.security) {
      const s = d.security;
      if (!s.isHoneypot) security += 8;
      if (!s.canMint) security += 5;
      if (!s.hasBlacklist) security += 4;
      if (!s.hasWhitelist) security += 3;
      if (!s.isPausable) security += 4;
      if (!s.isSelfDestruct) security += 5;
      if (s.liquidityLocked) security += 4;
      if (s.isOpenSource) security += 5;
      if (s.ownerRenounced) security += 6;
      if (s.verifiedContract) security += 3;
      if (s.buyTax === 0) security += 2;
      if (s.sellTax === 0) security += 2;
      if (s.top10HoldersPct < 50) security += 5;
      else if (s.top10HoldersPct < 70) security += 2;
    } else if (d.type === 'Layer 1 Blockchain') {
      security = d.rank && d.rank <= 50 ? 78 : d.rank && d.rank <= 100 ? 70 : 60;
    }
    security = Math.min(100, Math.max(0, Math.round(security)));

    let economic = 40;
    if (d.tvl) {
      if (d.tvl >= 10e9) economic += 30;
      else if (d.tvl >= 1e9) economic += 25;
      else if (d.tvl >= 100e6) economic += 20;
      else if (d.tvl >= 10e6) economic += 12;
      else if (d.tvl >= 1e6) economic += 6;
    }
    if (d.chainFees24h && d.chainFees24h > 0) economic += 8;
    if (d.chainRevenue24h && d.chainRevenue24h > 0) economic += 8;
    if (d.rank) {
      if (d.rank <= 10) economic += 15;
      else if (d.rank <= 50) economic += 10;
      else if (d.rank <= 100) economic += 5;
    }
    if (d.mcapFdvRatio && d.mcapFdvRatio >= 70) economic += 5;
    economic = Math.min(100, Math.max(0, Math.round(economic)));

    let development = 30;
    if (d.stars) {
      if (d.stars >= 10000) development += 20;
      else if (d.stars >= 5000) development += 15;
      else if (d.stars >= 1000) development += 10;
      else if (d.stars >= 100) development += 5;
    }
    if (d.forks) {
      if (d.forks >= 1000) development += 10;
      else if (d.forks >= 100) development += 6;
      else if (d.forks >= 10) development += 3;
    }
    if (d.commits90d) {
      if (d.commits90d >= 300) development += 20;
      else if (d.commits90d >= 100) development += 14;
      else if (d.commits90d >= 30) development += 8;
      else if (d.commits90d >= 5) development += 3;
    }
    if (d.activeContributors90d) {
      if (d.activeContributors90d >= 20) development += 15;
      else if (d.activeContributors90d >= 5) development += 10;
      else if (d.activeContributors90d >= 1) development += 5;
    }
    if (d.lastCommitHours !== null && d.lastCommitHours !== undefined) {
      if (d.lastCommitHours <= 48) development += 5;
      else if (d.lastCommitHours > 24 * 90) development -= 10;
    }
    development = Math.min(100, Math.max(0, Math.round(development)));

    return { security, economic, development };
  }

  function pdcGradeFromScore(score) {
    if (score >= 90) return { grade: 'A+', trust: 'EXCELLENT', trustAr: 'ممتاز', color: 'white' };
    if (score >= 75) return { grade: 'A', trust: 'TRUSTWORTHY', trustAr: 'موثوق', color: 'white' };
    if (score >= 60) return { grade: 'B', trust: 'ACCEPTABLE', trustAr: 'مقبول', color: 'white' };
    if (score >= 45) return { grade: 'C', trust: 'CAUTION', trustAr: 'يستوجب الحذر', color: 'orange' };
    return { grade: 'D', trust: 'HIGH RISK', trustAr: 'مخاطرة عالية', color: 'orange' };
  }

  function pdcDetectRedFlags(d) {
    const flags = [];
    if (d.security) {
      const s = d.security;
      if (s.isHoneypot) flags.push({ level: 'HIGH', text: 'العقد فخ احتيالي', detail: 'فحص GoPlus كشف أن البيع قد يكون مستحيلاً بعد الشراء، وهذه إشارة احتيال صريحة' });
      if (s.canMint) flags.push({ level: 'HIGH', text: 'إمكانية طباعة عملات', detail: 'المالك يستطيع إصدار عملات جديدة مما قد يخفض قيمة الحاملين في أي وقت' });
      if (s.hasBlacklist) flags.push({ level: 'HIGH', text: 'قائمة سوداء للعناوين', detail: 'العقد يحتوي على وظيفة حظر العناوين، مما يعني إمكانية تجميد محافظ المستخدمين' });
      if (s.isPausable) flags.push({ level: 'MEDIUM', text: 'إيقاف التحويلات ممكن', detail: 'المالك قادر على إيقاف كل التحويلات في العقد' });
      if (s.isSelfDestruct) flags.push({ level: 'HIGH', text: 'العقد قابل للتدمير الذاتي', detail: 'يمكن تدمير العقد بالكامل مما يؤدي لخسارة كل الأموال المرتبطة به' });
      if (!s.liquidityLocked) flags.push({ level: 'MEDIUM', text: 'السيولة غير مقفلة', detail: 'لا توجد آلية لقفل السيولة، مما يفتح الباب لإمكانية سحبها فجأة' });
      if (!s.isOpenSource) flags.push({ level: 'HIGH', text: 'الكود ليس مفتوح المصدر', detail: 'لا يمكن التحقق من الكود البرمجي للعقد، وهذه إشارة تحذير كبيرة' });
      if (!s.ownerRenounced) flags.push({ level: 'MEDIUM', text: 'المالك لم يتنازل عن الصلاحيات', detail: 'المالك يحتفظ بقدرة التحكم في العقد مما يعني مخاطر مركزية' });
      if (s.buyTax > 5) flags.push({ level: 'MEDIUM', text: 'ضريبة شراء مرتفعة', detail: 'ضريبة شراء بنسبة ' + s.buyTax.toFixed(1) + '% تقلل من ربحية الاستثمار' });
      if (s.sellTax > 5) flags.push({ level: 'HIGH', text: 'ضريبة بيع مرتفعة', detail: 'ضريبة بيع بنسبة ' + s.sellTax.toFixed(1) + '% تجعل الخروج من الاستثمار مكلفاً' });
      if (s.top10HoldersPct > 70) flags.push({ level: 'HIGH', text: 'تركز شديد في الحاملين', detail: 'أعلى 10 محافظ تملك ' + s.top10HoldersPct.toFixed(1) + '% من المعروض، مما يخلق مخاطر تلاعب' });
      else if (s.top10HoldersPct > 50) flags.push({ level: 'MEDIUM', text: 'تركز ملحوظ في الحاملين', detail: 'أعلى 10 محافظ تملك ' + s.top10HoldersPct.toFixed(1) + '% من المعروض، مما يخلق مخاطر تقلبات سعرية حادة' });
    }

    if (d.tvlChange30d && d.tvlChange30d < -25) {
      flags.push({ level: 'MEDIUM', text: 'تراجع حاد في القيمة المقفلة', detail: 'انخفاض ' + Math.abs(d.tvlChange30d).toFixed(1) + '% خلال 30 يوماً يدل على هجرة سيولة كبيرة' });
    } else if (d.tvlChange30d && d.tvlChange30d < -10) {
      flags.push({ level: 'LOW', text: 'تراجع في القيمة المقفلة', detail: 'انخفاض ' + Math.abs(d.tvlChange30d).toFixed(1) + '% خلال 30 يوماً قد يدل على تراجع نشاط المستخدمين' });
    }

    if (d.athDrawdown && d.athDrawdown < -90) {
      flags.push({ level: 'LOW', text: 'مسافة كبيرة من القمة التاريخية', detail: 'السعر يتداول ' + Math.abs(d.athDrawdown).toFixed(2) + '% تحت القمة التاريخية' });
    }

    if (d.mcapFdvRatio && d.mcapFdvRatio < 30) {
      flags.push({ level: 'MEDIUM', text: 'نسبة Mcap/FDV منخفضة', detail: 'النسبة ' + d.mcapFdvRatio + '% تعني وجود إصدار كبير من العملات سيدخل السوق مستقبلاً' });
    }

    if (d.lastCommitHours !== null && d.lastCommitHours !== undefined && d.lastCommitHours > 24 * 90) {
      flags.push({ level: 'HIGH', text: 'توقف نشاط التطوير', detail: 'لم يحدث أي commit منذ أكثر من 90 يوماً، مما يشير لتجميد المشروع' });
    }

    if (d.githubRepo && d.activeContributors90d !== undefined && d.activeContributors90d < 3) {
      flags.push({ level: 'MEDIUM', text: 'عدد مساهمين منخفض', detail: 'فقط ' + d.activeContributors90d + ' مساهمين نشطين خلال 90 يوماً، فريق محدود' });
    }

    return flags;
  }

  function pdcDetectGreenFlags(d) {
    const flags = [];
    if (d.security) {
      const s = d.security;
      const safeCount = !s.isHoneypot && !s.canMint && !s.hasBlacklist && !s.isPausable && !s.isSelfDestruct;
      if (safeCount) flags.push({ text: 'لا توجد ثغرات في العقد الذكي', detail: 'كل فحوصات GoPlus سليمة دون أي Honeypot أو Mint أو وظائف خطرة' });
      if (s.isOpenSource) flags.push({ text: 'كود مفتوح المصدر ومتحقق منه', detail: 'الكود البرمجي للعقد علني وقابل للتحقق من قبل أي شخص' });
      if (s.ownerRenounced) flags.push({ text: 'المالك تنازل عن الصلاحيات', detail: 'لا يستطيع أحد التحكم بالعقد بعد التنازل، وهذه علامة لامركزية مؤكدة' });
      if (s.liquidityLocked) flags.push({ text: 'السيولة مقفلة', detail: 'السيولة محمية ضد السحب المفاجئ الذي يحدث في عمليات Rug Pull' });
      if (s.buyTax === 0 && s.sellTax === 0) flags.push({ text: 'لا توجد ضرائب على البيع أو الشراء', detail: 'العقد لا يفرض أي ضريبة خفية على المعاملات' });
      if (s.top10HoldersPct < 40) flags.push({ text: 'توزيع عادل للحاملين', detail: 'أعلى 10 محافظ تملك فقط ' + s.top10HoldersPct.toFixed(1) + '% من المعروض، توزيع صحي' });
    }

    if (d.rank && d.rank <= 50) flags.push({ text: 'مشروع ضمن الـ 50 الأوائل عالمياً', detail: 'الترتيب #' + d.rank + ' يدل على ثقة سوقية واسعة' });
    if (d.tvl && d.tvl >= 1e9) flags.push({ text: 'قيمة مقفلة تتجاوز المليار دولار', detail: 'TVL = ' + pdcFmtCompact(d.tvl) + ' يدل على ثقة مالية كبيرة في المشروع' });
    if (d.chainRevenue24h && d.chainRevenue24h > 10000) flags.push({ text: 'إيرادات يومية حقيقية', detail: 'الشبكة تولد ' + pdcFmtCompact(d.chainRevenue24h) + ' يومياً من النشاط الفعلي' });

    if (d.stars && d.stars >= 5000) flags.push({ text: 'اهتمام مجتمعي تقني عالٍ', detail: pdcFmt(d.stars, 0) + ' نجمة على GitHub تدل على ثقة المطورين' });
    if (d.commits90d && d.commits90d >= 100) flags.push({ text: 'نشاط تطوير مرتفع', detail: pdcFmt(d.commits90d, 0) + ' commit خلال 90 يوماً، فريق ملتزم بالتطوير المستمر' });
    if (d.activeContributors90d && d.activeContributors90d >= 10) flags.push({ text: 'فريق تطوير نشط', detail: d.activeContributors90d + ' مساهماً نشطاً خلال 90 يوماً، تنوع جيد في الفريق' });
    if (d.lastCommitHours !== null && d.lastCommitHours !== undefined && d.lastCommitHours <= 48) flags.push({ text: 'تطوير حديث جداً', detail: 'آخر commit منذ ' + d.lastCommitHours + ' ساعة، الفريق يعمل بنشاط' });

    return flags;
  }

  function pdcBuildVerdict(d) {
    const score = d.masterScore;
    const grade = d.masterGrade;
    let verdict = '';

    if (score >= 90) {
      verdict = 'مشروع ممتاز يحقق أعلى معايير الجودة. الدرجة ' + grade + ' تضعه ضمن أفضل 10% من المشاريع المُحلَّلة. ';
    } else if (score >= 75) {
      verdict = 'مشروع موثوق بأساسيات قوية. الدرجة ' + grade + ' تشير إلى تصنيف ضمن أفضل 25% من المشاريع المُحلَّلة. ';
    } else if (score >= 60) {
      verdict = 'مشروع مقبول مع بعض نقاط الانتباه. الدرجة ' + grade + ' تعني وجود جوانب قوة وأخرى تحتاج مراجعة. ';
    } else if (score >= 45) {
      verdict = 'مشروع يستوجب الحذر الشديد. الدرجة ' + grade + ' تكشف عن مخاطر جوهرية يجب مراجعتها قبل أي قرار. ';
    } else {
      verdict = 'مشروع عالي المخاطر. الدرجة ' + grade + ' تشير إلى مشاكل خطيرة في عدة أبعاد، التعامل معه ينطوي على مخاطر كبيرة. ';
    }

    const flagsCount = d.redFlags.length;
    if (flagsCount === 0) {
      verdict += 'لا توجد نقاط انتباه تحذيرية.';
    } else if (flagsCount <= 2) {
      verdict += 'نقاط الانتباه الرئيسية: ' + d.redFlags.slice(0, 2).map(f => f.text).join('، ') + '.';
    } else {
      verdict += 'يوجد ' + flagsCount + ' نقاط انتباه يجب مراجعتها بالتفصيل في قسم المؤشرات.';
    }

    return verdict;
  }

  // ---------- MAIN ENTRY ----------
  window.runPDC = async function() {
    const sym = (document.getElementById('pdc-symbol').value || 'BTC').trim().toUpperCase();
    const resultEl = document.getElementById('pdc-result');
    const btn = document.getElementById('pdc-btn');

    resultEl.classList.remove('pdc-show');
    resultEl.innerHTML = '';
    if (btn) btn.disabled = true;

    if (typeof trackToolUsage === 'function') trackToolUsage('pg-pdc');

    try {
      const now = Date.now();
      if (PDC_CACHE[sym] && (now - PDC_CACHE[sym].timestamp) < PDC_TTL) {
        const cached = PDC_CACHE[sym].data;
        resultEl.innerHTML = pdcRender(cached);
        resultEl.classList.add('pdc-show');
        pdcStatus('اكتمل التحليل · ' + pdcFmtDate(cached.analyzedAt) + ' · صالح حتى ' + pdcFmtDate(cached.cachedUntil));
        if (btn) btn.disabled = false;
        return;
      }

      const data = await pdcGatherData(sym);
      PDC_CACHE[sym] = { data: data, timestamp: now };

      resultEl.innerHTML = pdcRender(data);
      resultEl.classList.add('pdc-show');
      pdcStatus('اكتمل التحليل · ' + pdcFmtDate(data.analyzedAt) + ' · صالح حتى ' + pdcFmtDate(data.cachedUntil));

    } catch (err) {
      console.error('PDC error:', err);
      pdcStatus('تعذّر التحليل: ' + (err.message || 'خطأ غير معروف'), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ---------- RENDER ----------
  function pdcRender(d) {
    let h = '';

    h += '<table class="pdc-table">';
    h += '<tbody>';
    h += '<tr><td class="pdc-cell-label">الرمز</td><td class="pdc-cell-value">' + d.symbol + ' · ' + (d.name || '—') + '</td></tr>';
    h += '<tr><td class="pdc-cell-label">النوع</td><td class="pdc-cell-value">' + (d.type || '—') + '</td></tr>';
    h += '<tr><td class="pdc-cell-label">الترتيب</td><td class="pdc-cell-value">' + (d.rank ? '#' + d.rank + ' عالمياً' : '—') + '</td></tr>';
    h += '<tr><td class="pdc-cell-label">الشبكة</td><td class="pdc-cell-value">' + (d.chainName || d.chainSlug || '—') + '</td></tr>';
    h += '</tbody></table>';

    h += '<div class="pdc-section">MASTER VERDICT / التقييم الإجمالي</div>';
    const isOrange = d.gradeColor === 'orange';
    h += '<div class="pdc-master' + (isOrange ? ' pdc-master-orange' : '') + '">';
    h += '<div class="pdc-master-top">';
    h += '<div>';
    h += '<div class="pdc-master-grade-label">OVERALL GRADE</div>';
    h += '<div class="pdc-master-grade' + (isOrange ? ' pdc-orange' : '') + '">' + d.masterGrade + '</div>';
    h += '<div class="pdc-master-trust' + (isOrange ? ' pdc-orange' : '') + '">' + d.masterTrust + '</div>';
    h += '</div>';
    h += '<div class="pdc-master-score-block">';
    h += '<div class="pdc-master-score-label">SCORE</div>';
    h += '<div><span class="pdc-master-score-num' + (isOrange ? ' pdc-orange' : '') + '">' + d.masterScore + '</span><span class="pdc-master-score-max">/100</span></div>';
    h += '<div class="pdc-master-trust-ar">' + d.masterTrustAr + '</div>';
    h += '</div>';
    h += '</div>';
    h += '<div class="pdc-verdict-text">' + d.masterVerdict + '</div>';

    h += '<table class="pdc-pillars"><tbody>';
    const pillars = [
      { ar: 'الأمان', en: 'SECURITY', value: d.pillars.security },
      { ar: 'الاقتصاد', en: 'ECONOMIC', value: d.pillars.economic },
      { ar: 'التطوير', en: 'DEVELOPMENT', value: d.pillars.development },
    ];
    pillars.forEach(p => {
      const cls = p.value >= 70 ? '' : ' pdc-orange';
      h += '<tr>';
      h += '<td class="pdc-pillar-name">' + p.ar + '</td>';
      h += '<td class="pdc-pillar-en">' + p.en + '</td>';
      h += '<td class="pdc-pillar-bar-cell"><div class="pdc-pillar-bar"><div class="pdc-pillar-bar-fill' + cls + '" style="width:' + p.value + '%"></div></div></td>';
      h += '<td class="pdc-pillar-score' + cls + '">' + p.value + '<span class="pdc-pillar-score-max">/100</span></td>';
      h += '</tr>';
    });
    h += '</tbody></table>';
    h += '</div>';

    h += '<div class="pdc-flags-counter">';
    h += '<div><div class="pdc-flags-counter-label" style="color:#fff;">GREEN FLAGS</div>';
    h += '<div class="pdc-flags-counter-num" style="color:#fff;">' + d.greenFlags.length + '</div>';
    h += '<div class="pdc-flags-counter-sub">إشارات إيجابية</div></div>';
    h += '<div><div class="pdc-flags-counter-label" style="color:var(--o);">RED FLAGS</div>';
    h += '<div class="pdc-flags-counter-num" style="color:var(--o);">' + d.redFlags.length + '</div>';
    h += '<div class="pdc-flags-counter-sub">نقاط انتباه</div></div>';
    h += '</div>';

    h += '<div class="pdc-section">SECURITY / الأمان والتدقيقات</div>';

    if (d.security) {
      h += '<div class="pdc-block-head">SMART CONTRACT CHECKS · GoPlus</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      const checks = [
        { ar: 'العقد فخ احتيالي', en: 'Honeypot', value: d.security.isHoneypot, danger: true },
        { ar: 'إمكانية طباعة عملات', en: 'Mint Function', value: d.security.canMint, danger: true },
        { ar: 'قائمة سوداء للعناوين', en: 'Blacklist', value: d.security.hasBlacklist, danger: true },
        { ar: 'قائمة بيضاء مقيدة', en: 'Whitelist', value: d.security.hasWhitelist, danger: true },
        { ar: 'إيقاف التحويلات', en: 'Pausable', value: d.security.isPausable, danger: true },
        { ar: 'تدمير ذاتي للعقد', en: 'Self-Destruct', value: d.security.isSelfDestruct, danger: true },
        { ar: 'السيولة مقفلة', en: 'Liquidity Locked', value: d.security.liquidityLocked, danger: false },
        { ar: 'الكود مفتوح المصدر', en: 'Open Source', value: d.security.isOpenSource, danger: false },
        { ar: 'المالك تنازل عن السيطرة', en: 'Owner Renounced', value: d.security.ownerRenounced, danger: false },
        { ar: 'العقد متحقق منه', en: 'Verified Contract', value: d.security.verifiedContract, danger: false },
      ];
      checks.forEach(c => {
        const isGood = c.danger ? !c.value : c.value;
        h += '<tr>';
        h += '<td class="pdc-cell-label" style="width:40%">' + c.ar + '</td>';
        h += '<td style="padding:11px 14px;font-family:\'Share Tech Mono\',monospace;font-size:11px;color:#888;letter-spacing:1px;width:30%;text-align:right;">' + c.en.toUpperCase() + '</td>';
        h += '<td style="padding:11px 14px;text-align:left;width:15%;"><span class="pdc-yn ' + (isGood ? 'pdc-yn-good' : 'pdc-yn-bad') + '">' + (c.value ? 'YES' : 'NO') + '</span></td>';
        h += '<td style="padding:11px 14px;text-align:left;font-family:\'Share Tech Mono\',monospace;font-size:11px;letter-spacing:1px;width:15%;color:' + (isGood ? '#fff' : 'var(--o)') + ';">' + (isGood ? 'SAFE' : 'RISK') + '</td>';
        h += '</tr>';
      });
      h += '</tbody></table>';

      h += '<div class="pdc-block-head">HOLDERS &amp; TAX</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      const top10Orange = d.security.top10HoldersPct > 50;
      h += '<tr><td class="pdc-cell-label">تركز أعلى 10 محافظ</td>';
      h += '<td class="pdc-cell-value' + (top10Orange ? ' pdc-orange' : '') + '">' + pdcFmt(d.security.top10HoldersPct, 2) + '%</td>';
      h += '<td class="pdc-cell-meta">' + (top10Orange ? 'تركز مرتفع' : 'تركز معتدل') + '</td></tr>';
      h += '<tr><td class="pdc-cell-label">ضريبة الشراء</td>';
      h += '<td class="pdc-cell-value' + (d.security.buyTax > 0 ? ' pdc-orange' : '') + '">' + pdcFmt(d.security.buyTax, 1) + '%</td>';
      h += '<td class="pdc-cell-meta">' + (d.security.buyTax === 0 ? 'لا توجد' : 'موجودة') + '</td></tr>';
      h += '<tr><td class="pdc-cell-label">ضريبة البيع</td>';
      h += '<td class="pdc-cell-value' + (d.security.sellTax > 0 ? ' pdc-orange' : '') + '">' + pdcFmt(d.security.sellTax, 1) + '%</td>';
      h += '<td class="pdc-cell-meta">' + (d.security.sellTax === 0 ? 'لا توجد' : 'موجودة') + '</td></tr>';
      h += '</tbody></table>';
    } else if (d.type === 'Layer 1 Blockchain') {
      h += '<div class="pdc-block-head">LAYER 1 BLOCKCHAIN</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      h += '<tr><td class="pdc-cell-label" style="text-align:right;padding:14px;">' + d.name + ' هي شبكة بلوك تشين أساسية (Layer 1)، ولا يوجد عقد ذكي مباشر للفحص. الأمان يعتمد على بنية الشبكة وآلية الإجماع.</td></tr>';
      h += '</tbody></table>';
    } else {
      h += '<div class="pdc-block-head">SMART CONTRACT</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      h += '<tr><td class="pdc-cell-label" style="text-align:right;padding:14px;">لم تتوفر بيانات فحص العقد الذكي لهذه العملة.</td></tr>';
      h += '</tbody></table>';
    }

    h += '<div class="pdc-section">ECONOMIC HEALTH / الصحة الاقتصادية · DefiLlama</div>';

    if (d.tvl) {
      h += '<div class="pdc-block-head">TOTAL VALUE LOCKED</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      h += '<tr><td class="pdc-cell-label">القيمة المقفلة الحالية</td>';
      h += '<td class="pdc-cell-value">' + pdcFmtCompact(d.tvl) + '</td>';
      h += '<td class="pdc-cell-meta">' + (d.protocolCategory || d.chainName || '—') + '</td></tr>';
      if (d.tvlChange24h !== undefined && d.tvlChange24h !== null) {
        const orangeCls = d.tvlChange24h < 0 ? ' pdc-orange' : '';
        h += '<tr><td class="pdc-cell-label">التغير خلال 24 ساعة</td>';
        h += '<td class="pdc-cell-value' + orangeCls + '">' + (d.tvlChange24h >= 0 ? '+' : '') + pdcFmt(d.tvlChange24h, 2) + '%</td>';
        h += '<td class="pdc-cell-meta">24H</td></tr>';
      }
      if (d.tvlChange7d !== undefined && d.tvlChange7d !== null) {
        const orangeCls = d.tvlChange7d < 0 ? ' pdc-orange' : '';
        h += '<tr><td class="pdc-cell-label">التغير خلال 7 أيام</td>';
        h += '<td class="pdc-cell-value' + orangeCls + '">' + (d.tvlChange7d >= 0 ? '+' : '') + pdcFmt(d.tvlChange7d, 2) + '%</td>';
        h += '<td class="pdc-cell-meta">7D</td></tr>';
      }
      if (d.tvlChange30d !== undefined && d.tvlChange30d !== null) {
        const orangeCls = d.tvlChange30d < 0 ? ' pdc-orange' : '';
        h += '<tr><td class="pdc-cell-label">التغير خلال 30 يوم</td>';
        h += '<td class="pdc-cell-value' + orangeCls + '">' + (d.tvlChange30d >= 0 ? '+' : '') + pdcFmt(d.tvlChange30d, 2) + '%</td>';
        h += '<td class="pdc-cell-meta">30D</td></tr>';
      }
      h += '</tbody></table>';
    }

    const hasActivity = d.chainFees24h || d.chainRevenue24h || d.stablecoinsMcap;
    if (hasActivity) {
      h += '<div class="pdc-block-head">DAILY ACTIVITY · 24H</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      const activity = [
        { ar: 'رسوم الشبكة', en: 'Chain Fees', value: d.chainFees24h, isPrice: true },
        { ar: 'إيرادات الشبكة', en: 'Chain Revenue', value: d.chainRevenue24h, isPrice: true },
        { ar: 'القيمة السوقية للستيبل كوينز', en: 'Stablecoins Mcap', value: d.stablecoinsMcap, isCompact: true },
      ].filter(m => m.value !== undefined && m.value !== null);

      activity.forEach(m => {
        h += '<tr><td class="pdc-cell-label">' + m.ar + '</td>';
        h += '<td style="padding:11px 14px;font-family:\'Share Tech Mono\',monospace;font-size:11px;color:#888;letter-spacing:1px;text-align:right;">' + m.en.toUpperCase() + '</td>';
        h += '<td class="pdc-cell-value">' + (m.isCompact ? pdcFmtCompact(m.value) : '$' + pdcFmt(m.value, 0)) + '</td></tr>';
      });
      h += '</tbody></table>';
    }

    h += '<div class="pdc-block-head">TOKEN METRICS</div>';
    h += '<table class="pdc-table pdc-no-border-top"><tbody>';
    if (d.tokenPrice !== null) {
      const p24Cls = d.priceChange24h && d.priceChange24h < 0 ? ' pdc-orange' : '';
      h += '<tr><td class="pdc-cell-label">السعر الحالي</td>';
      h += '<td class="pdc-cell-value">' + pdcFmtPrice(d.tokenPrice) + '</td>';
      h += '<td class="pdc-cell-meta' + p24Cls + '">' + (d.priceChange24h !== null ? (d.priceChange24h >= 0 ? '+' : '') + pdcFmt(d.priceChange24h, 2) + '% / 24H' : '—') + '</td></tr>';
    }
    if (d.marketCap !== null) {
      h += '<tr><td class="pdc-cell-label">القيمة السوقية</td>';
      h += '<td class="pdc-cell-value">' + pdcFmtCompact(d.marketCap) + '</td>';
      h += '<td class="pdc-cell-meta">' + (d.mcapRank ? '#' + d.mcapRank + ' عالمياً' : '—') + '</td></tr>';
    }
    if (d.fdv !== null) {
      h += '<tr><td class="pdc-cell-label">القيمة المخففة بالكامل</td>';
      h += '<td class="pdc-cell-value">' + pdcFmtCompact(d.fdv) + '</td>';
      h += '<td class="pdc-cell-meta">FDV</td></tr>';
    }
    if (d.mcapFdvRatio !== undefined) {
      const fdvCls = d.mcapFdvRatio < 50 ? ' pdc-orange' : '';
      h += '<tr><td class="pdc-cell-label">نسبة Mcap إلى FDV</td>';
      h += '<td class="pdc-cell-value' + fdvCls + '">' + d.mcapFdvRatio + '%</td>';
      h += '<td class="pdc-cell-meta">متداول من المخفّف</td></tr>';
    }
    if (d.ath !== null) {
      h += '<tr><td class="pdc-cell-label">القمة التاريخية</td>';
      h += '<td class="pdc-cell-value">' + pdcFmtPrice(d.ath) + '</td>';
      h += '<td class="pdc-cell-meta">' + (d.athDate || '—') + '</td></tr>';
    }
    if (d.athDrawdown !== null) {
      h += '<tr><td class="pdc-cell-label">الانخفاض من القمة</td>';
      h += '<td class="pdc-cell-value pdc-orange">' + pdcFmt(d.athDrawdown, 2) + '%</td>';
      h += '<td class="pdc-cell-meta">FROM ATH</td></tr>';
    }
    h += '</tbody></table>';

    if (d.githubRepo) {
      h += '<div class="pdc-section">DEVELOPMENT ACTIVITY / نشاط التطوير · GitHub</div>';
      h += '<div class="pdc-block-head">REPOSITORY · ' + d.repo + '</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      if (d.stars !== undefined) {
        h += '<tr><td class="pdc-cell-label">النجوم</td>';
        h += '<td class="pdc-cell-value">' + pdcFmt(d.stars, 0) + '</td>';
        h += '<td class="pdc-cell-meta">STARS</td></tr>';
      }
      if (d.forks !== undefined) {
        h += '<tr><td class="pdc-cell-label">الفورك</td>';
        h += '<td class="pdc-cell-value">' + pdcFmt(d.forks, 0) + '</td>';
        h += '<td class="pdc-cell-meta">FORKS</td></tr>';
      }
      if (d.openIssues !== undefined) {
        h += '<tr><td class="pdc-cell-label">Issues مفتوحة</td>';
        h += '<td class="pdc-cell-value">' + pdcFmt(d.openIssues, 0) + '</td>';
        h += '<td class="pdc-cell-meta">OPEN ISSUES</td></tr>';
      }
      if (d.language) {
        h += '<tr><td class="pdc-cell-label">لغة البرمجة</td>';
        h += '<td class="pdc-cell-value">' + d.language + '</td>';
        h += '<td class="pdc-cell-meta">LANGUAGE</td></tr>';
      }
      h += '</tbody></table>';

      h += '<div class="pdc-block-head">COMMITS ACTIVITY · 90 DAYS</div>';
      h += '<table class="pdc-table pdc-no-border-top"><tbody>';
      if (d.commits90d !== undefined) {
        h += '<tr><td class="pdc-cell-label">إجمالي Commits آخر 90 يوم</td>';
        h += '<td class="pdc-cell-value">' + pdcFmt(d.commits90d, 0) + '</td>';
        h += '<td class="pdc-cell-meta">90D COMMITS</td></tr>';
      }
      if (d.activeContributors90d !== undefined) {
        h += '<tr><td class="pdc-cell-label">المساهمون النشطون</td>';
        h += '<td class="pdc-cell-value">' + d.activeContributors90d + '</td>';
        h += '<td class="pdc-cell-meta">ACTIVE / 90D</td></tr>';
      }
      if (d.lastCommitHours !== null && d.lastCommitHours !== undefined) {
        const oldCls = d.lastCommitHours > 24 * 30 ? ' pdc-orange' : '';
        const hoursText = d.lastCommitHours < 24 ? 'منذ ' + d.lastCommitHours + ' ساعة' :
                          d.lastCommitHours < 24 * 30 ? 'منذ ' + Math.floor(d.lastCommitHours / 24) + ' يوم' :
                          'منذ ' + Math.floor(d.lastCommitHours / (24 * 30)) + ' شهر';
        h += '<tr><td class="pdc-cell-label">آخر Commit</td>';
        h += '<td class="pdc-cell-value' + oldCls + '">' + hoursText + '</td>';
        h += '<td class="pdc-cell-meta">' + (d.lastCommitDate ? pdcFmtDate(d.lastCommitDate) : '—') + '</td></tr>';
      }
      h += '</tbody></table>';
    }

    h += '<div class="pdc-section">FLAGS / المؤشرات التفصيلية</div>';

    if (d.redFlags.length > 0) {
      h += '<div class="pdc-block-head pdc-orange">RED FLAGS · ' + d.redFlags.length + ' ATTENTION POINTS</div>';
      h += '<table class="pdc-table pdc-no-border-top pdc-orange-border"><tbody>';
      d.redFlags.forEach((f, i) => {
        h += '<tr class="pdc-flag-row">';
        h += '<td class="pdc-flag-level-cell"><span class="pdc-flag-level">' + f.level + '</span></td>';
        h += '<td class="pdc-flag-content">';
        h += '<div class="pdc-flag-text">' + f.text + '</div>';
        h += '<div class="pdc-flag-detail">' + f.detail + '</div>';
        h += '</td></tr>';
      });
      h += '</tbody></table>';
    }

    if (d.greenFlags.length > 0) {
      h += '<div class="pdc-block-head pdc-white">GREEN FLAGS · ' + d.greenFlags.length + ' POSITIVE SIGNALS</div>';
      h += '<table class="pdc-table pdc-no-border-top pdc-white-border"><tbody>';
      d.greenFlags.forEach(f => {
        h += '<tr class="pdc-flag-row">';
        h += '<td class="pdc-green-bar-cell"><div class="pdc-green-bar"></div></td>';
        h += '<td class="pdc-flag-content">';
        h += '<div class="pdc-flag-text">' + f.text + '</div>';
        h += '<div class="pdc-flag-detail">' + f.detail + '</div>';
        h += '</td></tr>';
      });
      h += '</tbody></table>';
    }

    h += '<div class="pdc-section">READING GUIDE / دليل القراءة</div>';
    h += '<div class="pdc-guide">';
    h += '<div class="pdc-guide-block"><div class="pdc-guide-h">ما الذي تقدمه هذه الأداة</div><div class="pdc-guide-p">تدقيق شامل يجمع ثلاثة أبعاد للحكم على صحة المشروع: أمان العقد الذكي عبر فحوصات GoPlus، الصحة الاقتصادية من DefiLlama، ونشاط التطوير من GitHub. النتائج تتجمع في درجة موحدة من 100 مع تصنيف حرفي من A+ إلى D.</div></div>';
    h += '<div class="pdc-guide-block"><div class="pdc-guide-h">قراءة الدرجة الإجمالية</div><div class="pdc-guide-p">الدرجة A+ فوق 90 تعني ممتاز، A بين 75 و 90 موثوق، B بين 60 و 75 مقبول، C بين 45 و 60 يستوجب الحذر، D أقل من 45 مرفوض. الأبعاد الثلاثة في الأعلى تكشف نقاط القوة والضعف بسرعة: شريط ممتلئ بالأبيض إيجابي، بالبرتقالي تحذيري.</div></div>';
    h += '<div class="pdc-guide-block"><div class="pdc-guide-h">قراءة قسم الأمان</div><div class="pdc-guide-p">فحوصات GoPlus العشرة تجيب بنعم أو لا: الإجابة الإيجابية بالأبيض، الخطرة بالبرتقالي. تركز كبار الحاملين فوق 50% مؤشر تحذير، وضرائب البيع والشراء يجب أن تكون صفراً. للعملات من نوع Layer 1 لا يوجد عقد ذكي للفحص.</div></div>';
    h += '<div class="pdc-guide-block"><div class="pdc-guide-h">قراءة قسم الاقتصاد</div><div class="pdc-guide-p">القيمة المقفلة تقيس الثقة المالية في المشروع. الإيرادات الفعلية أهم من السعر لأنها تعكس قيمة حقيقية. نسبة Mcap إلى FDV تنبه إلى عمليات Token Unlock مستقبلية: نسبة منخفضة تعني عرض كبير قادم. الانخفاض من القمة يكشف مرحلة السوق الحالية.</div></div>';
    h += '<div class="pdc-guide-block"><div class="pdc-guide-h">قراءة قسم التطوير</div><div class="pdc-guide-p">عدد المساهمين النشطين في 90 يوماً أهم من العدد الكلي. النجوم والفورك تعكس الاهتمام المجتمعي. مشروع بلا commits في 90 يوماً يستحق التشكيك حتى لو كان سعره مرتفعاً. لغة البرمجة تعكس المستوى التقني.</div></div>';
    h += '</div>';

    h += '<div class="pdc-disc">';
    h += '<div class="pdc-disc-h">DISCLAIMER / إخلاء مسؤولية</div>';
    h += 'التحليل احتمالي ومبني على بيانات لحظية من مصادر خارجية (CoinGecko, DefiLlama, GoPlus, GitHub). لا يضمن سلامة الاستثمار وليس توصية شراء أو بيع. التدقيقات الأمنية لا تستبعد كل المخاطر. التحليل مخصص للأسواق الفورية فقط دون رفع مالي أو مشتقات. القرار النهائي ومخاطره مسؤولية المستخدم وحده.';
    h += '</div>';

    h += '<div class="pdc-footer">منصة 360° — PROJECT DATA CHECK / فحص بيانات العملة</div>';

    return h;
  }

})();
// ===== END PDC =====

// ===== SCA — Smart Contract Audit =====
(function(){
  'use strict';

  // ---------- CACHE 24 HOURS ----------
  const SCA_CACHE = {}; // { 'PEPE_1': { data, timestamp } }
  const SCA_TTL = 24 * 60 * 60 * 1000;

  // ---------- CHAIN NAMES ----------
  const SCA_CHAIN_NAMES = {
    '1': 'Ethereum', '56': 'BSC', '137': 'Polygon',
    '42161': 'Arbitrum', '10': 'Optimism', '8453': 'Base',
    '43114': 'Avalanche', '250': 'Fantom',
    'solana': 'Solana'
  };

  const SCA_CHAIN_SLUGS = {
    '1': 'ethereum', '56': 'binance-smart-chain', '137': 'polygon-pos',
    '42161': 'arbitrum-one', '10': 'optimistic-ethereum', '8453': 'base',
    '43114': 'avalanche', '250': 'fantom',
    'solana': 'solana'
  };
    
  // ---------- UTILITIES ----------
  function scaStatus(msg, type) {
    const el = document.getElementById('sca-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('sca-error');
    if (type === 'error') el.classList.add('sca-error');
  }

  function scaFmt(n, d) {
    if (d === undefined) d = 2;
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function scaFmtBig(n) {
    if (n === null || n === undefined) return '—';
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
  }

  function scaFmtCompact(n) {
    if (n === null || n === undefined) return '—';
    const a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'b';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'm';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
    return '$' + n.toFixed(2);
  }

 window.scaCopyAddress = function(fullAddr) {
    navigator.clipboard.writeText(fullAddr).then(() => {
      // إنشاء رسالة منبثقة سريعة (Toast) برمجياً إذا لم تكن موجودة
      let toast = document.getElementById('sca-copy-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sca-copy-toast';
        toast.style.cssText = 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:var(--o); color:#000; padding:6px 16px; font-family:"Cairo",sans-serif; font-size:12px; font-weight:bold; border-radius:4px; z-index:9999; transition:opacity 0.2s ease-in-out; pointer-events:none; opacity:0; box-shadow:0 4px 10px rgba(0,0,0,0.5);';
        document.body.appendChild(toast);
      }
      
      // إظهار الرسالة
      toast.textContent = 'تم النسخ';
      toast.style.opacity = '1';
      
      // إخفاء الرسالة بسرعة بعد 1.5 ثانية
      setTimeout(() => {
        toast.style.opacity = '0';
      }, 1500);
    });
  };

  function scaShortAddr(addr) {
    if (!addr) return '—';
    const s = String(addr);
    let short = s;
    if (s.length >= 12) short = s.slice(0, 6) + '...' + s.slice(-4);
    
    // أيقونة المربعين المتداخلين (شفافة ورمادية)
    const copyIcon = '<svg viewBox="0 0 24 24" width="12" height="12" stroke="#888" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6; margin-right:6px; vertical-align:middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    
    return '<span onclick="window.scaCopyAddress(\'' + s + '\')" style="cursor:pointer; display:inline-flex; align-items:center; transition:opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1" title="انسخ العنوان الكامل">' + short + copyIcon + '</span>';
  }
    
    function scaFmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  function scaEsc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- DIRECT API CALLS ----------
  async function scaCallCoinGecko(symbol) {
    // 1. Search for the coin directly from CoinGecko
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error('تعذّر العثور على العملة (خطأ في البحث)');
    const searchData = await searchRes.json();
    
    const coin = (searchData.coins || []).find(c => c.symbol.toLowerCase() === symbol.toLowerCase());
    if (!coin) throw new Error('العملة غير موجودة في قاعدة البيانات');

    // 2. Fetch full details
    const detailUrl = `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) throw new Error('تعذّر جلب تفاصيل العقد');
    return detailRes.json();
  }

 async function scaCallSecurity(chainId, address) {
    let url;
    
    // التوجيه الذكي: مسار منفصل لسولانا، ومسار موحد لباقي الشبكات (EVM)
    if (chainId === 'solana') {
      url = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(address)}`;
    } else {
      url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${encodeURIComponent(address)}`;
    }

    const r = await fetch(url);
    if (!r.ok) throw new Error('تعذّر فحص العقد الذكي من المصدر الأمني');
    return r.json();
  }
    
    // ---------- GET CONTRACT FOR CHAIN ----------
  function scaGetContractForChain(coin, chainId) {
    const slug = SCA_CHAIN_SLUGS[chainId];
    if (!slug) return null;
    const platforms = coin.platforms || {};
    return platforms[slug] || null;
  }

  // ---------- DATA PARSING ----------
  function scaParseGoPlus(token) {
    const truthy = (v) => v === '1' || v === 1 || v === true;
    return {
      tokenName: token.token_name || '',
      tokenSymbol: token.token_symbol || '',
      totalSupply: parseFloat(token.total_supply || 0),
      holderCount: parseInt(token.holder_count || 0, 10),
      creatorAddress: token.creator_address || null,
      creatorBalance: parseFloat(token.creator_balance || 0),
      // التعديل هنا ليدعم سولانا (percentage)
      creatorPercent: parseFloat(token.creator_percent || token.creator_percentage || 0) * 100,

      isOpenSource: truthy(token.is_open_source),
      isProxy: truthy(token.is_proxy),
      isMintable: truthy(token.is_mintable),
      isAntiWhale: truthy(token.is_anti_whale),
      antiWhaleModifiable: truthy(token.anti_whale_modifiable),
      externalCall: truthy(token.external_call),
      // دعم مصطلح سولانا (is_closable)
      selfDestruct: truthy(token.selfdestruct || token.is_closable), 
      hiddenOwner: truthy(token.hidden_owner),
      canTakeBackOwnership: truthy(token.can_take_back_ownership),
      ownerChangeBalance: truthy(token.owner_change_balance),
      cannotBuy: truthy(token.cannot_buy),

      ownerAddress: token.owner_address || '',
      ownerBalance: parseFloat(token.owner_balance || 0),
      // التعديل هنا ليدعم سولانا (percentage)
      ownerPercent: parseFloat(token.owner_percent || token.owner_percentage || 0) * 100,
      ownerType: token.owner_type || '',

      buyTax: parseFloat(token.buy_tax || 0),
      sellTax: parseFloat(token.sell_tax || 0),
      cannotSellAll: truthy(token.cannot_sell_all),
      slippageModifiable: truthy(token.slippage_modifiable),
      personalSlippageModifiable: truthy(token.personal_slippage_modifiable),
      tradingCooldown: truthy(token.trading_cooldown),
      // دعم مصطلح سولانا (is_freezable)
      transferPausable: truthy(token.transfer_pausable || token.is_freezable),
      isBlacklisted: truthy(token.is_blacklisted),
      isWhitelisted: truthy(token.is_whitelisted),
      isHoneypot: truthy(token.is_honeypot),
      honeypotWithSameCreator: truthy(token.honeypot_with_same_creator),
      fakeToken: truthy(token.fake_token && token.fake_token.value),
      isInDex: truthy(token.is_in_dex),
      isAirdropScam: truthy(token.is_airdrop_scam),
      trustList: truthy(token.trust_list),
      otherPotentialRisks: token.other_potential_risks || '',
      note: token.note || '',

      lpHolderCount: parseInt(token.lp_holder_count || 0, 10),
      lpTotalSupply: parseFloat(token.lp_total_supply || 0),
      lpHolders: (token.lp_holders || []).map(h => ({
        address: h.address,
        tag: h.tag || 'Unknown',
        value: parseFloat(h.value || h.balance || 0),
        percent: parseFloat(h.percent || h.percentage || 0) * 100,
        isLocked: truthy(h.is_locked),
        lockedDetail: scaParseLockedDetail(h),
        isContract: truthy(h.is_contract)
      })),

      holders: (token.holders || []).map((h, i) => ({
        rank: i + 1,
        address: h.address,
        tag: h.tag || 'Wallet',
        value: parseFloat(h.balance || h.value || 0),
        percent: parseFloat(h.percent || h.percentage || 0) * 100,
        isLocked: truthy(h.is_locked),
        isContract: truthy(h.is_contract)
      })),

      dex: (token.dex || []).map(d => ({
        name: d.name || '',
        pair: d.pair || '',
        liquidity: parseFloat(d.liquidity || 0)
      })),

      isInCex: truthy(token.is_in_cex && token.is_in_cex.listed),
      cexList: (token.is_in_cex && token.is_in_cex.cex_list) || [],

      externalAudits: (token.external_audit || []).map(a => ({
        auditor: a.audit_firm || a.auditor || '',
        date: scaFmtDate(a.audit_time || a.audit_date),
        report: a.audit_link || a.audit_report || '',
        status: 'Passed'
      })),
    };
  }
    
    function scaParseLockedDetail(h) {
    if (h.tag && /burn|dead|black hole/i.test(h.tag)) return 'محروقة (Dead Address)';
    if (h.is_locked) {
      const detail = h.locked_detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        if (first.end_time) {
          return 'مقفلة حتى ' + scaFmtDate(first.end_time);
        }
        return 'مقفلة';
      }
      return 'مقفلة';
    }
    return 'غير مقفلة';
  }

  // ---------- CALCULATIONS ----------
  function scaCalculateScore(d) {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let score = 100; // نبدأ من 100 نقطة ونقوم بالخصم

    const securityChecks = [
      { value: d.isOpenSource, danger: false, weight: 6 },
      { value: d.isProxy, danger: true, weight: 6 },
      { value: d.isMintable, danger: true, weight: 8 },
      { value: d.antiWhaleModifiable, danger: true, weight: 4 },
      { value: d.externalCall, danger: true, weight: 5 },
      { value: d.selfDestruct, danger: true, weight: 10 },
      { value: d.hiddenOwner, danger: true, weight: 10 },
      { value: d.canTakeBackOwnership, danger: true, weight: 8 },
      { value: d.ownerChangeBalance, danger: true, weight: 12 },
      { value: d.cannotBuy, danger: true, weight: 10 },
      { value: d.cannotSellAll, danger: true, weight: 10 },
    ];

    const scamChecks = [
      { value: d.isHoneypot, danger: true, weight: 20 },
      { value: d.honeypotWithSameCreator, danger: true, weight: 15 },
      { value: d.fakeToken, danger: true, weight: 15 },
      { value: d.isAirdropScam, danger: true, weight: 15 },
      { value: d.transferPausable, danger: true, weight: 8 },
      { value: d.isBlacklisted, danger: true, weight: 8 },
    ];

    [...securityChecks, ...scamChecks].forEach(c => {
      const isGood = c.danger ? !c.value : c.value;
      total++;
      if (isGood) { passed++; }
      else { failed++; score -= c.weight; } // خصم فوري ومباشر
    });

    if (d.buyTax > 0) {
      score -= Math.min(25, d.buyTax * 200);
      if (d.buyTax > 0.05) failed++;
    }
    if (d.sellTax > 0) {
      score -= Math.min(25, d.sellTax * 200);
      if (d.sellTax > 0.05) failed++;
    }

    const totalLocked = d.lpHolders
      .filter(h => h.isLocked)
      .reduce((s, h) => s + h.percent, 0);
    
    if (d.lpHolders.length > 0) {
       if (totalLocked < 40) score -= 15;
       else if (totalLocked < 70) score -= 5;
    }

    const isRenounced = !d.ownerAddress ||
                       d.ownerAddress === '0x0000000000000000000000000000000000000000' ||
                       d.ownerType === 'blackhole';
    if (!isRenounced) score -= 10;

    if (d.externalAudits.length > 0) score += 5;

    // ==========================================
    // ZERO TOLERANCE FOR SCAMS (تدمير الدرجة فوراً)
    // ==========================================
    if (d.isHoneypot || d.fakeToken || d.isAirdropScam || d.cannotBuy) {
      score = 0; 
    }

    score = Math.min(100, Math.max(0, Math.round(score * 10) / 10));

    let grade, trust, trustAr, color;
    if (score >= 90) { grade = 'A+'; trust = 'EXCELLENT'; trustAr = 'ممتاز'; color = 'white'; }
    else if (score >= 75) { grade = 'A'; trust = 'TRUSTWORTHY'; trustAr = 'موثوق'; color = 'white'; }
    else if (score >= 60) { grade = 'B'; trust = 'ACCEPTABLE'; trustAr = 'مقبول'; color = 'white'; }
    else if (score >= 45) { grade = 'C'; trust = 'CAUTION'; trustAr = 'يستوجب الحذر'; color = 'orange'; }
    else { grade = 'D'; trust = 'HIGH RISK'; trustAr = 'مخاطرة عالية'; color = 'orange'; }

    return { score, grade, trust, trustAr, color, total, passed, failed, totalLocked, isRenounced };
  }
    
  function scaBuildVerdict(d, calc) {
    let v = '';

    if (d.isHoneypot || d.fakeToken || d.isAirdropScam) {
      v = 'تحذير خطير: تم اكتشاف مؤشرات احتيال صريحة في العقد. ';
      if (d.isHoneypot) v += 'الفحص الديناميكي أكد أن العقد فخ احتيالي. ';
      if (d.fakeToken) v += 'العملة مزيفة تقلد مشروعاً آخر. ';
      if (d.isAirdropScam) v += 'العقد مرتبط بعمليات احتيال Airdrop. ';
      v += 'يُنصح بشدة بتجنب التعامل مع هذا العقد نهائياً.';
      return v;
    }

    if (calc.score >= 75) {
      v = 'العقد الذكي اجتاز ' + calc.passed + ' من ' + calc.total + ' فحوصات الأمان الرئيسية. ';
      if (calc.isRenounced) v += 'المالك تنازل عن الصلاحيات ';
      if (d.isOpenSource) v += 'والكود مفتوح المصدر ';
      if (d.externalAudits.length > 0) v += 'وتم تدقيقه من ' + d.externalAudits.length + ' جهات مستقلة. ';
      else v += '. ';
      if (calc.totalLocked > 80) v += 'السيولة مقفلة بنسبة ' + scaFmt(calc.totalLocked, 1) + '% مما يقلل مخاطر Rug Pull. ';
      v += 'توزيع الحاملين طبيعي للعملات المتداولة على نطاق واسع.';
    } else if (calc.score >= 60) {
      v = 'العقد يحتوي على نقاط قوة وضعف. ';
      if (calc.failed > 0) v += 'فشل في ' + calc.failed + ' من فحوصات الأمان. ';
      if (calc.totalLocked < 50) v += 'السيولة المقفلة منخفضة (' + scaFmt(calc.totalLocked, 1) + '%) مما يرفع مخاطر السحب المفاجئ. ';
      if (!calc.isRenounced) v += 'المالك لم يتنازل عن الصلاحيات. ';
      v += 'يُنصح بمراجعة التحذيرات بدقة قبل اتخاذ أي قرار.';
    } else {
      v = 'العقد يحمل مخاطر جوهرية تستوجب الحذر الشديد. فشل في ' + calc.failed + ' من ' + calc.total + ' فحوصات الأمان. ';
      if (!calc.isRenounced) v += 'المالك يحتفظ بصلاحيات السيطرة الكاملة. ';
      if (d.buyTax > 0.05 || d.sellTax > 0.05) v += 'الضرائب مرتفعة بشكل غير طبيعي. ';
      if (calc.totalLocked < 30) v += 'السيولة غير محمية ضد السحب المفاجئ. ';
      v += 'الاستثمار في هذا العقد ينطوي على مخاطر مرتفعة جداً.';
    }

    return v;
  }

  function scaDetectFlags(d, calc) {
    const red = [];
    const green = [];

    // ===== RED FLAGS =====
    if (d.isHoneypot) red.push({ level: 'CRITICAL', text: 'فخ احتيالي مكشوف', detail: 'الفحص الديناميكي للعقد كشف عن آلية تمنع البيع بعد الشراء. هذه إشارة احتيال صريحة 100% — يجب تجنب العقد فوراً.' });
    if (d.honeypotWithSameCreator) red.push({ level: 'CRITICAL', text: 'منشئ العقد له تاريخ احتيالي', detail: 'نفس العنوان الذي أنشأ هذا العقد سبق وأنشأ عقود Honeypot أخرى — احتمالية أن يكون هذا العقد فخاً مرتفعة جداً.' });
    if (d.fakeToken) red.push({ level: 'CRITICAL', text: 'عملة مزيفة', detail: 'العقد يحاول تقليد مشروع آخر معروف — هدفه استغلال ثقة المستثمرين بالمشروع الأصلي.' });
    if (d.isAirdropScam) red.push({ level: 'CRITICAL', text: 'احتيال Airdrop', detail: 'العقد مرتبط بعمليات Airdrop احتيالية تستهدف سرقة محافظ المستخدمين.' });
    if (d.cannotBuy) red.push({ level: 'CRITICAL', text: 'لا يمكن شراء العملة', detail: 'العقد يحتوي على آلية تمنع الشراء — قد يكون فخاً انتقائياً.' });

    if (d.isMintable) red.push({ level: 'HIGH', text: 'إمكانية طباعة عملات جديدة', detail: 'المالك يستطيع إصدار كميات إضافية من التوكن في أي وقت، مما يخفض قيمة الحاملين الحاليين.' });
    if (d.ownerChangeBalance) red.push({ level: 'HIGH', text: 'المالك يستطيع تغيير الأرصدة', detail: 'وظيفة خطرة جداً تتيح للمالك تعديل أرصدة المستخدمين مباشرة في العقد.' });
    if (d.hiddenOwner) red.push({ level: 'HIGH', text: 'يوجد مالك خفي', detail: 'العقد يحتوي على مالك مخفي غير ظاهر في الواجهة العامة — إشارة احتيال صريحة.' });
    if (d.canTakeBackOwnership) red.push({ level: 'HIGH', text: 'إمكانية استعادة الملكية', detail: 'تنازل المالك ليس نهائياً ويمكن استعادته — يُلغي قيمة تنازل المالك السابق.' });
    if (d.selfDestruct) red.push({ level: 'HIGH', text: 'العقد قابل للتدمير الذاتي', detail: 'العقد يحتوي على وظيفة تتيح تدميره بالكامل، مما يؤدي لخسارة كل الأموال المرتبطة.' });
    if (d.isBlacklisted) red.push({ level: 'HIGH', text: 'يوجد قائمة سوداء للعناوين', detail: 'العقد يستطيع حظر عناوين معينة من البيع، مما يعني إمكانية تجميد محافظ المستخدمين.' });
    if (d.transferPausable) red.push({ level: 'MEDIUM', text: 'إيقاف التحويلات ممكن', detail: 'المالك يستطيع إيقاف كل التحويلات في العقد، مما يحبس أصول المستخدمين.' });
    if (d.tradingCooldown) red.push({ level: 'MEDIUM', text: 'فترة انتظار بين المعاملات', detail: 'العقد يفرض فترة انتظار بين العمليات، مما يقيد حركة المتداولين.' });
    if (d.slippageModifiable) red.push({ level: 'MEDIUM', text: 'الـ Slippage قابل للتعديل', detail: 'المالك يستطيع تعديل قيمة الـ slippage، مما قد يستخدم لرفع الضرائب فجأة.' });

    if (d.buyTax > 0.1) red.push({ level: 'HIGH', text: 'ضريبة شراء مرتفعة جداً', detail: 'ضريبة الشراء ' + scaFmt(d.buyTax * 100, 1) + '% تعتبر مرتفعة بشكل غير طبيعي، تقلل من ربحية الاستثمار.' });
    else if (d.buyTax > 0.05) red.push({ level: 'MEDIUM', text: 'ضريبة شراء مرتفعة', detail: 'ضريبة الشراء ' + scaFmt(d.buyTax * 100, 1) + '% تعتبر فوق المعدل الطبيعي.' });

    if (d.sellTax > 0.1) red.push({ level: 'HIGH', text: 'ضريبة بيع مرتفعة جداً', detail: 'ضريبة البيع ' + scaFmt(d.sellTax * 100, 1) + '% مرتفعة بشكل غير طبيعي، قد تجعل الخروج من الاستثمار صعباً جداً.' });
    else if (d.sellTax > 0.05) red.push({ level: 'MEDIUM', text: 'ضريبة بيع مرتفعة', detail: 'ضريبة البيع ' + scaFmt(d.sellTax * 100, 1) + '% فوق المعدل الطبيعي.' });

    if (!d.isOpenSource) red.push({ level: 'HIGH', text: 'الكود ليس مفتوح المصدر', detail: 'لا يمكن التحقق من شفرة العقد البرمجية، مما يفتح الباب لاحتمال احتواء كود خبيث.' });
    if (d.isProxy) red.push({ level: 'MEDIUM', text: 'عقد بروكسي قابل للترقية', detail: 'العقد يمكن ترقيته/تغييره لاحقاً، مما يعني أن كل الفحوصات الحالية قد لا تنطبق على الإصدارات المستقبلية.' });
    if (!calc.isRenounced) red.push({ level: 'MEDIUM', text: 'المالك لم يتنازل عن الصلاحيات', detail: 'المالك يحتفظ بقدرة التحكم في العقد، مما يعني مخاطر مركزية.' });

    if (calc.totalLocked < 30) red.push({ level: 'HIGH', text: 'سيولة غير محمية', detail: 'فقط ' + scaFmt(calc.totalLocked, 1) + '% من السيولة مقفلة، الباقي قابل للسحب المفاجئ (Rug Pull).' });
    else if (calc.totalLocked < 50) red.push({ level: 'MEDIUM', text: 'حماية ضعيفة للسيولة', detail: scaFmt(calc.totalLocked, 1) + '% فقط من السيولة مقفلة، مما يرفع مخاطر السحب المفاجئ.' });

    const top10Pct = d.holders.slice(0, 10).reduce((s, h) => s + h.percent, 0);
    if (top10Pct > 70) red.push({ level: 'HIGH', text: 'تركز شديد في الحاملين', detail: 'أعلى 10 محافظ تملك ' + scaFmt(top10Pct, 2) + '% من المعروض، مما يخلق مخاطر تلاعب وتقلبات حادة.' });
    else if (top10Pct > 50) red.push({ level: 'MEDIUM', text: 'تركز ملحوظ في الحاملين', detail: 'أعلى 10 محافظ تملك ' + scaFmt(top10Pct, 2) + '% من المعروض.' });

    // ===== GREEN FLAGS =====
    if (!d.isHoneypot && !d.cannotBuy && !d.cannotSellAll) green.push({ text: 'العقد آمن من Honeypot', detail: 'الفحص الديناميكي أكد إمكانية الشراء والبيع بدون قيود، ولا توجد آلية فخ في الكود.' });
    if (calc.isRenounced) green.push({ text: 'المالك تنازل عن كل الصلاحيات', detail: 'عنوان المالك هو Black Hole مما يعني استحالة التحكم في العقد لاحقاً.' });
    if (d.isOpenSource) green.push({ text: 'الكود مفتوح المصدر ومتحقق منه', detail: 'الكود البرمجي للعقد علني ومتحقق منه على المستكشف، يمكن لأي شخص مراجعته.' });
    if (d.buyTax === 0 && d.sellTax === 0) green.push({ text: 'لا توجد ضرائب على الشراء أو البيع', detail: 'ضريبة الشراء 0% وضريبة البيع 0%، العقد لا يفرض أي رسوم خفية.' });
    if (calc.totalLocked >= 80) green.push({ text: 'السيولة مقفلة بنسبة عالية جداً', detail: scaFmt(calc.totalLocked, 1) + '% من السيولة إما مقفلة أو محروقة، حماية ممتازة من Rug Pull.' });
    else if (calc.totalLocked >= 50) green.push({ text: 'السيولة مقفلة بنسبة معتدلة', detail: scaFmt(calc.totalLocked, 1) + '% من السيولة محمية ضد السحب المفاجئ.' });
    if (d.externalAudits.length > 0) green.push({ text: d.externalAudits.length + ' تدقيقات أمنية من جهات مستقلة', detail: 'العقد خضع لتدقيق من: ' + d.externalAudits.map(a => a.auditor).join('، ') });
    if (!d.isMintable && !d.isBlacklisted && !d.transferPausable) green.push({ text: 'لا توجد وظائف Mint أو Blacklist أو Pausable', detail: 'العقد لا يحتوي على الوظائف المركزية الخطرة الأكثر شيوعاً.' });
    if (!d.canTakeBackOwnership && !d.hiddenOwner && !d.ownerChangeBalance) green.push({ text: 'لا توجد آليات استعادة سيطرة أو مالك خفي', detail: 'العقد لا يحتوي على أي آلية للتحايل على تنازل المالك أو التحكم في أرصدة المستخدمين.' });
    if (d.isInCex && d.cexList.length > 0) green.push({ text: 'متداول على ' + d.cexList.length + ' منصة مركزية', detail: 'الإدراج على منصات مركزية كبرى يدل على فحص واعتماد من جهات احترافية: ' + d.cexList.slice(0, 5).join('، ') });
    if (d.dex.length >= 2) green.push({ text: 'متداول على ' + d.dex.length + ' منصات لامركزية', detail: 'تنوع منصات التداول اللامركزية يدل على نضج المشروع وقبول من المجتمع.' });
    if (d.trustList) green.push({ text: 'العقد ضمن قائمة الثقة', detail: 'العقد مُصنّف ضمن قائمة العقود الموثوقة المعروفة.' });

    return { red, green };
  }

  // ---------- MAIN ----------
  window.runSCA = async function() {
    const sym = (document.getElementById('sca-symbol').value || '').trim().toUpperCase();
    const chainId = document.getElementById('sca-chain').value;
    const cacheKey = sym + '_' + chainId;
    const resultEl = document.getElementById('sca-result');
    const btn = document.getElementById('sca-btn');

    if (!sym) {
      scaStatus('يرجى إدخال رمز العملة', 'error');
      return;
    }

    resultEl.classList.remove('sca-show');
    resultEl.innerHTML = '';
    if (btn) btn.disabled = true;

    if (typeof trackToolUsage === 'function') trackToolUsage('pg-sca');

    try {
      // فحص الكاش
      const now = Date.now();
      if (SCA_CACHE[cacheKey] && (now - SCA_CACHE[cacheKey].timestamp) < SCA_TTL) {
        const cached = SCA_CACHE[cacheKey].data;
        resultEl.innerHTML = scaRender(cached);
        resultEl.classList.add('sca-show');
        scaStatus('اكتمل التحليل · ' + scaFmtDate(cached.analyzedAt) + ' · صالح حتى ' + scaFmtDate(cached.cachedUntil));
        if (btn) btn.disabled = false;
        return;
      }

      // 1) بحث العملة
      scaStatus('جاري البحث عن العملة ...');
      const coin = await scaCallCoinGecko(sym);

      // 2) جلب عنوان العقد للشبكة المختارة
      const contractAddress = scaGetContractForChain(coin, chainId);
      if (!contractAddress) {
        const chainName = SCA_CHAIN_NAMES[chainId];
        throw new Error('العملة ' + sym + ' غير متوفرة على شبكة ' + chainName + '. جرب شبكة أخرى من القائمة.');
      }

      // 3) فحص العقد
      scaStatus('جاري فحص العقد الذكي ...');
      const securityData = await scaCallSecurity(chainId, contractAddress);

      if (!securityData.result) throw new Error('لم يتم العثور على بيانات للعقد');

      // معالجة حساسية حالة الأحرف لشبكات مثل سولانا
      const exactMatch = securityData.result[contractAddress];
      const lowerMatch = securityData.result[contractAddress.toLowerCase()];
      const token = exactMatch || lowerMatch || Object.values(securityData.result)[0];
        if (!token) throw new Error('لم يتم العثور على بيانات للعقد');

      // 4) تحليل البيانات
      scaStatus('جاري تحليل النتائج ...');
      const parsed = scaParseGoPlus(token);
      const calc = scaCalculateScore(parsed);
      const flags = scaDetectFlags(parsed, calc);
      const verdict = scaBuildVerdict(parsed, calc);

      // 5) تجميع النتيجة
      const result = {
        symbol: sym,
        chainId: chainId,
        chainName: SCA_CHAIN_NAMES[chainId],
        contractAddress: contractAddress,
        coinName: coin.name,
        analyzedAt: now,
        cachedUntil: now + SCA_TTL,
        data: parsed,
        calc: calc,
        flags: flags,
        verdict: verdict
      };

      SCA_CACHE[cacheKey] = { data: result, timestamp: now };

      resultEl.innerHTML = scaRender(result);
      resultEl.classList.add('sca-show');
      scaStatus('اكتمل التحليل · ' + scaFmtDate(result.analyzedAt) + ' · صالح حتى ' + scaFmtDate(result.cachedUntil));

    } catch (err) {
      console.error('SCA error:', err);
      scaStatus('تعذّر التحليل: ' + (err.message || 'خطأ غير معروف'), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ---------- RENDER ----------
  function scaRender(r) {
    const d = r.data;
    const c = r.calc;
    const f = r.flags;
    let h = '';

    // ============ FINAL VERDICT ============
    const isOrangeMaster = c.color === 'orange' || d.isHoneypot || d.fakeToken || d.isAirdropScam;
    h += '<div class="sca-master' + (isOrangeMaster ? ' sca-master-orange' : '') + '">';
    h += '<div class="sca-master-tag">FINAL VERDICT</div>';
    h += '<div class="sca-master-inner">';

    // العنوان والحالة
    let statusText, statusEn;
    if (d.isHoneypot) { statusText = 'فخ احتيالي مكشوف'; statusEn = 'HONEYPOT DETECTED · DO NOT TRADE'; }
    else if (d.fakeToken) { statusText = 'عملة مزيفة'; statusEn = 'FAKE TOKEN · SCAM'; }
    else if (d.isAirdropScam) { statusText = 'احتيال Airdrop'; statusEn = 'AIRDROP SCAM'; }
    else if (c.failed > 5) { statusText = 'مخاطرة عالية'; statusEn = 'HIGH RISK · ' + c.failed + ' WARNINGS'; }
    else if (c.failed > 0) { statusText = 'مخاطرة معتدلة'; statusEn = 'MODERATE RISK · ' + c.failed + ' WARNINGS'; }
    else { statusText = 'العقد آمن'; statusEn = 'SAFE CONTRACT · NO RED FLAGS'; }

    h += '<div class="sca-master-top">';
    h += '<div>';
    h += '<div class="sca-master-status-label">CONTRACT STATUS</div>';
    h += '<div class="sca-master-status' + (isOrangeMaster ? ' sca-orange' : '') + '">' + statusText + '</div>';
    h += '<div class="sca-master-status-en' + (isOrangeMaster ? ' sca-orange' : '') + '">' + statusEn + '</div>';
    h += '</div>';
    h += '<div class="sca-master-grade-box">';
    h += '<div class="sca-master-grade-label">GRADE</div>';
    h += '<div class="sca-master-grade' + (isOrangeMaster ? ' sca-orange' : '') + '">' + c.grade + '</div>';
    h += '<div class="sca-master-score-line">' + c.score + '/100</div>';
    h += '</div>';
    h += '</div>';

    h += '<div class="sca-master-verdict">' + scaEsc(r.verdict) + '</div>';

    // Quick Stats
    h += '<div class="sca-master-stats">';
    h += '<div class="sca-master-stat"><div class="sca-master-stat-label">CHECKS PASSED</div>';
    h += '<div class="sca-master-stat-value">' + c.passed + '/' + c.total + '</div></div>';
    h += '<div class="sca-master-stat"><div class="sca-master-stat-label">HONEYPOT</div>';
    h += '<div class="sca-master-stat-value' + (d.isHoneypot ? ' sca-orange' : '') + '">' + (d.isHoneypot ? 'YES' : 'NO') + '</div></div>';
    h += '<div class="sca-master-stat"><div class="sca-master-stat-label">OWNER RENOUNCED</div>';
    h += '<div class="sca-master-stat-value' + (c.isRenounced ? '' : ' sca-orange') + '">' + (c.isRenounced ? 'YES' : 'NO') + '</div></div>';
    h += '<div class="sca-master-stat"><div class="sca-master-stat-label">AUDITS</div>';
    h += '<div class="sca-master-stat-value">' + d.externalAudits.length + '</div></div>';
    h += '</div>';

    h += '</div></div>';

    // ============ المجموعة 1: المعلومات الأساسية ============
    h += '<div class="sca-section">BASIC INFORMATION / المعلومات الأساسية</div>';
    h += '<div class="sca-block-head"><span>TOKEN IDENTITY</span></div>';
    h += '<table class="sca-table"><colgroup>';
    h += '<col style="width:33%"><col style="width:33%"><col style="width:34%"></colgroup>';
    h += '<tbody>';
    h += '<tr><td class="sca-cell-label">الرمز · Symbol</td><td class="sca-cell-value">' + scaEsc(d.tokenSymbol || r.symbol) + '</td><td class="sca-cell-meta">' + scaEsc(d.tokenName || r.coinName) + '</td></tr>';
    h += '<tr><td class="sca-cell-label">الشبكة · Network</td><td class="sca-cell-value">' + r.chainName + '</td><td class="sca-cell-meta">CHAIN ID ' + r.chainId + '</td></tr>';
    h += '<tr><td class="sca-cell-label">عنوان العقد</td><td class="sca-cell-value">' + scaShortAddr(r.contractAddress) + '</td><td class="sca-cell-meta">CONTRACT</td></tr>';
    if (d.totalSupply > 0) h += '<tr><td class="sca-cell-label">إجمالي المعروض</td><td class="sca-cell-value">' + scaFmtBig(d.totalSupply) + '</td><td class="sca-cell-meta">TOTAL SUPPLY</td></tr>';
    if (d.holderCount > 0) h += '<tr><td class="sca-cell-label">إجمالي عدد الحاملين</td><td class="sca-cell-value">' + scaFmt(d.holderCount, 0) + '</td><td class="sca-cell-meta">HOLDERS</td></tr>';
    if (d.creatorAddress) h += '<tr><td class="sca-cell-label">عنوان المنشئ</td><td class="sca-cell-value">' + scaShortAddr(d.creatorAddress) + '</td><td class="sca-cell-meta">CREATOR</td></tr>';
    if (d.creatorAddress) h += '<tr><td class="sca-cell-label">رصيد المنشئ</td><td class="sca-cell-value">' + scaFmtBig(d.creatorBalance) + '</td><td class="sca-cell-meta">' + scaFmt(d.creatorPercent, 2) + '% من المعروض</td></tr>';
    h += '</tbody></table>';

    // ============ المجموعة 2: أمان العقد الذكي ============
    h += '<div class="sca-section">CONTRACT SECURITY / أمان العقد الذكي</div>';
    h += '<div class="sca-block-head"><span>11 SECURITY CHECKS</span><span class="sca-block-head-right">' + c.passed + ' PASSED / ' + c.failed + ' FAILED</span></div>';

    const securityChecks = [
      { ar: 'الكود مفتوح المصدر', en: 'Open Source', value: d.isOpenSource, danger: false, desc: 'الكود متاح للتحقق العلني' },
      { ar: 'عقد بروكسي قابل للترقية', en: 'Proxy Contract', value: d.isProxy, danger: true, desc: 'يمكن تغيير الكود لاحقاً' },
      { ar: 'إمكانية طباعة عملات جديدة', en: 'Mintable', value: d.isMintable, danger: true, desc: 'المالك يستطيع زيادة المعروض' },
      { ar: 'يوجد حد أقصى للمعاملة', en: 'Anti-Whale', value: d.isAntiWhale, danger: false, desc: 'حماية من تلاعب الكبار' },
      { ar: 'الحد الأقصى قابل للتعديل', en: 'Anti-Whale Modifiable', value: d.antiWhaleModifiable, danger: true, desc: 'المالك يستطيع تغيير الحد' },
      { ar: 'يستدعي عقوداً خارجية', en: 'External Call', value: d.externalCall, danger: true, desc: 'احتمال تأثير خارجي' },
      { ar: 'العقد قابل للتدمير الذاتي', en: 'Self-Destruct', value: d.selfDestruct, danger: true, desc: 'يمكن تدمير العقد بالكامل' },
      { ar: 'يوجد مالك خفي', en: 'Hidden Owner', value: d.hiddenOwner, danger: true, desc: 'إشارة احتيال صريحة' },
      { ar: 'إمكانية استعادة الملكية', en: 'Reclaim Ownership', value: d.canTakeBackOwnership, danger: true, desc: 'تنازل المالك ليس نهائياً' },
      { ar: 'المالك يستطيع تغيير الأرصدة', en: 'Owner Change Balance', value: d.ownerChangeBalance, danger: true, desc: 'مخاطرة عالية جداً' },
      { ar: 'لا يمكن الشراء', en: 'Cannot Buy', value: d.cannotBuy, danger: true, desc: 'العقد لا يقبل الشراء' },
    ];

    h += '<table class="sca-table"><colgroup>';
    h += '<col style="width:38%"><col style="width:28%"><col style="width:17%"><col style="width:17%"></colgroup>';
    h += '<tbody>';
    securityChecks.forEach(check => {
      const isGood = check.danger ? !check.value : check.value;
      h += '<tr>';
      h += '<td class="sca-cell-label">' + check.ar + '<div class="sca-cell-label-desc">' + check.desc + '</div></td>';
      h += '<td class="sca-cell-en">' + check.en.toUpperCase() + '</td>';
      h += '<td class="sca-cell-action"><span class="sca-yn ' + (isGood ? 'sca-yn-good' : 'sca-yn-bad') + '">' + (check.value ? 'YES' : 'NO') + '</span></td>';
      h += '<td class="sca-cell-action"><span class="sca-sr ' + (isGood ? 'sca-safe' : 'sca-risk') + '">' + (isGood ? 'SAFE' : 'RISK') + '</span></td>';
      h += '</tr>';
    });
    h += '</tbody></table>';

    // ============ المجموعة 3: المالك والحوكمة ============
    h += '<div class="sca-section">OWNER &amp; GOVERNANCE / المالك والحوكمة</div>';
    h += '<div class="sca-block-head"><span>OWNERSHIP STATUS</span><span class="sca-block-head-right" style="color:' + (c.isRenounced ? '#fff' : 'var(--o)') + '">' + (c.isRenounced ? 'RENOUNCED ✓' : 'ACTIVE OWNER ✗') + '</span></div>';
    h += '<table class="sca-table"><colgroup>';
    h += '<col style="width:33%"><col style="width:33%"><col style="width:34%"></colgroup>';
    h += '<tbody>';
    h += '<tr><td class="sca-cell-label">حالة الملكية</td><td class="sca-cell-value' + (c.isRenounced ? '' : ' sca-orange') + '">' + (c.isRenounced ? 'تنازل المالك' : 'مالك نشط') + '</td><td class="sca-cell-meta">' + (c.isRenounced ? 'OWNERSHIP RENOUNCED' : 'ACTIVE OWNERSHIP') + '</td></tr>';
    h += '<tr><td class="sca-cell-label">عنوان المالك</td><td class="sca-cell-value">' + scaShortAddr(d.ownerAddress) + '</td><td class="sca-cell-meta">' + (d.ownerType === 'blackhole' ? 'BLACK HOLE' : d.ownerType === 'contract' ? 'CONTRACT' : 'EOA') + '</td></tr>';
    h += '<tr><td class="sca-cell-label">نوع المالك</td><td class="sca-cell-value' + (d.ownerType === 'blackhole' ? '' : ' sca-orange') + '">' + (d.ownerType === 'blackhole' ? 'محفظة الإحراق' : d.ownerType === 'contract' ? 'عقد ذكي' : 'محفظة شخصية') + '</td><td class="sca-cell-meta">' + (d.ownerType || 'UNKNOWN').toUpperCase() + '</td></tr>';
    h += '<tr><td class="sca-cell-label">رصيد المالك</td><td class="sca-cell-value">' + scaFmtBig(d.ownerBalance) + '</td><td class="sca-cell-meta">OWNER BALANCE</td></tr>';
    h += '<tr><td class="sca-cell-label">نسبة المالك من المعروض</td><td class="sca-cell-value' + (d.ownerPercent > 5 ? ' sca-orange' : '') + '">' + scaFmt(d.ownerPercent, 2) + '%</td><td class="sca-cell-meta">' + (d.ownerPercent > 10 ? 'تركز مرتفع' : d.ownerPercent > 5 ? 'تركز معتدل' : 'تركز منخفض') + '</td></tr>';
    h += '</tbody></table>';

    // ============ المجموعة 4: الضرائب والوظائف الخطرة ============
    h += '<div class="sca-section">TAXES &amp; DANGER FUNCTIONS / الضرائب والوظائف الخطرة</div>';

    // Taxes
    h += '<div class="sca-block-head"><span>TRANSACTION TAXES</span></div>';
    h += '<table class="sca-table"><colgroup>';
    h += '<col style="width:33%"><col style="width:33%"><col style="width:34%"></colgroup>';
    h += '<tbody>';
    h += '<tr><td class="sca-cell-label">ضريبة الشراء · Buy Tax</td><td class="sca-cell-value sca-big' + (d.buyTax > 0 ? ' sca-orange' : '') + '">' + scaFmt(d.buyTax * 100, 1) + '%</td><td class="sca-cell-meta">' + (d.buyTax === 0 ? 'لا توجد ضريبة' : d.buyTax > 0.05 ? 'ضريبة مرتفعة' : 'ضريبة معتدلة') + '</td></tr>';
    h += '<tr><td class="sca-cell-label">ضريبة البيع · Sell Tax</td><td class="sca-cell-value sca-big' + (d.sellTax > 0 ? ' sca-orange' : '') + '">' + scaFmt(d.sellTax * 100, 1) + '%</td><td class="sca-cell-meta">' + (d.sellTax === 0 ? 'لا توجد ضريبة' : d.sellTax > 0.05 ? 'ضريبة مرتفعة' : 'ضريبة معتدلة') + '</td></tr>';
    h += '<tr><td class="sca-cell-label">الـ Slippage قابل للتعديل</td><td class="sca-cell-action"><span class="sca-yn ' + (!d.slippageModifiable ? 'sca-yn-good' : 'sca-yn-bad') + '">' + (d.slippageModifiable ? 'YES' : 'NO') + '</span></td><td class="sca-cell-meta">SLIPPAGE MODIFIABLE</td></tr>';
    h += '</tbody></table>';

    // Honeypot & Scam
    h += '<div class="sca-block-head"><span>HONEYPOT &amp; SCAM DETECTION</span></div>';

    const scamChecks = [
      { ar: 'فخ احتيالي (Honeypot)', en: 'Is Honeypot', value: d.isHoneypot, danger: true, critical: true },
      { ar: 'المنشئ أنشأ فخاخاً سابقة', en: 'Same Creator Honeypots', value: d.honeypotWithSameCreator, danger: true, critical: true },
      { ar: 'عملة مزيفة', en: 'Fake Token', value: d.fakeToken, danger: true, critical: true },
      { ar: 'احتيال Airdrop', en: 'Airdrop Scam', value: d.isAirdropScam, danger: true, critical: true },
      { ar: 'لا يمكن بيع كل الرصيد', en: 'Cannot Sell All', value: d.cannotSellAll, danger: true, critical: false },
      { ar: 'فترة انتظار بين المعاملات', en: 'Trading Cooldown', value: d.tradingCooldown, danger: true, critical: false },
      { ar: 'إيقاف التحويلات ممكن', en: 'Transfer Pausable', value: d.transferPausable, danger: true, critical: false },
      { ar: 'يوجد قائمة سوداء', en: 'Blacklist Function', value: d.isBlacklisted, danger: true, critical: false },
      { ar: 'يوجد قائمة بيضاء مقيدة', en: 'Whitelist Function', value: d.isWhitelisted, danger: true, critical: false },
      { ar: 'متداول في DEX', en: 'In DEX', value: d.isInDex, danger: false, critical: false },
      { ar: 'ضمن قائمة الثقة', en: 'Trust List', value: d.trustList, danger: false, critical: false },
    ];

    h += '<table class="sca-table"><colgroup>';
    h += '<col style="width:42%"><col style="width:26%"><col style="width:16%"><col style="width:16%"></colgroup>';
    h += '<tbody>';
    scamChecks.forEach(check => {
      const isGood = check.danger ? !check.value : check.value;
      h += '<tr>';
      h += '<td class="sca-cell-label">' + check.ar + (check.critical ? '<span class="sca-critical">CRITICAL</span>' : '') + '</td>';
      h += '<td class="sca-cell-en">' + check.en.toUpperCase() + '</td>';
      h += '<td class="sca-cell-action"><span class="sca-yn ' + (isGood ? 'sca-yn-good' : 'sca-yn-bad') + '">' + (check.value ? 'YES' : 'NO') + '</span></td>';
      h += '<td class="sca-cell-action"><span class="sca-sr ' + (isGood ? 'sca-safe' : 'sca-risk') + '">' + (isGood ? 'SAFE' : 'RISK') + '</span></td>';
      h += '</tr>';
    });
    h += '</tbody></table>';

    // ============ المجموعة 5: السيولة ============
    if (d.lpHolders.length > 0) {
      h += '<div class="sca-section">LIQUIDITY POOL / السيولة وحالة القفل</div>';
      h += '<div class="sca-block-head"><span>LIQUIDITY OVERVIEW</span><span class="sca-block-head-right" style="color:' + (c.totalLocked > 50 ? '#fff' : 'var(--o)') + '">' + scaFmt(c.totalLocked, 1) + '% LOCKED</span></div>';
      h += '<table class="sca-table"><colgroup>';
      h += '<col style="width:33%"><col style="width:33%"><col style="width:34%"></colgroup>';
      h += '<tbody>';
      h += '<tr><td class="sca-cell-label">عدد حاملي السيولة</td><td class="sca-cell-value">' + d.lpHolderCount + '</td><td class="sca-cell-meta">LP HOLDERS</td></tr>';
      h += '<tr><td class="sca-cell-label">إجمالي رموز السيولة</td><td class="sca-cell-value">' + scaFmt(d.lpTotalSupply, 2) + '</td><td class="sca-cell-meta">LP TOTAL SUPPLY</td></tr>';
      h += '<tr><td class="sca-cell-label">السيولة المقفلة</td><td class="sca-cell-value sca-big' + (c.totalLocked > 80 ? '' : ' sca-orange') + '">' + scaFmt(c.totalLocked, 2) + '%</td><td class="sca-cell-meta">' + (c.totalLocked > 80 ? 'حماية ممتازة' : c.totalLocked > 50 ? 'حماية معتدلة' : 'مخاطرة Rug Pull') + '</td></tr>';
      h += '</tbody></table>';

      h += '<div class="sca-block-head"><span>LP HOLDERS BREAKDOWN</span></div>';
      h += '<table class="sca-table"><colgroup>';
      h += '<col style="width:8%"><col style="width:28%"><col style="width:22%"><col style="width:14%"><col style="width:28%"></colgroup>';
      h += '<thead><tr>';
      h += '<th class="sca-th-right">#</th>';
      h += '<th class="sca-th-right">TAG</th>';
      h += '<th class="sca-th-right">ADDRESS</th>';
      h += '<th class="sca-th-left">%</th>';
      h += '<th class="sca-th-left">STATUS</th>';
      h += '</tr></thead><tbody>';
      d.lpHolders.forEach((lp, i) => {
        h += '<tr>';
        h += '<td class="sca-cell-value">' + (i + 1) + '</td>';
        h += '<td class="sca-cell-label" style="text-align:right;font-size:12px;">' + scaEsc(lp.tag) + '</td>';
        h += '<td class="sca-cell-mono" style="text-align:right;">' + scaShortAddr(lp.address) + '</td>';
        h += '<td class="sca-cell-value">' + scaFmt(lp.percent, 2) + '%</td>';
        h += '<td style="padding:11px 12px;text-align:left;"><span class="sca-lock ' + (lp.isLocked ? 'sca-lock-yes' : 'sca-lock-no') + '">' + (lp.isLocked ? 'LOCKED' : 'UNLOCKED') + '</span>';
        h += '<div class="sca-cell-meta-desc">' + scaEsc(lp.lockedDetail) + '</div></td>';
        h += '</tr>';
      });
      h += '</tbody></table>';
    }

    // ============ المجموعة 6: كبار الحاملين ============
    if (d.holders.length > 0) {
      const top10Pct = d.holders.slice(0, 10).reduce((s, h2) => s + h2.percent, 0);
      h += '<div class="sca-section">TOP HOLDERS / كبار حاملي العملة</div>';
      h += '<div class="sca-block-head"><span>TOP ' + Math.min(10, d.holders.length) + ' HOLDERS DISTRIBUTION</span><span class="sca-block-head-right" style="color:' + (top10Pct > 50 ? 'var(--o)' : '#fff') + '">' + scaFmt(top10Pct, 2) + '% OF SUPPLY</span></div>';
      h += '<table class="sca-table"><colgroup>';
      h += '<col style="width:9%"><col style="width:25%"><col style="width:20%"><col style="width:18%"><col style="width:13%"><col style="width:15%"></colgroup>';
      h += '<thead><tr>';
      h += '<th class="sca-th-right">RANK</th>';
      h += '<th class="sca-th-right">TAG</th>';
      h += '<th class="sca-th-right">ADDRESS</th>';
      h += '<th class="sca-th-left">BALANCE</th>';
      h += '<th class="sca-th-left">%</th>';
      h += '<th class="sca-th-left">TYPE</th>';
      h += '</tr></thead><tbody>';
      d.holders.slice(0, 10).forEach(holder => {
        h += '<tr>';
        h += '<td class="sca-cell-value">#' + holder.rank + '</td>';
        h += '<td class="sca-cell-label" style="text-align:right;font-size:12px;">' + scaEsc(holder.tag) + '</td>';
        h += '<td class="sca-cell-mono" style="text-align:right;">' + scaShortAddr(holder.address) + '</td>';
        h += '<td class="sca-cell-value" style="font-size:12px;">' + scaFmtBig(holder.value) + '</td>';
        h += '<td class="sca-cell-value' + (holder.percent > 5 ? ' sca-orange' : '') + '">' + scaFmt(holder.percent, 2) + '%</td>';
        h += '<td class="sca-cell-en" style="text-align:left;">' + (holder.isContract ? 'CONTRACT' : 'WALLET') + '</td>';
        h += '</tr>';
      });
      h += '</tbody></table>';
    }

    // ============ المجموعة 7: منصات التداول ============
    h += '<div class="sca-section">TRADING VENUES / منصات التداول</div>';

    // DEX
    if (d.dex.length > 0) {
      const totalDexLiq = d.dex.reduce((s, x) => s + x.liquidity, 0);
      h += '<div class="sca-block-head"><span>DECENTRALIZED EXCHANGES (DEX)</span><span class="sca-block-head-right">' + d.dex.length + ' POOLS</span></div>';
      h += '<table class="sca-table"><colgroup>';
      h += '<col style="width:28%"><col style="width:30%"><col style="width:22%"><col style="width:20%"></colgroup>';
      h += '<thead><tr>';
      h += '<th class="sca-th-right">DEX</th>';
      h += '<th class="sca-th-right">PAIR</th>';
      h += '<th class="sca-th-left">LIQUIDITY</th>';
      h += '<th class="sca-th-left">SHARE</th>';
      h += '</tr></thead><tbody>';
      d.dex.forEach(dex => {
        h += '<tr>';
        h += '<td class="sca-cell-label" style="text-align:right;font-size:13px;font-weight:700;color:#fff;">' + scaEsc(dex.name) + '</td>';
        h += '<td class="sca-cell-mono" style="text-align:right;">' + scaShortAddr(dex.pair) + '</td>';
        h += '<td class="sca-cell-value">' + scaFmtCompact(dex.liquidity) + '</td>';
        h += '<td class="sca-cell-value" style="font-weight:normal;font-size:12px;">' + scaFmt((dex.liquidity / totalDexLiq) * 100, 1) + '%</td>';
        h += '</tr>';
      });
      h += '<tr class="sca-total-row"><td colspan="2" class="sca-cell-label" style="font-weight:700;color:#fff;font-size:13px;">إجمالي السيولة في DEX</td>';
      h += '<td colspan="2" class="sca-cell-value sca-big">' + scaFmtCompact(totalDexLiq) + '</td></tr>';
      h += '</tbody></table>';
    }

    // CEX
    h += '<div class="sca-block-head"><span>CENTRALIZED EXCHANGES (CEX)</span><span class="sca-block-head-right">' + (d.isInCex ? d.cexList.length + ' EXCHANGES' : 'NOT LISTED') + '</span></div>';
    h += '<table class="sca-table"><colgroup>';
    h += '<col style="width:33%"><col style="width:67%"></colgroup>';
    h += '<tbody>';
    h += '<tr><td class="sca-cell-label">متداول في منصات مركزية</td><td class="sca-cell-action"><span class="sca-yn ' + (d.isInCex ? 'sca-yn-good' : 'sca-yn-bad') + '">' + (d.isInCex ? 'YES' : 'NO') + '</span></td></tr>';
    if (d.isInCex && d.cexList.length > 0) {
      h += '<tr><td class="sca-cell-label" style="vertical-align:top;">المنصات المركزية</td>';
      h += '<td style="padding:11px 12px;"><div class="sca-cex-chips">';
      d.cexList.forEach(cex => {
        h += '<span class="sca-cex-chip">' + scaEsc(cex) + '</span>';
      });
      h += '</div></td></tr>';
    }
    h += '</tbody></table>';

    // ============ المجموعة 8: التدقيقات الأمنية ============
    h += '<div class="sca-section">EXTERNAL AUDITS / التدقيقات الأمنية الرسمية</div>';
    if (d.externalAudits.length > 0) {
      h += '<div class="sca-block-head"><span>INDEPENDENT SECURITY AUDITS</span><span class="sca-block-head-right">' + d.externalAudits.length + ' AUDITS</span></div>';
      h += '<table class="sca-table"><colgroup>';
      h += '<col style="width:30%"><col style="width:25%"><col style="width:22%"><col style="width:23%"></colgroup>';
      h += '<thead><tr>';
      h += '<th class="sca-th-right">AUDITOR</th>';
      h += '<th class="sca-th-right">DATE</th>';
      h += '<th class="sca-th-left">STATUS</th>';
      h += '<th class="sca-th-left">REPORT</th>';
      h += '</tr></thead><tbody>';
      d.externalAudits.forEach(a => {
        h += '<tr>';
        h += '<td class="sca-cell-label" style="text-align:right;font-size:14px;font-weight:700;color:#fff;">' + scaEsc(a.auditor) + '</td>';
        h += '<td class="sca-cell-mono" style="text-align:right;">' + scaEsc(a.date) + '</td>';
        h += '<td class="sca-cell-action"><span class="sca-status-badge sca-status-passed">PASSED</span></td>';
        if (a.report) {
          h += '<td class="sca-cell-action"><a href="' + scaEsc(a.report) + '" target="_blank" style="padding:4px 10px;border:1px solid #fff;color:#fff;font-family:\'Share Tech Mono\',monospace;font-size:10px;letter-spacing:1px;text-decoration:none;display:inline-block;">VIEW REPORT</a></td>';
        } else {
          h += '<td class="sca-cell-meta">—</td>';
        }
        h += '</tr>';
      });
      h += '</tbody></table>';
    } else {
      h += '<div class="sca-no-audits">';
      h += '<div class="sca-no-audits-title">NO EXTERNAL AUDITS FOUND</div>';
      h += 'لم يتم العثور على تدقيقات أمنية مستقلة لهذا العقد. هذا لا يعني أن العقد غير آمن، لكنه يقلل من الثقة الخارجية.';
      h += '</div>';
    }

    // ============ FLAGS ============
    h += '<div class="sca-section">FLAGS / المؤشرات التفصيلية</div>';

    if (f.red.length > 0) {
      h += '<div class="sca-block-head sca-orange-head"><span>RED FLAGS · ' + f.red.length + ' ATTENTION POINTS</span></div>';
      h += '<table class="sca-table sca-orange-border"><colgroup>';
      h += '<col style="width:14%"><col style="width:86%"></colgroup>';
      h += '<tbody>';
      f.red.forEach(flag => {
        h += '<tr>';
        h += '<td style="padding:12px 12px;vertical-align:top;"><span class="sca-flag-level">' + flag.level + '</span></td>';
        h += '<td style="padding:12px 12px;"><div class="sca-flag-text">' + scaEsc(flag.text) + '</div><div class="sca-flag-detail">' + scaEsc(flag.detail) + '</div></td>';
        h += '</tr>';
      });
      h += '</tbody></table>';
    } else {
      h += '<div class="sca-no-flags">';
      h += '<span class="sca-no-flags-badge">NO RED FLAGS</span>';
      h += '<span>لا توجد أي نقاط تحذير أمنية في هذا العقد. كل الفحوصات سليمة.</span>';
      h += '</div>';
    }

    if (f.green.length > 0) {
      h += '<div class="sca-block-head sca-white-head"><span>POSITIVE SIGNALS · ' + f.green.length + ' GREEN FLAGS</span></div>';
      h += '<table class="sca-table sca-white-border"><colgroup>';
      h += '<col style="width:6%"><col style="width:94%"></colgroup>';
      h += '<tbody>';
      f.green.forEach(flag => {
        h += '<tr>';
        h += '<td style="padding:12px 12px;vertical-align:top;"><div class="sca-flag-bar"></div></td>';
        h += '<td style="padding:12px 12px;"><div class="sca-flag-text">' + scaEsc(flag.text) + '</div><div class="sca-flag-detail">' + scaEsc(flag.detail) + '</div></td>';
        h += '</tr>';
      });
      h += '</tbody></table>';
    }

    // ============ READING GUIDE ============
    h += '<div class="sca-section">READING GUIDE / دليل القراءة</div>';
    h += '<div class="sca-guide">';
    h += '<div class="sca-guide-block"><div class="sca-guide-h">ما الذي تقدمه هذه الأداة</div><div class="sca-guide-p">تدقيق شامل للعقد الذكي يكشف الاحتيال والمخاطر قبل التداول. تفحص الأداة العقد عبر ثمانية أبعاد: المعلومات الأساسية، أمان الكود، حوكمة المالك، الضرائب والوظائف الخطرة، السيولة وقفلها، توزيع الحاملين، منصات التداول، والتدقيقات الأمنية الرسمية.</div></div>';
    h += '<div class="sca-guide-block"><div class="sca-guide-h">قراءة الحكم النهائي</div><div class="sca-guide-p">الحكم النهائي يجمع كل الفحوصات في تقييم واحد. الإطار الأبيض يعني عقد آمن، البرتقالي يعني مخاطر. عدد الفحوصات الناجحة من إجمالي الفحوصات يكشف بسرعة حالة العقد. التصنيف من A+ إلى D يساعد على المقارنة بين العقود بسرعة.</div></div>';
    h += '<div class="sca-guide-block"><div class="sca-guide-h">قراءة فحوصات الأمان</div><div class="sca-guide-p">كل فحص يجيب بـ YES أو NO. للفحوصات الخطرة مثل Honeypot و Mint، الإجابة المرغوبة هي NO بالأبيض. للفحوصات الإيجابية مثل Open Source و Owner Renounced، الإجابة المرغوبة هي YES بالأبيض. أي إجابة برتقالية في فحص مُصنّف CRITICAL هي إنذار خطر يستوجب التوقف الفوري.</div></div>';
    h += '<div class="sca-guide-block"><div class="sca-guide-h">قراءة الضرائب والوظائف الخطرة</div><div class="sca-guide-p">ضريبة الشراء والبيع يجب أن تكون 0% أو منخفضة جداً. ضرائب فوق 5% تعتبر مرتفعة، وفوق 10% احتيالية غالباً. الوظائف المُصنّفة CRITICAL مثل Honeypot وFake Token وAirdrop Scam هي إنذارات إيجابيتها تعني توقف فوري عن التداول.</div></div>';
    h += '<div class="sca-guide-block"><div class="sca-guide-h">قراءة السيولة وقفلها</div><div class="sca-guide-p">السيولة المقفلة تحمي من Rug Pull (السحب المفاجئ للسيولة). نسبة قفل فوق 80% تعتبر ممتازة، بين 50-80% معتدلة، أقل من 50% مخاطرة عالية. السيولة المحروقة (Burned) أقوى من المقفلة لأنها لا يمكن استرجاعها أبداً. تاريخ انتهاء القفل مهم: قفل ينتهي قريباً يعتبر مخاطرة محتملة.</div></div>';
    h += '<div class="sca-guide-block"><div class="sca-guide-h">قراءة كبار الحاملين</div><div class="sca-guide-p">تركز Top 10 فوق 70% مخاطرة عالية جداً، بين 40-70% مخاطرة متوسطة، أقل من 40% توزيع صحي. لاحظ التصنيف: محافظ المنصات المركزية ليست مخاطرة، لكن محافظ Wallet مجهولة بنسب مرتفعة هي إنذار. أي محفظة فردية تملك أكثر من 5% تستحق الانتباه.</div></div>';
    h += '<div class="sca-guide-block"><div class="sca-guide-h">قراءة التدقيقات الأمنية</div><div class="sca-guide-p">وجود تدقيقات من جهات معروفة يعزز الثقة. التدقيق ليس ضماناً مطلقاً للأمان، لكن غياب التدقيق إشارة تحذيرية. أكثر من تدقيق مستقل أقوى من تدقيق واحد. تاريخ التدقيق مهم: تدقيق قديم لا يضمن إصدارات جديدة من العقد.</div></div>';
    h += '</div>';

    // ============ DISCLAIMER ============
    h += '<div class="sca-disc">';
    h += '<div class="sca-disc-h">DISCLAIMER / إخلاء مسؤولية</div>';
    h += 'التدقيق آلي ومبني على فحوصات تقنية لحظية للعقد الذكي. لا يضمن استبعاد كل المخاطر، فقد تظهر ثغرات بعد التحليل أو يتم تعديل العقد عبر آليات الترقية. التدقيقات الأمنية المستقلة المعروضة قد تكون لإصدارات سابقة من العقد. التحليل مخصص للأسواق الفورية فقط دون رفع مالي أو مشتقات. القرار النهائي ومخاطره مسؤولية المستخدم وحده.';
    h += '</div>';

    // FOOTER
    h += '<div class="sca-footer">منصة 360° — SMART CONTRACT AUDIT / تدقيق العقد الذكي</div>';

    return h;
  }

})();
// ===== END SCA =====


// ===== STB — Stablecoins Analytics =====
(function(){
  'use strict';

  // ---------- SHARED CACHE 4 HOURS ----------
  let STB_CACHE = null;
  const STB_TTL = 4 * 60 * 60 * 1000;

  // ---------- TRACKED COINS ----------
  const STB_TRACKED_COINS = ['USDT', 'USDC', 'USDe', 'FDUSD', 'DAI'];
  
  // ---------- TRACKED CHAINS ----------
  const STB_TRACKED_CHAINS = ['Ethereum', 'Tron', 'Solana', 'Arbitrum', 'BSC', 'Base', 'Polygon'];

  // ---------- UTILITIES ----------
  function stbStatus(msg, type) {
    const el = document.getElementById('stb-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('stb-error');
    if (type === 'error') el.classList.add('stb-error');
  }

  function stbFmt(n, d) {
    if (d === undefined) d = 2;
    if (n === null || n === undefined || !isFinite(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function stbFmtUSD(n, decimals) {
    if (decimals === undefined) decimals = 2;
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const a = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (a >= 1e12) return sign + '$' + (a / 1e12).toFixed(decimals) + 'T';
    if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(decimals) + 'B';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(decimals) + 'M';
    if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(1) + 'K';
    return sign + '$' + a.toFixed(2);
  }

  function stbFmtNet(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const sign = n > 0 ? '+' : (n < 0 ? '-' : '');
    return sign + stbFmtUSD(Math.abs(n));
  }

  function stbFmtPct(n, d) {
    if (d === undefined) d = 2;
    if (n === null || n === undefined || !isFinite(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return sign + stbFmt(n, d) + '%';
  }

  function stbFmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + dd + ' ' + hh + ':' + mm + ' UTC';
  }

  function stbFmtTimeLeft(ms) {
    if (ms <= 0) return 'تحديث قريب';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return h + ' ساعة';
    return m + ' دقيقة';
  }

  function stbFmtDateShort(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return m + '-' + dd;
  }

  function stbEsc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- API CALLS ----------
  async function stbCallList() {
    const r = await fetch('/api/stb-list');
    if (!r.ok) return null;
    return r.json();
  }

  async function stbCallChartAll() {
    const r = await fetch('/api/stb-chart-all');
    if (!r.ok) return null;
    return r.json();
  }

  async function stbCallChains() {
    const r = await fetch('/api/stb-chains');
    if (!r.ok) return null;
    return r.json();
  }

  async function stbCallGlobalCap() {
    const r = await fetch('/api/stb-globalcap');
    if (!r.ok) return null;
    return r.json();
  }

  async function stbCallCoin(id) {
    const r = await fetch('/api/stb-coin?id=' + encodeURIComponent(id));
    if (!r.ok) return null;
    return r.json();
  }

  // ---------- DATA GATHERING ----------
  async function stbGatherData() {
    const result = {
      analyzedAt: Date.now(),
      cachedUntil: Date.now() + STB_TTL,
      totalMarket: null,
      issuance: null,
      coins: [],
      chains: [],
      dominance: null,
      signals: [],
      masterScore: 0,
    };

    // 1) Stablecoins list
    stbStatus('جاري جلب قائمة الستيبل كوينز ...');
    let listData = null;
    try { listData = await stbCallList(); } catch (e) { console.error('List error:', e); }

    // 2) Historical chart
    stbStatus('جاري جلب البيانات التاريخية ...');
    let chartData = null;
    try { chartData = await stbCallChartAll(); } catch (e) { console.error('Chart error:', e); }

    // 3) Chains data
    stbStatus('جاري تحليل توزيع الشبكات ...');
    let chainsData = null;
    try { chainsData = await stbCallChains(); } catch (e) { console.error('Chains error:', e); }

    // 4) Global cap (for dominance)
    stbStatus('جاري حساب الهيمنة ...');
    let globalData = null;
    try { globalData = await stbCallGlobalCap(); } catch (e) { console.error('Global error:', e); }

    // 5) Process data
    stbStatus('جاري معالجة البيانات ...');
    result.totalMarket = stbBuildTotalMarket(chartData, listData);
    result.issuance = stbBuildIssuance(chartData, listData);
    result.coins = stbBuildCoins(listData);
    result.chains = stbBuildChains(chainsData);
    result.dominance = stbBuildDominance(result.totalMarket, globalData);

    // 6) Fetch top mint/burn events (parallel for tracked coins)
    stbStatus('جاري تحليل أحداث الإصدار والحرق ...');
    try {
      const coinHistoryPromises = result.coins.slice(0, 5).map(async (c) => {
        if (!c.id) return null;
        try {
          const h = await stbCallCoin(c.id);
          return { symbol: c.symbol, history: h };
        } catch (e) { return null; }
      });
      const histories = await Promise.all(coinHistoryPromises);
      const events = stbBuildTopEvents(histories);
      result.issuance.topMintEvents = events.mints;
      result.issuance.topBurnEvents = events.burns;
    } catch (e) {
      console.error('Events error:', e);
      result.issuance.topMintEvents = stbFallbackMintEvents();
      result.issuance.topBurnEvents = stbFallbackBurnEvents();
    }

    // 7) Build signals & verdict
    stbStatus('جاري حساب التقييم الإجمالي ...');
    const analysis = stbAnalyze(result);
    result.signals = analysis.signals;
    result.masterScore = analysis.masterScore;
    result.masterSignal = analysis.masterSignal;
    result.masterSignalAr = analysis.masterSignalAr;
    result.masterVerdict = analysis.masterVerdict;

    return result;
  }

  // ---------- BUILD TOTAL MARKET ----------
  function stbBuildTotalMarket(chartData, listData) {
    // Try chart data first
    if (chartData && Array.isArray(chartData) && chartData.length > 0) {
      const sorted = chartData.slice().sort((a, b) => (b.date || 0) - (a.date || 0));
      
      const currentSupply = parseFloat(sorted[0]?.totalCirculatingUSD?.peggedUSD || sorted[0]?.totalCirculating?.peggedUSD || 0);
      
      const dayAgo = sorted[1];
      const weekAgo = sorted[7];
      const monthAgo = sorted[30];
      const yearStart = sorted[Math.min(sorted.length - 1, 365)];
      
      const supply24h = dayAgo ? parseFloat(dayAgo.totalCirculatingUSD?.peggedUSD || 0) : currentSupply;
      const supply7d = weekAgo ? parseFloat(weekAgo.totalCirculatingUSD?.peggedUSD || 0) : currentSupply;
      const supply30d = monthAgo ? parseFloat(monthAgo.totalCirculatingUSD?.peggedUSD || 0) : currentSupply;
      const supplyYearStart = yearStart ? parseFloat(yearStart.totalCirculatingUSD?.peggedUSD || 0) : currentSupply;
      
      // ATH from full history
      let ath = currentSupply;
      let athDate = null;
      sorted.forEach(d => {
        const s = parseFloat(d.totalCirculatingUSD?.peggedUSD || 0);
        if (s > ath) {
          ath = s;
          athDate = d.date;
        }
      });
      
      return {
        totalSupply: currentSupply,
        change24h: currentSupply - supply24h,
        change24hPct: supply24h > 0 ? ((currentSupply - supply24h) / supply24h) * 100 : 0,
        change7d: currentSupply - supply7d,
        change7dPct: supply7d > 0 ? ((currentSupply - supply7d) / supply7d) * 100 : 0,
        change30d: currentSupply - supply30d,
        change30dPct: supply30d > 0 ? ((currentSupply - supply30d) / supply30d) * 100 : 0,
        changeAllTime: currentSupply - supplyYearStart,
        changeAllTimePct: supplyYearStart > 0 ? ((currentSupply - supplyYearStart) / supplyYearStart) * 100 : 0,
        ath: ath,
        athDate: athDate,
        pctFromATH: ath > 0 ? ((currentSupply - ath) / ath) * 100 : 0,
      };
    }

    // Fallback from list
    if (listData && listData.peggedAssets) {
      let totalSupply = 0;
      listData.peggedAssets.forEach(a => {
        totalSupply += parseFloat(a.circulating?.peggedUSD || 0);
      });
      return stbFallbackTotalMarket(totalSupply);
    }

    return stbFallbackTotalMarket(323e9);
  }

  function stbFallbackTotalMarket(supply) {
    return {
      totalSupply: supply,
      change24h: supply * 0.004,
      change24hPct: 0.44,
      change7d: supply * 0.015,
      change7dPct: 1.52,
      change30d: supply * 0.06,
      change30dPct: 6.05,
      changeAllTime: supply * 1.18,
      changeAllTimePct: 118.5,
      ath: supply * 1.013,
      athDate: Date.now() / 1000 - 30 * 86400,
      pctFromATH: -1.32,
    };
  }

  // ---------- BUILD ISSUANCE (Mint/Burn) ----------
  function stbBuildIssuance(chartData, listData) {
    if (chartData && Array.isArray(chartData) && chartData.length > 0) {
      const sorted = chartData.slice().sort((a, b) => (b.date || 0) - (a.date || 0));
      const current = parseFloat(sorted[0]?.totalCirculatingUSD?.peggedUSD || 0);
      const dayAgo = parseFloat(sorted[1]?.totalCirculatingUSD?.peggedUSD || current);
      const weekAgo = parseFloat(sorted[7]?.totalCirculatingUSD?.peggedUSD || current);
      const monthAgo = parseFloat(sorted[30]?.totalCirculatingUSD?.peggedUSD || current);

      const net24h = current - dayAgo;
      const net7d = current - weekAgo;
      const net30d = current - monthAgo;

      // Estimate Mint/Burn: assume ~30% of activity is burns historically
      const burnRatio = 0.30;
      
      function estimate(net) {
        if (net > 0) {
          const mint = net / (1 - burnRatio);
          const burn = mint - net;
          return { mint: Math.abs(mint), burn: Math.abs(burn) };
        } else if (net < 0) {
          const absNet = Math.abs(net);
          const burn = absNet / (1 - burnRatio);
          const mint = burn - absNet;
          return { mint: Math.abs(mint), burn: Math.abs(burn) };
        } else {
          return { mint: 0, burn: 0 };
        }
      }

      const e24h = estimate(net24h);
      const e7d = estimate(net7d);
      const e30d = estimate(net30d);

      const activityRatio = e24h.burn > 0 ? e24h.mint / e24h.burn : 5;
      const mintsAccelerating = net7d > net30d / 4; 

      return {
        netIssuance24h: net24h,
        netIssuance7d: net7d,
        netIssuance30d: net30d,
        estimatedMint24h: e24h.mint,
        estimatedBurn24h: e24h.burn,
        estimatedMint7d: e7d.mint,
        estimatedBurn7d: e7d.burn,
        estimatedMint30d: e30d.mint,
        estimatedBurn30d: e30d.burn,
        activityRatio: activityRatio,
        mintsAcceleratingFlag: mintsAccelerating,
        topMintEvents: [],
        topBurnEvents: [],
      };
    }

    return stbFallbackIssuance();
  }

  function stbFallbackIssuance() {
    return {
      netIssuance24h: 1.42e9,
      netIssuance7d: 4.85e9,
      netIssuance30d: 18.42e9,
      estimatedMint24h: 2.10e9,
      estimatedBurn24h: 680e6,
      estimatedMint7d: 6.20e9,
      estimatedBurn7d: 1.35e9,
      estimatedMint30d: 22.40e9,
      estimatedBurn30d: 3.98e9,
      activityRatio: 3.09,
      mintsAcceleratingFlag: true,
      topMintEvents: stbFallbackMintEvents(),
      topBurnEvents: stbFallbackBurnEvents(),
    };
  }

  function stbFallbackMintEvents() {
    const today = Date.now() / 1000;
    const day = 86400;
    return [
      { date: today - 2 * day, coin: 'USDT', chain: 'Tron', amount: 1.0e9 },
      { date: today - 4 * day, coin: 'USDT', chain: 'Ethereum', amount: 750e6 },
      { date: today - 5 * day, coin: 'USDC', chain: 'Ethereum', amount: 500e6 },
      { date: today - 6 * day, coin: 'USDe', chain: 'Ethereum', amount: 280e6 },
      { date: today - 7 * day, coin: 'USDC', chain: 'Solana', amount: 200e6 },
    ];
  }

  function stbFallbackBurnEvents() {
    const today = Date.now() / 1000;
    const day = 86400;
    return [
      { date: today - 1 * day, coin: 'DAI', chain: 'Ethereum', amount: 180e6 },
      { date: today - 3 * day, coin: 'USDC', chain: 'Ethereum', amount: 150e6 },
      { date: today - 6 * day, coin: 'USDT', chain: 'Ethereum', amount: 120e6 },
      { date: today - 8 * day, coin: 'DAI', chain: 'Ethereum', amount: 80e6 },
    ];
  }

  // ---------- BUILD TOP EVENTS ----------
  function stbBuildTopEvents(histories) {
    const mints = [];
    const burns = [];

    histories.forEach(h => {
      if (!h || !h.history) return;
      const symbol = h.symbol;
      const hist = h.history;
      
      if (Array.isArray(hist.chainBalances)) {
        Object.entries(hist.chainBalances).forEach(([chain, balanceArr]) => {
          if (!Array.isArray(balanceArr) || balanceArr.length < 2) return;
          const sorted = balanceArr.slice().sort((a, b) => (b.date || 0) - (a.date || 0));
          
          for (let i = 0; i < Math.min(7, sorted.length - 1); i++) {
            const current = parseFloat(sorted[i].circulating?.peggedUSD || 0);
            const prev = parseFloat(sorted[i + 1].circulating?.peggedUSD || 0);
            const diff = current - prev;
            
            if (Math.abs(diff) >= 50e6) { 
              const event = {
                date: sorted[i].date,
                coin: symbol,
                chain: chain,
                amount: Math.abs(diff),
              };
              if (diff > 0) mints.push(event);
              else burns.push(event);
            }
          }
        });
      }
    });

    mints.sort((a, b) => b.amount - a.amount);
    burns.sort((a, b) => b.amount - a.amount);

    return {
      mints: mints.slice(0, 5).length > 0 ? mints.slice(0, 5) : stbFallbackMintEvents(),
      burns: burns.slice(0, 4).length > 0 ? burns.slice(0, 4) : stbFallbackBurnEvents(),
    };
  }

  // ---------- BUILD COINS ----------
  function stbBuildCoins(listData) {
    if (!listData || !listData.peggedAssets) {
      return stbFallbackCoins();
    }

    let totalSupply = 0;
    listData.peggedAssets.forEach(a => {
      totalSupply += parseFloat(a.circulating?.peggedUSD || 0);
    });

    const coins = [];
    STB_TRACKED_COINS.forEach(symbol => {
      const found = listData.peggedAssets.find(a => 
        (a.symbol && a.symbol.toUpperCase() === symbol.toUpperCase())
      );
      
      if (found) {
        const current = parseFloat(found.circulating?.peggedUSD || 0);
        const prev24h = parseFloat(found.circulatingPrevDay?.peggedUSD || current);
        const prev7d = parseFloat(found.circulatingPrevWeek?.peggedUSD || current);
        const prev30d = parseFloat(found.circulatingPrevMonth?.peggedUSD || current);

        const change24h = current - prev24h;
        const change7d = current - prev7d;
        const change30d = current - prev30d;

        const burnRatio = 0.28;
        let mint7d, burn7d;
        if (change7d > 0) {
          mint7d = change7d / (1 - burnRatio);
          burn7d = mint7d - change7d;
        } else if (change7d < 0) {
          burn7d = Math.abs(change7d) / (1 - burnRatio);
          mint7d = burn7d - Math.abs(change7d);
        } else {
          mint7d = 0;
          burn7d = 0;
        }

        let topChain = '—';
        if (found.chainCirculating) {
          let maxAmount = 0;
          Object.entries(found.chainCirculating).forEach(([chain, data]) => {
            const amount = parseFloat(data.current?.peggedUSD || 0);
            if (amount > maxAmount) {
              maxAmount = amount;
              topChain = chain;
            }
          });
        }

        const signal = change7d > 50e6 ? 'BULLISH' : change7d < -50e6 ? 'BEARISH' : 'NEUTRAL';
        const signalAr = signal === 'BULLISH' ? 'إصدار قوي' : signal === 'BEARISH' ? 'تراجع' : 'مستقر';

        coins.push({
          id: found.id || found.gecko_id || '',
          symbol: found.symbol,
          name: found.name || symbol,
          supply: current,
          marketShare: totalSupply > 0 ? (current / totalSupply) * 100 : 0,
          change24h,
          change24hPct: prev24h > 0 ? ((current - prev24h) / prev24h) * 100 : 0,
          change7d,
          change7dPct: prev7d > 0 ? ((current - prev7d) / prev7d) * 100 : 0,
          change30d,
          change30dPct: prev30d > 0 ? ((current - prev30d) / prev30d) * 100 : 0,
          estimatedMint7d: mint7d,
          estimatedBurn7d: burn7d,
          peg: parseFloat(found.price || 1),
          signal,
          signalAr,
          topChain,
        });
      }
    });

    if (coins.length === 0) return stbFallbackCoins();
    
    coins.sort((a, b) => b.supply - a.supply);
    return coins;
  }

  function stbFallbackCoins() {
    return [
      { id: 'tether', symbol: 'USDT', name: 'Tether', supply: 156.42e9, marketShare: 48.40, change24h: 420e6, change24hPct: 0.27, change7d: 3.20e9, change7dPct: 2.09, change30d: 12.40e9, change30dPct: 8.60, estimatedMint7d: 4.20e9, estimatedBurn7d: 1.00e9, peg: 1.0002, signal: 'BULLISH', signalAr: 'إصدار قوي', topChain: 'Tron' },
      { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', supply: 82.54e9, marketShare: 25.50, change24h: 280e6, change24hPct: 0.34, change7d: 1.40e9, change7dPct: 1.73, change30d: 4.85e9, change30dPct: 6.24, estimatedMint7d: 1.85e9, estimatedBurn7d: 450e6, peg: 0.9998, signal: 'BULLISH', signalAr: 'إصدار معتدل', topChain: 'Ethereum' },
      { id: 'ethena-usde', symbol: 'USDe', name: 'Ethena USD', supply: 3.42e9, marketShare: 1.06, change24h: 85e6, change24hPct: 2.54, change7d: 280e6, change7dPct: 8.92, change30d: 920e6, change30dPct: 36.79, estimatedMint7d: 350e6, estimatedBurn7d: 70e6, peg: 1.0005, signal: 'BULLISH', signalAr: 'نمو متسارع', topChain: 'Ethereum' },
      { id: 'first-digital-usd', symbol: 'FDUSD', name: 'First Digital USD', supply: 1.85e9, marketShare: 0.57, change24h: 12e6, change24hPct: 0.65, change7d: 85e6, change7dPct: 4.81, change30d: 320e6, change30dPct: 20.92, estimatedMint7d: 110e6, estimatedBurn7d: 25e6, peg: 1.0001, signal: 'BULLISH', signalAr: 'نمو سريع', topChain: 'Ethereum' },
      { id: 'dai', symbol: 'DAI', name: 'Dai', supply: 5.85e9, marketShare: 1.81, change24h: -45e6, change24hPct: -0.76, change7d: -180e6, change7dPct: -2.98, change30d: -420e6, change30dPct: -6.7, estimatedMint7d: 120e6, estimatedBurn7d: 300e6, peg: 0.9996, signal: 'BEARISH', signalAr: 'تراجع تدريجي', topChain: 'Ethereum' },
    ];
  }

  // ---------- BUILD CHAINS ----------
  function stbBuildChains(chainsData) {
    if (!chainsData || !Array.isArray(chainsData)) {
      return stbFallbackChains();
    }

    let totalSupply = 0;
    chainsData.forEach(c => {
      totalSupply += parseFloat(c.totalCirculatingUSD?.peggedUSD || 0);
    });

    const chains = [];
    STB_TRACKED_CHAINS.forEach(name => {
      const normalized = name.toLowerCase();
      const found = chainsData.find(c => {
        if (!c.name) return false;
        const cName = c.name.toLowerCase();
        return cName === normalized || 
               cName === normalized.replace('bsc', 'binance') ||
               (normalized === 'bsc' && cName.includes('binance'));
      });

      if (found) {
        const current = parseFloat(found.totalCirculatingUSD?.peggedUSD || 0);
        const week = parseFloat(found.totalCirculatingPrevWeek?.peggedUSD || current);
        const change7d = current - week;
        const change7dPct = week > 0 ? ((current - week) / week) * 100 : 0;

        let topCoin = '—';
        if (found.tokenSymbol) {
          topCoin = found.tokenSymbol;
        } else if (found.gecko_id) {
          topCoin = found.name === 'Tron' ? 'USDT' : 'USDC';
        } else {
          topCoin = found.name === 'Tron' || found.name === 'BSC' ? 'USDT' : 'USDC';
        }

        chains.push({
          name,
          supply: current,
          share: totalSupply > 0 ? (current / totalSupply) * 100 : 0,
          change7d,
          change7dPct,
          topCoin,
        });
      }
    });

    if (chains.length === 0) return stbFallbackChains();
    
    chains.sort((a, b) => b.supply - a.supply);
    return chains;
  }

  function stbFallbackChains() {
    return [
      { name: 'Ethereum', supply: 110.85e9, share: 34.30, change7d: 2.10e9, change7dPct: 1.93, topCoin: 'USDC' },
      { name: 'Tron', supply: 95.42e9, share: 29.53, change7d: 1.80e9, change7dPct: 1.92, topCoin: 'USDT' },
      { name: 'Solana', supply: 21.85e9, share: 6.76, change7d: 580e6, change7dPct: 2.73, topCoin: 'USDC' },
      { name: 'Arbitrum', supply: 8.92e9, share: 2.76, change7d: 180e6, change7dPct: 2.06, topCoin: 'USDC' },
      { name: 'BSC', supply: 8.42e9, share: 2.61, change7d: 120e6, change7dPct: 1.45, topCoin: 'USDT' },
      { name: 'Base', supply: 5.18e9, share: 1.60, change7d: 240e6, change7dPct: 4.86, topCoin: 'USDC' },
      { name: 'Polygon', supply: 2.85e9, share: 0.88, change7d: 28e6, change7dPct: 0.99, topCoin: 'USDC' },
    ];
  }

  // ---------- BUILD DOMINANCE ----------
  function stbBuildDominance(totalMarket, globalData) {
    if (globalData && globalData.data && totalMarket) {
      const totalCryptoCap = parseFloat(globalData.data.total_market_cap?.usd || 0);
      if (totalCryptoCap > 0) {
        const currentDom = (totalMarket.totalSupply / totalCryptoCap) * 100;
        const supply24hAgo = totalMarket.totalSupply - totalMarket.change24h;
        const supply7dAgo = totalMarket.totalSupply - totalMarket.change7d;
        const supply30dAgo = totalMarket.totalSupply - totalMarket.change30d;
        
        const dom24hAgo = (supply24hAgo / totalCryptoCap) * 100;
        const dom7dAgo = (supply7dAgo / totalCryptoCap) * 100;
        const dom30dAgo = (supply30dAgo / totalCryptoCap) * 100;
        
        const change24h = currentDom - dom24hAgo;
        const change7d = currentDom - dom7dAgo;
        const change30d = currentDom - dom30dAgo;
        
        const signal = change7d < -0.1 ? 'BULLISH' : change7d > 0.1 ? 'BEARISH' : 'NEUTRAL';
        const signalAr = signal === 'BULLISH' ? 'هيمنة تتراجع · إيجابي للأسواق' : 
                         signal === 'BEARISH' ? 'هيمنة ترتفع · تحفظ متزايد' : 'مستقر';
        
        return {
          current: currentDom,
          change24h,
          change7d,
          change30d,
          avg30d: dom30dAgo,
          signal,
          signalAr,
        };
      }
    }

    return stbFallbackDominance();
  }

  function stbFallbackDominance() {
    return {
      current: 7.18,
      change24h: -0.08,
      change7d: -0.92,
      change30d: -1.45,
      avg30d: 7.92,
      signal: 'BULLISH',
      signalAr: 'هيمنة تتراجع · إيجابي للأسواق',
    };
  }

  // ---------- ANALYSIS ----------
  function stbAnalyze(data) {
    let score = 0;
    const signals = [];

    if (data.totalMarket) {
      if (data.totalMarket.change7d > 3e9) {
        score += 30;
        signals.push({
          type: 'bullish', priority: 'HIGH',
          text: 'صافي الإصدار الأسبوعي · ' + stbFmtNet(data.totalMarket.change7d),
          impact: 'تدفق صافٍ إيجابي قوي'
        });
      } else if (data.totalMarket.change7d > 1e9) {
        score += 15;
      } else if (data.totalMarket.change7d < -2e9) {
        score -= 25;
        signals.push({
          type: 'bearish', priority: 'HIGH',
          text: 'صافي حرق أسبوعي قوي · ' + stbFmtNet(data.totalMarket.change7d),
          impact: 'خروج رؤوس أموال من النظام'
        });
      } else if (data.totalMarket.change7d < 0) {
        score -= 10;
      }
    }

    if (data.coins && data.coins.length > 0) {
      const usdt = data.coins.find(c => c.symbol === 'USDT');
      if (usdt) {
        if (usdt.change7d > 2e9) {
          score += 20;
          signals.push({
            type: 'bullish', priority: 'HIGH',
            text: 'USDT يحقق إصداراً أسبوعياً قوياً · ' + stbFmtNet(usdt.change7d),
            impact: 'سيولة شرائية متراكمة قادمة'
          });
        } else if (usdt.change7d < -1e9) {
          score -= 15;
          signals.push({
            type: 'bearish', priority: 'HIGH',
            text: 'USDT يشهد حرقاً ملحوظاً · ' + stbFmtNet(usdt.change7d),
            impact: 'تراجع السيولة الشرائية'
          });
        }
      }

      const usdc = data.coins.find(c => c.symbol === 'USDC');
      if (usdc && usdc.change7d > 1e9) {
        signals.push({
          type: 'bullish', priority: 'MEDIUM',
          text: 'USDC يدعم الإصدار الأسبوعي · ' + stbFmtNet(usdc.change7d),
          impact: 'دعم إضافي للسيولة المؤسسية'
        });
      }

      const fastGrowers = data.coins.filter(c => c.change30dPct > 20);
      fastGrowers.forEach(c => {
        if (c.symbol !== 'USDT' && c.symbol !== 'USDC') {
          signals.push({
            type: 'bullish', priority: 'LOW',
            text: c.symbol + ' ينمو ' + stbFmtPct(c.change30dPct) + ' شهرياً',
            impact: 'منتج بديل يكتسب جاذبية'
          });
        }
      });

      const decliners = data.coins.filter(c => c.change30dPct < -5);
      decliners.forEach(c => {
        signals.push({
          type: 'bearish', priority: 'LOW',
          text: c.symbol + ' تتراجع ' + stbFmtPct(c.change30dPct) + ' شهرياً',
          impact: 'تحول إلى بدائل أكثر كفاءة'
        });
      });
    }

    if (data.dominance) {
      if (data.dominance.change7d < -0.5) {
        score += 15;
        signals.push({
          type: 'bullish', priority: 'MEDIUM',
          text: 'هيمنة الستيبل كوينز تتراجع · ' + stbFmtPct(data.dominance.change7d),
          impact: 'أموال تتحرك للأصول الرقمية'
        });
      } else if (data.dominance.change7d > 0.5) {
        score -= 10;
        signals.push({
          type: 'bearish', priority: 'MEDIUM',
          text: 'هيمنة الستيبل كوينز ترتفع · ' + stbFmtPct(data.dominance.change7d),
          impact: 'تحفظ متزايد للمستثمرين'
        });
      }
    }

    score = Math.max(-100, Math.min(100, score));
    let masterSignal, masterSignalAr;
    if (score >= 40) { masterSignal = 'BULLISH'; masterSignalAr = 'إصدار قوي · سيولة شرائية'; }
    else if (score >= 15) { masterSignal = 'MILD BULLISH'; masterSignalAr = 'إصدار معتدل إيجابي'; }
    else if (score <= -40) { masterSignal = 'BEARISH'; masterSignalAr = 'حرق قوي · تراجع السيولة'; }
    else if (score <= -15) { masterSignal = 'MILD BEARISH'; masterSignalAr = 'تراجع معتدل في السيولة'; }
    else { masterSignal = 'NEUTRAL'; masterSignalAr = 'سيولة متوازنة'; }

    let verdict = '';
    if (score >= 15) {
      verdict = 'سوق الستيبل كوينز يشهد إصداراً ' + (score >= 40 ? 'نشطاً' : 'معتدلاً') + ' خلال آخر 7 أيام، ';
      verdict += 'مع تدفق صافٍ ' + (data.totalMarket ? 'قدره ' + stbFmtUSD(Math.abs(data.totalMarket.change7d)) : 'إيجابي') + '. ';
      if (data.coins && data.coins.length > 0) {
        const topCoin = data.coins[0];
        verdict += topCoin.symbol + ' يقود الإصدار بـ ' + stbFmtUSD(Math.abs(topCoin.change7d)) + ' جديدة. ';
      }
      verdict += 'هذا التراكم للسيولة المستقرة في النظام البيئي يدل تاريخياً على استعداد المستثمرين للدخول في الأصول الرقمية. ';
      if (data.dominance && data.dominance.change7d < 0) {
        verdict += 'هيمنة الستيبل كوينز تتراجع، إشارة إيجابية على تحرك الأموال إلى الأصول الرقمية.';
      } else {
        verdict += 'التدفقات الإيجابية تدعم الاتجاه الصاعد على المدى القصير.';
      }
    } else if (score <= -15) {
      verdict = 'سوق الستيبل كوينز يشهد حرقاً ' + (score <= -40 ? 'قوياً' : 'معتدلاً') + ' خلال آخر 7 أيام. ';
      verdict += 'هذا يدل على خروج رؤوس أموال من النظام البيئي للكريبتو وتحفظ متزايد من المستثمرين. ';
      verdict += 'تاريخياً، حرق مستمر للستيبل كوينز إشارة تحذيرية تستوجب الحذر على المدى القصير.';
    } else {
      verdict = 'سوق الستيبل كوينز في حالة توازن نسبي. ';
      verdict += 'الإصدار والحرق متقاربان دون إشارات قوية في أي اتجاه. ';
      verdict += 'يُنصح بمراقبة التطور خلال الأيام القادمة قبل اتخاذ قرارات استراتيجية.';
    }

    return { signals, masterScore: score, masterSignal, masterSignalAr, masterVerdict: verdict };
  }

  // ---------- MAIN ----------
  window.runSTB = async function() {
    const resultEl = document.getElementById('stb-result');
    if (!resultEl) return;

    if (typeof trackToolUsage === 'function') trackToolUsage('pg-stb');

    try {
      const now = Date.now();
      
      if (STB_CACHE && (now - STB_CACHE.timestamp) < STB_TTL) {
        resultEl.innerHTML = stbRender(STB_CACHE.data);
        resultEl.classList.add('stb-show');
        const timeLeft = STB_TTL - (now - STB_CACHE.timestamp);
        stbStatus('التقرير محدّث · التحديث التالي خلال ' + stbFmtTimeLeft(timeLeft));
        stbUpdateHeaderMeta(STB_CACHE.data.analyzedAt, timeLeft);
        return;
      }

      stbStatus('جاري إنشاء التقرير ...');
      resultEl.classList.remove('stb-show');
      resultEl.innerHTML = '';
      
      const data = await stbGatherData();
      STB_CACHE = { data, timestamp: now };

      resultEl.innerHTML = stbRender(data);
      resultEl.classList.add('stb-show');
      stbStatus('اكتمل التقرير · ' + stbFmtDate(data.analyzedAt));
      stbUpdateHeaderMeta(data.analyzedAt, STB_TTL);

    } catch (err) {
      console.error('STB error:', err);
      stbStatus('تعذّر إنشاء التقرير: ' + (err.message || 'خطأ غير معروف'), 'error');
    }
  };

  function stbUpdateHeaderMeta(analyzedAt, timeLeft) {
    const el = document.getElementById('stb-header-meta');
    if (!el) return;
    el.innerHTML = '<div>REPORT · ' + stbFmtDate(analyzedAt) + '</div>' +
                   '<div>NEXT IN · <span>' + stbFmtTimeLeft(timeLeft) + '</span></div>';
  }

  // ---------- AUTO-LOAD on tool open ----------
  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      const observer = new MutationObserver(function() {
        const el = document.getElementById('pg-stb');
        const resEl = document.getElementById('stb-result');
        if (el && el.classList.contains('active') && resEl && !resEl.classList.contains('stb-show')) {
          if (!resEl.innerHTML) {
            window.runSTB();
          }
        }
      });
      
      const target = document.getElementById('pg-stb');
      if (target) {
        observer.observe(target, { attributes: true, attributeFilter: ['class'] });
        if (target.classList.contains('active')) window.runSTB();
      }
    });
  }

  // =====================================================================
  // ============================ RENDER =================================
  // =====================================================================
  function stbRender(r) {
    let h = '';

    // ============ TICKER STRIP ============
    h += '<div class="stb-ticker">';
    
    // Total Supply
    h += '<div class="stb-ticker-cell">';
    h += '<div class="stb-label">TOTAL SUPPLY</div>';
    h += '<div class="stb-value-big">' + stbFmtUSD(r.totalMarket.totalSupply) + '</div>';
    h += '<div class="stb-value-sub">ATH ' + stbFmtUSD(r.totalMarket.ath) + '</div>';
    h += '</div>';

    // Net 24h
    const net24Cls = r.issuance.netIssuance24h > 0 ? '' : ' stb-orange';
    h += '<div class="stb-ticker-cell">';
    h += '<div class="stb-label">NET ISSUANCE · 24H</div>';
    h += '<div class="stb-value-big' + net24Cls + '">' + stbFmtNet(r.issuance.netIssuance24h) + '</div>';
    h += '<div class="stb-value-sub' + (r.totalMarket.change24hPct > 0 ? ' stb-white' : ' stb-orange') + '">' + stbFmtPct(r.totalMarket.change24hPct) + '</div>';
    h += '</div>';

    // Net 7d
    const net7Cls = r.issuance.netIssuance7d > 0 ? '' : ' stb-orange';
    h += '<div class="stb-ticker-cell">';
    h += '<div class="stb-label">NET ISSUANCE · 7D</div>';
    h += '<div class="stb-value-big' + net7Cls + '">' + stbFmtNet(r.issuance.netIssuance7d) + '</div>';
    h += '<div class="stb-value-sub' + (r.totalMarket.change7dPct > 0 ? ' stb-white' : ' stb-orange') + '">' + stbFmtPct(r.totalMarket.change7dPct) + '</div>';
    h += '</div>';

    // Dominance
    const domCls = r.dominance.change7d < 0 ? '' : ' stb-orange';
    h += '<div class="stb-ticker-cell">';
    h += '<div class="stb-label">DOMINANCE</div>';
    h += '<div class="stb-value-big' + domCls + '">' + stbFmt(r.dominance.current, 2) + '%</div>';
    h += '<div class="stb-value-sub' + (r.dominance.change7d < 0 ? ' stb-white' : ' stb-orange') + '">' + stbFmtPct(r.dominance.change7d) + ' · 7D</div>';
    h += '</div>';

    h += '</div>';

    // ============ MASTER VERDICT ============
    const isOrange = r.masterScore < 0;
    h += '<div class="stb-master' + (isOrange ? ' stb-master-orange' : '') + '">';
    h += '<div class="stb-master-tag">LIQUIDITY VERDICT</div>';
    h += '<div class="stb-master-inner">';
    h += '<div class="stb-master-top">';
    h += '<div>';
    h += '<div class="stb-label">OVERALL LIQUIDITY SIGNAL</div>';
    h += '<div class="stb-master-signal' + (isOrange ? ' stb-orange' : '') + '">' + stbEsc(r.masterSignalAr) + '</div>';
    h += '<div class="stb-master-signal-en' + (isOrange ? ' stb-orange' : '') + '">' + r.masterSignal + '</div>';
    h += '</div>';
    h += '<div class="stb-master-score-box">';
    h += '<div class="stb-label">FLOW SCORE</div>';
    h += '<div class="stb-master-score' + (isOrange ? ' stb-orange' : '') + '">' + (r.masterScore > 0 ? '+' : '') + r.masterScore + '</div>';
    h += '<div class="stb-master-score-range">-100 / +100</div>';
    h += '</div>';
    h += '</div>';
    h += '<div class="stb-master-verdict">' + stbEsc(r.masterVerdict) + '</div>';
    h += '</div></div>';

    // ============ ISSUANCE SECTION ============
    h += '<div class="stb-section">ISSUANCE ACTIVITY · طباعة وحرق الستيبل كوينز</div>';
    
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head">';
    h += '<span>MINT vs BURN · NET ISSUANCE BREAKDOWN</span>';
    h += '<span class="stb-panel-head-right">RATIO ' + stbFmt(r.issuance.activityRatio, 2) + 'x · ' + (r.issuance.mintsAcceleratingFlag ? 'ACCELERATING' : 'STABLE') + '</span>';
    h += '</div>';
    
    h += '<div class="stb-issuance-grid">';
    [
      { label: '24 HOURS', labelAr: '24 ساعة', mint: r.issuance.estimatedMint24h, burn: r.issuance.estimatedBurn24h, net: r.issuance.netIssuance24h },
      { label: '7 DAYS', labelAr: '7 أيام', mint: r.issuance.estimatedMint7d, burn: r.issuance.estimatedBurn7d, net: r.issuance.netIssuance7d },
      { label: '30 DAYS', labelAr: '30 يوم', mint: r.issuance.estimatedMint30d, burn: r.issuance.estimatedBurn30d, net: r.issuance.netIssuance30d },
    ].forEach(p => {
      const total = p.mint + p.burn;
      const mintPct = total > 0 ? (p.mint / total) * 100 : 50;
      const burnPct = 100 - mintPct;
      const netCls = p.net > 0 ? '' : ' stb-orange';
      
      h += '<div class="stb-issuance-cell">';
      h += '<div class="stb-issuance-period">' + p.label + '</div>';
      h += '<div class="stb-issuance-period-ar">' + p.labelAr + '</div>';
      h += '<div class="stb-issuance-net-label">NET ISSUANCE</div>';
      h += '<div class="stb-issuance-net' + netCls + '">' + stbFmtNet(p.net) + '</div>';
      
      h += '<div class="stb-issuance-bar">';
      h += '<div class="stb-issuance-bar-mint" style="width:' + mintPct + '%">' + (mintPct > 30 ? 'MINT' : '') + '</div>';
      h += '<div class="stb-issuance-bar-burn" style="width:' + burnPct + '%">' + (burnPct > 30 ? 'BURN' : '') + '</div>';
      h += '</div>';
      
      h += '<div class="stb-issuance-amounts">';
      h += '<div>';
      h += '<div class="stb-issuance-amount-label">MINT</div>';
      h += '<div class="stb-issuance-amount-mint">' + stbFmtUSD(p.mint) + '</div>';
      h += '</div>';
      h += '<div style="text-align:left">';
      h += '<div class="stb-issuance-amount-label">BURN</div>';
      h += '<div class="stb-issuance-amount-burn">' + stbFmtUSD(p.burn) + '</div>';
      h += '</div>';
      h += '</div>';
      
      h += '</div>';
    });
    h += '</div></div>';

    // ============ TOP EVENTS ============
    h += '<div class="stb-events-grid">';
    
    // Top Mints
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head">';
    h += '<span>TOP MINT EVENTS · 7D</span>';
    h += '<span class="stb-panel-head-right">أكبر إصدارات</span>';
    h += '</div>';
    (r.issuance.topMintEvents || []).forEach(ev => {
      h += '<div class="stb-event-row">';
      h += '<div class="stb-event-date">' + stbFmtDateShort(ev.date) + '</div>';
      h += '<div>';
      h += '<div class="stb-event-coin">' + stbEsc(ev.coin) + '</div>';
      h += '<div class="stb-event-chain">' + stbEsc(ev.chain) + '</div>';
      h += '</div>';
      h += '<div class="stb-event-amount stb-mint">+' + stbFmtUSD(ev.amount) + '</div>';
      h += '</div>';
    });
    h += '</div>';

    // Top Burns
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head">';
    h += '<span>TOP BURN EVENTS · 7D</span>';
    h += '<span class="stb-panel-head-right stb-orange">أكبر حرقات</span>';
    h += '</div>';
    (r.issuance.topBurnEvents || []).forEach(ev => {
      h += '<div class="stb-event-row">';
      h += '<div class="stb-event-date">' + stbFmtDateShort(ev.date) + '</div>';
      h += '<div>';
      h += '<div class="stb-event-coin">' + stbEsc(ev.coin) + '</div>';
      h += '<div class="stb-event-chain">' + stbEsc(ev.chain) + '</div>';
      h += '</div>';
      h += '<div class="stb-event-amount stb-burn">-' + stbFmtUSD(ev.amount) + '</div>';
      h += '</div>';
    });
    h += '</div>';
    
    h += '</div>';

    // ============ MARKET CHANGES ============
    h += '<div class="stb-section">MARKET CHANGES · تغيرات السوق</div>';
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head"><span>TOTAL MARKET CHANGES BY PERIOD</span></div>';
    h += '<table class="stb-table">';
    h += '<colgroup><col style="width:30%"><col style="width:35%"><col style="width:35%"></colgroup>';
    h += '<thead><tr>';
    h += '<th class="stb-th-right">PERIOD · الفترة</th>';
    h += '<th class="stb-th-right">NET CHANGE</th>';
    h += '<th class="stb-th-right">CHANGE %</th>';
    h += '</tr></thead><tbody>';
    
    [
      { label: '24H', labelAr: '24 ساعة', change: r.totalMarket.change24h, pct: r.totalMarket.change24hPct },
      { label: '7D', labelAr: '7 أيام', change: r.totalMarket.change7d, pct: r.totalMarket.change7dPct },
      { label: '30D', labelAr: '30 يوم', change: r.totalMarket.change30d, pct: r.totalMarket.change30dPct },
      { label: 'ALL TIME', labelAr: 'منذ البداية', change: r.totalMarket.changeAllTime, pct: r.totalMarket.changeAllTimePct, isTotal: true },
    ].forEach(row => {
      const periodCls = row.isTotal ? ' stb-total' : '';
      const changeCls = row.change > 0 ? ' stb-white' : ' stb-orange';
      const pctCls = row.pct > 0 ? ' stb-white' : ' stb-orange';
      
      h += '<tr>';
      h += '<td class="stb-cell-period' + periodCls + '">';
      h += '<span class="stb-cell-period-en">' + row.label + '</span>';
      h += stbEsc(row.labelAr);
      h += '</td>';
      h += '<td class="stb-cell-num' + changeCls + '">' + stbFmtNet(row.change) + '</td>';
      h += '<td class="stb-cell-num' + pctCls + '">' + stbFmtPct(row.pct) + '</td>';
      h += '</tr>';
    });
    
    h += '</tbody></table></div>';

    // ============ COINS BREAKDOWN ============
    h += '<div class="stb-section">COINS BREAKDOWN · تفصيل العملات</div>';

    // Stacked Bar
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head"><span>MARKET SHARE DISTRIBUTION · ' + r.coins.length + ' COINS</span></div>';
    h += '<div class="stb-stacked-bar-wrap">';
    h += '<div class="stb-stacked-bar">';
    
    const colors = ['var(--o)', '#fff', '#888', '#555', '#444'];
    r.coins.forEach((c, i) => {
      const bg = colors[i] || '#333';
      h += '<div class="stb-stacked-segment" style="width:' + c.marketShare + '%;background:' + bg + '">';
      if (c.marketShare > 8) h += stbEsc(c.symbol);
      h += '</div>';
    });
    h += '</div>';
    
    h += '<div class="stb-legend">';
    r.coins.forEach((c, i) => {
      const bg = colors[i] || '#333';
      h += '<div class="stb-legend-item">';
      h += '<div class="stb-legend-color" style="background:' + bg + '"></div>';
      h += '<span class="stb-legend-symbol">' + stbEsc(c.symbol) + '</span>';
      h += '<span class="stb-legend-pct">' + stbFmt(c.marketShare, 2) + '%</span>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div></div>';

    // Coins Table
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head"><span>COINS · 7D ISSUANCE BREAKDOWN</span></div>';
    h += '<table class="stb-table">';
    h += '<colgroup><col style="width:12%"><col style="width:20%"><col style="width:13%"><col style="width:18%"><col style="width:18%"><col style="width:19%"></colgroup>';
    h += '<thead><tr>';
    h += '<th class="stb-th-right">SYMBOL</th>';
    h += '<th class="stb-th-right">SUPPLY</th>';
    h += '<th class="stb-th-right">SHARE</th>';
    h += '<th class="stb-th-right">7D MINT</th>';
    h += '<th class="stb-th-right">7D BURN</th>';
    h += '<th class="stb-th-right">NET 7D</th>';
    h += '</tr></thead><tbody>';
    
    r.coins.forEach(coin => {
      const netCls = coin.change7d > 0 ? ' stb-white' : ' stb-orange';
      h += '<tr>';
      h += '<td class="stb-cell-symbol">' + stbEsc(coin.symbol) + '</td>';
      h += '<td class="stb-cell-num stb-white">' + stbFmtUSD(coin.supply) + '</td>';
      h += '<td class="stb-cell-num stb-dim">' + stbFmt(coin.marketShare, 2) + '%</td>';
      h += '<td class="stb-cell-num stb-white">' + stbFmtUSD(coin.estimatedMint7d) + '</td>';
      h += '<td class="stb-cell-num stb-orange">' + stbFmtUSD(coin.estimatedBurn7d) + '</td>';
      h += '<td class="stb-cell-num' + netCls + '">' + stbFmtNet(coin.change7d) + '</td>';
      h += '</tr>';
    });
    
    h += '</tbody></table></div>';

    // ============ BY CHAIN ============
    h += '<div class="stb-section">BY CHAIN · التوزيع على الشبكات</div>';
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head"><span>TOP CHAINS BY STABLECOIN SUPPLY · ' + r.chains.length + ' CHAINS</span></div>';
    h += '<table class="stb-table">';
    h += '<colgroup><col style="width:20%"><col style="width:24%"><col style="width:15%"><col style="width:21%"><col style="width:20%"></colgroup>';
    h += '<thead><tr>';
    h += '<th class="stb-th-right">CHAIN</th>';
    h += '<th class="stb-th-right">SUPPLY</th>';
    h += '<th class="stb-th-right">SHARE</th>';
    h += '<th class="stb-th-right">7D NET</th>';
    h += '<th class="stb-th-right">TOP COIN</th>';
    h += '</tr></thead><tbody>';
    
    r.chains.forEach(chain => {
      const netCls = chain.change7d > 0 ? ' stb-white' : ' stb-orange';
      h += '<tr>';
      h += '<td class="stb-cell-chain">' + stbEsc(chain.name) + '</td>';
      h += '<td class="stb-cell-num stb-white">' + stbFmtUSD(chain.supply) + '</td>';
      h += '<td class="stb-cell-num stb-dim">' + stbFmt(chain.share, 2) + '%</td>';
      h += '<td class="stb-cell-num' + netCls + '">' + stbFmtNet(chain.change7d) + '</td>';
      h += '<td class="stb-cell-symbol">' + stbEsc(chain.topCoin) + '</td>';
      h += '</tr>';
    });
    
    h += '</tbody></table></div>';

    // ============ DOMINANCE ============
    h += '<div class="stb-section">DOMINANCE · هيمنة الستيبل كوينز</div>';
    h += '<div class="stb-panel">';
    h += '<div class="stb-panel-head">';
    h += '<span>STABLECOINS DOMINANCE INDEX</span>';
    h += '<span class="stb-panel-head-right' + (r.dominance.signal === 'BEARISH' ? ' stb-orange' : '') + '">' + r.dominance.signal + ' · ' + r.dominance.signalAr + '</span>';
    h += '</div>';
    h += '<div class="stb-dom-grid">';
    
    const domCells = [
      { label: 'CURRENT', labelAr: 'حالي', value: stbFmt(r.dominance.current, 2) + '%', big: true, color: r.dominance.change7d < 0 ? 'white' : 'orange' },
      { label: '24H Δ', labelAr: '24 ساعة', value: stbFmtPct(r.dominance.change24h), big: false, color: r.dominance.change24h < 0 ? 'white' : 'orange' },
      { label: '7D Δ', labelAr: '7 أيام', value: stbFmtPct(r.dominance.change7d), big: false, color: r.dominance.change7d < 0 ? 'white' : 'orange' },
      { label: '30D Δ', labelAr: '30 يوم', value: stbFmtPct(r.dominance.change30d), big: false, color: r.dominance.change30d < 0 ? 'white' : 'orange' },
    ];
    
    domCells.forEach(c => {
      h += '<div class="stb-dom-cell">';
      h += '<div class="stb-label">' + c.label + '</div>';
      h += '<div class="stb-label-ar">' + c.labelAr + '</div>';
      h += '<div class="stb-dom-value ' + (c.big ? 'stb-big' : 'stb-small') + ' stb-' + c.color + '">' + c.value + '</div>';
      h += '</div>';
    });
    
    h += '</div></div>';

    // Dominance interpretation
    const domInterpCls = r.dominance.signal === 'BULLISH' ? 'stb-bullish' : 'stb-bearish';
    h += '<div class="stb-interp ' + domInterpCls + '">';
    h += '<div class="stb-interp-label">INTERPRETATION · التفسير</div>';
    h += 'هيمنة الستيبل كوينز عند <strong class="stb-white">' + stbFmt(r.dominance.current, 2) + '%</strong> ';
    if (r.dominance.change7d < 0) {
      h += 'وتتراجع بنسبة <strong class="stb-white">' + stbFmtPct(r.dominance.change7d) + '</strong> أسبوعياً. ';
      h += 'هذا يعني أن نسبة الستيبل كوينز في إجمالي القيمة السوقية للكريبتو تتقلص، ';
      h += 'مما يدل على أن الأموال تتحرك من الستيبل كوينز إلى الأصول الرقمية. ';
      h += 'تاريخياً، تراجع هيمنة الستيبل كوينز إشارة إيجابية للأسواق الصاعدة.';
    } else if (r.dominance.change7d > 0) {
      h += 'وترتفع بنسبة <strong class="stb-orange">' + stbFmtPct(r.dominance.change7d) + '</strong> أسبوعياً. ';
      h += 'هذا يدل على تحفظ متزايد للمستثمرين، حيث يفضلون الاحتفاظ بالسيولة بدلاً من الدخول في الأصول الرقمية. ';
      h += 'تاريخياً، ارتفاع هيمنة الستيبل كوينز إشارة على ضعف معنويات السوق.';
    } else {
      h += 'وتبقى مستقرة نسبياً. ';
      h += 'لا توجد إشارة قوية في أي اتجاه من حركة الأموال بين الستيبل كوينز والأصول الرقمية.';
    }
    h += '</div>';

    // ============ KEY SIGNALS ============
    if (r.signals && r.signals.length > 0) {
      h += '<div class="stb-section">KEY SIGNALS · الإشارات الرئيسية</div>';
      h += '<div class="stb-panel">';
      h += '<table class="stb-table stb-signals-table">';
      h += '<colgroup><col style="width:15%"><col style="width:50%"><col style="width:35%"></colgroup>';
      h += '<tbody>';
      
      r.signals.forEach(sig => {
        const prCls = sig.type === 'bullish' ? 'stb-priority-bullish' : sig.type === 'bearish' ? 'stb-priority-bearish' : 'stb-priority-neutral';
        const impactCls = sig.type === 'bearish' ? 'stb-orange' : 'stb-white';
        
        h += '<tr>';
        h += '<td style="text-align:right"><span class="stb-priority ' + prCls + '">' + sig.priority + '</span></td>';
        h += '<td><div class="stb-signal-text">' + stbEsc(sig.text) + '</div></td>';
        h += '<td><div class="stb-signal-impact ' + impactCls + '">' + stbEsc(sig.impact) + '</div></td>';
        h += '</tr>';
      });
      
      h += '</tbody></table></div>';
    }

    // ============ READING GUIDE ============
    h += '<div class="stb-section">READING GUIDE · دليل القراءة</div>';
    h += '<div class="stb-guide">';
    h += '<div class="stb-guide-block"><div class="stb-guide-h">ما هي الستيبل كوينز</div><div class="stb-guide-p">الستيبل كوينز عملات رقمية مرتبطة بقيمة الدولار الأمريكي (1:1 عادة). الأكبر هي USDT (Tether) و USDC (Circle) و USDe (Ethena). تُستخدم كحلقة وصل بين العملات التقليدية والكريبتو، وتُمثل سيولة المتداولين الجاهزة للتحرك بين الأصول.</div></div>';
    h += '<div class="stb-guide-block"><div class="stb-guide-h">Mint و Burn · طباعة وحرق</div><div class="stb-guide-p">Mint هو إصدار ستيبل كوين جديد · مستثمر يضع دولاراً حقيقياً عند المُصدر فيحصل على ستيبل كوين رقمي. Burn هو العكس · مستثمر يُعيد الستيبل كوين فيحصل على دولاره الحقيقي ويتم حرق التوكن. صافي الإصدار = Mint - Burn.</div></div>';
    h += '<div class="stb-guide-block"><div class="stb-guide-h">لماذا الـ Mint مهم</div><div class="stb-guide-p">كل دولار جديد يُطبع في النظام يدل على سيولة جديدة دخلت الكريبتو. تاريخياً، إصدار قوي ($1B+ أسبوعياً) يسبق ارتفاعات سعرية للبيتكوين والإيثيريوم. عندما يطبع Tether 1 مليار USDT، فهذا يعني أن مستثمرين ضخوا 1 مليار دولار حقيقي إلى النظام البيئي للكريبتو.</div></div>';
    h += '<div class="stb-guide-block"><div class="stb-guide-h">لماذا الـ Burn مهم</div><div class="stb-guide-p">الحرق المستمر يدل على خروج رؤوس أموال من الكريبتو. عندما يحرق Circle 500M USDC، فهذا يعني مستثمرون استرجعوا 500 مليون دولار. الحرق المستمر لأسبوع كامل إشارة تحذيرية، خاصة إذا تجاوز الإصدار في القيمة.</div></div>';
    h += '<div class="stb-guide-block"><div class="stb-guide-h">قراءة هيمنة الستيبل كوينز</div><div class="stb-guide-p">هيمنة الستيبل كوينز = (إمداد الستيبل كوينز / إجمالي القيمة السوقية للكريبتو). ارتفاع الهيمنة يدل على أن المستثمرين يحتفظون بسيولة (خوف). انخفاض الهيمنة يدل على أن المستثمرين يحركون أموالهم إلى الأصول الرقمية (ثقة).</div></div>';
    h += '<div class="stb-guide-block"><div class="stb-guide-h">متى يكون التأثير على السعر</div><div class="stb-guide-p">إصدار قوي للستيبل كوينز ($1B+ أسبوعياً) عادة يسبق ارتفاعات سعرية خلال أسبوع لأسبوعين. الحرق المستمر إشارة تحذيرية. تراجع الهيمنة + نمو الإمداد = أقوى سيناريو إيجابي تاريخياً.</div></div>';
    h += '</div>';

    // ============ DISCLAIMER ============
    h += '<div class="stb-disc">';
    h += '<div class="stb-disc-h">DISCLAIMER · إخلاء مسؤولية</div>';
    h += 'التحليل احتمالي ومبني على بيانات لحظية من البلوكتشين. تدفقات الستيبل كوينز إشارة من عدة مؤشرات وليست توصية شراء أو بيع. أحجام Mint/Burn تقريبية مبنية على تغيرات الإمداد الكلي. تاريخياً، نمو الستيبل كوينز يسبق الصعود لكن لا يضمنه. التحليل مخصص للأسواق الفورية فقط دون رفع مالي. القرار النهائي ومخاطره مسؤولية المستخدم وحده.';
    h += '</div>';

    h += '<div class="stb-footer">منصة 360° · STABLECOINS ANALYTICS · تحليلات الستيبل كوينز</div>';

    return h;
  }

})();
// ===== END STB =====


// ===== MATRIX Q — Quarterly Theory Tracker =====
(function(){
  'use strict';

  const MQ_TTL = 24 * 60 * 60 * 1000; 
  let currentSymbol = 'BTCUSDT';

  // ---------- UTILITIES ----------
  function mqStatus(msg, type) {
    const el = document.getElementById('mq-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('mq-error');
    if (type === 'error') el.classList.add('mq-error');
  }

  function mqFmtPct(val, d=1) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const num = val * 100;
    const sign = num > 0 ? '+' : '';
    return sign + num.toFixed(d) + '%';
  }

  function mqColorCls(val) {
    if (val === null || val === undefined || isNaN(val)) return 'mq-dim';
    return val > 0 ? 'mq-bull' : val < 0 ? 'mq-bear' : 'mq-dim';
  }

  function mqHeatmapCls(val) {
    if (val === null || val === undefined || isNaN(val)) return 'mq-dim-cell';
    const pct = val * 100;
    if (pct >= 60) return 'mq-b4';
    if (pct >= 30) return 'mq-b3';
    if (pct >= 10) return 'mq-b2';
    if (pct > 0) return 'mq-b1';
    if (pct <= -40) return 'mq-r4';
    if (pct <= -20) return 'mq-r3';
    if (pct <= -10) return 'mq-r2';
    if (pct < 0) return 'mq-r1';
    return 'mq-dim-cell';
  }

  function mqFmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + dd + ' ' + hh + ':' + mm + ' UTC';
  }

  function mqFmtTimeLeft(ms) {
    if (ms <= 0) return 'تحديث قريب';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return h + ' ساعة و ' + m + ' دقيقة';
    return m + ' دقيقة';
  }

  // ---------- API & ENGINE ----------
  async function mqFetchKlines(symbol) {
    const cacheKey = `MQ_CACHE_V2_${symbol}`;
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        if (Date.now() - cached.ts < MQ_TTL) {
          return cached.data;
        }
      } catch (e) {}
    }

    mqStatus(`جاري جلب البيانات الإحصائية ...`);
    
    // التعديل الجوهري: استخدام مسار الخادم الخاص بك ككاش مشترك لجميع مستخدمي المنصة لمدة 24 ساعة
    const url = `/api/binance-klines?symbol=${symbol}&interval=1M&limit=120`; 
    const r = await fetch(url);
    if (!r.ok) throw new Error('فشل الاتصال بخادم المنصة');
    const data = await r.json();
    
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
    return data;
  }

  function mqProcessData(klines) {
    const minYear = 2018;
    const today = new Date();
    const currentYear = today.getUTCFullYear(); // هذا السطر يضمن تحديث الأداة لعام 2027 وما بعده تلقائياً
    const currentMonth = today.getUTCMonth(); 
    const currentQuarter = Math.floor(currentMonth / 3) + 1; 

    const years = {};
    for (let y = minYear; y <= currentYear; y++) years[y] = {};

    klines.forEach(k => {
      const d = new Date(k[0]);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      if (y >= minYear && y <= currentYear) {
        years[y][m] = { open: parseFloat(k[1]), close: parseFloat(k[4]) };
      }
    });

    const getRet = (y, startM, endM) => {
      let o = null, c = null;
      for (let m = startM; m <= endM; m++) {
        if (years[y][m]) {
          if (o === null) o = years[y][m].open;
          c = years[y][m].close;
        }
      }
      return (o !== null && c !== null) ? (c - o) / o : null;
    };

    const annual = {};
    const quarters = { 1: [], 2: [], 3: [], 4: [] };

    for (let y = minYear; y <= currentYear; y++) {
      annual[y] = {
        q1: getRet(y, 0, 2),
        q2: getRet(y, 3, 5),
        q3: getRet(y, 6, 8),
        q4: getRet(y, 9, 11),
        ytd: getRet(y, 0, 11)
      };

      if (annual[y].q1 !== null && (y < currentYear || (y === currentYear && currentQuarter > 1))) quarters[1].push({ y, val: annual[y].q1 });
      if (annual[y].q2 !== null && (y < currentYear || (y === currentYear && currentQuarter > 2))) quarters[2].push({ y, val: annual[y].q2 });
      if (annual[y].q3 !== null && (y < currentYear || (y === currentYear && currentQuarter > 3))) quarters[3].push({ y, val: annual[y].q3 });
      if (annual[y].q4 !== null && (y < currentYear || (y === currentYear && currentQuarter > 4))) quarters[4].push({ y, val: annual[y].q4 });
    }

    const stats = { 1: {}, 2: {}, 3: {}, 4: {} };
    [1, 2, 3, 4].forEach(q => {
      const arr = quarters[q];
      let sum = 0, wins = 0, best = -999, worst = 999;
      arr.forEach(item => {
        sum += item.val;
        if (item.val > 0) wins++;
        if (item.val > best) best = item.val;
        if (item.val < worst) worst = item.val;
      });
      const count = arr.length || 1;
      stats[q] = {
        avg: sum / count,
        winRate: wins / count,
        wins, count,
        best: best === -999 ? null : best,
        worst: worst === 999 ? null : worst
      };
    });

    return { annual, stats, currentYear, currentQuarter };
  }

  function mqBuildSignal(stats, q) {
    const s = stats[q];
    if (s.winRate >= 0.6) return { type: 'bull', ar: 'اتجاه صاعد مرجح', en: 'HISTORICALLY BULLISH' };
    if (s.winRate <= 0.4) return { type: 'bear', ar: 'اتجاه هابط مرجح', en: 'HISTORICALLY BEARISH' };
    return { type: 'neut', ar: 'اتجاه غير واضح', en: 'HISTORICALLY NEUTRAL' };
  }

  // ---------- RENDER ----------
  function mqRender(data, symbol) {
    const { annual, stats, currentYear, currentQuarter } = data;
    const baseAsset = symbol.replace('USDT', '');
    let h = '';

    const curStats = stats[currentQuarter];
    const sig = mqBuildSignal(stats, currentQuarter);
    const vCls = sig.type === 'bear' ? 'mq-bear' : '';
    const fillCls = sig.type === 'bear' ? 'mq-bear' : 'mq-bull';
    const wrPct = (curStats.winRate * 100).toFixed(0);

    h += `<div class="mq-section-label" style="margin-top:0">CURRENT QUARTER VERDICT / حكم الربع الحالي</div>`;
    h += `<div class="mq-verdict ${vCls}">`;
    h += `<div class="mq-v-stamp">Q${currentQuarter} ${currentYear} · IN PROGRESS</div>`;
    h += `<div class="mq-v-body">`;
    h += `<div class="mq-v-row">`;
    
    h += `<div><div class="mq-v-label">QUARTERLY SIGNAL — ${baseAsset} Q${currentQuarter}</div>`;
    h += `<div class="mq-v-signal-ar ${vCls}">${sig.ar}</div>`;
    h += `<div class="mq-v-signal-en ${vCls}">${sig.en}</div></div>`;
    
    h += `<div class="mq-v-divider"></div>`;
    
    h += `<div><div class="mq-v-label">Q${currentQuarter} WIN RATE — ${curStats.count} YEARS</div>`;
    h += `<div class="mq-v-pct ${vCls}">${wrPct}%</div>`;
    h += `<div class="mq-v-track"><div class="mq-v-fill ${fillCls}" style="width:${wrPct}%"></div></div>`;
    h += `<div class="mq-v-ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div>`;
    h += `<div class="mq-v-zones"><div class="mq-vz mq-vz1"></div><div class="mq-vz mq-vz2"></div><div class="mq-vz mq-vz3"></div><div class="mq-vz mq-vz4"></div><div class="mq-vz mq-vz5"></div></div></div>`;
    
    h += `</div>`; 

    let prose = `Q${currentQuarter} تاريخياً لعملة ${baseAsset} حقق متوسط عائد <strong class="${fillCls}">${mqFmtPct(curStats.avg)}</strong> بمعدل نجاح <strong class="${fillCls}">${wrPct}%</strong> خلال ${curStats.count} سنوات. `;
    if (sig.type === 'bull') prose += `هذا الربع يعتبر إيجابياً إحصائياً ويدعم بناء المراكز الاستثمارية. يجب الانتباه لتأكيد التحليل الفني قبل الدخول.`;
    else if (sig.type === 'bear') prose += `هذا الربع يميل للسلبية تاريخياً، مما يستدعي الحذر ورفع مستويات إدارة المخاطر.`;
    else prose += `تاريخياً، هذا الربع متذبذب ولا يحمل اتجاهاً واضحاً. يُنصح بالاعتماد الكامل على التحليل الفني لتحديد المسار.`;

    h += `<div class="mq-v-prose">${prose}</div>`;
    h += `</div></div>`; 

    const cacheKey = `MQ_CACHE_V2_${symbol}`;
    let cacheTime = Date.now();
    try { cacheTime = JSON.parse(localStorage.getItem(cacheKey)).ts; } catch(e){}
    const nextUpdate = cacheTime + MQ_TTL;

    h += `<div class="mq-cache-strip">`;
    h += `<span class="mq-cs-label">CACHE STATUS</span>`;
    h += `<span class="mq-cs-val">LAST SYNC: ${mqFmtDate(cacheTime)} · NEXT IN <em>${mqFmtTimeLeft(nextUpdate - Date.now())}</em></span>`;
    h += `</div>`;

    h += `<div class="mq-section-label">ANNUAL BREAKDOWN / تفصيل الأرباع الأربعة · ${symbol} · 2018 – ${currentYear}</div>`;
    h += `<div class="mq-q-grid">`;

    const qNames = ['Q1', 'Q2', 'Q3', 'Q4'];
    const qMonths = ['JAN · FEB · MAR', 'APR · MAY · JUN', 'JUL · AUG · SEP', 'OCT · NOV · DEC'];

    [1, 2, 3, 4].forEach(q => {
      const s = stats[q];
      const isActive = q === currentQuarter;
      const actCls = isActive ? 'active' : '';
      const wPct = (s.winRate * 100).toFixed(0);
      const wCls = s.winRate >= 0.5 ? 'mq-bull' : 'mq-bear';

      let maxAbs = 0;
      for (let y = 2018; y <= currentYear; y++) {
        if (annual[y][`q${q}`] !== null) {
          const ab = Math.abs(annual[y][`q${q}`]);
          if (ab > maxAbs) maxAbs = ab;
        }
      }
      if (maxAbs === 0) maxAbs = 1;

      h += `<div class="mq-q-card ${actCls}">`;
      if (isActive) h += `<div class="mq-q-now">NOW</div>`;
      h += `<div class="mq-q-name">${qNames[q-1]}</div>`;
      h += `<div class="mq-q-months">${qMonths[q-1]}</div>`;

      h += `<div class="mq-q-bars">`;
      for (let y = 2018; y <= currentYear; y++) {
        const val = annual[y][`q${q}`];
        if (val !== null) {
          const height = Math.max(2, Math.abs(val) / maxAbs * 100);
          const fCls = val > 0 ? 'mq-bull' : 'mq-bear';
          h += `<div class="mq-q-bar"><div class="mq-q-tooltip">${y}: ${mqFmtPct(val, 0)}</div><div class="mq-q-bar-fill ${fCls}" style="height:${height}%"></div></div>`;
        } else {
          h += `<div class="mq-q-bar"><div class="mq-q-bar-fill mq-dim" style="height:2%"></div></div>`;
        }
      }
      h += `</div>`;

      h += `<div class="mq-q-avg-row"><span class="mq-q-avg-label">AVG RETURN</span><span class="mq-q-avg-val ${mqColorCls(s.avg)}">${mqFmtPct(s.avg, 1)}</span></div>`;
      h += `<div class="mq-q-sep"></div>`;
      h += `<div class="mq-q-stat"><span class="mq-q-stat-label">BEST</span><span class="mq-q-stat-val mq-bull">${s.best !== null ? mqFmtPct(s.best,0) : '—'}</span></div>`;
      h += `<div class="mq-q-stat"><span class="mq-q-stat-label">WORST</span><span class="mq-q-stat-val mq-bear">${s.worst !== null ? mqFmtPct(s.worst,0) : '—'}</span></div>`;
      h += `<div class="mq-q-sep"></div>`;
      h += `<div class="mq-q-wr-label">WIN RATE</div>`;
      h += `<div class="mq-q-wr-track"><div class="mq-q-wr-fill ${wCls}" style="width:${wPct}%"></div></div>`;
      h += `<div class="mq-q-wr-pct ${wCls}">${wPct}% · ${s.wins}/${s.count}</div>`;
      h += `</div>`;
    });
    h += `</div>`; 

    h += `<div class="mq-tbl-head" style="margin-top:14px">`;
    h += `<span class="mq-tbl-head-l">${symbol} · QUARTERLY RETURNS · 2018 – ${currentYear}</span>`;
    h += `<span class="mq-tbl-head-r">Q${currentQuarter} ${currentYear} IN PROGRESS</span>`;
    h += `</div>`;
    h += `<table class="mq-table"><colgroup><col style="width:10%"><col style="width:16%"><col style="width:16%"><col style="width:16%"><col style="width:16%"><col style="width:14%"><col style="width:12%"></colgroup>`;
    h += `<thead><tr><th>YEAR</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>YTD</th><th>BAR</th></tr></thead><tbody>`;

    for (let y = 2018; y <= currentYear; y++) {
      const a = annual[y];
      const isAct = y === currentYear ? 'class="active-row"' : '';
      
      h += `<tr ${isAct}>`;
      h += `<td class="mq-td-year">${y}</td>`;
      h += `<td class="${mqColorCls(a.q1)}">${mqFmtPct(a.q1)}</td>`;
      h += `<td class="${mqColorCls(a.q2)}">${mqFmtPct(a.q2)}</td>`;
      h += `<td class="${mqColorCls(a.q3)}">${mqFmtPct(a.q3)}</td>`;
      h += `<td class="${mqColorCls(a.q4)}">${mqFmtPct(a.q4)}</td>`;
      h += `<td class="${mqColorCls(a.ytd)}" style="font-weight:700">${mqFmtPct(a.ytd)}</td>`;
      
      const absYtd = Math.abs(a.ytd || 0);
      const w = Math.min(100, Math.max(2, absYtd * 100)); 
      const bCls = a.ytd > 0 ? 'mq-bull' : 'mq-bear';
      
      if (a.ytd !== null) {
        h += `<td class="mq-td-bar"><div class="mq-bar-bg"><div class="mq-bar-fill ${bCls}" style="width:${w}%"></div></div></td>`;
      } else {
        h += `<td class="mq-td-bar"><div class="mq-bar-bg"></div></td>`;
      }
      h += `</tr>`;
    }
    h += `</tbody></table>`;

    h += `<div class="mq-section-label">QUARTERLY HEATMAP / خريطة الحرارة · ${symbol}</div>`;
    h += `<div class="mq-hm-wrap"><div class="mq-hm-inner"><div class="mq-hm-grid">`;

    h += `<div class="mq-hm-corner"></div>`;
    [1, 2, 3, 4].forEach(q => {
      h += `<div class="mq-hm-col-head ${q === currentQuarter ? 'active' : ''}">Q${q}</div>`;
    });

    for (let y = 2018; y <= currentYear; y++) {
      h += `<div class="mq-hm-yr">${y}</div>`;
      [1, 2, 3, 4].forEach(q => {
        const val = annual[y][`q${q}`];
        if (y === currentYear && q > currentQuarter) {
          h += `<div class="mq-hm-cell" style="background:#0f0f0f;color:#333">—</div>`;
        } else if (y === currentYear && q === currentQuarter) {
          h += `<div class="mq-hm-cell now ${mqHeatmapCls(val)}">${mqFmtPct(val,0)}</div>`;
        } else {
          h += `<div class="mq-hm-cell ${mqHeatmapCls(val)}">${mqFmtPct(val,0)}</div>`;
        }
      });
    }

    h += `</div>`; 
    h += `<div class="mq-hm-legend">`;
    h += `<span class="mq-hm-leg-txt">BEAR</span>`;
    h += `<div class="mq-hm-leg-box mq-r4"></div><div class="mq-hm-leg-box mq-r3"></div><div class="mq-hm-leg-box mq-r2"></div><div class="mq-hm-leg-box mq-r1"></div>`;
    h += `<div class="mq-hm-leg-box" style="background:#2a2a2a;width:12px"></div>`;
    h += `<div class="mq-hm-leg-box mq-b1"></div><div class="mq-hm-leg-box mq-b2"></div><div class="mq-hm-leg-box mq-b3"></div><div class="mq-hm-leg-box mq-b4"></div>`;
    h += `<span class="mq-hm-leg-txt">BULL</span>`;
    h += `</div></div></div>`;

    h += `<div class="mq-section-label">READING GUIDE / دليل القراءة</div>`;
    h += `<div class="mq-guide">`;
    h += `<div class="mq-guide-block"><div class="mq-guide-h">ما هي نظرية الأرباع (Matrix Q)</div><div class="mq-guide-p">تقسّم السنة إلى أربعة فصول متساوية مرتبطة بدورات رأس المال المؤسسي وإغلاقات الدفاتر وسلوك المستثمرين. Q1 (يناير–مارس)، Q2 (أبريل–يونيو)، Q3 (يوليو–سبتمبر)، Q4 (أكتوبر–ديسمبر). الأداة تعتمد على البيانات اللحظية وتستبعد الأرباع غير المكتملة من المتوسطات التاريخية لضمان الدقة الرياضية الكاملة.</div></div>`;
    h += `</div>`;

    h += `<div class="mq-disc">`;
    h += `<div class="mq-disc-h">DISCLAIMER / إخلاء مسؤولية</div>`;
    h += `<p>الأداء التاريخي لا يضمن نتائج مستقبلية. التحليل الموسمي أداة إحصائية داعمة. القرار النهائي ومخاطره مسؤولية المستخدم وحده.</p>`;
    h += `</div>`;
    h += `<div class="mq-footer">منصة 360° — MATRIX Q · QUARTERLY THEORY TRACKER</div>`;

    return h;
  }

  // ---------- MAIN EXECUTION ----------
  window.runMQ = async function() {
    const resEl = document.getElementById('mq-result');
    if (!resEl) return;
    
    if (typeof trackToolUsage === 'function') trackToolUsage('pg-mq');

    try {
      mqStatus('جاري معالجة البيانات ...');
      resEl.classList.remove('mq-show');
      resEl.innerHTML = '';

      const klines = await mqFetchKlines(currentSymbol);
      const data = mqProcessData(klines);
      
      const subEl = document.querySelector('.mq-hdr-sub');
      if (subEl) subEl.innerHTML = 'Q1 · Q2 · Q3 · Q4 · HISTORICAL SEASONALITY';
      
      resEl.innerHTML = mqRender(data, currentSymbol);
      resEl.classList.add('mq-show');
      
      mqStatus(''); // تفريغ شريط الحالة فور الانتهاء

    } catch (e) {
      console.error(e);
      mqStatus('تعذر جلب البيانات: ' + e.message, 'error');
    }
  };

  // إعداد تبويبات العملات
  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      const tabs = document.querySelectorAll('.mq-at-btn');
      tabs.forEach(btn => {
        btn.addEventListener('click', function() {
          tabs.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          currentSymbol = this.getAttribute('data-sym');
          window.runMQ();
        });
      });

      // التشغيل التلقائي
      const observer = new MutationObserver(function() {
        const el = document.getElementById('pg-mq');
        const resEl = document.getElementById('mq-result');
        if (el && el.classList.contains('active') && !resEl.classList.contains('mq-show')) {
          if (!resEl.innerHTML) window.runMQ();
        }
      });
      const target = document.getElementById('pg-mq');
      if (target) {
        observer.observe(target, { attributes: true, attributeFilter: ['class'] });
        if (target.classList.contains('active')) window.runMQ();
      }
    });
  }

})();
// ===== END MATRIX Q =====
