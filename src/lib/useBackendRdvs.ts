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
  fetchBadgesAPI, Badges,
} from '@/lib/api';

// =====================================================
// Coûts 30/09 — RAFRAÎCHISSEMENT PARTAGÉ
// Avant : chaque composant lançait son propre minuteur (notifications en double, conversations en double…), toutes
// les 4 à 15 s, même onglet caché → ~10 000 appels par jour et par conseiller, 95 % de la facture du dashboard.
// Maintenant, pour chaque donnée : UN seul minuteur partagé par tous les écrans, à l'intervalle le plus court demandé
// par les écrans ouverts, en PAUSE quand l'onglet est caché (mise à jour immédiate au retour), ralenti à 5 min quand le
// conseiller est inactif depuis 15 min. Les pastilles (sidebar, cloche) viennent d'un seul appel léger /badges
// toutes les 60 s ; les listes complètes ne sont chargées que par les écrans qui les affichent.
// =====================================================

const BADGES_MS = 60000;        // pastilles : toutes les minutes
const LISTE_MS = 60000;         // listes affichées (RDV, demandes de formation)
const CONV_PAGE_MS = 30000;     // liste des conversations, page Messagerie ouverte
const NOTIFS_SECU_MS = 600000;  // liste des notifications : rechargée quand une pastille bouge, sinon toutes les 10 min
const MSG_POLL_MS = 10000;      // messages de la conversation ouverte
const INACTIF_MS = 15 * 60000;  // au-delà, rafraîchissement ralenti
const INACTIF_PAS_MS = 5 * 60000;

const estVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
let derniereActivite = Date.now();
const estInactif = () => Date.now() - derniereActivite > INACTIF_MS;

interface Store<T> {
  data: T | null;
  loading: boolean;
  listeners: Set<() => void>;
  subs: Map<number, number>;          // abonné → intervalle voulu (ms)
  timer: ReturnType<typeof setInterval> | null;
  ms: number;
  lastFetch: number;
  inflight: Promise<void> | null;
  token: string | null;
  fetcher: (token: string) => Promise<T>;
}

const stores: Store<unknown>[] = [];
let prochainId = 1;

function creerStore<T>(fetcher: (token: string) => Promise<T>): Store<T> {
  const s: Store<T> = { data: null, loading: true, listeners: new Set(), subs: new Map(), timer: null, ms: 0, lastFetch: 0, inflight: null, token: null, fetcher };
  stores.push(s as Store<unknown>);
  return s;
}

function prevenir<T>(s: Store<T>) { s.listeners.forEach(cb => cb()); }

function charger<T>(s: Store<T>): Promise<void> {
  if (!s.token) return Promise.resolve();
  if (s.inflight) return s.inflight;
  const token = s.token;
  s.inflight = s.fetcher(token)
    .then(d => { s.data = d; })
    .catch(() => { /* silencieux : on garde les dernières données */ })
    .finally(() => { s.loading = false; s.inflight = null; s.lastFetch = Date.now(); prevenir(s); });
  return s.inflight;
}

function tic<T>(s: Store<T>) {
  if (!estVisible()) return;
  if (estInactif() && Date.now() - s.lastFetch < INACTIF_PAS_MS) return;
  charger(s);
}

function replanifier<T>(s: Store<T>) {
  const ms = s.subs.size ? Math.min(...Array.from(s.subs.values())) : 0;
  if (!ms || !estVisible()) {
    if (s.timer) { clearInterval(s.timer); s.timer = null; }
    s.ms = 0;
    return;
  }
  if (s.timer && s.ms === ms) return;
  if (s.timer) clearInterval(s.timer);
  s.ms = ms;
  s.timer = setInterval(() => tic(s), ms);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    stores.forEach(s => {
      if (estVisible() && s.subs.size && Date.now() - s.lastFetch > 5000) charger(s);
      replanifier(s);
    });
  });
  const activite = () => { derniereActivite = Date.now(); };
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, activite, { passive: true }));
}

/** Abonne le composant à une donnée partagée : un seul minuteur pour tous les abonnés, à l'intervalle le plus court. */
function useStore<T>(s: Store<T>, ms: number): Store<T> {
  const { token } = useAuth();
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force(x => x + 1);
    s.listeners.add(cb);
    return () => { s.listeners.delete(cb); };
  }, [s]);
  useEffect(() => {
    if (!token) return;
    if (s.token !== token) { s.token = token; s.data = null; s.loading = true; s.lastFetch = 0; }
    const id = prochainId++;
    s.subs.set(id, ms);
    replanifier(s);
    if (!s.data || Date.now() - s.lastFetch > ms) charger(s);
    return () => { s.subs.delete(id); replanifier(s); };
  }, [s, token, ms]);
  return s;
}

// =====================================================
// PASTILLES (sidebar, cloche, badge RDV)
// =====================================================
const badgesStore = creerStore<Badges>(fetchBadgesAPI);

export function useBadges() {
  const s = useStore(badgesStore, BADGES_MS);
  const refresh = useCallback(() => charger(badgesStore), []);
  return { badges: s.data, loading: s.loading, refresh };
}

// =====================================================
// RENDEZ-VOUS
// =====================================================
const rdvsStore = creerStore<BackendRendezvous[]>(async (token) => (await listRendezvousAPI(token)).rendezvous || []);

/** RDV du conseiller, partagés par l'Accueil et la page Rendez-vous (un seul rafraîchissement par minute). */
export function useBackendRdvs() {
  const s = useStore(rdvsStore, LISTE_MS);
  const refresh = useCallback(() => charger(rdvsStore), []);
  return { rendezvous: s.data || [], loading: s.loading, error: null as string | null, refresh };
}

// =====================================================
// NOTIFICATIONS (cloche + boîte de réception de la topbar)
// La liste n'est rechargée que quand la pastille « non lues » change (ou toutes les 10 min par sécurité).
// =====================================================
interface NotifsState {
  notifications: RdvNotification[];
  unreadCount: number;
  unreadRdvCount: number;
  unreadFormationCount: number;
  unreadOtherCount: number;
}

// v17.8 — IDs récemment marqués comme lus en local : au prochain rechargement, on FORCE read=true sur ces IDs pour que
// le serveur pas encore à jour n'écrase pas l'état local. TTL 60 s.
const recentlyReadLocal = new Map<string, number>();
const RECENTLY_READ_TTL_MS = 60 * 1000;

function applyRecentlyRead(list: RdvNotification[]): RdvNotification[] {
  const now = Date.now();
  recentlyReadLocal.forEach((ts, id) => {
    if (now - ts > RECENTLY_READ_TTL_MS) recentlyReadLocal.delete(id);
  });
  if (recentlyReadLocal.size === 0) return list;
  return list.map(n => recentlyReadLocal.has(n.id) ? { ...n, read: true } : n);
}

function etatNotifs(rawList: RdvNotification[]): NotifsState {
  const list = applyRecentlyRead(rawList);
  const unread = list.filter(n => !n.read);
  return {
    notifications: list,
    unreadCount: unread.length,
    unreadRdvCount: unread.filter(n => n.type === 'rendezvous_response').length,
    unreadFormationCount: unread.filter(n => n.type === 'formation_request').length,
    unreadOtherCount: unread.filter(n => n.type !== 'rendezvous_response' && n.type !== 'formation_request').length,
  };
}

const notifsStore = creerStore<NotifsState>(async (token) => etatNotifs((await listRdvNotificationsAPI(token)).notifications || []));
let pastilleNotifsVue: number | null = null;

function majNotifsLocales(list: RdvNotification[]) {
  notifsStore.data = etatNotifs(list);
  prevenir(notifsStore);
}

/**
 * Notifications du conseiller, partagées par la topbar, le badge RDV, les pages Rendez-vous et Formations.
 * Même interface qu'avant ; plus aucun rafraîchissement propre (la pastille /badges déclenche le rechargement).
 */
export function useRdvNotifications() {
  const { token } = useAuth();
  const s = useStore(notifsStore, NOTIFS_SECU_MS);
  const { badges } = useBadges();

  // Recharge la liste quand le nombre de non lues change côté serveur (nouvelle notification, lecture ailleurs)
  const nbServeur = badges?.notifUnread ?? null;
  useEffect(() => {
    if (nbServeur == null) return;
    if (pastilleNotifsVue !== null && pastilleNotifsVue !== nbServeur) charger(notifsStore);
    pastilleNotifsVue = nbServeur;
  }, [nbServeur]);

  const refresh = useCallback(() => charger(notifsStore), []);

  const markRead = useCallback(async (notifId: string) => {
    if (!token) return;
    recentlyReadLocal.set(notifId, Date.now());
    if (notifsStore.data) majNotifsLocales(notifsStore.data.notifications.map(n => n.id === notifId ? { ...n, read: true } : n));
    try { await markRdvNotificationReadAPI(token, notifId); } catch { /* silent */ }
    charger(badgesStore);
  }, [token]);

  const markAllRead = useCallback(async (type?: string) => {
    if (!token) return;
    if (notifsStore.data) {
      const now = Date.now();
      notifsStore.data.notifications.forEach(n => {
        if (!n.read && (!type || n.type === type)) recentlyReadLocal.set(n.id, now);
      });
      majNotifsLocales(notifsStore.data.notifications.map(n => (!type || n.type === type) ? { ...n, read: true } : n));
    }
    try { await markAllRdvNotificationsReadAPI(token, type); } catch { /* silent */ }
    charger(badgesStore);
  }, [token]);

  // v17.8 — Marque une liste d'IDs comme lus (vider la cloche ou l'inbox d'un coup).
  const markIdsAsRead = useCallback(async (ids: string[]) => {
    if (!token || ids.length === 0) return;
    const now = Date.now();
    ids.forEach(id => recentlyReadLocal.set(id, now));
    if (notifsStore.data) {
      const idSet = new Set(ids);
      majNotifsLocales(notifsStore.data.notifications.map(n => idSet.has(n.id) ? { ...n, read: true } : n));
    }
    await Promise.all(ids.map(id => markRdvNotificationReadAPI(token, id).catch(() => null)));
    charger(badgesStore);
  }, [token]);

  const st: NotifsState = s.data ?? {
    notifications: [], unreadCount: 0,
    unreadRdvCount: 0, unreadFormationCount: 0, unreadOtherCount: 0,
  };
  return {
    notifications: st.notifications,
    unreadCount: st.unreadCount,
    unreadRdvCount: st.unreadRdvCount,
    unreadFormationCount: st.unreadFormationCount,
    unreadOtherCount: st.unreadOtherCount,
    loading: s.loading,
    refresh, markRead, markAllRead, markIdsAsRead,
  };
}

// =====================================================
// DEMANDES DE FORMATION (page Formations ; la sidebar lit la pastille)
// =====================================================
const formationsStore = creerStore<{ requests: FormationRequestRow[]; pendingCount: number }>(async (token) => {
  const res = await listAllFormationRequestsAPI(token);
  return { requests: res.requests || [], pendingCount: res.pendingCount || 0 };
});

export function useFormationRequests() {
  const { token } = useAuth();
  const s = useStore(formationsStore, LISTE_MS);
  const refresh = useCallback(() => charger(formationsStore), []);

  const markProcessed = useCallback(async (requestId: string, jeuneUid: string) => {
    if (!token) return;
    try {
      await processFormationRequestAPI(token, requestId, jeuneUid);
      if (formationsStore.data) {
        formationsStore.data = {
          requests: formationsStore.data.requests.map(r => r.id === requestId ? { ...r, status: 'processed' } : r),
          pendingCount: Math.max(0, formationsStore.data.pendingCount - 1),
        };
        prevenir(formationsStore);
      }
      charger(badgesStore);
    } catch { /* silent */ }
  }, [token]);

  return { requests: s.data?.requests || [], pendingCount: s.data?.pendingCount || 0, loading: s.loading, refresh, markProcessed };
}

// =====================================================
// MESSAGERIE
// =====================================================
const convsStore = creerStore<{ conversations: BackendConversation[]; unreadTotal: number }>(async (token) => {
  const res = await listConversationsAPI(token);
  return { conversations: res.conversations || [], unreadTotal: res.unreadTotal || 0 };
});
let pastilleConvsVue: number | null = null;

/** Liste des conversations (page Messagerie) : toutes les 30 s, et tout de suite quand un nouveau message arrive. */
export function useConversations() {
  const s = useStore(convsStore, CONV_PAGE_MS);
  const { badges } = useBadges();
  const nbServeur = badges?.convUnreadTotal ?? null;
  useEffect(() => {
    if (nbServeur == null) return;
    if (pastilleConvsVue !== null && pastilleConvsVue !== nbServeur) charger(convsStore);
    pastilleConvsVue = nbServeur;
  }, [nbServeur]);
  const refresh = useCallback(async () => { await charger(convsStore); charger(badgesStore); }, []);
  return { conversations: s.data?.conversations || [], unreadTotal: s.data?.unreadTotal || 0, loading: s.loading, refresh };
}

/**
 * Messages de la conversation ouverte : toutes les 10 s, seulement onglet visible.
 * ✨ UI optimiste : `send()` ajoute le message localement IMMÉDIATEMENT puis fait l'appel API en arrière-plan.
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
    setOptimisticMessages(prev => [...prev, tempMsg]);
    (async () => {
      try {
        await sendMessageAPI(token, conversationId, text);
        await refresh();
      } catch {
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
    charger(badgesStore);
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
    // Onglet caché : aucun appel ; au retour, mise à jour immédiate
    let dernier = Date.now();
    const i = setInterval(() => {
      if (!estVisible()) return;
      if (estInactif() && Date.now() - dernier < INACTIF_PAS_MS) return;
      dernier = Date.now();
      refresh();
    }, MSG_POLL_MS);
    const auRetour = () => { if (estVisible()) { dernier = Date.now(); refresh(); } };
    document.addEventListener('visibilitychange', auRetour);
    return () => { mountedRef.current = false; clearInterval(i); document.removeEventListener('visibilitychange', auRetour); };
  }, [refresh, conversationId]);

  // Merge server + optimistic, triés par createdAt
  const messages = [...serverMessages, ...optimisticMessages].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  return { messages, loading, error, refresh, send, markRead };
}
