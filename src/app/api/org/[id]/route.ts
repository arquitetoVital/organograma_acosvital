import { NextRequest, NextResponse } from 'next/server';
import { patchNode, removeNode } from '@/lib/orgRepository';
import { requireAuth } from '@/lib/apiAuth';
import { rateLimit, getIp, rateLimitResponse } from '@/lib/rateLimit';
import { sanitizePatch } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit(getIp(request), 'write');
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const { ctx, supabase, err } = await requireAuth('editor');
  if (err) return err;

  const { id } = await params;

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const patch = sanitizePatch(raw);
  if (!patch) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  try {
    const updated = await patchNode(supabase, id, patch);
    console.info(`[audit] PUT /api/org/${id} by=${ctx!.userId} role=${ctx!.role}`);
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[api/org PUT ${id}]`, msg);
    if (msg.includes('PGRST116') || msg.includes('0 rows')) {
      return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
    }
    if (msg.includes('violates row-level security') || msg.includes('42501')) {
      return NextResponse.json({ error: 'Permissão negada pelo banco (RLS).' }, { status: 500 });
    }
    return NextResponse.json({ error: msg || 'Erro ao atualizar.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit(getIp(request), 'write');
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const { ctx, supabase, err } = await requireAuth('editor');
  if (err) return err;

  const { id } = await params;

  try {
    const { removedCount, wasCascade } = await removeNode(supabase, id);
    if (removedCount === 0) {
      return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
    }
    console.info(`[audit] DELETE /api/org/${id} removedCount=${removedCount} wasCascade=${wasCascade} by=${ctx!.userId} role=${ctx!.role}`);
    return NextResponse.json({ removedCount });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[api/org DELETE ${id}]`, msg);
    return NextResponse.json({ error: msg || 'Erro ao deletar.' }, { status: 500 });
  }
}
