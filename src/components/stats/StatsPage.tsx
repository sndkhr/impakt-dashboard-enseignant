'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { exportStatsCSV, exportStatsPDF } from '@/lib/export';
import Chart from 'chart.js/auto';
import KpiCard from '@/components/ui/KpiCard';
import { inscriptionsTrend, completedTrend, activeTrend } from '@/lib/trends';
import { computeAlertLevel } from '@/types';
import { staggerDelay } from '@/lib/motion';

/* ============================================================
   STATS PAGE — tailored pour un prof principal
   5 sections utiles :
   1. KPIs classe
   2. Evolution 12 mois
   3. Repartition statuts + Alertes actionables
   4. Top metiers / secteurs / formations
   5. Activite enseignant + engagement IMPAKT
   ============================================================ */

const DAY_MS = 86400000;

// === Glass panel style admin ===
function GlassPanel({ title, subtitle, badge, children, style, index = 0 }: {
  title?: string; subtitle?: string; badge?: React.ReactNode;
  children: React.ReactNode; style?: React.CSSProperties; index?: number;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 20,
      padding: '18px 20px',
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
      position: 'relative', overflow: 'hidden',
      animation: `stagger-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
      animationDelay: staggerDelay(index, 60, 10),
      ...style,
    }}>
      {(title || badge) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: subtitle ? 10 : 14 }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}

// === RANKING list (top metiers / secteurs / formations) ===
// 3 accents IMPAKT only : violet / pink / noir (pas de vert, pas d'orange)
function RankingList({ items, accent }: { items: { name: string; count: number }[]; accent: 'violet' | 'pink' | 'noir' }) {
  if (!items.length) return <div style={{ fontSize: 12, color: 'var(--premium-text-4)', padding: '10px 0', fontStyle: 'italic' }}>Pas assez de données.</div>;
  const max = items[0]?.count || 1;
  const total = items.reduce((s, x) => s + x.count, 0);
  const colorMap = {
    violet: { bg: 'linear-gradient(90deg, #7f4997, #a78bfa)', badge: 'rgba(127,73,151,0.10)', text: '#7f4997' },
    pink: { bg: 'linear-gradient(90deg, #E84393, #f9a8d4)', badge: 'rgba(232,67,147,0.10)', text: '#E84393' },
    noir: { bg: 'linear-gradient(90deg, #1a1333, #7f4997)', badge: 'rgba(26,19,51,0.10)', text: '#1a1333' },
  };
  const c = colorMap[accent];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((m, i) => {
        const pct = Math.round((m.count / max) * 100);
        const share = total ? Math.round((m.count / total) * 100) : 0;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 0',
            borderBottom: i < items.length - 1 ? '1px solid rgba(15,15,15,0.04)' : 'none',
            animation: `stagger-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
            animationDelay: staggerDelay(i, 40, 6),
          }}>
            <div style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: 6,
              background: i < 3 ? c.badge : 'rgba(15,15,15,0.04)',
              color: i < 3 ? c.text : 'var(--premium-text-4)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              border: i < 3 ? `1px solid ${c.text}30` : '1px solid rgba(15,15,15,0.08)',
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                <span title={m.name} style={{
                  fontSize: 11.5, fontWeight: 600,
                  color: 'var(--premium-text)', letterSpacing: '-0.1px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.name}</span>
                <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: c.text, fontVariantNumeric: 'tabular-nums' }}>
                  {m.count} <span style={{ color: 'var(--premium-text-4)', fontWeight: 500 }}>· {share}%</span>
                </span>
              </div>
              <div style={{ height: 5, background: 'rgba(15,15,15,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: c.bg, borderRadius: 999,
                  transition: 'width .6s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === ALERTE actionnable ===
interface ActionableAlert {
  kind: 'positive' | 'warning' | 'neutral';
  icon: React.ReactNode;
  text: string;
  cta: string;
  onClick: () => void;
}

export default function StatsPage() {
  const { data } = useAuth();
  const { navigate } = useNav();
  const lineRef = useRef<HTMLCanvasElement>(null);
  const statutRef = useRef<HTMLCanvasElement>(null);
  const parcoursRef = useRef<HTMLCanvasElement>(null);
  const rdvRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<Chart[]>([]);

  const users = useMemo(() => data?.recentUsers || [], [data]);
  const total = data?.totalUsers || users.length;
  const completed = data?.quizCompleted || users.filter(u => u.quizCompleted).length;
  const now = Date.now();

  // === KPIs ===
  const activeWeek = useMemo(() => users.filter(u => u.lastActive && (now - new Date(u.lastActive).getTime()) < 7 * DAY_MS).length, [users, now]);
  const enAlerte = useMemo(() => users.filter(u => { const lvl = computeAlertLevel(u); return lvl === 'bloque' || lvl === 'decroch'; }).length, [users]);

  // Motivation moyenne agrégée du portefeuille
  const avgMotivation = useMemo(() => {
    if (users.length === 0) return 0;
    const sum = users.reduce((acc, u) => {
      let s = 50;
      const lad = u.lastActive ? Math.floor((now - new Date(u.lastActive).getTime()) / DAY_MS) : null;
      if (u.quizCompleted) s += 20; else if (u.quizStarted) s -= 5; else s -= 15;
      if (lad !== null && lad <= 2) s += 20; else if (lad !== null && lad >= 14) s -= 25;
      return acc + Math.max(0, Math.min(100, s));
    }, 0);
    return Math.round(sum / users.length);
  }, [users, now]);

  // Trends 7j pour KPIs
  const trInsc = useMemo(() => inscriptionsTrend(users, 7), [users]);
  const trCompleted = useMemo(() => completedTrend(users, 7), [users]);
  const trActive = useMemo(() => activeTrend(users, 7), [users]);

  // Repartition statuts (pour donut)
  const statutCounts = useMemo(() => {
    const notStarted = users.filter(u => !u.quizStarted).length;
    const inProgress = users.filter(u => u.quizStarted && !u.quizCompleted).length;
    const completedNoFav = users.filter(u => u.quizCompleted && (!u.topMetiers || u.topMetiers.length === 0)).length;
    const withFav = users.filter(u => u.quizCompleted && u.topMetiers && u.topMetiers.length > 0).length;
    const blocked = users.filter(u => {
      const lvl = computeAlertLevel(u);
      return lvl === 'bloque' || lvl === 'decroch';
    }).length;
    return {
      'Non démarré': notStarted,
      'Test en cours': inProgress,
      'Test terminé': completedNoFav,
      'Projet identifié': Math.max(0, withFav - blocked),
      'En alerte': blocked,
    };
  }, [users]);

  // Top metiers agréges
  const topMetiers = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => { if (u.topMetiers) u.topMetiers.forEach(m => { counts[m] = (counts[m] || 0) + 1; }); });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, count]) => ({ name, count }));
  }, [users]);

  // Secteurs (mapping simplifie)
  const topSecteurs = useMemo(() => {
    const mapMetierToSecteur = (m: string): string => {
      const ml = m.toLowerCase();
      if (/infirm|aide.?soignant|médecin|auxiliaire|kiné/.test(ml)) return 'Santé';
      if (/social|éducat|animat|médiateur|psycho|assistant social/.test(ml)) return 'Social & Services à la personne';
      if (/développ|informatique|data|cyber|tech|numérique|digital/.test(ml)) return 'Numérique & Tech';
      if (/vente|commerce|commercial|vendeur|caissier/.test(ml)) return 'Commerce & Vente';
      if (/commun|journa|rédact|graphi|marketi|publi/.test(ml)) return 'Communication & Médias';
      if (/professeur|enseignant|formateur|éducation/.test(ml)) return 'Enseignement & Formation';
      if (/cuisin|pâtissi|boulang|serveur|chef|hôtel|tourisme/.test(ml)) return 'Hôtellerie & Tourisme';
      if (/bâtiment|maçon|électric|plomb|btp|menuis/.test(ml)) return 'Bâtiment & Travaux';
      if (/mécanicien|industr|technicien|maintenanc|opérateur/.test(ml)) return 'Industrie & Maintenance';
      if (/chauff|logisti|transport|livraison|cariste/.test(ml)) return 'Transport & Logistique';
      if (/banqu|finance|assur|comptab/.test(ml)) return 'Banque & Finance';
      if (/coordinateur|responsable|chargé|conseiller|directeur|chef/.test(ml)) return 'Encadrement & Management';
      return 'Autres';
    };
    const counts: Record<string, number> = {};
    users.forEach(u => { (u.topMetiers || []).forEach(m => { const sec = mapMetierToSecteur(m); counts[sec] = (counts[sec] || 0) + 1; }); });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, count]) => ({ name, count }));
  }, [users]);

  // Top formations (mock)
  const topFormations = useMemo(() => [
    { name: 'BTS Communication', count: Math.round(total * 0.15) },
    { name: 'Titre pro Assistant commercial', count: Math.round(total * 0.12) },
    { name: 'POEI Opérateur logistique', count: Math.round(total * 0.09) },
    { name: 'CQP Vendeur conseil', count: Math.round(total * 0.08) },
    { name: 'Licence pro numérique', count: Math.round(total * 0.06) },
    { name: 'CAP Cuisine', count: Math.round(total * 0.05) },
    { name: 'Titre pro Community Manager', count: Math.round(total * 0.04) },
  ].filter(f => f.count > 0), [total]);

  // Alertes actionnables
  const alertes: ActionableAlert[] = useMemo(() => {
    const list: ActionableAlert[] = [];
    const finished = users.filter(u => u.quizCompleted && u.completedAt && (now - new Date(u.completedAt).getTime()) < 7 * DAY_MS).length;
    const inactive = users.filter(u => u.lastActive && (now - new Date(u.lastActive).getTime()) >= 14 * DAY_MS).length;
    const testBloque = users.filter(u => u.quizStarted && !u.quizCompleted && u.lastActive && (now - new Date(u.lastActive).getTime()) >= 5 * DAY_MS).length;
    const noFav = users.filter(u => u.quizCompleted && (!u.topMetiers || u.topMetiers.length === 0)).length;

    if (finished > 0) list.push({ kind: 'positive', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><polyline points="20 6 9 17 4 12" /></svg>, text: `${finished} jeune${finished > 1 ? 's' : ''} ont terminé leur test cette semaine`, cta: 'Inviter en RDV', onClick: () => navigate('suggestions') });
    if (testBloque > 0) list.push({ kind: 'warning', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>, text: `${testBloque} test${testBloque > 1 ? 's' : ''} bloqué${testBloque > 1 ? 's' : ''} depuis 5j+`, cta: 'Débloquer', onClick: () => navigate('suggestions') });
    if (inactive > 0) list.push({ kind: 'warning', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>, text: `${inactive} jeune${inactive > 1 ? 's' : ''} inactif${inactive > 1 ? 's' : ''} depuis 14j+`, cta: 'Relancer', onClick: () => navigate('suggestions') });
    if (noFav > 0) list.push({ kind: 'neutral', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>, text: `${noFav} jeune${noFav > 1 ? 's' : ''} sans favori — à accompagner`, cta: 'Voir la liste', onClick: () => navigate('jeunes') });
    return list.slice(0, 5);
  }, [users, now, navigate]);

  // === Charts ===
  useEffect(() => {
    charts.current.forEach(c => c.destroy());
    charts.current = [];
    if (!data) return;

    const fontFamily = 'Plus Jakarta Sans';
    const gridColor = 'rgba(15,15,15,0.04)';

    // 1. Evolution 12 mois
    if (lineRef.current) {
      const ctx = lineRef.current.getContext('2d');
      if (ctx) {
        const months = ['Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr', 'Mars', 'Avr'];
        const inscrData = months.map((_, i) => Math.round(total * (0.05 + i * 0.006)));
        const testData = months.map((_, i) => Math.round(inscrData[i] * 0.45));

        const gradInsc = ctx.createLinearGradient(0, 0, 0, 280);
        gradInsc.addColorStop(0, 'rgba(127,73,151,0.25)');
        gradInsc.addColorStop(1, 'rgba(127,73,151,0)');
        const gradTest = ctx.createLinearGradient(0, 0, 0, 280);
        gradTest.addColorStop(0, 'rgba(232,67,147,0.22)');
        gradTest.addColorStop(1, 'rgba(232,67,147,0)');

        charts.current.push(new Chart(ctx, {
          type: 'line',
          data: {
            labels: months,
            datasets: [
              { label: 'Inscriptions', data: inscrData, borderColor: '#7f4997', backgroundColor: gradInsc, fill: true, tension: 0.4, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#7f4997', pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 2 },
              { label: 'Tests terminés', data: testData, borderColor: '#E84393', backgroundColor: gradTest, fill: true, tension: 0.4, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#E84393', pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 2 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              legend: { position: 'bottom', align: 'start', labels: { color: '#525252', font: { family: fontFamily, size: 10.5, weight: 600 }, boxWidth: 8, boxHeight: 8, borderRadius: 4, useBorderRadius: true, padding: 12 } },
              tooltip: { backgroundColor: 'rgba(15,15,15,0.92)', titleColor: '#ffffff', bodyColor: 'rgba(255,255,255,0.85)', titleFont: { family: fontFamily, size: 11, weight: 700 }, bodyFont: { family: fontFamily, size: 11 }, padding: 10, cornerRadius: 8, displayColors: true, boxWidth: 6, boxHeight: 6, borderColor: 'rgba(232,67,147,0.3)', borderWidth: 1 },
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#a3a3a3', font: { family: fontFamily, size: 10 } }, border: { display: false } },
              y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: '#a3a3a3', font: { family: fontFamily, size: 10 }, precision: 0 }, border: { display: false } },
            },
            animation: { duration: 800, easing: 'easeOutCubic' },
          },
        }));
      }
    }

    // 2. Donut statut (repartition portefeuille) — palette IMPAKT degraded
    if (statutRef.current) {
      const labels = Object.keys(statutCounts);
      const values = Object.values(statutCounts);
      const colors = ['#e5e7eb', '#d8c5ed', '#a78bfa', '#7f4997', '#E84393', '#dc2626'];
      charts.current.push(new Chart(statutRef.current, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: {
            legend: { position: 'right', labels: { color: '#525252', font: { family: fontFamily, size: 10.5, weight: 500 }, boxWidth: 8, padding: 10, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { backgroundColor: 'rgba(15,15,15,0.92)', titleFont: { family: fontFamily, size: 11, weight: 700 }, bodyFont: { family: fontFamily, size: 11 }, padding: 10, cornerRadius: 8 },
          },
        },
      }));
    }

    // 3. Donut parcours validation (mock - à brancher sur localStorage)
    if (parcoursRef.current) {
      const validated = Math.round(total * 0.22);
      const discuss = Math.round(total * 0.14);
      const rejected = Math.round(total * 0.08);
      const pending = Math.max(0, total - validated - discuss - rejected);
      charts.current.push(new Chart(parcoursRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Validés', 'À discuter', 'Écartés', 'En attente'],
          datasets: [{ data: [validated, discuss, rejected, pending], backgroundColor: ['#7f4997', '#E84393', '#a3a3a3', '#e5e7eb'], borderWidth: 0, hoverOffset: 5 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '70%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#525252', font: { family: fontFamily, size: 10, weight: 500 }, boxWidth: 7, padding: 8, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { backgroundColor: 'rgba(15,15,15,0.92)', padding: 10, cornerRadius: 8 },
          },
        },
      }));
    }

    // 4. RDV par mois (bar chart)
    if (rdvRef.current) {
      const ctx = rdvRef.current.getContext('2d');
      if (ctx) {
        const months = ['Nov', 'Déc', 'Janv', 'Févr', 'Mars', 'Avr'];
        const rdvs = months.map((_, i) => Math.round(25 + i * 3 + Math.random() * 10));
        const grad = ctx.createLinearGradient(0, 0, 0, 200);
        grad.addColorStop(0, '#7f4997');
        grad.addColorStop(1, '#E84393');
        charts.current.push(new Chart(ctx, {
          type: 'bar',
          data: { labels: months, datasets: [{ label: 'RDV tenus', data: rdvs, backgroundColor: grad, borderRadius: 6, barPercentage: 0.55 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,15,15,0.92)', padding: 10, cornerRadius: 8 } },
            scales: { x: { grid: { display: false }, ticks: { color: '#a3a3a3', font: { family: fontFamily, size: 10 } }, border: { display: false } }, y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: '#a3a3a3', font: { family: fontFamily, size: 10 }, precision: 0 }, border: { display: false } } },
            animation: { duration: 700 },
          },
        }));
      }
    }

    return () => { charts.current.forEach(c => c.destroy()); charts.current = []; };
  }, [data, total, completed, statutCounts]);

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* === HEADER : pills + export buttons === */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 0 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
            boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E84393', boxShadow: '0 0 8px rgba(232,67,147,0.6)', animation: 'pulse 2s ease-in-out infinite' }} />
            Données temps réel
          </div>
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
            boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7f4997' }} />
            12 derniers mois
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => data && exportStatsCSV(data)}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(15,15,15,0.08)',
              color: 'var(--premium-text-2)',
              fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'all .12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.85)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.55)'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          <button onClick={() => data && exportStatsPDF(data)}
            style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(232,67,147,0.25)',
              transition: 'all .15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(232,67,147,0.35)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(232,67,147,0.25)'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* === ROW 1 : 5 KPIs portefeuille === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <KpiCard index={0} gradient title="Élèves" value={total} trend={trInsc.series} delta={trInsc.delta} />
        <KpiCard index={1} title="Actifs 7j" value={activeWeek} trend={trActive.series} delta={trActive.delta} />
        <KpiCard index={2} title="Complétés" value={completed} trend={trCompleted.series} delta={trCompleted.delta} />
        <KpiCard index={3} title="En alerte" value={enAlerte} />
        <KpiCard index={4} title="Motivation" value={avgMotivation} suffix="%" />
      </div>

      {/* === ROW 2 : Évolution 12 mois (pleine largeur) === */}
      <GlassPanel title="Évolution sur 12 mois" subtitle="Inscriptions · Tests terminés" index={0}>
        <div style={{ position: 'relative', height: 260 }}>
          <canvas ref={lineRef} />
        </div>
      </GlassPanel>

      {/* === ROW 3 : Répartition portefeuille (donut) + Alertes actionnables === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14 }}>
        <GlassPanel title="Répartition de la classe" subtitle={`${total} élèves suivis · 5 statuts`} index={0}>
          <div style={{ position: 'relative', height: 240 }}>
            <canvas ref={statutRef} />
          </div>
        </GlassPanel>

        <GlassPanel title="Actions prioritaires cette semaine" subtitle="Alertes actionnables détectées sur ton portefeuille" index={1}>
          {alertes.length === 0 ? (
            <div style={{ padding: '28px 10px', textAlign: 'center', fontSize: 12, color: 'var(--premium-text-4)', fontStyle: 'italic' }}>
              Tout est à jour, rien à signaler.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {alertes.map((a, i) => {
                // Dot color uniquement (pas de fond pastel)
                const dotColor = a.kind === 'positive' ? '#7f4997'
                  : a.kind === 'warning' ? '#E84393'
                  : '#a3a3a3';
                return (
                  <button key={i} onClick={a.onClick} style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '11px 4px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: i < alertes.length - 1 ? '1px solid rgba(15,15,15,0.05)' : 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left', width: '100%',
                    transition: 'all .12s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.03)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{
                      flexShrink: 0, width: 8, height: 8, borderRadius: '50%',
                      background: dotColor,
                      boxShadow: `0 0 8px ${dotColor}40`,
                    }} />
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--premium-text)', fontWeight: 500, lineHeight: 1.4 }}>{a.text}</span>
                    <span style={{
                      flexShrink: 0,
                      fontSize: 10.5, fontWeight: 700, color: '#7f4997',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      letterSpacing: '-0.1px',
                    }}>
                      {a.cta}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* === ROW 4 : Top métiers + Top secteurs + Top formations === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <GlassPanel title="Top métiers ciblés" subtitle="Par les jeunes de ton portefeuille" index={0}>
          <RankingList items={topMetiers} accent="violet" />
        </GlassPanel>
        <GlassPanel title="Top secteurs" subtitle="Agrégation des métiers du test" index={1}>
          <RankingList items={topSecteurs} accent="pink" />
        </GlassPanel>
        <GlassPanel title="Top formations consultées" subtitle="Dans l'app par tes jeunes" index={2}>
          <RankingList items={topFormations} accent="noir" />
        </GlassPanel>
      </div>

      {/* === ROW 5 : Activité RDV + Parcours validation (2 cards équilibrées) === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14 }}>
        <GlassPanel title="Mon activité RDV" subtitle="6 derniers mois · RDV tenus" index={0}>
          <div style={{ position: 'relative', height: 220 }}>
            <canvas ref={rdvRef} />
          </div>
        </GlassPanel>

        <GlassPanel title="Parcours de formation" subtitle="Statut de validation sur le portefeuille" index={1}>
          <div style={{ position: 'relative', height: 220 }}>
            <canvas ref={parcoursRef} />
          </div>
        </GlassPanel>
      </div>

    </div>
  );
}
