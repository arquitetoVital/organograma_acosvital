'use client';

import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error';

export interface ToastState {
  message: string;
  type:    ToastType;
}

export interface UseToastReturn {
  toast:     ToastState | null;
  showToast: (message: string, type?: ToastType) => void;
}

const TOAST_DURATION_MS = 3200;

/**
 * Gerencia o estado de uma notificação toast temporária.
 * O toast desaparece automaticamente após TOAST_DURATION_MS milissegundos.
 */
export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  return { toast, showToast };
}
