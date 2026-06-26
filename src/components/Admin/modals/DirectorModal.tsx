'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import { createOrgNode, updateOrgNode } from '@/lib/orgApi';
import { generateNodeId } from '@/lib/nodeUtils';
import { levelColors } from '@/data/orgData';
import type { OrgNode } from '@/types/orgChart';
import styles from './modals.module.css';

interface DirectorModalProps {
  /** Diretoria a editar. Null quando está criando uma nova. */
  directorBeingEdited: OrgNode | null;
  /** Já existe UMA Diretoria central (bloqueia criar individual extra). */
  centralDirectorExists?: boolean;
  onClose:             () => void;
  onDeleteClick:       (id: string, label: string) => void;
  setNodes:            React.Dispatch<React.SetStateAction<OrgNode[]>>;
  markSyncing:         (id: string) => void;
  unmarkSyncing:       (id: string) => void;
  showToast:           (message: string, type?: 'success' | 'error') => void;
  refreshNodes:        () => Promise<void>;
  onDirectorCreated?:  (newDirectorId: string) => Promise<void>;
}

/**
 * Modal para criar ou editar uma Diretoria (nível 0).
 *
 * Modo compartilhado: cria DOIS nós separados no banco (um por pessoa).
 * A mesclagem em um único card "A & B" é feita pelo OrgChart na exibição.
 */
export default function DirectorModal({
  directorBeingEdited,
  centralDirectorExists = false,
  onClose,
  onDeleteClick,
  setNodes,
  markSyncing,
  unmarkSyncing,
  showToast,
  refreshNodes,
  onDirectorCreated,
}: DirectorModalProps) {
  const isEditing = directorBeingEdited !== null;

  const [isSharedDirector, setIsSharedDirector] = useState(false);
  const [form, setForm] = useState({
    name1:    isEditing ? directorBeingEdited!.name : '',
    name2:    '',
    role:     directorBeingEdited?.role     ?? 'Diretoria',
    photoUrl:  directorBeingEdited?.photoUrl ?? '',
    photoUrl2: '',
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit() {
    const n1 = form.name1.trim();
    const n2 = form.name2.trim();

    if (!n1 || !form.role.trim()) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
    if (isSharedDirector && !n2) {
      showToast('Preencha o nome da segunda pessoa.', 'error');
      return;
    }

    // Bloqueia criar individual quando já existe diretoria (shared sempre permite)
    if (!isEditing && !isSharedDirector && centralDirectorExists) {
      showToast('Já existe uma Diretoria central. Cadastre diretores adicionais como Diretor de Setor.', 'error');
      return;
    }

    // ── Edição de nó individual ──────────────────────────────────────────
    if (isEditing) {
      const nodeId = directorBeingEdited!.id;
      const patch  = { name: n1, role: form.role, photoUrl: form.photoUrl || undefined };
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...patch } : n));
      onClose();
      markSyncing(nodeId);
      try {
        await updateOrgNode(nodeId, patch);
        await refreshNodes();
        showToast('Diretoria atualizada!');
      } catch (err) {
        await refreshNodes();
        showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
      } finally {
        unmarkSyncing(nodeId);
      }
      return;
    }

    // ── Criação compartilhada: dois nós separados no banco ───────────────
    if (isSharedDirector) {
      const id1 = generateNodeId('director');
      const id2 = generateNodeId('director');
      const node1: OrgNode = { id: id1, name: n1, role: form.role, photoUrl: form.photoUrl  || undefined, level: 0, parentId: null, isSector: false };
      const node2: OrgNode = { id: id2, name: n2, role: form.role, photoUrl: form.photoUrl2 || undefined, level: 0, parentId: null, isSector: false };

      // Otimista: adiciona ambos localmente
      setNodes(prev => [...prev, node1, node2]);
      onClose();
      markSyncing(id1);
      markSyncing(id2);
      try {
        await createOrgNode(node1);
        await onDirectorCreated?.(id1);
        await createOrgNode(node2);
        await refreshNodes();
        showToast('Diretoria compartilhada criada!');
      } catch (err) {
        await refreshNodes();
        showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
      } finally {
        unmarkSyncing(id1);
        unmarkSyncing(id2);
      }
      return;
    }

    // ── Criação individual ───────────────────────────────────────────────
    const nodeId = generateNodeId('director');
    const patch  = { name: n1, role: form.role, photoUrl: form.photoUrl || undefined };
    setNodes(prev => [...prev, { id: nodeId, ...patch, level: 0, parentId: null, isSector: false }]);
    onClose();
    markSyncing(nodeId);
    try {
      await createOrgNode({ id: nodeId, ...patch, level: 0, parentId: null, isSector: false });
      await onDirectorCreated?.(nodeId);
      await refreshNodes();
      showToast('Diretoria criada!');
    } catch (err) {
      await refreshNodes();
      showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
    } finally {
      unmarkSyncing(nodeId);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        <div className={styles.modalHead}>
          <h2>{isEditing ? 'Editar Diretoria' : 'Nova Diretoria'}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Toggle individual / compartilhado (apenas na criação) */}
        {!isEditing && (
          <div className={styles.sharedToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${!isSharedDirector ? styles.toggleBtnOn : ''}`}
              onClick={() => setIsSharedDirector(false)}
            >
              Individual
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${isSharedDirector ? styles.toggleBtnOn : ''}`}
              onClick={() => setIsSharedDirector(true)}
            >
              Compartilhado (casal)
            </button>
          </div>
        )}

        {/* Avatares de prévia */}
        <div className={styles.modalAvatarRow}>
          <Avatar photoUrl={form.photoUrl} name={form.name1 || '?'} size={isSharedDirector ? 52 : 72} color={levelColors[0]} />
          {isSharedDirector && (
            <Avatar photoUrl={form.photoUrl2} name={form.name2 || '?'} size={52} color={levelColors[0]} />
          )}
        </div>

        {/* Campos de nome */}
        {isSharedDirector ? (
          <>
            <div className={styles.modalGrid}>
              <label className={styles.label}>
                Nome — Pessoa 1 *
                <input
                  autoFocus
                  className={styles.input}
                  value={form.name1}
                  onChange={e => setForm(f => ({ ...f, name1: e.target.value }))}
                  placeholder="Ex: João da Silva"
                />
              </label>
              <label className={styles.label}>
                Nome — Pessoa 2 *
                <input
                  className={styles.input}
                  value={form.name2}
                  onChange={e => setForm(f => ({ ...f, name2: e.target.value }))}
                  placeholder="Ex: Maria da Silva"
                />
              </label>
            </div>

            <label className={styles.label}>
              Cargo / Título *
              <input
                className={styles.input}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="Ex: Diretoria"
              />
            </label>

            <div className={styles.modalGrid}>
              <label className={styles.label}>
                Foto — Pessoa 1
                <input
                  className={styles.input}
                  value={form.photoUrl}
                  onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <label className={styles.label}>
                Foto — Pessoa 2
                <input
                  className={styles.input}
                  value={form.photoUrl2}
                  onChange={e => setForm(f => ({ ...f, photoUrl2: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
            </div>

            {form.name1 && form.name2 && (
              <p className={styles.sharedHint}>
                Será exibido como: <strong>&quot;{form.name1.trim()} &amp; {form.name2.trim()}&quot;</strong>
                <br />
                <small>Salvo como dois registros separados no banco.</small>
              </p>
            )}
          </>
        ) : (
          <>
            <label className={styles.label}>
              Nome completo *
              <input
                autoFocus
                className={styles.input}
                value={form.name1}
                onChange={e => setForm(f => ({ ...f, name1: e.target.value }))}
                placeholder="Ex: Maria da Silva"
              />
            </label>

            <label className={styles.label}>
              Cargo / Título *
              <input
                className={styles.input}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="Ex: Diretora Executiva"
              />
            </label>

            <label className={styles.label}>
              URL da foto
              <input
                className={styles.input}
                value={form.photoUrl}
                onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
                placeholder="https://…"
              />
            </label>
          </>
        )}

        <div className={styles.modalFoot}>
          {isEditing && (
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => { onClose(); onDeleteClick(directorBeingEdited!.id, directorBeingEdited!.name); }}
            >
              Excluir
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>
            {isEditing ? 'Salvar alterações' : (isSharedDirector ? 'Criar Diretoria Compartilhada' : 'Criar Diretoria')}
          </button>
        </div>
      </form>
    </div>
  );
}
