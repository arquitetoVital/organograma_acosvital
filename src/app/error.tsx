'use client';

import { useEffect } from 'react';

interface ErrorPageProps {
  error:  Error & { digest?: string };
  reset:  () => void;
}

/**
 * Boundary de erro global da aplicação.
 * Captura erros não tratados em qualquer página e exibe uma tela de recuperação.
 */
export default function GlobalErrorBoundary({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '100vh',
      gap:            16,
      background:     '#0f172a',
      color:          '#e2e8f0',
      fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding:        '0 24px',
      textAlign:      'center',
    }}>
      <span style={{ fontSize: 40 }}>⚠️</span>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Algo deu errado</h2>
      <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 400, margin: 0 }}>
        Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato com o suporte se o problema persistir.
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
          padding:      '10px 24px',
          background:   '#3b82f6',
          color:        '#fff',
          border:       'none',
          borderRadius: 8,
          fontSize:     14,
          fontWeight:   600,
          cursor:       'pointer',
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
