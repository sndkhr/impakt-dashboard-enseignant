'use client';

import { useEffect, useState, useRef } from 'react';
import { useNav, PageId } from '@/lib/navigation';

/* ============================================================
   KEYBOARD SHORTCUTS — globaux, style Linear / GitHub
   - G + H = accueil (Home)
   - G + U = utilisateurs (Users)
   - G + R = rendez-vous (Rdv)
   - G + S = suggestions
   - G + A = statistiques (Analytics)
   - G + P = paramètres
   - ? = afficher le cheatsheet
   - Esc = fermer
   (⌘K / / sont gérés par CommandPalette directement)
   ============================================================ */

const SHORTCUTS: { keys: string[]; action: 'nav' | 'help'; target?: PageId; label: string }[] = [
  { keys: ['g', 'h'], action: 'nav', target: 'home', label: 'Accueil' },
  { keys: ['g', 'u'], action: 'nav', target: 'jeunes', label: 'Utilisateurs' },
  { keys: ['g', 'r'], action: 'nav', target: 'alertes', label: 'Rendez-vous' },
  { keys: ['g', 's'], action: 'nav', target: 'suggestions', label: 'Suggestions' },
  { keys: ['g', 'a'], action: 'nav', target: 'stats', label: 'Statistiques' },
  { keys: ['g', 'p'], action: 'nav', target: 'params', label: 'Paramètres' },
  { keys: ['?'], action: 'help', label: 'Afficher l\'aide clavier' },
];

const G_TIMEOUT_MS = 1200; // fenetre pour appuyer sur la 2eme touche apres "g"

export default function KeyboardShortcuts() {
  const { navigate } = useNav();
  const [helpOpen, setHelpOpen] = useState(false);
  const gPressedRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (inInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Fermer l'aide avec Esc
      if (e.key === 'Escape' && helpOpen) {
        e.preventDefault(); setHelpOpen(false); return;
      }

      // "?" ouvre le cheatsheet
      if (e.key === '?') {
        e.preventDefault(); setHelpOpen(v => !v); return;
      }

      // Sequence "g" puis lettre
      const now = Date.now();
      if (e.key.toLowerCase() === 'g' && !gPressedRef.current) {
        gPressedRef.current = now;
        // Auto-reset apres 1.2s
        setTimeout(() => {
          if (gPressedRef.current === now) gPressedRef.current = null;
        }, G_TIMEOUT_MS);
        return;
      }
      if (gPressedRef.current && (now - gPressedRef.current) < G_TIMEOUT_MS) {
        const second = e.key.toLowerCase();
        const match = SHORTCUTS.find(s => s.action === 'nav' && s.keys[0] === 'g' && s.keys[1] === second);
        if (match && match.target) {
          e.preventDefault();
          navigate(match.target);
          gPressedRef.current = null;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate, helpOpen]);

  if (!helpOpen) return null;

  return (
    <div
      onClick={() => setHelpOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(15,15,15,0.42)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, maxWidth: '92vw',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(32px) saturate(150%)',
          WebkitBackdropFilter: 'blur(32px) saturate(150%)',
          border: '1px solid rgba(255,255,255,0.85)',
          borderRadius: 18,
          padding: '22px 24px',
          boxShadow: '0 32px 80px rgba(15,15,15,0.22), 0 8px 24px rgba(15,15,15,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
          fontFamily: 'var(--font-display)',
          animation: 'stagger-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>
              Raccourcis clavier
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', marginTop: 3 }}>
              Navigue plus vite en mode pro
            </div>
          </div>
          <button
            onClick={() => setHelpOpen(false)}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(15,15,15,0.04)',
              border: '1px solid rgba(15,15,15,0.08)',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--premium-text-3)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Section Navigation */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--premium-text-4)', marginBottom: 10 }}>
            Navigation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SHORTCUTS.filter(s => s.action === 'nav').map(s => (
              <ShortcutRow key={s.keys.join('')} keys={s.keys} label={s.label} />
            ))}
          </div>
        </div>

        {/* Section Actions */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--premium-text-4)', marginBottom: 10 }}>
            Actions globales
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ShortcutRow keys={['⌘', 'K']} label="Command palette (recherche globale)" gradient />
            <ShortcutRow keys={['/']} label="Recherche rapide" />
            <ShortcutRow keys={['?']} label="Afficher cet écran" />
            <ShortcutRow keys={['Esc']} label="Fermer un modal" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label, gradient }: { keys: string[]; label: string; gradient?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px',
      background: gradient ? 'linear-gradient(135deg, rgba(127,73,151,0.06), rgba(232,67,147,0.06))' : 'rgba(15,15,15,0.02)',
      borderRadius: 8,
      border: gradient ? '1px solid rgba(127,73,151,0.12)' : '1px solid rgba(15,15,15,0.04)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--premium-text-2)', letterSpacing: '-0.1px' }}>
        {label}
      </span>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {keys.map((k, i) => (
          <kbd key={i} style={{
            fontSize: 10.5, fontWeight: 600,
            padding: '3px 8px', borderRadius: 5,
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(15,15,15,0.10)',
            color: 'var(--premium-text)',
            fontFamily: 'inherit',
            minWidth: 20, textAlign: 'center',
            boxShadow: '0 1px 2px rgba(15,15,15,0.04)',
            letterSpacing: '0.3px',
          }}>{k}</kbd>
        ))}
      </div>
    </div>
  );
}
