'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import GlobePanel, { type RegionFilter } from '@/components/Globe/GlobePanel';
import type { DotGroup } from '@/components/Globe/GlobeCanvasThree';
import { type ClientPoint, fromOmie, type OmieClient, toGlobePoint } from '@/types/client';
import { regionFromAddress, type RegionKey } from '@/lib/regions';
import styles from './GlobeLab.module.css';

// Ambos os motores compartilham EXATAMENTE o mesmo contrato de Props — é o que
// prova que o novo é "drop-in" do antigo.
const GlobeCanvas2D = dynamic(() => import('@/components/Globe/GlobeCanvas'), { ssr: false });
const GlobeCanvas3D = dynamic(() => import('@/components/Globe/GlobeCanvasThree'), { ssr: false });

type Dataset = 'clientes' | 'unidades';
type Engine = '2d' | '3d';

interface RawPoint {
  codigo_omie: number;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
}

function rawToPoint(u: RawPoint): ClientPoint {
  return {
    id: u.codigo_omie,
    codigo_omie: u.codigo_omie,
    nome: u.nome,
    endereco: u.endereco,
    lat: u.latitude,
    lon: u.longitude,
    source: 'file',
  };
}

export default function GlobeLab() {
  const [dataset, setDataset] = useState<Dataset>('clientes');
  const [engine, setEngine] = useState<Engine>('3d');

  const [clients, setClients] = useState<ClientPoint[]>([]);
  const [units, setUnits] = useState<ClientPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState<RegionFilter>('ALL');
  const [query, setQuery] = useState('');
  const [panelOpen, setPanel] = useState(true);
  const [focus, setFocus] = useState<{ lat: number; lon: number; nonce: number } | null>(null);
  const [selected, setSelected] = useState<ClientPoint | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/data/clients.json').then((r) => (r.ok ? (r.json() as Promise<OmieClient[]>) : [])),
      fetch('/data/units.json').then((r) => (r.ok ? (r.json() as Promise<RawPoint[]>) : [])),
    ])
      .then(([c, u]) => {
        setClients((c as OmieClient[]).map(fromOmie));
        setUnits((u as RawPoint[]).map(rawToPoint));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const theme = dataset === 'clientes' ? 'vital' : 'hub';
  const accent = theme === 'vital' ? '#ef4444' : '#f97316';
  const points = dataset === 'clientes' ? clients : units;
  const itemLabel =
    dataset === 'clientes'
      ? { singular: 'cliente', plural: 'clientes' }
      : { singular: 'unidade', plural: 'unidades' };

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

  const handleSelect = useCallback((p: ClientPoint) => {
    setFocus({ lat: p.lat, lon: p.lon, nonce: Date.now() });
    setSelected(p);
  }, []);

  const handlePointClick = useCallback(
    (group: DotGroup) => {
      const clicked = group.ids
        .map((id) => points.find((p) => p.id === id))
        .filter(Boolean) as ClientPoint[];
      if (clicked.length > 0) {
        if (!panelOpen) setPanel(true);
        handleSelect(clicked[0]);
      }
    },
    [points, handleSelect, panelOpen],
  );

  const togglePanel = () => {
    if (panelOpen) setSelected(null);
    setPanel((o) => !o);
  };

  // troca de dataset zera o estado de seleção/filtro
  const switchDataset = (d: Dataset) => {
    setDataset(d);
    setRegion('ALL');
    setQuery('');
    setSelected(null);
    setFocus(null);
  };

  const focusedId = panelOpen && selected ? selected.id : null;
  const Canvas = engine === '3d' ? GlobeCanvas3D : GlobeCanvas2D;

  return (
    <div className={styles.page}>
      {/* Barra de laboratório */}
      <div className={styles.labBar}>
        <span className={styles.labTag}>Globe Lab</span>

        <div className={styles.segmented}>
          <button
            className={engine === '3d' ? styles.segActive : styles.seg}
            onClick={() => setEngine('3d')}
          >
            Three.js (novo)
          </button>
          <button
            className={engine === '2d' ? styles.segActive : styles.seg}
            onClick={() => setEngine('2d')}
          >
            Canvas 2D (atual)
          </button>
        </div>

        <div className={styles.segmented}>
          <button
            className={dataset === 'clientes' ? styles.segActive : styles.seg}
            onClick={() => switchDataset('clientes')}
          >
            Clientes · {clients.length}
          </button>
          <button
            className={dataset === 'unidades' ? styles.segActive : styles.seg}
            onClick={() => switchDataset('unidades')}
          >
            Unidades · {units.length}
          </button>
        </div>

        <span className={styles.hint}>
          Comparação lado a lado — o de produção segue intacto em /clientes e /unidades.
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.globeArea}>
          {/* key força recriar a cena ao trocar de motor/tema */}
          <Canvas
            key={`${engine}-${theme}`}
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
              Carregando dados…
            </div>
          )}

          <button
            type="button"
            className={styles.panelToggle}
            style={{ background: accent }}
            onClick={togglePanel}
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
    </div>
  );
}
