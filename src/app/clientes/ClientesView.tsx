'use client';

import { useState, useEffect } from 'react';
import GlobeExplorer from '@/components/Globe/GlobeExplorer';
import type { ApiCliente, ClientPoint } from '@/types/client';
import { toClientPoint } from '@/types/client';
import { cachedFetch, isCacheHit, CACHE_KEYS, CACHE_TTL } from '@/lib/dataCache';

function buildPoints(clientes: ApiCliente[]): ClientPoint[] {
  return clientes
    .filter(c => c.latitude_y != null && c.longitude_x != null)
    .map(c => toClientPoint(c, Number(c.latitude_y), Number(c.longitude_x)));
}

interface ClientesViewProps {
  canViewDetails?: boolean;
}

export default function ClientesView({ canViewDetails = false }: ClientesViewProps) {
  const [points,  setPoints]  = useState<ClientPoint[]>([]);
  // Sem spinner se cache estiver quente — dado aparece instantaneamente
  const [loading, setLoading] = useState(
    () => !isCacheHit(CACHE_KEYS.CLIENTES, CACHE_TTL.LONG),
  );

  useEffect(() => {
    let cancelled = false;

    cachedFetch<{ clientes: ApiCliente[] }>(
      CACHE_KEYS.CLIENTES,
      () => fetch('/api/clientes-mapa').then(r => r.json()),
      CACHE_TTL.LONG,
    )
      .then(json => { if (!cancelled) setPoints(buildPoints(json.clientes ?? [])); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <GlobeExplorer
      points={points}
      theme="vital"
      loading={loading}
      itemLabel={{ singular: 'cliente', plural: 'clientes' }}
      loadingText="Carregando clientes…"
      readOnly={!canViewDetails}
    />
  );
}
