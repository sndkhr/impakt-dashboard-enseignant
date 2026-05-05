'use client';

import { useEffect, useMemo, useState } from 'react';
import { User } from '@/types';
import { useNav } from '@/lib/navigation';
import { getRelanceCount } from '@/lib/notifications';

/* ============================================================
   PREPARE RDV VIEW — Layout 3 colonnes logique conseiller
   Col 1 : SON PROFIL (qui est le jeune)
   Col 2 : CE QU'IL A FAIT DANS L'APP (top 10 + parcours)
   Col 3 : MES OUTILS RDV (objectif + questions + notes)
   ============================================================ */

const DAY_MS = 86400000;

function formatCountdown(ms: number): { text: string; tone: 'imminent' | 'soon' | 'later' | 'past' } {
  if (ms < 0) {
    const min = Math.floor(Math.abs(ms) / 60000);
    if (min < 60) return { text: `RDV passé · il y a ${min} min`, tone: 'past' };
    return { text: `RDV passé · il y a ${Math.floor(min / 60)}h`, tone: 'past' };
  }
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (totalMin < 10) return { text: `RDV dans ${totalMin} min`, tone: 'imminent' };
  if (totalMin < 60) return { text: `RDV dans ${mins} min`, tone: 'soon' };
  if (days === 0) return { text: `RDV dans ${hours}h${mins.toString().padStart(2, '0')}`, tone: 'soon' };
  if (days === 1) return { text: `RDV demain · ${hours}h${mins.toString().padStart(2, '0')}`, tone: 'later' };
  return { text: `RDV dans ${days}j`, tone: 'later' };
}

function formatRdvDate(d: Date): string {
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tgt = new Date(d); tgt.setHours(0, 0, 0, 0);
  const diff = Math.round((tgt.getTime() - today.getTime()) / DAY_MS);
  if (diff === 0) return `aujourd'hui · ${h}:${m}`;
  if (diff === 1) return `demain · ${h}:${m}`;
  return `${d.getDate()} ${months[d.getMonth()]} · ${h}:${m}`;
}

function formatAppTime(seconds: number | undefined): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

const RIASEC_LABELS: Record<string, { label: string; short: string; color: string }> = {
  R: { label: 'Réaliste', short: 'R', color: '#b45309' },
  I: { label: 'Investigateur', short: 'I', color: '#0369a1' },
  A: { label: 'Artistique', short: 'A', color: '#7f4997' },
  S: { label: 'Social', short: 'S', color: '#059669' },
  E: { label: 'Entreprenant', short: 'E', color: '#be123c' },
  C: { label: 'Conventionnel', short: 'C', color: '#525252' },
};

function getRiasecTop(user: User | null | undefined): { key: string; score: number }[] {
  if (!user?.riasecProfile) return [];
  return Object.entries(user.riasecProfile)
    .map(([k, v]) => ({ key: k.toUpperCase(), score: typeof v === 'number' ? v : 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// === JAUGE DE MOTIVATION ===
interface MotivationScore {
  score: number;          // 0 a 100
  label: string;
  color: string;
  signals: { text: string; positive: boolean }[];
}
function calcMotivation(user: User | null | undefined, parcoursCount: number): MotivationScore {
  if (!user) return { score: 50, label: 'À évaluer', color: '#a3a3a3', signals: [] };

  let score = 50;
  const positives: string[] = [];
  const negatives: string[] = [];
  const now = Date.now();
  const lastActiveDays = user.lastActive ? Math.floor((now - new Date(user.lastActive).getTime()) / DAY_MS) : null;
  const appTimeMin = user.totalAppTime ? Math.round(user.totalAppTime / 60) : 0;
  const debCount = user.uid ? getRelanceCount('debloquer', user.uid) : 0;
  const relCount = user.uid ? getRelanceCount('relancer', user.uid) : 0;

  // Test IMPAKT
  if (user.quizCompleted) { score += 20; positives.push('Test IMPAKT terminé'); }
  else if (user.quizProgress && user.quizProgress >= 50) { score += 10; positives.push(`Test en cours (${user.quizProgress}%)`); }
  else if (user.quizStarted) { score -= 5; negatives.push(`Test seulement à ${user.quizProgress || 0}%`); }
  else { score -= 15; negatives.push('Test non démarré'); }

  // Activité
  if (lastActiveDays !== null) {
    if (lastActiveDays <= 2) { score += 20; positives.push(`Actif ${lastActiveDays === 0 ? "aujourd'hui" : lastActiveDays === 1 ? 'hier' : 'avant-hier'}`); }
    else if (lastActiveDays <= 7) { score += 5; positives.push(`Actif il y a ${lastActiveDays}j`); }
    else if (lastActiveDays >= 14) { score -= 25; negatives.push(`Inactif depuis ${lastActiveDays}j`); }
    else if (lastActiveDays >= 7) { score -= 10; negatives.push(`Pas venu depuis ${lastActiveDays}j`); }
  }

  // Temps app
  if (appTimeMin > 60) { score += 10; positives.push(`${appTimeMin} min sur l'app`); }
  else if (appTimeMin < 10 && appTimeMin > 0) { score -= 5; }

  // Favoris
  if (parcoursCount > 0) { score += 15; positives.push(`${parcoursCount} métier${parcoursCount > 1 ? 's' : ''} en favori`); }
  else if (user.quizCompleted) { score -= 5; negatives.push('Aucun métier en favori'); }

  // Relances (effet négatif)
  const totalRelances = debCount + relCount;
  if (totalRelances > 0) { score -= Math.min(15, totalRelances * 5); negatives.push(`Déjà relancé ${totalRelances}x`); }

  score = Math.max(0, Math.min(100, score));

  // Palette IMPAKT (ZERO orange) : vert positif → neutre gris → pink IMPAKT attention → rouge
  let label: string, color: string;
  if (score >= 80) { label = 'Très motivé'; color = '#059669'; }
  else if (score >= 60) { label = 'Engagé'; color = '#10b981'; }
  else if (score >= 40) { label = 'Moyen'; color = '#94a3b8'; }
  else if (score >= 20) { label = 'En baisse'; color = '#E84393'; }
  else { label = 'Découragé'; color = '#dc2626'; }

  // Signaux : mix de 3 max (positifs et negatifs)
  const signals: { text: string; positive: boolean }[] = [
    ...positives.slice(0, 2).map(t => ({ text: t, positive: true })),
    ...negatives.slice(0, 2).map(t => ({ text: t, positive: false })),
  ].slice(0, 3);

  return { score, label, color, signals };
}

// === DATE INSCRIPTION FRANCE TRAVAIL (mock — a brancher backend) ===
function getFtInscription(user: User | null | undefined): { monthsAgo: number; dateStr: string; durationLabel: string } | null {
  if (!user?.uid) return null;
  const seed = user.uid.length;
  const monthsAgo = (seed * 2) + 1; // 1 a ~25 mois
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateStr = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  let durationLabel: string;
  if (monthsAgo < 1) durationLabel = 'ce mois-ci';
  else if (monthsAgo === 1) durationLabel = 'depuis 1 mois';
  else if (monthsAgo < 12) durationLabel = `depuis ${monthsAgo} mois`;
  else {
    const years = Math.floor(monthsAgo / 12);
    const remMonths = monthsAgo % 12;
    durationLabel = remMonths === 0 ? `depuis ${years} an${years > 1 ? 's' : ''}` : `depuis ${years} an${years > 1 ? 's' : ''} ${remMonths} mois`;
  }
  return { monthsAgo, dateStr, durationLabel };
}

// === Status pills ===
interface StatusPill { icon: 'check' | 'warning' | 'alert' | 'clock' | 'bookmark'; tone: 'positive' | 'warning' | 'negative' | 'neutral'; text: string; }
function getStatusPills(user: User | null | undefined, parcoursCount: number): StatusPill[] {
  if (!user) return [];
  const pills: StatusPill[] = [];
  const now = Date.now();
  const lastActiveDays = user.lastActive ? Math.floor((now - new Date(user.lastActive).getTime()) / DAY_MS) : null;

  if (user.quizCompleted) pills.push({ icon: 'check', tone: 'positive', text: 'Test terminé' });
  else if (user.quizStarted && (user.quizProgress || 0) >= 50) pills.push({ icon: 'clock', tone: 'warning', text: `Test à ${user.quizProgress}%` });
  else if (user.quizStarted) pills.push({ icon: 'warning', tone: 'warning', text: `Test à ${user.quizProgress || 0}%` });
  else pills.push({ icon: 'alert', tone: 'negative', text: 'Test non démarré' });

  if (lastActiveDays !== null && lastActiveDays <= 2) pills.push({ icon: 'check', tone: 'positive', text: `Actif ${lastActiveDays === 0 ? "aujourd'hui" : lastActiveDays === 1 ? 'hier' : 'avant-hier'}` });
  else if (lastActiveDays !== null && lastActiveDays >= 14) pills.push({ icon: 'alert', tone: 'negative', text: `Inactif ${lastActiveDays}j` });
  else if (lastActiveDays !== null && lastActiveDays >= 5) pills.push({ icon: 'clock', tone: 'warning', text: `Pas venu depuis ${lastActiveDays}j` });

  if (parcoursCount > 0) pills.push({ icon: 'bookmark', tone: 'neutral', text: `${parcoursCount} parcours à valider` });
  else if (user.quizCompleted) pills.push({ icon: 'warning', tone: 'warning', text: 'Aucun métier favori' });

  return pills;
}

// === Parcours ===
interface ParcoursEtape { name: string; duration: string; type: string }
interface ParcoursFormation { id: string; metier: string; generatedAt: string; etapes: ParcoursEtape[] }

function mockParcours(user: User | null | undefined): ParcoursFormation[] {
  if (!user?.topMetiers || user.topMetiers.length === 0 || !user.quizCompleted) return [];
  const seed = (user.uid || '').length;
  const count = seed % 4;
  const pool: ParcoursFormation[] = [
    { id: `pf-${seed}-1`, metier: user.topMetiers[0] || 'Métier 1', generatedAt: 'il y a 3 jours',
      etapes: [
        { name: 'Titre pro Assistant commercial', duration: '8 mois', type: 'AFPA · CPF' },
        { name: 'POEI en entreprise', duration: '3 mois', type: 'France Travail' },
      ] },
    { id: `pf-${seed}-2`, metier: user.topMetiers[1] || 'Métier 2', generatedAt: 'il y a 1 semaine',
      etapes: [
        { name: 'CQP Vendeur conseil', duration: '6 mois', type: 'CPF · AIF' },
        { name: 'Immersion (PMSMP)', duration: '2 sem.', type: 'France Travail' },
      ] },
    { id: `pf-${seed}-3`, metier: user.topMetiers[2] || 'Métier 3', generatedAt: 'il y a 2 semaines',
      etapes: [{ name: 'BTS en alternance', duration: '2 ans', type: 'Alternance' }] },
  ];
  return pool.slice(0, count);
}

type ParcoursStatus = 'pending' | 'validated' | 'discuss' | 'rejected';
function loadParcoursStatuses(uid?: string | null): Record<string, ParcoursStatus> {
  if (!uid || typeof window === 'undefined') return {};
  try { const raw = localStorage.getItem(`impakt_parcours_status_${uid}`); if (raw) return JSON.parse(raw); } catch { /* noop */ }
  return {};
}
function saveParcoursStatuses(uid: string, map: Record<string, ParcoursStatus>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`impakt_parcours_status_${uid}`, JSON.stringify(map)); } catch { /* noop */ }
}

// === Notes ===
interface Note { author: string; date: string; content: string }
function loadNotes(uid?: string | null): Note[] {
  if (!uid || typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(`impakt_notes_${uid}`); if (raw) return JSON.parse(raw); } catch { /* noop */ }
  const pool: Note[] = [
    { author: 'Sandra Khireche', date: 'il y a 3 sem.', content: 'Motivé mais encore flou sur le choix métier. À recadrer sur ses vraies forces.' },
  ];
  return pool.slice(0, (uid.length % 2) + 1);
}
function saveNotes(uid: string, notes: Note[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`impakt_notes_${uid}`, JSON.stringify(notes)); } catch { /* noop */ }
}

// === Questions ===
interface QuestionItem { id: string; text: string; custom: boolean; asked: boolean }
function loadCustomQuestions(uid?: string | null): QuestionItem[] {
  if (!uid || typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(`impakt_questions_${uid}`); if (raw) return JSON.parse(raw); } catch { /* noop */ }
  return [];
}
function saveCustomQuestions(uid: string, items: QuestionItem[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`impakt_questions_${uid}`, JSON.stringify(items)); } catch { /* noop */ }
}

function generateQuestions(rdvType: string, user?: User | null, parcoursCount: number = 0): string[] {
  const questions: string[] = [];
  const t = rdvType.toLowerCase();
  const top1 = user?.topMetiers?.[0];
  const top2 = user?.topMetiers?.[1];

  if (parcoursCount > 0 && top1) {
    questions.push(`L'app t'a généré un parcours pour "${top1}". Qu'en penses-tu ?`);
    questions.push(`Parmi les ${parcoursCount} parcours, lequel t'attire le plus ?`);
    questions.push(`La durée des formations est compatible avec ta situation ?`);
    questions.push(`Tu ferais une immersion (PMSMP) pour valider avant de t'engager ?`);
    questions.push(`Ta mobilité : jusqu'où tu peux aller pour une formation ?`);
    return questions.slice(0, 5);
  }

  if (t.includes('bilan') || t.includes('test')) {
    if (top1) questions.push(`Ton métier n°1 c'est "${top1}". Découverte ou tu y pensais déjà ?`);
    if (top2) questions.push(`Entre "${top1}" et "${top2}", lequel t'attire le plus ?`);
    questions.push(`Tu as sélectionné des favoris dans l'app ?`);
    questions.push(`Tu te verrais faire une immersion (PMSMP) ?`);
    questions.push(`Ta mobilité : jusqu'où peux-tu aller ?`);
  } else if (t.includes('premier')) {
    questions.push("Raconte-moi ton parcours : formations, jobs, stages.");
    questions.push("Tu es inscrit(e) à France Travail depuis quand ?");
    questions.push("Tu as déjà envoyé des candidatures ?");
    questions.push("Ta mobilité : jusqu'où tu peux aller ?");
    questions.push("Déjà envisagé une formation financée (CPF, AIF) ?");
  } else if (t.includes('suivi')) {
    if (top1) questions.push(`Tu as avancé sur "${top1}" depuis la dernière fois ?`);
    questions.push("Combien de candidatures depuis le dernier RDV ?");
    questions.push("Tu rencontres des blocages (mobilité, garde, logement) ?");
    questions.push("Tu as rencontré des pros (immersion, réseau) ?");
    questions.push("Ta situation administrative est à jour ?");
  } else if (t.includes('formation')) {
    if (top1) questions.push(`Cette formation mène à "${top1}" — c'est ton objectif ?`);
    questions.push("Tu as regardé les prérequis et le taux d'insertion ?");
    questions.push("Financement : CPF, AIF, région — on voit ensemble ?");
    questions.push("La durée est compatible avec tes obligations ?");
    questions.push("As-tu fait une immersion (PMSMP) pour valider ?");
  } else if (t.includes('cv') || t.includes('atelier')) {
    questions.push("Tu as un CV à jour ?");
    if (top1) questions.push(`Pour viser "${top1}", quelles expériences mettre en avant ?`);
    questions.push("Tu as postulé récemment ? Quels retours ?");
    questions.push("Tu as un LinkedIn / espace candidat à jour ?");
    questions.push("Tu sais adapter ta lettre à chaque offre ?");
  } else {
    questions.push("Comment tu te sens par rapport à ton projet ?");
    if (top1) questions.push(`"${top1}" reste ton objectif ?`);
    questions.push("Combien de candidatures depuis la dernière fois ?");
    questions.push("Tes priorités sur le mois à venir ?");
  }

  return questions.slice(0, 5);
}

// === Objectif du RDV (synthese courte) ===
function getObjectif(rdvType: string, user: User | null | undefined, parcoursCount: number, prenom: string): string {
  const t = rdvType.toLowerCase();
  const top1 = user?.topMetiers?.[0];

  if (parcoursCount > 0) return `Passer en revue les ${parcoursCount} parcours générés par l'app et décider avec ${prenom} lesquels valider.`;
  if (t.includes('bilan') || t.includes('test')) {
    if (top1) return `Échanger sur le top métier "${top1}" et inviter ${prenom} à sélectionner ses favoris dans l'app.`;
    return `Faire le point sur les résultats du test et dégager 2-3 pistes métiers à explorer.`;
  }
  if (t.includes('premier')) return `Comprendre le parcours de ${prenom} et poser les bases du projet pro.`;
  if (t.includes('suivi')) return top1 ? `Faire le point sur les actions menées sur "${top1}" depuis le dernier RDV.` : `Faire le point sur les avancées et ajuster le plan d'action.`;
  if (t.includes('formation')) return top1 ? `Valider que la formation cible bien "${top1}" et voir le financement.` : `Présenter la formation et vérifier la cohérence avec le projet.`;
  if (t.includes('cv') || t.includes('atelier')) return `Améliorer le CV et la lettre pour des candidatures ciblées.`;
  if (t.includes('métier') || t.includes('metier')) return top1 ? `Approfondir "${top1}" et voir les immersions possibles.` : `Approfondir le métier et vérifier l'adéquation.`;
  return `Faire le point sur l'avancement du projet et les prochaines étapes.`;
}

export default function PrepareRdvView() {
  const { preparingRdv, stopPreparingRdv, openProfile } = useNav();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stopPreparingRdv(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [stopPreparingRdv]);

  const countdown = useMemo(() => {
    if (!preparingRdv) return { text: '', tone: 'later' as const };
    return formatCountdown(preparingRdv.at.getTime() - now);
  }, [preparingRdv, now]);

  const user = preparingRdv?.user || null;
  const prenom = user?.prenom || preparingRdv?.name.split(' ')[0] || '';

  const parcoursList = useMemo(() => mockParcours(user), [user]);
  const statusPills = useMemo(() => getStatusPills(user, parcoursList.length), [user, parcoursList.length]);
  const riasecTop = useMemo(() => getRiasecTop(user), [user]);
  const metiers = user?.topMetiers || [];
  const objectif = useMemo(() => preparingRdv ? getObjectif(preparingRdv.type, user, parcoursList.length, prenom) : '', [preparingRdv, user, parcoursList.length, prenom]);
  const motivation = useMemo(() => calcMotivation(user, parcoursList.length), [user, parcoursList.length]);
  const ftInscription = useMemo(() => getFtInscription(user), [user]);

  const [parcoursStatuses, setParcoursStatuses] = useState<Record<string, ParcoursStatus>>({});
  useEffect(() => { if (user?.uid) setParcoursStatuses(loadParcoursStatuses(user.uid)); else setParcoursStatuses({}); }, [user?.uid]);
  const setStatus = (id: string, s: ParcoursStatus) => {
    const next = { ...parcoursStatuses, [id]: parcoursStatuses[id] === s ? 'pending' : s } as Record<string, ParcoursStatus>;
    setParcoursStatuses(next);
    if (user?.uid) saveParcoursStatuses(user.uid, next);
  };

  const autoQuestions = useMemo(() => preparingRdv ? generateQuestions(preparingRdv.type, user, parcoursList.length) : [], [preparingRdv, user, parcoursList.length]);

  const [customQuestions, setCustomQuestions] = useState<QuestionItem[]>([]);
  const [autoAsked, setAutoAsked] = useState<Set<string>>(new Set());
  const [newQuestionDraft, setNewQuestionDraft] = useState('');
  const [addingQuestion, setAddingQuestion] = useState(false);
  useEffect(() => { if (user?.uid) setCustomQuestions(loadCustomQuestions(user.uid)); else setCustomQuestions([]); }, [user?.uid]);
  const toggleAskedAuto = (q: string) => setAutoAsked(prev => { const n = new Set(prev); if (n.has(q)) n.delete(q); else n.add(q); return n; });
  const toggleAskedCustom = (id: string) => {
    const u = customQuestions.map(q => q.id === id ? { ...q, asked: !q.asked } : q);
    setCustomQuestions(u); if (user?.uid) saveCustomQuestions(user.uid, u);
  };
  const addQuestion = () => {
    const text = newQuestionDraft.trim(); if (!text || !user?.uid) return;
    const item: QuestionItem = { id: `q-${Date.now()}`, text, custom: true, asked: false };
    const u = [...customQuestions, item]; setCustomQuestions(u); saveCustomQuestions(user.uid, u);
    setNewQuestionDraft(''); setAddingQuestion(false);
  };
  const deleteQuestion = (id: string) => {
    const u = customQuestions.filter(q => q.id !== id); setCustomQuestions(u);
    if (user?.uid) saveCustomQuestions(user.uid, u);
  };

  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  useEffect(() => { if (user?.uid) setNotes(loadNotes(user.uid)); else setNotes([]); }, [user?.uid]);
  const handleAddNote = () => {
    const text = noteDraft.trim(); if (!text || !user?.uid) return;
    const n: Note = { author: 'Sandra Khireche', date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }), content: text };
    const u = [n, ...notes]; setNotes(u); saveNotes(user.uid, u);
    setNoteDraft(''); setAddingNote(false);
  };

  if (!preparingRdv) return null;

  const progress = user?.quizProgress ?? (user?.quizCompleted ? 100 : 0);
  const inscriptionDays = user?.inscriptionDate ? Math.floor((now - new Date(user.inscriptionDate).getTime()) / DAY_MS) : null;

  const cdColors = {
    imminent: { bg: '#fdf2f8', color: '#be123c', border: 'rgba(232,67,147,0.25)', pulse: true },
    soon: { bg: '#f5f3ff', color: '#7f4997', border: 'rgba(127,73,151,0.22)', pulse: false },
    later: { bg: 'rgba(15,15,15,0.04)', color: 'var(--premium-text-2)', border: 'rgba(15,15,15,0.08)', pulse: false },
    past: { bg: '#fef3c7', color: '#b45309', border: 'rgba(180,83,9,0.22)', pulse: false },
  };
  const cd = cdColors[countdown.tone];

  return (
    <div style={{ animation: 'pageFade .3s ease both', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }} className="prepare-rdv-page">

      {/* ============ MINI-BAR : retour + pills status + countdown + actions ============ */}
      <div style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 4px 14px rgba(15,15,15,0.04)',
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={stopPreparingRdv}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 7,
            background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.08)',
            color: 'var(--premium-text-3)',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            cursor: 'pointer', flexShrink: 0, transition: 'all .12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.08)'; (e.currentTarget as HTMLElement).style.color = '#7f4997'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,15,15,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--premium-text-3)'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Retour
        </button>

        {/* Separateur vertical */}
        <div style={{ width: 1, height: 20, background: 'rgba(15,15,15,0.08)', flexShrink: 0 }} />

        {/* Nom du jeune prominent */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.25px', flexShrink: 0 }}>
          {preparingRdv.name}
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {statusPills.map((p, i) => <StatusPillComp key={i} pill={p} />)}
        </div>

        <div style={{
          padding: '6px 10px', borderRadius: 8,
          background: cd.bg, color: cd.color, border: `1px solid ${cd.border}`,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          animation: cd.pulse ? 'pulse 1.8s ease-in-out infinite' : 'none',
          fontSize: 11, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.1px',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {countdown.text}
        </div>

        {user?.uid && (
          <button
            onClick={() => { if (user.uid) openProfile(user.uid); }}
            style={{
              padding: '6px 9px', borderRadius: 7,
              background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.08)',
              color: 'var(--premium-text-3)',
              fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', flexShrink: 0,
            }}
          >Profil complet →</button>
        )}
        <button
          onClick={() => { try { window.print(); } catch { /* noop */ } }}
          title="Imprimer"
          style={{
            padding: '6px 8px', borderRadius: 7,
            background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.08)',
            color: 'var(--premium-text-3)', cursor: 'pointer', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
          </svg>
        </button>
      </div>

      {/* ============ GRID 3 COLONNES ============ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 12, flex: 1, minHeight: 0,
      }} className="prepare-rdv-grid">

        {/* ╔═══════════════════════════════════════════╗ */}
        {/* ║  COL 1 : SON PROFIL (motivation + stats)  ║ */}
        {/* ╚═══════════════════════════════════════════╝ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ColumnHeader label="Son profil" />

          {/* MOTIVATION - jauge visuelle (premiere card) */}
          <Card title="Motivation actuelle" subtitle="Évaluée sur l'activité, le test et les favoris">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Donut */}
              <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
                <svg width="78" height="78" viewBox="0 0 78 78">
                  <circle cx="39" cy="39" r="32" stroke="rgba(15,15,15,0.07)" strokeWidth="7" fill="none" />
                  <circle
                    cx="39" cy="39" r="32"
                    stroke={motivation.color} strokeWidth="7" fill="none" strokeLinecap="round"
                    strokeDasharray={`${(motivation.score / 100) * 201} 201`}
                    transform="rotate(-90 39 39)"
                    style={{ transition: 'stroke-dasharray .6s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', fontWeight: 700, color: motivation.color, letterSpacing: '-0.5px', lineHeight: 1 }}>
                    <span style={{ fontSize: 22 }}>{motivation.score}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
                  </div>
                </div>
              </div>

              {/* Label + signaux */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: motivation.color, letterSpacing: '-0.2px', marginBottom: 7 }}>
                  {motivation.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {motivation.signals.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--premium-text-3)', lineHeight: 1.4 }}>
                      {s.positive ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 9, height: 9, flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 9, height: 9, flexShrink: 0 }}>
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Parcours IMPAKT */}
          <Card title="Parcours IMPAKT">
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--premium-text-2)', marginBottom: 5 }}>
                <span>Test d&apos;orientation</span>
                <span style={{ color: '#7f4997' }}>{progress}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(127,73,151,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7f4997, #E84393)', borderRadius: 999, transition: 'width .6s ease' }} />
              </div>
            </div>
            <InlineStats
              items={[
                { label: 'Connexions', value: `${user?.connexions ?? 0}` },
                { label: 'Temps app', value: formatAppTime(user?.totalAppTime) },
                { label: 'Inscrit', value: inscriptionDays === null ? '—' : inscriptionDays === 0 ? "aujourd'hui" : inscriptionDays === 1 ? 'hier' : `il y a ${inscriptionDays}j` },
                { label: 'Activité', value: user?.lastActive ? new Date(user.lastActive).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—' },
              ]}
            />
          </Card>

          {/* RIASEC */}
          {riasecTop.length > 0 && (
            <Card title="Profil RIASEC" subtitle="Top 3 dominantes (Holland)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {riasecTop.map((r, i) => {
                  const info = RIASEC_LABELS[r.key] || { label: r.key, short: r.key, color: '#525252' };
                  return (
                    <div key={r.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0',
                      borderBottom: i < riasecTop.length - 1 ? '1px solid rgba(15,15,15,0.05)' : 'none',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: `${info.color}15`, color: info.color,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        border: `1px solid ${info.color}30`,
                      }}>{info.short}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--premium-text)', flex: 1 }}>{info.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: info.color, fontVariantNumeric: 'tabular-nums' }}>{r.score}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* ╔═══════════════════════════════════════════╗ */}
        {/* ║  COL 2 : CE QU'IL A FAIT DANS L'APP      ║ */}
        {/* ╚═══════════════════════════════════════════╝ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ColumnHeader label={`Ce que ${prenom} a fait dans l'app`} />

          {/* Top 10 métiers — 2 colonnes LISIBLES : gauche 1→5, droite 6→10 */}
          {metiers.length > 0 ? (
            <Card title="Top 10 métiers" subtitle="Résultat du test d'orientation">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ display: 'flex', flexDirection: 'column' }}>
                    {metiers.slice(col * 5, col * 5 + 5).map((metier, subIdx) => {
                      const i = col * 5 + subIdx;
                      return (
                        <div key={`${metier}-${i}`} style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '7px 0',
                          borderBottom: subIdx < 4 ? '1px solid rgba(15,15,15,0.05)' : 'none',
                          minWidth: 0,
                        }}>
                          <div style={{
                            flexShrink: 0, width: 20, height: 20, borderRadius: 5,
                            background: i < 3 ? 'linear-gradient(135deg, rgba(127,73,151,0.12), rgba(232,67,147,0.12))' : 'transparent',
                            color: i < 3 ? '#7f4997' : 'var(--premium-text-4)',
                            border: i < 3 ? '1px solid rgba(127,73,151,0.18)' : '1px solid rgba(15,15,15,0.08)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          }}>{i + 1}</div>
                          <div title={metier} style={{
                            flex: 1, minWidth: 0,
                            fontSize: 11.5, fontWeight: 500,
                            color: i < 3 ? 'var(--premium-text)' : 'var(--premium-text-2)',
                            lineHeight: 1.35,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                          }}>{metier}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card title="Top 10 métiers">
              <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', fontStyle: 'italic', padding: '4px 0' }}>
                {user?.quizCompleted ? 'Aucun métier détecté.' : `Test non terminé.`}
              </div>
            </Card>
          )}

          {/* Parcours à valider */}
          <Card
            title="Parcours de formation à valider"
            subtitle={parcoursList.length > 0 ? `${parcoursList.length} généré${parcoursList.length > 1 ? 's' : ''} par l'app · à décider ensemble` : 'Aucun parcours généré'}
          >
            {parcoursList.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--premium-text-3)', padding: '6px 0', lineHeight: 1.5 }}>
                {prenom} {user?.quizCompleted
                  ? `n'a pas encore sélectionné de métier en favori. À faire ensemble au RDV.`
                  : `n'a pas encore terminé son test.`}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {parcoursList.map((pf, pIdx) => {
                  const status = parcoursStatuses[pf.id] || 'pending';
                  const accent = {
                    pending: 'linear-gradient(180deg, #7f4997, #E84393)',
                    validated: '#10b981',
                    discuss: '#f59e0b',
                    rejected: '#a3a3a3',
                  }[status];
                  const badge = {
                    pending: null as { bg: string; color: string; label: string } | null,
                    validated: { bg: 'rgba(16,185,129,0.12)', color: '#047857', label: 'Validé' },
                    discuss: { bg: 'rgba(180,83,9,0.12)', color: '#b45309', label: 'À discuter' },
                    rejected: { bg: 'rgba(15,15,15,0.08)', color: '#525252', label: 'Écarté' },
                  }[status];

                  return (
                    <div key={pf.id} style={{
                      paddingTop: pIdx === 0 ? 0 : 14,
                      paddingBottom: 14,
                      borderBottom: pIdx < parcoursList.length - 1 ? '1px solid rgba(15,15,15,0.06)' : 'none',
                      opacity: status === 'rejected' ? 0.55 : 1,
                      transition: 'opacity .15s ease',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{ flexShrink: 0, width: 4, height: 26, borderRadius: 2, background: accent }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 1 }}>
                              Parcours pour
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.15px' }}>
                              {pf.metier}
                            </div>
                          </div>
                        </div>
                        {badge && (
                          <span style={{
                            padding: '3px 9px', borderRadius: 999,
                            background: badge.bg, color: badge.color,
                            fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px',
                            flexShrink: 0,
                          }}>{badge.label}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 11, marginLeft: 14 }}>
                        {pf.etapes.map((e, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 0',
                            borderBottom: i < pf.etapes.length - 1 ? '1px dashed rgba(15,15,15,0.08)' : 'none',
                          }}>
                            <span style={{
                              flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                              background: 'rgba(127,73,151,0.08)', color: '#7f4997',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9.5, fontWeight: 700,
                              border: '1px solid rgba(127,73,151,0.18)',
                            }}>{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--premium-text)', letterSpacing: '-0.1px' }}>{e.name}</div>
                              <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 1 }}>{e.type} · {e.duration}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginLeft: 14 }}>
                        <div style={{ fontSize: 10, color: 'var(--premium-text-4)', fontStyle: 'italic' }}>
                          Généré {pf.generatedAt}
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <ValidationBtn label="Valider" active={status === 'validated'} color="#059669" activeBg="#10b981" onClick={() => setStatus(pf.id, 'validated')} />
                          <ValidationBtn label="À discuter" active={status === 'discuss'} color="#b45309" activeBg="#f59e0b" onClick={() => setStatus(pf.id, 'discuss')} />
                          <ValidationBtn label="Écarter" active={status === 'rejected'} color="#525252" activeBg="#737373" onClick={() => setStatus(pf.id, 'rejected')} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ╔═══════════════════════════════════════════╗ */}
        {/* ║  COL 3 : MES OUTILS RDV                   ║ */}
        {/* ╚═══════════════════════════════════════════╝ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ColumnHeader label="Mes outils RDV" />

          {/* CONTEXTE — FT inscription + infos admin + RDV (en HAUT A DROITE) */}
          <Card title="Contexte">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Ligne RDV */}
              {preparingRdv && (
                <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(15,15,15,0.06)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>RDV</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7f4997', letterSpacing: '-0.15px' }}>{preparingRdv.type}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 2 }}>
                    {formatRdvDate(preparingRdv.at)}{preparingRdv.location ? ' · ' + preparingRdv.location : ''}
                  </div>
                </div>
              )}
              {/* Ligne France Travail */}
              {ftInscription && (
                <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(15,15,15,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))',
                    color: '#7f4997',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(127,73,151,0.18)',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>France Travail</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.15px' }}>
                      Inscrit {ftInscription.durationLabel}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--premium-text-4)', marginTop: 1 }}>{ftInscription.dateStr}</div>
                  </div>
                </div>
              )}
              {/* Ligne identite */}
              <div style={{ padding: '10px 0 0' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Profil</div>
                <div style={{ fontSize: 12, color: 'var(--premium-text-2)', fontWeight: 600, lineHeight: 1.5 }}>
                  {user?.age ? `${user.age} ans` : ''}
                  {user?.age && user?.ville ? ' · ' : ''}
                  {user?.ville || ''}
                </div>
                {user?.situation && (
                  <div style={{
                    display: 'inline-block',
                    marginTop: 5,
                    padding: '2px 9px', borderRadius: 999,
                    background: 'rgba(127,73,151,0.06)',
                    border: '1px solid rgba(127,73,151,0.15)',
                    color: '#7f4997',
                    fontSize: 10, fontWeight: 600,
                    textTransform: 'capitalize',
                  }}>{user.situation}</div>
                )}
              </div>
            </div>
          </Card>

          {/* Objectif du RDV */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(127,73,151,0.05) 0%, rgba(232,67,147,0.05) 100%)',
            border: '1px solid rgba(127,73,151,0.15)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#7f4997" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#7f4997', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Objectif du RDV</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--premium-text)', lineHeight: 1.5, letterSpacing: '-0.1px' }}>
              {objectif}
            </div>
          </div>

          {/* Questions */}
          <Card
            title="Questions à poser"
            subtitle="Coche celles posées"
            headerAction={
              !addingQuestion && (
                <button onClick={() => setAddingQuestion(true)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(127,73,151,0.06)', border: '1px solid rgba(127,73,151,0.18)', color: '#7f4997', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Ajouter
                </button>
              )
            }
          >
            {addingQuestion && (
              <div style={{ padding: 9, marginBottom: 8, border: '1.5px solid rgba(127,73,151,0.30)', borderRadius: 8 }}>
                <textarea value={newQuestionDraft} onChange={e => setNewQuestionDraft(e.target.value)} autoFocus placeholder="Ta question…" rows={2} style={{ width: '100%', resize: 'vertical', padding: 4, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 11.5, color: 'var(--premium-text)', lineHeight: 1.5, minHeight: 38 }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 5 }}>
                  <button onClick={() => { setAddingQuestion(false); setNewQuestionDraft(''); }} style={{ padding: '3px 8px', borderRadius: 5, background: 'transparent', border: 'none', color: 'var(--premium-text-4)', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Annuler</button>
                  <button onClick={addQuestion} disabled={!newQuestionDraft.trim()} style={{ padding: '3px 10px', borderRadius: 5, background: newQuestionDraft.trim() ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'rgba(15,15,15,0.08)', border: 'none', color: newQuestionDraft.trim() ? '#ffffff' : 'var(--premium-text-4)', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: newQuestionDraft.trim() ? 'pointer' : 'not-allowed' }}>Ajouter</button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                ...autoQuestions.map((q, i) => ({ id: `auto-${i}`, num: i + 1, text: q, asked: autoAsked.has(q), custom: false, onToggle: () => toggleAskedAuto(q), onDelete: undefined as (() => void) | undefined })),
                ...customQuestions.map((q, i) => ({ id: q.id, num: autoQuestions.length + i + 1, text: q.text, asked: q.asked, custom: true, onToggle: () => toggleAskedCustom(q.id), onDelete: () => deleteQuestion(q.id) })),
              ].map((q, idx, arr) => (
                <QuestionRow key={q.id} num={q.num} text={q.text} asked={q.asked} custom={q.custom} onToggle={q.onToggle} onDelete={q.onDelete} isLast={idx === arr.length - 1} />
              ))}
            </div>
          </Card>

          {/* Notes */}
          <Card
            title="Mes notes"
            subtitle={notes.length > 0 ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Aucune note'}
            headerAction={
              !addingNote && (
                <button onClick={() => setAddingNote(true)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(127,73,151,0.06)', border: '1px solid rgba(127,73,151,0.18)', color: '#7f4997', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Ajouter
                </button>
              )
            }
          >
            {addingNote && (
              <div style={{ padding: 9, marginBottom: 8, border: '1.5px solid rgba(127,73,151,0.30)', borderRadius: 8 }}>
                <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} autoFocus placeholder="Écris ta note…" rows={3} style={{ width: '100%', resize: 'vertical', padding: 4, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 11.5, color: 'var(--premium-text)', lineHeight: 1.5, minHeight: 55 }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 5 }}>
                  <button onClick={() => { setAddingNote(false); setNoteDraft(''); }} style={{ padding: '3px 8px', borderRadius: 5, background: 'transparent', border: 'none', color: 'var(--premium-text-4)', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Annuler</button>
                  <button onClick={handleAddNote} disabled={!noteDraft.trim()} style={{ padding: '3px 10px', borderRadius: 5, background: noteDraft.trim() ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'rgba(15,15,15,0.08)', border: 'none', color: noteDraft.trim() ? '#ffffff' : 'var(--premium-text-4)', fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: noteDraft.trim() ? 'pointer' : 'not-allowed' }}>Enregistrer</button>
                </div>
              </div>
            )}
            {notes.length === 0 && !addingNote ? (
              <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', fontStyle: 'italic', padding: '4px 0' }}>Aucune note pour l&apos;instant.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {notes.map((n, i) => (
                  <div key={i} style={{
                    padding: i === 0 ? '0 0 11px' : '11px 0',
                    borderBottom: i < notes.length - 1 ? '1px solid rgba(15,15,15,0.06)' : 'none',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--premium-text-4)', marginBottom: 4, fontWeight: 600 }}>{n.date} · {n.author}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--premium-text-2)', lineHeight: 1.5 }}>{n.content}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}

// ========== SUBCOMPONENTS ==========

function ColumnHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700,
      color: 'var(--premium-text-4)',
      textTransform: 'uppercase', letterSpacing: '0.7px',
      padding: '2px 2px',
    }}>{label}</div>
  );
}

function Card({ title, subtitle, headerAction, children }: {
  title?: string; subtitle?: string; headerAction?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 14,
      padding: '13px 16px',
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
    }}>
      {(title || headerAction) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: subtitle ? 3 : 10 }}>
          {title && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.15px' }}>{title}</div>}
          {headerAction}
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginBottom: 10, letterSpacing: '-0.05px' }}>{subtitle}</div>
      )}
      {children}
    </div>
  );
}

function InlineStats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
      {items.map((it, i) => (
        <div key={i} style={{
          padding: '7px 0',
          borderBottom: i < items.length - 2 ? '1px solid rgba(15,15,15,0.05)' : 'none',
          paddingRight: i % 2 === 0 ? 8 : 0,
        }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.35px', marginBottom: 2 }}>{it.label}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--premium-text)', letterSpacing: '-0.1px' }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function StatusPillComp({ pill }: { pill: StatusPill }) {
  const toneMap = {
    positive: { bg: '#f0fdf4', color: '#047857', border: 'rgba(16,185,129,0.25)' },
    warning: { bg: '#fef3c7', color: '#b45309', border: 'rgba(180,83,9,0.25)' },
    negative: { bg: '#fee2e2', color: '#b91c1c', border: 'rgba(220,38,38,0.25)' },
    neutral: { bg: 'rgba(127,73,151,0.08)', color: '#7f4997', border: 'rgba(127,73,151,0.22)' },
  };
  const c = toneMap[pill.tone];
  const iconEl = {
    check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}><polyline points="20 6 9 17 4 12" /></svg>,
    warning: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
    clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    bookmark: <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>,
  }[pill.icon];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '-0.05px',
    }}>{iconEl}{pill.text}</span>
  );
}

function ValidationBtn({ label, active, color, activeBg, onClick }: {
  label: string; active: boolean; color: string; activeBg: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 6,
        background: active ? activeBg : 'transparent',
        border: active ? `1px solid ${activeBg}` : `1px solid ${color}30`,
        color: active ? '#ffffff' : color,
        fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
        letterSpacing: '-0.1px', cursor: 'pointer',
        transition: 'all .15s',
        boxShadow: active ? `0 2px 6px ${activeBg}40` : 'none',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = `${color}10`; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >{label}</button>
  );
}

function QuestionRow({ num, text, asked, custom, onToggle, onDelete, isLast }: {
  num: number; text: string; asked: boolean; custom?: boolean;
  onToggle: () => void; onDelete?: () => void; isLast?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 9,
      padding: '8px 0',
      borderBottom: isLast ? 'none' : '1px solid rgba(15,15,15,0.05)',
      transition: 'all .12s ease',
    }}>
      <button onClick={onToggle} aria-label={asked ? 'Remettre à poser' : 'Marquer comme posée'} style={{ flexShrink: 0, width: 17, height: 17, borderRadius: 5, background: asked ? '#059669' : 'transparent', border: asked ? 'none' : '1.5px solid rgba(127,73,151,0.30)', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', marginTop: 1 }}>
        {asked && (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><polyline points="20 6 9 17 4 12" /></svg>)}
      </button>
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: asked ? '#047857' : 'var(--premium-text-4)', fontVariantNumeric: 'tabular-nums', marginTop: 1, opacity: 0.7 }}>{num}.</span>
      <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.5, color: asked ? 'var(--premium-text-4)' : 'var(--premium-text-2)', textDecoration: asked ? 'line-through' : 'none' }}>{text}</span>
      {custom && (<span style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 3, background: 'rgba(127,73,151,0.08)', color: '#7f4997', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: 1 }}>Perso</span>)}
      {custom && onDelete && (
        <button onClick={onDelete} aria-label="Supprimer" style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, background: 'transparent', border: 'none', color: 'var(--premium-text-4)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      )}
    </div>
  );
}
