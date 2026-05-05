'use client';

/* ============================================================
   SCHEDULED RDV — store unifie localStorage
   Toutes les pages (HomePage, RdvPage, SuggestionsPage, ProfilePage)
   lisent et ecrivent ici. Une seule source de verite.

   Structure : { [rdvId]: ScheduledRdv }
   Indexe par rdvId (uuid) pour permettre plusieurs RDV par user
   et l'historique. Helpers pour requeter par user, periode, etat.
   ============================================================ */

const LS_KEY = 'impakt_scheduled_rdvs_v2';
const LS_KEY_LEGACY = 'impakt_scheduled_rdvs_v1';

// v17.7.29 — Sandra : liste épurée. On garde les anciens en union pour
// compat avec les RDV historiques en localStorage, mais le modal n'expose
// plus que les nouveaux.
export type RdvType =
  | 'Suivi'
  | "Point d'étape"
  | 'Bilan test IMPAKT'
  | 'Point formations'
  | 'Premier entretien'
  | 'Autre'
  // legacy (compat)
  | 'Suivi mensuel'
  | 'Présentation métier'
  | 'Présentation formation'
  | 'Atelier CV'
  | 'Atelier réseau'
  | 'Téléphone';

export type RdvLocation = 'en agence' | 'en visio' | 'au téléphone' | 'sur site partenaire';

export type RdvStatus =
  | 'upcoming'    // a venir
  | 'imminent'    // moins de 10 min
  | 'in_progress' // en cours (entre debut et debut+90min)
  | 'done_ok'     // termine, jeune present
  | 'done_no'     // termine, jeune absent (no show)
  | 'cancelled'   // annule
  | 'past_pending'; // passe mais pas encore marque present/absent

export interface ScheduledRdv {
  id: string;             // uuid stable
  uid: string;            // user id du beneficiaire
  beneficiaireName: string; // nom complet pour affichage si user supprime
  at: string;             // ISO datetime du RDV (date + heure de debut)
  durationMin: number;    // duree estimee (defaut 60)
  type: RdvType;
  location: RdvLocation;
  note?: string;
  // Marquage de presence (apres le RDV)
  attended?: 'yes' | 'no' | null; // jeune s'est presente ou non
  conclusion?: string;    // compte-rendu rapide
  // Meta
  scheduledAt: string;    // ISO de creation
  scheduledBy: string;    // 'conseiller' (futur: id du conseiller)
}

function uuid(): string {
  return `rdv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStore(): Record<string, ScheduledRdv> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
    // Migration depuis ancien format (v1) si present
    const legacy = localStorage.getItem(LS_KEY_LEGACY);
    if (legacy) {
      const old = JSON.parse(legacy) as Record<string, { uid: string; date: string; time: string; type: 'tel' | 'rdv'; scheduledAt: string }>;
      const migrated: Record<string, ScheduledRdv> = {};
      Object.values(old).forEach(r => {
        const id = uuid();
        const at = `${r.date}T${r.time}:00`;
        migrated[id] = {
          id,
          uid: r.uid,
          beneficiaireName: '',
          at,
          durationMin: r.type === 'tel' ? 30 : 60,
          type: r.type === 'tel' ? 'Téléphone' : 'Suivi mensuel',
          location: r.type === 'tel' ? 'au téléphone' : 'en agence',
          scheduledAt: r.scheduledAt,
          scheduledBy: 'conseiller',
          attended: null,
        };
      });
      writeStore(migrated);
      return migrated;
    }
    return {};
  } catch { return {}; }
}

function writeStore(store: Record<string, ScheduledRdv>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch { /* silent */ }
}

// === API publique ===

export function listAllRdvs(): ScheduledRdv[] {
  return Object.values(readStore());
}

export function listUpcomingRdvs(): ScheduledRdv[] {
  const now = Date.now();
  return Object.values(readStore())
    .filter(r => new Date(r.at).getTime() >= now - 90 * 60000) // garde "in_progress" + futurs
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function listRdvsForUser(uid: string): ScheduledRdv[] {
  return Object.values(readStore())
    .filter(r => r.uid === uid)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function getNextRdvForUser(uid: string): ScheduledRdv | null {
  const now = Date.now();
  const upcoming = Object.values(readStore())
    .filter(r => r.uid === uid && new Date(r.at).getTime() >= now - 90 * 60000)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return upcoming[0] || null;
}

export function hasUpcomingRdv(uid: string): boolean {
  const now = Date.now();
  return Object.values(readStore()).some(r => r.uid === uid && new Date(r.at).getTime() >= now);
}

export function addRdv(input: Omit<ScheduledRdv, 'id' | 'scheduledAt' | 'scheduledBy'> & { id?: string }): ScheduledRdv {
  const store = readStore();
  const id = input.id || uuid();
  const rdv: ScheduledRdv = {
    ...input,
    id,
    scheduledAt: new Date().toISOString(),
    scheduledBy: 'conseiller',
    attended: input.attended ?? null,
  };
  store[id] = rdv;
  writeStore(store);
  return rdv;
}

export function updateRdv(id: string, patch: Partial<ScheduledRdv>): ScheduledRdv | null {
  const store = readStore();
  if (!store[id]) return null;
  store[id] = { ...store[id], ...patch };
  writeStore(store);
  return store[id];
}

export function deleteRdv(id: string): boolean {
  const store = readStore();
  if (!store[id]) return false;
  delete store[id];
  writeStore(store);
  return true;
}

export function markAttendance(id: string, attended: 'yes' | 'no', conclusion?: string): ScheduledRdv | null {
  return updateRdv(id, { attended, conclusion });
}

// === Status calcule a partir du temps + attended ===
export function getRdvStatus(rdv: ScheduledRdv): RdvStatus {
  if (rdv.attended === 'yes') return 'done_ok';
  if (rdv.attended === 'no') return 'done_no';
  const now = Date.now();
  const start = new Date(rdv.at).getTime();
  const end = start + rdv.durationMin * 60000;
  const diffMin = (start - now) / 60000;
  if (diffMin > 10) return 'upcoming';
  if (diffMin > 0) return 'imminent';
  if (now < end) return 'in_progress';
  return 'past_pending'; // passe mais pas encore marque
}

// === Compteur RDV manques (no-show) sur 12 mois ===
export function countNoShowsForUser(uid: string): number {
  const yearAgo = Date.now() - 365 * 86400000;
  return Object.values(readStore())
    .filter(r => r.uid === uid && r.attended === 'no' && new Date(r.at).getTime() >= yearAgo)
    .length;
}

// === Helpers de formatage ===
// v17.7.30 — Sandra : format compact "29/04/2026 à 10h00"
export function formatRdvDateLong(at: string): string {
  const d = new Date(at);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} à ${h}h${m}`;
}
