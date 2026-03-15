'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { useModals } from '@/lib/modals';
import Badge from '@/components/ui/Badge';

const thStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-400)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '1px solid var(--border)', background: '#fafbfc', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '11px 16px', fontSize: '12.5px', color: 'var(--text-700)', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' };

function Avatar({ initials }: { initials: string }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e8e9ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-500)', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

type Tab = 'upcoming' | 'past';

export default function RdvPage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const { openExchange } = useModals();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  const users = useMemo(() => {
    return [...(data?.recentUsers || [])].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [data]);

  const { upcoming, past } = useMemo(() => {
    const rdvDates = ['5 mars 2026', '6 mars 2026', '8 mars 2026', '12 mars 2026', '15 mars 2026'];
    const rdvTimes = ['10h00', '14h30', '9h00', '11h00', '16h00'];
    const rdvTypes = ['Appel téléphonique', 'RDV en présentiel', 'Appel téléphonique', 'RDV en présentiel', 'Appel téléphonique'];
    const pastDates = ['18 févr. 2026', '10 févr. 2026', '3 févr. 2026', '25 janv. 2026', '20 janv. 2026'];
    const up: Array<{ user: typeof users[0]; idx: number; date: string; time: string; type: string; init: string }> = [];
    const pa: typeof up = [];
    let rdvCount = 0;
    users.forEach((u, i) => {
      if (i % 4 === 0) {
        const init = ((u.prenom || '?')[0] + (u.nom || '?')[0]).toUpperCase();
        const entry = { user: u, idx: i, init, date: rdvCount < 3 ? rdvDates[rdvCount] : pastDates[rdvCount - 3] || '20 janv. 2026', time: rdvTimes[rdvCount % 5], type: rdvTypes[rdvCount % 5] };
        if (rdvCount < 3) up.push(entry); else pa.push(entry);
        rdvCount++;
      }
    });
    return { upcoming: up, past: pa };
  }, [users]);

  const currentData = activeTab === 'upcoming' ? upcoming : past;

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-900)' }}>Rendez-vous</h2>
        <button onClick={openExchange} className="btn-gradient" style={{ padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Ajouter un RDV
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)' }}>
        {([
          { id: 'upcoming' as Tab, label: 'RDV à venir', count: upcoming.length },
          { id: 'past' as Tab, label: 'RDV passés', count: past.length },
        ]).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                color: isActive ? 'var(--text-900)' : 'var(--text-400)',
                background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid transparent' : '2px solid transparent',
                borderImage: isActive ? 'linear-gradient(135deg, #7f4997, #E84393) 1' : 'none',
                cursor: 'pointer', marginBottom: -2, transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: isActive ? 'linear-gradient(135deg, #7f4997, #E84393)' : '#f3f4f6',
                color: isActive ? '#fff' : 'var(--text-400)',
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Élève', 'Date', 'Heure', 'Type', 'Statut', ...(activeTab === 'upcoming' ? [''] : [])].map((h, i) => (
                <th key={i} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-300)', fontSize: 13 }}>
                  {activeTab === 'upcoming' ? 'Aucun RDV à venir' : 'Aucun RDV passé'}
                </td>
              </tr>
            ) : (
              currentData.map((r, i) => (
                <tr key={i} onClick={() => openProfile(r.user.uid)} style={{ cursor: 'pointer' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initials={r.init} />
                      <span style={{ fontWeight: 600, color: 'var(--text-900)' }}>{r.user.prenom} {r.user.nom}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{r.date}</td>
                  <td style={tdStyle}>{r.time}</td>
                  <td style={tdStyle}>{r.type}</td>
                  <td style={tdStyle}>
                    {activeTab === 'upcoming' ? (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'linear-gradient(135deg, #7f4997, #E84393)', color: '#fff' }}>Confirmé</span>
                    ) : (
                      <Badge label="Effectué" className="badge-green" />
                    )}
                  </td>
                  {activeTab === 'upcoming' && (
                    <td style={tdStyle}>
                      <button onClick={(e) => { e.stopPropagation(); openProfile(r.user.uid); }}
                        style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontWeight: 500, color: 'var(--text-700)', cursor: 'pointer' }}>
                        Voir la fiche ›
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
