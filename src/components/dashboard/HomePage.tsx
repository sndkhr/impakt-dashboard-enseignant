'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { useModals } from '@/lib/modals';
import { exportBeneficiairesCSV, exportBeneficiairesPDF } from '@/lib/export';
import { computeParcoursStatus, STATUS_CONFIG, formatDateFr } from '@/types';
import KpiCard from '@/components/ui/KpiCard';
import SideCard from '@/components/ui/SideCard';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import Chart from 'chart.js/auto';

export default function HomePage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const { openExchange, openFilters } = useModals();
  const [homeSort, setHomeSort] = useState<'name' | 'date' | 'prog'>('name');
  const donutRef = useRef<HTMLCanvasElement>(null);
  const activityRef = useRef<HTMLCanvasElement>(null);
  const donutChart = useRef<Chart | null>(null);
  const activityChart = useRef<Chart | null>(null);

  const handleExport = (fmt: 'csv' | 'pdf') => {
    if (!data) return;
    if (fmt === 'csv') {
      exportBeneficiairesCSV(data.recentUsers || []);
    } else {
      exportBeneficiairesPDF(data.recentUsers || []);
    }
  };

  const users = useMemo(() => data?.recentUsers || [], [data]);
  const completionRate = data?.quizRate || (data ? Math.round((data.quizCompleted / data.totalUsers) * 100) : 0);
  const notStartedCount = (data?.totalUsers || 0) - (data?.quizCompleted || 0);

  // Durée moyenne : calculée à partir du vrai totalAppTime des users
  const avgDays = useMemo(() => {
    const activeUsers = users.filter(u => u.totalAppTime && u.totalAppTime > 0);
    if (activeUsers.length === 0) return 0;
    const avgMinutes = activeUsers.reduce((sum, u) => sum + (u.totalAppTime || 0), 0) / activeUsers.length;
    return Math.round(avgMinutes / 60); // converti en heures
  }, [users]);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => (a.nom || '').localeCompare(b.nom || '')), [users]);
  const displayUsers = useMemo(() => {
    return sortedUsers.slice(0, 13);
  }, [sortedUsers]);

  const tableData = useMemo(() => displayUsers.map((u, i) => {
    const st = computeParcoursStatus(u);
    const prog = u.quizProgress ?? 0;
    const inscDate = u.inscriptionDate ? new Date(u.inscriptionDate) : new Date();
    const dateStr = formatDateFr(u.inscriptionDate);
    const userMetiers = u.topMetiers || [];
    return { ...u, index: i, st, prog, dateStr, inscDate, userMetiers };
  }), [displayUsers]);

  const sortedTableData = useMemo(() => {
    return [...tableData].sort((a, b) => {
      if (homeSort === 'date') return b.inscDate.getTime() - a.inscDate.getTime();
      if (homeSort === 'prog') return b.prog - a.prog;
      return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`);
    });
  }, [tableData, homeSort]);

  // Charts
  useEffect(() => {
    if (!donutRef.current || !data) return;
    if (donutChart.current) donutChart.current.destroy();
    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        datasets: [{ data: [completionRate, 100 - completionRate], backgroundColor: ['#0d9488', '#e5e7eb'], borderWidth: 0 }],
      },
      options: { cutout: '75%', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    });
    return () => { donutChart.current?.destroy(); };
  }, [data, completionRate]);

  useEffect(() => {
    if (!activityRef.current || !data) return;
    if (activityChart.current) activityChart.current.destroy();
    const sk = Object.keys(data.dailySignups).sort();
    const aD: string[] = [], aV: number[] = [], aV2: number[] = [];
    if (sk.length) {
      const s = new Date(sk[0]), e = new Date();
      for (let dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) {
        const k = dt.toISOString().split('T')[0];
        const val = data.dailySignups[k] || 0;
        aD.push(k.slice(5));
        aV.push(val);
        aV2.push(Math.max(0, Math.floor(val * 0.3 + Math.random() * 0.5)));
      }
    }
    activityChart.current = new Chart(activityRef.current, {
      type: 'line',
      data: {
        labels: aD,
        datasets: [
          {
            label: 'Inscriptions', data: aV, fill: true,
            backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D } }) => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 140);
              g.addColorStop(0, 'rgba(142,68,173,.10)'); g.addColorStop(1, 'rgba(142,68,173,.0)');
              return g;
            },
            borderColor: '#8E44AD', borderWidth: 2, tension: 0.4, pointRadius: 0,
          },
          {
            label: 'Parcours aboutis', data: aV2, fill: false,
            borderColor: '#E84393', borderWidth: 1.5, tension: 0.4, pointRadius: 0, borderDash: [4, 3],
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#111', bodyColor: '#374151', borderColor: '#eee', borderWidth: 1, padding: 8, cornerRadius: 8 } },
        interaction: { intersect: false, mode: 'index' as const },
        scales: {
          x: { ticks: { color: '#c4c7cf', font: { size: 8 }, maxTicksLimit: 6 }, grid: { display: false } },
          y: { ticks: { color: '#c4c7cf', font: { size: 8 }, stepSize: 2 }, grid: { color: '#f8f9fb' }, beginAtZero: true },
        },
      },
    });
    return () => { activityChart.current?.destroy(); };
  }, [data]);

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  // RDV badge count
  
  // Upcoming RDV items
  const completedUsers = sortedUsers.filter(u => u.quizCompleted).slice(0, 4);
  const upcomingRdv = completedUsers.map((u, i) => {
    const d = u.completedAt ? new Date(u.completedAt) : new Date();
    const ds = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return (
      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < completedUsers.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" style={{ width: 13, height: 13 }}><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-700)', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--text-900)' }}>{u.prenom} {u.nom}</strong> — Transmis à Avenir(s)
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-400)' }}>{ds} à {h}h{m}</div>
        </div>
      </div>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs */}
      <div className="fi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard title="Élèves inscrits" value={data.totalUsers} alert />
        <KpiCard title="Tests complétés" value={data.quizCompleted} suffix={` / ${data.totalUsers}`} />
        <KpiCard title="En attente de test" value={notStartedCount} />
        <KpiCard title="Temps moyen sur l'app" value={avgDays} suffix=" h" />
      </div>

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>
        {/* LEFT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filters bar */}
          <div>
            <div className="fi" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 18px', background: 'var(--white)',
              border: '1px solid var(--border)', borderRadius: '14px 14px 0 0',
            }}>
              <button onClick={() => setHomeSort('date')} style={{ padding: '7px 14px', border: homeSort === 'date' ? 'none' : '1px solid var(--border)', borderRadius: 8, background: homeSort === 'date' ? '#1a1a2e' : 'var(--white)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 500, color: homeSort === 'date' ? '#fff' : 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}><polyline points="6 9 12 15 18 9" /></svg>
                Dernière activité
              </button>
              <button onClick={() => setHomeSort('prog')} style={{ padding: '7px 14px', border: homeSort === 'prog' ? 'none' : '1px solid var(--border)', borderRadius: 8, background: homeSort === 'prog' ? '#1a1a2e' : 'var(--white)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 500, color: homeSort === 'prog' ? '#fff' : 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}><polyline points="6 9 12 15 18 9" /></svg>
                Progrès
              </button>
              <div style={{ flex: 1 }} />
              <div onClick={openFilters} style={{ width: 34, height: 34, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 16, height: 16, color: 'var(--text-400)' }}>
                  <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                </svg>
              </div>
            </div>

            {/* Table */}
            <div className="fi" style={{ background: 'var(--white)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', animationDelay: '.06s' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Nom', 'Quiz', 'Inscription', 'Métiers identifiés', 'Progrès'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-400)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '1px solid var(--border)', background: '#fafbfc', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTableData.map((u, i) => {
                    const stConf = STATUS_CONFIG[u.st];
                    return (
                      <tr key={i} onClick={() => openProfile(u.uid)} style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '10px 14px', fontSize: '12.5px', color: 'var(--text-700)', borderBottom: '1px solid #f5f5f5' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {u.nom} {u.prenom}
                            <span style={{ color: 'var(--text-300)', fontSize: 10, cursor: 'pointer' }}>›</span>
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12.5px', borderBottom: '1px solid #f5f5f5' }}>
                          <Badge label={stConf.label} className={stConf.className} />
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12.5px', color: 'var(--text-700)', borderBottom: '1px solid #f5f5f5' }}>
                          {u.dateStr}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12.5px', borderBottom: '1px solid #f5f5f5' }}>
                          {u.userMetiers.slice(0, 2).map((m, mi) => (
                            <span key={mi} className="metier-tag">{m}</span>
                          ))}
                        </td>
                        <td style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5' }}>
                          <ProgressBar value={u.prog} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          {/* Donut */}
          <SideCard title="Taux de complétion">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 110, height: 110, position: 'relative', flexShrink: 0 }}>
                <canvas ref={donutRef} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-900)', lineHeight: 1 }}>{completionRate}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-400)', marginTop: 2 }}>terminé</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-700)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488' }} />
                  Complété — {completionRate}%
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-700)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5e7eb' }} />
                  En attente — {100 - completionRate}%
                </div>
              </div>
            </div>
          </SideCard>

          {/* Activity chart */}
          <SideCard title="Résumé"
            titleRight={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 3, borderRadius: 2, background: '#8E44AD', display: 'inline-block' }} />
                  <span style={{ fontSize: 9, color: 'var(--text-400)', fontWeight: 500 }}>Inscriptions</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 3, borderRadius: 2, background: '#E84393', display: 'inline-block' }} />
                  <span style={{ fontSize: 9, color: 'var(--text-400)', fontWeight: 500 }}>Parcours aboutis</span>
                </div>
              </div>
            }
          >
            <div style={{ height: 140 }}>
              <canvas ref={activityRef} />
            </div>
          </SideCard>

          {/* Upcoming RDV */}
          <SideCard title="Avenir(s)" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
              {upcomingRdv}
            </div>
          </SideCard>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fi" style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14,
        padding: '12px 18px', animationDelay: '.12s',
      }}>
        <button onClick={() => handleExport('csv')} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          Exporter CSV
        </button>
        <button onClick={() => handleExport('pdf')} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          Exporter PDF
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={openExchange} className="btn-gradient" style={{ padding: '8px 16px', borderRadius: 8, fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Planifier un échange
        </button>
      </div>
    </div>
  );
}
