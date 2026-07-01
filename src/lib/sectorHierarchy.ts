import { fetchAllPages, apiPut, apiPost, ApiError } from './apiClient';

interface FuncBasic  { id: string; id_setor: string; id_cargo: string; }
interface CargoBasic { id: string; nvl_permissao: number; }

// Apenas funcionários de nível de setor (nvl >= 4) entram na hierarquia automática.
// Níveis 0-1 (Diretor/GM) são raízes globais; 2-3 são nós estruturais de setor.
const MIN_SECTOR_LEVEL = 4;

function computeParents(
  employees: Array<{ id: string; nvl: number }>,
  sectorId: string,
): Map<string, string> {
  const eligible = employees.filter(e => e.nvl >= MIN_SECTOR_LEVEL);
  const result   = new Map<string, string>();

  // Agrupa por nível; dentro de cada nível ordena por id para determinismo
  const byLevel = new Map<number, Array<{ id: string; nvl: number }>>();
  for (const e of eligible) {
    if (!byLevel.has(e.nvl)) byLevel.set(e.nvl, []);
    byLevel.get(e.nvl)!.push(e);
  }
  for (const group of byLevel.values()) group.sort((a, b) => a.id.localeCompare(b.id));

  // Níveis em ordem crescente: menor nvl = cargo mais alto
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  for (let i = 0; i < levels.length; i++) {
    const group     = byLevel.get(levels[i])!;
    // Superior imediato = nível anterior na lista (o mais próximo acima)
    const superiors = i > 0 ? byLevel.get(levels[i - 1])! : [];

    if (superiors.length === 0) {
      // Nível mais alto do setor → reporta direto ao setor
      for (const emp of group) result.set(emp.id, sectorId);
    } else {
      // Distribui em round-robin para equilibrar a carga entre os superiores
      group.forEach((emp, idx) => result.set(emp.id, superiors[idx % superiors.length].id));
    }
  }

  return result;
}

/**
 * Recomputa quem cada funcionário de nível de setor (nvl >= 4) reporta dentro do setor.
 * - Cargo mais alto do setor → reporta ao setor (parent_id = sectorId)
 * - Demais → reportam ao superior imediato (cargo mais alto abaixo do deles no setor)
 *
 * Atualiza os org nodes via apiPut (exceto o de `includeNew`, que ainda não foi criado).
 *
 * @param sectorId       UUID do setor a recomputar
 * @param opts.excludeId Funcionário a excluir do cálculo (ex.: está sendo deletado)
 * @param opts.includeNew Novo funcionário cujo org node ainda não foi criado
 */
export async function recomputeSectorHierarchy(
  sectorId: string,
  opts: {
    excludeId?: string;
    includeNew?: { id: string; nvl: number };
  } = {},
): Promise<Map<string, string>> {
  const [allFuncs, cargos] = await Promise.all([
    fetchAllPages<FuncBasic>('/funcionarios', 'funcionarios'),
    fetchAllPages<CargoBasic>('/cargos', 'cargos'),
  ]);

  const cargoMap = new Map(cargos.map(c => [c.id, c.nvl_permissao]));

  const employees = allFuncs
    .filter(f =>
      f.id_setor === sectorId &&
      f.id !== opts.excludeId &&
      (!opts.includeNew || f.id !== opts.includeNew.id),
    )
    .map(f => ({ id: f.id, nvl: cargoMap.get(f.id_cargo) ?? 99 }));

  if (opts.includeNew) employees.push(opts.includeNew);

  const parentMap = computeParents(employees, sectorId);

  // Atualiza apenas funcionários com org node existente (exclui o recém-criado)
  const toUpdate = opts.includeNew
    ? Array.from(parentMap.entries()).filter(([id]) => id !== opts.includeNew!.id)
    : Array.from(parentMap.entries());

  await Promise.allSettled(
    toUpdate.map(([empId, parentId]) =>
      apiPut(`/organograma_nodes/${empId}`, { parent_id: parentId }).catch(async (e) => {
        // Se o nó não existir, recria-o
        if (e instanceof ApiError && e.status === 404) {
          await apiPost('/organograma_nodes', {
            id: empId, id_ent: empId, parent_id: parentId, is_sector: false,
          });
        }
      }),
    ),
  );

  return parentMap;
}
