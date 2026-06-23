'use client';

import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import Avatar from '@/components/ui/Avatar';
import { createOrgNode, updateOrgNode } from '@/lib/orgApi';
import { generateNodeId } from '@/lib/nodeUtils';
import { levelNames, levelColors } from '@/data/orgData';
import type { OrgNode } from '@/types/orgChart';
import styles from './modals.module.css';

interface PersonModalProps {
  /**
   * Setor ao qual a nova pessoa será adicionada.
   * Null quando editando uma pessoa existente (usa o parentId dela).
   */
  targetSectorId:    string | null;
  /** Nó sendo editado. Null no modo de criação. */
  personBeingEdited: OrgNode | null;
  allNodes:          OrgNode[];
  nodeMap:           Map<string, OrgNode>;
  onClose:           () => void;
  setNodes:          Dispatch<SetStateAction<OrgNode[]>>;
  markSyncing:       (id: string) => void;
  unmarkSyncing:     (id: string) => void;
  showToast:         (message: string, type?: 'success' | 'error') => void;
  refreshNodes:      () => Promise<void>;
}

interface PersonFormState {
  name:     string;
  role:     string;
  photoUrl: string;
  level:    number;
  parentId: string;
}

/**
 * Modal para criar ou editar uma pessoa dentro de um setor.
 * Calcula automaticamente os pais elegíveis com base no nível hierárquico escolhido.
 */
export default function PersonModal({
  targetSectorId,
  personBeingEdited,
  allNodes,
  nodeMap,
  onClose,
  setNodes,
  markSyncing,
  unmarkSyncing,
  showToast,
  refreshNodes,
}: PersonModalProps) {
  const sectorNode = targetSectorId ? nodeMap.get(targetSectorId) : null;

  // Pessoas sempre começam no nível 4 (Diretor de Setor) independente do setor pai
  const minimumPersonLevel = 4;

  // Todos os nós que pertencem à subárvore do setor alvo
  const sectorSubtree = useMemo(() => {
    if (!targetSectorId) return allNodes;
    const ids = new Set<string>();
    const collect = (id: string) => {
      ids.add(id);
      allNodes.filter(n => n.parentId === id).forEach(child => collect(child.id));
    };
    collect(targetSectorId);
    return allNodes.filter(n => ids.has(n.id));
  }, [targetSectorId, allNodes]);

  const [form, setForm] = useState<PersonFormState>({
    name:     personBeingEdited?.name     ?? '',
    role:     personBeingEdited?.role     ?? '',
    photoUrl: personBeingEdited?.photoUrl ?? '',
    level:    personBeingEdited?.level    ?? minimumPersonLevel,
    parentId: personBeingEdited?.parentId ?? (targetSectorId ?? ''),
  });

  // Fecha com Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Nós elegíveis para ser pai, baseado no nível selecionado. */
  const eligibleParents = useMemo((): OrgNode[] => {
    const fallback = sectorNode ? [sectorNode] : [];
    if (form.level === minimumPersonLevel) return fallback;

    const candidates = sectorSubtree
      .filter(n => n.level < form.level && !n.isSector)
      .sort((a, b) => a.level - b.level);

    return candidates.length > 0 ? candidates : fallback;
  }, [form.level, sectorSubtree, sectorNode, minimumPersonLevel]);

  function changeLevel(newLevel: number) {
    const fallback = sectorNode ? [sectorNode] : [];
    const candidates = newLevel === minimumPersonLevel
      ? fallback
      : sectorSubtree.filter(n => n.level < newLevel && !n.isSector).sort((a, b) => a.level - b.level);

    const resolvedParents = candidates.length > 0 ? candidates : fallback;
    setForm(f => ({ ...f, level: newLevel, parentId: resolvedParents[0]?.id ?? '' }));
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.role.trim() || !form.parentId) {
      showToast('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const nodeId = personBeingEdited ? personBeingEdited.id : generateNodeId('person');

    // Atualização otimista — reflete na UI antes da resposta do servidor
    if (personBeingEdited) {
      setNodes(prev => prev.map(n =>
        n.id === personBeingEdited.id
          ? { ...n, ...form, photoUrl: form.photoUrl || undefined }
          : n
      ));
    } else {
      const optimisticNode: OrgNode = {
        id:       nodeId,
        name:     form.name,
        role:     form.role,
        photoUrl: form.photoUrl || undefined,
        level:    form.level,
        parentId: form.parentId,
      };
      setNodes(prev => [...prev, optimisticNode]);
    }

    onClose();
    markSyncing(nodeId);

    try {
      if (personBeingEdited) {
        await updateOrgNode(personBeingEdited.id, {
          name:     form.name,
          role:     form.role,
          photoUrl: form.photoUrl,
          level:    form.level,
          parentId: form.parentId,
        });
      } else {
        await createOrgNode({
          id:       nodeId,
          name:     form.name,
          role:     form.role,
          photoUrl: form.photoUrl,
          level:    form.level,
          parentId: form.parentId,
        });
      }
      await refreshNodes();
      showToast(personBeingEdited ? 'Pessoa atualizada!' : 'Pessoa adicionada!');
    } catch (err) {
      await refreshNodes();
      showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
    } finally {
      unmarkSyncing(nodeId);
    }
  }

  const sectorLabel = sectorNode?.name || sectorNode?.role;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        <div className={styles.modalHead}>
          <h2>
            {personBeingEdited
              ? 'Editar pessoa'
              : `Adicionar pessoa${sectorLabel ? ` — ${sectorLabel}` : ''}`}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalAvatarRow}>
          <Avatar photoUrl={form.photoUrl} name={form.name} size={72} color={levelColors[form.level]} />
        </div>

        <div className={styles.modalGrid}>
          <label className={styles.label}>
            Nome completo *
            <input
              autoFocus
              className={styles.input}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: João da Silva"
            />
          </label>

          <label className={styles.label}>
            Cargo *
            <input
              className={styles.input}
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              placeholder="Ex: Coordenador de Produção"
            />
          </label>

          <label className={`${styles.label} ${styles.span2}`}>
            URL da foto
            <input
              className={styles.input}
              value={form.photoUrl}
              onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
              placeholder="https://…"
            />
          </label>

          <label className={styles.label}>
            Nível hierárquico *
            <select
              className={styles.select}
              value={form.level}
              onChange={e => changeLevel(Number(e.target.value))}
            >
              {Array.from({ length: 12 - minimumPersonLevel }, (_, i) => i + minimumPersonLevel).map(lvl => (
                <option key={lvl} value={lvl}>{lvl} — {levelNames[lvl]}</option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Reporta a *
            <select
              className={styles.select}
              value={form.parentId}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
            >
              <option value="">— selecione —</option>
              {eligibleParents.map(parent => (
                <option key={parent.id} value={parent.id}>
                  {parent.name || parent.role}
                  {!parent.isSector ? ` — ${levelNames[parent.level] ?? `Nível ${parent.level}`}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.modalFoot}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={styles.btnPrimary}>
            {personBeingEdited ? 'Salvar alterações' : 'Adicionar pessoa'}
          </button>
        </div>
      </form>
    </div>
  );
}
