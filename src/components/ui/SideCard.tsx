'use client';

import { ReactNode, CSSProperties } from 'react';

interface SideCardProps {
  title?: string;
  titleRight?: ReactNode;
  subtitle?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export default function SideCard({ title, titleRight, subtitle, children, style }: SideCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 20,
      padding: '18px 20px',
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {(title || titleRight) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, marginBottom: subtitle ? 10 : 14,
        }}>
          <div style={{ minWidth: 0 }}>
            {title && (
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13, fontWeight: 700, color: 'var(--premium-text)',
                letterSpacing: '-0.3px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>{title}</div>
            )}
            {subtitle && (
              <div style={{
                fontSize: 11.5, color: 'var(--premium-text-4)',
                marginTop: 3, letterSpacing: '-0.005em',
              }}>{subtitle}</div>
            )}
          </div>
          {titleRight}
        </div>
      )}
      {children}
    </div>
  );
}
