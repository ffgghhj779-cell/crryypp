// lib/algorithms/wyckoff.ts — Wyckoff Phase Analyzer (500 candles)
import type { Kline } from '@/lib/binance/fetcher';

export type WyckoffPhase = 'ACC' | 'MRK' | 'DST' | 'MDN';
export interface WyckoffEffort    { buyPct:number; sellPct:number; ratio:number; verdict:string; }
export interface WyckoffVolatility{ atrCurrent:number; atrAvg:number; atrRatio:number; verdict:string; }
export interface WyckoffStructure { trend:'UPTREND'|'DOWNTREND'|'RANGING'; higherHighs:boolean; higherLows:boolean; rangeWidthPct:number; }
export interface WyckoffResult    { phase:WyckoffPhase; phaseAr:string; confidence:number; effort:WyckoffEffort; volatility:WyckoffVolatility; structure:WyckoffStructure; conclusion:string; }

function calcATR(k: Kline[], p: number): number[] {
  const tr = k.map((c,i)=>i===0?c.high-c.low:Math.max(c.high-c.low,Math.abs(c.high-k[i-1].close),Math.abs(c.low-k[i-1].close)));
  const out: number[] = [];
  let s = tr.slice(0,p).reduce((a,b)=>a+b,0);
  for(let i=0;i<p-1;i++) out.push(NaN);
  out.push(s/p);
  for(let i=p;i<tr.length;i++){ s=(out[out.length-1]*(p-1)+tr[i]); out.push(s/p); }
  return out;
}

function pivots(k:Kline[],w=5){
  const H:number[]=[],L:number[]=[];
  for(let i=w;i<k.length-w;i++){
    let isH=true,isL=true;
    for(let j=i-w;j<=i+w;j++){ if(j!==i){ if(k[j].high>=k[i].high)isH=false; if(k[j].low<=k[i].low)isL=false; } }
    if(isH)H.push(k[i].high); if(isL)L.push(k[i].low);
  }
  return {H,L};
}

export function analyzeWyckoff(klines: Kline[]): WyckoffResult {
  const price = klines[klines.length-1].close;
  const fmt = (n:number) => parseFloat(price>=10000?n.toFixed(1):price>=1?n.toFixed(4):n.toFixed(6));

  // 1. Effort — last 100 bars
  const e100 = klines.slice(-100);
  let bv=0,sv=0;
  for(const k of e100){ const r=k.high-k.low||1; bv+=k.volume*((k.close-k.low)/r); sv+=k.volume*((k.high-k.close)/r); }
  const tot=bv+sv||1;
  const buyPct=parseFloat((bv/tot*100).toFixed(1)), sellPct=parseFloat((sv/tot*100).toFixed(1)), ratio=parseFloat((buyPct/(sellPct||1)).toFixed(2));
  const effort:WyckoffEffort={buyPct,sellPct,ratio,verdict:ratio>=1.3?`جهد شرائي مهيمن (${ratio}x) — يعكس تجميعاً مؤسسياً محتملاً.`:ratio<=0.77?`جهد بيعي مهيمن (${ratio}x) — يعكس توزيعاً مؤسسياً.`:`توازن نسبي بين الجهد الشرائي والبيعي (${ratio}x).`};

  // 2. Volatility
  const atrS=calcATR(klines,14).filter(v=>!isNaN(v));
  const atrCurrent=atrS[atrS.length-1]??0;
  const atrAvg=atrS.slice(-100).reduce((a,b)=>a+b,0)/Math.min(100,atrS.length)||1;
  const atrRatio=parseFloat((atrCurrent/atrAvg).toFixed(2));
  const volatility:WyckoffVolatility={atrCurrent:fmt(atrCurrent),atrAvg:fmt(atrAvg),atrRatio,verdict:atrRatio>=1.4?`تذبذب مرتفع (${atrRatio}x) — ضغط أو اختراق وشيك.`:atrRatio<=0.7?`تذبذب منخفض (${atrRatio}x) — انحسار قبل حركة كبيرة.`:`تذبذب طبيعي (${atrRatio}x).`};

  // 3. Structure
  const {H,L}=pivots(klines.slice(-200));
  const rh=H.slice(-5),rl=L.slice(-5);
  const hhC=rh.filter((h,i)=>i>0&&h>rh[i-1]).length, hlC=rl.filter((l,i)=>i>0&&l>rl[i-1]).length;
  const llC=rl.filter((l,i)=>i>0&&l<rl[i-1]).length, lhC=rh.filter((h,i)=>i>0&&h<rh[i-1]).length;
  const higherHighs=hhC>=2, higherLows=hlC>=2;
  const trend:WyckoffStructure['trend']=hhC>=2&&hlC>=2?'UPTREND':llC>=2&&lhC>=2?'DOWNTREND':'RANGING';
  const rHigh=rh.length?Math.max(...rh):Math.max(...klines.slice(-50).map(k=>k.high));
  const rLow =rl.length?Math.min(...rl):Math.min(...klines.slice(-50).map(k=>k.low));
  const rangeWidthPct=parseFloat(((rHigh-rLow)/(rLow||1)*100).toFixed(2));
  const structure:WyckoffStructure={trend,higherHighs,higherLows,rangeWidthPct};

  // 4. Phase scoring
  const sc={ACC:0,MRK:0,DST:0,MDN:0};
  if(ratio>=1.2){sc.ACC+=30;sc.MRK+=15;}
  if(ratio<=0.85){sc.DST+=30;sc.MDN+=15;}
  if(atrRatio<=0.85){sc.ACC+=20;sc.DST+=10;}
  if(atrRatio>=1.3){sc.MRK+=20;sc.MDN+=20;}
  if(trend==='UPTREND'){sc.MRK+=25;sc.ACC+=5;}
  if(trend==='DOWNTREND'){sc.MDN+=25;sc.DST+=5;}
  if(trend==='RANGING'){sc.ACC+=15;sc.DST+=15;}
  if(higherHighs&&higherLows)sc.MRK+=15;
  if(!higherHighs&&!higherLows){sc.MDN+=10;sc.ACC+=5;}
  if(rangeWidthPct>15){sc.MRK+=10;sc.MDN+=10;}
  if(rangeWidthPct<6){sc.ACC+=10;sc.DST+=10;}

  const [phase]=(Object.entries(sc).sort((a,b)=>b[1]-a[1])[0]) as [WyckoffPhase,number];
  const tot2=Object.values(sc).reduce((a,b)=>a+b,0)||1;
  const confidence=Math.min(95,Math.max(40,Math.round((sc[phase]/tot2)*160)));

  const AR:Record<WyckoffPhase,string>={ACC:'تجميع مؤسسي',MRK:'صعود (ماركب)',DST:'توزيع مؤسسي',MDN:'هبوط (ماركداون)'};
  const CON:Record<WyckoffPhase,string>={
    ACC:'المؤسسات تراكم مراكز شرائية بهدوء. التذبذب المنخفض وجهد الشراء المتراكم يشيران إلى اهتمام بالتجميع. الاختراق الصعودي سيفعّل مرحلة الصعود.',
    MRK:'السوق في مرحلة صعود مؤسسي. المؤسسات تضخ سيولة شرائية عبر موجات ترقي متتالية. استمرار التحيز الصعودي ما لم يُكسر هيكل القمم.',
    DST:'المؤسسات تصرّف مراكزها على المشترين الجدد. التذبذب المرتفع مع جهد بيعي يؤكد التوزيع. الكسر الهبوطي يفعّل مرحلة الهبوط.',
    MDN:'السوق في هبوط مؤسسي حاد. الضغط البيعي يسيطر والهيكل يكسر القيعان تتالياً. تجنّب الصفقات الطويلة حتى ظهور إشارات إعادة تراكم.',
  };

  return {phase,phaseAr:AR[phase],confidence,effort,volatility,structure,conclusion:CON[phase]};
}
