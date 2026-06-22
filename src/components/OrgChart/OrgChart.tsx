'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { OrgNode, PositionedNode, Connection } from '@/types/orgChart';
import {
  SECTOR_RING_RADII, SECTOR_NODE_RADIUS,
  getSubtree, calculateLayout, calculateConnections,
} from '@/utils/radialLayout';
import NodeCard from '@/components/NodeCard/NodeCard';
import CenterCard from '@/components/CenterCard/CenterCard';
import SectorCard from '@/components/SectorCard/SectorCard';
import OrgTreeView from './OrgTreeView';
import styles from './OrgChart.module.css';

interface Props {
  // Pre-computed overview (levels 0-2 only)
  positions: PositionedNode[];
  connections: Connection[];
  // Full raw data for sector drill-down
  allNodes: OrgNode[];
  levelNames: Record<number, string>;
  levelColors: Record<number, string>;
}

interface ViewBox { x: number; y: number; w: number; h: number }

const OVERVIEW_VB: ViewBox = { x: -460, y: -460, w: 920,  h: 920  };
const SECTOR_VB:   ViewBox = { x: -1100, y: -1100, w: 2200, h: 2200 };
const MIN_W_OV = 300;
const MAX_W_OV = 1500;
const MIN_W_SC = 400;
const MAX_W_SC = 4000;
const CULL_MARGIN = 120;
const SPINE_R = 430; // Management ring sits on the sector ring (r=430)

export default function OrgChart({ positions, connections, allNodes, levelNames, levelColors }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mounted, setMounted] = useState(false);
  const [sectorStack, setSectorStack] = useState<string[]>([]);
  const activeSectorId = sectorStack.length > 0 ? sectorStack[sectorStack.length - 1] : null;
  const [vb, setVbState] = useState<ViewBox>(OVERVIEW_VB);
  const vbRef = useRef<ViewBox>(OVERVIEW_VB);
  const isPanning      = useRef(false);
  const panOrigin      = useRef({ mouseX: 0, mouseY: 0, vbX: 0, vbY: 0, vbW: 0, vbH: 0 });
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist  = useRef<number | null>(null);
  const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab');
  const animFrameRef = useRef<number | null>(null);

  // ── Busca, fly-to, highlight e modo de visualização ──────────────────────
  const [viewMode, setViewMode]     = useState<'radial' | 'tree'>('radial');
  const [query, setQuery]           = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget]   = useState<string | null>(null);

  const minW = activeSectorId ? MIN_W_SC : MIN_W_OV;
  const maxW = activeSectorId ? MAX_W_SC : MAX_W_OV;

  const setVb = useCallback((next: ViewBox) => {
    vbRef.current = next;
    setVbState(next);
  }, []);

  const animateTo = useCallback((target: ViewBox, duration = 650) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const from = { ...vbRef.current };
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const e = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setVb({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      });
      if (t < 1) { animFrameRef.current = requestAnimationFrame(tick); }
      else { animFrameRef.current = null; }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, [setVb]);

  useEffect(() => () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); }, []);

  const openSector = useCallback((id: string) => {
    setSectorStack((prev) => [...prev, id]);
  }, []);

  const goBack = useCallback(() => {
    setSectorStack((prev) => prev.slice(0, -1));
  }, []);

  // Animate viewBox when switching views
  useEffect(() => {
    animateTo(activeSectorId ? SECTOR_VB : OVERVIEW_VB, 700);
  }, [activeSectorId, animateTo]);

  // ── Sector detail layout (computed client-side) ────────────────────────
  const sectorDetail = useMemo(() => {
    if (!activeSectorId) return null;
    const subtree = getSubtree(activeSectorId, allNodes);
    const sectorDirectors = allNodes.filter((n) => n.sectorDirectorOf === activeSectorId);
    const sectorDirectorIds = new Set(sectorDirectors.map((d) => d.id));

    // Map each distinct person-level to a consecutive ring (rank-based, not absolute).
    // This prevents empty rings when levels are skipped:
    //   sector + apprentice only → apprentice at ring 1
    //   sector + manager + apprentice → manager ring 1, apprentice ring 2
    // When a sector director exists it occupies ring 1, so person rings start at 2.
    const presentLevels = [...new Set(
      subtree
        .filter((n) => n.id !== activeSectorId && !n.isSector && n.level > 0)
        .map((n) => n.level)
    )].sort((a, b) => a - b);
    const ringOffset = sectorDirectors.length > 0 ? 2 : 1;
    const levelToRing = new Map(presentLevels.map((lvl, i) => [lvl, i + ringOffset]));

    let relabeled: OrgNode[];
    if (sectorDirectors.length > 0) {
      // Directors sit at ring 1; direct sector people are reparented under the first director
      // so the connection chain is sector → director → manager (correct arc distribution).
      const firstDirId = sectorDirectors[0].id;
      const directPersonIds = new Set(
        subtree.filter((n) => n.parentId === activeSectorId && !n.isSector).map((n) => n.id)
      );
      relabeled = [
        ...subtree.map((n) => {
          if (n.id === activeSectorId) return { ...n, parentId: null };
          if (directPersonIds.has(n.id)) return { ...n, parentId: firstDirId };
          return n;
        }),
        ...sectorDirectors.map((d) => ({ ...d, parentId: activeSectorId })),
      ];
    } else {
      relabeled = subtree.map((n) => n.id === activeSectorId ? { ...n, parentId: null } : n);
    }

    const getDepth = (node: OrgNode, bfsDepth: number) => {
      if (sectorDirectorIds.has(node.id)) return 1;
      const ring = levelToRing.get(node.level);
      return ring !== undefined ? ring : bfsDepth; // fallback: sub-sectors use BFS depth
    };

    const pos = calculateLayout(relabeled, SECTOR_RING_RADII, SECTOR_NODE_RADIUS, getDepth);
    const conn = calculateConnections(pos);
    return { pos, conn, sectorDirectorIds };
  }, [activeSectorId, allNodes]);

  // ── Overview derived data ─────────────────────────────────────────────
  const overviewDirectors = useMemo(() => positions.filter((p) => p.level === 0), [positions]);
  const overviewGMs       = useMemo(() => positions.filter((p) => p.level === 1), [positions]);
  const overviewSectors   = useMemo(() => positions.filter((p) => p.isSector),    [positions]);
  const maxLevel          = useMemo(() => positions.reduce((m, p) => Math.max(m, p.level), 0), [positions]);
  const overviewPosMap    = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);

  const sectorsByGG = useMemo(() => {
    const map = new Map<string, PositionedNode[]>();
    overviewSectors.forEach((s) => {
      const pid = s.parentId ?? '';
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(s);
    });
    return map;
  }, [overviewSectors]);

  // ── Sector detail derived data ────────────────────────────────────────
  const detailCenter  = useMemo(() => sectorDetail?.pos.find((p) => p.id === activeSectorId) ?? null, [sectorDetail, activeSectorId]);
  const detailOthers  = useMemo(() => sectorDetail?.pos.filter((p) => p.id !== activeSectorId) ?? [], [sectorDetail, activeSectorId]);

  const visibleDetailOthers = useMemo(() => {
    const { x, y, w, h } = vb;
    return detailOthers.filter((n) => {
      const r = n.radius;
      return n.x + r + CULL_MARGIN > x && n.x - r - CULL_MARGIN < x + w &&
             n.y + r + CULL_MARGIN > y && n.y - r - CULL_MARGIN < y + h;
    });
  }, [detailOthers, vb]);

  const visibleDetailIds  = useMemo(() => new Set(visibleDetailOthers.map((n) => n.id)), [visibleDetailOthers]);
  const visibleDetailConn = useMemo(
    () => sectorDetail?.conn.filter((c) => visibleDetailIds.has(c.toId)) ?? [],
    [sectorDetail, visibleDetailIds],
  );

  const detailSubSectors = useMemo(
    () => visibleDetailOthers.filter((n) => n.isSector),
    [visibleDetailOthers],
  );
  const detailPeopleNodes = useMemo(
    () => visibleDetailOthers.filter((n) => !n.isSector),
    [visibleDetailOthers],
  );

  // ── Level counts (legend) ─────────────────────────────────────────────
  const levelCounts = useMemo(() => {
    const source = activeSectorId ? (sectorDetail?.pos ?? []) : positions;
    const counts: Record<number, number> = {};
    source.forEach((p) => {
      // In sector detail exclude the center card; in overview include sectors (level 2 count = 18)
      if (activeSectorId && p.isSector) return;
      counts[p.level] = (counts[p.level] ?? 0) + 1;
    });
    return counts;
  }, [activeSectorId, positions, sectorDetail]);

  const activeSectorNode = useMemo(
    () => allNodes.find((n) => n.id === activeSectorId) ?? null,
    [activeSectorId, allNodes],
  );
  const activeSectorName = activeSectorNode?.name ?? '';

  const backLabel = useMemo(() => {
    if (sectorStack.length <= 1) return '← Voltar à visão geral';
    const parentId = sectorStack[sectorStack.length - 2];
    const parentName = allNodes.find((n) => n.id === parentId)?.name ?? '';
    return `← Voltar${parentName ? ` a ${parentName}` : ''}`;
  }, [sectorStack, allNodes]);

  // ── Busca + navegação "voar até" ────────────────────────────────────────
  const nodeById = useMemo(() => new Map(allNodes.map((n) => [n.id, n])), [allNodes]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allNodes
      .filter((n) => `${n.name} ${n.role}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allNodes]);

  /** Sobe pela árvore até o setor que contém o nó (ou null se estiver no panorama). */
  const nearestSectorId = useCallback((node: OrgNode): string | null => {
    let cur: OrgNode | undefined = node;
    while (cur) {
      if (cur.isSector) return cur.id;
      cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
    }
    return null;
  }, [nodeById]);

  const flyTo = useCallback((node: OrgNode) => {
    setViewMode('radial');
    setSearchOpen(false);
    setQuery('');
    if (node.isSector) {
      setSectorStack([node.id]);              // setor: abre a equipe
    } else if (node.level <= 2) {
      setSectorStack([]);                      // diretoria / gerência: panorama
    } else {
      const sid = nearestSectorId(node);       // pessoa: abre o setor dela
      setSectorStack(sid ? [sid] : []);
    }
    setFlyTarget(node.id);
  }, [nearestSectorId]);

  // Centraliza e destaca o alvo assim que o layout dele estiver disponível.
  useEffect(() => {
    if (!flyTarget) return;
    const list = activeSectorId ? (sectorDetail?.pos ?? []) : positions;
    const target = list.find((p) => p.id === flyTarget);
    if (!target) return; // setor ainda montando — reavalia no próximo render
    const W = activeSectorId ? 720 : 460;
    animateTo({ x: target.x - W / 2, y: target.y - W / 2, w: W, h: W }, 720);
    setHighlightId(flyTarget);
    setFlyTarget(null);
    const t = setTimeout(() => setHighlightId(null), 2800);
    return () => clearTimeout(t);
  }, [flyTarget, activeSectorId, sectorDetail, positions, animateTo]);

  // Posição do nó destacado no modo atual (panorama ou detalhe de setor).
  const highlightPos = useMemo(() => {
    if (!highlightId) return null;
    if (activeSectorId) return sectorDetail?.pos.find((p) => p.id === highlightId) ?? null;
    return overviewPosMap.get(highlightId) ?? null;
  }, [highlightId, activeSectorId, sectorDetail, overviewPosMap]);

  // ── Wheel zoom ────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const cur = vbRef.current;
      const mx = cur.x + ((e.clientX - rect.left) / rect.width) * cur.w;
      const my = cur.y + ((e.clientY - rect.top) / rect.height) * cur.h;
      const factor = e.deltaY > 0 ? 1.14 : 0.88;
      const newW = Math.min(maxW, Math.max(minW, cur.w * factor));
      const newH = (newW / cur.w) * cur.h;
      setVb({ x: mx - (mx - cur.x) * (newW / cur.w), y: my - (my - cur.y) * (newH / cur.h), w: newW, h: newH });
    },
    [setVb, minW, maxW],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Pointer pan & pinch zoom (mouse + touch + pen) ────────────────────
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      isPanning.current = true;
      setCursor('grabbing');
      const cur = vbRef.current;
      panOrigin.current = { mouseX: e.clientX, mouseY: e.clientY, vbX: cur.x, vbY: cur.y, vbW: cur.w, vbH: cur.h };
    } else if (activePointers.current.size >= 2) {
      // Second finger down — cancel pan, start pinch
      isPanning.current = false;
      const ptrs = [...activePointers.current.values()];
      lastPinchDist.current = Math.hypot(ptrs[1].x - ptrs[0].x, ptrs[1].y - ptrs[0].y);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const ptrs = [...activePointers.current.values()];

    if (ptrs.length >= 2) {
      // Pinch zoom — zoom toward the midpoint between the two fingers
      const [p1, p2] = ptrs;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (lastPinchDist.current !== null && svgRef.current) {
        const ratio = lastPinchDist.current / dist;
        const cur   = vbRef.current;
        const rect  = svgRef.current.getBoundingClientRect();
        const cx = cur.x + ((p1.x + p2.x) / 2 - rect.left) / rect.width  * cur.w;
        const cy = cur.y + ((p1.y + p2.y) / 2 - rect.top)  / rect.height * cur.h;
        const newW = Math.min(maxW, Math.max(minW, cur.w * ratio));
        const newH = (newW / cur.w) * cur.h;
        setVb({ x: cx - (cx - cur.x) * (newW / cur.w), y: cy - (cy - cur.y) * (newH / cur.h), w: newW, h: newH });
      }
      lastPinchDist.current = dist;

    } else if (ptrs.length === 1 && isPanning.current && svgRef.current) {
      // Single-finger pan
      const rect = svgRef.current.getBoundingClientRect();
      const po   = panOrigin.current;
      const dx   = ((e.clientX - po.mouseX) / rect.width)  * po.vbW;
      const dy   = ((e.clientY - po.mouseY) / rect.height) * po.vbH;
      setVb({ ...vbRef.current, x: po.vbX - dx, y: po.vbY - dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);
    const remaining = activePointers.current.size;

    if (remaining < 2) lastPinchDist.current = null;

    if (remaining === 1) {
      // One finger remains — restart pan from its current position
      const [ptr] = activePointers.current.values();
      isPanning.current = true;
      const cur = vbRef.current;
      panOrigin.current = { mouseX: ptr.x, mouseY: ptr.y, vbX: cur.x, vbY: cur.y, vbW: cur.w, vbH: cur.h };
    } else if (remaining === 0) {
      isPanning.current = false;
      setCursor('grab');
    }
  };

  // ── Zoom buttons ──────────────────────────────────────────────────────
  const zoomIn    = () => { const c = vbRef.current; const nW = Math.max(minW, c.w * 0.78); const nH = (nW / c.w) * c.h; animateTo({ x: c.x + (c.w - nW) / 2, y: c.y + (c.h - nH) / 2, w: nW, h: nH }, 300); };
  const zoomOut   = () => { const c = vbRef.current; const nW = Math.min(maxW, c.w * 1.28); const nH = (nW / c.w) * c.h; animateTo({ x: c.x - (nW - c.w) / 2, y: c.y - (nH - c.h) / 2, w: nW, h: nH }, 300); };
  const resetView = () => animateTo(activeSectorId ? SECTOR_VB : OVERVIEW_VB, 500);

  const vbStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  // ── Connection renderer ───────────────────────────────────────────────
  function renderConnections(conns: Connection[], posMap?: Map<string, PositionedNode>) {
    return conns.map((c) => {
      const target = posMap?.get(c.toId);
      const color = (target?.isSector && target.sectorColor)
        ? target.sectorColor
        : (levelColors[c.level] ?? '#fff');
      const mx = (c.fromX + c.toX) / 2;
      const my = (c.fromY + c.toY) / 2;
      const dist = Math.sqrt(mx * mx + my * my);
      const nx = dist > 0 ? mx / dist : 0;
      const ny = dist > 0 ? my / dist : 0;
      const pull = dist * 0.15;
      const d = `M ${c.fromX} ${c.fromY} Q ${nx * (dist - pull)} ${ny * (dist - pull)} ${c.toX} ${c.toY}`;
      return (
        <g key={`${c.fromId}-${c.toId}`}>
          {/* Traço-base estático */}
          <path d={d} fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={1.3} />
          {/* Fluxo animado de partículas (desabilitado em prefers-reduced-motion) */}
          <path d={d} fill="none" stroke={color} strokeOpacity={0.85} strokeWidth={1.7}
            strokeLinecap="round" className={styles.flowLine} />
        </g>
      );
    });
  }

  // ── Arc-spine connections (all GGs → shared management ring → all sectors)
  function renderArcSpines() {
    const color = levelColors[1];

    // Stems: each GG → its point on the spine ring
    const stems = overviewGMs.map((gg) => {
      const ggAngle  = Math.atan2(gg.y, gg.x);
      const sp       = { x: SPINE_R * Math.cos(ggAngle), y: SPINE_R * Math.sin(ggAngle) };
      const dx = sp.x - gg.x;
      const dy = sp.y - gg.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      const ggEdge = { x: gg.x + (dx / d) * gg.radius, y: gg.y + (dy / d) * gg.radius };
      return (
        <line
          key={`${gg.id}-stem`}
          x1={ggEdge.x} y1={ggEdge.y}
          x2={sp.x} y2={sp.y}
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.5}
        />
      );
    });

    // Shared management ring
    const ring = (
      <circle
        key="mgmt-ring"
        cx={0} cy={0} r={SPINE_R}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeOpacity={0.45}
      />
    );

    return [...stems, ring];
  }

  // ── Legend entries ─────────────────────────────────────────────────────
  const legendEntries = useMemo(() => {
    if (activeSectorId) {
      return Object.entries(levelNames)
        .map(([lvl, name]) => [Number(lvl), name] as [number, string])
        .filter(([lvl]) => (lvl === 0 || lvl >= 3) && (levelCounts[lvl] ?? 0) > 0);
    }
    return [[0, levelNames[0]], [1, levelNames[1]], [2, levelNames[2]]] as [number, string][];
  }, [activeSectorId, levelNames, levelCounts]);

  const totalPeople = useMemo(() => {
    if (activeSectorId) {
      return Object.values(levelCounts).reduce((s, c) => s + c, 0);
    }
    return allNodes.filter((n) => !n.isSector && n.level > 0).length;
  }, [activeSectorId, levelCounts, allNodes]);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.skeleton}>
          <div className={styles.skeletonRing} style={{ width: 150, height: 150, animationDelay: '0s' }} />
          <div className={styles.skeletonRing} style={{ width: 380, height: 380, animationDelay: '0.3s' }} />
          <div className={styles.skeletonRing} style={{ width: 660, height: 660, animationDelay: '0.6s' }} />
          <div className={styles.skeletonCenter} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrapper} ${styles.wrapperLoaded}`}>
      {/* ── Barra: alternância de modo (Mapa/Lista) + busca ─────────── */}
      <div className={styles.toolbar}>
        <div className={styles.segmented}>
          <button type="button" data-active={viewMode === 'radial'} onClick={() => setViewMode('radial')}>Mapa</button>
          <button type="button" data-active={viewMode === 'tree'} onClick={() => setViewMode('tree')}>Lista</button>
        </div>

        {viewMode === 'radial' && (
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder="Buscar pessoa ou setor…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            />
            {query && (
              <button type="button" className={styles.searchClear} onClick={() => setQuery('')} aria-label="Limpar busca">×</button>
            )}
            {searchOpen && searchResults.length > 0 && (
              <ul className={styles.searchResults}>
                {searchResults.map((n) => (
                  <li key={n.id}>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); flyTo(n); }}>
                      <span className={styles.resultDot} style={{ background: n.isSector ? (n.sectorColor ?? levelColors[2]) : (levelColors[n.level] ?? '#94a3b8') }} />
                      <span className={styles.resultText}>
                        <span className={styles.resultName}>{n.name?.trim() || n.role}</span>
                        <span className={styles.resultSub}>{n.isSector ? 'Setor' : (levelNames[n.level] ?? n.role)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {viewMode === 'tree' && (
        <OrgTreeView nodes={allNodes} levelColors={levelColors} levelNames={levelNames} onSelect={flyTo} />
      )}

      {viewMode === 'radial' && (
      <>
      {/* ── Back button (sector view only) ──────────────────────────── */}
      {activeSectorId && (
        <button className={styles.backBtn} onClick={goBack}>
          {backLabel}
        </button>
      )}

      {/* ── Sector title (sector view only) ─────────────────────────── */}
      {activeSectorId && (
        <div className={styles.sectorTitle}>
          <span className={styles.sectorTitleLabel}>
            {activeSectorNode?.role === 'Sub-setor' ? 'SUB-SETOR' : 'SETOR'}
          </span>
          <span className={styles.sectorTitleName}>{activeSectorName}</span>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────── */}
      <aside className={styles.legend}>
        <div className={styles.legendTitle}>
          {activeSectorId ? activeSectorName : 'Hierarquia'}
        </div>
        {legendEntries.map(([lvl, name]) => (
          <div key={lvl} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: levelColors[lvl] }} />
            <span className={styles.legendLabel}>{name}</span>
            <span className={styles.legendCount}>{levelCounts[lvl] ?? 0}</span>
          </div>
        ))}
        <div className={styles.legendTotal}>
          {activeSectorId
            ? <>Equipe: <strong>{totalPeople}</strong> pessoas</>
            : <>Total: <strong>{totalPeople}</strong> colaboradores</>
          }
        </div>
        {!activeSectorId && (
          <div className={styles.legendHint}>
            <span>Toque num setor para ver a equipe</span>
            <span>Arraste · 2 dedos ou scroll → zoom</span>
          </div>
        )}
        {activeSectorId && (
          <div className={styles.legendHint}>
            <span>Arraste · 2 dedos ou scroll → zoom</span>
          </div>
        )}
      </aside>

      {/* ── SVG Canvas ──────────────────────────────────────────────── */}
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={vbStr}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor }}
      >
        <defs>
          <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: 'var(--bg-surface)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--bg-deep)' }} />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx={0} cy={0} r={activeSectorId ? 1600 : 700} fill="url(#bg-grad)" />

        {/* Ring guides */}
        {activeSectorId
          ? Object.entries(SECTOR_RING_RADII).filter(([d]) => Number(d) > 0).map(([d, r]) => (
              <circle key={d} cx={0} cy={0} r={r}
                fill="none" stroke={levelColors[Number(d) + 2] ?? '#fff'}
                strokeOpacity={0.25} strokeWidth={1.5} strokeDasharray="6 5" />
            ))
          : Array.from({ length: maxLevel }, (_, i) => i + 1).map((lv) => {
              const r = [190, 430][lv - 1] ?? 0;
              return r > 0 ? (
                <circle key={lv} cx={0} cy={0} r={r}
                  fill="none" stroke={levelColors[lv] ?? '#fff'}
                  strokeOpacity={0.28} strokeWidth={1.5} strokeDasharray="7 5" />
              ) : null;
            })
        }

        {/* ── OVERVIEW MODE ─────────────────────────────────────────── */}
        {!activeSectorId && (
          <g key="overview" className={styles.contentGroup}>
            {/* Dir→GG connections (Bezier) — level < 2 only */}
            {renderConnections(connections.filter((c) => c.level < 2), overviewPosMap)}
            {/* GG→Sector arc-spine connections */}
            {renderArcSpines()}

            {/* GMs */}
            {overviewGMs.map((node) => (
              <NodeCard key={node.id} node={node} color={levelColors[node.level] ?? '#fff'} vbW={vb.w} />
            ))}

            {/* Sector cards */}
            {overviewSectors.map((node) => (
              <SectorCard
                key={node.id}
                node={node}
                color={node.sectorColor ?? levelColors[2]}
                onClick={() => openSector(node.id)}
              />
            ))}

            {/* Directors center */}
            {overviewDirectors.map((d) => (
              <CenterCard key={d.id} node={d} color={levelColors[0]} />
            ))}
          </g>
        )}

        {/* ── SECTOR DETAIL MODE ────────────────────────────────────── */}
        {activeSectorId && sectorDetail && detailCenter && (
          <g key={activeSectorId} className={styles.contentGroup}>
            {renderConnections(visibleDetailConn)}

            {/* People nodes */}
            {detailPeopleNodes.map((node) => {
              const isSectorDirector = sectorDetail.sectorDirectorIds.has(node.id);
              const color = isSectorDirector ? levelColors[0] : (levelColors[node.level] ?? '#fff');
              return (
                <g key={node.id}>
                  {isSectorDirector && (
                    <>
                      <circle cx={node.x} cy={node.y} r={node.radius + 15} fill="none"
                        stroke={levelColors[0]} strokeWidth={1.5} strokeOpacity={0.25} strokeDasharray="5 4" />
                      <circle cx={node.x} cy={node.y} r={node.radius + 8} fill="none"
                        stroke={levelColors[0]} strokeWidth={1} strokeOpacity={0.18} />
                    </>
                  )}
                  <NodeCard node={node} color={color} vbW={vb.w} />
                </g>
              );
            })}

            {/* Sub-sector cards — clickable to drill down */}
            {detailSubSectors.map((node) => (
              <SectorCard
                key={node.id}
                node={node}
                color={node.sectorColor ?? levelColors[3]}
                onClick={() => openSector(node.id)}
              />
            ))}

            {/* Current sector at center */}
            <SectorCard
              node={detailCenter}
              color={detailCenter.sectorColor ?? levelColors[2]}
              onClick={() => {}}
            />
          </g>
        )}

        {/* ── Destaque do "voar até" ──────────────────────────────────── */}
        {highlightPos && (
          <FlyHighlight x={highlightPos.x} y={highlightPos.y} r={highlightPos.radius} />
        )}
      </svg>

      {/* ── Zoom Controls ───────────────────────────────────────────── */}
      <div className={styles.controls}>
        <button className={styles.btn} onClick={zoomIn}    title="Aproximar">+</button>
        <button className={styles.btn} onClick={resetView} title="Resetar visão">⌂</button>
        <button className={styles.btn} onClick={zoomOut}   title="Afastar">−</button>
      </div>

      {/* ── Mini-mapa (apenas no panorama) ──────────────────────────── */}
      {!activeSectorId && (
        <MiniMap
          positions={positions}
          vb={vb}
          levelColors={levelColors}
          onJump={(wx, wy) => {
            const c = vbRef.current;
            setVb({ x: wx - c.w / 2, y: wy - c.h / 2, w: c.w, h: c.h });
          }}
        />
      )}

      {/* ── Stats ───────────────────────────────────────────────────── */}
      {activeSectorId && (
        <div className={styles.stats}>
          {visibleDetailOthers.length} / {detailOthers.length} nós visíveis
        </div>
      )}
      </>
      )}
    </div>
  );
}

/** Anel de destaque animado exibido ao "voar até" um nó. */
function FlyHighlight({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g className={styles.flyHighlight} pointerEvents="none">
      <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeOpacity={0.95} />
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} className={styles.flyPulse}>
        <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#fbbf24" strokeWidth={2} />
      </g>
    </g>
  );
}

interface MiniMapProps {
  positions: PositionedNode[];
  vb: ViewBox;
  levelColors: Record<number, string>;
  onJump: (worldX: number, worldY: number) => void;
}

/** Mini-mapa de orientação: pontos dos nós + retângulo do viewport atual. */
function MiniMap({ positions, vb, levelColors, onJump }: MiniMapProps) {
  const S = 150;       // tamanho do mini-mapa em px
  const D = 1000;      // domínio do mundo: -500..500
  const k = S / D;
  const mx = (x: number) => (x + 500) * k;
  const my = (y: number) => (y + 500) * k;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * S;
    const py = ((e.clientY - rect.top) / rect.height) * S;
    onJump(px / k - 500, py / k - 500);
  };

  return (
    <div className={styles.minimap}>
      <svg viewBox={`0 0 ${S} ${S}`} className={styles.minimapSvg} onClick={handleClick}>
        {positions.map((p) => (
          <circle
            key={p.id}
            cx={mx(p.x)}
            cy={my(p.y)}
            r={p.level === 0 ? 3.2 : 2.2}
            fill={p.isSector ? (p.sectorColor ?? levelColors[2]) : (levelColors[p.level] ?? '#cbd5e1')}
          />
        ))}
        <rect
          x={mx(vb.x)}
          y={my(vb.y)}
          width={vb.w * k}
          height={vb.h * k}
          className={styles.minimapViewport}
        />
      </svg>
    </div>
  );
}
