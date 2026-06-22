/**
 * Classificação geográfica de pontos (clientes/unidades) por região do Brasil.
 *
 * A região é derivada da sigla de UF presente no endereço (formato Omie:
 * "Cidade, UF, Brasil"). Pontos sem UF reconhecível caem em "Outras".
 */

export type RegionKey = 'N' | 'NE' | 'CO' | 'SE' | 'S' | 'OUT';

export interface RegionMeta {
  key:   RegionKey;
  label: string;
  color: string;
}

/** Ordem e metadados de exibição das regiões. */
export const REGIONS: RegionMeta[] = [
  { key: 'N',  label: 'Norte',        color: '#22d3ee' },
  { key: 'NE', label: 'Nordeste',     color: '#f59e0b' },
  { key: 'CO', label: 'Centro-Oeste', color: '#a3e635' },
  { key: 'SE', label: 'Sudeste',      color: '#f87171' },
  { key: 'S',  label: 'Sul',          color: '#818cf8' },
  { key: 'OUT', label: 'Outras',      color: '#94a3b8' },
];

export const REGION_LABEL: Record<RegionKey, string> =
  Object.fromEntries(REGIONS.map((r) => [r.key, r.label])) as Record<RegionKey, string>;

export const REGION_COLOR: Record<RegionKey, string> =
  Object.fromEntries(REGIONS.map((r) => [r.key, r.color])) as Record<RegionKey, string>;

const UF_TO_REGION: Record<string, RegionKey> = {
  AC: 'N', AP: 'N', AM: 'N', PA: 'N', RO: 'N', RR: 'N', TO: 'N',
  AL: 'NE', BA: 'NE', CE: 'NE', MA: 'NE', PB: 'NE', PE: 'NE', PI: 'NE', RN: 'NE', SE: 'NE',
  DF: 'CO', GO: 'CO', MT: 'CO', MS: 'CO',
  ES: 'SE', MG: 'SE', RJ: 'SE', SP: 'SE',
  PR: 'S', RS: 'S', SC: 'S',
};

const UF_SET = new Set(Object.keys(UF_TO_REGION));

/** Extrai a UF de um endereço (última sigla válida encontrada). */
export function ufFromAddress(address: string): string | null {
  const tokens = address.match(/\b[A-Z]{2}\b/g);
  if (!tokens) return null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (UF_SET.has(tokens[i])) return tokens[i];
  }
  return null;
}

/** Classifica um endereço numa região do Brasil. */
export function regionFromAddress(address: string): RegionKey {
  const uf = ufFromAddress(address);
  return uf ? UF_TO_REGION[uf] : 'OUT';
}
