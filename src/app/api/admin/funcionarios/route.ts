import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiGet, apiPost, apiDelete, handleApiError, fetchAllPages } from '@/lib/apiClient';
import { recomputeSectorHierarchy } from '@/lib/sectorHierarchy';

export const dynamic = 'force-dynamic';

interface FuncRaw {
  id:         string;
  id_cargo:   string;
  id_setor:   string;
  id_unidade: string;
  [key: string]: unknown;
}
interface CargoRaw  { id: string; nome: string; nvl_permissao: number; }
interface SetorRaw  { id: string; nome: string; }
interface UnidRaw   { id: string; nome_fantasia: string; }

export async function GET() {
  const { err } = await requireAuth('editor');
  if (err) return err;

  try {
    const [funcionarios, cargos, setores, unidades] = await Promise.all([
      fetchAllPages<FuncRaw>('/funcionarios', 'funcionarios'),
      fetchAllPages<CargoRaw>('/cargos',       'cargos'),
      fetchAllPages<SetorRaw>('/setores',      'setores'),
      fetchAllPages<UnidRaw>('/unidades',      'unidades'),
    ]);

    const cargoMap   = new Map(cargos.map(c => [c.id, c]));
    const setorMap   = new Map(setores.map(s => [s.id, s]));
    const unidadeMap = new Map(unidades.map(u => [u.id, u]));

    const enriched = funcionarios.map(f => ({
      ...f,
      cargo_nome:   cargoMap.get(f.id_cargo)?.nome              ?? null,
      cargo_nvl:    cargoMap.get(f.id_cargo)?.nvl_permissao     ?? null,
      setor_nome:   setorMap.get(f.id_setor)?.nome              ?? null,
      unidade_nome: unidadeMap.get(f.id_unidade)?.nome_fantasia ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (e) {
    const { msg, status } = handleApiError(e, 'Erro ao buscar funcionários.');
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  const { err } = await requireAuth('editor');
  if (err) return err;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const required = ['nome_completo', 'id_cargo', 'id_setor', 'id_unidade'];
  const missing  = required.filter(k => !b[k]);
  if (missing.length) {
    return NextResponse.json({ error: `Campos obrigatórios: ${missing.join(', ')}.` }, { status: 400 });
  }

  // Busca o cargo para saber o nvl_permissao
  let cargoNvl = 4;
  try {
    const raw = await apiGet<unknown>(`/cargos/${String(b.id_cargo)}`);
    const obj = (raw && typeof raw === 'object' && !Array.isArray(raw))
      ? raw as Record<string, unknown>
      : {};
    const nvlRaw = obj.nvl_permissao
      ?? (obj.cargo as Record<string, unknown> | undefined)?.nvl_permissao;
    cargoNvl = typeof nvlRaw === 'number' ? nvlRaw : 4;
  } catch {
    return NextResponse.json({ error: 'Cargo não encontrado.' }, { status: 422 });
  }

  const skipOrgNode = b.skip_org_node === true;

  // Cria o funcionário
  let funcData: { id: string };
  try {
    funcData = await apiPost<{ id: string }>('/funcionarios', {
      nome_completo:     String(b.nome_completo).trim(),
      id_cargo:          String(b.id_cargo),
      id_setor:          String(b.id_setor),
      id_unidade:        String(b.id_unidade),
      photo_url:         b.photo_url         || null,
      cpf:               b.cpf               ? String(b.cpf).replace(/\D/g, '') : null,
      rg:                b.rg                || null,
      cnpj:              b.cnpj              || null,
      contrato_tipo:     b.contrato_tipo     || null,
      jornada_trabalho:  b.jornada_trabalho  || null,
      data_nascimento:   b.data_nascimento   || null,
      data_admissao:     b.data_admissao     || null,
      data_desligamento: b.data_desligamento || null,
      telefone:          b.telefone          || null,
      celular:           b.celular           || null,
      homepage:          b.homepage          || null,
      logradouro:        b.logradouro        || null,
      numero:            b.numero            || null,
      complemento:       b.complemento       || null,
      bairro:            b.bairro            || null,
      cidade:            b.cidade            || null,
      estado:            b.estado            ? String(b.estado).toUpperCase() : null,
      cep:               b.cep               ? String(b.cep).replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2') : null,
    });
  } catch (e) {
    const { msg, status } = handleApiError(e, 'Erro ao criar funcionário.');
    if (status === 409) return NextResponse.json({ error: 'CPF ou CNPJ já cadastrado.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status });
  }

  // Co-diretor: não cria nó no organograma (já existe o nó do diretor principal)
  if (skipOrgNode) {
    return NextResponse.json({ ...funcData }, { status: 201 });
  }

  // Determina o parent_id do nó no organograma via hierarquia automática do setor.
  // Níveis 0-1 (Diretor/GM) são sempre raízes; demais são calculados pelo setor.
  let orgParentId: string | null = null;
  if (cargoNvl <= 1) {
    orgParentId = null;
  } else {
    try {
      const parentMap = await recomputeSectorHierarchy(String(b.id_setor), {
        includeNew: { id: funcData.id, nvl: cargoNvl },
      });
      orgParentId = parentMap.get(funcData.id) ?? String(b.id_setor);
    } catch {
      orgParentId = String(b.id_setor);
    }
  }

  // Cria o nó no organograma via API externa
  // O nó usa o mesmo UUID do funcionário como id, facilitando lookups futuros
  try {
    await apiPost('/organograma_nodes', {
      id:        funcData.id,
      id_ent:    funcData.id,
      parent_id: orgParentId,
      is_sector: false,
    });
  } catch (e) {
    // Rollback: remove o funcionário recém-criado
    try { await apiDelete(`/funcionarios/${funcData.id}`); } catch { /* best-effort */ }
    const { msg } = handleApiError(e);
    return NextResponse.json(
      { error: `Funcionário criado mas falha ao criar nó no organograma: ${msg}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ...funcData, org_node_id: funcData.id }, { status: 201 });
}
