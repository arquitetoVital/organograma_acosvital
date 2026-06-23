import { NextResponse } from 'next/server';
import { importFromFuncionarios } from '@/lib/orgRepository';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { ctx, supabase, err } = await requireAuth('editor');
  if (err) return err;

  try {
    const result = await importFromFuncionarios(supabase);
    console.info(`[audit] POST /api/org/import created=${result.created} updated=${result.updated} skipped=${result.skipped} by=${ctx!.userId}`);
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/org/import POST]', msg);
    return NextResponse.json({ error: msg || 'Erro ao importar funcionários.' }, { status: 500 });
  }
}
