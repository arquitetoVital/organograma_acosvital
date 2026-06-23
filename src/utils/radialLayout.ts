import { OrgNode, PositionedNode, Connection } from '@/types/orgChart';

// ── Overview ring radii (used for the 3-level initial view) ────────────
export const OVERVIEW_RING_RADII: Record<number, number> = {
  0: 0,    // Diretoria (center)
  1: 190,  // Gerência Geral (5 nodes)
  2: 430,  // Setores (18 nodes)
};

// ── Sector detail ring radii (BFS depth from sector node) ─────────────
export const SECTOR_RING_RADII: Record<number, number> = {
  0: 0,     // sector card (center)
  1: 150,   // Diretor de Setor  (level 4)
  2: 300,   // Gerente de Setor  (level 5)
  3: 475,   // Coordenadores     (level 6)
  4: 665,   // Supervisores      (level 7)
  5: 875,   // Líderes           (level 8)
  6: 1105,  // Analistas         (level 9)
  7: 1345,  // Assistentes       (level 10)
  8: 1590,  // Aprendizes        (level 11)
};

// ── Node visual radii for overview ────────────────────────────────────
export const OVERVIEW_NODE_RADIUS: Record<number, number> = {
  0: 78,  // directors center card
  1: 28,  // GMs
  2: 36,  // sector cards (bigger — show names)
};

// ── Node visual radii for sector detail (keyed by BFS depth) ──────────
export const SECTOR_NODE_RADIUS: Record<number, number> = {
  0: 52,  // sector card at center
  1: 38,  // gerente de setor
  2: 30,  // coordenadores
  3: 25,  // supervisores
  4: 21,  // líderes
  5: 18,  // analistas
  6: 15,  // assistentes
  7: 12,  // aprendizes
};

// ── Helpers ────────────────────────────────────────────────────────────
function countLeaves(nodeId: string, childrenOf: Map<string, OrgNode[]>): number {
  const kids = childrenOf.get(nodeId);
  if (!kids || kids.length === 0) return 1;
  return kids.reduce((sum, kid) => sum + countLeaves(kid.id, childrenOf), 0);
}

/** Return the sector node + every descendant (BFS). */
export function getSubtree(rootId: string, allNodes: OrgNode[]): OrgNode[] {
  const childrenOf = new Map<string, OrgNode[]>();
  allNodes.forEach((n) => {
    if (!n.parentId) return;
    if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
    childrenOf.get(n.parentId)!.push(n);
  });

  const idMap = new Map(allNodes.map((n) => [n.id, n]));
  const result: OrgNode[] = [];
  const queue: string[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const node = idMap.get(id);
    if (!node) continue;
    result.push(node);
    childrenOf.get(id)?.forEach((c) => queue.push(c.id));
  }
  return result;
}

// ── Layout ─────────────────────────────────────────────────────────────
export function calculateLayout(
  nodes: OrgNode[],
  ringRadii: Record<number, number> = OVERVIEW_RING_RADII,
  nodeRadii: Record<number, number> = OVERVIEW_NODE_RADIUS,
  // Optional: override which ring a node goes to (e.g. level-based instead of BFS depth)
  getDepth?: (node: OrgNode, bfsDepth: number) => number,
): PositionedNode[] {
  const childrenOf = new Map<string, OrgNode[]>();
  nodes.forEach((n) => {
    if (!n.parentId) return;
    if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
    childrenOf.get(n.parentId)!.push(n);
  });

  const maxDefinedDepth = Math.max(...Object.keys(nodeRadii).map(Number));
  function getNodeR(depth: number) {
    return nodeRadii[depth] ?? nodeRadii[maxDefinedDepth] ?? 8;
  }
  function getRingR(depth: number): number {
    if (ringRadii[depth] !== undefined) return ringRadii[depth];
    const maxRing = Math.max(...Object.keys(ringRadii).map(Number));
    return ringRadii[maxRing] + 200 * (depth - maxRing);
  }

  const result: PositionedNode[] = [];
  const START = -Math.PI / 2;

  // When getDepth is provided, roots whose computed depth ≠ 0 should go into
  // the BFS at their correct ring (e.g. orphaned GMs with parentId=null, level=1).
  const allRoots = nodes.filter((n) => !n.parentId);
  const trueRoots    = getDepth ? allRoots.filter((n) => getDepth(n, 0) === 0) : allRoots;
  const orphanRoots  = getDepth ? allRoots.filter((n) => getDepth(n, 0) !== 0) : [];

  // True roots at center
  trueRoots.forEach((root) => {
    result.push({ ...root, x: 0, y: 0, angle: 0, radius: getNodeR(0) });
  });

  // BFS for depth 1+: children of true roots + orphaned roots treated as depth-1 nodes
  const level1 = [
    ...trueRoots.flatMap((r) => childrenOf.get(r.id) ?? []),
    ...orphanRoots,
  ];
  if (level1.length === 0) return result;

  const totalLeaves = level1.reduce((s, n) => s + countLeaves(n.id, childrenOf), 0);

  interface QItem { node: OrgNode; depth: number; sa: number; ea: number }

  let cursor = START;
  const queue: QItem[] = level1.map((n) => {
    const leaves = countLeaves(n.id, childrenOf);
    const arc = 2 * Math.PI * (leaves / Math.max(totalLeaves, 1));
    const item: QItem = { node: n, depth: 1, sa: cursor, ea: cursor + arc };
    cursor += arc;
    return item;
  });

  while (queue.length) {
    const { node, depth, sa, ea } = queue.shift()!;
    // Use custom depth for ring/radius; BFS depth (depth+1) still drives arc splitting for children
    const d = getDepth ? getDepth(node, depth) : depth;
    const angle = (sa + ea) / 2;
    const r = getRingR(d);
    result.push({ ...node, x: Math.cos(angle) * r, y: Math.sin(angle) * r, angle, radius: getNodeR(d) });

    const kids = childrenOf.get(node.id) ?? [];
    if (!kids.length) continue;
    const kidLeaves = kids.map((k) => countLeaves(k.id, childrenOf));
    const totalKL = Math.max(kidLeaves.reduce((s, l) => s + l, 0), 1);
    const arc = ea - sa;
    let kc = sa;
    kids.forEach((kid, i) => {
      const ka = arc * (kidLeaves[i] / totalKL);
      queue.push({ node: kid, depth: depth + 1, sa: kc, ea: kc + ka });
      kc += ka;
    });
  }

  return result;
}

// ── Overview layout (level-based even distribution) ───────────────────
/**
 * Places overview nodes evenly around their level ring.
 * All nodes at the same level share the full 360°, independent of tree structure.
 * This allows all sectors to spread evenly regardless of which GM they belong to,
 * and ensures orphaned nodes (parentId=null) land on the correct ring by level.
 */
export function calculateOverviewLayout(
  nodes: OrgNode[],
  ringRadii: Record<number, number> = OVERVIEW_RING_RADII,
  nodeRadii: Record<number, number> = OVERVIEW_NODE_RADIUS,
): PositionedNode[] {
  const START = -Math.PI / 2;
  const result: PositionedNode[] = [];

  const byLevel = new Map<number, OrgNode[]>();
  nodes.forEach((n) => {
    if (!byLevel.has(n.level)) byLevel.set(n.level, []);
    byLevel.get(n.level)!.push(n);
  });

  const maxDefinedR = Math.max(...Object.keys(nodeRadii).map(Number));

  [...byLevel.keys()].sort((a, b) => a - b).forEach((level) => {
    const levelNodes = byLevel.get(level)!;
    const r      = ringRadii[level] ?? 0;
    const nodeR  = nodeRadii[level] ?? nodeRadii[maxDefinedR] ?? 8;
    const count  = levelNodes.length;

    if (r === 0) {
      // Center ring (directors)
      levelNodes.forEach((n) =>
        result.push({ ...n, x: 0, y: 0, angle: 0, radius: nodeR }),
      );
      return;
    }

    const step = (2 * Math.PI) / count;
    levelNodes.forEach((n, i) => {
      const angle = START + step * i;
      result.push({
        ...n,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        angle,
        radius: nodeR,
      });
    });
  });

  return result;
}

// ── Sector detail: hierarchy-aware even distribution ───────────────────
/**
 * Layout for the sector detail view.
 *
 * Rules:
 *  - Compressed level→ring mapping: only levels actually present get
 *    consecutive rings (1, 2, 3…). If a sub-sector has only a Coordenador
 *    (level 6) and no Gerente (level 5), the Coordenador appears at ring 1
 *    (closest to center) instead of leaving rings 1–2 empty.
 *  - Dynamic ring radius: if a ring has many nodes the radius is expanded
 *    to guarantee minimum spacing, preventing crowding when many people
 *    are compressed into a single level.
 *  - Node visual size still uses the absolute level→ring mapping so
 *    Aprendizes remain small regardless of which compressed ring they occupy.
 *  - Sub-sectors (isSector=true) go to ring 1 and are NOT expanded —
 *    their people are revealed only when the user drills into them.
 *  - Rings 2+ are sorted by effective parent angle and distribution starts
 *    at that angle, so children always appear near their leader.
 */
export function calculateEvenSectorLayout(
  nodes: OrgNode[],
  sectorId: string,
  ringRadii: Record<number, number> = SECTOR_RING_RADII,
  nodeRadii: Record<number, number> = SECTOR_NODE_RADIUS,
): PositionedNode[] {
  const START = -Math.PI / 2;
  const PI2   = 2 * Math.PI;
  const MIN_GAP    = 6;  // minimum gap between node edges (SVG units)
  const LEVEL_BASE = 3;  // for visual radius: nodeRadii[level - LEVEL_BASE]

  const maxDefinedNodeR = Math.max(...Object.keys(nodeRadii).map(Number));
  // Visual radius is keyed by absolute ring (level − LEVEL_BASE) so small
  // nodes stay small even when compressed to an inner ring.
  const visualR = (node: OrgNode): number => {
    if (node.id === sectorId) return nodeRadii[0] ?? 52;
    if (node.isSector)        return nodeRadii[1] ?? 38;
    const absRing = Math.max(1, node.level - LEVEL_BASE);
    return nodeRadii[absRing] ?? nodeRadii[maxDefinedNodeR] ?? 8;
  };

  // ── Build full children map ──
  const childrenOf = new Map<string, OrgNode[]>();
  nodes.forEach((n) => {
    if (!n.parentId) return;
    if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
    childrenOf.get(n.parentId)!.push(n);
  });

  // ── Mark descendants of direct sub-sectors as hidden (drill-down) ──
  const directSubSectorIds = new Set(
    (childrenOf.get(sectorId) ?? []).filter((n) => n.isSector).map((n) => n.id),
  );
  const hiddenIds = new Set<string>();
  function markHidden(id: string) {
    for (const c of childrenOf.get(id) ?? []) {
      hiddenIds.add(c.id);
      markHidden(c.id);
    }
  }
  directSubSectorIds.forEach((id) => markHidden(id));

  // ── Build COMPRESSED level→ring mapping (only present levels get rings) ──
  const presentLevels = new Set<number>();
  function collectLevels(id: string) {
    for (const c of childrenOf.get(id) ?? []) {
      if (hiddenIds.has(c.id)) continue;
      if (!c.isSector) presentLevels.add(c.level);
      collectLevels(c.id);
    }
  }
  collectLevels(sectorId);
  const levelToRing = new Map(
    [...presentLevels].sort((a, b) => a - b).map((lvl, i) => [lvl, i + 1]),
  );
  const getRing = (n: OrgNode) => n.isSector ? 1 : (levelToRing.get(n.level) ?? 1);

  // ── Collect visible nodes per ring in DFS order ──
  const ringCollect = new Map<number, OrgNode[]>();
  function dfs(id: string) {
    for (const child of childrenOf.get(id) ?? []) {
      if (hiddenIds.has(child.id)) continue;
      const ring = getRing(child);
      if (!ringCollect.has(ring)) ringCollect.set(ring, []);
      ringCollect.get(ring)!.push(child);
      dfs(child.id);
    }
  }
  dfs(sectorId);

  // ── Dynamic ring radius: expand if node count demands minimum spacing ──
  const dynamicRingR = new Map<number, number>();
  ringCollect.forEach((ringNodes, ring) => {
    const staticR = ringRadii[ring] ?? (ring * 200);
    const maxVR   = Math.max(...ringNodes.map((n) => visualR(n)));
    const minR    = (ringNodes.length * (2 * maxVR + MIN_GAP)) / PI2;
    dynamicRingR.set(ring, Math.max(staticR, minR));
  });

  const result: PositionedNode[] = [];
  const angleOf = new Map<string, number>();

  // ── Sector at center ──
  const sectorNode = nodes.find((n) => n.id === sectorId);
  if (sectorNode) {
    result.push({ ...sectorNode, parentId: null, x: 0, y: 0, angle: 0, radius: visualR(sectorNode) });
  }
  angleOf.set(sectorId, 0);

  // Ring-1 people — used to infer visual parent angle for flat-hierarchy nodes
  const ring1People: { level: number; angle: number }[] = [];

  // Effective parent angle: flat-hierarchy nodes (parentId = sectorId) anchor
  // to the ring-1 person with the highest level ≤ their own level so that
  // a Gerente appears radially below its Diretor even when both report
  // directly to the sector in the database.
  const effectiveAngle = (node: OrgNode): number => {
    if (node.parentId !== sectorId) return angleOf.get(node.parentId!) ?? START;
    if (ring1People.length > 0) {
      const cands = ring1People.filter((p) => p.level <= node.level);
      return cands.length > 0
        ? cands.reduce((b, p) => (p.level > b.level ? p : b)).angle
        : ring1People.reduce((b, p) => (p.level < b.level ? p : b)).angle;
    }
    return START;
  };

  // Tracks placed nodes per ring so ring N+1 can find its nearest parent in ring N
  const placedByRing = new Map<number, Array<{ id: string; angle: number }>>();

  // ── Place each ring ──
  [...ringCollect.keys()].sort((a, b) => a - b).forEach((ring) => {
    const ringNodes = ringCollect.get(ring)!;
    const r    = dynamicRingR.get(ring)!;
    const step = PI2 / ringNodes.length;
    const norm = (θ: number) => ((θ - START + PI2 * 2) % PI2);

    const ringPlaced: Array<{ id: string; angle: number }> = [];

    // Compute (node, angle) pairs: ring-1 evenly from START; ring 2+ centered
    // on each parent so that if a parent has 4 children, it appears exactly in
    // the middle of those 4 (not at the edge of the group).
    let nodeAngles: Array<{ node: OrgNode; angle: number }>;

    if (ring === 1) {
      nodeAngles = ringNodes.map((node, i) => ({ node, angle: START + step * i }));
    } else {
      // Sort all nodes by effective parent angle
      ringNodes.sort((a, b) => norm(effectiveAngle(a)) - norm(effectiveAngle(b)));

      // Group consecutive nodes that share the same effective parent angle
      const groups: Array<{ parentAngle: number; nodes: OrgNode[] }> = [];
      ringNodes.forEach((node) => {
        const pa  = effectiveAngle(node);
        const last = groups[groups.length - 1];
        if (last && Math.abs(norm(pa) - norm(last.parentAngle)) < 0.001) {
          last.nodes.push(node);
        } else {
          groups.push({ parentAngle: pa, nodes: [node] });
        }
      });

      // Place each group CENTERED on its parent angle:
      // child i of K children → parentAngle + (i − (K−1)/2) × step
      nodeAngles = [];
      groups.forEach(({ parentAngle, nodes: grp }) => {
        const k = grp.length;
        grp.forEach((node, i) => {
          nodeAngles.push({ node, angle: parentAngle + (i - (k - 1) / 2) * step });
        });
      });
    }

    nodeAngles.forEach(({ node, angle }) => {
      // For flat-hierarchy nodes at ring > 1, infer visual parent as the
      // closest-angle node in the ring immediately above so connections form a
      // proper chain instead of a star radiating from the sector centre.
      let visualParentId = node.parentId;
      if (ring > 1 && node.parentId === sectorId) {
        const prev = placedByRing.get(ring - 1) ?? [];
        if (prev.length > 0) {
          const myN = norm(angle);
          visualParentId = prev.reduce((best, c) => {
            const dc = Math.min(Math.abs(norm(c.angle) - myN), PI2 - Math.abs(norm(c.angle) - myN));
            const db = Math.min(Math.abs(norm(best.angle) - myN), PI2 - Math.abs(norm(best.angle) - myN));
            return dc < db ? c : best;
          }).id;
        }
      }

      const vr = visualR(node);
      result.push({
        ...node,
        parentId: visualParentId,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        angle,
        radius: vr,
      });
      angleOf.set(node.id, angle);
      ringPlaced.push({ id: node.id, angle });
      if (ring === 1 && !node.isSector) ring1People.push({ level: node.level, angle });
    });

    placedByRing.set(ring, ringPlaced);
  });

  return result;
}

// ── Connections ────────────────────────────────────────────────────────
export function calculateConnections(positions: PositionedNode[]): Connection[] {
  const posMap = new Map(positions.map((p) => [p.id, p]));
  const connections: Connection[] = [];

  positions.forEach((node) => {
    if (!node.parentId) return;
    const parent = posMap.get(node.parentId);
    if (!parent) return;
    const dx = node.x - parent.x;
    const dy = node.y - parent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    connections.push({
      fromId: parent.id,
      toId: node.id,
      fromX: parent.x + nx * parent.radius,
      fromY: parent.y + ny * parent.radius,
      toX: node.x - nx * node.radius,
      toY: node.y - ny * node.radius,
      level: node.level,
    });
  });

  return connections;
}
