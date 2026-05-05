'use client';

import { useNav } from '@/lib/navigation';
import HomePage from '@/components/dashboard/HomePage';
import SuiviPage from '@/components/suivi/SuiviPage';
import ProfilePage from '@/components/profile/ProfilePage';
import RdvPage from '@/components/rdv/RdvPage';
import StatsPage from '@/components/stats/StatsPage';
import SuggestionsPage from '@/components/suggestions/SuggestionsPage';
import MessageriePage from '@/components/messagerie/MessageriePage';
import SettingsPage from '@/components/settings/SettingsPage';
import AidePage from '@/components/aide/AidePage';
import AvenirsPage from '@/components/avenirs/AvenirsPage';

export default function PageRouter() {
  const { currentPage, selectedUserIndex, selectedUserUid } = useNav();

  // Si un profil est sélectionné, on affiche la fiche bénéficiaire
  if (selectedUserIndex !== null || selectedUserUid !== null) {
    return <ProfilePage />;
  }

  switch (currentPage) {
    case 'home':
      return <HomePage />;
    case 'jeunes':
      return <SuiviPage />;
    case 'alertes':
      return <RdvPage />;
    case 'stats':
      return <StatsPage />;
    case 'suggestions':
      return <SuggestionsPage />;
    case 'messagerie':
      return <MessageriePage />;
    case 'avenirs':
      return <AvenirsPage />;
    case 'params':
      return <SettingsPage />;
    case 'aide':
      return <AidePage />;
    default:
      return <HomePage />;
  }
}
