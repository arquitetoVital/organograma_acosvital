'use client';

import { useState, useEffect } from 'react';
import { createOrgNode } from '@/lib/orgApi';
import { generateNodeId } from '@/lib/nodeUtils';
import { SECTOR_COLOR_PALETTE, DEFAULT_SECTOR_COLOR } from '@/data/sectorColors';
import type { OrgNode } from '@/types/orgChart';
import styles from './modals.module.css';

interface AddSectorModalProps {
  /** ID do Gerente Geral que será pai deste setor. */
  parentManagerId:   string;
  /** Nome do GG para exibir no título do modal. */
  parentManagerRole: string | undefined;
  setNodes:          React.Dispatch<React.SetStateAction<OrgNode[]>>;
  onClose:           () => void;
  markSyncing:       (id: string) => void;
  unmarkSyncing:     (id: string) => void;
  showToast:         (message: string, type?: 'success' | 'error') => void;
  refreshNodes:      () => Promise<void>;
}

/** Modal para criar um novo setor (nível 2) sob um Gerente Geral. */
export default function AddSectorModal({
  parentManagerId,
  parentManagerRole,
  setNodes,
  onClose,
  markSyncing,
  unmarkSyncing,
  showToast,
  refreshNodes,
}: AddSectorModalProps) {
  const [name,        setName]        = useState('');
  const [sectorColor, setSectorColor] = useState(DEFAULT_SECTOR_COLOR);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit() {
    if (!name.trim()) {
      showToast('Informe o nome do setor.', 'error');
      return;
    }

    const newId = generateNodeId('sector');
    const newSector: OrgNode = {
      id:          newId,
      name,
      role:        'Setor',
      level:       2,
      parentId:    parentManagerId,
      isSector:    true,
      sectorColor,
    };

    // Atualização otimista
    setNodes(prev => [...prev, newSector]);
    onClose();
    markSyncing(newId);

    try {
      await createOrgNode(newSector);
      await refreshNodes();
      showToast('Setor criado!');
    } catch (err) {
      // Reverte o otimismo em caso de erro
      setNodes(prev => prev.filter(n => n.id !== newId));
      showToast(err instanceof Error ? err.message : 'Erro ao criar setor.', 'error');
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
          <h2>Novo setor{parentManagerRole ? ` — ${parentManagerRole}` : ''}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <label className={styles.label}>
          Nome do setor *
          <input
            autoFocus
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Planejamento"
          />
        </label>

        <div className={styles.label}>
          Cor do setor
          <div className={styles.swatches}>
            {SECTOR_COLOR_PALETTE.map(color => (
              <button
                key={color}
                type="button"
                className={`${styles.swatch} ${sectorColor === color ? styles.swatchOn : ''}`}
                style={{ background: color }}
                onClick={() => setSectorColor(color)}
              />
            ))}
            <input
              type="color"
              className={styles.colorInput}
              value={sectorColor}
              onChange={e => setSectorColor(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.modalFoot}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>Criar setor</button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface AddSubSectorModalProps {
  /** ID do setor pai. */
  parentSectorId:    string;
  /** Nome do setor pai para exibir no título. */
  parentSectorName:  string | undefined;
  setNodes:          React.Dispatch<React.SetStateAction<OrgNode[]>>;
  onClose:           () => void;
  markSyncing:       (id: string) => void;
  unmarkSyncing:     (id: string) => void;
  showToast:         (message: string, type?: 'success' | 'error') => void;
  refreshNodes:      () => Promise<void>;
}

/** Modal para criar um sub-setor dentro de um setor existente. */
export function AddSubSectorModal({
  parentSectorId,
  parentSectorName,
  setNodes,
  onClose,
  markSyncing,
  unmarkSyncing,
  showToast,
  refreshNodes,
}: AddSubSectorModalProps) {
  const [name,        setName]        = useState('');
  const [sectorColor, setSectorColor] = useState(DEFAULT_SECTOR_COLOR);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit() {
    if (!name.trim()) {
      showToast('Informe o nome do sub-setor.', 'error');
      return;
    }

    const newId = generateNodeId('subsector');
    const newSubSector: OrgNode = {
      id:          newId,
      name,
      role:        'Sub-setor',
      level:       3,
      parentId:    parentSectorId,
      isSector:    true,
      sectorColor,
    };

    setNodes(prev => [...prev, newSubSector]);
    onClose();
    markSyncing(newId);

    try {
      await createOrgNode(newSubSector);
      await refreshNodes();
      showToast('Sub-setor criado!');
    } catch (err) {
      setNodes(prev => prev.filter(n => n.id !== newId));
      showToast(err instanceof Error ? err.message : 'Erro ao criar sub-setor.', 'error');
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
          <h2>Novo sub-setor{parentSectorName ? ` — ${parentSectorName}` : ''}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <label className={styles.label}>
          Nome do sub-setor *
          <input
            autoFocus
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Montagem"
          />
        </label>

        <div className={styles.label}>
          Cor do sub-setor
          <div className={styles.swatches}>
            {SECTOR_COLOR_PALETTE.map(color => (
              <button
                key={color}
                type="button"
                className={`${styles.swatch} ${sectorColor === color ? styles.swatchOn : ''}`}
                style={{ background: color }}
                onClick={() => setSectorColor(color)}
              />
            ))}
            <input
              type="color"
              className={styles.colorInput}
              value={sectorColor}
              onChange={e => setSectorColor(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.modalFoot}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary}>Criar sub-setor</button>
        </div>
      </form>
    </div>
  );
}
