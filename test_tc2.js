const tc = require('./lib/algorithms/trendCompass.ts');
const klines = [];
let price = 50000;
for(let i=0; i<200; i++) {
  klines.push({
    time: 1000000 + i*86400,
    open: price,
    high: price + 100,
    low: price - 100,
    close: price + 10,
    volume: 1000
  });
  price += 10;
}
try {
  const res = tc.calculateTrendCompass('BTCUSDT', '1D', klines);
  console.log('Success:', res.confidencePct);
} catch(e) {
  console.error('ERROR in calculateTrendCompass:', e);
}
