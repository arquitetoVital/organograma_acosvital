'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Avatar from '@/components/ui/Avatar';
import PersonModal      from '@/components/Admin/modals/PersonModal';
import NodeEditModal    from '@/components/Admin/modals/NodeEditModal';
import AddSectorModal, { AddSubSectorModal } from '@/components/Admin/modals/AddSectorModal';
import DirectorModal    from '@/components/Admin/modals/DirectorModal';
import CreateManagerModal from '@/components/Admin/modals/CreateManagerModal';
import { deleteOrgNode, updateOrgNode } from '@/lib/orgApi';
import { cachedFetch, invalidateCache, isCacheHit, CACHE_KEYS, CACHE_TTL } from '@/lib/dataCache';
import { countSectorMembers } from '@/lib/nodeUtils';
import { useToast }         from '@/hooks/useToast';
import { useSyncIds }       from '@/hooks/useSyncIds';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { levelNames, levelColors } from '@/data/orgData';
import type { OrgNode } from '@/types/orgChart';
import styles from '../page.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────

/** Configuração do drawer lateral (painel de detalhe de um setor). */
interface SectorDrawerData {
  sector:     OrgNode;
  /** Pessoas diretamente no setor (não em sub-setores). */
  directMembers: OrgNode[];
  /** Pessoas agrupadas por sub-setor. */
  membersBySubSector: Map<string, OrgNode[]>;
  subSectors: OrgNode[];
  /** Pessoas diretas agrupadas por nível hierárquico. */
  directMembersByLevel: Record<number, OrgNode[]>;
}

/**
 * Chave em localStorage que marca uma importação do RH em andamento.
 * Guarda o timestamp de início; é removida ao concluir/cancelar/falhar.
 * Sobrevive a F5: se a página recarregar no meio da importação, o marcador
 * permanece e a importação (idempotente) é retomada no próximo mount.
 */
const IMPORT_FLAG_KEY = 'org:importing';
/** Janela de validade do marcador — evita retomar uma importação muito antiga. */
const IMPORT_RESUME_WINDOW_MS = 15 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Editor completo do organograma — gerencia Diretorias, Gerências Gerais,
 * Setores, Sub-setores e Pessoas com atualização otimista e sincronização
 * em tempo real via Supabase Realtime.
 */
export default function OrganogramaEditor() {
  // ── Dados ────────────────────────────────────────────────────────────────
  const [nodes,       setNodes]       = useState<OrgNode[]>([]);
  const [isLoading,   setIsLoading]   = useState(
    () => !isCacheHit(CACHE_KEYS.ORG, CACHE_TTL.ORG),
  );
  const [isImporting, setIsImporting] = useState(false);
  const importAbortRef = useRef<AbortController | null>(null);

  // ── Hooks reutilizáveis ──────────────────────────────────────────────────
  const { toast,         showToast }         = useToast();
  const { syncingIds, deletingIds, markSyncing, unmarkSyncing, markDeleting, unmarkDeleting } = useSyncIds();
  const { confirmDialog, openConfirmDialog, closeConfirmDialog } = useConfirmDialog();

  // ── Estado dos modais ────────────────────────────────────────────────────
  const [openSectorId,            setOpenSectorId]            = useState<string | null>(null);
  const [isAddDirectorOpen,       setIsAddDirectorOpen]       = useState(false);
  const [directorBeingEdited,     setDirectorBeingEdited]     = useState<OrgNode | null>(null);
  const [isAddManagerOpen,        setIsAddManagerOpen]        = useState(false);
  const [nodeBeingEdited,         setNodeBeingEdited]         = useState<OrgNode | null>(null);
  const [activeSectorForNewPerson, setActiveSectorForNewPerson] = useState<string | null>(null);
  const [personBeingEdited,       setPersonBeingEdited]       = useState<OrgNode | null>(null);
  const [managerIdForNewSector,   setManagerIdForNewSector]   = useState<string | null>(null);
  const [sectorIdForNewSubSector, setSectorIdForNewSubSector] = useState<string | null>(null);
  const [reassigningOrphan,       setReassigningOrphan]       = useState<OrgNode | null>(null);

  // ── Dados derivados ──────────────────────────────────────────────────────
  const nodeMap = useMemo(
    () => new Map(nodes.map(n => [n.id, n])),
    [nodes],
  );

  const directors = useMemo(
    () => nodes.filter(n => n.level === 0),
    [nodes],
  );

  const generalManagers = useMemo(() => {
    const directorIds = new Set(directors.map(d => d.id));
    return nodes.filter(n => n.level === 1 && !!n.parentId && directorIds.has(n.parentId));
  }, [nodes, directors]);

  const allSectors = useMemo(
    () => nodes.filter(n => n.isSector),
    [nodes],
  );

  /** Todos os setores de nível 2. */
  const allTopLevelSectors = useMemo(
    () => allSectors.filter(s => s.level === 2),
    [allSectors],
  );

  /** Nós que perderam o pai e estão pendentes de reatribuição (parentId vazio, level > 0). */
  const orphanedNodes = useMemo(
    () => nodes.filter(n => n.level > 0 && !n.parentId),
    [nodes],
  );

  /** Estatísticas gerais para a barra de topo. */
  const orgStats = useMemo(() => {
    const people   = nodes.filter(n => !n.isSector);
    const byLevel  = people.reduce<Record<number, number>>((acc, p) => {
      acc[p.level] = (acc[p.level] ?? 0) + 1;
      return acc;
    }, {});
    return { total: people.length, byLevel };
  }, [nodes]);

  /** Dados completos do setor cujo drawer está aberto. */
  const openSectorDrawer = useMemo((): SectorDrawerData | null => {
    if (!openSectorId) return null;
    const sector = nodeMap.get(openSectorId);
    if (!sector) return null;

    const subtreeIds = new Set<string>();
    const collectIds = (id: string) => {
      subtreeIds.add(id);
      nodes.filter(n => n.parentId === id).forEach(c => collectIds(c.id));
    };
    collectIds(openSectorId);

    const allMembers  = nodes.filter(n => subtreeIds.has(n.id) && !n.isSector && n.id !== openSectorId);
    const subSectors  = nodes.filter(n => n.parentId === openSectorId && n.isSector);
    const subSectorIdSet = new Set(subSectors.map(s => s.id));

    const directMembers: OrgNode[]             = [];
    const membersBySubSector = new Map<string, OrgNode[]>(subSectors.map(s => [s.id, []]));

    for (const person of allMembers) {
      let ownerSubSectorId: string | null = null;
      let current: OrgNode | undefined    = person;

      // Sobe na árvore até encontrar o sub-setor dono (ou o setor raiz)
      while (current?.parentId) {
        const parent = nodeMap.get(current.parentId);
        if (!parent) break;
        if (parent.id === openSectorId) break;
        if (parent.isSector && subSectorIdSet.has(parent.id)) {
          ownerSubSectorId = parent.id;
          break;
        }
        current = parent;
      }

      if (ownerSubSectorId) {
        membersBySubSector.get(ownerSubSectorId)!.push(person);
      } else {
        directMembers.push(person);
      }
    }

    const directMembersByLevel = directMembers.reduce<Record<number, OrgNode[]>>((acc, p) => {
      (acc[p.level] ??= []).push(p);
      return acc;
    }, {});

    return { sector, directMembers, membersBySubSector, subSectors, directMembersByLevel };
  }, [openSectorId, nodes, nodeMap]);

  // ── Busca de dados ───────────────────────────────────────────────────────
  // forceRefresh=true é usado após mutações (delete, import) para bypassar cache
  const refreshNodes = useCallback(async (forceRefresh = false) => {
    const key = CACHE_KEYS.ORG;
    const ttl = CACHE_TTL.ORG;
    if (forceRefresh) invalidateCache(key);
    try {
      const data = await cachedFetch<OrgNode[]>(
        key,
        () => fetch('/api/org').then(r => r.json()),
        ttl,
      );
      setNodes(Array.isArray(data) ? data : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshNodes(); }, [refreshNodes]);


  // ── Ações de dados ───────────────────────────────────────────────────────

  /** Exibe um diálogo de confirmação e executa a exclusão após confirmação. */
  function requestDeleteNode(nodeId: string, nodeLabel: string) {
    if (deletingIds.has(nodeId)) return;

    const node         = nodeMap.get(nodeId);
    const isSector     = node?.isSector ?? false;
    const hasChildren  = nodes.some(n => n.parentId === nodeId);

    let message: string;
    if (isSector && hasChildren) {
      message = `Excluir "${nodeLabel}" manterá os sub-setores e pessoas abaixo como pendentes de reatribuição.`;
    } else if (!isSector && hasChildren) {
      message = `Excluir "${nodeLabel}" vai remover apenas esta pessoa. A equipe abaixo será promovida ao cargo superior automaticamente.`;
    } else {
      message = `Tem certeza que deseja excluir "${nodeLabel}"? Essa ação não pode ser desfeita.`;
    }

    openConfirmDialog({
      title:   'Confirmar exclusão',
      message,
      onConfirm: async () => {
        closeConfirmDialog();
        markDeleting(nodeId);
        try {
          await deleteOrgNode(nodeId);
          // Fecha o drawer se o setor excluído estava aberto
          if (openSectorId === nodeId) setOpenSectorId(null);
          await refreshNodes(true);
          showToast('Excluído com sucesso.');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
        } finally {
          unmarkDeleting(nodeId);
        }
      },
    });
  }

  // ── Targets elegíveis para reatribuição de nó órfão ─────────────────────
  const orphanReassignTargets = useMemo((): OrgNode[] => {
    if (!reassigningOrphan) return [];
    // GM → precisa de uma diretoria como pai
    if (reassigningOrphan.level === 1 && !reassigningOrphan.isSector) return directors;
    // Setor → precisa de um GM como pai
    if (reassigningOrphan.isSector && reassigningOrphan.level === 2) return generalManagers;
    // Sub-setor → precisa de um setor como pai
    if (reassigningOrphan.isSector) return allTopLevelSectors;
    // Pessoa → qualquer setor ou sub-setor
    return allSectors;
  }, [reassigningOrphan, directors, generalManagers, allTopLevelSectors, allSectors]);

  // ── Callback: ao criar diretoria, vincula GGs órfãos a ela ──────────────
  const handleDirectorCreated = useCallback(async (newDirectorId: string) => {
    const orphaned = nodes.filter(n => n.level === 1 && !n.isSector && !n.parentId);
    if (orphaned.length === 0) return;
    await Promise.all(orphaned.map(n => updateOrgNode(n.id, { parentId: newDirectorId })));
  }, [nodes]);

  // ── Callback: ao criar GG, vincula setores que ficaram sem gerente ───────
  const handleManagerCreated = useCallback(async (newManagerId: string) => {
    const orphaned = allTopLevelSectors.filter(s => !s.parentId);
    if (orphaned.length === 0) return;
    await Promise.all(orphaned.map(s => updateOrgNode(s.id, { parentId: newManagerId })));
  }, [allTopLevelSectors]);

  // ── Importação do RH ─────────────────────────────────────────────────────
  const handleImportFromRH = useCallback(async () => {
    const controller = new AbortController();
    importAbortRef.current = controller;
    setIsImporting(true);
    // Marca a importação como em andamento — sobrevive a F5 para ser retomada.
    try { window.localStorage.setItem(IMPORT_FLAG_KEY, String(Date.now())); } catch {}
    try {
      const res = await fetch('/api/org/import', { method: 'POST', signal: controller.signal });
      const data: unknown = await res.json();
      if (!res.ok) {
        const err = data as { error?: string };
        showToast(err.error ?? 'Erro ao importar.', 'error');
        return;
      }
      const result = data as { created: number; updated: number; skipped: number; orphans: number; diagnostics: { funcionarios: number; cargos: number; setores: number } };
      await refreshNodes(true);
      const d = result.diagnostics;
      const orphanNote = result.orphans > 0 ? ` (${result.orphans} sem setor)` : '';
      showToast(
        `Importação concluída: ${result.created} criados, ${result.updated} atualizados, ${result.skipped} erros${orphanNote}. [RH: ${d.funcionarios} func / ${d.cargos} cargos / ${d.setores} setores]`
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Cancelado pelo usuário. O servidor pode já ter gravado parte dos nós,
        // então recarregamos para refletir o estado real.
        await refreshNodes();
        showToast('Importação cancelada.', 'error');
      } else {
        showToast('Erro de rede ao importar.', 'error');
      }
    } finally {
      try { window.localStorage.removeItem(IMPORT_FLAG_KEY); } catch {}
      importAbortRef.current = null;
      setIsImporting(false);
    }
  }, [refreshNodes, showToast]);

  const handleCancelImport = useCallback(() => {
    importAbortRef.current?.abort();
  }, []);

  // Retoma uma importação interrompida por F5/reload (marcador no localStorage).
  // O import é idempotente, então re-executar conclui com segurança o que faltou.
  const resumeCheckedRef = useRef(false);
  useEffect(() => {
    if (resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;

    let startedAt: string | null = null;
    try { startedAt = window.localStorage.getItem(IMPORT_FLAG_KEY); } catch {}
    if (!startedAt) return;

    const isFresh = Date.now() - Number(startedAt) < IMPORT_RESUME_WINDOW_MS;
    if (isFresh) {
      showToast('Retomando importação do RH interrompida…');
      void handleImportFromRH();
    } else {
      try { window.localStorage.removeItem(IMPORT_FLAG_KEY); } catch {}
    }
  }, [handleImportFromRH, showToast]);

  // ── Props compartilhadas para todos os modais ────────────────────────────
  const sharedModalProps = {
    setNodes,
    markSyncing,
    unmarkSyncing,
    showToast: (msg: string, type?: 'success' | 'error') => showToast(msg, type),
    refreshNodes,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Toast de notificação */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastErr : styles.toastOk}`}>
          {toast.message}
        </div>
      )}

      {/* Conteúdo principal com scroll */}
      <div className={styles.content}>
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Barra de estatísticas + importação */}
            <div className={styles.statsBar}>
              <div className={styles.statTotal}>
                <span className={styles.statTotalNum}>{orgStats.total}</span>
                <span className={styles.statTotalLabel}>pessoas</span>
              </div>
              <div className={styles.statsBarDivider} />
              <div className={styles.statsLevels}>
                {Object.entries(orgStats.byLevel)
                  .sort(([a], [b]) => +a - +b)
                  .map(([lvl, count]) => (
                    <div key={lvl} className={styles.statLevel}>
                      <span className={styles.statLevelDot} style={{ background: levelColors[+lvl] }} />
                      <span className={styles.statLevelName}>{levelNames[+lvl]}</span>
                      <span className={styles.statLevelCount}>{count}</span>
                    </div>
                  ))}
              </div>
              <div className={styles.statsBarDivider} />
              <button
                className={styles.importRhBtn}
                onClick={handleImportFromRH}
                disabled={isImporting}
                title="Importa funcionários da tabela de RH e cria/atualiza nós no organograma"
              >
                {isImporting ? 'Importando…' : 'Importar do RH'}
              </button>
              {isImporting && (
                <button
                  className={styles.cancelImportBtn}
                  onClick={handleCancelImport}
                  title="Cancelar a importação em andamento"
                >
                  Cancelar
                </button>
              )}
            </div>

            {/* Seção de Diretorias */}
            <div className={styles.directorSection}>
              <div className={styles.directorSectionHead}>
                <span className={styles.directorSectionTag}>DIRETORIA</span>
                {directors.length > 0 && (
                  <span className={styles.directorSectionHint} title="Só existe uma Diretoria central. Diretores adicionais entram como Diretor de Setor.">
                    Centro único — diretores extras viram Diretor de Setor
                  </span>
                )}
              </div>

              {directors.length === 0 ? (
                <div className={styles.emptySetup}>
                  <div className={styles.emptySetupIcon}>🏢</div>
                  <p className={styles.emptySetupTitle}>Nenhuma diretoria cadastrada</p>
                  <p className={styles.emptySetupText}>Crie a diretoria para começar a montar a hierarquia.</p>
                  <button className={styles.btnPrimary} onClick={() => setIsAddDirectorOpen(true)}>
                    + Criar Diretoria
                  </button>
                </div>
              ) : (
                <div className={styles.directorsGrid}>
                  {directors.map(director => {
                    const isShared = director.name.includes(' & ');
                    return (
                      <div
                        key={director.id}
                        className={`${styles.directorCard} ${syncingIds.has(director.id) ? styles.pending : ''} ${deletingIds.has(director.id) ? styles.deleting : ''}`}
                      >
                        <Avatar photoUrl={director.photoUrl ?? ''} name={director.name} size={52} color={levelColors[0]} />
                        <div className={styles.directorText}>
                          <span className={styles.directorTag}>
                            {isShared ? '👫 COMPARTILHADO' : 'CENTRAL'}
                          </span>
                          <span className={styles.directorName}>
                            {director.name || <em className={styles.noName}>Sem nome</em>}
                          </span>
                          <span className={styles.directorRole}>{director.role}</span>
                        </div>
                        <div className={styles.directorCardActions}>
                          {syncingIds.has(director.id) && <span className={styles.syncSpinner} />}
                          <button className={styles.editIconBtn} title="Editar" onClick={() => setDirectorBeingEdited(director)}>✏</button>
                          <button className={`${styles.editIconBtn} ${styles.dangerBtn}`} title="Excluir" onClick={() => requestDeleteNode(director.id, director.name)}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Gerências Gerais ─────────────────────────────────── */}
            {(directors.length > 0 || generalManagers.length > 0) && (
              <div className={styles.ggsSectionHeader}>
                <span className={styles.ggsSectionTitle}>Gerências Gerais</span>
                {directors.length > 0 && (
                  <button className={styles.addGGBtn} onClick={() => setIsAddManagerOpen(true)}>
                    + Adicionar Gerente Geral
                  </button>
                )}
              </div>
            )}

            {directors.length > 0 && generalManagers.length === 0 && (
              <div className={styles.emptyGGs}>
                Nenhuma gerência geral cadastrada. Clique em &quot;+ Adicionar Gerente Geral&quot; para começar.
              </div>
            )}

            {/* Cards de GG */}
            {generalManagers.length > 0 && (
              <div className={styles.ggsGrid}>
                {generalManagers.map(manager => (
                  <div
                    key={manager.id}
                    className={`${styles.ggCard} ${syncingIds.has(manager.id) ? styles.pending : ''} ${deletingIds.has(manager.id) ? styles.deleting : ''}`}
                  >
                    <div className={styles.ggTop}>
                      <Avatar photoUrl={manager.photoUrl ?? ''} name={manager.name} size={46} color={levelColors[1]} />
                      <div className={styles.ggText}>
                        <span className={styles.ggRoleLabel}>{manager.role}</span>
                        <span className={styles.ggName}>{manager.name || <em className={styles.noName}>Sem nome cadastrado</em>}</span>
                      </div>
                      {syncingIds.has(manager.id) && <span className={styles.syncSpinner} />}
                      <button className={styles.editIconBtn} onClick={() => setNodeBeingEdited(manager)} title="Editar GG">✏</button>
                      <button className={`${styles.editIconBtn} ${styles.dangerBtn}`} onClick={() => requestDeleteNode(manager.id, manager.name || manager.role)} title="Excluir GG">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Seção unificada de Setores — visível sempre que houver setores ── */}
            {(directors.length > 0 || allTopLevelSectors.length > 0) && (
              <>
                <div className={styles.ggsSectionHeader} style={{ marginTop: 8 }}>
                  <span className={styles.ggsSectionTitle}>Setores</span>
                  {directors.length > 0 && (
                    <button
                      className={styles.addGGBtn}
                      onClick={() => setManagerIdForNewSector(
                        generalManagers.length > 0 ? generalManagers[0].id : directors[0].id
                      )}
                    >
                      + Novo setor
                    </button>
                  )}
                </div>

                {allTopLevelSectors.length === 0 ? (
                  <div className={styles.emptyGGs}>Nenhum setor cadastrado ainda.</div>
                ) : (
                  <div className={styles.sectorsUnifiedList}>
                    {allTopLevelSectors.map(sector => {
                      const memberCount  = countSectorMembers(sector.id, nodes);
                      const isDrawerOpen = openSectorId === sector.id;
                      return (
                        <div
                          key={sector.id}
                          className={`${styles.sectorRow} ${isDrawerOpen ? styles.sectorRowActive : ''} ${syncingIds.has(sector.id) ? styles.pending : ''} ${deletingIds.has(sector.id) ? styles.deleting : ''}`}
                        >
                          <button
                            className={styles.sectorBtn}
                            style={{ borderLeftColor: sector.sectorColor }}
                            onClick={() => setOpenSectorId(isDrawerOpen ? null : sector.id)}
                          >
                            <span className={styles.sectorDot} style={{ background: sector.sectorColor }} />
                            <span className={styles.sectorLabel}>{sector.name}</span>
                            {syncingIds.has(sector.id)
                              ? <span className={styles.syncSpinner} />
                              : <span className={styles.sectorBadge}>{memberCount}</span>
                            }
                          </button>
                          <button
                            className={styles.editIconBtn}
                            title="Editar setor"
                            onClick={() => setNodeBeingEdited(sector)}
                          >✏</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Pendentes de Reatribuição ────────────────────────── */}
            {orphanedNodes.length > 0 && (
              <>
                <div className={styles.ggsSectionHeader} style={{ marginTop: 8 }}>
                  <span className={`${styles.ggsSectionTitle} ${styles.pendingTitle}`}>
                    Pendentes de Reatribuição
                  </span>
                  <span className={styles.pendingCount}>{orphanedNodes.length}</span>
                </div>
                <div className={styles.sectorsUnifiedList}>
                  {orphanedNodes.map(node => {
                    const typeLabel = node.isSector
                      ? (node.level === 2 ? 'Setor' : (node.role || 'Sub-setor'))
                      : (levelNames[node.level] ?? node.role);
                    const color = node.sectorColor ?? (node.isSector ? '#fbbf24' : (levelColors[node.level] ?? '#94a3b8'));
                    return (
                      <div
                        key={node.id}
                        className={`${styles.sectorRow} ${styles.pendingRow} ${syncingIds.has(node.id) ? styles.pending : ''} ${deletingIds.has(node.id) ? styles.deleting : ''}`}
                      >
                        <div className={styles.sectorBtn} style={{ borderLeftColor: color }}>
                          <span className={styles.sectorDot} style={{ background: color }} />
                          <span className={styles.sectorLabel}>{node.name || <em>Sem nome</em>}</span>
                          <span className={styles.pendingTypeBadge}>{typeLabel}</span>
                        </div>
                        <button
                          className={styles.editIconBtn}
                          title="Reatribuir"
                          onClick={() => setReassigningOrphan(node)}
                        >↔</button>
                        <button
                          className={`${styles.editIconBtn} ${styles.dangerBtn}`}
                          title="Excluir"
                          onClick={() => requestDeleteNode(node.id, node.name || 'este item')}
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Drawer lateral de detalhe do setor ────────────────────────────── */}
      {openSectorDrawer && (
        <>
          <div className={styles.drawerOverlay} onClick={() => setOpenSectorId(null)} />
          <aside className={styles.drawer}>
            <div className={styles.drawerHead}>
              <div className={styles.drawerTitle}>
                <span className={styles.drawerDot} style={{ background: openSectorDrawer.sector.sectorColor }} />
                {openSectorDrawer.sector.name}
              </div>
              <button className={styles.closeBtn} onClick={() => setOpenSectorId(null)}>✕</button>
            </div>

            <div className={styles.drawerSubhead}>
              <span className={styles.drawerCount}>{openSectorDrawer.directMembers.length + [...openSectorDrawer.membersBySubSector.values()].reduce((s, a) => s + a.length, 0)} pessoas</span>
              <button className={styles.btnPrimary} onClick={() => setActiveSectorForNewPerson(openSectorId)}>
                + Adicionar pessoa
              </button>
            </div>

            {/* Mensagem de setor vazio */}
            {openSectorDrawer.directMembers.length === 0 && openSectorDrawer.subSectors.length === 0 && (
              <div className={styles.emptyPeople}>Nenhuma pessoa cadastrada neste setor ainda.</div>
            )}

            {/* Pessoas diretamente no setor, agrupadas por nível */}
            {Object.entries(openSectorDrawer.directMembersByLevel)
              .sort(([a], [b]) => +a - +b)
              .map(([lvl, people]) => (
                <div key={lvl} className={styles.levelGroup}>
                  <div className={styles.levelHead}>
                    <span className={styles.levelDot} style={{ background: levelColors[+lvl] }} />
                    {levelNames[+lvl]}
                    <span className={styles.levelCnt}>{people.length}</span>
                  </div>
                  {people.map(person => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      syncingIds={syncingIds}
                      deletingIds={deletingIds}
                      onEdit={() => setPersonBeingEdited(person)}
                      onDelete={() => requestDeleteNode(person.id, person.name || 'esta pessoa')}
                    />
                  ))}
                </div>
              ))}

            {/* Sub-setores com suas pessoas */}
            {openSectorDrawer.subSectors.map(subSector => {
              const subSectorMembers  = openSectorDrawer.membersBySubSector.get(subSector.id) ?? [];
              const membersByLevel    = subSectorMembers.reduce<Record<number, OrgNode[]>>((acc, p) => {
                (acc[p.level] ??= []).push(p);
                return acc;
              }, {});

              return (
                <div
                  key={subSector.id}
                  className={`${styles.subSectorBlock} ${syncingIds.has(subSector.id) ? styles.pending : ''} ${deletingIds.has(subSector.id) ? styles.deleting : ''}`}
                  style={{ borderLeftColor: subSector.sectorColor ?? '#334155' }}
                >
                  <div className={styles.subSectorBlockHead}>
                    <span className={styles.sectorDot} style={{ background: subSector.sectorColor }} />
                    <span className={styles.subSectorLabel}>{subSector.name}</span>
                    {syncingIds.has(subSector.id)
                      ? <span className={styles.syncSpinner} />
                      : <span className={styles.sectorBadge}>{countSectorMembers(subSector.id, nodes)}</span>
                    }
                    <button className={styles.editIconBtn} onClick={() => setActiveSectorForNewPerson(subSector.id)} title="Adicionar pessoa">+</button>
                    <button className={styles.editIconBtn} onClick={() => setNodeBeingEdited(subSector)} title="Editar">✏</button>
                    <button className={`${styles.editIconBtn} ${styles.dangerBtn}`} onClick={() => requestDeleteNode(subSector.id, subSector.name || 'este sub-setor')} title="Excluir">✕</button>
                  </div>

                  {subSectorMembers.length === 0 ? (
                    <p className={styles.ssEmptyPeople}>Nenhuma pessoa neste sub-setor.</p>
                  ) : (
                    Object.entries(membersByLevel)
                      .sort(([a], [b]) => +a - +b)
                      .map(([lvl, people]) => (
                        <div key={lvl} className={styles.levelGroup}>
                          <div className={styles.levelHead}>
                            <span className={styles.levelDot} style={{ background: levelColors[+lvl] }} />
                            {levelNames[+lvl]}
                            <span className={styles.levelCnt}>{people.length}</span>
                          </div>
                          {people.map(person => (
                            <PersonRow
                              key={person.id}
                              person={person}
                              syncingIds={syncingIds}
                              deletingIds={deletingIds}
                              onEdit={() => setPersonBeingEdited(person)}
                              onDelete={() => requestDeleteNode(person.id, person.name || 'esta pessoa')}
                            />
                          ))}
                        </div>
                      ))
                  )}
                </div>
              );
            })}

            <button className={styles.addSubSectorBtn} onClick={() => setSectorIdForNewSubSector(openSectorId)}>
              + Novo sub-setor
            </button>
          </aside>
        </>
      )}

      {/* ── Modais ─────────────────────────────────────────────────────────── */}

      {(activeSectorForNewPerson !== null || personBeingEdited !== null) && (
        <PersonModal
          targetSectorId={activeSectorForNewPerson ?? personBeingEdited?.parentId ?? null}
          personBeingEdited={personBeingEdited}
          allNodes={nodes}
          nodeMap={nodeMap}
          onClose={() => { setActiveSectorForNewPerson(null); setPersonBeingEdited(null); }}
          {...sharedModalProps}
        />
      )}

      {nodeBeingEdited && (
        <NodeEditModal
          node={nodeBeingEdited}
          onClose={() => setNodeBeingEdited(null)}
          onDeleteClick={requestDeleteNode}
          {...sharedModalProps}
        />
      )}

      {managerIdForNewSector !== null && (
        <AddSectorModal
          parentManagerId={managerIdForNewSector}
          parentManagerRole={nodeMap.get(managerIdForNewSector)?.role}
          onClose={() => setManagerIdForNewSector(null)}
          {...sharedModalProps}
        />
      )}

      {/* ── Modal de reatribuição de nó órfão ───────────────────────────── */}
      {reassigningOrphan && (
        <div className={styles.overlay} onClick={() => setReassigningOrphan(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Reatribuir {
                !reassigningOrphan.isSector && reassigningOrphan.level === 1 ? 'Gerência Geral' :
                reassigningOrphan.isSector && reassigningOrphan.level === 2 ? 'Setor' :
                reassigningOrphan.isSector ? (reassigningOrphan.role || 'Sub-setor') :
                (levelNames[reassigningOrphan.level] ?? 'Pessoa')
              }</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setReassigningOrphan(null)}>✕</button>
            </div>
            <p className={styles.orphanModalSubtitle}>
              Mover <strong>{reassigningOrphan.name || 'este item'}</strong> para:
            </p>
            <div className={styles.gmPickerList}>
              {orphanReassignTargets.length === 0 ? (
                <p className={styles.orphanEmpty}>
                  {reassigningOrphan.level === 1 && !reassigningOrphan.isSector
                    ? 'Nenhuma diretoria disponível. Crie uma primeiro.'
                    : reassigningOrphan.level === 2
                    ? 'Nenhum Gerente Geral disponível. Crie um primeiro.'
                    : reassigningOrphan.isSector
                    ? 'Nenhum setor disponível.'
                    : 'Nenhum setor ou sub-setor disponível.'}
                </p>
              ) : (
                orphanReassignTargets.map(target => (
                  <button
                    key={target.id}
                    type="button"
                    className={styles.gmPickerBtn}
                    onClick={async () => {
                      const node = reassigningOrphan;
                      setReassigningOrphan(null);
                      markSyncing(node.id);
                      try {
                        await updateOrgNode(node.id, { parentId: target.id });
                        await refreshNodes();
                        showToast(`"${node.name || 'Item'}" reatribuído com sucesso.`);
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Erro ao reatribuir.', 'error');
                      } finally {
                        unmarkSyncing(node.id);
                      }
                    }}
                  >
                    <Avatar
                      photoUrl={target.photoUrl ?? ''}
                      name={target.name}
                      size={32}
                      color={target.isSector ? (target.sectorColor ?? levelColors[2]) : levelColors[1]}
                    />
                    <span className={styles.gmPickerName}>{target.name || target.role}</span>
                    {target.name && <span className={styles.gmPickerRole}>{target.role}</span>}
                  </button>
                ))
              )}
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={styles.btnSecondary} onClick={() => setReassigningOrphan(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {sectorIdForNewSubSector !== null && (() => {
        const parentSector = nodeMap.get(sectorIdForNewSubSector);
        return (
          <AddSubSectorModal
            parentSectorId={sectorIdForNewSubSector}
            parentSectorName={parentSector?.name}
            onClose={() => setSectorIdForNewSubSector(null)}
            {...sharedModalProps}
          />
        );
      })()}

      {(isAddDirectorOpen || directorBeingEdited !== null) && (
        <DirectorModal
          directorBeingEdited={directorBeingEdited}
          centralDirectorExists={directors.length > 0}
          onClose={() => { setIsAddDirectorOpen(false); setDirectorBeingEdited(null); }}
          onDeleteClick={requestDeleteNode}
          onDirectorCreated={handleDirectorCreated}
          {...sharedModalProps}
        />
      )}

      {isAddManagerOpen && directors.length > 0 && (
        <CreateManagerModal
          directors={directors}
          onClose={() => setIsAddManagerOpen(false)}
          onManagerCreated={handleManagerCreated}
          {...sharedModalProps}
        />
      )}

      {/* ── Diálogo de confirmação de exclusão ─────────────────────────────── */}
      {confirmDialog && (
        <div className={styles.overlay} onClick={closeConfirmDialog}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑</div>
            <h3 className={styles.confirmTitle}>{confirmDialog.title}</h3>
            <p className={styles.confirmMsg}>{confirmDialog.message}</p>
            <div className={styles.confirmFoot}>
              <button className={styles.btnSecondary} onClick={closeConfirmDialog}>Cancelar</button>
              <button className={styles.btnDanger} onClick={confirmDialog.onConfirm}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes de renderização
// ─────────────────────────────────────────────────────────────────────────────

interface PersonRowProps {
  person:      OrgNode;
  syncingIds:  Set<string>;
  deletingIds: Set<string>;
  onEdit:      () => void;
  onDelete:    () => void;
}

/** Linha de pessoa no drawer lateral. Extraída para evitar duplicação. */
function PersonRow({ person, syncingIds, deletingIds, onEdit, onDelete }: PersonRowProps) {
  return (
    <div className={`${styles.personRow} ${syncingIds.has(person.id) ? styles.pending : ''} ${deletingIds.has(person.id) ? styles.deleting : ''}`}>
      <Avatar photoUrl={person.photoUrl ?? ''} name={person.name} size={38} color={levelColors[person.level]} />
      <div className={styles.personText}>
        <span className={styles.personName}>{person.name || <em className={styles.noName}>Sem nome</em>}</span>
        <span className={styles.personRole}>{person.role}</span>
      </div>
      <div className={styles.personActions}>
        {syncingIds.has(person.id) && <span className={styles.syncSpinner} />}
        <button className={styles.editIconBtn} onClick={onEdit} title="Editar">✏</button>
        <button className={`${styles.editIconBtn} ${styles.dangerBtn}`} onClick={onDelete} title="Excluir">✕</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton de carregamento
// ─────────────────────────────────────────────────────────────────────────────

/** Exibido enquanto os dados do organograma estão sendo carregados. */
function LoadingSkeleton() {
  return (
    <>
      <div className={styles.statsBar}>
        <div className={styles.statTotal}>
          <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 52, height: 28, borderRadius: 6 }} />
          <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 60, height: 10, marginTop: 4 }} />
        </div>
        <div className={styles.statsBarDivider} />
        <div className={styles.statsLevels}>
          {[90, 110, 120, 100, 130, 100].map((w, i) => (
            <span key={i} className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: w, height: 32, borderRadius: 8 }} />
          ))}
        </div>
      </div>
      <div className={styles.directorSection}>
        <div className={styles.directorSectionHead}>
          <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 80, height: 11 }} />
        </div>
        <div className={styles.directorsGrid}>
          {[0, 1].map(i => (
            <div key={i} className={styles.directorCard}>
              <span className={`${styles.skeleton} ${styles.skeletonRound}`} style={{ width: 52, height: 52, flexShrink: 0 }} />
              <div className={styles.directorText}>
                <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 64,  height: 9,  display: 'block', marginBottom: 7 }} />
                <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 160, height: 14, display: 'block', marginBottom: 5 }} />
                <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 110, height: 10, display: 'block' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.ggsSectionHeader}>
        <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 140, height: 12 }} />
      </div>
      <div className={styles.ggsGrid}>
        {[0, 1, 2].map(i => (
          <div key={i} className={styles.ggCard}>
            <div className={styles.ggTop}>
              <span className={`${styles.skeleton} ${styles.skeletonRound}`} style={{ width: 46, height: 46, flexShrink: 0 }} />
              <div className={styles.ggText}>
                <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 90,  height: 10, display: 'block', marginBottom: 7 }} />
                <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ width: 150, height: 13, display: 'block' }} />
              </div>
            </div>
            <div className={styles.divider} />
            <div className={styles.sectorList}>
              {[0, 1, 2, 3].map(j => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px' }}>
                  <span className={`${styles.skeleton} ${styles.skeletonRound}`} style={{ width: 9, height: 9, flexShrink: 0 }} />
                  <span className={`${styles.skeleton} ${styles.skeletonRect}`} style={{ flex: 1, height: 10 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
