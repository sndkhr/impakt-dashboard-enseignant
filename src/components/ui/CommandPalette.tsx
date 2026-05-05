'use client';

import { useEffect, useMemo, useRef, useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav, PageId } from '@/lib/navigation';
import { User } from '@/types';

/* ============================================================
   COMMAND PALETTE — style Linear / Raycast / Vercel
   Ouvre avec Cmd+K (Mac) / Ctrl+K (Windows) ou "/" pour recherche
   Recherche globale : utilisateurs + pages + actions
   Navigation clavier : ↑ ↓ Enter Esc
   ============================================================ */

interface CommandItem {
  id: string;
  label: string;
  hint?: string;              // sub-text (ex: "Ouvrir profil · Martin Dupont")
  icon?: ReactNode;
  section: 'navigation' | 'users' | 'actions';
  keywords?: string;          // pour fuzzy match
  shortcut?: string;          // ex: "⌘H"
  onSelect: () => void;
}

interface CommandPaletteCtx {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const CommandPaletteContext = createContext<CommandPaletteCtx | null>(null);

export function useCommandPalette(): CommandPaletteCtx {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) return { open: () => {}, close: () => {}, isOpen: false };
  return ctx;
}

// === Fuzzy score (simple : all chars must appear in order) ===
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 10 - t.indexOf(q) * 0.01; // exact substring = best, earlier = better
  let qi = 0, score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { score += 1; qi++; }
  }
  return qi === q.length ? score / t.length : 0;
}

// === Icones ===
const Icons = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  sparkle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  help: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
};

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Raccourci global ⌘K / Ctrl+K — aussi "/" quand on est pas deja dans un input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      // Cmd+K ou Ctrl+K (fonctionne meme dans un input)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(v => !v);
        return;
      }
      // "/" pour ouvrir quand pas dans un input
      if (e.key === '/' && !inInput && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      // Echap pour fermer
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <CommandPaletteContext.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && <CommandPaletteModal onClose={close} />}
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const { data } = useAuth();
  const { navigate, openProfile } = useNav();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input a l'ouverture + scroll lock
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const users = useMemo(() => data?.recentUsers || [], [data]);

  // === Construction de la liste des commandes ===
  const allCommands: CommandItem[] = useMemo(() => {
    const cmds: CommandItem[] = [];

    // --- Navigation ---
    const navItems: { id: PageId; label: string; icon: ReactNode; shortcut: string }[] = [
      { id: 'home', label: 'Accueil', icon: Icons.home, shortcut: 'G H' },
      { id: 'jeunes', label: 'Utilisateurs', icon: Icons.users, shortcut: 'G U' },
      { id: 'alertes', label: 'Rendez-vous', icon: Icons.calendar, shortcut: 'G R' },
      { id: 'suggestions', label: 'Suggestions', icon: Icons.sparkle, shortcut: 'G S' },
      { id: 'stats', label: 'Statistiques', icon: Icons.chart, shortcut: 'G A' },
      { id: 'params', label: 'Paramètres', icon: Icons.settings, shortcut: 'G P' },
      { id: 'aide', label: 'Aide', icon: Icons.help, shortcut: 'G ?' },
    ];
    navItems.forEach(n => {
      cmds.push({
        id: `nav-${n.id}`,
        label: n.label,
        hint: 'Aller sur la page',
        icon: n.icon,
        section: 'navigation',
        keywords: `${n.label} ${n.id} page section`,
        shortcut: n.shortcut,
        onSelect: () => { navigate(n.id); onClose(); },
      });
    });

    // --- Utilisateurs (top 50) ---
    users.slice(0, 50).forEach((u: User) => {
      if (!u.uid) return;
      const name = `${u.prenom || ''} ${u.nom || ''}`.trim() || 'Sans nom';
      cmds.push({
        id: `user-${u.uid}`,
        label: name,
        hint: u.email || 'Ouvrir le profil',
        icon: Icons.user,
        section: 'users',
        keywords: `${name} ${u.email || ''} ${u.prenom || ''} ${u.nom || ''}`,
        onSelect: () => { if (u.uid) { openProfile(u.uid); onClose(); } },
      });
    });

    // --- Actions rapides ---
    cmds.push({
      id: 'action-priorites',
      label: 'Voir les priorités du jour',
      hint: 'Ouvrir le tableau des suggestions',
      icon: Icons.bell,
      section: 'actions',
      keywords: 'priorite action suggestion relance debloquer inviter',
      onSelect: () => { navigate('suggestions'); onClose(); },
    });
    cmds.push({
      id: 'action-rdv',
      label: 'Planifier un RDV',
      hint: 'Ouvrir la page Rendez-vous',
      icon: Icons.calendar,
      section: 'actions',
      keywords: 'rdv rendez-vous planifier entretien',
      onSelect: () => { navigate('alertes'); onClose(); },
    });

    return cmds;
  }, [users, navigate, openProfile, onClose]);

  // === Filtrage + tri par score fuzzy ===
  const results = useMemo(() => {
    if (!query.trim()) {
      // Pas de query : top navigation + 5 actions + 3 user recents
      const nav = allCommands.filter(c => c.section === 'navigation');
      const actions = allCommands.filter(c => c.section === 'actions');
      const recentUsers = allCommands.filter(c => c.section === 'users').slice(0, 3);
      return [...nav, ...actions, ...recentUsers];
    }
    // Score fuzzy + filtre > 0
    return allCommands
      .map(c => ({ c, score: Math.max(fuzzyScore(query, c.label), fuzzyScore(query, c.keywords || '')) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(x => x.c);
  }, [query, allCommands]);

  // Groupement par section
  const grouped = useMemo(() => {
    const g: Record<string, CommandItem[]> = { navigation: [], users: [], actions: [] };
    results.forEach(c => g[c.section].push(c));
    return g;
  }, [results]);

  // Reset activeIdx quand la query change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll la row active dans le viewport
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // === Navigation clavier ===
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); results[activeIdx]?.onSelect(); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [activeIdx, results]);

  const sectionLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions rapides',
    users: 'Utilisateurs',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(15,15,15,0.42)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'fadeIn .15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 640, maxWidth: '92vw',
          maxHeight: '70vh',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(32px) saturate(150%)',
          WebkitBackdropFilter: 'blur(32px) saturate(150%)',
          border: '1px solid rgba(255,255,255,0.85)',
          borderRadius: 18,
          boxShadow: '0 32px 80px rgba(15,15,15,0.22), 0 8px 24px rgba(15,15,15,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-display)',
          animation: 'stagger-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          overflow: 'hidden',
        }}
      >
        {/* Input search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(15,15,15,0.06)',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, color: '#7f4997', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un jeune, une page, une action…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 14, fontWeight: 500,
              color: 'var(--premium-text)',
              letterSpacing: '-0.1px',
            }}
          />
          <kbd style={{
            fontSize: 10, fontWeight: 600,
            padding: '3px 7px', borderRadius: 5,
            background: 'rgba(15,15,15,0.05)',
            border: '1px solid rgba(15,15,15,0.08)',
            color: 'var(--premium-text-3)',
            fontFamily: 'inherit',
            letterSpacing: '0.3px',
          }}>ESC</kbd>
        </div>

        {/* Liste resultats */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {results.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 12.5 }}>
              Aucun résultat pour &ldquo;{query}&rdquo;
            </div>
          ) : (
            (['navigation', 'actions', 'users'] as const).map(sec => {
              const items = grouped[sec];
              if (!items.length) return null;
              return (
                <div key={sec} style={{ marginBottom: 4 }}>
                  <div style={{
                    padding: '6px 18px 4px',
                    fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.5px', color: 'var(--premium-text-4)',
                  }}>{sectionLabels[sec]}</div>
                  {items.map(cmd => {
                    const idx = results.indexOf(cmd);
                    const active = idx === activeIdx;
                    return (
                      <div
                        key={cmd.id}
                        data-idx={idx}
                        onClick={() => cmd.onSelect()}
                        onMouseEnter={() => setActiveIdx(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '8px 18px',
                          cursor: 'pointer',
                          background: active
                            ? 'linear-gradient(90deg, rgba(127,73,151,0.08), rgba(232,67,147,0.08))'
                            : 'transparent',
                          borderLeft: active ? '2px solid #E84393' : '2px solid transparent',
                          paddingLeft: active ? 16 : 18,
                          transition: 'all .12s ease',
                        }}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: 7,
                          background: active ? 'linear-gradient(135deg, rgba(127,73,151,0.12), rgba(232,67,147,0.12))' : 'rgba(15,15,15,0.04)',
                          color: active ? '#7f4997' : 'var(--premium-text-3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          border: active ? '1px solid rgba(127,73,151,0.20)' : '1px solid rgba(15,15,15,0.06)',
                          transition: 'all .12s',
                        }}>
                          {cmd.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 12.5, fontWeight: 600,
                            color: active ? 'var(--premium-text)' : 'var(--premium-text-2)',
                            letterSpacing: '-0.1px',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{cmd.label}</div>
                          {cmd.hint && (
                            <div style={{
                              fontSize: 10.5, color: 'var(--premium-text-4)',
                              marginTop: 1,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{cmd.hint}</div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd style={{
                            fontSize: 9.5, fontWeight: 600,
                            padding: '3px 6px', borderRadius: 4,
                            background: 'rgba(15,15,15,0.04)',
                            border: '1px solid rgba(15,15,15,0.07)',
                            color: 'var(--premium-text-3)',
                            fontFamily: 'inherit', flexShrink: 0,
                            letterSpacing: '0.3px',
                          }}>{cmd.shortcut}</kbd>
                        )}
                        {active && !cmd.shortcut && (
                          <div style={{ color: '#7f4997', flexShrink: 0 }}>{Icons.arrow}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer raccourcis */}
        <div style={{
          padding: '9px 18px',
          borderTop: '1px solid rgba(15,15,15,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 10, color: 'var(--premium-text-4)',
          background: 'rgba(15,15,15,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <KbdMini>↑</KbdMini><KbdMini>↓</KbdMini> Naviguer
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <KbdMini>↵</KbdMini> Sélectionner
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <KbdMini>⌘</KbdMini><KbdMini>K</KbdMini> Command palette
          </div>
        </div>
      </div>
    </div>
  );
}

function KbdMini({ children }: { children: ReactNode }) {
  return (
    <kbd style={{
      fontSize: 9.5, fontWeight: 600,
      padding: '2px 5px', borderRadius: 3,
      background: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(15,15,15,0.1)',
      color: 'var(--premium-text-3)',
      fontFamily: 'inherit', minWidth: 16, textAlign: 'center',
      display: 'inline-block',
    }}>{children}</kbd>
  );
}
