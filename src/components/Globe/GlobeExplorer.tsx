'use client';

import { useCallback, useMemo, useState } from 'react';
import GlobeCanvas, { type DotGroup, type GlobeTheme } from '@/components/Globe/GlobeCanvas';
import GlobePanel, { type RegionFilter } from '@/components/Globe/GlobePanel';
import { type ClientPoint, toGlobePoint } from '@/types/client';
import { regionFromAddress, type RegionKey } from '@/lib/regions';
import styles from './GlobeExplorer.module.css';

interface Props {
  points: ClientPoint[];
  theme: GlobeTheme;
  loading: boolean;
  itemLabel: { singular: string; plural: string };
  loadingText: string;
}

/**
 * Explorador de globo reutilizável: globo + painel lateral pesquisável com
 * filtro por região, distribuição e "voar até" sincronizado.
 */
export default function GlobeExplorer({ points, theme, loading, itemLabel, loadingText }: Props) {
  const [region, setRegion]   = useState<RegionFilter>('ALL');
  const [query, setQuery]     = useState('');
  const [panelOpen, setPanel] = useState(true);
  const [focus, setFocus]     = useState<{ lat: number; lon: number; nonce: number } | null>(null);
  const [selected, setSelected] = useState<ClientPoint | null>(null);

  const accent = theme === 'vital' ? '#ef4444' : '#f97316';

  // Região de cada ponto (memoizada por id de endereço).
  const regionOf = useMemo(() => {
    const m = new Map<number, RegionKey>();
    for (const p of points) m.set(p.id, regionFromAddress(p.endereco));
    return m;
  }, [points]);

  const regionCounts = useMemo(() => {
    const c: Record<RegionKey, number> = { N: 0, NE: 0, CO: 0, SE: 0, S: 0, OUT: 0 };
    for (const p of points) c[regionOf.get(p.id) ?? 'OUT']++;
    return c;
  }, [points, regionOf]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return points.filter((p) => {
      if (region !== 'ALL' && regionOf.get(p.id) !== region) return false;
      if (q && !`${p.nome} ${p.endereco}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [points, region, query, regionOf]);

  const globePoints = useMemo(() => visible.map(toGlobePoint), [visible]);

  // Clique na lista (ou no marcador): voa/aproxima/destaca o ponto, esmaece os
  // demais e abre a página de detalhes da empresa no painel — pausando o mapa
  // (sem modal cobrindo o globo).
  const handleSelect = useCallback((p: ClientPoint) => {
    setFocus({ lat: p.lat, lon: p.lon, nonce: Date.now() });
    setSelected(p);
  }, []);

  // Clique na marcação vermelha: seleciona a empresa no painel em vez de abrir
  // um modal. Em grupos com várias empresas, foca a primeira.
  const handlePointClick = useCallback((group: DotGroup) => {
    const clicked = group.ids
      .map((id) => points.find((p) => p.id === id))
      .filter(Boolean) as ClientPoint[];
    if (clicked.length > 0) {
      if (!panelOpen) setPanel(true);
      handleSelect(clicked[0]);
    }
  }, [points, handleSelect, panelOpen]);

  const togglePanel = () => {
    if (panelOpen) setSelected(null); // fechando → limpa detalhe e esmaecimento
    setPanel((o) => !o);
  };

  // Esmaece as demais marcações apenas quando o painel está aberto numa empresa.
  const focusedId = panelOpen && selected ? selected.id : null;

  return (
    <div className={styles.page}>
      <div className={styles.globeArea}>
        <GlobeCanvas
          points={globePoints}
          theme={theme}
          onPointClick={handlePointClick}
          focusTarget={focus}
          focusedId={focusedId}
          hideInfoOverlays
        />

        {loading && (
          <div className={styles.loadingBadge}>
            <span className={styles.loadingDot} />
            {loadingText}
          </div>
        )}

        <button
          type="button"
          className={styles.panelToggle}
          style={{ background: accent }}
          onClick={togglePanel}
          aria-label={panelOpen ? 'Ocultar painel' : 'Mostrar painel'}
          title={panelOpen ? 'Ocultar painel' : 'Mostrar painel'}
        >
          {panelOpen ? '›' : '‹'}
        </button>
      </div>

      {panelOpen && (
        <GlobePanel
          itemLabel={itemLabel}
          total={points.length}
          visible={visible}
          regionCounts={regionCounts}
          activeRegion={region}
          onRegion={setRegion}
          query={query}
          onQuery={setQuery}
          onSelect={handleSelect}
          accent={accent}
          selected={selected}
          onBack={() => setSelected(null)}
          onFocus={(p) => setFocus({ lat: p.lat, lon: p.lon, nonce: Date.now() })}
        />
      )}
    </div>
  );
}
