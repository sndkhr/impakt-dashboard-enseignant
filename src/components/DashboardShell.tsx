'use client';

import { useAuth } from '@/lib/auth';
import { useModals } from '@/lib/modals';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import PageRouter from '@/components/PageRouter';
import { ExchangeModal, BugModal } from '@/components/modals/Modals';
import FilterPanel from '@/components/modals/FilterPanel';

export default function DashboardShell() {
  const { data } = useAuth();
  const { exchangeOpen, closeExchange, bugOpen, closeBug, filtersOpen, closeFilters } = useModals();

  const users = data?.recentUsers || [];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar rdvBadge={3} />
      <main style={{ marginLeft: 'var(--sidebar-w)', flex: 1 }}>
        <Topbar />
        <div style={{ padding: '16px 20px', background: 'var(--bg)', minHeight: 'calc(100vh - 52px)' }}>
          <PageRouter />
        </div>
      </main>

      {/* Modales globales */}
      <ExchangeModal open={exchangeOpen} onClose={closeExchange} users={users} />
      <BugModal open={bugOpen} onClose={closeBug} />
      <FilterPanel open={filtersOpen} onClose={closeFilters} onApply={(f) => console.log('Filters applied:', f)} />
    </div>
  );
}
