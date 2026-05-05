'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User } from '@/types';

export type PageId = 'home' | 'jeunes' | 'alertes' | 'avenirs' | 'stats' | 'suggestions' | 'messagerie' | 'params' | 'aide';

export interface PreparingRdv {
  name: string;
  at: Date;
  type: string;
  location?: string;
  user: User | null;
}

interface NavContextType {
  currentPage: PageId;
  navigate: (page: PageId) => void;
  selectedUserIndex: number | null;
  selectedUserUid: string | null;
  /// v17.8 — Onglet à pré-sélectionner sur la fiche utilisateur quand
  /// on l'ouvre depuis un point d'entrée précis (ex: clic sur une demande
  /// de formation → onglet 'parcours' directement).
  profileDefaultTab: string | null;
  openProfile: (uid: string, defaultTab?: string) => void;
  closeProfile: () => void;
  // === RDV briefing mode (vue pleine page qui remplace le main content) ===
  preparingRdv: PreparingRdv | null;
  startPreparingRdv: (rdv: PreparingRdv) => void;
  stopPreparingRdv: () => void;
}

const NavContext = createContext<NavContextType | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);
  const [profileDefaultTab, setProfileDefaultTab] = useState<string | null>(null);
  const [preparingRdv, setPreparingRdv] = useState<PreparingRdv | null>(null);

  const navigate = useCallback((page: PageId) => {
    setCurrentPage(page);
    setSelectedUserIndex(null);
    setSelectedUserUid(null);
    setProfileDefaultTab(null);
    setPreparingRdv(null);
  }, []);

  const openProfile = useCallback((uid: string, defaultTab?: string) => {
    setSelectedUserUid(uid);
    setSelectedUserIndex(null);
    setProfileDefaultTab(defaultTab || null);
    setPreparingRdv(null);
  }, []);

  const closeProfile = useCallback(() => {
    setSelectedUserIndex(null);
    setSelectedUserUid(null);
    setProfileDefaultTab(null);
  }, []);

  const startPreparingRdv = useCallback((rdv: PreparingRdv) => {
    setPreparingRdv(rdv);
  }, []);

  const stopPreparingRdv = useCallback(() => {
    setPreparingRdv(null);
  }, []);

  return (
    <NavContext.Provider value={{
      currentPage, navigate,
      selectedUserIndex, selectedUserUid, profileDefaultTab, openProfile, closeProfile,
      preparingRdv, startPreparingRdv, stopPreparingRdv,
    }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
