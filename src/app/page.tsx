import { levelColors, levelNames } from '@/data/orgData';
import { readOrgData } from '@/lib/getData';
import { createClient } from '@/lib/supabase/server';
import { DEV_AUTH_BYPASS } from '@/lib/devAuth';
import OrgChartRealtimeWrapper from '@/components/OrgChart/OrgChartRealtimeWrapper';
import seedNodes from '@/data/orgData.json';
import styles from './page.module.css';
import type { OrgNode } from '@/types/orgChart';

export default async function Home() {
  let allNodes: OrgNode[] = [];

  try {
    const supabase = await createClient();
    allNodes = await readOrgData(supabase);
  } catch {}

  // Em desenvolvimento sem sessão real, o RLS bloqueia a leitura e a lista vem
  // vazia. Usa a estrutura-semente para que o organograma fique inspecionável.
  if (allNodes.length === 0 && DEV_AUTH_BYPASS) {
    allNodes = seedNodes as OrgNode[];
  }

  return (
    <div className={styles.page}>
      <OrgChartRealtimeWrapper
        initialNodes={allNodes}
        levelColors={levelColors}
        levelNames={levelNames}
      />
    </div>
  );
}
