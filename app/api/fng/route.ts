import { applyCORS, handlePreflight } from '@/lib/cors';

export const revalidate = 3600;

export async function OPTIONS(req: Request) {
  return handlePreflight(req) ?? new Response(null, { status: 204 });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=2', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return applyCORS(
      Response.json({ error: `Fear & Greed API error: ${res.status}` }, { status: res.status }),
      origin
    );
    const json  = await res.json();
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
