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
  /** Já existe uma Diretoria central? Em caso afirmativo, bloqueia criar outra. */
  centralDirectorExists?: boolean;
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
 * Modal para criar ou editar uma Diretoria (nível 0, sempre central).
 * Suporta modo individual ou compartilhado (casal: "Nome1 & Nome2").
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
  const isEditing    = directorBeingEdited !== null;
  const isSharedName = directorBeingEdited?.name.includes(' & ') ?? false;
  const nameParts    = directorBeingEdited?.name.split(' & ') ?? [];

  const [isSharedDirector, setIsSharedDirector] = useState(isSharedName);
  const [form, setForm] = useState({
    name1:    isEditing ? (isSharedName ? (nameParts[0] ?? '') : directorBeingEdited!.name) : '',
    name2:    isSharedName ? (nameParts[1] ?? '') : '',
    role:     directorBeingEdited?.role     ?? 'Diretoria',
    photoUrl: directorBeingEdited?.photoUrl ?? '',
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Nome final a ser salvo: "A & B" para compartilhado, ou só "A". */
  const resolvedName = isSharedDirector
    ? [form.name1.trim(), form.name2.trim()].filter(Boolean).join(' & ')
    : form.name1.trim();

  async function handleSubmit() {
    if (!resolvedName || !form.role.trim()) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    // Regra: só pode haver UMA Diretoria central. Do 2º diretor em diante,
    // cadastre como Diretor de Setor (dentro de um setor), nunca no centro.
    if (!isEditing && centralDirectorExists) {
      showToast('Já existe uma Diretoria central. Cadastre diretores adicionais como Diretor de Setor.', 'error');
      return;
    }

    const nodeId = isEditing ? directorBeingEdited!.id : generateNodeId('director');
    const patch = {
      name:     resolvedName,
      role:     form.role,
      photoUrl: form.photoUrl || undefined,
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

        {/* Toggle individual / compartilhado */}
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

        <div className={styles.modalAvatarRow}>
          <Avatar photoUrl={form.photoUrl} name={resolvedName || '?'} size={72} color={levelColors[0]} />
        </div>

        {/* Campos de nome */}
        {isSharedDirector ? (
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
              placeholder="Ex: Maria da Silva"
            />
          </label>
        )}

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
          URL da foto{isSharedDirector ? ' (foto do casal)' : ''}
          <input
            className={styles.input}
            value={form.photoUrl}
            onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
            placeholder="https://…"
          />
        </label>

        {isSharedDirector && resolvedName && (
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
