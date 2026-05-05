'use client';

import { useState, useMemo, useEffect } from 'react';
import { useNav } from '@/lib/navigation';
import { useFormationRequests, useRdvNotifications } from '@/lib/useBackendRdvs';
import { FormationRequestRow } from '@/lib/api';
import EmptyState from '@/components/ui/EmptyState';

const thStyle: React.CSSProperties = {
  padding: '9px 10px', fontSize: 10, fontWeight: 700,
  color: 'var(--premium-text-4)', textAlign: 'left',
  textTransform: 'uppercase', letterSpacing: '.5px',
  borderBottom: '1px solid rgba(15,15,15,0.06)', whiteSpace: 'nowrap',
};
// v17.8 — Cellules compactes, nowrap par défaut.
// Seule la cellule "Formation" est autorisée à wrap pour conserver
// le nom complet sans truncate (cf. tdFormation plus bas).
const tdStyle: React.CSSProperties = {
  padding: '9px 10px', fontSize: 12,
  color: 'var(--premium-text-2)',
  borderBottom: '1px solid rgba(15,15,15,0.04)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};
const tdFormation: React.CSSProperties = {
  ...tdStyle,
  whiteSpace: 'normal',
  fontWeight: 600,
  color: 'var(--premium-text)',
  lineHeight: 1.35,
  maxWidth: 280,
};

function Avatar({ initials }: { initials: string }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
      color: '#ffffff', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10.5, fontWeight: 700, letterSpacing: '-0.3px',
      boxShadow: '0 2px 6px rgba(232,67,147,0.25), inset 0 1px 0 rgba(255,255,255,0.40)',
    }}>{initials}</div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isPending = status === 'pending';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
      padding: '3px 9px', borderRadius: 999,
      color: isPending ? '#7f4997' : '#047857',
      background: isPending ? 'rgba(127,73,151,0.10)' : 'rgba(16,185,129,0.12)',
      border: `1px solid ${isPending ? 'rgba(127,73,151,0.20)' : 'rgba(16,185,129,0.22)'}`,
      whiteSpace: 'nowrap',
    }}>
      {isPending ? 'EN ATTENTE' : 'TRAITÉE'}
    </span>
  );
}

type Filter = 'all' | 'pending' | 'processed';

export default function FormationsPage() {
  const { openProfile } = useNav();
  const { requests, pendingCount, loading, markProcessed } = useFormationRequests();
  // v17.8 — Au mount de la page, marque toutes les notifs formation_request
  // comme lues (le conseiller "voit" la liste, donc plus de badge).
  const { markAllRead } = useRdvNotifications();
  useEffect(() => { markAllRead('formation_request'); }, [markAllRead]);
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const processed = total - pending;
    return { total, pending, processed };
  }, [requests]);

  const filtered = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter(r => r.status === filter);
  }, [requests, filter]);

  function ficheUrlFor(r: FormationRequestRow): string {
    // v17.8 — Portail formation France Travail (candidat.francetravail.fr) :
    // recherche publique alimentée par Carif-OREF, pas besoin de connexion
    // pour consulter une fiche. C'est l'outil que les demandeurs d'emploi
    // utilisent pour trouver une formation et leurs conseillers pour vérifier.
    const query = [r.formationNom, r.formationOrganisme].filter(Boolean).join(' ');
    return `https://candidat.francetravail.fr/formations/recherche?motsCles=${encodeURIComponent(query)}`;
  }

  function initialsFor(name: string | null): string {
    if (!name) return '?';
    return name.split(/\s+/).map(s => s[0] || '').slice(0, 2).join('').toUpperCase() || '?';
  }

  function dateLabel(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  }

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Container glassmorphisme cohérent avec le reste */}
      <div style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 20,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
        overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '16px 20px',
          borderBottom: '1px solid rgba(15,15,15,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {([
              { id: 'all', label: 'Toutes', count: counts.total, color: '#7f4997' },
              { id: 'pending', label: 'En attente', count: counts.pending, color: '#E84393' },
              { id: 'processed', label: 'Traitées', count: counts.processed, color: '#10b981' },
            ] as const).map(p => {
              const active = filter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setFilter(p.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', border: 'none', borderRadius: 999,
                    background: active
                      ? `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.20) 100%), rgba(127,73,151,0.10)`
                      : 'rgba(255,255,255,0.4)',
                    backdropFilter: 'blur(14px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                    boxShadow: active
                      ? `inset 0 1px 0.5px rgba(255,255,255,0.85), 0 4px 12px rgba(127,73,151,0.18)`
                      : 'inset 0 1px 0.5px rgba(255,255,255,0.7)',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 600 : 500,
                    color: active ? p.color : 'var(--premium-text-3)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all .15s ease',
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: p.color,
                    boxShadow: active ? `0 0 8px ${p.color}99` : 'none',
                  }} />
                  {p.label}
                  <span style={{ fontWeight: 700, color: active ? p.color : 'var(--premium-text-4)', fontVariantNumeric: 'tabular-nums' }}>
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>
          {pendingCount > 0 && (
            <div style={{
              fontSize: 11.5, color: 'var(--premium-text-3)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#E84393',
                boxShadow: '0 0 8px rgba(232,67,147,0.55)',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              {pendingCount} demande{pendingCount > 1 ? 's' : ''} à traiter
            </div>
          )}
        </div>

        {/* Tableau */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 13 }}>
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={filter === 'pending' ? 'Aucune demande en attente' : filter === 'processed' ? 'Aucune demande traitée' : 'Aucune demande de formation'}
            description="Quand un de tes bénéficiaires t'enverra une demande de formation depuis l'app, elle apparaîtra ici."
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Bénéficiaire</th>
                  <th style={thStyle}>Métier visé</th>
                  <th style={thStyle}>Formation</th>
                  <th style={thStyle}>Organisme</th>
                  <th style={thStyle}>Ville</th>
                  <th style={thStyle}>Durée</th>
                  <th style={thStyle}>Reçue</th>
                  <th style={thStyle}>Statut</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    style={{ cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(127,73,151,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    onClick={() => r.jeuneUid && openProfile(r.jeuneUid, 'parcours')}
                    /* v17.8 — clic sur ligne → fiche jeune onglet Parcours */
                  >
                    {/* Bénéficiaire compact : avatar + nom + (ville · âge) tout en ligne */}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar initials={initialsFor(r.jeuneNom)} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--premium-text)' }}>{r.jeuneNom || 'Bénéficiaire'}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--premium-text-2)', fontWeight: 500 }}>{r.metier || '—'}</td>
                    <td style={tdFormation}>{r.formationNom}</td>
                    <td style={tdStyle}>{r.formationOrganisme || '—'}</td>
                    <td style={tdStyle}>{r.formationVille || '—'}</td>
                    <td style={tdStyle}>{r.formationDuree || '—'}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--premium-text-4)' }}>{dateLabel(r.createdAt)}</td>
                    <td style={tdStyle}><StatusPill status={r.status} /></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                        {/* Bouton icône — Voir la fiche officielle */}
                        <a
                          href={ficheUrlFor(r)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Voir la fiche de la formation"
                          style={{
                            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(15,15,15,0.08)', borderRadius: 8,
                            background: 'rgba(255,255,255,0.55)',
                            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            color: 'var(--premium-text-3)',
                            textDecoration: 'none',
                            transition: 'all .12s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.85)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.55)'; }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                        {/* Bouton icône — Voir le profil du jeune */}
                        <button
                          onClick={() => openProfile(r.jeuneUid, 'parcours')}
                          title="Ouvrir la fiche du bénéficiaire"
                          style={{
                            width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(15,15,15,0.08)', borderRadius: 8,
                            background: 'rgba(255,255,255,0.55)',
                            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            color: 'var(--premium-text-3)',
                            cursor: 'pointer',
                            transition: 'all .12s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.85)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.55)'; }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </button>
                        {/* Bouton icône — Valider / Marquer traitée (gradient brand seulement si pending) */}
                        {r.status === 'pending' && (
                          <button
                            onClick={() => markProcessed(r.id, r.jeuneUid)}
                            title="Marquer comme traitée"
                            style={{
                              width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              border: 'none', borderRadius: 8,
                              background: 'linear-gradient(135deg, #7f4997, #E84393)',
                              color: '#fff', cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(232,67,147,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
                              transition: 'transform .12s ease',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>
    </div>
  );
}
