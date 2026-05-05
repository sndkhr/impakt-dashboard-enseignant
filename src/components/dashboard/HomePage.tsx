'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { computeParcoursStatus, computeAlertLevel, STATUS_CONFIG, formatDateFr, User } from '@/types';
import KpiCard from '@/components/ui/KpiCard';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { inscriptionsTrend, completedTrend, activeTrend } from '@/lib/trends';
import { staggerDelay } from '@/lib/motion';
import { SpotlightCard } from '@/components/ui/PremiumMotion';
import { useToast } from '@/components/ui/Toast';
import InviteRdvModal from '@/components/modals/InviteRdvModal';
import { markSent, isInCooldown, getDaysSinceSent, formatSince, snapshotSent, restoreSent, COOLDOWN_DAYS, NotifKind } from '@/lib/notifications';

interface RdvInfo {
  name: string;
  at: Date;
  type: string;
  location?: string;
}
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { listUpcomingRdvs } from '@/lib/scheduledRdv';
import { useBackendRdvs } from '@/lib/useBackendRdvs';

// === Periodes disponibles pour le selecteur (comme admin B2CDash) ===
const PERIODS: { id: string; label: string; days: number | null }[] = [
  { id: 'today',  label: "Aujourd'hui", days: 1 },
  { id: '7d',     label: '7 derniers jours', days: 7 },
  { id: '30d',    label: '30 derniers jours', days: 30 },
  { id: '90d',    label: '90 derniers jours', days: 90 },
  { id: 'all',    label: 'Tout', days: null },
];

// === Mapping metier → secteur (keyword based, robuste pour affichage conseiller) ===
function metierToSecteur(metier: string): string {
  const m = metier.toLowerCase();
  if (/infirm|aide.?soignant|médecin|medecin|pharmac|kin[ée]|dentiste|sage.?femme|ambul|auxiliaire|osteo|podo|orthop/.test(m)) return 'Santé';
  if (/social|éducat|educat|assistant social|médiateur|mediateur|animat|puéricult|puericult|psycho|famille|personnes âg|personnes ag/.test(m)) return 'Social & Services à la personne';
  if (/développ|develop|ingénieur|ingenieur|informatique|data|cyber|devops|front|back|fullstack|programm|dev web|dev mob|tech lead|ai |ia |machine learn/.test(m)) return 'Numérique & Tech';
  if (/vente|commerce|commercial|vendeur|vendeuse|caissier|caissi[eè]re|merchand|retail|magasin|boutique|e-commerce/.test(m)) return 'Commerce & Vente';
  if (/commun|markéti|marketi|médi|medi|journa|rédact|redact|graphi|designer|publi|rp |digital market|content|community/.test(m)) return 'Communication & Médias';
  if (/art |arti|musicien|musique|danse|danseur|comédien|comedien|théâtre|theatre|cinéma|cinema|photographe|styliste|mode |couture/.test(m)) return 'Arts & Culture';
  if (/bâtiment|batiment|btp|maçon|macon|menuis|électric|electric|plomb|soudeur|chaudronn|couvreur|peintre|carrel|charpent|génie civ|genie civ/.test(m)) return 'Bâtiment & Travaux';
  if (/mécanicien|mecanicien|industr|usin|fabricat|technicien|maintenanc|opérateur|operateur|électronic|electronic|automat|robotic/.test(m)) return 'Industrie & Maintenance';
  if (/professeur|enseignant|formateur|éducation nationale|education nationale|institut|prof des écoles|prof des ecoles|éduc spéc|educ spec/.test(m)) return 'Enseignement & Formation';
  if (/chauff|logisti|transport|livraison|cariste|magasinier|routier|navigat|pilot|conduct|manutent/.test(m)) return 'Transport & Logistique';
  if (/cuisin|pâtissi|patissi|boulang|chef |serveur|serveuse|barman|barmaid|hôtel|hotel|tourisme|réception|reception|sommeli|agent d.?accueil/.test(m)) return 'Hôtellerie & Tourisme';
  if (/agri|agricult|éleveur|eleveur|maraîch|maraich|jardinier|paysag|fleuri|horticul|sylvicul|forest|vétérin|veterin|environn|écolog|ecolog/.test(m)) return 'Agriculture & Environnement';
  if (/banqu|finance|assur|comptab|audit|conseiller financ|gestion patrimoine|trader|analyst|contr[ôo]leur de gestion/.test(m)) return 'Banque & Finance';
  if (/juriste|avocat|notaire|huissier|greffier|magistrat|parajur|rh |ressources humain|recrut|administratif|secrét|secret/.test(m)) return 'Droit & Administration';
  if (/sport|coach sport|animateur sport|entraîneur|entraineur|fitness|préparateur physique|preparateur physique|professeur de sport/.test(m)) return 'Sport & Animation';
  if (/chercheur|scientifique|biolog|chimi|physic|laboratoire|pharma|recherche/.test(m)) return 'Recherche & Sciences';
  if (/police|gendarm|militair|pompier|sécurité|securite|armée|armee|douan/.test(m)) return 'Sécurité & Défense';
  return 'Autres secteurs';
}

/* ============================================================
   ACCUEIL CONSEILLER — vision produit centree sur les besoins reels
   d'un conseiller France Travail qui suit 100-150 jeunes.
   Structure :
   1. 5 KPIs portefeuille (Suivis / Ont fini / Actifs semaine / En alerte / Completion)
   2. Actions du jour (killer feature) + RDV a venir
   3. Profils actifs cette semaine + Tendances portefeuille
   ============================================================ */

const DAY_MS = 86400000;

// === Helper : glass card premium identique admin ===
function GlassPanel({ title, subtitle, badge, children, style, noPadding }: {
  title?: string; subtitle?: string; badge?: React.ReactNode;
  children: React.ReactNode; style?: React.CSSProperties; noPadding?: boolean;
}) {
  // Si le style externe demande flex column, on wrappe les enfants dans un container flex-1
  // pour que les listes scrollables puissent remplir la hauteur dispo.
  const isFlexCol = style?.display === 'flex' && style?.flexDirection === 'column';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 20,
      padding: noPadding ? 0 : '18px 20px',
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {(title || badge) && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, marginBottom: subtitle ? 10 : 14,
          padding: noPadding ? '18px 20px 0' : 0,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          {badge}
        </div>
      )}
      {isFlexCol ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      ) : children}
    </div>
  );
}

export default function HomePage() {
  const { data } = useAuth();
  const { openProfile, navigate } = useNav();
  const toast = useToast();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<User[]>([]);
  const [sentTick, setSentTick] = useState(0); // force re-render apres markSent

  // === Minimum skeleton display time — garantit 700ms de squelette meme si les donnees arrivent + vite ===
  const [minSkeletonElapsed, setMinSkeletonElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSkeletonElapsed(true), 700);
    return () => clearTimeout(t);
  }, []);

  // === Selecteur de periode (calque sur B2CDash admin) ===
  const [periodId, setPeriodId] = useState('all');
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const currentPeriod = PERIODS.find(p => p.id === periodId) || PERIODS[4];
  const isFiltered = currentPeriod.days !== null;

  // Close dropdown au click exterieur
  useEffect(() => {
    if (!periodOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [periodOpen]);

  const allUsers = useMemo(() => data?.recentUsers || [], [data]);

  // Users filtres par periode (sur inscriptionDate comme l'admin)
  const users = useMemo(() => {
    if (!currentPeriod.days) return allUsers;
    const cutoff = Date.now() - currentPeriod.days * DAY_MS;
    return allUsers.filter(u => {
      if (!u.inscriptionDate) return false;
      return new Date(u.inscriptionDate).getTime() >= cutoff;
    });
  }, [allUsers, currentPeriod.days]);

  // === Calculs KPIs orientés conseiller (valeurs period-aware, calque admin B2CDash) ===
  // En mode "Tout" → totaux globaux. En mode filtre → computed sur le subset.
  const now = Date.now();
  const portfolioSize = isFiltered ? users.length : (data?.totalUsers || allUsers.length);
  const completedCount = isFiltered
    ? users.filter(u => u.quizCompleted).length
    : (data?.quizCompleted || allUsers.filter(u => u.quizCompleted).length);

  // Actifs : jeunes ayant ouvert l'app dans les 7 derniers jours, sur le subset courant
  const activeCount = useMemo(() =>
    users.filter(u => u.lastActive && (now - new Date(u.lastActive).getTime()) < 7 * DAY_MS).length,
    [users, now]
  );

  // En alerte (bloqués ou décrocheurs)
  const enAlerte = useMemo(() =>
    users.filter(u => {
      const lvl = computeAlertLevel(u);
      return lvl === 'bloque' || lvl === 'decroch';
    }).length,
    [users]
  );

  // Delta "En alerte" : approxime l'etat il y a 7j (exclut les inscrits < 7j qui n'existaient pas a l'epoque)
  const alertDelta = useMemo(() => {
    const sevenDaysAgo = now - 7 * DAY_MS;
    const alertPrev = allUsers.filter(u => {
      if (!u.inscriptionDate) return false;
      if (new Date(u.inscriptionDate).getTime() > sevenDaysAgo) return false;
      const lvl = computeAlertLevel(u);
      return lvl === 'bloque' || lvl === 'decroch';
    }).length;
    if (alertPrev === 0) return enAlerte > 0 ? 100 : 0;
    return Math.round(((enAlerte - alertPrev) / alertPrev) * 100);
  }, [allUsers, enAlerte, now]);

  // Taux de complétion (période courante)
  const completionRate = portfolioSize ? Math.round((completedCount / portfolioSize) * 100) : 0;

  // Delta taux complétion : compare taux courant vs taux il y a 7j
  const completionRateDelta = useMemo(() => {
    const sevenDaysAgo = now - 7 * DAY_MS;
    const pastUsers = allUsers.filter(u => u.inscriptionDate && new Date(u.inscriptionDate).getTime() <= sevenDaysAgo);
    const pastCompleted = pastUsers.filter(u => u.quizCompleted).length;
    const pastRate = pastUsers.length > 0 ? (pastCompleted / pastUsers.length) * 100 : 0;
    if (pastRate === 0) return completionRate > 0 ? 100 : 0;
    return Math.round(completionRate - pastRate);
  }, [allUsers, completionRate, now]);

  // === Actions du jour (killer feature) — listes complètes ===
  const actionsToday = useMemo(() => {
    const aRelancer: User[] = [];
    const aInviter: User[] = [];
    const bloques: User[] = [];

    users.forEach(u => {
      const lastActive = u.lastActive ? new Date(u.lastActive).getTime() : 0;
      const inactDays = lastActive ? Math.floor((now - lastActive) / DAY_MS) : 999;
      const completed = u.quizCompleted;
      const started = u.quizStarted;
      const finishedAt = u.completedAt ? new Date(u.completedAt).getTime() : 0;
      const finishedDaysAgo = finishedAt ? Math.floor((now - finishedAt) / DAY_MS) : 999;

      if (!completed && started && inactDays >= 5) bloques.push(u);
      else if (completed && finishedDaysAgo <= 7) aInviter.push(u);
      else if (started && inactDays >= 14) aRelancer.push(u);
    });

    return { aRelancer, aInviter, bloques };
  }, [users, now]);

  // Handler notification en masse avec UNDO (snapshot → markSent → toast Annuler)
  const handleNotify = (kind: NotifKind, uids: string[]) => {
    if (uids.length === 0) return;
    // 1. Snapshot de l'etat avant, pour pouvoir restaurer si undo
    const snaps = snapshotSent(kind, uids);
    // 2. Commit immediat (optimistic UI)
    markSent(kind, uids);
    setSentTick(t => t + 1);
    // 3. Toast avec bouton Annuler
    const verb = kind === 'debloquer' ? 'Rappel envoyé' : 'Relance envoyée';
    const s = uids.length > 1 ? 's' : '';
    toast.showUndo(
      `${verb}${s} à ${uids.length} bénéficiaire${s}`,
      () => {
        restoreSent(kind, snaps);
        setSentTick(t => t + 1);
        toast.show('↶ Annulé', 'info');
      },
      5000,
    );
  };

  // === Profils actifs récents (top 10) ===
  const topActive = useMemo(() => {
    return [...users]
      .filter(u => u.lastActive)
      .sort((a, b) => new Date(b.lastActive!).getTime() - new Date(a.lastActive!).getTime())
      .slice(0, 10);
  }, [users]);

  // === Skeleton premium pendant le chargement — shimmer avec meme layout que la vraie page ===
  if (!data || !minSkeletonElapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Pills header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, padding: '4px 0 0' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Skeleton.Pill w={110} />
            <Skeleton.Pill w={130} />
            <Skeleton.Pill w={90} />
          </div>
        </div>
        {/* 5 KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <Skeleton.Kpi gradient index={0} />
          <Skeleton.Kpi index={1} />
          <Skeleton.Kpi index={2} />
          <Skeleton.Kpi index={3} />
          <Skeleton.Kpi index={4} />
        </div>
        {/* Ligne 2 : Priorites + RDV */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 14 }}>
          <Skeleton.Card height={280}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flex: 1 }}>
              <div style={{ background: '#ffffff', border: '1px solid rgba(15,15,15,0.06)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton w="60%" h={12} />
                <Skeleton h={28} />
                <Skeleton h={28} />
              </div>
              <div style={{ background: '#ffffff', border: '1px solid rgba(15,15,15,0.06)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton w="60%" h={12} />
                <Skeleton h={28} />
                <Skeleton h={28} />
              </div>
              <div style={{ background: '#ffffff', border: '1px solid rgba(15,15,15,0.06)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton w="60%" h={12} />
                <Skeleton h={28} />
                <Skeleton h={28} />
              </div>
            </div>
          </Skeleton.Card>
          <Skeleton.Card height={280}>
            <Skeleton h={48} />
            <Skeleton h={48} />
            <Skeleton h={48} />
          </Skeleton.Card>
        </div>
        {/* Ligne 3 : table + chart + secteurs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, 1fr)', gap: 14 }}>
          <Skeleton.Card height={340}>
            <Skeleton.Row />
            <Skeleton.Row />
            <Skeleton.Row />
            <Skeleton.Row />
          </Skeleton.Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skeleton.Card height={160} />
            <Skeleton.Card height={170} />
          </div>
        </div>
      </div>
    );
  }

  // Trends (sparkline + delta %) — toujours 7j sur allUsers, comme l'admin B2CDash
  const trInsc = inscriptionsTrend(allUsers, 7);
  const trCompleted = completedTrend(allUsers, 7);
  const trActive = activeTrend(allUsers, 7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* === HEADER PILLS : statut services + donnees temps reel + selecteur periode === */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, padding: '4px 0 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {/* Pill "Services actifs" — vert pulse */}
          <div
            title="Tous les services IMPAKT sont opérationnels"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 14px',
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
              border: '1px solid rgba(255,255,255,0.7)',
              color: '#15803d',
              borderRadius: 999,
              fontSize: 11.5, fontWeight: 600,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.1px',
              boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
            }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e, 0 0 14px rgba(34,197,94,0.5)',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            Services actifs
          </div>

          {/* Pill "Données temps réel" */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 14px',
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(18px) saturate(140%)',
            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.7)',
            color: '#262626',
            borderRadius: 999,
            fontSize: 11.5, fontWeight: 500,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.1px',
            boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E84393', boxShadow: '0 0 8px rgba(232,67,147,0.6)' }} />
            Données temps réel
          </div>

          {/* Selecteur de periode (dropdown) */}
          <div ref={periodRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 12px 7px 14px',
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(18px) saturate(140%)',
                WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                border: '1px solid rgba(255,255,255,0.7)',
                color: '#262626',
                borderRadius: 999,
                fontSize: 11.5, fontWeight: 600,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.1px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
                transition: 'all .15s ease',
              }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isFiltered ? '#E84393' : '#a3a3a3',
                boxShadow: isFiltered ? '0 0 8px rgba(232,67,147,0.6)' : 'none',
              }} />
              {currentPeriod.label}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, marginLeft: 2, transform: periodOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {periodOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                width: 220, zIndex: 100,
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(24px) saturate(140%)',
                WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                border: '1px solid rgba(255,255,255,0.85)',
                borderRadius: 12,
                boxShadow: '0 12px 32px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                overflow: 'hidden',
                padding: 4,
                animation: 'subnavIn .18s ease-out',
              }}>
                {PERIODS.map(p => {
                  const active = p.id === periodId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setPeriodId(p.id); setPeriodOpen(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px',
                        background: active ? 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))' : 'transparent',
                        border: 'none', borderRadius: 8,
                        color: active ? '#7f4997' : '#262626',
                        fontSize: 11.5, fontWeight: active ? 600 : 500,
                        fontFamily: 'inherit', cursor: 'pointer',
                        textAlign: 'left', letterSpacing: '-0.1px',
                        transition: 'all .12s',
                      }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(15,15,15,0.04)'; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {p.label}
                      {active && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === LIGNE 1 : 5 KPIs portefeuille conseiller (titres courts + deltas % comme admin) === */}
      <div className="fi" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiCard index={0} gradient title="Mon portefeuille" value={portfolioSize} trend={trInsc.series} delta={trInsc.delta} />
        <KpiCard index={1} title="Tests complétés" value={completedCount} trend={trCompleted.series} delta={trCompleted.delta} />
        <KpiCard index={2} title="Utilisateurs actifs" value={activeCount} trend={trActive.series} delta={trActive.delta} />
        <KpiCard index={3} title="En alerte" value={enAlerte} delta={alertDelta} />
        <KpiCard index={4} title="Taux de complétion" value={completionRate} suffix="%" delta={completionRateDelta} />
      </div>

      {/* === LIGNE 2 : Actions du jour + RDV à venir (même hauteur) === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 14, minWidth: 0, alignItems: 'stretch' }}>

        {/* ACTIONS DU JOUR — glass card premium (halo super discret) */}
        <SpotlightCard
          spotlightColor="rgba(232,67,147,0.05)"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(28px) saturate(140%)',
            WebkitBackdropFilter: 'blur(28px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 20,
            padding: '18px 20px',
            boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
            minWidth: 0,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px' }}>Priorités du jour</div>
              <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', marginTop: 3 }}>Actions recommandées sur ton portefeuille</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: '#7f4997',
                background: 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.08))',
                padding: '4px 10px', borderRadius: 999,
                letterSpacing: '0.3px',
              }}>
                {actionsToday.aInviter.length + actionsToday.aRelancer.length + actionsToday.bloques.length} suggestions
              </div>
              <button onClick={() => navigate('suggestions')}
                style={{
                  fontSize: 11, fontWeight: 600, color: '#7f4997',
                  background: 'transparent', border: '1px solid rgba(127,73,151,0.20)',
                  padding: '5px 10px', borderRadius: 8,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >Voir tout ›</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flex: 1 }}>
            <ActionBlock
              key={`invite-${sentTick}`}
              kind={null}
              icon="✓"
              iconColor="#059669"
              title="À inviter en RDV"
              items={actionsToday.aInviter}
              hint="Ont fini leur test"
              onItemClick={openProfile}
              onCTA={(selectedUsers) => { setInviteCandidates(selectedUsers); setInviteModalOpen(true); }}
              ctaLabel="Planifier un RDV"
            />
            <ActionBlock
              key={`debloquer-${sentTick}`}
              kind="debloquer"
              icon="!"
              iconColor="#b45309"
              title="Débloquer"
              items={actionsToday.bloques}
              hint="Bloqués depuis 5j+"
              onItemClick={openProfile}
              onNotify={handleNotify}
              ctaLabel="Envoyer un rappel"
            />
            <ActionBlock
              key={`relancer-${sentTick}`}
              kind="relancer"
              icon="↻"
              iconColor="#be123c"
              title="À relancer"
              items={actionsToday.aRelancer}
              hint="Inactifs depuis 14j"
              onItemClick={openProfile}
              onNotify={handleNotify}
              ctaLabel="Envoyer une relance"
            />
          </div>
        </SpotlightCard>

        {/* RDV À VENIR — height 100% pour matcher la hauteur de Priorites, liste scrollable interne */}
        <GlassPanel
          title="RDV à venir"
          style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
          badge={
            <button onClick={() => navigate('alertes')} style={{
              padding: '5px 10px', borderRadius: 8,
              background: 'rgba(127,73,151,0.06)',
              border: '1px solid rgba(127,73,151,0.18)',
              color: '#7f4997',
              fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all .12s',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.06)'}
            >Voir tous les RDV ›</button>
          }
        >
          <UpcomingRdvList users={allUsers} onOpenProfile={openProfile} />
        </GlassPanel>

      </div>

      {/* === LIGNE 3 : Derniers événements + (Évolution + Métiers IA) === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(300px, 1fr)', gap: 14, minWidth: 0, alignItems: 'stretch' }}>

      <GlassPanel title="Derniers événements" noPadding>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nom', 'Prénom', 'Âge', 'Statut', 'Inscription', 'Activité', 'Progrès', ''].map((h, idx) => (
                  <th key={idx} style={{
                    padding: '11px 14px', fontSize: 10, fontWeight: 700,
                    color: 'var(--premium-text-4)', textAlign: 'left',
                    textTransform: 'uppercase', letterSpacing: '.5px',
                    borderBottom: '1px solid rgba(15,15,15,0.06)',
                    background: 'transparent', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topActive.map((u, i) => {
                const st = computeParcoursStatus(u);
                const stConf = STATUS_CONFIG[st];
                const prog = u.quizProgress ?? 0;
                const lastDate = u.lastActive ? formatLastActivite(u.lastActive) : '—';
                const inscDate = u.inscriptionDate ? formatDateFr(u.inscriptionDate) : '—';
                return (
                  <tr key={i}
                    style={{
                      animation: `stagger-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
                      animationDelay: staggerDelay(i, 35, 10),
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 12.5, borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--premium-text)' }}>{u.nom || '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--premium-text-2)', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                      {u.prenom || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--premium-text-2)', borderBottom: '1px solid rgba(15,15,15,0.04)', fontVariantNumeric: 'tabular-nums' }}>
                      {u.age || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                      <Badge label={stConf.label} className={stConf.className} />
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--premium-text-3)', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                      {inscDate}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--premium-text-3)', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                      {lastDate}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(15,15,15,0.04)', minWidth: 140 }}>
                      <ProgressBar value={prog} />
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(15,15,15,0.04)', textAlign: 'right' }}>
                      <button onClick={() => u.uid && openProfile(u.uid)}
                        style={{
                          padding: '6px 12px', borderRadius: 8,
                          background: 'rgba(127,73,151,0.06)',
                          border: '1px solid rgba(127,73,151,0.15)',
                          color: '#7f4997',
                          fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                          transition: 'all .12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.12)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.06)'; }}
                      >Voir le profil ›</button>
                    </td>
                  </tr>
                );
              })}
              {topActive.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '20px 14px' }}>
                    <EmptyState
                      iconKind="chart"
                      title="Aucune activité cette semaine"
                      description="Dès qu'un bénéficiaire commence ou termine son test d'orientation, il apparaîtra ici en temps réel."
                      ctaLabel="Voir tous les utilisateurs"
                      onCta={() => navigate('jeunes')}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* === Colonne droite : 2 cards stackés — Évolution chart + Top métiers IA === */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <GlassPanel title="Évolution 30 jours" subtitle="Inscriptions et complétions">
          <EvolutionChart users={users} />
        </GlassPanel>
        <GlassPanel
          title="Secteurs les plus recommandés"
          subtitle="Par l'IA IMPAKT sur ton portefeuille"
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <TopSecteursPanel users={users} topMetiers={data?.topMetiers} />
        </GlassPanel>
      </div>

      </div>

      {/* Modal Planifier RDV — prend la selection si definie, sinon tous les candidats a inviter */}
      <InviteRdvModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        candidates={inviteCandidates.length > 0 ? inviteCandidates : actionsToday.aInviter}
        onScheduled={() => toast.show('✓ RDV planifié', 'success')}
      />
    </div>
  );
}

// ==== Evolution Chart — 2 series line chart avec gradient IMPAKT ====
function EvolutionChart({ users }: { users: User[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Prepare data — 30 derniers jours
    const DAYS = 30;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const labels: string[] = [];
    const signupData: number[] = Array(DAYS).fill(0);
    const completedData: number[] = Array(DAYS).fill(0);

    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(`${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    users.forEach(u => {
      if (u.inscriptionDate) {
        const d = new Date(u.inscriptionDate); d.setHours(0, 0, 0, 0);
        const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
        if (diff >= 0 && diff < DAYS) signupData[DAYS - 1 - diff]++;
      }
      if (u.completedAt) {
        const d = new Date(u.completedAt); d.setHours(0, 0, 0, 0);
        const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
        if (diff >= 0 && diff < DAYS) completedData[DAYS - 1 - diff]++;
      }
    });

    // Gradient fills premium
    const gradInsc = ctx.createLinearGradient(0, 0, 0, 220);
    gradInsc.addColorStop(0, 'rgba(232,67,147,0.28)');
    gradInsc.addColorStop(1, 'rgba(232,67,147,0)');
    const gradComp = ctx.createLinearGradient(0, 0, 0, 220);
    gradComp.addColorStop(0, 'rgba(127,73,151,0.22)');
    gradComp.addColorStop(1, 'rgba(127,73,151,0)');

    // Destroy previous chart
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Inscriptions',
            data: signupData,
            borderColor: '#E84393',
            backgroundColor: gradInsc,
            borderWidth: 2.2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#E84393',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            fill: true,
          },
          {
            label: 'Complétions',
            data: completedData,
            borderColor: '#7f4997',
            backgroundColor: gradComp,
            borderWidth: 2.2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#7f4997',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            align: 'start',
            labels: {
              color: '#525252',
              font: { family: 'Plus Jakarta Sans', size: 10.5, weight: 600 },
              boxWidth: 8, boxHeight: 8, borderRadius: 4, useBorderRadius: true,
              padding: 10,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15,15,15,0.92)',
            titleColor: '#ffffff', bodyColor: 'rgba(255,255,255,0.85)',
            titleFont: { family: 'Plus Jakarta Sans', size: 11, weight: 700 },
            bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
            padding: 10, cornerRadius: 8, displayColors: true, boxWidth: 6, boxHeight: 6,
            borderColor: 'rgba(232,67,147,0.3)', borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#a3a3a3',
              font: { family: 'Plus Jakarta Sans', size: 9 },
              maxRotation: 0, autoSkip: true, autoSkipPadding: 20,
            },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(15,15,15,0.04)' },
            ticks: {
              color: '#a3a3a3',
              font: { family: 'Plus Jakarta Sans', size: 9 },
              precision: 0, padding: 6,
            },
            border: { display: false },
          },
        },
        animation: { duration: 800, easing: 'easeOutCubic' },
      },
    });
    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [users]);

  return (
    <div style={{ position: 'relative', height: 260, minWidth: 0 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ==== TopSecteursPanel — agrège les métiers recommandés en secteurs (plus pertinent pour le conseiller) ====
function TopSecteursPanel({ users, topMetiers }: { users: User[]; topMetiers?: { name: string; count: number }[] }) {
  const secteurs = useMemo(() => {
    const counts: Record<string, number> = {};
    // 1) Si topMetiers est dispo (agrege backend), on l'utilise
    if (topMetiers && topMetiers.length > 0) {
      topMetiers.forEach(({ name, count }) => {
        const sec = metierToSecteur(name);
        counts[sec] = (counts[sec] || 0) + count;
      });
    } else {
      // 2) Sinon on recompute depuis users (fallback)
      users.forEach(u => {
        (u.topMetiers || []).forEach(m => {
          const sec = metierToSecteur(m);
          counts[sec] = (counts[sec] || 0) + 1;
        });
      });
    }
    // On garde jusqu'a 10 secteurs (scroll interne a 4), tri par occurrence
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = entries[0]?.[1] || 1;
    const total = entries.reduce((s, [, c]) => s + c, 0) || 1;
    return entries.map(([name, count], i) => ({
      rank: i + 1,
      name,
      count,
      pct: Math.round((count / max) * 100),
      share: Math.round((count / total) * 100),
    }));
  }, [users, topMetiers]);

  if (secteurs.length === 0) {
    return (
      <EmptyState
        variant="compact"
        iconKind="sparkle"
        title="L'IA analyse ton portefeuille"
        description="Dès qu'un bénéficiaire termine son test, nos recommandations de secteurs apparaîtront ici."
      />
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      gap: 11, flex: 1,
      maxHeight: 186, // ~4 secteurs visibles (32px chacun + 11 gap + padding)
      overflowY: 'auto', paddingRight: 4,
    }}>
      {secteurs.map((s, i) => (
        <div key={s.name} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
          animation: `stagger-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
          animationDelay: staggerDelay(i, 45, 8),
        }}>
          {/* Rang */}
          <div style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: 7,
            background: i === 0
              ? 'linear-gradient(135deg, #7f4997, #E84393)'
              : 'rgba(127,73,151,0.08)',
            color: i === 0 ? '#ffffff' : '#7f4997',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.2px',
            border: i === 0 ? 'none' : '1px solid rgba(127,73,151,0.15)',
            boxShadow: i === 0 ? '0 2px 6px rgba(232,67,147,0.25)' : 'none',
          }}>{s.rank}</div>

          {/* Body : nom + bar + count */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{
                fontSize: 11.5, fontWeight: 600,
                color: 'var(--premium-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                letterSpacing: '-0.1px',
              }}>{s.name}</div>
              <div style={{
                flexShrink: 0,
                fontSize: 10.5, fontWeight: 600,
                color: 'var(--premium-text-3)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                <span style={{ color: 'var(--premium-text)' }}>{s.count}</span>
                <span style={{ color: 'var(--premium-text-4)', marginLeft: 4 }}>· {s.share}%</span>
              </div>
            </div>
            {/* Bar gradient IMPAKT */}
            <div style={{
              height: 6, borderRadius: 999,
              background: 'rgba(127,73,151,0.08)',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                height: '100%',
                width: `${s.pct}%`,
                background: 'linear-gradient(90deg, #7f4997, #E84393)',
                borderRadius: 999,
                boxShadow: '0 1px 3px rgba(232,67,147,0.25)',
                transition: 'width .6s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==== ActionBlock (Priorités du jour) avec checkboxes + tracking sent ====
function ActionBlock({ kind, icon, iconColor, title, items, hint, onItemClick, onCTA, onNotify, ctaLabel }: {
  kind: NotifKind | null; // null pour 'invite' — pas de tracking notification
  icon: string; iconColor: string; title: string;
  items: User[]; hint: string;
  onItemClick: (uid: string) => void;
  onCTA?: (selectedUsers: User[]) => void; // recoit selection, ou [] si rien
  onNotify?: (kind: NotifKind, uids: string[]) => void;
  ctaLabel?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // === Helpers smart (cooldown based) ===
  // Un jeune est "traite" UNIQUEMENT s'il est dans la fenetre de cooldown
  // (ex: relance il y a 2j, cooldown 5j => traite). Passe ce delai, il reapparait.
  const inCooldown = (u: User) => !!(kind && u.uid && isInCooldown(kind, u.uid));
  const daysSince = (u: User) => kind && u.uid ? getDaysSinceSent(kind, u.uid) : null;

  // Tri : a traiter en haut, en cooldown en bas
  const sortedItems = [...items].sort((a, b) => {
    const aCool = inCooldown(a) ? 1 : 0;
    const bCool = inCooldown(b) ? 1 : 0;
    return aCool - bCool;
  });

  const remainingItems = items.filter(u => !inCooldown(u));
  const remainingCount = remainingItems.length;

  const toggleOne = (uid: string) => {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setSelected(next);
  };

  const handleCTA = () => {
    // Users selectionnes (ou tous si rien coche, en filtrant les deja-envoyes pour notify)
    const selectedUsers = selected.size > 0
      ? items.filter(u => u.uid && selected.has(u.uid))
      : kind ? remainingItems : items;

    if (onCTA) {
      onCTA(selectedUsers);
      setSelected(new Set());
      return;
    }
    if (!onNotify || !kind) return;
    const uids = selectedUsers.map(u => u.uid).filter((uid): uid is string => !!uid);
    onNotify(kind, uids);
    setSelected(new Set());
  };

  const ctaDisabled = remainingCount === 0;
  const ctaText = ctaDisabled
    ? 'Tous notifiés ✓'
    : selected.size > 0
      ? `${ctaLabel} (${selected.size})`
      : ctaLabel;

  return (
    <div style={{
      padding: '14px 14px 12px',
      background: '#ffffff',
      border: '1px solid rgba(15,15,15,0.06)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Header avec icone pastille */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: `${iconColor}15`,
          color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
          border: `1px solid ${iconColor}30`,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--premium-text)' }}>{title}</div>
          <div style={{ fontSize: 10, color: 'var(--premium-text-4)', marginTop: 1 }}>{hint}</div>
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: iconColor,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px',
        }}>{items.length}</div>
      </div>

      {/* Liste SCROLLABLE avec checkboxes premium + bouton Voir separe */}
      {items.length > 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, flex: 1,
          minHeight: 0, maxHeight: 240, overflowY: 'auto',
          paddingRight: 2,
        }}>
          {sortedItems.map((u, i) => {
            const cool = inCooldown(u);
            const since = daysSince(u);
            const isSelected = u.uid ? selected.has(u.uid) : false;

            return (
              <div key={i}
                title={cool && since !== null ? `Relancé ${formatSince(since)} · réapparaîtra dans ${Math.max(1, COOLDOWN_DAYS[kind!] - since)}j si toujours bloqué` : undefined}
                style={{
                  padding: '6px 6px 6px 10px',
                  background: cool
                    ? 'rgba(16,185,129,0.08)'
                    : isSelected
                      ? 'linear-gradient(135deg, rgba(127,73,151,0.08), rgba(232,67,147,0.08))'
                      : 'rgba(15,15,15,0.02)',
                  border: cool
                    ? '1px solid rgba(16,185,129,0.25)'
                    : isSelected
                      ? '1px solid rgba(232,67,147,0.28)'
                      : '1px solid rgba(15,15,15,0.04)',
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                  flexShrink: 0,
                  transition: 'all .12s ease',
                }}>
                {/* Nom prenom — pleine largeur, plus de badge "2ème relance" qui mangeait la place */}
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: 11.5,
                  color: 'var(--premium-text)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  padding: '1px 0',
                }}>{u.prenom} {u.nom}</span>

                {/* Compteur humain (aujourd'hui / hier / il y a Xj) en etat cooldown (vert) */}
                {cool && since !== null && (
                  <span style={{
                    fontSize: 9, fontWeight: 600,
                    color: '#047857',
                    flexShrink: 0,
                    letterSpacing: '-0.1px',
                  }}>{formatSince(since)}</span>
                )}

                {/* Custom checkbox TOUJOURS VISIBLE quand a traiter (cercle pink vide → filled quand coché) */}
                {!cool && (
                  <button onClick={(e) => { e.stopPropagation(); if (u.uid) toggleOne(u.uid); }}
                    aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                    style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: isSelected
                        ? 'linear-gradient(135deg, #7f4997, #E84393)'
                        : 'transparent',
                      border: isSelected
                        ? 'none'
                        : '1.5px solid rgba(127,73,151,0.30)',
                      color: isSelected ? '#ffffff' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, cursor: 'pointer', flexShrink: 0,
                      transition: 'all .15s ease',
                      boxShadow: isSelected ? '0 2px 5px rgba(232,67,147,0.25)' : 'none',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,67,147,0.55)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(127,73,151,0.30)'; }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10, opacity: isSelected ? 1 : 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                )}

                {/* Coche verte foncée seule (cooldown actif — jeune traite recemment) */}
                {cool && (
                  <div title={`Relancé ${formatSince(since)}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, flexShrink: 0,
                    color: '#047857',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}

                {/* Bouton Voir separé (evite le mis-click qui ouvre le profil) */}
                <button onClick={(e) => { e.stopPropagation(); if (u.uid) onItemClick(u.uid); }}
                  style={{
                    padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(15,15,15,0.05)',
                    border: '1px solid rgba(15,15,15,0.08)',
                    color: 'var(--premium-text-3)',
                    fontSize: 9.5, fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'all .12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.10)'; (e.currentTarget as HTMLElement).style.color = '#7f4997'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(15,15,15,0.05)'; (e.currentTarget as HTMLElement).style.color = 'var(--premium-text-3)'; }}
                >Voir</button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          variant="compact"
          iconKind={kind === 'debloquer' ? 'sparkle' : kind === 'relancer' ? 'check' : 'target'}
          title={kind === 'debloquer' ? 'Personne bloqué' : kind === 'relancer' ? 'Tous engagés' : 'À jour'}
          description={kind === 'debloquer'
            ? 'Aucun bénéficiaire bloqué depuis 5 jours ou plus.'
            : kind === 'relancer'
              ? "Aucun bénéficiaire inactif depuis 14 jours."
              : 'Aucun nouveau test terminé à inviter cette semaine.'}
        />
      )}

      {/* CTA */}
      {(onCTA || onNotify) && items.length > 0 && (
        <button onClick={handleCTA}
          disabled={ctaDisabled && !onCTA}
          style={{
            padding: '7px 10px',
            background: ctaDisabled && !onCTA ? 'rgba(15,15,15,0.05)' : `${iconColor}15`,
            border: `1px solid ${ctaDisabled && !onCTA ? 'rgba(15,15,15,0.08)' : iconColor + '30'}`,
            borderRadius: 7,
            color: ctaDisabled && !onCTA ? 'var(--premium-text-4)' : iconColor,
            fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit',
            cursor: ctaDisabled && !onCTA ? 'default' : 'pointer',
            width: '100%',
            transition: 'all .12s',
          }}>{ctaText}</button>
      )}

      {/* Legende cooldown — rassure le conseiller sur le fait que la liste vit toute seule */}
      {kind && (
        <div
          title={`Un jeune relancé reste "traité" pendant ${COOLDOWN_DAYS[kind]}j. Passé ce délai, s'il n'a toujours pas bougé, il réapparaît ici avec un badge "2ème relance" pour que tu puisses changer d'approche.`}
          style={{
            fontSize: 9, color: 'var(--premium-text-4)',
            textAlign: 'center', marginTop: -2,
            letterSpacing: '-0.05px', lineHeight: 1.35,
          }}>
          Nouvelle relance possible après {COOLDOWN_DAYS[kind]}j · actualisé auto.
        </div>
      )}
    </div>
  );
}

// ==== Upcoming RDV List ====
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function formatRdvDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff > 1 && diff < 7) {
    const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
    return `${days[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
  }
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function UpcomingRdvList({ users }: { users: User[]; onOpenProfile: (uid: string) => void }) {
  const { openProfile, navigate } = useNav();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onFocus = () => setTick(t => t + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  void tick;

  // v17.8 — Fusion des deux sources de RDV :
  //   • store local (RDV créés via le bouton "Ajouter un RDV" en mode local)
  //   • backend Firestore (RDV créés via la Cloud Function createRendezvous)
  // Avant ça, les RDV backend étaient invisibles sur la home alors qu'ils
  // étaient bien programmés. Dédup par id.
  const stored = listUpcomingRdvs();
  const { rendezvous: backendRdvs } = useBackendRdvs();
  const now = Date.now();
  const localMapped = stored.map(r => ({
    id: r.id,
    uid: r.uid,
    name: (() => {
      const u = users.find(u => u.uid === r.uid);
      return (u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : '') || r.beneficiaireName || 'Bénéficiaire';
    })(),
    at: new Date(r.at),
    type: r.type,
    location: r.location,
  }));
  const backendMapped = (backendRdvs || [])
    .filter(r => {
      // RDV passés OK pour 90 min de tolérance (cohérent avec listUpcomingRdvs)
      if (!r.dateTime) return false;
      const t = new Date(r.dateTime).getTime();
      if (t < now - 90 * 60000) return false;
      // Cancelled / declined exclus
      if (r.status === 'cancelled' || r.status === 'declined') return false;
      return true;
    })
    .map(r => ({
      id: r.id,
      uid: r.jeuneUid || '',
      name: (() => {
        const u = users.find(u => u.uid === r.jeuneUid);
        return (u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : '') || r.jeuneName || r.jeunePhoneNumber || 'Bénéficiaire';
      })(),
      at: new Date(r.dateTime as string),
      type: r.objet || 'RDV',
      location: r.location || '',
    }));
  const seen = new Set<string>();
  const upcomingRdvs: (RdvInfo & { id: string; uid: string })[] = [...localMapped, ...backendMapped]
    .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  // "Preparer" -> ouvre la fiche du beneficiaire (ProfilePage = nouvelle preparation page)
  const handlePrepare = (rdv: RdvInfo & { id: string; uid: string }) => {
    openProfile(rdv.uid);
  };

  // Stats rapides pour le footer (pertinentes sans doublon)
  const todayCount = upcomingRdvs.filter(r => {
    const d = new Date(r.at); const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length;
  const tomorrowCount = upcomingRdvs.filter(r => {
    const d = new Date(r.at); const t = new Date(); t.setDate(t.getDate() + 1);
    return d.toDateString() === t.toDateString();
  }).length;
  const weekCount = upcomingRdvs.filter(r => {
    const d = new Date(r.at); const t = Date.now();
    return (d.getTime() - t) < 7 * 86400000;
  }).length;

  // Empty state si aucun RDV dans le store
  if (upcomingRdvs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <EmptyState
          variant="compact"
          iconKind="calendar"
          title="Aucun RDV planifié"
          description="Tes prochains rendez-vous apparaîtront ici. Tu peux en programmer un depuis l'onglet Suggestions ou Rendez-vous."
          ctaLabel="Voir mes RDV"
          onCta={() => navigate('alertes')}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Footer stats discret en haut — meta-info pertinente */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 0 10px',
        fontSize: 10, fontWeight: 600,
        color: 'var(--premium-text-4)',
        letterSpacing: '-0.05px',
        flexWrap: 'wrap',
      }}>
        {todayCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#E84393' }} />
            <span style={{ color: 'var(--premium-text-2)' }}>{todayCount} aujourd&apos;hui</span>
          </span>
        )}
        {tomorrowCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7f4997' }} />
            <span>{tomorrowCount} demain</span>
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>{weekCount} cette semaine</span>
      </div>

      {/* Liste scrollable interne — hauteur calee sur Priorites du jour (~5 RDV visibles) */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        flex: 1, minHeight: 0,
        maxHeight: 340,
        overflowY: 'auto', paddingRight: 4,
      }}>
      {upcomingRdvs.map((r, i) => {
        const d = r.at;
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const dateLabel = formatRdvDate(d);
        return (
          <div key={i} style={{
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(15,15,15,0.06)',
            borderRadius: 11,
            display: 'flex', alignItems: 'center', gap: 10,
            animation: `stagger-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
            animationDelay: staggerDelay(i, 40, 6),
          }}>
            {/* Bloc date : jour + mois en haut, heure en bas */}
            <div style={{
              flexShrink: 0, minWidth: 48, padding: '6px 8px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))',
              color: '#7f4997',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(127,73,151,0.15)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>{d.getDate()}</div>
              <div style={{ fontSize: 8.5, fontWeight: 600, color: '#a3a3a3', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{MONTHS_FR[d.getMonth()]}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--premium-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 1 }}>
                {dateLabel} · {time} · {r.type}
              </div>
            </div>
            <button
              onClick={() => handlePrepare(r)}
              style={{
                padding: '4px 9px', borderRadius: 6,
                background: 'rgba(127,73,151,0.08)',
                border: '1px solid rgba(127,73,151,0.18)',
                color: '#7f4997',
                fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer', flexShrink: 0,
                transition: 'all .12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, #7f4997, #E84393)'; (e.currentTarget as HTMLElement).style.color = '#ffffff'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.08)'; (e.currentTarget as HTMLElement).style.color = '#7f4997'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(127,73,151,0.18)'; }}
            >Préparer</button>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function formatLastActivite(d?: string | null): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
  if (diff < 7 * 86400000) return `il y a ${Math.floor(diff / 86400000)} j`;
  return formatDateFr(d);
}
