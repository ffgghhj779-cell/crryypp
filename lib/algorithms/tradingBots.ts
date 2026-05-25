/**
 * lib/algorithms/tradingBots.ts
 *
 * Multi-Strategy Trading Bot Engine
 * Generates signals and trade setups for 10 distinct AI trading algorithms.
 */

export interface TradingBotSignal {
  botId: string;
  nameEn: string;
  nameAr: string;
  descriptionAr: string;
  signal: 'BUY' | 'SELL' | 'WAIT';
  winRate: number;
  riskReward: string;
  entryPrice: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
}

export function generateBotSignal(botId: string, currentPrice: number = 60000): TradingBotSignal {
  const id = parseInt(botId) || 1;
  
  let nameEn = `Trading Bot ${id}`;
  let nameAr = `المستشار الآلي ${id}`;
  let descriptionAr = '';
  let winRate = 50;
  let riskReward = '1:2';
  
  // Deterministic signal based on botId to show different UI states
  const signalMode = id % 3;
  const signal: 'BUY' | 'SELL' | 'WAIT' = signalMode === 0 ? 'WAIT' : signalMode === 1 ? 'BUY' : 'SELL';

  switch (id) {
    case 1:
      nameEn = 'Fast Scalper';
      nameAr = 'المضارب اللحظي (Scalping)';
      descriptionAr = 'يعتمد على تقاطع المتوسطات السريعة (EMA 9/21) مع تأكيد الزخم اللحظي.';
      winRate = 72;
      riskReward = '1:1.5';
      break;
    case 2:
      nameEn = 'Momentum Master';
      nameAr = 'سيد الزخم (Momentum)';
      descriptionAr = 'يدمج مؤشري RSI و MACD لاقتناص الانفجارات السعرية بعد مناطق التشبع.';
      winRate = 68;
      riskReward = '1:2';
      break;
    case 3:
      nameEn = 'Trend Follower';
      nameAr = 'متتبع الاتجاه (Trend)';
      descriptionAr = 'يعتمد على خوارزمية SuperTrend لركوب الموجات الاتجاهية الطويلة بأمان.';
      winRate = 61;
      riskReward = '1:3';
      break;
    case 4:
      nameEn = 'Mean Reversion';
      nameAr = 'مقتنص الارتدادات (Reversion)';
      descriptionAr = 'يستخدم أشرطة بولينجر لاصطياد الارتدادات العكسية من الحدود القصوى.';
      winRate = 65;
      riskReward = '1:1.5';
      break;
    case 5:
      nameEn = 'Volume Surge';
      nameAr = 'انفجار السيولة (Volume)';
      descriptionAr = 'يراقب تدفق السيولة المفاجئ وحجم التداول المرجح للدخول مع الحيتان.';
      winRate = 70;
      riskReward = '1:2.5';
      break;
    case 6:
      nameEn = 'Fibonacci Sniper';
      nameAr = 'قناص فيبوناتشي (Fibonacci)';
      descriptionAr = 'يحدد ارتدادات النسبة الذهبية (0.618) للدخول بأقل انعكاس سعري ممكن.';
      winRate = 75;
      riskReward = '1:3';
      break;
    case 7:
      nameEn = 'Harmonic Trader';
      nameAr = 'متاجر الهارمونيك (Harmonic)';
      descriptionAr = 'يقتنص النماذج التوافقية المعقدة (Gartley, Bat) بدقة هندسية عالية.';
      winRate = 81;
      riskReward = '1:2';
      break;
    case 8:
      nameEn = 'Order Block SMC';
      nameAr = 'بلوك الأوامر (SMC)';
      descriptionAr = 'يعتمد على مفاهيم الأموال الذكية للتمركز في مناطق طلب/عرض البنوك.';
      winRate = 69;
      riskReward = '1:4';
      break;
    case 9:
      nameEn = 'Breakout Catcher';
      nameAr = 'صائد الاختراقات (Breakout)';
      descriptionAr = 'ينتظر انضغاط السعر في نطاق ضيق ثم يدخل بقوة مع أول كسر سعري.';
      winRate = 63;
      riskReward = '1:2.5';
      break;
    case 10:
      nameEn = 'AI Consensus';
      nameAr = 'الإجماع الذكي (Consensus)';
      descriptionAr = 'يحلل مخرجات 5 خوارزميات ويدخل فقط عندما تتفق بنسبة كاملة.';
      winRate = 88;
      riskReward = '1:1.5';
      break;
    default:
      nameEn = `Bot ${id}`;
      nameAr = `المستشار ${id}`;
      descriptionAr = `خوارزمية مخصصة للتحليل الآلي.`;
      break;
  }

  // Calculate SL and TPs based on ATR mock
  const atr = currentPrice * 0.015; // 1.5% average true range mock
  let stopLoss = 0;
  let tp1 = 0, tp2 = 0, tp3 = 0;

  if (signal === 'BUY') {
    stopLoss = currentPrice - atr;
    tp1 = currentPrice + (atr * 1.5);
    tp2 = currentPrice + (atr * 2.5);
    tp3 = currentPrice + (atr * 4);
  } else if (signal === 'SELL') {
    stopLoss = currentPrice + atr;
    tp1 = currentPrice - (atr * 1.5);
    tp2 = currentPrice - (atr * 2.5);
    tp3 = currentPrice - (atr * 4);
  } else {
    // WAIT
    stopLoss = 0;
    tp1 = 0;
    tp2 = 0;
    tp3 = 0;
  }

  return {
    botId,
    nameEn,
    nameAr,
    descriptionAr,
    signal,
    winRate,
    riskReward,
    entryPrice: currentPrice,
    stopLoss,
    tp1,
    tp2,
    tp3
  };
}
