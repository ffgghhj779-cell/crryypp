// المحرك الخوارزمي لنموذج ماركوف المخفي (HMM) - النسخة الحتمية
async function runHMM() {
    // [تعديل أمني]: إضافة فلتر يمنع أي رموز باستثناء الحروف والأرقام
const coinInput = document.getElementById('hmm-coin').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const tfInput = document.getElementById('hmm-tf').value;
    if (!coinInput) {
        alert("يرجى إدخال اسم العملة (مثال: BTC)");
        return;
    }

    const symbol = coinInput + "USDT";
    const btn = document.querySelector('#pg-hmm .btn');
    btn.innerText = "جاري جلب البيانات والتحليل...";
    btn.disabled = true;

    try {
        const response = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tfInput}&limit=50`);
        if (!response.ok) throw new Error("لم يتم العثور على العملة، تأكد من الرمز.");
        
        const data = await response.json();
        const closes = data.map(candle => parseFloat(candle[4]));

        const returns = [];
        for(let i = 1; i < closes.length; i++) {
            returns.push(Math.abs((closes[i] - closes[i-1]) / closes[i-1]));
        }
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const recentReturns = returns.slice(-5);
        const recentAvg = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;

        // المعالجة الرياضية الحتمية (Deterministic Calculation)
        const ratio = recentAvg / (avgReturn === 0 ? 1 : avgReturn);
        let pSideways = 0, pTrend = 0, pVolatile = 0;

        if (ratio > 1.3) {
            // نظام تقلبات حادة (صدمة سيولة)
            pVolatile = Math.min(88, Math.round(50 + (ratio * 10)));
            pTrend = Math.round((100 - pVolatile) * 0.6);
            pSideways = 100 - pVolatile - pTrend;
        } else if (ratio < 0.7) {
            // نظام تذبذب عرضي (انحسار سيولة)
            pSideways = Math.min(88, Math.round(100 - (ratio * 40)));
            pTrend = Math.round((100 - pSideways) * 0.7);
            pVolatile = 100 - pSideways - pTrend;
        } else {
            // نظام اتجاهي مستقر (توازن حركي)
            pTrend = Math.min(85, Math.round(40 + (ratio * 25)));
            pSideways = Math.round((100 - pTrend) * 0.65);
            pVolatile = 100 - pTrend - pSideways;
        }

        document.getElementById('hmm-val-1').innerText = pSideways + "%";
        document.getElementById('hmm-bar-1').style.width = pSideways + "%";
        
        document.getElementById('hmm-val-2').innerText = pTrend + "%";
        document.getElementById('hmm-bar-2').style.width = pTrend + "%";
        
        document.getElementById('hmm-val-3').innerText = pVolatile + "%";
        document.getElementById('hmm-bar-3').style.width = pVolatile + "%";

        let conclusion = "";
        if (pSideways > pTrend && pSideways > pVolatile) {
            conclusion = "الاستنتاج الخوارزمي: السوق في حالة توازن سعري.";
        } else if (pTrend > pSideways && pTrend > pVolatile) {
            conclusion = "الاستنتاج الخوارزمي: السوق في حالة اتجاه هادئ ومستقر.";
        } else {
            conclusion = "الاستنتاج الخوارزمي: السوق في حالة تقلبات حادة وانعدام توازن.";
        }
        
        document.getElementById('hmm-conclusion').innerText = conclusion;
        document.getElementById('hmm-result').style.display = 'block';

    } catch (error) {
        alert(error.message);
    } finally {
        btn.innerText = "تحليل بيانات السوق آلياً";
        btn.disabled = false;
    }
}

async function executeGarchModel() {
        // [تعديل أمني]: فلترة اسم العملة لنموذج GARCH
    const symbol = document.getElementById('garch-symbol').value.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const interval = document.getElementById('garch-interval').value;
    
    if (!symbol) {
        alert("يُرجى إدخال رمز العملة.");
        return;
    }

    // إعداد واجهة التحميل
    document.getElementById('garch-results').style.display = 'block';
    document.getElementById('garch-conclusion-text').innerHTML = "جاري الحسابات الرياضية...";
    document.getElementById('garch-upper-val').innerText = "--";
    document.getElementById('garch-current-val').innerText = "--";
    document.getElementById('garch-lower-val').innerText = "--";

    try {
        // جلب البيانات التاريخية لآخر 100 شمعة
        const url = `/api/binance-klines?symbol=${symbol}USDT&interval=${interval}&limit=100`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("فشل جلب المعطيات السعرية");
        
        const data = await response.json();
        const closes = data.map(candle => parseFloat(candle[4]));
        const currentPrice = closes[closes.length - 1];

        // حساب العوائد اللوغاريتمية
        let returns = [];
        for(let i = 1; i < closes.length; i++) {
            returns.push(Math.log(closes[i] / closes[i-1]));
        }

        // المحرك الرياضي لتقريب GARCH(1,1)
        const omega = 0.00001; 
        const alpha = 0.15; 
        const beta = 0.80; 

        let variance = returns.reduce((a, b) => a + Math.pow(b, 2), 0) / returns.length;

        for(let i = 1; i < returns.length; i++) {
            variance = omega + (alpha * Math.pow(returns[i-1], 2)) + (beta * variance);
        }

        // استخراج النطاقات للمستقبل
        const predictedVolatility = Math.sqrt(variance); 
        const volPercentage = (predictedVolatility * 100).toFixed(2); 
        const totalRangePercentage = (predictedVolatility * 2 * 100).toFixed(2); 

        const upperPrice = currentPrice * (1 + predictedVolatility);
        const lowerPrice = currentPrice * (1 - predictedVolatility);

        // تحديث الواجهة البصرية
        document.getElementById('garch-upper-val').innerHTML = `${upperPrice.toFixed(2)} <span class="garch-highlight">(+${volPercentage}%)</span>`;
        document.getElementById('garch-current-val').innerText = currentPrice.toFixed(2);
        document.getElementById('garch-lower-val').innerHTML = `${lowerPrice.toFixed(2)} <span class="garch-highlight">(-${volPercentage}%)</span>`;

        // صياغة الاستنتاج الخوارزمي
        const volatilityState = predictedVolatility > 0.02 ? "اتساع" : "انحسار";
        const conclusionHTML = `الاستنتاج الخوارزمي: رصد <span class="garch-highlight">${volatilityState}</span> في التباين. يُتوقع إحصائياً انحصار الحركة السعرية القادمة داخل نطاق تذبذب قدره <span class="garch-highlight">(${totalRangePercentage}%)</span>، بحد أقصى عند السعر <span class="garch-highlight">(${upperPrice.toFixed(2)})</span> وحد أدنى عند السعر <span class="garch-highlight">(${lowerPrice.toFixed(2)})</span>.`;
        
        document.getElementById('garch-conclusion-text').innerHTML = conclusionHTML;

    } catch (error) {
        document.getElementById('garch-conclusion-text').innerText = "حدث خطأ هندسي أثناء معالجة البيانات: " + error.message;
    }
}

// ==========================================
// محرك تحليل الدورات الزمنية (Fourier - FFT)
// ==========================================

// خوارزمية التحويل المتقطع (Discrete Fourier Transform - DFT)
function extractDominantCycles(closes) {
    const N = closes.length;
    const mean = closes.reduce((a, b) => a + b, 0) / N;
    const detrended = closes.map(val => val - mean);

    const cycles = [];
    const maxPeriod = Math.min(150, Math.floor(N / 2));

    for (let period = 10; period <= maxPeriod; period++) {
        let sumCos = 0, sumSin = 0;
        const freq = (2 * Math.PI) / period;
        for (let t = 0; t < N; t++) {
            sumCos += detrended[t] * Math.cos(freq * t);
            sumSin += detrended[t] * Math.sin(freq * t);
        }
        const power = (sumCos * sumCos) + (sumSin * sumSin);
        cycles.push({ period, power });
    }

    cycles.sort((a, b) => b.power - a.power);

    const macro = cycles.find(c => c.period >= 60) || cycles[0];
    const inter = cycles.find(c => c.period >= 30 && c.period < 60) || cycles[1] || cycles[0];
    const micro = cycles.find(c => c.period >= 10 && c.period < 30) || cycles[2] || cycles[0];

    const maxPower = macro.power || 1;

    return {
        macroCycle: macro.period,
        interCycle: inter.period,
        microCycle: micro.period,
        macroStr: Math.min(95, Math.floor(50 + (macro.power / maxPower) * 45)),
        interStr: Math.min(85, Math.floor(40 + (inter.power / maxPower) * 45)),
        microStr: Math.min(75, Math.floor(30 + (micro.power / maxPower) * 45))
    };
}

async function runFFT() {
    const coinInput = document.getElementById('fft-symbol').value.trim().toUpperCase();
    const tfInput = document.getElementById('fft-tf').value;
    const btn = document.getElementById('fft-btn');
    const resultsDiv = document.getElementById('fft-results');
    const dataBox = document.getElementById('fft-data');
    const consoleBox = document.getElementById('fft-console');

    if (!coinInput) {
        alert("يُرجى إدخال رمز العملة (مثال: BTC)");
        return;
    }

    const symbol = coinInput.includes('USDT') ? coinInput : coinInput + "USDT";
    btn.innerText = "جاري معالجة الترددات...";
    btn.disabled = true;

    // تهيئة الواجهة
    resultsDiv.style.display = 'block';
    dataBox.style.display = 'none';
    consoleBox.innerHTML = ''; 

    // دالة محاكاة السجل (Console)
    const addLog = async (text, color = '#ffffff', delayMs = 400) => {
        return new Promise(resolve => {
            setTimeout(() => {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
                const line = `<div style="color: ${color}; margin-bottom: 6px; border-bottom: 1px solid #111; padding-bottom: 4px;">[${timeStr}] ${text}</div>`;
                                consoleBox.insertAdjacentHTML('beforeend', line);
                consoleBox.scrollTop = consoleBox.scrollHeight;
                resolve();
            }, delayMs);
        });
    };

    try {
        await addLog('INITIATING FAST FOURIER TRANSFORM (FFT) ENGINE...', 'var(--t2)', 100);
        await addLog(`FETCHING TIME-SERIES DATA FOR ${symbol} [${tfInput}]...`, '#ffffff', 500);

        const response = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tfInput}&limit=500`);
        if (!response.ok) throw new Error("API_ERROR: UNABLE TO FETCH MARKET DATA.");
        
        await addLog('DATA FETCHED SUCCESSFULLY. PARSING ARRAYS...', 'var(--t2)', 400);

        const data = await response.json();
        const closes = data.map(candle => parseFloat(candle[4]));
        
        await addLog('APPLYING DISCRETE FOURIER TRANSFORM (DFT) ON 500 DATA POINTS...', '#ffffff', 700);
        await addLog('ISOLATING FREQUENCY DOMAINS AND AMPLITUDE PEAKS...', '#ffffff', 600);

        // التعديل: استدعاء المحرك الرياضي بدلاً من باقي القسمة
        const { macroCycle, interCycle, microCycle, macroStr, interStr, microStr } = extractDominantCycles(closes);

        const now = new Date();
        const tfHours = tfInput === '4h' ? 4 : (tfInput === '1d' ? 24 : 168);
        
        const calculateDate = (periods) => {
            const targetDate = new Date(now.getTime() + ((periods / 2) * tfHours * 60 * 60 * 1000));
            return targetDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
        };

        const macroDate = calculateDate(macroCycle);
        const interDate = calculateDate(interCycle);
        const microDate = calculateDate(microCycle);

        await addLog('FILTERING NOISE AND EXTRACTING DOMINANT CYCLES...', 'var(--t2)', 500);
        await addLog('MAPPING TIME CLUSTERS AND PROJECTING PIVOT DATES...', '#ffffff', 600);

        document.getElementById('fft-table-body').innerHTML = `
            <tr>
                <td style="color: var(--t2); padding: 12px; border-bottom: 1px solid #1a1a1a;">الدورة الكبرى (الاتجاه العام)</td>
                <td style="font-weight: 700; color: #ffffff; padding: 12px; border-bottom: 1px solid #1a1a1a;">${macroCycle} فترة</td>
                <td style="font-weight: 700; color: ${macroStr >= 70 ? 'var(--o)' : '#ffffff'}; padding: 12px; border-bottom: 1px solid #1a1a1a;">${macroStr}%</td>
                <td style="color: #ffffff; padding: 12px; border-bottom: 1px solid #1a1a1a; direction: ltr;">${macroDate}</td>
            </tr>
            <tr>
                <td style="color: var(--t2); padding: 12px; border-bottom: 1px solid #1a1a1a;">الدورة المتوسطة (الموجة الحالية)</td>
                <td style="font-weight: 700; color: #ffffff; padding: 12px; border-bottom: 1px solid #1a1a1a;">${interCycle} فترة</td>
                <td style="font-weight: 700; color: ${interStr >= 70 ? 'var(--o)' : '#ffffff'}; padding: 12px; border-bottom: 1px solid #1a1a1a;">${interStr}%</td>
                <td style="color: #ffffff; padding: 12px; border-bottom: 1px solid #1a1a1a; direction: ltr;">${interDate}</td>
            </tr>
            <tr>
                <td style="color: var(--t2); padding: 12px;">الدورة الصغرى (الذبذبة اللحظية)</td>
                <td style="font-weight: 700; color: #ffffff; padding: 12px;">${microCycle} فترة</td>
                <td style="font-weight: 700; color: ${microStr >= 70 ? 'var(--o)' : '#ffffff'}; padding: 12px;">${microStr}%</td>
                <td style="color: #ffffff; padding: 12px; direction: ltr;">${microDate}</td>
            </tr>
        `;

        const dominantCycle = macroStr >= interStr ? "الكبرى" : "المتوسطة";
        const maxStr = Math.max(macroStr, interStr);
        const timeDiff = Math.abs(interCycle - microCycle);
        
        let clusterText = timeDiff <= 15 
            ? `يُرصد توافق زمني <span style="color: var(--o); font-weight: bold;">(Time Cluster)</span> بين الدورة المتوسطة والصغرى بتاريخ [${interDate}]` 
            : `التباين الزمني واضح بين الدورات الفرعية`;

        document.getElementById('fft-conclusion-text').innerHTML = 
            `الاستنتاج الإحصائي: تسيطر الدورة <span style="color: var(--o); font-weight: bold;">${dominantCycle}</span> على المسار السعري بفعالية (${maxStr}%). ${clusterText}، مما يرفع الاحتمالية الإحصائية لتشكل نقطة انعكاس (Pivot) أو ذروة سعرية حول هذا النطاق.`;

        await addLog('ANALYSIS COMPLETE.', 'var(--o)', 500);

        setTimeout(() => {
            dataBox.style.display = 'flex';
        }, 300);

    } catch (error) {
        await addLog(error.message, 'var(--o)', 0);
    } finally {
        btn.innerText = "تحليل الدورات (FFT)";
        btn.disabled = false;
    }
}

// ==========================================
// خوارزمية مؤشر التذبذب الاتجاهي (CHOP)
// ==========================================
async function runChopAnalysis() {
    const symInput = document.getElementById('chop-sym').value.trim().toUpperCase();
    if(!symInput) return;
 
    // ضبط صيغة الرمز ليتوافق مع بينانس
    const symbol = symInput.includes('USDT') ? symInput : symInput + 'USDT';
    
    // إظهار حاوية النتائج وحالة التحميل
    document.getElementById('chop-res').style.display = 'block';
    document.getElementById('chop-val').innerText = "جاري المعالجة...";
    document.getElementById('chop-status').innerText = "---";
    document.getElementById('chop-analysis-text').innerText = "يتم الآن قراءة السيولة وحساب الإنتروبيا السعرية...";
    document.getElementById('chop-bar').style.width = "0%";
    document.getElementById('chop-pct').innerText = "0%";
    try {
        // سحب بيانات الشموع اليومية (14 فترة + شمعة سابقة لحساب الإغلاق)
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=15`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        let trueRanges = [];
        let highs = [];
        let lows = [];
        let closes = [];
        // حساب المدى الحقيقي (True Range) لكل شمعة
        for(let i = 1; i < data.length; i++) {
            let high = parseFloat(data[i][2]);
            let low = parseFloat(data[i][3]);
            let prevClose = parseFloat(data[i-1][4]);
            
            let tr1 = high - low;
            let tr2 = Math.abs(high - prevClose);
            let tr3 = Math.abs(low - prevClose);
            let tr = Math.max(tr1, tr2, tr3);
            
            trueRanges.push(tr);
            highs.push(high);
            lows.push(low);
            closes.push(parseFloat(data[i][4]));
        }
        
        // تطبيق معادلة CHOP الرياضية
        let n = 14;
        let sumTR = trueRanges.reduce((a, b) => a + b, 0);
        let maxHigh = Math.max(...highs);
        let minLow = Math.min(...lows);
                let rangeDiff = (maxHigh - minLow);
        let safeRange = rangeDiff === 0 ? 0.00000001 : rangeDiff;
        let chop = 100 * Math.log10(sumTR / safeRange) / Math.log10(n);

        chop = parseFloat(chop.toFixed(1));
        // تقريب لفاصلة عشرية واحدة
        
        // تحديد الاتجاه عبر المتوسط المتحرك البسيط (SMA)
        let currentPrice = closes[closes.length - 1];
        let sumClose = closes.reduce((a, b) => a + b, 0);
        let sma14 = sumClose / n;
        // تحديث واجهة المستخدم بالنتائج
        updateChopUI(chop, currentPrice, sma14);
    } catch(e) {
        document.getElementById('chop-val').innerText = "خطأ!";
        document.getElementById('chop-analysis-text').innerText = "تعذر جلب البيانات. تأكد من صحة رمز العملة (مثال: BTC) أو من اتصالك بالإنترنت.";
    }
}

function updateChopUI(chop, price, sma) {
    document.getElementById('chop-val').innerText = chop;
    document.getElementById('chop-pct').innerText = chop + "%";
    // ضبط عرض الشريط ليتناسب مع النسبة
    let barWidth = chop > 100 ? 100 : (chop < 0 ? 0 : chop);
    document.getElementById('chop-bar').style.width = barWidth + "%";
    
    let status = "";
    let analysis = "";
    const barElement = document.getElementById('chop-bar');
    
    // شجرة القرار لتوليد التحليل الفني ديناميكياً
    if (chop > 61.8) {
        status = "تذبذب عالي (Wait) 🟧";
        barElement.style.backgroundColor = "#ff4d4d"; // لون أحمر للتنبيه
        analysis = `تسجل القراءة الحالية لمؤشر (CHOP) مستوى ${chop}، مما يعكس هيمنة حالة من العشوائية والتذبذب العالي على الهيكل السعري. السوق يفتقر حالياً إلى مسار اتجاهي واضح ويتحرك في نطاق عرضي (Consolidation). يُنصح بالحياد المكتمل وانتظار كسر النطاقات السعرية الحالية لتأكيد تدفق السيولة في اتجاه صريح.`;
    } else if (chop < 38.2) {
        status = "اتجاه قوي (Trend) ⬜️";
        barElement.style.backgroundColor = "var(--o)"; // برتقالي للاتجاه
        if (price > sma) {
            analysis = `تسجل القراءة الحالية لمؤشر (CHOP) مستوى ${chop}، مما يشير إلى وجود زخم اتجاهي قوي ومستقر. بالدمج مع تمركز السعر أعلى المتوسطات اللحظية، يتأكد وجود مسار صاعد متماسك. الهيكل الحالي يدعم استمرارية الإيجابية السعرية ما لم تظهر انحرافات سلبية واضحة.`;
        } else {
            analysis = `تسجل القراءة الحالية لمؤشر (CHOP) مستوى ${chop}، مما يدل على سيطرة اتجاه حاد. نظراً لتداول السعر أسفل المتوسطات اللحظية، فإن هذا الزخم يدعم مساراً هابطاً صريحاً. الضغوط البيعية تتحكم في الهيكل السعري حالياً، ويُنصح بمراقبة مستويات الدعم التاريخية.`;
        }
    } else {
        status = "حركة طبيعية (Normal) ⏳";
        barElement.style.backgroundColor = "var(--o)";
        analysis = `تسجل القراءة الحالية لمؤشر (CHOP) مستوى ${chop}، مما يعكس حالة من التوازن النسبي في قوى السوق مع غياب مسار اتجاهي حاد. بالدمج مع تموضع السعر الحالي، يظهر أن الهيكل السعري يميل إلى التحرك في نطاق متوازن. يُنصح بمراقبة مناطق السيولة وانتظار كسر النطاق السعري الحالي لتأكيد الوجهة القادمة.`;
    }
    
    document.getElementById('chop-status').innerText = status;
    document.getElementById('chop-analysis-text').innerText = analysis;
}
// ==========================================
// محرك محاكاة مونت كارلو (Monte Carlo Simulation - GBM)
// ==========================================

// 1. دالة مساعدة لمعالجة المسارات الإحصائية بدون تجميد المتصفح (Non-blocking Batching)
async function runMonteCarloSim(currentPrice, drift, volatility, horizon, iterations = 5000) {
    return new Promise(resolve => {
        // استخدام Float64Array أسرع بكثير ولا يستهلك الذاكرة، مع الحفاظ على الدقة المطلقة
        const results = new Float64Array(iterations); 
        let i = 0;
        function computeBatch() {
            let end = Math.min(i + 500, iterations); // معالجة 500 مسار في كل دفعة
            for (; i < end; i++) {
                let p = currentPrice;
                for (let d = 0; d < horizon; d++) {
                    let u = 0, v = 0;
                    while(u === 0) u = Math.random();
                    while(v === 0) v = Math.random();
                    let shock = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                    p *= Math.exp(drift + volatility * shock);
                }
                results[i] = p;
            }
            if (i < iterations) {
                // إعطاء المتصفح فرصة للتنفس وتحديث الواجهة
                setTimeout(computeBatch, 0); 
            } else {
                // إرجاع المصفوفة مرتبة تصاعدياً
                resolve(Array.from(results).sort((a, b) => a - b)); 
            }
        }
        computeBatch();
    });
}

// 2. المحرك الرئيسي
async function runMonteCarlo() {
    const coinInput = document.getElementById('mcs-symbol').value.trim().toUpperCase();
    const horizon = parseInt(document.getElementById('mcs-horizon').value);
    const btn = document.getElementById('mcs-btn');
    const resultBox = document.getElementById('mcs-results');
    const dataBox = document.getElementById('mcs-data');
    const consoleBox = document.getElementById('mcs-console');

    if (!coinInput) return;

    const symbol = coinInput.includes('USDT') ? coinInput : coinInput + "USDT";
    btn.innerText = "جاري المعالجة الإحصائية...";
    btn.disabled = true;

    // تهيئة الواجهة
    resultBox.style.display = 'block';
    dataBox.style.display = 'none';
    consoleBox.innerHTML = '';

    // دالة محاكاة السجل (Console)
    const addLog = async (text, color = '#ffffff', delayMs = 400) => {
        return new Promise(resolve => {
            setTimeout(() => {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
                const line = `<div style="color: ${color}; margin-bottom: 6px; border-bottom: 1px solid #111; padding-bottom: 4px;">[${timeStr}] ${text}</div>`;
                                consoleBox.insertAdjacentHTML('beforeend', line);
                consoleBox.scrollTop = consoleBox.scrollHeight;
                resolve();
            }, delayMs);
        });
    };

    try {
        await addLog('INITIATING MONTE CARLO ENGINE (GBM)...', 'var(--t2)', 100);
        await addLog(`FETCHING HISTORICAL DATA FOR ${symbol}...`, '#ffffff', 500);

        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=1d&limit=100`);
        if (!res.ok) throw new Error("API_ERROR: UNABLE TO FETCH MARKET DATA.");
        
        await addLog('DATA FETCHED. CALCULATING LOG RETURNS AND VARIANCE...', 'var(--t2)', 400);
        const data = await res.json();
        const closes = data.map(d => parseFloat(d[4]));
        const currentPrice = closes[closes.length - 1];

        // المعالجة الإحصائية (Log Returns & Variance)
        let logReturns = [];
        for (let i = 1; i < closes.length; i++) {
            logReturns.push(Math.log(closes[i] / closes[i - 1]));
        }

        const meanReturn = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
        const variance = logReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / logReturns.length;
        const volatility = Math.sqrt(variance);
        const drift = meanReturn - (variance / 2);

        await addLog(`DRIFT: ${drift.toFixed(6)} | VOLATILITY: ${volatility.toFixed(6)}`, 'var(--o)', 400);
        await addLog(`SIMULATING 5,000 STOCHASTIC PATHS FOR ${horizon} DAYS...`, '#ffffff', 600);

        // ============================================================
        // 🚀 تشغيل المحاكاة السريعة الموزعة (تمنع تجميد المتصفح)
        // ============================================================
        const iterations = 5000;
        const simulatedPrices = await runMonteCarloSim(currentPrice, drift, volatility, horizon, iterations);

        await addLog('SIMULATION COMPLETE. EXTRACTING PERCENTILES...', 'var(--t2)', 500);

        // الفرز تم مسبقاً داخل الدالة المساعدة، نستخرج النسب والشرائح مباشرة
        const p5 = simulatedPrices[Math.floor(iterations * 0.05)];
        const p50 = simulatedPrices[Math.floor(iterations * 0.50)];
        const p95 = simulatedPrices[Math.floor(iterations * 0.95)];

        await addLog('MAPPING FINAL STRUCTURAL OUTPUT...', '#ffffff', 400);
        await addLog('ANALYSIS COMPLETE.', 'var(--o)', 600);

        // حقن المعطيات النهائية في الواجهة
        const formatPrice = (p) => p.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 4}) + ' $';
        
        document.getElementById('mcs-current-price').innerText = formatPrice(currentPrice);
        document.getElementById('mcs-p95').innerText = formatPrice(p95);
        document.getElementById('mcs-p50').innerText = formatPrice(p50);
        document.getElementById('mcs-p5').innerText = formatPrice(p5);

        // صياغة الاستنتاج التحليلي
        const range = ((p95 - p5) / currentPrice * 100).toFixed(2);
        const conclusionText = `الاستنتاج الإحصائي: بناءً على محاكاة 5,000 مسار عشوائي، يُتوقع أن يتحرك السعر خلال ${horizon} يوماً القادمة بمتوسط احتمالي يرتكز عند ${formatPrice(p50)}. أقصى مخاطرة هبوطية متوقعة (VaR 95%) تقف عند ${formatPrice(p5)}، بينما يمثل المستوى ${formatPrice(p95)} حداً علوياً تضعف احتمالية تجاوزه إحصائياً بنسبة الثقة المحددة. التذبذب الكلي يعادل ${range}% من القيمة الحالية.`;
        
        document.getElementById('mcs-conclusion-text').innerText = conclusionText;

        // العرض المرئي للنتائج
        setTimeout(() => {
            dataBox.style.display = 'flex';
        }, 300);

    } catch (e) {
        await addLog(e.message, 'var(--o)', 0);
    } finally {
        btn.innerText = "بدء المحاكاة الإحصائية";
        btn.disabled = false;
    }
}




// ==========================================
// محرك قياس الاستنفاد السعري (DeMark Sequential)
// ==========================================
async function runDeMark() {
    const coinInput = document.getElementById('td-symbol').value.trim().toUpperCase();
    const tfInput = document.getElementById('td-tf').value;
    const btn = document.getElementById('td-btn');
    const resultBox = document.getElementById('td-result');
    const dataBox = document.getElementById('td-data');
    const consoleBox = document.getElementById('td-console');

    if (!coinInput) return;

    const symbol = coinInput.includes('USDT') ? coinInput : coinInput + "USDT";
    btn.innerText = "جاري معالجة البيانات...";
    btn.disabled = true;
    
    // تهيئة الواجهة
    resultBox.style.display = 'block';
    dataBox.style.display = 'none';
    consoleBox.innerHTML = ''; 

    // دالة محاكاة السجل (Console)
    const addLog = async (text, color = '#ffffff', delayMs = 400) => {
        return new Promise(resolve => {
            setTimeout(() => {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
                const line = `<div style="color: ${color}; margin-bottom: 6px; border-bottom: 1px solid #111; padding-bottom: 4px;">[${timeStr}] ${text}</div>`;
                                consoleBox.insertAdjacentHTML('beforeend', line);
                consoleBox.scrollTop = consoleBox.scrollHeight;
                resolve();
            }, delayMs);
        });
    };

    try {
        await addLog('INITIATING DEMARK SEQUENTIAL ENGINE...', 'var(--t2)', 100);
        await addLog(`FETCHING TIME-SERIES DATA FOR ${symbol} [${tfInput}]...`, '#ffffff', 500);

        // ✅ التصحيح الأول: استدعاء البيانات عبر سيرفرك الذي يحتوي على الكاش المدمج
        const res = await fetch(`/api/binance-klines?symbol=${symbol}&interval=${tfInput}&limit=150`);
        if (!res.ok) throw new Error("تعذر جلب البيانات. تأكد من الاتصال بالخادم.");
        const data = await res.json();
        
        await addLog('DATA FETCHED SUCCESSFULLY. PARSING ARRAYS...', 'var(--t2)', 400);

        const closes = data.map(d => parseFloat(d[4]));
        const highs = data.map(d => parseFloat(d[2]));
        const lows = data.map(d => parseFloat(d[3]));
        const currentPrice = closes[closes.length - 1];

        await addLog('SCANNING SETUP PATTERNS (1-9)...', '#ffffff', 600);

        let setupUp = 0, setupDown = 0;
        let countdownUp = 0, countdownDown = 0;
        let activeSetup = 0; 
        let support = 0, resistance = 0;

        for (let i = 4; i < closes.length; i++) {
            if (closes[i] < closes[i - 4]) {
                setupDown++;
                setupUp = 0;
                if (setupDown === 9) {
                    activeSetup = 1; 
                    countdownDown = 0;
                    // ✅ حماية رياضية من الأرقام السالبة في بداية الشارت
                    const startIdx = Math.max(0, i - 8);
                    support = Math.min(...lows.slice(startIdx, i + 1));
                    if(resistance === 0) resistance = Math.max(...highs.slice(startIdx, i + 1)) * 1.05;
                }
            } else if (closes[i] > closes[i - 4]) {
                setupUp++;
                setupDown = 0;
                if (setupUp === 9) {
                    activeSetup = -1; 
                    countdownUp = 0;
                    // ✅ حماية رياضية من الأرقام السالبة في بداية الشارت
                    const startIdx = Math.max(0, i - 8);
                    resistance = Math.max(...highs.slice(startIdx, i + 1));
                    if(support === 0) support = Math.min(...lows.slice(startIdx, i + 1)) * 0.95;
                }
            } else {
                setupUp = 0;
                setupDown = 0;
            }

            // تطبيق قوانين ديمارك الصارمة بمقارنة الإغلاق بالقاع/القمة
            if (activeSetup === 1 && i >= 2 && closes[i] <= lows[i - 2]) {
                countdownDown++;
                if (countdownDown === 13) { activeSetup = 0; countdownDown = 0; }
            } else if (activeSetup === -1 && i >= 2 && closes[i] >= highs[i - 2]) {
                countdownUp++;
                if (countdownUp === 13) { activeSetup = 0; countdownUp = 0; }
            }
        }

        let currentSetup = setupUp > 0 ? setupUp : setupDown;
        let currentCount = activeSetup === -1 ? countdownUp : (activeSetup === 1 ? countdownDown : 0);

        if (support === 0 || resistance === 0 || resistance <= support) {
            support = Math.min(...lows.slice(-20));
            resistance = Math.max(...highs.slice(-20));
        }

        await addLog('EXTRACTING TDST SUPPORT & RESISTANCE LEVELS...', '#ffffff', 500);
        await addLog('CALCULATING COUNTDOWN VECTORS (1-13)...', '#ffffff', 500);
        await addLog('MAPPING FINAL STRUCTURAL OUTPUT...', 'var(--t2)', 400);
        await addLog('ANALYSIS COMPLETE.', 'var(--o)', 600);

        // حقن البيانات في البطاقات
        document.getElementById('td-current-price').innerText = currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 4}) + ' $';
        document.getElementById('td-pair-name').innerText = symbol;
        document.getElementById('td-support').innerText = support.toLocaleString('en-US', {maximumFractionDigits: 4}) + ' $';
        document.getElementById('td-resistance').innerText = resistance.toLocaleString('en-US', {maximumFractionDigits: 4}) + ' $';
        
        document.getElementById('td-setup-val').innerText = `[ ${currentSetup} / 9 ]`;
        document.getElementById('td-setup-status').innerText = currentSetup > 0 ? '(نشط)' : '(غير مفعل)';
        document.getElementById('td-setup-status').style.color = currentSetup > 0 ? 'var(--o)' : 'var(--t2)';
        
        document.getElementById('td-count-val').innerText = `[ ${currentCount} / 13 ]`;
        document.getElementById('td-count-status').innerText = currentCount > 0 ? '(نشط)' : '(غير مفعل)';
        document.getElementById('td-count-status').style.color = currentCount > 0 ? 'var(--o)' : 'var(--t2)';

        // إظهار البطاقات بعد انتهاء المحاكاة
        setTimeout(() => {
            dataBox.style.display = 'flex';
        }, 300);

    } catch (e) {
        await addLog(e.message, 'var(--o)', 0);
    } finally {
        btn.innerText = "تحليل الاستنفاد السعري (DeMark)";
        btn.disabled = false;
    }
}




// خوارزمية جلب إحصاءات الإغلاق اليومي للبيتكوين
async function loadDClose() {
    const tbody = document.getElementById('dclose-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--o)">جاري استدعاء البيانات ومعالجتها...</td></tr>';
    
    try {
         // سحب بيانات آخر 8 شمعات يومية للبيتكوين
        const res = await fetch('/api/binance-klines?symbol=BTCUSDT&interval=1d&limit=8');
        if (!res.ok) throw new Error('Network Error');
        const data = await res.json();
        
        // إجراء هندسي: حذف الشمعة الأخيرة (اليوم الحالي) لأنها لم تُغلق بعد
        data.pop();

        
        // مصفوفة أيام الأسبوع باللغة العربية
        const daysAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        let rows = "";
        
        // ترتيب البيانات من الأحدث إلى الأقدم ليظهر إغلاق الأمس أولاً
        const recentData = data.reverse();
        
        recentData.forEach(candle => {
            const timestamp = candle[0]; // وقت الشمعة
            const closePrice = parseFloat(candle[4]); // سعر الإغلاق
            
            const dateObj = new Date(timestamp);
            const dayName = daysAr[dateObj.getUTCDay()];
            const dayNum = dateObj.getUTCDate().toString().padStart(2, '0');
            const monthNum = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
            
            // التنسيق الدقيق المطلوب: مثال -> الأحد (15/03)
            const formattedDate = `${dayName} (${dayNum}/${monthNum})`;
            
            rows += `
            <tr>
                <td style="color: var(--t2); font-weight: 600; font-size: 0.9rem;">${formattedDate}</td>
                <td style="color: #ffffff; font-weight: 700; font-family: 'Share Tech Mono', monospace; font-size: 1.1rem;">
                    $${closePrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
            </tr>`;
        });
        
        tbody.innerHTML = rows;
        
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#ff4d4d">تعذر جلب البيانات، يرجى التحقق من الاتصال.</td></tr>';
    }
}
// --- محرك "نبض السوق والمشاعر" ---

async function loadSentimentDetails() {
    const historyBody = document.getElementById('sent-history-body');
    const mCapEl = document.getElementById('market-cap');
    const tVolEl = document.getElementById('trading-vol');
    const mCapChangeEl = document.getElementById('mcap-change');


    // 1. جلب بيانات الخوف والطمع التاريخية
    try {
        const fngRes = await fetch('https://api.alternative.me/fng/?limit=7');
        const fngData = await fngRes.json();
        
        let historyHtml = "";
        fngData.data.forEach((item, index) => {
            let label = "اليوم";
            if(index === 1) label = "أمس";
            if(index === 6) label = "الأسبوع الماضي";
            
            if(index === 0 || index === 1 || index === 6) {
                historyHtml += `
                <tr>
                    <td>${label}</td>
                    <td style="font-family:'Share Tech Mono'; color:var(--o)">${item.value}</td>
                    <td style="font-size:0.75rem">${item.value_classification}</td>
                </tr>`;
            }
        });
        historyBody.innerHTML = historyHtml;

        // تحديث العداد داخل الصفحة الجديدة
        const currentV = fngData.data[0].value;
        const rotateDeg = (currentV * 1.8) - 90;
        document.getElementById('sentNeedle').style.transform = `rotate(${rotateDeg}deg)`;
        document.getElementById('sentGaugeVal').innerText = currentV;
        document.getElementById('sentLabel').innerText = fngData.data[0].value_classification;

    } catch (e) { console.error("FnG Error"); }
    // 2. جلب البيانات الكلية للسوق من CoinGecko (تريليون ومليار)
    try {
        const globalRes = await fetch('https://api.coingecko.com/api/v3/global');
        const globalData = await globalRes.json();
        const d = globalData.data;

        // القيمة السوقية الكلية (Trillions)
        const totalMcap = (d.total_market_cap.usd / 1e12).toFixed(3);
        const mcapChange = d.market_cap_change_percentage_24h_usd.toFixed(2);
        
        mCapEl.innerText = totalMcap + "T US$";
        mCapChangeEl.innerText = (mcapChange >= 0 ? "▲ " : "▼ ") + mcapChange + "%";
        mCapChangeEl.style.color = "var(--o)"; 

        // حجم التداول الكلي (Billions)
        const totalVol = (d.total_volume.usd / 1e9).toFixed(2);
        tVolEl.innerText = totalVol + "B US$";

    } catch (e) {
        console.error("Global Data Error");
        mCapEl.innerText = "N/A";
        tVolEl.innerText = "N/A";
            }
}
// --- محرك إدارة المخاطر ---

// 1. نظام التبويب
function switchRiskTab(tabId, el) {
    document.querySelectorAll('.risk-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.risk-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    el.classList.add('active');
}

// 2. حاسبة حجم المركز
function setRiskPct(val, btn) {
    document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.getElementById('rs-pct').value = val;
    calcPositionSize();
}
function customRiskPct(input) {
    document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
    calcPositionSize();
}
function calcPositionSize() {
    const cap = parseFloat(document.getElementById('rs-cap').value);
    const entry = parseFloat(document.getElementById('rs-entry').value);
    const stop = parseFloat(document.getElementById('rs-stop').value);
    const pct = parseFloat(document.getElementById('rs-pct').value) / 100;
    const errEl = document.getElementById('rs-err');

    if(!cap || !entry || !stop || isNaN(pct)) return;

    if(stop >= entry) {
        errEl.style.display = "block";
        document.getElementById('rs-inv').innerText = "0.00 $";
        return;
    } else {
        errEl.style.display = "none";
    }

    const riskAmount = cap * pct;
    const riskPerCoin = entry - stop;
    const coinsToBuy = riskAmount / riskPerCoin;
    const totalInvestment = coinsToBuy * entry;

    document.getElementById('rs-inv').innerText = totalInvestment.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + " $";
    document.getElementById('rs-loss').innerText = riskAmount.toLocaleString('en-US', {minimumFractionDigits:2}) + " $";
    document.getElementById('rs-qty').innerText = coinsToBuy.toFixed(4);
}


// 4. العائد للمخاطرة R:R
function calcRR() {
    const entry = parseFloat(document.getElementById('rr-entry').value);
    const stop = parseFloat(document.getElementById('rr-stop').value);
    const target = parseFloat(document.getElementById('rr-target').value);

    if(!entry || !stop || !target || stop >= entry || target <= entry) return;

    const risk = entry - stop;
    const reward = target - entry;
    const ratio = reward / risk;
    const winRate = (1 / (1 + ratio)) * 100;

    document.getElementById('rr-ratio').innerText = "1 : " + ratio.toFixed(2);
    document.getElementById('rr-win').innerText = winRate.toFixed(1) + "%";
}

// --- محرك إدارة مخاطر الدخول الديناميكي (DCA) ---

function addDCARow() {
    const container = document.getElementById('dca-rows-container');
    const rowCount = container.children.length + 1;
    
    const row = document.createElement('div');
    row.className = 'dca-row';
    row.style.cssText = 'display:flex; gap:10px; align-items:flex-end; margin-bottom:10px;';
    
    row.innerHTML = `
        <div class="ig" style="flex:1; margin-bottom:0;"><label>سعر الدخول ${rowCount} ($)</label><input type="number" class="dca-price"></div>
        <div class="ig" style="flex:1; margin-bottom:0;"><label>المبلغ ($)</label><input type="number" class="dca-amount"></div>
        <button onclick="removeDCARow(this)" style="background:transparent; border:none; color:#ff4444; font-size:1.2rem; cursor:pointer; padding-bottom:5px; width:24px;">✖</button>
    `;
    container.appendChild(row);
    updateDCALabels();
}

function removeDCARow(btn) {
    btn.parentElement.remove();
    updateDCALabels();
}

function updateDCALabels() {
    const rows = document.querySelectorAll('.dca-row');
    rows.forEach((row, index) => {
        const label = row.querySelector('.ig label');
        label.innerText = `سعر الدخول ${index + 1} ($)`;
    });
}

function calculateDynamicDCA() {
    const prices = document.querySelectorAll('.dca-price');
    const amounts = document.querySelectorAll('.dca-amount');
    const stopPrice = parseFloat(document.getElementById('dca-global-stop').value);

    let totalMoney = 0;
    let totalCoins = 0;

    for (let i = 0; i < prices.length; i++) {
        const p = parseFloat(prices[i].value);
        const a = parseFloat(amounts[i].value);

        if (p > 0 && a > 0) {
            totalMoney += a;
            totalCoins += (a / p);
        }
    }

    if (totalCoins === 0) {
        document.getElementById('d-avg').innerText = "0.00 $";
        document.getElementById('d-total-money').innerText = "0.00 $";
        document.getElementById('d-total-coins').innerText = "0.00";
        document.getElementById('d-loss').innerText = "0.00 $";
        return;
    }

    const avgPrice = totalMoney / totalCoins;
    
    document.getElementById('d-avg').innerText = avgPrice.toFixed(4) + " $";
    document.getElementById('d-total-money').innerText = totalMoney.toFixed(2) + " $";
    document.getElementById('d-total-coins').innerText = totalCoins.toFixed(6);

    if (stopPrice > 0) {
        if (stopPrice < avgPrice) {
            const loss = totalMoney - (totalCoins * stopPrice);
            const lossPct = (loss / totalMoney) * 100;
            document.getElementById('d-loss').innerText = `-${loss.toFixed(2)} $ (-${lossPct.toFixed(2)}%)`;
        } else {
            document.getElementById('d-loss').innerText = "تنبيه: الوقف أعلى من المتوسط";
        }
    } else {
        document.getElementById('d-loss').innerText = "0.00 $";
    }
}

// --- محرك الجلسات السوقية (Market Sessions Engine) ---
function toggleSessionModal() {
    const m = document.getElementById('sessionModal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
    if(m.style.display === 'flex') updateMarketSessions();
}

function formatTimeDiff(diffInSeconds) {
    let h = Math.floor(diffInSeconds / 3600).toString().padStart(2, '0');
    let m = Math.floor((diffInSeconds % 3600) / 60).toString().padStart(2, '0');
    let s = (diffInSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateMarketSessions() {
    const now = new Date();
    const hUTC = now.getUTCHours();
    const mUTC = now.getUTCMinutes();
    const sUTC = now.getUTCSeconds();
    const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

    const clockEl = document.getElementById('live-utc-clock');
    if (clockEl) {
        clockEl.innerText = `${hUTC.toString().padStart(2,'0')}:${mUTC.toString().padStart(2,'0')}:${sUTC.toString().padStart(2,'0')}`;
    }

    const isWeekend = (day === 0 || day === 6);
    const currentSecs = hUTC * 3600 + mUTC * 60 + sUTC;

    const sessions = [
        { id: 'tokyo', name: 'طوكيو', open: 0, close: 9 },
        { id: 'london', name: 'لندن', open: 8, close: 16 },
        { id: 'ny', name: 'نيويورك', open: 13, close: 22 }
    ];

    let tbodyHtml = '';
    let activeNames = [];

    sessions.forEach(session => {
        const openSecs = session.open * 3600;
        const closeSecs = session.close * 3600;
        let status = '';
        let isActive = false;

        if (isWeekend) {
            let daysToMonday = day === 6 ? 2 : 1;
            let targetSecs = (daysToMonday * 86400) - currentSecs + openSecs;
            status = `<span style="color:#888; font-size:0.85rem;">يفتح بعد<br>${formatTimeDiff(targetSecs)}</span>`;
        } else {
            if (currentSecs >= openSecs && currentSecs < closeSecs) {
                isActive = true;
                activeNames.push(session.name);
                let left = closeSecs - currentSecs;
                status = `<span style="color:#00ff88; font-size:0.85rem;">نشط - يغلق بعد<br>${formatTimeDiff(left)}</span>`;
            } else if (currentSecs < openSecs) {
                let left = openSecs - currentSecs;
                status = `<span style="color:#aaa; font-size:0.85rem;">يفتح بعد<br>${formatTimeDiff(left)}</span>`;
            } else {
                let daysToAdd = day === 5 ? 3 : 1;
                let left = (daysToAdd * 86400) - currentSecs + openSecs;
                status = `<span style="color:#aaa; font-size:0.85rem;">يفتح بعد<br>${formatTimeDiff(left)}</span>`;
            }
        }

        tbodyHtml += `
          <tr style="border-bottom: 1px solid #222; background: ${isActive ? 'rgba(255,106,0,0.08)' : 'transparent'};">
            <td style="padding:12px; color:${isActive ? '#fff' : '#888'}; font-weight:${isActive ? 'bold' : 'normal'};">${session.name}</td>
            <td style="padding:12px; color:#aaa; font-family:monospace;">${session.open.toString().padStart(2,'0')}:00</td>
            <td style="padding:12px; color:#aaa; font-family:monospace;">${session.close.toString().padStart(2,'0')}:00</td>
            <td style="padding:12px; font-family:monospace;">${status}</td>
          </tr>
        `;
    });

    const tbody = document.getElementById('session-tbody');
    if (tbody) tbody.innerHTML = tbodyHtml;

    const btnText = document.getElementById('active-session-text');
    if (btnText) {
        if (isWeekend) {
            btnText.innerText = 'عطلة الأسواق';
        } else if (activeNames.length > 0) {
            btnText.innerText = activeNames.join(' / ');
        } else {
            btnText.innerText = 'الأسواق مغلقة';
        }
    }
}

setInterval(updateMarketSessions, 1000);
setTimeout(updateMarketSessions, 100);


// ==========================================
// محرك لوحة القيادة الماكرواقتصادية (Mining & On-Chain Dashboard)
// ==========================================
async function loadMiningData() {
    try {
        // 1. معالجة ديناميكية الإصدار والندرة
        let currentBlock = 840000;
        try {
            const blockRes = await fetch('https://mempool.space/api/blocks/tip/height');
            if (blockRes.ok) currentBlock = parseInt(await blockRes.text());
        } catch (e) { console.warn("Block Fetch Error"); }

        const nextHalvingBlock = 1050000;
        const blocksLeft = Math.max(0, nextHalvingBlock - currentBlock);
        const blocksSinceLast = currentBlock - 840000;
        const halvingPct = Math.min(100, (blocksSinceLast / 210000) * 100).toFixed(2);

        document.getElementById('mc-halving-pct').innerText = halvingPct + '%';
        document.getElementById('mc-halving-bar').style.width = halvingPct + '%';
        document.getElementById('mc-blocks-left').innerText = 'البلوكات المتبقية: ' + blocksLeft.toLocaleString('en-US');

        // 2. جلب البيانات من الخادم الوسيط (Proxy) لتجنب قيود CORS
        const ts = Date.now();
        const res = await fetch(`/api/mining-data?t=${ts}`);
            if (!res.ok) {
        console.warn('تأخر في استجابة بيانات الماكرو');
        return;
    }
        const data = await res.json();

        // 3. معالجة القوة الحوسبية وتطبيق النمذجة الرياضية للتكلفة
        const hashValues = data.hashData.values;
        const latestHash = hashValues[hashValues.length - 1].y;
        const hashEH = (latestHash / 1e6).toFixed(2);

        if (hashValues.length >= 2) {
            const prevHash = hashValues[hashValues.length - 2].y;
            const hashDiff = ((latestHash - prevHash) / prevHash * 100).toFixed(2);
            const isPositive = hashDiff >= 0;
            const hashChangeEl = document.getElementById('mc-hash-change');
            if(hashChangeEl) {
                hashChangeEl.innerText = (isPositive ? '↑ +' : '↓ ') + hashDiff + '% (24h)';
                hashChangeEl.style.color = isPositive ? '#ff6a00' : '#888888';
            }
        }

        const powerEfficiency = 28; 
        const electricityPrice = 0.06;

        const networkPowerWatts = latestHash * powerEfficiency;
        const dailyKWh = (networkPowerWatts / 1000) * 24;
        const dailyNetworkCost = dailyKWh * electricityPrice;
        const dailyBtcMinted = 144 * 3.125;
        const miningCost = dailyNetworkCost / dailyBtcMinted;
        const btcPrice = data.btcPrice;

        let profitText = '';
        let profitColor = '';
        if (btcPrice > miningCost) {
            const profitPct = (((btcPrice - miningCost) / miningCost) * 100).toFixed(1);
            profitText = 'فائض ربحي: +' + profitPct + '%';
            profitColor = '#ffffff';
        } else {
            const lossPct = (((miningCost - btcPrice) / miningCost) * 100).toFixed(1);
            profitText = 'عجز تقديري: -' + lossPct + '%';
            profitColor = '#888888';
        }

        document.getElementById('mc-cost').innerText = '$' + Math.round(miningCost).toLocaleString('en-US');
        document.getElementById('mc-profit-status').innerText = profitText;
        document.getElementById('mc-profit-status').style.color = profitColor;
        document.getElementById('mc-btc-price').innerText = '$' + btcPrice.toLocaleString('en-US', {maximumFractionDigits: 2});
        document.getElementById('mc-hashrate').innerText = hashEH + ' EH/s';

        const diffEl = document.getElementById('mc-difficulty');
        if(diffEl && data.difficulty) {
            diffEl.innerText = (parseFloat(data.difficulty) / 1e12).toFixed(2) + 'T';
        }

        // 4. تحليل أشرطة الهاش (Hash Ribbons)
        if (hashValues.length >= 60) {
            const last30 = hashValues.slice(-30).map(v => v.y);
            const last60 = hashValues.slice(-60).map(v => v.y);
            
            const sma30 = last30.reduce((a, b) => a + b, 0) / 30;
            const sma60 = last60.reduce((a, b) => a + b, 0) / 60;
            
            const ribbonsEl = document.getElementById('mc-hash-ribbons');
            if (sma30 < sma60) {
                ribbonsEl.innerText = 'استسلام (Capitulation)';
                ribbonsEl.style.color = '#ff4444'; 
            } else {
                ribbonsEl.innerText = 'تعافي وتراكم (Recovery)';
                ribbonsEl.style.color = '#ff6a00'; 
            }
        }

        // 5. قياس السيولة وازدحام الشبكة (Mempool)
        const mempoolTx = data.mempoolCount || 0;
        document.getElementById('mc-mempool-tx').innerText = mempoolTx.toLocaleString('en-US') + ' Tx';
        const memStatusEl = document.getElementById('mc-mempool-status');
        if (mempoolTx > 100000) {
            memStatusEl.innerText = 'سيولة نشطة (High Congestion)';
            memStatusEl.style.color = '#ff6a00';
        } else if (mempoolTx > 40000) {
            memStatusEl.innerText = 'نشاط شبكي مستقر';
            memStatusEl.style.color = '#ffffff';
        } else {
            memStatusEl.innerText = 'ركود شبكي (Low Demand)';
            memStatusEl.style.color = '#888888';
        }

        // تفعيل التحديث الآلي
        setTimeout(loadMiningData, 60000);

    } catch (e) {
        console.error('Macro-Dashboard Data Error:', e);
        document.getElementById('mc-cost').innerText = '---';
    }
}



// ==========================================
// محرك "رادار السيطرة والسيولة" (Macro Market Radar)
// دورة التحديث: كل 10 دقائق (لتخفيف العبء الشبكي)
// ==========================================
async function initMacroRadar() {
    const track = document.getElementById('macro-radar-track');
    if (!track) return;

    async function fetchRadarData() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/global');
            if (!response.ok) throw new Error("Network Error");
            const data = await response.json();
            const d = data.data;

            // 1. استخراج المعطيات الماكرو-اقتصادية الأولية
            const btcDominance = d.market_cap_percentage.btc || 0;
            const ethDominance = d.market_cap_percentage.eth || 0;
            const usdtDominance = d.market_cap_percentage.usdt || 0;
            const usdcDominance = d.market_cap_percentage.usdc || 0;

            // 2. معالجة بيانات القيمة الكلية وحجم التداول
            const totalMarketCap = (d.total_market_cap.usd / 1e12).toFixed(3); // بالتريليون
            const totalVolume = (d.total_volume.usd / 1e9).toFixed(2); // بالمليار
            const mcapChange = d.market_cap_change_percentage_24h_usd.toFixed(2);
            
            // 3. تحديد الاتجاه اللوني خوارزمياً
            const trendColor = mcapChange >= 0 ? 't-pos' : 't-neg';
            const trendArrow = mcapChange >= 0 ? '▲' : '▼';

            // 4. الحقن الهيكلي للبيانات (DOM Injection) مع الحفاظ على الهرمية البصرية
            const htmlStructure = `
                <div class="ticker-item-2">
                    <span class="t-lbl" style="color:var(--o)">استحواذ BTC:</span> 
                    <span class="t-val" style="color:#ffffff;">${btcDominance.toFixed(2)}%</span> 
                    <span class="t-sep" style="color:#444; margin:0 10px;">|</span>
                    
                    <span class="t-lbl" style="color:var(--o)">استحواذ ETH:</span> 
                    <span class="t-val" style="color:#ffffff;">${ethDominance.toFixed(2)}%</span>
                    <span class="t-sep" style="color:#444; margin:0 10px;">|</span>

                    <span class="t-lbl" style="color:var(--o)">استحواذ USDT:</span> 
                    <span class="t-val" style="color:#ffffff;">${usdtDominance.toFixed(2)}%</span>
                    <span class="t-sep" style="color:#444; margin:0 10px;">|</span>

                    <span class="t-lbl" style="color:var(--o)">استحواذ USDC:</span> 
                    <span class="t-val" style="color:#ffffff;">${usdcDominance.toFixed(2)}%</span>
                    <span class="t-sep" style="color:#444; margin:0 10px;">|</span>
                    
                    <span class="t-lbl" style="color:var(--o)">حجم التداول:</span> 
                    <span class="t-val" style="color:#ffffff;">${totalVolume}B $</span>
                    <span class="t-sep" style="color:#444; margin:0 10px;">|</span>

                    <span class="t-lbl" style="color:var(--o)">القيمة الكلية:</span> 
                    <span class="t-val" style="color:#ffffff;">${totalMarketCap}T $</span>
                    <span class="${trendColor}" style="margin-right:6px; font-weight:bold;">
                        (${trendArrow} ${Math.abs(mcapChange)}%)
                    </span>
                    <span class="t-sep" style="background-color: var(--o); color: #ffffff; font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 3px; margin: 0 15px; display: inline-flex; align-items: center; justify-content: center; letter-spacing: 1px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">360</span>
                </div>
            `;

            // مضاعفة الهيكل لضمان استمرارية الحركة الدائرية (Loop)
                        track.innerHTML = htmlStructure + htmlStructure;
            
            // إعادة ضبط المحرك الحركي لضمان السلاسة
            track.style.animation = 'none';
            void track.offsetWidth; // إجبار المتصفح على إعادة الحساب الهندسي
            track.style.animation = 'ticker-move-reverse 20s linear infinite';

        } catch (error) { 
            console.error("Macro Radar Fault:", error);
        }
    }

    fetchRadarData();
    // تأخير دورة المزامنة إلى 10 دقائق (600,000 مللي ثانية)
    setInterval(fetchRadarData, 600000);
}

// تشغيل المحرك تلقائياً
initMacroRadar();



// --- محرك خريطة السيولة المحدث (مع فلتر عطلة نهاية الأسبوع) ---
function updateSessionTicker() {
    const now = new Date();
    const utcDay = now.getUTCDay(); // 0 للأحد، 6 للسبت
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    
    // فلتر عطلة نهاية الأسبوع: الأسواق العالمية مغلقة السبت والأحد
    const isWeekend = (utcDay === 0 || utcDay === 6);

    // المنطق الزمني للجلسات (تعمل فقط في أيام العمل الرسمية)
    const isTokyoOpen = !isWeekend && (utcHour >= 0 && utcHour < 6);
    const isLondonOpen = !isWeekend && ((utcHour >= 8 && utcHour < 16) || (utcHour === 16 && utcMin <= 30));
    const isNYOpen = !isWeekend && (utcHour >= 13 && utcHour < 20);

    // عداد الإغلاق اليومي للبيتكوين (يعمل 24/7)
    const btcHoursLeft = 23 - utcHour;
    const btcMinsLeft = 59 - utcMin;
    const btcCloseText = `${btcHoursLeft}س و ${btcMinsLeft}د`;

    const formatStatus = (isOpen) => isOpen ? '<span class="t-pos">مفتوح</span>' : '<span class="t-neg">مغلق</span>';

    // مصفوفة البيانات المستهدفة
    const ids = ['tokyo', 'london', 'ny', 'btc-close'];
    const vals = [formatStatus(isTokyoOpen), formatStatus(isLondonOpen), formatStatus(isNYOpen), btcCloseText];

    // توزيع البيانات على النسختين (الأساسية والمكررة لضمان تدفق الحركة)
    ids.forEach((id, index) => {
        const el1 = document.getElementById(`tk-${id}`);
        const el2 = document.getElementById(`tk-${id}-2`);
        if (el1) el1.innerHTML = vals[index];
        if (el2) el2.innerHTML = vals[index];
    });
}

// ============================================================
// 🚀 محرك ORDER BOOK & LIQUIDITY SCANNER (LIVE DEPTH)
// ============================================================

async function runOrderBookScanner() {
    const coinInput = document.getElementById('obk-sym').value.trim().toUpperCase();
    const depthLimit = document.getElementById('obk-depth').value;
    const btn = document.getElementById('obk-btn');
    const loading = document.getElementById('obk-loading');
    const dash = document.getElementById('obk-dashboard');

    if (!coinInput) return;
    const symbol = coinInput.includes('USDT') ? coinInput : coinInput + 'USDT';

    btn.innerText = 'SCANNING...';
    btn.disabled = true;
    loading.style.display = 'block';
    dash.style.display = 'none';

    try {
        // 1. جلب السعر اللحظي (Ticker) لمعرفة التغير والمركز
        const tickRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        if (!tickRes.ok) throw new Error('تعذر جلب بيانات السعر.');
        const tickData = await tickRes.json();
        const currentPrice = parseFloat(tickData.lastPrice);
        const priceChg = parseFloat(tickData.priceChangePercent);

        // 2. جلب سجل الأوامر اللحظي (Order Book Depth) مستقلاً ومباشراً من بينانس
        const depthRes = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${depthLimit}`);
        if (!depthRes.ok) throw new Error('تعذر قراءة دفتر الأوامر. تأكد من الرمز.');
        const depthData = await depthRes.json();

        const fmtP = typeof window.fmtCryptoPrice === 'function' ? window.fmtCryptoPrice : (p => '$'+p.toFixed(2));
        const formatM = v => {
            if (v >= 1e9) return (v/1e9).toFixed(2)+'B';
            if (v >= 1e6) return (v/1e6).toFixed(2)+'M';
            if (v >= 1e3) return (v/1e3).toFixed(1)+'K';
            return v.toFixed(0);
        };

        // 3. خوارزمية التجميع (Clustering): تجميع الأوامر المتقاربة لكشف الجدران الحقيقية
        const processOrders = (orders, isBid) => {
            let totalUsd = 0;
            let list = orders.map(o => {
                const p = parseFloat(o[0]), q = parseFloat(o[1]), usd = p * q;
                totalUsd += usd;
                return { price: p, qty: q, usd };
            });

            // تقريب بنسبة 0.2% للم شمل الأوامر المتناثرة للحيتان
            const clusterSize = currentPrice * 0.002; 
            let clusters = [];
            list.forEach(order => {
                let added = false;
                for (let c of clusters) {
                    if (Math.abs(c.price - order.price) <= clusterSize) {
                        c.usd += order.usd;
                        c.qty += order.qty;
                        c.price = isBid ? Math.max(c.price, order.price) : Math.min(c.price, order.price);
                        added = true; break;
                    }
                }
                if (!added) clusters.push({ ...order });
            });

            clusters.sort((a,b) => b.usd - a.usd);
            // ترتيب العرض: العروض الأقرب للسعر أولاً
            let topWalls = clusters.slice(0, 10).sort((a,b) => isBid ? b.price - a.price : a.price - b.price);
            return { totalUsd, topWalls, raw: list };
        };

        const bidsData = processOrders(depthData.bids, true);  // طلبات الشراء (دعم)
        const asksData = processOrders(depthData.asks, false); // طلبات البيع (مقاومة)

        const totalLiquidity = bidsData.totalUsd + asksData.totalUsd;
        const bidsPct = totalLiquidity > 0 ? (bidsData.totalUsd / totalLiquidity) * 100 : 50;
        const asksPct = totalLiquidity > 0 ? (asksData.totalUsd / totalLiquidity) * 100 : 50;

        const domColor = bidsPct > asksPct ? '#fff' : 'var(--o)';
        const domDir = bidsPct > asksPct ? 'BUYERS CONTROL' : 'SELLERS CONTROL';

        // ================= RENDERING =================

        // 1. Ticker
        document.getElementById('obk-ticker').innerHTML = `
            <div style="background:#060606; border:1px solid #111; border-radius:4px; padding:8px 12px; display:flex; justify-content:space-between; align-items:baseline;">
                <div style="display:flex; align-items:baseline; gap:10px;">
                    <span style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.65rem; font-weight:bold;">${symbol.replace('USDT','')}</span>
                    <span style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:1.6rem; font-weight:bold; letter-spacing:1px; direction:ltr;">${fmtP(currentPrice)}</span>
                </div>
                <span style="color:${priceChg >= 0 ? '#fff' : 'var(--o)'}; font-family:'Share Tech Mono',monospace; font-size:0.85rem; font-weight:bold;">${priceChg >= 0 ? '+' : ''}${priceChg.toFixed(2)}%</span>
            </div>`;

        // 2. Power Meter (Imbalance)
        document.getElementById('obk-meter-sec').innerHTML = `
            <div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; padding:10px 12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <div style="display:flex; flex-direction:column; align-items:flex-start;">
                        <span style="color:#fff; font-size:0.5rem; font-weight:bold; font-family:'Share Tech Mono',monospace;">DEMAND (BIDS)</span>
                        <span style="color:#fff; font-size:0.7rem; font-weight:bold; font-family:'Share Tech Mono',monospace;">$${formatM(bidsData.totalUsd)}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
                        <span style="color:#444; font-size:0.4rem; font-family:'Share Tech Mono',monospace; letter-spacing:2px;">IMBALANCE</span>
                        <span style="color:${domColor}; font-size:0.6rem; font-weight:bold; font-family:'Share Tech Mono',monospace;">${domDir}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end;">
                        <span style="color:var(--o); font-size:0.5rem; font-weight:bold; font-family:'Share Tech Mono',monospace;">SUPPLY (ASKS)</span>
                        <span style="color:var(--o); font-size:0.7rem; font-weight:bold; font-family:'Share Tech Mono',monospace;">$${formatM(asksData.totalUsd)}</span>
                    </div>
                </div>
                <div style="position:relative; height:8px; background:#080808; border-radius:4px; border:1px solid #151515; overflow:hidden; display:flex;">
                    <div style="width:${bidsPct}%; height:100%; background:#fff; opacity:0.8; transition:width 1s ease;"></div>
                    <div style="width:${asksPct}%; height:100%; background:var(--o); opacity:0.8; transition:width 1s ease;"></div>
                    <div style="position:absolute; left:${bidsPct}%; top:0; bottom:0; width:2px; background:#000; transform:translateX(-50%);"></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:4px; font-family:'Share Tech Mono',monospace;">
                    <span style="color:#fff; font-size:0.55rem; font-weight:bold;">${bidsPct.toFixed(1)}%</span>
                    <span style="color:var(--o); font-size:0.55rem; font-weight:bold;">${asksPct.toFixed(1)}%</span>
                </div>
            </div>`;

        // 3. Depth Chart SVG
        const svgW = 340, mH = 100;
        let cumBids = [], bSum = 0, cumAsks = [], aSum = 0;
        
        bidsData.raw.forEach(b => { bSum += b.usd; cumBids.push({ p: b.price, v: bSum }); });
        asksData.raw.forEach(a => { aSum += a.usd; cumAsks.push({ p: a.price, v: aSum }); });
        
        const maxV = Math.max(bSum, aSum) || 1;
        const minP = cumBids[cumBids.length-1]?.p || currentPrice * 0.9;
        const maxP = cumAsks[cumAsks.length-1]?.p || currentPrice * 1.1;
        const pRange = maxP - minP || 1;
        
        const toX = p => ((p - minP) / pRange) * svgW;
        const toY = v => mH - (v / maxV) * (mH - 10);

        let bidPath = `${toX(currentPrice)},${mH} `;
        cumBids.forEach(b => { bidPath += `${toX(b.p)},${toY(b.v)} `; });
        bidPath += `${toX(minP)},${mH}`;

        let askPath = `${toX(currentPrice)},${mH} `;
        cumAsks.forEach(a => { askPath += `${toX(a.p)},${toY(a.v)} `; });
        askPath += `${toX(maxP)},${mH}`;

        document.getElementById('obk-chart-sec').innerHTML = `
            <div style="background:#060606; border:1px solid #1a1a1a; border-radius:4px; overflow:hidden; padding:4px 2px;">
                <svg width="100%" height="${mH}" viewBox="0 0 ${svgW} ${mH}" style="direction:ltr;">
                    <defs>
                        <linearGradient id="bidGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/></linearGradient>
                        <linearGradient id="askGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--o)" stop-opacity="0.05"/><stop offset="100%" stop-color="var(--o)" stop-opacity="0.3"/></linearGradient>
                    </defs>
                    <polygon points="${bidPath}" fill="url(#bidGrad)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" />
                    <polygon points="${askPath}" fill="url(#askGrad)" stroke="var(--o)" stroke-width="1.5" stroke-linejoin="round" />
                    <line x1="${toX(currentPrice)}" y1="0" x2="${toX(currentPrice)}" y2="${mH}" stroke="#555" stroke-width="1" stroke-dasharray="4 4" />
                    <rect x="${toX(currentPrice)-20}" y="2" width="40" height="12" rx="2" fill="#000" stroke="#333" stroke-width="0.5"/>
                    <text x="${toX(currentPrice)}" y="10" text-anchor="middle" fill="#ccc" font-size="5.5" font-weight="bold" font-family="Share Tech Mono">PRICE</text>
                </svg>
            </div>`;

        // 4. Tables (Walls)
        const maxBidUsd = Math.max(...bidsData.topWalls.map(w => w.usd)) || 1;
        const maxAskUsd = Math.max(...asksData.topWalls.map(w => w.usd)) || 1;

        let tablesHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">`;
        
        // Bids Table
        tablesHtml += `<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; border-top:2px solid #fff; padding:8px;">
            <div style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:0.6rem; font-weight:bold; letter-spacing:1px; margin-bottom:8px; text-align:center;">BUY WALLS (SUPPORT)</div>
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #222; padding-bottom:4px; margin-bottom:4px; font-size:0.45rem; color:#888; font-family:'Share Tech Mono',monospace;"><span>PRICE</span><span>SIZE (USDT)</span></div>`;
        bidsData.topWalls.forEach(w => {
            const dist = ((currentPrice - w.price) / currentPrice * 100).toFixed(2);
            const barW = (w.usd / maxBidUsd) * 100;
            tablesHtml += `<div class="ob-row" style="position:relative; margin-bottom:4px; padding:4px; background:#000; border-radius:2px; z-index:1;">
                <div style="position:absolute; right:0; top:0; height:100%; width:${barW}%; background:#ffffff15; border-radius:2px; z-index:-1;"></div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><div style="color:#fff; font-family:'Share Tech Mono',monospace; font-size:0.7rem; font-weight:bold; direction:ltr;">${fmtP(w.price).replace('$','')}</div><div style="font-size:0.45rem; color:#666; direction:ltr; text-align:left;">-${dist}%</div></div>
                    <div style="color:#ccc; font-family:'Share Tech Mono',monospace; font-size:0.6rem; font-weight:bold; direction:ltr;">$${formatM(w.usd)}</div>
                </div>
            </div>`;
        });
        tablesHtml += `</div>`;

        // Asks Table
        tablesHtml += `<div style="background:#0a0a0a; border:1px solid #1a1a1a; border-radius:4px; border-top:2px solid var(--o); padding:8px;">
            <div style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.6rem; font-weight:bold; letter-spacing:1px; margin-bottom:8px; text-align:center;">SELL WALLS (RESIST)</div>
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #222; padding-bottom:4px; margin-bottom:4px; font-size:0.45rem; color:#888; font-family:'Share Tech Mono',monospace;"><span>PRICE</span><span>SIZE (USDT)</span></div>`;
        asksData.topWalls.forEach(w => {
            const dist = ((w.price - currentPrice) / currentPrice * 100).toFixed(2);
            const barW = (w.usd / maxAskUsd) * 100;
            tablesHtml += `<div class="ob-row" style="position:relative; margin-bottom:4px; padding:4px; background:#000; border-radius:2px; z-index:1;">
                <div style="position:absolute; left:0; top:0; height:100%; width:${barW}%; background:rgba(255,106,0,0.15); border-radius:2px; z-index:-1;"></div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><div style="color:var(--o); font-family:'Share Tech Mono',monospace; font-size:0.7rem; font-weight:bold; direction:ltr;">${fmtP(w.price).replace('$','')}</div><div style="font-size:0.45rem; color:#666; direction:ltr; text-align:left;">+${dist}%</div></div>
                    <div style="color:#ccc; font-family:'Share Tech Mono',monospace; font-size:0.6rem; font-weight:bold; direction:ltr;">$${formatM(w.usd)}</div>
                </div>
            </div>`;
        });
        tablesHtml += `</div></div>`;
        document.getElementById('obk-tables-sec').innerHTML = tablesHtml;

        // 5. Conclusion
        let dirAr = bidsPct > asksPct + 5 ? 'للمشترين (الطلب)' : asksPct > bidsPct + 5 ? 'للبائعين (العرض)' : 'متوازن ومستقر';
        let conclusion = `من خلال فحص ${depthLimit} مستوى سعري في دفتر الأوامر اللحظي، يتبين أن الوزن المالي ${dirAr}.<br>`;
        
        const strongestBid = [...bidsData.topWalls].sort((a,b)=>b.usd - a.usd)[0];
        const strongestAsk = [...asksData.topWalls].sort((a,b)=>b.usd - a.usd)[0];

        if (strongestBid) conclusion += `أضخم جدار شرائي (دعم خفي) يتمركز عند ${fmtP(strongestBid.price)} بحجم $${formatM(strongestBid.usd)}.<br>`;
        if (strongestAsk) conclusion += `أضخم جدار بيعي (مقاومة خفية) يتمركز عند ${fmtP(strongestAsk.price)} بحجم $${formatM(strongestAsk.usd)}.<br>`;
        
        let pathOfRes = asksPct < bidsPct ? 'الصعود (مقاومة العرض أضعف)' : 'الهبوط (دعوم الطلب أضعف)';
        conclusion += `<span style="color:var(--o); font-weight:bold;">مسار المقاومة الأقل:</span> يميل نحو ${pathOfRes}.`;

        document.getElementById('obk-conclusion-sec').innerHTML = `
        <div style="background:#080808; border:1px solid #1a1a1a; border-right:3px solid ${asksPct < bidsPct ? '#fff' : 'var(--o)'}; border-radius:4px; padding:12px;">
            <div style="color:${asksPct < bidsPct ? '#fff' : 'var(--o)'}; font-family:'Share Tech Mono',monospace; font-size:0.55rem; font-weight:bold; letter-spacing:2px; margin-bottom:8px;">ORDER BOOK VERDICT</div>
            <div style="font-size:0.68rem; line-height:1.8; color:#ccc; font-family:'Cairo',sans-serif;">${conclusion}</div>
        </div>`;

        loading.style.display = 'none';
        dash.style.display = 'block';

        // Cooldown لحماية الـ API من الضغط المتكرر
        let cd = 3;
        const timer = setInterval(() => {
            btn.innerText = `COOLDOWN (${cd}s)`;
            cd--;
            if (cd < 0) {
                clearInterval(timer);
                btn.innerText = 'SCAN LIQUIDITY WALLS';
                btn.disabled = false;
            }
        }, 1000);

    } catch (e) {
        loading.innerHTML = `<div style="color:var(--o); font-family:'Cairo', sans-serif;">${e.message}</div>`;
        setTimeout(() => { btn.innerText = 'SCAN LIQUIDITY WALLS'; btn.disabled = false; }, 2000);
    }
}

/* =====================================================================
   CANDLE PATTERNS ENGINE — LEARN HUB 360
   ===================================================================== */

var cpCurrentCat = 'bull_rev';
var cpSelectedIdx = -1;

function cpSetCat(cat, btn) {
    cpCurrentCat = cat; 
    cpSelectedIdx = -1;
    var btns = document.querySelectorAll('.cp-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('cp-cat-active');
    if(btn) btn.classList.add('cp-cat-active');
    cpRender();
}

function cpSelect(idx) { cpSelectedIdx = idx; cpRender(); }
function cpBack() { cpSelectedIdx = -1; cpRender(); }

function cpInit() {
    var tabsEl = document.getElementById('cp-cat-tabs');
    if(!tabsEl) return;
    var h = '';
    var keys = Object.keys(cpData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = cpData[k];
        h += '<button class="cp-cat-btn' + (k === cpCurrentCat ? ' cp-cat-active' : '') + '" onclick="cpSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    cpRender();
}

// محرك رسم الشموع بنظام المتجهات الموحد
function cpC(x, oY, hY, lY, cY, w, bull) {
    var top = Math.min(oY, cY), bot = Math.max(oY, cY);
    // استخدام اللون البرتقالي المعتمد للمنصة var(--o)
    var c = bull ? '#ffffff' : '#ff6a00'; 
    return '<line x1="' + x + '" y1="' + hY + '" x2="' + x + '" y2="' + lY + '" stroke="' + c + '" stroke-width="1.5"/><rect x="' + (x - w / 2) + '" y="' + top + '" width="' + w + '" height="' + Math.max(1, bot - top) + '" fill="' + c + '" rx="1"/>';
}

// قاعدة البيانات التعليمية (نسخة طبق الأصل بدون أي حذف)
var cpData = {
    bull_rev: {
        label: 'انعكاسية صعودية', en: 'BULLISH REVERSAL',
        patterns: [
            { name: 'Hammer', ar: 'المطرقة', rel: 85, desc: 'شمعة بجسم صغير في الأعلى وذيل سفلي طويل يساوي 2-3 أضعاف الجسم على الأقل. تظهر حصرياً في نهاية اتجاه هابط. الذيل الطويل يكشف أن البائعين دفعوا السعر للأسفل بقوة خلال الجلسة لكن المشترين تدخلوا وأعادوه قرب الافتتاح. هذا الصراع ينتهي لصالح المشترين مما يشير إلى استنفاد الزخم الهبوطي وبداية انعكاس صعودي محتمل. التأكيد يأتي بشمعة صعودية تغلق فوق جسم المطرقة.', rules: '1. ذيل سفلي أطول من 2x الجسم\n2. ذيل علوي صغير جداً أو معدوم\n3. تظهر بعد اتجاه هابط واضح\n4. لون الجسم غير مهم لكن الأبيض أقوى\n5. حجم تداول مرتفع يعزز الإشارة\n6. تأكيد بشمعة صعودية بعدها', svg: cpC(60, 22, 10, 68, 14, 16, true) },
            { name: 'Inverted Hammer', ar: 'المطرقة المقلوبة', rel: 72, desc: 'شمعة بجسم صغير في الأسفل وذيل علوي طويل يساوي 2-3 أضعاف الجسم. تظهر بعد اتجاه هابط. تدل على أن المشترين حاولوا دفع السعر لأعلى بقوة خلال الجلسة لكنهم واجهوا مقاومة. رغم تراجع السعر المحاولة نفسها تُظهر بداية اهتمام شرائي. تحتاج تأكيد قوي — شمعة صعودية تغلق فوق جسم المطرقة المقلوبة.', rules: '1. ذيل علوي أطول من 2x الجسم\n2. ذيل سفلي صغير أو معدوم\n3. تظهر بعد اتجاه هابط\n4. تحتاج شمعة تأكيد صعودية ضرورية\n5. الفجوة الصعودية بعدها تعزز الإشارة', svg: cpC(60, 66, 12, 72, 58, 16, true) },
            { name: 'Morning Star', ar: 'نجمة الصباح', rel: 88, desc: 'نموذج قوي من 3 شموع يتشكل في قاع الاتجاه الهابط. الشمعة الأولى هابطة طويلة تؤكد سيطرة البائعين. الثانية (النجمة) صغيرة الجسم تُظهر تردد وتوازن — لحظة المعركة الحاسمة بين البائعين والمشترين. الثالثة صعودية طويلة تغلق فوق منتصف الأولى لتؤكد سيطرة المشترين الكاملة. كلما كانت الفجوة بين النجمة والشمعتين أكبر كانت الإشارة أقوى. يُعتبر من أقوى 3 أنماط انعكاسية صعودية في التحليل الفني الكلاسيكي.', rules: '1. الشمعة الأولى هابطة طويلة\n2. النجمة صغيرة الجسم (أي لون)\n3. الثالثة صعودية تغلق فوق منتصف الأولى\n4. فجوة بين الأولى والنجمة = أقوى\n5. حجم مرتفع في الثالثة يؤكد الانعكاس', svg: cpC(22, 60, 10, 66, 14, 14, false) + cpC(52, 56, 48, 66, 52, 8, true) + cpC(82, 22, 12, 60, 16, 14, true) },
            { name: 'Morning Doji Star', ar: 'نجمة الصباح دوجي', rel: 90, desc: 'نسخة أقوى من نجمة الصباح حيث الشمعة الوسطى دوجي (سعر الافتتاح يساوي سعر الإغلاق تماماً) مما يعني تردد مطلق وتوازن كامل بين القوتين. الدوجي في هذا الموقع يُعتبر نقطة التحول الحاسمة حيث استنفد البائعون كل طاقتهم ولم يعد لديهم القدرة على دفع السعر أكثر. موثوقية أعلى من نجمة الصباح العادية.', rules: '1. شمعة هابطة طويلة\n2. دوجي (افتتاح = إغلاق) بفجوة سفلية\n3. شمعة صعودية طويلة بفجوة علوية\n4. الدوجي يُظهر التوازن المطلق\n5. أقوى من نجمة الصباح العادية', svg: cpC(22, 60, 10, 66, 14, 14, false) + '<line x1="52" y1="48" x2="52" y2="66" stroke="#fff" stroke-width="1.5"/><line x1="46" y1="57" x2="58" y2="57" stroke="#fff" stroke-width="2.5"/>' + cpC(82, 22, 12, 60, 16, 14, true) },
            { name: 'Bullish Engulfing', ar: 'الابتلاع الصعودي', rel: 82, desc: 'نموذج من شمعتين حيث شمعة صعودية كبيرة تبتلع (تغطي) جسم الشمعة الهابطة السابقة بالكامل. الابتلاع يعني أن المشترين لم يكتفوا بامتصاص ضغط البيع بل تجاوزوه بقوة كبيرة. كلما كبر حجم الشمعة الابتلاعية مقارنة بالسابقة كانت الإشارة أقوى وأكثر موثوقية. الحجم المرتفع في شمعة الابتلاع يؤكد دخول المال المؤسسي وتحول حقيقي في ميزان القوى.', rules: '1. الأولى هابطة صغيرة الجسم\n2. الثانية صعودية تفتح أسفل إغلاق الأولى وتغلق فوق افتتاحها\n3. جسم الثانية يبتلع جسم الأولى بالكامل\n4. تظهر بعد اتجاه هابط واضح\n5. حجم كبير في الثانية = تأكيد مؤسسي قوي', svg: cpC(38, 50, 22, 58, 30, 14, false) + cpC(72, 20, 10, 64, 16, 20, true) },
            { name: 'Piercing Line', ar: 'خط الاختراق', rel: 75, desc: 'شمعة صعودية تفتح بفجوة أسفل إغلاق الشمعة الهابطة السابقة ثم ترتفع بقوة لتغلق فوق منتصف جسمها. الفجوة الهبوطية في البداية تُظهر استمرار حالة الخوف والبيع لكن الصعود القوي خلال الجلسة يكشف تحول جذري في المعنويات. شرط أساسي: الإغلاق فوق 50% من جسم الشمعة الأولى — أقل من ذلك لا يُعتبر خط اختراق صحيح.', rules: '1. الأولى هابطة طويلة الجسم\n2. الثانية تفتح بفجوة هبوطية تحت إغلاق الأولى\n3. تغلق فوق 50% من جسم الأولى حصرياً\n4. لا تغلق فوق الأولى بالكامل (وإلا تصبح ابتلاع)\n5. تظهر بعد اتجاه هابط واضح', svg: cpC(38, 55, 10, 60, 16, 16, false) + cpC(72, 30, 22, 66, 26, 16, true) },
            { name: 'Bullish Harami', ar: 'الحرامي الصعودي', rel: 68, desc: 'شمعة صعودية صغيرة تتشكل بالكامل داخل جسم الشمعة الهابطة الكبيرة السابقة — كأن الشمعة الكبيرة حامل بالصغيرة (ومن هنا جاء الاسم). يدل على توقف الزخم الهبوطي وبداية حالة تردد في السوق. إشارة أضعف من الابتلاع الصعودي وتحتاج تأكيد من شمعة صعودية ثالثة. الحجم المنخفض في الشمعة الصغيرة طبيعي ومتوقع.', rules: '1. الأولى هابطة طويلة الجسم\n2. الثانية صعودية صغيرة داخل جسم الأولى بالكامل\n3. لا تخرج عن حدود جسم الأولى أبداً\n4. تحتاج تأكيد بشمعة صعودية ثالثة\n5. إشارة متوسطة القوة — لا تتداول عليها وحدها', svg: cpC(42, 60, 10, 66, 16, 22, false) + cpC(70, 40, 30, 52, 36, 12, true) },
            { name: 'Tweezer Bottom', ar: 'القاع الملقطي', rel: 72, desc: 'شمعتان متتاليتان تشتركان في نفس القاع (أدنى سعر) بالضبط أو بفارق ضئيل جداً. الأولى هابطة والثانية صعودية. التطابق في القاع يُظهر مستوى دعم قوي للغاية رفض السعر مرتين متتاليتين — هذه منطقة لن يسمح فيها المشترون المؤسسيون بمزيد من الهبوط وبدأوا بالتجميع.', rules: '1. شمعتان بنفس أدنى سعر تماماً أو بفارق ضئيل\n2. الأولى هابطة والثانية صعودية\n3. تظهر في قاع اتجاه هابط واضح\n4. التطابق الدقيق في القاع = إشارة أقوى\n5. تأكيد بشمعة صعودية ثالثة يعزز الموثوقية', svg: cpC(38, 58, 18, 65, 24, 14, false) + cpC(72, 28, 18, 65, 22, 14, true) },
            { name: 'Dragonfly Doji', ar: 'دوجي اليعسوب', rel: 78, desc: 'نوع خاص من الدوجي حيث سعر الافتتاح وسعر الإغلاق وأعلى سعر كلها في نفس المستوى تقريباً مع ذيل سفلي طويل جداً. يشبه شكل حرف T. يُظهر أن البائعين سيطروا بالكامل خلال الجلسة ودفعوا السعر للأسفل بقوة لكن المشترين تدخلوا بقوة مضاعفة وأعادوا السعر بالكامل لنقطة البداية. في قاع الاتجاه الهابط يُعتبر إشارة انعكاس صعودي قوية جداً.', rules: '1. سعر الافتتاح = سعر الإغلاق = أعلى سعر تقريباً\n2. ذيل سفلي طويل جداً\n3. لا وجود لذيل علوي\n4. تظهر في قاع اتجاه هابط\n5. تأكيد بشمعة صعودية بعدها ضروري', svg: '<line x1="60" y1="20" x2="60" y2="70" stroke="#fff" stroke-width="1.5"/><line x1="50" y1="20" x2="70" y2="20" stroke="#fff" stroke-width="3"/>' },
            { name: 'Bullish Abandoned Baby', ar: 'الطفل المهجور الصعودي', rel: 92, desc: 'من أندر وأقوى أنماط الانعكاس على الإطلاق. يتكون من 3 شموع: شمعة هابطة كبيرة → دوجي بفجوة سفلية معزول تماماً لا يلمس الشمعة الأولى → شمعة صعودية كبيرة بفجوة علوية لا تلمس الدوجي. الدوجي المعزول بين فجوتين يُظهر لحظة استسلام مطلق للبائعين ثم انعكاس حاد ومفاجئ. نادر الحدوث جداً لكن عندما يظهر تكون موثوقيته شبه مطلقة.', rules: '1. شمعة هابطة كبيرة الجسم\n2. دوجي بفجوة سفلية لا يلمس ذيل الأولى أبداً\n3. شمعة صعودية كبيرة بفجوة علوية لا تلمس الدوجي\n4. الدوجي معزول تماماً بين فجوتين\n5. نادر جداً — موثوقية شبه مطلقة عند الظهور', svg: cpC(20, 52, 8, 58, 12, 12, false) + '<line x1="52" y1="62" x2="52" y2="74" stroke="#fff" stroke-width="1.5"/><line x1="47" y1="68" x2="57" y2="68" stroke="#fff" stroke-width="2.5"/>' + cpC(84, 18, 10, 56, 14, 12, true) },
            { name: 'Three Inside Up', ar: 'ثلاث شموع داخلية صعودية', rel: 76, desc: 'نموذج تأكيدي متكامل من 3 شموع يجمع بين إشارة الحرامي الصعودي والتأكيد في نموذج واحد. الأولى هابطة كبيرة. الثانية صعودية صغيرة داخل جسم الأولى (حرامي صعودي). الثالثة صعودية قوية تغلق فوق قمة الشمعة الأولى — وهي شمعة التأكيد النهائي. لا حاجة لانتظار تأكيد إضافي لأن النموذج يحتوي على التأكيد ذاتياً.', rules: '1. الأولى هابطة طويلة الجسم\n2. الثانية صعودية صغيرة داخل جسم الأولى (حرامي)\n3. الثالثة صعودية تغلق فوق قمة الشمعة الأولى\n4. الشمعة الثالثة هي التأكيد الذاتي\n5. حجم متصاعد من الثانية للثالثة = إشارة أقوى', svg: cpC(20, 54, 10, 60, 14, 14, false) + cpC(50, 36, 28, 48, 32, 10, true) + cpC(80, 10, 6, 50, 14, 14, true) },
            { name: 'Three White Soldiers', ar: 'ثلاثة جنود بيض', rel: 80, desc: 'ثلاث شموع صعودية متتالية بأجسام كبيرة ومتساوية تقريباً. كل شمعة تفتح داخل جسم الشمعة السابقة وتغلق أعلى منها. تؤكد سيطرة المشترين المطلقة واستمرار الزخم الصعودي بلا هوادة. الذيول العلوية القصيرة تدل على أن السعر يغلق قرب الأعلى في كل جلسة — لا تردد ولا ضعف. تحذير: بعد صعود طويل قد تشير إلى إرهاق شرائي بدلاً من استمرار.', rules: '1. ثلاث شموع صعودية متتالية بأجسام كبيرة\n2. كل شمعة تفتح داخل جسم الشمعة السابقة\n3. كل شمعة تغلق أعلى من سابقتها\n4. ذيول علوية قصيرة تدل على قوة الإغلاق\n5. أجسام متساوية تقريباً في الحجم', svg: cpC(22, 52, 44, 68, 48, 12, true) + cpC(50, 36, 28, 50, 32, 12, true) + cpC(78, 18, 10, 34, 14, 12, true) }
        ]
    },
    bear_rev: {
        label: 'انعكاسية هبوطية', en: 'BEARISH REVERSAL',
        patterns: [
            { name: 'Shooting Star', ar: 'الشهاب', rel: 82, desc: 'شمعة بجسم صغير في الأسفل وذيل علوي طويل جداً يساوي 2-3 أضعاف الجسم. تظهر في قمة اتجاه صاعد. المشترون دفعوا السعر لأعلى بقوة كبيرة خلال الجلسة لكن البائعين المؤسسيين رفضوا هذا المستوى بشدة وأعادوه للأسفل. الذيل الطويل هو رصاصة الرفض — إشارة بيع مؤسسية واضحة تدل على أن القمة قريبة.', rules: '1. ذيل علوي أطول من 2x الجسم\n2. جسم صغير في الأسفل\n3. ذيل سفلي صغير أو معدوم\n4. تظهر بعد اتجاه صاعد واضح\n5. لون الجسم غير مهم لكن البرتقالي أقوى', svg: cpC(60, 66, 12, 72, 58, 16, false) },
            { name: 'Hanging Man', ar: 'الرجل المشنوق', rel: 78, desc: 'شكلها مطابق للمطرقة تماماً لكن السياق مختلف جذرياً — تظهر في قمة اتجاه صاعد وليس قاعه. الذيل السفلي الطويل يدل على أن ضغط بيعي قوي ظهر خلال الجلسة لأول مرة. رغم تعافي السعر في النهاية فإن التحذير واضح: البائعون بدأوا يتدخلون بقوة وقد يسيطرون قريباً. تحتاج تأكيد بشمعة هبوطية.', rules: '1. ذيل سفلي أطول من 2x الجسم\n2. تظهر في قمة اتجاه صاعد حصرياً\n3. تحتاج تأكيد هبوطي ضروري في الشمعة التالية\n4. حجم تداول مرتفع يعزز التحذير\n5. الفجوة الهبوطية بعدها تؤكد الإشارة بقوة', svg: cpC(60, 22, 10, 68, 14, 16, false) },
            { name: 'Evening Star', ar: 'نجمة المساء', rel: 88, desc: 'عكس نجمة الصباح — نموذج من 3 شموع يتشكل في قمة الاتجاه الصاعد. الأولى صعودية كبيرة تؤكد السيطرة الشرائية. الثانية (النجمة) صغيرة الجسم بفجوة صعودية تُظهر بداية التردد. الثالثة هابطة كبيرة تغلق تحت منتصف الأولى لتؤكد انتقال السيطرة للبائعين. من أقوى إشارات الانعكاس الهبوطي المعروفة.', rules: '1. الأولى صعودية طويلة الجسم\n2. النجمة صغيرة الجسم بفجوة صعودية\n3. الثالثة هابطة تغلق تحت منتصف الأولى\n4. فجوة بين النجمة والشمعتين = إشارة أقوى\n5. حجم مرتفع في الثالثة يؤكد الانعكاس', svg: cpC(22, 60, 56, 14, 20, 14, true) + cpC(52, 18, 10, 24, 14, 8, false) + cpC(82, 22, 16, 64, 60, 14, false) },
            { name: 'Evening Doji Star', ar: 'نجمة المساء دوجي', rel: 90, desc: 'النسخة الأقوى من نجمة المساء حيث الشمعة الوسطى دوجي يُظهر تردد مطلق وحيرة كاملة في قمة الاتجاه. الانتقال من صعود قوي → تردد مطلق (دوجي) → هبوط قوي هو أوضح سيناريو للانعكاس المؤسسي. نادرة الحدوث مقارنة بالعادية لكن عند ظهورها تكون أكثر موثوقية.', rules: '1. صعودية طويلة الجسم\n2. دوجي بفجوة صعودية في القمة\n3. هابطة طويلة تغلق تحت منتصف الأولى\n4. أقوى وأكثر موثوقية من نجمة المساء العادية\n5. نادرة الحدوث — قيمة تحليلية عالية جداً', svg: cpC(22, 60, 56, 14, 20, 14, true) + '<line x1="52" y1="8" x2="52" y2="24" stroke="#ff6a00" stroke-width="1.5"/><line x1="46" y1="14" x2="58" y2="14" stroke="#ff6a00" stroke-width="2.5"/>' + cpC(82, 22, 16, 64, 60, 14, false) },
            { name: 'Bearish Engulfing', ar: 'الابتلاع الهبوطي', rel: 82, desc: 'شمعة هابطة كبيرة تبتلع جسم الشمعة الصعودية السابقة بالكامل. البائعون لم يمتصوا ضغط الشراء فقط بل سحقوه تماماً. كلما كبر حجم الابتلاع وارتفع حجم التداول كانت الإشارة أكثر حسماً. في القمم الرئيسية يُعتبر من أقوى إشارات البيع المؤسسية.', rules: '1. الأولى صعودية صغيرة الجسم\n2. الثانية هابطة تفتح فوق إغلاق الأولى وتغلق تحت افتتاحها\n3. جسم الثانية يبتلع جسم الأولى بالكامل\n4. تظهر في قمة اتجاه صاعد\n5. حجم كبير في الثانية = تأكيد مؤسسي', svg: cpC(38, 32, 22, 50, 28, 14, true) + cpC(72, 16, 10, 60, 56, 20, false) },
            { name: 'Dark Cloud Cover', ar: 'السحابة الداكنة', rel: 75, desc: 'عكس خط الاختراق. شمعة هابطة تفتح بفجوة فوق إغلاق الشمعة الصعودية السابقة ثم تهبط بقوة وتغلق تحت منتصف جسمها. الفجوة الصعودية في البداية أوحت باستمرار الصعود لكن الانعكاس الحاد خلال الجلسة يكشف أن المشترين وقعوا في فخ وأن البائعين سيطروا.', rules: '1. الأولى صعودية طويلة الجسم\n2. الثانية تفتح بفجوة صعودية فوق إغلاق الأولى\n3. تغلق تحت 50% من جسم الأولى حصرياً\n4. لا تغلق تحت الأولى بالكامل (وإلا تصبح ابتلاع)\n5. تظهر في قمة اتجاه صاعد واضح', svg: cpC(38, 56, 52, 16, 20, 16, true) + cpC(72, 20, 14, 60, 56, 16, false) },
            { name: 'Bearish Harami', ar: 'الحرامي الهبوطي', rel: 68, desc: 'شمعة هابطة صغيرة تتشكل داخل جسم الشمعة الصعودية الكبيرة السابقة. تدل على تباطؤ الزخم الصعودي وبداية حالة تردد في السوق. إشارة تحذيرية وليست حاسمة — تحتاج تأكيد من شمعة هبوطية ثالثة قوية لتأكيد الانعكاس.', rules: '1. الأولى صعودية طويلة الجسم\n2. الثانية هابطة صغيرة داخل جسم الأولى بالكامل\n3. لا تخرج عن حدود جسم الأولى\n4. تحتاج تأكيد بشمعة هبوطية ثالثة\n5. إشارة متوسطة القوة — لا تتداول عليها وحدها', svg: cpC(42, 58, 54, 14, 18, 22, true) + cpC(70, 42, 28, 50, 34, 12, false) },
            { name: 'Tweezer Top', ar: 'القمة الملقطية', rel: 72, desc: 'شمعتان متتاليتان تشتركان في نفس القمة (أعلى سعر) بالضبط. الأولى صعودية والثانية هابطة. التطابق في القمة يكشف عن مقاومة قوية جداً رفضت السعر مرتين متتاليتين — سقف حديدي لن يسمح البائعون المؤسسيون بتجاوزه.', rules: '1. شمعتان بنفس أعلى سعر تماماً أو بفارق ضئيل\n2. الأولى صعودية والثانية هابطة\n3. تظهر في قمة اتجاه صاعد\n4. التطابق الدقيق في القمة = إشارة أقوى\n5. تأكيد بشمعة هبوطية ثالثة يعزز الموثوقية', svg: cpC(38, 52, 15, 60, 20, 14, true) + cpC(72, 56, 15, 62, 52, 14, false) },
            { name: 'Gravestone Doji', ar: 'دوجي شاهد القبر', rel: 78, desc: 'نوع خاص من الدوجي حيث سعر الافتتاح وسعر الإغلاق وأدنى سعر كلها في نفس المستوى تقريباً مع ذيل علوي طويل جداً. يشبه حرف T مقلوب أو شاهد القبر. يُظهر رفض كامل ونهائي للأسعار المرتفعة — المشترون حاولوا لكن البائعين أعادوهم بالكامل. في قمة الاتجاه الصاعد يُعتبر إشارة بيع قوية.', rules: '1. سعر الافتتاح = سعر الإغلاق = أدنى سعر تقريباً\n2. ذيل علوي طويل جداً\n3. لا وجود لذيل سفلي\n4. تظهر في قمة اتجاه صاعد\n5. تأكيد بشمعة هبوطية بعدها', svg: '<line x1="60" y1="12" x2="60" y2="62" stroke="#ff6a00" stroke-width="1.5"/><line x1="50" y1="62" x2="70" y2="62" stroke="#ff6a00" stroke-width="3"/>' },
            { name: 'Bearish Abandoned Baby', ar: 'الطفل المهجور الهبوطي', rel: 92, desc: 'عكس النسخة الصعودية — من أندر الأنماط وأكثرها موثوقية لتأكيد انعكاس القمة. صعودية كبيرة → دوجي معزول بفجوة صعودية لا يلمس الشمعة الأولى → هابطة كبيرة بفجوة هبوطية لا تلمس الدوجي. العزل الكامل للدوجي بين فجوتين يُظهر ذروة الشراء المطلقة ثم الانهيار.', rules: '1. صعودية كبيرة الجسم\n2. دوجي بفجوة صعودية معزول تماماً\n3. هابطة كبيرة بفجوة هبوطية\n4. الدوجي لا يلمس ذيل أي من الشمعتين\n5. نادر جداً — موثوقية شبه مطلقة', svg: cpC(20, 52, 48, 12, 16, 12, true) + '<line x1="52" y1="6" x2="52" y2="18" stroke="#ff6a00" stroke-width="1.5"/><line x1="47" y1="12" x2="57" y2="12" stroke="#ff6a00" stroke-width="2.5"/>' + cpC(84, 22, 18, 62, 58, 12, false) },
            { name: 'Three Inside Down', ar: 'ثلاث شموع داخلية هبوطية', rel: 76, desc: 'عكس Three Inside Up. نموذج تأكيدي من 3 شموع. صعودية كبيرة → هابطة صغيرة داخلها (حرامي هبوطي) → هابطة قوية تغلق تحت قاع الأولى. يجمع بين إشارة الحرامي والتأكيد في نموذج واحد متكامل ذاتياً.', rules: '1. الأولى صعودية طويلة الجسم\n2. الثانية هابطة صغيرة داخل جسم الأولى\n3. الثالثة هابطة تغلق تحت قاع الشمعة الأولى\n4. الشمعة الثالثة هي التأكيد\n5. حجم متصاعد في الثالثة = إشارة أقوى', svg: cpC(20, 58, 54, 14, 18, 14, true) + cpC(50, 42, 30, 48, 36, 10, false) + cpC(80, 22, 16, 66, 62, 14, false) },
            { name: 'Three Black Crows', ar: 'ثلاثة غربان سود', rel: 80, desc: 'عكس ثلاثة جنود بيض. ثلاث شموع هابطة كبيرة متتالية بأجسام متساوية تقريباً. كل شمعة تفتح داخل جسم السابقة وتغلق أدنى منها. هيمنة مطلقة للبائعين بلا أي مقاومة. تحذير: بعد هبوط طويل قد تشير إلى ذروة بيع وإرهاق بائعين بدلاً من استمرار.', rules: '1. ثلاث هابطة متتالية بأجسام كبيرة\n2. كل شمعة تفتح داخل جسم السابقة\n3. كل شمعة تغلق أدنى من سابقتها\n4. ذيول سفلية قصيرة تدل على قوة الإغلاق\n5. أجسام متساوية تقريباً في الحجم', svg: cpC(22, 14, 8, 38, 34, 12, false) + cpC(50, 30, 26, 54, 50, 12, false) + cpC(78, 48, 44, 68, 64, 12, false) }
        ]
    },
    neutral: {
        label: 'محايدة واستمرارية', en: 'NEUTRAL / CONTINUATION',
        patterns: [
            { name: 'Doji', ar: 'الدوجي', rel: 65, desc: 'شمعة يتساوى فيها سعر الافتتاح مع سعر الإغلاق تماماً أو بفارق ضئيل جداً مما ينتج عنها جسم رفيع جداً أو خط. تمثل حالة توازن كامل بين المشترين والبائعين — لا أحد يسيطر. لا تعطي اتجاه بنفسها أبداً — الشمعة التالية هي التي تحدد المسار. في قمة اتجاه صاعد = تحذير هبوطي. في قاع اتجاه هابط = تحذير صعودي. في منتصف الاتجاه = استراحة مؤقتة.', rules: '1. جسم صغير جداً أو معدوم (افتتاح = إغلاق)\n2. ذيول علوية وسفلية بأطوال متفاوتة\n3. السياق يحدد المعنى — ليست إشارة مستقلة\n4. تحتاج تأكيد من الشمعة التالية دائماً\n5. حجم تداول مرتفع يزيد أهمية الإشارة', svg: '<line x1="60" y1="14" x2="60" y2="66" stroke="#fff" stroke-width="1.5"/><line x1="50" y1="40" x2="70" y2="40" stroke="#fff" stroke-width="3"/>' },
            { name: 'Long-Legged Doji', ar: 'دوجي طويل الأرجل', rel: 60, desc: 'نوع خاص من الدوجي يتميز بذيول علوية وسفلية طويلة جداً من الجانبين. يُظهر حالة صراع عنيف جداً بين المشترين والبائعين — السعر تحرك بقوة في الاتجاهين لكنه أغلق عند نقطة الافتتاح. معركة عنيفة بنتيجة صفرية. إشارة تحول أقوى من الدوجي العادي خاصة في القمم والقيعان.', rules: '1. ذيول طويلة جداً من الجانبين\n2. جسم معدوم أو شبه معدوم\n3. يدل على صراع عنيف بنتيجة متعادلة\n4. أقوى من الدوجي العادي كإشارة تحول\n5. في القمم والقيعان = احتمال انعكاس عالي', svg: '<line x1="60" y1="6" x2="60" y2="74" stroke="#fff" stroke-width="1.5"/><line x1="50" y1="40" x2="70" y2="40" stroke="#fff" stroke-width="3"/>' },
            { name: 'Spinning Top', ar: 'القمة الدوارة', rel: 55, desc: 'شمعة بجسم صغير مع ذيول علوية وسفلية. مشابهة للدوجي لكن بجسم أكبر قليلاً. تعكس حالة تردد وعدم يقين في السوق دون حسم واضح لأي طرف. ليست إشارة تداول بنفسها — فقط تحذير بأن الاتجاه الحالي يفقد زخمه ويحتاج مراقبة. اللون غير مهم.', rules: '1. جسم صغير (أكبر قليلاً من الدوجي)\n2. ذيول من الجانبين بأطوال مختلفة\n3. لون الجسم غير مهم للتفسير\n4. إشارة تحوارية وليست حاسمة أبداً\n5. تحتاج سياق وتأكيد من الشموع التالية', svg: cpC(60, 44, 14, 66, 36, 12, true) },
            { name: 'Marubozu Bullish', ar: 'ماروبوزو صعودي', rel: 78, desc: 'شمعة صعودية بدون أي ذيول نهائياً — سعر الافتتاح هو أدنى سعر وسعر الإغلاق هو أعلى سعر. تمثل سيطرة مشترين مطلقة وكاملة من أول ثانية في الجلسة لآخرها بدون أي تنازل أو تراجع. أقوى شمعة صعودية ممكنة نظرياً. تُظهر ثقة كاملة في الاتجاه الصعودي.', rules: '1. لا وجود لذيل علوي ولا سفلي إطلاقاً\n2. سعر الافتتاح = أدنى سعر في الجلسة\n3. سعر الإغلاق = أعلى سعر في الجلسة\n4. جسم كبير وطويل\n5. حجم تداول مرتفع يؤكد قوة الحركة', svg: '<rect x="48" y="12" width="24" height="56" fill="#fff" rx="1"/>' },
            { name: 'Marubozu Bearish', ar: 'ماروبوزو هبوطي', rel: 78, desc: 'عكس الماروبوزو الصعودي — شمعة هابطة بدون أي ذيول. سعر الافتتاح هو أعلى سعر وسعر الإغلاق هو أدنى سعر. سيطرة بائعين مطلقة وكاملة من البداية للنهاية. أقوى شمعة هبوطية ممكنة.', rules: '1. لا وجود لأي ذيول\n2. سعر الافتتاح = أعلى سعر\n3. سعر الإغلاق = أدنى سعر\n4. جسم كبير وطويل\n5. حجم تداول مرتفع', svg: '<rect x="48" y="12" width="24" height="56" fill="#ff6a00" rx="1"/>' },
            { name: 'Rising Three Methods', ar: 'ثلاث طرق صاعدة', rel: 74, desc: 'نموذج استمراري صعودي من 5 شموع. تبدأ بشمعة صعودية كبيرة تليها 3 شموع هابطة صغيرة متتالية تتشكل داخل نطاق الشمعة الأولى (تصحيح داخلي) ثم تنتهي بشمعة صعودية كبيرة تغلق فوق الأولى. الشموع الصغيرة مجرد استراحة طبيعية وصحية — الاتجاه الصاعد يستمر بقوة.', rules: '1. شمعة صعودية كبيرة الجسم\n2. 3 شموع صغيرة هابطة متتالية داخل نطاقها\n3. الشمعة الخامسة صعودية كبيرة تغلق فوق الأولى\n4. الحجم يتناقص في الشموع الصغيرة ويرتفع بقوة في الخامسة', svg: cpC(14, 48, 44, 12, 16, 10, true) + cpC(30, 24, 20, 36, 32, 6, false) + cpC(42, 30, 26, 42, 38, 6, false) + cpC(54, 36, 32, 48, 44, 6, false) + cpC(74, 8, 4, 46, 12, 10, true) },
            { name: 'Falling Three Methods', ar: 'ثلاث طرق هابطة', rel: 74, desc: 'عكس النموذج الصاعد — استمراري هبوطي من 5 شموع. هابطة كبيرة → 3 صعودية صغيرة داخل نطاقها → هابطة كبيرة تغلق تحت الأولى. الشموع الصغيرة ارتداد مؤقت — الاتجاه الهابط يستمر.', rules: '1. شمعة هابطة كبيرة\n2. 3 شموع صعودية صغيرة داخل نطاقها\n3. الخامسة هابطة كبيرة تغلق تحت الأولى\n4. حجم مرتفع في الشمعة الخامسة يؤكد الاستمرار', svg: cpC(14, 12, 8, 60, 56, 10, false) + cpC(30, 44, 40, 30, 34, 6, true) + cpC(42, 38, 34, 24, 28, 6, true) + cpC(54, 32, 28, 18, 22, 6, true) + cpC(74, 16, 10, 68, 64, 10, false) },
            { name: 'Tasuki Gap Up', ar: 'فجوة تاسوكي الصعودية', rel: 68, desc: 'نموذج استمراري صعودي من 3 شموع. شمعتان صعوديتان بفجوة بينهما تليهما شمعة هابطة تفتح داخل الثانية لكن لا تغلق الفجوة الأصلية. بقاء الفجوة مفتوحة يؤكد قوة الزخم الصعودي — المشترون لا يسمحون بإغلاقها.', rules: '1. شمعتان صعوديتان متتاليتان بفجوة صعودية\n2. شمعة هابطة ثالثة تفتح داخل الثانية\n3. الهابطة لا تغلق الفجوة بين الأولى والثانية\n4. بقاء الفجوة مفتوحة = تأكيد استمراري صعودي', svg: cpC(24, 52, 48, 20, 24, 12, true) + cpC(52, 16, 10, 38, 20, 12, true) + cpC(80, 24, 18, 44, 40, 12, false) }
        ]
    }
};

function cpRender() {
    var cat = cpData[cpCurrentCat];
    if (!cat) return;
    var el = document.getElementById('cp-content');
    if (!el) return;
    if (cpSelectedIdx >= 0 && cpSelectedIdx < cat.patterns.length) {
        el.innerHTML = cpRenderDetail(cat.patterns[cpSelectedIdx]);
        return;
    }
    var h = '<div class="cp-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        var isBear = cpCurrentCat === 'bear_rev';
        var topC = isBear ? '#ff6a00' : cpCurrentCat === 'neutral' ? '#888' : '#fff';
        h += '<div class="cp-card" style="border-top:3px solid ' + topC + '" onclick="cpSelect(' + i + ')">';
        h += '<div class="cp-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%"><rect width="120" height="80" fill="#000"/>' + p.svg + '</svg></div>';
        h += '<div class="cp-card-name">' + p.name + '</div>';
        h += '<div class="cp-card-ar">' + p.ar + '</div>';
        h += '<div class="cp-card-rel-row"><span class="cp-card-rel-l">RELIABILITY</span><span class="cp-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="cp-card-bar"><div class="cp-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="cp-footer">هذه الموسوعة مرجع تعليمي شامل لأنماط الشموع اليابانية. الأنماط لا تضمن نتائج بمفردها — استخدمها دائماً مع أدوات التحليل الأخرى والسياق العام للسوق. لا تعتمد على نمط واحد فقط في قرارات التداول. SPOT ONLY — تحليل مرجعي تعليمي وليس نصيحة مالية أو استثمارية.</div>';
    el.innerHTML = h;
}

function cpRenderDetail(p) {
    var h = '<div class="cp-back" onclick="cpBack()">رجوع</div>';
    h += '<div class="cp-detail">';
    h += '<div class="cp-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%"><rect width="120" height="80" fill="#000"/>' + p.svg + '</svg></div>';
    h += '<div class="cp-detail-name">' + p.name + '</div>';
    h += '<div class="cp-detail-ar">' + p.ar + '</div>';
    h += '<div class="cp-detail-rel-row"><span class="cp-detail-rel-l">RELIABILITY</span><span class="cp-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
    h += '<div class="cp-detail-bar"><div class="cp-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    h += '<div class="cp-detail-desc-wrap"><div class="cp-detail-desc-label">DESCRIPTION // الوصف والتفسير</div><div class="cp-detail-desc">' + p.desc + '</div></div>';
    h += '<div class="cp-detail-rules-wrap"><div class="cp-detail-rules-label">RULES // الشروط والقواعد</div>';
    var rules = p.rules.split('\n');
    for (var i = 0; i < rules.length; i++) {
        h += '<div class="cp-rule-row"><span class="cp-rule-num">' + rules[i].substring(0, 2) + '</span><span class="cp-rule-text">' + rules[i].substring(3) + '</span></div>';
    }
    h += '</div></div>';
    return h;
}

/* =====================================================================
   CHART PATTERNS ENGINE — LEARN HUB 360
   ===================================================================== */

var chCurrentCat = 'ch_rev';
var chSelectedIdx = -1;

function chSetCat(cat, btn) {
    chCurrentCat = cat;
    chSelectedIdx = -1;
    var btns = document.querySelectorAll('.ch-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('ch-cat-active');
    if (btn) btn.classList.add('ch-cat-active');
    chRender();
}

function chSelect(idx) { chSelectedIdx = idx; chRender(); }
function chBack() { chSelectedIdx = -1; chRender(); }

function chInit() {
    var tabsEl = document.getElementById('ch-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var keys = Object.keys(chData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = chData[k];
        h += '<button class="ch-cat-btn' + (k === chCurrentCat ? ' ch-cat-active' : '') + '" onclick="chSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    chRender();
}

// قاعدة البيانات التعليمية الكاملة (بدون أي اختصار)
var chData = {
    ch_rev: {
        label: 'نماذج انعكاسية', en: 'REVERSAL PATTERNS',
        patterns: [
            { name: 'Head & Shoulders', ar: 'الرأس والكتفين', rel: 85, type: 'BEARISH REVERSAL', desc: 'من أشهر وأقوى النماذج الانعكاسية في التحليل الفني الكلاسيكي. يتكون من 3 قمم متتالية: كتف أيسر (قمة أولى) → رأس (قمة أعلى من الكتفين) → كتف أيمن (قمة أدنى من الرأس). خط العنق (Neckline) يربط بين القاعين بين الكتفين. يتشكل عادة بعد اتجاه صاعد قوي ويُظهر فشل المشترين في الحفاظ على قمم أعلى. كسر خط العنق بحجم تداول مرتفع يؤكد الانعكاس الهبوطي. الهدف السعري يُحسب بطرح المسافة بين الرأس وخط العنق من نقطة الكسر. الحجم عادة يتناقص تدريجياً من الكتف الأيسر للأيمن مما يكشف ضعف الزخم الصعودي.', rules: '1. كتف أيسر → رأس أعلى منه → كتف أيمن أدنى من الرأس\n2. خط العنق يربط القاعين بين الكتفين (قد يكون مائلاً)\n3. كسر خط العنق بحجم مرتفع = تأكيد الانعكاس\n4. الهدف = المسافة بين الرأس وخط العنق مطروحة من نقطة الكسر\n5. إعادة اختبار خط العنق من الأسفل شائعة (Throwback)\n6. الحجم يتناقص تدريجياً من الكتف الأيسر للأيمن', svg: '<polyline points="6,62 24,30 36,52 60,10 78,52 90,30 114,62" fill="none" stroke="#fff" stroke-width="2.5"/><line x1="36" y1="52" x2="78" y2="52" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="4,3"/><text x="60" y="8" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono">HEAD</text><text x="24" y="28" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">LS</text><text x="90" y="28" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">RS</text>' },
            { name: 'Inverse Head & Shoulders', ar: 'الرأس والكتفين المقلوب', rel: 85, type: 'BULLISH REVERSAL', desc: 'النسخة المعكوسة من الرأس والكتفين — يتشكل في قاع الاتجاه الهابط ويُشير إلى انعكاس صعودي قوي. يتكون من 3 قيعان: كتف أيسر (قاع) → رأس (قاع أعمق) → كتف أيمن (قاع أعلى من الرأس). خط العنق يربط القمتين بين القيعان. كسر خط العنق لأعلى بحجم مرتفع يؤكد الانعكاس الصعودي. الحجم عادة يرتفع بقوة عند كسر خط العنق — هذا الارتفاع ضروري لتأكيد الإشارة. نفس قواعد حساب الهدف مطبقة بالعكس.', rules: '1. كتف أيسر → رأس أعمق منه → كتف أيمن أعلى من الرأس\n2. خط العنق يربط القمتين بين القيعان\n3. كسر خط العنق لأعلى بحجم مرتفع = تأكيد\n4. الهدف = المسافة بين الرأس وخط العنق مُضافة لنقطة الكسر\n5. إعادة اختبار خط العنق من الأعلى شائعة (Pullback)\n6. ارتفاع الحجم عند الكسر ضروري للتأكيد', svg: '<polyline points="6,18 24,50 36,28 60,72 78,28 90,50 114,18" fill="none" stroke="#fff" stroke-width="2.5"/><line x1="36" y1="28" x2="78" y2="28" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="4,3"/><text x="60" y="76" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono">HEAD</text>' },
            { name: 'Double Top', ar: 'القمة المزدوجة', rel: 80, type: 'BEARISH REVERSAL', desc: 'نموذج انعكاسي هبوطي يتشكل عندما يصل السعر لنفس مستوى المقاومة مرتين ويفشل في اختراقه في المرة الثانية — مما يُشكّل حرف M. القمة الثانية الفاشلة تُظهر أن المشترين استنفدوا قوتهم ولم يعودوا قادرين على دفع السعر أعلى. كسر خط العنق (القاع بين القمتين) يؤكد الانعكاس الهبوطي. الهدف يساوي المسافة بين القمة وخط العنق. القمة الثانية بحجم تداول أقل من الأولى تعزز الإشارة لأنها تكشف ضعف الاهتمام الشرائي.', rules: '1. قمتان بنفس المستوى تقريباً (فارق لا يتجاوز 3%)\n2. قاع بينهما يُشكّل خط العنق\n3. كسر خط العنق بحجم = تأكيد هبوطي\n4. الهدف = عمق النموذج (المسافة بين القمة وخط العنق)\n5. القمة الثانية بحجم أقل = إشارة أقوى\n6. المسافة الزمنية بين القمتين مهمة — كلما زادت كان أقوى', svg: '<polyline points="8,62 30,16 54,44 78,16 108,68" fill="none" stroke="#ff6a00" stroke-width="2.5"/><line x1="20" y1="44" x2="90" y2="44" stroke="#ff6a00" stroke-width="1" stroke-dasharray="4,3"/><text x="54" y="41" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">NECKLINE</text>' },
            { name: 'Double Bottom', ar: 'القاع المزدوج', rel: 80, type: 'BULLISH REVERSAL', desc: 'عكس القمة المزدوجة — يتشكل عندما يصل السعر لنفس مستوى الدعم مرتين ويرتد منه في المرة الثانية — مما يُشكّل حرف W. القاع الثاني الناجح يُظهر أن البائعين فشلوا في كسر هذا المستوى وأن المشترين يدافعون بقوة. كسر خط العنق (القمة بين القاعين) لأعلى يؤكد الانعكاس الصعودي. الهدف يساوي عمق النموذج مُضافاً لنقطة الكسر.', rules: '1. قاعان بنفس المستوى تقريباً (فارق لا يتجاوز 3%)\n2. قمة بينهما يُشكّل خط العنق\n3. كسر خط العنق لأعلى بحجم = تأكيد صعودي\n4. الهدف = عمق النموذج مُضاف لنقطة الكسر\n5. القاع الثاني بحجم أقل = إشارة أقوى\n6. Pullback لخط العنق بعد الكسر شائع', svg: '<polyline points="8,18 30,64 54,36 78,64 108,12" fill="none" stroke="#fff" stroke-width="2.5"/><line x1="20" y1="36" x2="90" y2="36" stroke="#ff6a00" stroke-width="1" stroke-dasharray="4,3"/><text x="54" y="33" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">NECKLINE</text>' },
            { name: 'Triple Top', ar: 'القمة الثلاثية', rel: 82, type: 'BEARISH REVERSAL', desc: 'نسخة أقوى من القمة المزدوجة — السعر يصل لنفس مستوى المقاومة 3 مرات ويفشل في كل مرة. ثلاث محاولات فاشلة تُظهر مقاومة حديدية لا يستطيع المشترون اختراقها. كسر الدعم (أدنى قاع بين القمم) يؤكد هبوط قوي. أقوى من القمة المزدوجة لأن الفشل تكرر 3 مرات بدلاً من مرتين.', rules: '1. ثلاث قمم متساوية تقريباً في نفس المنطقة\n2. قاعان بين القمم الثلاث\n3. كسر أدنى القاعين = تأكيد هبوطي قوي\n4. الهدف = ارتفاع النموذج (من القمة لأدنى قاع)\n5. أقوى من القمة المزدوجة في الموثوقية\n6. الحجم يتناقص مع كل قمة', svg: '<polyline points="4,58 18,16 28,42 44,16 56,42 72,16 86,42 108,62" fill="none" stroke="#ff6a00" stroke-width="2"/><line x1="14" y1="42" x2="96" y2="42" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/>' },
            { name: 'Triple Bottom', ar: 'القاع الثلاثي', rel: 82, type: 'BULLISH REVERSAL', desc: 'عكس القمة الثلاثية — 3 قيعان بنفس المستوى تُظهر دعم قوي جداً لا يستطيع البائعون كسره. كسر المقاومة (أعلى قمة بين القيعان) يؤكد صعود قوي. أقوى من القاع المزدوج.', rules: '1. ثلاث قيعان متساوية تقريباً\n2. قمتان بين القيعان الثلاث\n3. كسر أعلى القمتين لأعلى = تأكيد صعودي قوي\n4. الهدف = عمق النموذج مُضاف لنقطة الكسر\n5. أقوى من القاع المزدوج\n6. الحجم يرتفع عند الكسر', svg: '<polyline points="4,22 18,64 28,38 44,64 56,38 72,64 86,38 108,18" fill="none" stroke="#fff" stroke-width="2"/><line x1="14" y1="38" x2="96" y2="38" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/>' },
            { name: 'Cup & Handle', ar: 'الكوب والعروة', rel: 80, type: 'BULLISH REVERSAL', desc: "نموذج صعودي كلاسيكي قوي يشبه شكل فنجان القهوة بمقبضه. يبدأ بهبوط تدريجي ثم قاع مستدير (الكوب) يُظهر تجميع مؤسسي بطيء ومنظم ثم صعود تدريجي يليه تصحيح خفيف (العروة — Handle) قبل الانطلاق النهائي. الكوب يجب أن يكون مستديراً وليس حاداً على شكل V. العروة هي الاستراحة الأخيرة قبل الصعود — تصحيح يتراوح بين 30-50% من ارتفاع الكوب. كسر حافة الكوب العليا (المقاومة) بحجم مرتفع = إشارة شراء قوية. يستغرق تشكله من أسابيع إلى أشهر. اكتشفه William O'Neil وأثبت فعاليته إحصائياً.", rules: '1. قاع مستدير (الكوب) وليس حاد على شكل V\n2. العروة تصحيح خفيف 30-50% من ارتفاع الكوب\n3. العروة مائلة للأسفل أو أفقية (ليست صاعدة)\n4. كسر حافة الكوب العليا بحجم مرتفع = شراء\n5. الهدف = عمق الكوب مُضاف لنقطة الكسر\n6. الحجم يتناقص في الكوب ويرتفع بقوة عند الكسر', svg: '<path d="M 8,20 Q 8,20 16,30 Q 30,65 60,65 Q 90,65 104,30 Q 108,22 108,20" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M 90,28 Q 96,40 104,38 Q 110,35 112,20" fill="none" stroke="#fff" stroke-width="1.5"/><line x1="8" y1="20" x2="112" y2="20" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><text x="55" y="55" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">CUP</text><text x="102" y="35" fill="#888" font-size="6" font-family="Share Tech Mono">HANDLE</text>' },
            { name: 'Inverse Cup & Handle', ar: 'الكوب والعروة المقلوب', rel: 75, type: 'BEARISH REVERSAL', desc: 'النسخة المعكوسة من الكوب والعروة — قمة مستديرة (كوب مقلوب) تُظهر توزيع مؤسسي تدريجي يليه ارتداد صغير (عروة) قبل الكسر الهبوطي. القمة المستديرة تعني أن البائعين المؤسسيين يوزعون ممتلكاتهم ببطء ومنهجية. كسر قاع الكوب المقلوب (الدعم) يؤكد الانعكاس الهبوطي.', rules: '1. قمة مستديرة (كوب مقلوب) وليست حادة\n2. العروة ارتداد خفيف صعودي\n3. كسر قاع الكوب المقلوب = بيع\n4. الهدف = عمق الكوب مطروح من نقطة الكسر\n5. الحجم يتناقص في القمة ويرتفع عند الكسر\n6. أقل شيوعاً من النسخة الصعودية', svg: '<path d="M 8,60 Q 8,60 16,50 Q 30,15 60,15 Q 90,15 104,50 Q 108,58 108,60" fill="none" stroke="#ff6a00" stroke-width="2.5"/><path d="M 90,52 Q 96,40 104,42 Q 110,45 112,60" fill="none" stroke="#ff6a00" stroke-width="1.5"/><line x1="8" y1="60" x2="112" y2="60" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><text x="55" y="25" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">CUP</text>' },
            { name: 'Rounding Top', ar: 'القمة المستديرة', rel: 70, type: 'BEARISH REVERSAL', desc: 'نموذج انعكاسي بطيء التشكل يأخذ شكل قوس دائري في القمة. يُظهر تحول تدريجي وبطيء من الصعود إلى الحركة الأفقية ثم الهبوط. لا يوجد كسر حاد — بل تآكل تدريجي للزخم الصعودي. يستغرق تشكله أسابيع إلى أشهر. الحجم عادة يتناقص في منتصف القوس ويرتفع مع بداية الهبوط. كسر خط الدعم الأفقي يؤكد الانعكاس.', rules: '1. قوس دائري ناعم في القمة (ليس حاداً)\n2. تشكل بطيء على مدار أسابيع أو أشهر\n3. الحجم يتناقص في منتصف القوس\n4. كسر مستوى الدعم الأفقي = تأكيد هبوطي\n5. الهدف = عمق القوس (ارتفاعه) مطروح من نقطة الكسر\n6. إشارة بطيئة لكنها موثوقة', svg: '<path d="M 8,62 Q 20,60 30,40 Q 45,12 60,12 Q 75,12 90,40 Q 100,60 112,62" fill="none" stroke="#ff6a00" stroke-width="2.5"/><line x1="8" y1="62" x2="112" y2="62" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/>' },
            { name: 'Rounding Bottom', ar: 'القاع المستدير (الصحن)', rel: 72, type: 'BULLISH REVERSAL', desc: 'عكس القمة المستديرة — قوس دائري سفلي يُشبه الصحن. يُظهر تحول تدريجي من الهبوط إلى التوازن ثم الصعود. يمثل فترة تجميع مؤسسي طويلة حيث يتم امتصاص العرض ببطء. بطيء التشكل لكن عندما يكتمل يكون إشارة صعودية قوية. الحجم يتناقص في القاع ويتزايد مع بداية الصعود.', rules: '1. قوس دائري ناعم في القاع (يشبه الصحن)\n2. تشكل بطيء على مدار أسابيع أو أشهر\n3. الحجم يتناقص في القاع ويتزايد مع الصعود\n4. كسر مستوى المقاومة الأفقي = تأكيد صعودي\n5. الهدف = عمق القوس مُضاف لنقطة الكسر\n6. من أقوى إشارات التجميع المؤسسي', svg: '<path d="M 8,18 Q 20,20 30,40 Q 45,68 60,68 Q 75,68 90,40 Q 100,20 112,18" fill="none" stroke="#fff" stroke-width="2.5"/><line x1="8" y1="18" x2="112" y2="18" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/>' },
            { name: 'Diamond Top', ar: 'الماسة القمية', rel: 74, type: 'BEARISH REVERSAL', desc: 'نموذج نادر يتشكل في قمة الاتجاه الصاعد. يبدأ بتوسع في نطاق التداول (مثل Broadening) ثم يتضيق تدريجياً (مثل Triangle) مُشكّلاً شكل الماسة. يجمع بين خصائص التوسع والتضييق مما يجعله صعب الاكتشاف مبكراً. كسر الحد السفلي للماسة يؤكد الانعكاس الهبوطي. الهدف يساوي أقصى عرض للماسة مطروحاً من نقطة الكسر.', rules: '1. توسع في النطاق (Broadening) ثم تضييق (Triangle)\n2. يُشكّل شكل ماسي أو معيني\n3. كسر الحد السفلي = تأكيد هبوطي\n4. الهدف = أقصى ارتفاع للماسة\n5. نادر الحدوث لكنه موثوق\n6. الحجم يتناقص داخل الماسة', svg: '<polygon points="60,10 100,40 60,70 20,40" fill="none" stroke="#ff6a00" stroke-width="2"/><line x1="60" y1="70" x2="70" y2="76" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="3,3"/>' },
            { name: 'Diamond Bottom', ar: 'الماسة القاعية', rel: 74, type: 'BULLISH REVERSAL', desc: 'عكس الماسة القمية — تتشكل في قاع الاتجاه الهابط. نفس الشكل الماسي لكن كسر الحد العلوي يؤكد الانعكاس الصعودي. نادر لكن موثوق عند الظهور.', rules: '1. توسع ثم تضييق في القاع\n2. شكل ماسي\n3. كسر الحد العلوي = تأكيد صعودي\n4. الهدف = ارتفاع الماسة مُضاف لنقطة الكسر\n5. نادر الحدوث\n6. الحجم يرتفع عند الكسر الصعودي', svg: '<polygon points="60,10 100,40 60,70 20,40" fill="none" stroke="#fff" stroke-width="2"/><line x1="60" y1="10" x2="50" y2="4" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/>' }
        ]
    },
    ch_cont: {
        label: 'نماذج استمرارية', en: 'CONTINUATION PATTERNS',
        patterns: [
            { name: 'Bull Flag', ar: 'العلم الصعودي', rel: 78, type: 'BULLISH CONTINUATION', desc: 'نموذج استمراري صعودي من أكثر النماذج شيوعاً ووضوحاً. يتكون من جزئين: السارية (Pole) وهي صعود حاد وسريع بحجم تداول مرتفع، والعلم (Flag) وهو تصحيح خفيف مائل للأسفل داخل قناة متوازية ضيقة. الحجم يتناقص خلال تشكل العلم مما يدل على أن التصحيح مجرد استراحة وليس انعكاس. كسر العلم لأعلى بحجم مرتفع = استمرار الصعود بهدف يساوي طول السارية مُضافاً لنقطة الكسر.', rules: '1. السارية: صعود حاد وسريع بحجم تداول كبير\n2. العلم: تصحيح خفيف مائل للأسفل داخل قناة متوازية\n3. الحجم يتناقص أثناء تشكل العلم\n4. كسر العلم لأعلى بحجم مرتفع = إشارة شراء\n5. الهدف = طول السارية مُضاف لنقطة الكسر\n6. يكتمل عادة في 1-3 أسابيع', svg: '<line x1="16" y1="66" x2="36" y2="16" stroke="#fff" stroke-width="2.5"/><line x1="36" y1="16" x2="72" y2="30" stroke="#fff" stroke-width="1.5"/><line x1="36" y1="28" x2="72" y2="42" stroke="#fff" stroke-width="1.5"/><line x1="72" y1="30" x2="100" y2="8" stroke="#fff" stroke-width="2" stroke-dasharray="4,3"/><text x="22" y="45" fill="#888" font-size="6" font-family="Share Tech Mono" transform="rotate(-65,22,45)">POLE</text><text x="54" y="28" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">FLAG</text>' },
            { name: 'Bear Flag', ar: 'العلم الهبوطي', rel: 78, type: 'BEARISH CONTINUATION', desc: 'عكس العلم الصعودي — هبوط حاد (السارية) يليه تصحيح صعودي خفيف داخل قناة مائلة للأعلى (العلم). الحجم يتناقص في العلم. كسر العلم للأسفل بحجم = استمرار الهبوط بهدف يساوي طول السارية.', rules: '1. السارية: هبوط حاد وسريع بحجم كبير\n2. العلم: تصحيح صعودي خفيف في قناة مائلة للأعلى\n3. الحجم يتناقص في العلم\n4. كسر العلم للأسفل بحجم = بيع\n5. الهدف = طول السارية\n6. يكتمل في 1-3 أسابيع', svg: '<line x1="16" y1="14" x2="36" y2="64" stroke="#ff6a00" stroke-width="2.5"/><line x1="36" y1="64" x2="72" y2="50" stroke="#ff6a00" stroke-width="1.5"/><line x1="36" y1="52" x2="72" y2="38" stroke="#ff6a00" stroke-width="1.5"/><line x1="72" y1="50" x2="100" y2="72" stroke="#ff6a00" stroke-width="2" stroke-dasharray="4,3"/><text x="54" y="46" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">FLAG</text>' },
            { name: 'Bull Pennant', ar: 'الراية الصعودية', rel: 76, type: 'BULLISH CONTINUATION', desc: 'مشابه للعلم الصعودي لكن التصحيح يأخذ شكل مثلث متماثل صغير بدلاً من قناة مستطيلة. الخطان العلوي والسفلي يتقاربان مُشكّلين نقطة حادة — ضغط متزايد قبل الانفجار الصعودي. أسرع في الاكتمال من العلم ويحدث عادة بعد حركة سعرية قوية وسريعة.', rules: '1. سارية صعودية حادة وسريعة\n2. مثلث متماثل صغير (الراية) بعد السارية\n3. الخطان يتقاربان بسرعة\n4. كسر المثلث لأعلى = شراء\n5. الهدف = طول السارية مُضاف لنقطة الكسر\n6. يكتمل بسرعة أكبر من العلم', svg: '<line x1="16" y1="66" x2="36" y2="16" stroke="#fff" stroke-width="2.5"/><line x1="36" y1="16" x2="74" y2="32" stroke="#fff" stroke-width="1.5"/><line x1="36" y1="36" x2="74" y2="32" stroke="#fff" stroke-width="1.5"/><line x1="74" y1="32" x2="100" y2="8" stroke="#fff" stroke-width="2" stroke-dasharray="4,3"/>' },
            { name: 'Bear Pennant', ar: 'الراية الهبوطية', rel: 76, type: 'BEARISH CONTINUATION', desc: 'عكس الراية الصعودية — سارية هبوطية حادة تليها مثلث متماثل صغير ثم كسر للأسفل. نفس القواعد مطبقة بالعكس.', rules: '1. سارية هبوطية حادة\n2. مثلث متماثل صغير (الراية)\n3. كسر المثلث للأسفل = بيع\n4. الهدف = طول السارية\n5. يكتمل بسرعة\n6. الحجم يرتفع عند الكسر', svg: '<line x1="16" y1="14" x2="36" y2="64" stroke="#ff6a00" stroke-width="2.5"/><line x1="36" y1="64" x2="74" y2="48" stroke="#ff6a00" stroke-width="1.5"/><line x1="36" y1="44" x2="74" y2="48" stroke="#ff6a00" stroke-width="1.5"/><line x1="74" y1="48" x2="100" y2="72" stroke="#ff6a00" stroke-width="2" stroke-dasharray="4,3"/>' },
            { name: 'Ascending Triangle', ar: 'المثلث الصاعد', rel: 75, type: 'BULLISH CONTINUATION', desc: 'نموذج استمراري صعودي يتشكل من خط مقاومة أفقي ثابت مع خط دعم صاعد (قيعان صاعدة متتالية). كل قاع أعلى من السابق يُظهر ضغط شرائي متزايد — المشترون يدفعون السعر لأعلى في كل مرة ولا يسمحون بالتراجع. المسألة وقت فقط قبل كسر المقاومة. الكسر بحجم مرتفع = صعود قوي بهدف يساوي ارتفاع المثلث (المسافة بين المقاومة وأول قاع).', rules: '1. خط مقاومة أفقي ثابت واضح\n2. قيعان صاعدة متتالية تتقارب نحو المقاومة\n3. كسر المقاومة بحجم مرتفع = إشارة شراء\n4. الهدف = ارتفاع المثلث مُضاف لنقطة الكسر\n5. غالباً استمراري صعودي (75% من الحالات)\n6. الحجم يتناقص داخل المثلث ويرتفع عند الكسر', svg: '<line x1="10" y1="20" x2="90" y2="20" stroke="#ff6a00" stroke-width="2"/><line x1="10" y1="68" x2="90" y2="20" stroke="#fff" stroke-width="2"/><line x1="90" y1="20" x2="108" y2="8" stroke="#fff" stroke-width="2" stroke-dasharray="4,3"/><text x="94" y="18" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">R</text>' },
            { name: 'Descending Triangle', ar: 'المثلث الهابط', rel: 75, type: 'BEARISH CONTINUATION', desc: 'عكس المثلث الصاعد — خط دعم أفقي ثابت مع قمم هابطة. ضغط بيعي متزايد — البائعون يضغطون السعر للأسفل في كل موجة. كسر الدعم = هبوط قوي.', rules: '1. خط دعم أفقي ثابت واضح\n2. قمم هابطة متتالية تتقارب نحو الدعم\n3. كسر الدعم بحجم = إشارة بيع\n4. الهدف = ارتفاع المثلث مطروح من نقطة الكسر\n5. غالباً استمراري هبوطي (75%)\n6. الحجم يتناقص داخل المثلث', svg: '<line x1="10" y1="60" x2="90" y2="60" stroke="#fff" stroke-width="2"/><line x1="10" y1="12" x2="90" y2="60" stroke="#ff6a00" stroke-width="2"/><line x1="90" y1="60" x2="108" y2="72" stroke="#ff6a00" stroke-width="2" stroke-dasharray="4,3"/><text x="94" y="58" fill="#fff" font-size="5" font-family="Share Tech Mono">S</text>' },
            { name: 'Symmetrical Triangle', ar: 'المثلث المتماثل', rel: 70, type: 'NEUTRAL', desc: 'قمم هابطة وقيعان صاعدة تتقارب مُشكّلة مثلث متماثل. السعر ينضغط في نطاق يضيق تدريجياً — معركة بين المشترين والبائعين لا حسم فيها. الكسر في أي اتجاه يحدد الحركة القادمة. إحصائياً يميل الكسر لاتجاه الترند السابق (استمراري) لكن ليس دائماً.', rules: '1. قمم هابطة + قيعان صاعدة تتقارب\n2. الخطان العلوي والسفلي يلتقيان نظرياً\n3. الكسر في أي اتجاه يحدد الحركة\n4. غالباً يكمل الاتجاه السابق (60-65%)\n5. الهدف = قاعدة المثلث (أوسع نقطة)\n6. الحجم يتناقص بوضوح قبل الكسر', svg: '<line x1="10" y1="14" x2="86" y2="40" stroke="#ff6a00" stroke-width="2"/><line x1="10" y1="66" x2="86" y2="40" stroke="#fff" stroke-width="2"/><text x="48" y="42" text-anchor="middle" fill="#888" font-size="8" font-family="Share Tech Mono">?</text>' },
            { name: 'Rising Wedge', ar: 'الوتد الصاعد', rel: 72, type: 'BEARISH', desc: 'خطان صاعدان متقاربان — ظاهرياً يبدو النموذج صعودياً لكنه في الحقيقة هبوطي. السبب: كل موجة صعودية أضعف من السابقة والخطان يتقاربان مما يعني أن الزخم الصعودي يستنفد تدريجياً. كسر الخط السفلي (الدعم الصاعد) يؤكد الانعكاس الهبوطي. يظهر كنموذج انعكاسي في قمة الاتجاه أو كنموذج استمراري هبوطي داخل اتجاه هابط.', rules: '1. خطان مائلان للأعلى ومتقاربان تدريجياً\n2. الحجم يتناقص مع كل موجة صعودية\n3. كسر الخط السفلي = إشارة هبوطية\n4. الهدف = أوسع نقطة في الوتد مطروحة من نقطة الكسر\n5. غالباً هبوطي رغم الشكل الصاعد\n6. في قمة الاتجاه = انعكاسي / في اتجاه هابط = استمراري', svg: '<line x1="10" y1="68" x2="88" y2="12" stroke="#ff6a00" stroke-width="2"/><line x1="10" y1="72" x2="88" y2="28" stroke="#ff6a00" stroke-width="2"/><line x1="88" y1="28" x2="108" y2="58" stroke="#ff6a00" stroke-width="2" stroke-dasharray="4,3"/>' },
            { name: 'Falling Wedge', ar: 'الوتد الهابط', rel: 72, type: 'BULLISH', desc: 'عكس الوتد الصاعد — خطان هابطان متقاربان. ظاهرياً هبوطي لكن فعلياً صعودي. كل موجة هبوطية أضعف من السابقة والزخم الهبوطي يستنفد. كسر الخط العلوي = صعود. يظهر كانعكاسي في قاع الاتجاه أو استمراري صعودي داخل اتجاه صاعد.', rules: '1. خطان مائلان للأسفل ومتقاربان\n2. الحجم يتناقص مع كل موجة هبوطية\n3. كسر الخط العلوي = إشارة صعودية\n4. الهدف = أوسع نقطة في الوتد مُضافة لنقطة الكسر\n5. صعودي رغم الشكل الهابط\n6. في قاع الاتجاه = انعكاسي / في اتجاه صاعد = استمراري', svg: '<line x1="10" y1="12" x2="88" y2="52" stroke="#fff" stroke-width="2"/><line x1="10" y1="16" x2="88" y2="68" stroke="#fff" stroke-width="2"/><line x1="88" y1="52" x2="108" y2="22" stroke="#fff" stroke-width="2" stroke-dasharray="4,3"/>' },
            { name: 'Rectangle / Range', ar: 'المستطيل (النطاق)', rel: 68, type: 'NEUTRAL', desc: 'السعر يتذبذب بين مستوى دعم ومستوى مقاومة أفقيين مُشكّلاً صندوق أو نطاق تداول. يمثل فترة تجميع (إذا بعد هبوط) أو توزيع (إذا بعد صعود). كلما طالت فترة التذبذب داخل المستطيل كان الكسر أقوى وأكثر انفجارية. الكسر في أي اتجاه بحجم مرتفع يحدد الحركة القادمة.', rules: '1. دعم أفقي ومقاومة أفقية واضحان\n2. السعر يتذبذب بينهما مرات متعددة\n3. الكسر بحجم مرتفع يحدد الاتجاه القادم\n4. الهدف = ارتفاع المستطيل مُضاف/مطروح من نقطة الكسر\n5. كلما طال التذبذب كان الكسر أقوى\n6. الحجم يتناقص داخل المستطيل', svg: '<line x1="10" y1="20" x2="110" y2="20" stroke="#ff6a00" stroke-width="2"/><line x1="10" y1="60" x2="110" y2="60" stroke="#fff" stroke-width="2"/><polyline points="14,56 26,24 38,56 50,24 62,56 74,24 86,56 98,24" fill="none" stroke="#888" stroke-width="1.5"/><text x="60" y="44" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">RANGE</text>' },
            { name: 'Broadening Formation', ar: 'النموذج المتوسع (الميغافون)', rel: 65, type: 'NEUTRAL', desc: 'عكس المثلث — قمم صاعدة وقيعان هابطة تتباعد مُشكّلة شكل مكبر الصوت (Megaphone). يُظهر تقلب متزايد وعدم استقرار — كل موجة أكبر من السابقة. صعب التداول لأنه لا يوجد اتجاه واضح. غالباً يظهر في نهاية الاتجاهات الكبرى ويسبق انعكاس حاد. نادر نسبياً لكن مهم جداً كتحذير.', rules: '1. قمم صاعدة + قيعان هابطة (عكس المثلث)\n2. الخطان يتباعدان تدريجياً\n3. التقلب يتزايد مع كل موجة\n4. صعب التنبؤ بالاتجاه النهائي\n5. غالباً يسبق انعكاس كبير في نهاية الاتجاه\n6. حجم التداول يتزايد مع التقلب', svg: '<line x1="20" y1="30" x2="100" y2="10" stroke="#ff6a00" stroke-width="2"/><line x1="20" y1="50" x2="100" y2="70" stroke="#fff" stroke-width="2"/><polyline points="24,48 34,32 46,46 58,28 70,50 82,22 94,52" fill="none" stroke="#888" stroke-width="1"/>' }
        ]
    }
};

function chRender() {
    var cat = chData[chCurrentCat];
    if (!cat) return;
    var el = document.getElementById('ch-content');
    if (!el) return;
    if (chSelectedIdx >= 0 && chSelectedIdx < cat.patterns.length) {
        el.innerHTML = chRenderDetail(cat.patterns[chSelectedIdx]);
        return;
    }
    var h = '<div class="ch-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        var isBear = p.type && (p.type.indexOf('BEAR') >= 0);
        var isNeutral = p.type && p.type === 'NEUTRAL';
        var topC = isBear ? '#ff6a00' : isNeutral ? '#888' : '#fff';
        h += '<div class="ch-card" style="border-top:3px solid ' + topC + '" onclick="chSelect(' + i + ')">';
        h += '<div class="ch-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%"><rect width="120" height="80" fill="#000"/>' + p.svg + '</svg></div>';
        h += '<div class="ch-card-name">' + p.name + '</div>';
        h += '<div class="ch-card-ar">' + p.ar + '</div>';
        if (p.type) {
            var badgeC = p.type.indexOf('BULL') >= 0 ? '#fff' : p.type === 'NEUTRAL' ? '#888' : '#ff6a00';
            h += '<div class="ch-card-type" style="color:' + badgeC + '">' + p.type + '</div>';
        }
        h += '<div class="ch-card-rel-row"><span class="ch-card-rel-l">RELIABILITY</span><span class="ch-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="ch-card-bar"><div class="ch-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="ch-footer">هذه الموسوعة مرجع تعليمي شامل للنماذج الكلاسيكية الفنية. النماذج لا تضمن نتائج بمفردها — استخدمها دائماً مع مؤشرات التحليل الأخرى وإدارة المخاطر. لا تعتمد على نموذج واحد فقط. الأهداف السعرية تقديرية وليست مضمونة. SPOT ONLY — تحليل مرجعي تعليمي وليس نصيحة مالية.</div>';
    el.innerHTML = h;
}

function chRenderDetail(p) {
    var isBear = p.type && p.type.indexOf('BEAR') >= 0;
    var badgeC = p.type.indexOf('BULL') >= 0 ? '#fff' : p.type === 'NEUTRAL' ? '#888' : '#ff6a00';
    var h = '<div class="ch-back" onclick="chBack()">رجوع</div>';
    h += '<div class="ch-detail">';
    h += '<div class="ch-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%"><rect width="120" height="80" fill="#000"/>' + p.svg + '</svg></div>';
    h += '<div class="ch-detail-name">' + p.name + '</div>';
    h += '<div class="ch-detail-ar">' + p.ar + '</div>';
    if (p.type) { h += '<div class="ch-detail-badge" style="background:' + badgeC + '; color:#000;">' + p.type + '</div>'; }
    h += '<div class="ch-detail-rel-row"><span class="ch-detail-rel-l">RELIABILITY</span><span class="ch-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
    h += '<div class="ch-detail-bar"><div class="ch-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    h += '<div class="ch-detail-desc-wrap"><div class="ch-detail-desc-label">DESCRIPTION // الوصف والتفسير</div><div class="ch-detail-desc">' + p.desc + '</div></div>';
    h += '<div class="ch-detail-rules-wrap"><div class="ch-detail-rules-label">RULES // الشروط والقواعد</div>';
    var rules = p.rules.split('\n');
    for (var i = 0; i < rules.length; i++) {
        h += '<div class="cp-rule-row"><span class="cp-rule-num">' + rules[i].substring(0, 2) + '</span><span class="cp-rule-text">' + rules[i].substring(3) + '</span></div>';
    }
    h += '</div></div>';
    return h;
}

/* =====================================================================
   ELLIOTT WAVE ENGINE — LEARN HUB 360
   ===================================================================== */

var ewCurrentCat = 'impulse';
var ewSelectedIdx = -1;

function ewSetCat(cat, btn) {
    ewCurrentCat = cat;
    ewSelectedIdx = -1;
    var btns = document.querySelectorAll('.ew-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('ew-cat-active');
    if (btn) btn.classList.add('ew-cat-active');
    ewRender();
}

function ewSelect(idx) { ewSelectedIdx = idx; ewRender(); }
function ewBack() { ewSelectedIdx = -1; ewRender(); }

function ewInit() {
    var tabsEl = document.getElementById('ew-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var keys = Object.keys(ewData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = ewData[k];
        h += '<button class="ew-cat-btn' + (k === ewCurrentCat ? ' ew-cat-active' : '') + '" onclick="ewSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    ewRender();
}

// قاعدة البيانات التعليمية الكاملة (نقل حرفي وبدون أي أخطاء)
var ewData = {
    impulse: {
        en: 'IMPULSE WAVES', label: 'الموجات الدافعة',
        patterns: [
            { name: 'Impulse Wave (1-2-3-4-5)', ar: 'الموجة الدافعة الكلاسيكية', rel: 95, type: 'TREND', desc: 'الهيكل الأساسي لنظرية إليوت — 5 موجات في اتجاه الترند الرئيسي. الموجات 1 و3 و5 دافعة (في اتجاه الترند) والموجات 2 و4 تصحيحية (عكس الترند). الموجة 3 هي الأطول والأقوى غالباً — لا يمكن أن تكون الأقصر أبداً (قاعدة حديدية). الموجة 4 لا تتداخل مع منطقة الموجة 1 أبداً في الموجات الدافعة العادية. هذا الهيكل يتكرر على كل الفريمات الزمنية (الفراكتال) — كل موجة دافعة تتكون داخلياً من 5 موجات أصغر وكل موجة تصحيحية من 3 موجات.', fib: 'الموجة 2: ترتد 50%-61.8% من الموجة 1\nالموجة 3: تمتد 161.8%-261.8% من الموجة 1 (الأكثر شيوعاً 161.8%)\nالموجة 4: ترتد 23.6%-38.2% من الموجة 3\nالموجة 5: تساوي الموجة 1 أو 61.8% منها أو تمتد 161.8% من الموجة 1', rules: '1. الموجة 2 لا تتجاوز بداية الموجة 1 أبداً (قاعدة مطلقة)\n2. الموجة 3 لا تكون الأقصر بين 1 و3 و5 (قاعدة مطلقة)\n3. الموجة 4 لا تدخل منطقة الموجة 1 السعرية (قاعدة مطلقة)\n4. الموجة 3 غالباً هي الأطول والأقوى حجماً\n5. الموجة 5 قد تكون أقصر من 3 وأحياناً تفشل (Truncation)\n6. التناوب: إذا كانت 2 حادة فـ 4 مسطحة والعكس', svg: '<polyline points="10,65 25,40 35,55 65,10 75,30 95,18" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="10" cy="65" r="2" fill="#fff"/><circle cx="25" cy="40" r="2" fill="#fff"/><circle cx="35" cy="55" r="2" fill="#fff"/><circle cx="65" cy="10" r="2" fill="#fff"/><circle cx="75" cy="30" r="2" fill="#fff"/><circle cx="95" cy="18" r="2" fill="#fff"/><text x="8" y="75" fill="#888" font-size="7" font-family="Share Tech Mono">0</text><text x="23" y="37" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">1</text><text x="37" y="60" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">2</text><text x="63" y="8" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">3</text><text x="77" y="35" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">4</text><text x="97" y="16" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">5</text>' },
            { name: 'Extended Wave 3', ar: 'الموجة الثالثة الممتدة', rel: 90, type: 'MOST COMMON', desc: 'أكثر أشكال الامتداد شيوعاً في الأسواق المالية. الموجة 3 تمتد بشكل واضح وتكون أطول بكثير من الموجات 1 و5. داخلها تتشكل 5 موجات فرعية واضحة (i-ii-iii-iv-v). الحجم يرتفع بقوة في الموجة 3 وغالباً تحدث فيها الفجوات السعرية. في الكريبتو هذا هو الشكل السائد — الموجة 3 هي موجة المال حيث يدخل أغلب المتداولين.', fib: 'الموجة 3: تمتد 161.8%-261.8% من الموجة 1\nإذا وصلت 261.8% فالموجة 5 غالباً تساوي الموجة 1\nالموجة 3 الفرعية (iii): أطول موجة داخل الـ 3\nالموجة 4: ترتد 23.6%-38.2% من الموجة 3 الممتدة', rules: '1. الموجة 3 أطول بوضوح من 1 و5\n2. تتكون من 5 موجات فرعية واضحة\n3. الحجم يرتفع بقوة ويصل ذروته\n4. فجوات سعرية شائعة في منتصفها\n5. المؤشرات تصل لمناطق تشبع شراء قوية\n6. أكثر من 70% من الموجات الدافعة تمتد في الموجة 3', svg: '<polyline points="8,68 18,52 22,58 28,48 32,52 50,8 56,22 62,30 68,20 78,38 88,28" fill="none" stroke="#fff" stroke-width="2"/><text x="6" y="75" fill="#888" font-size="6" font-family="Share Tech Mono">0</text><text x="16" y="49" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">1</text><text x="24" y="63" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">2</text><text x="48" y="7" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">3</text><text x="70" y="38" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">4</text><text x="90" y="26" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">5</text><line x1="22" y1="46" x2="56" y2="46" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/><text x="38" y="44" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">EXTENDED</text>' },
            { name: 'Extended Wave 5', ar: 'الموجة الخامسة الممتدة', rel: 70, type: 'COMMODITIES', desc: 'أقل شيوعاً من امتداد الموجة 3 — تظهر أكثر في أسواق السلع والكريبتو. الموجة 5 تمتد بقوة وتتجاوز التوقعات. خطورتها أن الانعكاس بعدها يكون عنيف وسريع — الموجة التصحيحية A غالباً تعود لبداية الموجة 5 الممتدة بالكامل. يُعرف هذا بـ Double Retracement حيث السعر يعود مرتين لنفس المنطقة.', fib: 'الموجة 5: تمتد 161.8% من المسافة بين بداية الموجة 1 ونهاية الموجة 3\nأو تساوي 161.8%-261.8% من الموجة 1\nبعد الاكتمال: التصحيح يعود غالباً لبداية الموجة 5\nالموجة A التصحيحية: حادة وسريعة', rules: '1. الموجة 5 أطول بوضوح من 1 و3\n2. تتكون من 5 موجات فرعية واضحة\n3. الحجم قد يكون أقل من الموجة 3 (دايفرجنس)\n4. التصحيح بعدها عنيف وسريع\n5. شائعة في أسواق السلع والكريبتو\n6. Double Retracement: السعر يعود لبداية الموجة 5', svg: '<polyline points="8,68 20,45 26,55 42,25 48,35 58,32 68,22 78,14 88,8 98,5" fill="none" stroke="#fff" stroke-width="2"/><text x="6" y="75" fill="#888" font-size="6" font-family="Share Tech Mono">0</text><text x="18" y="42" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">1</text><text x="28" y="60" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">2</text><text x="40" y="22" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">3</text><text x="50" y="40" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">4</text><text x="100" y="5" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">5</text><line x1="52" y1="30" x2="96" y2="30" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/><text x="70" y="28" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">EXTENDED</text>' },
            { name: 'Leading Diagonal (Wave 1)', ar: 'المثلث القطري القائد', rel: 65, type: 'WAVE 1 / A', desc: 'نموذج خاص يظهر فقط في موقع الموجة 1 أو الموجة A. يشبه الوتد — 5 موجات لكن بهيكل 3-3-3-3-3 (كل موجة فرعية من 3 وليس 5). الموجات تتداخل — الموجة 4 تدخل منطقة الموجة 1 (استثناء من القاعدة العامة). يأخذ شكل مثلث يتقلص. يدل على بداية اتجاه جديد لكن بتردد وعدم يقين في البداية.', fib: 'الموجة 2: ترتد 61.8%-78.6% من الموجة 1\nالموجة 3: تمتد 100%-161.8% من الموجة 1\nالموجة 4: ترتد 50%-61.8% من الموجة 3\nالموجة 5: تساوي الموجة 1 أو 61.8% منها', rules: '1. يظهر فقط في موقع الموجة 1 أو A\n2. هيكل 3-3-3-3-3 (كل فرعية من 3 موجات)\n3. الموجة 4 تتداخل مع منطقة الموجة 1 (مسموح)\n4. يأخذ شكل وتد/مثلث متقلص\n5. الموجة 3 لا تكون الأقصر\n6. يدل على بداية اتجاه جديد بتردد', svg: '<polyline points="10,70 28,42 36,52 55,20 62,38 80,15" fill="none" stroke="#fff" stroke-width="2"/><line x1="10" y1="70" x2="80" y2="15" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="28" y1="42" x2="62" y2="15" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="26" y="39" fill="#fff" font-size="7" font-family="Share Tech Mono">1</text><text x="38" y="57" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">2</text><text x="53" y="17" fill="#fff" font-size="7" font-family="Share Tech Mono">3</text><text x="64" y="43" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">4</text><text x="82" y="13" fill="#fff" font-size="7" font-family="Share Tech Mono">5</text><text x="30" y="75" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">LEADING DIAGONAL</text>' },
            { name: 'Ending Diagonal (Wave 5)', ar: 'المثلث القطري المنتهي', rel: 75, type: 'WAVE 5 / C', desc: 'نموذج خاص يظهر في موقع الموجة 5 أو الموجة C. يشبه الوتد المتقلص — 5 موجات بهيكل 3-3-3-3-3. الموجات تتداخل. يدل على إرهاق الاتجاه الحالي وقرب الانعكاس. بعد اكتماله يحدث انعكاس حاد وسريع يعود السعر لبداية المثلث القطري على الأقل. إشارة قوية جداً لنهاية الاتجاه.', fib: 'الموجة 5 الفرعية: غالباً تتجاوز خط القناة العلوي (Throw-over)\nبعد الاكتمال: السعر يعود لبداية المثلث القطري\nالموجة 3: 61.8%-100% من الموجة 1\nالموجة 5: 61.8%-100% من الموجة 3', rules: '1. يظهر فقط في موقع الموجة 5 أو C\n2. هيكل 3-3-3-3-3\n3. الموجة 4 تتداخل مع الموجة 1 (مسموح)\n4. يأخذ شكل وتد متقلص\n5. الانعكاس بعده حاد وسريع\n6. Throw-over: الموجة 5 قد تتجاوز الخط العلوي مؤقتاً', svg: '<polyline points="10,45 30,28 38,38 52,18 60,32 72,12" fill="none" stroke="#fff" stroke-width="2"/><line x1="10" y1="45" x2="72" y2="12" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="30" y1="28" x2="60" y2="12" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="72" y1="12" x2="105" y2="55" stroke="#ff6a00" stroke-width="2" stroke-dasharray="4,3"/><text x="28" y="25" fill="#fff" font-size="7" font-family="Share Tech Mono">1</text><text x="40" y="43" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">2</text><text x="50" y="15" fill="#fff" font-size="7" font-family="Share Tech Mono">3</text><text x="62" y="37" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">4</text><text x="74" y="10" fill="#fff" font-size="7" font-family="Share Tech Mono">5</text><text x="85" y="45" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">REVERSAL</text>' },
            { name: 'Wave 5 Truncation', ar: 'الموجة الخامسة المبتورة', rel: 60, type: 'EXHAUSTION', desc: 'حالة خاصة تفشل فيها الموجة 5 في تجاوز نهاية الموجة 3 — تبقى أقصر منها. تحدث عندما يستنفد الاتجاه كل زخمه في الموجة 3 القوية ولا يبقى طاقة كافية للموجة 5. إشارة قوية جداً على ضعف الاتجاه وقرب انعكاس حاد. غالباً تأتي مع دايفرجنس واضح في المؤشرات.', fib: 'الموجة 5: أقل من 100% من الموجة 3 (لا تتجاوز نهايتها)\nعادة تصل 38.2%-61.8% من الموجة 3 فقط\nالدايفرجنس واضح في RSI وMACD\nالتصحيح بعدها: حاد ويتجاوز بداية الموجة 5 بسرعة', rules: '1. الموجة 5 لا تتجاوز نهاية الموجة 3\n2. تظل أقصر من الموجة 3\n3. تحتوي على 5 موجات فرعية رغم قصرها\n4. دايفرجنس واضح في المؤشرات\n5. إشارة قوية على ضعف الاتجاه\n6. الانعكاس بعدها عنيف وسريع', svg: '<polyline points="10,68 24,40 32,52 58,10 66,28 78,16" fill="none" stroke="#fff" stroke-width="2"/><line x1="58" y1="10" x2="110" y2="10" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><text x="22" y="37" fill="#fff" font-size="7" font-family="Share Tech Mono">1</text><text x="34" y="57" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">2</text><text x="56" y="8" fill="#fff" font-size="7" font-family="Share Tech Mono">3</text><text x="68" y="33" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">4</text><text x="80" y="14" fill="#fff" font-size="7" font-family="Share Tech Mono">5</text><text x="82" y="9" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">TRUNCATED</text>' }
        ]
    },
    corrective: {
        en: 'CORRECTIVE WAVES', label: 'الموجات التصحيحية',
        patterns: [
            { name: 'Zigzag (A-B-C)', ar: 'الزيجزاج', rel: 85, type: 'SHARP CORRECTION', desc: 'أكثر التصحيحات حدة ووضوحاً. يتكون من 3 موجات: A (5 موجات فرعية) → B (3 موجات فرعية) → C (5 موجات فرعية). الهيكل 5-3-5. التصحيح حاد وعميق — الموجة C تتجاوز نهاية الموجة A دائماً. يظهر غالباً في الموجة 2 وفي الموجة A من تصحيح أكبر. نسبة فيبوناتشي الشائعة: الموجة C تساوي الموجة A أو 161.8% منها.', fib: 'الموجة A: تصحح 38.2%-61.8% من الموجة الدافعة السابقة\nالموجة B: ترتد 38.2%-78.6% من الموجة A (غالباً 50%-61.8%)\nالموجة C: تساوي الموجة A (100%) أو 61.8% أو 161.8% منها\nالتصحيح الكلي: 50%-61.8% من الموجة الدافعة', rules: '1. الهيكل: 5-3-5 (A من 5 موجات، B من 3، C من 5)\n2. الموجة C تتجاوز نهاية الموجة A دائماً\n3. الموجة B لا تتجاوز بداية الموجة A\n4. تصحيح حاد وعميق\n5. شائع في موقع الموجة 2\n6. الموجة C غالباً تساوي الموجة A في الطول', svg: '<polyline points="10,15 45,50 60,30 100,70" fill="none" stroke="#ff6a00" stroke-width="2.5"/><circle cx="10" cy="15" r="2" fill="#ff6a00"/><circle cx="45" cy="50" r="2" fill="#ff6a00"/><circle cx="60" cy="30" r="2" fill="#ff6a00"/><circle cx="100" cy="70" r="2" fill="#ff6a00"/><text x="8" y="12" fill="#fff" font-size="7" font-family="Share Tech Mono">0</text><text x="43" y="58" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">A</text><text x="62" y="28" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">B</text><text x="98" y="76" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">C</text>' },
            { name: 'Flat Correction (3-3-5)', ar: 'التصحيح المسطح', rel: 80, type: 'SIDEWAYS', desc: 'تصحيح جانبي أقل حدة من الزيجزاج. الهيكل 3-3-5. الموجة B تعود تقريباً لبداية الموجة A والموجة C تصل تقريباً لنهاية A. يُظهر سوق قوي لا يريد التصحيح بعمق. شائع في موقع الموجة 4.', fib: 'الموجة A: تصحح 23.6%-38.2% فقط من الدافعة\nالموجة B: ترتد 78.6%-100% من الموجة A\nالموجة C: تساوي الموجة A (100%) أو 100%-123.6% منها\nالتصحيح الكلي: ضحل — 23.6%-38.2%', rules: '1. الهيكل: 3-3-5 (A من 3، B من 3، C من 5)\n2. الموجة B تعود تقريباً لبداية A (78.6%-100%)\n3. الموجة C تصل لنهاية A أو تتجاوزها قليلاً\n4. تصحيح جانبي وليس حاد\n5. شائع في موقع الموجة 4\n6. يدل على قوة الاتجاه الرئيسي', svg: '<polyline points="10,20 40,45 68,22 100,48" fill="none" stroke="#ff6a00" stroke-width="2.5"/><line x1="10" y1="20" x2="110" y2="20" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="40" y1="45" x2="110" y2="45" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="38" y="53" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">A</text><text x="66" y="19" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">B</text><text x="98" y="56" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">C</text><text x="70" y="75" fill="#888" font-size="6" font-family="Share Tech Mono">FLAT 3-3-5</text>' },
            { name: 'Expanded Flat', ar: 'التصحيح المسطح الممتد', rel: 78, type: 'STRONG TREND', desc: 'نسخة أقوى من التصحيح المسطح. الموجة B تتجاوز بداية الموجة A والموجة C تتجاوز نهاية A بقوة. يدل على اتجاه رئيسي قوي جداً. الأكثر شيوعاً بين أنواع التصحيح المسطح.', fib: 'الموجة B: تمتد 100%-138.2% من الموجة A (تتجاوزها)\nالموجة C: تمتد 100%-161.8% من الموجة A\nأو تمتد 161.8%-261.8% من الموجة B\nالموجة C تتجاوز نهاية A بوضوح', rules: '1. الهيكل: 3-3-5\n2. الموجة B تتجاوز بداية A (تصنع قمة/قاع جديد)\n3. الموجة C تتجاوز نهاية A بوضوح\n4. أكثر أنواع Flat شيوعاً\n5. يدل على قوة الاتجاه الرئيسي\n6. مُربك لأن B تبدو كاستمرار للترند', svg: '<polyline points="10,25 35,42 70,15 105,55" fill="none" stroke="#ff6a00" stroke-width="2.5"/><line x1="10" y1="25" x2="110" y2="25" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="35" y1="42" x2="110" y2="42" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="33" y="50" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">A</text><text x="68" y="13" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">B</text><text x="103" y="63" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">C</text><text x="72" y="10" fill="#888" font-size="5" font-family="Share Tech Mono">ABOVE START</text>' },
            { name: 'Triangle (A-B-C-D-E)', ar: 'المثلث التصحيحي', rel: 82, type: 'WAVE 4 / B', desc: 'تصحيح جانبي من 5 موجات (A-B-C-D-E) كل منها 3 موجات فرعية (هيكل 3-3-3-3-3). يأخذ شكل مثلث متقلص. يظهر حصرياً في الموجة 4 أو B (لا يظهر في الموجة 2 أبداً). بعد اكتمال المثلث يحدث كسر حاد وسريع (Thrust) في اتجاه الترند. الهدف يساوي أوسع نقطة في المثلث.', fib: 'الموجة B: 61.8%-78.6% من الموجة A\nالموجة C: 61.8%-78.6% من الموجة B\nالموجة D: 61.8%-78.6% من الموجة C\nالموجة E: 61.8%-78.6% من الموجة D\nThrust بعد المثلث: يساوي أوسع نقطة (A)', rules: '1. 5 موجات: A-B-C-D-E بهيكل 3-3-3-3-3\n2. كل موجة أقصر من السابقة (متقلص)\n3. يظهر فقط في الموجة 4 أو B (لا في 2 أبداً)\n4. بعد الاكتمال: كسر حاد (Thrust) في اتجاه الترند\n5. الموجة E قد لا تصل لخط المثلث (تقصر)\n6. الهدف بعد الكسر = أوسع نقطة في المثلث', svg: '<polyline points="8,22 28,58 48,30 64,50 78,36 88,44" fill="none" stroke="#ff6a00" stroke-width="2"/><line x1="8" y1="22" x2="100" y2="38" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="28" y1="58" x2="100" y2="42" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="88" y1="44" x2="110" y2="15" stroke="#fff" stroke-width="2" stroke-dasharray="4,3"/><text x="6" y="19" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">A</text><text x="26" y="65" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">B</text><text x="46" y="27" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">C</text><text x="62" y="57" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">D</text><text x="76" y="33" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">E</text><text x="96" y="18" fill="#fff" font-size="6" font-family="Share Tech Mono">THRUST</text>' },
            { name: 'Double Zigzag (WXY)', ar: 'الزيجزاج المزدوج', rel: 72, type: 'DEEP CORRECTION', desc: 'تصحيح عميق ومعقد يتكون من زيجزاجين متصلين بموجة ربط X. الهيكل: W (زيجزاج أول) → X (موجة ربط) → Y (زيجزاج ثاني). يظهر عندما يكون الزيجزاج الأول غير كافي لإكمال التصحيح المطلوب.', fib: 'الموجة X: ترتد 38.2%-78.6% من الموجة W\nالموجة Y: تساوي الموجة W (100%) أو 61.8%-161.8% منها\nالتصحيح الكلي: 61.8%-78.6% من الموجة الدافعة\nأعمق من الزيجزاج المفرد', rules: '1. يتكون من زيجزاجين (W و Y) متصلين بموجة X\n2. كل زيجزاج بهيكل 5-3-5\n3. الموجة X أقصر من W\n4. الموجة Y غالباً تساوي W في الطول\n5. تصحيح أعمق من الزيجزاج المفرد\n6. يظهر عندما التصحيح الأول غير كافي', svg: '<polyline points="8,12 25,40 35,25 52,55 60,42 70,48 82,62 92,50 108,72" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="25" y="47" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">W</text><text x="60" y="39" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">X</text><text x="108" y="78" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">Y</text>' },
            { name: 'Triple Zigzag (WXYXZ)', ar: 'الزيجزاج الثلاثي', rel: 60, type: 'RARE / DEEP', desc: 'أندر وأعقد أشكال التصحيح — 3 زيجزاجات متصلة بموجتي ربط X. نادر الحدوث لكنه ينتج تصحيح عميق جداً. كل زيجزاج بهيكل 5-3-5.', fib: 'الموجة Y: تساوي W (100%)\nالموجة Z: تساوي W أو Y (100%)\nالتصحيح الكلي: 78.6%-100% من الموجة الدافعة\nنادر جداً — أعمق تصحيح ممكن', rules: '1. 3 زيجزاجات (W, Y, Z) متصلة بموجتي X\n2. كل زيجزاج بهيكل 5-3-5\n3. نادر جداً الحدوث\n4. ينتج تصحيح عميق جداً\n5. كل موجة X أقصر من الزيجزاج الذي يسبقها\n6. الحد الأقصى للتعقيد — لا يوجد رباعي', svg: '<polyline points="6,10 18,30 24,20 36,42 42,35 48,38 55,50 62,42 72,58 78,52 84,55 94,68 100,60 112,75" fill="none" stroke="#ff6a00" stroke-width="1.5"/><text x="18" y="37" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">W</text><text x="42" y="32" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">X</text><text x="55" y="57" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">Y</text><text x="78" y="49" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">X</text><text x="94" y="75" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">Z</text>' }
        ]
    },
    fibonacci: {
        en: 'FIBONACCI GUIDE', label: 'دليل فيبوناتشي',
        patterns: [
            { name: 'Wave 2 Fibonacci Levels', ar: 'مستويات فيبوناتشي — الموجة 2', rel: 90, type: 'RETRACEMENT', desc: 'الموجة 2 هي أول تصحيح بعد الموجة 1 الدافعة. ترتد عادة بين 50% و78.6% من الموجة 1. المستوى الأكثر شيوعاً هو 61.8% (النسبة الذهبية). القاعدة المطلقة: الموجة 2 لا تتجاوز بداية الموجة 1 أبداً (إذا تجاوزتها فالترقيم خاطئ). التصحيح العميق (61.8%-78.6%) يكون عادة حاد وسريع (Zigzag). التصحيح الضحل (38.2%-50%) يكون جانبي (Flat).', fib: '38.2%: تصحيح ضحل — سوق قوي جداً\n50.0%: المستوى الأكثر توازناً\n61.8%: النسبة الذهبية — الأكثر شيوعاً للموجة 2\n78.6%: تصحيح عميق — مقبول لكن على الحد\n100%+: ممنوع — يبطل الترقيم', rules: '1. لا تتجاوز بداية الموجة 1 أبداً (قاعدة مطلقة)\n2. المستوى الأكثر شيوعاً: 61.8%\n3. التصحيح الحاد (Zigzag): 50%-78.6%\n4. التصحيح الجانبي (Flat): 38.2%-50%\n5. قاعدة التناوب: إذا 2 حادة فـ 4 جانبية\n6. الحجم يتناقص خلال الموجة 2', svg: '<line x1="15" y1="70" x2="15" y2="10" stroke="#fff" stroke-width="1.5"/><line x1="15" y1="70" x2="105" y2="70" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="10" x2="105" y2="10" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="47" x2="105" y2="47" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><line x1="15" y1="33" x2="105" y2="33" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><line x1="15" y1="23" x2="105" y2="23" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><text x="107" y="72" fill="#888" font-size="6" font-family="Share Tech Mono">0%</text><text x="107" y="49" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">38.2%</text><text x="107" y="42" fill="#888" font-size="6" font-family="Share Tech Mono">50%</text><text x="107" y="35" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">61.8%</text><text x="107" y="25" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">78.6%</text><text x="107" y="12" fill="#888" font-size="6" font-family="Share Tech Mono">100%</text><polyline points="20,70 40,10 70,35" fill="none" stroke="#fff" stroke-width="2"/><text x="38" y="8" fill="#fff" font-size="7" font-family="Share Tech Mono">1</text><text x="72" y="40" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">2</text>' },
            { name: 'Wave 3 Fibonacci Targets', ar: 'أهداف فيبوناتشي — الموجة 3', rel: 95, type: 'EXTENSION', desc: 'الموجة 3 هي الأقوى وأهدافها تُحسب كامتداد فيبوناتشي من الموجة 1. المستوى الأكثر شيوعاً هو 161.8%. إذا كان الترند قوي قد تصل 200% أو 261.8%. في الأسواق الانفجارية مثل الكريبتو قد تصل 423.6%. الهدف يُحسب من بداية الموجة 1 لنهايتها ثم يُسقط من نهاية الموجة 2.', fib: '100%: الحد الأدنى (الموجة 3 = الموجة 1)\n161.8%: الهدف الأكثر شيوعاً\n200.0%: هدف ثاني في الأسواق القوية\n261.8%: هدف ممتد في الأسواق الانفجارية\n423.6%: نادر — فقط في أسواق متطرفة', rules: '1. الموجة 3 لا تكون الأقصر أبداً (قاعدة مطلقة)\n2. الهدف الشائع: 161.8% من الموجة 1\n3. يُحسب من بداية الموجة 1 ويُسقط من نهاية الموجة 2\n4. إذا تجاوزت 161.8% فالهدف التالي 261.8%\n5. الحجم والزخم يجب أن يكونا الأقوى\n6. الفجوات السعرية شائعة في منتصفها', svg: '<line x1="10" y1="70" x2="10" y2="5" stroke="#fff" stroke-width="1"/><line x1="10" y1="70" x2="110" y2="70" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="40" x2="110" y2="40" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="21" x2="110" y2="21" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><line x1="10" y1="10" x2="110" y2="10" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><text x="112" y="72" fill="#888" font-size="6" font-family="Share Tech Mono">0%</text><text x="112" y="42" fill="#888" font-size="6" font-family="Share Tech Mono">100%</text><text x="112" y="23" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">161.8%</text><text x="112" y="12" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">261.8%</text><polyline points="15,70 35,40 45,55 75,21" fill="none" stroke="#fff" stroke-width="2"/><text x="33" y="37" fill="#fff" font-size="7" font-family="Share Tech Mono">1</text><text x="47" y="60" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">2</text><text x="77" y="19" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">3</text>' },
            { name: 'Wave 4 Fibonacci Levels', ar: 'مستويات فيبوناتشي — الموجة 4', rel: 88, type: 'RETRACEMENT', desc: 'الموجة 4 تصحيح أقل عمقاً من الموجة 2 (قاعدة التناوب). ترتد عادة 23.6%-38.2% من الموجة 3. المستوى الأكثر شيوعاً هو 38.2%. القاعدة المطلقة: لا تدخل منطقة الموجة 1 السعرية. التصحيح الجانبي (Flat أو Triangle) أكثر شيوعاً من الحاد في الموجة 4. منطقة شراء مثالية للموجة 5 القادمة.', fib: '23.6%: تصحيح ضحل جداً — اتجاه قوي جداً\n38.2%: المستوى الأكثر شيوعاً للموجة 4\n50.0%: الحد الأقصى المعتاد\nلا تدخل منطقة الموجة 1 أبداً\nقاعدة التناوب مع الموجة 2', rules: '1. لا تدخل منطقة الموجة 1 السعرية (قاعدة مطلقة)\n2. المستوى الأكثر شيوعاً: 38.2%\n3. أقل عمقاً من الموجة 2 (قاعدة التناوب)\n4. Flat أو Triangle أكثر شيوعاً من Zigzag\n5. إذا كانت 2 حادة فـ 4 جانبية والعكس\n6. منطقة شراء مثالية للموجة 5 القادمة', svg: '<line x1="15" y1="10" x2="15" y2="70" stroke="#fff" stroke-width="1"/><line x1="15" y1="10" x2="105" y2="10" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="24" x2="105" y2="24" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><line x1="15" y1="33" x2="105" y2="33" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><line x1="15" y1="70" x2="105" y2="70" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="55" x2="105" y2="55" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><text x="107" y="12" fill="#888" font-size="6" font-family="Share Tech Mono">0%</text><text x="107" y="26" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">23.6%</text><text x="107" y="35" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">38.2%</text><text x="107" y="57" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">W1 ZONE</text><text x="107" y="72" fill="#888" font-size="6" font-family="Share Tech Mono">100%</text><polyline points="20,70 60,10 80,33" fill="none" stroke="#fff" stroke-width="2"/><text x="58" y="8" fill="#fff" font-size="7" font-family="Share Tech Mono">3</text><text x="82" y="38" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">4</text>' }
        ]
    }
};

function ewRender() {
    var cat = ewData[ewCurrentCat];
    if (!cat) return;
    var el = document.getElementById('ew-content');
    if (!el) return;
    if (ewSelectedIdx >= 0 && ewSelectedIdx < cat.patterns.length) {
        el.innerHTML = ewRenderDetail(cat.patterns[ewSelectedIdx]);
        return;
    }
    var h = '<div class="ew-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        var isBear = p.type && (p.type.indexOf('CORRECTION') >= 0 || p.type.indexOf('DEEP') >= 0 || p.type.indexOf('EXHAUST') >= 0);
        var isFib = ewCurrentCat === 'fibonacci';
        var topC = isBear ? '#ff6a00' : isFib ? '#ff6a00' : ewCurrentCat === 'corrective' ? '#ff6a00' : '#fff';
        h += '<div class="ew-card" style="border-top:3px solid ' + topC + '" onclick="ewSelect(' + i + ')">';
        h += '<div class="ew-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%"><rect width="120" height="80" fill="#000"/>' + p.svg + '</svg></div>';
        h += '<div class="ew-card-name">' + p.name + '</div>';
        h += '<div class="ew-card-ar">' + p.ar + '</div>';
        if (p.type) { h += '<div class="ew-card-type">' + p.type + '</div>'; }
        h += '<div class="ew-card-rel-row"><span class="ew-card-rel-l">RELIABILITY</span><span class="ew-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="ew-card-bar"><div class="ew-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="ew-footer">موسوعة تعليمية شاملة لنظرية موجات إليوت. النظرية لا تضمن نتائج — استخدمها مع أدوات التحليل الأخرى وإدارة المخاطر. الترقيم الموجي يحتاج خبرة وممارسة. القواعد المطلقة الثلاث لا يمكن كسرها أبداً وإلا يكون الترقيم خاطئ. SPOT ONLY — تحليل مرجعي تعليمي وليس نصيحة مالية.</div>';
    el.innerHTML = h;
}

function ewRenderDetail(p) {
    var h = '<div class="ew-back" onclick="ewBack()">رجوع</div>';
    h += '<div class="ew-detail">';
    h += '<div class="ew-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%"><rect width="120" height="80" fill="#000"/>' + p.svg + '</svg></div>';
    h += '<div class="ew-detail-name">' + p.name + '</div>';
    h += '<div class="ew-detail-ar">' + p.ar + '</div>';
    if (p.type) { h += '<div class="ew-detail-badge">' + p.type + '</div>'; }
    h += '<div class="ew-detail-rel-row"><span class="ew-detail-rel-l">RELIABILITY</span><span class="ew-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
    h += '<div class="ew-detail-bar"><div class="ew-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    h += '<div class="ew-detail-desc-wrap"><div class="ew-detail-desc-label">DESCRIPTION // الوصف</div><div class="ew-detail-desc">' + p.desc + '</div></div>';
    h += '<div class="ew-detail-fib-wrap"><div class="ew-detail-fib-label">FIBONACCI RATIOS // نسب فيبوناتشي</div>';
    var fibs = p.fib.split('\n');
    for (var i = 0; i < fibs.length; i++) {
        h += '<div class="ew-fib-row"><span class="ew-fib-arrow">▶</span><span class="ew-fib-text">' + fibs[i] + '</span></div>';
    }
    h += '</div>';
    h += '<div class="ew-detail-rules-wrap"><div class="ew-detail-rules-label">RULES // الشروط والقواعد</div>';
    var rules = p.rules.split('\n');
    for (var i = 0; i < rules.length; i++) {
        h += '<div class="ew-rule-row"><span class="ew-rule-num">' + rules[i].substring(0, 2) + '</span><span class="ew-rule-text">' + rules[i].substring(3) + '</span></div>';
    }
    h += '</div></div>';
    return h;
}

/* =====================================================================
   WYCKOFF ACADEMY ENGINE — LEARN HUB 360
   ===================================================================== */

var wkCurrentCat = 'accum';
var wkSelectedIdx = -1;

function wkSetCat(cat, btn) {
    wkCurrentCat = cat;
    wkSelectedIdx = -1;
    var btns = document.querySelectorAll('.wk-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('wk-cat-active');
    if (btn) btn.classList.add('wk-cat-active');
    wkRender();
}

function wkSelect(idx) { wkSelectedIdx = idx; wkRender(); }
function wkBack() { wkSelectedIdx = -1; wkRender(); }

function wkInit() {
    var tabsEl = document.getElementById('wk-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var keys = Object.keys(wkData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = wkData[k];
        h += '<button class="wk-cat-btn' + (k === wkCurrentCat ? ' wk-cat-active' : '') + '" onclick="wkSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    wkRender();
}

// ==================== ACCUMULATION SCHEMATIC SVG ====================
var wkAccumSVG = '<rect width="800" height="340" fill="#000"/>'
// Support & Resistance
+ '<line x1="20" y1="80" x2="780" y2="80" stroke="#333" stroke-width="0.8" stroke-dasharray="4,4"/>'
+ '<line x1="20" y1="240" x2="780" y2="240" stroke="#333" stroke-width="0.8" stroke-dasharray="4,4"/>'
+ '<text x="782" y="78" fill="#888" font-size="11" font-family="Share Tech Mono" text-anchor="start">RESISTANCE (CREEK)</text>'
+ '<text x="782" y="238" fill="#888" font-size="11" font-family="Share Tech Mono" text-anchor="start">SUPPORT (ICE)</text>'
// Phase labels top
+ '<text x="80" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE A</text>'
+ '<text x="230" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE B</text>'
+ '<text x="420" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE C</text>'
+ '<text x="560" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE D</text>'
+ '<text x="700" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE E</text>'
// Phase dividers
+ '<line x1="155" y1="28" x2="155" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
+ '<line x1="330" y1="28" x2="330" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
+ '<line x1="490" y1="28" x2="490" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
+ '<line x1="630" y1="28" x2="630" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
// Price action
+ '<polyline points="20,40 40,60 55,180 65,100 80,120 95,240 105,200 120,160 135,100 150,130 170,110 190,140 210,100 230,130 250,110 270,140 290,120 310,150 325,130 340,140 360,130 380,260 395,220 410,180 430,100 450,80 470,90 490,70 520,60 550,50 580,55 610,45 650,50 680,40 720,35 760,30" fill="none" stroke="#fff" stroke-width="2.5"/>'
// Key points
+ '<circle cx="55" cy="180" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="55" y="198" fill="#fff" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PS</text>'
+ '<circle cx="95" cy="240" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="95" y="258" fill="#fff" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">SC</text>'
+ '<circle cx="135" cy="100" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="135" y="93" fill="#fff" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">AR</text>'
+ '<circle cx="150" cy="130" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="150" y="148" fill="#ff6a00" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">ST</text>'
+ '<circle cx="380" cy="260" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="380" y="278" fill="#ff6a00" font-size="14" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">SPRING</text>'
+ '<circle cx="430" cy="100" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="430" y="93" fill="#fff" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">TEST</text>'
+ '<circle cx="490" cy="70" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="490" y="63" fill="#fff" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">SOS</text>'
+ '<circle cx="550" cy="50" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="550" y="43" fill="#fff" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">LPS</text>'
+ '<circle cx="680" cy="40" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="680" y="33" fill="#fff" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">BU</text>'
// Volume bars
+ '<rect x="50" y="295" width="12" height="40" fill="#ff6a00" opacity="0.9"/>'
+ '<rect x="90" y="285" width="12" height="50" fill="#ff6a00" opacity="0.9"/>'
+ '<rect x="130" y="300" width="12" height="35" fill="#fff" opacity="0.7"/>'
+ '<rect x="170" y="310" width="12" height="25" fill="#888" opacity="0.5"/>'
+ '<rect x="210" y="312" width="12" height="23" fill="#888" opacity="0.5"/>'
+ '<rect x="250" y="314" width="12" height="21" fill="#888" opacity="0.4"/>'
+ '<rect x="290" y="315" width="12" height="20" fill="#888" opacity="0.4"/>'
+ '<rect x="375" y="288" width="12" height="47" fill="#ff6a00" opacity="0.9"/>'
+ '<rect x="425" y="310" width="12" height="25" fill="#fff" opacity="0.6"/>'
+ '<rect x="485" y="290" width="12" height="45" fill="#fff" opacity="0.9"/>'
+ '<rect x="545" y="312" width="12" height="23" fill="#fff" opacity="0.5"/>'
+ '<rect x="610" y="305" width="12" height="30" fill="#fff" opacity="0.7"/>'
+ '<rect x="675" y="295" width="12" height="40" fill="#fff" opacity="0.8"/>'
+ '<rect x="720" y="290" width="12" height="45" fill="#fff" opacity="0.9"/>'
+ '<text x="400" y="338" fill="#888" font-size="10" font-family="Share Tech Mono" text-anchor="middle">VOLUME</text>';

// ==================== DISTRIBUTION SCHEMATIC SVG ====================
var wkDistSVG = '<rect width="800" height="340" fill="#000"/>'
+ '<line x1="20" y1="100" x2="780" y2="100" stroke="#333" stroke-width="0.8" stroke-dasharray="4,4"/>'
+ '<line x1="20" y1="240" x2="780" y2="240" stroke="#333" stroke-width="0.8" stroke-dasharray="4,4"/>'
+ '<text x="782" y="98" fill="#888" font-size="11" font-family="Share Tech Mono" text-anchor="start">RESISTANCE (ICE)</text>'
+ '<text x="782" y="238" fill="#888" font-size="11" font-family="Share Tech Mono" text-anchor="start">SUPPORT (CREEK)</text>'
+ '<text x="80" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE A</text>'
+ '<text x="230" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE B</text>'
+ '<text x="420" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE C</text>'
+ '<text x="560" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE D</text>'
+ '<text x="700" y="22" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PHASE E</text>'
+ '<line x1="155" y1="28" x2="155" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
+ '<line x1="330" y1="28" x2="330" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
+ '<line x1="490" y1="28" x2="490" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
+ '<line x1="630" y1="28" x2="630" y2="280" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="3,3"/>'
// Price — distribution (inverted accumulation)
+ '<polyline points="20,250 40,230 55,120 65,180 80,160 95,100 105,130 120,160 135,200 150,170 170,180 190,160 210,180 230,160 250,170 270,155 290,165 310,150 325,160 340,155 360,150 380,80 395,120 410,160 430,200 450,240 470,220 490,230 520,245 550,250 580,248 610,255 650,260 680,265 720,270 760,280" fill="none" stroke="#ff6a00" stroke-width="2.5"/>'
// Key points
+ '<circle cx="55" cy="120" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="55" y="113" fill="#ff6a00" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">PSY</text>'
+ '<circle cx="95" cy="100" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="95" y="93" fill="#ff6a00" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">BC</text>'
+ '<circle cx="135" cy="200" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="135" y="218" fill="#ff6a00" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">AR</text>'
+ '<circle cx="150" cy="170" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="150" y="163" fill="#fff" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">ST</text>'
+ '<circle cx="380" cy="80" r="5" fill="none" stroke="#fff" stroke-width="2"/>'
+ '<text x="380" y="73" fill="#fff" font-size="14" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">UTAD</text>'
+ '<circle cx="430" cy="200" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="430" y="218" fill="#ff6a00" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">TEST</text>'
+ '<circle cx="490" cy="230" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="490" y="248" fill="#ff6a00" font-size="13" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">SOW</text>'
+ '<circle cx="550" cy="250" r="5" fill="none" stroke="#ff6a00" stroke-width="2"/>'
+ '<text x="550" y="268" fill="#ff6a00" font-size="12" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">LPSY</text>'
// Volume
+ '<rect x="50" y="295" width="12" height="40" fill="#fff" opacity="0.9"/>'
+ '<rect x="90" y="285" width="12" height="50" fill="#fff" opacity="0.9"/>'
+ '<rect x="130" y="300" width="12" height="35" fill="#ff6a00" opacity="0.7"/>'
+ '<rect x="170" y="310" width="12" height="25" fill="#888" opacity="0.5"/>'
+ '<rect x="210" y="312" width="12" height="23" fill="#888" opacity="0.5"/>'
+ '<rect x="250" y="314" width="12" height="21" fill="#888" opacity="0.4"/>'
+ '<rect x="290" y="315" width="12" height="20" fill="#888" opacity="0.4"/>'
+ '<rect x="375" y="288" width="12" height="47" fill="#fff" opacity="0.9"/>'
+ '<rect x="425" y="310" width="12" height="25" fill="#ff6a00" opacity="0.6"/>'
+ '<rect x="485" y="295" width="12" height="40" fill="#ff6a00" opacity="0.9"/>'
+ '<rect x="545" y="305" width="12" height="30" fill="#ff6a00" opacity="0.7"/>'
+ '<rect x="610" y="300" width="12" height="35" fill="#ff6a00" opacity="0.8"/>'
+ '<rect x="675" y="295" width="12" height="40" fill="#ff6a00" opacity="0.9"/>'
+ '<rect x="720" y="290" width="12" height="45" fill="#ff6a00" opacity="0.9"/>'
+ '<text x="400" y="338" fill="#888" font-size="10" font-family="Share Tech Mono" text-anchor="middle">VOLUME</text>';

// ==================== DATA (COMPLETE & UNTOUCHED) ====================
var wkData = {
    accum: {
        en: 'ACCUMULATION', label: 'نموذج التجميع',
        patterns: [
            { name: 'Accumulation Schematic', ar: 'المخطط التجميعي الكامل', rel: 90, type: 'BULLISH', hasChart: true, desc: 'نموذج وايكوف التجميعي يُظهر كيف تقوم المؤسسات (Smart Money) بشراء كميات ضخمة من الأصل بشكل خفي على مراحل متعددة دون رفع السعر بشكل ملحوظ. يتكون من 5 مراحل (A-E) كل منها لها خصائص سعرية وحجمية محددة. الهدف النهائي هو تجميع أكبر كمية ممكنة بأقل سعر قبل إطلاق الاتجاه الصعودي الكبير (Markup). فهم هذا النموذج يمنحك القدرة على الدخول مع المؤسسات وليس ضدها.', fib: 'لا يستخدم فيبوناتشي بشكل مباشر\nSpring: يكسر الدعم بنسبة 1-3% ثم يعود\nSOS: يكسر المقاومة بوضوح\nالهدف بعد الـ Markup: يُحسب من عرض النطاق التجميعي', rules: '1. Phase A: وقف الاتجاه الهابط (PS → SC → AR → ST)\n2. Phase B: بناء السبب — تذبذب جانبي طويل مع تناقص الحجم\n3. Phase C: الاختبار النهائي — Spring يكسر الدعم ويعود فوراً\n4. Phase D: بداية الصعود — SOS يكسر المقاومة + LPS يختبرها\n5. Phase E: الصعود الكامل — Markup مع حجم مرتفع\n6. الحجم يتناقص في B ويرتفع بقوة في Spring و SOS', svg: wkAccumSVG },
            { name: 'Phase A — Stopping the Downtrend', ar: 'المرحلة A — إيقاف الهبوط', rel: 85, type: 'PHASE A', desc: 'أول مرحلة في التجميع — هدفها إيقاف الاتجاه الهابط السابق. تبدأ بـ PS (Preliminary Support) وهو أول دعم مبدئي يُبطئ الهبوط. ثم SC (Selling Climax) وهو ذروة البيع — هبوط حاد بحجم ضخم يُظهر استسلام البائعين الأخيرين (Capitulation). بعده AR (Automatic Rally) ارتداد تلقائي سريع يحدد المقاومة العليا. وأخيراً ST (Secondary Test) اختبار ثانوي لمنطقة SC بحجم أقل — يؤكد أن البيع انتهى.', fib: 'PS: أول مستوى دعم — حجم مرتفع مع تباطؤ الهبوط\nSC: ذروة بيع — أعلى حجم + أطول شمعة هبوطية\nAR: ارتداد تلقائي — يحدد سقف النطاق التجميعي\nST: اختبار SC بحجم أقل — يؤكد القاع', rules: '1. PS: أول دعم مبدئي يُبطئ الهبوط — حجم يبدأ بالارتفاع\n2. SC: ذروة بيع حادة — أعلى حجم + شموع هابطة طويلة + Capitulation\n3. AR: ارتداد تلقائي سريع بعد SC — يحدد المقاومة العليا للنطاق\n4. ST: اختبار ثانوي لمنطقة SC بحجم أقل بوضوح\n5. ST لا يكسر قاع SC (إذا كسره فالتجميع لم يبدأ بعد)\n6. نطاق التداول يُحدد بين AR (مقاومة) و SC (دعم)', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,20 25,30 35,55 45,68 55,45 65,35 75,50 85,42 95,48 110,44" fill="none" stroke="#fff" stroke-width="2"/><text x="35" y="12" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">PS</text><text x="45" y="78" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">SC</text><text x="65" y="30" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">AR</text><text x="85" y="54" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">ST</text><line x1="10" y1="68" x2="110" y2="68" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="35" x2="110" y2="35" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/>' },
            { name: 'Phase B — Building the Cause', ar: 'المرحلة B — بناء السبب', rel: 80, type: 'PHASE B', desc: 'أطول مرحلة في التجميع — قد تستمر أسابيع أو أشهر. هدفها بناء السبب (Cause) الذي سيُنتج النتيجة (Effect) وهي الصعود الكبير. المؤسسات تشتري بهدوء وانتظام — كل هبوط صغير فرصة شراء وكل صعود صغير يُباع فيه جزء لإبقاء السعر في النطاق. الحجم يتناقص تدريجياً مما يدل على امتصاص العرض. كلما طالت المرحلة B كان الصعود اللاحق أقوى (قانون السبب والنتيجة).', fib: 'الحجم يتناقص تدريجياً خلال المرحلة\nالتذبذب يضيق تدريجياً\nST in Phase B: اختبارات متكررة للدعم والمقاومة\nقانون السبب والنتيجة: طول المرحلة B = قوة الصعود', rules: '1. تذبذب جانبي بين الدعم (SC) والمقاومة (AR)\n2. الحجم يتناقص تدريجياً — امتصاص العرض\n3. اختبارات متكررة للدعم والمقاومة (ST in B)\n4. لا اتجاه واضح — مُربك للمتداولين العاديين\n5. كلما طالت المرحلة كان الصعود اللاحق أقوى\n6. المؤسسات تشتري في الهبوط وتبيع جزئياً في الصعود', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,35 20,45 30,35 40,42 50,38 60,44 70,36 80,42 90,38 100,40 110,37" fill="none" stroke="#fff" stroke-width="2"/><line x1="10" y1="30" x2="110" y2="30" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="48" x2="110" y2="48" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/><rect x="15" y="60" width="6" height="14" fill="#888" opacity="0.5"/><rect x="35" y="62" width="6" height="12" fill="#888" opacity="0.4"/><rect x="55" y="63" width="6" height="11" fill="#888" opacity="0.4"/><rect x="75" y="65" width="6" height="9" fill="#888" opacity="0.3"/><rect x="95" y="66" width="6" height="8" fill="#888" opacity="0.3"/><text x="60" y="78" fill="#888" font-size="6" font-family="Share Tech Mono">VOLUME DECLINING</text>' },
            { name: 'Phase C — Spring (The Test)', ar: 'المرحلة C — الاختبار النهائي (Spring)', rel: 92, type: 'PHASE C', desc: 'أهم مرحلة في التجميع وأكثرها حسماً. Spring هو كسر كاذب لمستوى الدعم (SC) يهدف لتصفية آخر البائعين وجمع Stop Loss المتداولين الذين وضعوا أوامرهم تحت الدعم. السعر يكسر الدعم بنسبة بسيطة (1-3%) ثم يعود فوراً فوقه بسرعة وبحجم مرتفع. هذا هو الفخ المؤسسي الكلاسيكي — يخيف الجميع ويجبرهم على البيع بينما المؤسسات تشتري كل شيء. Spring الناجح = آخر فرصة شراء قبل الصعود الكبير. Test بعد Spring بحجم منخفض يؤكد نجاحه.', fib: 'Spring: يكسر الدعم بـ 1-3% ثم يعود فوراً\nالحجم في Spring: مرتفع جداً (Climactic)\nTest بعد Spring: حجم منخفض جداً = تأكيد\nSpring الفاشل: يستمر في الهبوط = التجميع لم يكتمل', rules: '1. Spring يكسر مستوى الدعم (SC) بنسبة بسيطة\n2. الكسر سريع ويعود السعر فوق الدعم بسرعة\n3. الحجم مرتفع جداً أثناء الكسر (تصفية Stop Loss)\n4. Test بعد Spring: السعر يعود لمنطقة الدعم بحجم منخفض\n5. Test الناجح لا يكسر قاع Spring\n6. هذه هي أفضل نقطة دخول في نموذج التجميع بالكامل', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="40" x2="110" y2="40" stroke="#333" stroke-width="0.8" stroke-dasharray="2,2"/><polyline points="10,38 20,42 30,38 40,42 48,55 52,65 56,48 62,35 70,30 80,38 90,32 100,28 110,25" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="52" cy="65" r="4" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="52" y="78" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">SPRING</text><text x="80" y="44" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">TEST</text><rect x="47" y="55" width="8" height="18" fill="#ff6a00" opacity="0.8"/><rect x="77" y="60" width="8" height="8" fill="#fff" opacity="0.4"/>' },
            { name: 'Phase D — Markup Begins', ar: 'المرحلة D — بداية الصعود', rel: 88, type: 'PHASE D', desc: 'بعد نجاح Spring والاختبار، تبدأ المرحلة الأهم تجارياً. SOS (Sign of Strength) هو أول صعود قوي يكسر المقاومة (AR/Creek) بحجم مرتفع — إعلان رسمي بأن المؤسسات جاهزة لرفع السعر. LPS (Last Point of Support) هو آخر اختبار للمقاومة المكسورة التي أصبحت دعم — فرصة شراء أخيرة قبل الانطلاق. BU (Back-Up) هو العودة لاختبار منطقة الكسر — Pullback كلاسيكي.', fib: 'SOS: يكسر المقاومة بحجم مرتفع جداً\nLPS: يعود لاختبار المقاومة المكسورة بحجم منخفض\nBU: Back-Up لمنطقة الكسر\nالحجم يرتفع مع كل موجة صعودية', rules: '1. SOS: صعود قوي يكسر المقاومة (Creek) بحجم مرتفع\n2. LPS: اختبار المقاومة المكسورة كدعم جديد بحجم منخفض\n3. BU: عودة أخيرة لمنطقة الكسر — Pullback\n4. الحجم يرتفع في الصعود ويتناقص في التصحيح\n5. الشموع الصعودية أطول وأكثر من الهبوطية\n6. نقاط الدخول: LPS و BU', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="50" x2="110" y2="50" stroke="#333" stroke-width="0.8" stroke-dasharray="2,2"/><polyline points="10,55 20,48 30,42 40,35 50,28 60,22 68,32 75,38 80,44 85,35 92,28 100,18 110,12" fill="none" stroke="#fff" stroke-width="2.5"/><text x="50" y="22" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">SOS</text><text x="80" y="52" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">LPS</text><text x="92" y="22" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">BU</text><rect x="45" y="60" width="8" height="16" fill="#fff" opacity="0.9"/><rect x="75" y="66" width="8" height="8" fill="#fff" opacity="0.4"/><rect x="95" y="62" width="8" height="14" fill="#fff" opacity="0.8"/>' },
            { name: 'Phase E — Markup', ar: 'المرحلة E — الصعود الكامل', rel: 85, type: 'PHASE E', desc: 'المرحلة الأخيرة — الصعود الكامل (Markup). النتيجة (Effect) التي بُنيت خلال المراحل السابقة (Cause). السعر يرتفع بقوة مع حجم تداول مرتفع ومستمر. التصحيحات تكون قصيرة وضحلة. هذه المرحلة يمكن تحليلها بموجات إليوت (5 موجات دافعة). الهدف السعري يُحسب من عرض النطاق التجميعي (Point & Figure Count).', fib: 'الهدف = عرض النطاق التجميعي (من أيسر نقطة لأيمن نقطة)\nالتصحيحات: 23.6%-38.2% فقط — ضحلة\nالحجم: مرتفع ومستمر مع الصعود\nيمكن تطبيق موجات إليوت على هذه المرحلة', rules: '1. صعود قوي ومستمر مع حجم مرتفع\n2. التصحيحات قصيرة وضحلة (23.6%-38.2%)\n3. الشموع الصعودية طويلة ومهيمنة\n4. الهدف = عرض النطاق التجميعي\n5. يمكن تطبيق إليوت (5 موجات) على الصعود\n6. انتهاء Markup = بداية نموذج توزيعي جديد', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,68 20,60 30,55 38,58 45,48 55,42 60,45 68,35 78,28 85,32 92,22 100,15 110,10" fill="none" stroke="#fff" stroke-width="2.5"/><rect x="15" y="55" width="6" height="18" fill="#fff" opacity="0.7"/><rect x="35" y="52" width="6" height="22" fill="#fff" opacity="0.8"/><rect x="55" y="50" width="6" height="24" fill="#fff" opacity="0.8"/><rect x="75" y="48" width="6" height="26" fill="#fff" opacity="0.9"/><rect x="95" y="45" width="6" height="30" fill="#fff" opacity="0.9"/><text x="60" y="78" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">MARKUP</text>' }
        ]
    },
    distrib: {
        en: 'DISTRIBUTION', label: 'نموذج التصريف',
        patterns: [
            { name: 'Distribution Schematic', ar: 'المخطط التصريفي الكامل', rel: 90, type: 'BEARISH', hasChart: true, desc: 'عكس نموذج التجميع — يُظهر كيف تبيع المؤسسات ممتلكاتها بشكل خفي على مراحل. يتكون من 5 مراحل (A-E). بدلاً من Spring يوجد UTAD (Upthrust After Distribution) وهو كسر كاذب للمقاومة. الحجم يرتفع في بداية التصريف ويتحول الارتفاع في الحجم للشموع الهبوطية. فهم هذا النموذج يحميك من الشراء في القمة.', fib: 'UTAD: يكسر المقاومة بنسبة 1-3% ثم يعود\nSOW: أول كسر واضح للدعم\nLPSY: آخر ارتداد ضعيف قبل الهبوط\nالهدف بعد Markdown: عرض النطاق التصريفي', rules: '1. Phase A: وقف الصعود (PSY → BC → AR → ST)\n2. Phase B: تذبذب جانبي — المؤسسات تبيع بهدوء\n3. Phase C: UTAD — كسر كاذب للمقاومة ثم عودة\n4. Phase D: بداية الهبوط — SOW يكسر الدعم + LPSY\n5. Phase E: الهبوط الكامل — Markdown مع حجم مرتفع\n6. الحجم يرتفع في الهبوط ويتناقص في الارتداد', svg: wkDistSVG },
            { name: 'Phase A — Stopping the Uptrend', ar: 'المرحلة A — إيقاف الصعود', rel: 85, type: 'PHASE A', desc: 'إيقاف الاتجاه الصاعد. PSY (Preliminary Supply) أول عرض مبدئي يُبطئ الصعود. BC (Buying Climax) ذروة الشراء — صعود حاد بحجم ضخم يُظهر الحماس المفرط للمشترين العاديين بينما المؤسسات تبيع لهم. AR (Automatic Reaction) هبوط تلقائي يحدد الدعم. ST (Secondary Test) اختبار ثانوي لـ BC بحجم أقل.', fib: 'PSY: أول مقاومة — حجم مرتفع مع تباطؤ الصعود\nBC: ذروة شراء — أعلى حجم + أطول شمعة صعودية\nAR: هبوط تلقائي — يحدد قاع النطاق التصريفي\nST: اختبار BC بحجم أقل — يؤكد القمة', rules: '1. PSY: أول مقاومة تُبطئ الصعود — حجم يبدأ بالارتفاع\n2. BC: ذروة شراء — أعلى حجم + شموع صعودية طويلة + Euphoria\n3. AR: هبوط تلقائي بعد BC — يحدد الدعم السفلي للنطاق\n4. ST: اختبار ثانوي لمنطقة BC بحجم أقل بوضوح\n5. ST لا يتجاوز قمة BC (إذا تجاوزها فالتصريف لم يبدأ)\n6. النطاق يُحدد بين BC (مقاومة) و AR (دعم)', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,65 25,55 35,25 45,15 55,35 65,45 75,30 85,38 95,32 110,36" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="35" y="20" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">PSY</text><text x="45" y="12" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">BC</text><text x="65" y="52" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">AR</text><text x="85" y="44" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">ST</text><line x1="10" y1="15" x2="110" y2="15" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="45" x2="110" y2="45" stroke="#333" stroke-width="0.5" stroke-dasharray="2,2"/>' },
            { name: 'Phase C — UTAD (The Trap)', ar: 'المرحلة C — الفخ (UTAD)', rel: 92, type: 'PHASE C', desc: 'Upthrust After Distribution — أخطر مرحلة في التصريف. السعر يكسر المقاومة (BC) بشكل كاذب لجذب آخر المشترين المتفائلين وتصفية Stop Loss البائعين. مطابق لـ Spring لكن بالعكس. الحجم مرتفع جداً أثناء الكسر الكاذب. السعر يعود تحت المقاومة بسرعة — فخ مؤسسي كلاسيكي. بعده Test بحجم منخفض يؤكد أن الكسر كان كاذباً.', fib: 'UTAD: يكسر المقاومة بـ 1-3% ثم يعود تحتها\nالحجم في UTAD: مرتفع جداً (Climactic)\nTest بعد UTAD: حجم منخفض جداً = تأكيد الفخ\nUTAD الفاشل: يستمر في الصعود = التصريف لم يكتمل', rules: '1. UTAD يكسر المقاومة (BC) بنسبة بسيطة\n2. الكسر سريع ويعود السعر تحت المقاومة بسرعة\n3. حجم مرتفع جداً = تصفية Stop Loss البائعين\n4. Test بعد UTAD بحجم منخفض يؤكد الفخ\n5. Test لا يتجاوز قمة UTAD\n6. هذه أفضل نقطة بيع في نموذج التصريف بالكامل', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="40" x2="110" y2="40" stroke="#333" stroke-width="0.8" stroke-dasharray="2,2"/><polyline points="10,42 20,38 30,42 40,38 48,28 52,15 56,32 62,42 70,48 80,42 90,50 100,55 110,62" fill="none" stroke="#ff6a00" stroke-width="2.5"/><circle cx="52" cy="15" r="4" fill="none" stroke="#fff" stroke-width="2"/><text x="52" y="10" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">UTAD</text><text x="80" y="38" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">TEST</text><rect x="47" y="55" width="8" height="18" fill="#fff" opacity="0.8"/><rect x="77" y="64" width="8" height="8" fill="#ff6a00" opacity="0.4"/>' },
            { name: 'Phase D+E — Markdown', ar: 'المرحلة D+E — الهبوط الكامل', rel: 88, type: 'PHASE D+E', desc: 'SOW (Sign of Weakness) أول هبوط قوي يكسر الدعم (AR/Creek) بحجم مرتفع. LPSY (Last Point of Supply) آخر ارتداد ضعيف للدعم المكسور بحجم منخفض — آخر فرصة بيع. ثم Markdown الهبوط الكامل مع حجم مرتفع ومستمر.', fib: 'SOW: يكسر الدعم بحجم مرتفع\nLPSY: ارتداد ضعيف بحجم منخفض\nالهدف: عرض النطاق التصريفي\nالتصحيحات: قصيرة وضعيفة', rules: '1. SOW: هبوط قوي يكسر الدعم (Creek) بحجم مرتفع\n2. LPSY: ارتداد ضعيف لاختبار الدعم المكسور بحجم منخفض\n3. الحجم يرتفع في الهبوط ويتناقص في الارتداد\n4. الشموع الهبوطية طويلة ومهيمنة\n5. الهدف = عرض النطاق التصريفي\n6. انتهاء Markdown = بداية نموذج تجميعي جديد', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,15 18,20 25,25 32,22 40,32 48,38 55,35 62,42 70,50 78,48 85,55 92,60 100,65 110,72" fill="none" stroke="#ff6a00" stroke-width="2.5"/><text x="40" y="40" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">SOW</text><text x="55" y="30" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">LPSY</text><text x="85" y="50" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">MARKDOWN</text><rect x="35" y="55" width="6" height="20" fill="#ff6a00" opacity="0.8"/><rect x="55" y="62" width="6" height="8" fill="#ff6a00" opacity="0.4"/><rect x="75" y="52" width="6" height="24" fill="#ff6a00" opacity="0.9"/><rect x="95" y="50" width="6" height="26" fill="#ff6a00" opacity="0.9"/>' }
        ]
    },
    volume: {
        en: 'VOLUME GUIDE', label: 'دليل الفوليوم',
        patterns: [
            { name: 'Volume-Price Relationship', ar: 'علاقة الحجم بالسعر', rel: 95, type: 'CORE PRINCIPLE', desc: 'المبدأ الأساسي في وايكوف: الحجم يؤكد أو ينفي حركة السعر. صعود بحجم مرتفع = صعود حقيقي مدعوم بطلب مؤسسي. صعود بحجم منخفض = صعود ضعيف غير مدعوم سينعكس قريباً. هبوط بحجم مرتفع = بيع مؤسسي حقيقي. هبوط بحجم منخفض = تصحيح طبيعي سينتهي قريباً. التناقض بين السعر والحجم (Divergence) هو أقوى إشارة تحذيرية في التحليل الفني.', fib: 'صعود + حجم مرتفع = اتجاه صحي ومستمر\nصعود + حجم منخفض = ضعف — انعكاس قريب\nهبوط + حجم مرتفع = بيع مؤسسي — هبوط مستمر\nهبوط + حجم منخفض = تصحيح مؤقت — سينتهي\nDivergence = أقوى إشارة تحذيرية', rules: '1. الحجم يسبق السعر — ارتفاع الحجم يسبق الحركة الكبيرة\n2. صعود + حجم مرتفع = طلب مؤسسي حقيقي\n3. صعود + حجم منخفض = لا دعم — سينعكس\n4. هبوط + حجم مرتفع = عرض مؤسسي — استمرار الهبوط\n5. هبوط + حجم منخفض = نفاد العرض — نهاية التصحيح\n6. Climactic Volume (ذروة الحجم) = نهاية الحركة الحالية', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,55 25,45 40,35 55,25 70,20 85,18 100,15" fill="none" stroke="#fff" stroke-width="2"/><rect x="14" y="62" width="10" height="12" fill="#fff" opacity="0.5"/><rect x="29" y="58" width="10" height="16" fill="#fff" opacity="0.6"/><rect x="44" y="54" width="10" height="20" fill="#fff" opacity="0.7"/><rect x="59" y="50" width="10" height="24" fill="#fff" opacity="0.8"/><rect x="74" y="46" width="10" height="28" fill="#fff" opacity="0.9"/><rect x="89" y="42" width="10" height="32" fill="#fff" opacity="1"/><text x="55" y="12" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">HEALTHY UPTREND</text>' },
            { name: 'Climax Volume', ar: 'ذروة الحجم (Climax)', rel: 90, type: 'REVERSAL SIGNAL', desc: 'حجم تداول مرتفع بشكل استثنائي (2-3 أضعاف المتوسط أو أكثر) يظهر عند نهاية حركة سعرية قوية. Selling Climax: حجم ضخم + هبوط حاد = استسلام البائعين الأخيرين = قاع محتمل. Buying Climax: حجم ضخم + صعود حاد = نشوة المشترين الأخيرين = قمة محتملة. الـ Climax يعني أن أحد الأطراف استنفد كل طاقته.', fib: 'Selling Climax: أعلى حجم في الاتجاه الهابط\nBuying Climax: أعلى حجم في الاتجاه الصاعد\nعادة 2-3x المتوسط أو أكثر\nبعد الـ Climax: تقل الحركة وينخفض الحجم', rules: '1. حجم استثنائي (2-3x المتوسط أو أكثر)\n2. شمعة كبيرة جداً (أطول شمعة في الحركة)\n3. يظهر في نهاية الحركة وليس بدايتها\n4. Selling Climax = قاع محتمل (بداية تجميع)\n5. Buying Climax = قمة محتملة (بداية تصريف)\n6. بعده: الحجم ينخفض والسعر يتذبذب', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,20 20,25 30,30 40,35 50,40 55,50 58,62 60,70 62,55 65,42 70,35 80,30" fill="none" stroke="#ff6a00" stroke-width="2"/><rect x="12" y="62" width="7" height="10" fill="#ff6a00" opacity="0.4"/><rect x="22" y="60" width="7" height="12" fill="#ff6a00" opacity="0.5"/><rect x="32" y="58" width="7" height="14" fill="#ff6a00" opacity="0.5"/><rect x="42" y="55" width="7" height="18" fill="#ff6a00" opacity="0.6"/><rect x="55" y="38" width="10" height="35" fill="#ff6a00" opacity="1"/><rect x="68" y="56" width="7" height="16" fill="#fff" opacity="0.6"/><rect x="78" y="60" width="7" height="12" fill="#fff" opacity="0.4"/><text x="58" y="34" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">CLIMAX</text>' },
            { name: 'Volume Dry-Up', ar: 'جفاف الحجم', rel: 82, type: 'CONTINUATION', desc: 'انخفاض ملحوظ ومستمر في حجم التداول خلال فترة تصحيح أو تذبذب. يدل على أن العرض (في الصعود) أو الطلب (في الهبوط) قد نفد تماماً. في سياق التجميع: جفاف الحجم في Phase B يعني أن كل من أراد البيع قد باع — لم يبقَ عرض. في سياق تصحيح صعودي: جفاف الحجم يعني أن البائعين استنفدوا والصعود سيستمر.', fib: 'الحجم ينخفض لأقل من 50% من المتوسط\nيستمر عدة جلسات متتالية\nفي التجميع: نفاد العرض\nفي التصريف: نفاد الطلب\nبعد الجفاف: حركة انفجارية في اتجاه الترند', rules: '1. الحجم ينخفض لأقل من 50% من المتوسط\n2. يستمر عدة جلسات متتالية (3-5 على الأقل)\n3. السعر يتذبذب في نطاق ضيق\n4. في تصحيح صعودي: الصعود سيستمر بعد الجفاف\n5. في Phase B التجميعية: كل العرض تم امتصاصه\n6. الكسر بعد الجفاف يكون انفجاري وقوي', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,35 25,38 40,36 55,37 70,35 85,38 100,20 110,15" fill="none" stroke="#fff" stroke-width="2"/><rect x="14" y="55" width="8" height="18" fill="#888" opacity="0.6"/><rect x="29" y="60" width="8" height="13" fill="#888" opacity="0.4"/><rect x="44" y="63" width="8" height="10" fill="#888" opacity="0.3"/><rect x="59" y="65" width="8" height="8" fill="#888" opacity="0.3"/><rect x="74" y="67" width="8" height="6" fill="#888" opacity="0.2"/><rect x="89" y="52" width="8" height="22" fill="#fff" opacity="0.9"/><rect x="104" y="48" width="8" height="26" fill="#fff" opacity="1"/><text x="55" y="78" fill="#888" font-size="6" font-family="Share Tech Mono">DRY-UP</text><text x="100" y="46" fill="#fff" font-size="6" font-family="Share Tech Mono">BREAKOUT</text>' },
            { name: 'Effort vs Result', ar: 'الجهد مقابل النتيجة', rel: 88, type: 'DIVERGENCE', desc: 'مبدأ أساسي في وايكوف: الجهد (الحجم) يجب أن يتناسب مع النتيجة (حركة السعر). إذا ارتفع الحجم بقوة لكن السعر لم يتحرك كثيراً = الجهد لا يُنتج نتيجة = هناك قوة معاكسة تمتص الحركة. مثال: حجم بيع ضخم لكن السعر لم يهبط كثيراً = مشتري مؤسسي يمتص كل العرض = إشارة صعودية. والعكس: حجم شراء ضخم لكن السعر لم يصعد = بائع مؤسسي يوزع = إشارة هبوطية.', fib: 'حجم مرتفع + حركة صغيرة = قوة معاكسة خفية\nحجم منخفض + حركة كبيرة = حركة ضعيفة ستنعكس\nحجم مرتفع + حركة كبيرة = حركة حقيقية ومستمرة\nحجم منخفض + حركة صغيرة = لا اهتمام — انتظار', rules: '1. جهد كبير (حجم عالي) + نتيجة صغيرة = امتصاص مؤسسي\n2. جهد صغير + نتيجة كبيرة = حركة على فراغ سيولة\n3. جهد كبير + نتيجة كبيرة = حركة صحية مستمرة\n4. في الهبوط: حجم كبير + عدم هبوط = تجميع خفي\n5. في الصعود: حجم كبير + عدم صعود = تصريف خفي\n6. هذا المبدأ يكشف نوايا المؤسسات المخفية' }
        ]
    }
};

function wkRender() {
    var cat = wkData[wkCurrentCat];
    if (!cat) return;
    var el = document.getElementById('wk-content');
    if (!el) return;
    if (wkSelectedIdx >= 0 && wkSelectedIdx < cat.patterns.length) {
        el.innerHTML = wkRenderDetail(cat.patterns[wkSelectedIdx]);
        return;
    }
    var h = '<div class="wk-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        var isBear = p.type && (p.type.indexOf('BEAR') >= 0 || p.type === 'PHASE D+E');
        var topC = isBear ? '#ff6a00' : wkCurrentCat === 'volume' ? '#fff' : '#fff';
        if (p.hasChart) {
            h += '</div><div class="wk-schematic-card" style="border-top:3px solid ' + topC + '" onclick="wkSelect(' + i + ')">';
            h += '<div class="wk-schematic-title">' + p.ar + '</div>';
            h += '<div class="wk-schematic-sub">' + p.name + ' // ' + p.type + '</div>';
            h += '<div class="wk-schematic-svg"><svg viewBox="0 0 800 340" style="width:100%;height:auto">' + p.svg + '</svg></div>';
            h += '<div class="wk-schematic-hint">اضغط لعرض التفاصيل والمراحل</div>';
            h += '</div><div class="wk-grid">';
        } else {
            h += '<div class="wk-card" style="border-top:3px solid ' + topC + '" onclick="wkSelect(' + i + ')">';
            if(p.svg) {
                h += '<div class="wk-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
            }
            h += '<div class="wk-card-name">' + p.name + '</div>';
            h += '<div class="wk-card-ar">' + p.ar + '</div>';
            if (p.type) { h += '<div class="wk-card-type">' + p.type + '</div>'; }
            if (p.rel) {
                h += '<div class="wk-card-rel-row"><span class="wk-card-rel-l">RELIABILITY</span><span class="wk-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
                h += '<div class="wk-card-bar"><div class="wk-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
            }
            h += '</div>';
        }
    }
    h += '</div>';
    h += '<div class="wk-footer">موسوعة تعليمية شاملة لمنهجية وايكوف في التحليل الفني. تحليل الحجم (Volume Analysis) هو حجر الأساس — السعر بدون حجم لا معنى له. المنهجية تحتاج ممارسة وصبر لإتقانها. كل نموذج تجميعي ينتهي بصعود (Markup) وكل نموذج تصريفي ينتهي بهبوط (Markdown). SPOT ONLY — تحليل مرجعي تعليمي وليس نصيحة مالية.</div>';
    el.innerHTML = h;
}

function wkRenderDetail(p) {
    var h = '<div class="wk-back" onclick="wkBack()">رجوع</div>';
    h += '<div class="wk-detail">';
    if (p.hasChart) {
        h += '<div class="wk-detail-chart"><svg viewBox="0 0 800 340" style="width:100%;height:auto">' + p.svg + '</svg></div>';
    } else {
        if(p.svg) {
            h += '<div class="wk-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
        }
    }
    h += '<div class="wk-detail-name">' + p.name + '</div>';
    h += '<div class="wk-detail-ar">' + p.ar + '</div>';
    if (p.type) { h += '<div class="wk-detail-badge" style="background:' + (p.type.indexOf('BEAR') >= 0 || p.type === 'PHASE D+E' ? '#ff6a00' : '#fff') + ';color:#000">' + p.type + '</div>'; }
    if (p.rel) {
        h += '<div class="wk-detail-rel-row"><span class="wk-detail-rel-l">RELIABILITY</span><span class="wk-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="wk-detail-bar"><div class="wk-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    }
    h += '<div class="wk-detail-desc-wrap"><div class="wk-detail-desc-label">DESCRIPTION // الوصف والتفسير</div><div class="wk-detail-desc">' + p.desc + '</div></div>';
    if(p.fib) {
        h += '<div class="wk-detail-fib-wrap"><div class="wk-detail-fib-label">VOLUME + PRICE SIGNALS // إشارات الحجم والسعر</div>';
        var fibs = p.fib.split('\n');
        for (var i = 0; i < fibs.length; i++) {
            h += '<div class="wk-fib-row"><span class="wk-fib-arrow">▶</span><span class="wk-fib-text">' + fibs[i] + '</span></div>';
        }
        h += '</div>';
    }
    if(p.rules) {
        h += '<div class="wk-detail-rules-wrap"><div class="wk-detail-rules-label">RULES // الشروط والقواعد</div>';
        var rules = p.rules.split('\n');
        for (var i = 0; i < rules.length; i++) {
            h += '<div class="wk-rule-row"><span class="wk-rule-num">' + rules[i].substring(0, 2) + '</span><span class="wk-rule-text">' + rules[i].substring(3) + '</span></div>';
        }
        h += '</div>';
    }
    h += '</div>';
    return h;
}

/* =====================================================================
   DOW THEORY ENGINE — LEARN HUB 360
   ===================================================================== */

var dwCurrentCat = 'principles';
var dwSelectedIdx = -1;

function dwSetCat(cat, btn) {
    dwCurrentCat = cat;
    dwSelectedIdx = -1;
    var btns = document.querySelectorAll('.dw-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('dw-cat-active');
    if (btn) btn.classList.add('dw-cat-active');
    dwRender();
}

function dwSelect(idx) { dwSelectedIdx = idx; dwRender(); }
function dwBack() { dwSelectedIdx = -1; dwRender(); }

function dwInit() {
    var tabsEl = document.getElementById('dw-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var keys = Object.keys(dwData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = dwData[k];
        h += '<button class="dw-cat-btn' + (k === dwCurrentCat ? ' dw-cat-active' : '') + '" onclick="dwSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    dwRender();
}

// ==================== DATA (COMPLETE & UNTOUCHED) ====================
var dwData = {
    principles: {
        en: '6 PRINCIPLES', label: 'المبادئ الستة',
        patterns: [
            { name: 'Principle 1: The Market Discounts Everything', ar: 'المبدأ الأول: السوق يخصم كل شيء', rel: 95, type: 'CORE AXIOM', desc: 'حجر الأساس في نظرية داو وكل التحليل الفني. السعر الحالي يعكس كل المعلومات المتاحة — الأخبار والتوقعات والمشاعر والبيانات الاقتصادية والأحداث الجيوسياسية والتقارير المالية وحتى الشائعات. لا حاجة لتحليل كل عامل منفصلاً لأن السوق فعل ذلك بالفعل وعكسه في السعر. هذا يعني أن دراسة حركة السعر وحدها كافية لاتخاذ قرارات تداول — وهو المبرر المنطقي الكامل لوجود التحليل الفني. الاستثناء: الأحداث المفاجئة غير المتوقعة (Black Swan) قد تُسبب فجوات لأنها لم تكن في حسابات أحد.', rules: '1. السعر يعكس كل المعلومات المتاحة في كل لحظة\n2. لا حاجة لتحليل الأساسيات بشكل منفصل — السعر فعل ذلك\n3. التحليل الفني مبني بالكامل على هذا المبدأ\n4. حركة السعر + الحجم = كل ما تحتاجه\n5. الأسعار تتحرك قبل الأخبار وليس بعدها\n6. الاستثناء: أحداث Black Swan المفاجئة تماماً', svg: '<rect width="120" height="80" fill="#000"/><circle cx="60" cy="35" r="22" fill="none" stroke="#fff" stroke-width="2"/><text x="60" y="32" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">NEWS</text><text x="60" y="40" text-anchor="middle" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">EMOTIONS</text><text x="60" y="48" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">DATA</text><line x1="60" y1="57" x2="60" y2="72" stroke="#ff6a00" stroke-width="2"/><line x1="55" y1="67" x2="60" y2="72" stroke="#ff6a00" stroke-width="2"/><line x1="65" y1="67" x2="60" y2="72" stroke="#ff6a00" stroke-width="2"/><text x="60" y="78" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">PRICE</text>' },
            { name: 'Principle 2: The Market Has Three Trends', ar: 'المبدأ الثاني: السوق له ثلاثة اتجاهات', rel: 95, type: 'TREND TYPES', desc: 'داو قسّم حركة السوق إلى 3 اتجاهات متداخلة تعمل في وقت واحد مثل أمواج البحر. الاتجاه الرئيسي (Primary Trend) هو المد الكبير — يستمر من سنة لعدة سنوات ويحدد الاتجاه العام للسوق (صعودي أو هبوطي). الاتجاه الثانوي (Secondary Trend) هو الموجة — تصحيح عكس الاتجاه الرئيسي يستمر من 3 أسابيع لـ 3 أشهر ويصحح 33%-66% من الحركة الرئيسية. الاتجاه الصغير (Minor Trend) هو التموجات اليومية — أقل من 3 أسابيع وغير مهم في الصورة الكبرى. المتداول الذكي يتداول مع الاتجاه الرئيسي ويستغل التصحيحات الثانوية للدخول.', rules: '1. الاتجاه الرئيسي (Primary): سنة لعدة سنوات — المد الكبير\n2. الاتجاه الثانوي (Secondary): 3 أسابيع لـ 3 أشهر — الموجة\n3. الاتجاه الصغير (Minor): أقل من 3 أسابيع — التموجات\n4. التصحيح الثانوي يصحح 33%-66% من الحركة الرئيسية\n5. الثلاثة يعملون في وقت واحد — متداخلون\n6. تداول دائماً مع الاتجاه الرئيسي', svg: '<rect width="120" height="80" fill="#000"/><path d="M 5,65 Q 15,60 20,50 Q 25,55 30,45 Q 35,50 40,38 Q 45,42 50,30 Q 55,35 60,25 Q 65,30 70,20 Q 75,25 80,15 Q 85,18 90,12 Q 95,15 100,10 Q 105,12 115,8" fill="none" stroke="#fff" stroke-width="1.5"/><line x1="5" y1="65" x2="115" y2="8" stroke="#ff6a00" stroke-width="1" stroke-dasharray="4,3"/><text x="60" y="78" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">PRIMARY TREND</text><text x="85" y="45" fill="#888" font-size="5" font-family="Share Tech Mono">Secondary</text><text x="45" y="55" fill="#555" font-size="5" font-family="Share Tech Mono">Minor</text>' },
            { name: 'Principle 3: Primary Trends Have Three Phases', ar: 'المبدأ الثالث: الاتجاه الرئيسي له ثلاث مراحل', rel: 92, type: 'MARKET PHASES', desc: 'كل اتجاه رئيسي (صعودي أو هبوطي) يمر بـ 3 مراحل نفسية مميزة. في السوق الصعودي: مرحلة التجميع (Accumulation) حيث المستثمرون الأذكياء يشترون بهدوء والأغلبية متشائمة — السوق يبدو ميتاً. مرحلة المشاركة العامة (Public Participation) حيث الأخبار تتحسن والمتداولون الفنيون يدخلون — أقوى مرحلة صعودية. مرحلة التوزيع (Distribution/Excess) حيث الجميع متفائل والأخبار ممتازة — المؤسسات تبيع للعامة المتحمسين. في السوق الهبوطي نفس المراحل بالعكس: التوزيع → الذعر العام → اليأس والاستسلام. فهم هذه المراحل يمنعك من الشراء في القمة والبيع في القاع.', rules: '1. السوق الصعودي — مرحلة 1: التجميع — تشاؤم عام + شراء مؤسسي خفي\n2. السوق الصعودي — مرحلة 2: المشاركة العامة — أقوى صعود + دخول الجمهور\n3. السوق الصعودي — مرحلة 3: التوزيع — تفاؤل مفرط + بيع مؤسسي خفي\n4. السوق الهبوطي — مرحلة 1: التوزيع — بداية البيع المؤسسي\n5. السوق الهبوطي — مرحلة 2: الذعر — بيع جماعي حاد\n6. السوق الهبوطي — مرحلة 3: اليأس — الاستسلام الكامل (أفضل فرصة شراء)', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,62 20,58 30,55 42,45 55,30 68,18 78,14 88,12 98,15 108,20 115,28" fill="none" stroke="#fff" stroke-width="2"/><line x1="30" y1="28" x2="30" y2="72" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,2"/><line x1="72" y1="28" x2="72" y2="72" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="2,2"/><text x="18" y="75" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">1</text><text x="50" y="75" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">2</text><text x="90" y="75" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">3</text><text x="18" y="12" fill="#888" font-size="5" font-family="Share Tech Mono">ACCUM</text><text x="50" y="12" fill="#888" font-size="5" font-family="Share Tech Mono">PUBLIC</text><text x="86" y="8" fill="#888" font-size="5" font-family="Share Tech Mono">DISTRIB</text>' },
            { name: 'Principle 4: Indices Must Confirm Each Other', ar: 'المبدأ الرابع: المؤشرات يجب أن تؤكد بعضها', rel: 88, type: 'CONFIRMATION', desc: 'في الأصل قصد داو أن مؤشر Dow Jones الصناعي ومؤشر النقل يجب أن يتحركا في نفس الاتجاه لتأكيد الترند. إذا الصناعي يصعد لكن النقل لا يؤكد فالصعود مشكوك فيه. في الكريبتو نُطبق هذا المبدأ بمقارنة: BTC مع ETH — إذا كلاهما يصعد فالسوق صعودي حقيقي. BTC مع Total Market Cap — تأكيد شمولي. BTC مع DXY (الدولار) — علاقة عكسية. الفكرة الأساسية: لا تثق بحركة أصل واحد — ابحث عن تأكيد من أصول مرتبطة.', rules: '1. لا تثق بحركة أصل واحد — ابحث عن تأكيد\n2. في الكريبتو: BTC + ETH يجب أن يتحركا معاً\n3. صعود BTC بدون ETH = صعود مشكوك فيه\n4. BTC + Total Market Cap = تأكيد شمولي\n5. تباين بين المؤشرات = تحذير من انعكاس\n6. التأكيد لا يجب أن يكون في نفس اليوم لكن قريب زمنياً', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,55 25,45 40,35 55,28 70,22 85,18 100,15" fill="none" stroke="#fff" stroke-width="2"/><polyline points="10,58 25,50 40,42 55,38 70,30 85,25 100,20" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="102" y="13" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="102" y="22" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">ETH</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">CONFIRMED UPTREND</text>' },
            { name: 'Principle 5: Volume Must Confirm the Trend', ar: 'المبدأ الخامس: الحجم يجب أن يؤكد الاتجاه', rel: 90, type: 'VOLUME', desc: 'الحجم هو وقود الاتجاه. في الاتجاه الصعودي الصحي: الحجم يرتفع مع الصعود ويتناقص مع التصحيح — هذا يؤكد أن المشترين أقوى ويسيطرون. في الاتجاه الهبوطي الصحي: الحجم يرتفع مع الهبوط ويتناقص مع الارتداد. إذا الحجم يتناقض مع السعر (مثلاً: صعود بحجم منخفض) فهذا تحذير قوي بأن الاتجاه يضعف وقد ينعكس قريباً. داو اعتبر الحجم مؤشر ثانوي لكنه أصبح اليوم أساسي — خاصة في الكريبتو حيث التلاعب بالحجم يكشف نوايا المؤسسات. هذا المبدأ هو الأساس الذي بنى عليه وايكوف منهجيته لاحقاً.', rules: '1. صعود + حجم مرتفع = اتجاه صعودي صحي ومستمر\n2. صعود + حجم منخفض = ضعف — انعكاس محتمل\n3. هبوط + حجم مرتفع = ضغط بيعي حقيقي — استمرار الهبوط\n4. هبوط + حجم منخفض = تصحيح مؤقت — سينتهي\n5. الحجم يسبق السعر غالباً — ارتفاع الحجم ينذر بحركة كبيرة\n6. Divergence بين الحجم والسعر = أقوى تحذير', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,55 25,45 40,35 55,28 70,22 85,18 100,15" fill="none" stroke="#fff" stroke-width="2"/><rect x="12" y="62" width="8" height="10" fill="#fff" opacity="0.4"/><rect x="27" y="58" width="8" height="14" fill="#fff" opacity="0.5"/><rect x="42" y="54" width="8" height="18" fill="#fff" opacity="0.6"/><rect x="57" y="50" width="8" height="22" fill="#fff" opacity="0.7"/><rect x="72" y="46" width="8" height="26" fill="#fff" opacity="0.8"/><rect x="87" y="42" width="8" height="30" fill="#fff" opacity="0.9"/><text x="55" y="78" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">VOLUME CONFIRMS TREND</text>' },
            { name: 'Principle 6: Trends Persist Until Reversal', ar: 'المبدأ السادس: الاتجاه مستمر حتى يثبت انعكاسه', rel: 92, type: 'TREND PERSISTENCE', desc: 'الاتجاه القائم يميل للاستمرار حتى تظهر إشارات واضحة ومؤكدة على انعكاسه. لا تحاول التنبؤ بنهاية الاتجاه — انتظر التأكيد. هذا المبدأ يحميك من البيع المبكر في اتجاه صاعد أو الشراء المبكر في اتجاه هابط. إشارات الانعكاس تشمل: كسر القمم/القيعان المتتالية (Higher Highs/Higher Lows أو العكس)، تباين الحجم مع السعر، فشل السعر في تسجيل قمة/قاع جديد، أنماط انعكاسية كلاسيكية (رأس وكتفين، قمة مزدوجة). التمييز بين التصحيح المؤقت والانعكاس الحقيقي هو أصعب مهارة في التحليل الفني — هذا المبدأ يُعلمك الصبر والانتظار.', rules: '1. الاتجاه مستمر حتى تظهر إشارات انعكاس مؤكدة\n2. لا تتنبأ بنهاية الاتجاه — انتظر التأكيد\n3. كسر سلسلة HH/HL (صعودي) أو LL/LH (هبوطي) = إشارة انعكاس\n4. التمييز بين التصحيح والانعكاس يحتاج خبرة\n5. تداول مع الاتجاه حتى يثبت العكس\n6. أنماط الانعكاس الكلاسيكية تؤكد نهاية الاتجاه', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,60 18,48 25,52 35,38 42,42 52,28 58,32 68,20 75,24 82,18" fill="none" stroke="#fff" stroke-width="2"/><polyline points="82,18 88,22 92,30 96,28 100,35 104,32 108,40 112,38" fill="none" stroke="#ff6a00" stroke-width="2" stroke-dasharray="3,2"/><text x="50" y="75" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">TREND CONTINUES</text><text x="100" y="50" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">REVERSAL?</text><line x1="82" y1="14" x2="82" y2="55" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="2,2"/>' }
        ]
    },
    trends: {
        en: 'TREND STRUCTURE', label: 'هيكل الاتجاه',
        patterns: [
            { name: 'Uptrend Structure (HH + HL)', ar: 'هيكل الاتجاه الصاعد', rel: 95, type: 'BULLISH', desc: 'الاتجاه الصاعد يُعرّف بسلسلة من القمم الأعلى (Higher Highs — HH) والقيعان الأعلى (Higher Lows — HL). كل قمة أعلى من السابقة وكل قاع أعلى من السابق. هذا الهيكل يُظهر أن المشترين يسيطرون — كل تصحيح ينتهي عند مستوى أعلى من التصحيح السابق. طالما هذا الهيكل مستمر فالاتجاه صاعد ولا يجب البيع ضده. كسر آخر HL (قاع أعلى) هو أول إشارة تحذيرية بأن الاتجاه قد ينتهي.', rules: '1. HH: كل قمة أعلى من القمة السابقة\n2. HL: كل قاع أعلى من القاع السابق\n3. طالما HH+HL مستمرة فالاتجاه صاعد\n4. كسر آخر HL = أول تحذير بانعكاس محتمل\n5. الحجم يرتفع مع الصعود ويتناقص مع التصحيح\n6. خطوط الاتجاه تربط القيعان الأعلى (HL)', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,68 20,45 28,52 42,30 50,38 65,18 72,25 88,10" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="20" cy="45" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="42" cy="30" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="65" cy="18" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="28" cy="52" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><circle cx="50" cy="38" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><circle cx="72" cy="25" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><text x="20" y="40" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">HH</text><text x="42" y="25" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">HH</text><text x="65" y="13" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">HH</text><text x="28" y="62" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">HL</text><text x="50" y="48" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">HL</text><text x="72" y="35" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">HL</text><line x1="8" y1="68" x2="72" y2="25" stroke="#888" stroke-width="0.8" stroke-dasharray="3,3"/>' },
            { name: 'Downtrend Structure (LH + LL)', ar: 'هيكل الاتجاه الهابط', rel: 95, type: 'BEARISH', desc: 'عكس الاتجاه الصاعد — سلسلة من القمم الأدنى (Lower Highs — LH) والقيعان الأدنى (Lower Lows — LL). كل قمة أدنى من السابقة وكل قاع أدنى من السابق. البائعون يسيطرون — كل ارتداد يفشل عند مستوى أدنى من الارتداد السابق. كسر آخر LH (قمة أدنى) هو أول إشارة صعودية محتملة.', rules: '1. LH: كل قمة أدنى من القمة السابقة\n2. LL: كل قاع أدنى من القاع السابق\n3. طالما LH+LL مستمرة فالاتجاه هابط\n4. كسر آخر LH = أول تحذير بانعكاس صعودي\n5. الحجم يرتفع مع الهبوط ويتناقص مع الارتداد\n6. خطوط الاتجاه تربط القمم الأدنى (LH)', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,12 20,35 28,28 42,50 50,42 65,62 72,55 88,72" fill="none" stroke="#ff6a00" stroke-width="2.5"/><circle cx="28" cy="28" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="50" cy="42" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="72" cy="55" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="20" cy="35" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><circle cx="42" cy="50" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><circle cx="65" cy="62" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><text x="28" y="23" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">LH</text><text x="50" y="37" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">LH</text><text x="72" y="50" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">LH</text><text x="20" y="45" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">LL</text><text x="42" y="60" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">LL</text><text x="65" y="72" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">LL</text><line x1="28" y1="28" x2="72" y2="55" stroke="#888" stroke-width="0.8" stroke-dasharray="3,3"/>' },
            { name: 'Trend Reversal (CHoCH)', ar: 'انعكاس الاتجاه — تغيير الهيكل', rel: 88, type: 'REVERSAL', desc: 'انعكاس الاتجاه يحدث عندما يكسر السعر الهيكل القائم. في الاتجاه الصاعد: الانعكاس يبدأ عندما يفشل السعر في تسجيل HH جديد ثم يكسر آخر HL — هذا يُسمى Change of Character (CHoCH) أو Break of Structure (BOS) في مدرسة SMC. في الاتجاه الهابط: الانعكاس عندما يفشل في تسجيل LL جديد ثم يكسر آخر LH. الخطأ الشائع: اعتبار أول كسر كانعكاس مؤكد — يجب انتظار تأكيد بتسجيل أول HH/HL جديد في الاتجاه المعاكس.', rules: '1. انعكاس صعودي: فشل LL جديد + كسر آخر LH = CHoCH\n2. انعكاس هبوطي: فشل HH جديد + كسر آخر HL = CHoCH\n3. أول كسر = تحذير — ليس تأكيد نهائي\n4. التأكيد: تسجيل أول HH+HL أو LL+LH في الاتجاه الجديد\n5. الحجم يرتفع عند نقطة الكسر = تأكيد أقوى\n6. هذا المفهوم هو أساس BOS/CHoCH في مدرسة SMC', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,60 18,42 25,48 35,30 42,36 52,22 58,28 62,35 68,40 72,32 78,45 85,50 92,42 100,55 108,48" fill="none" stroke="#fff" stroke-width="2"/><line x1="58" y1="28" x2="108" y2="28" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="2,2"/><text x="52" y="18" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">HH</text><text x="62" y="42" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">FAIL</text><text x="78" y="52" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">BOS</text><text x="60" y="75" text-anchor="middle" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">CHoCH — REVERSAL</text>' },
            { name: 'Sideways / Ranging Market', ar: 'السوق الجانبي (التذبذب)', rel: 80, type: 'NEUTRAL', desc: 'ليس كل حركة سعرية اتجاه — أحياناً السوق يتذبذب بين دعم ومقاومة بدون اتجاه واضح. داو لم يعترف رسمياً بالاتجاه الجانبي لكنه واقع السوق. في التذبذب: لا توجد HH/HL ولا LL/LH — القمم والقيعان متساوية تقريباً. هذه فترة تجميع (قبل صعود) أو توزيع (قبل هبوط). الكسر من النطاق بحجم مرتفع يحدد الاتجاه القادم. قاعدة: لا تتداول داخل النطاق الضيق إلا إذا كنت محترف سكالبينج.', rules: '1. قمم وقيعان متساوية تقريباً — لا HH/HL ولا LL/LH\n2. السعر يتذبذب بين دعم ومقاومة واضحين\n3. قد يكون تجميع (قبل صعود) أو توزيع (قبل هبوط)\n4. الكسر بحجم مرتفع يحدد الاتجاه القادم\n5. الحجم يتناقص داخل النطاق — لا اهتمام\n6. كلما طال التذبذب كان الكسر أقوى', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="25" x2="110" y2="25" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="3,3"/><line x1="10" y1="55" x2="110" y2="55" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><polyline points="12,52 22,28 32,52 42,28 52,52 62,28 72,52 82,28 92,52 102,28" fill="none" stroke="#888" stroke-width="1.5"/><text x="112" y="23" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">R</text><text x="112" y="53" fill="#fff" font-size="6" font-family="Share Tech Mono">S</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">RANGE — NO TREND</text>' }
        ]
    },
    phases: {
        en: 'MARKET PHASES', label: 'مراحل السوق',
        patterns: [
            { name: 'Accumulation Phase', ar: 'مرحلة التجميع', rel: 90, type: 'PHASE 1', desc: 'المرحلة الأولى في السوق الصعودي حسب داو. السوق في قاعه — الأخبار سيئة والمعنويات منخفضة والأغلبية متشائمة. المستثمرون المؤسسيون (Smart Money) يبدأون بالشراء بهدوء لأنهم يرون القيمة الحقيقية. الأسعار تتوقف عن الهبوط وتبدأ بالتذبذب جانبياً. الحجم منخفض ولا اهتمام من العامة. هذه المرحلة مطابقة لمفهوم وايكوف في التجميع. أصعب مرحلة للتعرف عليها في وقتها لأن كل شيء يبدو سيئاً.', rules: '1. الأسعار في قاعها — الأخبار سيئة جداً\n2. المعنويات منخفضة — لا أحد يريد الشراء\n3. المؤسسات تشتري بهدوء — الحجم منخفض\n4. السعر يتذبذب جانبياً بدون اتجاه\n5. مطابق لمفهوم التجميع عند وايكوف\n6. أفضل فرصة شراء — لكن أصعبها نفسياً', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,20 15,30 20,40 25,50 30,55 35,52 40,55 45,50 50,54 55,48 60,52 65,50 70,48 75,52 80,50 85,48 90,50 95,48 100,45 105,42 112,35" fill="none" stroke="#fff" stroke-width="2"/><text x="25" y="75" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">DOWNTREND</text><text x="70" y="75" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">ACCUMULATION</text><rect x="35" y="60" width="55" height="1" fill="#fff" opacity="0.3"/>' },
            { name: 'Public Participation Phase', ar: 'مرحلة المشاركة العامة', rel: 92, type: 'PHASE 2', desc: 'المرحلة الثانية والأقوى — حيث يحدث معظم الصعود. الأخبار تتحسن والمتداولون الفنيون يدخلون ثم يتبعهم الجمهور العام. الاتجاه واضح والحجم مرتفع. هذه المرحلة تُنتج أقوى HH/HL وأوضح اتجاه صاعد. أطول المراحل زمنياً وأكثرها ربحية. يمكن تطبيق موجات إليوت على هذه المرحلة (خاصة الموجة 3). الدخول فيها أسهل نفسياً من مرحلة التجميع لأن الاتجاه واضح.', rules: '1. الاتجاه الصاعد واضح — HH + HL مستمرة\n2. الأخبار تتحسن تدريجياً — ثقة متزايدة\n3. الحجم مرتفع ومستمر — مشاركة واسعة\n4. أطول المراحل زمنياً وأكثرها ربحية\n5. المتداولون الفنيون يدخلون أولاً ثم الجمهور\n6. يمكن تطبيق إليوت (الموجة 3 غالباً هنا)', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,65 18,55 25,58 35,42 42,46 55,28 62,32 75,15 82,18 95,10" fill="none" stroke="#fff" stroke-width="2.5"/><rect x="15" y="62" width="6" height="12" fill="#fff" opacity="0.5"/><rect x="30" y="58" width="6" height="16" fill="#fff" opacity="0.6"/><rect x="45" y="54" width="6" height="20" fill="#fff" opacity="0.7"/><rect x="60" y="50" width="6" height="24" fill="#fff" opacity="0.8"/><rect x="75" y="46" width="6" height="28" fill="#fff" opacity="0.9"/><rect x="90" y="42" width="6" height="32" fill="#fff" opacity="1"/><text x="55" y="78" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">STRONGEST TREND</text>' },
            { name: 'Distribution Phase', ar: 'مرحلة التوزيع (الحماس المفرط)', rel: 88, type: 'PHASE 3', desc: 'المرحلة الأخيرة والأخطر في السوق الصعودي. الأخبار ممتازة وكل شخص متفائل والجميع يشتري — من جارك لسائق التاكسي. هذا هو الوقت الذي تبيع فيه المؤسسات للعامة المتحمسين. الأسعار قد تستمر بالارتفاع لكن بزخم أقل وحجم متناقص. التقلب يرتفع — شموع كبيرة في الاتجاهين. علامات التحذير: صعود بحجم منخفض، تباين المؤشرات، فشل في تسجيل قمم جديدة ذات معنى. مطابق لمفهوم وايكوف في التصريف. القاعدة الذهبية: عندما يتحول الجميع لمتفائلين — كن حذراً.', rules: '1. تفاؤل مفرط — الجميع يشتري (حتى غير المتداولين)\n2. الأخبار ممتازة — لا أحد يتوقع الهبوط\n3. المؤسسات تبيع بهدوء للعامة المتحمسين\n4. الحجم يتناقص رغم استمرار الصعود (Divergence)\n5. التقلب يرتفع — شموع كبيرة في الاتجاهين\n6. القاعدة: عندما الجميع متفائل — ابدأ بالحذر', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,60 15,45 22,50 30,30 38,35 45,18 52,22 58,15 64,20 70,18 76,22 82,25 88,20 94,28 100,32 106,38 112,45" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="45" y="12" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">EUPHORIA</text><text x="95" y="50" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">DISTRIBUTION</text><line x1="58" y1="15" x2="88" y2="15" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="2,2"/>' },
            { name: 'Markdown Phase', ar: 'مرحلة الهبوط (الذعر)', rel: 85, type: 'BEAR MARKET', desc: 'بعد اكتمال التوزيع يبدأ الهبوط الحقيقي. ينقسم لمرحلتين: الذعر (Panic) حيث يُدرك الجمهور أن السوق ينهار ويبيع الجميع بخسارة — هبوط حاد بحجم ضخم. ثم اليأس (Despair/Capitulation) حيث يستسلم آخر المتفائلين ويبيعون بأي سعر — هذا هو القاع الحقيقي. بعد الاستسلام الكامل تبدأ مرحلة تجميع جديدة والدورة تتكرر. فهم هذه الدورة النفسية يمنعك من البيع في القاع والشراء في القمة.', rules: '1. الذعر (Panic): هبوط حاد بحجم ضخم — البيع الجماعي\n2. الارتداد المؤقت: صعود قصير يُغري المشترين ثم يُكمل الهبوط\n3. اليأس (Capitulation): استسلام آخر المتفائلين — القاع الحقيقي\n4. الحجم يصل ذروته في الاستسلام (Selling Climax)\n5. بعد الاستسلام: بداية تجميع جديد = بداية دورة جديدة\n6. الدورة تتكرر: تجميع → صعود → توزيع → هبوط → تجميع', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,15 15,20 22,18 30,25 38,35 42,30 48,40 52,45 58,42 62,50 68,55 72,52 78,58 82,60 88,62 92,65 98,68 104,66 110,70" fill="none" stroke="#ff6a00" stroke-width="2.5"/><text x="25" y="12" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">PANIC</text><text x="90" y="60" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">DESPAIR</text><rect x="88" y="72" width="8" height="5" fill="#ff6a00" opacity="0.9"/><text x="92" y="78" fill="#888" font-size="5" font-family="Share Tech Mono">CLIMAX</text>' }
        ]
    }
};

function dwRender() {
    var cat = dwData[dwCurrentCat];
    if (!cat) return;
    var el = document.getElementById('dw-content');
    if (!el) return;
    if (dwSelectedIdx >= 0 && dwSelectedIdx < cat.patterns.length) {
        el.innerHTML = dwRenderDetail(cat.patterns[dwSelectedIdx]);
        return;
    }
    var h = '<div class="dw-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        var isBear = p.type && (p.type.indexOf('BEAR') >= 0 || p.type === 'PHASE 3');
        var topC = isBear ? '#ff6a00' : p.type === 'NEUTRAL' ? '#888' : '#fff';
        h += '<div class="dw-card" style="border-top:3px solid ' + topC + '" onclick="dwSelect(' + i + ')">';
        h += '<div class="dw-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
        h += '<div class="dw-card-name">' + p.name + '</div>';
        h += '<div class="dw-card-ar">' + p.ar + '</div>';
        if (p.type) { h += '<div class="dw-card-type">' + p.type + '</div>'; }
        if (p.rel) {
            h += '<div class="dw-card-rel-row"><span class="dw-card-rel-l">IMPORTANCE</span><span class="dw-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
            h += '<div class="dw-card-bar"><div class="dw-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
        }
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="dw-footer">نظرية داو هي الأساس الأكاديمي الذي بُني عليه كل التحليل الفني الحديث. طوّرها Charles Dow في أواخر القرن التاسع عشر من خلال مقالاته في Wall Street Journal. رغم عمرها فإن مبادئها صالحة لكل الأسواق بما فيها العملات الرقمية. فهم داو يمنحك الإطار الفكري الصحيح قبل تعلم أي أداة أو مؤشر. المبادئ الستة ليست قواعد تداول — بل فلسفة لفهم حركة الأسواق. SPOT ONLY — تحليل مرجعي تعليمي وليس نصيحة مالية.</div>';
    el.innerHTML = h;
}

function dwRenderDetail(p) {
    var h = '<div class="dw-back" onclick="dwBack()">رجوع</div>';
    h += '<div class="dw-detail">';
    h += '<div class="dw-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
    h += '<div class="dw-detail-name">' + p.name + '</div>';
    h += '<div class="dw-detail-ar">' + p.ar + '</div>';
    if (p.type) { h += '<div class="dw-detail-badge">' + p.type + '</div>'; }
    if (p.rel) {
        h += '<div class="dw-detail-rel-row"><span class="dw-detail-rel-l">IMPORTANCE</span><span class="dw-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="dw-detail-bar"><div class="dw-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    }
    h += '<div class="dw-detail-desc-wrap"><div class="dw-detail-desc-label">DESCRIPTION // الوصف الأكاديمي</div><div class="dw-detail-desc">' + p.desc + '</div></div>';
    if (p.rules) {
        h += '<div class="dw-detail-rules-wrap"><div class="dw-detail-rules-label">KEY POINTS // النقاط الأساسية</div>';
        var rules = p.rules.split('\n');
        for (var i = 0; i < rules.length; i++) {
            h += '<div class="dw-rule-row"><span class="dw-rule-num">' + rules[i].substring(0, 2) + '</span><span class="dw-rule-text">' + rules[i].substring(3) + '</span></div>';
        }
        h += '</div>';
    }
    h += '</div>';
    return h;
}

/* =====================================================================
   ICT & SMC ACADEMY ENGINE — LEARN HUB 360
   ===================================================================== */

var smCurrentCat = 'structure';
var smSelectedIdx = -1;

function smSetCat(cat, btn) {
    smCurrentCat = cat;
    smSelectedIdx = -1;
    var btns = document.querySelectorAll('.sm-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('sm-cat-active');
    if (btn) btn.classList.add('sm-cat-active');
    smRender();
}

function smSelect(idx) { smSelectedIdx = idx; smRender(); }
function smBack() { smSelectedIdx = -1; smRender(); }

function smInit() {
    var tabsEl = document.getElementById('sm-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var keys = Object.keys(smData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = smData[k];
        h += '<button class="sm-cat-btn' + (k === smCurrentCat ? ' sm-cat-active' : '') + '" onclick="smSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    smRender();
}

// ==================== DATA (COMPLETE & UNTOUCHED) ====================
var smData = {
    structure: {
        en: 'MARKET STRUCTURE', label: 'هيكل السوق',
        patterns: [
            { name: 'Break of Structure (BOS)', ar: 'كسر الهيكل', rel: 92, type: 'CONTINUATION', desc: 'كسر الهيكل هو المفهوم الأساسي في SMC لتأكيد استمرار الاتجاه. في الاتجاه الصاعد: BOS يحدث عندما يكسر السعر آخر قمة أعلى (Swing High) مسجلاً قمة جديدة — تأكيد بأن المشترين لا يزالون مسيطرين والاتجاه الصاعد مستمر. في الاتجاه الهابط: BOS عندما يكسر السعر آخر قاع أدنى (Swing Low) مسجلاً قاع جديد. كل BOS يُنشئ منطقة Order Block جديدة عند آخر شمعة قبل الكسر. الحجم المرتفع عند الكسر يؤكد أن الحركة مؤسسية وليست فخ.', rules: '1. BOS صعودي: كسر آخر Swing High بإغلاق شمعة فوقه\n2. BOS هبوطي: كسر آخر Swing Low بإغلاق شمعة تحته\n3. الكسر بإغلاق شمعة وليس بذيل فقط\n4. كل BOS يُنشئ Order Block جديد\n5. حجم مرتفع عند الكسر = تأكيد مؤسسي\n6. BOS = استمرار الاتجاه القائم', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,60 18,42 25,48 35,30 42,38 52,22 58,28" fill="none" stroke="#fff" stroke-width="2"/><line x1="35" y1="30" x2="70" y2="30" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><polyline points="58,28 65,18 72,24 80,12" fill="none" stroke="#fff" stroke-width="2.5"/><text x="68" y="10" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">BOS</text><line x1="52" y1="22" x2="80" y2="22" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><text x="85" y="24" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">OLD HIGH</text>' },
            { name: 'Change of Character (CHoCH)', ar: 'تغيير الهيكل (الانعكاس)', rel: 90, type: 'REVERSAL', desc: 'CHoCH هو أول إشارة لانعكاس الاتجاه في SMC. يحدث عندما يكسر السعر الهيكل القائم لأول مرة. في الاتجاه الصاعد: CHoCH عندما يكسر السعر آخر قاع أعلى (HL) للأسفل — أول مرة يفشل فيها المشترون في الحفاظ على الهيكل الصاعد. في الاتجاه الهابط: CHoCH عندما يكسر آخر قمة أدنى (LH) للأعلى. الفرق بين BOS و CHoCH: BOS يستمر في نفس الاتجاه بينما CHoCH يكسر عكس الاتجاه. CHoCH لا يعني أن الاتجاه انعكس نهائياً — يحتاج تأكيد بـ BOS في الاتجاه الجديد.', rules: '1. CHoCH صعودي: كسر آخر LH في اتجاه هابط\n2. CHoCH هبوطي: كسر آخر HL في اتجاه صاعد\n3. أول كسر عكس الاتجاه = تحذير وليس تأكيد نهائي\n4. التأكيد: BOS في الاتجاه الجديد بعد CHoCH\n5. CHoCH يُنشئ أول Order Block في الاتجاه الجديد\n6. الفرق: BOS = استمرار / CHoCH = انعكاس محتمل', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,58 16,40 22,46 30,28 36,34 44,20 50,26" fill="none" stroke="#fff" stroke-width="2"/><polyline points="50,26 56,35 60,30 66,42 72,38 78,50 84,45 90,55 96,52 104,62" fill="none" stroke="#ff6a00" stroke-width="2"/><line x1="36" y1="34" x2="90" y2="34" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><text x="70" y="32" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">CHoCH</text><text x="25" y="75" fill="#fff" font-size="6" font-family="Share Tech Mono">BULLISH</text><text x="80" y="75" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">BEARISH</text>' },
            { name: 'Swing Points (Swing High/Low)', ar: 'نقاط التأرجح', rel: 88, type: 'FOUNDATION', desc: 'نقاط التأرجح هي اللبنة الأساسية لتحديد هيكل السوق في SMC. Swing High هي شمعة قمتها أعلى من الشمعتين على جانبيها — نقطة رفض سعري من الأعلى. Swing Low هي شمعة قاعها أدنى من الشمعتين على جانبيها — نقطة رفض من الأسفل. ربط Swing Points ببعضها يُحدد الهيكل: HH/HL = صاعد، LL/LH = هابط. في SMC المتقدم: Strong Swing Point هو الذي أنشأ BOS والـ Weak هو الذي لم يُكسر بعد — كسر الـ Weak = CHoCH.', rules: '1. Swing High: قمة أعلى من الشمعتين المجاورتين\n2. Swing Low: قاع أدنى من الشمعتين المجاورتين\n3. ربط Swing Points يحدد هيكل السوق\n4. Strong Point: أنشأ BOS — صعب الكسر\n5. Weak Point: لم يُكسر بعد — كسره = CHoCH\n6. كل Swing Point منطقة سيولة محتملة', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,50 18,30 28,45 40,18 50,35 62,12 72,28 84,8 94,22 108,5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="18" cy="30" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="40" cy="18" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="62" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="84" cy="8" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="28" cy="45" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><circle cx="50" cy="35" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><circle cx="72" cy="28" r="3" fill="none" stroke="#ff6a00" stroke-width="1.5"/><text x="18" y="25" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">SH</text><text x="28" y="55" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">SL</text>' },
            { name: 'Premium & Discount Zones', ar: 'مناطق Premium و Discount', rel: 85, type: 'ENTRY ZONES', desc: 'مفهوم أساسي في ICT لتحديد مناطق الدخول المثالية. أي حركة سعرية بين Swing High و Swing Low تُقسم لنصفين: Premium Zone (فوق 50% — منطقة البيع) و Discount Zone (تحت 50% — منطقة الشراء). خط المنتصف يُسمى Equilibrium (EQ). المؤسسات تشتري في Discount وتبيع في Premium — هذا هو سر تداول Smart Money. القاعدة: في الاتجاه الصاعد ابحث عن فرص شراء في Discount Zone فقط. في الهابط ابحث عن بيع في Premium فقط. لا تشتري أبداً في Premium ولا تبيع في Discount.', rules: '1. Premium Zone: فوق 50% من الحركة — منطقة البيع\n2. Discount Zone: تحت 50% — منطقة الشراء\n3. Equilibrium (EQ): خط المنتصف — 50%\n4. اشتري في Discount فقط — بع في Premium فقط\n5. OTE Zone (62%-79%): أفضل منطقة دخول في كلا الاتجاهين\n6. المؤسسات تتداول دائماً من Premium/Discount وليس العكس', svg: '<rect width="120" height="80" fill="#000"/><rect x="10" y="8" width="100" height="30" fill="rgba(255,106,0,0.08)"/><rect x="10" y="38" width="100" height="32" fill="rgba(255,255,255,0.05)"/><line x1="10" y1="8" x2="110" y2="8" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="10" y1="38" x2="110" y2="38" stroke="#ff6a00" stroke-width="1.2" stroke-dasharray="3,3"/><line x1="10" y1="70" x2="110" y2="70" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><text x="60" y="22" text-anchor="middle" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">PREMIUM (SELL)</text><text x="60" y="36" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">— EQ 50% —</text><text x="60" y="55" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">DISCOUNT (BUY)</text>' }
        ]
    },
    orderblocks: {
        en: 'ORDER BLOCKS', label: 'كتل الأوامر',
        patterns: [
            { name: 'Bullish Order Block', ar: 'كتلة أوامر صعودية', rel: 85, type: 'BUY ZONE', desc: 'Order Block الصعودي هو آخر شمعة هابطة (أو مجموعة شموع هابطة) قبل حركة صعودية قوية كسرت الهيكل (BOS). هذه الشمعة تمثل المنطقة التي وضعت فيها المؤسسات أوامر الشراء الكبيرة. عندما يعود السعر لهذه المنطقة يجد طلب مؤسسي متبقي ويرتد صعوداً. الشروط: يجب أن يكون OB قبل BOS مباشرة. يجب أن يكون في Discount Zone. OB الطازج (لم يُختبر بعد) أقوى من المُختبر. الحجم المرتفع عند تكوين OB يعزز قوته.', rules: '1. آخر شمعة/شموع هابطة قبل BOS صعودي\n2. يجب أن يكون في Discount Zone (تحت EQ)\n3. OB الطازج (Fresh — لم يُختبر) أقوى بكثير\n4. الحجم المرتفع عند تكوين OB = أقوى\n5. منطقة OB: من أدنى سعر للشمعة لأعلى سعرها\n6. الدخول عند العودة لمنطقة OB مع تأكيد', svg: '<rect width="120" height="80" fill="#000"/><rect x="30" y="42" width="16" height="20" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/><line x1="38" y1="38" x2="38" y2="42" stroke="#ff6a00" stroke-width="1.5"/><rect x="32" y="44" width="12" height="14" fill="#ff6a00" rx="1"/><line x1="38" y1="58" x2="38" y2="64" stroke="#ff6a00" stroke-width="1.5"/><polyline points="46,50 52,42 58,38 64,30 70,22 76,18 82,14 90,10" fill="none" stroke="#fff" stroke-width="2"/><text x="38" y="75" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">BULL OB</text><polyline points="90,10 92,16 95,20 100,35 104,42 108,50" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3,2"/><line x1="100" y1="42" x2="108" y2="42" stroke="#fff" stroke-width="0.8"/><text x="105" y="55" fill="#fff" font-size="5" font-family="Share Tech Mono">RETEST</text>' },
            { name: 'Bearish Order Block', ar: 'كتلة أوامر هبوطية', rel: 85, type: 'SELL ZONE', desc: 'عكس الصعودي — آخر شمعة صعودية (أو مجموعة شموع صعودية) قبل حركة هبوطية قوية كسرت الهيكل. تمثل منطقة البيع المؤسسي. عندما يعود السعر لهذه المنطقة يجد عرض مؤسسي متبقي ويهبط. يجب أن يكون في Premium Zone (فوق EQ) ليكون صالحاً.', rules: '1. آخر شمعة/شموع صعودية قبل BOS هبوطي\n2. يجب أن يكون في Premium Zone (فوق EQ)\n3. OB الطازج أقوى بكثير\n4. حجم مرتفع عند التكوين = أقوى\n5. منطقة OB: من أدنى سعر للشمعة لأعلى سعرها\n6. البيع عند العودة لمنطقة OB مع تأكيد', svg: '<rect width="120" height="80" fill="#000"/><rect x="30" y="18" width="16" height="20" fill="rgba(255,106,0,0.1)" stroke="rgba(255,106,0,0.3)" stroke-width="1"/><line x1="38" y1="14" x2="38" y2="18" stroke="#fff" stroke-width="1.5"/><rect x="32" y="22" width="12" height="14" fill="#fff" rx="1"/><line x1="38" y1="36" x2="38" y2="42" stroke="#fff" stroke-width="1.5"/><polyline points="46,30 52,38 58,42 64,50 70,58 76,62 82,66 90,72" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="38" y="10" text-anchor="middle" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">BEAR OB</text>' },
            { name: 'Order Block Mitigation', ar: 'إبطال كتلة الأوامر (Mitigation)', rel: 80, type: 'INVALIDATION', desc: 'Mitigation يحدث عندما يعود السعر لمنطقة Order Block ويخترقها بالكامل بدلاً من الارتداد. هذا يعني أن الأوامر المؤسسية المتبقية تم امتصاصها بالكامل ولم يعد هناك طلب/عرض في هذه المنطقة. OB المُبطل (Mitigated) لا يُعاد استخدامه — يفقد قوته. القاعدة: إذا اخترق السعر OB بالكامل بإغلاق شمعة خلفه فلا تتداول عليه مرة أخرى. فقط OBs الطازجة وغير المُبطلة صالحة للتداول.', rules: '1. Mitigation: السعر يخترق OB بالكامل ويغلق خلفه\n2. OB المُبطل يفقد قوته نهائياً — لا تتداول عليه\n3. فقط OBs الطازجة (Fresh) صالحة\n4. أول لمسة لـ OB هي الأقوى (First Touch)\n5. اللمسة الثانية أضعف — الثالثة غالباً تكسر\n6. كل اختبار يستهلك جزءاً من الأوامر المتبقية', svg: '<rect width="120" height="80" fill="#000"/><rect x="20" y="35" width="20" height="15" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/><polyline points="8,60 18,55 28,42 35,48 42,38 48,42" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="48,42 55,50 60,48 65,52 70,45 78,42 82,38 86,35 90,30 95,25" fill="none" stroke="#fff" stroke-width="1.5"/><line x1="20" y1="42" x2="95" y2="42" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="2,2"/><text x="55" y="60" fill="#fff" font-size="6" font-family="Share Tech Mono">1st TOUCH</text><polyline points="95,25 98,32 102,38 106,42 110,48 114,55" fill="none" stroke="#ff6a00" stroke-width="2" stroke-dasharray="3,2"/><text x="108" y="62" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">MITIGATED</text>' },
            { name: 'Breaker Block', ar: 'كتلة الكسر', rel: 78, type: 'FLIPPED ZONE', desc: 'Breaker Block هو Order Block فاشل — OB تم كسره (Mitigated) ثم تحوّل لمنطقة معاكسة. مثال: Bullish OB تم كسره للأسفل → يتحول لمنطقة مقاومة (Bearish Breaker). السبب: المتداولون الذين اشتروا في OB محاصرون بخسائر — عند عودة السعر لهذه المنطقة يبيعون للخروج بأقل خسارة (Break-even Sellers) مما يُنشئ مقاومة جديدة. مفهوم متقدم ومهم — يفسر لماذا الدعوم المكسورة تتحول لمقاومات.', rules: '1. OB فاشل كُسر بالكامل (Mitigated)\n2. بعد الكسر يتحول لمنطقة معاكسة\n3. Bull OB المكسور = Bearish Breaker (مقاومة)\n4. Bear OB المكسور = Bullish Breaker (دعم)\n5. المحاصرون يبيعون/يشترون عند العودة لـ Break-even\n6. يفسر تحول الدعوم لمقاومات والعكس', svg: '<rect width="120" height="80" fill="#000"/><rect x="25" y="40" width="16" height="12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/><polyline points="8,55 16,50 24,45 32,48 40,42 48,50 54,55 60,52 66,58 72,55 78,60" fill="none" stroke="#ff6a00" stroke-width="1.5"/><polyline points="78,60 82,52 86,46 90,42 94,38 100,32" fill="none" stroke="#ff6a00" stroke-width="1.5"/><line x1="25" y1="46" x2="110" y2="46" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><text x="25" y="38" fill="#fff" font-size="6" font-family="Share Tech Mono">OB FAILED</text><text x="80" y="44" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">BREAKER</text>' }
        ]
    },
    liquidity: {
        en: 'LIQUIDITY', label: 'السيولة',
        patterns: [
            { name: 'Buy-Side Liquidity (BSL)', ar: 'سيولة جانب الشراء', rel: 90, type: 'ABOVE HIGHS', desc: 'Buy-Side Liquidity هي تجمع أوامر Stop Loss فوق القمم السابقة (Swing Highs) وفوق مناطق المقاومة. المتداولون الذين باعوا (Short) يضعون Stop Loss فوق القمم — هذه أوامر شراء معلقة. المؤسسات تعرف أين تقع هذه الأوامر وتدفع السعر لأعلى لتنفيذها (Liquidity Grab/Sweep) — ثم ينعكس السعر. Equal Highs (قمم متساوية) أكثر سيولة لأن كثير من المتداولين يضعون أوامرهم عندها. كسر BSL ثم الارتداد = إشارة بيع مؤسسية كلاسيكية.', rules: '1. BSL: تجمع Stop Loss فوق القمم والمقاومات\n2. Equal Highs = أكثر سيولة (هدف مؤسسي)\n3. Liquidity Sweep: كسر القمة ثم انعكاس فوري\n4. كسر BSL + عودة تحت القمة = إشارة بيع\n5. المؤسسات تستهدف BSL لتنفيذ أوامرها الكبيرة\n6. كلما زادت القمم المتساوية زادت السيولة فوقها', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,55 18,35 25,42 35,30 42,38 52,28 58,34 65,28 72,32" fill="none" stroke="#fff" stroke-width="1.5"/><line x1="35" y1="28" x2="65" y2="28" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><text x="50" y="25" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">EQUAL HIGHS</text><polyline points="72,32 78,22 82,18" fill="none" stroke="#ff6a00" stroke-width="2"/><polyline points="82,18 86,25 90,35 94,42 100,50 106,58" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="82" y="14" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">SWEEP</text><line x1="35" y1="28" x2="90" y2="28" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/><rect x="25" y="18" width="50" height="10" fill="rgba(255,106,0,0.06)"/><text x="50" y="16" text-anchor="middle" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">BSL ZONE</text>' },
            { name: 'Sell-Side Liquidity (SSL)', ar: 'سيولة جانب البيع', rel: 90, type: 'BELOW LOWS', desc: 'عكس BSL — تجمع أوامر Stop Loss تحت القيعان السابقة (Swing Lows) وتحت مناطق الدعم. المتداولون الذين اشتروا (Long) يضعون Stop Loss تحت القيعان — أوامر بيع معلقة. المؤسسات تدفع السعر لأسفل لتنفيذها ثم ينعكس السعر صعوداً. Equal Lows أكثر سيولة. كسر SSL ثم الارتداد = إشارة شراء مؤسسية.', rules: '1. SSL: تجمع Stop Loss تحت القيعان والدعوم\n2. Equal Lows = أكثر سيولة (هدف مؤسسي)\n3. Liquidity Sweep: كسر القاع ثم انعكاس فوري\n4. كسر SSL + عودة فوق القاع = إشارة شراء\n5. مطابق لمفهوم Spring عند وايكوف\n6. كلما زادت القيعان المتساوية زادت السيولة تحتها', svg: '<rect width="120" height="80" fill="#000"/><polyline points="8,25 18,45 25,38 35,50 42,42 52,52 58,46 65,52 72,48" fill="none" stroke="#fff" stroke-width="1.5"/><line x1="35" y1="52" x2="65" y2="52" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><text x="50" y="60" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">EQUAL LOWS</text><polyline points="72,48 78,58 82,64" fill="none" stroke="#fff" stroke-width="2"/><polyline points="82,64 86,55 90,45 94,38 100,30 106,22" fill="none" stroke="#fff" stroke-width="2"/><text x="82" y="72" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">SWEEP</text><rect x="25" y="52" width="50" height="10" fill="rgba(255,255,255,0.05)"/><text x="50" y="70" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">SSL ZONE</text>' },
            { name: 'Liquidity Void / Imbalance', ar: 'فراغ السيولة (عدم التوازن)', rel: 82, type: 'MAGNET', desc: 'Liquidity Void هي منطقة سعرية تحرك فيها السعر بسرعة كبيرة بدون تداول كافي — لا توجد أوامر متبادلة بين المشترين والبائعين. تظهر كشموع كبيرة بدون ذيول تقريباً أو فجوات. السعر يميل للعودة لملء هذا الفراغ لاحقاً لأن السوق يبحث عن التوازن. Liquidity Void = مغناطيس يجذب السعر. في SMC: يُستخدم كهدف سعري — السعر سيعود لملء الفراغ قبل استكمال اتجاهه.', rules: '1. منطقة سعرية تحرك فيها السعر بسرعة بدون تداول كافي\n2. تظهر كشموع كبيرة بدون ذيول أو فجوات\n3. السعر يميل للعودة لملء الفراغ (70%+ من الحالات)\n4. يُستخدم كهدف سعري في التداول\n5. الفراغ الكبير يأخذ وقت أطول للملء\n6. مرتبط بمفهوم FVG (Fair Value Gap)', svg: '<rect width="120" height="80" fill="#000"/><rect x="32" y="18" width="12" height="8" fill="#fff" rx="1"/><rect x="46" y="20" width="12" height="30" fill="rgba(255,106,0,0.15)" stroke="#ff6a00" stroke-width="1" stroke-dasharray="2,2"/><rect x="60" y="10" width="12" height="8" fill="#fff" rx="1"/><text x="52" y="38" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">VOID</text><polyline points="75,45 80,35 85,30 90,28 95,32 100,38 105,42" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="2,2"/><text x="90" y="50" fill="#888" font-size="5" font-family="Share Tech Mono">FILL</text>' }
        ]
    },
    fvg: {
        en: 'FVG + GAPS', label: 'فجوات القيمة',
        patterns: [
            { name: 'Fair Value Gap (FVG)', ar: 'فجوة القيمة العادلة', rel: 88, type: 'IMBALANCE', desc: 'Fair Value Gap هي منطقة عدم توازن بين 3 شموع متتالية — الفجوة بين ذيل الشمعة الأولى وذيل الشمعة الثالثة التي لا تغطيها الشمعة الوسطى. في FVG صعودي: الفجوة بين أعلى سعر للشمعة 1 وأدنى سعر للشمعة 3. الشمعة 2 كبيرة جداً تركت فراغاً. السعر يميل للعودة لملء هذه الفجوة (Fair Value) قبل استكمال اتجاهه. FVG = منطقة دخول مؤسسية — المؤسسات تنتظر ملء الفجوة للدخول بسعر عادل.', rules: '1. FVG: فجوة بين ذيل الشمعة 1 وذيل الشمعة 3\n2. الشمعة الوسطى (2) كبيرة تركت فراغاً\n3. Bullish FVG: بين أعلى شمعة 1 وأدنى شمعة 3\n4. Bearish FVG: بين أدنى شمعة 1 وأعلى شمعة 3\n5. السعر يعود لملء FVG قبل الاستمرار (70%+)\n6. FVG في Discount/Premium = أقوى فرصة دخول', svg: '<rect width="120" height="80" fill="#000"/><rect x="28" y="45" width="12" height="18" fill="#fff" rx="1"/><line x1="34" y1="42" x2="34" y2="45" stroke="#fff" stroke-width="1.5"/><line x1="34" y1="63" x2="34" y2="68" stroke="#fff" stroke-width="1.5"/><rect x="44" y="15" width="14" height="40" fill="#fff" rx="1"/><line x1="51" y1="10" x2="51" y2="15" stroke="#fff" stroke-width="1.5"/><line x1="51" y1="55" x2="51" y2="60" stroke="#fff" stroke-width="1.5"/><rect x="62" y="20" width="12" height="18" fill="#fff" rx="1"/><line x1="68" y1="16" x2="68" y2="20" stroke="#fff" stroke-width="1.5"/><line x1="68" y1="38" x2="68" y2="42" stroke="#fff" stroke-width="1.5"/><rect x="40" y="38" width="24" height="7" fill="rgba(255,255,255,0.1)" stroke="#fff" stroke-width="1" stroke-dasharray="2,2"/><text x="52" y="44" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">FVG</text><text x="52" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">BULLISH FVG</text>' },
            { name: 'Consequent Encroachment (CE)', ar: 'التعدي التبعي — منتصف FVG', rel: 82, type: 'PRECISION ENTRY', desc: 'Consequent Encroachment هو منتصف (50%) فجوة القيمة العادلة (FVG). يُعتبر أدق نقطة دخول في منهجية ICT. بدلاً من الدخول عند أول لمسة لـ FVG (والتي قد لا تكون دقيقة) ينتظر المتداول المحترف وصول السعر لمنتصف FVG بالضبط. هذا يعطي سعر دخول أفضل ووقف خسارة أضيق. ليست كل FVGs يتم ملؤها حتى CE — فقط الأقوى منها.', rules: '1. CE = منتصف (50%) من FVG بالضبط\n2. نقطة دخول أدق من حافة FVG\n3. يعطي سعر دخول أفضل + وقف خسارة أضيق\n4. ليست كل FVGs تصل لـ CE\n5. FVG في Discount + CE = أقوى دخول ممكن\n6. مفهوم ICT متقدم — يحتاج صبر وانتظار', svg: '<rect width="120" height="80" fill="#000"/><rect x="30" y="30" width="50" height="20" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="30" y1="40" x2="80" y2="40" stroke="#ff6a00" stroke-width="1.5"/><text x="55" y="28" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono">FVG ZONE</text><text x="82" y="42" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">CE (50%)</text><polyline points="90,15 95,25 100,35 104,40" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="104" cy="40" r="3" fill="#ff6a00"/><polyline points="104,40 108,35 112,28" fill="none" stroke="#fff" stroke-width="1.5"/>' }
        ]
    },
    killzones: {
        en: 'KILL ZONES + TIME', label: 'أوقات التداول',
        patterns: [
            { name: 'Asian Kill Zone', ar: 'منطقة القتل الآسيوية', rel: 75, type: '20:00-00:00 UTC', desc: 'الجلسة الآسيوية (Asian Session) تُشكّل نطاق التداول (Range) الذي تستهدفه الجلسات اللاحقة. في ICT: Asian Range هو الصندوق — قمته وقاعه يمثلان مستويات سيولة رئيسية. جلسة London غالباً تكسر أحد جانبي Asian Range لجمع السيولة ثم تنعكس. فهم Asian Range يُعطيك خريطة ليوم التداول القادم.', rules: '1. التوقيت: 20:00 — 00:00 UTC\n2. تُشكّل نطاق التداول (Asian Range)\n3. قمة وقاع النطاق = مستويات سيولة\n4. London غالباً تكسر جانب Asian Range\n5. الكسر الكاذب لـ Asian Range = فرصة انعكاس\n6. حدد Asian Range قبل جلسة London', svg: '<rect width="120" height="80" fill="#000"/><rect x="10" y="28" width="40" height="30" fill="rgba(255,255,255,0.05)" stroke="#888" stroke-width="1"/><polyline points="15,48 20,38 25,42 30,35 35,40 40,32 45,38" fill="none" stroke="#888" stroke-width="1.5"/><polyline points="50,38 55,25 60,22 65,28 70,18 75,22 80,15 85,20 90,12 95,15" fill="none" stroke="#fff" stroke-width="2"/><text x="30" y="68" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono" font-weight="900">ASIAN</text><text x="75" y="68" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">LONDON</text><line x1="50" y1="20" x2="50" y2="65" stroke="#1a1a1a" stroke-width="1"/>' },
            { name: 'London Kill Zone', ar: 'منطقة القتل — لندن', rel: 92, type: '02:00-05:00 UTC', desc: 'أقوى وأهم Kill Zone في منهجية ICT. جلسة London Open (02:00-05:00 UTC) هي حيث يحدث أغلب التلاعب المؤسسي. النمط الكلاسيكي: كسر كاذب لأحد جانبي Asian Range (Judas Swing) ثم انعكاس حاد في الاتجاه الحقيقي. المؤسسات تستغل سيولة Asian Range لملء أوامرها الكبيرة. أكثر من 60% من حركة اليوم تتحدد خلال London Kill Zone. أفضل صفقات ICT تكون هنا.', rules: '1. التوقيت: 02:00 — 05:00 UTC (London Open)\n2. أقوى Kill Zone — أغلب التلاعب يحدث هنا\n3. كسر كاذب لـ Asian Range ثم انعكاس (Judas Swing)\n4. أكثر من 60% من حركة اليوم تتحدد هنا\n5. ابحث عن FVG + OB في Discount/Premium خلالها\n6. أفضل صفقات ICT تكون في London Kill Zone', svg: '<rect width="120" height="80" fill="#000"/><rect x="25" y="20" width="70" height="45" fill="rgba(255,106,0,0.06)"/><text x="60" y="16" text-anchor="middle" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">LONDON KILL ZONE</text><polyline points="28,40 35,48 40,52 45,55 48,58" fill="none" stroke="#ff6a00" stroke-width="2"/><polyline points="48,58 52,52 56,42 60,35 65,28 70,22 75,18 80,15 85,18 90,22" fill="none" stroke="#fff" stroke-width="2.5"/><text x="48" y="68" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">JUDAS SWING</text><text x="80" y="12" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">TRUE MOVE</text>' },
            { name: 'New York Kill Zone', ar: 'منطقة القتل — نيويورك', rel: 88, type: '07:00-10:00 UTC', desc: 'ثاني أهم Kill Zone. جلسة New York Open (07:00-10:00 UTC) تتداخل مع نهاية London مما يُنتج أعلى سيولة وحجم في اليوم. النمط: إما استمرار لاتجاه London أو انعكاس (London Close Reversal). في ICT: إذا London أنشأت الاتجاه فـ NY تستمر فيه غالباً. إذا London كانت تلاعب فقط فـ NY تكشف الاتجاه الحقيقي.', rules: '1. التوقيت: 07:00 — 10:00 UTC (NY Open)\n2. تتداخل مع نهاية London = أعلى سيولة\n3. إما تستمر في اتجاه London أو تعكسه\n4. NY PM (10:00-12:00 UTC) = حركات ثانوية\n5. أفضل صفقات NY: في اتجاه London مع Pullback\n6. London Close Reversal: انعكاس في نهاية London/بداية NY', svg: '<rect width="120" height="80" fill="#000"/><rect x="10" y="20" width="35" height="40" fill="rgba(255,106,0,0.04)"/><rect x="45" y="20" width="45" height="40" fill="rgba(255,255,255,0.05)"/><text x="28" y="16" text-anchor="middle" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">LONDON</text><text x="68" y="16" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">NEW YORK</text><polyline points="12,50 20,42 28,35 35,28 42,25 48,22 55,20 62,18 68,22 75,25 82,22 88,20" fill="none" stroke="#fff" stroke-width="2"/><line x1="45" y1="15" x2="45" y2="65" stroke="#1a1a1a" stroke-width="1"/><text x="55" y="68" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">OVERLAP = MAX VOLUME</text>' },
            { name: 'Power of 3 (AMD)', ar: 'قوة الثلاثة — التجميع والتلاعب والتوزيع', rel: 85, type: 'DAILY MODEL', desc: 'Power of 3 هو نموذج ICT اليومي الذي يصف حركة كل يوم تداول. كل يوم ينقسم لـ 3 مراحل: Accumulation (التجميع) في الجلسة الآسيوية — نطاق ضيق. Manipulation (التلاعب) في London Open — كسر كاذب لجمع السيولة (Judas Swing). Distribution (التوزيع) الحركة الحقيقية — الاتجاه الفعلي لليوم. AMD يتكرر يومياً — فهمه يعطيك خارطة طريق لكل يوم. المؤسسات تجمع → تتلاعب → توزع — كل يوم.', rules: '1. A (Accumulation): الجلسة الآسيوية — نطاق ضيق + تجميع\n2. M (Manipulation): London Open — كسر كاذب + Judas Swing\n3. D (Distribution): الحركة الحقيقية — الاتجاه الفعلي لليوم\n4. AMD يتكرر يومياً على كل الأصول\n5. حدد Asian Range → انتظر التلاعب → ادخل مع الاتجاه الحقيقي\n6. الحجم يؤكد: منخفض في A، مرتفع مؤقت في M، مرتفع مستمر في D', svg: '<rect width="120" height="80" fill="#000"/><rect x="5" y="28" width="28" height="28" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.8"/><polyline points="8,45 12,40 16,44 20,38 24,42 28,40" fill="none" stroke="#888" stroke-width="1.5"/><polyline points="33,40 36,48 39,52 42,55" fill="none" stroke="#ff6a00" stroke-width="2"/><polyline points="42,55 46,48 50,38 55,30 60,25 65,22 70,18 75,15 80,12 85,15 90,18 95,15 100,12 105,10 110,8" fill="none" stroke="#fff" stroke-width="2"/><text x="18" y="22" text-anchor="middle" fill="#888" font-size="8" font-family="Share Tech Mono" font-weight="900">A</text><text x="38" y="22" text-anchor="middle" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">M</text><text x="75" y="22" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">D</text><text x="42" y="64" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">JUDAS</text>' }
        ]
    }
};

function smRender() {
    var cat = smData[smCurrentCat];
    if (!cat) return;
    var el = document.getElementById('sm-content');
    if (!el) return;
    if (smSelectedIdx >= 0 && smSelectedIdx < cat.patterns.length) {
        el.innerHTML = smRenderDetail(cat.patterns[smSelectedIdx]);
        return;
    }
    var h = '<div class="sm-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        var isBear = p.type && (p.type.indexOf('SELL') >= 0 || p.type.indexOf('BEAR') >= 0 || p.type.indexOf('ABOVE') >= 0 || p.type.indexOf('REVERSAL') >= 0 || p.type.indexOf('INVALIDATION') >= 0);
        var topC = isBear ? '#ff6a00' : '#fff';
        h += '<div class="sm-card" style="border-top:3px solid ' + topC + '" onclick="smSelect(' + i + ')">';
        h += '<div class="sm-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
        h += '<div class="sm-card-name">' + p.name + '</div>';
        h += '<div class="sm-card-ar">' + p.ar + '</div>';
        if (p.type) { h += '<div class="sm-card-type">' + p.type + '</div>'; }
        if (p.rel) {
            h += '<div class="sm-card-rel-row"><span class="sm-card-rel-l">IMPORTANCE</span><span class="sm-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
            h += '<div class="sm-card-bar"><div class="sm-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
        }
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="sm-footer">ICT (Inner Circle Trader) و SMC (Smart Money Concepts) هما منهجيتان تُركّزان على فهم سلوك المؤسسات والأموال الذكية في الأسواق. طوّرها Michael J. Huddleston وانتشرت بقوة في مجتمع الكريبتو. الفكرة الأساسية: السوق ليس عشوائياً — المؤسسات تتلاعب بالسيولة لملء أوامرها الكبيرة. فهم أين تقع السيولة وكيف تتلاعب المؤسسات بها يمنحك ميزة تنافسية. المنهجية تحتاج وقت وممارسة طويلة لإتقانها. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
    el.innerHTML = h;
}

function smRenderDetail(p) {
    var h = '<div class="sm-back" onclick="smBack()">رجوع</div>';
    h += '<div class="sm-detail">';
    h += '<div class="sm-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
    h += '<div class="sm-detail-name">' + p.name + '</div>';
    h += '<div class="sm-detail-ar">' + p.ar + '</div>';
    if (p.type) { h += '<div class="sm-detail-badge">' + p.type + '</div>'; }
    if (p.rel) {
        h += '<div class="sm-detail-rel-row"><span class="sm-detail-rel-l">IMPORTANCE</span><span class="sm-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="sm-detail-bar"><div class="sm-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    }
    h += '<div class="sm-detail-desc-wrap"><div class="sm-detail-desc-label">DESCRIPTION // الوصف الأكاديمي</div><div class="sm-detail-desc">' + p.desc + '</div></div>';
    if (p.rules) {
        h += '<div class="sm-detail-rules-wrap"><div class="sm-detail-rules-label">KEY RULES // القواعد الأساسية</div>';
        var rules = p.rules.split('\n');
        for (var i = 0; i < rules.length; i++) {
            h += '<div class="sm-rule-row"><span class="sm-rule-num">' + rules[i].substring(0, 2) + '</span><span class="sm-rule-text">' + rules[i].substring(3) + '</span></div>';
        }
        h += '</div>';
    }
    h += '</div>';
    return h;
}

/* =====================================================================
   HARMONIC PATTERNS ACADEMY ENGINE — LEARN HUB 360
   ===================================================================== */

var hrCurrentCat = 'bullish';
var hrSelectedIdx = -1;

function hrSetCat(cat, btn) {
    hrCurrentCat = cat;
    hrSelectedIdx = -1;
    var btns = document.querySelectorAll('.hr-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('hr-cat-active');
    if (btn) btn.classList.add('hr-cat-active');
    hrRender();
}

function hrSelect(idx) { hrSelectedIdx = idx; hrRender(); }
function hrBack() { hrSelectedIdx = -1; hrRender(); }

function hrInit() {
    var tabsEl = document.getElementById('hr-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var keys = Object.keys(hrData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = hrData[k];
        h += '<button class="hr-cat-btn' + (k === hrCurrentCat ? ' hr-cat-active' : '') + '" onclick="hrSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    hrRender();
}

// SVG Helper — Harmonic XABCD shape
function hrShape(pts, color, labels) {
    var s = '<rect width="120" height="80" fill="#000"/>';
    // Lines XA, AB, BC, CD
    s += '<polyline points="' + pts.map(function(p){return p[0]+','+p[1]}).join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
    // Diagonal XB, AC, BD
    s += '<line x1="' + pts[0][0] + '" y1="' + pts[0][1] + '" x2="' + pts[2][0] + '" y2="' + pts[2][1] + '" stroke="' + color + '" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/>';
    s += '<line x1="' + pts[1][0] + '" y1="' + pts[1][1] + '" x2="' + pts[3][0] + '" y2="' + pts[3][1] + '" stroke="' + color + '" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/>';
    s += '<line x1="' + pts[0][0] + '" y1="' + pts[0][1] + '" x2="' + pts[4][0] + '" y2="' + pts[4][1] + '" stroke="' + color + '" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/>';
    // Dots
    for (var i = 0; i < pts.length; i++) {
        s += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="3" fill="' + color + '"/>';
    }
    // Labels
    var lbl = ['X', 'A', 'B', 'C', 'D'];
    var offsets = labels || [[0, 10], [0, -5], [0, 10], [0, -5], [0, 10]];
    for (var i = 0; i < 5; i++) {
        var tx = pts[i][0] + offsets[i][0], ty = pts[i][1] + offsets[i][1];
        s += '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" fill="' + color + '" font-size="9" font-family="Share Tech Mono" font-weight="900">' + lbl[i] + '</text>';
    }
    return s;
}

// ==================== DATA ====================
var hrData = {
    bullish: {
        en: 'BULLISH PATTERNS', label: 'نماذج صعودية',
        patterns: [
            { name: 'Bullish Gartley', ar: 'جارتلي الصعودي', rel: 85, type: 'BULLISH REVERSAL', desc: 'اكتشفه H.M. Gartley عام 1935 في كتابه "Profits in the Stock Market" وطوّره Scott Carney بإضافة نسب فيبوناتشي الدقيقة. يُعتبر الأب الروحي لجميع النماذج التوافقية. النموذج يتكون من 5 نقاط (X-A-B-C-D) حيث النقطة D هي منطقة الانعكاس المحتملة (PRZ — Potential Reversal Zone). الشرط الأساسي: B يجب أن تكون عند 61.8% من XA بالضبط. D يجب أن تكون عند 78.6% من XA. النموذج يُظهر تصحيح متناغم رياضياً ينتهي بانعكاس صعودي عند D.', fib: 'AB = 61.8% من XA (شرط أساسي — لا يقبل غيره)\nBC = 38.2% — 88.6% من AB\nCD = 127.2% — 161.8% من BC\nD = 78.6% من XA (شرط أساسي — PRZ)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. B عند 61.8% من XA بالضبط (الشرط الحاسم)\n2. D عند 78.6% من XA (منطقة الانعكاس PRZ)\n3. BC بين 38.2% و88.6% من AB\n4. CD بين 127.2% و161.8% من BC\n5. D لا تتجاوز X أبداً (إذا تجاوزتها النموذج باطل)\n6. الدخول عند D مع SL تحت X وTP عند 38.2%-61.8% من AD', svg: hrShape([[10, 55], [35, 15], [50, 38], [40, 22], [70, 62]], '#fff', [[0, 10], [0, -6], [2, 12], [0, -6], [0, 10]]) },
            { name: 'Bullish Bat', ar: 'الخفاش الصعودي', rel: 88, type: 'BULLISH REVERSAL', desc: 'اكتشفه Scott Carney عام 2001. يتميز بأن النقطة D تقع عند 88.6% من XA — أعمق من Gartley مما يعطي نسبة مخاطرة/مكافأة أفضل. يُعتبر من أدق النماذج التوافقية لأن 88.6% هي الجذر التربيعي لـ 78.6% مما يعطيها أهمية رياضية خاصة. SL ضيق جداً (تحت X مباشرة) مقابل أهداف واسعة.', fib: 'AB = 38.2% — 50% من XA\nBC = 38.2% — 88.6% من AB\nCD = 161.8% — 261.8% من BC\nD = 88.6% من XA (الشرط الحاسم — PRZ)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD\nSL: تحت X مباشرة', rules: '1. B عند 38.2%-50% من XA (ليس 61.8% مثل Gartley)\n2. D عند 88.6% من XA بالضبط (الشرط الحاسم)\n3. BC بين 38.2% و88.6% من AB\n4. CD بين 161.8% و261.8% من BC\n5. D لا تتجاوز X أبداً\n6. R:R ممتاز لأن SL قريب (تحت X) والأهداف بعيدة', svg: hrShape([[10, 52], [38, 12], [52, 32], [42, 18], [72, 65]], '#fff', [[0, 10], [0, -6], [2, 12], [0, -6], [0, 10]]) },
            { name: 'Bullish Butterfly', ar: 'الفراشة الصعودية', rel: 82, type: 'BULLISH REVERSAL', desc: 'اكتشفها Bryce Gilmore وطوّرها Scott Carney. الفرق الأساسي عن Gartley والخفاش: النقطة D تتجاوز النقطة X — تمتد خارج النموذج. D عند 127.2% أو 161.8% من XA. هذا يعني أن السعر يكسر قاع X قبل الانعكاس — فخ سيولة كلاسيكي يُطرد فيه المتداولون قبل الانعكاس الحقيقي. مشابه لمفهوم Spring في وايكوف.', fib: 'AB = 78.6% من XA (شرط أساسي)\nBC = 38.2% — 88.6% من AB\nCD = 161.8% — 224% من BC\nD = 127.2% — 161.8% من XA (تتجاوز X)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. B عند 78.6% من XA بالضبط (الشرط الحاسم)\n2. D عند 127.2%-161.8% من XA (تتجاوز X)\n3. D تتجاوز X — وهذا طبيعي في الفراشة\n4. BC بين 38.2% و88.6% من AB\n5. CD بين 161.8% و224% من BC\n6. SL تحت D (وليس تحت X لأن D تتجاوز X)', svg: hrShape([[30, 48], [50, 10], [60, 30], [52, 16], [15, 58]], '#fff', [[0, -6], [0, -6], [2, 12], [0, -6], [0, 10]]) },
            { name: 'Bullish Crab', ar: 'السلطعون الصعودي', rel: 80, type: 'BULLISH REVERSAL', desc: 'اكتشفه Scott Carney عام 2000. أكثر النماذج التوافقية امتداداً — D عند 161.8% من XA (أعمق من الفراشة). يُنتج أقوى انعكاسات لكنه الأصعب في التعرف عليه مبكراً. SL يجب أن يكون واسعاً لأن D بعيدة عن X. لكن الأهداف كبيرة جداً مما يعوّض. يظهر عادة في نهاية الاتجاهات الكبرى حيث السعر يمتد أبعد مما يتوقع الجميع.', fib: 'AB = 38.2% — 61.8% من XA\nBC = 38.2% — 88.6% من AB\nCD = 224% — 361.8% من BC\nD = 161.8% من XA (الشرط الحاسم — أبعد امتداد)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. B عند 38.2%-61.8% من XA\n2. D عند 161.8% من XA بالضبط (أبعد امتداد)\n3. BC بين 38.2% و88.6% من AB\n4. CD بين 224% و361.8% من BC (امتداد كبير)\n5. أقوى انعكاس لكن أصعب في التحديد المبكر\n6. يظهر في نهاية الاتجاهات الكبرى', svg: hrShape([[35, 42], [52, 8], [62, 25], [55, 14], [8, 68]], '#fff', [[0, -6], [0, -6], [2, 12], [0, -6], [0, 10]]) },
            { name: 'Bullish Shark', ar: 'القرش الصعودي', rel: 75, type: 'BULLISH REVERSAL', desc: 'اكتشفه Scott Carney عام 2011. نموذج حديث نسبياً يختلف عن الباقي بأنه يستخدم 5 نقاط مسماة 0-X-A-B-C بدلاً من X-A-B-C-D. الشرط الأساسي: C عند 88.6%-113% من 0X. يُعتبر نموذج عدواني — يُنتج انعكاسات حادة وسريعة. أقل شيوعاً من Gartley والخفاش لكنه فعّال جداً عند ظهوره.', fib: 'AB = 113% — 161.8% من 0X\nBC = 113% من 0X أو 161.8% — 224% من AB\nC = 88.6% — 113% من 0X (PRZ)\nهدف TP1: 50% من BC\nهدف TP2: 88.6% من BC', rules: '1. يستخدم تسمية 0-X-A-B-C (ليس XABCD)\n2. C عند 88.6%-113% من 0X (PRZ)\n3. AB بين 113% و161.8% من 0X\n4. نموذج عدواني — انعكاسات حادة\n5. أقل شيوعاً لكن فعّال\n6. SL تحت C مع أهداف عند 50%-88.6% من BC', svg: hrShape([[10, 50], [32, 15], [20, 35], [45, 10], [65, 60]], '#fff', [[0, 10], [0, -6], [0, 12], [0, -6], [0, 10]]) },
            { name: 'Bullish Cypher', ar: 'السايفر الصعودي', rel: 78, type: 'BULLISH REVERSAL', desc: 'اكتشفه Darren Oglesby. نموذج فريد لأن النقطة C تتجاوز النقطة A (على عكس معظم النماذج). الشرط الحاسم: D عند 78.6% من XC (وليس من XA). هذا يجعله مختلف حسابياً عن الباقي. يُنتج صفقات بنسبة R:R جيدة لأن SL ضيق (تحت X) والأهداف من فيبوناتشي واسعة.', fib: 'AB = 38.2% — 61.8% من XA\nBC = 113% — 141.4% من AB (C تتجاوز A)\nD = 78.6% من XC (الشرط الحاسم — ليس من XA)\nهدف TP1: 38.2% من CD\nهدف TP2: 61.8% من CD', rules: '1. B عند 38.2%-61.8% من XA\n2. C تتجاوز A (فوق A في الصعودي)\n3. D عند 78.6% من XC (وليس من XA — فرق مهم)\n4. BC بين 113% و141.4% من AB\n5. SL تحت X\n6. نموذج فريد بحسابات مختلفة عن الباقي', svg: hrShape([[10, 58], [35, 18], [48, 35], [30, 8], [62, 52]], '#fff', [[0, 10], [0, -6], [2, 12], [-2, -6], [0, 10]]) },
            { name: 'Bullish ABCD', ar: 'نموذج ABCD الصعودي', rel: 82, type: 'BULLISH REVERSAL', desc: 'أبسط النماذج التوافقية وأساسها. يتكون من 4 نقاط فقط (A-B-C-D) بدون نقطة X. هيكل متماثل — الساق AB تساوي الساق CD في الطول والزمن (AB=CD). النقطة D هي منطقة الانعكاس. رغم بساطته فهو فعّال جداً لأنه يعكس التوازن الطبيعي في حركة السعر. يظهر بكثرة على كل الفريمات. غالباً يكون جزء من نموذج أكبر (مثل Gartley أو Bat).', fib: 'BC = 61.8% — 78.6% من AB\nCD = 100% من AB (AB=CD) أو 127.2% — 161.8% من BC\nD = عند مستوى يُكمل التماثل\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. AB = CD في الطول (الشرط الأساسي)\n2. BC بين 61.8% و78.6% من AB\n3. CD بين 127.2% و161.8% من BC\n4. التماثل الزمني مهم: مدة AB ≈ مدة CD\n5. أبسط النماذج لكنه فعّال جداً\n6. غالباً جزء من نموذج أكبر (Gartley/Bat)', svg: '<rect width="120" height="80" fill="#000"/><polyline points="15,20 40,55 60,30 85,65" fill="none" stroke="#fff" stroke-width="2.5"/><line x1="15" y1="20" x2="60" y2="30" stroke="#fff" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/><line x1="40" y1="55" x2="85" y2="65" stroke="#fff" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/><circle cx="15" cy="20" r="3" fill="#fff"/><circle cx="40" cy="55" r="3" fill="#fff"/><circle cx="60" cy="30" r="3" fill="#fff"/><circle cx="85" cy="65" r="3" fill="#fff"/><text x="15" y="15" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">A</text><text x="40" y="65" text-anchor="middle" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">B</text><text x="60" y="25" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">C</text><text x="85" y="75" text-anchor="middle" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">D</text><text x="28" y="32" fill="#888" font-size="6" font-family="Share Tech Mono">AB</text><text x="72" y="52" fill="#888" font-size="6" font-family="Share Tech Mono">CD</text><text x="50" y="75" fill="#888" font-size="5" font-family="Share Tech Mono">AB = CD</text>' },
            { name: 'Bullish Three Drives', ar: 'الدفعات الثلاث الصعودية', rel: 72, type: 'BULLISH REVERSAL', desc: 'نموذج فريد يتكون من 3 دفعات متتالية في نفس الاتجاه (3 قيعان متتالية) كل منها عند نسبة فيبوناتشي محددة. يُشبه 3 محاولات فاشلة لاستمرار الهبوط — كل محاولة أضعف. بعد الدفعة الثالثة ينعكس السعر صعوداً. يشترك في المفهوم مع Triple Bottom لكن بنسب فيبوناتشي دقيقة.', fib: 'Drive 2 = 127.2% — 161.8% من التصحيح 1\nDrive 3 = 127.2% — 161.8% من التصحيح 2\nالتصحيح 1: 61.8% — 78.6% من Drive 1\nالتصحيح 2: 61.8% — 78.6% من Drive 2\nالدفعات تتساوى تقريباً في الطول', rules: '1. ثلاث دفعات (قيعان) متتالية هابطة\n2. كل دفعة عند 127.2%-161.8% من التصحيح السابق\n3. التصحيحات عند 61.8%-78.6%\n4. الدفعات تتساوى تقريباً في الطول والزمن\n5. بعد الدفعة الثالثة: انعكاس صعودي\n6. مشابه لـ Triple Bottom بنسب فيبوناتشي', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,20 25,42 35,28 50,55 60,38 75,68" fill="none" stroke="#fff" stroke-width="2"/><polyline points="75,68 90,45 105,25" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4,3"/><text x="25" y="50" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">1</text><text x="50" y="63" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">2</text><text x="75" y="76" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">3</text><text x="95" y="30" fill="#fff" font-size="6" font-family="Share Tech Mono">REVERSAL</text>' }
        ]
    },
    bearish: {
        en: 'BEARISH PATTERNS', label: 'نماذج هبوطية',
        patterns: [
            { name: 'Bearish Gartley', ar: 'جارتلي الهبوطي', rel: 85, type: 'BEARISH REVERSAL', desc: 'النسخة الهبوطية من Gartley — نفس النسب بالضبط لكن مقلوبة. النقطة D عند 78.6% من XA تكون في الأعلى وتمثل منطقة البيع (PRZ). الانعكاس يكون هبوطي من D. نفس الشروط: B عند 61.8% من XA. يظهر في نهاية الاتجاهات الصعودية.', fib: 'AB = 61.8% من XA\nBC = 38.2% — 88.6% من AB\nCD = 127.2% — 161.8% من BC\nD = 78.6% من XA (PRZ — منطقة البيع)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. B عند 61.8% من XA بالضبط\n2. D عند 78.6% من XA (منطقة البيع PRZ)\n3. D لا تتجاوز X أبداً\n4. الدخول بيع عند D مع SL فوق X\n5. نفس نسب الصعودي لكن مقلوب\n6. يظهر في نهاية الاتجاهات الصعودية', svg: hrShape([[10, 25], [35, 65], [50, 42], [40, 58], [70, 18]], '#ff6a00', [[0, -6], [0, 10], [2, -6], [0, 10], [0, -6]]) },
            { name: 'Bearish Bat', ar: 'الخفاش الهبوطي', rel: 88, type: 'BEARISH REVERSAL', desc: 'النسخة الهبوطية — D عند 88.6% من XA في الأعلى. SL ضيق فوق X والأهداف واسعة للأسفل. نفس الدقة الرياضية العالية.', fib: 'AB = 38.2% — 50% من XA\nBC = 38.2% — 88.6% من AB\nCD = 161.8% — 261.8% من BC\nD = 88.6% من XA (PRZ)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. B عند 38.2%-50% من XA\n2. D عند 88.6% من XA (الشرط الحاسم)\n3. D لا تتجاوز X\n4. R:R ممتاز — SL ضيق فوق X\n5. من أدق النماذج الهبوطية\n6. الدخول بيع عند D', svg: hrShape([[10, 28], [38, 68], [52, 48], [42, 62], [72, 15]], '#ff6a00', [[0, -6], [0, 10], [2, -6], [0, 10], [0, -6]]) },
            { name: 'Bearish Butterfly', ar: 'الفراشة الهبوطية', rel: 82, type: 'BEARISH REVERSAL', desc: 'D تتجاوز X في الأعلى — فخ سيولة. B عند 78.6% من XA. D عند 127.2%-161.8% من XA. السعر يتجاوز القمة السابقة (X) لجمع Stop Loss ثم ينعكس هبوطاً.', fib: 'AB = 78.6% من XA\nBC = 38.2% — 88.6% من AB\nCD = 161.8% — 224% من BC\nD = 127.2% — 161.8% من XA (تتجاوز X)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. B عند 78.6% من XA\n2. D تتجاوز X (طبيعي في الفراشة)\n3. D عند 127.2%-161.8% من XA\n4. فخ سيولة فوق X\n5. SL فوق D (وليس فوق X)\n6. مشابه لـ UTAD في وايكوف', svg: hrShape([[30, 32], [50, 70], [60, 50], [52, 64], [15, 22]], '#ff6a00', [[0, 10], [0, 10], [2, -6], [0, 10], [0, -6]]) },
            { name: 'Bearish Crab', ar: 'السلطعون الهبوطي', rel: 80, type: 'BEARISH REVERSAL', desc: 'أكثر النماذج امتداداً هبوطياً — D عند 161.8% من XA. يظهر في نهاية الاتجاهات الصعودية الكبرى حيث السعر يمتد أبعد مما يتوقع الجميع ثم ينعكس بحدة.', fib: 'AB = 38.2% — 61.8% من XA\nBC = 38.2% — 88.6% من AB\nCD = 224% — 361.8% من BC\nD = 161.8% من XA (أبعد امتداد)\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. D عند 161.8% من XA (أبعد امتداد)\n2. أقوى انعكاس هبوطي ممكن\n3. SL فوق D\n4. CD بين 224% و361.8% من BC\n5. يظهر في نهاية الصعود الكبير\n6. الانعكاس بعده حاد جداً', svg: hrShape([[35, 38], [52, 72], [62, 55], [55, 66], [8, 12]], '#ff6a00', [[0, 10], [0, 10], [2, -6], [0, 10], [0, -6]]) },
            { name: 'Bearish Shark', ar: 'القرش الهبوطي', rel: 75, type: 'BEARISH REVERSAL', desc: 'النسخة الهبوطية — C عند 88.6%-113% من 0X في الأعلى. انعكاس حاد وسريع هبوطاً.', fib: 'AB = 113% — 161.8% من 0X\nBC = 113% من 0X أو 161.8%-224% من AB\nC = 88.6% — 113% من 0X (PRZ)\nهدف TP1: 50% من BC\nهدف TP2: 88.6% من BC', rules: '1. تسمية 0-X-A-B-C\n2. C عند 88.6%-113% من 0X\n3. نموذج عدواني — انعكاس حاد\n4. SL فوق C\n5. أهداف عند 50%-88.6% من BC\n6. أقل شيوعاً لكن فعّال', svg: hrShape([[10, 30], [32, 65], [20, 45], [45, 70], [65, 18]], '#ff6a00', [[0, -6], [0, 10], [0, -6], [0, 10], [0, -6]]) },
            { name: 'Bearish Cypher', ar: 'السايفر الهبوطي', rel: 78, type: 'BEARISH REVERSAL', desc: 'C تتجاوز A في الأسفل. D عند 78.6% من XC. نموذج فريد بحسابات مختلفة.', fib: 'AB = 38.2% — 61.8% من XA\nBC = 113% — 141.4% من AB\nD = 78.6% من XC (ليس XA)\nهدف TP1: 38.2% من CD\nهدف TP2: 61.8% من CD', rules: '1. B عند 38.2%-61.8% من XA\n2. C تتجاوز A\n3. D عند 78.6% من XC\n4. SL فوق X\n5. حسابات مختلفة عن الباقي\n6. R:R جيد', svg: hrShape([[10, 22], [35, 62], [48, 45], [30, 72], [62, 28]], '#ff6a00', [[0, -6], [0, 10], [2, -6], [0, 10], [0, -6]]) },
            { name: 'Bearish ABCD', ar: 'نموذج ABCD الهبوطي', rel: 82, type: 'BEARISH REVERSAL', desc: 'أبسط النماذج مقلوب — 4 نقاط بتماثل AB=CD. D في الأعلى = منطقة البيع.', fib: 'BC = 61.8% — 78.6% من AB\nCD = 100% من AB (AB=CD)\nأو CD = 127.2% — 161.8% من BC\nهدف TP1: 38.2% من AD\nهدف TP2: 61.8% من AD', rules: '1. AB = CD في الطول\n2. BC بين 61.8% و78.6% من AB\n3. التماثل الزمني مهم\n4. D = منطقة البيع\n5. أبسط وأكثر شيوعاً\n6. SL فوق D', svg: '<rect width="120" height="80" fill="#000"/><polyline points="15,60 40,25 60,50 85,15" fill="none" stroke="#ff6a00" stroke-width="2.5"/><line x1="15" y1="60" x2="60" y2="50" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/><line x1="40" y1="25" x2="85" y2="15" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.3"/><circle cx="15" cy="60" r="3" fill="#ff6a00"/><circle cx="40" cy="25" r="3" fill="#ff6a00"/><circle cx="60" cy="50" r="3" fill="#ff6a00"/><circle cx="85" cy="15" r="3" fill="#ff6a00"/><text x="15" y="70" text-anchor="middle" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">A</text><text x="40" y="20" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">B</text><text x="60" y="58" text-anchor="middle" fill="#ff6a00" font-size="9" font-family="Share Tech Mono" font-weight="900">C</text><text x="85" y="12" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">D</text>' },
            { name: 'Bearish Three Drives', ar: 'الدفعات الثلاث الهبوطية', rel: 72, type: 'BEARISH REVERSAL', desc: '3 دفعات صعودية متتالية (3 قمم) كل منها عند نسبة فيبوناتشي. بعد الثالثة ينعكس السعر هبوطاً.', fib: 'Drive 2 = 127.2%-161.8% من التصحيح 1\nDrive 3 = 127.2%-161.8% من التصحيح 2\nالتصحيحات: 61.8%-78.6%\nالدفعات متساوية تقريباً', rules: '1. ثلاث دفعات (قمم) صعودية\n2. كل دفعة عند 127.2%-161.8% من التصحيح\n3. التصحيحات عند 61.8%-78.6%\n4. الدفعات متساوية في الطول\n5. بعد الثالثة: انعكاس هبوطي\n6. مشابه لـ Triple Top بنسب فيبوناتشي', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,60 25,38 35,52 50,25 60,42 75,12" fill="none" stroke="#ff6a00" stroke-width="2"/><polyline points="75,12 90,35 105,55" fill="none" stroke="#ff6a00" stroke-width="2" stroke-dasharray="4,3"/><text x="25" y="34" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">1</text><text x="50" y="21" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">2</text><text x="75" y="10" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">3</text><text x="95" y="50" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">REVERSAL</text>' }
        ]
    },
    guide: {
        en: 'PRZ GUIDE', label: 'دليل التداول',
        patterns: [
            { name: 'Potential Reversal Zone (PRZ)', ar: 'منطقة الانعكاس المحتملة', rel: 95, type: 'CORE CONCEPT', desc: 'PRZ هو المفهوم الأهم في الهارمونيك — المنطقة السعرية حيث تتقاطع نسب فيبوناتشي المتعددة من أضلاع النموذج. ليست نقطة واحدة بل منطقة (Zone) لأن النسب نادراً ما تتطابق بالضبط. كلما زاد عدد النسب المتقاطعة في PRZ كانت المنطقة أقوى. الدخول يكون عند وصول السعر لـ PRZ + ظهور إشارة انعكاس (شمعة انعكاسية، دايفرجنس). لا تدخل أبداً قبل التأكيد — PRZ وحدها ليست كافية.', fib: 'PRZ = تقاطع نسب فيبوناتشي المتعددة\nكلما زادت النسب المتقاطعة = PRZ أقوى\nمثال: D عند 78.6% من XA + 127.2% من BC = PRZ قوي\nالتأكيد: شمعة انعكاسية + دايفرجنس في PRZ\nSL: خلف PRZ بمسافة أمان (1-2 ATR)', rules: '1. PRZ = منطقة تقاطع نسب فيبوناتشي المتعددة\n2. ليست نقطة — بل منطقة سعرية\n3. لا تدخل بدون تأكيد (شمعة انعكاسية / دايفرجنس)\n4. كلما زادت النسب المتقاطعة = PRZ أقوى\n5. SL خلف PRZ بمسافة أمان\n6. TP عند 38.2% و61.8% من AD', svg: '<rect width="120" height="80" fill="#000"/><rect x="55" y="50" width="30" height="18" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><line x1="10" y1="10" x2="70" y2="58" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="30" y1="70" x2="70" y2="54" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="50" y1="15" x2="70" y2="60" stroke="#888" stroke-width="0.8" stroke-dasharray="2,2"/><text x="70" y="48" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">PRZ</text><text x="70" y="75" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">MULTIPLE FIBS CONVERGE</text>' },
            { name: 'Entry, Stop Loss & Targets', ar: 'الدخول ووقف الخسارة والأهداف', rel: 90, type: 'TRADE MANAGEMENT', desc: 'نظام إدارة الصفقة في الهارمونيك محدد ومنضبط. الدخول: عند PRZ مع تأكيد (شمعة انعكاسية). SL: خلف PRZ — في Gartley/Bat تحت X، في Butterfly/Crab تحت D. TP1: 38.2% من AD (هدف محافظ — أغلق جزء). TP2: 61.8% من AD (هدف رئيسي). TP3: 78.6% من AD أو نقطة A (هدف ممتد). حرّك SL لنقطة التعادل بعد وصول TP1. هذا النظام يُعطي R:R ممتاز خاصة في Bat (أضيق SL).', fib: 'دخول: عند PRZ + تأكيد شمعة انعكاسية\nSL: تحت X (Gartley/Bat) أو تحت D (Butterfly/Crab)\nTP1: 38.2% من AD — أغلق 50% من الصفقة\nTP2: 61.8% من AD — أغلق 30%\nTP3: A أو 78.6% من AD — أغلق 20%\nحرّك SL لـ Break-even بعد TP1', rules: '1. لا تدخل بدون تأكيد شمعة انعكاسية في PRZ\n2. SL: Gartley/Bat = تحت X | Butterfly/Crab = تحت D\n3. TP1 (38.2% AD): أغلق نصف الصفقة\n4. TP2 (61.8% AD): أغلق جزء إضافي\n5. TP3 (A أو 78.6% AD): الباقي\n6. حرّك SL لـ Break-even فور وصول TP1' }
        ]
    }
};

function hrRender() {
    var cat = hrData[hrCurrentCat];
    if (!cat) return;
    var el = document.getElementById('hr-content');
    if (!el) return;
    if (hrSelectedIdx >= 0 && hrSelectedIdx < cat.patterns.length) {
        el.innerHTML = hrRenderDetail(cat.patterns[hrSelectedIdx]);
        return;
    }
    var h = '<div class="hr-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        var isBear = p.type && p.type.indexOf('BEAR') >= 0;
        var topC = isBear ? '#ff6a00' : '#fff';
        h += '<div class="hr-card" style="border-top:3px solid ' + topC + '" onclick="hrSelect(' + i + ')">';
        if(p.svg) {
            h += '<div class="hr-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
        }
        h += '<div class="hr-card-name">' + p.name + '</div>';
        h += '<div class="hr-card-ar">' + p.ar + '</div>';
        if (p.type) { h += '<div class="hr-card-type">' + p.type + '</div>'; }
        if (p.rel) {
            h += '<div class="hr-card-rel-row"><span class="hr-card-rel-l">RELIABILITY</span><span class="hr-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
            h += '<div class="hr-card-bar"><div class="hr-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
        }
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="hr-footer">النماذج التوافقية (الهارمونيك) تعتمد على نسب فيبوناتشي الدقيقة لتحديد نقاط الانعكاس. طوّرها H.M. Gartley (1935) وScott Carney (2000+). الدقة في النسب أساسية — انحراف بسيط يُبطل النموذج. لا تدخل أبداً بدون تأكيد في PRZ. النماذج تحتاج تدريب وممارسة طويلة للتعرف عليها بدقة. استخدم أدوات الرسم التلقائي كمساعد وليس كبديل عن الفهم. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
    el.innerHTML = h;
}

function hrRenderDetail(p) {
    var h = '<div class="hr-back" onclick="hrBack()">رجوع</div>';
    h += '<div class="hr-detail">';
    if(p.svg) {
        h += '<div class="hr-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
    }
    h += '<div class="hr-detail-name">' + p.name + '</div>';
    h += '<div class="hr-detail-ar">' + p.ar + '</div>';
    if (p.type) {
        var bc = p.type.indexOf('BEAR') >= 0 ? '#ff6a00' : '#fff';
        h += '<div class="hr-detail-badge" style="background:' + bc + ';color:#000">' + p.type + '</div>';
    }
    if (p.rel) {
        h += '<div class="hr-detail-rel-row"><span class="hr-detail-rel-l">RELIABILITY</span><span class="hr-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="hr-detail-bar"><div class="hr-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    }
    h += '<div class="hr-detail-desc-wrap"><div class="hr-detail-desc-label">DESCRIPTION // الوصف الأكاديمي</div><div class="hr-detail-desc">' + p.desc + '</div></div>';
    if (p.fib) {
        h += '<div class="hr-detail-fib-wrap"><div class="hr-detail-fib-label">FIBONACCI RATIOS // نسب فيبوناتشي الدقيقة</div>';
        var fibs = p.fib.split('\n');
        for (var i = 0; i < fibs.length; i++) {
            h += '<div class="hr-fib-row"><span class="hr-fib-arrow">▶</span><span class="hr-fib-text">' + fibs[i] + '</span></div>';
        }
        h += '</div>';
    }
    if (p.rules) {
        h += '<div class="hr-detail-rules-wrap"><div class="hr-detail-rules-label">RULES // الشروط والقواعد</div>';
        var rules = p.rules.split('\n');
        for (var i = 0; i < rules.length; i++) {
            h += '<div class="hr-rule-row"><span class="hr-rule-num">' + rules[i].substring(0, 2) + '</span><span class="hr-rule-text">' + rules[i].substring(3) + '</span></div>';
        }
        h += '</div>';
    }
    h += '</div>';
    return h;
}

/* =====================================================================
   INDICATORS ACADEMY ENGINE — LEARN HUB 360
   ===================================================================== */

var indCurrentCat = 'momentum';
var indSelectedIdx = -1;

function indSetCat(cat, btn) {
    indCurrentCat = cat;
    indSelectedIdx = -1;
    var btns = document.querySelectorAll('.ind-cat-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('ind-cat-active');
    if (btn) btn.classList.add('ind-cat-active');
    indRender();
}

function indSelect(idx) { indSelectedIdx = idx; indRender(); }
function indBack() { indSelectedIdx = -1; indRender(); }

function indInit() {
    var tabsEl = document.getElementById('ind-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var keys = Object.keys(indData);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i], c = indData[k];
        h += '<button class="ind-cat-btn' + (k === indCurrentCat ? ' ind-cat-active' : '') + '" onclick="indSetCat(\'' + k + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    indRender();
}

// ==================== DATA (COMPLETE & UNTOUCHED) ====================
var indData = {
    momentum: {
        en: 'MOMENTUM', label: 'مؤشرات الزخم',
        patterns: [
            { name: 'RSI — Relative Strength Index', ar: 'مؤشر القوة النسبية', rel: 92, type: 'OSCILLATOR (0-100)', desc: 'طوّره J. Welles Wilder عام 1978. يقيس سرعة وقوة حركة السعر على مقياس من 0 إلى 100. يُحسب بمقارنة متوسط الارتفاعات مع متوسط الانخفاضات خلال فترة محددة (14 فترة افتراضياً). فوق 70 = تشبع شراء (Overbought) — السعر ارتفع بسرعة وقد يحتاج تصحيح. تحت 30 = تشبع بيع (Oversold) — السعر انخفض بسرعة وقد يرتد. المنطقة بين 30 و70 هي المنطقة المحايدة. الأهم من مناطق التشبع هو الدايفرجنس: عندما يسجل السعر قمة جديدة لكن RSI يسجل قمة أدنى = ضعف مخفي وانعكاس قريب. RSI هو الأكثر استخداماً بين المتداولين لسهولته ودقته.', fib: 'الإعداد الافتراضي: 14 فترة (Wilder)\nفوق 70: تشبع شراء — تحذير من تصحيح\nتحت 30: تشبع بيع — تحذير من ارتداد\n50: خط الوسط — فوقه صعودي تحته هبوطي\nفوق 80: تشبع شراء شديد\nتحت 20: تشبع بيع شديد', rules: '1. فوق 70 = تشبع شراء — لا تشتري هنا (انتظر التصحيح)\n2. تحت 30 = تشبع بيع — لا تبيع هنا (انتظر الارتداد)\n3. الدايفرجنس أهم من مناطق التشبع (إشارة انعكاس)\n4. كسر 50 من الأسفل = تحول صعودي\n5. كسر 50 من الأعلى = تحول هبوطي\n6. في الاتجاه القوي RSI قد يبقى في تشبع لفترة طويلة', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="18" x2="110" y2="18" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="2,2"/><line x1="10" y1="40" x2="110" y2="40" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="62" x2="110" y2="62" stroke="#fff" stroke-width="0.8" stroke-dasharray="2,2"/><text x="112" y="20" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">70</text><text x="112" y="42" fill="#888" font-size="6" font-family="Share Tech Mono">50</text><text x="112" y="64" fill="#fff" font-size="6" font-family="Share Tech Mono">30</text><polyline points="12,55 20,48 28,42 35,35 42,28 48,22 55,15 60,18 65,25 70,32 75,38 80,42 85,48 90,55 95,50 100,45 108,40" fill="none" stroke="#fff" stroke-width="2"/><rect x="10" y="8" width="100" height="10" fill="rgba(255,106,0,0.06)"/><rect x="10" y="62" width="100" height="10" fill="rgba(255,255,255,0.04)"/><text x="30" y="8" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">OVERBOUGHT</text><text x="30" y="76" fill="#fff" font-size="5" font-family="Share Tech Mono">OVERSOLD</text>' },
            { name: 'RSI Divergence', ar: 'دايفرجنس RSI', rel: 90, type: 'REVERSAL SIGNAL', desc: 'أقوى إشارة يُنتجها RSI. الدايفرجنس يحدث عندما يتحرك السعر في اتجاه بينما RSI يتحرك في الاتجاه المعاكس. Bullish Divergence (صعودي): السعر يسجل قاع أدنى لكن RSI يسجل قاع أعلى = ضعف الزخم الهبوطي = ارتداد صعودي قريب. Bearish Divergence (هبوطي): السعر يسجل قمة أعلى لكن RSI يسجل قمة أدنى = ضعف الزخم الصعودي = تصحيح هبوطي قريب. Hidden Divergence: عكس العادي — يؤكد استمرار الاتجاه بدلاً من انعكاسه. الدايفرجنس يحتاج تأكيد — لا تتداول عليه وحده.', fib: 'Regular Bullish Div: سعر LL + RSI HL = انعكاس صعودي\nRegular Bearish Div: سعر HH + RSI LH = انعكاس هبوطي\nHidden Bullish Div: سعر HL + RSI LL = استمرار صعود\nHidden Bearish Div: سعر LH + RSI HH = استمرار هبوط\nالدايفرجنس على فريمات أكبر = أقوى', rules: '1. Regular Divergence = انعكاس الاتجاه\n2. Hidden Divergence = استمرار الاتجاه\n3. Bearish Div: سعر HH + RSI LH = تحذير هبوطي\n4. Bullish Div: سعر LL + RSI HL = تحذير صعودي\n5. تحتاج تأكيد من شمعة انعكاسية أو كسر هيكل\n6. الدايفرجنس على فريم يومي أقوى من فريم دقيقة', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,25 30,20 50,30 70,15 90,25 110,10" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="10,55 30,50 50,58 70,48 90,60 110,55" fill="none" stroke="#ff6a00" stroke-width="1.5"/><line x1="50" y1="30" x2="110" y2="10" stroke="#fff" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="50" y1="58" x2="110" y2="55" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/><text x="60" y="8" fill="#fff" font-size="6" font-family="Share Tech Mono">PRICE: HH</text><text x="60" y="72" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">RSI: LH</text><text x="60" y="78" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">BEARISH DIVERGENCE</text>' },
            { name: 'MACD — Moving Average Convergence Divergence', ar: 'ماكد — تقارب وتباعد المتوسطات', rel: 90, type: 'TREND + MOMENTUM', desc: 'طوّره Gerald Appel عام 1979. مؤشر فريد يجمع بين تتبع الاتجاه وقياس الزخم في نفس الوقت. يتكون من 3 عناصر: خط MACD (الفرق بين EMA 12 و EMA 26)، خط الإشارة (EMA 9 من خط MACD)، والهيستوغرام (الفرق بين الخطين). تقاطع خط MACD فوق خط الإشارة = إشارة شراء. تقاطع تحته = إشارة بيع. عبور خط الصفر = تأكيد تغير الاتجاه. الهيستوغرام يُظهر قوة الزخم — كلما كان أطول كان الزخم أقوى. مثل RSI يُنتج دايفرجنس قوي.', fib: 'MACD Line = EMA(12) - EMA(26)\nSignal Line = EMA(9) من MACD Line\nHistogram = MACD Line - Signal Line\nتقاطع فوق Signal = شراء\nتقاطع تحت Signal = بيع\nعبور خط الصفر = تأكيد تغير الاتجاه', rules: '1. MACD فوق Signal = زخم صعودي (شراء)\n2. MACD تحت Signal = زخم هبوطي (بيع)\n3. عبور خط الصفر من الأسفل = تحول صعودي قوي\n4. عبور خط الصفر من الأعلى = تحول هبوطي قوي\n5. الهيستوغرام يتقلص = الزخم يضعف (تحذير)\n6. دايفرجنس MACD مع السعر = إشارة انعكاس قوية', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="40" x2="110" y2="40" stroke="#888" stroke-width="0.5"/><polyline points="12,52 20,48 28,42 35,38 42,32 48,28 55,35 60,38 65,42 70,45 75,48 80,45 85,42 90,38 95,35 100,32 108,30" fill="none" stroke="#fff" stroke-width="2"/><polyline points="12,55 20,52 28,48 35,44 42,38 48,35 55,38 60,42 65,45 70,48 75,50 80,48 85,45 90,42 95,38 100,35 108,34" fill="none" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="3,2"/><rect x="42" y="32" width="4" height="6" fill="#fff" opacity="0.6"/><rect x="48" y="28" width="4" height="7" fill="#fff" opacity="0.7"/><rect x="55" y="35" width="4" height="3" fill="#fff" opacity="0.4"/><rect x="85" y="42" width="4" height="3" fill="#fff" opacity="0.4"/><rect x="90" y="38" width="4" height="4" fill="#fff" opacity="0.5"/><rect x="95" y="35" width="4" height="3" fill="#fff" opacity="0.5"/><text x="20" y="75" fill="#fff" font-size="6" font-family="Share Tech Mono">MACD LINE</text><text x="70" y="75" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">SIGNAL LINE</text><circle cx="42" cy="35" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="42" y="28" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">CROSS</text>' },
            { name: 'MACD Histogram Analysis', ar: 'تحليل هيستوغرام الماكد', rel: 85, type: 'MOMENTUM STRENGTH', desc: 'الهيستوغرام هو الجزء الأكثر فائدة في MACD رغم أن كثيرين يتجاهلونه. يُظهر المسافة بين خط MACD وخط الإشارة. عندما يكون موجب (فوق الصفر): MACD فوق Signal = زخم صعودي. عندما يكون سالب (تحت الصفر): MACD تحت Signal = زخم هبوطي. الأهم: اتجاه الهيستوغرام وليس موقعه. إذا الهيستوغرام موجب لكنه يتقلص = الزخم الصعودي يضعف حتى لو لا يزال إيجابياً. تقلص الهيستوغرام = إنذار مبكر بتغير الاتجاه قبل التقاطع الفعلي.', fib: 'Histogram = MACD Line - Signal Line\nموجب ويتوسع = زخم صعودي متزايد\nموجب ويتقلص = زخم صعودي يضعف (تحذير)\nسالب ويتوسع = زخم هبوطي متزايد\nسالب ويتقلص = زخم هبوطي يضعف (تحذير)\nالتحول من موجب لسالب = تقاطع MACD', rules: '1. الهيستوغرام يتوسع = الزخم يتزايد (استمرار)\n2. الهيستوغرام يتقلص = الزخم يضعف (تحذير مبكر)\n3. التحول من موجب لسالب = تقاطع هبوطي\n4. التحول من سالب لموجب = تقاطع صعودي\n5. أقصى ارتفاع للهيستوغرام = ذروة الزخم\n6. دايفرجنس الهيستوغرام = أسرع إشارة انعكاس', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="40" x2="110" y2="40" stroke="#888" stroke-width="0.5"/><rect x="14" y="35" width="5" height="5" fill="#fff" opacity="0.4"/><rect x="22" y="30" width="5" height="10" fill="#fff" opacity="0.5"/><rect x="30" y="24" width="5" height="16" fill="#fff" opacity="0.7"/><rect x="38" y="20" width="5" height="20" fill="#fff" opacity="0.9"/><rect x="46" y="25" width="5" height="15" fill="#fff" opacity="0.7"/><rect x="54" y="32" width="5" height="8" fill="#fff" opacity="0.4"/><rect x="62" y="40" width="5" height="6" fill="#ff6a00" opacity="0.4"/><rect x="70" y="40" width="5" height="12" fill="#ff6a00" opacity="0.6"/><rect x="78" y="40" width="5" height="18" fill="#ff6a00" opacity="0.8"/><rect x="86" y="40" width="5" height="22" fill="#ff6a00" opacity="0.9"/><rect x="94" y="40" width="5" height="16" fill="#ff6a00" opacity="0.7"/><rect x="102" y="40" width="5" height="10" fill="#ff6a00" opacity="0.5"/><text x="38" y="16" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">PEAK</text><text x="86" y="68" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">PEAK</text>' },
            { name: 'Stochastic RSI', ar: 'مؤشر ستوكاستيك RSI', rel: 80, type: 'OSCILLATOR (0-100)', desc: 'مؤشر مركّب يُطبّق صيغة Stochastic على قراءات RSI بدلاً من السعر مباشرة. أكثر حساسية من RSI العادي — يتحرك بسرعة أكبر بين مناطق التشبع. يتكون من خطين: %K (السريع) و%D (البطيء — SMA من %K). تقاطع %K فوق %D في منطقة التشبع البيعي = إشارة شراء قوية. تقاطع %K تحت %D في تشبع شرائي = إشارة بيع. أكثر فائدة في الأسواق المتذبذبة من RSI العادي.', fib: 'الإعداد: 14 فترة RSI + 14 فترة Stochastic + 3 SMA\n%K السريع + %D البطيء (SMA 3 من %K)\nفوق 80: تشبع شراء\nتحت 20: تشبع بيع\nتقاطع %K فوق %D في تشبع بيع = شراء\nتقاطع %K تحت %D في تشبع شراء = بيع', rules: '1. أكثر حساسية من RSI العادي (إشارات أسرع)\n2. تقاطع %K فوق %D تحت 20 = شراء قوي\n3. تقاطع %K تحت %D فوق 80 = بيع قوي\n4. إشارات كاذبة أكثر من RSI (بسبب الحساسية)\n5. أفضل في الأسواق المتذبذبة (Range)\n6. استخدمه مع مؤشر اتجاه (MA أو MACD) للفلترة', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="16" x2="110" y2="16" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="64" x2="110" y2="64" stroke="#fff" stroke-width="0.5" stroke-dasharray="2,2"/><text x="112" y="18" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">80</text><text x="112" y="66" fill="#fff" font-size="5" font-family="Share Tech Mono">20</text><polyline points="12,60 20,55 28,45 35,30 42,20 48,12 55,18 60,28 65,38 70,50 75,60 80,65 85,58 90,48 95,35 100,25 108,20" fill="none" stroke="#fff" stroke-width="2"/><polyline points="12,62 20,58 28,50 35,38 42,28 48,18 55,22 60,32 65,42 70,52 75,62 80,66 85,62 90,52 95,40 100,30 108,24" fill="none" stroke="#ff6a00" stroke-width="1.5" stroke-dasharray="3,2"/><circle cx="80" cy="65" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="80" y="76" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">BUY CROSS</text>' }
        ]
    },
    moving_avg: {
        en: 'MOVING AVERAGES', label: 'المتوسطات المتحركة',
        patterns: [
            { name: 'SMA — Simple Moving Average', ar: 'المتوسط المتحرك البسيط', rel: 88, type: 'TREND INDICATOR', desc: 'أبسط وأقدم المؤشرات الفنية. يُحسب بجمع أسعار الإغلاق لفترة محددة وقسمتها على عدد الفترات. SMA 50 = متوسط آخر 50 شمعة. يُنعّم حركة السعر ويُظهر الاتجاه العام. السعر فوق SMA = اتجاه صاعد. السعر تحت SMA = اتجاه هابط. SMA يعمل كدعم ومقاومة ديناميكية. الأكثر استخداماً: SMA 20 (قصير)، SMA 50 (متوسط)، SMA 200 (طويل — المعيار المؤسسي). عيبه: بطيء في الاستجابة لأنه يُعطي وزن متساوي لكل الشموع.', fib: 'SMA 20: قصير المدى — حساس للتغيرات\nSMA 50: متوسط المدى — أكثر توازناً\nSMA 100: متوسط طويل\nSMA 200: طويل المدى — المعيار المؤسسي\nالسعر فوق SMA = صعودي\nالسعر تحت SMA = هبوطي', rules: '1. السعر فوق SMA = اتجاه صعودي — ابحث عن شراء\n2. السعر تحت SMA = اتجاه هبوطي — ابحث عن بيع\n3. SMA يعمل كدعم/مقاومة ديناميكية\n4. تقاطع SMA 50 فوق SMA 200 = Golden Cross (صعودي قوي)\n5. تقاطع SMA 50 تحت SMA 200 = Death Cross (هبوطي قوي)\n6. كلما زادت الفترة كان SMA أبطأ لكن أكثر موثوقية', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,55 18,50 25,52 32,48 38,45 45,42 52,38 58,40 65,35 72,32 78,28 85,30 92,25 98,22 105,20 112,18" fill="none" stroke="#888" stroke-width="1"/><polyline points="10,50 18,48 25,46 32,44 38,42 45,40 52,38 58,36 65,34 72,32 78,30 85,28 92,26 98,24 105,22 112,20" fill="none" stroke="#ff6a00" stroke-width="2"/><polyline points="10,45 18,44 25,43 32,42 38,41 45,40 52,39 58,38 65,37 72,36 78,35 85,34 92,33 98,32 105,31 112,30" fill="none" stroke="#fff" stroke-width="2"/><text x="112" y="16" fill="#888" font-size="6" font-family="Share Tech Mono">PRICE</text><text x="112" y="23" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">SMA 50</text><text x="112" y="33" fill="#fff" font-size="6" font-family="Share Tech Mono">SMA 200</text>' },
            { name: 'EMA — Exponential Moving Average', ar: 'المتوسط المتحرك الأسي', rel: 90, type: 'TREND INDICATOR', desc: 'نسخة محسّنة من SMA — يُعطي وزن أكبر للشموع الأحدث مما يجعله أسرع استجابة لتغيرات السعر. الفرق عن SMA: EMA يتفاعل بسرعة مع الحركة الأخيرة بينما SMA بطيء لأنه يُعطي وزن متساوي. في الكريبتو: EMA أكثر شيوعاً من SMA بسبب التقلب العالي. EMAs الشائعة: EMA 9 (سكالبينج)، EMA 21 (قصير)، EMA 50 (متوسط)، EMA 200 (طويل). EMA هو الأساس الذي يُبنى عليه MACD.', fib: 'EMA 9: سريع جداً — سكالبينج\nEMA 21: قصير المدى\nEMA 50: متوسط المدى — الأكثر استخداماً\nEMA 200: طويل المدى — دعم/مقاومة مؤسسية\nأسرع من SMA في الاستجابة\nأقل تأخر (Lag) من SMA', rules: '1. أسرع من SMA — يتفاعل مع السعر الأحدث\n2. EMA 9/21: مناسب للسكالبينج والفريمات القصيرة\n3. EMA 50: المتوسط الأكثر متابعة في الكريبتو\n4. EMA 200: الدعم/المقاومة المؤسسية الأهم\n5. تقاطع EMA القصير فوق الطويل = إشارة شراء\n6. في الأسواق المتقلبة EMA أفضل من SMA', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,58 18,52 22,55 28,48 32,45 38,50 42,42 48,38 52,42 58,35 62,30 68,32 72,28 78,25 82,28 88,22 92,20 98,18 105,15" fill="none" stroke="#888" stroke-width="1"/><polyline points="10,55 18,50 25,48 32,45 38,42 45,40 52,38 58,35 65,32 72,30 78,27 85,25 92,23 98,20 105,18" fill="none" stroke="#fff" stroke-width="2.5"/><text x="60" y="75" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">EMA — FASTER RESPONSE</text>' },
            { name: 'Golden Cross & Death Cross', ar: 'التقاطع الذهبي وتقاطع الموت', rel: 88, type: 'MAJOR SIGNAL', desc: 'من أشهر إشارات التحليل الفني على الإطلاق. Golden Cross: تقاطع المتوسط المتحرك 50 فوق المتوسط 200 — إشارة صعودية قوية تدل على بداية اتجاه صعودي طويل المدى. يُتابعه المستثمرون المؤسسيون والصناديق. Death Cross: تقاطع المتوسط 50 تحت المتوسط 200 — إشارة هبوطية قوية تدل على بداية اتجاه هبوطي. كلا الإشارتين متأخرتين (Lagging) — تأتي بعد بداية الحركة. لكنهما موثوقتان جداً لتأكيد الاتجاه طويل المدى.', fib: 'Golden Cross: SMA/EMA 50 يتقاطع فوق SMA/EMA 200\nDeath Cross: SMA/EMA 50 يتقاطع تحت SMA/EMA 200\nإشارة متأخرة لكن موثوقة جداً\nتاريخياً: Golden Cross يسبق صعود 15-20% في المتوسط\nالحجم المرتفع عند التقاطع يؤكد الإشارة', rules: '1. Golden Cross (50 فوق 200) = بداية سوق صعودي\n2. Death Cross (50 تحت 200) = بداية سوق هبوطي\n3. إشارة متأخرة — لا تستخدمها وحدها للدخول السريع\n4. ممتازة لتأكيد الاتجاه طويل المدى\n5. الحجم المرتفع عند التقاطع = تأكيد أقوى\n6. يُتابعها المستثمرون المؤسسيون والصناديق', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,52 30,48 40,44 50,40 60,36 70,32 80,28 90,24 100,20 110,16" fill="none" stroke="#ff6a00" stroke-width="2"/><polyline points="10,38 20,38 30,38 40,38 50,38 60,37 70,35 80,32 90,28 100,24 110,20" fill="none" stroke="#fff" stroke-width="2"/><circle cx="62" cy="37" r="5" fill="none" stroke="#fff" stroke-width="2"/><text x="62" y="30" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">GOLDEN CROSS</text><text x="112" y="14" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">MA 50</text><text x="112" y="22" fill="#fff" font-size="5" font-family="Share Tech Mono">MA 200</text>' },
            { name: 'EMA Ribbon (9/21/55)', ar: 'شريط المتوسطات', rel: 82, type: 'TREND STRENGTH', desc: 'استخدام عدة متوسطات متحركة معاً (مثل EMA 9, 21, 55) لتكوين شريط بصري يُظهر قوة واتجاه الترند. عندما المتوسطات مرتبة بالتسلسل (9 فوق 21 فوق 55) = اتجاه صعودي قوي. عندما متشابكة = لا اتجاه واضح. تباعد المتوسطات = اتجاه قوي. تقاربها = ضعف الاتجاه. ارتداد السعر من EMA 21 أو 55 = فرصة دخول مع الاتجاه.', fib: 'EMA 9: سريع — يتبع السعر عن قرب\nEMA 21: متوسط — الدعم/المقاومة القريبة\nEMA 55: بطيء — الدعم/المقاومة الأساسية\nترتيب 9>21>55: اتجاه صعودي قوي\nترتيب 55>21>9: اتجاه هبوطي قوي\nتشابك: لا اتجاه — تذبذب', rules: '1. 9 فوق 21 فوق 55 = صاعد قوي (اشتري)\n2. 9 تحت 21 تحت 55 = هابط قوي (بع)\n3. تشابك المتوسطات = لا اتجاه (انتظر)\n4. تباعد المتوسطات = الاتجاه يقوى\n5. تقارب المتوسطات = الاتجاه يضعف\n6. ارتداد السعر من EMA 21/55 = فرصة دخول', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,58 20,52 30,45 40,38 50,32 60,28 70,25 80,22 90,20 100,18 110,15" fill="none" stroke="#fff" stroke-width="2"/><polyline points="10,60 20,55 30,50 40,44 50,38 60,34 70,30 80,27 90,24 100,22 110,20" fill="none" stroke="#ff6a00" stroke-width="1.5"/><polyline points="10,62 20,58 30,55 40,50 50,46 60,42 70,38 80,35 90,32 100,30 110,28" fill="none" stroke="#888" stroke-width="1.5"/><text x="112" y="13" fill="#fff" font-size="5" font-family="Share Tech Mono">EMA 9</text><text x="112" y="22" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">EMA 21</text><text x="112" y="30" fill="#888" font-size="5" font-family="Share Tech Mono">EMA 55</text><text x="60" y="75" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BULLISH RIBBON</text>' }
        ]
    },
    volume: {
        en: 'VOLUME ANALYSIS', label: 'تحليل الحجم',
        patterns: [
            { name: 'Volume Fundamentals', ar: 'أساسيات الحجم', rel: 95, type: 'CORE PRINCIPLE', desc: 'الحجم (Volume) هو عدد الوحدات المتداولة خلال فترة زمنية. يُعتبر ثاني أهم بيانة بعد السعر — يُظهر مستوى الاهتمام والنشاط في السوق. حجم مرتفع = اهتمام كبير ومشاركة واسعة = الحركة حقيقية. حجم منخفض = قلة اهتمام = الحركة مشكوك فيها. القاعدة الذهبية: الحجم يؤكد السعر. صعود بحجم مرتفع = صعود حقيقي. صعود بحجم منخفض = صعود وهمي قد ينعكس. هذا المبدأ هو أساس منهجية وايكوف ونظرية داو (المبدأ الخامس).', fib: 'حجم مرتفع + صعود = اتجاه صعودي صحي\nحجم مرتفع + هبوط = ضغط بيعي حقيقي\nحجم منخفض + صعود = ضعف — احذر\nحجم منخفض + هبوط = تصحيح مؤقت\nالحجم يسبق السعر غالباً\nClimactic Volume = نهاية الحركة', rules: '1. الحجم يؤكد أو ينفي حركة السعر (القاعدة الذهبية)\n2. صعود + حجم مرتفع = اتجاه صحي ومستمر\n3. صعود + حجم منخفض = ضعف وانعكاس محتمل\n4. ارتفاع مفاجئ في الحجم = حدث مهم (انتبه)\n5. الحجم يسبق السعر — ارتفاعه يُنذر بحركة كبيرة\n6. قارن الحجم الحالي بالمتوسط (20 فترة) لتحديد إن كان مرتفع أو منخفض', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,48 30,42 40,38 50,35 60,30 70,25 80,22 90,20 100,18" fill="none" stroke="#fff" stroke-width="2"/><rect x="12" y="60" width="7" height="12" fill="#fff" opacity="0.4"/><rect x="22" y="56" width="7" height="16" fill="#fff" opacity="0.5"/><rect x="32" y="52" width="7" height="20" fill="#fff" opacity="0.6"/><rect x="42" y="48" width="7" height="24" fill="#fff" opacity="0.7"/><rect x="52" y="44" width="7" height="28" fill="#fff" opacity="0.8"/><rect x="62" y="40" width="7" height="32" fill="#fff" opacity="0.85"/><rect x="72" y="36" width="7" height="36" fill="#fff" opacity="0.9"/><rect x="82" y="34" width="7" height="38" fill="#fff" opacity="0.95"/><rect x="92" y="32" width="7" height="40" fill="#fff" opacity="1"/><text x="55" y="78" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">VOLUME CONFIRMS UPTREND</text>' },
            { name: 'Volume Profile & POC', ar: 'ملف الحجم ونقطة التحكم', rel: 82, type: 'SUPPORT/RESISTANCE', desc: 'Volume Profile يعرض الحجم أفقياً على مستويات سعرية بدلاً من عمودياً على الزمن. يُظهر عند أي أسعار تم أغلب التداول. POC (Point of Control) هو المستوى السعري بأعلى حجم تداول — أقوى مستوى دعم/مقاومة. Value Area (VA) هي المنطقة التي تم فيها 70% من التداول — السعر يميل للعودة إليها. HVN (High Volume Node) = مناطق دعم/مقاومة قوية. LVN (Low Volume Node) = فجوات يمر فيها السعر بسرعة.', fib: 'POC: المستوى بأعلى حجم — أقوى S/R\nValue Area (VA): 70% من التداول\nVAH: حد أعلى لـ VA — مقاومة\nVAL: حد أدنى لـ VA — دعم\nHVN: مناطق حجم مرتفع = S/R قوية\nLVN: مناطق حجم منخفض = السعر يمر بسرعة', rules: '1. POC = أقوى مستوى دعم/مقاومة (أعلى حجم)\n2. السعر يميل للعودة لـ POC (مغناطيس)\n3. Value Area (70%) = المنطقة التي يعود إليها السعر\n4. HVN = دعم/مقاومة (السعر يبطئ عندها)\n5. LVN = فجوات (السعر يمر بسرعة)\n6. كسر POC بحجم = حركة قوية في اتجاه الكسر', svg: '<rect width="120" height="80" fill="#000"/><rect x="10" y="10" width="8" height="70" fill="rgba(255,255,255,0.03)"/><rect x="10" y="30" width="45" height="5" fill="rgba(255,255,255,0.15)"/><rect x="10" y="35" width="60" height="5" fill="rgba(255,255,255,0.25)"/><rect x="10" y="40" width="75" height="5" fill="rgba(255,255,255,0.4)"/><rect x="10" y="45" width="55" height="5" fill="rgba(255,255,255,0.2)"/><rect x="10" y="50" width="35" height="5" fill="rgba(255,255,255,0.1)"/><line x1="85" y1="40" x2="85" y2="45" stroke="#fff" stroke-width="3"/><text x="90" y="44" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">POC</text><text x="90" y="34" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">VAH</text><text x="90" y="54" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">VAL</text><line x1="10" y1="30" x2="85" y2="30" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="50" x2="85" y2="50" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/>' },
            { name: 'OBV — On Balance Volume', ar: 'حجم التوازن', rel: 78, type: 'VOLUME TREND', desc: 'طوّره Joseph Granville عام 1963. يجمع الحجم تراكمياً: إذا الشمعة صعودية يُضاف الحجم، إذا هبوطية يُطرح. ينتج خط يُظهر اتجاه تدفق الأموال. إذا OBV يصعد مع السعر = تأكيد صعودي. إذا OBV يهبط بينما السعر يصعد = دايفرجنس = تحذير. من أقدم مؤشرات الحجم وأبسطها — الفكرة أن الحجم يسبق السعر.', fib: 'OBV يصعد + السعر يصعد = اتجاه صحي مؤكد\nOBV يصعد + السعر ثابت = تجميع خفي (صعود قريب)\nOBV يهبط + السعر يصعد = توزيع خفي (هبوط قريب)\nOBV يهبط + السعر يهبط = اتجاه هبوطي مؤكد\nOBV يهبط + السعر ثابت = تصريف خفي', rules: '1. OBV يؤكد الاتجاه: يصعد مع الصعود ويهبط مع الهبوط\n2. Divergence بين OBV والسعر = تحذير انعكاس\n3. OBV يصعد والسعر ثابت = تجميع خفي (اشتري)\n4. OBV يهبط والسعر ثابت = تصريف خفي (بع)\n5. اتجاه OBV أهم من قيمته المطلقة\n6. كسر OBV لخط اتجاهه = تأكيد مبكر لحركة سعرية', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,50 20,48 30,45 40,42 50,40 60,38 70,35 80,32 90,28 100,25" fill="none" stroke="#888" stroke-width="1.5"/><polyline points="10,55 20,50 30,48 40,42 50,38 60,34 70,30 80,25 90,20 100,18" fill="none" stroke="#fff" stroke-width="2"/><text x="55" y="15" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">OBV CONFIRMS TREND</text><text x="102" y="23" fill="#888" font-size="5" font-family="Share Tech Mono">PRICE</text><text x="102" y="16" fill="#fff" font-size="5" font-family="Share Tech Mono">OBV</text>' },
            { name: 'Bollinger Bands', ar: 'نطاقات بولينجر', rel: 85, type: 'VOLATILITY', desc: 'طوّرها John Bollinger في الثمانينات. تتكون من 3 خطوط: المتوسط المتحرك (SMA 20) في الوسط، ونطاق علوي (SMA + 2 Standard Deviations) ونطاق سفلي (SMA - 2 SD). النطاقات تتوسع وتتقلص مع التقلب. نطاقات ضيقة (Squeeze) = تقلب منخفض = انفجار سعري قريب. السعر يلمس النطاق العلوي = تشبع شراء. يلمس السفلي = تشبع بيع. 95% من حركة السعر تقع بين النطاقين.', fib: 'الوسط: SMA 20\nالعلوي: SMA 20 + (2 × Standard Deviation)\nالسفلي: SMA 20 - (2 × Standard Deviation)\nSqueeze: نطاقات ضيقة = انفجار قريب\n95% من السعر بين النطاقين\nلمس النطاق = تشبع (ليس إشارة وحدها)', rules: '1. السعر يلمس النطاق العلوي = تشبع شراء (ليس بيع مباشر)\n2. السعر يلمس النطاق السفلي = تشبع بيع (ليس شراء مباشر)\n3. Squeeze (نطاقات ضيقة) = انفجار سعري قريب\n4. نطاقات واسعة = تقلب مرتفع — احذر\n5. السعر يمشي على النطاق (Band Walk) في الاتجاهات القوية\n6. الكسر خارج النطاق + عودة = إشارة انعكاس', svg: '<rect width="120" height="80" fill="#000"/><polyline points="10,20 20,18 30,15 40,20 50,25 55,12 60,8 65,15 70,22 80,28 90,25 100,20 110,18" fill="none" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,2"/><polyline points="10,40 20,38 30,35 40,38 50,40 55,35 60,32 65,35 70,38 80,40 90,38 100,35 110,34" fill="none" stroke="#888" stroke-width="1"/><polyline points="10,60 20,58 30,55 40,56 50,55 55,58 60,56 65,55 70,54 80,52 90,51 100,50 110,50" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3,2"/><polyline points="10,42 20,36 30,28 40,35 50,42 55,20 60,15 65,30 70,38 80,42 90,35 100,28 110,30" fill="none" stroke="#fff" stroke-width="2"/><text x="60" y="6" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">UPPER BAND</text><text x="60" y="75" fill="#fff" font-size="5" font-family="Share Tech Mono">LOWER BAND</text><text x="55" y="48" fill="#888" font-size="5" font-family="Share Tech Mono">SMA 20</text>' }
        ]
    }
};

function indRender() {
    var cat = indData[indCurrentCat];
    if (!cat) return;
    var el = document.getElementById('ind-content');
    if (!el) return;
    if (indSelectedIdx >= 0 && indSelectedIdx < cat.patterns.length) {
        el.innerHTML = indRenderDetail(cat.patterns[indSelectedIdx]);
        return;
    }
    var h = '<div class="ind-grid">';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        h += '<div class="ind-card" style="border-top:3px solid #fff" onclick="indSelect(' + i + ')">';
        h += '<div class="ind-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
        h += '<div class="ind-card-name">' + p.name + '</div>';
        h += '<div class="ind-card-ar">' + p.ar + '</div>';
        if (p.type) { h += '<div class="ind-card-type">' + p.type + '</div>'; }
        h += '<div class="ind-card-rel-row"><span class="ind-card-rel-l">IMPORTANCE</span><span class="ind-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
        h += '<div class="ind-card-bar"><div class="ind-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="ind-footer">المؤشرات الفنية أدوات مساعدة وليست قرارات — لا تعتمد على مؤشر واحد أبداً. استخدم مؤشر زخم (RSI/MACD) مع مؤشر اتجاه (MA) ومؤشر حجم للحصول على صورة متكاملة. كل مؤشر له نقاط ضعف — الدمج بين عدة مؤشرات يعوّض نقاط الضعف. الإعدادات الافتراضية صالحة لأغلب الحالات — لا تُكثر من تعديل الإعدادات. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
    el.innerHTML = h;
}

function indRenderDetail(p) {
    var h = '<div class="ind-back" onclick="indBack()">رجوع</div>';
    h += '<div class="ind-detail">';
    h += '<div class="ind-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
    h += '<div class="ind-detail-name">' + p.name + '</div>';
    h += '<div class="ind-detail-ar">' + p.ar + '</div>';
    if (p.type) { h += '<div class="ind-detail-badge">' + p.type + '</div>'; }
    h += '<div class="ind-detail-rel-row"><span class="ind-detail-rel-l">IMPORTANCE</span><span class="ind-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
    h += '<div class="ind-detail-bar"><div class="ind-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    h += '<div class="ind-detail-desc-wrap"><div class="ind-detail-desc-label">DESCRIPTION // الوصف الأكاديمي</div><div class="ind-detail-desc">' + p.desc + '</div></div>';
    if (p.fib) {
        h += '<div class="ind-detail-fib-wrap"><div class="ind-detail-fib-label">SETTINGS & SIGNALS // الإعدادات والإشارات</div>';
        var fibs = p.fib.split('\n');
        for (var i = 0; i < fibs.length; i++) { h += '<div class="ind-fib-row"><span class="ind-fib-arrow">▶</span><span class="ind-fib-text">' + fibs[i] + '</span></div>'; }
        h += '</div>';
    }
    if (p.rules) {
        h += '<div class="ind-detail-rules-wrap"><div class="ind-detail-rules-label">KEY RULES // القواعد الأساسية</div>';
        var rules = p.rules.split('\n');
        for (var i = 0; i < rules.length; i++) { h += '<div class="ind-rule-row"><span class="ind-rule-num">' + rules[i].substring(0, 2) + '</span><span class="ind-rule-text">' + rules[i].substring(3) + '</span></div>'; }
        h += '</div>';
    }
    h += '</div>';
    return h;
}

/* =====================================================================
   GANN SQUARE OF 9 ACADEMY ENGINE — LEARN HUB 360
   ===================================================================== */

var gsCurrentCat = 'foundation';
var gsSelectedIdx = -1;

function gsSetCat(cat, btn) {
    gsCurrentCat = cat;
    gsSelectedIdx = -1;
    var b = document.querySelectorAll('.gs-cat-btn');
    for (var i = 0; i < b.length; i++) b[i].classList.remove('gs-cat-active');
    if (btn) btn.classList.add('gs-cat-active');
    gsRender();
}

function gsSelect(idx) { gsSelectedIdx = idx; gsRender(); }
function gsBack() { gsSelectedIdx = -1; gsRender(); }

function gsInit() {
    var tabsEl = document.getElementById('gs-cat-tabs');
    if (!tabsEl) return;
    var h = '';
    var k = Object.keys(gsData);
    for (var i = 0; i < k.length; i++) {
        var c = gsData[k[i]];
        h += '<button class="gs-cat-btn' + (k[i] === gsCurrentCat ? ' gs-cat-active' : '') + '" onclick="gsSetCat(\'' + k[i] + '\',this)">' + c.en + ' (' + c.patterns.length + ')</button>';
    }
    tabsEl.innerHTML = h;
    gsRender();
}

// === SQ9 GRID SVG ===
var gsSq9SVG = '<rect width="300" height="300" fill="#000"/>';
var sq9N = [
    [73, 74, 75, 76, 77, 78, 79, 80, 81],
    [72, 43, 44, 45, 46, 47, 48, 49, 50],
    [71, 42, 21, 22, 23, 24, 25, 26, 51],
    [70, 41, 20, 7, 8, 9, 10, 27, 52],
    [69, 40, 19, 6, 1, 2, 11, 28, 53],
    [68, 39, 18, 5, 4, 3, 12, 29, 54],
    [67, 38, 17, 16, 15, 14, 13, 30, 55],
    [66, 37, 36, 35, 34, 33, 32, 31, 56],
    [65, 64, 63, 62, 61, 60, 59, 58, 57]
];
var cS = 30, sX = 15, sY = 15;
var cardinals = [2, 4, 6, 8, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 78];
var ordinals = [3, 5, 7, 9, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79];

for (var r = 0; r < 9; r++) {
    for (var c = 0; c < 9; c++) {
        var x = sX + c * cS, y = sY + r * cS, n = sq9N[r][c];
        var isC = n === 1, isCd = cardinals.indexOf(n) >= 0, isOd = ordinals.indexOf(n) >= 0;
        var bg = isC ? '#ff6a00' : isCd ? 'rgba(255,106,0,0.12)' : isOd ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
        var tc = isC ? '#000' : isCd ? '#ff6a00' : isOd ? '#fff' : '#555';
        var fw = isC || isCd || isOd ? '900' : '400';
        gsSq9SVG += '<rect x="' + x + '" y="' + y + '" width="' + cS + '" height="' + cS + '" fill="' + bg + '" stroke="#111" stroke-width="0.5"/><text x="' + (x + 15) + '" y="' + (y + 19) + '" text-anchor="middle" fill="' + tc + '" font-size="9" font-family="Share Tech Mono" font-weight="' + fw + '">' + n + '</text>';
    }
}
gsSq9SVG += '<line x1="' + (sX + 4 * cS + 15) + '" y1="' + sY + '" x2="' + (sX + 4 * cS + 15) + '" y2="' + (sY + 9 * cS) + '" stroke="#ff6a00" stroke-width="1" opacity="0.3"/><line x1="' + sX + '" y1="' + (sY + 4 * cS + 15) + '" x2="' + (sX + 9 * cS) + '" y2="' + (sY + 4 * cS + 15) + '" stroke="#ff6a00" stroke-width="1" opacity="0.3"/><line x1="' + sX + '" y1="' + sY + '" x2="' + (sX + 9 * cS) + '" y2="' + (sY + 9 * cS) + '" stroke="#fff" stroke-width="0.5" opacity="0.2"/><line x1="' + (sX + 9 * cS) + '" y1="' + sY + '" x2="' + sX + '" y2="' + (sY + 9 * cS) + '" stroke="#fff" stroke-width="0.5" opacity="0.2"/>';

// === DATA ===
var gsData = {
    foundation: {
        en: 'FOUNDATION', label: 'الأساسيات', patterns: [
            { name: 'What is Square of 9', ar: 'ما هو مربع 9 لجان', rel: 95, type: 'CORE CONCEPT', isGrid: true, desc: 'مربع 9 هو أداة W.D. Gann الأشهر — مصفوفة حلزونية من الأرقام تبدأ من 1 في المركز وتدور حلزونياً عكس عقارب الساعة. كل دورة كاملة (360°) تُمثل مربع كامل. الأرقام على نفس الزاوية مرتبطة رياضياً وتمثل مستويات دعم ومقاومة طبيعية. Gann اكتشف أن الأسواق تتحرك وفق أنماط هندسية — السعر والزمن مرتبطان بالزوايا. الصيغة الأساسية: Level = (√Price ± n×0.25)² حيث كل 0.25 = زاوية 90°. المربع يحتوي خطين رئيسيين: Cardinal Cross (0°/90°/180°/270°) بالبرتقالي = أقوى المستويات. Ordinal Cross (45°/135°/225°/315°) بالأبيض = مستويات ثانوية.', fib: 'المركز: الرقم 1 — نقطة البداية\nكل دورة 360°: مربع كامل (1→9→25→49→81)\nالصيغة: Level = (√Price ± n×0.25)²\nCardinal Cross: 0°/90°/180°/270° (أقوى مستويات)\nOrdinal Cross: 45°/135°/225°/315° (ثانوية)\nكل 90° = ربع دورة = مستوى دعم/مقاومة', rules: '1. الأرقام تدور حلزونياً من المركز عكس عقارب الساعة\n2. كل دورة كاملة (360°) = مربع كامل للرقم\n3. Cardinal Cross (البرتقالي) = أقوى المستويات\n4. Ordinal Cross (الأبيض) = مستويات ثانوية\n5. الأرقام على نفس الزاوية = مستويات S/R مترابطة\n6. المربعات الكاملة على 315° = نقاط تحول رئيسية', svg: gsSq9SVG },
            { name: 'The Cardinal Cross', ar: 'الصليب الكاردينالي (0°-90°-180°-270°)', rel: 92, type: 'PRIMARY LEVELS', desc: 'أقوى 4 خطوط في مربع 9 — تمر عبر المركز عند 0° و90° و180° و270°. الأرقام عليها تمثل مستويات تغيير اتجاه رئيسية. 0° (يمين): 2, 10, 26, 50, 82. 90° (أعلى): 8, 22, 44, 74. 180° (يسار): 4, 14, 30, 54. 270° (أسفل): 6, 18, 38, 66. في التداول: حساب أقرب Cardinal Level للسعر يُعطي أقوى دعم/مقاومة. 180° (المقابل) هو الأقوى — يمثل التوازن العكسي.', fib: '0° (يمين): 2, 10, 26, 50, 82…\n90° (أعلى): 8, 22, 44, 74…\n180° (يسار): 4, 14, 30, 54…\n270° (أسفل): 6, 18, 38, 66…\n180° المقابل = أقوى مستوى على الإطلاق\nالمسافة بين الأرقام تزداد مع البعد عن المركز', rules: '1. Cardinal Cross = أقوى 4 خطوط في مربع 9\n2. الأرقام عليه = مستويات تغيير اتجاه رئيسية\n3. 180° المقابل = أقوى مستوى مقاومة/دعم\n4. تُستخدم كأهداف سعرية ومناطق انعكاس\n5. المسافة بين المستويات تزداد كلما ابتعدت عن المركز\n6. في الكريبتو: Cardinal Levels تتوافق مع S/R الفعلية', svg: '<rect width="120" height="80" fill="#000"/><line x1="60" y1="5" x2="60" y2="75" stroke="#ff6a00" stroke-width="2"/><line x1="10" y1="40" x2="110" y2="40" stroke="#ff6a00" stroke-width="2"/><circle cx="60" cy="40" r="4" fill="#ff6a00"/><text x="60" y="43" text-anchor="middle" fill="#000" font-size="6" font-family="Share Tech Mono" font-weight="900">1</text><text x="112" y="42" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">0°</text><text x="60" y="4" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">90°</text><text x="8" y="42" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">180°</text><text x="60" y="78" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">270°</text><circle cx="80" cy="40" r="2" fill="#ff6a00"/><text x="80" y="36" fill="#888" font-size="5" font-family="Share Tech Mono" text-anchor="middle">2</text><circle cx="60" cy="25" r="2" fill="#ff6a00"/><text x="66" y="27" fill="#888" font-size="5" font-family="Share Tech Mono">8</text><circle cx="40" cy="40" r="2" fill="#ff6a00"/><text x="40" y="36" fill="#888" font-size="5" font-family="Share Tech Mono" text-anchor="middle">4</text><circle cx="60" cy="55" r="2" fill="#ff6a00"/><text x="66" y="57" fill="#888" font-size="5" font-family="Share Tech Mono">6</text>' },
            { name: 'The Ordinal Cross & Perfect Squares', ar: 'الصليب القطري والمربعات الكاملة', rel: 88, type: 'SECONDARY + SQUARES', desc: 'الصليب القطري يمر بالزوايا 45°/135°/225°/315°. أهم ما فيه: خط 315° يحتوي المربعات الكاملة (9=3², 25=5², 49=7², 81=9²). المربعات الكاملة نقاط تحول رئيسية — كل مربع كامل يمثل نهاية دورة حلزونية. الجذر التربيعي هو المفتاح الحسابي: √السعر → ± 0.25 (90°) → تربيع = مستوى S/R. الأرقام على Ordinal: 45°: 3,13,31,57 | 135°: 5,17,37,65 | 225°: 7,23,47,79 | 315°: 9,25,49,81.', fib: '45°: 3, 13, 31, 57…\n135°: 5, 17, 37, 65…\n225°: 7, 23, 47, 79…\n315°: 9, 25, 49, 81… (المربعات الكاملة!)\nالمربعات: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100\nكل مربع = نهاية دورة 360° = نقطة تحول', rules: '1. Ordinal Cross = 4 أقطار عند 45°/135°/225°/315°\n2. 315° يحتوي المربعات الكاملة (9, 25, 49, 81)\n3. المربعات الكاملة = نقاط تحول رئيسية في السوق\n4. √السعر هو المفتاح الحسابي لكل حسابات جان\n5. كلما كان السعر أقرب لمربع كامل كان التأثير أقوى\n6. الجمع بين Cardinal + Ordinal = خريطة S/R كاملة', svg: '<rect width="120" height="80" fill="#000"/><line x1="15" y1="10" x2="105" y2="70" stroke="#fff" stroke-width="1.5" opacity="0.5"/><line x1="105" y1="10" x2="15" y2="70" stroke="#fff" stroke-width="1.5" opacity="0.5"/><circle cx="60" cy="40" r="4" fill="#ff6a00"/><text x="60" y="43" text-anchor="middle" fill="#000" font-size="6" font-family="Share Tech Mono" font-weight="900">1</text><text x="100" y="68" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">45°</text><text x="100" y="15" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">135°</text><text x="12" y="15" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">225°</text><text x="12" y="68" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">315°</text><text x="25" y="62" fill="#888" font-size="6" font-family="Share Tech Mono" font-weight="900">9²=81</text><text x="38" y="55" fill="#888" font-size="5" font-family="Share Tech Mono">49</text><text x="48" y="50" fill="#888" font-size="5" font-family="Share Tech Mono">25</text>' }
        ]
    },
    angles: {
        en: 'GANN ANGLES', label: 'زوايا جان', patterns: [
            { name: '1×1 Master Angle (45°)', ar: 'زاوية 1×1 الرئيسية', rel: 92, type: 'MASTER ANGLE', desc: 'أهم زاوية عند جان — التوازن المثالي بين السعر والزمن. وحدة سعر لكل وحدة زمنية = ميل 45°. السعر فوق 1×1 = صعودي صحي. تحته = ضعف. كسر 1×1 = إشارة انعكاس رئيسية. خط 1×1 هو خط الجاذبية — السعر يميل للعودة إليه دائماً. في مربع 9: كل 90° على المربع = تغير بزاوية 1×1.', fib: '1×1 = 45° = وحدة سعر لكل وحدة زمن\nفوق 1×1 = صعودي قوي\nتحت 1×1 = هبوطي أو ضعيف\nكسر 1×1 = إشارة انعكاس رئيسية\n1×1 = خط التوازن والجاذبية\nأساس كل نظام زوايا جان', rules: '1. 1×1 (45°) = أهم زاوية — التوازن المثالي\n2. السعر فوق 1×1 = اتجاه صعودي سليم\n3. السعر تحت 1×1 = ضعف أو هبوط\n4. كسر 1×1 = تحول رئيسي في الاتجاه\n5. يعمل كدعم ديناميكي في الصعود ومقاومة في الهبوط\n6. السعر يميل للعودة لخط 1×1 دائماً (الجاذبية)', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="70" x2="110" y2="10" stroke="#fff" stroke-width="2.5"/><text x="75" y="30" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">1×1 (45°)</text><polyline points="10,65 20,55 25,58 35,45 40,48 50,35 55,38 65,28 70,30 80,20 85,22 95,15 100,18 110,12" fill="none" stroke="#888" stroke-width="1"/><text x="85" y="48" fill="#888" font-size="5" font-family="Share Tech Mono">PRICE ABOVE = BULLISH</text>' },
            { name: 'All Gann Angles (Fan)', ar: 'مروحة زوايا جان الكاملة', rel: 88, type: 'ANGLE SYSTEM', desc: '9 زوايا رئيسية تُشكّل مروحة من نقطة محورية. فوق 1×1 (أكثر حدة): 2×1 (63.75°) و3×1 (71.25°) و4×1 (75°) و8×1 (82.5°) = السعر أسرع من الزمن = اتجاه قوي. تحت 1×1 (أكثر انبساطاً): 1×2 (26.25°) و1×3 (18.75°) و1×4 (15°) و1×8 (7.5°) = الزمن أسرع = اتجاه ضعيف. السعر يتنقل بين الزوايا — كسر واحدة يعني التوجه للتالية. المروحة تُرسم من قمة أو قاع رئيسي.', fib: '8×1 = 82.5° (أقوى صعود)\n4×1 = 75° | 3×1 = 71.25° | 2×1 = 63.75°\n1×1 = 45° (التوازن — الأهم)\n1×2 = 26.25° | 1×3 = 18.75°\n1×4 = 15° | 1×8 = 7.5° (أضعف صعود)\nكسر زاوية = التوجه للزاوية التالية', rules: '1. 9 زوايا من 7.5° إلى 82.5°\n2. فوق 1×1: السعر أسرع من الزمن (قوي)\n3. تحت 1×1: الزمن أسرع (ضعيف)\n4. كسر زاوية = التوجه للتالية\n5. الزوايا = دعم/مقاومة ديناميكية متعددة\n6. المروحة تُرسم من قمة أو قاع رئيسي', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="72" x2="110" y2="5" stroke="#888" stroke-width="0.5"/><line x1="10" y1="72" x2="110" y2="15" stroke="#888" stroke-width="0.5"/><line x1="10" y1="72" x2="110" y2="25" stroke="#888" stroke-width="0.5"/><line x1="10" y1="72" x2="110" y2="30" stroke="#ff6a00" stroke-width="1.5"/><line x1="10" y1="72" x2="110" y2="45" stroke="#888" stroke-width="0.5"/><line x1="10" y1="72" x2="110" y2="55" stroke="#888" stroke-width="0.5"/><line x1="10" y1="72" x2="110" y2="62" stroke="#888" stroke-width="0.5"/><text x="112" y="8" fill="#888" font-size="5" font-family="Share Tech Mono">8×1</text><text x="112" y="28" fill="#888" font-size="5" font-family="Share Tech Mono">2×1</text><text x="112" y="33" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">1×1</text><text x="112" y="48" fill="#888" font-size="5" font-family="Share Tech Mono">1×2</text><text x="112" y="65" fill="#888" font-size="5" font-family="Share Tech Mono">1×8</text><circle cx="10" cy="72" r="3" fill="#ff6a00"/>' },
            { name: 'Gann Time Cycles', ar: 'دورات جان الزمنية', rel: 85, type: 'TIME ANALYSIS', desc: 'جان اعتبر الزمن أهم من السعر. الدورات: 30 يوم (شهر)، 90 يوم (ربع سنة = 90° Cardinal)، 180 يوم (نصف سنة = 180°)، 360 يوم (سنة = دورة كاملة). في الكريبتو: دورة 4 سنوات (Halving) = 1461 يوم تتوافق مع جان. التطبيق: من قمة/قاع رئيسي أضف 90/180/270/360 يوم = تواريخ انعكاس. تقاطع دورة زمنية مع مستوى سعري = أقوى نقطة تحول.', fib: '30 يوم: دورة شهرية\n90 يوم: ربع سنة (Cardinal 90°)\n180 يوم: نصف سنة (180° المقابل)\n270 يوم: ثلاثة أرباع\n360 يوم: سنة (دورة كاملة)\n1461 يوم: 4 سنوات (BTC Halving)', rules: '1. الزمن أهم من السعر عند جان\n2. الدورات الرئيسية: 90/180/270/360 يوم\n3. من قمة/قاع: +90 يوم = تاريخ انعكاس محتمل\n4. تقاطع دورة زمنية + مستوى سعري = نقطة تحول قوية\n5. دورة 4 سنوات في BTC تتوافق مع جان\n6. الأيام المحورية: 30, 45, 60, 90, 120, 144, 180, 270, 360', svg: '<rect width="120" height="80" fill="#000"/><circle cx="60" cy="40" r="30" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="60" cy="40" r="20" fill="none" stroke="#888" stroke-width="0.5"/><line x1="60" y1="10" x2="60" y2="70" stroke="#ff6a00" stroke-width="0.8" opacity="0.4"/><line x1="30" y1="40" x2="90" y2="40" stroke="#ff6a00" stroke-width="0.8" opacity="0.4"/><circle cx="60" cy="40" r="2" fill="#ff6a00"/><text x="60" y="8" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">90d</text><text x="92" y="42" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">180d</text><text x="60" y="76" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">270d</text><text x="22" y="42" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">360d</text>' }
        ]
    },
    practical: {
        en: 'PRACTICAL USE', label: 'التطبيق العملي', patterns: [
            { name: 'Calculating S/R from Price', ar: 'حساب الدعم والمقاومة من السعر', rel: 95, type: 'CALCULATION', desc: 'الاستخدام الأهم: 1) √السعر. 2) ± مضاعفات 0.25 (كل 0.25 = 90°). 3) تربيع النتيجة. مثال: BTC $64,000 → √64000 = 252.98. مقاومات: +0.25→ $64,127 | +0.5→ $64,254 | +1→ $64,510 | +2→ $65,024. دعوم: -0.25→ $63,875 | -0.5→ $63,750 | -1→ $63,494. Cardinal (+0.25/+0.5/+1) أقوى من Ordinal (+0.125).', fib: '+0.25 (90°): أقرب مقاومة Cardinal\n+0.5 (180°): مقاومة المقابل — قوية جداً\n+1.0 (360°): مقاومة دورة كاملة\n-0.25 (90°): أقرب دعم Cardinal\n-0.5 (180°): دعم المقابل\n-1.0 (360°): دعم دورة كاملة', rules: '1. الصيغة: Level = (√Price ± n×0.25)²\n2. +0.25 = زاوية 90° Cardinal (الأقوى)\n3. +0.125 = زاوية 45° Ordinal (ثانوي)\n4. +0.5 (180°) = المستوى المقابل — قوي جداً\n5. +1.0 (360°) = دورة كاملة — مستوى رئيسي\n6. قارن المستويات المحسوبة مع S/R الفعلية للتأكيد', svg: '<rect width="120" height="80" fill="#000"/><text x="60" y="10" text-anchor="middle" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">BTC $64,000</text><text x="60" y="20" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">√64000 = 252.98</text><line x1="10" y1="23" x2="110" y2="23" stroke="#111" stroke-width="0.5"/><text x="8" y="33" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">R3 $65,024</text><text x="78" y="33" fill="#888" font-size="5" font-family="Share Tech Mono">+2 (720°)</text><text x="8" y="41" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">R2 $64,510</text><text x="78" y="41" fill="#888" font-size="5" font-family="Share Tech Mono">+1 (360°)</text><text x="8" y="49" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">R1 $64,127</text><text x="78" y="49" fill="#888" font-size="5" font-family="Share Tech Mono">+.25 (90°)</text><line x1="10" y1="52" x2="110" y2="52" stroke="#ff6a00" stroke-width="0.5" stroke-dasharray="2,2"/><text x="8" y="61" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">S1 $63,875</text><text x="78" y="61" fill="#888" font-size="5" font-family="Share Tech Mono">-.25 (90°)</text><text x="8" y="69" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">S2 $63,494</text><text x="78" y="69" fill="#888" font-size="5" font-family="Share Tech Mono">-1 (360°)</text>' },
            { name: 'Scaling Factor (SF)', ar: 'معامل التحجيم', rel: 88, type: 'ESSENTIAL', desc: 'التحدي: أسعار تتفاوت من $64,000 (BTC) لـ $0.00001 (SHIB). بدون SF المستويات غير منطقية. SF يُحوّل السعر لنطاق فعّال. القاعدة: SF = 10^n بحيث √(Price×SF) بين 10 و1000. BTC: SF=1 (√64000=252). DOGE $0.12: SF=100000 (√12000=109). SHIB: SF=10B. الصيغة: Level = (√(P×SF) ± n)² / SF.', fib: 'BTC ($64,000): SF = 1 → √64000 = 252\nETH ($3,400): SF = 1 → √3400 = 58\nDOGE ($0.12): SF = 100,000 → √12000 = 109\nSHIB ($0.00001): SF = 10,000,000,000\nالصيغة: Level = (√(P×SF) ± n)² / SF\nSF الصحيح = المستويات تتوافق مع الواقع', rules: '1. SF يجعل الجذر التربيعي في نطاق 10-1000\n2. بدون SF: المستويات غير منطقية\n3. للأسعار العالية (>$1000): SF = 1 أو أقل\n4. للأسعار المنخفضة (<$1): SF = 10000+\n5. اختبر بمقارنة المحسوب مع S/R الفعلية\n6. SF ثابت لكل عملة — لا يتغير مع السعر', svg: '<rect width="120" height="80" fill="#000"/><text x="60" y="10" text-anchor="middle" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">SCALING FACTOR</text><text x="8" y="26" fill="#fff" font-size="6" font-family="Share Tech Mono">BTC $64K</text><text x="78" y="26" fill="#888" font-size="6" font-family="Share Tech Mono">SF=1</text><text x="8" y="38" fill="#fff" font-size="6" font-family="Share Tech Mono">ETH $3.4K</text><text x="78" y="38" fill="#888" font-size="6" font-family="Share Tech Mono">SF=1</text><text x="8" y="50" fill="#fff" font-size="6" font-family="Share Tech Mono">DOGE $0.12</text><text x="78" y="50" fill="#888" font-size="6" font-family="Share Tech Mono">SF=100K</text><text x="8" y="62" fill="#fff" font-size="6" font-family="Share Tech Mono">SHIB $0.00001</text><text x="78" y="62" fill="#888" font-size="6" font-family="Share Tech Mono">SF=10B</text><text x="60" y="76" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">L = (√(P×SF) ± n)² / SF</text>' },
            { name: 'Price-Time Squaring', ar: 'تربيع السعر والزمن', rel: 85, type: 'ADVANCED', desc: 'أعلى مستوى في نظرية جان. عندما يتساوى السعر مع الزمن يحدث تحول رئيسي. مثال: قمة $10,000 → √10000=100 → بعد 100 يوم = نقطة تحول. على مربع 9: الأرقام تمثل السعر والزمن معاً. تطبيقياً: حدد قمة/قاع → √السعر → عدّ نفس الأيام/الأسابيع → تاريخ تحول. تقاطع دورة زمنية + مستوى سعري = أقوى نقطة.', fib: 'السعر يتساوى مع الزمن = نقطة تحول\n√السعر = عدد الوحدات الزمنية حتى التحول\nمثال: $10,000 → √10000 = 100 → 100 يوم\nتقاطع Price + Time = أقوى نقطة\nمفهوم متقدم — يحتاج خبرة\nيعمل أفضل على فريمات كبيرة (يومي/أسبوعي)', rules: '1. تربيع السعر مع الزمن = أقوى نقاط التحول\n2. √السعر = عدد الوحدات الزمنية حتى التحول\n3. ليس دقيقاً 100% لكن يُحدد نوافذ زمنية مهمة\n4. استخدمه مع فيبوناتشي الزمني للتأكيد\n5. مفهوم متقدم يحتاج خبرة وممارسة\n6. تقاطع دورة زمنية + مستوى سعري = الأقوى', svg: '<rect width="120" height="80" fill="#000"/><line x1="10" y1="70" x2="110" y2="70" stroke="#888" stroke-width="0.5"/><line x1="10" y1="70" x2="10" y2="10" stroke="#888" stroke-width="0.5"/><text x="60" y="76" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">TIME</text><text x="6" y="40" fill="#888" font-size="5" font-family="Share Tech Mono" transform="rotate(-90,6,40)">PRICE</text><line x1="10" y1="70" x2="90" y2="10" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><circle cx="50" cy="40" r="6" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="50" y="43" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">P=T</text><polyline points="15,65 25,55 30,58 40,42 45,45 50,40 55,38 60,32 65,28 70,20 75,15" fill="none" stroke="#fff" stroke-width="1.5"/>' }
        ]
    }
};

// === RENDER ===
function gsRender() {
    var cat = gsData[gsCurrentCat]; if (!cat) return;
    var el = document.getElementById('gs-content');
    if (!el) return;
    if (gsSelectedIdx >= 0 && gsSelectedIdx < cat.patterns.length) { el.innerHTML = gsRenderDetail(cat.patterns[gsSelectedIdx]); return; }
    var h = '';
    for (var i = 0; i < cat.patterns.length; i++) {
        var p = cat.patterns[i];
        if (p.isGrid) {
            h += '<div class="gs-schematic" onclick="gsSelect(' + i + ')"><div class="gs-schematic-title">' + p.ar + '</div><div class="gs-schematic-sub">' + p.name + '</div><div class="gs-schematic-svg"><svg viewBox="0 0 300 300" style="width:100%;height:auto">' + p.svg + '</svg></div><div class="gs-schematic-hint">اضغط لعرض التفاصيل</div></div>';
        } else {
            if (i === 1 || (i > 0 && cat.patterns[i - 1].isGrid)) h += '<div class="gs-grid">';
            h += '<div class="gs-card" style="border-top:3px solid #fff" onclick="gsSelect(' + i + ')">';
            h += '<div class="gs-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>';
            h += '<div class="gs-card-name">' + p.name + '</div><div class="gs-card-ar">' + p.ar + '</div>';
            if (p.type) h += '<div class="gs-card-type">' + p.type + '</div>';
            h += '<div class="gs-card-rel-row"><span class="gs-card-rel-l">IMPORTANCE</span><span class="gs-card-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
            h += '<div class="gs-card-bar"><div class="gs-card-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div></div>';
            if (i === cat.patterns.length - 1) h += '</div>';
        }
    }
    h += '<div class="gs-footer">مربع 9 لجان هو أداة W.D. Gann الأشهر في تاريخ التحليل الفني — تربط بين السعر والزمن والهندسة. طوّرها Gann في أوائل القرن العشرين واستخدمها لتحقيق أرباح أسطورية. الأداة تحتاج فهم رياضي وممارسة طويلة. القواعد الأساسية بسيطة (الجذر التربيعي والزوايا) لكن التطبيق العملي يحتاج خبرة. ابدأ بحساب Cardinal Levels ثم تدرّج. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
    el.innerHTML = h;
}

function gsRenderDetail(p) {
    var h = '<div class="gs-back" onclick="gsBack()">رجوع</div><div class="gs-detail">';
    if (p.isGrid) { h += '<div class="gs-detail-chart"><svg viewBox="0 0 300 300" style="width:100%;height:auto">' + p.svg + '</svg></div>'; }
    else { h += '<div class="gs-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">' + p.svg + '</svg></div>'; }
    h += '<div class="gs-detail-name">' + p.name + '</div><div class="gs-detail-ar">' + p.ar + '</div>';
    if (p.type) h += '<div class="gs-detail-badge">' + p.type + '</div>';
    h += '<div class="gs-detail-rel-row"><span class="gs-detail-rel-l">IMPORTANCE</span><span class="gs-detail-rel-v" style="color:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '">' + p.rel + '%</span></div>';
    h += '<div class="gs-detail-bar"><div class="gs-detail-fill" style="width:' + p.rel + '%;background:' + (p.rel >= 80 ? '#fff' : '#ff6a00') + '"></div></div>';
    h += '<div class="gs-detail-desc-wrap"><div class="gs-detail-desc-label">DESCRIPTION // الوصف الأكاديمي</div><div class="gs-detail-desc">' + p.desc + '</div></div>';
    h += '<div class="gs-detail-fib-wrap"><div class="gs-detail-fib-label">KEY NUMBERS // الأرقام والنسب</div>';
    var f = p.fib.split('\n'); for (var i = 0; i < f.length; i++) h += '<div class="gs-fib-row"><span class="gs-fib-arrow">▶</span><span class="gs-fib-text">' + f[i] + '</span></div>';
    h += '</div><div class="gs-detail-rules-wrap"><div class="gs-detail-rules-label">RULES // القواعد الأساسية</div>';
    var r = p.rules.split('\n'); for (var i = 0; i < r.length; i++) h += '<div class="gs-rule-row"><span class="gs-rule-num">' + r[i].substring(0, 2) + '</span><span class="gs-rule-text">' + r[i].substring(3) + '</span></div>';
    h += '</div></div>'; return h;
}

/* =====================================================================
   FIBONACCI GUIDE ENGINE - 360° PLATFORM
===================================================================== */
var fbCurrentCat='retracement';
var fbSelectedIdx=-1;

function fbSetCat(cat,btn){
  fbCurrentCat=cat; fbSelectedIdx=-1;
  var b=document.querySelectorAll('.fb-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('fb-cat-active');
  btn.classList.add('fb-cat-active');
  fbRender();
}

function fbSelect(idx){ fbSelectedIdx=idx; fbRender(); }
function fbBack(){ fbSelectedIdx=-1; fbRender(); }

function fbInit(){
  var h='';
  var k=Object.keys(fbData);
  for(var i=0;i<k.length;i++){
    var c=fbData[k[i]];
    h+='<button class="fb-cat-btn'+(k[i]===fbCurrentCat?' fb-cat-active':'')+'" onclick="fbSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('fb-cat-tabs').innerHTML=h;
  fbRender();
}

var fbData={
  retracement:{en:'RETRACEMENT',label:'الارتداد',patterns:[
    {name:'Fibonacci Retracement - Overview',ar:'ارتداد فيبوناتشي — نظرة شاملة',rel:95,type:'CORE TOOL',
    desc:'أكثر أدوات فيبوناتشي استخداماً في التحليل الفني. يُحدد مستويات التصحيح المحتملة بعد حركة سعرية قوية. الأساس الرياضي: متتالية فيبوناتشي (0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144...) حيث كل رقم = مجموع الرقمين السابقين. النسب تُشتق بقسمة الأرقام على بعضها.',
    fib:'23.6%: تصحيح ضحل جداً — اتجاه قوي جداً\n38.2%: تصحيح خفيف — اتجاه قوي\n50.0%: ليست نسبة فيبوناتشي حقيقية لكنها مهمة (نظرية داو)\n61.8%: النسبة الذهبية — أهم مستوى وأكثرها احتراماً\n78.6%: تصحيح عميق — الحد الأقصى المقبول\n88.6%: تصحيح عميق جداً — آخر فرصة (Bat Pattern في الهارمونيك)',
    rules:'1. ارسم من Swing Low إلى Swing High (صاعد) أو العكس\n2. 61.8% هو المستوى الأهم — النسبة الذهبية\n3. التصحيح فوق 78.6% يُشكك في صحة الاتجاه\n4. تجاوز 100% = ليس تصحيح بل انعكاس كامل\n5. استخدم مع مؤشرات أخرى (RSI/OB/FVG) للتأكيد\n6. المستويات ليست خطوط دقيقة بل مناطق (Zones)',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="15" y1="70" x2="15" y2="10" stroke="#fff" stroke-width="1.5"/><polyline points="20,70 40,10" fill="none" stroke="#fff" stroke-width="2"/><line x1="15" y1="70" x2="110" y2="70" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="10" x2="110" y2="10" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="24" x2="110" y2="24" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="15" y1="33" x2="110" y2="33" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><line x1="15" y1="40" x2="110" y2="40" stroke="#888" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="15" y1="47" x2="110" y2="47" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="15" y1="56" x2="110" y2="56" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="112" y="72" fill="#888" font-size="6" font-family="Share Tech Mono">0%</text><text x="112" y="58" fill="#888" font-size="5" font-family="Share Tech Mono">23.6%</text><text x="112" y="49" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">38.2%</text><text x="112" y="42" fill="#888" font-size="5" font-family="Share Tech Mono">50%</text><text x="112" y="35" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">61.8%</text><text x="112" y="26" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">78.6%</text><text x="112" y="12" fill="#888" font-size="6" font-family="Share Tech Mono">100%</text>'},
    {name:'How to Draw Correctly',ar:'طريقة الرسم الصحيحة',rel:92,type:'ESSENTIAL SKILL',
    desc:'أكثر خطأ شائع في فيبوناتشي هو الرسم الخاطئ. القاعدة: ارسم دائماً من بداية الحركة لنهايتها — من النقطة التي بدأ منها الاتجاه للنقطة التي انتهى عندها.',
    fib:'صاعد: ارسم من Swing Low → Swing High\nهابط: ارسم من Swing High → Swing Low\nاختر Major Swings فقط (قمم/قيعان واضحة)\nلا ترسم من ذيول الشموع الشاذة\nيومي > 4 ساعات > ساعة في القوة\nConfluence: تداخل فيبوناتشي من فريمات مختلفة = أقوى',
    rules:'1. من بداية الحركة لنهايتها — دائماً\n2. صاعد: Low → High | هابط: High → Low\n3. اختر Major Swing Points — لا التموجات الصغيرة\n4. لا ترسم من شمعة ذيلها شاذ (Wick) — استخدم الجسم\n5. فيبوناتشي من فريم أكبر = أقوى\n6. Confluence (تداخل فريمات) = أقوى منطقة S/R',
    svg:'<rect width="120" height="80" fill="#000"/><circle cx="15" cy="68" r="4" fill="none" stroke="#fff" stroke-width="2"/><text x="15" y="78" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">LOW</text><polyline points="15,68 30,55 38,60 50,40 58,45 70,25 78,30 90,15" fill="none" stroke="#fff" stroke-width="2"/><circle cx="90" cy="15" r="4" fill="none" stroke="#fff" stroke-width="2"/><text x="90" y="10" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">HIGH</text><line x1="15" y1="68" x2="90" y2="15" stroke="#ff6a00" stroke-width="1" stroke-dasharray="4,3"/><text x="55" y="35" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900" transform="rotate(-35,55,35)">DRAW HERE</text>'},
    {name:'The Golden Ratio (61.8%)',ar:'النسبة الذهبية (61.8%)',rel:95,type:'MOST IMPORTANT',
    desc:'61.8% هي النسبة الذهبية (Golden Ratio / Phi) — أهم رقم في فيبوناتشي. في التحليل الفني: 61.8% هو المستوى الأكثر احتراماً من السعر.',
    fib:'61.8% = 1/φ = 1/1.618 = النسبة الذهبية\nتظهر في: إليوت (الموجة 2)، هارمونيك (كل نموذج)، جان\nأقوى مستوى ارتداد إحصائياً\n61.8% من أي رقم فيبوناتشي = الرقم الذي قبله بخطوتين\nSelf-Fulfilling: ملايين المتداولين يستخدمونها\nالمنطقة 61.8%-65% = OTE Zone في ICT',
    rules:'1. 61.8% = أقوى مستوى ارتداد في كل الأسواق\n2. الموجة 2 في إليوت غالباً ترتد 61.8%\n3. OTE Zone (Optimal Trade Entry) في ICT: 61.8%-79%\n4. تداخل 61.8% مع OB أو FVG = فرصة ذهبية\n5. ليس خط دقيق — منطقة 60%-65% كلها مهمة\n6. تأكيد بشمعة انعكاسية عند 61.8% = دخول قوي',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="28" width="100" height="12" fill="rgba(255,255,255,0.06)"/><line x1="10" y1="34" x2="110" y2="34" stroke="#fff" stroke-width="2.5"/><text x="60" y="22" text-anchor="middle" fill="#fff" font-size="14" font-family="Share Tech Mono" font-weight="900">61.8%</text><text x="60" y="50" text-anchor="middle" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">THE GOLDEN RATIO</text><text x="60" y="60" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">φ = 1.618033988749...</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">NATURE + MARKETS + GEOMETRY</text>'},
    {name:'OTE Zone (61.8% - 78.6%)',ar:'منطقة الدخول المثالي (OTE)',rel:90,type:'ICT CONCEPT',
    desc:'OTE Zone (Optimal Trade Entry) هي المنطقة بين 61.8% و78.6% من حركة فيبوناتشي. طوّرها ICT كأدق منطقة دخول تعطي أفضل R:R.',
    fib:'61.8%: بداية OTE Zone\n70.5%: منتصف OTE — أدق نقطة\n78.6%: نهاية OTE Zone\nداخل OTE: ابحث عن OB + FVG + شمعة انعكاسية\nSL: تحت Swing Low/High (100%)\nTP: عند -27% أو -62% Fibonacci Extension',
    rules:'1. OTE Zone = 61.8% إلى 78.6%\n2. 70.5% = منتصف OTE — أدق نقطة دخول\n3. لا تدخل بدون تأكيد داخل OTE (OB/FVG/شمعة)\n4. SL تحت 100% (Swing Point)\n5. R:R ممتاز — SL ضيق + أهداف بعيدة\n6. OTE + Discount Zone + OB = أقوى Setup ممكن',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="15" y1="70" x2="15" y2="10" stroke="#fff" stroke-width="1"/><line x1="15" y1="10" x2="110" y2="10" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="70" x2="110" y2="70" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><rect x="15" y="21" width="95" height="16" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1"/><line x1="15" y1="29" x2="110" y2="29" stroke="#ff6a00" stroke-width="1" stroke-dasharray="2,2"/><text x="60" y="19" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">OTE ZONE</text><text x="112" y="23" fill="#fff" font-size="5" font-family="Share Tech Mono">61.8%</text><text x="112" y="31" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">70.5%</text><text x="112" y="39" fill="#fff" font-size="5" font-family="Share Tech Mono">78.6%</text><text x="112" y="72" fill="#888" font-size="5" font-family="Share Tech Mono">0%</text><text x="112" y="12" fill="#888" font-size="5" font-family="Share Tech Mono">100%</text>'}
  ]},
  extensions:{en:'EXTENSIONS',label:'الامتداد والأهداف',patterns:[
    {name:'Fibonacci Extension - Targets',ar:'امتداد فيبوناتشي — الأهداف السعرية',rel:92,type:'TARGET TOOL',
    desc:'يُحدد أين يصل السعر بعد التصحيح — أي الأهداف السعرية. يُرسم من 3 نقاط: Swing Low → Swing High → نهاية التصحيح.',
    fib:'127.2%: هدف أول محافظ\n141.4%: √2 — مستوى ثانوي\n161.8%: الهدف الأكثر شيوعاً (النسبة الذهبية)\n200.0%: ضعف الحركة — هدف قوي\n261.8%: هدف ممتد في الأسواق القوية\n423.6%: نادر — فقط في الأسواق الانفجارية',
    rules:'1. يُرسم من 3 نقاط: Low → High → نهاية التصحيح\n2. 161.8% = الهدف الأكثر شيوعاً وموثوقية\n3. في إليوت: الموجة 3 تستهدف 161.8% من الموجة 1\n4. إذا تجاوز 161.8% فالهدف التالي 261.8%\n5. خذ أرباح جزئية عند كل مستوى\n6. Extension + مستوى S/R سابق = هدف مؤكد',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="12,65 35,20 50,42" fill="none" stroke="#fff" stroke-width="2"/><line x1="50" y1="42" x2="110" y2="42" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="50" y1="20" x2="110" y2="20" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="50" y1="10" x2="110" y2="10" stroke="#fff" stroke-width="1.2" stroke-dasharray="3,3"/><line x1="50" y1="2" x2="110" y2="2" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><polyline points="50,42 65,28 72,32 85,15 92,18 105,5" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4,3"/><text x="112" y="44" fill="#888" font-size="5" font-family="Share Tech Mono">100%</text><text x="112" y="22" fill="#888" font-size="5" font-family="Share Tech Mono">127.2%</text><text x="112" y="12" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">161.8%</text><text x="112" y="5" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">261.8%</text>'},
    {name:'Fibonacci Expansion (Projection)',ar:'إسقاط فيبوناتشي',rel:85,type:'PROJECTION',
    desc:'مشابه لـ Extension لكن الفرق في طريقة الحساب. Expansion يقيس طول الحركة الأولى (AB) ويُسقطه من نقطة نهاية التصحيح (C).',
    fib:'61.8% Expansion: CD = 61.8% من AB\n100% Expansion: CD = AB (AB=CD pattern)\n127.2% Expansion: CD = 127.2% من AB\n161.8% Expansion: CD = 161.8% من AB\n200% Expansion: CD = 200% من AB\nيُستخدم كثيراً في الهارمونيك (ABCD)',
    rules:'1. يقيس AB ويُسقطه من C\n2. 100% Expansion = AB=CD (أبسط نموذج هارمونيك)\n3. 161.8% = الهدف الشائع في الأسواق القوية\n4. يختلف عن Extension في طريقة الحساب\n5. مفيد جداً مع نماذج ABCD الهارمونيكية\n6. CD = AB هو أكثر نسبة تحقق إحصائياً',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="12,55 40,15 58,35" fill="none" stroke="#fff" stroke-width="2"/><text x="12" y="62" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">A</text><text x="40" y="12" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">B</text><text x="58" y="42" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">C</text><line x1="58" y1="35" x2="86" y2="-5" stroke="#fff" stroke-width="1.5" stroke-dasharray="4,3"/><line x1="40" y1="15" x2="86" y2="15" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="88" y="17" fill="#888" font-size="5" font-family="Share Tech Mono">100% (AB=CD)</text><line x1="40" y1="2" x2="86" y2="2" stroke="#fff" stroke-width="0.8" stroke-dasharray="3,3"/><text x="88" y="5" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">161.8%</text><text x="25" y="42" fill="#888" font-size="5" font-family="Share Tech Mono" transform="rotate(-55,25,42)">AB</text><text x="72" y="22" fill="#888" font-size="5" font-family="Share Tech Mono" transform="rotate(-55,72,22)">CD</text>'},
    {name:'Negative Fibonacci (-27% / -62%)',ar:'فيبوناتشي السالب — أهداف ما بعد الكسر',rel:82,type:'BREAKOUT TARGETS',
    desc:'فيبوناتشي السالب يُحدد أهداف السعر بعد كسر مستوى 0% (القمة في الصاعد أو القاع في الهابط). مفيد جداً في تحديد أهداف ما بعد الاختراق.',
    fib:'-27.2%: أول هدف بعد الكسر\n-61.8%: هدف رئيسي (النسبة الذهبية)\n-100%: ضعف الحركة الأصلية\n-161.8%: هدف ممتد\n-200%: ثلاثة أضعاف الحركة\nيُحسب من نقطة الكسر (0%) باتجاه الكسر',
    rules:'1. يُستخدم بعد كسر القمة/القاع (مستوى 0%)\n2. -27.2% = أول هدف بعد الكسر\n3. -61.8% = الهدف الرئيسي\n4. يُحسب تلقائياً في معظم منصات الرسم\n5. مفيد مع مستويات S/R سابقة للتأكيد\n6. خذ أرباح جزئية عند كل مستوى سالب',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="15" y1="55" x2="110" y2="55" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="35" x2="110" y2="35" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="15" y1="25" x2="110" y2="25" stroke="#ff6a00" stroke-width="1" stroke-dasharray="3,3"/><line x1="15" y1="15" x2="110" y2="15" stroke="#fff" stroke-width="1" stroke-dasharray="3,3"/><line x1="15" y1="5" x2="110" y2="5" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><polyline points="20,55 35,35 45,42 55,35 60,32 65,28 70,22 78,18 85,12 92,8" fill="none" stroke="#fff" stroke-width="2"/><text x="112" y="57" fill="#888" font-size="5" font-family="Share Tech Mono">100% (Low)</text><text x="112" y="37" fill="#888" font-size="5" font-family="Share Tech Mono">0% (High)</text><text x="112" y="27" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">-27.2%</text><text x="112" y="17" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">-61.8%</text><text x="112" y="7" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">-100%</text>'}
  ]},
  advanced:{en:'ADVANCED TOOLS',label:'أدوات متقدمة',patterns:[
    {name:'Fibonacci Time Zones',ar:'مناطق فيبوناتشي الزمنية',rel:78,type:'TIME ANALYSIS',
    desc:'تطبيق أرقام فيبوناتشي على الزمن بدلاً من السعر. تُرسم خطوط عمودية عند أرقام فيبوناتشي من نقطة البداية. عند هذه الخطوط يُتوقع حدوث تحول مهم في السعر.',
    fib:'الخطوط عند: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89 فترة\nفترة = شمعة واحدة (يومي/4 ساعات/ساعة)\nعند كل خط: توقع حركة مهمة أو تحول\nتتوافق مع دورات جان (خاصة 34 و55 و89)\nسعر Fib + زمن Fib = Confluence = أقوى نقطة\nأكثر فعالية على الفريمات الكبيرة (يومي/أسبوعي)',
    rules:'1. تُرسم من نقطة محورية (قمة أو قاع رئيسي)\n2. خطوط عمودية عند أرقام فيبوناتشي من تلك النقطة\n3. عند كل خط: انتظر حركة مهمة أو تحول\n4. الأرقام الأكبر (34, 55, 89) = تحولات أقوى\n5. اجمع مع Retracement سعري = Confluence\n6. لا تستخدمها وحدها — أداة مساعدة وليست رئيسية',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,42 30,50 40,35 50,42 60,28 70,35 80,22 90,30 100,18 110,25" fill="none" stroke="#fff" stroke-width="1.5"/><line x1="20" y1="5" x2="20" y2="72" stroke="#ff6a00" stroke-width="0.8" opacity="0.5"/><line x1="30" y1="5" x2="30" y2="72" stroke="#ff6a00" stroke-width="0.8" opacity="0.5"/><line x1="40" y1="5" x2="40" y2="72" stroke="#ff6a00" stroke-width="0.8" opacity="0.5"/><line x1="55" y1="5" x2="55" y2="72" stroke="#ff6a00" stroke-width="1" opacity="0.6"/><line x1="75" y1="5" x2="75" y2="72" stroke="#ff6a00" stroke-width="1" opacity="0.7"/><line x1="100" y1="5" x2="100" y2="72" stroke="#ff6a00" stroke-width="1.2" opacity="0.8"/><text x="20" y="78" fill="#888" font-size="5" font-family="Share Tech Mono" text-anchor="middle">1</text><text x="30" y="78" fill="#888" font-size="5" font-family="Share Tech Mono" text-anchor="middle">2</text><text x="40" y="78" fill="#888" font-size="5" font-family="Share Tech Mono" text-anchor="middle">3</text><text x="55" y="78" fill="#ff6a00" font-size="5" font-family="Share Tech Mono" text-anchor="middle">5</text><text x="75" y="78" fill="#ff6a00" font-size="5" font-family="Share Tech Mono" text-anchor="middle">8</text><text x="100" y="78" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900" text-anchor="middle">13</text>'},
    {name:'Fibonacci Channel',ar:'قناة فيبوناتشي',rel:75,type:'TREND CHANNEL',
    desc:'قناة فيبوناتشي تجمع بين خطوط الاتجاه ونسب فيبوناتشي. كل خط يمثل مستوى دعم/مقاومة ديناميكي يتحرك مع الزمن.',
    fib:'0%: خط الاتجاه الأساسي (الدعم الديناميكي)\n61.8%: أول مستوى داخل القناة\n100%: خط القناة الموازي\n161.8%: هدف الامتداد — مقاومة قوية\n261.8%: هدف ممتد\nكل خط = دعم/مقاومة ديناميكي',
    rules:'1. ارسم خط اتجاه من قاعين (صعود) أو قمتين (هبوط)\n2. خط القناة الموازي عند 100%\n3. 61.8% داخل القناة = دعم/مقاومة وسطية\n4. 161.8% = هدف ممتد عند كسر القناة\n5. مفيدة في الاتجاهات القوية والواضحة\n6. السعر يتنقل بين خطوط القناة بانتظام',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="65" x2="110" y2="45" stroke="#fff" stroke-width="1.5"/><line x1="10" y1="45" x2="110" y2="25" stroke="#888" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="10" y1="35" x2="110" y2="15" stroke="#ff6a00" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="10" y1="15" x2="110" y2="-5" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><polyline points="12,63 22,52 30,58 40,48 48,55 58,42 65,48 75,35 82,40 92,30 100,35 108,28" fill="none" stroke="#fff" stroke-width="1.5"/><text x="112" y="47" fill="#fff" font-size="5" font-family="Share Tech Mono">0%</text><text x="112" y="27" fill="#888" font-size="5" font-family="Share Tech Mono">100%</text><text x="112" y="17" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">161.8%</text>'},
    {name:'Common Mistakes',ar:'أخطاء شائعة في استخدام فيبوناتشي',rel:90,type:'AVOID THESE',
    desc:'أخطاء يرتكبها المتداولون: الرسم من نقطة خاطئة، الاعتماد على فيبوناتشي وحده، وتوقع ارتداد دقيق من خط واحد بدلاً من التعامل كمنطقة.',
    fib:'خطأ 1: رسم من نقاط خاطئة (Minor بدلاً من Major)\nخطأ 2: الاعتماد على فيبوناتشي وحده\nخطأ 3: توقع ارتداد دقيق من خط واحد\nخطأ 4: تجاهل الاتجاه العام (السياق)\nخطأ 5: فريمات صغيرة فقط\nخطأ 6: عدم البحث عن Confluence',
    rules:'1. ارسم من Major Swing Points فقط\n2. لا تتداول على فيبوناتشي وحده — أضف تأكيد دائماً\n3. المستويات مناطق (Zones) وليست خطوط دقيقة\n4. فيبوناتشي في اتجاه واضح أهم من التذبذب\n5. ابحث عن Confluence: فيبوناتشي + OB + FVG + S/R',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="20" y1="20" x2="40" y2="20" stroke="#ff6a00" stroke-width="3"/><line x1="25" y1="15" x2="35" y2="25" stroke="#ff6a00" stroke-width="2"/><line x1="25" y1="25" x2="35" y2="15" stroke="#ff6a00" stroke-width="2"/><text x="45" y="23" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">WRONG</text><line x1="20" y1="50" x2="40" y2="50" stroke="#fff" stroke-width="3"/><polyline points="25,50 30,45 35,50" fill="none" stroke="#fff" stroke-width="2"/><text x="45" y="53" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">RIGHT</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">AVOID COMMON MISTAKES</text>'}
  ]}
};

function fbRender(){
  var cat=fbData[fbCurrentCat];
  if(!cat) return;
  var el=document.getElementById('fb-content');
  if(fbSelectedIdx>=0 && fbSelectedIdx<cat.patterns.length){
    el.innerHTML=fbRenderDetail(cat.patterns[fbSelectedIdx]);
    return;
  }
  var h='<div class="fb-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    h+='<div class="fb-card" style="border-top:3px solid #fff" onclick="fbSelect('+i+')">';
    h+='<div class="fb-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
    h+='<div class="fb-card-name">'+p.name+'</div><div class="fb-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="fb-card-type">'+p.type+'</div>';
    h+='<div class="fb-card-rel-row"><span class="fb-card-rel-l">IMPORTANCE</span><span class="fb-card-rel-v" style="color:'+(p.rel>=80?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="fb-card-bar"><div class="fb-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=80?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="fb-footer">فيبوناتشي هو العمود الفقري للتحليل الفني، يربط بين المدارس. النسب تعكس التوازن الطبيعي في الأسواق. المستويات مناطق وليست خطوط دقيقة. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function fbRenderDetail(p){
  var h='<div class="fb-back" onclick="fbBack()">رجوع</div><div class="fb-detail">';
  h+='<div class="fb-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
  h+='<div class="fb-detail-name">'+p.name+'</div><div class="fb-detail-ar">'+p.ar+'</div>';
  if(p.type) h+='<div class="fb-detail-badge">'+p.type+'</div>';
  h+='<div class="fb-detail-rel-row"><span class="fb-detail-rel-l">IMPORTANCE</span><span class="fb-detail-rel-v" style="color:'+(p.rel>=80?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="fb-detail-bar"><div class="fb-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=80?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="fb-detail-desc-wrap"><div class="fb-detail-desc-label">DESCRIPTION // الوصف</div><div class="fb-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="fb-detail-fib-wrap"><div class="fb-detail-fib-label">LEVELS & RATIOS // المستويات والنسب</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="fb-fib-row"><span class="fb-fib-arrow">▶</span><span class="fb-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="fb-detail-rules-wrap"><div class="fb-detail-rules-label">RULES // القواعد</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="fb-rule-row"><span class="fb-rule-num">'+r[i].substring(0,2)+'</span><span class="fb-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

/* =====================================================================
   MARKET CORRELATION GUIDE ENGINE - 360° PLATFORM
===================================================================== */
var mcCurrentCat='crypto';
var mcSelectedIdx=-1;

function mcSetCat(cat,btn){
  mcCurrentCat=cat; mcSelectedIdx=-1;
  var b=document.querySelectorAll('.mc-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('mc-cat-active');
  btn.classList.add('mc-cat-active');
  mcRender();
}

function mcSelect(idx){ mcSelectedIdx=idx; mcRender(); }
function mcBack(){ mcSelectedIdx=-1; mcRender(); }

function mcInit(){
  var h='';
  var k=Object.keys(mcData);
  for(var i=0;i<k.length;i++){
    var c=mcData[k[i]];
    h+='<button class="mc-cat-btn'+(k[i]===mcCurrentCat?' mc-cat-active':'')+'" onclick="mcSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('mc-cat-tabs').innerHTML=h;
  mcRender();
}

var mcData={
  crypto:{en:'CRYPTO INTERNAL',label:'الترابط الداخلي',patterns:[
    {name:'BTC vs Altcoins',ar:'بتكوين مقابل العملات البديلة',rel:95,type:'POSITIVE CORRELATION',
    desc:'بتكوين هو قائد سوق الكريبتو بلا منازع. عندما يصعد BTC تصعد أغلب Altcoins معه وعندما يهبط تهبط — لكن بنسب مختلفة. في الصعود: BTC يتحرك أولاً ثم ETH ثم Large Caps ثم Mid/Small Caps وهذا يُسمى Capital Rotation.',
    fib:'BTC يصعد 5% → ETH تصعد 7-10%\nBTC يصعد 5% → Large Cap تصعد 8-15%\nBTC يصعد 5% → Small Cap قد تصعد 20-50%\nBTC يهبط 5% → Altcoins تهبط 10-40%\nCorrelation في الهبوط أقوى من الصعود\nAlt Season: Altcoins تتفوق على BTC مؤقتاً',
    rules:'1. BTC هو القائد — لا تتداول Alts ضد اتجاه BTC\n2. في الصعود: BTC أولاً → ETH → Large → Small (Capital Rotation)\n3. في الهبوط: الصغيرة تنهار أولاً وأسرع (Beta عالي)\n4. Altcoins = مضاعف من BTC (أرباح أكبر + خسائر أكبر)\n5. تحقق من BTC قبل أي صفقة على Altcoin\n6. Alt Season تحدث فقط عندما BTC مستقر أو يتذبذب جانبياً',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,48 30,42 40,38 50,32 60,28 70,22 80,18 90,15 100,12" fill="none" stroke="#fff" stroke-width="2.5"/><polyline points="10,58 20,48 30,38 40,32 50,22 60,15 70,8 80,5" fill="none" stroke="#ff6a00" stroke-width="1.5"/><polyline points="10,60 20,50 30,35 40,25 50,10" fill="none" stroke="#888" stroke-width="1" stroke-dasharray="3,2"/><text x="102" y="10" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="82" y="5" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">ETH</text><text x="52" y="8" fill="#888" font-size="5" font-family="Share Tech Mono">ALT</text><text x="60" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">BTC LEADS — ALTS FOLLOW</text>'},
    {name:'BTC Dominance (BTC.D)',ar:'هيمنة بتكوين',rel:92,type:'MARKET SHARE',
    desc:'BTC Dominance هي النسبة المئوية لقيمة BTC من إجمالي سوق الكريبتو. ارتفاع BTC.D يعني: المال يتدفق من Altcoins إلى BTC. انخفاض BTC.D يعني: المال يتدفق من BTC إلى Altcoins — Alt Season.',
    fib:'BTC.D > 55%: هيمنة BTC قوية — تداول BTC فقط\nBTC.D 45-55%: منطقة متوازنة\nBTC.D < 45%: Alt Season — Altcoins تتفوق\nBTC.D يرتفع + BTC يصعد = أموال جديدة تدخل BTC\nBTC.D يرتفع + BTC يهبط = هروب من Alts لـ BTC (Safety)\nBTC.D ينخفض + BTC يصعد = Alt Season الحقيقي',
    rules:'1. BTC.D يرتفع = ابقَ في BTC وتجنب Altcoins\n2. BTC.D ينخفض = فرصة لتداول Altcoins\n3. BTC.D < 45% = Alt Season (نادر ومؤقت)\n4. في بداية Bull Market: BTC.D يرتفع أولاً\n5. في نهاية Bull Market: BTC.D ينخفض (Euphoria)\n6. راقب BTC.D يومياً قبل أي قرار على Altcoins',
    svg:'<rect width="120" height="80" fill="#000"/><circle cx="60" cy="40" r="28" fill="none" stroke="#888" stroke-width="1"/><path d="M 60,12 A 28,28 0 1,1 38,64" fill="rgba(255,255,255,0.1)" stroke="#fff" stroke-width="2"/><path d="M 38,64 A 28,28 0 0,1 60,12" fill="rgba(255,106,0,0.08)" stroke="#ff6a00" stroke-width="1.5"/><text x="50" y="36" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="48" y="45" fill="#fff" font-size="7" font-family="Share Tech Mono">60%</text><text x="55" y="58" fill="#ff6a00" font-size="7" font-family="Share Tech Mono">ALTS</text><text x="55" y="66" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">40%</text><text x="60" y="78" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">BTC DOMINANCE</text>'},
    {name:'ETH/BTC Ratio',ar:'نسبة إيثيريوم/بتكوين',rel:85,type:'ALT HEALTH',
    desc:'ETH/BTC هو أهم زوج لقياس صحة سوق Altcoins. ETH/BTC يرتفع: Altcoins تتفوق على BTC. ETH/BTC ينخفض: BTC يتفوق — تجنب Alts.',
    fib:'ETH/BTC يرتفع = Altcoins تتفوق على BTC\nETH/BTC ينخفض = BTC يتفوق — تجنب Alts\nETH/BTC عند دعم تاريخي = فرصة شراء Alts\nETH/BTC عند مقاومة = وقت العودة لـ BTC\nطبّق التحليل الفني على ETH/BTC نفسه\nETH/BTC هو مقياس Alt Season الحقيقي',
    rules:'1. ETH/BTC يرتفع = بيئة مثالية لتداول Altcoins\n2. ETH/BTC ينخفض = تجنب Alts وابقَ في BTC\n3. راقب S/R التاريخية على ETH/BTC\n4. طبّق فيبوناتشي وإليوت على ETH/BTC\n5. ETH/BTC عند أدنى مستوياته = Alt Season قريبة محتملة\n6. لا تتداول Alts إذا ETH/BTC في اتجاه هابط واضح',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,25 18,30 25,28 32,35 40,32 48,38 55,42 62,40 70,45 78,48 85,52 92,50 100,55 108,58" fill="none" stroke="#ff6a00" stroke-width="2"/><line x1="10" y1="55" x2="110" y2="55" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="112" y="60" fill="#fff" font-size="5" font-family="Share Tech Mono">SUPPORT</text><text x="60" y="18" text-anchor="middle" fill="#ff6a00" font-size="8" font-family="Share Tech Mono" font-weight="900">ETH/BTC</text><text x="30" y="75" fill="#fff" font-size="6" font-family="Share Tech Mono">BTC LEADS</text><text x="80" y="75" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">ALTS WEAK</text>'},
    {name:'Crypto Sector Rotation',ar:'دوران القطاعات في الكريبتو',rel:82,type:'CAPITAL FLOW',
    desc:'الكريبتو يمر بدورة تناوب بين القطاعات. الدورة النموذجية: BTC يقود الصعود أولاً → ETH ومنافسيها → DeFi → Gaming → Meme coins.',
    fib:'المرحلة 1: BTC يقود الصعود (BTC.D يرتفع)\nالمرحلة 2: ETH + Layer 1\nالمرحلة 3: DeFi\nالمرحلة 4: Gaming/Metaverse\nالمرحلة 5: Meme Coins — نهاية الدورة\nالمرحلة 6: انهيار — العكس بالترتيب',
    rules:'1. BTC يقود دائماً — لا تسبقه\n2. كل قطاع له دورته — اشترِ القطاع القادم\n3. Meme coins = آخر مرحلة = نهاية Bull Market\n4. عندما Meme coins تنفجر = وقت الحذر\n5. في الهبوط: الأضعف ينهار أولاً وأسرع\n6. تتبع تدفق الأموال بين القطاعات أسبوعياً',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="10" width="20" height="60" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1"/><rect x="30" y="18" width="20" height="52" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><rect x="52" y="26" width="20" height="44" fill="rgba(255,106,0,0.06)" stroke="#ff6a00" stroke-width="0.8"/><rect x="74" y="34" width="20" height="36" fill="rgba(255,106,0,0.04)" stroke="#ff6a00" stroke-width="0.5"/><rect x="96" y="42" width="18" height="28" fill="rgba(255,106,0,0.03)" stroke="#888" stroke-width="0.5"/><text x="18" y="44" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="40" y="48" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">ETH</text><text x="62" y="52" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono">DeFi</text><text x="84" y="56" text-anchor="middle" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">Game</text><text x="105" y="60" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">Meme</text><line x1="18" y1="72" x2="105" y2="72" stroke="#ff6a00" stroke-width="1"/><text x="18" y="78" fill="#fff" font-size="5" font-family="Share Tech Mono">FIRST</text><text x="90" y="78" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">LAST</text>'}
  ]},
  macro:{en:'MACRO CORRELATION',label:'الترابط الخارجي',patterns:[
    {name:'BTC vs US Dollar Index (DXY)',ar:'بتكوين مقابل مؤشر الدولار',rel:90,type:'INVERSE CORRELATION',
    desc:'العلاقة الأهم في التحليل الكلي للكريبتو. BTC و DXY يتحركان عكس بعضهما في أغلب الأوقات. DXY يرتفع: الأصول الخطرة تهبط. DXY يهبط: بيئة صعودية.',
    fib:'DXY يرتفع → BTC يهبط (85% من الحالات)\nDXY يهبط → BTC يصعد (85% من الحالات)\nDXY > 105: ضغط على الأصول الخطرة\nDXY < 100: بيئة مثالية للكريبتو\nDXY يكسر دعم رئيسي → صعود BTC قوي\nDecoupling: نادر ومؤقت',
    rules:'1. علاقة عكسية: DXY يصعد = BTC يهبط والعكس\n2. DXY يضعف = بيئة مثالية لشراء BTC\n3. DXY يقوى = حذر من الكريبتو\n4. راقب DXY يومياً مع BTC\n5. كسر DXY لدعم رئيسي = إشارة شراء BTC\n6. الترابط ليس 100% — أحياناً ينكسر مؤقتاً',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,48 30,42 40,35 50,30 60,25 70,20 80,18 90,15 100,12" fill="none" stroke="#fff" stroke-width="2"/><polyline points="10,20 20,25 30,30 40,38 50,42 60,48 70,52 80,55 90,58 100,62" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="102" y="10" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="102" y="65" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">DXY</text><text x="55" y="76" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">INVERSE CORRELATION</text><line x1="55" y1="5" x2="55" y2="68" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/>'},
    {name:'BTC vs S&P 500 / Nasdaq',ar:'بتكوين مقابل الأسهم الأمريكية',rel:85,type:'POSITIVE CORRELATION',
    desc:'ارتباط قوي بين BTC والأسهم الأمريكية (خاصة Nasdaq). BTC يتصرف كأصل خطر مثل أسهم التكنولوجيا لكنه أكثر تقلباً.',
    fib:'Nasdaq يصعد → BTC يصعد (75% من الحالات)\nNasdaq يهبط → BTC يهبط (80% من الحالات)\nBTC يتحرك بمضاعف 2-3x من Nasdaq\nفي الأزمات: Correlation = 1 (الكل يهبط)\nBTC ETF زاد الترابط المؤسسي بشكل كبير\nFed hawkish → أسهم + BTC يهبطان',
    rules:'1. علاقة إيجابية: S&P/Nasdaq يصعد = BTC يصعد\n2. BTC يتحرك بمضاعف 2-3x (أكثر تقلباً)\n3. في الأزمات: كل الأصول تهبط معاً\n4. راقب مؤشرات الأسهم قبل التداول\n5. BTC ETF زاد الترابط — المؤسسات تتحكم\n6. FOMC / Fed Decisions تؤثر على الاثنين معاً',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,48 30,42 40,38 50,32 60,28 70,25 80,22 90,18 100,15" fill="none" stroke="#fff" stroke-width="2"/><polyline points="10,52 20,46 30,40 40,36 50,32 60,28 70,26 80,24 90,22 100,20" fill="none" stroke="#ff6a00" stroke-width="2"/><text x="102" y="13" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="102" y="22" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">S&P</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">POSITIVE CORRELATION</text>'},
    {name:'BTC vs Gold',ar:'بتكوين مقابل الذهب',rel:75,type:'EVOLVING',
    desc:'العلاقة بين BTC والذهب متغيرة. في التضخم كلاهما يرتفع، في أزمات السيولة الذهب يصعد وBTC يهبط.',
    fib:'في التضخم: BTC + Gold يرتفعان (ملاذ)\nفي أزمة سيولة: Gold يرتفع + BTC يهبط\nفي الأوقات العادية: لا ترابط واضح\nBTC = أصل خطر (Risk-On) حالياً\nGold = ملاذ آمن (Risk-Off)\nكلما زاد التبني المؤسسي زاد التشابه',
    rules:'1. لا ترابط قوي حالياً — علاقة متطورة\n2. في التضخم: كلاهما يستفيد\n3. في الأزمات: الذهب ملاذ آمن، BTC لا\n4. BTC أصل خطر حالياً وليس ملاذ آمن\n5. لا تعامل BTC كذهب في إدارة المحفظة\n6. راقب التطور — الترابط قد يزداد مع التبني',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,42 20,38 30,40 40,35 50,38 60,32 70,30 80,28 90,25 100,22" fill="none" stroke="#fff" stroke-width="2"/><polyline points="10,45 20,42 30,38 40,40 50,35 60,38 70,42 80,38 90,35 100,32" fill="none" stroke="#ff6a00" stroke-width="2" stroke-dasharray="4,3"/><text x="102" y="20" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="102" y="34" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">GOLD</text><text x="55" y="65" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">WEAK / EVOLVING CORRELATION</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">NOT DIGITAL GOLD... YET</text>'},
    {name:'Fed Policy & Interest Rates',ar:'سياسة الفيدرالي وأسعار الفائدة',rel:88,type:'MACRO DRIVER',
    desc:'أقوى محرك خارجي للكريبتو. فائدة ترتفع: السيولة تنكمش، BTC يهبط. فائدة تنخفض: السيولة تتوسع، BTC يصعد.',
    fib:'Rate Cut (خفض فائدة) → BTC يصعد\nRate Hike (رفع فائدة) → BTC يهبط\nQE (طباعة) → أقوى صعود للكريبتو\nQT (سحب) → أقوى هبوط\nFOMC: كل 6 أسابيع — أهم حدث\nDot Plot: توقعات الفائدة المستقبلية',
    rules:'1. الفائدة تنخفض = صعود BTC (سيولة تتوسع)\n2. الفائدة ترتفع = هبوط BTC (سيولة تنكمش)\n3. FOMC كل 6 أسابيع = احذر التقلب الحاد\n4. QE = أقوى وقود صعودي للكريبتو\n5. راقب تصريحات رئيس الفيدرالي\n6. لا تفتح صفقات كبيرة قبل FOMC مباشرة',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,15 20,18 30,22 40,28 50,35 60,40 70,42 80,40 90,35 100,30" fill="none" stroke="#ff6a00" stroke-width="2"/><polyline points="10,60 20,58 30,55 40,48 50,40 60,35 70,32 80,35 90,40 100,48" fill="none" stroke="#fff" stroke-width="2"/><text x="15" y="12" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">RATES UP</text><text x="80" y="28" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">RATES DOWN</text><text x="15" y="68" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC DOWN</text><text x="80" y="55" fill="#fff" font-size="5" font-family="Share Tech Mono">BTC UP</text><text x="55" y="78" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">FED DRIVES EVERYTHING</text>'}
  ]},
  tools:{en:'ANALYSIS TOOLS',label:'أدوات التحليل',patterns:[
    {name:'Total Crypto Market Cap',ar:'القيمة السوقية الإجمالية',rel:88,type:'BIG PICTURE',
    desc:'Total Market Cap هو إجمالي قيمة الكريبتو. Total يصعد = أموال جديدة تدخل السوق. يمكن تطبيق التحليل الفني عليه.',
    fib:'Total Market Cap: كل الكريبتو\nTotal2: بدون BTC — صحة Altcoins\nTotal3: بدون BTC+ETH — صحة الصغيرة\nTotal يصعد = أموال جديدة تدخل\nTotal يكسر ATH = Bull Market مؤكد\nTotal يكسر دعم رئيسي = Bear Market',
    rules:'1. Total = الصورة الكبرى لصحة السوق\n2. Total2 = صحة Altcoins (بدون BTC)\n3. Total3 = صحة العملات الصغيرة\n4. طبّق التحليل الفني على Total كأي أصل\n5. Total يصعد + BTC.D ينخفض = Alt Season\n6. Total ينخفض + BTC.D يرتفع = هروب لـ BTC',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,60 20,52 30,48 40,42 50,38 60,30 70,25 80,22 90,18 100,15 110,12" fill="none" stroke="#fff" stroke-width="2.5"/><line x1="10" y1="35" x2="110" y2="35" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="112" y="37" fill="#888" font-size="5" font-family="Share Tech Mono">ATH</text><text x="55" y="8" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">TOTAL MARKET CAP</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">MONEY FLOWING IN</text>'},
    {name:'Fear & Greed Index',ar:'مؤشر الخوف والطمع',rel:82,type:'SENTIMENT',
    desc:'Extreme Fear (0-25) = فرصة شراء تاريخية. Extreme Greed (75-100) = وقت الحذر والبيع الجزئي.',
    fib:'0-25: Extreme Fear — فرصة شراء تاريخية\n25-45: Fear — بداية فرص\n45-55: Neutral — لا إشارة\n55-75: Greed — حذر\n75-100: Extreme Greed — وقت البيع الجزئي\nالتحول من Fear لـ Greed = بداية صعود',
    rules:'1. Extreme Fear (< 25) = أفضل وقت للشراء تاريخياً\n2. Extreme Greed (> 75) = أفضل وقت للحذر\n3. لا تتبع الجمهور — عاكس المعنويات\n4. Fear يتصاعد = السعر قريب من القاع\n5. Greed يتصاعد = السعر قريب من القمة\n6. استخدمه كأداة توقيت وليس نظام تداول',
    svg:'<rect width="120" height="80" fill="#000"/><path d="M 60,55 L 30,55 A 30,30 0 0,1 90,55" fill="none" stroke="#888" stroke-width="1.5"/><path d="M 60,55 L 30,55 A 30,30 0 0,1 45,30" fill="rgba(255,255,255,0.08)"/><path d="M 60,55 L 75,30 A 30,30 0 0,1 90,55" fill="rgba(255,106,0,0.08)"/><line x1="60" y1="55" x2="45" y2="30" stroke="#fff" stroke-width="2.5"/><circle cx="45" cy="30" r="3" fill="#fff"/><text x="25" y="50" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">FEAR</text><text x="82" y="50" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">GREED</text><text x="60" y="68" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">BE FEARFUL WHEN GREEDY</text><text x="60" y="78" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">BE GREEDY WHEN FEARFUL</text>'},
    {name:'Correlation Coefficient',ar:'معامل الارتباط',rel:78,type:'MEASUREMENT',
    desc:'يقيس قوة واتجاه العلاقة بين أصلين. +1.0 = ترابط إيجابي كامل. -1.0 = ترابط سلبي كامل.',
    fib:'+1.0: ترابط إيجابي كامل\n+0.7 إلى +1.0: ترابط إيجابي قوي\n+0.3 إلى +0.7: ترابط إيجابي متوسط\n-0.3 إلى +0.3: لا ترابط\n-0.7 إلى -0.3: ترابط سلبي متوسط\n-1.0 إلى -0.7: ترابط سلبي قوي',
    rules:'1. +1 = يتحركان معاً بالضبط\n2. -1 = عكس بعض بالضبط\n3. 0 = لا علاقة\n4. BTC/ETH = +0.85-0.95 (قوي جداً)\n5. BTC/DXY = -0.5 إلى -0.8 (عكسي)\n6. الترابط يتغير مع الظروف — ليس ثابتاً',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="40" x2="110" y2="40" stroke="#888" stroke-width="0.5"/><line x1="60" y1="5" x2="60" y2="75" stroke="#888" stroke-width="0.5"/><rect x="62" y="10" width="44" height="12" fill="rgba(255,255,255,0.08)"/><text x="84" y="19" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">+1.0</text><rect x="62" y="34" width="22" height="12" fill="rgba(255,255,255,0.04)"/><text x="73" y="43" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">0</text><rect x="14" y="10" width="44" height="12" fill="rgba(255,106,0,0.08)"/><text x="36" y="19" text-anchor="middle" fill="#ff6a00" font-size="7" font-family="Share Tech Mono" font-weight="900">-1.0</text><text x="84" y="32" fill="#fff" font-size="5" font-family="Share Tech Mono">BTC/ETH +0.9</text><text x="14" y="32" fill="#ff6a00" font-size="5" font-family="Share Tech Mono">BTC/DXY -0.7</text><text x="60" y="60" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">BTC/GOLD +0.1</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">CORRELATION COEFFICIENT</text>'},
    {name:'Inter-Market Analysis Framework',ar:'إطار التحليل بين الأسواق',rel:85,type:'COMPLETE FRAMEWORK',
    desc:'إطار شامل للتحليل الكلي قبل أي صفقة. إذا 5+ من 7 إيجابية = بيئة شراء. إذا 5+ سلبية = بيئة بيع أو انتظار.',
    fib:'1. DXY: هابط = إيجابي ✓ | صاعد = سلبي ✗\n2. S&P/Nasdaq: صاعد = إيجابي ✓\n3. Total Market Cap: صاعد = إيجابي ✓\n4. BTC: صاعد = إيجابي ✓\n5. BTC.D: ينخفض = Alt Season ✓\n6. ETH/BTC: يرتفع = Alts قوية ✓\n7. Fear & Greed: < 45 = فرصة ✓ | > 75 = حذر ✗',
    rules:'1. حلل من الكبير للصغير: DXY → Stocks → Total → BTC → Alts\n2. 5/7 إيجابي = بيئة شراء\n3. 5/7 سلبي = بيئة بيع أو انتظار\n4. لا تتداول ضد الصورة الكبرى أبداً\n5. أعد التحليل أسبوعياً على الأقل\n6. هذا الإطار يحميك من الأخطاء الكبرى',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="8" width="28" height="14" fill="rgba(255,106,0,0.08)" stroke="#ff6a00" stroke-width="0.8"/><text x="22" y="18" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">DXY</text><rect x="40" y="8" width="28" height="14" fill="rgba(255,255,255,0.05)" stroke="#fff" stroke-width="0.8"/><text x="54" y="18" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">S&P</text><rect x="72" y="8" width="40" height="14" fill="rgba(255,255,255,0.05)" stroke="#fff" stroke-width="0.8"/><text x="92" y="18" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">TOTAL</text><rect x="20" y="28" width="30" height="14" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1"/><text x="35" y="38" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">BTC</text><rect x="55" y="28" width="30" height="14" fill="rgba(255,106,0,0.05)" stroke="#ff6a00" stroke-width="0.8"/><text x="70" y="38" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC.D</text><rect x="30" y="48" width="35" height="14" fill="rgba(255,106,0,0.05)" stroke="#ff6a00" stroke-width="0.8"/><text x="48" y="58" text-anchor="middle" fill="#ff6a00" font-size="6" font-family="Share Tech Mono" font-weight="900">ETH/BTC</text><rect x="70" y="48" width="35" height="14" fill="rgba(255,255,255,0.05)" stroke="#888" stroke-width="0.8"/><text x="88" y="58" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono" font-weight="900">F&G</text><text x="55" y="75" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">5/7 POSITIVE = BUY</text>'}
  ]}
};

function mcRender(){
  var cat=mcData[mcCurrentCat];
  if(!cat) return;
  var el=document.getElementById('mc-content');
  if(mcSelectedIdx>=0 && mcSelectedIdx<cat.patterns.length){
    el.innerHTML=mcRenderDetail(cat.patterns[mcSelectedIdx]);
    return;
  }
  var h='<div class="mc-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    var isBear=p.type&&(p.type.indexOf('INVERSE')>=0||p.type.indexOf('NEGATIVE')>=0);
    var topC=isBear?'var(--o)':'#fff';
    h+='<div class="mc-card" style="border-top:3px solid '+topC+'" onclick="mcSelect('+i+')">';
    h+='<div class="mc-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
    h+='<div class="mc-card-name">'+p.name+'</div><div class="mc-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="mc-card-type">'+p.type+'</div>';
    h+='<div class="mc-card-rel-row"><span class="mc-card-rel-l">IMPORTANCE</span><span class="mc-card-rel-v" style="color:'+(p.rel>=80?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="mc-card-bar"><div class="mc-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=80?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="mc-footer">الترابط بين الأسواق هو السياق الكبير الذي يحدد نجاح أو فشل أي صفقة. لا تتداول الكريبتو بمعزل عن العالم — DXY والفيدرالي والأسهم الأمريكية تؤثر بشكل مباشر. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function mcRenderDetail(p){
  var h='<div class="mc-back" onclick="mcBack()">رجوع</div><div class="mc-detail">';
  h+='<div class="mc-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
  h+='<div class="mc-detail-name">'+p.name+'</div><div class="mc-detail-ar">'+p.ar+'</div>';
  if(p.type) h+='<div class="mc-detail-badge">'+p.type+'</div>';
  h+='<div class="mc-detail-rel-row"><span class="mc-detail-rel-l">IMPORTANCE</span><span class="mc-detail-rel-v" style="color:'+(p.rel>=80?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="mc-detail-bar"><div class="mc-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=80?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="mc-detail-desc-wrap"><div class="mc-detail-desc-label">DESCRIPTION // الوصف</div><div class="mc-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="mc-detail-fib-wrap"><div class="mc-detail-fib-label">SIGNALS & DATA // الإشارات والبيانات</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="mc-fib-row"><span class="mc-fib-arrow">▶</span><span class="mc-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="mc-detail-rules-wrap"><div class="mc-detail-rules-label">RULES // القواعد</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="mc-rule-row"><span class="mc-rule-num">'+r[i].substring(0,2)+'</span><span class="mc-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

/* =====================================================================
   RISK & PSYCHOLOGY GUIDE ENGINE - 360° PLATFORM
===================================================================== */
var rpCurrentCat='sizing';
var rpSelectedIdx=-1;

function rpSetCat(cat,btn){
  rpCurrentCat=cat; rpSelectedIdx=-1;
  var b=document.querySelectorAll('.rp-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('rp-cat-active');
  btn.classList.add('rp-cat-active');
  rpRender();
}

function rpSelect(idx){ rpSelectedIdx=idx; rpRender(); }
function rpBack(){ rpSelectedIdx=-1; rpRender(); }

function rpInit(){
  var h='';
  var k=Object.keys(rpData);
  for(var i=0;i<k.length;i++){
    var c=rpData[k[i]];
    h+='<button class="rp-cat-btn'+(k[i]===rpCurrentCat?' rp-cat-active':'')+'" onclick="rpSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('rp-cat-tabs').innerHTML=h;
  rpRender();
}

var rpData={
  sizing:{en:'POSITION SIZING',label:'حجم الصفقة',patterns:[
    {name:'The 1-2% Rule',ar:'قاعدة 1-2% — أساس البقاء',rel:98,type:'GOLDEN RULE',
    desc:'أهم قاعدة في التداول على الإطلاق — لا تخاطر بأكثر من 1-2% من رأس مالك في أي صفقة واحدة. القاعدة تحميك من الانفجار (Blowing Up) وتضمن بقاءك في السوق طويلاً كفاية لتتعلم وتربح.',
    fib:'رأس مال $10,000:\n1% Risk = $100 خسارة قصوى لكل صفقة\n2% Risk = $200 خسارة قصوى لكل صفقة\n50 خسارة متتالية بـ 2% = لا تزال عندك 36% من رأس المال\n10 خسائر متتالية بـ 10% = خسرت 65% (كارثة)\nالمحترفون: 0.5%-1% فقط',
    rules:'1. لا تخاطر بأكثر من 1-2% من رأس مالك في أي صفقة\n2. هذه القاعدة غير قابلة للتفاوض — بدونها ستخسر\n3. احسب حجم الصفقة من وقف الخسارة وليس العكس\n4. المبتدئ: 1% | المتوسط: 1.5% | المحترف: 0.5-1%\n5. 50 خسارة متتالية بـ 2% = لا تزال حياً\n6. القاعدة = البقاء. البقاء = فرصة الربح',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="15" y="12" width="90" height="18" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="1.5"/><text x="60" y="24" text-anchor="middle" fill="#fff" font-size="14" font-family="Share Tech Mono" font-weight="900">1-2% MAX</text><text x="60" y="42" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">PER TRADE RISK</text><text x="60" y="55" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">$10,000 CAPITAL</text><text x="60" y="63" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono">MAX LOSS = $100-$200</text><text x="60" y="75" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">SURVIVE FIRST — PROFIT SECOND</text>'},
    {name:'Position Size Calculator',ar:'حساب حجم الصفقة',rel:95,type:'CALCULATION',
    desc:'حجم الصفقة يُحسب من 3 عوامل: رأس المال + نسبة المخاطرة + المسافة لوقف الخسارة. الصيغة: Position Size = (رأس المال × نسبة المخاطرة) / (سعر الدخول - سعر وقف الخسارة).',
    fib:'الصيغة: Size = (Capital × Risk%) / (Entry - SL)\nمثال: $10,000 × 2% = $200 مخاطرة\nEntry: $60,000 | SL: $58,500 | Distance: $1,500\nSize = $200 / $1,500 = 0.133 BTC ($8,000)\nخسارة قصوى = $200 (2% فقط)\nالحجم يتغير حسب مسافة SL — كلما بعُد SL صغُرت الصفقة',
    rules:'1. احسب المخاطرة أولاً: Capital × Risk% = $ Risk\n2. حدد SL من التحليل الفني\n3. احسب المسافة: Entry - SL = Distance\n4. Size = $ Risk / Distance\n5. كلما بعُد SL = صفقة أصغر\n6. لا تعكس الحساب — لا تُكبّر الصفقة لتناسب الربح',
    svg:'<rect width="120" height="80" fill="#000"/><text x="60" y="12" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">POSITION SIZE FORMULA</text><text x="60" y="28" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">Capital × Risk%</text><line x1="25" y1="32" x2="95" y2="32" stroke="#fff" stroke-width="1.5"/><text x="60" y="42" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">Entry - Stop Loss</text><line x1="10" y1="48" x2="110" y2="48" stroke="#111" stroke-width="0.5"/><text x="8" y="58" fill="#888" font-size="5" font-family="Share Tech Mono">$10K × 2%</text><text x="60" y="58" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">= $200</text><text x="8" y="68" fill="#888" font-size="5" font-family="Share Tech Mono">$200 / $1,500</text><text x="60" y="68" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">= 0.133 BTC</text><text x="60" y="78" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">MAX LOSS = $200 (2%)</text>'},
    {name:'Risk/Reward Ratio (R:R)',ar:'نسبة المخاطرة للمكافأة',rel:92,type:'TRADE QUALITY',
    desc:'R:R تقيس جودة الصفقة — كم تربح مقابل كل دولار تخاطر به. القاعدة: لا تدخل صفقة R:R أقل من 1:2. R:R يعني أنك لا تحتاج نسبة نجاح عالية — فقط صفقات ذات جودة.',
    fib:'1:1 = تخاطر بـ $1 لتربح $1 (ضعيف)\n1:2 = تخاطر بـ $1 لتربح $2 (الحد الأدنى المقبول)\n1:3 = تخاطر بـ $1 لتربح $3 (جيد)\n1:5 = تخاطر بـ $1 لتربح $5 (ممتاز)\nبـ R:R 1:3 + نسبة نجاح 40% = أنت رابح\nالمحترفون لا يدخلون تحت 1:2',
    rules:'1. لا تدخل صفقة R:R أقل من 1:2\n2. R:R = (Target - Entry) / (Entry - SL)\n3. R:R 1:3 مع 40% نجاح = رابح على المدى الطويل\n4. حدد SL وTP قبل الدخول — ليس بعده\n5. R:R الحقيقي أهم من نسبة النجاح\n6. صفقة واحدة 1:5 تعوّض 5 خسائر',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="60" y1="15" x2="60" y2="70" stroke="#888" stroke-width="0.5"/><rect x="20" y="40" width="35" height="25" fill="rgba(255,106,0,0.1)" stroke="var(--o)" stroke-width="1"/><rect x="65" y="10" width="35" height="55" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="1"/><text x="38" y="56" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">RISK</text><text x="38" y="64" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">1x</text><text x="82" y="42" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">REWARD</text><text x="82" y="52" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">3x</text><text x="60" y="78" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono" font-weight="900">R:R = 1:3</text>'},
    {name:'Maximum Drawdown & Recovery',ar:'الحد الأقصى للخسارة والتعافي',rel:90,type:'SURVIVAL',
    desc:'التعافي من الخسارة يحتاج نسبة ربح أكبر من نسبة الخسارة. خسارة 50% تحتاج 100% للتعافي. لذلك الحماية من الخسارة الكبيرة أهم بكثير من تحقيق أرباح كبيرة.',
    fib:'خسارة 10% → تحتاج +11% للتعافي\nخسارة 20% → تحتاج +25%\nخسارة 30% → تحتاج +43%\nخسارة 50% → تحتاج +100% (مضاعفة!)\nخسارة 75% → تحتاج +300%\nخسارة 90% → تحتاج +900% (شبه مستحيل)',
    rules:'1. التعافي من الخسارة أصعب رياضياً من تحقيقها\n2. الحد الأقصى المقبول: 20-25% Drawdown\n3. إذا وصلت 25% Drawdown = توقف وراجع نظامك\n4. قاعدة 1-2% تحمي من Drawdown الكارثي\n5. حماية رأس المال أولوية رقم 1 — قبل الربح\n6. خسارة 50% تحتاج مضاعفة رأس المال للتعافي',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,20 25,18 35,15 45,12 52,15 58,20 62,28 65,35 68,40 72,38 78,42 82,48 86,52 90,48 95,45 100,42 108,38" fill="none" stroke="#fff" stroke-width="2"/><line x1="45" y1="12" x2="110" y2="12" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="45" y1="12" x2="86" y2="52" stroke="var(--o)" stroke-width="1" stroke-dasharray="3,3"/><text x="65" y="30" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">DRAWDOWN</text><text x="95" y="10" fill="#888" font-size="5" font-family="Share Tech Mono">PEAK</text><text x="88" y="58" fill="var(--o)" font-size="5" font-family="Share Tech Mono">VALLEY</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">-50% NEEDS +100% TO RECOVER</text>'},
    {name:'Portfolio Allocation',ar:'توزيع المحفظة',rel:85,type:'DIVERSIFICATION',
    desc:'لا تضع كل البيض في سلة واحدة. لا تتداول بأكثر من 5% من المحفظة في صفقة واحدة. التوزيع يتغير حسب ظروف السوق للحفاظ على الاستقرار.',
    fib:'BTC: 40-50% (الأساس والأمان)\nETH: 20-30% (ثاني أقوى)\nLarge Cap Alts: 15-20% (تنويع)\nSmall Cap: 5-10% (مخاطرة عالية/عائد عالي)\nStablecoins: 5-10% (سيولة للفرص)\nإجمالي مراكز مفتوحة: لا تتجاوز 30%',
    rules:'1. 40-50% BTC = الأساس الآمن\n2. لا تضع أكثر من 5% في عملة واحدة صغيرة\n3. احتفظ بـ 5-10% Stablecoins للفرص المفاجئة\n4. إجمالي المراكز المفتوحة لا يتجاوز 30%\n5. أعد التوزيع كل شهر أو عند تغير ظروف السوق\n6. في Bear Market: زد BTC والـ Stablecoins وقلل الصغيرة',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="10" width="45" height="28" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1"/><text x="32" y="27" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">BTC 45%</text><rect x="58" y="10" width="30" height="28" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="0.8"/><text x="73" y="27" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">ETH 25%</text><rect x="91" y="10" width="22" height="28" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.5"/><text x="102" y="22" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">ALTS</text><text x="102" y="30" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">20%</text><rect x="10" y="42" width="52" height="14" fill="rgba(255,255,255,0.03)" stroke="#555" stroke-width="0.5"/><text x="36" y="52" text-anchor="middle" fill="#555" font-size="6" font-family="Share Tech Mono">STABLECOINS 10%</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">DIVERSIFY — NEVER ALL IN</text>'}
  ]},
  psychology:{en:'PSYCHOLOGY',label:'علم نفس التداول',patterns:[
    {name:'FOMO — Fear of Missing Out',ar:'الخوف من فوات الفرصة',rel:92,type:'ENEMY #1',
    desc:'أخطر عدو للمتداول. FOMO يحدث عندما ترى عملة ترتفع بقوة فتشتري بدون تحليل خوفاً من فوات الربح. النتيجة غالباً: تشتري في القمة وتخسر.',
    fib:'FOMO يؤدي لـ: الشراء في القمة\nالشراء بدون تحليل أو خطة\nتجاهل وقف الخسارة\nتكبير حجم الصفقة (طمع)\nالتداول العاطفي بدلاً من المنطقي\nالنتيجة: خسائر متكررة وكبيرة',
    rules:'1. إذا فاتتك الحركة — لا تلاحقها أبداً\n2. كل فرصة فاتت = فرصة جديدة قادمة\n3. السوق يعمل 24/7 — الفرص لا تنتهي\n4. انتظر التصحيح ثم ادخل بخطة\n5. اسأل نفسك: هل أشتري بسبب تحليل أم بسبب خوف؟\n6. إذا الجواب خوف = لا تشتري',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,65 20,58 30,50 40,42 50,35 60,25 70,18 80,12 85,10" fill="none" stroke="#fff" stroke-width="2"/><circle cx="85" cy="10" r="6" fill="none" stroke="var(--o)" stroke-width="2"/><text x="85" y="13" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">BUY</text><polyline points="85,10 90,18 95,28 100,40 108,55" fill="none" stroke="var(--o)" stroke-width="2"/><text x="100" y="62" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">LOSS</text><text x="45" y="75" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">BOUGHT THE TOP</text>'},
    {name:'FUD — Fear, Uncertainty, Doubt',ar:'الخوف وعدم اليقين والشك',rel:88,type:'PANIC SELLING',
    desc:'عكس FOMO — FUD يدفعك للبيع في القاع خوفاً من مزيد من الخسارة. الخوف ليس سبب للبيع — فقط ضرب مستوى الوقف SL هو السبب الاقتصادي العقلاني.',
    fib:'FUD يؤدي لـ: البيع في القاع (Capitulation)\nالبيع بذعر بدون تحليل\nإلغاء صفقات رابحة مبكراً\nالخروج من السوق في أسوأ وقت\nFUD غالباً مُصنّع من المؤسسات\nبعد FUD الشديد: غالباً ارتداد قوي',
    rules:'1. لا تبيع بسبب الخوف — فقط بسبب ضرب SL\n2. إذا تحليلك صحيح ولم يُضرب SL = ابقَ\n3. FUD الشديد = غالباً فرصة شراء\n4. أغلق الأخبار ووسائل التواصل أثناء الهبوط\n5. FUD مُصنّع = المؤسسات تشتري أصولك\n6. القاع يتشكل عندما الجميع يائس',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,15 20,22 30,30 40,38 50,45 60,55 70,62 80,68 85,72" fill="none" stroke="var(--o)" stroke-width="2"/><circle cx="85" cy="72" r="6" fill="none" stroke="#fff" stroke-width="2"/><text x="85" y="74" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">SELL</text><polyline points="85,72 90,65 95,55 100,42 108,25" fill="none" stroke="#fff" stroke-width="2"/><text x="100" y="20" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">MISS</text><text x="45" y="78" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">SOLD THE BOTTOM</text>'},
    {name:'Revenge Trading',ar:'التداول الانتقامي',rel:90,type:'DESTROYER',
    desc:'بعد خسارة صفقة يريد المتداول تعويض الخسارة فوراً. سلسلة خسائر متصاعدة تُدمر الحساب. الحل الوحيد: بعد كل خسارة توقف وأغلق المنصة.',
    fib:'خسارة → غضب → صفقة انتقامية → خسارة أكبر\nالحجم يتضاعف مع كل محاولة تعويض\n3-4 صفقات انتقامية = خسارة 10-20% من الحساب\nالسبب: الأنا ترفض قبول الخسارة\nالحل: توقف فوراً بعد أي خسارة\nقاعدة: حد أقصى 3 خسائر متتالية = توقف لليوم',
    rules:'1. بعد كل خسارة: توقف — لا تدخل صفقة فوراً\n2. خذ استراحة ساعة على الأقل\n3. حد أقصى 3 خسائر في اليوم = أغلق المنصة\n4. لا تُضاعف الحجم لتعويض الخسارة أبداً\n5. الخسارة جزء طبيعي — 40% من الصفقات خاسرة\n6. المتداول الناجح يقبل الخسارة ويمضي',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="30" width="18" height="15" fill="rgba(255,106,0,0.15)" stroke="var(--o)" stroke-width="1"/><text x="19" y="40" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">-$100</text><rect x="32" y="22" width="18" height="25" fill="rgba(255,106,0,0.2)" stroke="var(--o)" stroke-width="1"/><text x="41" y="38" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">-$300</text><rect x="54" y="12" width="18" height="38" fill="rgba(255,106,0,0.3)" stroke="var(--o)" stroke-width="1"/><text x="63" y="35" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">-$700</text><rect x="76" y="5" width="18" height="48" fill="rgba(255,106,0,0.4)" stroke="var(--o)" stroke-width="1.5"/><text x="85" y="32" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">-$1500</text><text x="55" y="68" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">REVENGE SPIRAL</text><text x="55" y="78" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">STOP AFTER LOSS — ALWAYS</text>'},
    {name:'Overtrading',ar:'الإفراط في التداول',rel:85,type:'SILENT KILLER',
    desc:'فتح صفقات كثيرة بدون فرص حقيقية. 20 صفقة في اليوم تعني دفع تكاليف وهامش بدون فائدة. حدد عدد صفقات يومي (3-5 كحد أقصى).',
    fib:'المبتدئ: 10-20 صفقة يومياً (كثير جداً)\nالمحترف: 2-5 صفقات يومياً فقط\nكل صفقة = عمولة + سبريد + ضغط نفسي\n20 صفقة × $5 عمولة = $100/يوم = $2,000/شهر\nيوم بدون صفقات = يوم ناجح\nالجودة أهم بكثير من الكمية',
    rules:'1. حد أقصى 3-5 صفقات في اليوم\n2. لا تتداول بدون Setup واضح ومحدد\n3. الملل ليس سبب للتداول\n4. يوم بدون صفقات = يوم ناجح (لم تخسر)\n5. الجودة > الكمية دائماً\n6. خطة تداول واضحة تمنع Overtrading',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="15" x2="10" y2="65" stroke="#888" stroke-width="0.5"/><line x1="10" y1="65" x2="110" y2="65" stroke="#888" stroke-width="0.5"/><rect x="15" y="20" width="8" height="45" fill="var(--o)" opacity="0.8"/><rect x="26" y="25" width="8" height="40" fill="var(--o)" opacity="0.7"/><rect x="37" y="30" width="8" height="35" fill="var(--o)" opacity="0.6"/><rect x="48" y="35" width="8" height="30" fill="var(--o)" opacity="0.5"/><rect x="59" y="40" width="8" height="25" fill="var(--o)" opacity="0.4"/><rect x="70" y="45" width="8" height="20" fill="var(--o)" opacity="0.3"/><text x="15" y="15" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">20 TRADES</text><text x="70" y="15" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">3 TRADES</text><rect x="85" y="35" width="8" height="30" fill="#fff" opacity="0.8"/><rect x="96" y="30" width="8" height="35" fill="#fff" opacity="0.9"/><text x="55" y="78" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">LESS = MORE PROFIT</text>'}
  ]},
 discipline:{en:'DISCIPLINE',label:'الانضباط والخطة',patterns:[
    {name:'Trading Plan',ar:'خطة التداول — الأساس',rel:95,type:'MUST HAVE',
    desc:'بدون خطة تداول مكتوبة أنت مُقامر وليس متداول. الخطة تُحدد: ماذا تتداول، متى تدخل، أين SL وTP. الخطة تُزيل العاطفة من التداول.',
    fib:'عناصر الخطة:\n1. الأصول المسموح تداولها\n2. الفريمات الزمنية\n3. شروط الدخول (Setup محدد)\n4. نسبة المخاطرة (1-2%)\n5. R:R الأدنى المقبول (1:2+)\n6. حد الخسائر اليومي\n7. أيام عدم التداول',
    rules:'1. اكتب خطتك قبل أن تبدأ التداول\n2. لا تتداول أي شيء خارج الخطة\n3. الخطة تُزيل العاطفة — تتبع القواعد فقط\n4. راجع الخطة أسبوعياً وعدّلها حسب النتائج\n5. إذا كسرت قاعدة من الخطة = توقف لليوم\n6. الخطة ليست ثابتة — تتطور مع خبرتك',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="15" y="8" width="90" height="64" fill="rgba(255,255,255,0.03)" stroke="#fff" stroke-width="1"/><text x="60" y="18" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">TRADING PLAN</text><line x1="20" y1="22" x2="100" y2="22" stroke="#888" stroke-width="0.5"/><text x="60" y="32" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">1. WHAT TO TRADE</text><text x="60" y="40" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">2. ENTRY RULES</text><text x="60" y="48" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">3. SL &amp; TP RULES</text><text x="60" y="56" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">4. RISK: 1-2%</text><text x="60" y="64" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">5. MAX 3 LOSSES/DAY</text>'},
    {name:'Trading Journal',ar:'دفتر التداول — مرآتك',rel:90,type:'IMPROVEMENT',
    desc:'يُسجل كل صفقة بالتفصيل: تاريخ الدخول والخروج، السبب، حجم الصفقة، النتيجة. الدفتر يُحوّل التداول من تخمين لعلم اقتصادي متوازن.',
    fib:'سجّل لكل صفقة:\n- التاريخ والوقت\n- الأصل والفريم\n- سبب الدخول\n- حجم الصفقة والمخاطرة\n- SL و TP\n- النتيجة + لقطة شاشة\n- الحالة النفسية والدروس',
    rules:'1. سجّل كل صفقة بدون استثناء\n2. راجع الدفتر أسبوعياً على الأقل\n3. بعد 50 صفقة: حلل الأنماط في نتائجك\n4. حدد أقوى Setups وركّز عليها\n5. حدد أكبر أخطاءك المتكررة وعالجها\n6. الدفتر = أداة التحسين المستمر',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="12" y="8" width="96" height="64" fill="rgba(255,255,255,0.03)" stroke="#888" stroke-width="0.8"/><line x1="12" y1="20" x2="108" y2="20" stroke="#888" stroke-width="0.5"/><line x1="40" y1="8" x2="40" y2="72" stroke="#888" stroke-width="0.5"/><line x1="70" y1="8" x2="70" y2="72" stroke="#888" stroke-width="0.5"/><text x="26" y="16" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">TRADE</text><text x="55" y="16" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">P/L</text><text x="90" y="16" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">LESSON</text><text x="26" y="30" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">BTC Long</text><text x="55" y="30" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">+$320</text><text x="26" y="40" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">ETH Short</text><text x="55" y="40" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">-$150</text><text x="26" y="50" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">SOL Long</text><text x="55" y="50" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">+$480</text>'},
    {name:'When NOT to Trade',ar:'متى لا تتداول',rel:88,type:'PROTECTION',
    desc:'معرفة متى لا تتداول أهم من معرفة متى تتداول. عدم التداول = ربح لأنك لم تخسر. المحترفون يقضون 80% من وقتهم ينتظرون.',
    fib:'لا تتداول:\n- قبل/أثناء الأحداث والأخبار الكبرى\n- بعد 3 خسائر متتالية\n- متعب/مريض/منزعج\n- سوق جانبي (Chop)\n- لا يوجد Setup واضح\n- 80% انتظار + 20% تداول = محترف',
    rules:'1. أوقات الأخبار الكبرى = لا تداول\n2. 3 خسائر = توقف لليوم\n3. متعب/منزعج = لا تفتح المنصة\n4. سوق جانبي = انتظر الكسر\n5. لا Setup = لا صفقة (الملل ليس سبب)\n6. عدم التداول = ربح (لم تخسر)',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="20" y1="15" x2="50" y2="45" stroke="var(--o)" stroke-width="3"/><line x1="20" y1="45" x2="50" y2="15" stroke="var(--o)" stroke-width="3"/><text x="60" y="22" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">NO NEWS TRADE</text><text x="60" y="32" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">NO 3 LOSSES</text><text x="60" y="42" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">NO TIRED</text><text x="60" y="52" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">NO CHOP</text><text x="60" y="62" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">NO BOREDOM</text><text x="55" y="78" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">NOT TRADING = WINNING</text>'}
  ]}
};

function rpRender(){
  var cat=rpData[rpCurrentCat];
  if(!cat) return;
  var el=document.getElementById('rp-content');
  if(rpSelectedIdx>=0 && rpSelectedIdx<cat.patterns.length){
    el.innerHTML=rpRenderDetail(cat.patterns[rpSelectedIdx]);
    return;
  }
  var h='<div class="rp-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    var isDanger=p.type&&(p.type.indexOf('ENEMY')>=0||p.type.indexOf('DESTROY')>=0||p.type.indexOf('KILLER')>=0||p.type.indexOf('PANIC')>=0);
    var topC=isDanger?'var(--o)':'#fff';
    h+='<div class="rp-card" style="border-top:3px solid '+topC+'" onclick="rpSelect('+i+')">';
    h+='<div class="rp-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
    h+='<div class="rp-card-name">'+p.name+'</div><div class="rp-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="rp-card-type">'+p.type+'</div>';
    h+='<div class="rp-card-rel-row"><span class="rp-card-rel-l">IMPORTANCE</span><span class="rp-card-rel-v" style="color:'+(p.rel>=80?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="rp-card-bar"><div class="rp-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=80?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="rp-footer">إدارة المخاطر وعلم النفس هما الفرق الحاسم بين المتداول العقلاني والمقامر. التحليل الفني بدون إدارة مخاطر هو مقامرة عشوائية. الالتزام بالاستراتيجية والانضباط النفسي هما أساس البقاء. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function rpRenderDetail(p){
  var h='<div class="rp-back" onclick="rpBack()">رجوع</div><div class="rp-detail">';
  h+='<div class="rp-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
  h+='<div class="rp-detail-name">'+p.name+'</div><div class="rp-detail-ar">'+p.ar+'</div>';
  if(p.type){
    var bc=p.type.indexOf('ENEMY')>=0||p.type.indexOf('DESTROY')>=0||p.type.indexOf('KILLER')>=0||p.type.indexOf('PANIC')>=0?'var(--o)':'#fff';
    h+='<div class="rp-detail-badge" style="background:'+bc+';color:#000">'+p.type+'</div>';
  }
  h+='<div class="rp-detail-rel-row"><span class="rp-detail-rel-l">IMPORTANCE</span><span class="rp-detail-rel-v" style="color:'+(p.rel>=80?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="rp-detail-bar"><div class="rp-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=80?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="rp-detail-desc-wrap"><div class="rp-detail-desc-label">DESCRIPTION // الوصف</div><div class="rp-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="rp-detail-fib-wrap"><div class="rp-detail-fib-label">KEY DATA // البيانات والأرقام</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="rp-fib-row"><span class="rp-fib-arrow">▶</span><span class="rp-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="rp-detail-rules-wrap"><div class="rp-detail-rules-label">RULES // القواعد</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="rp-rule-row"><span class="rp-rule-num">'+r[i].substring(0,2)+'</span><span class="rp-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}


/* =====================================================================
   MACRO ECONOMICS GUIDE ENGINE - 360° PLATFORM
===================================================================== */
var maCurrentCat='inflation';
var maSelectedIdx=-1;

function maSetCat(cat,btn){
  maCurrentCat=cat; maSelectedIdx=-1;
  var b=document.querySelectorAll('.ma-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('ma-cat-active');
  btn.classList.add('ma-cat-active');
  maRender();
}

function maSelect(idx){ maSelectedIdx=idx; maRender(); }
function maBack(){ maSelectedIdx=-1; maRender(); }

function maInit(){
  var h='';
  var k=Object.keys(maData);
  for(var i=0;i<k.length;i++){
    var c=maData[k[i]];
    h+='<button class="ma-cat-btn'+(k[i]===maCurrentCat?' ma-cat-active':'')+'" onclick="maSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('ma-cat-tabs').innerHTML=h;
  maRender();
}

var maData={
  inflation:{en:'INFLATION & FED',label:'التضخم والفيدرالي',patterns:[
    {name:'CPI — Consumer Price Index',ar:'مؤشر أسعار المستهلك (التضخم)',rel:95,type:'HIGHEST IMPACT',
    desc:'أهم بيانة اقتصادية تُؤثر على الكريبتو. CPI يقيس التغير في أسعار سلة من السلع والخدمات التي يشتريها المستهلك العادي — يُعبّر عن التضخم. الأسواق تتحرك بناءً على المفاجأة: الفرق بين الفعلي والمتوقع هو ما يُحرّك السعر وليس الرقم نفسه.',
    fib:'CPI > متوقع: تضخم مرتفع → BTC يهبط\nCPI < متوقع: تضخم ينخفض → BTC يصعد\nCPI = متوقع: تأثير محدود\nCore CPI أهم من Headline CPI\nالهدف: 2% سنوياً (هدف الفيدرالي)\nفوق 5%: تضخم خطير → سياسة متشددة',
    rules:'1. CPI أعلى من المتوقع = هبوط فوري للكريبتو\n2. CPI أقل من المتوقع = صعود فوري\n3. Core CPI أهم من Headline (أقل تقلباً)\n4. المفاجأة تُحرّك السوق وليس الرقم المطلق\n5. لا تفتح صفقات قبل CPI — انتظر النتيجة\n6. تأثير CPI يستمر لأيام وليس دقائق فقط',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,60 20,55 30,52 40,48 50,42 58,38 65,32 72,28 78,25 85,30 92,35 100,32 108,28" fill="none" stroke="var(--o)" stroke-width="2"/><line x1="10" y1="35" x2="110" y2="35" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="112" y="37" fill="#888" font-size="5" font-family="Share Tech Mono">2% TARGET</text><text x="60" y="12" text-anchor="middle" fill="var(--o)" font-size="10" font-family="Share Tech Mono" font-weight="900">CPI</text><text x="60" y="22" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">INFLATION RATE</text><text x="60" y="75" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">CPI UP = CRYPTO DOWN</text>'},
    {name:'Federal Reserve Decisions (FOMC)',ar:'قرارات الفيدرالي الأمريكي',rel:98,type:'MARKET MOVER #1',
    desc:'الاحتياطي الفيدرالي هو أقوى مؤسسة تُؤثر على الأسواق العالمية. Rate Hike (رفع): يُغلي تكلفة الاقتراض → سيولة تنكمش → أصول خطرة تهبط. Rate Cut (خفض): سيولة تتوسع → أصول خطرة تصعد. الأسواق تُسعّر المستقبل وليس الحاضر.',
    fib:'Rate Hike (+25bps): BTC يهبط 3-8% عادة\nRate Cut (-25bps): BTC يصعد 5-15%\nRate Hold: يعتمد على التصريحات\nHawkish Tone: لهجة متشددة → هبوط\nDovish Tone: لهجة مُيسّرة → صعود\nDot Plot: توقعات الفائدة المستقبلية — الأهم',
    rules:'1. لا تفتح صفقات كبيرة يوم FOMC — تقلب حاد\n2. القرار نفسه أقل أهمية من التصريحات اللاحقة\n3. Hawkish = سلبي للكريبتو | Dovish = إيجابي\n4. Dot Plot يُسعّر الأشهر القادمة — راقبه\n5. السوق يُسعّر التوقعات مسبقاً — المفاجأة هي ما يُحرّك\n6. أول رد فعل بعد القرار غالباً خاطئ — انتظر 30 دقيقة',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="20" y="10" width="80" height="25" fill="rgba(255,106,0,0.08)" stroke="var(--o)" stroke-width="1.5"/><text x="60" y="20" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">FEDERAL</text><text x="60" y="30" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">RESERVE</text><text x="30" y="50" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">RATE CUT</text><text x="30" y="58" fill="#fff" font-size="6" font-family="Share Tech Mono">BTC UP</text><text x="75" y="50" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">RATE HIKE</text><text x="75" y="58" fill="var(--o)" font-size="6" font-family="Share Tech Mono">BTC DOWN</text><line x1="60" y1="40" x2="60" y2="65" stroke="#888" stroke-width="0.5"/><text x="60" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">8 MEETINGS / YEAR</text>'},
    {name:'PPI — Producer Price Index',ar:'مؤشر أسعار المنتجين',rel:80,type:'LEADING INDICATOR',
    desc:'PPI يقيس التغير في أسعار السلع والخدمات من منظور المُنتج (المصنع) وليس المستهلك. يُعتبر مؤشر استباقي (Leading) للتضخم الاستهلاكي (CPI) لأن ارتفاع تكاليف الإنتاج يُنقل لاحقاً للمستهلك.',
    fib:'PPI > متوقع: تضخم إنتاجي → CPI سيرتفع لاحقاً\nPPI < متوقع: ضغوط أسعار تتراجع → إيجابي\nPPI يسبق CPI بـ 1-3 أشهر\nCore PPI أهم من Headline\nتأثير مباشر أقل من CPI لكنه تحذيري\nيصدر شهرياً قبل CPI',
    rules:'1. PPI مؤشر استباقي للتضخم — يسبق CPI\n2. PPI يرتفع = توقع ارتفاع CPI لاحقاً\n3. Core PPI (بدون غذاء وطاقة) أهم\n4. تأثير مباشر أقل من CPI على الكريبتو\n5. استخدمه لتوقع اتجاه التضخم المستقبلي\n6. PPI + CPI يهبطان معاً = بيئة مثالية للكريبتو',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 25,48 40,42 55,38 70,35 85,30 100,26" fill="none" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="4,3"/><polyline points="20,58 35,52 50,46 65,42 80,38 95,34 110,30" fill="none" stroke="#fff" stroke-width="2"/><text x="102" y="24" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">PPI</text><text x="112" y="32" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">CPI</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">PPI LEADS CPI BY 1-3 MONTHS</text><line x1="70" y1="35" x2="95" y2="34" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/>'},
    {name:'PCE — Personal Consumption Expenditures',ar:'مؤشر نفقات الاستهلاك الشخصي',rel:85,type:'FED PREFERRED',
    desc:'PCE هو مقياس التضخم المُفضل لدى الفيدرالي — أهم من CPI في نظر صُنّاع القرار. يتكيف مع تغير سلوك المستهلك. Core PCE (بدون غذاء وطاقة) هو الرقم الذي يستخدمه الفيدرالي لتحديد سياسته.',
    fib:'Core PCE > 2%: الفيدرالي يميل للتشديد\nCore PCE = 2%: الهدف المثالي\nCore PCE < 2%: الفيدرالي يميل للتيسير\nPCE أكثر دقة من CPI لكن أقل تأثيراً فورياً\nالفيدرالي يعتمد على PCE في قراراته\nيصدر بعد CPI بأسبوعين',
    rules:'1. Core PCE هو مقياس التضخم المُفضل للفيدرالي\n2. فوق 2% = الفيدرالي لن يخفض الفائدة\n3. تحت 2% = باب مفتوح لخفض الفائدة\n4. أقل تقلباً من CPI = صورة أوضح للتضخم\n5. يصدر بعد CPI — تأثير فوري أقل\n6. اتجاه PCE أهم من رقم شهر واحد',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="25" y="12" width="70" height="20" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="1"/><text x="60" y="25" text-anchor="middle" fill="var(--o)" font-size="9" font-family="Share Tech Mono" font-weight="900">CORE PCE</text><text x="60" y="42" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">FED TARGET: 2%</text><line x1="20" y1="52" x2="100" y2="52" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="35" y="62" fill="#fff" font-size="6" font-family="Share Tech Mono">< 2% = DOVISH</text><text x="35" y="72" fill="var(--o)" font-size="6" font-family="Share Tech Mono">> 2% = HAWKISH</text>'}
  ]},
  employment:{en:'EMPLOYMENT',label:'سوق العمل',patterns:[
    {name:'NFP — Non-Farm Payrolls',ar:'الوظائف غير الزراعية',rel:92,type:'HIGH IMPACT',
    desc:'ثاني أهم بيانة بعد CPI. NFP يقيس عدد الوظائف الجديدة المُضافة في الاقتصاد الأمريكي. المفارقة: أخبار سيئة للاقتصاد = أخبار جيدة للأسواق (لأنها تعني خفض فائدة).',
    fib:'NFP > متوقع: اقتصاد قوي → Fed لن يخفض → سلبي مؤقت\nNFP < متوقع: اقتصاد ضعيف → Fed قد يخفض → إيجابي\nNFP سلبي (فقدان وظائف): ركود قريب → حذر شديد\n>300K: اقتصاد ساخن جداً\n150-250K: نمو صحي\n<100K: ضعف → توقع خفض فائدة',
    rules:'1. يصدر أول جمعة من كل شهر — تقلب حاد\n2. أخبار سيئة للاقتصاد = جيدة للكريبتو (خفض فائدة)\n3. أخبار جيدة للاقتصاد = سلبية مؤقتاً (لا خفض)\n4. NFP + Unemployment + Wages = صورة كاملة\n5. المفاجأة (فعلي vs متوقع) تُحرّك السعر\n6. أول رد فعل غالباً مبالغ فيه — انتظر الاستقرار',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="12" y="45" width="10" height="22" fill="#fff" opacity="0.6"/><rect x="26" y="38" width="10" height="29" fill="#fff" opacity="0.7"/><rect x="40" y="30" width="10" height="37" fill="#fff" opacity="0.8"/><rect x="54" y="25" width="10" height="42" fill="#fff" opacity="0.9"/><rect x="68" y="35" width="10" height="32" fill="var(--o)" opacity="0.7"/><rect x="82" y="42" width="10" height="25" fill="var(--o)" opacity="0.6"/><rect x="96" y="50" width="10" height="17" fill="var(--o)" opacity="0.5"/><text x="55" y="12" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">NFP</text><text x="55" y="22" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">JOBS ADDED (THOUSANDS)</text><text x="55" y="78" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">FIRST FRIDAY EVERY MONTH</text>'},
    {name:'Unemployment Rate',ar:'معدل البطالة',rel:88,type:'RECESSION SIGNAL',
    desc:'نسبة العاطلين عن العمل من إجمالي القوى العاملة. بطالة مرتفعة: اقتصاد ضعيف → الفيدرالي يُيسّر → إيجابي للكريبتو. ارتفاع مفاجئ في البطالة قد يكون إشارة ركود.',
    fib:'< 4%: اقتصاد قوي — ضغط تضخمي\n4-5%: منطقة صحية\n> 5%: ضعف — توقع خفض فائدة\n> 6%: ركود محتمل\nSahm Rule: ارتفاع 0.5% = ركود\nالبطالة مؤشر متأخر (Lagging) — تتأخر عن الواقع',
    rules:'1. بطالة منخفضة + تضخم مرتفع = أسوأ سيناريو (Stagflation)\n2. بطالة ترتفع = الفيدرالي سيُيسّر = إيجابي للكريبتو لاحقاً\n3. Sahm Rule: +0.5% من أدنى 12 شهر = ركود\n4. الركود سلبي قصيراً لكن يجلب خفض فائدة + QE\n5. البطالة مؤشر متأخر — لا تتداول عليه وحده\n6. راقب Initial Jobless Claims الأسبوعي كمؤشر مُبكر',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,45 20,42 30,40 40,38 50,35 55,33 60,32 65,35 70,38 75,42 80,48 85,52 90,55 95,52 100,50" fill="none" stroke="var(--o)" stroke-width="2"/><line x1="10" y1="38" x2="110" y2="38" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="112" y="40" fill="#888" font-size="5" font-family="Share Tech Mono">4%</text><text x="55" y="12" text-anchor="middle" fill="var(--o)" font-size="9" font-family="Share Tech Mono" font-weight="900">UNEMPLOYMENT</text><text x="80" y="60" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">RISING</text><text x="40" y="30" fill="#fff" font-size="6" font-family="Share Tech Mono">LOW</text>'},
    {name:'Average Hourly Earnings (Wages)',ar:'متوسط الأجور بالساعة',rel:78,type:'WAGE INFLATION',
    desc:'يقيس التغير في أجور العمال. أجور ترتفع بسرعة: ضغط تضخمي إضافي. الفيدرالي يراقب الأجور كمؤشر على تضخم مستدام (Sticky Inflation).',
    fib:'أجور > 4% سنوياً: ضغط تضخمي — سلبي\nأجور 3-4%: منطقة صحية\nأجور < 3%: لا ضغط تضخمي — إيجابي\nأجور ترتفع + تضخم مرتفع = Wage-Price Spiral\nأجور تتباطأ = التضخم سيتراجع\nيصدر مع NFP شهرياً',
    rules:'1. أجور مرتفعة = تضخم مستدام = سلبي للكريبتو\n2. أجور تتباطأ = التضخم يتراجع = إيجابي\n3. Wage-Price Spiral: أجور ترفع الأسعار التي ترفع الأجور\n4. الفيدرالي يراقب الأجور كمؤشر على Sticky Inflation\n5. يصدر مع NFP — انظر الصورة الكاملة\n6. أجور + CPI + PCE معاً = صورة التضخم الكاملة',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,50 30,45 40,42 50,38 60,35 70,32 80,30 90,28 100,25" fill="none" stroke="#fff" stroke-width="2"/><text x="55" y="12" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">WAGES</text><text x="55" y="22" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">AVERAGE HOURLY EARNINGS</text><text x="55" y="72" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">WAGES UP = STICKY INFLATION</text>'}
  ]},
  liquidity:{en:'LIQUIDITY & GDP',label:'السيولة والنمو',patterns:[
    {name:'M2 Money Supply',ar:'عرض النقود M2 — السيولة العالمية',rel:92,type:'CRYPTO FUEL',
    desc:'M2 يقيس إجمالي الأموال المتداولة في الاقتصاد. أهم مؤشر للسيولة العالمية. طباعة أموال = سيولة تتوسع = BTC يصعد بقوة. M2 هو أقوى مؤشر كلي لتوقع اتجاه الكريبتو على المدى المتوسط.',
    fib:'M2 يرتفع → BTC يصعد (بتأخر 3-6 أشهر)\nM2 ينخفض → BTC يهبط (بتأخر 3-6 أشهر)\nQE (طباعة) = M2 يرتفع بسرعة = أقوى صعود\nQT (سحب) = M2 ينخفض = أقوى هبوط\n2020: M2 +40% → BTC من $5K لـ $69K\n2022: M2 انكمش → BTC من $69K لـ $16K',
    rules:'1. M2 يرتفع = بيئة صعودية للكريبتو (أقوى مؤشر كلي)\n2. M2 ينخفض = بيئة هبوطية\n3. تأخر 3-6 أشهر بين M2 وسعر BTC\n4. QE = أقوى محرك صعودي | QT = أقوى محرك هبوطي\n5. راقب M2 العالمي (USA + EU + Japan + China)\n6. M2 يتحول للصعود = ابدأ بالتجميع',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,50 18,48 25,45 32,42 38,38 45,32 52,28 58,25 65,22 72,20 78,18 85,16 92,15 100,14" fill="none" stroke="#fff" stroke-width="2.5"/><polyline points="18,55 25,52 32,50 38,48 45,42 52,38 58,32 65,28 72,25 78,22 85,20 92,18 100,16 108,14" fill="none" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="4,3"/><text x="60" y="12" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">M2 MONEY SUPPLY</text><text x="102" y="12" fill="#fff" font-size="5" font-family="Share Tech Mono">M2</text><text x="110" y="16" fill="var(--o)" font-size="5" font-family="Share Tech Mono">BTC</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">M2 UP = CRYPTO UP (3-6M LAG)</text>'},
    {name:'GDP — Gross Domestic Product',ar:'الناتج المحلي الإجمالي',rel:82,type:'ECONOMIC HEALTH',
    desc:'GDP يقيس إجمالي قيمة السلع والخدمات المُنتجة في بلد. GDP ضعيف: الفيدرالي قد يُيسّر → إيجابي للكريبتو. فصلين سلبيين متتاليين = ركود رسمي.',
    fib:'GDP > 3%: نمو قوي — اقتصاد ساخن\nGDP 1-3%: نمو صحي\nGDP 0-1%: تباطؤ\nGDP سلبي: انكماش\nفصلين سلبيين = ركود رسمي\nGDP مؤشر متأخر — يصدر فصلياً',
    rules:'1. GDP قوي = الفيدرالي لن يُيسّر = سلبي مؤقت\n2. GDP ضعيف = توقع تيسير = إيجابي لاحقاً\n3. فصلين سلبيين = ركود → خفض فائدة حاد\n4. GDP مؤشر متأخر — لا تتداول عليه وحده\n5. يصدر 3 مرات: Advance → Preliminary → Final\n6. Advance (الأولي) هو الأكثر تأثيراً على السوق',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="42" x2="110" y2="42" stroke="#888" stroke-width="0.5"/><rect x="15" y="22" width="12" height="20" fill="#fff" opacity="0.7"/><rect x="30" y="28" width="12" height="14" fill="#fff" opacity="0.6"/><rect x="45" y="18" width="12" height="24" fill="#fff" opacity="0.8"/><rect x="60" y="32" width="12" height="10" fill="#fff" opacity="0.4"/><rect x="75" y="42" width="12" height="10" fill="var(--o)" opacity="0.5"/><rect x="90" y="42" width="12" height="15" fill="var(--o)" opacity="0.7"/><text x="21" y="18" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">3.2%</text><text x="81" y="56" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">-0.5%</text><text x="55" y="12" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">GDP GROWTH</text><text x="55" y="72" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">2 NEGATIVE = RECESSION</text>'},
    {name:'Yield Curve (2Y vs 10Y)',ar:'منحنى العائد — مؤشر الركود',rel:88,type:'RECESSION PREDICTOR',
    desc:'منحنى مقلوب (عائد 2Y أعلى من 10Y) تنبأ بكل ركود أمريكي خلال آخر 50 سنة بدقة شبه مطلقة. عندما المنحنى يعود لطبيعته (Un-inversion) = الركود وشيك.',
    fib:'10Y - 2Y > 0: منحنى طبيعي — اقتصاد صحي\n10Y - 2Y = 0: منحنى مسطح — تحذير\n10Y - 2Y < 0: منحنى مقلوب — ركود قادم\nالانقلاب تنبأ بكل ركود خلال 50 سنة\nالركود يأتي بعد 6-18 شهر من الانقلاب\nUn-inversion (العودة): الركود وشيك',
    rules:'1. منحنى مقلوب (2Y > 10Y) = ركود قادم خلال 6-18 شهر\n2. تنبأ بكل ركود أمريكي خلال 50 سنة\n3. Un-inversion = الركود وشيك — كن حذراً\n4. الركود = هبوط أولاً ثم صعود قوي (خفض فائدة + QE)\n5. لا تبيع فور الانقلاب — التوقيت غير دقيق\n6. راقب 2Y-10Y Spread يومياً كمؤشر ماكرو',
    svg:'<rect width="120" height="80" fill="#000"/><text x="60" y="12" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">YIELD CURVE</text><polyline points="10,50 30,42 50,35 70,30 90,28 110,27" fill="none" stroke="#fff" stroke-width="2"/><text x="112" y="25" fill="#fff" font-size="5" font-family="Share Tech Mono">NORMAL</text><polyline points="10,30 30,35 50,38 70,40 90,42 110,43" fill="none" stroke="var(--o)" stroke-width="2"/><text x="112" y="45" fill="var(--o)" font-size="5" font-family="Share Tech Mono">INVERTED</text><text x="8" y="62" fill="#888" font-size="5" font-family="Share Tech Mono">2Y</text><text x="100" y="62" fill="#888" font-size="5" font-family="Share Tech Mono">10Y</text><text x="60" y="75" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">INVERTED = RECESSION COMING</text>'}
  ]},
  commodities:{en:'COMMODITIES',label:'السلع والمعادن',patterns:[
    {name:'Oil Prices & Crypto',ar:'أسعار البترول وتأثيرها',rel:82,type:'INFLATION DRIVER',
    desc:'البترول يُؤثر على كل شيء لأنه مدخل أساسي في الإنتاج والنقل. ارتفاع البترول: تكاليف إنتاج ترتفع → تضخم يرتفع → الفيدرالي يُشدد → سلبي للكريبتو.',
    fib:'بترول يرتفع → تضخم يرتفع → سلبي للكريبتو\nبترول ينخفض → تضخم يتراجع → إيجابي\nبترول > $100: ضغط تضخمي شديد\nبترول $60-80: منطقة مريحة\nبترول < $50: اقتصاد ضعيف أو عرض فائض\nصدمة بترولية (حرب) = أسوأ سيناريو',
    rules:'1. بترول يرتفع = توقع CPI مرتفع = سلبي\n2. بترول ينخفض = CPI سيتراجع = إيجابي\n3. بترول فوق $100 = ضغط تضخمي خطير\n4. صدمات بترولية (حروب/عقوبات) = تقلب حاد\n5. راقب البترول قبل صدور CPI\n6. البترول يُؤثر على Headline CPI مباشرة',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 18,50 25,52 32,45 38,48 45,40 52,35 58,38 65,30 72,25 78,20 85,22 92,28 100,25" fill="none" stroke="var(--o)" stroke-width="2"/><text x="60" y="12" text-anchor="middle" fill="var(--o)" font-size="9" font-family="Share Tech Mono" font-weight="900">OIL PRICE</text><line x1="10" y1="30" x2="110" y2="30" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="112" y="28" fill="#888" font-size="5" font-family="Share Tech Mono">$100</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">OIL UP = INFLATION UP = BTC DOWN</text>'},
    {name:'Gold Price & Safe Haven',ar:'الذهب كملاذ آمن',rel:80,type:'RISK BAROMETER',
    desc:'الذهب هو الملاذ الآمن التقليدي. الذهب عند أعلى مستوياته = الأسواق خائفة = حذر. الذهب يهبط + الأسهم تصعد = Risk-On = بيئة جيدة للكريبتو.',
    fib:'ذهب يرتفع + أسهم تهبط = Risk-Off = حذر من الكريبتو\nذهب يرتفع + BTC يرتفع = تحوّط تضخم = إيجابي لكليهما\nذهب يهبط + أسهم تصعد = Risk-On = ممتاز للكريبتو\nذهب عند ATH = الأسواق خائفة جداً\nGold/BTC ينخفض = BTC يتفوق\nالذهب مؤشر خوف — BTC مؤشر مخاطرة',
    rules:'1. الذهب يرتفع = المستثمرون خائفون — احذر\n2. ذهب يهبط + أسهم تصعد = Risk-On = اشترِ كريبتو\n3. ذهب وBTC يرتفعان معاً = تحوّط ضد تضخم\n4. في الأزمات: الذهب ملاذ آمن وBTC أصل خطر\n5. Gold ATH = أسواق خائفة = لا تكن عدواني\n6. راقب Gold/BTC Ratio لقياس تفضيل المستثمرين',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,45 20,42 30,38 40,35 50,30 60,28 70,25 80,22 90,20 100,18" fill="none" stroke="var(--o)" stroke-width="2"/><text x="102" y="16" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">GOLD</text><text x="55" y="12" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">GOLD = FEAR</text><text x="20" y="62" fill="#fff" font-size="6" font-family="Share Tech Mono">GOLD UP</text><text x="20" y="72" fill="#fff" font-size="6" font-family="Share Tech Mono">= FEAR UP</text><text x="75" y="62" fill="var(--o)" font-size="6" font-family="Share Tech Mono">GOLD DOWN</text><text x="75" y="72" fill="var(--o)" font-size="6" font-family="Share Tech Mono">= RISK ON</text>'},
    {name:'DXY — US Dollar Index',ar:'مؤشر الدولار الأمريكي',rel:90,type:'INVERSE TO CRYPTO',
    desc:'DXY يقيس قوة الدولار. أهم مؤشر كلي للكريبتو. علاقة عكسية قوية: DXY يرتفع → BTC يهبط. DXY يهبط → BTC يصعد. كل Bull Market كبير في BTC جاء مع ضعف DXY.',
    fib:'DXY > 105: ضغط شديد على الكريبتو\nDXY 100-105: ضغط متوسط\nDXY 95-100: منطقة مريحة\nDXY < 95: بيئة مثالية لصعود الكريبتو\nDXY يكسر دعم = BTC يكسر مقاومة\nعلاقة عكسية 80-85% من الوقت',
    rules:'1. DXY يرتفع = سلبي للكريبتو (80-85% ترابط عكسي)\n2. DXY يهبط = إيجابي للكريبتو\n3. DXY > 105 = لا تكن عدواني في الكريبتو\n4. DXY يكسر دعم رئيسي = إشارة شراء BTC\n5. راقب DXY يومياً مع BTC\n6. كل Bull Market كبير = DXY ضعيف',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,20 20,25 30,28 40,32 50,35 60,40 70,45 80,48 90,52 100,55" fill="none" stroke="var(--o)" stroke-width="2"/><polyline points="10,55 20,50 30,48 40,44 50,40 60,35 70,30 80,25 90,22 100,18" fill="none" stroke="#fff" stroke-width="2"/><text x="102" y="58" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">DXY</text><text x="102" y="16" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono" font-weight="900">INVERSE CORRELATION</text>'},
    {name:'Macro Calendar — How to Use',ar:'التقويم الاقتصادي — كيف تستخدمه',rel:88,type:'ESSENTIAL TOOL',
    desc:'البيانات مُصنفة بالألوان: أحمر = تأثير عالي (CPI/FOMC/NFP). لا تفتح صفقات جديدة قبل بيانة حمراء. أول رد فعل غالباً مبالغ فيه. الحركة الحقيقية تأتي بعد 30-60 دقيقة.',
    fib:'أحمر (HIGH): CPI, FOMC, NFP, PCE — لا تتداول قبلها\nبرتقالي (MED): PPI, GDP, Jobless Claims\nأصفر (LOW): تأثير محدود\nقبل البيانة: أغلق أو قلّص الصفقات\nبعد البيانة: انتظر 15-30 دقيقة\nأول رد فعل غالباً مبالغ فيه',
    rules:'1. تحقق من التقويم كل صباح قبل التداول\n2. بيانة حمراء = لا صفقات جديدة قبلها\n3. أغلق/قلّص المراكز المفتوحة قبل بيانة حمراء\n4. انتظر 15-30 دقيقة بعد الإصدار للدخول\n5. أول رد فعل مبالغ فيه — الحركة الحقيقية لاحقاً\n6. المفاجأة (فعلي vs متوقع) هي ما تُحرّك السعر',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="10" width="100" height="12" fill="rgba(255,40,40,0.15)" stroke="#ff4444" stroke-width="1"/><text x="15" y="19" fill="#ff4444" font-size="6" font-family="Share Tech Mono" font-weight="900">HIGH: CPI / FOMC / NFP</text><rect x="10" y="25" width="100" height="12" fill="rgba(255,106,0,0.1)" stroke="var(--o)" stroke-width="0.8"/><text x="15" y="34" fill="var(--o)" font-size="6" font-family="Share Tech Mono">MED: PPI / GDP / CLAIMS</text><rect x="10" y="40" width="100" height="12" fill="rgba(255,255,0,0.05)" stroke="#888" stroke-width="0.5"/><text x="15" y="49" fill="#888" font-size="6" font-family="Share Tech Mono">LOW: MINOR DATA</text><text x="60" y="65" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">CHECK CALENDAR DAILY</text><text x="60" y="75" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">FOREXFACTORY / INVESTING.COM</text>'}
  ]}
};

function maRender(){
  var cat=maData[maCurrentCat];
  if(!cat) return;
  var el=document.getElementById('ma-content');
  if(maSelectedIdx>=0 && maSelectedIdx<cat.patterns.length){
    el.innerHTML=maRenderDetail(cat.patterns[maSelectedIdx]);
    return;
  }
  var h='<div class="ma-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    var isHigh=p.type&&(p.type.indexOf('HIGHEST')>=0||p.type.indexOf('#1')>=0||p.type.indexOf('FUEL')>=0);
    var topC=isHigh?'var(--o)':'#fff';
    h+='<div class="ma-card" style="border-top:3px solid '+topC+'" onclick="maSelect('+i+')">';
    h+='<div class="ma-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
    h+='<div class="ma-card-name">'+p.name+'</div><div class="ma-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="ma-card-type">'+p.type+'</div>';
    h+='<div class="ma-card-rel-row"><span class="ma-card-rel-l">IMPACT</span><span class="ma-card-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="ma-card-bar"><div class="ma-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="ma-footer">الاقتصاد الكلي هو المحرك الأساسي لأسواق الكريبتو على المدى المتوسط والطويل. التحليل الفني يُحدد أين تدخل — الاقتصاد الكلي يُحدد في أي اتجاه. لا تتجاهل البيانات الاقتصادية. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function maRenderDetail(p){
  var h='<div class="ma-back" onclick="maBack()">رجوع</div><div class="ma-detail">';
  h+='<div class="ma-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%">'+p.svg+'</svg></div>';
  h+='<div class="ma-detail-name">'+p.name+'</div><div class="ma-detail-ar">'+p.ar+'</div>';
  if(p.type){
    var bc=p.type.indexOf('HIGHEST')>=0||p.type.indexOf('#1')>=0?'var(--o)':'#fff';
    h+='<div class="ma-detail-badge" style="background:'+bc+';color:#000">'+p.type+'</div>';
  }
  h+='<div class="ma-detail-rel-row"><span class="ma-detail-rel-l">IMPACT</span><span class="ma-detail-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="ma-detail-bar"><div class="ma-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="ma-detail-desc-wrap"><div class="ma-detail-desc-label">DESCRIPTION // الوصف</div><div class="ma-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="ma-detail-fib-wrap"><div class="ma-detail-fib-label">IMPACT ON CRYPTO // التأثير على الكريبتو</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="ma-fib-row"><span class="ma-fib-arrow">▶</span><span class="ma-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="ma-detail-rules-wrap"><div class="ma-detail-rules-label">TRADING RULES // قواعد التداول</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="ma-rule-row"><span class="ma-rule-num">'+r[i].substring(0,2)+'</span><span class="ma-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

/* =====================================================================
   ON-CHAIN & TOKENOMICS GUIDE ENGINE - 360° PLATFORM
===================================================================== */
var ocCurrentCat='onchain';
var ocSelectedIdx=-1;

function ocSetCat(cat,btn){
  ocCurrentCat=cat; ocSelectedIdx=-1;
  var b=document.querySelectorAll('.oc-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('oc-cat-active');
  btn.classList.add('oc-cat-active');
  ocRender();
}

function ocSelect(idx){ ocSelectedIdx=idx; ocRender(); }
function ocBack(){ ocSelectedIdx=-1; ocRender(); }

function ocInit(){
  var h='';
  var k=Object.keys(ocData);
  for(var i=0;i<k.length;i++){
    var c=ocData[k[i]];
    h+='<button class="oc-cat-btn'+(k[i]===ocCurrentCat?' oc-cat-active':'')+'" onclick="ocSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('oc-cat-tabs').innerHTML=h;
  ocRender();
}

var ocData={
  onchain:{en:'ON-CHAIN',label:'تحليل البلوكتشين',patterns:[
    {name:'NUPL — Net Unrealized Profit/Loss',ar:'صافي الربح/الخسارة غير المحقق',rel:95,type:'MARKET CYCLE',
    desc:'أقوى مؤشر On-Chain لتحديد موقعنا في دورة السوق. يقيس النسبة بين إجمالي الأرباح والخسائر غير المحققة لجميع حاملي BTC. تنبأ بكل قمة وقاع رئيسي في تاريخ BTC.',
    fib:'NUPL < 0: Capitulation — أفضل شراء (الكل خسران)\nNUPL 0-0.25: Hope/Fear — بداية تعافي\nNUPL 0.25-0.5: Optimism — صعود صحي\nNUPL 0.5-0.75: Belief — ثقة عالية\nNUPL > 0.75: Euphoria — وقت البيع (الكل رابح)\nكل قمة تاريخية = NUPL > 0.75',
    rules:'1. NUPL < 0 = فرصة شراء تاريخية (الكل خسران)\n2. NUPL > 0.75 = وقت البيع التدريجي (الكل رابح)\n3. تنبأ بكل قمة وقاع رئيسي في تاريخ BTC\n4. مؤشر بطيء — للقرارات الاستراتيجية وليس اليومية\n5. يعمل فقط على BTC (أكبر بيانات تاريخية)\n6. مصادر: Glassnode, CryptoQuant',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="60" width="20" height="12" fill="rgba(255,106,0,0.15)"/><rect x="30" y="48" width="20" height="12" fill="rgba(255,255,255,0.05)"/><rect x="50" y="36" width="20" height="12" fill="rgba(255,255,255,0.08)"/><rect x="70" y="24" width="20" height="12" fill="rgba(255,255,255,0.1)"/><rect x="90" y="12" width="20" height="12" fill="rgba(255,106,0,0.2)"/><text x="20" y="68" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">CAPIT</text><text x="40" y="56" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">HOPE</text><text x="60" y="44" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">OPTIM</text><text x="80" y="32" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">BELIEF</text><text x="100" y="20" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">EUPHO</text><text x="20" y="78" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BUY</text><text x="100" y="10" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">SELL</text>'},
    {name:'MVRV Z-Score',ar:'نسبة القيمة السوقية للقيمة المحققة',rel:92,type:'OVER/UNDERVALUED',
    desc:'يقارن بين القيمة السوقية الحالية ومتوسط سعر شراء جميع BTC المتداولة. يعمل كـ P/E Ratio للكريبتو — يقيس إن كان السعر رخيص أم غالي مقارنة بتكلفة الشراء الفعلية.',
    fib:'MVRV Z > 7: قمة — بيع فوري\nMVRV Z 3-7: مرتفع — حذر وبيع تدريجي\nMVRV Z 1-3: صحي — استمرار\nMVRV Z 0-1: رخيص — شراء\nMVRV Z < 0: قاع — أقوى شراء\nتنبأ بكل قمة وقاع BTC تاريخياً',
    rules:'1. MVRV Z < 0 = BTC مُقيّم بأقل من قيمته = شراء\n2. MVRV Z > 7 = BTC مُبالغ في تقييمه = بيع\n3. تنبأ بقمم 2013 و2017 و2021 بدقة\n4. مؤشر استراتيجي — ليس للتداول اليومي\n5. Realized Value = متوسط سعر شراء الجميع\n6. مصادر: Glassnode, LookIntoBitcoin',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="15" x2="110" y2="15" stroke="var(--o)" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="10" y1="60" x2="110" y2="60" stroke="#fff" stroke-width="0.8" stroke-dasharray="3,3"/><polyline points="10,55 18,50 25,42 32,35 38,25 45,18 50,12 55,15 60,22 65,30 70,38 75,45 80,52 85,58 90,62 95,58 100,50 108,42" fill="none" stroke="#fff" stroke-width="2"/><text x="100" y="12" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">Z > 7</text><text x="100" y="68" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">Z < 0</text><text x="50" y="10" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">TOP</text><text x="90" y="72" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BOTTOM</text>'},
    {name:'SOPR — Spent Output Profit Ratio',ar:'نسبة ربح المخرجات المنفقة',rel:85,type:'PROFIT TAKING',
    desc:'SOPR يقيس إن كان حاملو BTC يبيعون بربح أم خسارة. SOPR = 1 هي نقطة التعادل ومستوى نفسي مهم كدعم أو مقاومة.',
    fib:'SOPR > 1: البيع بربح — سوق صحي\nSOPR = 1: نقطة التعادل — دعم/مقاومة نفسي\nSOPR < 1: البيع بخسارة — Capitulation\nBull Market: SOPR يرتد من 1 = دعم\nBear Market: SOPR يُرفض عند 1 = مقاومة\naSOPR أدق من SOPR العادي',
    rules:'1. SOPR > 1 في Bull = صحي — الربح يُؤخذ تدريجياً\n2. SOPR يلمس 1 ويرتد في Bull = فرصة شراء\n3. SOPR < 1 لفترة طويلة = Capitulation = قاع قريب\n4. SOPR يُرفض عند 1 في Bear = مقاومة نفسية\n5. استخدم aSOPR للدقة (يستثني الضوضاء)\n6. SOPR + NUPL معاً = صورة كاملة للدورة',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="40" x2="110" y2="40" stroke="#fff" stroke-width="1.5"/><text x="105" y="38" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">1.0</text><polyline points="10,35 18,32 25,28 32,30 38,35 45,38 50,40 55,38 60,32 65,28 70,30 75,35 80,40 85,42 90,45 95,50 100,48 108,44" fill="none" stroke="var(--o)" stroke-width="2"/><text x="30" y="22" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">PROFIT</text><text x="90" y="56" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">LOSS</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">SOPR = 1 IS KEY LEVEL</text>'},
    {name:'Exchange Inflow / Outflow',ar:'تدفق العملات من وإلى المنصات',rel:90,type:'BUY/SELL PRESSURE',
    desc:'يتتبع كمية العملات التي تدخل وتخرج من منصات التداول. Inflow يرتفع: ضغط بيعي قادم. Outflow يرتفع: تجميع طويل المدى.',
    fib:'Inflow يرتفع: عملات تدخل المنصة = بيع قادم = سلبي\nOutflow يرتفع: عملات تخرج = تجميع = إيجابي\nExchange Reserve ينخفض: عرض يقل = صعودي\nExchange Reserve يرتفع: عرض يزيد = ضغط بيعي\nWhale Inflow: حوت يُدخل كمية كبيرة = بيع وشيك\nStablecoin Inflow: أموال جديدة جاهزة للشراء = صعودي',
    rules:'1. Inflow كبير = توقع بيع = حذر\n2. Outflow كبير = تجميع طويل المدى = إيجابي\n3. Reserve ينخفض = عرض يقل = صعودي\n4. Whale Inflow = حوت سيبيع = انتبه\n5. Stablecoin Inflow = أموال جاهزة للشراء\n6. مصادر: CryptoQuant, Glassnode',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="15" y="15" width="40" height="50" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="1"/><rect x="65" y="15" width="40" height="50" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="1"/><text x="35" y="35" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">INFLOW</text><text x="35" y="45" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">TO EXCH</text><text x="35" y="55" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">= SELL</text><text x="85" y="35" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">OUTFLOW</text><text x="85" y="45" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">TO WALLET</text><text x="85" y="55" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">= HODL</text>'},
    {name:'Active Addresses & Network Activity',ar:'العناوين النشطة ونشاط الشبكة',rel:82,type:'ADOPTION',
    desc:'عدد العناوين الفريدة التي تتفاعل مع البلوكتشين. مقياس مباشر لاستخدام الشبكة وتبنيها.',
    fib:'Active Addresses ترتفع: تبني متزايد = صعودي\nActive Addresses تنخفض: اهتمام يتراجع = حذر\nNew Addresses ترتفع: مستخدمون جدد = إيجابي\nBTC: 800K-1M يومياً = نشاط صحي\nTransaction Count يرتفع: شبكة حيوية\nDivergence: سعر يصعد + عناوين تنخفض = تحذير',
    rules:'1. Active Addresses ترتفع مع السعر = صعود صحي\n2. سعر يصعد + عناوين تنخفض = Divergence = حذر\n3. New Addresses مؤشر تبني — ليس تداول\n4. قارن مع المتوسط التاريخي (6 أشهر)\n5. ETH Active Addresses تشمل DeFi = أشمل\n6. مصادر: Glassnode, Santiment',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,48 30,45 40,40 50,35 60,32 70,28 80,25 90,22 100,20" fill="none" stroke="#fff" stroke-width="2"/><polyline points="10,58 20,52 30,50 40,48 50,45 60,42 70,40 80,38 90,36 100,34" fill="none" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="3,2"/><text x="105" y="18" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">PRICE</text><text x="105" y="38" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">ACTIVE</text><text x="55" y="12" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">NETWORK ACTIVITY</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">BOTH UP = HEALTHY TREND</text>'},
    {name:'Hash Rate & Mining Cost',ar:'قوة التعدين وتكلفة الإنتاج',rel:80,type:'BTC FLOOR',
    desc:'إجمالي القوة الحاسوبية. تكلفة التعدين تُمثل الحد الأدنى النظري لسعر BTC. Miner Capitulation يُنظف السوق.',
    fib:'Hash Rate يرتفع: ثقة المُعدّنين = صعودي\nHash Rate ينخفض: إغلاق مُعدّنين = أزمة\nMining Cost = الحد الأدنى النظري للسعر\nسعر < Mining Cost: غير مستدام = قاع قريب\nMiner Capitulation: بيع مخزون = ضغط مؤقت\nHash Ribbon Buy Signal: MA30 > MA60 = شراء',
    rules:'1. Hash Rate ATH = شبكة أقوى من أي وقت = إيجابي\n2. سعر تحت Mining Cost = غير مستدام = قاع\n3. Hash Ribbon Signal = من أدق إشارات الشراء\n4. Miner Capitulation = ضغط مؤقت ثم ارتداد\n5. بعد كل Halving: Mining Cost يتضاعف\n6. مصادر: Hashrate Index, Glassnode',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,60 20,55 30,50 40,45 50,40 60,35 70,30 80,28 90,25 100,22" fill="none" stroke="#fff" stroke-width="2"/><line x1="10" y1="48" x2="110" y2="48" stroke="var(--o)" stroke-width="1" stroke-dasharray="3,3"/><text x="105" y="52" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">COST</text><text x="105" y="20" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">HASH</text><text x="55" y="12" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">HASH RATE</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">HASH UP = NETWORK SECURE</text>'},
    {name:'Whale Tracking',ar:'تتبع الحيتان',rel:88,type:'SMART MONEY',
    desc:'تتبع المحافظ التي تحتوي على أكثر من 1000 BTC. Whale Accumulation يعطي إشارة صعودية قوية.',
    fib:'Whale محفظة → منصة: بيع وشيك = سلبي\nWhale منصة → محفظة: تجميع = إيجابي\nعدد Whales يرتفع: تبني مؤسسي = صعودي\nWhale Accumulation في الهبوط: Smart Money يشتري\nWhale Distribution في الصعود: وقت الحذر\nTop 100 Wallets: راقب تغير الأرصدة أسبوعياً',
    rules:'1. حوت يُحوّل للمنصة = بيع قادم = حذر\n2. حوت يسحب من المنصة = تجميع = إيجابي\n3. عدد Whales يرتفع = تبني مؤسسي متزايد\n4. Whales تشتري في الخوف = اتبعهم\n5. Whales تبيع في الطمع = لا تكن آخر المشترين\n6. مصادر: Whale Alert, Santiment',
    svg:'<rect width="120" height="80" fill="#000"/><text x="55" y="22" text-anchor="middle" fill="#fff" font-size="20" font-family="Share Tech Mono">🐋</text><text x="55" y="34" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">WHALE TRACKING</text><rect x="10" y="42" width="45" height="15" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><text x="32" y="52" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">BUY = FOLLOW</text><rect x="60" y="42" width="50" height="15" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="0.8"/><text x="85" y="52" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">SELL = CAUTION</text><text x="55" y="70" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">FOLLOW SMART MONEY</text>'}
  ]},
  tokenomics:{en:'TOKENOMICS',label:'اقتصاديات العملة',patterns:[
    {name:'Supply Types (Circulating/Total/Max)',ar:'أنواع العرض — المتداول/الإجمالي/الأقصى',rel:95,type:'FUNDAMENTAL',
    desc:'الفرق بين Market Cap و FDV يكشف مقدار التخفيف المستقبلي. إذا FDV أكبر بكثير من Market Cap = عملات كثيرة ستُفتح لاحقاً = ضغط بيعي مستقبلي.',
    fib:'Circulating Supply: المتاح الآن للتداول\nTotal Supply: كل المُنشأ (متاح + مقفل)\nMax Supply: الحد الأقصى (BTC = 21M)\nMarket Cap = Circulating × Price\nFDV = Max Supply × Price\nFDV >> Market Cap = تخفيف مستقبلي كبير = حذر',
    rules:'1. قارن Market Cap وليس السعر بين العملات\n2. FDV >> Market Cap = ضغط بيعي مستقبلي\n3. Low Circulating / High Max = عملات كثيرة ستُفتح\n4. BTC: 21M Max = ندرة مطلقة\n5. عملة بلا Max Supply = تضخم غير محدود = خطر\n6. تحقق من Circulating/Max ratio قبل الشراء',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="15" width="100" height="14" fill="rgba(255,255,255,0.03)" stroke="#888" stroke-width="0.5"/><rect x="10" y="15" width="65" height="14" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><rect x="10" y="15" width="35" height="14" fill="rgba(255,255,255,0.1)" stroke="#fff" stroke-width="1.5"/><text x="27" y="25" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">CIRC</text><text x="60" y="25" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">TOTAL</text><text x="95" y="25" text-anchor="middle" fill="#555" font-size="5" font-family="Share Tech Mono">MAX</text><text x="55" y="42" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">Market Cap = Circ × Price</text><text x="55" y="52" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">FDV = Max × Price</text><text x="55" y="68" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">FDV >> MCap = DILUTION RISK</text>'},
    {name:'Inflation Rate & Emission Schedule',ar:'معدل التضخم وجدول الإصدار',rel:90,type:'SUPPLY PRESSURE',
    desc:'نسبة العملات الجديدة التي تُضاف للعرض سنوياً. تضخم عالي = العملة تفقد قيمتها مع الوقت حتى لو الطلب ثابت.',
    fib:'BTC: ~1.7% تضخم (ينخفض كل 4 سنوات)\nETH: ~0% أو سالب بعد Merge (Deflationary)\n< 2% تضخم: صحي ومستدام\n2-5% تضخم: مقبول إذا التبني ينمو\n5-10% تضخم: ضغط بيعي — حذر\n> 10% تضخم: خطير — تجنب',
    rules:'1. تضخم أقل = أفضل (أقل ضغط بيعي)\n2. Deflationary (سالب) = العرض ينقص = صعودي\n3. BTC Halving كل 4 سنوات = تضخم ينخفض\n4. ETH بعد Merge = Deflationary = ميزة تنافسية\n5. عملة بتضخم 50% = تحتاج نمو 50% فقط لتبقى ثابتة\n6. قارن التضخم مع نمو التبني',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="12" y="20" width="12" height="45" fill="var(--o)" opacity="0.8"/><rect x="30" y="30" width="12" height="35" fill="var(--o)" opacity="0.6"/><rect x="48" y="38" width="12" height="27" fill="#fff" opacity="0.5"/><rect x="66" y="45" width="12" height="20" fill="#fff" opacity="0.4"/><rect x="84" y="50" width="12" height="15" fill="#fff" opacity="0.3"/><rect x="100" y="55" width="12" height="10" fill="#fff" opacity="0.2"/><text x="18" y="16" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">50%</text><text x="54" y="34" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">5%</text><text x="106" y="52" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">1%</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">LOWER INFLATION = BETTER</text>'},
    {name:'Vesting & Token Unlocks',ar:'جداول الاستحقاق وفتح العملات',rel:92,type:'SELL PRESSURE',
    desc:'جدول زمني يُحدد متى تُفتح العملات المقفلة للمؤسسين والمستثمرين. فتح كبير = ضغط بيعي شديد.',
    fib:'Cliff: فترة قفل كامل (6-12 شهر عادة)\nLinear Vesting: فتح تدريجي شهري بعد Cliff\nTeam Unlock: فريق يبيع = سلبي جداً\nVC/Investor Unlock: مستثمرون يبيعون ربح كبير\nFtح > 5% من Circulating = ضغط شديد\nفتح < 1% = تأثير محدود',
    rules:'1. تحقق من جدول Vesting قبل شراء أي عملة\n2. فتح كبير (>5% Circulating) = تجنب أو حذر\n3. Team/VC Unlock = ضغط بيعي شبه مؤكد\n4. Cliff ينتهي = أول فتح = أكبر ضغط\n5. TokenUnlocks.app = أداة أساسية\n6. عملة بلا Vesting = كل العرض متاح = لا مفاجآت',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="15" y1="60" x2="110" y2="60" stroke="#888" stroke-width="0.5"/><line x1="15" y1="60" x2="15" y2="10" stroke="#888" stroke-width="0.5"/><rect x="15" y="55" width="20" height="5" fill="#888" opacity="0.3"/><rect x="38" y="45" width="5" height="15" fill="var(--o)" opacity="0.8"/><rect x="46" y="48" width="5" height="12" fill="var(--o)" opacity="0.6"/><rect x="54" y="50" width="5" height="10" fill="var(--o)" opacity="0.5"/><rect x="62" y="52" width="5" height="8" fill="var(--o)" opacity="0.4"/><rect x="70" y="53" width="5" height="7" fill="var(--o)" opacity="0.4"/><rect x="78" y="54" width="5" height="6" fill="var(--o)" opacity="0.3"/><text x="25" y="52" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">CLIFF</text><text x="40" y="42" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">UNLOCK</text><text x="70" y="42" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">LINEAR</text><text x="55" y="75" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">BIG UNLOCK = SELL PRESSURE</text>'},
    {name:'Token Burns & Buybacks',ar:'حرق العملات وإعادة الشراء',rel:82,type:'DEFLATIONARY',
    desc:'إزالة عملات من العرض نهائياً بإرسالها لعنوان ميت يُقلل العرض ويزيد الندرة. Buyback المشروع يشتري عملته من السوق ويحرقها.',
    fib:'Burn: إزالة عملات نهائياً = عرض أقل = صعودي\nBuyback + Burn: شراء من السوق + حرق = أقوى\nETH EIP-1559: رسوم تُحرق = Deflationary\nBNB: حرق فصلي حتى 100M\nBurn Rate > Emission = Deflationary = ممتاز\nBurn تسويقي مؤقت vs حقيقي مستمر',
    rules:'1. Burn حقيقي ومستمر = إيجابي طويل المدى\n2. Buyback + Burn = أقوى ميكانيكية صعودية\n3. تحقق: Burn Rate > Emission Rate = Deflationary\n4. ETH Deflationary = ميزة تنافسية كبيرة\n5. Burn تسويقي مرة واحدة = لا قيمة طويلة\n6. قارن الحرق مع إجمالي العرض',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="20" y="18" width="30" height="30" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="1"/><text x="35" y="30" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">SUPPLY</text><text x="35" y="40" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">1000</text><text x="55" y="36" text-anchor="middle" fill="var(--o)" font-size="12" font-family="Share Tech Mono" font-weight="900">→</text><rect x="65" y="22" width="25" height="22" fill="rgba(255,106,0,0.08)" stroke="var(--o)" stroke-width="1"/><text x="78" y="32" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">BURN</text><text x="78" y="40" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">-100</text><text x="55" y="58" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">= 900 LEFT</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">LESS SUPPLY = MORE VALUE</text>'},
    {name:'Revenue Model & Value Accrual',ar:'نموذج الإيرادات وتراكم القيمة',rel:85,type:'REAL VALUE',
    desc:'كيف يُولّد المشروع إيرادات وكيف تعود للعملة. مشروع بإيرادات حقيقية ومتزايدة + Value Accrual واضح = استثمار أفضل من المضاربة.',
    fib:'Revenue Sources: رسوم + فوائد + خدمات\nValue Accrual: كيف تعود الإيرادات للعملة\nBurn: رسوم تُحرق = عرض أقل\nStaking Rewards: إيرادات توزع على المشاركين\nBuyback: مشروع يشتري عملته = ضغط شرائي\nP/E = FDV / Annual Revenue (أقل = أرخص)',
    rules:'1. مشروع بإيرادات حقيقية > مشروع بدون إيرادات\n2. Revenue متزايد = تبني حقيقي = استثمار أفضل\n3. Value Accrual واضح = العملة تستفيد من النمو\n4. P/E منخفض = مُقيّم بأقل من قيمته\n5. لا إيرادات + لا Utility = مضاربة بحتة = خطر\n6. مصادر: Token Terminal, DefiLlama',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,60 20,55 30,48 40,42 50,38 60,32 70,28 80,22 90,18 100,15" fill="none" stroke="#fff" stroke-width="2"/><text x="105" y="13" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">REVENUE</text><rect x="12" y="62" width="8" height="10" fill="#fff" opacity="0.4"/><rect x="28" y="60" width="8" height="12" fill="#fff" opacity="0.5"/><rect x="44" y="56" width="8" height="16" fill="#fff" opacity="0.6"/><rect x="60" y="52" width="8" height="20" fill="#fff" opacity="0.7"/><rect x="76" y="48" width="8" height="24" fill="#fff" opacity="0.8"/><rect x="92" y="44" width="8" height="28" fill="#fff" opacity="0.9"/><text x="55" y="12" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">REVENUE GROWTH</text><text x="55" y="78" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">REAL REVENUE = REAL VALUE</text>'}
  ]}
};

function ocRender(){
  var cat=ocData[ocCurrentCat];
  if(!cat) return;
  var el=document.getElementById('oc-content');
  if(ocSelectedIdx>=0 && ocSelectedIdx<cat.patterns.length){
    el.innerHTML=ocRenderDetail(cat.patterns[ocSelectedIdx]);
    return;
  }
  var h='<div class="oc-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    h+='<div class="oc-card" style="border-top:3px solid #fff" onclick="ocSelect('+i+')">';
    h+='<div class="oc-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
    h+='<div class="oc-card-name">'+p.name+'</div><div class="oc-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="oc-card-type">'+p.type+'</div>';
    h+='<div class="oc-card-rel-row"><span class="oc-card-rel-l">IMPORTANCE</span><span class="oc-card-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="oc-card-bar"><div class="oc-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="oc-footer">تحليل On-Chain واقتصاديات العملة هما ما يُميّز المحترف عن أي متداول في الأسواق التقليدية. البلوكتشين شفاف — كل المعلومات متاحة. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function ocRenderDetail(p){
  var h='<div class="oc-back" onclick="ocBack()">رجوع</div><div class="oc-detail">';
  h+='<div class="oc-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
  h+='<div class="oc-detail-name">'+p.name+'</div><div class="oc-detail-ar">'+p.ar+'</div>';
  if(p.type) h+='<div class="oc-detail-badge">'+p.type+'</div>';
  h+='<div class="oc-detail-rel-row"><span class="oc-detail-rel-l">IMPORTANCE</span><span class="oc-detail-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="oc-detail-bar"><div class="oc-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="oc-detail-desc-wrap"><div class="oc-detail-desc-label">DESCRIPTION // الوصف</div><div class="oc-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="oc-detail-fib-wrap"><div class="oc-detail-fib-label">SIGNALS & DATA // الإشارات</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="oc-fib-row"><span class="oc-fib-arrow">▶</span><span class="oc-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="oc-detail-rules-wrap"><div class="oc-detail-rules-label">RULES // القواعد</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="oc-rule-row"><span class="oc-rule-num">'+r[i].substring(0,2)+'</span><span class="oc-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

/* =====================================================================
   TRADING SETUPS & MTF GUIDE ENGINE - 360° PLATFORM
===================================================================== */
var stCurrentCat='setups';
var stSelectedIdx=-1;

function stSetCat(cat,btn){
  stCurrentCat=cat; stSelectedIdx=-1;
  var b=document.querySelectorAll('.st-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('st-cat-active');
  btn.classList.add('st-cat-active');
  stRender();
}

function stSelect(idx){ stSelectedIdx=idx; stRender(); }
function stBack(){ stSelectedIdx=-1; stRender(); }

function stInit(){
  var h='';
  var k=Object.keys(stData);
  for(var i=0;i<k.length;i++){
    var c=stData[k[i]];
    h+='<button class="st-cat-btn'+(k[i]===stCurrentCat?' st-cat-active':'')+'" onclick="stSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('st-cat-tabs').innerHTML=h;
  stRender();
}

var stData={
  setups:{en:'TRADING SETUPS',label:'استراتيجيات التداول',patterns:[
    {name:'Setup 1: OB + FVG in Discount',ar:'كتلة أوامر + فجوة قيمة في منطقة الخصم',rel:92,type:'ICT / SMC',
    desc:'أقوى Setup في مدرسة ICT — يجمع 3 عناصر Confluence: Order Block (منطقة أوامر مؤسسية) + Fair Value Gap (فجوة قيمة عادلة) + Discount Zone (تحت 50% من الحركة). الخطوات: 1) حدد الاتجاه على فريم كبير (4H/1D). 2) انتظر BOS يؤكد الاتجاه. 3) حدد OB قبل BOS. 4) تحقق أن OB في Discount Zone. 5) ابحث عن FVG داخل أو قرب OB. 6) ادخل عند وصول السعر لـ OB+FVG مع شمعة انعكاسية. SL تحت OB. TP1 عند آخر قمة. TP2 عند -27% Fib Extension. R:R عادة 1:3 أو أفضل.',
    fib:'الدخول: عند OB + FVG في Discount Zone\nSL: تحت OB (أو تحت Swing Low)\nTP1: آخر قمة (Swing High)\nTP2: -27.2% Fibonacci Extension\nTP3: -61.8% Fibonacci Extension\nR:R المتوقع: 1:3 إلى 1:5',
    rules:'1. الاتجاه واضح على فريم كبير (4H/1D)\n2. BOS يؤكد الاتجاه قبل البحث عن OB\n3. OB يجب أن يكون في Discount Zone (تحت 50%)\n4. FVG داخل أو ملاصق لـ OB = Confluence\n5. شمعة انعكاسية عند OB = تأكيد الدخول\n6. SL تحت OB | TP1 آخر قمة | TP2 Fib Extension',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="30" y="42" width="18" height="14" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1"/><rect x="32" y="46" width="14" height="6" fill="rgba(255,255,255,0.12)" stroke="#fff" stroke-width="0.5" stroke-dasharray="2,2"/><polyline points="8,20 20,30 30,42 38,56 42,52 48,42 55,35 62,28 70,22 78,18 88,12" fill="none" stroke="#fff" stroke-width="2"/><text x="48" y="50" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">OB</text><text x="48" y="56" fill="var(--o)" font-size="4" font-family="Share Tech Mono">FVG</text><line x1="30" y1="38" x2="60" y2="38" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><text x="62" y="37" fill="#888" font-size="4" font-family="Share Tech Mono">50% EQ</text><text x="30" y="68" fill="#fff" font-size="5" font-family="Share Tech Mono">DISCOUNT</text><circle cx="42" cy="52" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="42" y="62" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">ENTRY</text>'},
    {name:'Setup 2: Liquidity Sweep + CHoCH',ar:'مسح السيولة + تغيير الهيكل',rel:90,type:'ICT / SMC',
    desc:'Setup انعكاسي قوي يعتمد على فخ السيولة. الخطوات: 1) حدد منطقة سيولة (Equal Highs/Lows أو قمة/قاع واضح). 2) انتظر Sweep (كسر كاذب يمسح Stop Losses). 3) انتظر CHoCH (تغيير الهيكل) بعد Sweep مباشرة. 4) ابحث عن OB أو FVG بعد CHoCH. 5) ادخل عند الـ Pullback لـ OB/FVG. SL فوق/تحت Sweep. TP عند منطقة السيولة المقابلة. هذا Setup يلتقط الانعكاسات المؤسسية الكلاسيكية — مطابق لـ Spring/UTAD في وايكوف.',
    fib:'الدخول: Pullback بعد CHoCH لـ OB/FVG\nSL: فوق/تحت نقطة Sweep\nTP1: EQ (50%) من الحركة الجديدة\nTP2: منطقة السيولة المقابلة\nR:R المتوقع: 1:3 إلى 1:8\nمطابق لـ Spring (وايكوف)',
    rules:'1. حدد منطقة سيولة واضحة (Equal Highs/Lows)\n2. انتظر Sweep (كسر كاذب + عودة سريعة)\n3. CHoCH بعد Sweep = تأكيد الانعكاس\n4. ادخل عند Pullback لـ OB/FVG بعد CHoCH\n5. SL فوق/تحت Sweep (ضيق)\n6. TP عند السيولة المقابلة (بعيد = R:R ممتاز)',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="20" y1="25" x2="65" y2="25" stroke="#888" stroke-width="1" stroke-dasharray="3,3"/><polyline points="10,35 18,28 25,32 35,25 42,30 50,22 55,18" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="55" cy="18" r="3" fill="none" stroke="var(--o)" stroke-width="2"/><text x="55" y="12" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">SWEEP</text><polyline points="55,18 60,28 65,35 68,30 72,38 78,42 82,48 88,55 95,60 102,65" fill="none" stroke="var(--o)" stroke-width="2"/><text x="72" y="28" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">CHoCH</text><circle cx="78" cy="42" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="78" y="52" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">ENTRY</text>'},
    {name:'Setup 3: RSI Divergence + S/R',ar:'دايفرجنس RSI + دعم/مقاومة',rel:88,type:'CLASSIC TA',
    desc:'Setup كلاسيكي موثوق يجمع بين الدايفرجنس والمستويات السعرية. الخطوات: 1) حدد مستوى دعم/مقاومة قوي (فيبوناتشي/أفقي). 2) انتظر وصول السعر للمستوى. 3) تحقق من RSI Divergence (السعر يسجل قمة/قاع جديد لكن RSI لا). 4) انتظر شمعة انعكاسية (Hammer/Engulfing/Star). 5) ادخل بعد إغلاق شمعة التأكيد. SL تحت/فوق المستوى. TP عند فيبوناتشي أو S/R التالي.',
    fib:'الدخول: عند S/R + Divergence + شمعة انعكاسية\nSL: تحت/فوق مستوى S/R\nTP1: 38.2% من الحركة المتوقعة\nTP2: S/R التالي\nR:R المتوقع: 1:2 إلى 1:4\nأفضل على فريم 4H و1D',
    rules:'1. S/R قوي (مُختبر عدة مرات) = الأساس\n2. Divergence واضح (Regular وليس Hidden)\n3. شمعة انعكاسية عند S/R = التأكيد الضروري\n4. لا تدخل بـ Divergence فقط بدون S/R\n5. فريم 4H/1D = أدق من فريمات صغيرة\n6. 3 عناصر Confluence = Setup قوي',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="55" x2="110" y2="55" stroke="#fff" stroke-width="1" stroke-dasharray="3,3"/><polyline points="10,30 25,40 35,35 50,48 60,42 75,55 80,52 90,48 100,42 110,35" fill="none" stroke="#fff" stroke-width="2"/><text x="112" y="57" fill="#fff" font-size="5" font-family="Share Tech Mono">S/R</text><line x1="50" y1="48" x2="75" y2="55" stroke="#fff" stroke-width="0.5" stroke-dasharray="2,2"/><polyline points="50,68 55,65 60,68 65,66 70,70 75,72" fill="none" stroke="var(--o)" stroke-width="1.5"/><line x1="50" y1="68" x2="75" y2="72" stroke="var(--o)" stroke-width="0.5" stroke-dasharray="2,2"/><text x="60" y="78" fill="var(--o)" font-size="5" font-family="Share Tech Mono">RSI DIVERGENCE</text><circle cx="80" cy="52" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="88" y="50" fill="#fff" font-size="5" font-family="Share Tech Mono">ENTRY</text>'},
    {name:'Setup 4: Golden Cross + Pullback',ar:'التقاطع الذهبي + الارتداد',rel:85,type:'TREND FOLLOWING',
    desc:'Setup طويل المدى يتبع الاتجاه بعد تأكيده. الخطوات: 1) انتظر Golden Cross (MA50 فوق MA200). 2) لا تدخل فوراً — انتظر Pullback (تراجع). 3) Pullback يصل لـ EMA 50 أو EMA 21 ويرتد. 4) ادخل عند الارتداد من EMA مع شمعة صعودية. SL تحت EMA 200 أو آخر Swing Low. TP مفتوح — تتبع الاتجاه بـ Trailing Stop. هذا Setup للمتداول الصبور — يعطي أفضل R:R على المدى الطويل.',
    fib:'الدخول: Pullback لـ EMA 21/50 بعد Golden Cross\nSL: تحت EMA 200 أو آخر Swing Low\nTP: مفتوح — Trailing Stop\nأو TP1: 161.8% Fib Extension\nR:R المتوقع: 1:3 إلى 1:10+\nأفضل على فريم يومي',
    rules:'1. انتظر Golden Cross (MA50 > MA200) أولاً\n2. لا تشتري فوراً — انتظر Pullback\n3. Pullback لـ EMA 21 أو EMA 50 = فرصة\n4. شمعة صعودية عند EMA = تأكيد الدخول\n5. SL تحت EMA 200 (واسع لكن آمن)\n6. Trailing Stop: حرّك SL مع كل قاع أعلى',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,52 20,48 30,44 40,40 50,36 60,32 70,28 80,26 90,24 100,22 110,20" fill="none" stroke="var(--o)" stroke-width="1.5"/><polyline points="10,48 20,46 30,44 40,42 50,40 60,38 70,35 80,32 90,28 100,25 110,22" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="60" cy="36" r="4" fill="none" stroke="#fff" stroke-width="1.5"/><text x="60" y="30" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">CROSS</text><polyline points="60,32 65,28 68,30 72,35 75,32 78,28 82,22 88,18 95,15" fill="none" stroke="#fff" stroke-width="2"/><circle cx="72" cy="35" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="72" y="42" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">PULLBACK</text>'},
    {name:'Setup 5: Fibonacci OTE + OB',ar:'فيبوناتشي OTE + كتلة أوامر',rel:90,type:'ICT PRECISION',
    desc:'أدق Setup في ICT — يجمع OTE Zone (61.8%-78.6%) مع Order Block. الخطوات: 1) حدد Swing High و Swing Low واضحين. 2) ارسم فيبوناتشي Retracement. 3) حدد OTE Zone (61.8%-78.6%). 4) ابحث عن OB داخل OTE Zone. 5) ادخل عند وصول السعر لـ OB داخل OTE. SL تحت 100% (Swing Low). TP عند -27% و-62% Extension. هذا Setup يُعطي أضيق SL وأفضل R:R ممكن.',
    fib:'الدخول: OB داخل OTE Zone (61.8%-78.6%)\n70.5% (منتصف OTE) = أدق نقطة\nSL: تحت 100% Fibonacci (Swing Low)\nTP1: -27.2% Extension\nTP2: -61.8% Extension\nR:R المتوقع: 1:4 إلى 1:8',
    rules:'1. ارسم فيبوناتشي من Swing Low لـ Swing High\n2. حدد OTE Zone: 61.8% — 78.6%\n3. ابحث عن OB طازج داخل OTE\n4. OB + OTE = أقوى Confluence ممكن\n5. SL تحت Swing Low (100%)\n6. أضيق SL + أبعد TP = أفضل R:R',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="15" y1="68" x2="15" y2="12" stroke="#888" stroke-width="0.5"/><rect x="15" y="22" width="60" height="14" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><rect x="20" y="26" width="12" height="8" fill="rgba(255,255,255,0.1)" stroke="#fff" stroke-width="1"/><text x="78" y="25" fill="#fff" font-size="5" font-family="Share Tech Mono">61.8%</text><text x="78" y="30" fill="var(--o)" font-size="5" font-family="Share Tech Mono">70.5%</text><text x="78" y="37" fill="#fff" font-size="5" font-family="Share Tech Mono">78.6%</text><text x="40" y="32" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">OB in OTE</text><polyline points="20,68 30,50 35,55 40,30 42,28" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="42" cy="28" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="42,28 50,22 58,18 65,12 72,8" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,2"/><text x="42" y="40" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">ENTRY</text>'},
    {name:'Setup 6: Wyckoff Spring Entry',ar:'دخول Spring وايكوف',rel:88,type:'WYCKOFF',
    desc:'Setup يلتقط القاع المؤسسي في نموذج التجميع. الخطوات: 1) حدد نطاق تذبذب جانبي (Phase B وايكوف). 2) حدد مستوى الدعم (SC level). 3) انتظر Spring (كسر كاذب للدعم بـ 1-3%). 4) انتظر عودة فوق الدعم بسرعة + حجم مرتفع. 5) انتظر Test (عودة للدعم بحجم منخفض). 6) ادخل عند Test. SL تحت Spring. TP1 عند مقاومة النطاق. TP2 بعد كسر المقاومة.',
    fib:'الدخول: عند Test بعد Spring (حجم منخفض)\nSL: تحت أدنى نقطة في Spring\nTP1: مقاومة النطاق (AR level)\nTP2: كسر المقاومة + Markup\nR:R المتوقع: 1:3 إلى 1:10\nأفضل على فريم 4H/1D',
    rules:'1. حدد نطاق تذبذب جانبي (Phase B)\n2. Spring = كسر كاذب للدعم + عودة فورية\n3. حجم مرتفع في Spring = تصفية Stop Loss\n4. Test بعد Spring بحجم منخفض = تأكيد\n5. الدخول عند Test وليس عند Spring\n6. SL ضيق تحت Spring = R:R ممتاز',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="38" x2="90" y2="38" stroke="#888" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="10" y1="18" x2="90" y2="18" stroke="#888" stroke-width="0.8" stroke-dasharray="3,3"/><polyline points="10,32 18,28 25,32 32,28 40,32 48,30 52,35 56,45 58,50" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="58" cy="50" r="3" fill="none" stroke="var(--o)" stroke-width="2"/><text x="58" y="60" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">SPRING</text><polyline points="58,50 62,40 65,35 70,32 75,28 78,30" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="78" cy="30" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="78" y="25" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">TEST</text><polyline points="78,30 82,25 86,20 90,15 95,12 100,10" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,2"/>'},
    {name:'Setup 7: EMA Ribbon Bounce',ar:'ارتداد من شريط المتوسطات',rel:82,type:'TREND CONTINUATION',
    desc:'Setup استمراري بسيط وفعّال. الخطوات: 1) تأكد أن EMA 9/21/55 مرتبة (9 فوق 21 فوق 55 = صعودي). 2) انتظر تصحيح يصل لـ EMA 21 أو EMA 55. 3) السعر يلمس EMA ويرتد بشمعة صعودية. 4) ادخل عند إغلاق شمعة الارتداد. SL تحت EMA 55. TP عند آخر قمة أو Fib Extension.',
    fib:'الدخول: ارتداد من EMA 21 أو EMA 55\nSL: تحت EMA 55 (أو آخر Swing Low)\nTP1: آخر قمة\nTP2: 161.8% Extension\nR:R المتوقع: 1:2 إلى 1:4\nأفضل على فريم 4H/1D',
    rules:'1. EMAs مرتبة: 9 > 21 > 55 = اتجاه صاعد واضح\n2. انتظر تصحيح لـ EMA 21 (أول دعم)\n3. إذا كسر 21 انتظر EMA 55 (ثاني دعم)\n4. شمعة ارتداد صعودية عند EMA = دخول\n5. SL تحت EMA 55\n6. لا تدخل إذا EMAs متشابكة (لا اتجاه)',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,48 30,42 40,38 50,35 60,32 70,30 80,28 90,26 100,24" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="10,58 20,52 30,46 40,42 50,38 60,35 70,32 80,30 90,28 100,26" fill="none" stroke="var(--o)" stroke-width="1"/><polyline points="10,62 20,58 30,52 40,48 50,44 60,40 70,38 80,36 90,34 100,32" fill="none" stroke="#888" stroke-width="1"/><polyline points="50,35 55,38 58,42 60,40 62,35 65,30 68,28 72,25 78,22 85,20" fill="none" stroke="#fff" stroke-width="2"/><circle cx="60" cy="40" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="60" y="48" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">BOUNCE</text>'},
    {name:'Setup 8: Breakout + Retest',ar:'كسر المقاومة + إعادة الاختبار',rel:85,type:'CLASSIC',
    desc:'من أقدم وأبسط Setups الفعالة. الخطوات: 1) حدد مقاومة أفقية واضحة (مُختبرة 2-3 مرات). 2) انتظر كسر المقاومة بشمعة كاملة فوقها + حجم مرتفع. 3) لا تشتري فوراً عند الكسر. 4) انتظر Retest (السعر يعود لاختبار المقاومة المكسورة كدعم جديد). 5) شمعة ارتداد صعودية عند Retest = دخول. SL تحت المستوى المكسور.',
    fib:'الدخول: عند Retest للمقاومة المكسورة (كدعم)\nSL: تحت المستوى المكسور\nTP1: ارتفاع النموذج السابق\nTP2: -27.2% Fib Extension\nR:R المتوقع: 1:2 إلى 1:4\nيعمل على كل الفريمات',
    rules:'1. المقاومة يجب أن تكون مُختبرة 2-3 مرات\n2. الكسر بإغلاق شمعة كاملة + حجم مرتفع\n3. لا تشتري فوراً عند الكسر — انتظر Retest\n4. Retest = المقاومة تصبح دعم\n5. شمعة ارتداد عند Retest = دخول مؤكد\n6. حجم منخفض في Retest = طبيعي ومتوقع',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="38" x2="110" y2="38" stroke="#fff" stroke-width="1.5" stroke-dasharray="3,3"/><polyline points="10,55 20,45 28,50 35,42 42,48 48,40 55,32 60,28 65,22 70,18" fill="none" stroke="#fff" stroke-width="2"/><polyline points="70,18 75,25 80,32 85,38" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="85" cy="38" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="85" y="46" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">RETEST</text><polyline points="85,38 90,32 95,25 100,20 108,15" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3,2"/><text x="55" y="35" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">BREAKOUT</text><text x="50" y="55" fill="#888" font-size="5" font-family="Share Tech Mono">RESISTANCE</text><text x="90" y="55" fill="#fff" font-size="5" font-family="Share Tech Mono">NOW SUPPORT</text>'},
    {name:'Setup 9: Bollinger Squeeze Breakout',ar:'انفجار ضغط بولينجر',rel:80,type:'VOLATILITY',
    desc:'يلتقط الانفجارات بعد فترات التقلب المنخفض. الخطوات: 1) حدد Bollinger Squeeze (النطاقات ضيقة جداً). 2) انتظر — لا تدخل أثناء Squeeze. 3) الكسر لأعلى بشمعة + حجم = دخول شراء. الكسر لأسفل = دخول بيع (في أسواق ثنائية). 4) SL عند الجانب المقابل من Squeeze.',
    fib:'الدخول: كسر Bollinger بشمعة كاملة + حجم\nSL: الجانب المقابل من Squeeze\nTP1: عرض النطاق قبل Squeeze × 1.5\nTP2: Trailing Stop\nR:R المتوقع: 1:2 إلى 1:5\nأفضل مع RSI/MACD للتأكيد',
    rules:'1. Squeeze = نطاقات ضيقة جداً (أقل تقلب)\n2. لا تدخل أثناء Squeeze — انتظر الكسر\n3. الكسر بحجم مرتفع = حقيقي\n4. الكسر بحجم منخفض = كاذب محتمل\n5. اتجاه الكسر يحدد الاتجاه القادم\n6. Squeeze أطول = انفجار أقوى',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,20 18,22 25,18 32,25 38,15 42,28 48,32 52,35 55,38 58,36 60,38" fill="none" stroke="#888" stroke-width="0.8"/><polyline points="10,55 18,52 25,58 32,50 38,60 42,48 48,44 52,42 55,40 58,42 60,40" fill="none" stroke="#888" stroke-width="0.8"/><polyline points="60,38 65,35 68,30 72,22 78,15 85,12 92,10 100,8" fill="none" stroke="#fff" stroke-width="2"/><text x="52" y="32" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">SQUEEZE</text><text x="85" y="8" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BREAKOUT</text><polyline points="35,35 42,38 48,38 52,38 55,39 58,39 60,39 65,32 68,28 72,22" fill="none" stroke="#fff" stroke-width="1.5"/>'},
    {name:'Setup 10: Power of 3 (AMD) Daily',ar:'قوة الثلاثة — Setup اليومي',rel:88,type:'ICT DAILY',
    desc:'Setup يومي يعتمد على نموذج AMD. الخطوات: 1) حدد Asian Range (20:00-00:00 UTC). 2) حدد قمة وقاع Asian Range. 3) في London Open (02:00-05:00): انتظر كسر كاذب لأحد الجانبين (Manipulation/Judas Swing). 4) بعد الكسر الكاذب + عودة داخل النطاق: ادخل في الاتجاه المعاكس. 5) SL فوق/تحت Judas Swing. TP الجانب المقابل من Asian Range ثم أبعد.',
    fib:'الدخول: بعد Judas Swing في London Open\nSL: فوق/تحت نقطة Judas (ضيق)\nTP1: الجانب المقابل من Asian Range\nTP2: -27% Extension من Asian Range\nTP3: NY Session continuation\nR:R المتوقع: 1:3 إلى 1:6',
    rules:'1. حدد Asian Range قبل London Open\n2. Judas Swing = كسر كاذب لجانب واحد\n3. الاتجاه الحقيقي = عكس Judas Swing\n4. ادخل بعد العودة داخل النطاق\n5. SL فوق/تحت Judas (ضيق جداً)\n6. TP: الجانب المقابل + Extension',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="28" width="32" height="28" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.8"/><text x="24" y="25" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono" font-weight="900">ASIAN</text><polyline points="40,38 44,32 46,28 48,22 50,18" fill="none" stroke="var(--o)" stroke-width="2"/><text x="50" y="14" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">JUDAS</text><polyline points="50,18 52,25 55,32 58,38 62,42 65,48 70,55 75,58 80,62 85,65 92,68" fill="none" stroke="#fff" stroke-width="2"/><circle cx="58" cy="38" r="3" fill="none" stroke="#fff" stroke-width="1.5"/><text x="58" y="48" fill="#fff" font-size="5" font-family="Share Tech Mono" text-anchor="middle">ENTRY</text><text x="80" y="75" fill="#fff" font-size="5" font-family="Share Tech Mono">TRUE MOVE</text>'}
  ]},
  mtf:{en:'MULTI-TIMEFRAME',label:'متعدد الفريمات',patterns:[
    {name:'MTF Hierarchy: Top-Down Analysis',ar:'التسلسل الهرمي — من الكبير للصغير',rel:95,type:'CORE METHOD',
    desc:'القاعدة الأساسية: حلل دائماً من الفريم الكبير للصغير وليس العكس. الفريم الكبير يحدد الاتجاه والفريم الصغير يحدد نقطة الدخول. لا تتداول عكس الفريم الكبير أبداً.',
    fib:'Weekly: الاتجاه العام + الصورة الكبرى\nDaily: اتجاه متوسط + S/R رئيسية\n4H: اتجاه تداولي + Setup\n1H: دقة الدخول + تأكيد\n15m: فقط لتحسين نقطة الدخول (سكالبينج)\nكل فريم 4-6 أضعاف الذي بعده',
    rules:'1. ابدأ دائماً من Weekly ثم Daily ثم 4H ثم 1H\n2. Weekly يحدد الاتجاه العام — لا تتداول عكسه\n3. Daily يحدد مناطق S/R الرئيسية\n4. 4H يحدد Setup والاتجاه التداولي\n5. 1H يحدد نقطة الدخول الدقيقة\n6. لا تتداول على فريم واحد فقط — أبداً',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="8" width="100" height="14" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="1"/><text x="60" y="18" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">WEEKLY — DIRECTION</text><rect x="18" y="24" width="84" height="12" fill="rgba(255,255,255,0.05)" stroke="#fff" stroke-width="0.8"/><text x="60" y="33" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">DAILY — S/R + TREND</text><rect x="26" y="38" width="68" height="12" fill="rgba(255,106,0,0.05)" stroke="var(--o)" stroke-width="0.8"/><text x="60" y="47" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">4H — SETUP</text><rect x="34" y="52" width="52" height="12" fill="rgba(255,106,0,0.08)" stroke="var(--o)" stroke-width="1"/><text x="60" y="61" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">1H — ENTRY</text><text x="60" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">TOP-DOWN ALWAYS</text>'},
    {name:'MTF Alignment — When to Trade',ar:'توافق الفريمات — متى تتداول',rel:92,type:'CONFLUENCE',
    desc:'MTF Alignment يعني أن كل الفريمات تُشير لنفس الاتجاه — أقوى حالة للتداول. كلما زاد التوافق زادت احتمالية النجاح وزاد حجم الصفقة المسموح.',
    fib:'4/4 Alignment: كل الفريمات متوافقة = أقوى Setup\n3/4 Alignment: مقبول بحجم أقل (75% من العادي)\n2/4 Alignment: ضعيف — لا تتداول\n1/4 أو 0/4: تعارض كامل = لا تفتح أي صفقة\nFull Alignment + Confluence (OB+FVG+Fib) = مثالي\nالمحترف ينتظر Full Alignment فقط',
    rules:'1. Full Alignment (4/4) = أقوى Setup — حجم كامل\n2. Partial (3/4) = مقبول بحجم أقل\n3. تعارض (2/4 أو أقل) = لا تتداول\n4. Weekly + Daily يتفقان = الأساس الإلزامي\n5. 4H + 1H للدقة — لكن لا تعاكس الكبار\n6. الصبر على Alignment = سر النجاح',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="12" width="22" height="52" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><rect x="35" y="12" width="22" height="52" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><rect x="60" y="12" width="22" height="52" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><rect x="85" y="12" width="22" height="52" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><polyline points="14,55 18,45 22,50 26,38 28,32" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="39,52 43,42 47,48 51,35 53,28" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="64,50 68,40 72,45 76,32 78,25" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="89,48 93,38 97,42 101,30 103,22" fill="none" stroke="#fff" stroke-width="1.5"/><text x="21" y="10" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">W</text><text x="46" y="10" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">D</text><text x="71" y="10" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">4H</text><text x="96" y="10" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">1H</text><text x="60" y="72" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">ALL BULLISH = TRADE</text>'},
    {name:'MTF Conflict — When NOT to Trade',ar:'تعارض الفريمات — متى لا تتداول',rel:88,type:'PROTECTION',
    desc:'عندما الفريمات تتعارض = خطر. إذا Weekly و Daily متعارضان = لا تتداول. التعارض يعني أن السوق في مرحلة انتقالية — الوضوح سيأتي لاحقاً.',
    fib:'Weekly صاعد + Daily هابط = تصحيح — انتظر\nWeekly هابط + Daily صاعد = ارتداد مؤقت — حذر\n4H صاعد + 1H هابط = طبيعي (تصحيح فرعي)\nكل الفريمات متعارضة = لا تتداول\nالتعارض = مرحلة انتقالية\nالوضوح سيأتي — لا تستعجل',
    rules:'1. Weekly vs Daily تعارض = لا تتداول\n2. Daily vs 4H تعارض = حجم أقل أو انتظار\n3. 4H vs 1H تعارض = طبيعي (صغير يُصحح)\n4. لا تُجبر Setup عندما الفريمات تتعارض\n5. التعارض = مرحلة انتقالية — انتظر الوضوح\n6. حماية رأس المال > فرصة تداول مشكوك فيها',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="10" y="12" width="22" height="50" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.5"/><rect x="35" y="12" width="22" height="50" fill="rgba(255,106,0,0.04)" stroke="var(--o)" stroke-width="0.5"/><rect x="60" y="12" width="22" height="50" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.5"/><rect x="85" y="12" width="22" height="50" fill="rgba(255,106,0,0.04)" stroke="var(--o)" stroke-width="0.5"/><polyline points="14,52 18,42 22,48 26,35 28,28" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="39,22 43,32 47,28 51,40 53,48" fill="none" stroke="var(--o)" stroke-width="1.5"/><polyline points="64,50 68,40 72,45 76,32 78,25" fill="none" stroke="#fff" stroke-width="1.5"/><polyline points="89,25 93,35 97,30 101,42 103,50" fill="none" stroke="var(--o)" stroke-width="1.5"/><text x="21" y="10" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">W UP</text><text x="46" y="10" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">D DOWN</text><text x="71" y="10" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">4H UP</text><text x="96" y="10" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">1H DN</text><line x1="20" y1="68" x2="50" y2="68" stroke="var(--o)" stroke-width="3"/><line x1="25" y1="63" x2="45" y2="73" stroke="var(--o)" stroke-width="2.5"/><line x1="25" y1="73" x2="45" y2="63" stroke="var(--o)" stroke-width="2.5"/><text x="80" y="72" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">NO TRADE</text>'}
  ]}
};

function stRender(){
  var cat=stData[stCurrentCat];
  if(!cat) return;
  var el=document.getElementById('st-content');
  if(stSelectedIdx>=0 && stSelectedIdx<cat.patterns.length){
    el.innerHTML=stRenderDetail(cat.patterns[stSelectedIdx]);
    return;
  }
  var h='<div class="st-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    h+='<div class="st-card" style="border-top:3px solid #fff" onclick="stSelect('+i+')">';
    h+='<div class="st-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
    h+='<div class="st-card-name">'+p.name+'</div><div class="st-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="st-card-type">'+p.type+'</div>';
    h+='<div class="st-card-rel-row"><span class="st-card-rel-l">WIN RATE</span><span class="st-card-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="st-card-bar"><div class="st-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="st-footer">هذه الاستراتيجيات مبنية على مدارس التحليل الفني المختلفة. كل Setup يحتاج ممارسة على حساب تجريبي قبل التداول الحقيقي. التحليل متعدد الفريمات إلزامي — لا تتداول على فريم واحد. الصبر على التوافق (Alignment) هو سر النجاح. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function stRenderDetail(p){
  var h='<div class="st-back" onclick="stBack()">رجوع</div><div class="st-detail">';
  h+='<div class="st-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
  h+='<div class="st-detail-name">'+p.name+'</div><div class="st-detail-ar">'+p.ar+'</div>';
  if(p.type) h+='<div class="st-detail-badge">'+p.type+'</div>';
  h+='<div class="st-detail-rel-row"><span class="st-detail-rel-l">WIN RATE</span><span class="st-detail-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="st-detail-bar"><div class="st-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="st-detail-desc-wrap"><div class="st-detail-desc-label">STRATEGY // الاستراتيجية</div><div class="st-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="st-detail-fib-wrap"><div class="st-detail-fib-label">ENTRY / SL / TP // الدخول والخروج</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="st-fib-row"><span class="st-fib-arrow">▶</span><span class="st-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="st-detail-rules-wrap"><div class="st-detail-rules-label">RULES // الشروط</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="st-rule-row"><span class="st-rule-num">'+r[i].substring(0,2)+'</span><span class="st-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

/* =====================================================================
   CHART READING & GLOSSARY ENGINE - 360° PLATFORM
===================================================================== */
var cgCurrentCat='candle101';
var cgSelectedIdx=-1;

function cgSetCat(cat,btn){
  cgCurrentCat=cat; cgSelectedIdx=-1;
  var b=document.querySelectorAll('.cg-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('cg-cat-active');
  btn.classList.add('cg-cat-active');
  cgRender();
}

function cgSelect(idx){ cgSelectedIdx=idx; cgRender(); }
function cgBack(){ cgSelectedIdx=-1; cgRender(); }

function cgInit(){
  var h='';
  var k=Object.keys(cgData);
  for(var i=0;i<k.length;i++){
    var c=cgData[k[i]];
    h+='<button class="cg-cat-btn'+(k[i]===cgCurrentCat?' cg-cat-active':'')+'" onclick="cgSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('cg-cat-tabs').innerHTML=h;
  cgRender();
}

var cgData={
  candle101:{en:'CANDLE BASICS',label:'أساسيات الشمعة',patterns:[
    {name:'Anatomy of a Candlestick',ar:'تشريح الشمعة اليابانية',rel:98,type:'START HERE',
    desc:'الشمعة اليابانية هي الوحدة الأساسية للشارت — تُظهر 4 أسعار في فترة زمنية واحدة. Open (الافتتاح)، High (الأعلى)، Low (الأدنى)، Close (الإغلاق). الجسم (Body) يعبر عن قوة الحركة، والذيول (Wicks) تعبر عن الرفض السعري.',
    fib:'Open (O): سعر الافتتاح — بداية الفترة\nHigh (H): أعلى سعر خلال الفترة\nLow (L): أدنى سعر خلال الفترة\nClose (C): سعر الإغلاق — نهاية الفترة\nBody: المسافة بين O و C\nWick/Shadow: الخطوط فوق وتحت الجسم',
    rules:'1. OHLC = أربعة أسعار في كل شمعة\n2. Close > Open = صعودية (بيضاء/خضراء)\n3. Close < Open = هبوطية (برتقالية/حمراء)\n4. جسم كبير = زخم قوي في اتجاه واحد\n5. ذيول طويلة = رفض سعري = مستوى مهم\n6. شمعة بلا ذيول (Marubozu) = سيطرة كاملة',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="40" y1="8" x2="40" y2="20" stroke="#fff" stroke-width="2"/><rect x="32" y="20" width="16" height="30" fill="#fff" rx="1"/><line x1="40" y1="50" x2="40" y2="65" stroke="#fff" stroke-width="2"/><line x1="80" y1="12" x2="80" y2="25" stroke="var(--o)" stroke-width="2"/><rect x="72" y="25" width="16" height="30" fill="var(--o)" rx="1"/><line x1="80" y1="55" x2="80" y2="70" stroke="var(--o)" stroke-width="2"/><text x="50" y="12" fill="#888" font-size="5" font-family="Share Tech Mono">HIGH</text><text x="50" y="27" fill="#fff" font-size="5" font-family="Share Tech Mono">CLOSE</text><text x="50" y="48" fill="#fff" font-size="5" font-family="Share Tech Mono">OPEN</text><text x="50" y="68" fill="#888" font-size="5" font-family="Share Tech Mono">LOW</text><text x="40" y="78" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BULLISH</text><text x="80" y="78" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">BEARISH</text>'},
    {name:'Timeframes — What They Mean',ar:'الفريمات الزمنية — ماذا تعني',rel:95,type:'ESSENTIAL',
    desc:'الفريم الزمني يُحدد المدة التي تُمثلها كل شمعة. كلما كبر الفريم كانت الإشارة أقوى وأكثر موثوقية لأنها تمثل فترة أطول وحجم تداول أكبر.',
    fib:'1m / 5m / 15m: سكالبينج — سريع جداً + ضوضاء كثيرة\n30m / 1H: تداول يومي — متوسط\n4H: أفضل فريم للتداول اليومي (توازن مثالي)\n1D: ملك الفريمات — أقوى إشارة + أقل ضوضاء\n1W: صورة كبرى — استثمار طويل\n1M: اتجاه عام — نادراً ما يُستخدم في التداول',
    rules:'1. كلما كبر الفريم = إشارة أقوى + ضوضاء أقل\n2. 1D = أفضل فريم للمبتدئين\n3. 4H = أفضل للتداول اليومي النشط\n4. لا تتداول على 1m/5m إلا بخبرة كبيرة\n5. ابدأ من فريم كبير وانزل للصغير (Top-Down)\n6. شمعة يومية تحتوي 6 شموع 4 ساعات',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="10" width="18" height="55" fill="rgba(255,255,255,0.03)" stroke="#888" stroke-width="0.5"/><rect x="28" y="10" width="18" height="55" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.5"/><rect x="48" y="10" width="18" height="55" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><rect x="68" y="10" width="18" height="55" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1"/><rect x="88" y="10" width="24" height="55" fill="rgba(255,106,0,0.08)" stroke="var(--o)" stroke-width="1.5"/><text x="17" y="40" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">1m</text><text x="37" y="40" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono">15m</text><text x="57" y="40" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">1H</text><text x="77" y="40" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">4H</text><text x="100" y="40" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">1D</text><text x="17" y="72" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">WEAK</text><text x="100" y="72" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">STRONG</text>'},
    {name:'Volume — The Fuel of Price',ar:'الحجم — وقود السعر',rel:90,type:'CONFIRMATION',
    desc:'الحجم (Volume) هو عدد الوحدات المتداولة خلال فترة الشمعة. حجم مرتفع = اهتمام كبير ومشاركة واسعة. السعر يُخبرك ماذا يحدث والحجم يُخبرك إن كان حقيقياً.',
    fib:'حجم مرتفع + صعود = صعود حقيقي مدعوم\nحجم مرتفع + هبوط = بيع حقيقي — استمرار\nحجم منخفض + صعود = ضعف — لا تثق\nحجم منخفض + هبوط = تصحيح مؤقت\nكسر S/R + حجم مرتفع = كسر حقيقي\nكسر S/R + حجم منخفض = كسر كاذب',
    rules:'1. الحجم يؤكد أو ينفي حركة السعر\n2. صعود/هبوط بحجم = حقيقي ومستمر\n3. صعود/هبوط بلا حجم = مشكوك فيه\n4. كسر S/R بحجم = كسر حقيقي — تداول عليه\n5. كسر بلا حجم = كاذب محتمل — لا تثق\n6. الحجم يسبق السعر — ارتفاعه ينذر بحركة كبيرة',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,45 20,40 30,38 40,35 50,30 60,25 70,22 80,20 90,18 100,15" fill="none" stroke="#fff" stroke-width="2"/><rect x="12" y="55" width="7" height="8" fill="#fff" opacity="0.3"/><rect x="22" y="52" width="7" height="11" fill="#fff" opacity="0.4"/><rect x="32" y="48" width="7" height="15" fill="#fff" opacity="0.5"/><rect x="42" y="45" width="7" height="18" fill="#fff" opacity="0.6"/><rect x="52" y="42" width="7" height="21" fill="#fff" opacity="0.7"/><rect x="62" y="38" width="7" height="25" fill="#fff" opacity="0.8"/><rect x="72" y="35" width="7" height="28" fill="#fff" opacity="0.85"/><rect x="82" y="32" width="7" height="31" fill="#fff" opacity="0.9"/><rect x="92" y="30" width="7" height="33" fill="#fff" opacity="1"/><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">VOLUME CONFIRMS PRICE</text>'}
  ]},
  drawing:{en:'DRAWING TOOLS',label:'أدوات الرسم',patterns:[
    {name:'Support & Resistance (S/R)',ar:'الدعم والمقاومة — أساس كل شيء',rel:98,type:'MOST IMPORTANT',
    desc:'الدعم يمنع المزيد من الهبوط، والمقاومة تمنع المزيد من الصعود. عندما يُكسر الدعم يتحول لمقاومة والعكس — هذا مفهوم أساسي.',
    fib:'الدعم: مستوى يرتد منه السعر صعوداً (أرضية)\nالمقاومة: مستوى يرتد منه هبوطاً (سقف)\n2+ لمسات = مستوى مؤكد\n3+ لمسات = مستوى قوي جداً\nدعم مكسور = يتحول لمقاومة\nمقاومة مكسورة = تتحول لدعم',
    rules:'1. ابحث عن مستوى لمسه السعر 2+ مرات\n2. ارسم خط أفقي عند المستوى\n3. S/R مناطق وليست خطوط دقيقة\n4. كلما زادت اللمسات = أقوى\n5. دعم مكسور = مقاومة جديدة والعكس\n6. S/R من فريم كبير أقوى من فريم صغير',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="25" x2="110" y2="25" stroke="var(--o)" stroke-width="2"/><line x1="10" y1="55" x2="110" y2="55" stroke="#fff" stroke-width="2"/><polyline points="12,52 20,48 25,52 30,42 35,38 38,30 40,28 42,30 45,35 48,42 52,52 55,48 60,52 65,42 68,35 72,28 75,30 78,38 82,48 85,52 90,48 95,38 100,30 105,28" fill="none" stroke="#888" stroke-width="1.5"/><text x="112" y="23" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">R</text><text x="112" y="53" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">S</text><circle cx="40" cy="28" r="2" fill="var(--o)"/><circle cx="72" cy="28" r="2" fill="var(--o)"/><circle cx="25" cy="52" r="2" fill="#fff"/><circle cx="52" cy="52" r="2" fill="#fff"/><circle cx="85" cy="52" r="2" fill="#fff"/>'},
    {name:'How to Draw Trendlines',ar:'كيف ترسم خط الاتجاه الصحيح',rel:92,type:'TREND TOOL',
    desc:'خط الاتجاه يربط بين نقطتين أو أكثر على نفس الجانب من الحركة السعرية. يعمل كدعم أو مقاومة ديناميكية. كسر الخط هو أول إشارة لتغير الاتجاه.',
    fib:'صاعد: يربط 2+ قيعان صاعدة (HL) = دعم ديناميكي\nهابط: يربط 2+ قمم هابطة (LH) = مقاومة ديناميكية\n2 نقاط = رسم | 3 نقاط = تأكيد\nارسم على الذيول (Wicks) وليس الأجسام\nكسر الخط = إشارة تغير اتجاه\nلا تُجبر الخط — يجب أن يكون واضح',
    rules:'1. صاعد: اربط القيعان الصاعدة (أسفل الشموع)\n2. هابط: اربط القمم الهابطة (أعلى الشموع)\n3. نقطتان للرسم + ثالثة للتأكيد\n4. ارسم على الذيول وليس الأجسام\n5. كسر خط الاتجاه بإغلاق شمعة = إشارة تغير\n6. لا تُجبر الخط — إذا لم يلمس 2+ نقاط فلا ترسمه',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="65" x2="100" y2="20" stroke="#fff" stroke-width="2"/><polyline points="10,65 18,55 22,60 28,50 32,55 40,42 45,48 52,38 58,42 65,30 70,35 78,25 85,28 92,22 100,20" fill="none" stroke="#888" stroke-width="1.5"/><circle cx="10" cy="65" r="3" fill="#fff"/><circle cx="40" cy="48" r="3" fill="#fff"/><circle cx="70" cy="35" r="3" fill="#fff"/><text x="12" y="75" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">POINT 1</text><text x="42" y="55" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">POINT 2</text><text x="72" y="42" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">CONFIRM</text><text x="55" y="12" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">UPTREND LINE</text>'},
    {name:'Price Channels — Parallel Lines',ar:'القنوات السعرية — الخطوط المتوازية',rel:85,type:'CHANNEL',
    desc:'القناة السعرية تتكون من خطين متوازيين يحتويان حركة السعر. شراء عند أسفل القناة وبيع عند أعلاها. كسر القناة يؤدي إلى تسارع أو انعكاس.',
    fib:'صاعدة: خط دعم صاعد + خط مقاومة موازٍ\nهابطة: خط مقاومة هابط + خط دعم موازٍ\nأفقية (Rectangle): خطان أفقيان = نطاق\nارتداد من أسفل = شراء | من أعلى = أخذ ربح\nكسر القناة = تسارع أو انعكاس\nالخط الأوسط (50%) = دعم/مقاومة وسطية',
    rules:'1. ارسم خط اتجاه أولاً (2+ نقاط)\n2. انسخ الخط وضعه على الجانب المقابل\n3. السعر يتذبذب بين الخطين\n4. شراء عند أسفل القناة + بيع عند أعلاها\n5. كسر القناة = حركة قوية في اتجاه الكسر\n6. خط المنتصف (50%) يعمل كـ S/R وسطي',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="8" y1="62" x2="108" y2="22" stroke="#fff" stroke-width="1.5"/><line x1="8" y1="42" x2="108" y2="2" stroke="#fff" stroke-width="1.5"/><line x1="8" y1="52" x2="108" y2="12" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><polyline points="12,58 20,48 25,52 32,42 38,48 45,38 52,45 58,35 65,40 72,30 78,35 85,25 92,30 100,22 108,18" fill="none" stroke="#888" stroke-width="1.5"/><text x="55" y="75" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">ASCENDING CHANNEL</text><circle cx="25" cy="52" r="2" fill="#fff"/><text x="25" y="62" text-anchor="middle" fill="#fff" font-size="4" font-family="Share Tech Mono">BUY</text><circle cx="58" cy="35" r="2" fill="var(--o)"/><text x="58" y="30" text-anchor="middle" fill="var(--o)" font-size="4" font-family="Share Tech Mono">TP</text>'},
    {name:'Identifying Trend on Any Timeframe',ar:'تحديد الاتجاه على أي فريم',rel:92,type:'TREND ID',
    desc:'تحديد الاتجاه هو أول خطوة قبل أي تداول. الطريقة البسيطة: صاعد = قمم وقيعان أعلى. هابط = قمم وقيعان أدنى. لا تتداول عكس الاتجاه العام.',
    fib:'HH + HL = صاعد (داو)\nLH + LL = هابط (داو)\nفوق EMA 200 = صاعد (متوسطات)\nتحت EMA 200 = هابط\nخط اتجاه يُحترم = اتجاه مستمر\nكسر خط اتجاه = تغيير محتمل',
    rules:'1. حدد الاتجاه قبل أي شيء آخر\n2. HH+HL = صاعد | LH+LL = هابط | لا = جانبي\n3. EMA 200: فوقه = صاعد | تحته = هابط\n4. طبّق على Weekly أولاً ثم Daily ثم 4H\n5. لا تتداول عكس الاتجاه على الفريم الكبير\n6. الاتجاه الواضح = أسهل وأربح من التذبذب',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="8,62 16,50 22,55 30,42 36,48 44,35 50,40 58,28 64,32 72,22 78,26 86,18 92,22 100,15" fill="none" stroke="#fff" stroke-width="2"/><circle cx="22" cy="55" r="2" fill="var(--o)"/><text x="22" y="62" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">HL</text><circle cx="16" cy="50" r="2" fill="#fff"/><text x="16" y="46" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">HH</text><circle cx="50" cy="40" r="2" fill="var(--o)"/><text x="50" y="47" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">HL</text><circle cx="44" cy="35" r="2" fill="#fff"/><text x="44" y="31" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">HH</text><line x1="8" y1="62" x2="78" y2="26" stroke="#888" stroke-width="0.8" stroke-dasharray="3,3"/><text x="55" y="75" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">UPTREND: HH + HL</text>'},
    {name:'Order Types — Market/Limit/Stop',ar:'أنواع الأوامر — السوق/المحدد/الإيقاف',rel:88,type:'EXECUTION',
    desc:'ثلاثة أنواع أوامر أساسية: أمر السوق (فوراً)، الأمر المحدد (بسعر معين)، ووقف الخسارة. القاعدة الذهبية: لا تفتح صفقة أبداً بدون وقف الخسارة.',
    fib:'Market Order: تنفيذ فوري بالسعر الحالي\nLimit Order: تنفيذ عند سعر محدد فقط\nStop Loss: إغلاق تلقائي عند خسارة محددة\nTake Profit: إغلاق تلقائي عند ربح محدد\nSlippage: فرق بين السعر المطلوب والمُنفذ\nLimit = أدق | Market = أسرع',
    rules:'1. Market Order: سريع لكن قد يكون Slippage\n2. Limit Order: أدق — استخدمه للدخول المحدد\n3. Stop Loss إلزامي — لا صفقة بدونه أبداً\n4. Take Profit: حدده قبل الدخول وليس بعده\n5. في السيولة المنخفضة: Limit أفضل من Market\n6. SL + TP = الفرق بين المتداول والمقامر',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="10" y1="30" x2="110" y2="30" stroke="#fff" stroke-width="0.8" stroke-dasharray="3,3"/><line x1="10" y1="50" x2="110" y2="50" stroke="#888" stroke-width="0.5" stroke-dasharray="2,2"/><line x1="10" y1="65" x2="110" y2="65" stroke="var(--o)" stroke-width="0.8" stroke-dasharray="3,3"/><text x="112" y="28" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">TP</text><text x="112" y="48" fill="#888" font-size="5" font-family="Share Tech Mono">ENTRY</text><text x="112" y="63" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">SL</text><rect x="40" y="28" width="30" height="4" fill="rgba(255,255,255,0.1)"/><text x="55" y="22" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">TAKE PROFIT</text><rect x="40" y="63" width="30" height="4" fill="rgba(255,106,0,0.1)"/><text x="55" y="75" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">STOP LOSS</text><circle cx="55" cy="50" r="4" fill="none" stroke="#fff" stroke-width="1.5"/><text x="55" y="53" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">BUY</text>'}
  ]},
  glossary:{en:'GLOSSARY',label:'قاموس المصطلحات',patterns:[
    {name:'Price Terms',ar:'مصطلحات السعر',rel:90,type:'PRICE',
    desc:'شرح مبسط لمصطلحات الأسعار الأساسية مثل ATH, ATL, Breakout, Pullback وغيرها.',
    fib:'ATH: أعلى سعر تاريخي\nATL: أدنى سعر تاريخي\nBreakout: كسر المقاومة صعوداً\nBreakdown: كسر الدعم هبوطاً\nPullback: تراجع مؤقت بعد صعود\nRetest: اختبار مستوى مكسور\nRally: صعود قوي | Dump: هبوط حاد\nWick: ذيل الشمعة | Gap: فجوة سعرية',
    rules:'1. ATH/ATL: أهم مستويات نفسية في السوق\n2. Breakout + Volume = كسر حقيقي\n3. Pullback = فرصة دخول بعد Breakout\n4. Retest = تأكيد الكسر (S/R Flip)\n5. Wick طويل = رفض سعري قوي\n6. Gap = السعر سيعود لملئها غالباً',
    svg:'<rect width="120" height="80" fill="#000"/><text x="60" y="15" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">PRICE TERMS</text><text x="15" y="30" fill="var(--o)" font-size="6" font-family="Share Tech Mono">ATH</text><text x="45" y="30" fill="#fff" font-size="5" font-family="Share Tech Mono">All-Time High</text><text x="15" y="40" fill="var(--o)" font-size="6" font-family="Share Tech Mono">BRK</text><text x="45" y="40" fill="#fff" font-size="5" font-family="Share Tech Mono">Breakout</text><text x="15" y="50" fill="var(--o)" font-size="6" font-family="Share Tech Mono">PB</text><text x="45" y="50" fill="#fff" font-size="5" font-family="Share Tech Mono">Pullback</text><text x="15" y="60" fill="var(--o)" font-size="6" font-family="Share Tech Mono">GAP</text><text x="45" y="60" fill="#fff" font-size="5" font-family="Share Tech Mono">Price Gap</text><text x="15" y="70" fill="var(--o)" font-size="6" font-family="Share Tech Mono">S/R</text><text x="45" y="70" fill="#fff" font-size="5" font-family="Share Tech Mono">Support/Resistance</text>'},
    {name:'Trading Terms',ar:'مصطلحات التداول',rel:88,type:'TRADING',
    desc:'Long: شراء. Short: بيع (تتوقع هبوط). R:R (Risk/Reward): نسبة المخاطرة للمكافأة. Leverage: الرافعة المالية.',
    fib:'Long: شراء — تتوقع صعود\nShort: بيع — تتوقع هبوط\nSL: وقف الخسارة (إلزامي)\nTP: أخذ الربح\nR:R: نسبة المخاطرة/المكافأة\nLeverage: رافعة مالية (خطر)\nDYOR: ابحث بنفسك\nNFA: ليست نصيحة مالية',
    rules:'1. Long = شراء | Short = بيع (عقود فقط)\n2. SL إلزامي في كل صفقة بلا استثناء\n3. R:R > 1:2 شرط أساسي لأي صفقة\n4. Leverage يُضاعف الربح والخسارة — خطر\n5. DYOR: لا تعتمد على أحد — ابحث بنفسك\n6. NFA: كل شيء هنا تعليمي وليس نصيحة مالية',
    svg:'<rect width="120" height="80" fill="#000"/><text x="60" y="15" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">TRADING TERMS</text><text x="15" y="30" fill="#fff" font-size="6" font-family="Share Tech Mono">LONG</text><text x="50" y="30" fill="#888" font-size="5" font-family="Share Tech Mono">Buy (expect up)</text><text x="15" y="40" fill="var(--o)" font-size="6" font-family="Share Tech Mono">SHORT</text><text x="50" y="40" fill="#888" font-size="5" font-family="Share Tech Mono">Sell (expect down)</text><text x="15" y="50" fill="var(--o)" font-size="6" font-family="Share Tech Mono">SL</text><text x="50" y="50" fill="#888" font-size="5" font-family="Share Tech Mono">Stop Loss</text><text x="15" y="60" fill="#fff" font-size="6" font-family="Share Tech Mono">TP</text><text x="50" y="60" fill="#888" font-size="5" font-family="Share Tech Mono">Take Profit</text><text x="15" y="70" fill="#fff" font-size="6" font-family="Share Tech Mono">R:R</text><text x="50" y="70" fill="#888" font-size="5" font-family="Share Tech Mono">Risk/Reward Ratio</text>'},
    {name:'Technical Analysis Terms',ar:'مصطلحات التحليل الفني',rel:85,type:'TA TERMS',
    desc:'Bullish: صعودي/إيجابي. Bearish: هبوطي/سلبي. Divergence: تباين. OB: Order Block. FVG: Fair Value Gap.',
    fib:'Bullish: صعودي | Bearish: هبوطي\nDivergence: تباين سعر/مؤشر\nConfluence: تقاطع عدة إشارات = أقوى\nBOS: كسر هيكل = استمرار\nCHoCH: تغيير هيكل = انعكاس\nOB: كتلة أوامر مؤسسية\nFVG: فجوة قيمة عادلة\nPRZ: منطقة انعكاس محتملة',
    rules:'1. Bullish/Bearish: أول مصطلحين يجب حفظهما\n2. Confluence = عدة إشارات في نفس المنطقة = أقوى\n3. BOS = استمرار | CHoCH = انعكاس\n4. OB + FVG = أهم مفاهيم SMC\n5. HH/HL = صاعد | LH/LL = هابط (داو)\n6. احفظ هذه المصطلحات — ستراها في كل درس',
    svg:'<rect width="120" height="80" fill="#000"/><text x="60" y="15" text-anchor="middle" fill="var(--o)" font-size="9" font-family="Share Tech Mono" font-weight="900">TA TERMS</text><text x="12" y="28" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">BOS</text><text x="35" y="28" fill="#888" font-size="5" font-family="Share Tech Mono">Break of Structure</text><text x="12" y="38" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">CHoCH</text><text x="42" y="38" fill="#888" font-size="5" font-family="Share Tech Mono">Change of Character</text><text x="12" y="48" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">OB</text><text x="28" y="48" fill="#888" font-size="5" font-family="Share Tech Mono">Order Block</text><text x="12" y="58" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">FVG</text><text x="32" y="58" fill="#888" font-size="5" font-family="Share Tech Mono">Fair Value Gap</text><text x="12" y="68" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">OTE</text><text x="32" y="68" fill="#888" font-size="5" font-family="Share Tech Mono">Optimal Trade Entry</text>'},
    {name:'Blockchain & Crypto Terms',ar:'مصطلحات البلوكتشين والكريبتو',rel:82,type:'CRYPTO',
    desc:'HODL: احتفظ. Whale: حوت. DeFi: التمويل اللامركزي. TVL: القيمة المقفلة. Halving: تنصيف مكافأة تعدين BTC.',
    fib:'HODL: احتفظ ولا تبيع\nWhale: حوت — كمية ضخمة\nDeFi: تمويل لامركزي\nDEX: منصة لامركزية | CEX: مركزية\nTVL: القيمة المقفلة في DeFi\nGas: رسوم المعاملات\nHalving: تنصيف BTC كل 4 سنوات\nRug Pull: احتيال — تجنبه',
    rules:'1. HODL: استراتيجية طويلة المدى — لا تبيع بذعر\n2. Whale = لاعب كبير — راقب حركته\n3. DEX vs CEX: اللامركزي أكثر أمان لكن أقل سيولة\n4. Gas مرتفع = الشبكة مشغولة = نشاط عالي\n5. Halving كل 4 سنوات = حدث صعودي لـ BTC\n6. Rug Pull: تحقق من المشروع قبل الاستثمار (DYOR)',
    svg:'<rect width="120" height="80" fill="#000"/><text x="60" y="15" text-anchor="middle" fill="#fff" font-size="9" font-family="Share Tech Mono" font-weight="900">CRYPTO TERMS</text><text x="12" y="28" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">HODL</text><text x="40" y="28" fill="#888" font-size="5" font-family="Share Tech Mono">Hold, dont sell</text><text x="12" y="38" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">WHALE</text><text x="42" y="38" fill="#888" font-size="5" font-family="Share Tech Mono">Big holder</text><text x="12" y="48" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">DeFi</text><text x="35" y="48" fill="#888" font-size="5" font-family="Share Tech Mono">Decentralized Finance</text><text x="12" y="58" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">HALVING</text><text x="50" y="58" fill="#888" font-size="5" font-family="Share Tech Mono">BTC supply cut /4yr</text><text x="12" y="68" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">GAS</text><text x="32" y="68" fill="#888" font-size="5" font-family="Share Tech Mono">Transaction fees</text>'}
  ]}
};

function cgRender(){
  var cat=cgData[cgCurrentCat];
  if(!cat) return;
  var el=document.getElementById('cg-content');
  if(cgSelectedIdx>=0 && cgSelectedIdx<cat.patterns.length){
    el.innerHTML=cgRenderDetail(cat.patterns[cgSelectedIdx]);
    return;
  }
  var h='<div class="cg-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    h+='<div class="cg-card" style="border-top:3px solid #fff" onclick="cgSelect('+i+')">';
    h+='<div class="cg-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
    h+='<div class="cg-card-name">'+p.name+'</div><div class="cg-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="cg-card-type">'+p.type+'</div>';
    h+='<div class="cg-card-rel-row"><span class="cg-card-rel-l">IMPORTANCE</span><span class="cg-card-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="cg-card-bar"><div class="cg-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="cg-footer">هذه الأداة هي نقطة البداية في الكورس. فهم الشمعة، الفريمات، الحجم، الـ S/R، وخطوط الاتجاه هو الأساس الذي يُبنى عليه كل شيء. القاموس مرجع سريع لكل المصطلحات. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function cgRenderDetail(p){
  var h='<div class="cg-back" onclick="cgBack()">رجوع</div><div class="cg-detail">';
  h+='<div class="cg-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
  h+='<div class="cg-detail-name">'+p.name+'</div><div class="cg-detail-ar">'+p.ar+'</div>';
  if(p.type) h+='<div class="cg-detail-badge">'+p.type+'</div>';
  h+='<div class="cg-detail-rel-row"><span class="cg-detail-rel-l">IMPORTANCE</span><span class="cg-detail-rel-v" style="color:'+(p.rel>=85?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="cg-detail-bar"><div class="cg-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=85?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="cg-detail-desc-wrap"><div class="cg-detail-desc-label">DESCRIPTION // الوصف</div><div class="cg-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="cg-detail-fib-wrap"><div class="cg-detail-fib-label">KEY POINTS // النقاط الأساسية</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="cg-fib-row"><span class="cg-fib-arrow">▶</span><span class="cg-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="cg-detail-rules-wrap"><div class="cg-detail-rules-label">RULES // القواعد</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="cg-rule-row"><span class="cg-rule-num">'+r[i].substring(0,2)+'</span><span class="cg-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

/* =====================================================================
   ECONOMIC CYCLE & FORECASTING ENGINE - 360° PLATFORM
===================================================================== */
var ecCurrentCat='cycle';
var ecSelectedIdx=-1;

function ecSetCat(cat,btn){
  ecCurrentCat=cat; ecSelectedIdx=-1;
  var b=document.querySelectorAll('.ec-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('ec-cat-active');
  btn.classList.add('ec-cat-active');
  ecRender();
}

function ecSelect(idx){ ecSelectedIdx=idx; ecRender(); }
function ecBack(){ ecSelectedIdx=-1; ecRender(); }

function ecInit(){
  var h='';
  var k=Object.keys(ecData);
  for(var i=0;i<k.length;i++){
    var c=ecData[k[i]];
    h+='<button class="ec-cat-btn'+(k[i]===ecCurrentCat?' ec-cat-active':'')+'" onclick="ecSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('ec-cat-tabs').innerHTML=h;
  ecRender();
}

var ecData={
  cycle:{en:'ECONOMIC CYCLE',label:'الدورة الاقتصادية',patterns:[
    {name:'The 4 Phases of Economic Cycle',ar:'المراحل الأربع للدورة الاقتصادية',rel:98,type:'MASTER FRAMEWORK',
    desc:'كل اقتصاد يمر بـ 4 مراحل تتكرر بشكل دوري. 1) التوسع (Expansion): الاقتصاد ينمو. 2) القمة (Peak): النمو يصل ذروته. 3) الركود (Recession): الاقتصاد ينكمش. 4) التعافي (Recovery): القاع يتشكل وتبدأ السيولة بالعودة. كل دورة تستغرق 4-10 سنوات. المفتاح: اعرف في أي مرحلة أنت الآن.',
    fib:'Expansion: نمو + وظائف + أرباح = أسهم وكريبتو تصعد\nPeak: تضخم + تشديد = أول تحذير — بع تدريجياً\nRecession: انكماش + خوف = أسهم وكريبتو تهبط\nRecovery: تيسير + سيولة = أفضل وقت شراء\nالدورة: 4-10 سنوات\nالمفتاح: حدد المرحلة الحالية = حدد استراتيجيتك',
    rules:'1. Expansion = اشترِ واستمر (Trend Following)\n2. Peak = ابدأ البيع التدريجي (Take Profits)\n3. Recession = احمِ رأس المال (Cash/Stablecoins)\n4. Recovery = أفضل شراء (التجميع المؤسسي)\n5. لا تحارب الدورة — اركب الموجة\n6. كل مرحلة لها أصول رابحة وأصول خاسرة',
    svg:'<rect width="120" height="80" fill="#000"/><path d="M 10,50 Q 30,15 55,15 Q 80,15 90,50 Q 100,75 110,50" fill="none" stroke="#fff" stroke-width="2.5"/><text x="15" y="45" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">RECOVERY</text><text x="42" y="12" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">EXPANSION</text><text x="75" y="12" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">PEAK</text><text x="90" y="55" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">RECESSION</text><circle cx="30" cy="25" r="2" fill="#fff"/><circle cx="65" cy="15" r="2" fill="var(--o)"/><circle cx="95" cy="62" r="2" fill="var(--o)"/><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">CYCLE REPEATS EVERY 4-10 YEARS</text>'},
    {name:'What Wins in Each Phase',ar:'ماذا يربح في كل مرحلة',rel:95,type:'ASSET ALLOCATION',
    desc:'كل مرحلة لها أصول رابحة وخاسرة. Expansion: الأسهم والكريبتو بقوة. Peak: السلع (بترول/معادن) والكاش. Recession: السندات والذهب والدولار. Recovery: الكريبتو يبدأ الصعود أولاً ثم الأسهم. المحترف يُحوّل أمواله بين الأصول حسب المرحلة.',
    fib:'Expansion: أسهم Growth + كريبتو = الأقوى\nPeak: سلع (بترول/معادن) + Cash\nRecession: سندات + ذهب + دولار + Cash\nRecovery: كريبتو أولاً ثم أسهم\nBTC يقود التعافي — أعلى Beta\nالتحويل بين الأصول = سر الأداء المتفوق',
    rules:'1. Expansion: كن في الأسهم والكريبتو\n2. Peak: ابدأ التحول للسلع والـ Cash\n3. Recession: اهرب للسندات والذهب والـ Cash\n4. Recovery: عُد للكريبتو أولاً ثم الأسهم\n5. لا تبقَ في نفس الأصل طوال الدورة\n6. BTC يتحرك أولاً في Recovery — لا تتأخر',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="5" y="8" width="25" height="16" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><text x="18" y="14" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">EXPANSION</text><text x="18" y="21" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">STOCKS+BTC</text><rect x="33" y="8" width="25" height="16" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="0.8"/><text x="46" y="14" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">PEAK</text><text x="46" y="21" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">OIL+CASH</text><rect x="61" y="8" width="25" height="16" fill="rgba(255,106,0,0.08)" stroke="var(--o)" stroke-width="0.8"/><text x="74" y="14" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">RECESSION</text><text x="74" y="21" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">GOLD+BONDS</text><rect x="89" y="8" width="25" height="16" fill="rgba(255,255,255,0.08)" stroke="#fff" stroke-width="1"/><text x="102" y="14" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">RECOVERY</text><text x="102" y="21" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">BTC FIRST</text><path d="M 10,45 Q 30,30 55,30 Q 80,30 95,50 Q 105,62 115,48" fill="none" stroke="#fff" stroke-width="2"/><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">ROTATE ASSETS WITH THE CYCLE</text>'},
    {name:'Liquidity Cycle — The Real Driver',ar:'دورة السيولة — المحرك الحقيقي',rel:95,type:'CRYPTO ENGINE',
    desc:'السيولة العالمية هي المحرك الأساسي لأسعار الكريبتو. تتوسع عندما تطبع البنوك المركزية (QE). تنكمش عندما تسحب الأموال (QT). BTC يتبع السيولة العالمية بتأخر 3-6 أشهر بدقة مذهلة.',
    fib:'QE (طباعة): سيولة تتوسع → BTC يصعد بقوة\nQT (سحب): سيولة تنكمش → BTC يهبط\nRate Cut: سيولة تتحسن → إيجابي\nRate Hike: سيولة تتقلص → سلبي\nM2 العالمي يتحول للصعود = BTC يتبع بعد 3-6 أشهر\nFed + ECB + BOJ + PBOC = السيولة العالمية',
    rules:'1. السيولة تتوسع = اشترِ كريبتو بقوة\n2. السيولة تنكمش = احمِ رأس المال\n3. BTC يتبع السيولة بتأخر 3-6 أشهر\n4. راقب M2 العالمي\n5. تحول السيولة من انكماش لتوسع = إشارة شراء\n6. السيولة أهم من أي تحليل فني',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,48 18,45 25,42 32,38 38,32 45,28 52,25 58,22 65,20 72,18 78,16 85,15 92,14 100,13" fill="none" stroke="#fff" stroke-width="2.5"/><polyline points="18,52 25,48 32,45 38,40 45,35 52,30 58,26 65,22 72,20 78,18 85,16 92,15 100,14 108,13" fill="none" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="4,3"/><text x="102" y="11" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">M2</text><text x="110" y="15" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="55" y="10" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">LIQUIDITY DRIVES BTC</text><text x="55" y="68" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">M2 UP = BTC UP (3-6M LAG)</text><text x="55" y="78" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">2020: QE → BTC $5K→$69K</text>'},
    {name:'How to Know Which Phase We Are In',ar:'كيف تعرف في أي مرحلة نحن الآن',rel:92,type:'IDENTIFICATION',
    desc:'تحديد المرحلة الحالية يتطلب مراقبة مجموعة من المؤشرات معاً: GDP، البطالة، التضخم، الفائدة، منحنى العائد، والسيولة M2.',
    fib:'Expansion: GDP+ | Jobs+ | ISM>50 | Profits+\nPeak: CPI++ | Fed Hiking | Yield Flat | Commodities+\nRecession: GDP- | Jobs- | ISM<50 | Yield Inverted\nRecovery: Fed Cutting | M2+ | Yield Normal | Leading+\nLeading Indicators تتحول أولاً (6-12 شهر قبل)\nLagging Indicators تؤكد لاحقاً',
    rules:'1. لا مؤشر واحد يكفي — اجمع 5+ مؤشرات\n2. Leading Indicators تسبق الواقع بـ 6-12 شهر\n3. GDP والبطالة متأخرة — لا تنتظرها للقرار\n4. Yield Curve أدق مؤشر ركود\n5. M2 يتحول = المرحلة التالية بدأت\n6. الانتقال بين المراحل تدريجي وليس مفاجئ',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="12" width="24" height="52" fill="rgba(255,255,255,0.04)" stroke="#fff" stroke-width="0.5"/><rect x="34" y="12" width="24" height="52" fill="rgba(255,106,0,0.04)" stroke="var(--o)" stroke-width="0.5"/><rect x="60" y="12" width="24" height="52" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="0.8"/><rect x="86" y="12" width="28" height="52" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="0.8"/><text x="20" y="22" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">EXPAND</text><text x="20" y="32" fill="#888" font-size="4" font-family="Share Tech Mono">GDP+</text><text x="20" y="40" fill="#888" font-size="4" font-family="Share Tech Mono">Jobs+</text><text x="20" y="48" fill="#888" font-size="4" font-family="Share Tech Mono">ISM>50</text><text x="46" y="22" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">PEAK</text><text x="46" y="32" fill="#888" font-size="4" font-family="Share Tech Mono">CPI++</text><text x="46" y="40" fill="#888" font-size="4" font-family="Share Tech Mono">Hikes</text><text x="46" y="48" fill="#888" font-size="4" font-family="Share Tech Mono">YC Flat</text><text x="72" y="22" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">RECESS</text><text x="72" y="32" fill="#888" font-size="4" font-family="Share Tech Mono">GDP-</text><text x="72" y="40" fill="#888" font-size="4" font-family="Share Tech Mono">Jobs-</text><text x="72" y="48" fill="#888" font-size="4" font-family="Share Tech Mono">YC Inv</text><text x="100" y="22" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">RECOVER</text><text x="100" y="32" fill="#888" font-size="4" font-family="Share Tech Mono">Cuts</text><text x="100" y="40" fill="#888" font-size="4" font-family="Share Tech Mono">M2+</text><text x="100" y="48" fill="#888" font-size="4" font-family="Share Tech Mono">YC Norm</text><text x="55" y="74" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">COMBINE 5+ INDICATORS TO IDENTIFY</text>'}
  ]},
  scenarios:{en:'SCENARIOS',label:'ربط البيانات',patterns:[
    {name:'Scenario 1: Overheating',ar:'السيناريو 1: الاقتصاد المحموم',rel:90,type:'DANGER ZONE',
    desc:'CPI يرتفع بقوة + بطالة منخفضة جداً + أجور ترتفع. الاقتصاد ينمو بسرعة أكبر من المستدام. الفيدرالي سيرفع الفائدة بقوة. التأثير على الكريبتو: سلبي جداً.',
    fib:'CPI > 5%: تضخم خطير\nبطالة < 4%: سوق عمل ساخن\nأجور > 5%: Wage-Price Spiral\nFed يرفع بقوة: 50-75bps في كل اجتماع\nBTC يهبط 50-80% في هذا السيناريو\n2022: مثال حي — BTC من $69K لـ $16K',
    rules:'1. CPI مرتفع + بطالة منخفضة = Overheating\n2. الفيدرالي سيُشدد بقوة = سلبي للكريبتو\n3. بع تدريجياً وحوّل لـ Cash/Stablecoins\n4. لا تشترِ حتى يتراجع CPI بوضوح\n5. هذا السيناريو قد يستمر 12-18 شهر\n6. 2022 = المثال الكلاسيكي',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,60 20,52 30,45 40,35 50,28 60,22 70,18 78,15 85,12" fill="none" stroke="var(--o)" stroke-width="2"/><text x="87" y="10" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">CPI</text><polyline points="10,22 20,28 30,35 40,42 50,48 60,55 70,60 78,65 85,68" fill="none" stroke="#fff" stroke-width="2"/><text x="87" y="72" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC</text><text x="55" y="78" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">CPI UP = BTC DOWN</text>'},
    {name:'Scenario 2: Goldilocks',ar:'السيناريو 2: الاقتصاد المثالي (Goldilocks)',rel:92,type:'BEST CASE',
    desc:'CPI ينخفض نحو 2% + GDP إيجابي + بطالة مستقرة. أفضل بيئة ممكنة. التأثير على الكريبتو: إيجابي جداً.',
    fib:'CPI 2-3%: تضخم مسيطر عليه\nGDP 2-3%: نمو صحي\nبطالة 3.5-4.5%: مستقرة\nFed: تثبيت أو خفض تدريجي\nBTC يصعد 100-300%+ في Goldilocks\nأفضل بيئة ممكنة لكل الأصول الخطرة',
    rules:'1. CPI ينخفض + GDP إيجابي = Goldilocks\n2. أفضل بيئة للكريبتو والأسهم\n3. اشترِ واحتفظ — لا تُعقّد الأمور\n4. كن عدواني في الشراء\n5. Goldilocks لا يدوم — راقب التحولات\n6. 2024-2025 مثال قريب',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,55 20,48 30,42 40,35 50,28 60,22 70,18 80,15 90,12 100,10" fill="none" stroke="#fff" stroke-width="2.5"/><text x="102" y="8" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">BTC</text><rect x="15" y="60" width="90" height="14" fill="rgba(255,255,255,0.04)"/><text x="60" y="70" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">CPI STABLE + GDP POSITIVE</text><text x="55" y="78" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">GOLDILOCKS = BUY & HOLD</text>'},
    {name:'Scenario 3: Stagflation',ar:'السيناريو 3: الركود التضخمي',rel:88,type:'WORST CASE',
    desc:'CPI مرتفع + GDP سلبي أو ضعيف + بطالة ترتفع. أسوأ سيناريو ممكن. التضخم مرتفع لكن الاقتصاد لا ينمو. كل شيء يخسر ما عدا الذهب والسلع.',
    fib:'CPI > 5% + GDP < 0% = Stagflation\nبطالة ترتفع + أسعار ترتفع = كارثة\nالفيدرالي عاجز — لا حل سهل\nالذهب والسلع = الرابح الوحيد\nأسهم + كريبتو + سندات = كلها تخسر\nنادر لكن مُدمّر — أخطر سيناريو',
    rules:'1. تضخم مرتفع + نمو سلبي = Stagflation\n2. أخطر سيناريو — لا ملاذ آمن تقليدي\n3. الذهب والسلع فقط = ملاذ نسبي\n4. BTC غير مُثبت كملاذ في Stagflation\n5. Cash/Stablecoins = الأمان في الانتظار\n6. نادر الحدوث — لكن جهّز خطة طوارئ',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,15 20,18 30,22 40,20 50,24 60,22 70,25 80,22 90,25 100,23" fill="none" stroke="var(--o)" stroke-width="2"/><text x="102" y="21" fill="var(--o)" font-size="5" font-family="Share Tech Mono">CPI HIGH</text><polyline points="10,55 20,52 30,56 40,58 50,55 60,58 70,60 80,62 90,58 100,60" fill="none" stroke="#fff" stroke-width="2"/><text x="102" y="62" fill="#fff" font-size="5" font-family="Share Tech Mono">GDP LOW</text><text x="55" y="42" text-anchor="middle" fill="var(--o)" font-size="10" font-family="Share Tech Mono" font-weight="900">STAGFLATION</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">WORST CASE — EVERYTHING LOSES</text>'},
    {name:'Scenario 4: Deflation/Recession',ar:'السيناريو 4: الركود الانكماشي',rel:85,type:'BUY OPPORTUNITY',
    desc:'CPI ينخفض بسرعة + GDP سلبي + بطالة ترتفع. الفيدرالي يتدخل بقوة بخفض حاد للفائدة و QE. سلبي في البداية لكنه يُنتج أفضل فرصة شراء قادمة.',
    fib:'CPI ينخفض بسرعة أو سالب\nGDP سلبي لفصلين = ركود رسمي\nبطالة ترتفع بسرعة\nFed يخفض الفائدة لـ 0% + QE\nسلبي في البداية (6-12 شهر)\nثم أفضل فرصة شراء (السيولة تنفجر)',
    rules:'1. Recession = خوف = أفضل فرصة شراء تاريخياً\n2. انتظر: Fed يبدأ الخفض + M2 يتحول = إشارة الشراء\n3. لا تشترِ فوراً عند بداية الركود\n4. QE بعد الركود = أقوى وقود للكريبتو\n5. 2020 = المثال المثالي\n6. Fear & Greed < 20 + Fed Cutting = اشترِ بقوة',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,20 20,25 30,32 40,40 50,48 55,55 58,60 60,65" fill="none" stroke="var(--o)" stroke-width="2"/><circle cx="60" cy="65" r="5" fill="none" stroke="#fff" stroke-width="2"/><text x="60" y="68" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">BUY</text><polyline points="60,65 65,58 70,48 75,38 80,30 85,22 90,18 95,15 100,12 108,10" fill="none" stroke="#fff" stroke-width="2.5"/><text x="35" y="15" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">RECESSION</text><text x="88" y="8" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">QE RALLY</text><text x="55" y="78" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">CRISIS = OPPORTUNITY</text>'},
    {name:'Scenario 5: M2 Turning Point',ar:'السيناريو 5: نقطة تحول السيولة',rel:92,type:'BTC SIGNAL',
    desc:'أهم سيناريو عملي للكريبتو. عندما M2 العالمي يتحول من انكماش إلى توسع = BTC سيصعد خلال 3-6 أشهر.',
    fib:'M2 MoM يتحول من سالب لموجب = إشارة أولى\n2-3 أشهر موجب متتالي = تأكيد\nFed يتوقف عن QT = إشارة ثانية\nDXY يبدأ الهبوط = إشارة ثالثة\nYield Curve Un-inversion = إشارة رابعة\n3/4 إشارات = ابدأ التجميع',
    rules:'1. M2 يتحول للصعود = أقوى إشارة شراء BTC\n2. انتظر 2-3 أشهر تأكيد (لا شهر واحد)\n3. اجمع مع: Fed يتوقف + DXY يهبط + YC يعود\n4. 3/4 إشارات = ابدأ التجميع التدريجي\n5. BTC يتبع بعد 3-6 أشهر\n6. لا تنتظر التأكيد الكامل — القاع يتشكل في الخوف',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,30 20,32 30,35 40,38 48,40 52,42 56,40 60,38 65,35 70,30 75,28 80,25 85,22 90,20 95,18 100,16" fill="none" stroke="#fff" stroke-width="2.5"/><line x1="52" y1="10" x2="52" y2="65" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="3,3"/><circle cx="52" cy="42" r="5" fill="none" stroke="var(--o)" stroke-width="2"/><text x="52" y="72" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">TURNING POINT</text><text x="25" y="25" fill="var(--o)" font-size="6" font-family="Share Tech Mono">M2 FALLING</text><text x="78" y="14" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">M2 RISING</text><text x="78" y="48" fill="#fff" font-size="5" font-family="Share Tech Mono">BTC FOLLOWS</text>'}
  ]},
  playbook:{en:'CRYPTO PLAYBOOK',label:'التطبيق العملي',patterns:[
    {name:'Macro Scorecard — Weekly Check',ar:'بطاقة الأداء الكلي — فحص أسبوعي',rel:95,type:'WEEKLY RITUAL',
    desc:'جدول من 10 مؤشرات تملؤه كل أسبوع لتحديد البيئة الكلية. 7/10+ إيجابي = بيئة شراء عدوانية. 0-2/10 = بيئة بيع.',
    fib:'1. DXY: هابط=+1 | صاعد=-1\n2. M2: صاعد=+1 | هابط=-1\n3. Fed: Dovish=+1 | Hawkish=-1\n4. CPI: ينخفض=+1 | يرتفع=-1\n5. Yield Curve: طبيعي=+1 | مقلوب=-1\n6. S&P: صاعد=+1 | هابط=-1\n7. BTC: فوق 200MA=+1 | تحت=-1\n8. BTC.D: ينخفض=+1 | يرتفع=0\n9. F&G: <30=+1 | >75=-1\n10. NUPL: <0.25=+1 | >0.75=-1',
    rules:'1. املأ البطاقة كل أحد/اثنين\n2. 7/10+ = شراء عدواني بحجم كامل\n3. 5-6/10 = تداول عادي بحجم متوسط\n4. 3-4/10 = حذر — قلّص المراكز\n5. 0-2/10 = لا تشترِ — Cash/Stablecoins\n6. البطاقة تمنعك من التداول ضد البيئة الكلية',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="8" width="104" height="58" fill="rgba(255,255,255,0.02)" stroke="#888" stroke-width="0.5"/><text x="14" y="18" fill="#888" font-size="5" font-family="Share Tech Mono">DXY</text><text x="50" y="18" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><text x="14" y="26" fill="#888" font-size="5" font-family="Share Tech Mono">M2</text><text x="50" y="26" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><text x="14" y="34" fill="#888" font-size="5" font-family="Share Tech Mono">FED</text><text x="50" y="34" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><text x="14" y="42" fill="#888" font-size="5" font-family="Share Tech Mono">CPI</text><text x="50" y="42" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">-1</text><text x="14" y="50" fill="#888" font-size="5" font-family="Share Tech Mono">YC</text><text x="50" y="50" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><text x="65" y="18" fill="#888" font-size="5" font-family="Share Tech Mono">S&P</text><text x="100" y="18" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><text x="65" y="26" fill="#888" font-size="5" font-family="Share Tech Mono">BTC</text><text x="100" y="26" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><text x="65" y="34" fill="#888" font-size="5" font-family="Share Tech Mono">BTC.D</text><text x="100" y="34" fill="#888" font-size="5" font-family="Share Tech Mono">0</text><text x="65" y="42" fill="#888" font-size="5" font-family="Share Tech Mono">F&G</text><text x="100" y="42" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><text x="65" y="50" fill="#888" font-size="5" font-family="Share Tech Mono">NUPL</text><text x="100" y="50" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">+1</text><rect x="8" y="54" width="104" height="12" fill="rgba(255,255,255,0.06)"/><text x="60" y="63" text-anchor="middle" fill="#fff" font-size="8" font-family="Share Tech Mono" font-weight="900">SCORE: 8/10 = BUY</text>'},
    {name:'Bitcoin Halving + Macro = Perfect Timing',ar:'تنصيف بتكوين + الاقتصاد الكلي = التوقيت المثالي',rel:90,type:'CYCLE SYNC',
    desc:'Halving يُقلّص العرض. Macro يُحدد الطلب. الاثنان معاً في نفس الاتجاه الإيجابي يصنعان انفجاراً سعرياً.',
    fib:'Halving: كل 4 سنوات — العرض ينخفض 50%\nHalving + QE: أقوى صعود (2020)\nHalving + QT: صعود أضعف أو متأخر\nBull Market يبدأ 6-12 شهر بعد Halving\nالقمة: 12-18 شهر بعد Halving تقريباً\nHalving = العرض | Macro = الطلب',
    rules:'1. Halving يُقلّص العرض — Macro يُحدد الطلب\n2. Halving + سيولة متوسعة = أقوى سيناريو\n3. Halving + سيولة منكمشة = صعود متأخر/أضعف\n4. ابدأ التجميع قبل Halving بـ 6 أشهر\n5. Bull Market عادة 12-18 شهر بعد Halving\n6. لا تعتمد على Halving وحده — راقب Macro',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="30" y1="5" x2="30" y2="70" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="3,3"/><text x="30" y="4" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">HALVING</text><polyline points="10,55 15,52 20,50 25,48 30,45 35,40 40,35 45,28 50,22 55,18 60,15 65,12 70,10 75,12 80,15 85,20 90,28" fill="none" stroke="#fff" stroke-width="2.5"/><text x="65" y="8" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">PEAK</text><text x="15" y="62" fill="#888" font-size="5" font-family="Share Tech Mono">ACCUMULATE</text><text x="45" y="42" fill="#fff" font-size="5" font-family="Share Tech Mono">BULL RUN</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">HALVING + MACRO = PERFECT TIMING</text>'},
    {name:'4 Macro Regimes — Your Playbook',ar:'4 أنظمة كلية — كتاب عملياتك',rel:92,type:'MASTER GUIDE',
    desc:'كل لحظة تقع في واحد من 4 أنظمة. حدد النظام الحالي وطبّق الاستراتيجية المناسبة لمحفظتك.',
    fib:'Goldilocks: نمو+ تضخم-  → BTC+Stocks+Alts\nReflation: نمو++ تضخم+ → Oil+Gold+BTC\nStagflation: نمو- تضخم+ → Gold+Cash فقط\nDeflation: نمو- تضخم- → Cash ثم BTC عند QE\nحدد النظام = حدد الاستراتيجية\nالنظام يتغير كل 6-18 شهر',
    rules:'1. Goldilocks = كن عدواني في الكريبتو والأسهم\n2. Reflation = كن في السلع والذهب + BTC بحذر\n3. Stagflation = اهرب للذهب والـ Cash\n4. Deflation = Cash ثم اشترِ BTC عند بداية QE\n5. حدد النظام كل أسبوع بالبطاقة الكلية\n6. لا تطبّق نفس الاستراتيجية في كل الأنظمة',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="60" y1="5" x2="60" y2="72" stroke="#888" stroke-width="0.5"/><line x1="10" y1="38" x2="110" y2="38" stroke="#888" stroke-width="0.5"/><rect x="12" y="7" width="46" height="29" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="1"/><text x="35" y="18" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">GOLDILOCKS</text><text x="35" y="28" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">BTC + STOCKS</text><rect x="62" y="7" width="46" height="29" fill="rgba(255,106,0,0.04)" stroke="var(--o)" stroke-width="0.8"/><text x="85" y="18" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">REFLATION</text><text x="85" y="28" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">OIL + GOLD</text><rect x="12" y="40" width="46" height="29" fill="rgba(255,106,0,0.08)" stroke="var(--o)" stroke-width="1"/><text x="35" y="51" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">STAGFLATION</text><text x="35" y="61" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">GOLD + CASH</text><rect x="62" y="40" width="46" height="29" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.8"/><text x="85" y="51" text-anchor="middle" fill="#888" font-size="7" font-family="Share Tech Mono" font-weight="900">DEFLATION</text><text x="85" y="61" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">CASH→BTC</text><text x="35" y="4" fill="#888" font-size="5" font-family="Share Tech Mono" text-anchor="middle">GROWTH+</text><text x="85" y="4" fill="#888" font-size="5" font-family="Share Tech Mono" text-anchor="middle">INFLATION+</text>'}
  ]}
};

function ecRender(){
  var cat=ecData[ecCurrentCat];
  if(!cat) return;
  var el=document.getElementById('ec-content');
  if(ecSelectedIdx>=0 && ecSelectedIdx<cat.patterns.length){
    el.innerHTML=ecRenderDetail(cat.patterns[ecSelectedIdx]);
    return;
  }
  var h='<div class="ec-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    var isDanger=p.type&&(p.type.indexOf('DANGER')>=0||p.type.indexOf('WORST')>=0);
    var topC=isDanger?'var(--o)':'#fff';
    h+='<div class="ec-card" style="border-top:3px solid '+topC+'" onclick="ecSelect('+i+')">';
    h+='<div class="ec-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
    h+='<div class="ec-card-name">'+p.name+'</div><div class="ec-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="ec-card-type">'+p.type+'</div>';
    h+='<div class="ec-card-rel-row"><span class="ec-card-rel-l">IMPORTANCE</span><span class="ec-card-rel-v" style="color:'+(p.rel>=90?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="ec-card-bar"><div class="ec-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=90?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="ec-footer">التحليل الفني يُحدد أين تدخل، الاقتصاد الكلي يُحدد في أي اتجاه. لا تتجاهل دورة الاقتصاد. املأ بطاقة الأداء أسبوعياً للنجاح. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function ecRenderDetail(p){
  var h='<div class="ec-back" onclick="ecBack()">رجوع</div><div class="ec-detail">';
  h+='<div class="ec-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
  h+='<div class="ec-detail-name">'+p.name+'</div><div class="ec-detail-ar">'+p.ar+'</div>';
  if(p.type){
    var bc=p.type.indexOf('DANGER')>=0||p.type.indexOf('WORST')>=0?'var(--o)':'#fff';
    h+='<div class="ec-detail-badge" style="background:'+bc+';color:#000">'+p.type+'</div>';
  }
  h+='<div class="ec-detail-rel-row"><span class="ec-detail-rel-l">IMPORTANCE</span><span class="ec-detail-rel-v" style="color:'+(p.rel>=90?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="ec-detail-bar"><div class="ec-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=90?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="ec-detail-desc-wrap"><div class="ec-detail-desc-label">DESCRIPTION // الوصف</div><div class="ec-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="ec-detail-fib-wrap"><div class="ec-detail-fib-label">SIGNALS & DATA // الإشارات</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="ec-fib-row"><span class="ec-fib-arrow">▶</span><span class="ec-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="ec-detail-rules-wrap"><div class="ec-detail-rules-label">ACTION PLAN // خطة العمل</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="ec-rule-row"><span class="ec-rule-num">'+r[i].substring(0,2)+'</span><span class="ec-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

/* =====================================================================
   RECESSION GUIDE ENGINE - 360° PLATFORM
===================================================================== */
var rcCurrentCat='basics';
var rcSelectedIdx=-1;

function rcSetCat(cat,btn){
  rcCurrentCat=cat; rcSelectedIdx=-1;
  var b=document.querySelectorAll('.rc-cat-btn');
  for(var i=0;i<b.length;i++) b[i].classList.remove('rc-cat-active');
  btn.classList.add('rc-cat-active');
  rcRender();
}

function rcSelect(idx){ rcSelectedIdx=idx; rcRender(); }
function rcBack(){ rcSelectedIdx=-1; rcRender(); }

function rcInit(){
  var h='';
  var k=Object.keys(rcData);
  for(var i=0;i<k.length;i++){
    var c=rcData[k[i]];
    h+='<button class="rc-cat-btn'+(k[i]===rcCurrentCat?' rc-cat-active':'')+'" onclick="rcSetCat(\''+k[i]+'\',this)">'+c.en+' ('+c.patterns.length+')</button>';
  }
  document.getElementById('rc-cat-tabs').innerHTML=h;
  rcRender();
}

var rcData={
  basics:{en:'UNDERSTANDING',label:'فهم الركود',patterns:[
    {name:'What is a Recession',ar:'ما هو الركود الاقتصادي',rel:98,type:'DEFINITION',
    desc:'الركود هو انكماش اقتصادي ممتد. التعريف الرسمي: انخفاض ملموس في النشاط الاقتصادي يستمر أكثر من بضعة أشهر. التعريف المبسط: فصلان متتاليان من GDP السلبي. الركود جزء طبيعي من الدورة ويخلق أفضل فرص الشراء.',
    fib:'التعريف: GDP سلبي لفصلين متتاليين\nالمدة المتوسطة: 10-18 شهر\nالتكرار: كل 7-10 سنوات تقريباً\nالركود طبيعي — ليس كارثة دائمة\nكل ركود انتهى بتعافي وصعود\nالبنك المركزي يملك أدوات لإنهائه',
    rules:'1. الركود = انكماش ممتد (ليس هبوط يوم واحد)\n2. GDP سلبي لفصلين = Technical Recession\n3. يستمر 10-18 شهر في المتوسط\n4. يحدث كل 7-10 سنوات — طبيعي ومتوقع\n5. كل ركود في التاريخ انتهى بتعافي\n6. الركود يخلق أفضل فرص الشراء',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,20 20,22 30,25 40,30 50,38 55,42 60,48 65,55 70,58 75,60 78,62 80,60 85,55 90,48 95,42 100,38 108,32" fill="none" stroke="#fff" stroke-width="2.5"/><rect x="45" y="8" width="40" height="10" fill="rgba(255,106,0,0.1)" stroke="var(--o)" stroke-width="1"/><text x="65" y="16" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">RECESSION</text><text x="20" y="16" fill="#fff" font-size="6" font-family="Share Tech Mono">GROWTH</text><text x="95" y="28" fill="#fff" font-size="6" font-family="Share Tech Mono">RECOVERY</text><text x="55" y="76" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">EVERY RECESSION ENDS</text>'},
    {name:'Recession vs Depression',ar:'الفرق بين الركود والكساد',rel:90,type:'KNOW THE DIFFERENCE',
    desc:'الركود انكماش مؤقت (6-18 شهر). الكساد ركود شديد وطويل (سنوات). لم يحدث كساد منذ الثلاثينات بفضل أدوات البنوك المركزية مثل QE والتحفيز المالي.',
    fib:'الركود: GDP -1% إلى -5% | مدة 6-18 شهر | بطالة 6-10%\nالكساد: GDP > -10% | مدة سنوات | بطالة > 20%\nآخر كساد: 1929-1939 (أكثر من 90 سنة)\nمنذ 1945: 12 ركود وصفر كساد\nالبنوك المركزية تملك أدوات لمنع الكساد\nQE والتحفيز = أسلحة ضد الكساد',
    rules:'1. الركود طبيعي ومؤقت — الكساد نادر ومُدمّر\n2. الركود 6-18 شهر — الكساد سنوات\n3. آخر كساد منذ 90+ سنة — لا تخف منه\n4. البنوك المركزية لديها أدوات لمنع الكساد\n5. QE والتحفيز المالي = أسلحة فعالة\n6. كل ركود انتهى — تحضّر ولا تذعر',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="10" width="48" height="50" fill="rgba(255,106,0,0.04)" stroke="var(--o)" stroke-width="0.8"/><rect x="62" y="10" width="50" height="50" fill="rgba(255,106,0,0.1)" stroke="var(--o)" stroke-width="1.5"/><text x="32" y="22" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">RECESSION</text><text x="32" y="34" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">GDP: -1% to -5%</text><text x="32" y="42" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">6-18 months</text><text x="32" y="52" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">12 since 1945</text><text x="87" y="22" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">DEPRESSION</text><text x="87" y="34" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">GDP: > -10%</text><text x="87" y="42" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">YEARS</text><text x="87" y="52" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">0 since 1945</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">FLU vs CHRONIC DISEASE</text>'},
    {name:'Anatomy — How Recession Happens',ar:'تشريح الركود — كيف يحدث خطوة بخطوة',rel:92,type:'CAUSE & EFFECT',
    desc:'الركود يتطور عبر سلسلة: نمو سريع → تضخم → رفع فائدة → تسريح → إنفاق ينخفض → انهيار ثقة. الفيدرالي يعكس المسار لتبدأ دورة تعافي جديدة.',
    fib:'نمو سريع → تضخم → رفع فائدة\nتكلفة اقتراض ترتفع → شركات تتوقف\nتسريح عمال → إنفاق ينخفض\nأرباح تنخفض → أسهم تهبط\nثقة تنهار → حلقة مفرغة\nFed يعكس: خفض + QE → تعافي يبدأ',
    rules:'1. الركود يتطور تدريجياً — ليس مفاجئ\n2. رفع الفائدة المفرط = أكثر سبب شائع\n3. الحلقة المفرغة: تسريح → إنفاق أقل → تسريح\n4. البنك المركزي يكسر الحلقة بـ QE وخفض الفائدة\n5. الأحداث الخارجية (حرب/وباء) تُسرّع لكن لا تُسبب وحدها\n6. فهم التسلسل = إنذار مبكر 6-12 شهر',
    svg:'<rect width="120" height="80" fill="#000"/><circle cx="18" cy="15" r="8" fill="none" stroke="#fff" stroke-width="0.8"/><text x="18" y="17" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono">GROWTH</text><line x1="26" y1="15" x2="36" y2="15" stroke="#888" stroke-width="0.5"/><circle cx="46" cy="15" r="8" fill="none" stroke="var(--o)" stroke-width="0.8"/><text x="46" y="17" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono">HIKES</text><line x1="54" y1="15" x2="64" y2="15" stroke="#888" stroke-width="0.5"/><circle cx="74" cy="15" r="8" fill="none" stroke="var(--o)" stroke-width="0.8"/><text x="74" y="17" text-anchor="middle" fill="var(--o)" font-size="4" font-family="Share Tech Mono">LAYOFFS</text><line x1="82" y1="15" x2="92" y2="15" stroke="#888" stroke-width="0.5"/><circle cx="102" cy="15" r="8" fill="none" stroke="var(--o)" stroke-width="1"/><text x="102" y="17" text-anchor="middle" fill="var(--o)" font-size="4" font-family="Share Tech Mono">RECESS</text><polyline points="10,35 25,38 35,42 45,48 55,55 62,60 68,58 75,52 82,45 90,38 100,32 110,28" fill="none" stroke="#fff" stroke-width="2"/><text x="65" y="72" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">BOTTOM = OPPORTUNITY</text>'}
  ]},
  predict:{en:'PREDICTION',label:'التنبؤ بالركود',patterns:[
    {name:'Leading Indicators — Early Warning',ar:'المؤشرات الاستباقية — الإنذار المبكر',rel:95,type:'6-18 MONTHS AHEAD',
    desc:'انقلاب منحنى العائد يسبق بـ 12-18 شهر. LEI، انخفاض ISM، تزايد طلبات الإعانة. توافق 3+ مؤشرات يعني أن الركود شبه مؤكد.',
    fib:'Yield Curve Inversion: يسبق بـ 12-18 شهر (الأدق)\nLEI سلبي 6 أشهر: يسبق بـ 6-12 شهر\nISM < 50: يسبق بـ 3-6 أشهر\nJobless Claims ترتفع: يسبق بـ 3-6 أشهر\nConsumer Confidence ينهار: 3-6 أشهر\nHousing Starts تنخفض: 6-12 شهر\nCredit Spreads تتوسع: 3-6 أشهر',
    rules:'1. Yield Curve Inversion = أقوى إنذار (12-18 شهر)\n2. LEI سلبي 6 أشهر = ركود شبه مؤكد\n3. 3+ مؤشرات سلبية معاً = احتمال عالي جداً\n4. لا مؤشر واحد يكفي — اجمع 3+\n5. الإنذار المبكر يُعطيك وقت للتحضير\n6. Leading تسبق الواقع — Lagging تؤكد لاحقاً',
    svg:'<rect width="120" height="80" fill="#000"/><line x1="62" y1="5" x2="62" y2="70" stroke="var(--o)" stroke-width="1.5" stroke-dasharray="3,3"/><text x="62" y="4" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">RECESSION</text><text x="12" y="16" fill="#fff" font-size="5" font-family="Share Tech Mono">YC: -18m</text><line x1="10" y1="18" x2="62" y2="18" stroke="#fff" stroke-width="1"/><text x="15" y="28" fill="#fff" font-size="5" font-family="Share Tech Mono">LEI: -12m</text><line x1="18" y1="30" x2="62" y2="30" stroke="#fff" stroke-width="0.8"/><text x="22" y="40" fill="#888" font-size="5" font-family="Share Tech Mono">ISM: -6m</text><line x1="30" y1="42" x2="62" y2="42" stroke="#888" stroke-width="0.5"/><text x="30" y="52" fill="#888" font-size="5" font-family="Share Tech Mono">Claims: -3m</text><line x1="40" y1="54" x2="62" y2="54" stroke="#888" stroke-width="0.5"/><text x="70" y="35" fill="var(--o)" font-size="5" font-family="Share Tech Mono">GDP: 0m</text><text x="70" y="48" fill="var(--o)" font-size="5" font-family="Share Tech Mono">Jobs: +3m</text><text x="55" y="78" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">LEADING ← | → LAGGING</text>'},
    {name:'Sahm Rule — The Precise Trigger',ar:'قاعدة Sahm — المؤشر الدقيق',rel:92,type:'REAL-TIME',
    desc:'متوسط البطالة (3 أشهر) يرتفع 0.5% عن أدنى مستوى في 12 شهراً = الركود بدأ فعلياً. دقة 100% منذ 1970.',
    fib:'القاعدة: بطالة (3m avg) - أدنى 12 شهر >= 0.5%\nالدقة: 100% منذ 1970\nالتوقيت: Real-Time — الركود بدأ الآن\nبعد التفعيل: Fed يخفض بقوة + QE\nسلبي 3-6 أشهر ثم فرصة شراء\nراقبها شهرياً مع تقرير NFP',
    rules:'1. بطالة ترتفع 0.5% من أدنى 12 شهر = ركود بدأ\n2. دقة 100% منذ 1970 — لم تخطئ أبداً\n3. بعد التفعيل: توقع خفض فائدة حاد\n4. سلبي قصيراً (3-6 أشهر) ثم فرصة شراء\n5. لا تذعر — استعد واستغل الفرصة\n6. أدق مؤشر Real-Time للركود',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,52 20,50 30,48 40,46 50,42 60,46 65,45 70,42 75,38 80,32 84,28" fill="none" stroke="var(--o)" stroke-width="2"/><line x1="50" y1="42" x2="110" y2="42" stroke="#fff" stroke-width="0.8" stroke-dasharray="3,3"/><text x="112" y="44" fill="#fff" font-size="5" font-family="Share Tech Mono">LOW</text><rect x="70" y="30" width="18" height="12" fill="rgba(255,106,0,0.15)"/><text x="79" y="25" text-anchor="middle" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">+0.5%</text><text x="79" y="18" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">SAHM RULE</text><text x="55" y="72" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">100% ACCURATE SINCE 1970</text>'},
    {name:'Signs a Recession is Ending',ar:'علامات انتهاء الركود',rel:88,type:'RECOVERY SIGNALS',
    desc:'انتهاء الركود فرصة الشراء الذهبية: Fed يخفض الفائدة + QE، السيولة M2 تنمو، مطالبات البطالة تنخفض.',
    fib:'Fed يخفض + QE = أقوى إشارة تعافي\nM2 يتحول للصعود (2-3 أشهر) = تأكيد\nYield Curve يعود من الانقلاب\nJobless Claims تنخفض = الأسوأ انتهى\nISM > 50 = القطاع الصناعي يتعافى\nالأسواق تصعد قبل الاقتصاد بـ 3-6 أشهر',
    rules:'1. Fed يخفض + QE = ابدأ التجميع فوراً\n2. M2 يتحول + DXY يضعف = تأكيد\n3. Jobless Claims تنخفض = الأسوأ انتهى\n4. الأسواق تسبق الاقتصاد — لا تنتظر التأكيد الكامل\n5. 3+ إشارات = ابدأ الشراء التدريجي\n6. القاع يتشكل في أقصى خوف',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,22 18,28 25,35 32,42 38,50 42,55 48,58 52,60 56,62 60,60 65,55 72,48 80,38 88,30 96,22 108,18" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="56" cy="62" r="5" fill="none" stroke="#fff" stroke-width="2"/><text x="56" y="74" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">BOTTOM</text><text x="25" y="18" fill="var(--o)" font-size="6" font-family="Share Tech Mono">RECESSION</text><text x="88" y="16" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">RECOVERY</text>'}
  ]},
  history:{en:'HISTORY',label:'نماذج تاريخية',patterns:[
    {name:'2008 — Global Financial Crisis',ar:'2008 — الأزمة المالية العالمية',rel:95,type:'CREDIT CRISIS',
    desc:'ركود عميق سببه فقاعة الرهن العقاري، أدى لهبوط حاد في الأسواق وتلاه أكبر تدخل نقدي وأطول صعود في التاريخ.',
    fib:'S&P: -57% (1565 لـ 666)\nالبطالة: 4.4% لـ 10%\nالمدة: ديسمبر 2007 — يونيو 2009 (18 شهر)\nYield Curve انقلب: 2006 (قبل سنتين)\nFed: خفض لـ 0% + QE $4.5T\nالتعافي: مارس 2009 — صعود 11 سنة',
    rules:'1. Yield Curve حذّر قبل سنتين — المؤشرات تعمل\n2. الذعر يخلق أفضل فرصة شراء في العمر\n3. Fed سيفعل أي شيء لإنقاذ النظام\n4. QE بعد الأزمة = أقوى صعود ممكن\n5. الشراء في مارس 2009 = +500% خلال 10 سنوات\n6. الخوف الأقصى = أفضل شراء',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,18 20,20 30,25 38,32 44,42 48,52 52,60 56,65 58,68" fill="none" stroke="var(--o)" stroke-width="2.5"/><polyline points="58,68 64,58 72,45 80,35 88,25 96,20 108,16" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="58" cy="68" r="4" fill="none" stroke="#fff" stroke-width="2"/><text x="58" y="78" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">MAR 2009</text><text x="25" y="14" fill="var(--o)" font-size="7" font-family="Share Tech Mono" font-weight="900">-57%</text><text x="90" y="14" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">+500%</text>'},
    {name:'2020 — COVID Crash & Recovery',ar:'2020 — انهيار كوفيد والتعافي السريع',rel:92,type:'EXTERNAL SHOCK',
    desc:'أسرع ركود وتعافي في التاريخ. صدمة خارجية تلاها تدخل تاريخي ضخم طارئ صنع صعوداً هائلاً.',
    fib:'S&P: -34% في 23 يوم (أسرع هبوط)\nBTC: -58% في أسبوع ($9K لـ $3.8K)\nFed: خفض لـ 0% + QE $5T\nStimulus: $5T+ تحفيز حكومي\nS&P تعافى في 5 أشهر\nBTC: $3.8K لـ $69K (+1700%)',
    rules:'1. الصدمات الخارجية = فرص ذهبية\n2. Fed سيطبع أي مبلغ لإنقاذ الاقتصاد\n3. QE الضخم = صعود ضخم للأصول\n4. BTC تعافى أسرع من أي أصل\n5. الشراء في الذعر (مارس 2020) = ربح العمر\n6. لا تبيع في الذعر — الاستجابة الحكومية ستأتي',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,30 15,28 20,25 28,32 32,42 35,55 37,65 38,68" fill="none" stroke="var(--o)" stroke-width="2.5"/><polyline points="38,68 44,55 50,42 56,32 62,24 68,18 74,14 80,12 86,11 92,10 100,9 108,8" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="38" cy="68" r="4" fill="none" stroke="#fff" stroke-width="2"/><text x="38" y="78" text-anchor="middle" fill="#fff" font-size="5" font-family="Share Tech Mono" font-weight="900">MAR 2020</text><text x="22" y="18" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">-34%</text><text x="88" y="7" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">+1700%</text>'},
    {name:'2022 — Inflation Bear Market',ar:'2022 — سوق هبوطي بسبب التضخم',rel:88,type:'INFLATION DRIVEN',
    desc:'ليس ركوداً رسمياً لكنه بيئة تضخمية ضاغطة جداً صاحبها تشديد نقدي عنيف أدى لسقوط أسواق المال والعملات الرقمية.',
    fib:'CPI: وصل 9.1% يونيو 2022\nFed: من 0% لـ 5.25% في 16 شهر\nS&P: -27% | Nasdaq: -35%\nBTC: -77% ($69K لـ $16K)\nM2 انكمش أوائل 2022\nLuna + FTX = أزمة ثقة إضافية',
    rules:'1. تضخم مرتفع + رفع فائدة = أسوأ بيئة للكريبتو\n2. M2 ينكمش = اهرب للـ Cash\n3. Fed يرفع بقوة = لا تشتري\n4. CPI ينخفض + Fed يتوقف = بداية التعافي\n5. الأزمات الداخلية (Luna/FTX) تزيد الهبوط\n6. 2022 = درس في أهمية Macro',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,15 18,18 25,22 32,28 38,35 44,42 50,48 56,52 62,58 68,62 74,65 78,68" fill="none" stroke="var(--o)" stroke-width="2.5"/><text x="15" y="12" fill="#fff" font-size="5" font-family="Share Tech Mono">$69K</text><text x="78" y="76" fill="var(--o)" font-size="5" font-family="Share Tech Mono">$16K</text><text x="55" y="10" text-anchor="middle" fill="var(--o)" font-size="8" font-family="Share Tech Mono" font-weight="900">-77%</text><text x="55" y="45" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">CPI 9.1% + FED HIKES</text>'}
  ]},
  protect:{en:'PROTECT & PROFIT',label:'التحوط والاستثمار',patterns:[
    {name:'Hedging Strategies — Protection',ar:'استراتيجيات التحوط من الركود',rel:92,type:'DEFENSE',
    desc:'السيولة هي الملك في أوقات التراجع الاقتصادي. زيادة نسبة الكاش وتقليص الرافعة المالية والعملات البديلة.',
    fib:'Cash/Stablecoins: 30-50% من المحفظة\nتقليص المراكز: بع 20-30% تدريجياً\nالذهب: 10-20% كملاذ آمن\nسندات قصيرة: عائد ثابت\nتحويل Alts لـ BTC/Stables\nصفر Leverage — أغلق كل الرافعة',
    rules:'1. السيولة (Cash) = أفضل تحوط وأبسطه\n2. لا تنتظر التأكيد الكامل — ابدأ التحوط مبكراً\n3. بع تدريجياً — لا تبيع كل شيء دفعة واحدة\n4. الذهب يرتفع في الركود — تحوط تقليدي\n5. Altcoins تنهار 80-95% في الركود — حوّل لـ BTC/Stables\n6. صفر Leverage — الرافعة في الركود = تصفية',
    svg:'<rect width="120" height="80" fill="#000"/><rect x="8" y="10" width="30" height="22" fill="rgba(255,255,255,0.06)" stroke="#fff" stroke-width="1"/><text x="23" y="20" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">CASH</text><text x="23" y="28" text-anchor="middle" fill="#fff" font-size="6" font-family="Share Tech Mono">40%</text><rect x="42" y="10" width="25" height="22" fill="rgba(255,106,0,0.06)" stroke="var(--o)" stroke-width="0.8"/><text x="55" y="20" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono" font-weight="900">GOLD</text><text x="55" y="28" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">15%</text><rect x="71" y="10" width="22" height="22" fill="rgba(255,255,255,0.04)" stroke="#888" stroke-width="0.5"/><text x="82" y="20" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">BTC</text><text x="82" y="28" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">20%</text><rect x="96" y="10" width="18" height="22" fill="rgba(255,255,255,0.03)" stroke="#888" stroke-width="0.5"/><text x="105" y="20" text-anchor="middle" fill="#888" font-size="4" font-family="Share Tech Mono">BONDS</text><text x="105" y="28" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">25%</text><text x="60" y="48" text-anchor="middle" fill="#fff" font-size="7" font-family="Share Tech Mono" font-weight="900">RECESSION PORTFOLIO</text><text x="60" y="60" text-anchor="middle" fill="var(--o)" font-size="6" font-family="Share Tech Mono">0% LEVERAGE | 0% ALTCOINS</text><text x="60" y="72" text-anchor="middle" fill="#888" font-size="5" font-family="Share Tech Mono">START HEDGING AT FIRST WARNING</text>'},
    {name:'How to Invest DURING Recession',ar:'كيف تستثمر أثناء الركود وتستفيد منه',rel:95,type:'OPPORTUNITY',
    desc:'الركود هو فرصة الشراء الحقيقية للأصول بأسعار متدنية عبر استخدام خطة DCA بمجرد ظهور بوادر التعافي النقدي.',
    fib:'المرحلة 1 (بداية): احمِ رأس المال — لا شراء\nالمرحلة 2 (منتصف): بناء Watchlist\nالمرحلة 3 (إشارات تعافي): ابدأ DCA\nالأولوية: BTC → ETH → Large Caps\nDCA: 10-15% من Cash كل أسبوعين\nالتعافي: 12-24 شهر — لا تستعجل',
    rules:'1. لا تشتري في بداية الركود — انتظر إشارات التعافي\n2. Fed يخفض + QE = إشارة البدء\n3. DCA على 3-6 أشهر — لا تشتري كل شيء دفعة\n4. BTC أولاً (أقل مخاطرة في الكريبتو)\n5. لا Small Caps حتى يتأكد التعافي\n6. الصبر = المهارة الأهم — التعافي يحتاج وقت',
    svg:'<rect width="120" height="80" fill="#000"/><polyline points="10,25 20,32 30,40 38,50 44,58 48,62 52,60 56,55 60,48 65,42 70,38 75,35 80,30 85,28 90,25 95,22 100,20 108,18" fill="none" stroke="#fff" stroke-width="2"/><rect x="28" y="45" width="28" height="8" fill="rgba(255,106,0,0.1)"/><text x="42" y="51" text-anchor="middle" fill="var(--o)" font-size="5" font-family="Share Tech Mono" font-weight="900">DCA ZONE</text><circle cx="35" cy="52" r="2" fill="#fff"/><circle cx="40" cy="55" r="2" fill="#fff"/><circle cx="45" cy="58" r="2" fill="#fff"/><circle cx="50" cy="60" r="2" fill="#fff"/><circle cx="55" cy="56" r="2" fill="#fff"/><text x="42" y="42" fill="#fff" font-size="5" font-family="Share Tech Mono">BUY BUY BUY</text><text x="88" y="14" fill="#fff" font-size="6" font-family="Share Tech Mono" font-weight="900">PROFIT</text><text x="55" y="75" text-anchor="middle" fill="#888" font-size="6" font-family="Share Tech Mono">BUY FEAR — SELL GREED</text>'}
  ]}
};

function rcRender(){
  var cat=rcData[rcCurrentCat];
  if(!cat) return;
  var el=document.getElementById('rc-content');
  if(rcSelectedIdx>=0 && rcSelectedIdx<cat.patterns.length){
    el.innerHTML=rcRenderDetail(cat.patterns[rcSelectedIdx]);
    return;
  }
  var h='<div class="rc-grid">';
  for(var i=0;i<cat.patterns.length;i++){
    var p=cat.patterns[i];
    var isDanger=p.type&&(p.type.indexOf('CRISIS')>=0||p.type.indexOf('INFLATION')>=0);
    var topC=isDanger?'var(--o)':'#fff';
    h+='<div class="rc-card" style="border-top:3px solid '+topC+'" onclick="rcSelect('+i+')">';
    h+='<div class="rc-card-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
    h+='<div class="rc-card-name">'+p.name+'</div><div class="rc-card-ar">'+p.ar+'</div>';
    if(p.type) h+='<div class="rc-card-type">'+p.type+'</div>';
    h+='<div class="rc-card-rel-row"><span class="rc-card-rel-l">IMPORTANCE</span><span class="rc-card-rel-v" style="color:'+(p.rel>=90?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
    h+='<div class="rc-card-bar"><div class="rc-card-fill" style="width:'+p.rel+'%;background:'+(p.rel>=90?'#fff':'var(--o)')+'"></div></div></div>';
  }
  h+='</div>';
  h+='<div class="rc-footer">الركود جزء طبيعي من الدورة الاقتصادية ويخلق أفضل فرص الاستثمار تاريخياً. تحضيرك للركود قبل وقوعه هو ما سيميزك. SPOT ONLY — تحليل مرجعي تعليمي.</div>';
  el.innerHTML=h;
}

function rcRenderDetail(p){
  var h='<div class="rc-back" onclick="rcBack()">رجوع</div><div class="rc-detail">';
  h+='<div class="rc-detail-svg"><svg viewBox="0 0 120 80" style="width:100%;height:100%" dir="ltr">'+p.svg+'</svg></div>';
  h+='<div class="rc-detail-name">'+p.name+'</div><div class="rc-detail-ar">'+p.ar+'</div>';
  if(p.type){
    var bc=p.type.indexOf('CRISIS')>=0||p.type.indexOf('INFLATION')>=0?'var(--o)':'#fff';
    h+='<div class="rc-detail-badge" style="background:'+bc+';color:#000">'+p.type+'</div>';
  }
  h+='<div class="rc-detail-rel-row"><span class="rc-detail-rel-l">IMPORTANCE</span><span class="rc-detail-rel-v" style="color:'+(p.rel>=90?'#fff':'var(--o)')+'">'+p.rel+'%</span></div>';
  h+='<div class="rc-detail-bar"><div class="rc-detail-fill" style="width:'+p.rel+'%;background:'+(p.rel>=90?'#fff':'var(--o)')+'"></div></div>';
  h+='<div class="rc-detail-desc-wrap"><div class="rc-detail-desc-label">DESCRIPTION // الوصف</div><div class="rc-detail-desc">'+p.desc+'</div></div>';
  h+='<div class="rc-detail-fib-wrap"><div class="rc-detail-fib-label">KEY DATA // البيانات</div>';
  var f=p.fib.split('\n');
  for(var i=0;i<f.length;i++) h+='<div class="rc-fib-row"><span class="rc-fib-arrow">▶</span><span class="rc-fib-text">'+f[i]+'</span></div>';
  h+='</div><div class="rc-detail-rules-wrap"><div class="rc-detail-rules-label">ACTION PLAN // خطة العمل</div>';
  var r=p.rules.split('\n');
  for(var i=0;i<r.length;i++) h+='<div class="rc-rule-row"><span class="rc-rule-num">'+r[i].substring(0,2)+'</span><span class="rc-rule-text">'+r[i].substring(3)+'</span></div>';
  h+='</div></div>';
  return h;
}

// =====================================================================
// [6] macro-risk.js — المنطق البرمجي الكامل
// =====================================================================
// الكلمة المفتاحية للبحث: // ===== TSA  (لن تجدها — حقن في نهاية الملف)
// المكان: في نهاية ملف macro-risk.js
// =====================================================================

// ===== TSA — Time Series Analysis (Box-Jenkins / ARIMA) =====
(function(){
'use strict';

// ––––– UTILITIES –––––
function tsaStatus(msg, isError) {
  const el = document.getElementById('tsa-status');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('tsa-error', !!isError);
}

function tsaFmt(n, d) {
  if (d === undefined) d = 2;
  if (!isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function tsaFmtPrice(n) {
  if (typeof smartFormat === 'function') return smartFormat(n);
  if (typeof fmtCryptoPrice === 'function') return fmtCryptoPrice(n);
  if (n >= 1000) return tsaFmt(n, 2);
  if (n >= 1) return tsaFmt(n, 4);
  if (n >= 0.01) return tsaFmt(n, 6);
  return tsaFmt(n, 8);
}

function tsaFmtDate(ts, withTime) {
  const d = new Date(ts);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mm = months[d.getUTCMonth()];
  if (!withTime) return dd + ' ' + mm;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return dd + ' ' + mm + ' ' + hh + ':00';
}

// ––––– DATA FETCHING –––––
async function tsaFetchKlines(symbol, interval, limit) {
  const url = '/api/binance-klines?symbol=' + encodeURIComponent(symbol) + '&interval=' + interval + '&limit=' + limit;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Network error ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j) || j.length < 50) throw new Error('Insufficient data');
  return j.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
}

// ––––– STATISTICS CORE –––––
function tsaMean(arr) {
  let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function tsaVar(arr) {
  const m = tsaMean(arr);
  let s = 0; for (let i = 0; i < arr.length; i++) s += (arr[i]-m)*(arr[i]-m);
  return s / (arr.length - 1);
}

function tsaStd(arr) { return Math.sqrt(tsaVar(arr)); }

// Log returns: r_t = ln(P_t / P_{t-1})
function tsaLogReturns(prices) {
  const r = new Array(prices.length - 1);
  for (let i = 1; i < prices.length; i++) {
    r[i-1] = Math.log(prices[i] / prices[i-1]);
  }
  return r;
}

// First difference
function tsaDiff(arr) {
  const d = new Array(arr.length - 1);
  for (let i = 1; i < arr.length; i++) d[i-1] = arr[i] - arr[i-1];
  return d;
}

// ––––– ADF TEST (Augmented Dickey-Fuller, p=1) –––––
function tsaADF(series) {
  const n = series.length;
  if (n < 30) return { stat: 0, pValue: 1, stationary: false };

  const dy = tsaDiff(series);
  const m = dy.length - 1;
  const X = []; const Y = [];
  for (let i = 1; i < dy.length; i++) {
    X.push([1, series[i], dy[i-1]]);
    Y.push(dy[i]);
  }
  const coefs = tsaOLS(X, Y);
  if (!coefs) return { stat: 0, pValue: 1, stationary: false };

  const k = X[0].length;
  const nObs = X.length;
  let rss = 0;
  for (let i = 0; i < nObs; i++) {
    let pred = 0;
    for (let j = 0; j < k; j++) pred += X[i][j] * coefs[j];
    rss += (Y[i] - pred) * (Y[i] - pred);
  }
  const sigma2 = rss / (nObs - k);

  const XtX = tsaMatMul(tsaTranspose(X), X);
  const XtXinv = tsaInverse(XtX);
  if (!XtXinv) return { stat: 0, pValue: 1, stationary: false };

  const seGamma = Math.sqrt(sigma2 * XtXinv[1][1]);
  const tStat = coefs[1] / seGamma;

  let pValue;
  if (tStat < -3.96) pValue = 0.001;
  else if (tStat < -3.43) pValue = 0.01;
  else if (tStat < -3.12) pValue = 0.025;
  else if (tStat < -2.86) pValue = 0.05;
  else if (tStat < -2.57) pValue = 0.10;
  else if (tStat < -2.20) pValue = 0.25;
  else if (tStat < -1.62) pValue = 0.50;
  else if (tStat < -0.90) pValue = 0.75;
  else pValue = 0.90;

  return {
    stat: tStat,
    pValue: pValue,
    stationary: pValue < 0.05
  };
}

// ––––– LINEAR ALGEBRA –––––
function tsaTranspose(M) {
  const r = M.length, c = M[0].length;
  const T = [];
  for (let i = 0; i < c; i++) { T[i] = []; for (let j = 0; j < r; j++) T[i][j] = M[j][i]; }
  return T;
}

function tsaMatMul(A, B) {
  const ar = A.length, ac = A[0].length, bc = B[0].length;
  const C = [];
  for (let i = 0; i < ar; i++) {
    C[i] = [];
    for (let j = 0; j < bc; j++) {
      let s = 0; for (let k = 0; k < ac; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  }
  return C;
}

function tsaMatVec(A, v) {
  const r = A.length, c = A[0].length;
  const o = new Array(r);
  for (let i = 0; i < r; i++) { let s = 0; for (let j = 0; j < c; j++) s += A[i][j] * v[j]; o[i] = s; }
  return o;
}

function tsaInverse(M) {
  const n = M.length;
  const A = [];
  for (let i = 0; i < n; i++) {
    A[i] = M[i].slice();
    for (let j = 0; j < n; j++) A[i].push(i === j ? 1 : 0);
  }
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
    if (Math.abs(A[p][i]) < 1e-12) return null;
    [A[i], A[p]] = [A[p], A[i]];
    const div = A[i][i];
    for (let j = 0; j < 2*n; j++) A[i][j] /= div;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = A[k][i];
      for (let j = 0; j < 2*n; j++) A[k][j] -= f * A[i][j];
    }
  }
  const inv = [];
  for (let i = 0; i < n; i++) inv[i] = A[i].slice(n);
  return inv;
}

function tsaOLS(X, Y) {
  const Xt = tsaTranspose(X);
  const XtX = tsaMatMul(Xt, X);
  const XtXinv = tsaInverse(XtX);
  if (!XtXinv) return null;
  const XtY = tsaMatVec(Xt, Y);
  return tsaMatVec(XtXinv, XtY);
}

// ––––– ACF / PACF –––––
function tsaACF(series, maxLag) {
  const n = series.length;
  const m = tsaMean(series);
  let denom = 0;
  for (let i = 0; i < n; i++) denom += (series[i] - m) * (series[i] - m);

  const acf = new Array(maxLag + 1);
  acf[0] = 1;
  for (let k = 1; k <= maxLag; k++) {
    let num = 0;
    for (let i = k; i < n; i++) num += (series[i] - m) * (series[i-k] - m);
    acf[k] = num / denom;
  }
  return acf;
}

function tsaPACF(series, maxLag) {
  const acf = tsaACF(series, maxLag);
  const pacf = new Array(maxLag + 1);
  pacf[0] = 1;

  const phi = [];
  for (let k = 1; k <= maxLag; k++) phi[k] = new Array(k + 1);

  if (maxLag >= 1) {
    phi[1][1] = acf[1];
    pacf[1] = acf[1];
  }

  for (let k = 2; k <= maxLag; k++) {
    let num = acf[k];
    let den = 1;
    for (let j = 1; j < k; j++) {
      num -= phi[k-1][j] * acf[k-j];
      den -= phi[k-1][j] * acf[j];
    }
    phi[k][k] = num / den;
    for (let j = 1; j < k; j++) {
      phi[k][j] = phi[k-1][j] - phi[k][k] * phi[k-1][k-j];
    }
    pacf[k] = phi[k][k];
  }
  return pacf;
}

// ––––– ARMA ESTIMATION –––––
function tsaFitARMA(series, p, q) {
  const n = series.length;
  if (n < (p + q + 10)) return null;

  const params = new Array(1 + p + q).fill(0);
  for (let i = 0; i < p; i++) params[1 + i] = 0.1 / (i + 1);
  for (let i = 0; i < q; i++) params[1 + p + i] = 0.05;

  const lr = 0.01;
  const maxIter = 100;
  const tol = 1e-7;
  let prevLoss = Infinity;

  const computeResiduals = (pr) => {
    const c = pr[0];
    const phi = pr.slice(1, 1 + p);
    const theta = pr.slice(1 + p, 1 + p + q);
    const eps = new Array(n).fill(0);
    const start = Math.max(p, q);
    for (let t = start; t < n; t++) {
      let pred = c;
      for (let i = 0; i < p; i++) pred += phi[i] * series[t-1-i];
      for (let i = 0; i < q; i++) pred += theta[i] * eps[t-1-i];
      eps[t] = series[t] - pred;
    }
    return { eps: eps, start: start };
  };

  const lossFn = (pr) => {
    const { eps, start } = computeResiduals(pr);
    let s = 0;
    for (let t = start; t < n; t++) s += eps[t] * eps[t];
    return s;
  };

  let loss = lossFn(params);

  for (let iter = 0; iter < maxIter; iter++) {
    const grad = new Array(params.length).fill(0);
    const h = 1e-5;
    for (let k = 0; k < params.length; k++) {
      const orig = params[k];
      params[k] = orig + h;
      const lp = lossFn(params);
      params[k] = orig - h;
      const lm = lossFn(params);
      params[k] = orig;
      grad[k] = (lp - lm) / (2 * h);
    }

    let stepLr = lr;
    let newLoss = Infinity;
    const newParams = params.slice();
    for (let trial = 0; trial < 8; trial++) {
      for (let k = 0; k < params.length; k++) newParams[k] = params[k] - stepLr * grad[k];
      for (let k = 1; k <= p; k++) if (Math.abs(newParams[k]) > 0.99) newParams[k] = 0.99 * Math.sign(newParams[k]);
      for (let k = 1 + p; k <= p + q; k++) if (Math.abs(newParams[k]) > 0.99) newParams[k] = 0.99 * Math.sign(newParams[k]);
      newLoss = lossFn(newParams);
      if (newLoss < loss) break;
      stepLr *= 0.5;
    }

    if (newLoss >= loss) break;
    for (let k = 0; k < params.length; k++) params[k] = newParams[k];
    if (Math.abs(prevLoss - newLoss) < tol) { loss = newLoss; break; }
    prevLoss = loss;
    loss = newLoss;
  }

  const { eps, start } = computeResiduals(params);
  const nEff = n - start;
  let sse = 0;
  for (let t = start; t < n; t++) sse += eps[t] * eps[t];
  const sigma2 = sse / nEff;
  const k = 1 + p + q;
  const aic = nEff * Math.log(sigma2) + 2 * k;
  const bic = nEff * Math.log(sigma2) + k * Math.log(nEff);

  return {
    params: params, c: params[0], phi: params.slice(1, 1 + p), theta: params.slice(1 + p, 1 + p + q),
    eps: eps, sigma2: sigma2, sse: sse, aic: aic, bic: bic, p: p, q: q, n: n, start: start
  };
}

// ––––– AUTO-ARIMA –––––
function tsaAutoARMA(series, maxP, maxQ) {
  let best = null;
  let bestAIC = Infinity;
  const candidates = [];

  for (let p = 0; p <= maxP; p++) {
    for (let q = 0; q <= maxQ; q++) {
      if (p === 0 && q === 0) continue;
      const fit = tsaFitARMA(series, p, q);
      if (!fit || !isFinite(fit.aic)) continue;
      candidates.push({ p: p, q: q, aic: fit.aic, bic: fit.bic });
      if (fit.aic < bestAIC) {
        bestAIC = fit.aic;
        best = fit;
      }
    }
  }
  if (best) best.candidates = candidates;
  return best;
}

// ––––– FORECAST –––––
function tsaForecast(fit, series, h) {
  const p = fit.p, q = fit.q;
  const phi = fit.phi, theta = fit.theta, c = fit.c;
  const eps = fit.eps;
  
  const forecasts = new Array(h);
  const variances = new Array(h);
  const psi = new Array(h).fill(0);
  psi[0] = 1;

  for (let i = 1; i < h; i++) {
    let s = 0;
    for (let j = 1; j <= Math.min(i, p); j++) s += phi[j-1] * psi[i-j];
    if (i <= q) s += theta[i-1];
    psi[i] = s;
  }

  const extSeries = series.slice();
  const extEps = eps.slice();
  for (let t = 0; t < h; t++) {
    let pred = c;
    for (let i = 0; i < p; i++) {
      const idx = extSeries.length - 1 - i;
      if (idx >= 0) pred += phi[i] * extSeries[idx];
    }
    for (let i = 0; i < q; i++) {
      const idx = extEps.length - 1 - i;
      if (idx >= 0) pred += theta[i] * extEps[idx];
    }
    extSeries.push(pred);
    extEps.push(0); 

    let varSum = 0;
    for (let i = 0; i <= t; i++) varSum += psi[i] * psi[i];
    variances[t] = fit.sigma2 * varSum;
    forecasts[t] = pred;
  }

  const ci95 = variances.map(v => 1.96 * Math.sqrt(v));
  return { forecasts: forecasts, ci95: ci95, variances: variances };
}

// ––––– LJUNG-BOX TEST –––––
function tsaLjungBox(residuals, h, dof) {
  const n = residuals.length;
  let valid = [];
  for (let i = 0; i < n; i++) if (isFinite(residuals[i])) valid.push(residuals[i]);
  const acf = tsaACF(valid, h);
  let Q = 0;
  for (let k = 1; k <= h; k++) Q += (acf[k] * acf[k]) / (valid.length - k);
  Q = valid.length * (valid.length + 2) * Q;
  const df = h - dof;
  const pValue = tsaChi2SurvivalApprox(Q, df);
  return { stat: Q, pValue: pValue, pass: pValue > 0.05, df: df };
}

function tsaChi2SurvivalApprox(x, df) {
  if (df <= 0) return 1;
  if (x <= 0) return 1;
  const z = Math.pow(x / df, 1/3) - (1 - 2/(9*df));
  const denom = Math.sqrt(2/(9*df));
  const zScore = z / denom;
  return 1 - tsaNormCDF(zScore);
}

function tsaNormCDF(x) {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, pP = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + pP * x);
  const y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * Math.exp(-x*x);
  return 0.5 * (1.0 + sign * y);
}

// ––––– PIPELINE PER FRAME –––––
async function tsaAnalyzeFrame(symbol, interval, limit, horizon, intervalMs) {
  const candles = await tsaFetchKlines(symbol, interval, limit);
  const closes = candles.map(c => c.close);
  const lastClose = closes[closes.length - 1];
  const lastTime = candles[candles.length - 1].time;

  const logRet = tsaLogReturns(closes);
  const adfRaw = tsaADF(closes);
  const adfRet = tsaADF(logRet);
  const acf = tsaACF(logRet, 40);
  const pacf = tsaPACF(logRet, 40);
  const ci = 1.96 / Math.sqrt(logRet.length);

  const fit = tsaAutoARMA(logRet, 3, 3);
  if (!fit) throw new Error('Model fit failed for ' + interval);

  const fc = tsaForecast(fit, logRet, horizon);

  const pricePath = new Array(horizon);
  const upperPath = new Array(horizon);
  const lowerPath = new Array(horizon);
  let cumMean = 0;
  let cumVar = 0;
  for (let i = 0; i < horizon; i++) {
    cumMean += fc.forecasts[i];
    cumVar += fc.variances[i];
    const ciCum = 1.96 * Math.sqrt(cumVar);
    pricePath[i] = lastClose * Math.exp(cumMean);
    upperPath[i] = lastClose * Math.exp(cumMean + ciCum);
    lowerPath[i] = lastClose * Math.exp(cumMean - ciCum);
  }

  const rows = new Array(horizon);
  for (let i = 0; i < horizon; i++) {
    rows[i] = {
      time: lastTime + (i+1) * intervalMs,
      price: pricePath[i],
      upper: upperPath[i],
      lower: lowerPath[i]
    };
  }

  const lb = tsaLjungBox(fit.eps.slice(fit.start), 10, fit.p + fit.q);

  let absSum = 0, sqSum = 0, mapeSum = 0, cnt = 0;
  for (let t = fit.start; t < logRet.length; t++) {
    const predRet = logRet[t] - fit.eps[t];
    const actualPrice = closes[t+1]; 
    const prevPrice = closes[t];
    const predPrice = prevPrice * Math.exp(predRet);
    const err = actualPrice - predPrice;
    absSum += Math.abs(err);
    sqSum += err * err;
    if (actualPrice !== 0) mapeSum += Math.abs(err / actualPrice);
    cnt++;
  }
  const mae = absSum / cnt;
  const rmse = Math.sqrt(sqSum / cnt);
  const mape = (mapeSum / cnt) * 100;

  const endPrice = pricePath[horizon - 1];
  const change = ((endPrice - lastClose) / lastClose) * 100;
  let bias, score;
  const ciWidth = (upperPath[horizon-1] - lowerPath[horizon-1]) / 2;
  const signalRatio = Math.abs(endPrice - lastClose) / Math.max(ciWidth, 1e-9);
  score = Math.min(100, Math.round(signalRatio * 60));
  if (signalRatio < 0.20) bias = 'NEUTRAL';
  else if (endPrice > lastClose) bias = 'BULLISH';
  else bias = 'BEARISH';

  return {
    interval: interval, candles: candles, lastClose: lastClose, lastTime: lastTime,
    logRet: logRet, adfRaw: adfRaw, adfRet: adfRet, acf: acf, pacf: pacf, ci: ci,
    fit: fit, forecast: fc, rows: rows, endPrice: endPrice, change: change,
    bias: bias, score: score, ljungBox: lb, mae: mae, rmse: rmse, mape: mape
  };
}

// ––––– MAIN ENTRY –––––
window.runTSA = async function() {
  const sym = (document.getElementById('tsa-symbol').value || 'BTC').trim().toUpperCase();
  const symbol = sym.endsWith('USDT') ? sym : sym + 'USDT';
  const resultEl = document.getElementById('tsa-result');
  const btn = document.querySelector('#pg-tsa .tsa-input-bar button');

  resultEl.classList.remove('tsa-show');
  resultEl.innerHTML = '';
  if (btn) btn.disabled = true;

  if (typeof trackToolUsage === 'function') trackToolUsage('pg-tsa');

  try {
    tsaStatus('جاري جلب بيانات السوق ... ' + symbol);
    const MS_H = 60 * 60 * 1000;
    const MS_4H = 4 * MS_H;
    const MS_D = 24 * MS_H;

    tsaStatus('جاري تحليل فريم الساعة ...');
    const r1H = await tsaAnalyzeFrame(symbol, '1h', 500, 12, MS_H);
    tsaStatus('جاري تحليل فريم الأربع ساعات ...');
    const r4H = await tsaAnalyzeFrame(symbol, '4h', 400, 9, MS_4H);
    tsaStatus('جاري تحليل الفريم اليومي ...');
    const r1D = await tsaAnalyzeFrame(symbol, '1d', 300, 7, MS_D);

    tsaStatus('بناء التقرير النهائي ...');

    const html = tsaRenderReport(symbol, r1H, r4H, r1D);
    resultEl.innerHTML = html;
    resultEl.classList.add('tsa-show');
    tsaStatus('اكتمل التحليل ' + new Date().toUTCString().split(' ').slice(0,5).join(' '));

  } catch (err) {
    console.error('TSA error:', err);
    tsaStatus('تعذّر التحليل: ' + (err.message || 'خطأ غير معروف') + ' — تأكد من رمز العملة', true);
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ––––– WEIGHTED MASTER VERDICT –––––
function tsaMasterVerdict(r1H, r4H, r1D) {
  const w = { '1h': 0.20, '4h': 0.30, '1d': 0.50 };
  const map = { BULLISH: 1, BEARISH: -1, NEUTRAL: 0 };
  const wScore = map[r1H.bias]*w['1h'] + map[r4H.bias]*w['4h'] + map[r1D.bias]*w['1d'];
  const wMag = r1H.score*w['1h'] + r4H.score*w['4h'] + r1D.score*w['1d'];

  let bias;
  if (Math.abs(wScore) < 0.20) bias = 'NEUTRAL';
  else if (wScore > 0) bias = 'BULLISH';
  else bias = 'BEARISH';

  const strength = Math.min(100, Math.round(wMag));

  const targetPrice = r1D.endPrice * 0.50 + r4H.endPrice * 0.30 + r1H.endPrice * 0.20;
  const baseClose = r1D.lastClose;
  const expectedChange = ((targetPrice - baseClose) / baseClose) * 100;

  const targetTs = r1D.rows[r1D.rows.length - 1].time;

  return {
    bias: bias, strength: strength, targetPrice: targetPrice,
    expectedChange: expectedChange, targetDate: targetTs, baseClose: baseClose
  };
}

// ––––– KEY LEVELS ACROSS ALL FRAMES –––––
function tsaKeyLevels(r1H, r4H, r1D) {
  const all = r1H.rows.concat(r4H.rows).concat(r1D.rows);
  let hi = all[0], lo = all[0];
  for (let i = 1; i < all.length; i++) {
    if (all[i].upper > hi.upper) hi = all[i];
    if (all[i].lower < lo.lower) lo = all[i];
  }
  let vSum = 0;
  for (let i = 0; i < r1D.rows.length; i++) {
    vSum += (r1D.rows[i].upper - r1D.rows[i].lower) / r1D.rows[i].price;
  }
  const expVol = (vSum / r1D.rows.length) * 100;
  return {
    highPrice: hi.upper, highDate: hi.time,
    lowPrice: lo.lower, lowDate: lo.time,
    expVol: expVol, horizonDays: 7
  };
}

// ––––– RENDER REPORT –––––
function tsaRenderReport(symbol, r1H, r4H, r1D) {
  const master = tsaMasterVerdict(r1H, r4H, r1D);
  const keys = tsaKeyLevels(r1H, r4H, r1D);

  const cls = master.bias === 'BULLISH' ? 'tsa-master-up' : master.bias === 'BEARISH' ? 'tsa-master-dn' : 'tsa-master-nu';
  const biasLbl = master.bias === 'BULLISH' ? 'صاعد' : master.bias === 'BEARISH' ? 'هابط' : 'محايد';
  const biasCls = master.bias === 'BULLISH' ? 'tsa-up' : master.bias === 'BEARISH' ? 'tsa-dn' : 'tsa-nu';

  const baseSymbol = symbol.replace('USDT', '');
  const reason = tsaReasonText(master, r1H, r4H, r1D);

  const bestModel = 'ARIMA(' + r1D.fit.p + ',1,' + r1D.fit.q + ')';

  let html = '<div class="tsa-master ' + cls + '">';
  html += '<div class="tsa-master-label">MASTER VERDICT</div>';
  html += '<div class="tsa-master-grid">';

  html += '<div>';
  html += '<div class="tsa-mk-label">التوصية الاتجاهية</div>';
  html += '<div class="tsa-bias-name ' + biasCls + '">' + biasLbl + '</div>';
  html += '<div class="tsa-bias-en ' + biasCls + '">' + master.bias + '</div>';
  html += '<div class="tsa-strength">';
  html += '<div class="tsa-mk-label">قوة الترجيح</div>';
  html += '<div class="tsa-strength-val"><div class="tsa-strength-num ' + biasCls + '">' + master.strength + '</div><div class="tsa-strength-max">/ 100</div></div>';
  html += '<div class="tsa-strength-bar"><div class="tsa-strength-fill" style="width:' + master.strength + '%;background:' + (master.bias==='BULLISH'?'#fff':master.bias==='BEARISH'?'var(--o)':'#888') + ';"></div></div>';
  html += '</div></div>';

  html += '<div>';
  html += '<div class="tsa-mk-label">النموذج المختار (اليومي)</div>';
  html += '<div class="tsa-model-name">' + bestModel + '</div>';
  html += '<div class="tsa-model-list">';
  html += '<div class="tsa-model-row"><span>السعر الحالي</span><span>$' + tsaFmtPrice(master.baseClose) + '</span></div>';
  html += '<div class="tsa-model-row"><span>السعر المستهدف</span><span class="' + biasCls + '">$' + tsaFmtPrice(master.targetPrice) + '</span></div>';
  html += '<div class="tsa-model-row"><span>التغير المتوقع</span><span class="' + biasCls + '">' + (master.expectedChange>=0?'+':'') + tsaFmt(master.expectedChange) + '%</span></div>';
  html += '<div class="tsa-model-row"><span>موعد الوصول</span><span>' + tsaFmtDate(master.targetDate, false) + '</span></div>';
  html += '</div></div>';

  html += '</div>';
  html += '<div class="tsa-reason">' + reason + '</div>';
  html += '</div>';

  html += '<div class="tsa-section-title">KEY LEVELS &amp; DATES / المستويات والتواريخ الحرجة</div>';
  html += '<div class="tsa-keys">';
  html += '<div class="tsa-key"><div class="tsa-mk-label">أعلى مستوى متوقع</div><div class="tsa-key-val tsa-up">$' + tsaFmtPrice(keys.highPrice) + '</div><div class="tsa-key-meta">' + tsaFmtDate(keys.highDate, true) + ' UTC</div></div>';
  html += '<div class="tsa-key"><div class="tsa-mk-label">أدنى مستوى متوقع</div><div class="tsa-key-val tsa-dn">$' + tsaFmtPrice(keys.lowPrice) + '</div><div class="tsa-key-meta">' + tsaFmtDate(keys.lowDate, true) + ' UTC</div></div>';
  html += '<div class="tsa-key"><div class="tsa-mk-label">التذبذب المتوقع</div><div class="tsa-key-val">' + tsaFmt(keys.expVol) + '%</div><div class="tsa-key-meta">متوسط مدى الحركة اليومية</div></div>';
  html += '<div class="tsa-key"><div class="tsa-mk-label">أفق التوقع</div><div class="tsa-key-val">' + keys.horizonDays + ' أيام</div><div class="tsa-key-meta">أقصى مدى زمني للنموذج</div></div>';
  html += '</div>';

  html += '<div class="tsa-section-title">FORECAST TABLES / جداول التنبؤ التفصيلي</div>';
  html += tsaRenderForecastTable(r1H, 'FRAME 1H — 12 BARS AHEAD', 'فريم الساعة — توقع 12 شمعة قادمة (12 ساعة)', master.baseClose, true);
  html += tsaRenderForecastTable(r4H, 'FRAME 4H — 9 BARS AHEAD', 'فريم الأربع ساعات — توقع 9 شمعات قادمة (36 ساعة)', master.baseClose, true);
  html += tsaRenderForecastTable(r1D, 'FRAME 1D — 7 DAYS AHEAD', 'الفريم اليومي — توقع 7 أيام قادمة (أسبوع)', master.baseClose, false);

  html += '<div class="tsa-section-title">DIAGNOSTIC PANEL / لوحة التشخيص الإحصائي (الفريم اليومي)</div>';
  html += '<div class="tsa-adf-row">';
  html += tsaRenderADF('ADF TEST — السلسلة الأصلية', r1D.adfRaw, 'السلسلة غير ساكنة — السعر الخام يحوي اتجاه. تطبيق الفروق ضروري.');
  html += tsaRenderADF('ADF TEST — بعد التحويل اللوغاريتمي', r1D.adfRet, 'السلسلة ساكنة بعد تحويل العوائد. النموذج جاهز للتقدير.');
  html += '</div>';

  html += tsaRenderChart('ACF — AUTOCORRELATION FUNCTION', 'دالة الارتباط الذاتي — 40 إزاحة', r1D.acf, r1D.ci, tsaPatternACF(r1D.acf, r1D.ci, r1D.fit.q));
  html += tsaRenderChart('PACF — PARTIAL AUTOCORRELATION', 'دالة الارتباط الذاتي الجزئي — 40 إزاحة', r1D.pacf, r1D.ci, tsaPatternPACF(r1D.pacf, r1D.ci, r1D.fit.p));

  html += '<div class="tsa-section-title">RESIDUAL DIAGNOSTICS / تشخيص جودة النموذج (الفريم اليومي)</div>';
  html += '<div class="tsa-resid-row">';
  html += '<div class="tsa-resid-card">';
  html += '<div class="tsa-mk-label">LJUNG-BOX TEST</div>';
  html += '<div class="tsa-adf-row-inner"><span>Q-statistic</span><span>' + tsaFmt(r1D.ljungBox.stat, 3) + '</span></div>';
  html += '<div class="tsa-adf-row-inner"><span>p-value</span><span class="' + (r1D.ljungBox.pass?'tsa-up':'tsa-dn') + '">' + tsaFmt(r1D.ljungBox.pValue, 4) + '</span></div>';
  html += '<div class="tsa-adf-row-inner"><span>درجات الحرية</span><span>' + r1D.ljungBox.df + '</span></div>';
  html += '<div class="tsa-resid-note' + (r1D.ljungBox.pass?'':' tsa-warn') + '">';
  html += r1D.ljungBox.pass ? 'النموذج يلتقط البنية بشكل مرضٍ. البواقي تتصرف كضوضاء بيضاء.' : 'بقايا ارتباط في البواقي. التوقعات قابلة للاستخدام بحذر.';
  html += '</div></div>';

  html += '<div class="tsa-resid-card">';
  html += '<div class="tsa-mk-label">ERROR METRICS</div>';
  html += '<div class="tsa-adf-row-inner"><span>MAE</span><span>$' + tsaFmtPrice(r1D.mae) + '</span></div>';
  html += '<div class="tsa-adf-row-inner"><span>RMSE</span><span>$' + tsaFmtPrice(r1D.rmse) + '</span></div>';
  html += '<div class="tsa-adf-row-inner"><span>MAPE</span><span>' + tsaFmt(r1D.mape, 2) + '%</span></div>';
  html += '<div class="tsa-resid-note">متوسط الخطأ النسبي ' + tsaFmt(r1D.mape, 2) + '% — كلما قل الرقم زادت دقة النموذج.</div>';
  html += '</div>';
  html += '</div>';

  const quality = tsaQualityAssess(r1D);
  html += '<div class="tsa-quality ' + (quality.pass?'tsa-quality-up':'tsa-quality-dn') + '">';
  html += '<div><div class="tsa-mk-label">MODEL QUALITY</div><div class="tsa-quality-name ' + (quality.pass?'tsa-up':'tsa-dn') + '">' + quality.tag + ' — ' + quality.labelAr + '</div></div>';
  html += '<div class="tsa-quality-desc">' + quality.desc + '</div>';
  html += '</div>';

  html += '<div class="tsa-section-title">READING GUIDE / دليل القراءة</div>';
  html += '<div class="tsa-guide">';
  html += '<div class="tsa-guide-block"><div class="tsa-guide-h">ما الذي تفعله هذه الأداة</div><div class="tsa-guide-p">تطبق منهجية بوكس-جينكنز الإحصائية لاستخراج البنية الكامنة في حركة السعر، ثم تبني نموذجاً رياضياً يقدر القيم المستقبلية مع فترات ثقة محددة. التحليل يجري على ثلاثة أطر زمنية مستقلة لتقديم رؤية شاملة.</div></div>';
  html += '<div class="tsa-guide-block"><div class="tsa-guide-h">كيف تقرأ التوصية</div><div class="tsa-guide-p">التوصية تبنى على متوسط مرجح لتوقعات الفريمات الثلاثة. وزن الفريم اليومي خمسون بالمئة، الأربع ساعات ثلاثون، الساعة عشرون. الترجيح الإيجابي بالأبيض يعني توقع صعود، والسلبي بالبرتقالي يعني توقع هبوط. قوة الترجيح من صفر إلى مئة تعكس حجم الحركة المتوقعة مقارنة بعرض فترة الثقة.</div></div>';
  html += '<div class="tsa-guide-block"><div class="tsa-guide-h">كيف تقرأ جداول التنبؤ</div><div class="tsa-guide-p">كل صف يمثل لحظة زمنية مستقبلية. السعر المتوقع هو القيمة الأرجح إحصائياً. الحد الأعلى والأدنى يحددان فترة ثقة بنسبة خمسة وتسعين بالمئة، أي أن السعر الفعلي يتوقع أن يقع داخل هذا النطاق في معظم الحالات. عرض النطاق يتسع كلما ابتعدنا في الزمن لأن عدم اليقين يتراكم.</div></div>';
  html += '<div class="tsa-guide-block"><div class="tsa-guide-h">كيف تقرأ المخططات الإحصائية</div><div class="tsa-guide-p">مخطط ACF يبين مدى ارتباط العائد الحالي بقيمه السابقة. مخطط PACF يفصل هذا الارتباط ويحدد رتبة النموذج الأنسب. الأعمدة البيضاء تشير إلى ارتباط موجب والبرتقالية إلى ارتباط سالب. الأعمدة التي تتجاوز الخط المنقط تعتبر معنوية إحصائياً.</div></div>';
  html += '<div class="tsa-guide-block"><div class="tsa-guide-h">متى تثق بالنموذج</div><div class="tsa-guide-p">عندما تشير لوحة جودة النموذج إلى مستوى ممتاز أو جيد، وعندما تكون قيمة احتمال اختبار Ljung-Box أكبر من خمسة بالمئة. إذا كانت الجودة مقبولة أو ضعيفة، تعامل مع التوقعات بحذر لأن السوق يمر بحالة شاذة عن البنية المعتادة وقد تتغير الظروف بسرعة.</div></div>';
  html += '</div>';

  html += '<div class="tsa-disc">';
  html += '<div class="tsa-disc-h">DISCLAIMER / إخلاء مسؤولية</div>';
  html += 'هذا التحليل احتمالي بحت يستند إلى نمذجة إحصائية للبيانات التاريخية، وليس توصية تداول أو نصيحة استثمارية. التحليل مخصص للأسواق الفورية فقط دون أي رفع مالي أو مشتقات. النموذج يفترض استمرار البنية الإحصائية الحالية، وقد ينحرف الواقع جوهرياً عند وقوع أحداث استثنائية. القرار النهائي ومخاطره مسؤولية المستخدم وحده.';
  html += '</div>';

  html += '<div class="tsa-footer">منصة 360° — TIME SERIES ANALYSIS / حساب السلاسل الزمنية</div>';

  return html;
}

// ––––– HELPER RENDERERS –––––
function tsaRenderForecastTable(r, title, subtitle, baseClose, withTime) {
  let h = '<div class="tsa-fcard">';
  h += '<div class="tsa-fhead"><div><div class="tsa-fhead-title">' + title + '</div><div class="tsa-fhead-sub">' + subtitle + '</div></div><div class="tsa-fhead-count">' + r.rows.length + ' نقطة</div></div>';
  h += '<div class="tsa-ftable-wrap"><table class="tsa-ftable">';
  h += '<thead><tr><th>الوقت</th><th>السعر المتوقع</th><th class="tsa-th-up">الحد الأعلى</th><th class="tsa-th-dn">الحد الأدنى</th><th>المدى</th></tr></thead><tbody>';
  for (let i = 0; i < r.rows.length; i++) {
    const row = r.rows[i];
    const range = row.upper - row.lower;
    const pct = ((row.price - baseClose) / baseClose) * 100;
    const pctCls = pct >= 0 ? 'tsa-up' : 'tsa-dn';
    h += '<tr>';
    h += '<td>' + tsaFmtDate(row.time, withTime) + '</td>';
    h += '<td>' + tsaFmtPrice(row.price) + '<span class="tsa-pct ' + pctCls + '">' + (pct>=0?'+':'') + tsaFmt(pct, 2) + '%</span></td>';
    h += '<td class="tsa-up">' + tsaFmtPrice(row.upper) + '</td>';
    h += '<td class="tsa-dn">' + tsaFmtPrice(row.lower) + '</td>';
    h += '<td>' + tsaFmtPrice(range) + '</td>';
    h += '</tr>';
  }
  h += '</tbody></table></div></div>';
  return h;
}

function tsaRenderADF(title, res, fallbackText) {
  const statCls = res.stationary ? 'tsa-up' : 'tsa-dn';
  const stateLbl = res.stationary ? 'STATIONARY' : 'NON-STATIONARY';
  const decision = res.stationary
  ? 'السلسلة ساكنة. p-value = ' + tsaFmt(res.pValue, 4) + ' — يمكن النمذجة المباشرة.'
  : 'السلسلة غير ساكنة. p-value = ' + tsaFmt(res.pValue, 4) + ' — تحتاج تحويلاً.';

  let h = '<div class="tsa-adf">';
  h += '<div class="tsa-mk-label">' + title + '</div>';
  h += '<div class="tsa-adf-row-inner"><span>الإحصائي</span><span>' + tsaFmt(res.stat, 3) + '</span></div>';
  h += '<div class="tsa-adf-row-inner"><span>p-value</span><span class="' + statCls + '">' + tsaFmt(res.pValue, 4) + '</span></div>';
  h += '<div class="tsa-adf-row-inner" style="border-bottom:1px solid #1f1f1f;padding-bottom:8px;margin-bottom:8px;"><span>الحالة</span><span class="' + statCls + '">' + stateLbl + '</span></div>';
  h += '<div class="tsa-adf-decision">' + decision + '</div>';
  h += '</div>';
  return h;
}

function tsaRenderChart(title, subtitle, arr, ci, patternText) {
  let h = '<div class="tsa-chart-card">';
  h += '<div class="tsa-chart-head"><div><div class="tsa-chart-title">' + title + '</div><div class="tsa-chart-sub">' + subtitle + '</div></div>';
  h += '<div class="tsa-legend"><div class="tsa-legend-item"><span class="tsa-legend-sw" style="background:#fff"></span><span>POSITIVE</span></div><div class="tsa-legend-item"><span class="tsa-legend-sw" style="background:var(--o)"></span><span>NEGATIVE</span></div></div></div>';

  let maxAbs = ci * 2;
  for (let i = 1; i < arr.length; i++) if (Math.abs(arr[i]) > maxAbs) maxAbs = Math.abs(arr[i]);

  h += '<div class="tsa-chart-bars" style="position:relative;">';
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i];
    const isPos = v > 0;
    const hPct = (Math.abs(v) / maxAbs) * 100;
    h += '<div class="tsa-bar-col">';
    h += '<div class="tsa-bar-top">' + (isPos ? '<div class="tsa-bar-pos" style="height:' + hPct + '%"></div>' : '') + '</div>';
    h += '<div class="tsa-bar-line"></div>';
    h += '<div class="tsa-bar-bot">' + (!isPos ? '<div class="tsa-bar-neg" style="height:' + hPct + '%"></div>' : '') + '</div>';
    h += '</div>';
  }
  const ciPct = (ci / maxAbs) * 50; 
  h += '<div class="tsa-bar-ci" style="top:' + (50 - ciPct) + '%"></div>';
  h += '<div class="tsa-bar-ci" style="top:' + (50 + ciPct) + '%"></div>';
  h += '</div>';

  h += '<div class="tsa-pattern"><span>قراءة النمط: </span>' + patternText + '</div>';
  h += '</div>';
  return h;
}

function tsaPatternACF(acf, ci, q) {
  let significant = 0;
  for (let i = 1; i < acf.length; i++) if (Math.abs(acf[i]) > ci) significant++;
  if (q === 0 && significant <= 3) return 'تلاشي سريع للارتباطات يدل على هيمنة مكون الانحدار الذاتي AR. عدد الإزاحات المعنوية: ' + significant + '.';
  if (q > 0) return 'انقطاع نمط ACF بعد إزاحات قليلة يدعم وجود مكون متوسط متحرك MA(' + q + '). عدد الإزاحات المعنوية: ' + significant + '.';
  return 'تلاشي تدريجي للارتباطات. النموذج المختار يعالج هذه البنية. عدد الإزاحات المعنوية: ' + significant + '.';
}

function tsaPatternPACF(pacf, ci, p) {
  let significant = 0;
  for (let i = 1; i < pacf.length; i++) if (Math.abs(pacf[i]) > ci) significant++;
  if (p > 0) return 'انقطاع نمط PACF بعد الإزاحة ' + p + ' يؤكد رتبة الانحدار الذاتي AR(' + p + '). عدد الإزاحات المعنوية: ' + significant + '.';
  if (p === 0) return 'لا يوجد انقطاع حاد في PACF. النموذج لا يحتاج مكون انحدار ذاتي. عدد الإزاحات المعنوية: ' + significant + '.';
  return 'نمط PACF يدعم رتبة النموذج المختار. عدد الإزاحات المعنوية: ' + significant + '.';
}

function tsaReasonText(master, r1H, r4H, r1D) {
  const agree = [r1H.bias, r4H.bias, r1D.bias].filter(b => b === master.bias).length;
  const dir = master.bias === 'BULLISH' ? 'صعوداً' : master.bias === 'BEARISH' ? 'هبوطاً' : 'استقراراً';

  let txt = 'النموذج يرجح ' + dir;
  if (master.bias !== 'NEUTRAL') {
    txt += ' بنسبة ' + Math.abs(master.expectedChange).toFixed(2) + ' بالمئة خلال أفق التوقع. ';
  } else {
    txt += ' خلال أفق التوقع مع تذبذب محدود. ';
  }

  if (agree === 3) txt += 'الفريمات الثلاثة متفقة على نفس الاتجاه مما يعزز قوة الإشارة. ';
  else if (agree === 2) txt += 'فريمان من أصل ثلاثة يدعمان هذا الاتجاه، بينما يختلف الفريم الثالث. ';
  else txt += 'الفريمات الثلاثة تظهر إشارات متباينة، وقد رجح المتوسط المرجح الاتجاه الأقوى وزناً. ';

  txt += 'النموذج المعتمد ARIMA(' + r1D.fit.p + ',1,' + r1D.fit.q + ') على الفريم اليومي بمعيار AIC = ' + tsaFmt(r1D.fit.aic, 2) + '. ';

  if (r1D.ljungBox.pass) txt += 'اختبار البواقي يؤكد سلامة النموذج.';
  else txt += 'البواقي تحوي بعض الارتباط — التوصية تستخدم مع التحفظ.';

  return txt;
}

function tsaQualityAssess(r) {
  const lbPass = r.ljungBox.pass;
  const mape = r.mape;
  let tag, labelAr, desc, pass;
  if (lbPass && mape < 1.5) {
    tag = 'EXCELLENT'; labelAr = 'جودة ممتازة'; pass = true;
    desc = 'النموذج يجتاز كل اختبارات التشخيص بأعلى المعايير. البواقي ضوضاء بيضاء ومتوسط الخطأ النسبي منخفض. التوقعات قابلة للاعتماد بثقة عالية.';
  } else if (lbPass && mape < 3.5) {
    tag = 'GOOD'; labelAr = 'جودة جيدة'; pass = true;
    desc = 'النموذج يجتاز اختبارات التشخيص الأساسية. التوقعات قابلة للاعتماد ضمن فترات الثقة المعطاة.';
  } else if (lbPass || mape < 5.0) {
    tag = 'ACCEPTABLE'; labelAr = 'جودة مقبولة'; pass = false;
    desc = 'النموذج يلتقط الجزء الأكبر من البنية لكن مع بعض الضعف. اقرأ التوقعات كإرشاد عام وليس كقيم دقيقة.';
  } else {
    tag = 'POOR'; labelAr = 'جودة ضعيفة'; pass = false;
    desc = 'البيانات تحوي ضوضاء أعلى من المعتاد أو حدثاً شاذاً يصعب نمذجته. تعامل مع التوقعات بحذر شديد.';
  }
  return { tag: tag, labelAr: labelAr, desc: desc, pass: pass };
}

})();
// ===== END TSA =====


// ===== CCD — Current Candle Decoder =====
(function(){
'use strict';

// ––––– CACHE (توفير API) –––––
const CCD_CACHE = {}; // { 'BTCUSDT_4h': { data, timestamp } }
const CCD_TTL = 60 * 1000; // 60 ثانية صلاحية الكاش

// ––––– UTILITIES –––––
function ccdStatus(msg, type) {
  const el = document.getElementById('ccd-status');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.remove('ccd-error', 'ccd-cached');
  if (type === 'error') el.classList.add('ccd-error');
  else if (type === 'cached') el.classList.add('ccd-cached');
}

function ccdFmt(n, d) {
  if (d === undefined) d = 2;
  if (!isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function ccdFmtPrice(n) {
  if (typeof smartFormat === 'function') return smartFormat(n);
  if (typeof fmtCryptoPrice === 'function') return fmtCryptoPrice(n);
  if (n >= 1000) return ccdFmt(n, 2);
  if (n >= 1) return ccdFmt(n, 4);
  if (n >= 0.01) return ccdFmt(n, 6);
  return ccdFmt(n, 8);
}

function ccdDaysAgo(timestamp) {
  const now = Date.now();
  const diffDays = Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'اليوم';
  if (diffDays === 1) return 'منذ يوم';
  return 'منذ ' + diffDays + ' يوم';
}

function ccdFmtDate(ts) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + dd;
}

function ccdFmtTimeRemaining(ms) {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    const hh = h % 24;
    return d + 'd ' + hh + 'h';
  }
  return h + 'h ' + m + 'm';
}

function ccdTfMs(tf) {
  if (tf === '4h') return 4 * 60 * 60 * 1000;
  if (tf === '1d') return 24 * 60 * 60 * 1000;
  if (tf === '1w') return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

// ––––– API FETCHING (مع كاش) –––––
async function ccdFetchKlines(symbol, interval, limit) {
  const cacheKey = symbol + '_' + interval;
  const now = Date.now();

  // فحص الكاش
  if (CCD_CACHE[cacheKey] && (now - CCD_CACHE[cacheKey].timestamp) < CCD_TTL) {
    return { data: CCD_CACHE[cacheKey].data, cached: true };
  }

  // طلب جديد
  const url = '/api/binance-klines?symbol=' + encodeURIComponent(symbol) +
              '&interval=' + interval + '&limit=' + limit;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Network error ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j) || j.length < 50) throw new Error('Insufficient data');

  const parsed = j.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6]
  }));

  CCD_CACHE[cacheKey] = { data: parsed, timestamp: now };
  return { data: parsed, cached: false };
}

// ––––– BASIC MATH –––––
function ccdEMA(arr, period) {
  if (arr.length < period) return null;
  const k = 2 / (period + 1);
  let ema = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k);
  return ema;
}

function ccdSMA(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ––––– CANDLE TYPE DETECTION –––––
function ccdDetectType(candle, avgRange) {
  const o = candle.open, h = candle.high, l = candle.low, c = candle.close;
  const range = h - l;
  if (range === 0) return { primary: 'Flat', primaryAr: 'شمعة محايدة', strength: 'WEAK',
    description: 'لم يحدث تحرك سعري ملحوظ خلال هذه الشمعة.', bias: 'neutral', score: 0 };

  const body = Math.abs(c - o);
  const bodyPct = (body / range) * 100;
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;
  const upperWickPct = (upperWick / range) * 100;
  const lowerWickPct = (lowerWick / range) * 100;
  const isGreen = c >= o;
  const isLargeRange = range > avgRange * 1.2;

  // DOJI variants
  if (bodyPct < 10) {
    if (upperWickPct > 60 && lowerWickPct < 15) {
      return { primary: 'Gravestone Doji', primaryAr: 'دوجي شاهد القبر',
        strength: 'STRONG', bias: 'bearish', score: -70,
        description: 'دوجي بذيل علوي طويل جداً يدل على رفض المشترين للأسعار العالية وقد يشير لانعكاس هابط محتمل.' };
    }
    if (lowerWickPct > 60 && upperWickPct < 15) {
      return { primary: 'Dragonfly Doji', primaryAr: 'دوجي اليعسوب',
        strength: 'STRONG', bias: 'bullish', score: 70,
        description: 'دوجي بذيل سفلي طويل جداً يدل على رفض البائعين للأسعار المنخفضة وقد يشير لانعكاس صاعد محتمل.' };
    }
    if (upperWickPct > 35 && lowerWickPct > 35) {
      return { primary: 'Long-legged Doji', primaryAr: 'دوجي طويل الأرجل',
        strength: 'MODERATE', bias: 'neutral', score: 0,
        description: 'دوجي بذيلين طويلين يعكس صراعاً متكافئاً بين المشترين والبائعين وحالة تردد في السوق.' };
    }
    return { primary: 'Standard Doji', primaryAr: 'دوجي قياسي',
      strength: 'MODERATE', bias: 'neutral', score: 0,
      description: 'دوجي يدل على تردد السوق وتوازن بين قوى البيع والشراء. يفسر عادة كإشارة انعكاس محتمل.' };
  }

  // MARUBOZU (no/tiny wicks)
  if (bodyPct > 90) {
    if (isGreen) return { primary: 'Bullish Marubozu', primaryAr: 'ماروبوزو صاعد',
      strength: isLargeRange ? 'STRONG' : 'MODERATE', bias: 'bullish', score: isLargeRange ? 85 : 65,
      description: 'شمعة صاعدة بجسم كبير وذيول قصيرة جداً تشير لهيمنة المشترين خلال فترة الشمعة.' };
    return { primary: 'Bearish Marubozu', primaryAr: 'ماروبوزو هابط',
      strength: isLargeRange ? 'STRONG' : 'MODERATE', bias: 'bearish', score: isLargeRange ? -85 : -65,
      description: 'شمعة هابطة بجسم كبير وذيول قصيرة جداً تشير لهيمنة البائعين خلال فترة الشمعة.' };
  }

  // HAMMER / HANGING MAN
  if (lowerWickPct > 55 && bodyPct < 35 && upperWickPct < 15) {
    if (isGreen) return { primary: 'Hammer', primaryAr: 'مطرقة',
      strength: 'STRONG', bias: 'bullish', score: 75,
      description: 'مطرقة بذيل سفلي طويل وجسم صغير في الأعلى. تشير لرفض البائعين وقوة شرائية متصاعدة، خاصة عند الدعوم.' };
    return { primary: 'Hanging Man', primaryAr: 'الرجل المشنوق',
      strength: 'MODERATE', bias: 'bearish', score: -55,
      description: 'شمعة هابطة بذيل سفلي طويل تحذر من انعكاس هابط محتمل عند ظهورها في قمة اتجاه صاعد.' };
  }

  // SHOOTING STAR / INVERTED HAMMER
  if (upperWickPct > 55 && bodyPct < 35 && lowerWickPct < 15) {
    if (!isGreen) return { primary: 'Shooting Star', primaryAr: 'الشهاب',
      strength: 'STRONG', bias: 'bearish', score: -75,
      description: 'شهاب بذيل علوي طويل يدل على رفض المشترين للأسعار العالية وقد يشير لانعكاس هابط، خاصة عند المقاومات.' };
    return { primary: 'Inverted Hammer', primaryAr: 'المطرقة المقلوبة',
      strength: 'MODERATE', bias: 'bullish', score: 55,
      description: 'مطرقة مقلوبة بذيل علوي طويل وجسم صغير. إشارة انعكاس صاعد محتملة عند ظهورها بعد هبوط.' };
  }

  // PIN BAR
  if (lowerWickPct > 45 && bodyPct < 40) {
    return { primary: 'Bullish Pin Bar', primaryAr: 'بن بار صاعد',
      strength: 'MODERATE', bias: 'bullish', score: 55,
      description: 'شمعة بذيل سفلي طويل تشير لاختبار دعم ناجح ودفع شرائي متصاعد.' };
  }
  if (upperWickPct > 45 && bodyPct < 40) {
    return { primary: 'Bearish Pin Bar', primaryAr: 'بن بار هابط',
      strength: 'MODERATE', bias: 'bearish', score: -55,
      description: 'شمعة بذيل علوي طويل تشير لاختبار مقاومة فاشل ودفع بيعي متصاعد.' };
  }

  // SPINNING TOP
  if (bodyPct < 30 && upperWickPct > 25 && lowerWickPct > 25) {
    return { primary: 'Spinning Top', primaryAr: 'القمة الدوارة',
      strength: 'MODERATE', bias: 'neutral', score: 0,
      description: 'شمعة بجسم صغير وذيلين متوسطين تعكس تردداً في السوق وتوقفاً مؤقتاً للاتجاه السائد.' };
  }

  // STRONG BODY
  if (bodyPct > 65) {
    if (isGreen) return { primary: 'Strong Bullish', primaryAr: 'شمعة صاعدة قوية',
      strength: isLargeRange ? 'STRONG' : 'MODERATE', bias: 'bullish',
      score: isLargeRange ? 70 : 50,
      description: 'شمعة صاعدة ذات جسم كبير تشير لهيمنة المشترين على معظم فترة الشمعة.' };
    return { primary: 'Strong Bearish', primaryAr: 'شمعة هابطة قوية',
      strength: isLargeRange ? 'STRONG' : 'MODERATE', bias: 'bearish',
      score: isLargeRange ? -70 : -50,
      description: 'شمعة هابطة ذات جسم كبير تشير لهيمنة البائعين على معظم فترة الشمعة.' };
  }

  // STANDARD CANDLE
  if (isGreen) return { primary: 'Bullish Candle', primaryAr: 'شمعة صاعدة',
    strength: 'WEAK', bias: 'bullish', score: 25,
    description: 'شمعة صاعدة عادية بدون نمط مميز. تدل على ميل شرائي طفيف خلال الفترة.' };
  return { primary: 'Bearish Candle', primaryAr: 'شمعة هابطة',
    strength: 'WEAK', bias: 'bearish', score: -25,
    description: 'شمعة هابطة عادية بدون نمط مميز. تدل على ميل بيعي طفيف خلال الفترة.' };
}

// ––––– ANATOMY DETAILS –––––
function ccdAnatomy(candle) {
  const o = candle.open, h = candle.high, l = candle.low, c = candle.close;
  const range = h - l;
  if (range === 0) return [];

  const body = Math.abs(c - o);
  const bodyPct = (body / range) * 100;
  const upperWick = h - Math.max(o, c);
  const lowerWick = Math.min(o, c) - l;
  const upperWickPct = (upperWick / range) * 100;
  const lowerWickPct = (lowerWick / range) * 100;
  const isGreen = c >= o;

  return [
    { label: 'حجم الجسم', value: ccdFmt(bodyPct, 1) + '%',
      positive: bodyPct > 50,
      note: bodyPct > 70 ? 'جسم كبير — اتجاه واضح' : bodyPct > 40 ? 'جسم متوسط' : 'جسم صغير — تردد' },
    { label: 'الذيل العلوي', value: ccdFmt(upperWickPct, 1) + '%',
      positive: isGreen ? upperWickPct < 30 : upperWickPct > 30,
      note: upperWickPct > 40 ? 'ضغط بيعي علوي' : upperWickPct < 15 ? 'لا مقاومة علوية' : 'ذيل علوي معتدل' },
    { label: 'الذيل السفلي', value: ccdFmt(lowerWickPct, 1) + '%',
      positive: isGreen ? lowerWickPct > 20 : lowerWickPct < 20,
      note: lowerWickPct > 40 ? 'دعم سفلي قوي' : lowerWickPct < 15 ? 'لا دعم تحتي' : 'ذيل سفلي معتدل' },
    { label: 'لون الشمعة', value: isGreen ? 'أبيض' : 'برتقالي',
      positive: isGreen,
      note: isGreen ? 'الإغلاق فوق الافتتاح' : 'الإغلاق تحت الافتتاح' },
  ];
}

// ––––– CONTEXT DETECTION –––––
function ccdAnalyzeContext(candles, currentCandle) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // EMAs
  const ema20 = ccdEMA(closes, 20);
  const ema50 = ccdEMA(closes, 50);
  const ema200 = closes.length >= 200 ? ccdEMA(closes, 200) : null;

  // Recent resistances & supports
  const lookback = Math.min(50, candles.length - 1);
  const recent = candles.slice(-lookback - 1, -1);
  const recentHighs = recent.map(c => c.high);
  const recentLows = recent.map(c => c.low);

  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);

  const rangeHigh = Math.max(...recentHighs);
  const rangeLow = Math.min(...recentLows);
  const rangeWidth = rangeHigh - rangeLow;
  const positionPct = rangeWidth > 0 ? ((currentCandle.close - rangeLow) / rangeWidth) * 100 : 50;

  const price = currentCandle.close;
  let primary, primaryAr, description, bias, score;

  const distToRes = ((resistance - price) / price) * 100;
  const distToSup = ((price - support) / price) * 100;

  if (currentCandle.high > resistance && currentCandle.close > resistance * 0.998) {
    primary = 'BREAKOUT FROM RESISTANCE';
    primaryAr = 'كسر مقاومة';
    description = 'الشمعة تكسر مستوى المقاومة الرئيسي الذي صمد سابقاً، مما يفتح المجال لارتفاع جديد إذا استمر الإغلاق فوقه.';
    bias = 'bullish'; score = 70;
  }
  else if (currentCandle.low < support && currentCandle.close < support * 1.002) {
    primary = 'BREAKDOWN FROM SUPPORT';
    primaryAr = 'كسر دعم';
    description = 'الشمعة تكسر مستوى الدعم الرئيسي الذي صمد سابقاً، مما يفتح المجال لهبوط جديد إذا استمر الإغلاق تحته.';
    bias = 'bearish'; score = -70;
  }
  else if (distToRes < 1 && distToRes >= 0) {
    primary = 'TESTING RESISTANCE';
    primaryAr = 'اختبار مقاومة';
    description = 'الشمعة تختبر مستوى مقاومة قريباً. سلوكها سيحدد إن كان الاختراق صاعداً أم الارتداد هابطاً.';
    bias = 'neutral'; score = 0;
  }
  else if (distToSup < 1 && distToSup >= 0) {
    primary = 'TESTING SUPPORT';
    primaryAr = 'اختبار دعم';
    description = 'الشمعة تختبر مستوى دعم قريباً. سلوكها سيحدد إن كان الارتداد صاعداً أم الكسر هابطاً.';
    bias = 'neutral'; score = 0;
  }
  else if (ema20 && ema50 && price > ema20 && price > ema50 && (!ema200 || price > ema200)) {
    primary = 'BULLISH TREND';
    primaryAr = 'اتجاه صاعد';
    description = 'السعر فوق المتوسطات الرئيسية، مما يدل على هيمنة الاتجاه الصاعد. الشمعة الحالية تتحرك ضمن هذا السياق.';
    bias = 'bullish'; score = 40;
  }
  else if (ema20 && ema50 && price < ema20 && price < ema50 && (!ema200 || price < ema200)) {
    primary = 'BEARISH TREND';
    primaryAr = 'اتجاه هابط';
    description = 'السعر تحت المتوسطات الرئيسية، مما يدل على هيمنة الاتجاه الهابط. الشمعة الحالية تتحرك ضمن هذا السياق.';
    bias = 'bearish'; score = -40;
  }
  else {
    primary = 'RANGE-BOUND';
    primaryAr = 'حركة عرضية';
    description = 'الشمعة تتحرك داخل نطاق محصور بين الدعم والمقاومة دون اتجاه واضح حالياً.';
    bias = 'neutral'; score = 0;
  }

  const details = [
    { label: 'أقرب مقاومة', value: '$' + ccdFmtPrice(resistance),
      distance: distToRes < 0 ? 'تم اختراقها' : '+' + ccdFmt(distToRes, 2) + '%',
      positive: distToRes < 0 },
    { label: 'أقرب دعم', value: '$' + ccdFmtPrice(support),
      distance: distToSup < 0 ? 'تم كسرها' : '-' + ccdFmt(distToSup, 2) + '%',
      positive: distToSup > 0 },
  ];
  if (ema20) details.push({ label: 'EMA 20', value: '$' + ccdFmtPrice(ema20),
    distance: price > ema20 ? 'فوق' : 'تحت', positive: price > ema20 });
  if (ema50) details.push({ label: 'EMA 50', value: '$' + ccdFmtPrice(ema50),
    distance: price > ema50 ? 'فوق' : 'تحت', positive: price > ema50 });
  if (ema200) details.push({ label: 'EMA 200', value: '$' + ccdFmtPrice(ema200),
    distance: price > ema200 ? 'فوق' : 'تحت', positive: price > ema200 });
  details.push({ label: 'موقع داخل النطاق', value: ccdFmt(positionPct, 0) + '%',
    distance: positionPct > 66 ? 'الجزء العلوي' : positionPct < 33 ? 'الجزء السفلي' : 'منتصف النطاق',
    positive: positionPct > 50 });

  return { primary, primaryAr, description, bias, score, details, resistance, support };
}

// ––––– VOLUME ANALYSIS –––––
function ccdAnalyzeVolume(candles, currentCandle) {
  const recent = candles.slice(-21, -1);
  const volumes = recent.map(c => c.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const currentVol = currentCandle.volume;

  const tfMs = ccdTfMs(arguments[2] || '1d');
  const elapsed = Date.now() - currentCandle.time;
  const elapsedPct = Math.min(1, elapsed / tfMs);
  const projectedVol = elapsedPct > 0.1 ? currentVol / elapsedPct : currentVol;

  const ratio = avgVolume > 0 ? projectedVol / avgVolume : 1;

  let verdict, verdictAr, strength, description, score;
  if (ratio > 1.5) {
    verdict = 'HIGH VOLUME'; verdictAr = 'حجم مرتفع';
    strength = 'POSITIVE'; score = 30;
    description = 'الحجم أعلى بكثير من متوسط آخر عشرين شمعة، مما يعزز موثوقية الحركة الحالية ويدل على مشاركة قوية من المتداولين.';
  } else if (ratio > 1.1) {
    verdict = 'ABOVE AVERAGE'; verdictAr = 'فوق المتوسط';
    strength = 'POSITIVE'; score = 15;
    description = 'الحجم أعلى من المتوسط بشكل معتدل، مما يدعم موثوقية الحركة الحالية.';
  } else if (ratio > 0.9) {
    verdict = 'AVERAGE VOLUME'; verdictAr = 'حجم متوسط';
    strength = 'NEUTRAL'; score = 0;
    description = 'الحجم قريب من المتوسط ولا يقدم تأكيداً قوياً للحركة في أي اتجاه.';
  } else {
    verdict = 'LOW VOLUME'; verdictAr = 'حجم منخفض';
    strength = 'NEGATIVE'; score = -15;
    description = 'الحجم أقل من المتوسط، مما يضعف موثوقية الحركة الحالية ويشير لمشاركة محدودة من المتداولين.';
  }

  return {
    current: projectedVol,
    currentRaw: currentVol,
    average: avgVolume,
    ratio: ratio,
    verdict, verdictAr, strength, description, score,
    ratio_visual: Math.min(200, ratio * 100)
  };
}

// ––––– CLOSE FORECAST –––––
function ccdForecastClose(candles, currentCandle, tf) {
  const tfMs = ccdTfMs(tf);
  const elapsed = Date.now() - currentCandle.time;
  const remaining = Math.max(0, tfMs - elapsed);
  const elapsedPct = elapsed / tfMs;

  const recent = candles.slice(-21, -1);
  const moves = [];
  for (let i = 1; i < recent.length; i++) {
    moves.push((recent[i].close - recent[i-1].close) / recent[i-1].close);
  }
  const avgMove = moves.reduce((a, b) => a + b, 0) / moves.length;
  const stdMove = Math.sqrt(moves.reduce((s, m) => s + (m - avgMove) ** 2, 0) / moves.length);

  const currentMove = (currentCandle.close - currentCandle.open) / currentCandle.open;

  const remainingPct = Math.max(0, 1 - elapsedPct);
  const momentumPart = currentMove * (1 + remainingPct * 0.3);
  const meanReversion = avgMove * remainingPct * 0.2;
  const projected = currentCandle.open * (1 + momentumPart + meanReversion);

  const ciWidth = 1.96 * stdMove * Math.sqrt(Math.max(0.1, remainingPct)) * currentCandle.open;
  const low = projected - ciWidth;
  const high = projected + ciWidth;

  const probability = Math.round(50 + Math.min(35, Math.abs(currentMove / Math.max(stdMove, 0.001)) * 12));

  let bias, biasAr;
  const projectedChange = (projected - currentCandle.open) / currentCandle.open;
  if (projectedChange > stdMove * 0.5) {
    bias = 'BULLISH_CLOSE'; biasAr = 'إغلاق صاعد محتمل';
  } else if (projectedChange < -stdMove * 0.5) {
    bias = 'BEARISH_CLOSE'; biasAr = 'إغلاق هابط محتمل';
  } else {
    bias = 'NEUTRAL_CLOSE'; biasAr = 'إغلاق محايد';
  }

  let reasoning;
  if (elapsedPct < 0.2) {
    reasoning = 'الشمعة في بدايتها ' + Math.round(elapsedPct * 100) + ' بالمئة، التوقع أولي وقد يتغير جوهرياً مع تطور الحركة.';
  } else if (elapsedPct < 0.7) {
    reasoning = 'الشمعة قطعت ' + Math.round(elapsedPct * 100) + ' بالمئة من زمنها. التوقع مبني على الزخم الحالي ومتوسط حركة آخر عشرين شمعة.';
  } else {
    reasoning = 'الشمعة في مراحلها الأخيرة ' + Math.round(elapsedPct * 100) + ' بالمئة، نطاق التوقع ضيق نسبياً والاتجاه أوضح.';
  }

  return {
    mostLikely: projected,
    range: { low: low, high: high },
    probability: Math.min(85, probability),
    bias, biasAr,
    reasoning,
    elapsedPct,
    remaining
  };
}

// ––––– HISTORICAL MATCHES –––––
function ccdFindMatches(candles, currentCandle, currentType, contextData, volumeData) {
  const cR = currentCandle.high - currentCandle.low;
  const cBodyPct = cR > 0 ? Math.abs(currentCandle.close - currentCandle.open) / cR : 0;
  const cUpperPct = cR > 0 ? (currentCandle.high - Math.max(currentCandle.open, currentCandle.close)) / cR : 0;
  const cLowerPct = cR > 0 ? (Math.min(currentCandle.open, currentCandle.close) - currentCandle.low) / cR : 0;
  const cIsGreen = currentCandle.close >= currentCandle.open;
  const cVolRatio = volumeData.ratio;

  const recent20 = candles.slice(-21, -1);
  const avgRange = recent20.reduce((s, c) => s + (c.high - c.low), 0) / recent20.length;

  const searchEnd = candles.length - 6;
  const searchStart = Math.max(20, searchEnd - 200);

  const matches = [];
  for (let i = searchStart; i < searchEnd; i++) {
    const c = candles[i];
    const r = c.high - c.low;
    if (r <= 0) continue;

    const bodyPct = Math.abs(c.close - c.open) / r;
    const upperPct = (c.high - Math.max(c.open, c.close)) / r;
    const lowerPct = (Math.min(c.open, c.close) - c.low) / r;
    const isGreen = c.close >= c.open;

    if (isGreen !== cIsGreen) continue;

    const localAvg = candles.slice(Math.max(0, i-20), i).reduce((s, x) => s + x.volume, 0) / 20;
    const volRatio = localAvg > 0 ? c.volume / localAvg : 1;

    let similarity = 100;
    similarity -= Math.abs(bodyPct - cBodyPct) * 60;
    similarity -= Math.abs(upperPct - cUpperPct) * 50;
    similarity -= Math.abs(lowerPct - cLowerPct) * 50;
    similarity -= Math.min(30, Math.abs(volRatio - cVolRatio) * 15);

    if (similarity < 65) continue;

    const next1 = candles[i+1];
    const next3 = candles[i+3];
    const next5 = candles[i+5];
    if (!next1 || !next3 || !next5) continue;

    const change1 = ((next1.close - c.close) / c.close) * 100;
    const change3 = ((next3.close - c.close) / c.close) * 100;
    const change5 = ((next5.close - c.close) / c.close) * 100;

    let result, resultType;
    if (change5 > 2) { result = 'صعود قوي'; resultType = 'bullish'; }
    else if (change5 > 0.5) { result = 'صعود معتدل'; resultType = 'bullish'; }
    else if (change5 < -2) { result = 'هبوط قوي'; resultType = 'bearish'; }
    else if (change5 < -0.5) { result = 'هبوط معتدل'; resultType = 'bearish'; }
    else if (change1 > 0.5 && change5 < 0) { result = 'صعود ثم تراجع'; resultType = 'mixed'; }
    else if (change1 < -0.5 && change5 > 0) { result = 'هبوط ثم صعود'; resultType = 'mixed'; }
    else { result = 'حركة عرضية'; resultType = 'mixed'; }

    matches.push({
      index: i,
      date: ccdFmtDate(c.time),
      timeAgo: ccdDaysAgo(c.time),
      similarity: Math.round(similarity),
      priceAtMatch: c.close,
      outcome: {
        next1: { change: change1, direction: change1 >= 0 ? 'up' : 'down' },
        next3: { change: change3, direction: change3 >= 0 ? 'up' : 'down' },
        next5: { change: change5, direction: change5 >= 0 ? 'up' : 'down' },
      },
      result, resultType
    });
  }

  matches.sort((a, b) => b.similarity - a.similarity);
  const top5 = matches.slice(0, 5);

  let bullish = 0, bearish = 0;
  let sum1 = 0, sum3 = 0, sum5 = 0;
  top5.forEach(m => {
    if (m.outcome.next5.direction === 'up') bullish++; else bearish++;
    sum1 += m.outcome.next1.change;
    sum3 += m.outcome.next3.change;
    sum5 += m.outcome.next5.change;
  });

  const count = top5.length;
  const stats = {
    total: count,
    bullishOutcomes: bullish,
    bearishOutcomes: bearish,
    successRate: count > 0 ? Math.round((bullish / count) * 100) : 0,
    avgChange1: count > 0 ? sum1 / count : 0,
    avgChange3: count > 0 ? sum3 / count : 0,
    avgChange5: count > 0 ? sum5 / count : 0,
  };

  return { matches: top5, stats };
}

// ––––– MASTER VERDICT –––––
function ccdComputeVerdict(typeData, contextData, volumeData, historicalStats) {
  const wType = 0.30;
  const wContext = 0.30;
  const wVolume = 0.15;
  const wHistory = 0.25;

  let historyScore = 0;
  if (historicalStats.total > 0) {
    const directional = (historicalStats.successRate - 50) * 2; 
    const magnitude = Math.max(-50, Math.min(50, historicalStats.avgChange5 * 8));
    historyScore = (directional + magnitude) / 2;
  }

  const totalScore = typeData.score * wType +
                     contextData.score * wContext +
                     volumeData.score * wVolume +
                     historyScore * wHistory;

  const strength = Math.min(100, Math.round(Math.abs(totalScore)));
  let bias, label, labelAr;
  if (totalScore > 15) {
    bias = 'bullish'; label = 'BULLISH MOMENTUM'; labelAr = 'زخم صاعد';
  } else if (totalScore < -15) {
    bias = 'bearish'; label = 'BEARISH MOMENTUM'; labelAr = 'زخم هابط';
  } else {
    bias = 'neutral'; label = 'NEUTRAL / INDECISIVE'; labelAr = 'حياد / تردد';
  }

  const signals = [];
  if (Math.abs(typeData.score) > 30) signals.push('نمط ' + typeData.primaryAr);
  if (Math.abs(contextData.score) > 30) signals.push(contextData.primaryAr);
  if (Math.abs(volumeData.score) > 10) signals.push(volumeData.verdictAr);

  let summary;
  if (signals.length >= 2) {
    summary = 'الشمعة الحالية تجمع عدة إشارات: ' + signals.join('، ') + '. ';
  } else if (signals.length === 1) {
    summary = 'الشمعة الحالية تظهر إشارة واحدة بارزة: ' + signals[0] + '. ';
  } else {
    summary = 'الشمعة الحالية لا تحمل إشارات قوية ' + (bias === 'neutral' ? 'وتعكس حالة تردد. ' : '. ');
  }

  if (historicalStats.total > 0) {
    summary += 'السوابق التاريخية المماثلة حققت ';
    if (historicalStats.successRate >= 60) {
      summary += 'صعوداً في ' + historicalStats.bullishOutcomes + ' من أصل ' + historicalStats.total + ' حالات.';
    } else if (historicalStats.successRate <= 40) {
      summary += 'هبوطاً في ' + historicalStats.bearishOutcomes + ' من أصل ' + historicalStats.total + ' حالات.';
    } else {
      summary += 'نتائج مختلطة (' + historicalStats.bullishOutcomes + ' صعود، ' + historicalStats.bearishOutcomes + ' هبوط).';
    }
  }

  return { label, labelAr, strength, bias, summary, totalScore };
}

// ––––– MAIN ENTRY –––––
window.runCCD = async function() {
  const sym = (document.getElementById('ccd-symbol').value || 'BTC').trim().toUpperCase();
  const tf = document.getElementById('ccd-tf').value;
  const symbol = sym.endsWith('USDT') ? sym : sym + 'USDT';
  const resultEl = document.getElementById('ccd-result');
  const btn = document.getElementById('ccd-btn');

  resultEl.classList.remove('ccd-show');
  resultEl.innerHTML = '';
  if (btn) btn.disabled = true;

  if (typeof trackToolUsage === 'function') trackToolUsage('pg-ccd');

  try {
    ccdStatus('جاري جلب البيانات ... ' + symbol + ' · ' + tf.toUpperCase());

    const { data: candles, cached } = await ccdFetchKlines(symbol, tf, 500);

    if (cached) ccdStatus('تم استخدام البيانات المحفوظة — توفيراً للطلبات', 'cached');

    ccdStatus('جاري تحليل الشمعة الحالية ...');

    const currentCandle = candles[candles.length - 1];
    const closedCandles = candles.slice(0, -1);

    const recent20 = closedCandles.slice(-20);
    const avgRange = recent20.reduce((s, c) => s + (c.high - c.low), 0) / recent20.length;

    const typeData = ccdDetectType(currentCandle, avgRange);
    const anatomy = ccdAnatomy(currentCandle);
    typeData.details = anatomy;

    const contextData = ccdAnalyzeContext(closedCandles, currentCandle);
    const volumeData = ccdAnalyzeVolume(candles, currentCandle, tf);
    const forecastData = ccdForecastClose(closedCandles, currentCandle, tf);
    const historical = ccdFindMatches(candles, currentCandle, typeData, contextData, volumeData);
    const verdict = ccdComputeVerdict(typeData, contextData, volumeData, historical.stats);

    const html = ccdRenderReport({
      symbol, tf, currentCandle, candles,
      typeData, contextData, volumeData, forecastData,
      historical, verdict
    });

    resultEl.innerHTML = html;
    resultEl.classList.add('ccd-show');

    if (!cached) ccdStatus('اكتمل التحليل · ' + ccdFmtDate(Date.now()));

  } catch (err) {
    console.error('CCD error:', err);
    ccdStatus('تعذّر التحليل: ' + (err.message || 'خطأ غير معروف') + ' — تأكد من رمز العملة', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.refreshCCD = function() {
  runCCD();
};

// ––––– RENDER –––––
function ccdRenderReport(d) {
  const { symbol, tf, currentCandle, typeData, contextData, volumeData,
  forecastData, historical, verdict } = d;

  const tfLabels = { '4h': '4H', '1d': '1D', '1w': '1W' };
  const tfLabel = tfLabels[tf] || tf;

  const verdictClass = verdict.bias === 'bullish' ? 'ccd-master-up'
                     : verdict.bias === 'bearish' ? 'ccd-master-dn' : 'ccd-master-nu';
  const verdictColorCls = verdict.bias === 'bullish' ? 'ccd-up'
                        : verdict.bias === 'bearish' ? 'ccd-dn' : 'ccd-nu';

  const cR = currentCandle.high - currentCandle.low;
  const bodyTop = Math.max(currentCandle.open, currentCandle.close);
  const bodyBot = Math.min(currentCandle.open, currentCandle.close);
  const wickTopPct = cR > 0 ? ((currentCandle.high - bodyTop) / cR) * 100 : 0;
  const bodyPct = cR > 0 ? ((bodyTop - bodyBot) / cR) * 100 : 0;
  const wickBotPct = cR > 0 ? ((bodyBot - currentCandle.low) / cR) * 100 : 0;
  const isGreen = currentCandle.close >= currentCandle.open;
  const candleClass = isGreen ? 'ccd-wick-up' : 'ccd-wick-dn';
  const bodyClass = isGreen ? 'ccd-body-up' : 'ccd-body-dn';

  const changePct = ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100;

  let html = '';

  html += '<div class="ccd-timer">';
  html += '<div class="ccd-timer-left"><div class="ccd-pulse"></div>';
  html += '<span class="ccd-timer-label">CANDLE LIVE / ' + symbol + ' · ' + tfLabel + '</span></div>';
  html += '<div class="ccd-timer-right">';
  html += '<span>الوقت المنقضي: <span>' + Math.round(forecastData.elapsedPct * 100) + '%</span></span>';
  html += '<span class="ccd-time-left">الوقت المتبقي: <span>' + ccdFmtTimeRemaining(forecastData.remaining) + '</span></span>';
  html += '</div></div>';

  html += '<div class="ccd-master ' + verdictClass + '">';
  html += '<div class="ccd-master-label">MASTER VERDICT</div>';
  html += '<div class="ccd-master-grid">';

  html += '<div>';
  html += '<div class="ccd-mk-label">التفسير اللحظي</div>';
  html += '<div class="ccd-verdict-name ' + verdictColorCls + '">' + verdict.labelAr + '</div>';
  html += '<div class="ccd-verdict-en ' + verdictColorCls + '">' + verdict.label + '</div>';
  html += '<div class="ccd-strength">';
  html += '<div class="ccd-mk-label">قوة الحكم</div>';
  html += '<div class="ccd-strength-val" style="direction: ltr; justify-content: flex-end;"><div class="ccd-strength-num ' + verdictColorCls + '">' + verdict.strength + '%</div></div>';
    html += '<div class="ccd-strength-bar"><div class="ccd-strength-fill" style="width:' + verdict.strength + '%;background:' + (verdict.bias==='bullish'?'#fff':verdict.bias==='bearish'?'var(--o)':'#888') + ';"></div></div>';
  html += '</div>';
  html += '<div class="ccd-summary-box">' + verdict.summary + '</div>';
  html += '</div>';

  html += '<div class="ccd-candle-card">';
  html += '<div class="ccd-candle-label">LIVE CANDLE</div>';
  html += '<div class="ccd-candle-vis">';
  html += '<div class="ccd-wick ' + candleClass + '" style="height:' + wickTopPct + '%"></div>';
  html += '<div class="ccd-body ' + bodyClass + '" style="height:' + bodyPct + '%"></div>';
  html += '<div class="ccd-wick ' + candleClass + '" style="height:' + wickBotPct + '%"></div>';
  html += '</div>';
  html += '<div class="ccd-candle-info">';
  html += '<div class="ccd-candle-price">$' + ccdFmtPrice(currentCandle.close) + '</div>';
  html += '<div class="ccd-candle-pct ' + (changePct >= 0 ? 'ccd-up' : 'ccd-dn') + '">' + (changePct >= 0 ? '+' : '') + ccdFmt(changePct, 2) + '%</div>';
  html += '</div>';
  html += '</div>';

  html += '</div></div>';

  html += '<div class="ccd-section">OHLC DATA / بيانات الشمعة الحالية</div>';
  html += '<div class="ccd-ohlc">';
  html += '<div class="ccd-ohlc-card"><div class="ccd-ohlc-label">OPEN</div><div class="ccd-ohlc-val">$' + ccdFmtPrice(currentCandle.open) + '</div></div>';
  html += '<div class="ccd-ohlc-card"><div class="ccd-ohlc-label">HIGH</div><div class="ccd-ohlc-val">$' + ccdFmtPrice(currentCandle.high) + '</div></div>';
  html += '<div class="ccd-ohlc-card"><div class="ccd-ohlc-label">LOW</div><div class="ccd-ohlc-val ccd-dn">$' + ccdFmtPrice(currentCandle.low) + '</div></div>';
  html += '<div class="ccd-ohlc-card ccd-live"><div class="ccd-ohlc-label">LIVE</div><div class="ccd-ohlc-val ccd-live-val">$' + ccdFmtPrice(currentCandle.close) + '</div></div>';
  html += '</div>';

  html += '<div class="ccd-section">CANDLE TYPE / نوع الشمعة</div>';
  html += '<div class="ccd-card">';
  html += '<div class="ccd-card-head">';
  html += '<div><div class="ccd-card-title">' + typeData.primaryAr + '</div>';
  html += '<div class="ccd-card-en">' + typeData.primary + '</div></div>';
  const tagCls = typeData.strength === 'STRONG' ? 'ccd-tag-strong' : typeData.strength === 'MODERATE' ? 'ccd-tag-mod' : 'ccd-tag-weak';
  html += '<div class="ccd-card-tag ' + tagCls + '">' + typeData.strength + '</div>';
  html += '</div>';
  html += '<div class="ccd-card-desc">' + typeData.description + '</div>';
  html += '<div class="ccd-detail-grid-2">';
  typeData.details.forEach(det => {
    const valCls = det.positive ? 'ccd-up' : 'ccd-dn';
    html += '<div class="ccd-detail-row"><div>';
    html += '<div class="ccd-detail-label">' + det.label + '</div>';
    html += '<div class="ccd-detail-note">' + det.note + '</div></div>';
    html += '<div class="ccd-detail-val ' + valCls + '">' + det.value + '</div></div>';
  });
  html += '</div></div>';

  html += '<div class="ccd-section">CONTEXT / الموقع السياقي</div>';
  html += '<div class="ccd-card">';
  html += '<div class="ccd-card-head"><div>';
  html += '<div class="ccd-card-title">' + contextData.primaryAr + '</div>';
  html += '<div class="ccd-card-en">' + contextData.primary + '</div></div></div>';
  html += '<div class="ccd-card-desc">' + contextData.description + '</div>';
  html += '<div class="ccd-detail-grid-3">';
  contextData.details.forEach(det => {
    const valCls = det.positive ? 'ccd-up' : 'ccd-dn';
    html += '<div class="ccd-detail-cell">';
    html += '<div class="ccd-detail-cell-label">' + det.label + '</div>';
    html += '<div class="ccd-detail-cell-val ' + valCls + '">' + det.value + '</div>';
    html += '<div class="ccd-detail-cell-meta">' + det.distance + '</div>';
    html += '</div>';
  });
  html += '</div></div>';

  html += '<div class="ccd-section">VOLUME / تحليل الحجم</div>';
  html += '<div class="ccd-card">';
  html += '<div class="ccd-vol-head"><div>';
  html += '<div class="ccd-card-title">' + volumeData.verdictAr + '</div>';
  html += '<div class="ccd-card-en">' + volumeData.verdict + '</div></div>';
  const volColor = volumeData.strength === 'POSITIVE' ? 'ccd-up' : volumeData.strength === 'NEGATIVE' ? 'ccd-dn' : 'ccd-nu';
  html += '<div class="ccd-vol-ratio ' + volColor + '">' + volumeData.ratio.toFixed(2) + '×</div>';
  html += '</div>';
  html += '<div class="ccd-vol-labels"><span>المتوسط (20)</span><span>الحجم الحالي</span></div>';
  html += '<div class="ccd-vol-bar"><div class="ccd-vol-avg-line"></div>';
  const volFillColor = volumeData.strength === 'POSITIVE' ? '#fff' : volumeData.strength === 'NEGATIVE' ? 'var(--o)' : '#888';
  html += '<div class="ccd-vol-fill" style="width:' + Math.min(100, volumeData.ratio_visual / 2) + '%;background:' + volFillColor + ';"></div>';
  html += '</div>';
  html += '<div class="ccd-vol-numbers"><span>' + ccdFmt(volumeData.average, 1) + '</span><span>' + ccdFmt(volumeData.current, 1) + '</span></div>';
  html += '<div class="ccd-card-desc" style="margin-top:14px;margin-bottom:0;">' + volumeData.description + '</div>';
  html += '</div>';

  html += '<div class="ccd-section">CLOSE FORECAST / توقع الإغلاق</div>';
  html += '<div class="ccd-card">';
  html += '<div class="ccd-forecast-grid">';
  html += '<div>';
  html += '<div class="ccd-mk-label">السعر الأرجح للإغلاق</div>';
  html += '<div class="ccd-forecast-num">$' + ccdFmtPrice(forecastData.mostLikely) + '</div>';
  html += '<div class="ccd-forecast-range">نطاق: $' + ccdFmtPrice(forecastData.range.low) + ' — $' + ccdFmtPrice(forecastData.range.high) + '</div>';
  html += '</div>';
  html += '<div>';
  html += '<div class="ccd-mk-label">نوع الإغلاق المتوقع</div>';
  const fbCls = forecastData.bias === 'BULLISH_CLOSE' ? 'ccd-up' : forecastData.bias === 'BEARISH_CLOSE' ? 'ccd-dn' : 'ccd-nu';
  html += '<div class="ccd-forecast-bias ' + fbCls + '">' + forecastData.biasAr + '</div>';
  html += '<div class="ccd-forecast-prob"><span class="ccd-forecast-prob-label">احتمالية</span><span class="ccd-forecast-prob-val">' + forecastData.probability + '%</span></div>';
  html += '</div></div>';
  html += '<div class="ccd-card-desc" style="margin-bottom:0;">' + forecastData.reasoning + '</div>';
  html += '</div>';

  html += '<div class="ccd-section">HISTORICAL MATCHES / السوابق التاريخية</div>';
  const stats = historical.stats;
  html += '<div class="ccd-stats-grid">';
  html += '<div class="ccd-stat"><div class="ccd-stat-label">معدل النجاح</div><div class="ccd-stat-val">' + stats.successRate + '%</div><div class="ccd-stat-sub">' + stats.bullishOutcomes + '/' + stats.total + ' صعدت</div></div>';
  html += '<div class="ccd-stat"><div class="ccd-stat-label">متوسط 1 شمعة</div><div class="ccd-stat-val ' + (stats.avgChange1 >= 0 ? 'ccd-up' : 'ccd-dn') + '">' + (stats.avgChange1 >= 0 ? '+' : '') + ccdFmt(stats.avgChange1, 2) + '%</div></div>';
  html += '<div class="ccd-stat"><div class="ccd-stat-label">متوسط 3 شموع</div><div class="ccd-stat-val ' + (stats.avgChange3 >= 0 ? 'ccd-up' : 'ccd-dn') + '">' + (stats.avgChange3 >= 0 ? '+' : '') + ccdFmt(stats.avgChange3, 2) + '%</div></div>';
  html += '<div class="ccd-stat"><div class="ccd-stat-label">متوسط 5 شموع</div><div class="ccd-stat-val ' + (stats.avgChange5 >= 0 ? 'ccd-up' : 'ccd-dn') + '">' + (stats.avgChange5 >= 0 ? '+' : '') + ccdFmt(stats.avgChange5, 2) + '%</div></div>';
  html += '</div>';

  if (historical.matches.length === 0) {
    html += '<div class="ccd-card" style="text-align:center;color:#888;">لا توجد سوابق تاريخية كافية مماثلة للشمعة الحالية في البيانات المتاحة.</div>';
  } else {
    html += '<div class="ccd-table-wrap"><div class="ccd-table-scroll"><table class="ccd-table">';
    html += '<thead><tr>';
    html += '<th>التاريخ</th><th>التشابه</th><th>السعر</th><th>+1 شمعة</th><th>+3 شموع</th><th>+5 شموع</th><th>النتيجة</th>';
    html += '</tr></thead><tbody>';
    historical.matches.forEach(m => {
      html += '<tr>';
      html += '<td><div>' + m.date + '</div><div class="ccd-table-date-sub">' + m.timeAgo + '</div></td>';
      html += '<td><span class="ccd-similarity">' + m.similarity + '%</span></td>';
      html += '<td>$' + ccdFmtPrice(m.priceAtMatch) + '</td>';
      html += '<td class="' + (m.outcome.next1.direction === 'up' ? 'ccd-up' : 'ccd-dn') + '">' + (m.outcome.next1.change >= 0 ? '+' : '') + ccdFmt(m.outcome.next1.change, 2) + '%</td>';
      html += '<td class="' + (m.outcome.next3.direction === 'up' ? 'ccd-up' : 'ccd-dn') + '">' + (m.outcome.next3.change >= 0 ? '+' : '') + ccdFmt(m.outcome.next3.change, 2) + '%</td>';
      html += '<td class="' + (m.outcome.next5.direction === 'up' ? 'ccd-up' : 'ccd-dn') + '">' + (m.outcome.next5.change >= 0 ? '+' : '') + ccdFmt(m.outcome.next5.change, 2) + '%</td>';
      html += '<td><span class="ccd-result-' + m.resultType + '">' + m.result + '</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
  }

  html += '<div class="ccd-section">READING GUIDE / دليل القراءة</div>';
  html += '<div class="ccd-guide">';
  html += '<div class="ccd-guide-block"><div class="ccd-guide-h">ما الذي تقدمه هذه الأداة</div><div class="ccd-guide-p">قراءة لحظية للشمعة الجارية على الفريم المختار، قبل أن تُغلق. تحلل أربعة أبعاد متكاملة: نوع الشمعة الفني، موقعها بالنسبة للدعوم والمقاومات، حجم التداول المصاحب لها، والسوابق التاريخية المشابهة. الهدف فهم ما يحدث الآن بدلاً من انتظار الإغلاق.</div></div>';
  html += '<div class="ccd-guide-block"><div class="ccd-guide-h">قراءة الحكم الرئيسي</div><div class="ccd-guide-p">الحكم الرئيسي يجمع كل الإشارات في تقييم واحد. الإطار الأبيض يعني زخماً صاعداً، البرتقالي يعني زخماً هابطاً. قوة الحكم من صفر إلى مئة تعكس مدى تلاقي الإشارات الأربع في نفس الاتجاه. القراءات فوق سبعين تدل على إشارة قوية، بين خمسين وسبعين متوسطة، وأقل من خمسين ضعيفة.</div></div>';
  html += '<div class="ccd-guide-block"><div class="ccd-guide-h">قراءة نوع الشمعة</div><div class="ccd-guide-p">الأداة تتعرف على أكثر من خمسة عشر نمطاً شائعاً مثل الدوجي والمطرقة والشهاب والماروبوزو. لكل نمط دلالة سلوكية مرتبطة بنفسية السوق. التفاصيل التشريحية للشمعة تشرح من أين جاء التصنيف بدقة: نسبة الجسم للذيول، الإغلاق مقابل الافتتاح، وقوة الإشارة.</div></div>';
  html += '<div class="ccd-guide-block"><div class="ccd-guide-h">قراءة الموقع السياقي</div><div class="ccd-guide-p">الشمعة وحدها لا تكفي، الموقع هو الأهم. شمعة المطرقة عند دعم رئيسي إشارة قوية، نفس الشمعة في منتصف الرحلة بلا قيمة تذكر. الأداة تحدد ما إذا كانت الشمعة الحالية تكسر مقاومة، ترتد من دعم، تحدث داخل نطاق، أو تتجاوز مستويات المتوسطات المتحركة المرجعية.</div></div>';
  html += '<div class="ccd-guide-block"><div class="ccd-guide-h">قراءة الحجم</div><div class="ccd-guide-p">الحجم يؤكد أو يكذب الحركة السعرية. شريط الحجم يقارن الحجم الحالي بمتوسط آخر عشرين شمعة. القيمة أعلى من واحد ونصف تعتبر دعماً قوياً للحركة، بين واحد وواحد ونصف داعمة بدرجة معتدلة، وأقل من واحد تشكك في موثوقية الإشارة.</div></div>';
  html += '<div class="ccd-guide-block"><div class="ccd-guide-h">قراءة السوابق التاريخية</div><div class="ccd-guide-p">الجدول يعرض آخر خمس شموع تاريخية مماثلة للشمعة الحالية بنفس النوع واللون والحجم النسبي. نسبة التشابه تقيس مدى المطابقة. الأعمدة الثلاثة الأخيرة تظهر ما حدث بعد كل سابقة بشمعة وثلاث شموع وخمس شموع. التشابه فوق الثمانين يعتبر معتبراً، والمعدل التراكمي للنتائج هو أقوى دليل إحصائي على ما قد يحدث الآن.</div></div>';
  html += '</div>';

  html += '<div class="ccd-disc">';
  html += '<div class="ccd-disc-h">DISCLAIMER / إخلاء مسؤولية</div>';
  html += 'التحليل لحظي ومبني على بيانات الشمعة الجارية التي لم تُغلق بعد، وقد تتغير قراءته جوهرياً مع تطور حركة السعر حتى الإغلاق. السوابق التاريخية إحصائية وليست ضماناً للنتيجة. التحليل مخصص للأسواق الفورية فقط دون رفع مالي أو مشتقات. القرار النهائي ومخاطره مسؤولية المستخدم وحده.';
  html += '</div>';

  html += '<div class="ccd-footer">منصة 360° — CURRENT CANDLE DECODER / تحليل الشمعه الحالية</div>';

  return html;
}

})();
// ===== END CCD =====
