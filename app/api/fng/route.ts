import { applyCORS, handlePreflight } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return handlePreflight(req) ?? new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=2', {
      cache: 'no-store',
    });
    if (!res.ok) return applyCORS(
      Response.json({ value: 50, label: 'Neutral', prevValue: 50, prevLabel: 'Neutral', timestamp: '' }),
      origin
    );
    const text = await res.text();
    if (text.trim().startsWith('<')) return applyCORS(
      Response.json({ value: 50, label: 'Neutral', prevValue: 50, prevLabel: 'Neutral', timestamp: '' }),
      origin
    );
    const json  = JSON.parse(text);
    const today = json.data[0];
    const prev  = json.data[1];
    return applyCORS(Response.json({
      value:     parseInt(today.value, 10),
      label:     today.value_classification,
      prevValue: parseInt(prev.value, 10),
      prevLabel: prev.value_classification,
      timestamp: today.timestamp,
    }), origin);
  } catch (err: any) {
    return applyCORS(Response.json({ error: err.message }, { status: 500 }), origin);
  }
}
