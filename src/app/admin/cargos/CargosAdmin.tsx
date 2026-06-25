'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { Cargo } from '@/types/adminCore';
import { CARGO_LEVELS, NVL_LABELS } from '@/types/adminCore';
import { levelColors } from '@/data/orgData';
import styles from '../crud.module.css';

// ── Paleta de cor por nível ───────────────────────────────────────────────────
function LvlBadge({ nvl }: { nvl: number }) {
  const color = levelColors[nvl] ?? '#94a3b8';
  return (
    <span
      className={styles.lvlBadge}
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      Nv {nvl} · {NVL_LABELS[nvl] ?? 'Desconhecido'}
    </span>
  );
}

const BLANK = { nome: '', nvl_permissao: 4, descricao: '', ativo: true };

export default function CargosAdmin() {
  const [cargos,   setCargos]   = useState<Cargo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [form,     setForm]     = useState(BLANK);
  const [editing,  setEditing]  = useState<Cargo | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; err: boolean } | null>(null);
  const [confirm,  setConfirm]  = useState<Cargo | null>(null);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/cargos');
    if (res.ok) setCargos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = cargos;
    if (filter === 'ativos')   list = list.filter(c => c.ativo);
    if (filter === 'inativos') list = list.filter(c => !c.ativo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.descricao.toLowerCase().includes(q) ||
        String(c.nvl_permissao).includes(q)
      );
    }
    return [...list].sort((a, b) => a.nvl_permissao - b.nvl_permissao);
  }, [cargos, search, filter]);

  function startEdit(c: Cargo) {
    setEditing(c);
    setForm({ nome: c.nome, nvl_permissao: c.nvl_permissao, descricao: c.descricao, ativo: c.ativo });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(BLANK);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.descricao.trim()) {
      showToast('Preencha nome e descrição.', true);
      return;
    }
    setSaving(true);
    try {
      const url    = editing ? `/api/admin/cargos/${editing.id}` : '/api/admin/cargos';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? 'Erro ao salvar.', true); return; }
      showToast(editing ? 'Cargo atualizado!' : 'Cargo criado!');
      cancelEdit();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Cargo) {
    setConfirm(null);
    const res  = await fetch(`/api/admin/cargos/${c.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { showToast(json.error ?? 'Erro ao excluir.', true); return; }
    showToast('Cargo removido.');
    if (editing?.id === c.id) cancelEdit();
    await load();
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/admin">Admin</Link>
          <span className={styles.breadcrumbSep}>›</span>
          <span>Cargos</span>
        </div>
        <h1 className={styles.headerTitle}>Cargos</h1>
        <span className={styles.headerBadge}>{cargos.filter(c => c.ativo).length} ativos</span>
      </div>

      <div className={styles.body}>

        {/* Painel esquerdo: formulário */}
        <div className={styles.formPanel}>
          <div className={styles.formPanelHead}>
            <span className={styles.formPanelTitle}>{editing ? 'Editar cargo' : 'Novo cargo'}</span>
            {editing && <span className={`${styles.formPanelMode} ${styles.formPanelModeEdit}`}>Editando</span>}
          </div>

          <form className={styles.formBody} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label}>Nome <span className={styles.required}>*</span></label>
              <input
                className={styles.input}
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Analista Sênior"
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Nível hierárquico <span className={styles.required}>*</span></label>
              <select
                className={styles.select}
                value={form.nvl_permissao}
                onChange={e => setForm(f => ({ ...f, nvl_permissao: Number(e.target.value) }))}
              >
                {CARGO_LEVELS.map(lvl => (
                  <option key={lvl} value={lvl}>
                    {lvl} — {NVL_LABELS[lvl]}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHint}>Faixa válida: 0–12. Níveis 2 e 3 são reservados para Setores e Sub-setores.</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Descrição <span className={styles.required}>*</span></label>
              <textarea
                className={styles.textarea}
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descreva as responsabilidades deste cargo…"
                rows={3}
              />
            </div>

            <div
              className={styles.toggleRow}
              onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setForm(f => ({ ...f, ativo: !f.ativo }))}
            >
              <span className={styles.toggleLabel}>Cargo ativo</span>
              <span className={`${styles.toggle} ${form.ativo ? styles.toggleOn : ''}`} />
            </div>

            {/* Preview do nível */}
            <div style={{ paddingTop: 4 }}>
              <LvlBadge nvl={form.nvl_permissao} />
            </div>
          </form>

          <div className={styles.formFoot}>
            {editing && (
              <button type="button" className={styles.btnSecondary} onClick={cancelEdit}>
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving}
              onClick={handleSubmit as unknown as React.MouseEventHandler}
            >
              {saving ? 'Salvando…' : editing ? 'Salvar alterações' : '+ Criar cargo'}
            </button>
          </div>
        </div>

        {/* Painel direito: lista */}
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div className={styles.statsChip}>
              <span className={styles.statsNum}>{filtered.length}</span>
              <span className={styles.statsLabel}>cargos</span>
            </div>

            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                className={styles.searchInput}
                placeholder="Buscar cargo…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select
              className={styles.filterSelect}
              value={filter}
              onChange={e => setFilter(e.target.value as typeof filter)}
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </div>

          <div className={styles.list}>
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className={styles.row} style={{ gap: 12 }}>
                  <span className={styles.skeleton} style={{ width: 28, height: 28, borderRadius: 8 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className={styles.skeleton} style={{ width: '60%', height: 13 }} />
                    <span className={styles.skeleton} style={{ width: '40%', height: 10 }} />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🗂</div>
                <p className={styles.emptyTitle}>Nenhum cargo encontrado</p>
                <p className={styles.emptyText}>Crie o primeiro cargo usando o formulário ao lado.</p>
              </div>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  className={`${styles.row} ${editing?.id === c.id ? styles.rowSelected : ''} ${!c.ativo ? styles.rowInactive : ''}`}
                  onClick={() => startEdit(c)}
                >
                  <div
                    className={styles.rowColorDot}
                    style={{ background: levelColors[c.nvl_permissao] ?? '#94a3b8' }}
                  />
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{c.nome}</div>
                    <div className={styles.rowSub}>{c.descricao}</div>
                  </div>
                  <LvlBadge nvl={c.nvl_permissao} />
                  <span className={c.ativo ? styles.badgeAtivo : styles.badgeInativo}>
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <div className={styles.rowActions} onClick={e => e.stopPropagation()}>
                    <button className={styles.iconBtn} title="Editar" onClick={() => startEdit(c)}>✏</button>
                    <button
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      title="Excluir"
                      onClick={() => setConfirm(c)}
                    >🗑</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.err ? styles.toastErr : ''}`}>{toast.msg}</div>
      )}

      {/* Confirm delete */}
      {confirm && (
        <div className={styles.overlay} onClick={() => setConfirm(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑</div>
            <p className={styles.confirmTitle}>Excluir cargo</p>
            <p className={styles.confirmMsg}>
              Tem certeza que deseja remover <strong>{confirm.nome}</strong>?<br />
              Funcionários com este cargo precisarão ser atualizados.
            </p>
            <div className={styles.confirmFoot}>
              <button className={styles.btnSecondary} onClick={() => setConfirm(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => handleDelete(confirm)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
