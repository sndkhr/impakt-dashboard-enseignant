'use client';

import { useNav, PageId } from '@/lib/navigation';
import { useAuth } from '@/lib/auth';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

// Icônes SVG extraites du HTML original
const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  jeunes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  alertes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  params: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  aide: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

export default function Sidebar({ rdvBadge }: { rdvBadge?: number }) {
  const { currentPage, navigate } = useNav();
  const { logout } = useAuth();

  const mainNav: NavItem[] = [
    { id: 'home', label: 'Accueil', icon: icons.home },
    { id: 'jeunes', label: 'Mes élèves', icon: icons.jeunes },
    { id: 'alertes', label: 'Rendez-vous', icon: icons.alertes, badge: rdvBadge },
    { id: 'stats', label: 'Statistiques', icon: icons.stats },
  ];

  const bottomNav: NavItem[] = [
    { id: 'params', label: 'Réglages', icon: icons.params },
    { id: 'aide', label: 'Aide & support', icon: icons.aide },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: '#f8f9fb',
      borderRight: '1px solid #ecedf2',
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 22px 26px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontSize: 20, fontWeight: 800, letterSpacing: '-0.8px',
          background: 'linear-gradient(135deg, #7f4997, #E84393)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          IMPAKT
        </div>
      </div>

      {/* Profil conseiller */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        margin: '0 14px 4px', padding: '11px 13px', borderRadius: 12,
        background: 'var(--white)', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        border: '1px solid #eef0f4',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: '#e8e9ef',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'var(--text-500)',
        }}>
          MD
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-900)' }}>Marie Dupont</div>
          <div style={{ fontSize: 10, color: 'var(--text-400)' }}>Prof. principale</div>
        </div>
      </div>

      {/* Navigation principale */}
      <div style={{ padding: '18px 22px 6px', fontSize: 9, fontWeight: 700, color: 'var(--text-300)', textTransform: 'uppercase', letterSpacing: '1.3px' }}>
        Navigation
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
        {mainNav.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '8px 13px', borderRadius: 10, cursor: 'pointer',
              transition: 'all .2s', fontSize: 12,
              fontWeight: currentPage === item.id ? 600 : 500,
              color: currentPage === item.id ? 'var(--text-900)' : 'var(--text-500)',
              background: currentPage === item.id ? 'var(--white)' : 'none',
              boxShadow: currentPage === item.id ? '0 1px 4px rgba(0,0,0,.05)' : 'none',
              border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit',
            }}
          >
            <span style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--text-400)' }}>
              {item.icon}
            </span>
            {item.label}
            {item.badge && item.badge > 0 && (
              <span style={{
                marginLeft: 'auto', background: 'var(--red)', color: '#fff',
                fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: 8,
              }}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Bas de sidebar */}
      <div style={{ marginTop: 'auto', padding: '14px 12px', borderTop: '1px solid #eaebed' }}>
        <div style={{ padding: '18px 10px 6px', fontSize: 9, fontWeight: 700, color: 'var(--text-300)', textTransform: 'uppercase', letterSpacing: '1.3px' }}>
          Paramètres
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bottomNav.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '8px 13px', borderRadius: 10, cursor: 'pointer',
                transition: 'all .2s', fontSize: 12,
                fontWeight: currentPage === item.id ? 600 : 500,
                color: currentPage === item.id ? 'var(--text-900)' : 'var(--text-500)',
                background: currentPage === item.id ? 'var(--white)' : 'none',
                boxShadow: currentPage === item.id ? '0 1px 4px rgba(0,0,0,.05)' : 'none',
                border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <span style={{ width: 16, height: 16, flexShrink: 0, color: 'var(--text-400)' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}

          {/* Déconnexion */}
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '8px 13px', borderRadius: 10, cursor: 'pointer',
              transition: 'all .2s', fontSize: 12, fontWeight: 500,
              color: 'var(--red)', background: 'none',
              border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit',
              marginTop: 4,
            }}
          >
            <span style={{ width: 16, height: 16, flexShrink: 0 }}>
              {icons.logout}
            </span>
            Se déconnecter
          </button>
        </nav>
      </div>
    </aside>
  );
}
