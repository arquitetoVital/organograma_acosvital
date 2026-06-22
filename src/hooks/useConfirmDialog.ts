'use client';

import { useState, useCallback } from 'react';

export interface ConfirmDialogConfig {
  title:     string;
  message:   string;
  onConfirm: () => void;
}

export interface UseConfirmDialogReturn {
  confirmDialog:  ConfirmDialogConfig | null;
  openConfirmDialog:  (config: ConfirmDialogConfig) => void;
  closeConfirmDialog: () => void;
}

/**
 * Controla o estado do diálogo de confirmação destrutiva (ex.: exclusão).
 * Separa a lógica de "o que confirmar" do componente que renderiza o diálogo.
 */
export function useConfirmDialog(): UseConfirmDialogReturn {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);

  const openConfirmDialog  = useCallback((config: ConfirmDialogConfig) => setConfirmDialog(config), []);
  const closeConfirmDialog = useCallback(() => setConfirmDialog(null), []);

  return { confirmDialog, openConfirmDialog, closeConfirmDialog };
}
