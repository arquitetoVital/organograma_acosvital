import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { ApiError, apiPost, apiPut, apiDelete, handleApiError } from '@/lib/apiClient';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { err } = await requireAuth('editor');
  if (err) return err;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  const strNullable = ['photo_url', 'rg', 'cnpj', 'contrato_tipo', 'jornada_trabalho',
                       'telefone', 'celular', 'homepage', 'logradouro', 'numero',
                       'complemento', 'bairro', 'cidade',
                       'data_nascimento', 'data_admissao', 'data_desligamento'] as const;

  for (const f of strNullable) {
    if (b[f] !== undefined) patch[f] = b[f] || null;
  }

  if (b.nome_completo !== undefined) patch.nome_completo = String(b.nome_completo).trim();
  if (b.id_cargo      !== undefined) patch.id_cargo      = String(b.id_cargo);
  if (b.id_setor      !== undefined) patch.id_setor      = String(b.id_setor);
  if (b.id_unidade    !== undefined) patch.id_unidade    = String(b.id_unidade);
  if (b.estado        !== undefined) patch.estado        = b.estado ? String(b.estado).toUpperCase() : null;
  if (b.cpf           !== undefined) patch.cpf           = b.cpf ? String(b.cpf).replace(/\D/g, '') : null;
  if (b.cep !== undefined) {
    patch.cep = b.cep
      ? String(b.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')
      : null;
  }

  try {
    const data = await apiPut(`/funcionarios/${id}`, patch);

    // Sincroniza o nó no organograma
    // Prioridade: parent_node_id explícito > novo setor > sem mudança
    const hasExplicitParent = b.parent_node_id !== undefined;
    const sectorChanged     = b.id_setor !== undefined && b.id_setor !== '';

    if (hasExplicitParent || sectorChanged) {
      const newParentId: string | null = hasExplicitParent
        ? (b.parent_node_id ? String(b.parent_node_id) : null)
        : String(b.id_setor); // UUID do setor == UUID do nó do setor

      try {
        await apiPut(`/organograma_nodes/${id}`, { parent_id: newParentId });
      } catch (e) {
        // Se o nó não existe (foi removido junto com o setor excluído) → recriar
        if (e instanceof ApiError && e.status === 404 && sectorChanged) {
          try {
            await apiPost('/organograma_nodes', {
              id:        id,
              id_ent:    id,
              parent_id: String(b.id_setor),
              is_sector: false,
            });
          } catch { /* best-effort */ }
        }
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    const { msg, status } = handleApiError(e, 'Erro ao atualizar funcionário.');
    if (status === 404) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    if (status === 409) return NextResponse.json({ error: 'CPF ou CNPJ já cadastrado.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { err } = await requireAuth('editor');
  if (err) return err;

  try {
    await apiDelete(`/funcionarios/${id}`);
  } catch (e) {
    const { msg, status } = handleApiError(e, 'Erro ao excluir funcionário.');
    if (status === 404) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    return NextResponse.json({ error: msg }, { status });
  }

  // Remove o nó correspondente no organograma (best-effort)
  try { await apiDelete(`/organograma_nodes/${id}`); } catch { /* ignora se já não existir */ }

  return NextResponse.json({ ok: true });
}
