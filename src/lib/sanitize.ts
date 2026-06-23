const MAX_STR   = 300;
const MAX_URL   = 2048;
const COLOR_RE  = /^#[0-9A-Fa-f]{6}$/;
const URL_RE    = /^https?:\/\/.+/i;
const ID_RE     = /^[\w\-]{1,64}$/;
const CTRL_RE   = /[\x00-\x1f\x7f]/g;

function clean(v: unknown, max = MAX_STR): string {
  if (typeof v !== 'string') return '';
  return v.trim().replace(CTRL_RE, '').slice(0, max);
}

function safeUrl(v: unknown): string {
  const s = clean(v, MAX_URL);
  return s && URL_RE.test(s) ? s : '';
}

function safeId(v: unknown): string {
  const s = clean(v, 64);
  return ID_RE.test(s) ? s : '';
}

function safeColor(v: unknown): string | undefined {
  const s = clean(v, 7);
  return COLOR_RE.test(s) ? s : undefined;
}

function safeLevel(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const l = Math.floor(v);
  return l >= 0 && l <= 11 ? l : null;
}

export interface SanitizedNode {
  id:             string;
  name:           string;
  role:           string;
  level:          number;
  parentId:       string;
  isSector?:      boolean;
  photoUrl?:      string;
  sectorColor?:   string;
  funcionarioId?: string | null;
}

export function sanitizeNode(raw: unknown): SanitizedNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id    = safeId(r.id);
  const level = safeLevel(r.level);

  if (!id || level === null) return null;

  const node: SanitizedNode = {
    id,
    name:     clean(r.name, 200),
    role:     clean(r.role, 150),
    level,
    parentId: safeId(r.parentId),
  };

  if (r.isSector        !== undefined) node.isSector       = Boolean(r.isSector);
  if (r.photoUrl        !== undefined) node.photoUrl       = safeUrl(r.photoUrl);
  if (r.sectorColor     !== undefined) node.sectorColor    = safeColor(r.sectorColor);
  if (r.funcionarioId   !== undefined) node.funcionarioId  = r.funcionarioId ? safeId(r.funcionarioId) : null;

  return node;
}

export function sanitizePatch(raw: unknown): Partial<SanitizedNode> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const p: Partial<SanitizedNode> = {};

  if (r.name        !== undefined) p.name        = clean(r.name, 200);
  if (r.role        !== undefined) p.role        = clean(r.role, 150);
  if (r.photoUrl    !== undefined) p.photoUrl    = safeUrl(r.photoUrl);
  if (r.parentId    !== undefined) p.parentId    = safeId(r.parentId);
  if (r.isSector    !== undefined) p.isSector    = Boolean(r.isSector);
  if (r.sectorColor !== undefined) p.sectorColor = safeColor(r.sectorColor);
  if (r.funcionarioId !== undefined) p.funcionarioId = r.funcionarioId ? safeId(r.funcionarioId) : null;
  if (r.level       !== undefined) {
    const l = safeLevel(r.level);
    if (l !== null) p.level = l;
  }

  return Object.keys(p).length > 0 ? p : null;
}
