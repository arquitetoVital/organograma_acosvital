'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../crud.module.css';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Cliente {
  codigo_parceiro_omie: string;
  nome_fantasia:        string;
  email:                string | null;
  telefone:             string | null;
  logradouro:           string | null;
  numero:               string | null;
  complemento:          string | null;
  bairro:               string | null;
  cidade:               string | null;
  estado:               string | null;
  cep:                  string | null;
  latitude_y:           number | null;
  longitude_x:          number | null;
}

interface ApiResponse {
  clientes: Cliente[];
  total:    number;
  page:     number;
  pages:    number;
}

function buildAddress(c: Cliente): string {
  return [
    c.logradouro && c.numero ? `${c.logradouro}, ${c.numero}` : c.logradouro,
    c.complemento,
    c.bairro,
    c.cidade && c.estado ? `${c.cidade} – ${c.estado}` : c.cidade ?? c.estado,
    c.cep,
  ].filter(Boolean).join(', ');
}

const LIMIT = 50;

export default function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, page: String(p), limit: String(LIMIT) });
      const res  = await fetch(`/api/admin/clientes?${params}`);
      const json = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Erro ${res.status}`);
        setClientes([]);
        return;
      }
      setClientes(json.clientes ?? []);
      setTotal(json.total    ?? 0);
      setPage(json.page      ?? 1);
      setPages(json.pages    ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar clientes.');
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load('', 1); }, [load]);

  function handleSearch(value: string) {
    setSearch(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { load(value, 1); }, 350);
  }

  function goPage(p: number) { load(search, p); }

  function toggleSelected(c: Cliente) {
    setSelected(prev => prev?.codigo_parceiro_omie === c.codigo_parceiro_omie ? null : c);
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <span>Admin</span><span>›</span><span>Clientes</span>
        </div>
        <div className={styles.headerTitle}>Clientes</div>
        {!loading && (
          <span className={styles.headerBadge}>{total} registro{total !== 1 ? 's' : ''}</span>
        )}
        <input
          className={styles.searchInput}
          style={{ maxWidth: 280, marginLeft: 'auto' }}
          placeholder="Buscar por nome, código, cidade…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Table panel */}
        <div className={styles.listPanel} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Column header */}
          <div className={styles.clHead}>
            <div style={{ flex: '0 0 130px' }}>Cód. Omie</div>
            <div style={{ flex: '1 1 220px' }}>Nome Fantasia</div>
            <div style={{ flex: '1 1 160px' }}>Cidade / Estado</div>
            <div style={{ flex: '1 1 180px' }}>E-mail</div>
            <div style={{ flex: '0 0 140px' }}>Telefone</div>
            <div style={{ flex: '0 0 32px' }} />
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && (
              <div className={styles.list}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={styles.skeleton} style={{ height: 40, borderRadius: 6, marginBottom: 4 }} />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>⚠️</div>
                <div className={styles.emptyTitle}>Erro ao carregar clientes</div>
                <div className={styles.emptyText}>{error}</div>
                <button className={styles.btnSecondary} style={{ marginTop: 12 }} onClick={() => load(search, page)}>
                  Tentar novamente
                </button>
              </div>
            )}

            {!loading && !error && clientes.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🌍</div>
                <div className={styles.emptyTitle}>
                  {search ? 'Nenhum resultado encontrado.' : 'Nenhum cliente cadastrado.'}
                </div>
                <div className={styles.emptyText}>
                  {search ? 'Tente um termo diferente.' : 'Os dados vêm da integração com o Omie.'}
                </div>
              </div>
            )}

            {!loading && !error && clientes.map(c => (
              <div
                key={c.codigo_parceiro_omie}
                className={`${styles.clRow} ${selected?.codigo_parceiro_omie === c.codigo_parceiro_omie ? styles.clRowActive : ''}`}
                onClick={() => toggleSelected(c)}
              >
                <div style={{ flex: '0 0 130px' }}>
                  <span className={styles.codeBadge}>{c.codigo_parceiro_omie}</span>
                </div>
                <div style={{ flex: '1 1 220px' }}>
                  <span className={styles.rowName}>{c.nome_fantasia || '—'}</span>
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <span className={styles.rowSub}>
                    {[c.cidade, c.estado].filter(Boolean).join(' – ') || '—'}
                  </span>
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <span className={styles.rowSub}>{c.email || '—'}</span>
                </div>
                <div style={{ flex: '0 0 140px' }}>
                  <span className={styles.rowSub}>{c.telefone || '—'}</span>
                </div>
                <div style={{ flex: '0 0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.latitude_y && c.longitude_x
                    ? <span title="Coordenadas na API" style={{ fontSize: 12, opacity: 0.7 }}>📍</span>
                    : null}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && !loading && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={page <= 1} onClick={() => goPage(page - 1)}>
                ← Anterior
              </button>
              <span className={styles.pageInfo}>Página {page} de {pages}</span>
              <button className={styles.pageBtn} disabled={page >= pages} onClick={() => goPage(page + 1)}>
                Próxima →
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className={styles.detailPanel}>
            <div className={styles.drawerHead}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.drawerTitle}>{selected.nome_fantasia || '—'}</div>
                <div className={styles.drawerSubtitle}>Código Omie: {selected.codigo_parceiro_omie}</div>
              </div>
              <button className={styles.drawerClose} onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className={styles.drawerBody}>

              <div className={styles.detailGroup}>
                <div className={styles.detailGroupTitle}>Contato</div>
                <div className={styles.detailItem}>
                  <span className={styles.detailKey}>E-mail</span>
                  <span className={styles.detailVal}>{selected.email || '—'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailKey}>Telefone</span>
                  <span className={styles.detailVal}>{selected.telefone || '—'}</span>
                </div>
              </div>

              <div className={styles.detailGroup}>
                <div className={styles.detailGroupTitle}>Endereço</div>
                {buildAddress(selected) ? (
                  <p className={styles.detailAddr}>{buildAddress(selected)}</p>
                ) : (
                  <p className={styles.detailAddr} style={{ color: 'var(--text-muted)' }}>Não informado.</p>
                )}
                <div className={styles.row2} style={{ marginTop: 8 }}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>CEP</span>
                    <span className={styles.detailVal}>{selected.cep || '—'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>Estado</span>
                    <span className={styles.detailVal}>{selected.estado || '—'}</span>
                  </div>
                </div>
              </div>

              {(selected.latitude_y && selected.longitude_x) && (
                <div className={styles.detailGroup}>
                  <div className={styles.detailGroupTitle}>Localização</div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailKey}>Lat / Lon</span>
                    <span className={styles.detailVal}>
                      {selected.latitude_y.toFixed(5)}, {selected.longitude_x.toFixed(5)}
                    </span>
                  </div>
                </div>
              )}

              <div className={styles.infoNotice}>
                Cadastro de clientes gerenciado via integração Omie.
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
