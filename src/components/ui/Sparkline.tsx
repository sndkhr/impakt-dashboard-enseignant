'use client';
import { useId } from 'react';

interface SparklineProps {
  values?: number[];
  w?: number;
  h?: number;
  color?: 'gradient' | 'white' | string;
  strokeWidth?: number;
}

export default function Sparkline({ values = [], w = 64, h = 22, color = 'gradient', strokeWidth = 1.6 }: SparklineProps) {
  // useId doit être appelé AVANT tout early return (règles des hooks)
  const uid = useId();
  const gradId = `spark-grad-${uid}`;
  const fillId = `spark-fill-${uid}`;

  if (!Array.isArray(values) || values.length < 2) return <div style={{ width: w, height: h }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return [x, y] as [number, number];
  });

  const d = pts.reduce((acc: string, pt, i, arr) => {
    const [x, y] = pt;
    if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = arr[i - 1];
    const cx = (px + x) / 2;
    return `${acc} Q ${cx.toFixed(1)} ${py.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  const dArea = `${d} L ${w} ${h} L 0 ${h} Z`;

  const isWhite = color === 'white';
  const stroke1 = isWhite ? 'rgba(255,255,255,0.95)' : '#7f4997';
  const stroke2 = isWhite ? 'rgba(255,255,255,0.6)' : '#E84393';
  const fill1 = isWhite ? 'rgba(255,255,255,0.20)' : 'rgba(127,73,151,0.18)';
  const fill2 = isWhite ? 'rgba(255,255,255,0.0)' : 'rgba(232,67,147,0.0)';
  const lastPt = pts[pts.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stroke1} />
          <stop offset="100%" stopColor={stroke2} />
        </linearGradient>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={fill1} />
          <stop offset="100%" stopColor={fill2} />
        </linearGradient>
      </defs>
      <path d={dArea} fill={`url(#${fillId})`} />
      <path d={d} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r={2.2} fill={isWhite ? '#fff' : '#E84393'} />
    </svg>
  );
}
