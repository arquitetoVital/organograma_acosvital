import styles from './loading.module.css';

const ROW_WIDTHS = [
  ['62%', '38%'],
  ['50%', '30%'],
  ['70%', '44%'],
  ['55%', '36%'],
  ['66%', '42%'],
  ['48%', '28%'],
];

export default function AdminLoading() {
  return (
    <div className={styles.page}>

      {/* Cabeçalho */}
      <div className={styles.header}>
        <div className={styles.breadcrumbRow}>
          <span className={styles.bone} style={{ width: 36 }} />
          <span className={styles.sep}>›</span>
          <span className={styles.bone} style={{ width: 64 }} />
        </div>
        <span className={styles.bone} style={{ width: 180, height: 22 }} />
      </div>

      {/* Barra de ferramentas */}
      <div className={styles.toolbar}>
        <span className={styles.bone} style={{ width: 220, height: 34, borderRadius: 8 }} />
        <span className={styles.bone} style={{ width: 90,  height: 34, borderRadius: 8 }} />
        <span className={styles.bone} style={{ width: 90,  height: 34, borderRadius: 8 }} />
      </div>

      {/* Linhas */}
      <div className={styles.list}>
        {ROW_WIDTHS.map(([w1, w2], i) => (
          <div key={i} className={styles.row} style={{ animationDelay: `${i * 0.06}s` }}>
            <span className={styles.bone} style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
            <div className={styles.info}>
              <span className={styles.bone} style={{ width: w1, height: 13 }} />
              <span className={styles.bone} style={{ width: w2, height: 10 }} />
            </div>
            <span className={styles.bone} style={{ width: 54, height: 22, borderRadius: 6, flexShrink: 0 }} />
          </div>
        ))}
      </div>

    </div>
  );
}
