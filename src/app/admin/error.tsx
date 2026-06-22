'use client';

import { useEffect } from 'react';

interface AdminErrorProps {
  error:  Error & { digest?: string };
  reset:  () => void;
}

/**
 * Boundary de erro específico para a área administrativa.
 * Mantém a sidebar visível e limita o impacto ao conteúdo da página.
 */
export default function AdminErrorBoundary({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error('[AdminError]', error);
  }, [error]);

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '100%',
      gap:            12,
      background:     '#0f172a',
      color:          '#e2e8f0',
      fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding:        '0 24px',
      textAlign:      'center',
    }}>
      <span style={{ fontSize: 36 }}>⚠️</span>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Erro na área administrativa</h2>
      <p style={{ fontSize: 13, color: '#94a3b8', maxWidth: 380, margin: 0 }}>
        Não foi possível carregar esta seção. Verifique sua conexão e tente novamente.
      </p>
      {error.digest && (
        <code style={{ fontSize: 11, color: '#475569', background: '#1e293b', padding: '4px 8px', borderRadius: 4 }}>
          ref: {error.digest}
        </code>
      )}
      <button
        onClick={reset}
        style={{
          marginTop:    8,
          padding:      '9px 22px',
          background:   '#3b82f6',
          color:        '#fff',
          border:       'none',
          borderRadius: 8,
          fontSize:     13,
          fontWeight:   600,
          cursor:       'pointer',
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
