'use client';

import React from 'react';

/* ============================================================
   EMPTY STATE — premium empty-zone avec icone + titre + CTA
   Transforme les "rien a signaler" / "aucun" en moments utiles.
   ============================================================ */

interface EmptyStateProps {
  icon?: React.ReactNode;      // custom icon override (SVG)
  iconKind?: 'check' | 'target' | 'users' | 'calendar' | 'inbox' | 'chart' | 'bell' | 'sparkle';
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  variant?: 'default' | 'compact';  // compact = mini (pour petites cards)
  style?: React.CSSProperties;
}

// === Icon library (tous dans le gradient IMPAKT) ===
const ICONS: Record<NonNullable<EmptyStateProps['iconKind']>, React.ReactNode> = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" opacity="0.35" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" opacity="0.35" />
      <circle cx="12" cy="12" r="6" opacity="0.55" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" opacity="0.5" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" opacity="0.5" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" opacity="0.55" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.7" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="3" y1="20" x2="21" y2="20" opacity="0.55" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M3 12h3M18 12h3M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" opacity="0.55" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  ),
};

export default function EmptyState({
  icon, iconKind = 'inbox', title, description, ctaLabel, onCta, variant = 'default', style,
}: EmptyStateProps) {
  const compact = variant === 'compact';
  const iconSize = compact ? 32 : 46;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: compact ? 8 : 12,
        padding: compact ? '18px 10px' : '28px 16px',
        textAlign: 'center',
        animation: 'stagger-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        ...style,
      }}
    >
      {/* Icone avec halo gradient IMPAKT */}
      <div style={{
        position: 'relative',
        width: iconSize + 20, height: iconSize + 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Halo radial */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at center, rgba(232,67,147,0.14), rgba(127,73,151,0.08) 60%, transparent 80%)',
          filter: 'blur(4px)',
        }} />
        {/* Disc gradient */}
        <div style={{
          position: 'relative',
          width: iconSize, height: iconSize, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.12))',
          border: '1px solid rgba(127,73,151,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#7f4997',
        }}>
          <div style={{ width: iconSize - 22, height: iconSize - 22 }}>
            {icon || ICONS[iconKind]}
          </div>
        </div>
      </div>

      {/* Titre */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: compact ? 12 : 13.5, fontWeight: 600,
        color: 'var(--premium-text)',
        letterSpacing: '-0.2px',
        maxWidth: compact ? 200 : 280,
      }}>{title}</div>

      {/* Description */}
      {description && (
        <div style={{
          fontSize: compact ? 10.5 : 11.5,
          color: 'var(--premium-text-4)',
          lineHeight: 1.45,
          maxWidth: compact ? 220 : 300,
          letterSpacing: '-0.05px',
        }}>{description}</div>
      )}

      {/* CTA */}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 4,
            padding: compact ? '6px 12px' : '8px 16px',
            background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            fontSize: compact ? 11 : 11.5, fontWeight: 600,
            fontFamily: 'inherit',
            letterSpacing: '-0.1px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(232,67,147,0.25)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            transition: 'all .15s ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(232,67,147,0.35)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(232,67,147,0.25)'; }}
        >
          {ctaLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}
    </div>
  );
}
