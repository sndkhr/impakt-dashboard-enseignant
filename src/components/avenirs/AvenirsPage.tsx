'use client';

import { useState } from 'react';

function ProfCard({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 14, padding: 18, ...style }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}

const features = [
  {
    icon: (<><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>),
    title: 'Synchronisation Avenir(s)',
    desc: 'Connexion automatique avec la plateforme officielle Avenir(s) pour récupérer les compétences et passions saisies par vos élèves.',
    tag: 'Actif',
  },
  {
    icon: (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
    title: 'Suivi en temps réel',
    desc: 'Visualisez l\'avancement de chaque élève dans son parcours d\'orientation Avenir(s) directement depuis le dashboard.',
    tag: 'Temps réel',
  },
  {
    icon: (<><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
    title: 'Validation des étapes',
    desc: 'Validez en un clic les étapes franchies par vos élèves : passions, compétences, projets professionnels.',
    tag: 'Pédagogique',
  },
  {
    icon: (<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></>),
    title: 'Tableau de bord global',
    desc: 'Vue synthétique de toute votre classe : taux de complétion, élèves avancés, élèves en retard sur Avenir(s).',
    tag: 'Classe entière',
  },
];

const recentActivities = [
  { name: 'Lucas M.', action: 'a complété son test de personnalité Avenir(s)', time: 'il y a 2h', avatar: 'LM' },
  { name: 'Sarah B.', action: 'a ajouté 3 nouvelles passions', time: 'il y a 5h', avatar: 'SB' },
  { name: 'Yanis K.', action: 'a validé son projet professionnel', time: 'hier', avatar: 'YK' },
  { name: 'Emma L.', action: 'a partagé son CV Avenir(s)', time: 'il y a 2j', avatar: 'EL' },
];

export default function AvenirsPage() {
  const [tab, setTab] = useState<'overview' | 'activity' | 'sync'>('overview');

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* === HERO === */}
      <ProfCard style={{ padding: '24px 26px', background: 'linear-gradient(135deg, rgba(127,73,151,0.08) 0%, rgba(232,67,147,0.06) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(232,67,147,0.25)',
              color: '#fff',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.5px' }}>
                Plateforme Avenir(s)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--premium-text-3)', marginTop: 2 }}>
                Suivez le parcours d&apos;orientation de vos élèves sur la plateforme nationale Avenir(s)
              </div>
            </div>
          </div>
          <a
            href="https://avenirs.onisep.fr/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 18px', borderRadius: 10,
              background: '#1c1917', color: '#fff',
              fontSize: 12.5, fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(15,15,15,0.18)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            Ouvrir Avenir(s)
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
              <path d="M7 17L17 7" /><polyline points="7 7 17 7 17 17" />
            </svg>
          </a>
        </div>

        {/* Stats inline */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 22 }}>
          {[
            { k: 'Élèves connectés', v: '24', sub: 'sur 28' },
            { k: 'Passions saisies', v: '142', sub: 'cette année' },
            { k: 'Projets pro', v: '18', sub: 'définis' },
            { k: 'Taux de complétion', v: '76%', sub: '+12% vs trim. dernier' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.85)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.k}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--premium-text)', marginTop: 4, letterSpacing: '-0.5px' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--premium-text-3)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </ProfCard>

      {/* === TABS === */}
      <div style={{ display: 'flex', gap: 6, padding: '4px', borderRadius: 12, background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)', width: 'fit-content' }}>
        {[
          { id: 'overview', label: 'Vue d\'ensemble' },
          { id: 'activity', label: 'Activité récente' },
          { id: 'sync', label: 'Synchronisation' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'overview' | 'activity' | 'sync')}
            style={{
              padding: '8px 16px', borderRadius: 9,
              border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#1c1917' : 'transparent',
              color: tab === t.id ? '#fafafa' : 'var(--premium-text-2)',
              fontSize: 12.5, fontWeight: tab === t.id ? 600 : 500,
              fontFamily: 'inherit', letterSpacing: '-0.2px',
              transition: 'all .15s ease',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* === CONTENU TAB === */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {features.map((f, i) => (
            <ProfCard key={i} style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 42, height: 42, flexShrink: 0,
                  borderRadius: 11,
                  background: 'linear-gradient(135deg, rgba(127,73,151,0.12) 0%, rgba(232,67,147,0.10) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#7f4997',
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                    {f.icon}
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>{f.title}</div>
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, color: '#7f4997',
                      padding: '2px 8px', borderRadius: 8,
                      background: 'rgba(127,73,151,0.10)',
                      letterSpacing: '0.3px', textTransform: 'uppercase',
                    }}>{f.tag}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--premium-text-3)', lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              </div>
            </ProfCard>
          ))}
        </div>
      )}

      {tab === 'activity' && (
        <ProfCard title="Dernière activité de la classe">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentActivities.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 0', borderBottom: i < recentActivities.length - 1 ? '1px solid rgba(15,15,15,0.05)' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, letterSpacing: '-0.2px',
                  boxShadow: '0 2px 6px rgba(232,67,147,0.18)',
                }}>{a.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--premium-text)' }}>
                    <strong style={{ fontWeight: 600 }}>{a.name}</strong> {a.action}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--premium-text-4)', marginTop: 2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </ProfCard>
      )}

      {tab === 'sync' && (
        <ProfCard title="Synchronisation avec Avenir(s)">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 0', borderBottom: '1px solid rgba(15,15,15,0.05)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--premium-text)' }}>État de la connexion</div>
              <div style={{ fontSize: 12, color: 'var(--premium-text-3)', marginTop: 2 }}>Dernière synchronisation : il y a 2 minutes</div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, color: '#16a34a',
              padding: '5px 10px', borderRadius: 8,
              background: 'rgba(22,163,74,0.10)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
              CONNECTÉ
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 0', borderBottom: '1px solid rgba(15,15,15,0.05)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--premium-text)' }}>Synchronisation automatique</div>
              <div style={{ fontSize: 12, color: 'var(--premium-text-3)', marginTop: 2 }}>Toutes les 15 minutes</div>
            </div>
            <button style={{
              padding: '8px 14px', borderRadius: 9,
              border: '1px solid rgba(15,15,15,0.1)', background: 'rgba(255,255,255,0.7)',
              fontSize: 12, fontWeight: 600, color: 'var(--premium-text-2)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Modifier</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 0' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--premium-text)' }}>Forcer une synchronisation</div>
              <div style={{ fontSize: 12, color: 'var(--premium-text-3)', marginTop: 2 }}>Récupérer immédiatement les dernières données</div>
            </div>
            <button style={{
              padding: '8px 14px', borderRadius: 9,
              border: 'none', background: '#1c1917', color: '#fff',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(15,15,15,0.18)',
            }}>Synchroniser maintenant</button>
          </div>
        </ProfCard>
      )}
    </div>
  );
}
