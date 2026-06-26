import { levelColors, levelNames } from '@/data/orgData';
import OrgChartRealtimeWrapper from '@/components/OrgChart/OrgChartRealtimeWrapper';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <OrgChartRealtimeWrapper
        levelColors={levelColors}
        levelNames={levelNames}
      />
    </div>
  );
}
