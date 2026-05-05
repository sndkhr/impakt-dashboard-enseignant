'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { computeParcoursStatus, STATUS_CONFIG, formatDateFr, User } from '@/types';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { staggerDelay } from '@/lib/motion';
import { SpotlightCard, CountUp } from '@/components/ui/PremiumMotion';
import { useToast } from '@/components/ui/Toast';
import { markSent, isInCooldown, getRelanceCount, getDaysSinceSent, formatSince, snapshotSent, restoreSent, COOLDOWN_DAYS, NotifKind } from '@/lib/notifications';
import InviteRdvModal from '@/components/modals/InviteRdvModal';
import EmptyState from '@/components/ui/EmptyState';

/* ============================================================
   PAGE SUGGESTIONS — recap complet des actions recommandees
   avec liste DETAILLEE par categorie + actions en masse selective.
   Le conseiller peut cocher les jeunes, envoyer un rappel groupe, etc.
   ============================================================ */

const DAY_MS = 86400000;

type SuggestionKind = 'invite' | 'debloquer' | 'relancer';

// Couleurs raffinées (teintes atténuées, alignées avec le design premium)
const KIND_CONFIG: Record<SuggestionKind, {
  icon: string; color: string; title: string; hint: string; cta: string;
}> = {
  invite: { icon: '✓', color: '#059669', title: 'À inviter en RDV', hint: 'Ont fini leur test dans les 7 derniers jours', cta: 'Planifier un RDV' },
  debloquer: { icon: '!', color: '#b45309', title: 'Débloquer', hint: 'Test démarré, pas d\'activité depuis 3 jours ou +', cta: 'Envoyer un rappel' },
  relancer: { icon: '↻', color: '#be123c', title: 'À relancer', hint: 'Inactifs depuis 7 jours ou +', cta: 'Envoyer une relance' },
};

export default function SuggestionsPage() {
  const { data } = useAuth();
  const { openProfile } = useNav();
  const toast = useToast();
  const [activeKind, setActiveKind] = useState<SuggestionKind>('invite');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sentTick, setSentTick] = useState(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Skeleton min display 700ms
  const [minSkeletonElapsed, setMinSkeletonElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSkeletonElapsed(true), 700);
    return () => clearTimeout(t);
  }, []);

  const users = useMemo(() => data?.recentUsers || [], [data]);
  const now = Date.now();

  const buckets = useMemo(() => {
    const invite: User[] = [];
    const debloquer: User[] = [];
    const relancer: User[] = [];
    users.forEach(u => {
      const lastActive = u.lastActive ? new Date(u.lastActive).getTime() : 0;
      const inactDays = lastActive ? Math.floor((now - lastActive) / DAY_MS) : 999;
      const finishedAt = u.completedAt ? new Date(u.completedAt).getTime() : 0;
      const finishedDaysAgo = finishedAt ? Math.floor((now - finishedAt) / DAY_MS) : 999;
      // v17.8 — Seuils baissés pour avoir des candidats pertinents plus tôt :
      // débloquer = quiz commencé non terminé + 3 jours d'inactivité
      // relancer  = quiz fini il y a longtemps OU profil inactif depuis 7 jours
      if (!u.quizCompleted && u.quizStarted && inactDays >= 3) debloquer.push(u);
      else if (u.quizCompleted && finishedDaysAgo <= 7) invite.push(u);
      else if (u.quizStarted && inactDays >= 7) relancer.push(u);
    });
    return { invite, debloquer, relancer };
  }, [users, now]);

  const rawList = buckets[activeKind];
  const conf = KIND_CONFIG[activeKind];
  const notifKind: NotifKind | null = activeKind !== 'invite' ? (activeKind as NotifKind) : null;

  // Smart helpers : cooldown-based (pas de "sent" binaire permanent)
  const inCooldown = (u: User) => !!(notifKind && u.uid && isInCooldown(notifKind, u.uid));
  const relanceCount = (u: User) => notifKind && u.uid ? getRelanceCount(notifKind, u.uid) : 0;
  const daysSince = (u: User) => notifKind && u.uid ? getDaysSinceSent(notifKind, u.uid) : null;

  // Tri : a traiter en haut, en cooldown en bas
  const currentList = [...rawList].sort((a, b) => {
    const aCool = inCooldown(a) ? 1 : 0;
    const bCool = inCooldown(b) ? 1 : 0;
    return aCool - bCool;
  });
  // void sentTick pour que React re-render quand on change
  void sentTick;

  const toggleOne = (uid: string) => {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === currentList.length) setSelected(new Set());
    else setSelected(new Set(currentList.map(u => u.uid).filter((uid): uid is string => !!uid)));
  };

  const handleAction = () => {
    if (activeKind === 'invite') {
      // Ouvre le modal avec les candidats selectionnes (ou tous si aucune selection)
      setInviteModalOpen(true);
      return;
    }
    // Notifications groupées
    let uids: string[];
    if (selected.size > 0) {
      uids = Array.from(selected);
    } else {
      // Par defaut : tous ceux qui ne sont PAS en cooldown (a traiter)
      uids = currentList
        .filter(u => !inCooldown(u))
        .map(u => u.uid)
        .filter((uid): uid is string => !!uid);
    }
    if (uids.length === 0) { toast.show('Tous les bénéficiaires ont déjà été notifiés', 'info'); return; }
    // Snapshot avant markSent pour undo
    const kindTyped = activeKind as NotifKind;
    const snaps = snapshotSent(kindTyped, uids);
    markSent(kindTyped, uids);
    const verb = activeKind === 'debloquer' ? 'Rappel envoyé' : 'Relance envoyée';
    const s = uids.length > 1 ? 's' : '';
    toast.showUndo(
      `${verb}${s} à ${uids.length} bénéficiaire${s}`,
      () => {
        restoreSent(kindTyped, snaps);
        setSentTick(t => t + 1);
        toast.show('↶ Annulé', 'info');
      },
      5000,
    );
    setSelected(new Set());
    setSentTick(t => t + 1);
  };

  // Candidats a passer au modal : selection si non-vide, sinon tous ceux de la categorie
  const inviteCandidates = selected.size > 0
    ? buckets.invite.filter(u => u.uid && selected.has(u.uid))
    : buckets.invite;

  if (!data || !minSkeletonElapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
          borderRadius: 20, padding: '20px 22px',
          boxShadow: '0 4px 14px rgba(127,73,151,0.28)',
        }}>
          <div style={{ width: 120, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.20)', marginBottom: 10 }} />
          <div style={{ width: 90, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.26)', marginBottom: 8 }} />
          <div style={{ width: 220, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.16)' }} />
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.7)', borderRadius: 20,
          minHeight: 400, padding: 18,
        }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ width: 130, height: 28, borderRadius: 6, background: 'rgba(15,15,15,0.06)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.6s ease-in-out infinite' }} />)}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
              {[1, 2, 3, 4, 5, 6, 7].map(j => <div key={j} style={{ flex: 1, height: 12, borderRadius: 4, background: 'rgba(15,15,15,0.06)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.6s ease-in-out infinite' }} />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalSuggestions = buckets.invite.length + buckets.debloquer.length + buckets.relancer.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'pageFade .4s ease both' }}>

      {/* === Bandeau récap total === */}
      <SpotlightCard
        style={{
          background: 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
          color: '#ffffff',
          borderRadius: 20,
          padding: '20px 22px',
          boxShadow: '0 4px 14px rgba(127,73,151,0.28), 0 10px 30px rgba(232,67,147,0.22)',
          fontFamily: 'var(--font-display)',
        }}
        spotlightColor="rgba(255,255,255,0.10)"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Actions recommandées</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                <CountUp value={totalSuggestions} />
              </span>
              <span style={{ fontSize: 16, fontWeight: 500, opacity: 0.85, letterSpacing: '-0.01em' }}>
                {totalSuggestions > 1 ? 'suggestions' : 'suggestion'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8, letterSpacing: '-0.005em' }}>
              {buckets.invite.length} à inviter en RDV · {buckets.debloquer.length} à débloquer · {buckets.relancer.length} à relancer
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* === Card glass unique : tabs + toolbar + tableau === */}
      <div style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 20,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
        overflow: 'hidden',
      }}>
        {/* Tabs DANS la card avec border bottom */}
        <div style={{
          padding: '14px 18px 0',
          borderBottom: '1px solid rgba(15,15,15,0.06)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['invite', 'debloquer', 'relancer'] as const).map(k => {
              const c = KIND_CONFIG[k];
              const count = buckets[k].length;
              const active = activeKind === k;
              return (
                <button key={k} onClick={() => { setActiveKind(k); setSelected(new Set()); }}
                  style={{
                    padding: '8px 14px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: active ? '2px solid #E84393' : '2px solid transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 7,
                    transition: 'all .18s ease',
                    marginBottom: -1,
                  }}>
                  <span style={{
                    fontSize: 12.5, fontWeight: active ? 700 : 500,
                    color: active ? 'var(--premium-text)' : 'var(--premium-text-3)',
                    letterSpacing: '-0.2px',
                  }}>{c.title}</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 999,
                    background: active ? `${c.color}15` : 'rgba(15,15,15,0.05)',
                    color: active ? c.color : 'var(--premium-text-4)',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 18, textAlign: 'center',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--premium-text-4)', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{conf.hint}</span>
            {notifKind && (
              <span
                title={`Chaque jeune relancé reste "traité" pendant ${COOLDOWN_DAYS[notifKind]} jours. Au-delà, s'il n'a toujours pas bougé, il réapparaît ici avec un badge "2ème relance" pour que tu puisses changer d'approche.`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px', borderRadius: 999,
                  background: 'rgba(127,73,151,0.06)',
                  border: '1px solid rgba(127,73,151,0.14)',
                  color: '#7f4997',
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: '-0.05px',
                  cursor: 'help',
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Nouvelle relance possible après {COOLDOWN_DAYS[notifKind]}j · actualisé auto.
              </span>
            )}
          </div>
        </div>
        {/* Toolbar avec actions en masse */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid rgba(15,15,15,0.06)',
          gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox"
                checked={selected.size === currentList.length && currentList.length > 0}
                onChange={toggleAll}
                style={{ width: 14, height: 14, accentColor: '#E84393', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--premium-text-2)', fontWeight: 500 }}>Tout sélectionner</span>
            </label>
            {selected.size > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#7f4997',
                background: 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))',
                padding: '3px 10px', borderRadius: 999,
              }}>{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
            )}
          </div>
          {(() => {
            const remainingCount = currentList.filter(u => !inCooldown(u)).length;
            const disabled = activeKind !== 'invite' && remainingCount === 0;
            const btnText = activeKind === 'invite'
              ? conf.cta
              : selected.size > 0
                ? `${conf.cta} (${selected.size})`
                : disabled
                  ? 'Tous notifiés ✓'
                  : `${conf.cta} (tous les ${remainingCount})`;
            return (
              <button
                onClick={handleAction}
                disabled={disabled}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  background: disabled
                    ? 'rgba(15,15,15,0.05)'
                    : 'linear-gradient(135deg, #7f4997, #E84393)',
                  color: disabled ? 'var(--premium-text-4)' : '#ffffff',
                  border: 'none',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  cursor: disabled ? 'default' : 'pointer',
                  boxShadow: disabled ? 'none' : '0 2px 8px rgba(232,67,147,0.25)',
                  transition: 'all .15s ease',
                }}>
                {btnText}
              </button>
            );
          })()}
        </div>

        {/* Liste détaillée */}
        {currentList.length === 0 ? (
          <div style={{ padding: '20px 14px' }}>
            <EmptyState
              iconKind={activeKind === 'invite' ? 'calendar' : activeKind === 'debloquer' ? 'sparkle' : 'check'}
              title={
                activeKind === 'invite' ? 'Aucun jeune à inviter cette semaine'
                : activeKind === 'debloquer' ? 'Personne de bloqué'
                : 'Tous tes bénéficiaires sont engagés'
              }
              description={
                activeKind === 'invite' ? 'Dès qu\'un bénéficiaire termine son test d\'orientation IMPAKT, il apparaîtra ici pour que tu puisses planifier un RDV.'
                : activeKind === 'debloquer' ? 'Aucun bénéficiaire n\'est bloqué depuis 5 jours ou plus. Bon travail !'
                : 'Aucun bénéficiaire inactif depuis 14 jours ou plus.'
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: 44, padding: '11px 10px 11px 18px', borderBottom: '1px solid rgba(15,15,15,0.06)' }}></th>
                  {(() => {
                    const cols = ['Nom', 'Prénom', 'Âge', 'Statut', 'Inscription', 'Dernière activité', 'Progrès'];
                    // Colonne "Dernière relance" uniquement pour les kinds notifiables (debloquer / relancer)
                    if (notifKind) cols.push('Dernière relance');
                    return cols;
                  })().map(h => (
                    <th key={h} style={{
                      padding: '11px 10px', fontSize: 10, fontWeight: 700,
                      color: 'var(--premium-text-4)',
                      textAlign: h === 'Dernière relance' ? 'center' : 'left',
                      textTransform: 'uppercase', letterSpacing: '.5px',
                      borderBottom: '1px solid rgba(15,15,15,0.06)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                  <th style={{ width: 90, padding: '11px 24px 11px 10px', borderBottom: '1px solid rgba(15,15,15,0.06)' }}></th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((u, i) => {
                  const st = computeParcoursStatus(u);
                  const stConf = STATUS_CONFIG[st];
                  const prog = u.quizProgress ?? 0;
                  const inscDate = u.inscriptionDate ? formatDateFr(u.inscriptionDate) : '—';
                  const lastDate = u.lastActive ? formatLastActivite(u.lastActive) : '—';
                  const isSelected = u.uid ? selected.has(u.uid) : false;
                  const cool = inCooldown(u);
                  const count = relanceCount(u);
                  const since = daysSince(u);
                  const ordinal = (n: number) => n === 1 ? '1ère' : `${n}ème`;

                  return (
                    <tr key={i}
                      style={{
                        background: cool
                          ? 'rgba(16,185,129,0.05)'
                          : isSelected
                            ? 'rgba(127,73,151,0.04)'
                            : 'transparent',
                        animation: `stagger-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
                        animationDelay: staggerDelay(i, 35, 10),
                        transition: 'background .12s ease',
                      }}
                      onMouseEnter={e => { if (!isSelected && !cool) (e.currentTarget as HTMLElement).style.background = 'rgba(15,15,15,0.02)'; }}
                      onMouseLeave={e => { if (!isSelected && !cool) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '10px 10px 10px 18px', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                        {cool ? (
                          <div title={`Relancé ${formatSince(since)} · réapparaîtra dans ${Math.max(1, COOLDOWN_DAYS[notifKind!] - (since || 0))}j si toujours bloqué`} style={{
                            color: '#047857',
                            display: 'flex', alignItems: 'center',
                          }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : (
                          <input type="checkbox"
                            checked={isSelected}
                            onChange={() => { if (u.uid) toggleOne(u.uid); }}
                            style={{ width: 14, height: 14, accentColor: '#E84393', cursor: 'pointer' }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12.5, borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--premium-text)' }}>{u.nom || '—'}</span>
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12.5, color: 'var(--premium-text-2)', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                        {u.prenom || '—'}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--premium-text-2)', borderBottom: '1px solid rgba(15,15,15,0.04)', fontVariantNumeric: 'tabular-nums' }}>
                        {u.age || '—'}
                      </td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(15,15,15,0.04)' }}>
                        <Badge label={stConf.label} className={stConf.className} />
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 11.5, color: 'var(--premium-text-3)', borderBottom: '1px solid rgba(15,15,15,0.04)', whiteSpace: 'nowrap' }}>
                        {inscDate}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 11.5, color: 'var(--premium-text-3)', borderBottom: '1px solid rgba(15,15,15,0.04)', whiteSpace: 'nowrap' }}>
                        {lastDate}
                      </td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(15,15,15,0.04)', width: 110 }}>
                        <ProgressBar value={prog} />
                      </td>
                      {/* Colonne "Dernière relance" — badge centré, même style que
                          l'ancien tag à côté du nom. Compteur d'envois en tooltip. */}
                      {notifKind && (
                        <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(15,15,15,0.04)', textAlign: 'center' }}>
                          {count === 0 ? (
                            <span style={{ color: 'var(--premium-text-4)', fontSize: 11.5 }}>—</span>
                          ) : (
                            <span
                              title={`Déjà relancé ${count} fois${since !== null ? ` · dernière ${formatSince(since)}` : ''}`}
                              style={{
                                display: 'inline-block',
                                fontSize: 8.5, fontWeight: 700,
                                padding: '3px 7px', borderRadius: 4,
                                background: 'rgba(180,83,9,0.10)',
                                color: '#b45309',
                                border: '1px solid rgba(180,83,9,0.20)',
                                letterSpacing: '0.2px',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                                cursor: 'help',
                              }}
                            >
                              {ordinal(count + 1)} relance
                            </span>
                          )}
                        </td>
                      )}
                      <td style={{ padding: '10px 24px 10px 10px', borderBottom: '1px solid rgba(15,15,15,0.04)', textAlign: 'right' }}>
                        <button onClick={() => u.uid && openProfile(u.uid)}
                          style={{
                            padding: '6px 12px', borderRadius: 8,
                            background: 'rgba(127,73,151,0.06)',
                            border: '1px solid rgba(127,73,151,0.15)',
                            color: '#7f4997',
                            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                            transition: 'all .12s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.12)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,73,151,0.06)'; }}
                        >Voir ›</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Planifier RDV — pris la selection en compte, ou tous les candidats si rien coche */}
      <InviteRdvModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        candidates={inviteCandidates}
        onScheduled={() => toast.show('✓ RDV planifié', 'success')}
      />
    </div>
  );
}

function formatLastActivite(d?: string | null): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
  if (diff < 7 * 86400000) return `il y a ${Math.floor(diff / 86400000)} j`;
  return formatDateFr(d);
}
