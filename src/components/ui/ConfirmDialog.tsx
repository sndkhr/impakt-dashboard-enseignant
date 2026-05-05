'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// =====================================================
// ConfirmDialog v1.0
// Modal de confirmation glassmorphique réutilisable.
// Remplace le confirm() natif du navigateur par une vraie UI Impakt.
// =====================================================

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  variant = 'danger',
  onConfirm, onCancel,
}: Props) {
  // Lock body scroll
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open || typeof document === 'undefined') return null;

  // v17.7.32 — Sandra : couleurs Impakt même pour danger
  const confirmBg = 'linear-gradient(135deg, #7f4997, #E84393)';
  const confirmShadow = '0 4px 14px rgba(232,67,147,0.30)';

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,15,15,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fi .15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          borderRadius: 20,
          boxShadow: '0 12px 50px rgba(15,15,15,0.30), 0 24px 80px rgba(127,73,151,0.10), inset 0 1px 0 rgba(255,255,255,0.95)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.85)',
          animation: 'stagger-in .18s cubic-bezier(0.2, 0.8, 0.2, 1)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {/* Icône en haut — toujours dans les couleurs Impakt */}
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(127,73,151,0.12), rgba(232,67,147,0.10))',
            color: '#7f4997',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {variant === 'danger' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
        </div>

        {/* Titre + message */}
        <div style={{ padding: '14px 28px 20px', textAlign: 'center' }}>
          <div style={{
            fontSize: 17, fontWeight: 700,
            color: 'var(--premium-text)',
            letterSpacing: '-0.3px',
            marginBottom: message ? 6 : 0,
          }}>{title}</div>
          {message && (
            <div style={{
              fontSize: 12.5, color: 'var(--premium-text-3)',
              lineHeight: 1.5,
            }}>{message}</div>
          )}
        </div>

        {/* Boutons */}
        <div style={{
          padding: '14px 22px 20px',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px 18px', borderRadius: 10,
              background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.10)',
              color: 'var(--premium-text-2)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >{cancelLabel}</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 18px', borderRadius: 10,
              background: confirmBg,
              border: 'none', color: '#ffffff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: confirmShadow,
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
