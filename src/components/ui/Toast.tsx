'use client';

import { useEffect, useState, createContext, useContext, useCallback, ReactNode, useRef } from 'react';

interface ToastData {
  id: number;
  message: string;
  kind?: 'success' | 'info' | 'error';
  onUndo?: () => void;
  duration?: number; // ms
}

interface ToastContextType {
  show: (message: string, kind?: ToastData['kind']) => void;
  /** Affiche un toast avec bouton "Annuler" + barre de progression. Duration par defaut 5s. */
  showUndo: (message: string, onUndo: () => void, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {}, showUndo: () => {} };
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const show = useCallback((message: string, kind: ToastData['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, kind, duration: 3500 }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const showUndo = useCallback((message: string, onUndo: () => void, duration: number = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, kind: 'success', onUndo, duration }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, showUndo }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100); // 100 → 0 au cours de duration
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    // Progress bar animation (pour les toasts avec undo)
    if (toast.onUndo && toast.duration) {
      startRef.current = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startRef.current;
        const pct = Math.max(0, 100 - (elapsed / toast.duration!) * 100);
        setProgress(pct);
        if (pct > 0) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [toast.onUndo, toast.duration]);

  const colors = {
    success: { bg: '#ffffff', accent: '#10b981', icon: '✓' },
    info: { bg: '#ffffff', accent: '#7f4997', icon: 'ⓘ' },
    error: { bg: '#ffffff', accent: '#ef4444', icon: '!' },
  };
  const c = colors[toast.kind || 'success'];

  const handleUndo = () => {
    if (toast.onUndo) toast.onUndo();
    onDismiss();
  };

  return (
    <div style={{
      pointerEvents: 'auto',
      background: c.bg,
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(15,15,15,0.06)',
      borderRadius: 12,
      boxShadow: '0 10px 40px rgba(15,15,15,0.15), 0 2px 8px rgba(15,15,15,0.08), inset 0 1px 0 rgba(255,255,255,0.85)',
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 0,
      minWidth: 300, maxWidth: 440,
      fontFamily: 'var(--font-display)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(20px)',
      transition: 'opacity .25s ease, transform .25s cubic-bezier(0.2, 0.8, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: `${c.accent}15`,
          color: c.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
          border: `1px solid ${c.accent}30`,
        }}>{c.icon}</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--premium-text)', lineHeight: 1.4, flex: 1 }}>
          {toast.message}
        </div>
        {toast.onUndo && (
          <button
            onClick={handleUndo}
            style={{
              padding: '6px 12px',
              background: 'linear-gradient(135deg, rgba(127,73,151,0.08), rgba(232,67,147,0.08))',
              border: '1px solid rgba(127,73,151,0.20)',
              borderRadius: 8,
              color: '#7f4997',
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
              cursor: 'pointer', flexShrink: 0,
              letterSpacing: '-0.1px',
              transition: 'all .12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(127,73,151,0.15), rgba(232,67,147,0.15))'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(127,73,151,0.08), rgba(232,67,147,0.08))'; }}
          >Annuler</button>
        )}
      </div>
      {/* Barre de progression cooldown (uniquement pour undo) */}
      {toast.onUndo && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 2, background: 'rgba(15,15,15,0.05)',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #7f4997, #E84393)',
            transition: 'width .1s linear',
          }} />
        </div>
      )}
    </div>
  );
}
