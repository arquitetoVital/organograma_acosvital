/**
 * Paleta de cores disponíveis para setores e sub-setores.
 * Usada nos seletores de cor dos modais de criação/edição.
 */
export const SECTOR_COLOR_PALETTE: readonly string[] = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
  '#22d3ee', '#60a5fa', '#818cf8', '#c084fc', '#f472b6',
  '#fb7185', '#4ade80', '#2dd4bf', '#38bdf8', '#a78bfa',
  '#e879f9', '#facc15', '#86efac',
] as const;

/** Cor padrão para novos setores quando nenhuma é selecionada. */
export const DEFAULT_SECTOR_COLOR = SECTOR_COLOR_PALETTE[0];
