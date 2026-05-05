'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { User } from '@/types';

type TxStatus = 'sent' | 'pending' | 'error';

interface AvenirsRow extends User {
  index: number;
  txAt: string | null;
  txStatus: TxStatus;
  txItems: number;
}

const STATUS_CONFIG: Record<TxStatus, { label: string; bg: string; color: string; dot: string }> = {
  sent:    { label: 'Transmis',   bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', dot: '#16a34a' },
  pending: { label: 'En attente', bg: 'rgba(234,179,8,0.12)',  color: '#a16207', dot: '#eab308' },
  error:   { label: 'Erreur',     bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', dot: '#dc2626' },
};

// Hash deterministe pour generer un statut "stable" par eleve (en attendant la vraie API)
function deterministicStatus(uid: string): TxStatus {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  const m = h % 10;
  if (m < 7) return 'sent';
  if (m < 9) return 'pending';
  return 'error';
}

function formatActivite(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${day} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatNiveauAdmin(classe?: string): string {
  if (!classe) return '—';
  const cl = classe.toLowerCase();
  if (cl.includes('term')) return 'Term';
  if (cl.includes('1') || cl.includes('prem')) return '1ère';
  if (cl.includes('2') || cl.includes('sec')) return '2nde';
  if (cl.includes('3')) return '3ème';
  return classe;
}

const PER_PAGE = 8;

export default function AvenirsPage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TxStatus>('all');
  const [sortField, setSortField] = useState<'name' | 'classe' | 'date' | 'status'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  const users = useMemo(() => {
    const list = data?.recentUsers || [];
    return list.filter((u: User) => (u.nom && u.nom.trim()) || (u.prenom && u.prenom.trim()));
  }, [data]);

  const enriched: AvenirsRow[] = useMemo(() => {
    return users.map((u, i) => {
      const txStatus = deterministicStatus(u.uid || String(i));
      const txAt = txStatus === 'sent' ? (u.lastActive || u.completedAt || u.inscriptionDate || null) : null;
      const txItems = txStatus === 'sent' ? Math.max(3, ((u.topMetiers?.length) || 0) + 2) : 0;
      return { ...u, index: i, txAt, txStatus, txItems };
    });
  }, [users]);

  const counts = useMemo(() => {
    const c = { sent: 0, pending: 0, error: 0, total: enriched.length };
    enriched.forEach(u => { c[u.txStatus]++; });
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (statusFilter !== 'all') list = list.filter(u => u.txStatus === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        `${u.prenom || ''} ${u.nom || ''}`.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.classe || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      let va: string | number = '', vb: string | number = '';
      switch (sortField) {
        case 'name':
          va = `${a.prenom || ''} ${a.nom || ''}`.toLowerCase();
          vb = `${b.prenom || ''} ${b.nom || ''}`.toLowerCase();
          break;
        case 'classe':
          va = a.classe || ''; vb = b.classe || '';
          break;
        case 'status':
          va = a.txStatus; vb = b.txStatus;
          break;
        case 'date':
        default:
          va = a.txAt ? new Date(a.txAt).getTime() : 0;
          vb = b.txAt ? new Date(b.txAt).getTime() : 0;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [enriched, statusFilter, search, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const completionRate = counts.total > 0 ? Math.round((counts.sent / counts.total) * 100) : 0;

  const setSort = (f: typeof sortField) => {
    if (sortField === f) setSortAsc(!sortAsc);
    else { setSortField(f); setSortAsc(false); }
  };

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* === HERO === */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(127,73,151,0.08) 0%, rgba(232,67,147,0.06) 100%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 14, padding: '22px 26px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 13,
              background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(232,67,147,0.25)', color: '#fff',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.4px' }}>
                Transmissions Avenir(s)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--premium-text-3)', marginTop: 2 }}>
                Élèves dont vous avez transmis les informations à la plateforme nationale Avenir(s)
              </div>
            </div>
          </div>
          <a href="https://avenirs.onisep.fr/" target="_blank" rel="noopener noreferrer" style={{
            padding: '10px 16px', borderRadius: 10, background: '#1c1917', color: '#fff',
            fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(15,15,15,0.18)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Ouvrir Avenir(s)
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
              <path d="M7 17L17 7" /><polyline points="7 7 17 7 17 17" />
            </svg>
          </a>
        </div>
      </div>

      {/* === KPIs === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { k: 'Total élèves', v: counts.total, sub: 'dans votre classe', color: '#0a0a0a' },
          { k: 'Transmis', v: counts.sent, sub: `${completionRate}% du total`, color: '#16a34a' },
          { k: 'En attente', v: counts.pending, sub: 'en cours de synchro', color: '#a16207' },
          { k: 'Erreurs', v: counts.error, sub: 'à relancer', color: '#dc2626' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.k}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, marginTop: 4, letterSpacing: '-0.5px' }}>{s.v}</div>
            <div style={{ fontSize: 11, color: 'var(--premium-text-3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* === TABLE === */}
      <div style={{
        background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 14, padding: 18,
      }}>
        {/* Toolbar : pills statut + recherche */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, padding: '4px', borderRadius: 10, background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.05)' }}>
            {[
              { id: 'all',     label: 'Tous',       count: counts.total },
              { id: 'sent',    label: 'Transmis',   count: counts.sent },
              { id: 'pending', label: 'En attente', count: counts.pending },
              { id: 'error',   label: 'Erreur',     count: counts.error },
            ].map(p => (
              <button key={p.id}
                onClick={() => { setStatusFilter(p.id as typeof statusFilter); setPage(1); }}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: statusFilter === p.id ? '#fff' : 'transparent',
                  boxShadow: statusFilter === p.id ? '0 1px 3px rgba(15,15,15,0.06)' : 'none',
                  color: statusFilter === p.id ? 'var(--premium-text)' : 'var(--premium-text-3)',
                  fontSize: 12, fontWeight: statusFilter === p.id ? 600 : 500,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all .15s ease',
                }}>
                {p.label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: statusFilter === p.id ? 'rgba(127,73,151,0.10)' : 'rgba(15,15,15,0.06)',
                  color: statusFilter === p.id ? '#7f4997' : 'var(--premium-text-3)',
                  padding: '1px 7px', borderRadius: 8,
                }}>{p.count}</span>
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: 260 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--premium-text-4)" strokeWidth="2" strokeLinecap="round" style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 14, height: 14, pointerEvents: 'none',
            }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Rechercher un élève…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%', padding: '8px 12px 8px 32px', borderRadius: 9,
                border: '1px solid rgba(15,15,15,0.08)', background: 'rgba(255,255,255,0.7)',
                fontSize: 12.5, fontFamily: 'inherit', color: 'var(--premium-text)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { id: 'name',   label: 'Élève',         w: '32%', sortable: true },
                  { id: 'classe', label: 'Classe',        w: '12%', sortable: true },
                  { id: 'status', label: 'Statut',        w: '14%', sortable: true },
                  { id: 'items',  label: 'Données envoyées', w: '14%', sortable: false },
                  { id: 'date',   label: 'Date de transmission', w: '20%', sortable: true },
                  { id: 'act',    label: '',              w: '8%',  sortable: false },
                ].map(h => (
                  <th key={h.id} onClick={() => h.sortable && setSort(h.id as typeof sortField)}
                    style={{
                      width: h.w, textAlign: 'left',
                      padding: '10px 12px', fontSize: 10.5, fontWeight: 700,
                      color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderBottom: '1px solid rgba(15,15,15,0.06)',
                      cursor: h.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {h.label}
                      {h.sortable && sortField === h.id && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10, transform: sortAsc ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 13 }}>
                    Aucun élève à afficher.
                  </td>
                </tr>
              )}
              {pageRows.map((u) => {
                const cfg = STATUS_CONFIG[u.txStatus];
                const initials = ((u.prenom?.[0] || '') + (u.nom?.[0] || '')).toUpperCase() || '?';
                return (
                  <tr key={u.uid || u.index}
                    style={{ transition: 'background .15s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(127,73,151,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(15,15,15,0.05)' }}>
                      <button onClick={() => u.uid && openProfile(u.uid)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11, border: 'none',
                          background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                          padding: 0, textAlign: 'left',
                        }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, letterSpacing: '-0.2px',
                          boxShadow: '0 2px 6px rgba(232,67,147,0.18)',
                        }}>{initials}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--premium-text)', letterSpacing: '-0.1px' }}>
                            {u.prenom || ''} {u.nom || ''}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--premium-text-4)', marginTop: 1 }}>
                            {u.email || '—'}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(15,15,15,0.05)', fontSize: 12.5, color: 'var(--premium-text-2)', fontWeight: 500 }}>
                      {formatNiveauAdmin(u.classe)}
                    </td>
                    <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(15,15,15,0.05)' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 11, fontWeight: 700,
                        padding: '4px 10px', borderRadius: 8,
                        background: cfg.bg, color: cfg.color,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                        {cfg.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(15,15,15,0.05)', fontSize: 12.5, color: 'var(--premium-text-2)' }}>
                      {u.txStatus === 'sent' ? (
                        <span><strong style={{ fontWeight: 700, color: 'var(--premium-text)' }}>{u.txItems}</strong> éléments</span>
                      ) : (
                        <span style={{ color: 'var(--premium-text-4)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(15,15,15,0.05)', fontSize: 12.5, color: 'var(--premium-text-2)' }}>
                      {formatActivite(u.txAt)}
                    </td>
                    <td style={{ padding: '12px 12px', borderBottom: '1px solid rgba(15,15,15,0.05)', textAlign: 'right' }}>
                      <button onClick={() => u.uid && openProfile(u.uid)}
                        style={{
                          padding: '6px 10px', borderRadius: 8,
                          border: '1px solid rgba(15,15,15,0.1)', background: 'rgba(255,255,255,0.7)',
                          fontSize: 11.5, fontWeight: 600, color: 'var(--premium-text-2)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        Voir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)' }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} sur {filtered.length}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: '1px solid rgba(15,15,15,0.1)',
                  background: page === 1 ? 'rgba(15,15,15,0.03)' : 'rgba(255,255,255,0.7)',
                  fontSize: 11.5, fontWeight: 600,
                  color: page === 1 ? 'var(--premium-text-4)' : 'var(--premium-text-2)',
                  cursor: page === 1 ? 'default' : 'pointer', fontFamily: 'inherit',
                }}>← Précédent</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 12, color: 'var(--premium-text-3)' }}>
                {page} / {totalPages}
              </span>
              <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: '1px solid rgba(15,15,15,0.1)',
                  background: page === totalPages ? 'rgba(15,15,15,0.03)' : 'rgba(255,255,255,0.7)',
                  fontSize: 11.5, fontWeight: 600,
                  color: page === totalPages ? 'var(--premium-text-4)' : 'var(--premium-text-2)',
                  cursor: page === totalPages ? 'default' : 'pointer', fontFamily: 'inherit',
                }}>Suivant →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
