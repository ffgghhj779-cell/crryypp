export async function GET() {
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      next: { revalidate: 3600 }
    });
    if (!res.ok) throw new Error('Calendar fetch failed');
    const data = await res.json();
    
    // Filter for High/Medium impact only
    const filtered = data.filter((e: any) => ['High', 'Medium'].includes(e.impact));
    return Response.json(filtered.slice(0, 10));
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
