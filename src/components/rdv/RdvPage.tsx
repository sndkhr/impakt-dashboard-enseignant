'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { useModals } from '@/lib/modals';
import { deleteRdv, markAttendance, ScheduledRdv, RdvType, RdvLocation, listAllRdvs } from '@/lib/scheduledRdv';
import { useBackendRdvs, useRdvNotifications } from '@/lib/useBackendRdvs';
import { BackendRendezvous, RdvBackendStatus, respondToJeuneRequestAPI, updateRendezvousAPI } from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';

const thStyle: React.CSSProperties = { padding: '11px 14px', fontSize: 10, fontWeight: 700, color: 'var(--premium-text-4)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid rgba(15,15,15,0.06)', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '11px 14px', fontSize: 12.5, color: 'var(--premium-text-2)', borderBottom: '1px solid rgba(15,15,15,0.04)', verticalAlign: 'middle' };

function Avatar({ initials }: { initials: string }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
      color: '#ffffff', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, letterSpacing: '-0.3px',
      boxShadow: '0 2px 6px rgba(232,67,147,0.25)',
    }}>{initials}</div>
  );
}

type Tab = 'upcoming' | 'past' | 'deleted';

// ============================================================
// Conversion BackendRendezvous → ScheduledRdv-like unifie pour affichage
// ============================================================
interface UnifiedRdv {
  id: string;                          // rdvId backend OU id local
  source: 'backend' | 'local';
  uid: string;                         // jeuneUid
  beneficiaireName: string;
  at: string;                          // ISO datetime
  durationMin: number;
  type: RdvType | string;
  location: RdvLocation | string;
  note?: string;
  // Backend only
  backendStatus?: RdvBackendStatus;    // pending / accepted / declined / cancelled
  jeunePhoneNumber?: string | null;
  // Local only
  attended?: 'yes' | 'no' | null;
  conclusion?: string;
  // Meta
  scheduledAt?: string;
}

function backendToUnified(r: BackendRendezvous): UnifiedRdv {
  return {
    id: r.id,
    source: 'backend',
    uid: r.jeuneUid || '',
    beneficiaireName: r.jeuneName || r.jeunePhoneNumber || 'Bénéficiaire',
    at: r.dateTime || new Date().toISOString(),
    durationMin: 60,
    type: r.objet || 'Rendez-vous',
    location: r.location || '',
    note: r.notes || undefined,
    backendStatus: r.status,
    jeunePhoneNumber: r.jeunePhoneNumber,
    scheduledAt: r.createdAt || undefined,
  };
}

// v17.7.28 — true si la demande vient du jeune et n'est pas encore traitée
function isOpenJeuneRequest(r: BackendRendezvous): boolean {
  return r.requestedBy === 'jeune'
    && r.status === 'pending'
    && (!r.conseillerUid || r.conseillerUid === '');
}

function localToUnified(r: ScheduledRdv): UnifiedRdv {
  return {
    id: r.id,
    source: 'local',
    uid: r.uid,
    beneficiaireName: r.beneficiaireName || '',
    at: r.at,
    durationMin: r.durationMin,
    type: r.type,
    location: r.location,
    note: r.note,
    attended: r.attended,
    conclusion: r.conclusion,
    scheduledAt: r.scheduledAt,
  };
}

// Badge pour statut backend (RDV cree via createRendezvous)
// v17.7.29 — Sandra : labels simples sans emoji, "Confirmé" au lieu de "Validé par le candidat"
function backendStatusBadge(s: RdvBackendStatus | undefined) {
  switch (s) {
    case 'pending':   return { label: 'En attente', bg: 'rgba(180,83,9,0.10)', color: '#b45309' };
    case 'accepted':  return { label: 'Confirmé',    bg: 'rgba(16,185,129,0.12)', color: '#047857' };
    case 'declined':  return { label: 'Refusé',      bg: 'rgba(220,38,38,0.10)', color: '#dc2626' };
    case 'cancelled': return { label: 'Supprimé',    bg: 'rgba(220,38,38,0.10)', color: '#dc2626' };
    default:          return { label: '—',           bg: 'rgba(15,15,15,0.04)', color: 'var(--premium-text-4)' };
  }
}

// Badge pour statut local (RDV planifie localement, sans backend)
// v17.7.30 — Sandra : aligné sur le format backend → En attente / Confirmé / Refusé
function localStatusBadge(r: UnifiedRdv) {
  if (r.attended === 'yes') return { label: 'Confirmé',   bg: 'rgba(16,185,129,0.12)', color: '#047857' };
  if (r.attended === 'no')  return { label: 'Refusé',     bg: 'rgba(220,38,38,0.10)', color: '#dc2626' };
  return { label: 'En attente', bg: 'rgba(180,83,9,0.10)', color: '#b45309' };
}

export default function RdvPage() {
  const { data, token } = useAuth();
  const { openProfile } = useNav();
  const { openExchange } = useModals();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [tick, setTick] = useState(0);

  // Backend RDV (polling 15s)
  const { rendezvous: backendRdvs, refresh: refreshBackend } = useBackendRdvs();

  // v17.8 — Au mount de la page, marque toutes les notifs RDV (rendezvous_response)
  // comme lues — la badge sidebar "Rendez-vous" se vide instantanément.
  const { markAllRead } = useRdvNotifications();
  useEffect(() => { markAllRead('rendezvous_response'); }, [markAllRead]);

  // v17.7.31 — Confirm dialog pour suppression
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; source: 'backend' | 'local'; name: string } | null>(null);

  // v17.7.28 — Demandes initiées par les jeunes (non encore traitées)
  const candidateRequests = useMemo(() => {
    return backendRdvs.filter(isOpenJeuneRequest)
      .sort((a, b) => new Date(a.dateTime || '').getTime() - new Date(b.dateTime || '').getTime());
  }, [backendRdvs]);

  const respondToRequest = async (rdv: BackendRendezvous, action: 'accept' | 'decline') => {
    try {
      if (!token) {
        toast.show('Session expirée — reconnecte-toi', 'error');
        return;
      }
      await respondToJeuneRequestAPI(token, rdv.id, { action });
      toast.show(action === 'accept' ? '✓ RDV accepté, le candidat a été notifié' : 'Demande refusée', action === 'accept' ? 'success' : 'info');
      refreshBackend();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast.show(`Erreur : ${msg}`, 'error');
    }
  };

  useEffect(() => {
    const onFocus = () => { setTick(t => t + 1); refreshBackend(); };
    // v17.7.32 — Refresh immédiat quand un RDV est créé/modifié
    const onRdvChanged = () => { refreshBackend(); setTick(t => t + 1); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('rdv:changed', onRdvChanged);
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('rdv:changed', onRdvChanged);
      clearInterval(interval);
    };
  }, [refreshBackend]);
  void tick;

  const users = useMemo(() => data?.recentUsers || [], [data]);

  // Merge : backend d'abord (source de verite), local pour les anciens RDV manuels
  const allRdvs: UnifiedRdv[] = useMemo(() => {
    const fromBackend = backendRdvs.map(backendToUnified);
    const backendIds = new Set(fromBackend.map(r => r.id));
    const fromLocal = listAllRdvs()
      .filter(r => !backendIds.has(r.id)) // evite doublons si id local == id backend
      .map(localToUnified);
    return [...fromBackend, ...fromLocal];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendRdvs, tick]);

  const now = Date.now();

  const { upcoming, past, deleted } = useMemo(() => {
    const up: UnifiedRdv[] = [];
    const pa: UnifiedRdv[] = [];
    const de: UnifiedRdv[] = [];
    allRdvs.forEach(r => {
      const start = new Date(r.at).getTime();
      const end = start + r.durationMin * 60000;
      // Backend cancelled (supprimé par le conseiller) → onglet Supprimés uniquement
      if (r.source === 'backend' && r.backendStatus === 'cancelled') {
        de.push(r);
        return;
      }
      // Pour tous les autres (pending, accepted, declined) : on garde la
      // logique standard "futur = À venir, passé = Passés". Un RDV refusé
      // par le jeune reste donc visible dans À venir avec le badge "Refusé"
      // jusqu'à ce que la date soit dépassée.
      if ((r.attended === 'yes' || r.attended === 'no') && now > end) { pa.push(r); return; }
      if (now < end + 60000) { up.push(r); return; }
      pa.push(r);
    });
    up.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    pa.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    de.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { upcoming: up, past: pa, deleted: de };
  }, [allRdvs, now]);

  const getInit = (uid: string, fallbackName: string): string => {
    const u = users.find(x => x.uid === uid);
    if (u) return ((u.prenom || '?')[0] + (u.nom || '?')[0]).toUpperCase();
    const parts = fallbackName.split(/\s+/);
    return ((parts[0] || '?')[0] + (parts[1] || '?')[0]).toUpperCase();
  };
  const getDisplayName = (r: UnifiedRdv): string => {
    const u = users.find(x => x.uid === r.uid);
    if (u) return `${u.prenom || ''} ${u.nom || ''}`.trim() || r.beneficiaireName;
    return r.beneficiaireName || 'Bénéficiaire';
  };

  const handleDelete = async (id: string, source: 'backend' | 'local') => {
    if (source === 'backend') {
      if (!token) {
        toast.show('Session expirée', 'error');
        return;
      }
      try {
        // PATCH status:"cancelled" — le RDV bascule dans l'onglet Supprimés
        // et le jeune reçoit une push "Rendez-vous annulé".
        await updateRendezvousAPI(token, id, { status: 'cancelled' });
        toast.show('RDV supprimé', 'info');
        refreshBackend();
      } catch (e) {
        toast.show(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`, 'error');
      }
      return;
    }
    deleteRdv(id);
    setTick(t => t + 1);
    toast.show('RDV supprimé', 'info');
  };
  const handlePresence = (id: string, attended: 'yes' | 'no') => {
    markAttendance(id, attended);
    setTick(t => t + 1);
    toast.show(attended === 'yes' ? '✓ Présence enregistrée' : 'Absence enregistrée', 'success');
  };

  const currentData = activeTab === 'upcoming' ? upcoming : activeTab === 'past' ? past : deleted;

  if (!data) return <div className="ld"><div className="ld-spin" />Chargement…</div>;

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* === Header === */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px', margin: 0 }}>
            Rendez-vous
          </h2>
          <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', marginTop: 3 }}>
            {upcoming.length} à venir · {past.length} passés
          </div>
        </div>
        <button onClick={() => openExchange()} className="btn-gradient" style={{
          padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Ajouter un RDV
        </button>
      </div>

      {/* === v17.7.28 — Demandes des candidats (jeunes) en attente === */}
      {candidateRequests.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(127,73,151,0.08) 0%, rgba(232,67,147,0.06) 100%)',
          border: '1px solid rgba(127,73,151,0.20)',
          borderRadius: 14,
          padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>
              Demandes des candidats
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              padding: '2px 7px', borderRadius: 999,
              background: 'linear-gradient(90deg, #7f4997, #E84393)',
              color: '#fff', minWidth: 18, textAlign: 'center',
            }}>{candidateRequests.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidateRequests.map(rdv => {
              const dateStr = rdv.dateTime
                ? new Date(rdv.dateTime).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—';
              const name = rdv.jeuneName || rdv.jeunePhoneNumber || 'Candidat';
              const initials = (name.split(' ').map(s => s[0] || '').join('').slice(0, 2) || 'C').toUpperCase();
              return (
                <div key={rdv.id} style={{
                  background: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(15,15,15,0.06)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <Avatar initials={initials} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                      fontSize: 12.5, fontWeight: 600, color: 'var(--premium-text)',
                    }}>
                      <span>{name}</span>
                      <span style={{
                        fontSize: 9.5, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 4,
                        background: 'linear-gradient(90deg, #7f4997, #E84393)',
                        color: '#fff', letterSpacing: '0.3px',
                      }}>DEMANDE</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--premium-text-3)', marginTop: 2 }}>
                      {rdv.objet || 'Rendez-vous'} · {dateStr} · {rdv.location || '—'}
                    </div>
                    {rdv.notes && (
                      <div style={{ fontSize: 11, color: 'var(--premium-text-4)', fontStyle: 'italic', marginTop: 4 }}>
                        « {rdv.notes} »
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => respondToRequest(rdv, 'decline')} style={{
                      padding: '7px 12px', borderRadius: 8,
                      border: '1px solid rgba(15,15,15,0.1)', background: 'rgba(255,255,255,0.7)',
                      fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                      color: 'var(--premium-text-3)', cursor: 'pointer',
                    }}>Refuser</button>
                    <button onClick={() => respondToRequest(rdv, 'accept')} className="btn-gradient" style={{
                      padding: '7px 14px', borderRadius: 8, fontFamily: 'inherit',
                      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}>Accepter</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Tabs === */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(15,15,15,0.06)' }}>
        {([
          { id: 'upcoming' as Tab, label: 'À venir', count: upcoming.length },
          { id: 'past' as Tab, label: 'Passés', count: past.length },
          { id: 'deleted' as Tab, label: 'Supprimés', count: deleted.length },
        ]).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '8px 14px 12px', background: 'transparent', border: 'none',
              borderBottom: isActive ? '2px solid #E84393' : '2px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 7,
              transition: 'all .18s ease', marginBottom: -1,
            }}>
              <span style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--premium-text)' : 'var(--premium-text-3)', letterSpacing: '-0.2px' }}>{tab.label}</span>
              <span style={{
                fontSize: 10.5, fontWeight: 700,
                padding: '2px 7px', borderRadius: 999,
                background: isActive ? 'rgba(232,67,147,0.10)' : 'rgba(15,15,15,0.05)',
                color: isActive ? '#E84393' : 'var(--premium-text-4)',
                fontVariantNumeric: 'tabular-nums', minWidth: 18, textAlign: 'center',
              }}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* === Table === */}
      <div id="rdv-table" style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 16,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
        overflow: 'hidden',
      }}>
        {currentData.length === 0 ? (
          <EmptyState
            iconKind="calendar"
            title={activeTab === 'upcoming' ? 'Aucun RDV à venir' : activeTab === 'past' ? 'Aucun RDV passé' : 'Aucun RDV supprimé'}
            description={activeTab === 'upcoming'
              ? 'Tu peux planifier un RDV en cliquant sur « Ajouter un RDV » en haut.'
              : activeTab === 'past'
                ? 'Tes RDV passés apparaîtront ici une fois marqués comme effectués.'
                : 'Les RDV que tu supprimes apparaîtront ici.'}
            ctaLabel={activeTab === 'upcoming' ? '+ Planifier un RDV' : undefined}
            onCta={activeTab === 'upcoming' ? () => openExchange() : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Bénéficiaire</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Heure</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Lieu</th>
                  <th style={thStyle}>Statut</th>
                  <th style={{ ...thStyle, textAlign: 'right', paddingRight: 18 }}></th>
                </tr>
              </thead>
              <tbody>
                {currentData.map(r => {
                  const name = getDisplayName(r);
                  const init = getInit(r.uid, name);
                  const badge = r.source === 'backend'
                    ? backendStatusBadge(r.backendStatus)
                    : localStatusBadge(r);
                  const isLocalPastPending = r.source === 'local' && !r.attended && Date.now() > new Date(r.at).getTime() + r.durationMin * 60000;
                  return (
                    <tr key={`${r.source}-${r.id}`} id={`rdv-${r.id}`} style={{ transition: 'background .12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.04)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ ...tdStyle, paddingLeft: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar initials={init} />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--premium-text)' }}>{name}</div>
                            {r.note && <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 1 }}>{r.note}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--premium-text)', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                          {(() => { const d = new Date(r.at); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; })()}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--premium-text)', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                          {(() => { const d = new Date(r.at); return `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`; })()}
                        </div>
                      </td>
                      <td style={tdStyle}>{r.type}</td>
                      <td style={{ ...tdStyle, color: 'var(--premium-text-3)' }}>{r.location}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '4px 9px', borderRadius: 999,
                          background: badge.bg, color: badge.color,
                          fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.3px',
                        }}>{badge.label}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', paddingRight: 18 }}>
                        <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                          {isLocalPastPending && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handlePresence(r.id, 'yes'); }} title="Marquer présent" style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(127,73,151,0.08)', border: '1px solid rgba(127,73,151,0.20)', color: '#7f4997', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Présent</button>
                              <button onClick={(e) => { e.stopPropagation(); handlePresence(r.id, 'no'); }} title="Marquer absent" style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', color: '#dc2626', fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Absent</button>
                            </>
                          )}
                          {r.uid && (
                            <button onClick={(e) => { e.stopPropagation(); openProfile(r.uid); }} style={{
                              padding: '5px 11px', borderRadius: 7,
                              background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.08)',
                              color: 'var(--premium-text-2)',
                              fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}>Voir fiche →</button>
                          )}
                          {/* v17.7.31 — Icône Modifier (crayon) — visible pour TOUS les RDV */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openExchange({
                                id: r.id,
                                jeuneUid: r.uid || undefined,
                                jeuneName: r.beneficiaireName || undefined,
                                dateTime: r.at,
                                location: typeof r.location === 'string' ? r.location : '',
                                objet: typeof r.type === 'string' ? r.type : 'Suivi',
                                notes: r.note || undefined,
                              });
                            }}
                            title="Modifier"
                            style={{
                              padding: 5, borderRadius: 6,
                              background: 'transparent', border: 'none',
                              color: 'var(--premium-text-4)', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7f4997'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--premium-text-4)'; }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          {/* Poubelle visible pour TOUS aussi */}
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: r.id, source: r.source, name: name }); }} title="Supprimer" style={{
                            padding: 5, borderRadius: 6,
                            background: 'transparent', border: 'none',
                            color: 'var(--premium-text-4)', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#dc2626'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--premium-text-4)'; }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* v17.7.31 — Modal de confirmation de suppression (style Impakt) */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Supprimer ce rendez-vous ?"
        message={confirmDelete ? `Le RDV avec ${confirmDelete.name} sera annulé. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete) {
            handleDelete(confirmDelete.id, confirmDelete.source);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
