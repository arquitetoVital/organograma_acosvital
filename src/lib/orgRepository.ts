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
  id:                 string;
  name:               string;
  role:               string;
  level:              number;
  parent_id:          string | null;
  is_sector:          boolean;
  photo_url:          string | null;
  sector_color:       string | null;
  sector_director_of: string | null;
};

/** Converte uma linha do banco para o modelo de domínio. */
function rowToNode(row: DbRow): OrgNode {
  return {
    id:               row.id,
    name:             row.name             ?? '',
    role:             row.role             ?? '',
    level:            row.level,
    parentId:         row.parent_id        ?? null,
    isSector:         row.is_sector        ?? false,
    photoUrl:         row.photo_url        ?? undefined,
    sectorColor:      row.sector_color     ?? undefined,
    sectorDirectorOf: row.sector_director_of ?? null,
  };
}

/** Atalho para a tabela de nós no schema correto. */
const table = (supabase: SupabaseClient) =>
  supabase.schema('organograma').from('org_nodes');

// ─────────────────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna todos os nós do organograma ordenados por nível (raiz primeiro). */
export async function fetchAllNodes(supabase: SupabaseClient): Promise<OrgNode[]> {
  const { data, error } = await table(supabase)
    .select('*')
    .order('level', { ascending: true });

  if (error || !data) return [];
  return (data as DbRow[]).map(rowToNode);
}

// ─────────────────────────────────────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────────────────────────────────────

/** Insere um novo nó. Lança Error se houver conflito de ID ou violação de RLS. */
export async function insertNode(supabase: SupabaseClient, node: OrgNode): Promise<OrgNode> {
  const { data, error } = await table(supabase)
    .insert({
      id:                  node.id,
      name:                node.name,
      role:                node.role,
      level:               node.level,
      parent_id:           node.parentId           || null,
      is_sector:           node.isSector           ?? false,
      photo_url:           node.photoUrl           ?? null,
      sector_color:        node.sectorColor        ?? null,
      sector_director_of:  node.sectorDirectorOf   ?? null,
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

  if (patch.name              !== undefined) dbPatch.name               = patch.name;
  if (patch.role              !== undefined) dbPatch.role               = patch.role;
  if (patch.level             !== undefined) dbPatch.level              = patch.level;
  if (patch.parentId          !== undefined) dbPatch.parent_id          = patch.parentId ?? null;
  if (patch.isSector          !== undefined) dbPatch.is_sector          = patch.isSector;
  if (patch.photoUrl          !== undefined) dbPatch.photo_url          = patch.photoUrl || null;
  if (patch.sectorColor       !== undefined) dbPatch.sector_color       = patch.sectorColor || null;
  if (patch.sectorDirectorOf  !== undefined) dbPatch.sector_director_of = patch.sectorDirectorOf ?? null;

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
