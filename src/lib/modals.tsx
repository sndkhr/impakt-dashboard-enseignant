'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface FilterState {
  genders: string[];
  ageMin: number;
  ageMax: number;
  eduLevels: string[];
  statuts: string[];
  alertLevels: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  genders: [],
  ageMin: 15, ageMax: 26,
  eduLevels: [],
  statuts: [],
  alertLevels: [],
};

export function isFilterActive(f: FilterState): boolean {
  return (
    f.genders.length > 0 ||
    f.eduLevels.length > 0 ||
    f.statuts.length > 0 ||
    f.alertLevels.length > 0 ||
    f.ageMin !== DEFAULT_FILTERS.ageMin ||
    f.ageMax !== DEFAULT_FILTERS.ageMax
  );
}

// v17.7.30 — Données pré-remplies pour ouvrir le modal en mode édition
export interface EditingRdv {
  id: string;
  jeuneUid?: string;
  jeuneName?: string;
  dateTime: string;     // ISO
  location: string;
  objet: string;
  notes?: string;
}

interface ModalsContextType {
  // Planifier un échange
  exchangeOpen: boolean;
  editingRdv: EditingRdv | null;
  openExchange: (editing?: EditingRdv) => void;
  closeExchange: () => void;
  // Signaler un problème
  bugOpen: boolean;
  openBug: () => void;
  closeBug: () => void;
  // Filtres
  filtersOpen: boolean;
  openFilters: () => void;
  closeFilters: () => void;
  // État des filtres actifs
  activeFilters: FilterState;
  applyFilters: (f: FilterState) => void;
  resetFilters: () => void;
}

const ModalsContext = createContext<ModalsContextType | null>(null);

export function ModalsProvider({ children }: { children: ReactNode }) {
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [editingRdv, setEditingRdv] = useState<EditingRdv | null>(null);
  const [bugOpen, setBugOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });

  const openExchange = useCallback((editing?: EditingRdv) => {
    setEditingRdv(editing || null);
    setExchangeOpen(true);
  }, []);
  const closeExchange = useCallback(() => {
    setExchangeOpen(false);
    setEditingRdv(null);
  }, []);
  const openBug = useCallback(() => setBugOpen(true), []);
  const closeBug = useCallback(() => setBugOpen(false), []);
  const openFilters = useCallback(() => setFiltersOpen(true), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const applyFilters = useCallback((f: FilterState) => setActiveFilters(f), []);
  const resetFilters = useCallback(() => setActiveFilters({ ...DEFAULT_FILTERS }), []);

  return (
    <ModalsContext.Provider value={{
      exchangeOpen, editingRdv, openExchange, closeExchange,
      bugOpen, openBug, closeBug,
      filtersOpen, openFilters, closeFilters,
      activeFilters, applyFilters, resetFilters,
    }}>
      {children}
    </ModalsContext.Provider>
  );
}

export function useModals() {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error('useModals must be used within ModalsProvider');
  return ctx;
}
