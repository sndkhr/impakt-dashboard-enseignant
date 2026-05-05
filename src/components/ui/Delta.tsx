'use client';

interface DeltaProps {
  value: number | null | undefined;
  suffix?: string;
  white?: boolean;
  hideArrow?: boolean;
}

export default function Delta({ value, suffix = 'vs sem. dern.', white = false, hideArrow = false }: DeltaProps) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const v = Math.round(value);
  const isUp = v > 0;
  const isFlat = v === 0;
  const arrow = hideArrow || isFlat ? '' : (isUp ? '▲' : '▼');
  const sign = isUp ? '+' : '';

  let color: string;
  if (white) color = 'rgba(255,255,255,0.85)';
  else if (isFlat) color = '#737373';
  else if (isUp) color = '#059669';
  else color = '#dc2626';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: 'var(--font-display)',
      fontSize: 10.5, fontWeight: 600, letterSpacing: '-0.005em',
      color, whiteSpace: 'nowrap',
    }}>
      {arrow && <span style={{ fontSize: 8, lineHeight: 1 }}>{arrow}</span>}
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sign}{v}%</span>
      {suffix && (
        <span style={{
          fontWeight: 500,
          color: white ? 'rgba(255,255,255,0.65)' : '#a3a3a3',
          marginLeft: 2,
        }}>{suffix}</span>
      )}
    </span>
  );
}
