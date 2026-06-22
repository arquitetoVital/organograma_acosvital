import { PositionedNode } from '@/types/orgChart';
import styles from './CenterCard.module.css';

interface Props {
  node: PositionedNode;
  color: string;
}

const CR = 75; // circle radius

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.toLowerCase() !== 'e' && w.toLowerCase() !== 'de')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function splitName(name: string): [string, string | null] {
  // Split on " e " or " & " to get two lines
  const match = name.match(/^(.+?)\s+[e&]\s+(.+)$/i);
  if (match) return [match[1].trim(), match[2].trim()];
  // Fallback: split at middle word boundary
  const words = name.split(' ');
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ') || null];
}

export default function CenterCard({ node, color }: Props) {
  const [nameLine1, nameLine2] = splitName(node.name);
  const initials = getInitials(node.name);

  return (
    <g className={styles.group}>
      <title>{node.name} — {node.role}</title>

      <defs>
        <clipPath id="clip-center">
          <circle cx={0} cy={0} r={CR - 1} />
        </clipPath>
      </defs>

      {/* Outer glow */}
      <circle cx={0} cy={0} r={CR + 10} fill={color} fillOpacity={0.07} />

      {/* Second ring (decorative) */}
      <circle
        cx={0}
        cy={0}
        r={CR + 5}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.3}
        strokeDasharray="4 3"
      />

      {/* Main border */}
      <circle
        cx={0}
        cy={0}
        r={CR + 2}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeOpacity={0.75}
        className={styles.border}
      />

      {/* Background */}
      <circle cx={0} cy={0} r={CR} style={{ fill: 'var(--bg-deep)' }} />

      {/* Initials fallback */}
      <text
        x={0}
        y={CR * 0.35}
        textAnchor="middle"
        fill={color}
        fontSize={CR * 0.42}
        fontWeight="700"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >
        {initials}
      </text>

      {/* Photo (covers initials when loaded) */}
      {node.photoUrl && (
        <image
          href={node.photoUrl}
          x={-CR}
          y={-CR}
          width={CR * 2}
          height={CR * 2}
          clipPath="url(#clip-center)"
          preserveAspectRatio="xMidYMid slice"
        />
      )}

      {/* Role label — e.g. "DIRETORIA" */}
      <text
        x={0}
        y={CR + 20}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontWeight="700"
        letterSpacing="2"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        opacity={0.9}
      >
        {node.role.toUpperCase()}
      </text>

      {/* Name line 1 */}
      <text
        x={0}
        y={CR + 38}
        textAnchor="middle"
        style={{ fill: 'var(--text-primary)' }}
        fontSize={12}
        fontWeight="700"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      >
        {nameLine1}
      </text>

      {/* Name line 2 (if present) */}
      {nameLine2 && (
        <text
          x={0}
          y={CR + 54}
          textAnchor="middle"
          style={{ fill: 'var(--text-primary)' }}
          fontSize={12}
          fontWeight="700"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        >
          {nameLine2}
        </text>
      )}
    </g>
  );
}
