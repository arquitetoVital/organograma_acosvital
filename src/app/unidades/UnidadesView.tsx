'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import GlobeExplorer from '@/components/Globe/GlobeExplorer';
import type { ClientPoint } from '@/types/client';

// ── Tipos da API externa ───────────────────────────────────────────────────────
interface ApiUnidade {
  id:            string;
  nome_fantasia: string;
  razao_social:  string;
  logradouro:    string | null;
  numero:        string | null;
  bairro:        string | null;
  cidade:        string | null;
  estado:        string | null;
  cep:           string | null;
  [k: string]:   unknown;
}

// ── Cache de geocodificação ────────────────────────────────────────────────────
const GEO_CACHE_KEY = 'vital-units-geo-v2';
const GEO_DELAY_MS  = 1150; // Nominatim: máx 1 req/s

type GeoCache = Record<string, { lat: number; lon: number }>;

function loadGeoCache(): GeoCache {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) ?? '{}'); } catch { return {}; }
}
function saveGeoCache(cache: GeoCache) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function buildGeoQuery(u: ApiUnidade): string | null {
  if (!u.cidade && !u.estado) return null;
  const parts: string[] = [];
  if (u.logradouro) {
    parts.push(u.logradouro);
    if (u.numero) parts.push(u.numero);
  }
  if (u.bairro)  parts.push(u.bairro);
  if (u.cidade)  parts.push(u.cidade);
  if (u.estado)  parts.push(u.estado);
  parts.push('Brasil');
  return parts.join(', ');
}

function buildEndereco(u: ApiUnidade): string {
  return [u.cidade, u.estado].filter(Boolean).join(', ');
}

function toPoint(u: ApiUnidade, lat: number, lon: number): ClientPoint {
  return {
    id:      hashCode(u.id),
    codigo:  u.id,
    nome:    u.nome_fantasia || u.razao_social,
    endereco: buildEndereco(u),
    lat,
    lon,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function geocodeAddress(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url  = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

// ── Componente ─────────────────────────────────────────────────────────────────
export default function UnidadesView() {
  const [points,   setPoints]   = useState<ClientPoint[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [geoTotal, setGeoTotal] = useState(0);
  const [geoDone,  setGeoDone]  = useState(0);

  const abortRef = useRef(false);

  const run = useCallback(async () => {
    abortRef.current = false;

    // 1 — Exibe do cache imediatamente
    const cache   = loadGeoCache();
    const initial = Object.entries(cache).map(([id, coords]) => ({
      id:       hashCode(id),
      codigo:   id,
      nome:     '',
      endereco: '',
      lat:      coords.lat,
      lon:      coords.lon,
    } as ClientPoint));
    if (initial.length > 0) setPoints(initial);

    // 2 — Busca lista completa da API
    let unidades: ApiUnidade[] = [];
    try {
      const res  = await fetch('/api/unidades-mapa');
      const json = await res.json() as { unidades: ApiUnidade[] };
      unidades = json.unidades ?? [];
    } catch {
      setLoading(false);
      return;
    }

    // 3 — Separa as já geocodificadas das que precisam
    const cached:   ClientPoint[]  = [];
    const needsGeo: ApiUnidade[]   = [];

    for (const u of unidades) {
      if (cache[u.id]) {
        cached.push(toPoint(u, cache[u.id].lat, cache[u.id].lon));
      } else if (buildGeoQuery(u)) {
        needsGeo.push(u);
      }
    }

    setPoints(cached);
    setLoading(false);

    if (!needsGeo.length) return;

    // 4 — Geocodifica progressivamente
    setGeoTotal(needsGeo.length);
    setGeoDone(0);

    const updatedCache = { ...cache };

    for (let i = 0; i < needsGeo.length; i++) {
      if (abortRef.current) break;

      const u     = needsGeo[i];
      const query = buildGeoQuery(u)!;
      const coords = await geocodeAddress(query);
      setGeoDone(i + 1);

      if (coords) {
        updatedCache[u.id] = coords;
        const newPoint = toPoint(u, coords.lat, coords.lon);

        setPoints(prev => {
          const without = prev.filter(p => p.codigo !== u.id);
          return [...without, newPoint];
        });

        if ((i + 1) % 10 === 0) saveGeoCache(updatedCache);
      }

      if (i < needsGeo.length - 1) await delay(GEO_DELAY_MS);
    }

    saveGeoCache(updatedCache);
    setGeoTotal(0);
    setGeoDone(0);
  }, []);

  useEffect(() => {
    run();
    return () => { abortRef.current = true; };
  }, [run]);

  const pct = geoTotal > 0 ? (geoDone / geoTotal) * 100 : 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GlobeExplorer
        points={points}
        theme="hub"
        loading={loading}
        itemLabel={{ singular: 'unidade', plural: 'unidades' }}
        loadingText="Carregando unidades…"
      />

      {geoTotal > 0 && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(8,14,40,0.90)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 24, padding: '8px 14px 8px 16px',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 12, color: 'rgba(255,255,255,0.75)',
          zIndex: 50, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap', minWidth: 300,
        }}>
          {/* Barra de progresso */}
          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#f97316', borderRadius: 2, transition: 'width .4s ease' }} />
          </div>

          {/* Contagem */}
          <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
            {geoDone.toLocaleString('pt-BR')} / {geoTotal.toLocaleString('pt-BR')}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>geocodificadas</span>

          {/* Botão parar */}
          <button
            type="button"
            onClick={() => { abortRef.current = true; }}
            style={{
              marginLeft: 4, padding: '3px 10px', borderRadius: 12,
              border: '1px solid rgba(249,115,22,0.45)', background: 'rgba(249,115,22,0.12)',
              color: '#f97316', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Parar
          </button>
        </div>
      )}
    </div>
  );
}
