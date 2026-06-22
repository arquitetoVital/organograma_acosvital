/**
 * Cliente HTTP para a API REST do organograma.
 * Todas as funções lançam Error com mensagem em português em caso de falha.
 */

import type { OrgNode } from '@/types/orgChart';

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body = await res.json().catch(() => ({})) as { error?: string };
  throw new Error(body.error ?? `Erro HTTP ${res.status}`);
}

/** Cria um novo nó no organograma. Retorna o nó salvo pelo servidor. */
export async function createOrgNode(node: OrgNode): Promise<OrgNode> {
  const res = await fetch('/api/org', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(node),
  });
  return handleResponse<OrgNode>(res);
}

/** Atualiza campos de um nó existente. Retorna o nó atualizado. */
export async function updateOrgNode(id: string, patch: Partial<OrgNode>): Promise<OrgNode> {
  const res = await fetch(`/api/org/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  });
  return handleResponse<OrgNode>(res);
}

/** Remove um nó (e seus descendentes, se for setor). */
export async function deleteOrgNode(id: string): Promise<void> {
  const res = await fetch(`/api/org/${id}`, { method: 'DELETE' });
  return handleResponse<void>(res);
}
