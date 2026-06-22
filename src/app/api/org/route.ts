import { NextRequest, NextResponse } from 'next/server';
import { fetchAllNodes, insertNode } from '@/lib/orgRepository';
import { requireAuth } from '@/lib/apiAuth';
import { rateLimit, getIp, rateLimitResponse } from '@/lib/rateLimit';
import { sanitizeNode } from '@/lib/sanitize';
import { DEV_AUTH_BYPASS } from '@/lib/devAuth';
import seedNodes from '@/data/orgData.json';
import type { OrgNode } from '@/types/orgChart';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rl = rateLimit(getIp(request), 'read');
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const { ctx, supabase, err } = await requireAuth('viewer');
  if (err) return err;

  try {
    const nodes = await fetchAllNodes(supabase);
    // Em desenvolvimento sem sessão real, o RLS retorna lista vazia: cai na
    // estrutura-semente para que o editor admin fique inspecionável.
    if (nodes.length === 0 && DEV_AUTH_BYPASS) {
      return NextResponse.json(seedNodes as OrgNode[]);
    }
    return NextResponse.json(nodes);
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(getIp(request), 'write');
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const { ctx, supabase, err } = await requireAuth('editor');
  if (err) return err;

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const node = sanitizeNode(raw);
  if (!node) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  try {
    const created = await insertNode(supabase, node);
    console.info(`[audit] POST /api/org id=${node.id} by=${ctx!.userId} role=${ctx!.role}`);
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/org POST]', msg);
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
      return NextResponse.json({ error: 'ID já existe.' }, { status: 409 });
    }
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json({ error: 'Tabela org_nodes não encontrada — execute o schema.sql no Supabase.' }, { status: 500 });
    }
    if (msg.includes('violates row-level security') || msg.includes('42501')) {
      return NextResponse.json({ error: 'Permissão negada pelo banco (RLS). Verifique as policies no Supabase.' }, { status: 500 });
    }
    return NextResponse.json({ error: msg || 'Erro ao criar nó.' }, { status: 500 });
  }
}
