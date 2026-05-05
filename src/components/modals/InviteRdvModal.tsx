'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User } from '@/types';
import { useAuth } from '@/lib/auth';
import { createRendezvousAPI } from '@/lib/api';

const LS_SCHEDULED = 'impakt_scheduled_rdvs_v1';

interface ScheduledRdv {
  uid: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: 'tel' | 'rdv';
  scheduledAt: string; // ISO
  rdvId?: string;
}

export function getScheduledRdvs(): Record<string, ScheduledRdv> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_SCHEDULED);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveScheduledRdv(rdv: ScheduledRdv) {
  if (typeof window === 'undefined') return;
  try {
    const all = getScheduledRdvs();
    all[rdv.uid] = rdv;
    localStorage.setItem(LS_SCHEDULED, JSON.stringify(all));
  } catch { /* silent */ }
}

interface Props {
  open: boolean;
  onClose: () => void;
  candidates: User[];
  onScheduled?: () => void;
}

export default function InviteRdvModal({ open, onClose, candidates, onScheduled }: Props) {
  const { token, data: dashboardData } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [schedulingUser, setSchedulingUser] = useState<User | null>(null);
  const [scheduled, setScheduled] = useState<Record<string, ScheduledRdv>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form fields quand on planifie un user specific
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [type, setType] = useState<'tel' | 'rdv'>('rdv');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (open) {
      setScheduled(getScheduledRdvs());
      setSchedulingUser(null);
      setSelected(new Set());
      const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
      setDate(tmr.toISOString().split('T')[0]);
      setTime('10:00');
      setType('rdv');
      setNote('');
      setLocation('');
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [open]);

  const toggleOne = (uid: string) => {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setSelected(next);
  };

  // Lock scroll du body tant que le modal est ouvert → le fond reste fixe
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Tri intelligent : non-planifies en premier, planifies en bas
  const sortedCandidates = [...candidates].sort((a, b) => {
    const aSched = a.uid && scheduled[a.uid] ? 1 : 0;
    const bSched = b.uid && scheduled[b.uid] ? 1 : 0;
    return aSched - bSched;
  });

  if (!open || !mounted) return null;

  const handleConfirmSchedule = async () => {
    if (!schedulingUser?.uid) return;
    if (!token) {
      setErrorMsg("Session expirée, reconnecte-toi.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      // Compose ISO dateTime avec fuseau Paris (+02:00 été / +01:00 hiver : on laisse le navigateur gérer via toISOString)
      const [hh, mm] = time.split(':').map(Number);
      const dt = new Date(date);
      dt.setHours(hh || 10, mm || 0, 0, 0);
      const iso = dt.toISOString();

      const locationLabel = type === 'tel'
        ? 'Appel téléphonique'
        : (location.trim() || 'Agence France Travail');
      const objetLabel = note.trim() || (type === 'tel' ? 'Appel de suivi' : 'Rendez-vous de suivi');

      const result = await createRendezvousAPI(token, {
        jeuneUid: schedulingUser.uid,
        dateTime: iso,
        location: locationLabel,
        objet: objetLabel,
        notes: note.trim() || undefined,
        conseillerName: dashboardData?.conseillerName || undefined,
      });

      if (!result.success) throw new Error(result.error || 'Erreur inconnue');

      saveScheduledRdv({
        uid: schedulingUser.uid,
        date, time, type,
        scheduledAt: new Date().toISOString(),
        rdvId: result.rdvId,
      });
      setScheduled(getScheduledRdvs());
      setSchedulingUser(null);
      onScheduled?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création du RDV';
      setErrorMsg(msg === 'UNAUTHORIZED' ? 'Session expirée, reconnecte-toi.' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const remainingCount = candidates.filter(u => u.uid && !scheduled[u.uid]).length;
  const scheduledCount = candidates.filter(u => u.uid && scheduled[u.uid]).length;

  return createPortal(
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,15,15,0.45)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      animation: 'fi .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560,
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 10px 60px rgba(15,15,15,0.25), 0 24px 80px rgba(127,73,151,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.85)',
        animation: 'stagger-in .2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        fontFamily: 'var(--font-display)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid rgba(15,15,15,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px' }}>
              {schedulingUser ? `Planifier un RDV avec ${schedulingUser.prenom} ${schedulingUser.nom}` : 'Planifier un RDV'}
            </div>
            {!schedulingUser && (
              <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', marginTop: 3 }}>
                {candidates.length} bénéficiaire{candidates.length > 1 ? 's' : ''} ont terminé leur test · {scheduledCount} déjà planifié{scheduledCount > 1 ? 's' : ''}
              </div>
            )}
          </div>
          <button onClick={schedulingUser ? () => setSchedulingUser(null) : onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(15,15,15,0.08)',
              background: 'rgba(15,15,15,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13, color: 'var(--premium-text-3)',
            }}>{schedulingUser ? '‹' : '✕'}</button>
        </div>

        {/* Body */}
        {!schedulingUser ? (
          /* LIST MODE — tous les candidats avec check pour ceux deja planifies */
          <div style={{ padding: 14, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {candidates.length === 0 && (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 13 }}>
                Aucun bénéficiaire à inviter pour le moment
              </div>
            )}
            {sortedCandidates.map((u) => {
              const isScheduled = !!(u.uid && scheduled[u.uid]);
              const rdv = u.uid ? scheduled[u.uid] : null;
              const isSelected = u.uid ? selected.has(u.uid) : false;
              return (
                <div key={u.uid || u.nom} style={{
                  padding: '11px 14px', borderRadius: 11,
                  background: isScheduled
                    ? 'rgba(16,185,129,0.08)'
                    : isSelected
                      ? 'linear-gradient(135deg, rgba(127,73,151,0.06), rgba(232,67,147,0.06))'
                      : 'rgba(15,15,15,0.02)',
                  border: isScheduled
                    ? '1px solid rgba(16,185,129,0.25)'
                    : isSelected
                      ? '1px solid rgba(232,67,147,0.28)'
                      : '1px solid rgba(15,15,15,0.06)',
                  display: 'flex', alignItems: 'center', gap: 11,
                  transition: 'all .15s',
                }}>
                  {/* Avatar initiales */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isScheduled
                      ? 'rgba(16,185,129,0.15)'
                      : 'linear-gradient(135deg, rgba(127,73,151,0.12), rgba(232,67,147,0.10))',
                    color: isScheduled ? '#047857' : '#7f4997',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.3px',
                  }}>{(u.prenom?.[0] || '?').toUpperCase()}{(u.nom?.[0] || '').toUpperCase()}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--premium-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.prenom} {u.nom}
                    </div>
                    <div style={{ fontSize: 10.5, color: isScheduled ? '#047857' : 'var(--premium-text-4)', marginTop: 1 }}>
                      {isScheduled && rdv
                        ? `RDV prévu le ${new Date(rdv.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${rdv.time}`
                        : 'A terminé son test · à inviter'}
                    </div>
                  </div>

                  {/* Custom checkbox (uniquement si non-planifie) */}
                  {!isScheduled && u.uid && (
                    <button onClick={(e) => { e.stopPropagation(); if (u.uid) toggleOne(u.uid); }}
                      aria-label={isSelected ? 'Désélectionner' : 'Sélectionner'}
                      style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: isSelected ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'transparent',
                        border: isSelected ? 'none' : '1.5px solid rgba(127,73,151,0.30)',
                        color: isSelected ? '#ffffff' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, cursor: 'pointer', flexShrink: 0,
                        transition: 'all .15s ease',
                        boxShadow: isSelected ? '0 2px 5px rgba(232,67,147,0.25)' : 'none',
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10, opacity: isSelected ? 1 : 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  )}

                  {/* Coche verte foncee SEULE si planifie */}
                  {isScheduled && (
                    <div title="RDV planifié" style={{
                      display: 'flex', alignItems: 'center',
                      color: '#047857', flexShrink: 0,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}

                  {/* CTA Planifier (si non-planifie) */}
                  {!isScheduled && (
                    <button onClick={() => setSchedulingUser(u)}
                      style={{
                        padding: '7px 12px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #7f4997, #E84393)',
                        color: '#ffffff', border: 'none',
                        fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                        cursor: 'pointer', flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(232,67,147,0.20)',
                      }}>Planifier</button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* FORM MODE — pour le user selectionne */
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Type d&apos;échange</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['rdv', 'tel'] as const).map(t => {
                  const active = type === t;
                  const lbl = t === 'rdv' ? 'RDV en présentiel' : 'Appel téléphonique';
                  return (
                    <button key={t} onClick={() => setType(t)}
                      style={{
                        flex: 1, padding: '10px 14px',
                        border: active ? '1.5px solid rgba(232,67,147,0.35)' : '1px solid rgba(15,15,15,0.10)',
                        background: active ? 'linear-gradient(135deg, rgba(127,73,151,0.06), rgba(232,67,147,0.06))' : '#ffffff',
                        color: active ? '#7f4997' : 'var(--premium-text-3)',
                        borderRadius: 10,
                        fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                      }}>{lbl}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Heure</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {type === 'rdv' && (
              <div>
                <label style={labelStyle}>Lieu</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="Ex : Agence France Travail Paris 15 - 20 rue de la Paix"
                  style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Objet / Note (optionnel)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : bilan du test IMPAKT"
                style={inputStyle} />
            </div>
            {errorMsg && (
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#b91c1c', fontSize: 12, fontWeight: 500,
              }}>{errorMsg}</div>
            )}
          </div>
        )}

        {/* Footer */}
        {schedulingUser && (
          <div style={{
            padding: '14px 22px', borderTop: '1px solid rgba(15,15,15,0.06)',
            display: 'flex', gap: 8, justifyContent: 'flex-end',
          }}>
            <button onClick={() => setSchedulingUser(null)}
              disabled={submitting}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'transparent', border: '1px solid rgba(15,15,15,0.10)',
                color: 'var(--premium-text-3)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
              }}>Retour</button>
            <button onClick={handleConfirmSchedule}
              disabled={submitting}
              style={{
                padding: '10px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, #7f4997, #E84393)',
                color: '#ffffff', border: 'none',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(232,67,147,0.25)',
              }}>{submitting ? 'Envoi…' : 'Confirmer le RDV'}</button>
          </div>
        )}

        {!schedulingUser && candidates.length > 0 && (
          <div style={{
            padding: '12px 22px', borderTop: '1px solid rgba(15,15,15,0.06)',
            fontSize: 11, color: 'var(--premium-text-4)',
            textAlign: 'center',
          }}>
            {remainingCount} RDV{remainingCount > 1 ? 's' : ''} à planifier · {scheduledCount} déjà fait{scheduledCount > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10.5, fontWeight: 600, color: 'var(--premium-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.4px',
  marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid rgba(15,15,15,0.10)',
  borderRadius: 10,
  background: '#ffffff',
  fontSize: 13, fontFamily: 'inherit',
  color: 'var(--premium-text)', outline: 'none',
};
