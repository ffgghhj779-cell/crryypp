const tsNode = require('ts-node');
tsNode.register({ compilerOptions: { module: 'commonjs' } });
const fetcher = require('./lib/binance/fetcher.ts');
const tc = require('./lib/algorithms/trendCompass.ts');

async function test() {
  try {
    const klines = await fetcher.fetchKlines('XAUUSD', '1d', 200);
    console.log('Fetched', klines.length, 'klines');
    const res = tc.calculateTrendCompass('XAUUSD', '1D', klines);
    console.log('Result:', res.symbol, res.confidencePct);
  } catch (e) {
    console.error('ERROR:', e);
  }
}
test();
