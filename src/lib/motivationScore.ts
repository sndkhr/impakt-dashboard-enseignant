// =====================================================
// motivationScore — Calcul du score de motivation composite
// =====================================================
//
// Le score motivation final = 60% journal (déclaratif) + 40% engagement
// (comportement réel dans l'app). Le journal seul peut mentir (le jeune
// dit "je suis motivé" mais ne se connecte jamais), l'engagement seul ne
// capture pas l'état d'esprit. Les deux ensemble donnent le bon signal.
//
// Si pas de journal complété → on affiche que l'engagement (et on le dit
// au conseiller).
// =====================================================

interface UserDataLike {
  // Quiz
  quizStarted?: boolean;
  quizCompleted?: boolean;
  room1Completed?: boolean;
  room2Completed?: boolean;
  room3Completed?: boolean;
  // Engagement
  connexions?: number;
  totalAppTime?: number;          // en secondes
  lastActive?: string | null;     // ISO date
  // Activity (entries from acts collection — pre-filtered ou non)
  activity?: Array<{
    type?: string;
    action?: string;
    detail?: string;
    timestamp?: string;
  }>;
  // Pathways générés
  pathways?: unknown[];
  // Métiers vus (sous-collection précomputée si disponible)
  matchedJobOffers?: Array<{ viewed?: boolean; favorited?: boolean }>;
}

export interface EngagementBreakdown {
  total: number;                          // 0-100
  parts: {
    quiz: number;            // 0-30 pts
    connexions: number;      // 0-20 pts
    tempsApp: number;        // 0-15 pts
    metiersVus: number;      // 0-15 pts
    parcoursGeneres: number; // 0-10 pts
    varieteOnglets: number;  // 0-10 pts
  };
}

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

/**
 * Calcule le score d'engagement (0-100) basé sur le comportement réel
 * dans l'app. Les 7 derniers jours pèsent plus.
 */
export function computeEngagementScore(d: UserDataLike): EngagementBreakdown {
  const now = Date.now();

  // 1) Avancement du quiz (30 pts max — c'est l'action structurante de l'app)
  let quiz = 0;
  if (d.room3Completed) quiz = 30;
  else if (d.room2Completed) quiz = 22;
  else if (d.room1Completed) quiz = 15;
  else if (d.quizStarted) quiz = 5;

  // 2) Nb de connexions (20 pts max à partir de 5 connexions)
  const conn = d.connexions || 0;
  const connexions = Math.min(20, Math.round(conn * 4));

  // 3) Temps total dans l'app (15 pts max à partir de 60 min)
  const minutes = (d.totalAppTime || 0) / 60;
  const tempsApp = Math.min(15, Math.round(minutes * 0.25));

  // 4-6) Activité récente (7 derniers jours) — on filtre une fois
  const acts = (d.activity || []).filter(a => {
    if (!a.timestamp) return false;
    try {
      return now - new Date(a.timestamp).getTime() < SEVEN_DAYS_MS;
    } catch { return false; }
  });

  // 4) Métiers vus dans les 7 derniers jours (15 pts max à partir de 10)
  let jobsViewedCount = acts.filter(a => a.action === 'job_viewed').length;
  // Fallback : si on a la sous-collection matchedJobOffers, on compte les viewed
  if (jobsViewedCount === 0 && Array.isArray(d.matchedJobOffers)) {
    jobsViewedCount = d.matchedJobOffers.filter(o => o.viewed).length;
  }
  const metiersVus = Math.min(15, Math.round(jobsViewedCount * 1.5));

  // 5) Parcours/formations générés dans les 7 derniers jours (10 pts max à partir de 3)
  const pathwaysActs = acts.filter(a => a.type === 'formation' && a.action === 'pathway_results').length;
  const savedPathways = Array.isArray(d.pathways) ? d.pathways.length : 0;
  const totalPathways = pathwaysActs + savedPathways;
  const parcoursGeneres = Math.min(10, Math.round(totalPathways * 3.5));

  // 6) Variété des onglets visités dans les 7 derniers jours (10 pts max à partir de 5 onglets différents)
  const tabsVisited = new Set(
    acts.filter(a => a.action === 'tab_opened' && a.detail).map(a => a.detail)
  );
  const varieteOnglets = Math.min(10, tabsVisited.size * 2);

  const total = Math.min(100, quiz + connexions + tempsApp + metiersVus + parcoursGeneres + varieteOnglets);

  return {
    total,
    parts: { quiz, connexions, tempsApp, metiersVus, parcoursGeneres, varieteOnglets },
  };
}

/**
 * Score composite final = 60% journal + 40% engagement.
 * Si pas de journal, retourne null (l'UI affichera juste l'engagement).
 */
export function computeCompositeScore(
  journalScore: number | null,
  engagementScore: number
): number | null {
  if (journalScore == null) return null;
  return Math.round(journalScore * 0.6 + engagementScore * 0.4);
}

// =====================================================
// Palette motivation — pastel doux, cohérente avec le
// glassmorphisme du dashboard. Un SEUL endroit pour
// modifier toutes les couleurs partout.
// =====================================================
export type MotivLevel = 'forte' | 'moderee' | 'faible';

export interface MotivPalette {
  dot: string;        // couleur principale (point lumineux, barre)
  text: string;       // texte assorti pour bon contraste
  rgb: string;        // "r, g, b" pour rgba(...) — utilisé pour les halos
  gradient: string;   // "stop1, stop2" — utilisé pour les fills de barre de progression
}

export const MOTIV_PALETTE: Record<MotivLevel, MotivPalette> = {
  // Forte : dégradé de vert profond → mint, frais et premium
  forte:   { dot: '#10b981', text: '#047857', rgb: '16, 185, 129', gradient: '#059669, #34d399' },
  // Modérée : dégradé IMPAKT (violet brand → magenta brand)
  moderee: { dot: '#E84393', text: '#7f4997', rgb: '232, 67, 147', gradient: '#7f4997, #E84393' },
  // Faible : dégradé noir (slate profond → gris charbon), sobre et élégant
  faible:  { dot: '#1f2937', text: '#0f172a', rgb: '30, 41, 59',   gradient: '#0f172a, #475569' },
};

export function motivLevelFromScore(score: number): MotivLevel {
  if (score >= 70) return 'forte';
  if (score >= 40) return 'moderee';
  return 'faible';
}

export function motivLabelFromLevel(level: MotivLevel): string {
  return level === 'forte' ? 'Forte' : level === 'moderee' ? 'Modérée' : 'Faible';
}

/** Background frosted glass tinté + halo (style des pills motivation). */
export function motivGlassBg(palette: MotivPalette): string {
  return `linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 100%), rgba(${palette.rgb}, 0.12)`;
}
