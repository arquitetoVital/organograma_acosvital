'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import type { Funcionario, Cargo, Setor, Unidade, OrgNodeOption } from '@/types/adminCore';
import { NVL_LABELS } from '@/types/adminCore';
import { levelColors } from '@/data/orgData';
import styles from '../crud.module.css';

// ── Utilitários de máscara ────────────────────────────────────────────────────
const maskCPF  = (v: string) => v.replace(/\D/g,'').slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{2})$/,'$1-$2');
const maskPhone= (v: string) => { const d=v.replace(/\D/g,'').slice(0,11); return d.length<=10?d.replace(/^(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').trim():d.replace(/^(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').trim(); };
const maskCEP  = (v: string) => v.replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');

// ── Seção collapsível ─────────────────────────────────────────────────────────
function Section({
  icon, title, badge, open, onToggle, children,
}: {
  icon: string; title: string; badge?: string;
  open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead} onClick={onToggle}>
        <div className={styles.sectionHeadLeft}>
          <span className={styles.sectionHeadIcon}>{icon}</span>
          <span className={styles.sectionHeadTitle}>{title}</span>
          {badge && <span className={styles.sectionHeadBadge}>{badge}</span>}
        </div>
        <span className={`${styles.sectionChevron} ${open ? styles.sectionChevronOpen : ''}`}>▼</span>
      </div>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// ── Formulário completo de funcionário ────────────────────────────────────────
const BLANK_FORM = {
  nome_completo: '', id_cargo: '', id_setor: '', id_unidade: '',
  photo_url: '', cpf: '', rg: '', cnpj: '',
  contrato_tipo: '' as '' | 'CLT' | 'PJ' | 'Freelancer',
  jornada_trabalho: '' as '' | 'Integral' | 'Meio Período' | 'Flexível',
  data_nascimento: '', data_admissao: '', data_desligamento: '',
  telefone: '', celular: '', homepage: '',
  logradouro: '', numero: '', complemento: '',
  bairro: '', cidade: '', estado: '', cep: '',
  parent_node_id: '',
  // Campos virtuais para co-diretor (nvl 0 apenas — combinados / enviados separadamente antes de salvar)
  co_diretor_nome: '',
  co_id:            '', // ID do funcionário co-diretor já existente (edit)
  co_cpf:  '', co_rg: '', co_cnpj: '',
  co_contrato_tipo:    '' as '' | 'CLT' | 'PJ' | 'Freelancer',
  co_jornada_trabalho: '' as '' | 'Integral' | 'Meio Período' | 'Flexível',
  co_data_nascimento: '', co_data_admissao: '', co_data_desligamento: '',
  co_telefone: '', co_celular: '', co_homepage: '',
  co_logradouro: '', co_numero: '', co_complemento: '',
  co_bairro: '', co_cidade: '', co_estado: '', co_cep: '',
};

type FuncForm = typeof BLANK_FORM;

interface DrawerProps {
  form: FuncForm;
  setForm: React.Dispatch<React.SetStateAction<FuncForm>>;
  editing: Funcionario | null;
  cargos: Cargo[];
  setores: Setor[];
  unidades: Unidade[];
  orgNodes: OrgNodeOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onDelete: () => void;
}

function FuncionarioDrawer({
  form, setForm, editing, cargos, setores, unidades, orgNodes,
  saving, onClose, onSubmit, onDelete,
}: DrawerProps) {
  const [sections, setSections] = useState({
    dados: true, contrato: false, contato: false, endereco: false,
    co_contrato: false, co_contato: false, co_endereco: false,
  });
  const toggle = (k: keyof typeof sections) => setSections(s => ({ ...s, [k]: !s[k] }));

  const selectedCargo = useMemo(() => cargos.find(c => c.id === form.id_cargo), [cargos, form.id_cargo]);
  const needsParent   = selectedCargo && selectedCargo.nvl_permissao >= 4;
  const isDirector    = selectedCargo?.nvl_permissao === 0;

  // co-diretor ativo quando há nome preenchido
  const [isPaired, setIsPaired] = useState(() => form.co_diretor_nome !== '');
  const coDirRef = useRef<HTMLDivElement>(null);

  // Filtra nós elegíveis como "Reporta a" (nivel < cargo selecionado)
  const parentOptions = useMemo(() => {
    if (!selectedCargo) return orgNodes;
    return orgNodes.filter(n => n.level < selectedCargo.nvl_permissao && n.level >= 1);
  }, [orgNodes, selectedCargo]);

  const initials = form.nome_completo
    ? form.nome_completo.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  const coInitials = form.co_diretor_nome
    ? form.co_diretor_nome.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  return (
    <>
      <div className={styles.drawerOverlay} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.drawerHead}>
          {isPaired ? (
            <div className={styles.avatarPair}>
              <div className={styles.avatarPreview}>
                {form.photo_url ? <img src={form.photo_url} alt="" /> : <span className={styles.avatarInitials}>{initials}</span>}
              </div>
              <span className={styles.avatarPairSep}>&amp;</span>
              <div className={styles.avatarPreview}>
                {form.photo_url ? <img src={form.photo_url} alt="" /> : <span className={styles.avatarInitials}>{coInitials}</span>}
              </div>
            </div>
          ) : (
            <div className={styles.avatarPreview}>
              {form.photo_url
                ? <img src={form.photo_url} alt="" />
                : <span className={styles.avatarInitials}>{initials}</span>
              }
            </div>
          )}
          <span className={styles.drawerTitle}>
            {editing ? 'Editar funcionário' : 'Novo funcionário'}
          </span>
          <button className={styles.drawerClose} onClick={onClose}>✕</button>
        </div>

        <form className={styles.drawerBody} onSubmit={onSubmit}>

          {/* Dados básicos */}
          <Section icon="👤" title="Identificação" badge="obrigatório" open={sections.dados} onToggle={() => toggle('dados')}>
            <div className={styles.field}>
              <label className={styles.label}>Nome completo <span className={styles.required}>*</span></label>
              <input autoFocus className={styles.input} value={form.nome_completo}
                onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))}
                placeholder="João da Silva" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Cargo <span className={styles.required}>*</span></label>
              <select className={styles.select} value={form.id_cargo}
                onChange={e => setForm(f => ({ ...f, id_cargo: e.target.value, parent_node_id: '' }))}>
                <option value="">— Selecione o cargo —</option>
                {cargos.filter(c => c.ativo).map(c => (
                  <option key={c.id} value={c.id}>
                    Nv {c.nvl_permissao} · {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {selectedCargo && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
                Nível hierárquico: <strong style={{ color: levelColors[selectedCargo.nvl_permissao] ?? '#94a3b8' }}>
                  {NVL_LABELS[selectedCargo.nvl_permissao] ?? `Nível ${selectedCargo.nvl_permissao}`}
                </strong>
              </div>
            )}

            {needsParent && (
              <div className={styles.field}>
                <label className={styles.label}>Reporta a <span className={styles.required}>*</span></label>
                <select className={styles.select} value={form.parent_node_id}
                  onChange={e => setForm(f => ({ ...f, parent_node_id: e.target.value }))}>
                  <option value="">— Selecione o superior direto —</option>
                  {parentOptions.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.name} · {NVL_LABELS[n.level] ?? `Nível ${n.level}`}
                    </option>
                  ))}
                </select>
                <span className={styles.fieldHint}>Selecione a quem este funcionário se reporta no organograma.</span>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Setor <span className={styles.required}>*</span></label>
              <select className={styles.select} value={form.id_setor}
                onChange={e => setForm(f => ({ ...f, id_setor: e.target.value }))}>
                <option value="">— Selecione o setor —</option>
                {setores.filter(s => s.ativo).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.parent_id ? '  ↳ ' : ''}{s.nome}{s.sigla ? ` (${s.sigla})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Unidade <span className={styles.required}>*</span></label>
              <select className={styles.select} value={form.id_unidade}
                onChange={e => setForm(f => ({ ...f, id_unidade: e.target.value }))}>
                <option value="">— Selecione a unidade —</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nome_fantasia} ({u.tipo_unidade})</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>URL da foto</label>
              <input className={styles.input} value={form.photo_url}
                onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                placeholder="https://…" />
            </div>

            {/* Toggle co-diretor — só para nvl 0 */}
            {isDirector && (
              <label className={styles.coDirToggle}>
                <input
                  type="checkbox"
                  checked={isPaired}
                  onChange={e => {
                    const checked = e.target.checked;
                    setIsPaired(checked);
                    if (!checked) {
                      setForm(f => ({ ...f, co_diretor_nome: '' }));
                    } else {
                      setTimeout(() => coDirRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                    }
                  }}
                />
                Compartilhar card com co-diretor
              </label>
            )}

            {isDirector && isPaired && (
              <div ref={coDirRef} className={styles.coDirSection}>
                <span className={styles.coDirLabel}>Co-Diretor</span>
                <div className={styles.field}>
                  <label className={styles.label}>Nome do co-diretor <span className={styles.required}>*</span></label>
                  <input className={styles.input} value={form.co_diretor_nome}
                    onChange={e => setForm(f => ({ ...f, co_diretor_nome: e.target.value }))}
                    placeholder="Maria Santos" />
                </div>
              </div>
            )}
          </Section>

          {/* Contrato, Contato e Endereço — não exibidos para Diretoria (nvl 0) */}
          {!isDirector && (
            <>
              <Section icon="📋" title="Contrato & Documentos"
                open={sections.contrato} onToggle={() => toggle('contrato')}>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Tipo de contrato</label>
                    <select className={styles.select} value={form.contrato_tipo}
                      onChange={e => setForm(f => ({ ...f, contrato_tipo: e.target.value as FuncForm['contrato_tipo'] }))}>
                      <option value="">— Selecione —</option>
                      <option value="CLT">CLT</option>
                      <option value="PJ">PJ</option>
                      <option value="Freelancer">Freelancer</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Jornada</label>
                    <select className={styles.select} value={form.jornada_trabalho}
                      onChange={e => setForm(f => ({ ...f, jornada_trabalho: e.target.value as FuncForm['jornada_trabalho'] }))}>
                      <option value="">— Selecione —</option>
                      <option value="Integral">Integral</option>
                      <option value="Meio Período">Meio Período</option>
                      <option value="Flexível">Flexível</option>
                    </select>
                  </div>
                </div>

                {form.contrato_tipo !== 'PJ' && (
                  <div className={styles.row2}>
                    <div className={styles.field}>
                      <label className={styles.label}>CPF</label>
                      <input className={styles.input} value={form.cpf}
                        onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))}
                        placeholder="000.000.000-00" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>RG</label>
                      <input className={styles.input} value={form.rg}
                        onChange={e => setForm(f => ({ ...f, rg: e.target.value }))}
                        placeholder="00.000.000-0" />
                    </div>
                  </div>
                )}

                {form.contrato_tipo === 'PJ' && (
                  <div className={styles.field}>
                    <label className={styles.label}>CNPJ</label>
                    <input className={styles.input} value={form.cnpj}
                      onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))}
                      placeholder="00.000.000/0000-00" />
                  </div>
                )}

                <div className={styles.row3}>
                  <div className={styles.field}>
                    <label className={styles.label}>Nascimento</label>
                    <input type="date" className={styles.input} value={form.data_nascimento}
                      onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Admissão</label>
                    <input type="date" className={styles.input} value={form.data_admissao}
                      onChange={e => setForm(f => ({ ...f, data_admissao: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Desligamento</label>
                    <input type="date" className={styles.input} value={form.data_desligamento}
                      onChange={e => setForm(f => ({ ...f, data_desligamento: e.target.value }))} />
                  </div>
                </div>
              </Section>

              <Section icon="📞" title="Contato"
                open={sections.contato} onToggle={() => toggle('contato')}>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Telefone</label>
                    <input className={styles.input} value={form.telefone}
                      onChange={e => setForm(f => ({ ...f, telefone: maskPhone(e.target.value) }))}
                      placeholder="(11) 3000-0000" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Celular</label>
                    <input className={styles.input} value={form.celular}
                      onChange={e => setForm(f => ({ ...f, celular: maskPhone(e.target.value) }))}
                      placeholder="(11) 99999-0000" />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Website / LinkedIn</label>
                  <input className={styles.input} value={form.homepage}
                    onChange={e => setForm(f => ({ ...f, homepage: e.target.value }))}
                    placeholder="https://linkedin.com/in/…" />
                </div>
              </Section>

              <Section icon="📍" title="Endereço"
                open={sections.endereco} onToggle={() => toggle('endereco')}>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>CEP</label>
                    <input className={styles.input} value={form.cep}
                      onChange={e => setForm(f => ({ ...f, cep: maskCEP(e.target.value) }))}
                      placeholder="00000-000" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Estado</label>
                    <input className={styles.input} value={form.estado}
                      onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase().slice(0,2) }))}
                      placeholder="SP" maxLength={2} />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Logradouro</label>
                  <input className={styles.input} value={form.logradouro}
                    onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))}
                    placeholder="Rua das Flores" />
                </div>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Número</label>
                    <input className={styles.input} value={form.numero}
                      onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="100" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Complemento</label>
                    <input className={styles.input} value={form.complemento}
                      onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} placeholder="Apto 1" />
                  </div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Bairro</label>
                    <input className={styles.input} value={form.bairro}
                      onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} placeholder="Centro" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Cidade</label>
                    <input className={styles.input} value={form.cidade}
                      onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="São Paulo" />
                  </div>
                </div>
              </Section>
            </>
          )}
        </form>

        <div className={styles.drawerFoot}>
          {editing && (
            <button type="button" className={styles.btnDanger} onClick={onDelete}>Excluir</button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving}
            onClick={onSubmit as unknown as React.MouseEventHandler}
          >
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar funcionário'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FuncionariosAdmin() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [cargos,       setCargos]       = useState<Cargo[]>([]);
  const [setores,      setSetores]      = useState<Setor[]>([]);
  const [unidades,     setUnidades]     = useState<Unidade[]>([]);
  const [orgNodes,     setOrgNodes]     = useState<OrgNodeOption[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [search,  setSearch]  = useState('');
  const [fSetor,  setFSetor]  = useState('');
  const [fCargo,  setFCargo]  = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState<Funcionario | null>(null);
  const [form,       setForm]       = useState<typeof BLANK_FORM>({ ...BLANK_FORM });
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; err: boolean } | null>(null);
  const [confirm,    setConfirm]    = useState<Funcionario | null>(null);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadDeps = useCallback(async () => {
    const [rc, rs, ru, ro] = await Promise.all([
      fetch('/api/admin/cargos'),
      fetch('/api/admin/setores'),
      fetch('/api/admin/unidades-rh'),
      fetch('/api/org'),
    ]);
    if (rc.ok) setCargos(await rc.json());
    if (rs.ok) setSetores(await rs.json());
    if (ru.ok) setUnidades(await ru.json());
    if (ro.ok) {
      const nodes = await ro.json() as Array<{ id: string; name: string; role: string; level: number; isSector: boolean }>;
      setOrgNodes(nodes.filter(n => !n.isSector).map(n => ({ id: n.id, name: n.name, role: n.role, level: n.level })));
    }
  }, []);

  const loadFuncionarios = useCallback(async () => {
    const res = await fetch('/api/admin/funcionarios');
    if (res.ok) setFuncionarios(await res.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDeps(), loadFuncionarios()]).finally(() => setLoading(false));
  }, [loadDeps, loadFuncionarios]);

  const hasDeps = cargos.length > 0 && setores.length > 0 && unidades.length > 0;

  // Funcionários cujo setor foi excluído (id_setor não existe mais nos setores ativos)
  const validSetorIds = useMemo(() => new Set(setores.map(s => s.id)), [setores]);
  const semSetorValido = useMemo(
    () => funcionarios.filter(f => f.id_setor && !validSetorIds.has(f.id_setor)),
    [funcionarios, validSetorIds],
  );

  const filtered = useMemo(() => {
    let list = funcionarios;
    if (fSetor === '__none__') list = list.filter(f => f.id_setor && !validSetorIds.has(f.id_setor));
    else if (fSetor) list = list.filter(f => f.id_setor === fSetor);
    if (fCargo) list = list.filter(f => f.id_cargo === fCargo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        f.nome_completo.toLowerCase().includes(q) ||
        (f.cargo_nome ?? '').toLowerCase().includes(q) ||
        (f.setor_nome ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [funcionarios, search, fSetor, fCargo, validSetorIds]);

  function openNew() {
    setEditing(null);
    setForm({ ...BLANK_FORM });
    setDrawerOpen(true);
  }

  function openEdit(f: Funcionario) {
    setEditing(f);

    // Detecta par de diretores: nome "A & B"
    const isPairedEdit = / & /.test(f.nome_completo);
    const nameParts    = f.nome_completo.split(/\s+&\s+/);
    const mainNome     = isPairedEdit ? (nameParts[0]?.trim() ?? f.nome_completo) : f.nome_completo;
    const coNome       = isPairedEdit ? (nameParts[1]?.trim() ?? '') : '';

    // Procura o registro do co-diretor na lista já carregada
    const coRecord = isPairedEdit
      ? funcionarios.find(fn =>
          fn.nome_completo === coNome &&
          fn.id_cargo === f.id_cargo &&
          fn.id !== f.id
        )
      : undefined;

    setForm({
      nome_completo:    mainNome,
      id_cargo:         f.id_cargo,
      // Se o setor foi excluído, limpa para forçar nova seleção
      id_setor:         validSetorIds.has(f.id_setor) ? f.id_setor : '',
      id_unidade:       f.id_unidade,
      photo_url:        f.photo_url       ?? '',
      cpf:              f.cpf             ?? '',
      rg:               f.rg              ?? '',
      cnpj:             f.cnpj            ?? '',
      contrato_tipo:    (f.contrato_tipo    ?? '') as FuncForm['contrato_tipo'],
      jornada_trabalho: (f.jornada_trabalho ?? '') as FuncForm['jornada_trabalho'],
      data_nascimento:  f.data_nascimento  ?? '',
      data_admissao:    f.data_admissao    ?? '',
      data_desligamento:f.data_desligamento ?? '',
      telefone:         f.telefone         ?? '',
      celular:          f.celular          ?? '',
      homepage:         f.homepage         ?? '',
      logradouro:       f.logradouro       ?? '',
      numero:           f.numero           ?? '',
      complemento:      f.complemento      ?? '',
      bairro:           f.bairro           ?? '',
      cidade:           f.cidade           ?? '',
      estado:           f.estado           ?? '',
      cep:              f.cep              ?? '',
      parent_node_id:   '',
      // Dados do co-diretor
      co_diretor_nome:  coNome,
      co_id:            coRecord?.id ?? '',
      co_cpf:           (coRecord?.cpf             as string | undefined) ?? '',
      co_rg:            (coRecord?.rg              as string | undefined) ?? '',
      co_cnpj:          (coRecord?.cnpj            as string | undefined) ?? '',
      co_contrato_tipo: ((coRecord?.contrato_tipo  as string | undefined) ?? '') as FuncForm['co_contrato_tipo'],
      co_jornada_trabalho: ((coRecord?.jornada_trabalho as string | undefined) ?? '') as FuncForm['co_jornada_trabalho'],
      co_data_nascimento:  (coRecord?.data_nascimento  as string | undefined) ?? '',
      co_data_admissao:    (coRecord?.data_admissao    as string | undefined) ?? '',
      co_data_desligamento:(coRecord?.data_desligamento as string | undefined) ?? '',
      co_telefone:      (coRecord?.telefone   as string | undefined) ?? '',
      co_celular:       (coRecord?.celular    as string | undefined) ?? '',
      co_homepage:      (coRecord?.homepage   as string | undefined) ?? '',
      co_logradouro:    (coRecord?.logradouro as string | undefined) ?? '',
      co_numero:        (coRecord?.numero     as string | undefined) ?? '',
      co_complemento:   (coRecord?.complemento as string | undefined) ?? '',
      co_bairro:        (coRecord?.bairro     as string | undefined) ?? '',
      co_cidade:        (coRecord?.cidade     as string | undefined) ?? '',
      co_estado:        (coRecord?.estado     as string | undefined) ?? '',
      co_cep:           (coRecord?.cep        as string | undefined) ?? '',
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome_completo.trim() || !form.id_cargo || !form.id_unidade) {
      showToast('Preencha: nome, cargo e unidade.', true);
      return;
    }
    if (!form.id_setor || !validSetorIds.has(form.id_setor)) {
      showToast('Selecione um setor válido para o funcionário.', true);
      return;
    }
    setSaving(true);
    try {
      const url    = editing ? `/api/admin/funcionarios/${editing.id}` : '/api/admin/funcionarios';
      const method = editing ? 'PUT' : 'POST';

      // Combina nome do co-diretor se preenchido (cargo nvl 0)
      const hasCo     = form.co_diretor_nome.trim() !== '';
      const nomeFinal = hasCo
        ? `${form.nome_completo.trim()} & ${form.co_diretor_nome.trim()}`
        : form.nome_completo.trim();

      // Remove campos virtuais antes de enviar
      const {
        co_diretor_nome: _cn, co_id: _ci,
        co_cpf: _ccpf, co_rg: _crg, co_cnpj: _ccnpj,
        co_contrato_tipo: _cct, co_jornada_trabalho: _cjt,
        co_data_nascimento: _cdn, co_data_admissao: _cda, co_data_desligamento: _cdd,
        co_telefone: _ctel, co_celular: _ccel, co_homepage: _chp,
        co_logradouro: _clg, co_numero: _cnum, co_complemento: _ccomp,
        co_bairro: _cbai, co_cidade: _ccid, co_estado: _cest, co_cep: _ccep,
        ...rest
      } = form;

      const body = {
        ...rest,
        nome_completo:    nomeFinal,
        photo_url:        form.photo_url,
        contrato_tipo:    form.contrato_tipo    || null,
        jornada_trabalho: form.jornada_trabalho || null,
      };

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? 'Erro ao salvar.', true); return; }

      // Se há co-diretor, cria/atualiza o registro dele separadamente (sem org node)
      if (hasCo) {
        const coUrl    = form.co_id ? `/api/admin/funcionarios/${form.co_id}` : '/api/admin/funcionarios';
        const coMethod = form.co_id ? 'PUT' : 'POST';
        const coBody = {
          nome_completo:    form.co_diretor_nome.trim(),
          id_cargo:         form.id_cargo,
          id_setor:         form.id_setor,
          id_unidade:       form.id_unidade,
          photo_url:        form.photo_url,
          cpf:              form.co_cpf              || null,
          rg:               form.co_rg               || null,
          cnpj:             form.co_cnpj             || null,
          contrato_tipo:    form.co_contrato_tipo    || null,
          jornada_trabalho: form.co_jornada_trabalho || null,
          data_nascimento:  form.co_data_nascimento  || null,
          data_admissao:    form.co_data_admissao    || null,
          data_desligamento:form.co_data_desligamento|| null,
          telefone:         form.co_telefone         || null,
          celular:          form.co_celular           || null,
          homepage:         form.co_homepage         || null,
          logradouro:       form.co_logradouro       || null,
          numero:           form.co_numero           || null,
          complemento:      form.co_complemento      || null,
          bairro:           form.co_bairro           || null,
          cidade:           form.co_cidade           || null,
          estado:           form.co_estado           || null,
          cep:              form.co_cep              || null,
          skip_org_node: true,
        };
        const coRes = await fetch(coUrl, {
          method: coMethod,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coBody),
        });
        if (!coRes.ok) {
          const coJson = await coRes.json();
          showToast(`Diretor principal salvo, mas erro no co-diretor: ${coJson.error ?? 'desconhecido'}`, true);
          closeDrawer();
          await loadFuncionarios();
          return;
        }
      }

      showToast(editing ? 'Funcionários atualizados!' : 'Funcionários cadastrados no organograma!');
      closeDrawer();
      await loadFuncionarios();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setConfirm(editing);
  }

  async function confirmDelete(f: Funcionario) {
    setConfirm(null);
    const res  = await fetch(`/api/admin/funcionarios/${f.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { showToast(json.error ?? 'Erro ao excluir.', true); return; }
    showToast('Funcionário removido do sistema e do organograma.');
    closeDrawer();
    await loadFuncionarios();
  }

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin">Admin</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>Funcionários</span>
        </div>
        <h1 className={styles.headerTitle}>Funcionários</h1>
        <span className={styles.headerBadge}>{funcionarios.length} cadastrados</span>
      </div>

      <div className={styles.funcLayout}>

        {/* Aviso se falta dependência */}
        {!loading && !hasDeps && (
          <div className={styles.depWarning}>
            <span className={styles.depWarningIcon}>⚠️</span>
            <span>
              Para cadastrar funcionários, é necessário ter pelo menos um{' '}
              <Link href="/admin/cargos" style={{ color: 'inherit', textDecoration: 'underline' }}>Cargo</Link>,{' '}
              <Link href="/admin/setores" style={{ color: 'inherit', textDecoration: 'underline' }}>Setor</Link> e{' '}
              <Link href="/admin/unidades/cadastro" style={{ color: 'inherit', textDecoration: 'underline' }}>Unidade</Link> cadastrados.
            </span>
          </div>
        )}

        {/* Aviso de funcionários sem setor válido (setor excluído) */}
        {!loading && semSetorValido.length > 0 && (
          <div className={styles.sectorWarn}>
            <span className={styles.sectorWarnIcon}>⚠</span>
            <span>
              <strong>{semSetorValido.length} funcionário{semSetorValido.length > 1 ? 's' : ''}</strong> sem setor válido — o setor foi excluído.
              Eles estão ocultos no organograma até serem realocados.{' '}
              <button className={styles.sectorWarnBtn} onClick={() => setFSetor('__none__')}>
                Ver funcionários pendentes
              </button>
            </span>
          </div>
        )}

        {/* Barra de busca e filtros */}
        <div className={styles.listHeader}>
          <div className={styles.statsChip}>
            <span className={styles.statsNum}>{filtered.length}</span>
            <span className={styles.statsLabel}>funcionários</span>
          </div>

          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>⌕</span>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome, cargo, setor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select className={styles.filterSelect} value={fSetor} onChange={e => setFSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {semSetorValido.length > 0 && (
              <option value="__none__">⚠ Sem setor válido ({semSetorValido.length})</option>
            )}
            {setores.filter(s => s.ativo).map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>

          <select className={styles.filterSelect} value={fCargo} onChange={e => setFCargo(e.target.value)}>
            <option value="">Todos os cargos</option>
            {cargos.filter(c => c.ativo).map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <button className={styles.addBtn} onClick={openNew} disabled={!hasDeps}>
            + Novo funcionário
          </button>
        </div>

        {/* Tabela */}
        <div className={styles.tableHead}>
          <span className={styles.tableHeadCell}>Nome</span>
          <span className={styles.tableHeadCell}>Cargo</span>
          <span className={styles.tableHeadCell}>Setor</span>
          <span className={styles.tableHeadCell}>Unidade</span>
          <span className={styles.tableHeadCell}>Contrato</span>
          <span className={styles.tableHeadCell}>Ações</span>
        </div>

        <div className={styles.funcTable}>
          {loading ? (
            <div style={{ padding: 24 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} className={styles.tableRow} style={{ opacity: .6 }}>
                  <span className={styles.skeleton} style={{ width: '70%', height: 14 }} />
                  <span className={styles.skeleton} style={{ width: '60%', height: 12 }} />
                  <span className={styles.skeleton} style={{ width: '55%', height: 12 }} />
                  <span className={styles.skeleton} style={{ width: '50%', height: 12 }} />
                  <span className={styles.skeleton} style={{ width: 50, height: 20, borderRadius: 999 }} />
                  <span />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>👥</div>
              <p className={styles.emptyTitle}>
                {hasDeps ? 'Nenhum funcionário encontrado' : 'Cadastre os pré-requisitos primeiro'}
              </p>
              <p className={styles.emptyText}>
                {hasDeps
                  ? 'Use o botão "+ Novo funcionário" para começar.'
                  : 'Cargos, Setores e Unidades precisam existir antes.'}
              </p>
            </div>
          ) : (
            filtered.map(f => {
              const nvl          = f.cargo_nvl ?? 9;
              const color        = levelColors[nvl] ?? '#94a3b8';
              const setorInvalido = f.id_setor && !validSetorIds.has(f.id_setor);
              return (
                <div
                  key={f.id}
                  className={`${styles.tableRow} ${setorInvalido ? styles.tableRowWarn : ''}`}
                  onClick={() => openEdit(f)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar photoUrl={f.photo_url ?? ''} name={f.nome_completo} size={32} color={color} />
                      <span className={styles.cellName}>{f.nome_completo}</span>
                    </div>
                  </div>
                  <div>
                    <span className={styles.cellName} style={{ fontSize: 12 }}>{f.cargo_nome ?? '—'}</span>
                    {f.cargo_nvl !== undefined && (
                      <div>
                        <span className={styles.lvlBadge} style={{ background: `${color}20`, color, border: `1px solid ${color}40`, fontSize: 9 }}>
                          Nv {f.cargo_nvl}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    {setorInvalido ? (
                      <span className={styles.sectorWarnBadge}>⚠ Setor excluído</span>
                    ) : (
                      <span className={styles.cellSub}>{f.setor_nome ?? '—'}</span>
                    )}
                  </div>
                  <span className={styles.cellSub}>{f.unidade_nome ?? '—'}</span>
                  <span>
                    {f.contrato_tipo ? (
                      <span className={styles.badgeAtivo} style={
                        f.contrato_tipo === 'PJ' ? { background: 'rgba(168,85,247,.12)', color: '#c4b5fd', borderColor: 'rgba(168,85,247,.25)' } :
                        f.contrato_tipo === 'Freelancer' ? { background: 'rgba(251,191,36,.10)', color: '#fbbf24', borderColor: 'rgba(251,191,36,.25)' } :
                        {}
                      }>
                        {f.contrato_tipo}
                      </span>
                    ) : (
                      <span className={styles.badgeInativo}>—</span>
                    )}
                  </span>
                  <div className={styles.cellActions} onClick={e => e.stopPropagation()}>
                    <button className={styles.iconBtn} title="Editar" onClick={() => openEdit(f)}>✏</button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Excluir" onClick={() => setConfirm(f)}>🗑</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <FuncionarioDrawer
          form={form}
          setForm={setForm}
          editing={editing}
          cargos={cargos}
          setores={setores}
          unidades={unidades}
          orgNodes={orgNodes}
          saving={saving}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
        />
      )}

      {toast && <div className={`${styles.toast} ${toast.err ? styles.toastErr : ''}`}>{toast.msg}</div>}

      {confirm && (
        <div className={styles.overlay} onClick={() => setConfirm(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑</div>
            <p className={styles.confirmTitle}>Excluir funcionário</p>
            <p className={styles.confirmMsg}>
              Remover <strong>{confirm.nome_completo}</strong>?<br />
              O nó correspondente no organograma também será removido.
            </p>
            <div className={styles.confirmFoot}>
              <button className={styles.btnSecondary} onClick={() => setConfirm(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => confirmDelete(confirm)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
