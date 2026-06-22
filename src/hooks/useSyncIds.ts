'use client';

import { useState, useCallback } from 'react';

export interface UseSyncIdsReturn {
  /** IDs de nós cujos dados estão sendo enviados ao servidor (spinner visual). */
  syncingIds:    Set<string>;
  /** IDs de nós que estão sendo excluídos (estilo "deletando"). */
  deletingIds:   Set<string>;
  markSyncing:   (id: string) => void;
  unmarkSyncing: (id: string) => void;
  markDeleting:  (id: string) => void;
  unmarkDeleting:(id: string) => void;
}

/**
 * Rastreia quais nós estão em processo de sincronização ou exclusão,
 * para exibir indicadores visuais de progresso na UI.
 */
export function useSyncIds(): UseSyncIdsReturn {
  const [syncingIds,  setSyncingIds]  = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const markSyncing   = useCallback((id: string) => setSyncingIds(prev => new Set([...prev, id])), []);
  const unmarkSyncing = useCallback((id: string) => setSyncingIds(prev => { const s = new Set(prev); s.delete(id); return s; }), []);
  const markDeleting  = useCallback((id: string) => setDeletingIds(prev => new Set([...prev, id])), []);
  const unmarkDeleting= useCallback((id: string) => setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; }), []);

  return { syncingIds, deletingIds, markSyncing, unmarkSyncing, markDeleting, unmarkDeleting };
}
