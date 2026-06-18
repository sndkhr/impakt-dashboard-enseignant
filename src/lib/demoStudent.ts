// =====================================================
// Élève de DÉMO "en dur" — pour présentation (ministère).
// N'existe pas en base : injectée côté front dans api.ts
// (liste + motivation + satisfaction + rdv) ET dans
// ProfilePage (chargement de la fiche). Profil = fille,
// terminale techno STMG, profil ART + DESIGN + SOCIAL,
// motivation fragile, besoin d'aide en orientation.
// Tout est figé (top 10 écrit à la main = NE change pas).
// À RETIRER après la démo (cf. memory project_demo_student).
// =====================================================
import type { DashboardData, User, UserDetail } from '@/types';
import type { MotivationJournalDTO, MotivationAnswerDTO, SatisfactionSurveyDTO } from './api';

export const DEMO_UID = 'demo-eleve-lea-martin';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Top 10 = mélange art/design + social (varié, pas dominé par "thérapeute").
const TOP10_TITLES = [
  'designer graphique',
  'éducateur/trice spécialisé/e',
  'UX / UI designer',
  'animateur/trice socioculturel/le',
  'motion designer',
  'éducateur/trice de jeunes enfants',
  'illustrateur/trice',
  'médiateur/trice culturel/le',
  'conseiller/ère en économie sociale et familiale',
  "designer d'espace / scénographe",
];
const TOP10_IDS = TOP10_TITLES.map((_, i) => `demo_m${i + 1}`);

const JUSTIFS: Record<string, string> = {
  demo_m1: "Créer des visuels, des identités, des messages : sa créativité au service d'un projet ou d'une cause.",
  demo_m2: "Accompagner au quotidien des personnes en difficulté : un métier de terrain, humain et engagé.",
  demo_m3: "Concevoir des interfaces utiles et belles : le croisement parfait entre le design et l'attention aux autres.",
  demo_m4: "Imaginer et animer des projets culturels et sociaux : du contact, de la créativité et de l'utilité sociale.",
  demo_m5: "Animer visuels, vidéos et contenus animés : du design en mouvement, créatif et très demandé en digital.",
  demo_m6: "Accompagner l'éveil et le développement des tout-petits : un métier social, bienveillant et créatif.",
  demo_m7: "Raconter et transmettre par l'image : pour sa créativité tournée vers un public.",
  demo_m8: "Faire le lien entre les œuvres, la culture et le public : à la fois l'art et le contact humain.",
  demo_m9: "Accompagner les familles dans leur quotidien (budget, logement, vie sociale) : du social très concret.",
  demo_m10: "Concevoir des espaces et des décors : créativité, design et sensibilité artistique.",
};

// Tension France Travail par métier (affiché sous chaque titre, hors dépliage).
const HIRING: Record<string, { label: string; level: 'fort' | 'moyen' | 'faible' }> = {
  demo_m1: { label: 'Marché concurrentiel', level: 'faible' },
  demo_m2: { label: 'Recrute fortement', level: 'fort' },
  demo_m3: { label: 'Recrute bien', level: 'fort' },
  demo_m4: { label: 'Recrute', level: 'moyen' },
  demo_m5: { label: 'Recrute', level: 'moyen' },
  demo_m6: { label: 'Recrute', level: 'moyen' },
  demo_m7: { label: 'Peu de postes', level: 'faible' },
  demo_m8: { label: 'Marché concurrentiel', level: 'faible' },
  demo_m9: { label: 'Recrute', level: 'moyen' },
  demo_m10: { label: 'Peu de postes', level: 'faible' },
};

const PROFILE_ANALYSIS =
  "Léa a un profil qui combine deux moteurs forts : la création visuelle (design, image, arts appliqués) et le lien aux autres (accompagner, transmettre, aider). Elle aime imaginer, donner forme à des idées, et le faire au service des gens. Les métiers qui lui correspondent se situent donc à ce croisement art/design + social. À ce stade, son projet n'est pas encore fixé et elle exprime le besoin d'être accompagnée pour y voir plus clair — c'est normal en terminale, et c'est le bon moment pour explorer ces pistes avec elle.";

const CAREER_PATHS = [
  { name: 'Design & création visuelle', description: "Graphisme, UX/UI, direction artistique, illustration — donner forme aux idées." },
  { name: 'Travail social & éducatif', description: "Éducation spécialisée, petite enfance, animation, ESF — accompagner et faire grandir." },
  { name: 'Art, culture & médiation', description: "Médiation culturelle, projets artistiques — relier l'art et les publics." },
];

const RIASEC = { R: 1, I: 3, A: 8, S: 9, E: 4, C: 2 };

const ORIENTATION_LLM = {
  top10_ids: TOP10_IDS,
  top10_titles: TOP10_TITLES,
  profileAnalysis: PROFILE_ANALYSIS,
  justifications: JUSTIFS,
  hiringByCareerID: HIRING,
  rankJustifications: {} as Record<string, string>,
  careerPathByCareerID: {} as Record<string, string>,
  careerPaths: CAREER_PATHS,
  latencyMs: 14200,
  generatedAt: isoDaysAgo(170),
};

// Item affiché dans la liste des élèves.
export function demoListUser(): User {
  return {
    uid: DEMO_UID,
    prenom: 'Léa',
    nom: 'Lefèvre',
    age: 17,
    dateNaissance: '05/10/2008',
    email: 'lea.lefevre@email.fr',
    ville: 'Bobigny',
    codeDepartement: '93',
    situation: 'lyceen',
    classe: 'Terminale STMG',
    niveauEtudes: 'Terminale technologique',
    isMinor: true,
    quizStarted: true,
    quizCompleted: true,
    quizProgress: 100,
    room1Completed: true,
    room2Completed: true,
    room3Completed: true,
    topMetiers: TOP10_TITLES,
    inscriptionDate: isoDaysAgo(178),
    completedAt: isoDaysAgo(176),
    lastActive: isoDaysAgo(4),
    connexions: 11,
    totalAppTime: 2040,
    riasecProfile: RIASEC,
    lastMotivationScore: 32,
    lastMotivationAt: isoDaysAgo(4),
  };
}

// Activité (sous-collection acts) : historique, compteur réponses quiz,
// questions/parcours, métiers recherchés.
function demoActivity() {
  const acts: Array<{ type: string; action: string; detail: string | null; metadata?: Record<string, unknown> | null; timestamp: string }> = [];
  acts.push({ type: 'screen', action: 'tab_opened', detail: 'top10', timestamp: isoDaysAgo(12) });
  acts.push({ type: 'metier', action: 'job_viewed', detail: 'designer graphique', metadata: { sector: 'pathway_search' }, timestamp: isoDaysAgo(14) });
  acts.push({ type: 'metier', action: 'job_viewed', detail: 'éducateur/trice spécialisé/e', metadata: { sector: 'pathway_search' }, timestamp: isoDaysAgo(16) });
  // Réponses aux QUESTIONS du parcours (ce qu'elle a renseigné pour générer ses résultats).
  acts.push({
    type: 'formation', action: 'pathway_questions', detail: 'Designer graphique', timestamp: isoDaysAgo(21),
    metadata: {
      'métier': 'Designer graphique',
      'diplôme en cours': 'Bac techno STMG',
      'filière': 'Technologique (STMG)',
      'spécialités': 'Mercatique (marketing)',
      'moyenne': '14,5/20',
      'lieu': 'Île-de-France (93)',
      'durée études': '3 à 5 ans',
      'alternance': 'Oui',
      'étranger': 'Non',
    },
  });
  acts.push({
    type: 'formation', action: 'pathway_questions', detail: 'Éducateur spécialisé', timestamp: isoDaysAgo(17),
    metadata: {
      'métier': 'Éducateur spécialisé',
      'diplôme en cours': 'Bac techno STMG',
      'filière': 'Technologique (STMG)',
      'spécialités': 'Mercatique (marketing)',
      'moyenne': '14,5/20',
      'lieu': 'Île-de-France (93)',
      'durée études': '3 ans',
      'alternance': 'Oui',
      'étranger': 'Non',
    },
  });
  acts.push({
    type: 'formation', action: 'pathway_results', detail: 'Éducateur spécialisé', timestamp: isoDaysAgo(20),
    metadata: {
      parcours_publics: [{ titre: 'Voie publique — Diplôme d\'État', etape1: 'Diplôme d\'État d\'Éducateur Spécialisé (DEES) — 3 ans en IRTS', etape2: 'Stages en structure pendant la formation (ASE, IME, foyer)', etape3: 'Diplôme d\'État → poste d\'éducateur·rice spécialisé·e' }],
      parcours_prives: [{ titre: 'Voie en alternance', etape1: 'DEES en alternance (école du travail social)', etape2: 'Alternance rémunérée en structure sociale', etape3: 'Insertion progressive → poste d\'éducateur·rice spécialisé·e' }],
    },
  });
  acts.push({ type: 'screen', action: 'tab_opened', detail: 'pathway', timestamp: isoDaysAgo(22) });
  acts.push({ type: 'screen', action: 'tab_opened', detail: 'chat', timestamp: isoDaysAgo(25) });
  // Réponses au quiz (au moment de la complétion, ~6 mois) : room1×8, room2×7, room3×6.
  const rooms: Array<[string, number]> = [['room1', 8], ['room2', 7], ['room3', 6]];
  let base = 176;
  rooms.forEach(([room, n]) => {
    for (let i = 0; i < n; i++) {
      acts.push({ type: 'quiz', action: 'question_answered', detail: room, metadata: { questionIndex: i }, timestamp: isoDaysAgo(base) });
      base -= 0.3;
    }
    base -= 2;
  });
  return acts;
}

// Parcours enregistrés (sous-collection pathways) — un social, un design.
function demoPathways() {
  return [
    {
      id: 'demo_path_1',
      type: 'public',
      titre: "DE Éducateur Spécialisé (DEES)",
      metier: 'Éducateur spécialisé',
      metierTitle: 'Éducateur spécialisé',
      savedAt: isoDaysAgo(18),
      formations: [
        { nom: "Diplôme d'État d'Éducateur Spécialisé (DEES)", ecole: 'IRTS Île-de-France', ville: 'Montrouge', duree: '3 ans après le bac' },
        { nom: 'Premier poste : ASE, IME, foyer ou MECS', ecole: 'Structure médico-sociale', ville: 'Île-de-France', duree: 'Insertion' },
      ],
    },
    {
      id: 'demo_path_2',
      type: 'public',
      titre: 'Designer graphique',
      metier: 'Designer graphique',
      metierTitle: 'Designer graphique',
      savedAt: isoDaysAgo(15),
      formations: [
        { nom: 'DN MADE mention graphisme', ecole: 'Lycée (post-bac)', ville: 'Paris', duree: '3 ans' },
        { nom: "DSAA Design ou école supérieure d'art & design", ecole: "École supérieure d'art & design", ville: 'Paris', duree: '2 ans' },
      ],
    },
  ];
}

// Fiche détaillée (chargée par ProfilePage via demoUserDetail()).
export function demoUserDetail(): UserDetail {
  const base = demoListUser();
  return {
    ...base,
    orientationScore: {
      riasec: RIASEC,
      families: { 'Créatif & Artistique': 9, 'Humain & Social': 8, 'Action & Mouvement': 2, 'Sciences & Santé': 2 },
      interests: { creer: 9, contact: 7, transmettre: 6, soigner: 5, organiser: 3 },
      domaines: { B: 6, J: 5, E: 4, K: 3 },
      selectedBranches: ['creatif_design', 'creatif_arts', 'humain_accompagner', 'humain_enseigner', 'culture_mediation'],
      antiFamilies: ['Tech & Industrie'],
      antiRiasec: ['R'],
      antiDomaines: [],
      antiSector: null,
    },
    pathways: demoPathways() as unknown as UserDetail['pathways'],
    activity: demoActivity() as unknown as UserDetail['activity'],
    // Champs lus en `any` par ProfilePage (résumé auto + top 10 + chemins + genre).
    ...( {
      gender: 'femme',          // → résumé auto + ligne "Genre" au féminin
      filiere: 'technologique',
      niveauScolaire: 'bien',
      moyenneGenerale: '14,5/20',
      orientationLLM: ORIENTATION_LLM,
      top3Jobs: TOP10_TITLES,
    } as Record<string, unknown> ),
  } as unknown as UserDetail;
}

// 6 mois de journal de motivation — courbe en dents de scie (pics + creux),
// motivation fragile, besoin d'aide en orientation constant. Le plus récent
// est volontairement bas (alertes : démotivée, stress, découragée, besoin d'aide).
export function demoMotivationJournals(): MotivationJournalDTO[] {
  const ans = (value: boolean, level: MotivationAnswerDTO['level'] = null): MotivationAnswerDTO => ({ value, level });
  // du plus récent au plus ancien
  const scores = [32, 38, 45, 30, 52, 60, 48, 35, 28, 55, 68, 72, 50, 42, 58, 55];
  return scores.map((s, i): MotivationJournalDTO => ({
    id: `demo_journal_${i}`,
    createdAt: isoDaysAgo(i * 11 + 4),
    score: s,
    questionSet: 'lyceen',
    questionLabels: null,
    decouverteMetier: i === 2 ? 'Designer graphique' : null,
    motivation: ans(s >= 45, s >= 45 ? (s >= 65 ? 'forte' : 'moderee') : null),
    ressources: ans(s >= 50),               // a une idée de ce qu'elle veut faire
    visionAvenir: ans(s >= 42),
    stress: ans(s < 50, s < 50 ? (s < 35 ? 'forte' : 'moderee') : null),
    decourage: ans(s < 45),                 // peur de se tromper de voie
    visionPro: ans(s >= 48),                // se sent accompagnée
    entretienPret: ans(s >= 52),            // fait le lien avec des métiers
    besoinAideCV: ans(true),                // a besoin d'aide pour les filières post-bac
  }));
}

// Questionnaire de satisfaction — rempli en POSITIF (tout "oui" → 100/100).
export function demoSatisfactionSurveys(): SatisfactionSurveyDTO[] {
  return [{
    id: 'demo_satisfaction_1',
    createdAt: isoDaysAgo(9),
    score: 100,
    questionSet: 'lyceen',
    canImagineJob: true,
    wantUseTerminale: true,
    wouldReassure: true,
    learnedSelf: true,
    couldHelp: true,
    wouldShare: true,
  }];
}

// Injecte l'élève de démo en tête de la liste des élèves.
export function withDemoStudent(data: DashboardData): DashboardData {
  const recent = Array.isArray(data.recentUsers) ? data.recentUsers : [];
  return {
    ...data,
    recentUsers: [demoListUser(), ...recent],
    totalUsers: (data.totalUsers || 0) + 1,
    quizCompleted: (data.quizCompleted || 0) + 1,
    quizStarted: (data.quizStarted || 0) + 1,
  };
}
