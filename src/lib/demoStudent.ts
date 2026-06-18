// =====================================================
// Élève de DÉMO "en dur" — pour présentation (ministère).
// N'existe pas en base : injectée côté front dans api.ts
// (liste + fiche + motivation). Profil = fille, terminale
// technologique, social + artistique, motivation fragile,
// besoin d'aide en orientation. Tout est figé → zéro risque
// le jour J (aucune dépendance live / Claude / réseau).
// =====================================================
import type { DashboardData, User, UserDetail } from '@/types';
import type { MotivationJournalDTO, MotivationAnswerDTO } from './api';

export const DEMO_UID = 'demo-eleve-lea-martin';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const TOP10_TITLES = [
  'éducateur/trice spécialisé/e',
  'art-thérapeute',
  'animateur/trice socioculturel/le',
  'éducateur/trice de jeunes enfants',
  'médiateur/trice culturel/le',
  'ergothérapeute',
  'designer graphique',
  'professeur/e des écoles',
  'psychomotricien/ne',
  'illustrateur/trice',
];
const TOP10_IDS = TOP10_TITLES.map((_, i) => `demo_m${i + 1}`);

const JUSTIFS: Record<string, string> = {
  demo_m1: "Accompagner au quotidien des personnes en difficulté : un métier de terrain, humain et engagé, qui colle à son envie d'aider concrètement.",
  demo_m2: "Utiliser l'art (dessin, musique, théâtre) comme outil de soin : le pont parfait entre sa fibre créative et son envie d'aider les autres.",
  demo_m3: "Imaginer et animer des projets culturels et sociaux pour des publics variés : du contact, de la créativité et de l'utilité sociale.",
  demo_m4: "Accompagner l'éveil et le développement des tout-petits : un métier social, bienveillant et créatif.",
  demo_m5: "Faire le lien entre les œuvres, la culture et le public : pour quelqu'un qui aime à la fois l'art et le contact humain.",
  demo_m6: "Aider les personnes à retrouver leur autonomie par des activités concrètes et créatives : du soin, du sens, et de la créativité.",
  demo_m7: "Créer des visuels, des identités, des messages : exprimer sa créativité au service d'un projet ou d'une cause.",
  demo_m8: "Transmettre, accompagner, faire grandir des enfants : un métier profondément social et créatif au quotidien.",
  demo_m9: "Aider par le corps et le mouvement, notamment les enfants et les personnes fragiles : soin et créativité corporelle.",
  demo_m10: "Raconter et transmettre par l'image : pour sa créativité, tournée vers un public.",
};

const PROFILE_ANALYSIS =
  "Léa a un profil profondément tourné vers les autres et vers la création. Ce qui ressort le plus fort, c'est son envie d'aider, d'accompagner et de donner du sens à ce qu'elle fait — et de le faire avec sa sensibilité créative. Elle se sent à sa place dans le relationnel : écouter, soutenir, transmettre. Elle a aussi un vrai besoin d'exprimer sa créativité, par l'art, l'image ou des projets concrets. Les métiers qui lui correspondent le mieux mêlent donc ces deux dimensions, le social et la création. À ce stade, son projet n'est pas encore fixé et elle exprime le besoin d'être accompagnée pour y voir plus clair — c'est normal en terminale, et c'est le bon moment pour explorer ces pistes avec elle.";

const CAREER_PATHS = [
  { name: 'Travail social & éducatif', description: "Éducation spécialisée, petite enfance, animation — accompagner et faire grandir." },
  { name: 'Art, création & culture', description: "Design, illustration, médiation culturelle — s'exprimer et transmettre par la création." },
  { name: 'Soin & accompagnement', description: "Ergothérapie, psychomotricité, art-thérapie — aider par des approches créatives et humaines." },
];

const RIASEC = { R: 1, I: 3, A: 7, S: 9, E: 4, C: 2 };

const ORIENTATION_LLM = {
  top10_ids: TOP10_IDS,
  top10_titles: TOP10_TITLES,
  profileAnalysis: PROFILE_ANALYSIS,
  justifications: JUSTIFS,
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
    ville: 'Lyon',
    situation: 'lyceen',
    classe: 'Terminale ST2S',
    niveauEtudes: 'Terminale technologique',
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

// Fiche détaillée (route /user/:uid).
export function demoUserDetail(): UserDetail {
  const base = demoListUser();
  return {
    ...base,
    orientationScore: {
      riasec: RIASEC,
      families: { 'Humain & Social': 9, 'Créatif & Artistique': 7, 'Action & Mouvement': 2, 'Sciences & Santé': 3 },
      interests: { soigner: 8, creer: 7, contact: 7, transmettre: 6, organiser: 2 },
      domaines: { J: 6, B: 5, K: 4, E: 3 },
      selectedBranches: ['humain_accompagner', 'humain_enseigner', 'creatif_design', 'creatif_arts', 'sante_paramedical'],
      antiFamilies: ['Tech & Numérique'],
      antiRiasec: ['R'],
      antiDomaines: [],
      antiSector: null,
    },
    // Champs lus en `any` par ProfilePage (résumé auto + top 10 + chemins).
    ...( {
      gender: 'femme',          // → le résumé auto se genre au féminin ("Elle", "intéressée")
      orientationLLM: ORIENTATION_LLM,
      top3Jobs: TOP10_TITLES,
    } as Record<string, unknown> ),
    pathways: [],
    activity: [],
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
    decouverteMetier: i === 2 ? 'Art-thérapeute' : null,
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
