'use client';

import { useState, useCallback, KeyboardEvent, useMemo } from 'react';
import { ClientPoint } from '@/types/client';
import styles from './VitalPanel.module.css';

type Tab = 'lista' | 'adicionar';

interface EditState {
  id: number;
  nome: string;
  endereco: string;
  lat: string;
  lon: string;
}

interface Labels {
  title: string;
  entitySingular: string;
  entityPlural: string;
  searchPlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  emptyText: string;
  addButton: string;
}

const LABELS: Record<'cliente' | 'unidade', Labels> = {
  cliente: {
    title: 'Clientes',
    entitySingular: 'cliente',
    entityPlural: 'clientes',
    searchPlaceholder: 'Buscar cliente ou cidade…',
    nameLabel: 'Nome do cliente / empresa *',
    namePlaceholder: 'Ex: Construtora ABC Ltda',
    emptyText: 'Nenhum cliente ainda.',
    addButton: '+ Adicionar cliente',
  },
  unidade: {
    title: 'Unidades',
    entitySingular: 'unidade',
    entityPlural: 'unidades',
    searchPlaceholder: 'Buscar unidade ou cidade…',
    nameLabel: 'Nome da unidade *',
    namePlaceholder: 'Ex: Filial São Paulo',
    emptyText: 'Nenhuma unidade ainda.',
    addButton: '+ Adicionar unidade',
  },
};

interface Props {
  clients:  ClientPoint[];
  isAdmin:  boolean;
  kind?:    'cliente' | 'unidade';
  onAdd:    (lat: number, lon: number, nome: string, endereco: string) => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, lat: number, lon: number, nome: string, endereco: string) => void;
}

export default function VitalPanel({ clients, isAdmin, kind = 'cliente', onAdd, onRemove, onUpdate }: Props) {
  const L = LABELS[kind];
  const [tab,        setTab]        = useState<Tab>('lista');
  const [search,     setSearch]     = useState('');
  const [nome,       setNome]       = useState('');
  const [endereco,   setEndereco]   = useState('');
  const [lat,        setLat]        = useState('');
  const [lon,        setLon]        = useState('');
  const [editing,    setEditing]    = useState<EditState | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError,   setGeoError]   = useState('');
  const [geoOk,      setGeoOk]      = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.endereco.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const handleAdd = useCallback(() => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (isNaN(la) || isNaN(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) return;
    if (!nome.trim()) return;
    onAdd(la, lo, nome, endereco);
    setNome(''); setEndereco(''); setLat(''); setLon('');
    setGeoOk(false); setGeoError('');
    setTab('lista');
  }, [lat, lon, nome, endereco, onAdd]);

  const geocode = useCallback(async () => {
    const q = endereco.trim();
    if (!q) return;
    setGeoLoading(true);
    setGeoError('');
    setGeoOk(false);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      );
      const json = await res.json() as { lat: string; lon: string }[];
      if (json.length > 0) {
        setLat(parseFloat(json[0].lat).toFixed(6));
        setLon(parseFloat(json[0].lon).toFixed(6));
        setGeoOk(true);
      } else {
        setGeoError('Endereço não encontrado');
      }
    } catch {
      setGeoError('Erro ao buscar endereço');
    } finally {
      setGeoLoading(false);
    }
  }, [endereco]);

  const handleKey = (e: KeyboardEvent) => { if (e.key === 'Enter') handleAdd(); };

  const startEdit = useCallback((c: ClientPoint) => {
    if (!isAdmin) return;
    setEditing({ id: c.id, nome: c.nome, endereco: c.endereco, lat: String(c.lat), lon: String(c.lon) });
  }, [isAdmin]);

  const cancelEdit = () => setEditing(null);

  const saveEdit = useCallback(() => {
    if (!editing) return;
    const la = parseFloat(editing.lat);
    const lo = parseFloat(editing.lon);
    if (isNaN(la) || isNaN(lo)) return;
    onUpdate(editing.id, la, lo, editing.nome, editing.endereco);
    setEditing(null);
  }, [editing, onUpdate]);

  const handleEditKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className={styles.panel}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTag}>AÇOS VITAL</div>
        <div className={styles.headerTitle}>{L.title}</div>
        <div className={styles.totalBadge}>
          <span className={styles.totalNum}>{clients.length}</span>
          <span className={styles.totalLabel}>{clients.length === 1 ? L.entitySingular : L.entityPlural} no mapa</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'lista' ? styles.tabActive : ''}`} onClick={() => setTab('lista')}>Lista</button>
        {isAdmin && (
          <button className={`${styles.tab} ${tab === 'adicionar' ? styles.tabActive : ''}`} onClick={() => setTab('adicionar')}>+ Adicionar</button>
        )}
      </div>

      {/* ── TAB LISTA ── */}
      {tab === 'lista' && (
        <>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.868-3.834zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={L.searchPlaceholder}
              className={styles.searchInput}
            />
            {search && <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>}
          </div>

          {search && (
            <div className={styles.searchResult}>
              {filtered.length} de {clients.length} {clients.length !== 1 ? L.entityPlural : L.entitySingular}
            </div>
          )}

          <div className={styles.listSection}>
            {clients.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📍</div>
                {L.emptyText}{isAdmin && <><br />Use &ldquo;+ Adicionar&rdquo; para incluir.</>}
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔍</div>
                Nenhum resultado para<br />&ldquo;{search}&rdquo;.
              </div>
            ) : (
              filtered.map(c => {
                const isEditing = editing?.id === c.id;
                return (
                  <div key={c.id} className={`${styles.card} ${isEditing ? styles.cardEditing : ''}`}>
                    <div className={styles.cardDot} />

                    {isEditing ? (
                      <div className={styles.editForm}>
                        <input autoFocus type="text" value={editing.nome}
                          onChange={e => setEditing(s => s && ({ ...s, nome: e.target.value }))}
                          onKeyDown={handleEditKey} placeholder="Nome" className={styles.inputSm} />
                        <input type="text" value={editing.endereco}
                          onChange={e => setEditing(s => s && ({ ...s, endereco: e.target.value }))}
                          onKeyDown={handleEditKey} placeholder="Endereço" className={styles.inputSm} />
                        <div className={styles.coordRow}>
                          <input type="number" value={editing.lat}
                            onChange={e => setEditing(s => s && ({ ...s, lat: e.target.value }))}
                            onKeyDown={handleEditKey} placeholder="Lat" className={styles.inputSm} />
                          <input type="number" value={editing.lon}
                            onChange={e => setEditing(s => s && ({ ...s, lon: e.target.value }))}
                            onKeyDown={handleEditKey} placeholder="Lon" className={styles.inputSm} />
                        </div>
                        <div className={styles.editActions}>
                          <button onClick={saveEdit}   className={styles.saveButton}>Salvar</button>
                          <button onClick={cancelEdit} className={styles.cancelButton}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.cardBody}>
                        <div className={styles.cardName}>{c.nome}</div>
                        {c.endereco && <div className={styles.cardAddress}>{c.endereco}</div>}
                        <div className={styles.cardCoord}>{c.lat.toFixed(4)}° / {c.lon.toFixed(4)}°</div>
                      </div>
                    )}

                    {!isEditing && isAdmin && (
                      <div className={styles.cardActions}>
                        <button onClick={() => startEdit(c)} className={styles.editButton} title="Editar">✎</button>
                        <button onClick={() => onRemove(c.id)} className={styles.removeButton} title="Remover">×</button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── TAB ADICIONAR (somente admin) ── */}
      {tab === 'adicionar' && isAdmin && (
        <div className={styles.addSection}>
          <div className={styles.fieldWrap}>
            <div className={styles.fieldLabel}>{L.nameLabel}</div>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={handleKey}
              placeholder={L.namePlaceholder} className={styles.input} />
          </div>
          <div className={styles.fieldWrap}>
            <div className={styles.fieldLabel}>Endereço</div>
            <div className={styles.addressRow}>
              <input
                type="text"
                value={endereco}
                onChange={e => { setEndereco(e.target.value); setGeoOk(false); setGeoError(''); }}
                onKeyDown={handleKey}
                placeholder="Ex: São Paulo, SP, Brasil"
                className={styles.input}
              />
              <button
                type="button"
                className={`${styles.geoBtn} ${geoOk ? styles.geoBtnOk : ''}`}
                onClick={geocode}
                disabled={!endereco.trim() || geoLoading}
                title="Buscar coordenadas pelo endereço (OpenStreetMap)"
              >
                {geoLoading ? '…' : geoOk ? '✓' : 'Buscar'}
              </button>
            </div>
            {geoError && <div className={styles.geoError}>{geoError}</div>}
          </div>
          <div className={styles.coordRow}>
            <div className={styles.coordField}>
              <div className={styles.fieldLabel}>Latitude *</div>
              <input type="number" value={lat} onChange={e => setLat(e.target.value)} onKeyDown={handleKey}
                placeholder="-23.5505" min={-90} max={90} step="any" className={styles.input} />
            </div>
            <div className={styles.coordField}>
              <div className={styles.fieldLabel}>Longitude *</div>
              <input type="number" value={lon} onChange={e => setLon(e.target.value)} onKeyDown={handleKey}
                placeholder="-46.6333" min={-180} max={180} step="any" className={styles.input} />
            </div>
          </div>
          <button onClick={handleAdd} className={styles.addButton} disabled={!nome.trim() || !lat || !lon}>
            {L.addButton}
          </button>
        </div>
      )}
    </div>
  );
}
