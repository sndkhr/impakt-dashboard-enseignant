'use client';

import { useAuth } from '@/lib/auth';
import { useModals } from '@/lib/modals';
import { useRdvNotifications } from '@/lib/useBackendRdvs';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import PageRouter from '@/components/PageRouter';
import { ExchangeModal, BugModal } from '@/components/modals/Modals';
import FilterPanel from '@/components/modals/FilterPanel';

export default function DashboardShell() {
  const { data } = useAuth();
  const { exchangeOpen, closeExchange, bugOpen, closeBug, filtersOpen, closeFilters } = useModals();
  // v17.8 — Le badge sidebar "Rendez-vous" ne compte QUE les notifs RDV
  // (pas les formation_request qui ont leur propre section).
  const { unreadRdvCount } = useRdvNotifications();

  const users = data?.recentUsers || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', background: 'var(--bg)' }}>
      <div className="premium-sphere s1" />
      <div className="premium-sphere s2" />
      <div className="premium-sphere s3" />

      <Sidebar rdvBadge={unreadRdvCount} />

      <main style={{
        marginLeft: 'calc(var(--sidebar-w) + 32px)',
        paddingRight: 16, paddingTop: 16, paddingBottom: 16,
        flex: 1, minHeight: '100vh',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}>
        <Topbar />
        <div style={{
          padding: '16px 0',
          flex: 1, minWidth: 0, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          position: 'relative', zIndex: 5,
        }}>
          {/* La fiche beneficiaire (ProfilePage) sert maintenant aussi de "Preparer RDV"
              — la banniere RDV dynamique apparait quand un RDV est detecte */}
          <PageRouter />
        </div>
      </main>

      <ExchangeModal open={exchangeOpen} onClose={closeExchange} users={users} />
      <BugModal open={bugOpen} onClose={closeBug} />
      <FilterPanel open={filtersOpen} onClose={closeFilters} onApply={(f) => console.log('Filters applied:', f)} />
    </div>
  );
}
