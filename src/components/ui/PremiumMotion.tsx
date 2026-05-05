"use client";
import React, { useRef, CSSProperties, ReactNode, RefObject } from "react";
import { useCountUp, useTilt, useMousePosition, useMagnetic } from "@/lib/motion";

/* ============================================================
   PREMIUM MOTION COMPONENTS TypeScript — port depuis admin IMPAKT
   ============================================================ */

interface CountUpProps {
  value: number | string;
  duration?: number;
  format?: (v: number) => string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: CSSProperties;
  className?: string;
}
export function CountUp({ value, duration = 900, format, decimals = 0, prefix = '', suffix = '', style, className }: CountUpProps) {
  const animated = useCountUp(typeof value === 'number' ? value : 0, duration, { decimals });
  const defaultFormat = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const formatted = format ? format(animated) : defaultFormat(animated);
  if (typeof value !== 'number' || isNaN(value)) {
    return <span style={{ fontVariantNumeric: 'tabular-nums lining-nums', ...style }} className={className}>{value}</span>;
  }
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums lining-nums', ...style }} className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  spotlightColor?: string;
  size?: number;
}
export function SpotlightCard({ children, style, className, spotlightColor = 'rgba(232,67,147,0.18)', size = 320, ...rest }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { x, y, hovering } = useMousePosition(ref);
  // Si le style externe demande une layout flex column, on propage au wrapper interne
  // pour que les enfants avec flex:1 puissent remplir toute la hauteur.
  const isFlexCol = style?.display === 'flex' && style?.flexDirection === 'column';
  return (
    <div ref={ref} {...rest} className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        opacity: hovering ? 1 : 0,
        transition: 'opacity .25s ease',
        background: `radial-gradient(${size}px circle at ${x}px ${y}px, ${spotlightColor}, transparent 65%)`,
      }} />
      <div style={isFlexCol
        ? { position: 'relative', zIndex: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
        : { position: 'relative', zIndex: 2 }
      }>{children}</div>
    </div>
  );
}

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tiltOptions?: { max?: number; scale?: number; perspective?: number };
}
export function TiltCard({ children, style, className, tiltOptions, ...rest }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tilt = useTilt(ref, tiltOptions);
  return (
    <div ref={ref} {...rest} className={className}
      style={{
        transformStyle: 'preserve-3d' as const, willChange: 'transform',
        ...style,
        transform: tilt.transform || (style?.transform as string) || '',
        transition: tilt.transition,
      }}>{children}</div>
  );
}

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  magneticOptions?: { strength?: number; radius?: number };
}
export function MagneticButton({ children, onClick, style, className, magneticOptions, ...rest }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const mag = useMagnetic(ref as RefObject<HTMLElement>, magneticOptions);
  return (
    <button ref={ref} onClick={onClick} {...rest} className={className}
      style={{ ...style, transform: mag.transform, transition: mag.transition }}>
      {children}
    </button>
  );
}

interface ShimmerBoxProps { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties; className?: string }
export function ShimmerBox({ width = '100%', height = 16, radius = 6, style, className }: ShimmerBoxProps) {
  return (
    <div className={`shimmer-bg ${className || ''}`.trim()}
      style={{
        width, height, borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(15,15,15,0.06) 0%, rgba(15,15,15,0.12) 50%, rgba(15,15,15,0.06) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        ...style,
      }} />
  );
}

interface ConicRingProps { value?: number; size?: number; thickness?: number; colors?: [string, string]; sublabel?: string; label?: boolean }
export function ConicRing({ value = 0, size = 80, thickness = 8, colors = ['#7f4997', '#E84393'], sublabel, label }: ConicRingProps) {
  const pct = Math.max(0, Math.min(100, value));
  const animatedPct = useCountUp(pct, 1000);
  const angle = (animatedPct / 100) * 360;
  const innerSize = size - thickness * 2;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(15,15,15,0.06)' }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `conic-gradient(from -90deg, ${colors[0]} 0deg, ${colors[1]} ${angle}deg, transparent ${angle}deg)`,
        transition: 'background .15s ease',
      }} />
      <div style={{
        position: 'absolute', top: thickness, left: thickness, width: innerSize, height: innerSize,
        borderRadius: '50%', background: '#ffffff',
        boxShadow: 'inset 0 1px 2px rgba(15,15,15,0.04)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: size > 90 ? 20 : 16, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(animatedPct)}{label === false ? '' : '%'}
        </div>
        {sublabel && <div style={{ fontSize: 9.5, fontWeight: 600, color: '#8a8a8a', marginTop: 2, letterSpacing: '0.3px', textTransform: 'uppercase' }}>{sublabel}</div>}
      </div>
    </div>
  );
}

