'use client';

import { useNav } from '@/lib/navigation';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  home: { title: 'Accueil', subtitle: 'Suivez les données en temps réel sur votre tableau de bord.' },
  jeunes: { title: 'Mes élèves', subtitle: 'Liste complète de tous les élèves inscrits.' },
  alertes: { title: 'Rendez-vous', subtitle: 'Gérez vos prochains rendez-vous.' },
  stats: { title: 'Statistiques', subtitle: 'Analyse de votre activité et de vos élèves.' },
  params: { title: 'Réglages', subtitle: 'Gérez votre compte et vos préférences.' },
  aide: { title: 'Aide & support', subtitle: 'FAQ et signalement de problèmes.' },
};

export default function Topbar() {
  const { currentPage } = useNav();
  const pageInfo = PAGE_TITLES[currentPage] || { title: '', subtitle: '' };

  return (
    <header style={{
      height: 52,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      background: '#f8f9fb',
      borderBottom: '1px solid #ecedf2',
    }}>
      <div>
        <h1 style={{ fontSize: 13, fontWeight: 700 }}>{pageInfo.title}</h1>
        <p style={{ fontSize: '10.5px', color: 'var(--text-500)', marginTop: 2 }}>{pageInfo.subtitle}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text"
          placeholder="Rechercher..."
          style={{
            padding: '7px 12px 7px 32px',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontFamily: 'inherit',
            fontSize: 12,
            color: 'var(--text-900)',
            outline: 'none',
            width: 180,
            marginRight: 8,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='5.5' cy='5.5' r='4.5'/%3E%3Cline x1='9' y1='9' x2='12' y2='12'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: '10px center',
          }}
        />

        <div style={{ width: 1, height: 18, background: '#dddee6', margin: '0 8px' }} />

        <button style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 17, height: 17, color: 'var(--text-400)' }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
      </div>
    </header>
  );
}
