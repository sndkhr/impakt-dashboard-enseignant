'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type PageId = 'home' | 'jeunes' | 'alertes' | 'stats' | 'params' | 'aide';

interface NavContextType {
  currentPage: PageId;
  navigate: (page: PageId) => void;
  selectedUserIndex: number | null;
  selectedUserUid: string | null;
  openProfile: (uid: string) => void;
  closeProfile: () => void;
}

const NavContext = createContext<NavContextType | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);

  const navigate = useCallback((page: PageId) => {
    setCurrentPage(page);
    setSelectedUserIndex(null);
    setSelectedUserUid(null);
  }, []);

  const openProfile = useCallback((uid: string) => {
    setSelectedUserUid(uid);
    setSelectedUserIndex(null);
  }, []);

  const closeProfile = useCallback(() => {
    setSelectedUserIndex(null);
    setSelectedUserUid(null);
  }, []);

  return (
    <NavContext.Provider value={{ currentPage, navigate, selectedUserIndex, selectedUserUid, openProfile, closeProfile }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
