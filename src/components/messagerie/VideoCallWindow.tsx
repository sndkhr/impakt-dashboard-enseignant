'use client';

// =====================================================
// VideoCallWindow — fenêtre flottante de visio Jitsi.
// Draggable, minimisable, placée au-dessus du dashboard
// sans bloquer son interactivité.
// =====================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { useVideoCall, buildDailyEmbedUrl } from '@/lib/videoCall';
import { useNav } from '@/lib/navigation';

const DEFAULT_W = 480;
const DEFAULT_H = 360;
const MIN_W = 320;
const MIN_H = 240;
const HEADER_H = 36;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function VideoCallWindow() {
  const { activeCall, endCall } = useVideoCall();
  const { currentPage } = useNav();
  // Sur la page Messagerie, l'appel est rendu en grand dans le chat panel
  // (composant InlineVideoCall) → on n'affiche pas la fenêtre flottante.
  const shouldHide = currentPage === 'messagerie';
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [minimized, setMinimized] = useState(false);
  const [duration, setDuration] = useState(0);
  const dragStateRef = useRef<{ kind: 'drag' | 'resize'; x: number; y: number; px: number; py: number; pw: number; ph: number } | null>(null);

  // Positionne la fenêtre en bas-droite la première fois
  useEffect(() => {
    if (!activeCall) return;
    setPos({
      x: window.innerWidth - DEFAULT_W - 24,
      y: window.innerHeight - DEFAULT_H - 24,
    });
    setSize({ w: DEFAULT_W, h: DEFAULT_H });
    setMinimized(false);
  }, [activeCall?.roomName]);

  // Tick de la durée
  useEffect(() => {
    if (!activeCall) return;
    const i = setInterval(() => setDuration(Date.now() - activeCall.startedAt), 1000);
    return () => clearInterval(i);
  }, [activeCall]);

  // === Drag & resize handlers ===
  const onMouseMove = useCallback((e: MouseEvent) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.kind === 'drag') {
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 80, s.px + dx)),
        y: Math.max(8, Math.min(window.innerHeight - 80, s.py + dy)),
      });
    } else {
      setSize({
        w: Math.max(MIN_W, Math.min(window.innerWidth - s.px - 16, s.pw + dx)),
        h: Math.max(MIN_H, Math.min(window.innerHeight - s.py - 16, s.ph + dy)),
      });
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragStateRef.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const startDrag = (e: React.MouseEvent, kind: 'drag' | 'resize') => {
    e.preventDefault();
    dragStateRef.current = {
      kind,
      x: e.clientX, y: e.clientY,
      px: pos.x, py: pos.y,
      pw: size.w, ph: size.h,
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!activeCall || shouldHide) return null;

  // === Mode minimisé : petite bulle ===
  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed',
          left: pos.x, top: pos.y,
          background: 'linear-gradient(135deg, #7f4997, #E84393)',
          color: '#fff',
          padding: '10px 14px 10px 10px',
          borderRadius: 999,
          boxShadow: '0 10px 30px rgba(15,15,15,0.20)',
          display: 'flex', alignItems: 'center', gap: 9,
          cursor: 'pointer',
          zIndex: 9999,
          fontFamily: 'inherit',
          userSelect: 'none',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>{getInitials(activeCall.recipientName)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}>{activeCall.recipientName.split(' ')[0]}</span>
          <span style={{ fontSize: 10, opacity: 0.85, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>● {formatDuration(duration)}</span>
        </div>
      </div>
    );
  }

  // === Mode fenêtre flottante ===
  const embedUrl = buildDailyEmbedUrl(activeCall.roomUrl, activeCall.conseillerName);

  return (
    <div style={{
      position: 'fixed',
      left: pos.x, top: pos.y,
      width: size.w, height: size.h,
      background: '#1c1917',
      borderRadius: 14,
      boxShadow: '0 20px 60px rgba(15,15,15,0.35), 0 0 0 1px rgba(255,255,255,0.08)',
      overflow: 'hidden',
      zIndex: 9999,
      fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header — drag handle */}
      <div
        onMouseDown={e => startDrag(e, 'drag')}
        style={{
          height: HEADER_H,
          background: 'rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '0 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'grab',
          flexShrink: 0,
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 6px rgba(16,185,129,0.7)',
          }} />
          <span>{activeCall.recipientName.split(' ')[0]}</span>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            {formatDuration(duration)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setMinimized(true)}
            title="Réduire"
            style={{
              width: 22, height: 22, borderRadius: 6,
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 11, height: 11 }}>
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button onClick={endCall}
            title="Raccrocher"
            style={{
              width: 22, height: 22, borderRadius: 6,
              background: '#ef4444', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ width: 12, height: 12 }}>
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="22" y1="2" x2="2" y2="22" />
            </svg>
          </button>
        </div>
      </div>

      {/* Iframe Jitsi */}
      <div style={{ flex: 1, position: 'relative' }}>
        <iframe
          src={embedUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{
            width: '100%', height: '100%',
            border: 0,
            background: '#000',
          }}
          title="Appel vidéo"
        />
      </div>

      {/* Resize handle bottom-right */}
      <div
        onMouseDown={e => startDrag(e, 'resize')}
        style={{
          position: 'absolute',
          right: 0, bottom: 0,
          width: 16, height: 16,
          cursor: 'nwse-resize',
          background: 'transparent',
        }}
      >
        <svg viewBox="0 0 16 16" style={{ width: 14, height: 14, opacity: 0.4 }}>
          <path d="M11 14h2v-2h-2v2zm-3 0h2v-2H8v2zm-3 0h2v-2H5v2zm6-3h2V9h-2v2zm-3 0h2V9H8v2zm3-3h2V6h-2v2z" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}
