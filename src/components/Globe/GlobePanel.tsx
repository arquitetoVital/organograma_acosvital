'use client';

import type { ClientPoint } from '@/types/client';
import { REGIONS, REGION_COLOR, REGION_LABEL, regionFromAddress, type RegionKey } from '@/lib/regions';
import styles from './GlobePanel.module.css';

export type RegionFilter = RegionKey | 'ALL';

interface Props {
  /** Rótulo do tipo de ponto, ex.: { singular: 'cliente', plural: 'clientes' }. */
  itemLabel: { singular: string; plural: string };
  /** Total de pontos (sem filtro) — usado no cabeçalho. */
  total: number;
  /** Pontos já filtrados (região + busca) — usados na lista. */
  visible: ClientPoint[];
  /** Contagem por região sobre todos os pontos (chips + distribuição). */
  regionCounts: Record<RegionKey, number>;
  activeRegion: RegionFilter;
  onRegion: (r: RegionFilter) => void;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (p: ClientPoint) => void;
  /** Cor de acento do tema (laranja = unidades, vermelho = clientes). */
  accent: string;
  /** Quando definido, o painel exibe a página de detalhes desse ponto. */
  selected: ClientPoint | null;
  onBack: () => void;
  onFocus: (p: ClientPoint) => void;
}

export default function GlobePanel({
  itemLabel, total, visible, regionCounts, activeRegion, onRegion, query, onQuery, onSelect, accent, selected, onBack, onFocus,
}: Props) {
  const maxRegion = Math.max(1, ...REGIONS.map((r) => regionCounts[r.key] ?? 0));
  const presentRegions = REGIONS.filter((r) => (regionCounts[r.key] ?? 0) > 0);

  // ── Página de detalhes da empresa selecionada ──
  if (selected) {
    const region = regionFromAddress(selected.endereco);
    return (
      <aside className={styles.panel}>
        <div className={styles.detailTop}>
          <button type="button" className={styles.back} onClick={onBack}>
            <span aria-hidden="true">←</span> Voltar à lista
          </button>
        </div>

        <div className={styles.detailBody}>
          <span className={styles.tag} style={{ color: accent }}>{itemLabel.singular}</span>
          <h2 className={styles.detailName}>{selected.nome}</h2>
          <span className={styles.regionBadge} style={{ color: REGION_COLOR[region], borderColor: REGION_COLOR[region] }}>
            {REGION_LABEL[region]}
          </span>

          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt>Endereço</dt>
              <dd>{selected.endereco}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Coordenadas</dt>
              <dd className={styles.mono}>{selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Cód. Omie</dt>
              <dd className={styles.mono}>{selected.codigo_omie}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>Origem</dt>
              <dd>{selected.source === 'manual' ? 'Cadastrado manualmente' : 'Importado do Omie'}</dd>
            </div>
          </dl>

          <button type="button" className={styles.focusBtn} style={{ background: accent }} onClick={() => onFocus(selected)}>
            Centralizar no mapa
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      {/* Cabeçalho — contador unificado */}
      <header className={styles.header}>
        <span className={styles.tag} style={{ color: accent }}>Aços Vital · Onde já estamos</span>
        <div className={styles.totalRow}>
          <span className={styles.total} style={{ color: accent }}>{total.toLocaleString('pt-BR')}</span>
          <span className={styles.totalLabel}>{total === 1 ? itemLabel.singular : itemLabel.plural}</span>
        </div>
        {visible.length !== total && (
          <span className={styles.filteredNote}>{visible.length.toLocaleString('pt-BR')} no filtro atual</span>
        )}
      </header>

      {/* Filtro por região */}
      <div className={styles.chips}>
        <button
          type="button"
          className={`${styles.chip} ${activeRegion === 'ALL' ? styles.chipActive : ''}`}
          onClick={() => onRegion('ALL')}
        >
          Todas <span className={styles.chipCount}>{total}</span>
        </button>
        {presentRegions.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`${styles.chip} ${activeRegion === r.key ? styles.chipActive : ''}`}
            onClick={() => onRegion(r.key)}
          >
            <span className={styles.chipDot} style={{ background: r.color }} />
            {r.label} <span className={styles.chipCount}>{regionCounts[r.key]}</span>
          </button>
        ))}
      </div>

      {/* Distribuição por região */}
      <div className={styles.dist}>
        <div className={styles.distTitle}>Distribuição</div>
        {presentRegions.map((r) => {
          const c = regionCounts[r.key] ?? 0;
          return (
            <div key={r.key} className={styles.distRow}>
              <span className={styles.distLabel}>{r.label}</span>
              <span className={styles.distBarTrack}>
                <span className={styles.distBar} style={{ width: `${(c / maxRegion) * 100}%`, background: r.color }} />
              </span>
              <span className={styles.distCount}>{c}</span>
            </div>
          );
        })}
      </div>

      {/* Busca */}
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          className={styles.search}
          placeholder={`Buscar ${itemLabel.singular}…`}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && <button type="button" className={styles.clear} onClick={() => onQuery('')} aria-label="Limpar">×</button>}
      </div>

      {/* Lista sincronizada com o globo */}
      <div className={styles.list}>
        {visible.length === 0 ? (
          <div className={styles.empty}>Nenhum {itemLabel.singular} no filtro.</div>
        ) : (
          visible.slice(0, 400).map((p) => (
            <button key={p.id} type="button" className={styles.item} onClick={() => onSelect(p)}>
              <span className={styles.itemDot} style={{ background: accent }} />
              <span className={styles.itemText}>
                <span className={styles.itemName}>{p.nome}</span>
                <span className={styles.itemAddr}>{p.endereco}</span>
              </span>
            </button>
          ))
        )}
        {visible.length > 400 && (
          <div className={styles.more}>+{(visible.length - 400).toLocaleString('pt-BR')} — refine a busca</div>
        )}
      </div>
    </aside>
  );
}
