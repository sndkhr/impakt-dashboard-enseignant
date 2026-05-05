'use client';

import { useState, useEffect, useRef } from 'react';
import { useNav } from '@/lib/navigation';
import { useAuth } from '@/lib/auth';
import { useCommandPalette } from '@/components/ui/CommandPalette';
import { useRdvNotifications } from '@/lib/useBackendRdvs';
import { RdvNotification } from '@/lib/api';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  home: { title: 'Accueil', subtitle: 'Données temps réel sur votre tableau de bord' },
  jeunes: { title: 'Mes élèves', subtitle: 'Liste complète de tous vos élèves' },
  alertes: { title: 'Rendez-vous', subtitle: 'Gérez vos prochains rendez-vous' },
  messagerie: { title: 'Messagerie', subtitle: 'Échanges privés avec vos élèves' },
  avenirs: { title: 'Avenir(s)', subtitle: 'Plateforme nationale d\'orientation — suivi des parcours de vos élèves' },
  suggestions: { title: 'Suggestions', subtitle: 'Actions recommandées sur votre classe — sélectionnez et agissez en masse' },
  stats: { title: 'Statistiques', subtitle: 'Analyse de votre activité et de vos élèves' },
  params: { title: 'Réglages', subtitle: 'Gérez votre compte et vos préférences' },
  aide: { title: 'Aide & support', subtitle: 'FAQ et signalement de problèmes' },
};

function formatLastRefresh(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 30000) return "à l'instant";
  if (diff < 60000) return 'il y a ' + Math.floor(diff / 1000) + 's';
  if (diff < 3600000) return 'il y a ' + Math.floor(diff / 60000) + ' min';
  return 'il y a ' + Math.floor(diff / 3600000) + ' h';
}

function formatNotifTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function Topbar() {
  const { currentPage, navigate, openProfile } = useNav();
  const { refreshData } = useAuth();
  const { open: openPalette } = useCommandPalette();
  const pageInfo = PAGE_TITLES[currentPage] || { title: '', subtitle: '' };
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [tick, setTick] = useState(0);
  // v17.8 — 2 popovers distincts :
  //   • inbox : demandes des jeunes (RDV + formations)
  //   • bell  : autres notifications (test terminé, etc.)
  const [inboxOpen, setInboxOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const inboxRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const {
    notifications,
    unreadRdvCount, unreadFormationCount, unreadOtherCount,
    markRead, markIdsAsRead,
  } = useRdvNotifications();

  // Filtres par catégorie d'icône
  const inboxNotifications = notifications.filter(n =>
    n.type === 'rendezvous_response' || n.type === 'formation_request'
  );
  const bellNotifications = notifications.filter(n =>
    n.type !== 'rendezvous_response' && n.type !== 'formation_request'
  );
  const inboxUnread = unreadRdvCount + unreadFormationCount;
  const bellUnread = unreadOtherCount;

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    if (!inboxOpen && !bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (inboxOpen && inboxRef.current && !inboxRef.current.contains(e.target as Node)) setInboxOpen(false);
      if (bellOpen && bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [inboxOpen, bellOpen]);

  const handleRefresh = async () => {
    if (refreshData) { await refreshData(); }
    setLastRefresh(Date.now());
  };

  const handleNotifClick = async (notif: RdvNotification) => {
    if (!notif.read) await markRead(notif.id);
    setInboxOpen(false);
    setBellOpen(false);
    // v17.8 — Routage selon le type de notif
    if (notif.type === 'formation_request' && notif.jeuneUid) {
      openProfile(notif.jeuneUid, 'parcours');
      return;
    }
    if ((notif.type === 'quiz_completed' || notif.type === 'profile_completed') && notif.jeuneUid) {
      openProfile(notif.jeuneUid);
      return;
    }
    // Cas par défaut : RDV → onglet RDV + scroll au RDV concerné
    navigate('alertes');
    if (notif.rdvId) {
      setTimeout(() => {
        const el = document.getElementById(`rdv-${notif.rdvId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'background .3s';
          el.style.background = 'rgba(232,67,147,0.12)';
          setTimeout(() => { el.style.background = 'transparent'; }, 2000);
        }
      }, 300);
    }
  };

  return (
    <header style={{
      flexShrink: 0,
      position: 'relative', zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 22px',
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 20,
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
    }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 19, fontWeight: 700,
          color: 'var(--premium-text)',
          margin: 0, lineHeight: 1.15,
          letterSpacing: '-0.02em',
        }}>{pageInfo.title}</h1>
        {pageInfo.subtitle && (
          <p style={{
            fontSize: 11.5, color: 'var(--premium-text-3)',
            margin: '3px 0 0', lineHeight: 1.35,
            fontFamily: 'var(--font-display)',
            fontWeight: 450,
            letterSpacing: '-0.005em',
          }}>{pageInfo.subtitle}</p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* === SEARCH premium glass === */}
        <button
          onClick={() => openPalette()}
          style={{
            position: 'relative',
            width: 280, padding: '10px 52px 10px 36px',
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(28,25,23,0.06)',
            borderRadius: 12,
            fontFamily: 'inherit', fontSize: 12.5,
            color: 'var(--premium-text-4)',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all .18s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.borderColor = 'rgba(127,73,151,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(28,25,23,0.06)'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--premium-text-4)' }}>
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Rechercher…
          <kbd style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10, fontWeight: 600, color: 'var(--premium-text-4)',
            background: 'rgba(15,15,15,0.05)',
            border: '1px solid rgba(15,15,15,0.08)',
            padding: '2px 6px', borderRadius: 5,
            fontFamily: 'inherit',
            pointerEvents: 'none',
            letterSpacing: '0.3px',
          }}>⌘K</kbd>
        </button>

        <div style={{ width: 1, height: 24, background: 'rgba(28,25,23,0.08)' }} />

        {/* === Actualiser === */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span key={tick} style={{ fontSize: 10.5, color: 'var(--premium-text-4)', fontWeight: 500, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
            Mis à jour {formatLastRefresh(lastRefresh)}
          </span>
          <button onClick={handleRefresh} title="Actualiser les données"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36,
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(28,25,23,0.08)', borderRadius: 10,
              color: 'var(--premium-text-3)', cursor: 'pointer',
              transition: 'all .15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.borderColor = 'rgba(127,73,151,0.25)'; e.currentTarget.style.color = '#7f4997'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(28,25,23,0.08)'; e.currentTarget.style.color = 'var(--premium-text-3)'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: 'rgba(28,25,23,0.08)' }} />

        {/* v17.8 — INBOX : demandes des jeunes (RDV + formations) */}
        <NotifIconButton
          ariaTitle="Demandes des bénéficiaires"
          isOpen={inboxOpen}
          unread={inboxUnread}
          containerRef={inboxRef}
          onToggle={() => {
            const willOpen = !inboxOpen;
            setInboxOpen(willOpen);
            setBellOpen(false);
            // À l'ouverture, on marque comme lues TOUTES les notifs visibles
            // dans cette boîte (peu importe leur type sous-jacent).
            if (willOpen) {
              const ids = inboxNotifications.filter(n => !n.read).map(n => n.id);
              if (ids.length > 0) markIdsAsRead(ids);
            }
          }}
          icon={(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17, color: 'var(--premium-text-3)' }}>
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
          )}
          popoverTitle="Demandes des bénéficiaires"
          popoverSubtitle={inboxUnread > 0
            ? `${inboxUnread} non lue${inboxUnread > 1 ? 's' : ''}`
            : 'Aucune nouvelle demande'}
          notifications={inboxNotifications}
          emptyText="Aucune demande pour le moment"
          onNotifClick={handleNotifClick}
        />

        {/* v17.8 — CLOCHE : autres notifs (test terminé, etc.) */}
        <NotifIconButton
          ariaTitle="Autres notifications"
          isOpen={bellOpen}
          unread={bellUnread}
          containerRef={bellRef}
          onToggle={() => {
            const willOpen = !bellOpen;
            setBellOpen(willOpen);
            setInboxOpen(false);
            // Marque toutes les notifs visibles dans la cloche comme lues
            // (peu importe leur type — robuste aux types inconnus).
            if (willOpen) {
              const ids = bellNotifications.filter(n => !n.read).map(n => n.id);
              if (ids.length > 0) markIdsAsRead(ids);
            }
          }}
          icon={(
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17, color: 'var(--premium-text-3)' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          )}
          popoverTitle="Notifications"
          popoverSubtitle={bellUnread > 0
            ? `${bellUnread} non lue${bellUnread > 1 ? 's' : ''}`
            : 'Tout est à jour'}
          notifications={bellNotifications}
          emptyText="Aucune notification pour le moment"
          onNotifClick={handleNotifClick}
        />
      </div>
    </header>
  );
}

// =====================================================
// v17.8 — Bouton icône notif + popover, factorisé
// =====================================================

interface NotifIconButtonProps {
  ariaTitle: string;
  isOpen: boolean;
  unread: number;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  onToggle: () => void;
  icon: React.ReactNode;
  popoverTitle: string;
  popoverSubtitle: string;
  notifications: RdvNotification[];
  emptyText: string;
  onNotifClick: (n: RdvNotification) => void;
}

function NotifIconButton({
  ariaTitle, isOpen, unread, containerRef, onToggle, icon,
  popoverTitle, popoverSubtitle, notifications, emptyText, onNotifClick,
}: NotifIconButtonProps) {
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        title={ariaTitle}
        aria-label={ariaTitle}
        style={{
          position: 'relative', width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isOpen ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(28,25,23,0.08)', borderRadius: 10,
          cursor: 'pointer', transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.55)'; }}
      >
        {icon}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9,
            background: 'linear-gradient(135deg, #7f4997, #E84393)',
            color: '#ffffff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(232,67,147,0.35)',
            fontVariantNumeric: 'tabular-nums',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 360, maxHeight: 460,
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 10px 40px rgba(15,15,15,0.15), 0 2px 6px rgba(15,15,15,0.06)',
          border: '1px solid rgba(15,15,15,0.06)',
          overflow: 'hidden', zIndex: 50,
          display: 'flex', flexDirection: 'column',
          animation: 'stagger-in .18s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}>
          <div style={{
            padding: '13px 16px',
            borderBottom: '1px solid rgba(15,15,15,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>{popoverTitle}</div>
              <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 2 }}>{popoverSubtitle}</div>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 12 }}>
                {emptyText}
              </div>
            ) : (
              notifications.map(n => {
                const isFormation = n.type === 'formation_request';
                const isQuizDone = n.type === 'quiz_completed';
                const isProfileDone = n.type === 'profile_completed';
                const isAccepted = n.status === 'accepted';
                const isDeclined = n.status === 'declined';
                // Couleurs / emoji selon le type
                let pastilleBg = 'rgba(127,73,151,0.10)';
                let pastilleColor = '#7f4997';
                let pastilleEmoji = '📅';
                let verbe = 'a répondu';
                if (isFormation) { pastilleBg = 'rgba(232,67,147,0.12)'; pastilleColor = '#E84393'; pastilleEmoji = '📚'; verbe = "a envoyé une demande de formation"; }
                else if (isQuizDone) { pastilleBg = 'rgba(16,185,129,0.15)'; pastilleColor = '#047857'; pastilleEmoji = '🎯'; verbe = 'a terminé son test'; }
                else if (isProfileDone) { pastilleBg = 'rgba(59,130,246,0.12)'; pastilleColor = '#2563eb'; pastilleEmoji = '✨'; verbe = 'a finalisé son inscription'; }
                else if (isAccepted) { pastilleBg = 'rgba(16,185,129,0.15)'; pastilleColor = '#047857'; pastilleEmoji = '✅'; verbe = 'a accepté'; }
                else if (isDeclined) { pastilleBg = 'rgba(220,38,38,0.12)'; pastilleColor = '#dc2626'; pastilleEmoji = '❌'; verbe = 'a refusé'; }
                const ligneSecondaire = isFormation
                  ? (n.formationNom || null)
                  : (isQuizDone || isProfileDone) ? null
                  : (n.objet || null);
                return (
                  <button key={n.id} onClick={() => onNotifClick(n)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '12px 16px',
                      display: 'flex', gap: 11, alignItems: 'flex-start',
                      background: n.read ? '#ffffff' : 'rgba(127,73,151,0.04)',
                      border: 'none', borderBottom: '1px solid rgba(15,15,15,0.04)',
                      cursor: 'pointer', transition: 'background .12s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(127,73,151,0.07)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = n.read ? '#ffffff' : 'rgba(127,73,151,0.04)'; }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: pastilleBg, color: pastilleColor, fontSize: 16,
                    }}>{pastilleEmoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--premium-text)', letterSpacing: '-0.1px' }}>
                        {n.jeuneName || 'Un bénéficiaire'}{' '}
                        <span style={{ fontWeight: 500, color: 'var(--premium-text-3)' }}>{verbe}</span>
                      </div>
                      {ligneSecondaire && (
                        <div style={{ fontSize: 11, color: 'var(--premium-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ligneSecondaire}</div>
                      )}
                      <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 3 }}>
                        {formatNotifTime(n.createdAt)}
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #7f4997, #E84393)',
                        marginTop: 6,
                        boxShadow: '0 0 0 3px rgba(232,67,147,0.15)',
                      }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
