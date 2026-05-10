export async function fetchGlobalData() {
  const res = await fetch('https://api.coingecko.com/api/v3/global', {
    next: { revalidate: 300 } // cache 5 mins
  });
  if (!res.ok) throw new Error('CoinGecko fetch failed');
  const json = await res.json();
  
  const totalMarketCap = json.data.total_market_cap.usd;
  const btcDominance = json.data.market_cap_percentage.btc;
  
  return {
    totalMarketCap: (totalMarketCap / 1e12).toFixed(2) + 'T',
    btcDominance: btcDominance.toFixed(1) + '%'
  };
}
