'use client';

/* ============================================================
   NOTIFICATIONS tracking (localStorage) — avec COOLDOWNS
   Garde trace des rappels/relances envoyes par categorie + uid.
   Structure : { [kind]: { [uid]: { sentAt: ISO, count: number } } }

   --- Principe smart ---
   Apres un envoi, le jeune est considere "traite" pendant une duree
   de cooldown (5j debloquer / 10j relancer). Au-dela, s'il n'a
   toujours pas bouge, il reapparait dans la liste comme a traiter
   avec un badge "2eme relance" / "3eme relance" pour que le
   conseiller sache qu'il faut peut-etre changer de canal.
   ============================================================ */

const LS_KEY = 'impakt_sent_notifications_v1';

export type NotifKind = 'debloquer' | 'relancer';

// Cooldown en jours par type d'action
export const COOLDOWN_DAYS: Record<NotifKind, number> = {
  debloquer: 5,
  relancer: 10,
};

export interface SentRecord {
  sentAt: string;   // ISO de la derniere relance envoyee
  count: number;    // nombre total de relances envoyees (cumul)
}

type Store = Record<NotifKind, Record<string, SentRecord>>;

function readStore(): Store {
  if (typeof window === 'undefined') return { debloquer: {}, relancer: {} };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { debloquer: {}, relancer: {} };
    const parsed = JSON.parse(raw);
    // Migration backward-compat : anciens records sans count -> count = 1
    const migrate = (obj: Record<string, unknown>): Record<string, SentRecord> => {
      const result: Record<string, SentRecord> = {};
      Object.entries(obj || {}).forEach(([uid, rec]) => {
        const r = rec as { sentAt?: string; count?: number } | null;
        if (r && typeof r.sentAt === 'string') {
          result[uid] = { sentAt: r.sentAt, count: typeof r.count === 'number' ? r.count : 1 };
        }
      });
      return result;
    };
    return {
      debloquer: migrate(parsed.debloquer || {}),
      relancer: migrate(parsed.relancer || {}),
    };
  } catch { return { debloquer: {}, relancer: {} }; }
}

function writeStore(store: Store) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch { /* silent */ }
}

export function getSentMap(kind: NotifKind): Record<string, SentRecord> {
  return readStore()[kind];
}

export function markSent(kind: NotifKind, uids: string[]) {
  const store = readStore();
  const now = new Date().toISOString();
  uids.forEach(uid => {
    if (!uid) return;
    const prev = store[kind][uid];
    const prevCount = prev?.count || 0;
    store[kind][uid] = { sentAt: now, count: prevCount + 1 };
  });
  writeStore(store);
}

/** Vrai si le jeune a ete relance recemment (dans la periode de cooldown). */
export function isInCooldown(kind: NotifKind, uid?: string | null): boolean {
  if (!uid) return false;
  const rec = readStore()[kind][uid];
  if (!rec) return false;
  const elapsedMs = Date.now() - new Date(rec.sentAt).getTime();
  const cooldownMs = COOLDOWN_DAYS[kind] * 86400000;
  return elapsedMs < cooldownMs;
}

/** Nombre total de relances envoyees pour ce jeune (cumul, y compris expirees). */
export function getRelanceCount(kind: NotifKind, uid?: string | null): number {
  if (!uid) return 0;
  return readStore()[kind][uid]?.count || 0;
}

/** Jours depuis la derniere relance (null si jamais relance). */
export function getDaysSinceSent(kind: NotifKind, uid?: string | null): number | null {
  if (!uid) return null;
  const rec = readStore()[kind][uid];
  if (!rec) return null;
  return Math.floor((Date.now() - new Date(rec.sentAt).getTime()) / 86400000);
}

/** Formate une duree en texte FR humain : "aujourd'hui" / "hier" / "il y a Xj". */
export function formatSince(days: number | null): string {
  if (days === null || days === undefined) return '';
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days}j`;
}

/** Date ISO de la derniere relance (null si jamais). */
export function getLastSentAt(kind: NotifKind, uid?: string | null): string | null {
  if (!uid) return null;
  return readStore()[kind][uid]?.sentAt || null;
}

/** Alias backward-compat — renvoie si le jeune est encore en cooldown (= "traite"). */
export function isSent(kind: NotifKind, uid?: string | null): boolean {
  return isInCooldown(kind, uid);
}

/* ============================================================
   UNDO support — snapshot l'etat avant markSent pour pouvoir
   restaurer si l'utilisateur clique sur "Annuler".
   ============================================================ */
export type SentSnapshot = Record<string, SentRecord | null>;

/** Snapshote l'etat courant des uids donnes (null si pas d'entry). */
export function snapshotSent(kind: NotifKind, uids: string[]): SentSnapshot {
  const store = readStore();
  const snaps: SentSnapshot = {};
  uids.forEach(uid => { if (uid) snaps[uid] = store[kind][uid] ? { ...store[kind][uid] } : null; });
  return snaps;
}

/** Restaure l'etat snapshote (utilise par le bouton Annuler du toast). */
export function restoreSent(kind: NotifKind, snapshots: SentSnapshot) {
  const store = readStore();
  Object.entries(snapshots).forEach(([uid, snap]) => {
    if (snap === null) delete store[kind][uid];
    else store[kind][uid] = snap;
  });
  writeStore(store);
}
