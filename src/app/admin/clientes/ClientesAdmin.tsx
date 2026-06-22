'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ClientPoint, OmieClient, fromOmie } from '@/types/client';
import styles from '../management.module.css';

const STORAGE_KEY = 'vital-clients-v2';
const DOT = '#ef4444';

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

export default function ClientesAdmin() {
  const [clients,  setClients]  = useState<ClientPoint[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [toast,    setToast]    = useState<{ msg: string; err?: boolean } | null>(null);

  // Add form
  const [addNome,    setAddNome]    = useState('');
  const [addAddr,    setAddAddr]    = useState('');
  const [addLat,     setAddLat]     = useState('');
  const [addLon,     setAddLon]     = useState('');
  const [geoOk,      setGeoOk]      = useState(false);
  const [geoErr,     setGeoErr]     = useState('');
  const [geocoding,  setGeocoding]  = useState(false);
  const [adding,     setAdding]     = useState(false);

  // Inline edit
  const [editId,      setEditId]      = useState<number | null>(null);
  const [editNome,    setEditNome]    = useState('');
  const [editAddr,    setEditAddr]    = useState('');
  const [editLat,     setEditLat]     = useState('');
  const [editLon,     setEditLon]     = useState('');

  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const stored = load();
    if (stored.length > 0) setClients(stored);
    fetch('/data/clients.json')
      .then(r => r.ok ? r.json() as Promise<OmieClient[]> : Promise.reject())
      .then(data => {
        setClients(prev => {
          const ids = new Set(prev.map(c => c.id));
          const fresh = data.map(fromOmie).filter(c => !ids.has(c.id));
          const merged = fresh.length > 0 ? [...prev, ...fresh] : prev;
          save(merged);
          return merged;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.nome.toLowerCase().includes(q) || c.endereco.toLowerCase().includes(q)
    );
  }, [clients, search]);

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
    setAdding(true);
    const id = Date.now();
    const newClient: ClientPoint = { id, codigo_omie: id, nome, endereco: addr, lat, lon, source: 'manual' };
    setClients(prev => { const n = [...prev, newClient]; save(n); return n; });
    setAddNome(''); setAddAddr(''); setAddLat(''); setAddLon(''); setGeoOk(false); setGeoErr('');
    setAdding(false);
    showToast('Cliente adicionado.');
  }

  function handleDelete(id: number) {
    setClients(prev => { const n = prev.filter(c => c.id !== id); save(n); return n; });
    if (editId === id) setEditId(null);
    showToast('Cliente removido.');
  }

  function startEdit(c: ClientPoint) {
    setEditId(c.id);
    setEditNome(c.nome);
    setEditAddr(c.endereco);
    setEditLat(String(c.lat));
    setEditLon(String(c.lon));
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
    setClients(prev => {
      const n = prev.map(c => c.id === editId ? { ...c, nome, endereco: addr, lat, lon } : c);
      save(n); return n;
    });
    setEditId(null);
    showToast('Cliente atualizado.');
  }

  return (
    <div className={styles.page}>
      {/* Body */}
      <div className={styles.body}>
        {/* Add panel */}
        <div className={styles.addPanel}>
          <div className={styles.sectionTitle}>Adicionar novo cliente</div>

          <label className={styles.fieldLabel}>
            Nome do cliente / empresa *
            <input
              className={styles.input}
              placeholder="Ex: Construtora ABC Ltda"
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

          <button className={styles.btnPrimary} onClick={handleAdd} disabled={adding}>
            + Adicionar cliente
          </button>
        </div>

        {/* List panel */}
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div className={styles.statsChip}>
              <span className={styles.statsNum}>{clients.length}</span>
              <span className={styles.statsLabel}>clientes</span>
            </div>
            <input
              className={styles.searchInput}
              placeholder="Buscar cliente ou endereço…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.list}>
            {loading && <div className={styles.loadingState}>Carregando…</div>}
            {!loading && filtered.length === 0 && (
              <div className={styles.emptyState}>
                {search ? 'Nenhum resultado.' : 'Nenhum cliente ainda.'}
              </div>
            )}
            {filtered.map(c =>
              editId === c.id ? (
                <div key={c.id} className={`${styles.row} ${styles.rowEditing}`}>
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
                <div key={c.id} className={styles.row}>
                  <div className={styles.dot} style={{ background: DOT }} />
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{c.nome}</div>
                    <div className={styles.rowAddr}>{c.endereco}</div>
                    <div className={styles.rowCoord}>{c.lat.toFixed(4)}, {c.lon.toFixed(4)}</div>
                  </div>
                  <div className={styles.rowActions}>
                    <button className={styles.iconBtn} title="Editar" onClick={() => startEdit(c)}>✏️</button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Remover" onClick={() => handleDelete(c.id)}>🗑</button>
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
