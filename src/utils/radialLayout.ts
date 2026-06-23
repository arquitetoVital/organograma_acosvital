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
