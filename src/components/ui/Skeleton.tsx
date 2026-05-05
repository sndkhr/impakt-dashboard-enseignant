'use client';

import React from 'react';

/* ============================================================
   SKELETON — placeholder shimmer premium
   Utilisation : <Skeleton w={120} h={32} /> ou <Skeleton.Card />
   Animation : gradient qui balaie de gauche a droite (2s infinite)
   ============================================================ */

interface SkeletonProps {
  w?: number | string;
  h?: number | string;
  rounded?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

function SkeletonBase({ w = '100%', h = 14, rounded = 6, style, className }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        borderRadius: rounded,
        background: 'linear-gradient(90deg, rgba(15,15,15,0.05) 0%, rgba(15,15,15,0.10) 50%, rgba(15,15,15,0.05) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

// KPI card skeleton (matches exact layout of KpiCard)
function SkeletonKpi({ gradient, index = 0 }: { gradient?: boolean; index?: number }) {
  return (
    <div
      style={{
        background: gradient
          ? 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)'
          : 'rgba(255,255,255,0.52)',
        backdropFilter: gradient ? 'none' : 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: gradient ? 'none' : 'blur(28px) saturate(140%)',
        border: gradient ? 'none' : '1px solid rgba(255,255,255,0.7)',
        borderRadius: 18,
        padding: '16px 18px 17px',
        display: 'flex', flexDirection: 'column', gap: 7,
        boxShadow: gradient
          ? '0 4px 14px rgba(127,73,151,0.28), 0 10px 30px rgba(232,67,147,0.22), inset 0 1px 0 rgba(255,255,255,0.25)'
          : '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
        animation: 'stagger-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Title skeleton */}
      <div style={{
        width: 90, height: 10,
        borderRadius: 4,
        background: gradient ? 'rgba(255,255,255,0.18)' : 'rgba(15,15,15,0.07)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
      }} />
      {/* Value + sparkline row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
        <div style={{
          width: 70, height: 28,
          borderRadius: 6,
          background: gradient ? 'rgba(255,255,255,0.22)' : 'rgba(15,15,15,0.08)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        }} />
        <div style={{
          width: 62, height: 22,
          borderRadius: 4,
          background: gradient ? 'rgba(255,255,255,0.12)' : 'rgba(15,15,15,0.05)',
          marginRight: 10, marginBottom: 2,
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        }} />
      </div>
      {/* Delta skeleton */}
      <div style={{
        width: 50, height: 11,
        borderRadius: 4,
        background: gradient ? 'rgba(255,255,255,0.14)' : 'rgba(15,15,15,0.05)',
        marginTop: 2,
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
      }} />
    </div>
  );
}

// Card skeleton (glass panel)
function SkeletonCard({ height = 200, children }: { height?: number; children?: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 20,
      padding: '18px 20px',
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
      minHeight: height,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header title + subtitle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
        <SkeletonBase w={130} h={13} />
        <SkeletonBase w={180} h={11} />
      </div>
      {children || (
        <>
          <SkeletonBase h={12} />
          <SkeletonBase h={12} w="85%" />
          <SkeletonBase h={12} w="70%" />
        </>
      )}
    </div>
  );
}

// Row skeleton for tables
function SkeletonRow({ cells = 7 }: { cells?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
      {Array.from({ length: cells }).map((_, i) => (
        <SkeletonBase key={i} h={12} w={`${Math.floor(100 / cells)}%`} style={{ flex: 1 }} />
      ))}
    </div>
  );
}

// Pill skeleton for the header
function SkeletonPill({ w = 110 }: { w?: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 14px',
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(18px) saturate(140%)',
      WebkitBackdropFilter: 'blur(18px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 999,
      boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(15,15,15,0.12)' }} />
      <SkeletonBase w={w - 30} h={11} style={{ background: 'rgba(15,15,15,0.08)' }} />
    </div>
  );
}

const Skeleton = Object.assign(SkeletonBase, {
  Kpi: SkeletonKpi,
  Card: SkeletonCard,
  Row: SkeletonRow,
  Pill: SkeletonPill,
});

export default Skeleton;
