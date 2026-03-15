'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { exportStatsCSV, exportStatsPDF } from '@/lib/export';
import Chart from 'chart.js/auto';

function ProfCard({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 18, transition: 'box-shadow .2s', ...style,
    }}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function StatKpi({ value, suffix, label, color, progress }: {
  value: number | string; suffix?: string; label: string; color?: string; progress?: number;
}) {
  return (
    <ProfCard style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--accent)' }}>
        {value}
        {suffix && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-400)' }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 2 }}>{label}</div>
      {progress !== undefined && (
        <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 8 }}>
          <div style={{ height: 4, background: color === '#059669' ? '#059669' : 'linear-gradient(135deg, #7f4997, #E84393)', borderRadius: 2, width: `${progress}%` }} />
        </div>
      )}
    </ProfCard>
  );
}

function MetierRankList({ items, color }: { items: Array<{ name: string; count: number }>; color: string }) {
  if (!items.length) return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-300)', fontSize: 12 }}>Pas assez de données</div>;
  const max = items[0]?.count || 1;
  return (
    <div>
      {items.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
          <div style={{ width: 20, fontSize: 11, fontWeight: 700, color: 'var(--text-400)' }}>{i + 1}</div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-900)' }}>{m.name}</div>
          <div style={{ width: 40, textAlign: 'right', fontSize: 11, fontWeight: 600, color }}>{m.count}</div>
          <div style={{ width: 50 }}>
            <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3 }}>
              <div style={{ height: 6, background: color, borderRadius: 3, width: `${Math.min((m.count / max) * 100, 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { data } = useAuth();
  const lineRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const eduRef = useRef<HTMLCanvasElement>(null);
  const activityRef = useRef<HTMLCanvasElement>(null);
  const charts = useRef<Chart[]>([]);

  const users = useMemo(() => data?.recentUsers || [], [data]);
  const total = data?.totalUsers || users.length;
  const completed = data?.quizCompleted || 0;
  const started = data?.quizStarted || 0;

  const tauxCompletion = total > 0 ? Math.round(completed / total * 100) : 0;
  const projetsValides = Math.round(completed * 0.6);
    const tauxTransmission = total > 0 ? Math.round(completed / total * 100) : 0;
  const parcoursEnregistres = useMemo(() => {
    return users.filter(u => u.quizCompleted).length;
  }, [users]);
    const finalises = Math.round(projetsValides * 0.7);
  
  // Status repartition
  const notStarted = total - started;
  const startedNotDone = started - completed;
  const validatedNotOut = projetsValides - finalises;

  // Top métiers recommandés
  const topMetiersRecommandes = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => {
      if (u.topMetiers) u.topMetiers.forEach(m => { counts[m] = (counts[m] || 0) + 1; });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, count]) => ({ name, count }));
  }, [users]);

  // Top métiers recherchés (simulé)
  const topMetiersRecherches = useMemo(() => {
    const searches = ['Infirmier', 'Développeur web', 'Comptable', 'Cuisinier', 'Graphiste', 'Aide-soignant', 'Community manager'];
    return searches.map(name => ({ name, count: Math.floor(Math.random() * 15) + 3 }));
  }, []);

  // Edu counts
  const eduCounts = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    users.forEach(u => { const e = (u as unknown as Record<string, number>).educationLevel || 0; counts[e] = (counts[e] || 0) + 1; });
    return counts;
  }, [users]);

  // Weekly connections (simulé)
  const weeklyConns = useMemo(() => {
    return Array.from({ length: 8 }, () => Math.floor(Math.random() * 50) + 20);
  }, []);

  // Charts
  useEffect(() => {
    // Destroy previous
    charts.current.forEach(c => c.destroy());
    charts.current = [];

    if (!data) return;

    const fontFamily = 'Plus Jakarta Sans';

    // 1. Evolution mensuelle
    if (lineRef.current) {
      const months = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr'];
      const inscrData = [8, 14, 22, 28, 35, total];
      const testData = [2, 6, 12, 18, 24, completed];
      const finData = [0, 1, 3, 5, 8, finalises];
      charts.current.push(new Chart(lineRef.current, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            { label: 'Inscriptions', data: inscrData, borderColor: '#7f4997', backgroundColor: 'rgba(127,73,151,.08)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#7f4997' },
            { label: 'Tests complétés', data: testData, borderColor: '#E84393', backgroundColor: 'rgba(232,67,147,.05)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#E84393' },
            { label: 'Transmissions Avenir(s)', data: finData, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.05)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#059669' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { family: fontFamily, size: 10 }, boxWidth: 10, padding: 12 } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: fontFamily, size: 10 } } },
            y: { beginAtZero: true, grid: { color: '#f5f5f5' }, ticks: { font: { family: fontFamily, size: 10 } } },
          },
        },
      }));
    }

    // 2. Donut statut
    if (donutRef.current) {
      charts.current.push(new Chart(donutRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Non démarré', 'Test en cours', 'Test terminé', 'Transmis à Avenir(s)'],
          datasets: [{
            data: [notStarted, startedNotDone, completed - completed, completed],
            backgroundColor: ['#e5e7eb', '#fbbf24', '#E84393', '#059669'],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: { legend: { position: 'bottom', labels: { font: { family: fontFamily, size: 10 }, boxWidth: 10, padding: 10 } } },
        },
      }));
    }

    // 3. Transmissions à Avenir(s) par mois
    if (eduRef.current) {
      const transLabels = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr'];
      const transData = [0, 2, 5, 8, 14, completed];
      charts.current.push(new Chart(eduRef.current, {
        type: 'bar',
        data: {
          labels: transLabels,
          datasets: [{ label: 'Transmissions', data: transData, backgroundColor: 'rgba(5,150,105,.7)', borderRadius: 6, barPercentage: 0.6 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: fontFamily, size: 10 } } },
            y: { beginAtZero: true, grid: { color: '#f5f5f5' }, ticks: { font: { family: fontFamily, size: 10 } } },
          },
        },
      }));
    }

    // 4. Activité connexions/semaine
    if (activityRef.current) {
      const weeks = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
      charts.current.push(new Chart(activityRef.current, {
        type: 'line',
        data: {
          labels: weeks,
          datasets: [{
            label: 'Connexions', data: weeklyConns,
            borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,.08)',
            fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#0d9488',
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: fontFamily, size: 10 } } },
            y: { beginAtZero: true, grid: { color: '#f5f5f5' }, ticks: { font: { family: fontFamily, size: 10 } } },
          },
        },
      }));
    }

    return () => { charts.current.forEach(c => c.destroy()); charts.current = []; };
  }, [data, total, completed, finalises, notStarted, startedNotDone, projetsValides, validatedNotOut, eduCounts, weeklyConns]);

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Export bar */}
      <ProfCard style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-900)' }}>Exporter les données statistiques</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => data && exportStatsCSV(data)} style={{
            padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--white)',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            CSV
          </button>
          <button onClick={() => data && exportStatsPDF(data)} className="btn-gradient" style={{
            padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            PDF
          </button>
        </div>
      </ProfCard>

      {/* 4 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatKpi value={`${tauxCompletion}%`} label="Taux de complétion du test" progress={tauxCompletion} />
        <StatKpi value={`${tauxTransmission}%`} label="Taux de transmission à Avenir(s)" progress={tauxTransmission} />
        <StatKpi value={25} suffix=" min" label="Temps moyen sur l'app" color="var(--text-900)" />
        <StatKpi value={parcoursEnregistres} label="Parcours enregistrés en favoris" color="#059669" />
      </div>

      {/* Charts row 1: Line + Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ProfCard title="Évolution mensuelle">
          <div style={{ height: 220 }}><canvas ref={lineRef} /></div>
        </ProfCard>
        <ProfCard title="Répartition par statut">
          <div style={{ height: 220 }}><canvas ref={donutRef} /></div>
        </ProfCard>
      </div>

      {/* Métiers row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ProfCard title="Top métiers recommandés">
          <MetierRankList items={topMetiersRecommandes} color="var(--accent)" />
        </ProfCard>
        <ProfCard title="Top métiers recherchés par les élèves">
          <MetierRankList items={topMetiersRecherches} color="#0d9488" />
        </ProfCard>
      </div>

      {/* Charts row 2: Edu bars + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ProfCard title="Transmissions à Avenir(s)">
          <div style={{ height: 200 }}><canvas ref={eduRef} /></div>
        </ProfCard>
        <ProfCard title="Activité sur la plateforme (connexions/semaine)">
          <div style={{ height: 200 }}><canvas ref={activityRef} /></div>
        </ProfCard>
      </div>
    </div>
  );
}
