'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ClientPoint } from '@/types/client';
import styles from '../management.module.css';

const STORAGE_KEY = 'vital-units-v1';
const DOT = '#10b981';

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

function load(): ClientPoint[] {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function save(list: ClientPoint[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch { return null; }
}

export default function UnidadesAdmin() {
  const [units,    setUnits]    = useState<ClientPoint[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [toast,    setToast]    = useState<{ msg: string; err?: boolean } | null>(null);

  // Add form
  const [addNome,   setAddNome]   = useState('');
  const [addAddr,   setAddAddr]   = useState('');
  const [addLat,    setAddLat]    = useState('');
  const [addLon,    setAddLon]    = useState('');
  const [geoOk,     setGeoOk]     = useState(false);
  const [geoErr,    setGeoErr]    = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Inline edit
  const [editId,   setEditId]   = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editAddr, setEditAddr] = useState('');
  const [editLat,  setEditLat]  = useState('');
  const [editLon,  setEditLon]  = useState('');

  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const stored = load();
    if (stored.length > 0) setUnits(stored);
    fetch('/data/units.json')
      .then(r => r.ok ? r.json() as Promise<RawUnit[]> : Promise.reject())
      .then(data => {
        setUnits(prev => {
          const ids = new Set(prev.map(u => u.id));
          const fresh = data.map(rawToPoint).filter(u => !ids.has(u.id));
          const merged = fresh.length > 0 ? [...prev, ...fresh] : prev;
          save(merged);
          return merged;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return units;
    const q = search.toLowerCase();
    return units.filter(u =>
      u.nome.toLowerCase().includes(q) || u.endereco.toLowerCase().includes(q)
    );
  }, [units, search]);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleGeocode() {
    if (!addAddr.trim()) return;
    setGeocoding(true); setGeoErr(''); setGeoOk(false);
    const r = await geocode(addAddr);
    setGeocoding(false);
    if (!r) { setGeoErr('Endereço não encontrado. Tente ser mais específico.'); return; }
    setAddLat(r.lat.toFixed(6));
    setAddLon(r.lon.toFixed(6));
    setGeoOk(true);
  }

  function handleAdd() {
    const nome = addNome.trim();
    const addr = addAddr.trim();
    const lat  = parseFloat(addLat);
    const lon  = parseFloat(addLon);
    if (!nome || !addr) { showToast('Nome e endereço são obrigatórios.', true); return; }
    if (isNaN(lat) || isNaN(lon)) { showToast('Use o botão Geo ou preencha lat/lon.', true); return; }
    const id = Date.now();
    const newUnit: ClientPoint = { id, codigo_omie: id, nome, endereco: addr, lat, lon, source: 'manual' };
    setUnits(prev => { const n = [...prev, newUnit]; save(n); return n; });
    setAddNome(''); setAddAddr(''); setAddLat(''); setAddLon(''); setGeoOk(false); setGeoErr('');
    showToast('Unidade adicionada.');
  }

  function handleDelete(id: number) {
    setUnits(prev => { const n = prev.filter(u => u.id !== id); save(n); return n; });
    if (editId === id) setEditId(null);
    showToast('Unidade removida.');
  }

  function startEdit(u: ClientPoint) {
    setEditId(u.id);
    setEditNome(u.nome);
    setEditAddr(u.endereco);
    setEditLat(String(u.lat));
    setEditLon(String(u.lon));
  }

  function handleSaveEdit() {
    if (editId === null) return;
    const nome = editNome.trim();
    const addr = editAddr.trim();
    const lat  = parseFloat(editLat);
    const lon  = parseFloat(editLon);
    if (!nome || !addr || isNaN(lat) || isNaN(lon)) {
      showToast('Preencha todos os campos corretamente.', true); return;
    }
    setUnits(prev => {
      const n = prev.map(u => u.id === editId ? { ...u, nome, endereco: addr, lat, lon } : u);
      save(n); return n;
    });
    setEditId(null);
    showToast('Unidade atualizada.');
  }

  return (
    <div className={styles.page}>
      {/* Body */}
      <div className={styles.body}>
        {/* Add panel */}
        <div className={styles.addPanel}>
          <div className={styles.sectionTitle}>Adicionar nova unidade</div>

          <label className={styles.fieldLabel}>
            Nome da unidade *
            <input
              className={styles.input}
              placeholder="Ex: Filial São Paulo"
              value={addNome}
              onChange={e => setAddNome(e.target.value)}
            />
          </label>

          <label className={styles.fieldLabel}>
            Endereço *
            <div className={styles.addressRow}>
              <input
                className={`${styles.input} ${styles.addressInput}`}
                placeholder="Rua, cidade, estado…"
                value={addAddr}
                onChange={e => { setAddAddr(e.target.value); setGeoOk(false); setGeoErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleGeocode()}
              />
              <button
                className={`${styles.geoBtn}${geoOk ? ' ' + styles.geoBtnOk : ''}`}
                onClick={handleGeocode}
                disabled={geocoding || !addAddr.trim()}
              >
                {geocoding ? '…' : geoOk ? '✓ Geo' : 'Geo'}
              </button>
            </div>
            {geoErr && <span className={styles.geoError}>{geoErr}</span>}
          </label>

          <div className={styles.coordRow}>
            <label className={styles.fieldLabel}>
              Latitude
              <input className={styles.input} placeholder="-23.550" value={addLat} onChange={e => setAddLat(e.target.value)} />
            </label>
            <label className={styles.fieldLabel}>
              Longitude
              <input className={styles.input} placeholder="-46.633" value={addLon} onChange={e => setAddLon(e.target.value)} />
            </label>
          </div>

          <button className={styles.btnPrimary} onClick={handleAdd}>
            + Adicionar unidade
          </button>
        </div>

        {/* List panel */}
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div className={styles.statsChip}>
              <span className={styles.statsNum}>{units.length}</span>
              <span className={styles.statsLabel}>unidades</span>
            </div>
            <input
              className={styles.searchInput}
              placeholder="Buscar unidade ou endereço…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.list}>
            {loading && <div className={styles.loadingState}>Carregando…</div>}
            {!loading && filtered.length === 0 && (
              <div className={styles.emptyState}>
                {search ? 'Nenhum resultado.' : 'Nenhuma unidade ainda.'}
              </div>
            )}
            {filtered.map(u =>
              editId === u.id ? (
                <div key={u.id} className={`${styles.row} ${styles.rowEditing}`}>
                  <div className={styles.dot} style={{ background: DOT }} />
                  <div className={styles.editForm}>
                    <input className={styles.input} value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome" />
                    <input className={styles.input} value={editAddr} onChange={e => setEditAddr(e.target.value)} placeholder="Endereço" />
                    <div className={styles.editCoords}>
                      <input className={styles.input} value={editLat} onChange={e => setEditLat(e.target.value)} placeholder="Lat" />
                      <input className={styles.input} value={editLon} onChange={e => setEditLon(e.target.value)} placeholder="Lon" />
                    </div>
                    <div className={styles.editActions}>
                      <button className={styles.btnSave} onClick={handleSaveEdit}>Salvar</button>
                      <button className={styles.btnSecondary} onClick={() => setEditId(null)}>Cancelar</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={u.id} className={styles.row}>
                  <div className={styles.dot} style={{ background: DOT }} />
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{u.nome}</div>
                    <div className={styles.rowAddr}>{u.endereco}</div>
                    <div className={styles.rowCoord}>{u.lat.toFixed(4)}, {u.lon.toFixed(4)}</div>
                  </div>
                  <div className={styles.rowActions}>
                    <button className={styles.iconBtn} title="Editar" onClick={() => startEdit(u)}>✏️</button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Remover" onClick={() => handleDelete(u.id)}>🗑</button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`${styles.toast}${toast.err ? ' ' + styles.toastErr : ''}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
