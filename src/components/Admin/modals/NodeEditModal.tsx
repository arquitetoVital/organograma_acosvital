'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import { updateOrgNode } from '@/lib/orgApi';
import { SECTOR_COLOR_PALETTE, DEFAULT_SECTOR_COLOR } from '@/data/sectorColors';
import { levelColors } from '@/data/orgData';
import type { OrgNode } from '@/types/orgChart';
import styles from './modals.module.css';

interface NodeEditModalProps {
  node:          OrgNode;
  onClose:       () => void;
  onDeleteClick: (id: string, label: string) => void;
  setNodes:      React.Dispatch<React.SetStateAction<OrgNode[]>>;
  markSyncing:   (id: string) => void;
  unmarkSyncing: (id: string) => void;
  showToast:     (message: string, type?: 'success' | 'error') => void;
  refreshNodes:  () => Promise<void>;
}

/**
 * Modal para editar um nó já existente que não seja pessoa:
 * Diretoria, Gerente Geral, Setor ou Sub-setor.
 */
export default function NodeEditModal({
  node,
  onClose,
  onDeleteClick,
  setNodes,
  markSyncing,
  unmarkSyncing,
  showToast,
  refreshNodes,
}: NodeEditModalProps) {
  const isSector = !!node.isSector;

  const [form, setForm] = useState({
    name:        node.name,
    role:        node.role,
    photoUrl:    node.photoUrl ?? '',
    sectorColor: node.sectorColor ?? DEFAULT_SECTOR_COLOR,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit() {
    // Atualização otimista
    setNodes(prev => prev.map(n =>
      n.id === node.id
        ? { ...n, name: form.name, role: form.role, photoUrl: form.photoUrl || undefined, sectorColor: form.sectorColor || undefined }
        : n
    ));
    onClose();
    markSyncing(node.id);

    try {
      await updateOrgNode(node.id, form);
      await refreshNodes();
      showToast('Salvo!');
    } catch (err) {
      await refreshNodes();
      showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
    } finally {
      unmarkSyncing(node.id);
    }
  }

  const modalTitle = isSector
    ? (node.level > 2 ? 'Editar Sub-setor' : 'Editar Setor')
    : (node.level === 0 ? 'Editar Diretoria' : 'Editar Gerente Geral');

  const nameLabel = isSector
    ? (node.level > 2 ? 'Nome do sub-setor' : 'Nome do setor')
    : 'Nome completo';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        <div className={styles.modalHead}>
          <h2>{modalTitle}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalAvatarRow}>
          <Avatar
            photoUrl={form.photoUrl}
            name={form.name}
            size={72}
            color={isSector ? form.sectorColor : levelColors[node.level]}
          />
        </div>

        <label className={styles.label}>
          {nameLabel} *
          <input
            autoFocus
            className={styles.input}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </label>

        {!isSector && (
          <>
            <label className={styles.label}>
              Cargo *
              <input
                className={styles.input}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
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

        {isSector && (
          <div className={styles.label}>
            Cor do setor
            <div className={styles.swatches}>
              {SECTOR_COLOR_PALETTE.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`${styles.swatch} ${form.sectorColor === color ? styles.swatchOn : ''}`}
                  style={{ background: color }}
                  onClick={() => setForm(f => ({ ...f, sectorColor: color }))}
                />
              ))}
              <input
                type="color"
                className={styles.colorInput}
                value={form.sectorColor}
                onChange={e => setForm(f => ({ ...f, sectorColor: e.target.value }))}
              />
            </div>
          </div>
        )}

        <div className={styles.modalFoot}>
          {/* Apenas nós abaixo da diretoria podem ser excluídos aqui */}
          {node.level >= 1 && (
            <button
              type="button"
              className={styles.btnDanger}
              onClick={() => { onClose(); onDeleteClick(node.id, node.name || node.role); }}
            >
              Excluir
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>Salvar</button>
        </div>
      </form>
    </div>
  );
}
