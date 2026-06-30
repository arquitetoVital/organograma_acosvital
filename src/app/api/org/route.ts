import { NextRequest, NextResponse } from 'next/server';
import { insertNode } from '@/lib/orgRepository';
import { requireAuth } from '@/lib/apiAuth';
import { rateLimit, getIp, rateLimitResponse } from '@/lib/rateLimit';
import { sanitizeNode } from '@/lib/sanitize';
import { apiGet, extractArray, handleApiError } from '@/lib/apiClient';
import type { OrgNode } from '@/types/orgChart';

export const dynamic = 'force-dynamic';

// Shape retornado pela view externa /vw_organograma_nodes
interface VwNode {
  id:                  string;
  name:                string;
  role:                string;
  level:               number;
  parent_id:           string | null;
  is_sector:           boolean;
  photo_url:           string | null;
  sector_color:        string | null;
  sector_director_of:  string | null;
  id_ent:              string | null;
}

// Setores que são apenas containers organizacionais e não devem aparecer como
// nós no organograma (seus filhos diretos sobem para o pai do setor oculto).
const HIDDEN_SECTOR_NAMES = new Set(['diretoria', 'gerencia geral']);

function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function toOrgNode(n: VwNode): OrgNode {
  return {
    id:               n.id,
    name:             n.name          ?? '',
    role:             n.role          ?? '',
    level:            Number(n.level),  // garante número mesmo se a API retornar string
    parentId:         n.parent_id     ?? null,
    isSector:         Boolean(n.is_sector),
    photoUrl:         n.photo_url     ?? undefined,
    sectorColor:      n.sector_color  ?? undefined,
    sectorDirectorOf: n.sector_director_of ?? null,
    funcionarioId:    n.id_ent        ?? null,
  };
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(getIp(request), 'read');
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const { err } = await requireAuth('viewer');
  if (err) return err;

  try {
    // Suporte a ?parent_id=<uuid> para busca lazy dos filhos de um setor
    const parentId = request.nextUrl.searchParams.get('parent_id');
    const params: Record<string, string> = {};
    if (parentId) params.parent_id = parentId;

    const raw   = await apiGet<unknown>('/vw_organograma_nodes', params);
    const nodes = (extractArray(raw, 'nodes') as VwNode[]).map(toOrgNode);

    // Oculta setores que são apenas containers organizacionais (Diretoria, Gerência
    // Geral): seus filhos diretos "sobem" para o pai do setor oculto (cascateando
    // se houver mais de um nível oculto encadeado).
    const hiddenSectorIds = new Set(
      nodes.filter(n => n.isSector && HIDDEN_SECTOR_NAMES.has(normalizeName(n.name))).map(n => n.id),
    );
    const parentById = new Map(nodes.map(n => [n.id, n.parentId]));
    const resolveParent = (parentId: string | null): string | null => {
      let pid = parentId;
      const seen = new Set<string>();
      while (pid && hiddenSectorIds.has(pid) && !seen.has(pid)) {
        seen.add(pid);
        pid = parentById.get(pid) ?? null;
      }
      return pid;
    };
    const visible = hiddenSectorIds.size === 0 ? nodes : nodes
      .filter(n => !hiddenSectorIds.has(n.id))
      .map(n => ({ ...n, parentId: resolveParent(n.parentId) }));

    return NextResponse.json(visible);
  } catch (e) {
    const { msg, status } = handleApiError(e, 'Erro ao buscar dados do organograma.');
    return NextResponse.json({ error: msg }, { status });
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
