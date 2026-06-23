import styles from './loading.module.css';

const GM_COUNT     = 5;
const SECTOR_COUNT = 12;
const GM_R         = 190;
const SEC_R        = 430;
const DIR_R        = 75;
const GM_NODE_R    = 34;
const SEC_NODE_R   = 26;

function polar(r: number, i: number, total: number, offsetDeg = -90) {
  const angle = ((i / total) * 360 + offsetDeg) * (Math.PI / 180);
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

export default function OrgChartLoading() {
  return (
    <div className={styles.page}>
      <svg viewBox="-540 -540 1080 1080" className={styles.svg}>

        {/* ── Anel externo (setores) ── */}
        <circle cx={0} cy={0} r={SEC_R}
          fill="none" stroke="rgba(255,255,255,0.05)"
          strokeWidth={1.5} strokeDasharray="6 5"
          className={styles.ringOuter} />

        {/* ── Anel interno (gerentes) ── */}
        <circle cx={0} cy={0} r={GM_R}
          fill="none" stroke="rgba(255,255,255,0.05)"
          strokeWidth={1.5} strokeDasharray="7 5"
          className={styles.ringInner} />

        {/* ── Hastes GM → anel externo ── */}
        {Array.from({ length: GM_COUNT }, (_, i) => {
          const a = polar(GM_R,  i, GM_COUNT);
          const b = polar(SEC_R, i, GM_COUNT);
          return (
            <line key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={styles.stem} strokeWidth={1.5} />
          );
        })}

        {/* ── Nós placeholder — setores ── */}
        {Array.from({ length: SECTOR_COUNT }, (_, i) => {
          const { x, y } = polar(SEC_R, i, SECTOR_COUNT);
          return (
            <circle key={i} cx={x} cy={y} r={SEC_NODE_R}
              fill="rgba(255,255,255,0.07)"
              className={styles.node}
              style={{ animationDelay: `${i * 0.07}s` }} />
          );
        })}

        {/* ── Nós placeholder — gerentes ── */}
        {Array.from({ length: GM_COUNT }, (_, i) => {
          const { x, y } = polar(GM_R, i, GM_COUNT);
          return (
            <circle key={i} cx={x} cy={y} r={GM_NODE_R}
              fill="rgba(255,255,255,0.09)"
              className={styles.node}
              style={{ animationDelay: `${i * 0.13}s` }} />
          );
        })}

        {/* ── Centro: diretor ── */}
        <circle cx={0} cy={0} r={DIR_R + 8}
          fill="rgba(245,158,11,0.05)"
          className={styles.centerBorder} />
        <circle cx={0} cy={0} r={DIR_R}
          fill="rgba(245,158,11,0.10)"
          stroke="rgba(245,158,11,0.22)" strokeWidth={2}
          className={styles.center} />

      </svg>

      <span className={styles.label}>Carregando organograma…</span>
    </div>
  );
}
