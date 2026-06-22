'use client';

import { useState, useEffect, useRef } from 'react';
import GlobeExplorer from '@/components/Globe/GlobeExplorer';
import { ClientPoint, OmieClient, fromOmie } from '@/types/client';

const STORAGE_KEY = 'vital-clients-v2';

function loadFromStorage(): ClientPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ClientPoint[];
  } catch {}
  return [];
}

export default function ClientesView() {
  const [clients, setClients] = useState<ClientPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const stored = loadFromStorage();
    if (stored.length > 0) setClients(stored);

    setLoading(true);
    fetch('/data/clients.json')
      .then((r) => (r.ok ? (r.json() as Promise<OmieClient[]>) : Promise.reject()))
      .then((data) => {
        setClients((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newOnes = data.map(fromOmie).filter((c) => !existingIds.has(c.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <GlobeExplorer
      points={clients}
      theme="vital"
      loading={loading}
      itemLabel={{ singular: 'cliente', plural: 'clientes' }}
      loadingText="Carregando clientes…"
    />
  );
}
