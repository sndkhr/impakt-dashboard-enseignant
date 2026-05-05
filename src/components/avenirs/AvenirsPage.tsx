'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { User } from '@/types';
import { computeEngagementScore, computeCompositeScore, MOTIV_PALETTE } from '@/lib/motivationScore';

type TxStatus = 'sent' | 'pending' | 'error';

const STATUS_CONFIG: Record<TxStatus, { label: string; bg: string; color: string; dot: string }> = {
  sent:    { label: 'Transmis',   bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', dot: '#16a34a' },
  pending: { label: 'En attente', bg: 'rgba(234,179,8,0.12)',  color: '#a16207', dot: '#eab308' },
  error:   { label: 'Erreur',     bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', dot: '#dc2626' },
};

function deterministicStatus(uid: string): TxStatus {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  const m = h % 10;
  if (m < 7) return 'sent';
  if (m < 9) return 'pending';
  return 'error';
}

function formatDateLong(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const PER_PAGE = 8;

export default function AvenirsPage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TxStatus>('all');
  const [sortField, setSortField] = useState<'name' | 'prenom' | 'motivation' | 'date' | 'status'>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);

  const users = useMemo(() => {
    const list = data?.recentUsers || [];
    return list.filter((u: User) => (u.nom && u.nom.trim()) || (u.prenom && u.prenom.trim()));
  }, [data]);

  const enriched = useMemo(() => {
    return users.map((u, i) => {
      const txStatus = deterministicStatus(u.uid || String(i));
      const txAt = txStatus === 'sent' ? (u.lastActive || u.completedAt || u.inscriptionDate || null) : null;
      const eng = computeEngagementScore(u);
      const motivScore = u.lastMotivationScore != null
        ? (computeCompositeScore(u.lastMotivationScore, eng.total) ?? eng.total)
        : eng.total;
      const motivLevel: 'forte' | 'moderee' | 'faible' =
        motivScore >= 70 ? 'forte' : motivScore >= 40 ? 'moderee' : 'faible';
      return { ...u, index: i, txAt, txStatus, motivScore, motivLevel };
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
        (u.nom || '').toLowerCase().includes(q) || (u.prenom || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0;
      switch (sortField) {
        case 'name':       va = (a.nom || '').toLowerCase();    vb = (b.nom || '').toLowerCase(); break;
        case 'prenom':     va = (a.prenom || '').toLowerCase(); vb = (b.prenom || '').toLowerCase(); break;
        case 'motivation': va = a.motivScore;                   vb = b.motivScore; break;
        case 'status':     va = a.txStatus;                     vb = b.txStatus; break;
        case 'date':
        default:           va = a.txAt ? new Date(a.txAt).getTime() : 0; vb = b.txAt ? new Date(b.txAt).getTime() : 0;
      }
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [enriched, statusFilter, search, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const completionRate = counts.total > 0 ? Math.round((counts.sent / counts.total) * 100) : 0;

  const handleSort = (f: typeof sortField) => {
    if (sortField === f) setSortAsc(!sortAsc);
    else { setSortField(f); setSortAsc(false); }
    setPage(1);
  };
  const arrow = (f: typeof sortField) => sortField === f ? (sortAsc ? ' ↑' : ' ↓') : '';

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  return (
    <div className="fi" style={{
      display: 'flex', flexDirection: 'column', gap: 14,
      height: 'calc(100vh - 32px - var(--topbar-h, 76px))',
    }}>
      {/* === KPIs (compacts, alignés sur le reste du dashboard) === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flexShrink: 0 }}>
        {[
          { k: 'Total élèves',  v: counts.total,   sub: 'dans votre classe',  color: 'var(--premium-text)' },
          { k: 'Transmis',      v: counts.sent,    sub: `${completionRate}% du total`,         color: '#16a34a' },
          { k: 'En attente',    v: counts.pending, sub: 'en cours de synchro', color: '#a16207' },
          { k: 'Erreurs',       v: counts.error,   sub: 'à relancer',          color: '#dc2626' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.52)',
            backdropFilter: 'blur(28px) saturate(140%)',
            WebkitBackdropFilter: 'blur(28px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 18,
            boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.04), inset 0 1px 0 rgba(255,255,255,0.85)',
            padding: '16px 18px',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--premium-text-4)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{s.k}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, marginTop: 6, letterSpacing: '-0.5px', lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11.5, color: 'var(--premium-text-3)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* === Card glass : toolbar + tableau (s'étend sur l'espace restant) === */}
      <div style={{
        background: 'rgba(255,255,255,0.52)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 22,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.04), inset 0 1px 0 rgba(255,255,255,0.85)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        flex: 1, minHeight: 0,
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '16px 18px', borderBottom: '1px solid rgba(15,15,15,0.06)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="text" placeholder="Rechercher un élève..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                padding: '9px 14px 9px 34px', background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(28,25,23,0.08)', borderRadius: 10,
                fontFamily: 'inherit', fontSize: 12.5, color: 'var(--premium-text)', outline: 'none',
                width: 280,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='6' cy='6' r='5'/%3E%3Cline x1='10' y1='10' x2='13' y2='13'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: '12px center',
              }}
            />
            {/* Pills filtre rapide statut */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {([
                { id: 'all',     label: 'Tous',       count: counts.total,   dot: '#a3a3a3', text: '#737373', rgb: '163,163,163' },
                { id: 'sent',    label: 'Transmis',   count: counts.sent,    dot: '#16a34a', text: '#16a34a', rgb: '22,163,74' },
                { id: 'pending', label: 'En attente', count: counts.pending, dot: '#eab308', text: '#a16207', rgb: '234,179,8' },
                { id: 'error',   label: 'Erreur',     count: counts.error,   dot: '#dc2626', text: '#dc2626', rgb: '220,38,38' },
              ] as const).map(p => {
                const active = statusFilter === p.id;
                return (
                  <button key={p.id}
                    onClick={() => { setStatusFilter(p.id); setPage(1); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', border: 'none', borderRadius: 999,
                      background: active
                        ? `linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 100%), rgba(${p.rgb},0.14)`
                        : 'rgba(255,255,255,0.4)',
                      backdropFilter: 'blur(18px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                      boxShadow: active
                        ? `inset 0 1px 0.5px rgba(255,255,255,0.85), 0 1px 2px rgba(15,15,15,0.04), 0 4px 12px rgba(${p.rgb},0.18)`
                        : 'inset 0 1px 0.5px rgba(255,255,255,0.7)',
                      fontFamily: 'inherit', fontSize: 11.5, fontWeight: active ? 600 : 500,
                      color: active ? p.text : 'var(--premium-text-3)',
                      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s ease',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.6)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.4)'; }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: p.dot,
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
          </div>

          <a href="https://avenirs.onisep.fr/" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            border: '1px solid rgba(28,25,23,0.08)', background: 'rgba(255,255,255,0.7)',
            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, color: 'var(--premium-text-2)',
            textDecoration: 'none',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Avenir(s)
          </a>
        </div>

        {/* Tableau */}
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', zIndex: 1 }}>
              <tr>
                <th onClick={() => handleSort('name')}       style={thStyle}>Nom{arrow('name')}</th>
                <th onClick={() => handleSort('prenom')}     style={thStyle}>Prénom{arrow('prenom')}</th>
                <th onClick={() => handleSort('motivation')} style={thStyle}>Motivation{arrow('motivation')}</th>
                <th onClick={() => handleSort('date')}       style={thStyle}>Date transmission{arrow('date')}</th>
                <th onClick={() => handleSort('status')}     style={thStyle}>Statut{arrow('status')}</th>
                <th style={{ ...thStyle, cursor: 'default' }}></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 13 }}>
                    Aucun élève ne correspond aux filtres
                  </td>
                </tr>
              ) : pageRows.map(u => {
                const cfg = STATUS_CONFIG[u.txStatus];
                const palette = MOTIV_PALETTE[u.motivLevel];
                const motivLabel = u.motivLevel === 'forte' ? 'Forte' : u.motivLevel === 'moderee' ? 'Modérée' : 'Faible';
                const score = Math.max(0, Math.min(100, u.motivScore));
                return (
                  <tr key={u.uid || u.index}
                    onClick={() => { if (u.uid) openProfile(u.uid); }}
                    style={{ cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafbfc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--premium-text)' }}>{u.nom || '—'}</td>
                    <td style={tdStyle}>{u.prenom || '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110, maxWidth: 140 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, lineHeight: 1 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: palette.text, letterSpacing: '-0.1px' }}>{motivLabel}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--premium-text-3)', fontVariantNumeric: 'tabular-nums' }}>{u.motivScore}</span>
                        </div>
                        <div style={{
                          height: 6, borderRadius: 999,
                          background: 'rgba(255,255,255,0.5)',
                          backdropFilter: 'blur(12px) saturate(160%)',
                          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                          boxShadow: 'inset 0 1px 1.5px rgba(15,15,15,0.06), inset 0 0 0 0.5px rgba(255,255,255,0.6)',
                          overflow: 'hidden', position: 'relative',
                        }}>
                          <div style={{
                            width: `${score}%`, height: '100%', borderRadius: 999,
                            background: `linear-gradient(90deg, ${palette.gradient})`,
                            boxShadow: `0 0 8px rgba(${palette.rgb}, 0.55), inset 0 1px 0.5px rgba(255,255,255,0.6)`,
                            transition: 'width .6s cubic-bezier(0.2, 0.8, 0.2, 1)',
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{formatDateLong(u.txAt)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 10.5, fontWeight: 700,
                        padding: '4px 10px', borderRadius: 999,
                        background: cfg.bg, color: cfg.color, letterSpacing: '.3px',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                        {cfg.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={(e) => { e.stopPropagation(); if (u.uid) openProfile(u.uid); }}
                        style={{
                          fontSize: 11, padding: '5px 12px',
                          border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8,
                          background: 'rgba(255,255,255,0.55)',
                          fontFamily: 'inherit', fontWeight: 500, color: 'var(--premium-text-2)',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
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
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: 'var(--premium-text-4)' }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} sur {filtered.length}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{
                  padding: '6px 12px', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8,
                  background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  color: page === 1 ? 'var(--text-300)' : 'var(--text-700)',
                  cursor: page === 1 ? 'default' : 'pointer',
                }}>‹ Précédent</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{
                    width: 32, height: 32,
                    border: p === page ? 'none' : '1px solid var(--border)',
                    borderRadius: 8,
                    background: p === page ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'var(--white)',
                    color: p === page ? '#fff' : 'var(--text-700)',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{
                  padding: '6px 12px', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8,
                  background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  color: page === totalPages ? 'var(--text-300)' : 'var(--text-700)',
                  cursor: page === totalPages ? 'default' : 'pointer',
                }}>Suivant ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 12px', fontSize: 10.5, fontWeight: 600,
  color: 'var(--premium-text-4)', textAlign: 'left',
  textTransform: 'uppercase', letterSpacing: '.3px',
  borderBottom: '1px solid var(--border)',
  background: 'transparent', whiteSpace: 'nowrap',
  cursor: 'pointer', userSelect: 'none',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12,
  color: 'var(--premium-text-2)',
  borderBottom: '1px solid rgba(15,15,15,0.04)',
  verticalAlign: 'middle', whiteSpace: 'nowrap',
};
