'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import {
  listRendezvousAPI, BackendRendezvous,
  listRdvNotificationsAPI, RdvNotification,
  markRdvNotificationReadAPI,
  markAllRdvNotificationsReadAPI,
  listConversationsAPI, BackendConversation,
  listMessagesAPI, BackendMessage,
  sendMessageAPI, markConversationReadAPI,
  listAllFormationRequestsAPI, FormationRequestRow, processFormationRequestAPI,
} from '@/lib/api';

const POLL_INTERVAL_MS = 15000; // 15s — suffisant pour un "quasi temps reel"

// Cache module-level pour les RDV (meme principe que convsCache)
let rdvsCache: { rendezvous: BackendRendezvous[]; ts: number } | null = null;

/**
 * Hook qui poll les RDV du conseiller connecte toutes les 15s.
 * Cache module-level pour eviter le "vide puis pop" sur changement de page.
 */
export function useBackendRdvs() {
  const { token } = useAuth();
  const [rendezvous, setRendezvous] = useState<BackendRendezvous[]>(rdvsCache?.rendezvous || []);
  const [loading, setLoading] = useState(!rdvsCache);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listRendezvousAPI(token);
      const list = res.rendezvous || [];
      rdvsCache = { rendezvous: list, ts: Date.now() };
      if (!mountedRef.current) return;
      setRendezvous(list);
      setError(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return { rendezvous, loading, error, refresh };
}

// =====================================================
// v17.8 — State PARTAGÉ entre toutes les instances du hook
// (sidebar, topbar, RdvPage, FormationsPage). Un cache module-level + un
// jeu de listeners qui re-render tous les composants quand le cache change.
// Sans ça, marquer une notif lue dans une instance ne se propageait pas
// aux autres → badges qui restent à 8 même après visite de la page.
// =====================================================
interface NotifsState {
  notifications: RdvNotification[];
  unreadCount: number;
  unreadRdvCount: number;
  unreadFormationCount: number;
  unreadOtherCount: number;
}

let notifsState: NotifsState | null = null;
let notifsLoading = true;
const notifsListeners = new Set<() => void>();
// v17.8 — IDs récemment marqués comme lus en local. Au prochain refresh
// venant du polling, on FORCE read=true sur ces IDs pour ne pas que le
// backend pas encore synchronisé écrase l'état local. TTL 60s.
const recentlyReadLocal = new Map<string, number>();
const RECENTLY_READ_TTL_MS = 60 * 1000;

function applyRecentlyRead(list: RdvNotification[]): RdvNotification[] {
  const now = Date.now();
  // Nettoie les entrées expirées
  recentlyReadLocal.forEach((ts, id) => {
    if (now - ts > RECENTLY_READ_TTL_MS) recentlyReadLocal.delete(id);
  });
  if (recentlyReadLocal.size === 0) return list;
  return list.map(n => recentlyReadLocal.has(n.id) ? { ...n, read: true } : n);
}

function recomputeNotifsState(rawList: RdvNotification[]) {
  const list = applyRecentlyRead(rawList);
  const unread = list.filter(n => !n.read);
  notifsState = {
    notifications: list,
    unreadCount: unread.length,
    unreadRdvCount: unread.filter(n => n.type === 'rendezvous_response').length,
    unreadFormationCount: unread.filter(n => n.type === 'formation_request').length,
    unreadOtherCount: unread.filter(n => n.type !== 'rendezvous_response' && n.type !== 'formation_request').length,
  };
  notifsLoading = false;
  notifsListeners.forEach(cb => cb());
}

/**
 * Hook qui poll les notifications du conseiller toutes les 15s.
 * Toutes les instances du hook partagent le même state pour que le badge
 * sidebar et la cloche topbar restent synchronisés en permanence.
 */
export function useRdvNotifications() {
  const { token } = useAuth();
  const [, force] = useState(0);
  const mountedRef = useRef(true);

  // S'abonne aux changements du state partagé
  useEffect(() => {
    mountedRef.current = true;
    const cb = () => { if (mountedRef.current) force(x => x + 1); };
    notifsListeners.add(cb);
    return () => {
      mountedRef.current = false;
      notifsListeners.delete(cb);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listRdvNotificationsAPI(token);
      recomputeNotifsState(res.notifications || []);
    } catch {
      /* silent — pas critique */
    }
  }, [token]);

  const markRead = useCallback(async (notifId: string) => {
    if (!token) return;
    recentlyReadLocal.set(notifId, Date.now());
    if (notifsState) {
      const list = notifsState.notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
      recomputeNotifsState(list);
    }
    try { await markRdvNotificationReadAPI(token, notifId); } catch { /* silent */ }
  }, [token]);

  const markAllRead = useCallback(async (type?: string) => {
    if (!token) return;
    // Marque les IDs concernés en local pour résister au prochain poll
    if (notifsState) {
      const now = Date.now();
      notifsState.notifications.forEach(n => {
        if (!n.read && (!type || n.type === type)) recentlyReadLocal.set(n.id, now);
      });
      const list = notifsState.notifications.map(n => (!type || n.type === type) ? { ...n, read: true } : n);
      recomputeNotifsState(list);
    }
    try { await markAllRdvNotificationsReadAPI(token, type); } catch { /* silent */ }
  }, [token]);

  // v17.8 — Marque une liste d'IDs comme lus (utilisé pour vider la cloche
  // ou l'inbox d'un coup, peu importe le type des notifs visibles).
  const markIdsAsRead = useCallback(async (ids: string[]) => {
    if (!token || ids.length === 0) return;
    const now = Date.now();
    ids.forEach(id => recentlyReadLocal.set(id, now));
    if (notifsState) {
      const idSet = new Set(ids);
      const list = notifsState.notifications.map(n => idSet.has(n.id) ? { ...n, read: true } : n);
      recomputeNotifsState(list);
    }
    // Calls API en parallèle (pas bloquant pour l'UI)
    await Promise.all(ids.map(id =>
      markRdvNotificationReadAPI(token, id).catch(() => null)
    ));
  }, [token]);

  // Polling : un seul timer global, peu importe le nombre d'instances
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const s: NotifsState = notifsState ?? {
    notifications: [], unreadCount: 0,
    unreadRdvCount: 0, unreadFormationCount: 0, unreadOtherCount: 0,
  };
  return {
    notifications: s.notifications,
    unreadCount: s.unreadCount,
    unreadRdvCount: s.unreadRdvCount,
    unreadFormationCount: s.unreadFormationCount,
    unreadOtherCount: s.unreadOtherCount,
    loading: notifsLoading,
    refresh, markRead, markAllRead, markIdsAsRead,
  };
}

// =====================================================
// v17.8 — Demandes de formation (vue tableau de la sidebar)
// =====================================================

let formationRequestsCache: { requests: FormationRequestRow[]; pendingCount: number; ts: number } | null = null;

export function useFormationRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<FormationRequestRow[]>(formationRequestsCache?.requests || []);
  const [pendingCount, setPendingCount] = useState<number>(formationRequestsCache?.pendingCount || 0);
  const [loading, setLoading] = useState<boolean>(!formationRequestsCache);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listAllFormationRequestsAPI(token);
      const list = res.requests || [];
      formationRequestsCache = { requests: list, pendingCount: res.pendingCount || 0, ts: Date.now() };
      if (!mountedRef.current) return;
      setRequests(list);
      setPendingCount(res.pendingCount || 0);
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token]);

  const markProcessed = useCallback(async (requestId: string, jeuneUid: string) => {
    if (!token) return;
    try {
      await processFormationRequestAPI(token, requestId, jeuneUid);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'processed' } : r));
      setPendingCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return { requests, pendingCount, loading, refresh, markProcessed };
}

// =====================================================
// MESSAGERIE — Phase 3
// =====================================================

const CONV_POLL_MS = 10000; // 10s pour la liste convs (badge sidebar)
const MSG_POLL_MS = 4000;   // 4s pour les messages d'une conv ouverte

// Cache module-level partagé entre tous les useConversations() (Sidebar +
// MessageriePage). Evite que la page Messagerie reparte de zero a chaque
// montage et affiche un "Chargement..." de 1-3s alors que Sidebar a deja
// les donnees fraiches.
let convsCache: { conversations: BackendConversation[]; unreadTotal: number; ts: number } | null = null;

/**
 * Hook qui poll la liste des conversations du conseiller (toutes les 10s).
 * Utilise un cache module-level pour un affichage instantane sur changement
 * de page.
 */
export function useConversations() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<BackendConversation[]>(convsCache?.conversations || []);
  const [unreadTotal, setUnreadTotal] = useState(convsCache?.unreadTotal || 0);
  const [loading, setLoading] = useState(!convsCache);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await listConversationsAPI(token);
      const next = { conversations: res.conversations || [], unreadTotal: res.unreadTotal || 0, ts: Date.now() };
      convsCache = next;
      if (!mountedRef.current) return;
      setConversations(next.conversations);
      setUnreadTotal(next.unreadTotal);
    } catch { /* silent */ }
    finally { if (mountedRef.current) setLoading(false); }
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const i = setInterval(refresh, CONV_POLL_MS);
    return () => { mountedRef.current = false; clearInterval(i); };
  }, [refresh]);

  return { conversations, unreadTotal, loading, refresh };
}

/**
 * Hook qui poll les messages d'une conversation ouverte (toutes les 4s).
 * ✨ Avec UI optimiste : `send()` ajoute le message localement IMMÉDIATEMENT
 * puis fait l'appel API en arrière-plan. Le message apparaît donc instantanément
 * dans le chat sans avoir à attendre le serveur.
 */
export function useConversationMessages(conversationId: string | null) {
  const { token } = useAuth();
  const [serverMessages, setServerMessages] = useState<BackendMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<BackendMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!token || !conversationId) return;
    try {
      const res = await listMessagesAPI(token, conversationId);
      if (!mountedRef.current) return;
      setServerMessages(res.messages || []);
      // Filtre les optimistic messages dont le contenu existe maintenant côté serveur
      setOptimisticMessages(prev => prev.filter(opt =>
        !(res.messages || []).some(m => m.text === opt.text && m.senderType === opt.senderType)
      ));
      setError(null);
    } catch (e: unknown) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token, conversationId]);

  // ✨ send() avec UI optimiste : retour immédiat, API en background
  const send = useCallback((text: string): boolean => {
    if (!token || !conversationId) return false;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const tempMsg: BackendMessage = {
      id: tempId,
      text,
      senderType: 'conseiller',
      senderUid: null,
      senderName: null,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    // Ajoute le message optimiste IMMÉDIATEMENT
    setOptimisticMessages(prev => [...prev, tempMsg]);
    // Fire-and-forget : l'API call est en arrière-plan
    (async () => {
      try {
        await sendMessageAPI(token, conversationId, text);
        await refresh();
      } catch {
        // En cas d'erreur, on retire l'optimistic msg
        if (mountedRef.current) {
          setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
        }
      }
    })();
    return true;
  }, [token, conversationId, refresh]);

  const markRead = useCallback(async () => {
    if (!token || !conversationId) return;
    try { await markConversationReadAPI(token, conversationId); } catch { /* silent */ }
  }, [token, conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!conversationId) {
      setServerMessages([]);
      setOptimisticMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
    const i = setInterval(refresh, MSG_POLL_MS);
    return () => { mountedRef.current = false; clearInterval(i); };
  }, [refresh, conversationId]);

  // Merge server + optimistic, triés par createdAt
  const messages = [...serverMessages, ...optimisticMessages].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  return { messages, loading, error, refresh, send, markRead };
}
