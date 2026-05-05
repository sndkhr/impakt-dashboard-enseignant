'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

// =====================================================
// GlassDatePicker v1.0
// Date picker glassmorphique premium qui matche le design dashboard.
// Bouton qui affiche la date, popup calendrier au clic.
// =====================================================

interface Props {
  value: string;     // YYYY-MM-DD
  onChange: (v: string) => void;
}

export function GlassDatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(value + 'T00:00:00') : undefined;

  // Close au clic dehors
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const display = selected
    ? selected.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Choisir une date';

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 14px',
          border: '1.5px solid var(--border)', borderRadius: 10,
          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
          color: 'var(--premium-text)',
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{display}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, opacity: 0.6 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.85)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(15,15,15,0.18), 0 2px 8px rgba(127,73,151,0.10)',
          padding: 10, zIndex: 100,
        }}>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (d) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                onChange(`${yyyy}-${mm}-${dd}`);
                setOpen(false);
              }
            }}
            locale={fr}
            disabled={{ before: new Date() }}
            styles={{
              caption: { color: '#171717', fontWeight: 700, fontSize: 13 },
              head_cell: { color: '#525252', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' },
              day: { fontSize: 13, fontWeight: 500, color: '#171717', borderRadius: 8 },
            }}
            modifiersStyles={{
              selected: {
                background: 'linear-gradient(135deg, #7f4997, #E84393)',
                color: '#fff', fontWeight: 700,
              },
              today: { color: '#7f4997', fontWeight: 700 },
            }}
          />
        </div>
      )}
    </div>
  );
}

// =====================================================
// GlassTimePicker — picker d'heure avec dropdown stylé
// =====================================================
interface TimeProps {
  value: string;     // HH:MM
  onChange: (v: string) => void;
}

export function GlassTimePicker({ value, onChange }: TimeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Génère les créneaux toutes les 15 min de 7h à 20h
  const slots: string[] = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of [0, 15, 30, 45]) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  const display = value ? value.replace(':', 'h') : 'Choisir une heure';

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 14px',
          border: '1.5px solid var(--border)', borderRadius: 10,
          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
          color: 'var(--premium-text)',
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{display}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, opacity: 0.6 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          maxHeight: 240, overflowY: 'auto',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.85)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(15,15,15,0.18), 0 2px 8px rgba(127,73,151,0.10)',
          padding: 6, zIndex: 100,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
        }}>
          {slots.map(s => {
            const isSelected = s === value;
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  padding: '8px 10px', borderRadius: 7,
                  border: 'none', cursor: 'pointer',
                  background: isSelected ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--premium-text-2)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: isSelected ? 700 : 500,
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.08)'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {s.replace(':', 'h')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
