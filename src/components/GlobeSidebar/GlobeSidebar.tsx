'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import GlobeCanvas, { DotGroup } from '@/components/Globe/GlobeCanvas';
import VitalPanel from '@/components/Vital/VitalPanel';
import ClientModal from '@/components/Vital/ClientModal';
import { ClientPoint, ApiCliente, toClientPoint, toGlobePoint } from '@/types/client';
import { cachedFetch, CACHE_KEYS, CACHE_TTL } from '@/lib/dataCache';
import styles from './GlobeSidebar.module.css';

interface Props {
  isAdmin: boolean;
}

export default function GlobeSidebar({ isAdmin }: Props) {
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [clients,      setClients]      = useState<ClientPoint[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modalClients, setModalClients] = useState<ClientPoint[] | null>(null);

  const globePoints = useMemo(() => clients.map(toGlobePoint), [clients]);

  useEffect(() => {
    let cancelled = false;
    cachedFetch<{ clientes: ApiCliente[] }>(
      CACHE_KEYS.CLIENTES,
      () => fetch('/api/clientes-mapa').then(r => r.json()),
      CACHE_TTL.LONG,
    )
      .then(json => {
        if (cancelled) return;
        const pts = (json.clientes ?? [])
          .filter(c => c.latitude_y != null && c.longitude_x != null)
          .map(c => toClientPoint(c, Number(c.latitude_y), Number(c.longitude_x)));
        setClients(pts);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Clique num ponto do globo → abre modal
  const handlePointClick = useCallback((group: DotGroup) => {
    const clicked = group.ids
      .map(id => clients.find(c => c.id === id))
      .filter(Boolean) as ClientPoint[];
    if (clicked.length > 0) setModalClients(clicked);
  }, [clients]);


  return (
    <>
      {/* Botão de abrir/fechar o drawer principal */}
      <button
        className={`${styles.mainToggle} ${sidebarOpen ? styles.mainToggleOpen : ''}`}
        onClick={() => setSidebarOpen(o => !o)}
        title={sidebarOpen ? 'Fechar mapa de clientes' : 'Abrir mapa de clientes'}
        aria-label="Mapa de clientes"
      >
        {sidebarOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        )}
        {!sidebarOpen && <span className={styles.mainToggleLabel}>Clientes</span>}
      </button>

      {/* Drawer que desliza da direita */}
      <div className={`${styles.drawer} ${sidebarOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerInner}>

          {/* Globo ocupa toda a área do drawer */}
          <GlobeCanvas
            points={globePoints}
            theme="vital"
            onPointClick={handlePointClick}
          />

          {/* Badge de carregamento */}
          {loading && (
            <div className={styles.loadingBadge}>
              <span className={styles.loadingDot} />
              Carregando clientes…
            </div>
          )}

          {/* Botão de abrir/fechar o painel de lista */}
          <button
            className={`${styles.panelToggle} ${panelOpen ? styles.panelToggleOpen : ''}`}
            onClick={() => setPanelOpen(o => !o)}
            title={panelOpen ? 'Fechar painel' : 'Gerenciar clientes'}
          >
            {panelOpen ? '✕' : '⊕'}
          </button>

          {/* Painel lateral de clientes (dentro do drawer) */}
          <div className={`${styles.panel} ${panelOpen ? styles.panelOpen : ''}`}>
            <VitalPanel
              clients={clients}
              isAdmin={isAdmin}
              onAdd={() => {}}
              onRemove={() => {}}
              onUpdate={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Modal de detalhes do cliente */}
      {modalClients && (
        <ClientModal
          clients={modalClients}
          onClose={() => setModalClients(null)}
        />
      )}
    </>
  );
}
