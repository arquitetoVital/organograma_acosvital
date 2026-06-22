'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut } from '@/app/login/actions';
import { LOGO_URL } from '@/lib/constants';
import styles from './page.module.css';

export default function PageHeader({ isAdmin }: { isAdmin: boolean }) {
  const [isFs, setIsFs] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enterFs = useCallback(async () => {
    try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch {}
  }, []);

  const exitFs = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
  }, []);

  async function handleSignOut() {
    setPending(true);
    await signOut();
  }

  /* ── Modo tela cheia: sem header, só logo + pill de saída ── */
  if (isFs) {
    return (
      <>
        <img src={LOGO_URL} alt="Acos Vital" className={styles.fsLogo} />
        <div className={styles.fsPill}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <rect x="3" y="5.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4.5 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Tela travada
          <button onClick={exitFs} className={styles.fsPillExit} title="Sair da tela cheia">✕</button>
        </div>
      </>
    );
  }

  /* ── Header normal ── */
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img src={LOGO_URL} alt="Acos Vital" className={styles.brandLogo} />
      </div>
      <h1 className={styles.title}>Organograma</h1>
      <div className={styles.headerActions}>
        {isAdmin && (
          <a href="/admin" className={styles.adminLink}>⚙ Administrar</a>
        )}
        <button onClick={enterFs} className={styles.actionBtn} title="Tela cheia">
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path d="M1 5V1h4M10 1h4v4M14 10v4h-4M5 14H1v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tela cheia
        </button>
        <button onClick={handleSignOut} disabled={pending} className={styles.actionBtn}>
          {pending ? '…' : 'Sair da conta'}
        </button>
      </div>
    </header>
  );
}
