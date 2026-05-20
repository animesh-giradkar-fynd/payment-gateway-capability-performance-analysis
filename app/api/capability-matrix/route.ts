import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { loadCapabilities } from '@/lib/capabilities';

export const runtime = 'nodejs';
// Curated JSON — cache for 5 minutes; PR-based edits invalidate via redeploy anyway.
export const revalidate = 300;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const data = await loadCapabilities();
    return NextResponse.json({ data, generatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ handler: '/api/capability-matrix', error: message }));
    return NextResponse.json({ error: 'capabilities_load_failed', message }, { status: 500 });
  }
}
