'use client';

import { useState, useEffect, useMemo } from 'react';
import Avatar from '@/components/ui/Avatar';
import { createOrgNode, updateOrgNode } from '@/lib/orgApi';
import { generateNodeId } from '@/lib/nodeUtils';
import { levelColors } from '@/data/orgData';
import type { OrgNode } from '@/types/orgChart';
import styles from './modals.module.css';

interface DirectorModalProps {
  /** Diretoria a editar. Null quando está criando uma nova. */
  directorBeingEdited: OrgNode | null;
  /** Lista de todos os setores, para vincular diretores de setor. */
  allSectors:          OrgNode[];
  onClose:             () => void;
  onDeleteClick:       (id: string, label: string) => void;
  setNodes:            React.Dispatch<React.SetStateAction<OrgNode[]>>;
  markSyncing:         (id: string) => void;
  unmarkSyncing:       (id: string) => void;
  showToast:           (message: string, type?: 'success' | 'error') => void;
  refreshNodes:        () => Promise<void>;
  /** Chamado após a diretoria ser criada com sucesso; permite vincular GGs órfãos. */
  onDirectorCreated?:  (newDirectorId: string) => Promise<void>;
}

/**
 * Modal para criar ou editar uma Diretoria.
 *
 * Suporta três configurações:
 * - Central: aparece no centro do organograma
 * - De setor: vinculado a um setor específico
 * - Compartilhado (casal): dois nomes exibidos como "Nome1 & Nome2"
 */
export default function DirectorModal({
  directorBeingEdited,
  allSectors,
  onClose,
  onDeleteClick,
  setNodes,
  markSyncing,
  unmarkSyncing,
  showToast,
  refreshNodes,
  onDirectorCreated,
}: DirectorModalProps) {
  const isEditing    = directorBeingEdited !== null;
  const isSharedName = directorBeingEdited?.name.includes(' & ') ?? false;

  const nameParts = directorBeingEdited?.name.split(' & ') ?? [];

  const [isSharedDirector, setIsSharedDirector]         = useState(isSharedName);
  const [linkedSectorId,   setLinkedSectorId]           = useState<string | null>(directorBeingEdited?.sectorDirectorOf ?? null);
  const [form,             setForm]                     = useState({
    name1:    isEditing ? (isSharedName ? (nameParts[0] ?? '') : directorBeingEdited!.name) : '',
    name2:    isSharedName ? (nameParts[1] ?? '') : '',
    role:     directorBeingEdited?.role     ?? 'Diretoria',
    photoUrl: directorBeingEdited?.photoUrl ?? '',
  });

  const sortedSectors = useMemo(
    () => [...allSectors].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    [allSectors],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleSectorLinked(isSector: boolean) {
    setLinkedSectorId(isSector ? (sortedSectors[0]?.id ?? '') : null);
  }

  /** Nome final a ser salvo: "A & B" para compartilhado, ou só "A". */
  const resolvedName = isSharedDirector
    ? [form.name1.trim(), form.name2.trim()].filter(Boolean).join(' & ')
    : form.name1.trim();

  async function handleSubmit() {
    if (!resolvedName || !form.role.trim()) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
    if (linkedSectorId !== null && !linkedSectorId) {
      showToast('Selecione o setor desta diretoria.', 'error');
      return;
    }

    const nodeId = isEditing ? directorBeingEdited!.id : generateNodeId('director');
    const patch = {
      name:             resolvedName,
      role:             form.role,
      photoUrl:         form.photoUrl || undefined,
      sectorDirectorOf: linkedSectorId ?? null,
    };

    // Atualização otimista
    if (isEditing) {
      setNodes(prev => prev.map(n => n.id === directorBeingEdited!.id ? { ...n, ...patch } : n));
    } else {
      setNodes(prev => [...prev, { id: nodeId, ...patch, level: 0, parentId: null, isSector: false }]);
    }

    onClose();
    markSyncing(nodeId);

    try {
      if (isEditing) {
        await updateOrgNode(directorBeingEdited!.id, patch);
      } else {
        await createOrgNode({ id: nodeId, ...patch, level: 0, parentId: null, isSector: false });
        await onDirectorCreated?.(nodeId);
      }
      await refreshNodes();
      showToast(isEditing ? 'Diretoria atualizada!' : 'Diretoria criada!');
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

        {/* Posição no organograma: central ou de setor */}
        <div className={styles.dirTypeSection}>
          <span className={styles.dirTypeLabel}>Posição no organograma</span>
          <div className={styles.sharedToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${linkedSectorId === null ? styles.toggleBtnOn : ''}`}
              onClick={() => toggleSectorLinked(false)}
            >
              Central — centro da tela
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${linkedSectorId !== null ? styles.toggleBtnOn : ''}`}
              onClick={() => toggleSectorLinked(true)}
            >
              De setor — aparece no setor
            </button>
          </div>

          {linkedSectorId !== null && (
            <label className={styles.label} style={{ marginTop: 10 }}>
              Setor gerenciado *
              <select
                className={styles.select}
                value={linkedSectorId}
                onChange={e => setLinkedSectorId(e.target.value)}
              >
                <option value="">— selecione —</option>
                {sortedSectors.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.level > 2 ? ' (sub-setor)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Toggle individual / compartilhado (só para diretorias centrais) */}
        {linkedSectorId === null && (
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

        <div className={styles.modalAvatarRow}>
          <Avatar photoUrl={form.photoUrl} name={resolvedName || '?'} size={72} color={levelColors[0]} />
        </div>

        {/* Campos de nome */}
        {isSharedDirector && linkedSectorId === null ? (
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
        ) : (
          <label className={styles.label}>
            Nome completo *
            <input
              autoFocus
              className={styles.input}
              value={form.name1}
              onChange={e => setForm(f => ({ ...f, name1: e.target.value }))}
              placeholder={linkedSectorId !== null ? 'Ex: Ana Souza' : 'Ex: Maria da Silva'}
            />
          </label>
        )}

        <label className={styles.label}>
          Cargo / Título *
          <input
            className={styles.input}
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            placeholder={linkedSectorId !== null ? 'Ex: Diretora Financeira' : 'Ex: Diretora Executiva'}
          />
        </label>

        <label className={styles.label}>
          URL da foto{isSharedDirector && linkedSectorId === null ? ' (foto do casal)' : ''}
          <input
            className={styles.input}
            value={form.photoUrl}
            onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
            placeholder="https://…"
          />
        </label>

        {isSharedDirector && linkedSectorId === null && resolvedName && (
          <p className={styles.sharedHint}>
            Será exibido como: <strong>&quot;{resolvedName}&quot;</strong>
          </p>
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
            {isEditing ? 'Salvar alterações' : 'Criar Diretoria'}
          </button>
        </div>
      </form>
    </div>
  );
}
