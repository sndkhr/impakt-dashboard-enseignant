import { DashboardData, UserDetail } from '@/types';

const API_URL = 'https://europe-west1-impakt-6c00e.cloudfunctions.net/dashboardAPI';
// Alias exporté — utilisé par AdminUserProfile.tsx (port de la fiche admin)
export const dashAPI = API_URL;
const CREATE_RENDEZVOUS_URL = 'https://europe-west1-impakt-6c00e.cloudfunctions.net/createRendezvous';

export async function fetchDashboardData(token: string): Promise<DashboardData> {
  // v17.8 — page_size=200 (compromis entre 50 par défaut, qui tronquait
  // Suggestions, et 500+ qui chargerait trop pour de gros volumes).
  // Au-delà de 1000 users, on devra basculer sur des endpoints dédiés
  // qui calculent les buckets côté backend.
  const response = await fetch(`${API_URL}?page_size=200`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (response.status === 403) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    throw new Error(`Erreur serveur: ${response.status}`);
  }

  return response.json();
}

export async function fetchUserDetail(token: string, uid: string): Promise<UserDetail> {
  const response = await fetch(`${API_URL}/user/${uid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (response.status === 403) {
    throw new Error('UNAUTHORIZED');
  }

  if (!response.ok) {
    throw new Error(`Erreur serveur: ${response.status}`);
  }

  return response.json();
}

// ====== ÉCRITURE FIRESTORE ======

export interface ScheduleExchangePayload {
  beneficiaireUid: string;
  type: 'tel' | 'rdv';
  date: string;
  time: string;
  note?: string;
}

export async function scheduleExchange(token: string, payload: ScheduleExchangePayload): Promise<{ success: boolean; id?: string; error?: string }> {
  const response = await fetch(`${API_URL}/exchange`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Erreur serveur: ${response.status} ${text}`);
  }

  return response.json();
}

// ====== CREATE RENDEZVOUS (Phase 2) ======

export interface CreateRendezvousPayload {
  jeuneUid?: string;
  jeunePhoneNumber?: string;
  jeuneName?: string;
  dateTime: string; // ISO avec fuseau, ex: "2026-04-30T14:00:00+02:00"
  location: string;
  objet: string;
  notes?: string;
  conseillerName?: string;
  conseillerEmail?: string;
}

export interface CreateRendezvousResponse {
  success: boolean;
  rdvId?: string;
  jeuneUid?: string | null;
  push?: { sent: boolean; messageId?: string; reason?: string };
  sms?: { sent: boolean; reference?: string; error?: string; reason?: string };
  error?: string;
}

export async function createRendezvousAPI(
  token: string,
  payload: CreateRendezvousPayload
): Promise<CreateRendezvousResponse> {
  const response = await fetch(CREATE_RENDEZVOUS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 403) throw new Error('UNAUTHORIZED');

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Erreur serveur: ${response.status}`);
  }

  return data;
}

// ====== LIST RENDEZVOUS (Phase 2) ======

export type RdvBackendStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface BackendRendezvous {
  id: string;
  conseillerUid: string;
  conseillerName: string | null;
  conseillerEmail: string | null;
  jeuneUid: string | null;
  jeunePhoneNumber: string | null;
  jeuneName: string | null;
  dateTime: string | null; // ISO
  location: string | null;
  objet: string | null;
  notes: string | null;
  status: RdvBackendStatus;
  // v17.7.28 — Qui a initié le RDV
  requestedBy?: 'jeune' | 'conseiller';
  structureId?: string | null;
  createdAt: string | null;
  respondedAt: string | null;
}

export async function listRendezvousAPI(token: string): Promise<{ rendezvous: BackendRendezvous[]; count: number; openRequestsCount?: number }> {
  const response = await fetch(`${API_URL}/rendezvous`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

// v17.7.28 — Le conseiller répond à une demande de RDV initiée par le jeune
export async function respondToJeuneRequestAPI(
  token: string,
  rdvId: string,
  body: { action: 'accept' | 'decline'; newDateTime?: string; newLocation?: string; notes?: string }
): Promise<{ success: boolean; action: string }> {
  const response = await fetch(`${API_URL}/rendezvous/${rdvId}/respond-request`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  return response.json();
}

// v17.7.29 — Modifier un RDV (date, lieu, objet, notes du conseiller, questions)
export interface UpdateRendezvousPayload {
  dateTime?: string;
  location?: string;
  objet?: string;
  notes?: string;
  conseillerNotes?: string;
  questions?: string;
  status?: 'pending' | 'accepted' | 'declined' | 'cancelled';
}
export async function updateRendezvousAPI(
  token: string,
  rdvId: string,
  payload: UpdateRendezvousPayload
): Promise<{ success: boolean; updated: string[] }> {
  const response = await fetch(`${API_URL}/rendezvous/${rdvId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || `Erreur ${response.status}`);
  }
  return response.json();
}

// v17.7.29 — Liste des RDV d'un jeune particulier (vue conseiller, fiche jeune)
export interface BackendRendezvousFull extends BackendRendezvous {
  conseillerNotes?: string | null;
  questions?: string | null;
  updatedAt?: string | null;
}
export async function listJeuneRendezvousAPI(
  token: string,
  jeuneUid: string
): Promise<{ rendezvous: BackendRendezvousFull[]; count: number }> {
  const response = await fetch(`${API_URL}/rendezvous/by-jeune/${jeuneUid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  return response.json();
}

// ====== MOTIVATION JOURNAL (hebdo) ======

export type MotivationLevel = 'legere' | 'moderee' | 'forte';
export interface MotivationAnswerDTO {
  value: boolean;
  level: MotivationLevel | null;
}
export interface MotivationJournalDTO {
  id: string;
  createdAt: string | null;
  score: number;
  motivation: MotivationAnswerDTO | null;
  ressources: MotivationAnswerDTO | null;
  visionAvenir: MotivationAnswerDTO | null;
  stress: MotivationAnswerDTO | null;
  decourage: MotivationAnswerDTO | null;
  visionPro: MotivationAnswerDTO | null;
  entretienPret: MotivationAnswerDTO | null;
  besoinAideCV: MotivationAnswerDTO | null;
}
export async function listMotivationJournalsAPI(
  token: string,
  jeuneUid: string
): Promise<{ journals: MotivationJournalDTO[]; count: number; currentScore: number | null; lastCompletedAt: string | null }> {
  const response = await fetch(`${API_URL}/motivation/by-jeune/${jeuneUid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  return response.json();
}

// ====== RDV NOTIFICATIONS (Phase 2) ======

export interface RdvNotification {
  id: string;
  /** "rendezvous_response" | "formation_request" — le type pilote l'affichage côté UI. */
  type: string;
  rdvId: string | null;
  status: 'accepted' | 'declined' | null;
  jeuneName: string | null;
  jeuneUid: string | null;
  objet: string | null;
  dateTime: string | null;
  createdAt: string | null;
  read: boolean;
  // v17.8 — Champs présents quand type === "formation_request"
  requestId?: string | null;
  metier?: string | null;
  formationNom?: string | null;
  formationOrganisme?: string | null;
}

export async function listRdvNotificationsAPI(
  token: string,
  opts?: { onlyUnread?: boolean }
): Promise<{ notifications: RdvNotification[]; unreadCount: number }> {
  const qs = opts?.onlyUnread ? '?unread=1' : '';
  const response = await fetch(`${API_URL}/notifications-rdv${qs}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

export async function markRdvNotificationReadAPI(token: string, notifId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/notifications-rdv/${notifId}/read`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

// v17.8 — Marque toutes les notifs (optionnellement filtrées par type) comme lues.
export async function markAllRdvNotificationsReadAPI(
  token: string,
  type?: string
): Promise<{ updated: number }> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const response = await fetch(`${API_URL}/notifications-rdv/mark-all-read${qs}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

// ====== v17.8 — DEMANDES DE FORMATION (jeune → conseiller) ======

export interface FormationRequest {
  id: string;
  metier: string | null;
  formationNom: string;
  formationOrganisme: string | null;
  formationVille: string | null;
  formationDuree: string | null;
  formationCodeRNCP: string | null;
  formationFinancement: string | null;
  status: string; // "pending" par défaut
  createdAt: string | null;
}

export async function listFormationRequestsAPI(
  token: string,
  jeuneUid: string
): Promise<{ requests: FormationRequest[] }> {
  const response = await fetch(`${API_URL}/formation-requests/by-jeune/${jeuneUid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

// v17.8 — Demandes formation enrichies (vue tableau de la sidebar)
export interface FormationRequestRow extends FormationRequest {
  jeuneUid: string;
  jeuneNom: string | null;
  jeuneVille: string | null;
  jeuneAge: number | null;
}

export async function listAllFormationRequestsAPI(
  token: string,
  opts?: { onlyPending?: boolean }
): Promise<{ requests: FormationRequestRow[]; pendingCount: number }> {
  const qs = opts?.onlyPending ? '?pending=1' : '';
  const response = await fetch(`${API_URL}/formation-requests${qs}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

export async function processFormationRequestAPI(
  token: string,
  requestId: string,
  jeuneUid: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/formation-requests/${requestId}/process?uid=${encodeURIComponent(jeuneUid)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

// ====== MESSAGERIE (Phase 3) ======

export type SenderType = 'jeune' | 'conseiller';

export interface BackendConversation {
  id: string;
  jeuneUid: string | null;
  jeuneName: string | null;
  conseillerUid: string;
  conseillerName: string | null;
  lastMessage: string;
  lastMessageAt: string | null;
  lastSenderType: SenderType | null;
  unreadByConseiller: number;
  unreadByJeune: number;
  createdAt: string | null;
}

export interface BackendMessage {
  id: string;
  text: string;
  senderType: SenderType;
  senderUid: string | null;
  senderName: string | null;
  createdAt: string | null;
  readAt: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
}

export async function listConversationsAPI(token: string): Promise<{ conversations: BackendConversation[]; unreadTotal: number }> {
  const response = await fetch(`${API_URL}/conversations`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

export async function listMessagesAPI(
  token: string,
  conversationId: string
): Promise<{ messages: BackendMessage[]; conversation: { id: string; jeuneUid: string | null; jeuneName: string | null; conseillerName: string | null; unreadByConseiller: number } }> {
  const response = await fetch(`${API_URL}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

export async function sendMessageAPI(
  token: string,
  conversationId: string,
  text: string
): Promise<{ success: boolean; push?: unknown }> {
  const response = await fetch(`${API_URL}/conversations/${encodeURIComponent(conversationId)}/send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

export async function markConversationReadAPI(token: string, conversationId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/conversations/${encodeURIComponent(conversationId)}/mark-read`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);
  return response.json();
}

// startConversation = envoie un premier message (le backend crée la conv si elle n'existe pas)
export async function startConversationFromDashboard(
  token: string,
  jeuneUid: string,
  text: string
): Promise<{ success: boolean; conversationId?: string }> {
  const response = await fetch(`https://europe-west1-impakt-6c00e.cloudfunctions.net/sendMessageFromDashboard`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jeuneUid, text }),
  });
  if (response.status === 403) throw new Error('UNAUTHORIZED');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Erreur serveur: ${response.status}`);
  return data;
}

export interface ValidateJobPayload {
  beneficiaireUid: string;
  jobName: string;
  jobIndex: number;
  validated: boolean;
}

export async function validateJob(token: string, payload: ValidateJobPayload): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/validate-job`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 403) throw new Error('UNAUTHORIZED');
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Erreur serveur: ${response.status} ${text}`);
  }

  return response.json();
}
