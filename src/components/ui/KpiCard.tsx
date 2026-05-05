'use client';

import React from 'react';
import { SpotlightCard, CountUp } from '@/components/ui/PremiumMotion';
import { staggerDelay } from '@/lib/motion';
import Sparkline from '@/components/ui/Sparkline';
import Delta from '@/components/ui/Delta';

interface KpiCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  gradient?: boolean;
  alert?: boolean; // alias
  index?: number;
  trend?: number[];
  delta?: number | null;
}

/**
 * KpiCard = port 1:1 de ProKpi (admin B2CDash.js ligne 288)
 * - fontSize 32px (pas 28)
 * - letterSpacing -1.5px
 * - gap 7 (pas 10)
 * - boxShadow dynamique au hover
 * - marginRight sparkline 10 (pas 8)
 */
export default function KpiCard({ title, value, suffix = '', sub, gradient, alert, index = 0, trend, delta }: KpiCardProps) {
  const isGradient = gradient || alert;
  const isNumeric = typeof value === 'number' && !isNaN(value);

  const shadowNormal = isGradient
    ? '0 4px 14px rgba(127,73,151,0.28), 0 10px 30px rgba(232,67,147,0.22), inset 0 1px 0 rgba(255,255,255,0.25)'
    : '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.85)';
  const shadowHover = isGradient
    ? '0 8px 22px rgba(127,73,151,0.35), 0 16px 40px rgba(232,67,147,0.30), inset 0 1px 0 rgba(255,255,255,0.30)'
    : '0 2px 6px rgba(15,15,15,0.05), 0 12px 34px rgba(15,15,15,0.08), inset 0 1px 0 rgba(255,255,255,0.95)';

  return (
    <SpotlightCard
      spotlightColor={isGradient ? 'rgba(255,255,255,0.10)' : 'rgba(232,67,147,0.06)'}
      style={{
        background: isGradient ? 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)' : 'rgba(255,255,255,0.52)',
        backdropFilter: isGradient ? 'none' : 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: isGradient ? 'none' : 'blur(28px) saturate(140%)',
        border: isGradient ? 'none' : '1px solid rgba(255,255,255,0.7)',
        borderRadius: 18,
        padding: '16px 18px 17px',
        display: 'flex', flexDirection: 'column',
        gap: 7,
        boxShadow: shadowNormal,
        transition: 'transform .25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow .25s ease',
        animation: 'stagger-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        animationDelay: staggerDelay(index, 60, 10),
      } as React.CSSProperties}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = shadowHover;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'none';
        (e.currentTarget as HTMLDivElement).style.boxShadow = shadowNormal;
      }}
    >
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 10.5, fontWeight: 600,
        color: isGradient ? 'rgba(255,255,255,0.72)' : '#525252',
        textTransform: 'uppercase',
        letterSpacing: '0.55px',
      }}>{title}</div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32, fontWeight: 700,
          letterSpacing: '-1.5px',
          lineHeight: 1,
          color: isGradient ? '#ffffff' : '#0a0a0a',
          fontVariantNumeric: 'tabular-nums lining-nums',
        }}>
          {isNumeric ? <CountUp value={value as number} suffix={suffix} /> : <>{value}{suffix}</>}
        </div>
        {trend && trend.length >= 2 && (
          <div style={{ marginRight: 10, marginBottom: 2 }}>
            <Sparkline values={trend} color={isGradient ? 'white' : 'gradient'} w={62} h={22} />
          </div>
        )}
      </div>

      {delta !== undefined && delta !== null ? (
        <Delta value={delta} white={isGradient} />
      ) : sub ? (
        <div style={{
          fontSize: 10.5, fontWeight: 500,
          color: isGradient ? 'rgba(255,255,255,0.80)' : '#a3a3a3',
          fontFamily: 'var(--font-display)',
        }}>{sub}</div>
      ) : null}
    </SpotlightCard>
  );
}
