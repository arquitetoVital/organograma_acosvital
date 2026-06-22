/**
 * Configuração estática dos níveis hierárquicos do organograma.
 *
 * Nível 0 = Diretoria (topo)
 * Nível 1 = Gerência Geral
 * Nível 2 = Setor (nó estrutural, não é pessoa)
 * Níveis 3–9 = cargos dentro de setores, em ordem decrescente de senioridade
 */
export const levelNames: Record<number, string> = {
  0: 'Diretoria',
  1: 'Gerência Geral',
  2: 'Setor',
  3: 'Gerência de Setor',
  4: 'Coordenação',
  5: 'Supervisão',
  6: 'Liderança',
  7: 'Analista / Técnico',
  8: 'Assistente / Auxiliar',
  9: 'Aprendiz',
};

export const levelColors: Record<number, string> = {
  0: '#f59e0b',
  1: '#3b82f6',
  2: '#a78bfa',
  3: '#6366f1',
  4: '#8b5cf6',
  5: '#d946ef',
  6: '#ec4899',
  7: '#10b981',
  8: '#14b8a6',
  9: '#06b6d4',
};
