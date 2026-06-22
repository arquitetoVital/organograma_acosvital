/**
 * @deprecated Arquivo mantido apenas para compatibilidade retroativa.
 * Importe diretamente de `@/lib/orgRepository` nos novos arquivos.
 */
export {
  fetchAllNodes  as readOrgData,
  insertNode,
  patchNode      as updateNode,
  removeNode     as deleteNode,
} from './orgRepository';
