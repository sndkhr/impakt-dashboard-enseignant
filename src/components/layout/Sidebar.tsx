'use client';

import { useNav, PageId } from '@/lib/navigation';
import { useAuth } from '@/lib/auth';
import { useConversations } from '@/lib/useBackendRdvs';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

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
  suggestions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  messagerie: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
  avenirs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
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
  const { logout, data } = useAuth();
  const { unreadTotal: unreadMessages } = useConversations();

  const mainNav: NavItem[] = [
    { id: 'home', label: 'Accueil', icon: icons.home },
    { id: 'jeunes', label: 'Mes élèves', icon: icons.jeunes },
    { id: 'messagerie', label: 'Messagerie', icon: icons.messagerie, badge: unreadMessages },
    { id: 'alertes', label: 'Rendez-vous', icon: icons.alertes, badge: rdvBadge },
    { id: 'avenirs', label: 'Avenir(s)', icon: icons.avenirs },
    { id: 'suggestions', label: 'Suggestions', icon: icons.suggestions },
    { id: 'stats', label: 'Statistiques', icon: icons.stats },
  ];

  const bottomNav: NavItem[] = [
    { id: 'params', label: 'Réglages', icon: icons.params },
    { id: 'aide', label: 'Aide & support', icon: icons.aide },
  ];

  // Nom complet : assure qu'on a bien prenom + nom (si le backend renvoie juste un prenom, on complete avec une valeur par defaut)
  const rawName = data?.conseillerName?.trim() || '';
  const conseillerName = rawName && rawName.split(/\s+/).length >= 2
    ? rawName
    : (rawName ? `${rawName} Dupont` : 'Marie Dupont');
  const initials = conseillerName.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();

  // Premium navItem renderer — pill noir pour l'actif, hover subtil
  const navItem = (n: NavItem, isActive: boolean) => (
    <button key={n.id} onClick={() => navigate(n.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '9px 12px',
        border: 'none', borderRadius: 12,
        background: isActive ? '#1c1917' : 'transparent',
        boxShadow: isActive ? '0 2px 6px rgba(15,15,15,0.12), 0 6px 18px rgba(15,15,15,0.08)' : 'none',
        cursor: 'pointer', textAlign: 'left',
        fontFamily: 'inherit', width: '100%',
        position: 'relative',
        transition: 'all .15s ease',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(15,15,15,0.05)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        width: 18, height: 18, flexShrink: 0,
        color: isActive ? '#fafafa' : 'var(--premium-text-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n.icon}</span>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13.5,
        fontWeight: isActive ? 600 : 500,
        color: isActive ? '#fafafa' : 'var(--premium-text-2)',
        letterSpacing: '-0.2px',
        flex: 1,
      }}>{n.label}</span>
      {isActive && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ffffff', boxShadow: '0 0 8px rgba(255,255,255,0.9)' }} />
      )}
      {(n.badge ?? 0) > 0 && !isActive && (
        <span style={{
          fontSize: 9.5, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg, #7f4997, #E84393)',
          padding: '2px 7px', borderRadius: 999,
          letterSpacing: '0.3px',
          boxShadow: '0 2px 6px rgba(232,67,147,0.25)',
        }}>{n.badge}</span>
      )}
    </button>
  );

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'rgba(255,255,255,0.52)',
      backdropFilter: 'blur(30px) saturate(160%)',
      WebkitBackdropFilter: 'blur(30px) saturate(160%)',
      border: '1px solid rgba(255,255,255,0.65)',
      borderRadius: 24,
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 12px 40px rgba(15,15,15,0.08), inset 0 1px 0 rgba(255,255,255,0.85)',
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 32px)',
      position: 'fixed',
      top: 16, left: 16, zIndex: 50,
      overflow: 'hidden',
    }}>
      {/* === Logo IMPAKT officiel (image) === */}
      <div style={{ padding: '24px 24px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src="/impakt-logo.png"
          alt="Impakt"
          style={{
            width: 36, height: 36, borderRadius: 9,
            objectFit: 'cover',
            boxShadow: '0 2px 10px rgba(15,15,15,0.15)',
          }}
        />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 700,
          letterSpacing: '-0.7px',
          color: 'var(--premium-text)',
          lineHeight: 1,
        }}>Impakt</span>
      </div>

      {/* === Bloc profil conseiller glass === */}
      <div style={{
        margin: '0 16px 20px',
        padding: '13px 14px',
        display: 'flex', alignItems: 'center', gap: 11,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.52)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 4px 14px rgba(15,15,15,0.04), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
          color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12.5, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.3px',
          boxShadow: '0 2px 8px rgba(232,67,147,0.25)',
        }}>{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--premium-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.1px' }}>{conseillerName}</div>
          <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Prof. principale</div>
        </div>
      </div>

      {/* === Navigation principale === */}
      <div style={{ padding: '10px 22px 8px', fontSize: 9.5, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Navigation
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
        {mainNav.map((item) => navItem(item, currentPage === item.id))}
      </nav>

      {/* === Bas de sidebar : Paramètres + Logout === */}
      <div style={{ marginTop: 'auto', padding: '14px 12px 18px', borderTop: '1px solid rgba(15,15,15,0.06)' }}>
        <div style={{ padding: '12px 10px 8px', fontSize: 9.5, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Réglages
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bottomNav.map((item) => navItem(item, currentPage === item.id))}

          {/* Déconnexion — accent rouge */}
          <button onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '9px 12px',
              border: 'none', borderRadius: 12,
              background: 'transparent',
              cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', width: '100%',
              transition: 'all .15s ease',
              marginTop: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ width: 18, height: 18, flexShrink: 0, color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icons.logout}
            </span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13.5, fontWeight: 500,
              color: '#dc2626',
              letterSpacing: '-0.2px',
            }}>Se déconnecter</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
