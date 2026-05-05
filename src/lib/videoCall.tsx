'use client';

// =====================================================
// Video Call Context — Daily.co
// Crée une salle Daily à la volée via le backend, expose un état global
// pour que la fenêtre flottante / inline puisse l'afficher.
//
// Quand l'appel se termine (endCall), on poste automatiquement un message
// de résumé dans la conv : "📹 Appel vidéo · 3 min 45 s" — comme WhatsApp.
// =====================================================

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { sendMessageAPI } from '@/lib/api';

const CREATE_ROOM_ENDPOINT = 'https://europe-west1-impakt-6c00e.cloudfunctions.net/createVideoRoom';
const SEND_VOIP_CALL_ENDPOINT = 'https://europe-west1-impakt-6c00e.cloudfunctions.net/sendVoipCall';

export interface ActiveCall {
  roomUrl: string;
  roomName: string;
  recipientName: string;
  recipientUid: string;
  startedAt: number;
  conseillerName: string;
  conversationId?: string;
  audioOnly: boolean;
}

interface StartCallParams {
  recipientName: string;
  recipientUid: string;
  conversationId?: string;
  conseillerName: string;
  audioOnly?: boolean;
}

interface VideoCallContextValue {
  activeCall: ActiveCall | null;
  starting: boolean;
  startCall: (params: StartCallParams) => Promise<string | null>;
  endCall: () => void;
}

const VideoCallContext = createContext<VideoCallContextValue | null>(null);

function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm > 0 ? `${h} h ${mm} min` : `${h} h`;
}

export function VideoCallProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [starting, setStarting] = useState(false);

  const startCall = useCallback(async (params: StartCallParams): Promise<string | null> => {
    if (!token) {
      // eslint-disable-next-line no-console
      console.error('[videoCall] no token, cannot start call');
      return null;
    }
    setStarting(true);
    try {
      const audioOnly = !!params.audioOnly;
      const res = await fetch(CREATE_ROOM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioOnly }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        // eslint-disable-next-line no-console
        console.error('[videoCall] backend error:', res.status, errText);
        return null;
      }
      const data = await res.json();
      setActiveCall({
        roomUrl: data.roomUrl,
        roomName: data.roomName,
        recipientName: params.recipientName,
        recipientUid: params.recipientUid,
        conversationId: params.conversationId,
        conseillerName: params.conseillerName,
        audioOnly,
        startedAt: Date.now(),
      });

      // ✨ Fait sonner l'iPhone du jeune en mode CallKit (sonnerie native, même
      // écran verrouillé / silencieux). Fire-and-forget : on n'attend pas et on
      // ne bloque pas l'ouverture de la salle côté conseiller si le push échoue
      // (ex: jeune sur Android, app jamais ouverte, token VoIP absent).
      fetch(SEND_VOIP_CALL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          youthUid: params.recipientUid,
          roomUrl: data.roomUrl,
          callerName: params.conseillerName,
          hasVideo: !audioOnly,
        }),
      }).then(r => {
        if (!r.ok) {
          // eslint-disable-next-line no-console
          r.text().then(t => console.warn('[videoCall] sendVoipCall non-OK:', r.status, t));
        }
      }).catch(err => {
        // eslint-disable-next-line no-console
        console.warn('[videoCall] sendVoipCall failed (non-blocking):', err);
      });

      return data.roomUrl;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[videoCall] startCall error:', e);
      return null;
    } finally {
      setStarting(false);
    }
  }, [token]);

  const endCall = useCallback(() => {
    if (!activeCall) {
      setActiveCall(null);
      return;
    }
    // ✨ Message de résumé : on l'envoie à la fin de l'appel, façon WhatsApp.
    // Si l'appel a duré moins de 3s on suppose que la salle n'a pas pu être
    // jointe (clic accidentel) → pas de message de résumé.
    const durationSec = Math.floor((Date.now() - activeCall.startedAt) / 1000);
    if (token && activeCall.conversationId && durationSec >= 3) {
      const emoji = activeCall.audioOnly ? '📞' : '📹';
      const label = activeCall.audioOnly ? 'Appel audio' : 'Appel vidéo';
      const summary = `${emoji} ${label} · ${formatCallDuration(durationSec)}`;
      // Fire-and-forget : ne bloque pas la fermeture de la fenêtre
      sendMessageAPI(token, activeCall.conversationId, summary).catch(err => {
        // eslint-disable-next-line no-console
        console.error('[videoCall] failed to log call summary:', err);
      });
    }
    setActiveCall(null);
  }, [activeCall, token]);

  return (
    <VideoCallContext.Provider value={{ activeCall, starting, startCall, endCall }}>
      {children}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall(): VideoCallContextValue {
  const ctx = useContext(VideoCallContext);
  if (!ctx) throw new Error('useVideoCall must be used within VideoCallProvider');
  return ctx;
}

/** Construit l'URL d'embed Daily.co pour un participant donné. */
export function buildDailyEmbedUrl(roomUrl: string, displayName: string): string {
  const params = new URLSearchParams({ userName: displayName });
  return `${roomUrl}?${params.toString()}`;
}

/**
 * Détecte un message de fin d'appel ("📹 Appel vidéo · 3 min 45 s").
 * Renvoie {kind, label, duration} si match, null sinon.
 */
export function parseCallSummary(text: string): { kind: 'video' | 'audio'; label: string; duration: string } | null {
  const m = text.match(/^(📹|📞) (Appel vidéo|Appel audio) · (.+)$/);
  if (!m) return null;
  return {
    kind: m[1] === '📹' ? 'video' : 'audio',
    label: m[2],
    duration: m[3],
  };
}
