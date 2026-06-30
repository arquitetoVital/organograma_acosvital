/**
 * Repositório de acesso a dados do organograma.
 *
 * Responsabilidades:
 * - Traduz entre o formato de banco (snake_case) e o modelo de domínio (camelCase)
 * - Encapsula todas as queries SQL no schema `organograma`
 * - Não contém lógica de negócio — só persiste e lê dados
 *
 * Para regras de negócio (ex.: cascade delete de setores),
 * veja os comentários das funções individuais.
 */

import type { OrgNode } from '@/types/orgChart';
import type { createClient } from '@/lib/supabase/server';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Formato exato de uma linha na tabela `organograma.org_nodes`. */
type DbRow = {
  id:              string;
  name:            string;
  role:            string;
  level:           number;
  parent_id:       string | null;
  is_sector:       boolean;
  photo_url:       string | null;
  sector_color:    string | null;
  funcionario_id?: string | null;
};

/** Converte uma linha do banco para o modelo de domínio. */
function rowToNode(row: DbRow): OrgNode {
  return {
    id:            row.id,
    name:          row.name          ?? '',
    role:          row.role          ?? '',
    level:         row.level,
    parentId:      row.parent_id     ?? null,
    isSector:      row.is_sector     ?? false,
    photoUrl:      row.photo_url     ?? undefined,
    sectorColor:   row.sector_color  ?? undefined,
    funcionarioId: row.funcionario_id ?? null,
  };
}

/** Atalho para a view de nós no schema correto. */
const table = (supabase: SupabaseClient) =>
  supabase.schema('organograma').from('org_nodes_from_rh');

// ─────────────────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna TODOS os nós do organograma ordenados por nível (raiz primeiro).
 *
 * O PostgREST/Supabase limita cada resposta a `db-max-rows` (1000 por padrão),
 * então paginamos com `.range()` em lotes até esgotar — caso contrário a
 * contagem "trava" em ~1000 mesmo havendo milhares de nós. A ordenação
 * secundária por `id` torna a paginação determinística (sem pular/repetir).
 */
export async function fetchAllNodes(supabase: SupabaseClient): Promise<OrgNode[]> {
  const PAGE = 1000;
  const rows: DbRow[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await table(supabase)
      .select('*')
      .order('level', { ascending: true })
      .order('id',    { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) break;                       // devolve o que já coletou (ou [])
    if (!data || data.length === 0) break;
    rows.push(...(data as DbRow[]));
    if (data.length < PAGE) break;          // última página
  }

  return rows.map(rowToNode);
}

/**
 * Busca paginada genérica para contornar o limite de 1000 linhas do PostgREST
 * (`db-max-rows`). `makeQuery` deve devolver a query JÁ ordenada de forma estável
 * (ex.: por `id`) com `.range(from, to)` aplicado, para não pular/repetir linhas.
 */
async function fetchPaged(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<unknown[]> {
  const PAGE = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────────────────────────────────────

/** Insere um novo nó. Lança Error se houver conflito de ID ou violação de RLS. */
export async function insertNode(supabase: SupabaseClient, node: OrgNode): Promise<OrgNode> {
  const { data, error } = await table(supabase)
    .insert({
      id:             node.id,
      name:           node.name,
      role:           node.role,
      level:          node.level,
      parent_id:      node.parentId      || null,
      is_sector:      node.isSector      ?? false,
      photo_url:      node.photoUrl      ?? null,
      sector_color:   node.sectorColor   ?? null,
      funcionario_id: node.funcionarioId ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToNode(data as DbRow);
}

/** Aplica um patch parcial a um nó existente. Lança Error se não encontrado. */
export async function patchNode(
  supabase: SupabaseClient,
  id:       string,
  patch:    Partial<OrgNode>,
): Promise<OrgNode> {
  const dbPatch: Partial<DbRow> = {};

  if (patch.name          !== undefined) dbPatch.name           = patch.name;
  if (patch.role          !== undefined) dbPatch.role           = patch.role;
  if (patch.level         !== undefined) dbPatch.level          = patch.level;
  if (patch.parentId      !== undefined) dbPatch.parent_id      = patch.parentId ?? null;
  if (patch.isSector      !== undefined) dbPatch.is_sector      = patch.isSector;
  if (patch.photoUrl      !== undefined) dbPatch.photo_url      = patch.photoUrl || null;
  if (patch.sectorColor   !== undefined) dbPatch.sector_color   = patch.sectorColor || null;
  if (patch.funcionarioId !== undefined) dbPatch.funcionario_id = patch.funcionarioId ?? null;

  const { data, error } = await table(supabase)
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToNode(data as DbRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exclusão
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove um nó com comportamento contextual:
 * - **Setor / sub-setor / GM (level 1)**: filhos diretos ficam órfãos (parent_id = null),
 *   pendentes de reatribuição. Apenas o nó em si é excluído.
 * - **Pessoa (level > 1, !isSector)**: subordinados diretos são promovidos ao avô.
 *
 * @returns Informações sobre o que foi removido (para logging de auditoria)
 */
export async function removeNode(
  supabase: SupabaseClient,
  id:       string,
): Promise<{ wasCascade: boolean; removedCount: number }> {
  const { data: target, error: fetchError } = await table(supabase)
    .select('id, parent_id, is_sector, level')
    .eq('id', id)
    .single();

  if (fetchError || !target) throw new Error('Nó não encontrado.');

  const row = target as { parent_id: string | null; is_sector: boolean; level: number };

  // Setor, sub-setor ou GM: filhos ficam órfãos (parentId = null)
  if (row.is_sector || row.level === 1) {
    const { error: orphanError } = await table(supabase)
      .update({ parent_id: null })
      .eq('parent_id', id);
    if (orphanError) throw new Error(orphanError.message);

    const { error: deleteError } = await table(supabase).delete().eq('id', id);
    if (deleteError) throw new Error(deleteError.message);

    return { wasCascade: false, removedCount: 1 };
  }

  // Pessoa: promove subordinados diretos ao avô antes de remover
  const { error: reparentError } = await table(supabase)
    .update({ parent_id: row.parent_id })
    .eq('parent_id', id);
  if (reparentError) throw new Error(reparentError.message);

  const { error: deleteError } = await table(supabase).delete().eq('id', id);
  if (deleteError) throw new Error(deleteError.message);

  return { wasCascade: false, removedCount: 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Importação do RH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Importa o RH para org_nodes montando a hierarquia a partir de `cargos.nivel`:
 *   - nivel 0   → Diretoria (raiz do organograma, sem pai)
 *   - nivel 1   → Gerência Geral (sob a Diretoria)
 *   - setores   → nós de setor (nível 2, is_sector) criados a partir da tabela
 *                 `setores`; ficam sob a Gerência Geral (ou, na falta dela, sob
 *                 a Diretoria)
 *   - nivel ≥ 2 → pessoas, penduradas no seu setor (via funcionarios.id_setor)
 *
 * Idempotente: nós de pessoa usam id `rh-{uuid}` (match por funcionario_id) e
 * nós de setor reaproveitam um setor existente de mesmo nome ou criam `sec-{uuid}`.
 *
 * Sub-setores (nível 3) NÃO são criados aqui — a tabela `setores` não tem vínculo
 * de setor-pai. Crie-os manualmente no painel do organograma se precisar.
 *
 * Usa queries separadas em vez de joins PostgREST para evitar erros de schema cache.
 */
export async function importFromFuncionarios(supabase: SupabaseClient): Promise<{
  created:  number;
  updated:  number;
  skipped:  number;
  orphans:  number;
  diagnostics: { funcionarios: number; cargos: number; setores: number };
}> {
  const rhSchema = supabase.schema('organograma');

  type CargoRow = { id: string; nome: string; nivel: number };
  type SetorRow = { id: string; nome: string; sigla: string | null; cor: string | null };
  type FuncRaw  = { id: string; nome_completo: string; foto_url: string | null; id_cargo: string; id_setor: string };

  // 1. Busca paginada (sem filtros extras): contorna o limite de 1000 linhas do
  //    PostgREST — senão importações com >1000 funcionários ficam truncadas.
  let funcionarios: FuncRaw[], cargos: CargoRow[], setores: SetorRow[];
  try {
    [funcionarios, cargos, setores] = await Promise.all([
      fetchPaged((from, to) => rhSchema.from('funcionarios')
        .select('id, nome_completo, foto_url, id_cargo, id_setor')
        .order('id', { ascending: true }).range(from, to)) as Promise<FuncRaw[]>,
      fetchPaged((from, to) => rhSchema.from('cargos')
        .select('id, nome, nivel')
        .order('id', { ascending: true }).range(from, to)) as Promise<CargoRow[]>,
      fetchPaged((from, to) => rhSchema.from('setores')
        .select('id, nome, sigla, cor')
        .order('id', { ascending: true }).range(from, to)) as Promise<SetorRow[]>,
    ]);
  } catch (e) {
    throw new Error(`RH: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!funcionarios.length) throw new Error('Nenhum funcionário encontrado no RH.');

  const cargoMap = new Map(cargos.map((c) => [c.id, c]));

  // 2. Org_nodes existentes (para idempotência) — também paginado
  const existingNodes = await fetchPaged((from, to) => table(supabase)
    .select('*').order('id', { ascending: true }).range(from, to)) as DbRow[];

  const existingByFuncId     = new Map<string, DbRow>();
  const existingSectorByName = new Map<string, DbRow>();
  for (const row of existingNodes) {
    if (row.funcionario_id) existingByFuncId.set(row.funcionario_id, row);
    if (row.is_sector)      existingSectorByName.set(row.name.toLowerCase(), row);
  }

  let created = 0, updated = 0, skipped = 0, orphans = 0;

  // 3. Liderança: nível do cargo define Diretoria (0) e Gerência Geral (1)
  const withLevel = (funcionarios as FuncRaw[]).map((f) => {
    const cargo = cargoMap.get(f.id_cargo);
    return {
      f,
      level: cargo ? Math.max(0, Math.min(11, cargo.nivel)) : 9,
      role:  cargo ? cargo.nome : 'Colaborador',
    };
  });

  const directors      = withLevel.filter((x) => x.level === 0);
  const gms            = withLevel.filter((x) => x.level === 1);
  // Todos os diretores (nivel 0) ficam no centro como nós raiz separados.
  // O frontend mescla múltiplos nós level-0 num único CenterCard com "&".
  // O primeiro diretor serve como referência de parentId para as GGs.
  const rootDirectorId = directors[0]?.f.id ? `rh-${directors[0].f.id}` : null;
  // Setores penduram na Gerência Geral única; com 0 ou várias GGs, vão sob a Diretoria.
  const sectorParentId = (gms.length === 1 ? `rh-${gms[0].f.id}` : null) ?? rootDirectorId;

  // 4. Nós de setor (nível 2): reaproveita por nome ou cria `sec-{uuid}`
  const sectorNodeIdBySetorId = new Map<string, string>();
  for (const s of setores as SetorRow[]) {
    const existing = existingSectorByName.get(s.nome.toLowerCase());
    const nodeId   = existing?.id ?? `sec-${s.id}`;
    sectorNodeIdBySetorId.set(s.id, nodeId);

    const { error } = await table(supabase).upsert({
      id:           nodeId,
      name:         s.nome,
      role:         s.sigla ?? '',
      level:        2,
      parent_id:    sectorParentId,
      is_sector:    true,
      sector_color: s.cor ?? null,
    }, { onConflict: 'id' });

    if (error) { skipped++; continue; }
    if (existing) updated++; else created++;
  }

  // 5. Pessoas (e liderança) — upsert por id `rh-{uuid}`
  for (const { f, level, role } of withLevel) {
    // Todos os diretores (nivel 0) ficam como raiz (parentId null); o frontend
    // detecta múltiplos nós level-0 e os mescla num único CenterCard com "&".
    const effectiveLevel = level;

    let parentId: string | null;
    if (level === 0)               parentId = null;                                          // Diretoria (raiz, todos)
    else if (level === 1)          parentId = rootDirectorId;                                // Gerência Geral
    else                           parentId = sectorNodeIdBySetorId.get(f.id_setor) ?? null; // pessoa → setor

    if (parentId === null && effectiveLevel >= 2) orphans++;

    const existing = existingByFuncId.get(f.id);
    const { error } = await table(supabase).upsert({
      id:             `rh-${f.id}`,
      name:           f.nome_completo,
      role,
      level:          effectiveLevel,
      parent_id:      parentId,
      is_sector:      false,
      photo_url:      f.foto_url ?? null,
      sector_color:   null,
      funcionario_id: f.id,
    }, { onConflict: 'id' });

    if (error) { skipped++; continue; }
    if (existing) updated++; else created++;
  }

  return {
    created,
    updated,
    skipped,
    orphans,
    diagnostics: {
      funcionarios: (funcionarios as FuncRaw[]).length,
      cargos:       (cargos       as CargoRow[]).length,
      setores:      (setores      as SetorRow[]).length,
    },
  };
}
