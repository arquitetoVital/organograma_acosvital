import { levelColors, levelNames } from '@/data/orgData';
import OrgChartRealtimeWrapper from '@/components/OrgChart/OrgChartRealtimeWrapper';
import seedNodes from '@/data/orgData.json';
import styles from './page.module.css';
import type { OrgNode } from '@/types/orgChart';

export default function Home() {
  return (
    <div className={styles.page}>
      <OrgChartRealtimeWrapper
        initialNodes={seedNodes as OrgNode[]}
        levelColors={levelColors}
        levelNames={levelNames}
      />
    </div>
  );
}
