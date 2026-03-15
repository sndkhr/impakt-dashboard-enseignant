'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { useModals, isFilterActive } from '@/lib/modals';
import { User, ALERT_CONFIG, computeAlertLevel, computeParcoursStatus, formatDateFr } from '@/types';
import { exportBeneficiairesCSV, exportBeneficiairesPDF } from '@/lib/export';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';

const PER_PAGE = 15;

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



export default function SuiviPage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const { openFilters, activeFilters, resetFilters } = useModals();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('activite');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  const users = useMemo(() => data?.recentUsers || [], [data]);
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

      return { ...u, index: i, status, alertLvl, prog, dateStr, hasRdv, gender };
    });
  }, [users]);

  // Appliquer les filtres actifs
  const filteredByPanel = useMemo(() => {
    if (!hasActiveFilters) return enrichedUsers;

    return enrichedUsers.filter(u => {
      if (!matchGenderFilter(u.situation, activeFilters.genders)) return false;
      if (u.age != null) {
        if (u.age < activeFilters.ageMin || u.age > activeFilters.ageMax) return false;
      }
      if (!matchEduFilter(u.niveauEtudes, activeFilters.eduLevels)) return false;
      if (activeFilters.statuts.length > 0 && !activeFilters.statuts.includes(u.status)) return false;
      if (activeFilters.alertLevels.length > 0 && !activeFilters.alertLevels.includes(u.alertLvl)) return false;
      return true;
    });
  }, [enrichedUsers, activeFilters, hasActiveFilters]);

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

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-900)', margin: 0 }}>Suivi</h1>
        <p style={{ fontSize: 12, color: 'var(--text-400)', margin: '4px 0 0' }}>Liste complète de tous les élèves inscrits.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="text" placeholder="Rechercher un élève..." value={search} onChange={(e) => handleSearch(e.target.value)}
            style={{ padding: '9px 14px 9px 34px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, fontFamily: 'inherit', fontSize: '12.5px', color: 'var(--text-900)', outline: 'none', width: 280, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='6' cy='6' r='5'/%3E%3Cline x1='10' y1='10' x2='13' y2='13'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: '12px center' }} />
          <span style={{ fontSize: 12, color: 'var(--text-400)', fontWeight: 500 }}>{sorted.length} élèves</span>
          {hasActiveFilters && (
            <button onClick={resetFilters} style={{
              padding: '5px 12px', border: '1px solid #E84393', borderRadius: 8,
              background: '#fce7f3', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
              color: '#E84393', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              ✕ Effacer les filtres
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => exportBeneficiairesCSV(data?.recentUsers || [])} style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            CSV
          </button>
          <button onClick={() => exportBeneficiairesPDF(data?.recentUsers || [])} style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            PDF
          </button>
          <div onClick={openFilters} style={{
            width: 34, height: 34, border: hasActiveFilters ? '1.5px solid #E84393' : '1px solid var(--border)',
            borderRadius: 8, background: hasActiveFilters ? '#fce7f3' : 'var(--white)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            position: 'relative',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 16, height: 16, color: hasActiveFilters ? '#E84393' : 'var(--text-400)' }}>
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

      {/* Table */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={thStyle}>Nom{sortArrow('name')}</th>
                <th onClick={() => handleSort('prenom')} style={thStyle}>Prénom{sortArrow('prenom')}</th>
                <th onClick={() => handleSort('age')} style={{ ...thStyle, textAlign: 'center' }}>Âge{sortArrow('age')}</th>
                <th onClick={() => handleSort('date')} style={thStyle}>Inscription{sortArrow('date')}</th>
                <th onClick={() => handleSort('activite')} style={thStyle}>Activité{sortArrow('activite')}</th>
                <th onClick={() => handleSort('prog')} style={thStyle}>Progrès{sortArrow('prog')}</th>
                <th onClick={() => handleSort('alert')} style={thStyle}>Statut{sortArrow('alert')}</th>
                <th style={{ ...thStyle, cursor: 'default' }}></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-400)', fontSize: 13 }}>
                    Aucun élève ne correspond aux filtres sélectionnés
                  </td>
                </tr>
              ) : paginated.map((u) => {
                const alertConf = ALERT_CONFIG[u.alertLvl];
                return (
                  <tr key={u.uid || u.index} onClick={() => openProfile(u.uid)} style={{ cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-900)' }}>{u.nom || '—'}</td>
                    <td style={tdStyle}>{u.prenom || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{u.age || '—'}</td>
                    <td style={tdStyle}>{u.dateStr}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-400)' }}>{formatActivite(u.lastActive)}</td>
                    <td style={tdStyle}><ProgressBar value={u.prog} /></td>
                    <td style={tdStyle}><Badge label={alertConf.label} className={alertConf.className} /></td>
                    <td style={tdStyle}>
                      <button onClick={(e) => { e.stopPropagation(); openProfile(u.uid); }}
                        style={{ fontSize: 11, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontWeight: 500, color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', background: '#fafbfc' }}>
            <span style={{ fontSize: 12, color: 'var(--text-400)' }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, sorted.length)} sur {sorted.length}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: page === 1 ? 'var(--text-300)' : 'var(--text-700)', cursor: page === 1 ? 'default' : 'pointer' }}>
                ‹ Précédent
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 32, height: 32, border: p === page ? 'none' : '1px solid var(--border)', borderRadius: 8, background: p === page ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'var(--white)', color: p === page ? '#fff' : 'var(--text-700)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: page === totalPages ? 'var(--text-300)' : 'var(--text-700)', cursor: page === totalPages ? 'default' : 'pointer' }}>
                Suivant ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '12px 12px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-400)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.3px', borderBottom: '1px solid var(--border)', background: '#fafbfc', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '12px', color: 'var(--text-700)', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle', whiteSpace: 'nowrap' };
