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

const OVERVIEW_VB: ViewBox = { x: -540, y: -540, w: 1080, h: 1080 };
const SECTOR_VB:   ViewBox = { x: -1100, y: -1100, w: 2200, h: 2200 };
const MIN_W_OV = 300;
const MAX_W_OV = 1500;
const MIN_W_SC = 400;
const MAX_W_SC = 4000;
const CULL_MARGIN = 120;
const SPINE_R = 430; // Management ring sits on the sector ring (r=430)

// ── Orbital intro animation ──────────────────────────────────────────────────
const ORB_DIR_R  = 92;   // orbit clearance around director card (card r=78)
const GM_ORB_R   = 38;   // orbit radius around each GM node
const SEC_ORB_R  = 50;   // orbit radius around each sector node
const ORB_BLUE   = '#5B9DD4';  // medium blue — line color
const ORB_TIP    = '#A8D4F0';  // light sky blue — alive flowing tip
const ORB_NAVY   = '#081336';  // deep navy — depth layer

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

    // Map each distinct person-level to a consecutive ring (rank-based, not absolute).
    // Prevents empty rings when levels are skipped:
    //   only level 4+9 present → level 4 at ring 1, level 9 at ring 2
    const presentLevels = [...new Set(
      subtree
        .filter((n) => n.id !== activeSectorId && !n.isSector && n.level > 0)
        .map((n) => n.level)
    )].sort((a, b) => a - b);
    const levelToRing = new Map(presentLevels.map((lvl, i) => [lvl, i + 1]));

    // Clear sector root's parentId so it renders at center (depth 0)
    const relabeled = subtree.map((n) =>
      n.id === activeSectorId ? { ...n, parentId: null } : n
    );

    const getDepth = (node: OrgNode, bfsDepth: number) => {
      const ring = levelToRing.get(node.level);
      return ring !== undefined ? ring : bfsDepth; // fallback: sub-sectors use BFS depth
    };

    const pos = calculateLayout(relabeled, SECTOR_RING_RADII, SECTOR_NODE_RADIUS, getDepth);
    const conn = calculateConnections(pos);
    return { pos, conn };
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
      if (p.isSector) return; // setores e sub-setores nunca são contados como pessoas
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

  // ── Orbital intro + permanent alive animation ─────────────────────────────
  // Path: 360° director → radial to GM ring → 360° GM ring (all GMs) → stem → 360° sector ring
  function renderOrbitalAnimation() {
    if (!overviewGMs.length) return null;

    const f   = (n: number) => n.toFixed(2);
    const PI2 = 2 * Math.PI;

    // CW arc on circle radius r (centred at origin), from angle a1 to a2
    function cwArc(r: number, a1: number, a2: number): string {
      const dA   = ((a2 - a1) % PI2 + PI2) % PI2;
      const large = dA > Math.PI ? 1 : 0;
      return `A ${r},${r} 0 ${large},1 ${f(r * Math.cos(a2))},${f(r * Math.sin(a2))}`;
    }

    // Full CW 360° on circle of radius r, starting at angle startA (4 quarter-arcs)
    function ring360(r: number, startA: number): string[] {
      const a = startA;
      return [
        cwArc(r, a,             a + Math.PI / 2),
        cwArc(r, a + Math.PI / 2,   a + Math.PI),
        cwArc(r, a + Math.PI,       a + Math.PI * 1.5),
        cwArc(r, a + Math.PI * 1.5, a + Math.PI * 2),
      ];
    }

    // Pick the first GM sorted CW from top (−π/2)
    const topAngle    = -Math.PI / 2;
    const normAngle   = (n: { x: number; y: number }) =>
      ((Math.atan2(n.y, n.x) - topAngle + PI2 * 2) % PI2);
    const firstGM     = [...overviewGMs].sort((a, b) => normAngle(a) - normAngle(b))[0];
    const gmAngle     = Math.atan2(firstGM.y, firstGM.x);

    const DR    = ORB_DIR_R;   // orbit radius around director card
    const GM_R  = 190;         // GM ring radius
    const SEC_R = 430;         // sector ring radius

    const parts: string[] = [];

    // ── 1. Full 360° orbit of director card ──
    parts.push(`M 0,${-DR}`);
    parts.push(...ring360(DR, topAngle));

    // ── 2. Arc along director orbit from top to first GM's radial direction ──
    const dToGM = ((gmAngle - topAngle) % PI2 + PI2) % PI2;
    if (dToGM > 0.05) parts.push(cwArc(DR, topAngle, gmAngle));

    // ── 3. Radial line: director orbit → first GM position (connection line) ──
    parts.push(`L ${f(firstGM.x)},${f(firstGM.y)}`);

    // ── 4. Full 360° around GM ring — sweeps through ALL GM nodes ──
    parts.push(...ring360(GM_R, gmAngle));

    // ── 5 & 6. Sector ring — only if there are sectors ──
    const hasSectors = overviewSectors.length > 0;
    if (hasSectors) {
      parts.push(`L ${f(SEC_R * Math.cos(gmAngle))},${f(SEC_R * Math.sin(gmAngle))}`);
      parts.push(...ring360(SEC_R, gmAngle));
    }

    const dynPath = parts.join(' ');

    // Path length: dir + arc + connector + GM ring + (stem + sec ring if sectors exist)
    const dirLen  = PI2 * DR;
    const arcLen  = dToGM * DR;
    const connLen = GM_R - DR;
    const gmLen   = PI2 * GM_R;
    const stemLen = hasSectors ? SEC_R - GM_R : 0;
    const secLen  = hasSectors ? PI2 * SEC_R  : 0;
    const TOTAL   = Math.round(dirLen + arcLen + connLen + gmLen + stemLen + secLen);

    const DRAW = '15s';

    return (
      <g pointerEvents="none">

        {/* ── DRAW: navy depth layer ── */}
        <path d={dynPath} fill="none" stroke={ORB_NAVY} strokeWidth={5}
          strokeLinecap="round" strokeDasharray={`0 ${TOTAL}`} opacity={0.9}>
          {/* @ts-ignore — SMIL */}
          <animate attributeName="stroke-dasharray"
            values={`0 ${TOTAL};${TOTAL} 0`}
            dur={DRAW} fill="freeze" repeatCount="1" />
        </path>

        {/* ── DRAW: outer blue glow ── */}
        <path d={dynPath} fill="none" stroke={ORB_BLUE} strokeWidth={6}
          filter="url(#orb-glow)" strokeLinecap="round"
          strokeDasharray={`0 ${TOTAL}`} opacity={0.18}>
          {/* @ts-ignore */}
          <animate attributeName="stroke-dasharray"
            values={`0 ${TOTAL};${TOTAL} 0`}
            dur={DRAW} fill="freeze" repeatCount="1" />
        </path>

        {/* ── DRAW: sharp blue core line ── */}
        <path d={dynPath} fill="none" stroke={ORB_BLUE} strokeWidth={2}
          strokeLinecap="round" strokeDasharray={`0 ${TOTAL}`} opacity={0.92}>
          {/* @ts-ignore */}
          <animate attributeName="stroke-dasharray"
            values={`0 ${TOTAL};${TOTAL} 0`}
            dur={DRAW} fill="freeze" repeatCount="1" />
        </path>

        {/* ── DRAW: leading orange tip ── */}
        <circle r={5} fill={ORB_TIP} filter="url(#orb-tip-glow)">
          {/* @ts-ignore */}
          <animateMotion path={dynPath} dur={DRAW} fill="freeze"
            repeatCount="1" calcMode="linear" />
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="1;1;0" keyTimes="0;0.96;1"
            dur={DRAW} fill="freeze" repeatCount="1" />
        </circle>

        {/* ── ALIVE: pulsing blue glow (begins after draw) ── */}
        <g opacity={0}>
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="0.14;0.32;0.14" dur="2.8s"
            repeatCount="indefinite" begin={DRAW} />
          <path d={dynPath} fill="none" stroke={ORB_BLUE} strokeWidth={6}
            filter="url(#orb-glow)" strokeLinecap="round"
            strokeDasharray={`${TOTAL} 0`} />
        </g>

        {/* ── ALIVE: static navy base ── */}
        <path d={dynPath} fill="none" stroke={ORB_NAVY} strokeWidth={4}
          strokeLinecap="round" strokeDasharray={`${TOTAL} 0`} opacity={0}>
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="0;0;0.85" keyTimes="0;0.999;1"
            dur={DRAW} fill="freeze" repeatCount="1" />
        </path>

        {/* ── ALIVE: static blue line ── */}
        <path d={dynPath} fill="none" stroke={ORB_BLUE} strokeWidth={1.8}
          strokeLinecap="round" strokeDasharray={`${TOTAL} 0`} opacity={0}>
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="0;0;0.5" keyTimes="0;0.999;1"
            dur={DRAW} fill="freeze" repeatCount="1" />
        </path>

        {/* ── ALIVE: flowing orange tip segment ── */}
        <path d={dynPath} fill="none" stroke={ORB_TIP} strokeWidth={3}
          strokeLinecap="round" filter="url(#orb-tip-glow)"
          strokeDasharray={`70 ${TOTAL - 70}`} strokeDashoffset={0} opacity={0}>
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="0;0;0.75" keyTimes="0;0.999;1"
            dur={DRAW} fill="freeze" repeatCount="1" />
          {/* @ts-ignore */}
          <animate attributeName="stroke-dashoffset"
            from="0" to={`${-TOTAL}`}
            dur="10s" repeatCount="indefinite" />
        </path>

        {/* ── ALIVE: blue trailing segment (forward) ── */}
        <path d={dynPath} fill="none" stroke={ORB_BLUE} strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`35 ${TOTAL - 35}`} strokeDashoffset={-50} opacity={0}>
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="0;0;0.45" keyTimes="0;0.999;1"
            dur={DRAW} fill="freeze" repeatCount="1" />
          {/* @ts-ignore */}
          <animate attributeName="stroke-dashoffset"
            from="-50" to={`${-TOTAL - 50}`}
            dur="10s" repeatCount="indefinite" />
        </path>

        {/* ── ALIVE: reverse flowing tip (opposite direction) ── */}
        <path d={dynPath} fill="none" stroke={ORB_TIP} strokeWidth={3}
          strokeLinecap="round" filter="url(#orb-tip-glow)"
          strokeDasharray={`70 ${TOTAL - 70}`} strokeDashoffset={0} opacity={0}>
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="0;0;0.75" keyTimes="0;0.999;1"
            dur={DRAW} fill="freeze" repeatCount="1" />
          {/* @ts-ignore */}
          <animate attributeName="stroke-dashoffset"
            from="0" to={`${TOTAL}`}
            dur="10s" repeatCount="indefinite" />
        </path>

        {/* ── ALIVE: reverse blue trailing segment ── */}
        <path d={dynPath} fill="none" stroke={ORB_BLUE} strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`35 ${TOTAL - 35}`} strokeDashoffset={50} opacity={0}>
          {/* @ts-ignore */}
          <animate attributeName="opacity"
            values="0;0;0.45" keyTimes="0;0.999;1"
            dur={DRAW} fill="freeze" repeatCount="1" />
          {/* @ts-ignore */}
          <animate attributeName="stroke-dashoffset"
            from="50" to={`${TOTAL + 50}`}
            dur="10s" repeatCount="indefinite" />
        </path>

      </g>
    );
  }

  // ── Arc-spine connections (all GGs → sector ring → all sectors) ─────────
  function renderArcSpines() {
    const gmColor = levelColors[1];

    // Stems: each GG → its touch point on the sector ring
    const stems = overviewGMs.map((gg) => {
      const ggAngle = Math.atan2(gg.y, gg.x);
      const sp      = { x: SPINE_R * Math.cos(ggAngle), y: SPINE_R * Math.sin(ggAngle) };
      const dx = sp.x - gg.x;
      const dy = sp.y - gg.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ggEdge = { x: gg.x + (dx / dist) * gg.radius, y: gg.y + (dy / dist) * gg.radius };
      return (
        <line
          key={`${gg.id}-stem`}
          x1={ggEdge.x} y1={ggEdge.y}
          x2={sp.x} y2={sp.y}
          stroke={gmColor}
          strokeWidth={1.5}
          strokeOpacity={0.55}
        />
      );
    });

    // Arcs along the sector ring: from each GG touch point → each sector node.
    // Each arc visually "traverses" the ring to reach the sector.
    const arcs: React.ReactNode[] = [];
    overviewGMs.forEach((gg) => {
      const ggAngle = Math.atan2(gg.y, gg.x);
      const spX = SPINE_R * Math.cos(ggAngle);
      const spY = SPINE_R * Math.sin(ggAngle);

      overviewSectors.forEach((sector) => {
        const sAngle = Math.atan2(sector.y, sector.x);
        let dA = sAngle - ggAngle;
        // Normalise to [-π, π] so we always take the shorter arc
        while (dA >  Math.PI) dA -= 2 * Math.PI;
        while (dA < -Math.PI) dA += 2 * Math.PI;

        const largeArc = Math.abs(dA) > Math.PI ? 1 : 0;
        const sweep    = dA > 0 ? 1 : 0;
        const arcD = `M ${spX} ${spY} A ${SPINE_R} ${SPINE_R} 0 ${largeArc} ${sweep} ${sector.x} ${sector.y}`;

        arcs.push(
          <path
            key={`${gg.id}-${sector.id}-arc`}
            d={arcD}
            fill="none"
            stroke={sector.sectorColor ?? gmColor}
            strokeWidth={1.4}
            strokeOpacity={0.3}
          />,
        );
      });
    });

    // Junction dots: where each GM stem meets the ring
    const gmDots = overviewGMs.map((gg) => {
      const ggAngle = Math.atan2(gg.y, gg.x);
      return (
        <circle
          key={`${gg.id}-junc`}
          cx={SPINE_R * Math.cos(ggAngle)}
          cy={SPINE_R * Math.sin(ggAngle)}
          r={3.5}
          fill={gmColor}
          fillOpacity={0.7}
        />
      );
    });

    // Junction dots: where each sector sits on the ring
    const sectorDots = overviewSectors.map((sector) => (
      <circle
        key={`${sector.id}-sdot`}
        cx={sector.x}
        cy={sector.y}
        r={4}
        fill={sector.sectorColor ?? gmColor}
        fillOpacity={0.65}
      />
    ));

    // Base ring at low opacity as a subtle guide
    const ring = (
      <circle
        key="mgmt-ring"
        cx={0} cy={0} r={SPINE_R}
        fill="none"
        stroke={gmColor}
        strokeWidth={1.2}
        strokeOpacity={0.15}
      />
    );

    return [ring, ...arcs, ...stems, ...gmDots, ...sectorDots];
  }

  // ── Legend entries ─────────────────────────────────────────────────────
  const legendEntries = useMemo(() => {
    if (activeSectorId) {
      return Object.entries(levelNames)
        .map(([lvl, name]) => [Number(lvl), name] as [number, string])
        .filter(([lvl]) => (lvl === 0 || lvl >= 3) && (levelCounts[lvl] ?? 0) > 0);
    }
    // Panorama: mostra apenas níveis de pessoas (0 e 1); setores não são pessoas
    return [[0, levelNames[0]], [1, levelNames[1]]] as [number, string][];
  }, [activeSectorId, levelNames, levelCounts]);

  const sectorCount = useMemo(
    () => (!activeSectorId ? positions.filter((p) => p.isSector).length : 0),
    [activeSectorId, positions],
  );

  const totalPeople = useMemo(() => {
    if (activeSectorId) {
      return Object.values(levelCounts).reduce((s, c) => s + c, 0);
    }
    return allNodes.filter((n) => !n.isSector).length;
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
                        <span className={styles.resultSub}>{n.isSector ? (n.role || 'Setor') : (levelNames[n.level] ?? n.role)}</span>
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
            <span>{sectorCount} setor{sectorCount !== 1 ? 'es' : ''} · Toque para ver a equipe</span>
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

          {/* ── Orbital animation defs ── */}
          <filter id="orb-glow" filterUnits="userSpaceOnUse" x="-480" y="-480" width="960" height="960">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="orb-tip-glow" filterUnits="userSpaceOnUse" x="-480" y="-480" width="960" height="960">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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
            {/* Orbital intro + alive animation */}
            {renderOrbitalAnimation()}
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
              const isSectorDirector = node.level === 4;
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
