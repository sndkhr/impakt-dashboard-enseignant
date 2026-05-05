// Types pour les données de l'API IMPAKT — alignés sur le vrai backend Firebase

export interface User {
  uid: string;
  prenom: string;
  nom: string;
  age?: number;
  dateNaissance?: string | null;
  ville?: string;
  email?: string;
  situation?: string;
  codeDepartement?: string;
  classe?: string;
  niveauEtudes?: string;
  quizStarted?: boolean;
  quizCompleted?: boolean;
  quizProgress?: number;
  topMetiers?: string[];
  inscriptionDate?: string | null;
  completedAt?: string | null;
  quizStartedAt?: string | null;
  lastActive?: string | null;
  connexions?: number;
  room1Completed?: boolean;
  room2Completed?: boolean;
  room3Completed?: boolean;
  room1CompletedAt?: string | null;
  room2CompletedAt?: string | null;
  room3CompletedAt?: string | null;
  structureId?: string | null;
  structureName?: string | null;
  isMinor?: boolean;
  riasecProfile?: Record<string, number> | null;
  deviceInfo?: Record<string, string> | null;
  personalityProfile?: Record<string, unknown> | null;
  totalAppTime?: number;
  lastSessionDuration?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalAPICalls?: number;
  apiCallCount?: number;
  apiErrorCount?: number;
  apiTotalLatency?: number;
  // Motivation hebdo (écrit par l'app iOS dans MotivationStore.save)
  lastMotivationScore?: number;
  lastMotivationAt?: string | { _seconds: number; _nanoseconds: number } | null;
}

// Score d'orientation complet (sous-collection scores/orientation)
export interface OrientationScoreDetail {
  riasec?: Record<string, number>;
  domaines?: Record<string, number>;
  families?: Record<string, number>;
  interests?: Record<string, number>;
  env?: Record<string, number>;
  antiFamilies?: string[];
  antiRiasec?: string[];
  antiDomaines?: string[];
  antiSector?: string | null;
  selectedBranches?: string[];
  updatedAt?: { _seconds: number; _nanoseconds: number } | null;
}

// Détail utilisateur (route /user/:uid)
export interface UserDetail extends User {
  orientationScore?: OrientationScoreDetail | null;
  pathways?: Pathway[];
  activity?: ActivityEvent[];
}

export interface Pathway {
  id: string;
  createdAt?: { toDate?: () => Date } | string;
  [key: string]: unknown;
}

export interface ActivityEvent {
  type: string;
  action: string;
  detail?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: string | null;
}

export interface TopMetier {
  name: string;
  count: number;
}

export interface DashboardData {
  totalUsers: number;
  quizCompleted: number;
  quizStarted: number;
  quizRate?: number;
  recentUsers: User[];
  topMetiers: TopMetier[];
  dailySignups: Record<string, number>;
  situationCounts?: Record<string, number>;
  departementCounts?: Record<string, number>;
  structureId?: string | null;
  structureName?: string;
  conseillerName?: string;
  generatedAt?: string;
  pagination?: {
    pageSize: number;
    returnedCount: number;
    hasMore: boolean;
    nextCursor: string | null;
  } | null;
}

// Status du parcours
export type ParcoursStatus = 'n' | 'p' | 't';

// Niveau d'alerte
export type AlertLevel = 'ok' | 'cours' | 'bloque' | 'decroch' | 'non';

// Config des statuts
export const STATUS_CONFIG: Record<ParcoursStatus, { label: string; className: string }> = {
  t: { label: 'Terminée', className: 'badge-green' },
  p: { label: 'En cours', className: 'badge-orange' },
  n: { label: 'Non démarrée', className: 'badge-grey' },
};

export const ALERT_CONFIG: Record<AlertLevel, { label: string; className: string }> = {
  ok: { label: 'En bonne voie', className: 'badge-alert-ok' },
  cours: { label: 'En cours', className: 'badge-alert-cours' },
  bloque: { label: 'Bloqué', className: 'badge-alert-bloque' },
  decroch: { label: 'Décrochage', className: 'badge-alert-decroch' },
  non: { label: 'Non démarré', className: 'badge-alert-non' },
};

// Helpers pour calculer le statut d'alerte à partir des vraies données
export function computeAlertLevel(u: User): AlertLevel {
  const daysSinceActive = u.lastActive
    ? Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 864e5)
    : u.inscriptionDate
      ? Math.floor((Date.now() - new Date(u.inscriptionDate).getTime()) / 864e5)
      : 999;

  if (u.quizCompleted && (u.quizProgress ?? 100) >= 100) return 'ok';
  if ((u.connexions || 0) < 1 && !u.quizStarted) return 'non';
  if (!u.quizStarted && daysSinceActive > 14) return 'decroch';
  if (u.quizStarted && !u.quizCompleted && daysSinceActive > 7) return 'bloque';
  if (u.quizStarted) return 'cours';
  return 'non';
}

export function computeParcoursStatus(u: User): ParcoursStatus {
  if (u.quizCompleted) return 't';
  if (u.quizStarted) return 'p';
  return 'n';
}

export function formatNiveauEtudes(niv?: string): string {
  if (!niv) return '—';
  const map: Record<string, string> = {
    'sans_diplome': 'Sans diplôme',
    'brevet': 'Brevet',
    'cap_bep': 'CAP/BEP',
    'bac': 'Bac',
    'bac+2': 'Bac+2',
    'bac+3': 'Bac+3',
    'bac+5': 'Bac+5',
    'superieur': 'Bac+5 et plus',
    // Au cas où les valeurs sont déjà lisibles
    'Sans diplôme': 'Sans diplôme',
    'CAP/BEP': 'CAP/BEP',
    'Bac': 'Bac',
    'Bac+2': 'Bac+2',
    'Bac+3': 'Bac+3',
    'Bac+5': 'Bac+5',
  };
  return map[niv] || niv;
}

export function formatDateFr(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateLongFr(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
