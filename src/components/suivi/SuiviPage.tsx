'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { useModals, isFilterActive } from '@/lib/modals';
import { User, ALERT_CONFIG, computeAlertLevel, computeParcoursStatus, formatNiveauEtudes, formatDateFr } from '@/types';
import { exportBeneficiairesCSV, exportBeneficiairesPDF } from '@/lib/export';
import { computeEngagementScore, computeCompositeScore, MOTIV_PALETTE } from '@/lib/motivationScore';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import KpiCard from '@/components/ui/KpiCard';
import { inscriptionsTrend, startedTrend, completedTrend } from '@/lib/trends';

const PER_PAGE = 7;

// Map filter eduLevel codes to actual niveauEtudes values
function matchEduFilter(niveauEtudes: string | undefined, filterCodes: string[]): boolean {
  if (filterCodes.length === 0) return true;
  if (!niveauEtudes) return false;
  const niv = niveauEtudes.toLowerCase();
  return filterCodes.some(code => {
    switch (code) {
      case 'sans': return niv.includes('sans') || niv === 'sans_diplome';
      case 'cap': return niv.includes('cap') || niv.includes('bep');
      case 'bac': return niv === 'bac' || niv === 'baccalauréat';
      case 'bac2': return niv === 'bac+2';
      case 'bac3': return niv === 'bac+3';
      case 'bac5': return niv === 'bac+5' || niv.includes('superieur');
      default: return false;
    }
  });
}

function matchGenderFilter(situation: string | undefined, genders: string[]): boolean {
  if (genders.length === 0) return true;
  if (!situation) return false;
  const sit = situation.toLowerCase();
  return genders.some(g => {
    if (g === 'H') return sit.includes('homme') || sit === 'h' || sit === 'm';
    if (g === 'F') return sit.includes('femme') || sit === 'f';
    return false;
  });
}

// Formatter la date d'activité avec heure (comme l'admin)
function formatActivite(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const month = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

// Niveau affiché comme l'admin (Term, 1ère, 2nde, Bac+3, etc.)
function formatNiveauAdmin(niveauEtudes?: string, classe?: string): string {
  if (classe) {
    const cl = classe.toLowerCase();
    if (cl.includes('term')) return 'Term';
    if (cl.includes('1') || cl.includes('prem')) return '1ère';
    if (cl.includes('2') || cl.includes('sec')) return '2nde';
    if (cl.includes('3')) return '3ème';
  }
  return formatNiveauEtudes(niveauEtudes);
}

export default function SuiviPage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const { openFilters, activeFilters, resetFilters } = useModals();
  const [search, setSearch] = useState('');
  // Tri par defaut : par date d'inscription DESCENDANTE (les plus recents en haut)
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  // Filtre rapide par niveau de motivation (pills à gauche)
  const [motivationFilter, setMotivationFilter] = useState<'all' | 'forte' | 'moderee' | 'faible'>('all');

  // v17.8 — On filtre les fiches "fantômes" (pas de nom ni prénom) qui
  // affichent des tirets partout dans le tableau et polluent visuellement.
  const users = useMemo(() => {
    const list = data?.recentUsers || [];
    return list.filter((u: User) => {
      const hasIdentite = (u.nom && u.nom.trim()) || (u.prenom && u.prenom.trim());
      return !!hasIdentite;
    });
  }, [data]);
  const hasActiveFilters = isFilterActive(activeFilters);

  // Enrichir avec les données calculées
  const enrichedUsers = useMemo(() => {
    return users.map((u: User, i: number) => {
      const status = computeParcoursStatus(u);
      const alertLvl = computeAlertLevel(u);
      const prog = u.quizProgress ?? 0;
      const dateStr = formatDateFr(u.inscriptionDate);
      const hasRdv = false;
      const gender = u.situation || '—';

      // Score motivation composite (60% journal + 40% engagement)
      const eng = computeEngagementScore(u);
      const motivScore = u.lastMotivationScore != null
        ? (computeCompositeScore(u.lastMotivationScore, eng.total) ?? eng.total)
        : eng.total;
      const motivLevel: 'forte' | 'moderee' | 'faible' =
        motivScore >= 70 ? 'forte' : motivScore >= 40 ? 'moderee' : 'faible';
      const hasJournal = u.lastMotivationScore != null;

      return { ...u, index: i, status, alertLvl, prog, dateStr, hasRdv, gender, motivScore, motivLevel, hasJournal };
    });
  }, [users]);

  // Compteurs par niveau de motivation (pour les badges des pills)
  const motivationCounts = useMemo(() => {
    const c = { forte: 0, moderee: 0, faible: 0 };
    enrichedUsers.forEach(u => { c[u.motivLevel]++; });
    return c;
  }, [enrichedUsers]);

  // Appliquer les filtres actifs (panel + filtre rapide motivation)
  const filteredByPanel = useMemo(() => {
    return enrichedUsers.filter(u => {
      // Filtre rapide motivation (pills à gauche)
      if (motivationFilter !== 'all' && u.motivLevel !== motivationFilter) return false;
      // Filtres panel
      if (!hasActiveFilters) return true;
      if (!matchGenderFilter(u.situation, activeFilters.genders)) return false;
      if (u.age != null) {
        if (u.age < activeFilters.ageMin || u.age > activeFilters.ageMax) return false;
      }
      if (!matchEduFilter(u.niveauEtudes, activeFilters.eduLevels)) return false;
      if (activeFilters.statuts.length > 0 && !activeFilters.statuts.includes(u.status)) return false;
      if (activeFilters.alertLevels.length > 0 && !activeFilters.alertLevels.includes(u.alertLvl)) return false;
      return true;
    });
  }, [enrichedUsers, activeFilters, hasActiveFilters, motivationFilter]);

  // Puis filtre par recherche texte
  const filtered = useMemo(() => {
    if (!search.trim()) return filteredByPanel;
    const q = search.toLowerCase();
    return filteredByPanel.filter(u =>
      (u.nom || '').toLowerCase().includes(q) || (u.prenom || '').toLowerCase().includes(q)
    );
  }, [filteredByPanel, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      switch (sortField) {
        case 'name': va = (a.nom || '').toLowerCase(); vb = (b.nom || '').toLowerCase(); break;
        case 'prenom': va = (a.prenom || '').toLowerCase(); vb = (b.prenom || '').toLowerCase(); break;
        case 'age': va = a.age || 0; vb = b.age || 0; break;
        case 'situation': va = (a.situation || '').toLowerCase(); vb = (b.situation || '').toLowerCase(); break;
        case 'motivation': va = a.motivScore; vb = b.motivScore; break;
        case 'date': va = new Date(a.inscriptionDate || 0).getTime(); vb = new Date(b.inscriptionDate || 0).getTime(); break;
        case 'activite': va = new Date(a.lastActive || 0).getTime(); vb = new Date(b.lastActive || 0).getTime(); break;
        case 'prog': va = a.prog; vb = b.prog; break;
        case 'alert': {
          const order: Record<string, number> = { decroch: 0, bloque: 1, non: 2, cours: 3, ok: 4 };
          va = order[a.alertLvl] ?? 3; vb = order[b.alertLvl] ?? 3; break;
        }
      }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filtered, sortField, sortAsc]);

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return sorted.slice(start, start + PER_PAGE);
  }, [sorted, page]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
    setPage(1);
  };

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const sortArrow = (field: string) => sortField === field ? (sortAsc ? ' ↑' : ' ↓') : '';

  // KPIs computed from users — AVANT le early return pour respecter les règles des hooks
  const enriched = useMemo(() => (data?.recentUsers || []).map(u => ({ ...u, alertLvl: computeAlertLevel(u) })), [data]);
  const totalUsers = data?.totalUsers ?? enriched.length;
  const okCount = enriched.filter(u => u.alertLvl === 'ok').length;
  const coursCount = enriched.filter(u => u.alertLvl === 'cours').length;
  const nonCount = enriched.filter(u => u.alertLvl === 'non').length;
  const alertCount = enriched.filter(u => u.alertLvl === 'bloque' || u.alertLvl === 'decroch').length;

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* === KPIs en haut avec sparklines + deltas (matche admin B2CUsers) === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {(() => {
          const users = data?.recentUsers || [];
          const trInsc = inscriptionsTrend(users, 7);
          const trStarted = startedTrend(users, 7);
          const trCompleted = completedTrend(users, 7);
          return (
            <>
              <KpiCard index={0} title="Inscrits" value={totalUsers} gradient trend={trInsc.series} delta={trInsc.delta} />
              <KpiCard index={1} title="En bonne voie" value={okCount} sub={`${totalUsers > 0 ? Math.round((okCount / totalUsers) * 100) : 0}% du total`} trend={trCompleted.series} />
              <KpiCard index={2} title="En cours" value={coursCount} sub={`${totalUsers > 0 ? Math.round((coursCount / totalUsers) * 100) : 0}% du total`} trend={trStarted.series} />
              <KpiCard index={3} title="Non démarrés" value={nonCount} sub={`${totalUsers > 0 ? Math.round((nonCount / totalUsers) * 100) : 0}% du total`} />
              <KpiCard index={4} title="En alerte" value={alertCount} sub={`${totalUsers > 0 ? Math.round((alertCount / totalUsers) * 100) : 0}% du total`} />
            </>
          );
        })()}
      </div>

      {/* === Card glass unique : toolbar + tableau (comme admin B2CUsers) === */}
      <div style={{
        background: 'rgba(255,255,255,0.52)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 22,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.04), inset 0 1px 0 rgba(255,255,255,0.85)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Toolbar DANS la card avec borderBottom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid rgba(15,15,15,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="text" placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => handleSearch(e.target.value)}
              style={{ padding: '9px 14px 9px 34px', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(28,25,23,0.08)', borderRadius: 10, fontFamily: 'inherit', fontSize: '12.5px', color: 'var(--premium-text)', outline: 'none', width: 280, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='6' cy='6' r='5'/%3E%3Cline x1='10' y1='10' x2='13' y2='13'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: '12px center' }} />
            {/* Pills filtre rapide motivation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {([
                { id: 'all',     label: 'Tous',    count: enrichedUsers.length,        dot: '#a3a3a3', text: '#737373', rgb: '163, 163, 163' },
                { id: 'forte',   label: 'Forte',   count: motivationCounts.forte,      ...MOTIV_PALETTE.forte },
                { id: 'moderee', label: 'Modérée', count: motivationCounts.moderee,    ...MOTIV_PALETTE.moderee },
                { id: 'faible',  label: 'Faible',  count: motivationCounts.faible,     ...MOTIV_PALETTE.faible },
              ] as const).map(p => {
                const active = motivationFilter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setMotivationFilter(p.id)}
                    title={p.id === 'all' ? `Voir tous les utilisateurs (${p.count})` : `Filtrer : motivation ${p.label.toLowerCase()} (${p.count})`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: 999,
                      background: active
                        ? `linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 100%), rgba(${p.rgb}, 0.14)`
                        : 'rgba(255,255,255,0.4)',
                      backdropFilter: 'blur(18px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                      boxShadow: active
                        ? `inset 0 1px 0.5px rgba(255,255,255,0.85), 0 1px 2px rgba(15,15,15,0.04), 0 4px 12px rgba(${p.rgb}, 0.18)`
                        : 'inset 0 1px 0.5px rgba(255,255,255,0.7)',
                      fontFamily: 'inherit', fontSize: 11.5, fontWeight: active ? 600 : 500,
                      color: active ? p.text : 'var(--premium-text-3)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all .15s ease',
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.6)'; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.4)'; }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: p.dot,
                      boxShadow: active ? `0 0 8px ${p.dot}99` : 'none',
                    }} />
                    {p.label}
                    <span style={{ fontWeight: 700, color: active ? p.text : 'var(--premium-text-4)', fontVariantNumeric: 'tabular-nums' }}>
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {hasActiveFilters && (
              <button onClick={resetFilters} style={{
                padding: '5px 12px', border: '1px solid #E84393', borderRadius: 8,
                background: 'rgba(232,67,147,0.10)', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                color: '#E84393', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                ✕ Effacer les filtres
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => exportBeneficiairesCSV(data?.recentUsers || [])} style={{ padding: '7px 14px', border: '1px solid rgba(28,25,23,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 500, color: 'var(--premium-text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              CSV
            </button>
            <button onClick={() => exportBeneficiairesPDF(data?.recentUsers || [])} style={{ padding: '7px 14px', border: '1px solid rgba(28,25,23,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 500, color: 'var(--premium-text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              PDF
            </button>
            <div onClick={openFilters} style={{
              width: 34, height: 34, border: hasActiveFilters ? '1.5px solid #E84393' : '1px solid rgba(28,25,23,0.08)',
              borderRadius: 8, background: hasActiveFilters ? 'rgba(232,67,147,0.10)' : 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              position: 'relative',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 16, height: 16, color: hasActiveFilters ? '#E84393' : 'var(--premium-text-4)' }}>
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              </svg>
              {hasActiveFilters && (
                <div style={{
                  position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%',
                  background: '#E84393', color: '#fff', fontSize: 8, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {[activeFilters.genders.length > 0, activeFilters.eduLevels.length > 0, activeFilters.statuts.length > 0, activeFilters.alertLevels.length > 0, activeFilters.ageMin !== 15 || activeFilters.ageMax !== 26].filter(Boolean).length}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table DANS la card glass */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={thStyle}>Nom{sortArrow('name')}</th>
                <th onClick={() => handleSort('prenom')} style={thStyle}>Prénom{sortArrow('prenom')}</th>
                <th onClick={() => handleSort('age')} style={{ ...thStyle, textAlign: 'center' }}>Âge{sortArrow('age')}</th>
                <th onClick={() => handleSort('motivation')} style={thStyle}>Motivation{sortArrow('motivation')}</th>
                <th style={thStyle}>Niveau</th>
                <th onClick={() => handleSort('date')} style={thStyle}>Inscription{sortArrow('date')}</th>
                <th onClick={() => handleSort('activite')} style={thStyle}>Activité{sortArrow('activite')}</th>
                <th onClick={() => handleSort('prog')} style={thStyle}>Progrès{sortArrow('prog')}</th>
                <th onClick={() => handleSort('alert')} style={thStyle}>Statut{sortArrow('alert')}</th>
                <th style={thStyle}>Ville</th>
                <th style={{ ...thStyle, cursor: 'default' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 13 }}>
                    Aucun bénéficiaire ne correspond aux filtres sélectionnés
                  </td>
                </tr>
              ) : paginated.map((u) => {
                const alertConf = ALERT_CONFIG[u.alertLvl];
                return (
                  <tr key={u.uid || u.index} onClick={() => openProfile(u.uid)} style={{ cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--premium-text)' }}>{u.nom || '—'}</td>
                    <td style={tdStyle}>{u.prenom || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{u.age || '—'}</td>
                    <td style={tdStyle}>
                      {(() => {
                        const palette = MOTIV_PALETTE[u.motivLevel];
                        const label = u.motivLevel === 'forte' ? 'Forte' : u.motivLevel === 'moderee' ? 'Modérée' : 'Faible';
                        const score = Math.max(0, Math.min(100, u.motivScore));
                        return (
                          <div
                            title={u.hasJournal
                              ? `Score composite (journal + engagement) : ${u.motivScore}/100`
                              : `Score d'engagement seul (pas encore de journal) : ${u.motivScore}/100`}
                            style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110, maxWidth: 130 }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, lineHeight: 1 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: palette.text, letterSpacing: '-0.1px' }}>{label}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--premium-text-3)', fontVariantNumeric: 'tabular-nums' }}>{u.motivScore}</span>
                            </div>
                            <div style={{
                              height: 6,
                              borderRadius: 999,
                              background: 'rgba(255,255,255,0.5)',
                              backdropFilter: 'blur(12px) saturate(160%)',
                              WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                              boxShadow: 'inset 0 1px 1.5px rgba(15,15,15,0.06), inset 0 0 0 0.5px rgba(255,255,255,0.6)',
                              overflow: 'hidden',
                              position: 'relative',
                            }}>
                              <div style={{
                                width: `${score}%`,
                                height: '100%',
                                borderRadius: 999,
                                background: `linear-gradient(90deg, ${palette.gradient})`,
                                boxShadow: `0 0 8px rgba(${palette.rgb}, 0.55), inset 0 1px 0.5px rgba(255,255,255,0.6)`,
                                transition: 'width 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
                              }} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={tdStyle}>{formatNiveauAdmin(u.niveauEtudes, u.classe)}</td>
                    <td style={tdStyle}>{u.dateStr}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--premium-text-4)' }}>{formatActivite(u.lastActive)}</td>
                    <td style={tdStyle}><ProgressBar value={u.prog} /></td>
                    <td style={tdStyle}><Badge label={alertConf.label} className={alertConf.className} /></td>
                    <td style={tdStyle}>{u.ville || '—'}</td>
                    <td style={tdStyle}>
                      <button onClick={(e) => { e.stopPropagation(); openProfile(u.uid); }}
                        style={{ fontSize: 11, padding: '5px 12px', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8, background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontWeight: 500, color: 'var(--premium-text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Voir ›
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'transparent' }}>
            <span style={{ fontSize: 12, color: 'var(--premium-text-4)' }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, sorted.length)} sur {sorted.length}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 12px', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8, background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: page === 1 ? 'var(--text-300)' : 'var(--text-700)', cursor: page === 1 ? 'default' : 'pointer' }}>
                ‹ Précédent
              </button>
              {/* v17.8 — Pagination compacte : 1 ... 4 5 [6] 7 8 ... 25 */}
              {(() => {
                const items: (number | 'gap')[] = [];
                const window = 1; // pages avant et après la page courante
                const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
                if (totalPages <= 7) {
                  items.push(...range(1, totalPages));
                } else {
                  const start = Math.max(2, page - window);
                  const end = Math.min(totalPages - 1, page + window);
                  items.push(1);
                  if (start > 2) items.push('gap');
                  items.push(...range(start, end));
                  if (end < totalPages - 1) items.push('gap');
                  items.push(totalPages);
                }
                return items.map((p, idx) => p === 'gap' ? (
                  <span key={`gap-${idx}`} style={{ width: 22, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--premium-text-4)', fontSize: 12 }}>…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    style={{ width: 32, height: 32, border: p === page ? 'none' : '1px solid var(--border)', borderRadius: 8, background: p === page ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'var(--white)', color: p === page ? '#fff' : 'var(--text-700)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p}
                  </button>
                ));
              })()}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 12px', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8, background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: page === totalPages ? 'var(--text-300)' : 'var(--text-700)', cursor: page === totalPages ? 'default' : 'pointer' }}>
                Suivant ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '12px 12px', fontSize: 10.5, fontWeight: 600, color: 'var(--premium-text-4)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '1px solid var(--border)', background: 'transparent', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '12px', color: 'var(--premium-text-2)', borderBottom: '1px solid rgba(15,15,15,0.04)', verticalAlign: 'middle', whiteSpace: 'nowrap' };
