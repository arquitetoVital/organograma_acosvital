'use client';

import { useState, useEffect, useRef } from 'react';
import GlobeExplorer from '@/components/Globe/GlobeExplorer';
import { ClientPoint } from '@/types/client';

const STORAGE_KEY = 'vital-units-v1';

interface RawUnit {
  codigo_omie: number;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
}

function rawToPoint(u: RawUnit): ClientPoint {
  return { id: u.codigo_omie, codigo_omie: u.codigo_omie, nome: u.nome, endereco: u.endereco, lat: u.latitude, lon: u.longitude, source: 'file' };
}

function loadFromStorage(): ClientPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ClientPoint[];
  } catch {}
  return [];
}

export default function UnidadesView() {
  const [units, setUnits] = useState<ClientPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const stored = loadFromStorage();
    if (stored.length > 0) setUnits(stored);

    setLoading(true);
    fetch('/data/units.json')
      .then((r) => (r.ok ? (r.json() as Promise<RawUnit[]>) : Promise.reject()))
      .then((data) => {
        setUnits((prev) => {
          const existingIds = new Set(prev.map((u) => u.id));
          const newOnes = data.map(rawToPoint).filter((u) => !existingIds.has(u.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <GlobeExplorer
      points={units}
      theme="hub"
      loading={loading}
      itemLabel={{ singular: 'unidade', plural: 'unidades' }}
      loadingText="Carregando unidades…"
    />
  );
}
