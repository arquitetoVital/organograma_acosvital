'use client';

import { useEffect, useCallback } from 'react';
import { ClientPoint } from '@/types/client';
import styles from './ClientModal.module.css';

interface Props {
  clients: ClientPoint[];
  onClose: () => void;
}

export default function ClientModal({ clients, onClose }: Props) {
  // Close on Escape
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (clients.length === 0) return null;

  const isGroup = clients.length > 1;
  const ref = clients[0];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13"/>
            <line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
        </button>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerTag}>
            {isGroup ? `${clients.length} clientes neste local` : 'Cliente'}
          </span>
          {!isGroup && <h2 className={styles.headerName}>{ref.nome}</h2>}
          {isGroup && (
            <h2 className={styles.headerName}>
              {clients.length} empresas no mesmo endereço
            </h2>
          )}
        </div>

        {/* Single client details */}
        {!isGroup && (
          <div className={styles.details}>
            {ref.endereco && (
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C5.24 0 3 2.24 3 5c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 8 3.5a1.5 1.5 0 0 1 0 3z"/>
                  </svg>
                </span>
                <span className={styles.detailText}>{ref.endereco}</span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailIcon}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.2"/>
                  <ellipse cx="8" cy="8" rx="3.5" ry="7" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                </svg>
              </span>
              <span className={styles.detailCoord}>
                {ref.lat.toFixed(6)}°, {ref.lon.toFixed(6)}°
              </span>
            </div>
            {ref.codigo_omie !== ref.id || ref.source === 'file' ? (
              <div className={styles.detailRow}>
                <span className={styles.detailIcon}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 2h5l2 2h5v10H2V2zm0 0"/>
                  </svg>
                </span>
                <span className={styles.detailMeta}>
                  Cód. Omie: <strong>{ref.codigo_omie}</strong>
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* Group list */}
        {isGroup && (
          <div className={styles.groupList}>
            {/* Shared address/coords from first item */}
            {ref.endereco && (
              <div className={styles.groupLocation}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C5.24 0 3 2.24 3 5c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.5A1.5 1.5 0 1 1 8 3.5a1.5 1.5 0 0 1 0 3z"/>
                </svg>
                {ref.endereco}
              </div>
            )}
            <div className={styles.groupCoord}>
              {ref.lat.toFixed(5)}°, {ref.lon.toFixed(5)}°
            </div>

            <div className={styles.groupDivider} />

            {/* Client list */}
            <div className={styles.groupScroll}>
              {clients.map((c, i) => (
                <div key={c.id} className={styles.groupItem}>
                  <div className={styles.groupItemNum}>{i + 1}</div>
                  <div className={styles.groupItemBody}>
                    <div className={styles.groupItemName}>{c.nome}</div>
                    {c.source === 'file' && (
                      <div className={styles.groupItemMeta}>Cód. Omie: {c.codigo_omie}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer coords strip */}
        <div className={styles.footer}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style={{opacity:0.45}}>
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          <span>{ref.lat.toFixed(4)}° / {ref.lon.toFixed(4)}°</span>
        </div>
      </div>
    </div>
  );
}
