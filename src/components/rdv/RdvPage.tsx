'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
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

type Tab = 'envoye' | 'non_envoye';

export default function RdvPage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const [activeTab, setActiveTab] = useState<Tab>('envoye');

  const users = useMemo(() => {
    return [...(data?.recentUsers || [])].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  }, [data]);

  // Simuler: les élèves avec quiz complété = envoyés, les autres = non envoyés
  const { envoyes, nonEnvoyes } = useMemo(() => {
    const env: Array<{ user: typeof users[0]; init: string; dateEnvoi: string }> = [];
    const nonEnv: Array<{ user: typeof users[0]; init: string }> = [];

    users.forEach((u) => {
      const init = ((u.prenom || '?')[0] + (u.nom || '?')[0]).toUpperCase();
      if (u.quizCompleted) {
        const d = u.completedAt ? new Date(u.completedAt) : new Date();
        const dateEnvoi = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
        env.push({ user: u, init, dateEnvoi });
      } else {
        nonEnv.push({ user: u, init });
      }
    });
    return { envoyes: env, nonEnvoyes: nonEnv };
  }, [users]);

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-900)' }}>Avenir(s)</h2>
        <div style={{ fontSize: 12, color: 'var(--text-400)' }}>
          {envoyes.length} envoyé{envoyes.length > 1 ? 's' : ''} · {nonEnvoyes.length} en attente
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)' }}>
        {([
          { id: 'envoye' as Tab, label: 'Envoyés', count: envoyes.length },
          { id: 'non_envoye' as Tab, label: 'Non envoyés', count: nonEnvoyes.length },
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

      {/* Table Envoyés */}
      {activeTab === 'envoye' && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nom', 'Prénom', "Date d'envoi", 'Statut', ''].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {envoyes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-300)', fontSize: 13 }}>
                    Aucun envoi effectué
                  </td>
                </tr>
              ) : (
                envoyes.map((r, i) => (
                  <tr key={i} onClick={() => openProfile(r.user.uid)} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initials={r.init} />
                        <span style={{ fontWeight: 600, color: 'var(--text-900)' }}>{r.user.nom || '—'}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{r.user.prenom || '—'}</td>
                    <td style={tdStyle}>{r.dateEnvoi}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" style={{ width: 12, height: 12 }}><polyline points="20 6 9 17 4 12" /></svg>
                        <Badge label="Confirmé" className="badge-green" />
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={(e) => { e.stopPropagation(); openProfile(r.user.uid); }}
                        style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontWeight: 500, color: 'var(--text-700)', cursor: 'pointer' }}>
                        Voir la fiche ›
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Non envoyés */}
      {activeTab === 'non_envoye' && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nom', 'Prénom', 'Statut', ''].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nonEnvoyes.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-300)', fontSize: 13 }}>
                    Tous les élèves ont été envoyés
                  </td>
                </tr>
              ) : (
                nonEnvoyes.map((r, i) => (
                  <tr key={i} onClick={() => openProfile(r.user.uid)} style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initials={r.init} />
                        <span style={{ fontWeight: 600, color: 'var(--text-900)' }}>{r.user.nom || '—'}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{r.user.prenom || '—'}</td>
                    <td style={tdStyle}>
                      <Badge label="En attente" className="badge-grey" />
                    </td>
                    <td style={tdStyle}>
                      <button onClick={(e) => { e.stopPropagation(); openProfile(r.user.uid); }}
                        style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontWeight: 500, color: 'var(--text-700)', cursor: 'pointer' }}>
                        Voir la fiche ›
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
