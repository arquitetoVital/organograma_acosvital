'use client';

import { useState, useEffect } from 'react';
import GlobeExplorer from '@/components/Globe/GlobeExplorer';
import type { ApiCliente, ClientPoint } from '@/types/client';
import { toClientPoint } from '@/types/client';

function buildPoints(clientes: ApiCliente[]): ClientPoint[] {
  return clientes
    .filter(c => c.latitude_y != null && c.longitude_x != null)
    .map(c => toClientPoint(c, Number(c.latitude_y), Number(c.longitude_x)));
}

export default function ClientesView() {
  const [points,  setPoints]  = useState<ClientPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/clientes-mapa')
      .then(r => r.json())
      .then((json: { clientes: ApiCliente[] }) => {
        if (!cancelled) setPoints(buildPoints(json.clientes ?? []));
      })
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
    />
  );
}
