export async function fetchFearGreedIndex(): Promise<number> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1', {
    next: { revalidate: 3600 }, // cache 1h
  });
  if (!res.ok) throw new Error('Fear & Greed fetch failed');
  const json = await res.json();
  return parseInt(json.data[0].value, 10);
}
