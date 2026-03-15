'use client';

import { ReactNode } from 'react';

interface SideCardProps {
  title: string;
  titleRight?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}

export default function SideCard({ title, titleRight, children, style }: SideCardProps) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '16px 18px',
      ...style,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: 'var(--text-900)',
        marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {title}
        {titleRight}
      </div>
      {children}
    </div>
  );
}
