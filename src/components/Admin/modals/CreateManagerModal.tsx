'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import { createOrgNode } from '@/lib/orgApi';
import { generateNodeId } from '@/lib/nodeUtils';
import { levelColors } from '@/data/orgData';
import type { OrgNode } from '@/types/orgChart';
import styles from './modals.module.css';

interface CreateManagerModalProps {
  /** Lista de diretores disponíveis para o GG reportar. */
  directors:          OrgNode[];
  onClose:            () => void;
  setNodes:           React.Dispatch<React.SetStateAction<OrgNode[]>>;
  markSyncing:        (id: string) => void;
  unmarkSyncing:      (id: string) => void;
  showToast:          (message: string, type?: 'success' | 'error') => void;
  refreshNodes:       () => Promise<void>;
  /** Chamado após o GG ser criado com sucesso; permite reatribuir setores órfãos. */
  onManagerCreated?:  (newManagerId: string) => Promise<void>;
}

/**
 * Modal para adicionar um Gerente Geral (nível 1) vinculado a uma Diretoria.
 * Só é exibido quando há ao menos uma diretoria cadastrada.
 */
export default function CreateManagerModal({
  directors,
  onClose,
  setNodes,
  markSyncing,
  unmarkSyncing,
  showToast,
  refreshNodes,
  onManagerCreated,
}: CreateManagerModalProps) {
  const [form, setForm] = useState({
    name:        '',
    role:        'Gerente Geral',
    photoUrl:    '',
    directorId:  directors[0]?.id ?? '',
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit() {
    if (!form.name.trim() || !form.role.trim() || !form.directorId) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const newId = generateNodeId('manager');
    const newManager: OrgNode = {
      id:       newId,
      name:     form.name,
      role:     form.role,
      photoUrl: form.photoUrl || undefined,
      level:    1,
      parentId: form.directorId,
      isSector: false,
    };

    // Atualização otimista
    setNodes(prev => [...prev, newManager]);
    onClose();
    markSyncing(newId);

    try {
      await createOrgNode(newManager);
      await onManagerCreated?.(newId);
      await refreshNodes();
      showToast('Gerente Geral adicionado!');
    } catch (err) {
      setNodes(prev => prev.filter(n => n.id !== newId));
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar.', 'error');
    } finally {
      unmarkSyncing(newId);
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
          <h2>Adicionar Gerente Geral</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalAvatarRow}>
          <Avatar photoUrl={form.photoUrl} name={form.name} size={72} color={levelColors[1]} />
        </div>

        <label className={styles.label}>
          Nome completo *
          <input
            autoFocus
            className={styles.input}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Carlos Lima"
          />
        </label>

        <label className={styles.label}>
          Cargo *
          <input
            className={styles.input}
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            placeholder="Ex: Gerente de Operações"
          />
        </label>

        {/* Seletor de diretoria só aparece quando há mais de uma */}
        {directors.length > 1 && (
          <label className={styles.label}>
            Reporta à Diretoria *
            <select
              className={styles.select}
              value={form.directorId}
              onChange={e => setForm(f => ({ ...f, directorId: e.target.value }))}
            >
              {directors.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.role}</option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.label}>
          URL da foto
          <input
            className={styles.input}
            value={form.photoUrl}
            onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
            placeholder="https://…"
          />
        </label>

        <div className={styles.modalFoot}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>Adicionar GG</button>
        </div>
      </form>
    </div>
  );
}
