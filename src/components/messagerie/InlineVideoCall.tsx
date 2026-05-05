'use client';

// =====================================================
// InlineVideoCall — vue grande de l'appel vidéo qui prend
// toute la place du chat panel sur la page Messagerie.
// =====================================================

import { useEffect, useState } from 'react';
import { useVideoCall, buildDailyEmbedUrl } from '@/lib/videoCall';

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

export default function InlineVideoCall() {
  const { activeCall, endCall } = useVideoCall();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!activeCall) return;
    const i = setInterval(() => setDuration(Date.now() - activeCall.startedAt), 1000);
    return () => clearInterval(i);
  }, [activeCall]);

  if (!activeCall) return null;

  const embedUrl = buildDailyEmbedUrl(activeCall.roomUrl, activeCall.conseillerName);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#0f0f0f',
      minHeight: 0,
    }}>
      {/* Header de l'appel */}
      <div style={{
        padding: '12px 18px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #7f4997, #E84393)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
          }}>{getInitials(activeCall.recipientName)}</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeCall.recipientName}
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px rgba(16,185,129,0.7)',
              }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
              Appel en cours · {formatDuration(duration)}
            </div>
          </div>
        </div>

        <button onClick={endCall}
          style={{
            padding: '8px 16px', borderRadius: 10,
            background: '#ef4444', color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: '0 2px 8px rgba(239,68,68,0.30)',
          }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ width: 13, height: 13 }}>
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="22" y1="2" x2="2" y2="22" />
          </svg>
          Raccrocher
        </button>
      </div>

      {/* Iframe Daily.co en grand */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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

      {/* Footer info */}
      <div style={{
        padding: '8px 18px',
        background: 'rgba(255,255,255,0.04)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        fontSize: 10.5, color: 'rgba(255,255,255,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span>💡 Tu peux naviguer ailleurs dans le dashboard, l&apos;appel suivra dans une fenêtre flottante.</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>{activeCall.roomName}</span>
      </div>
    </div>
  );
}
