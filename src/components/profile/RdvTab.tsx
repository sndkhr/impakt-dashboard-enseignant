'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  listJeuneRendezvousAPI,
  updateRendezvousAPI,
  BackendRendezvousFull,
} from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

// =====================================================
// RdvTab v1.0 — Onglet "Rendez-vous" de la fiche jeune
//
// Affiche pour le bénéficiaire :
//   • Liste de tous ses RDV (à venir + passés) avec statut
//   • Pour chaque RDV : récap (date, lieu, objet, motif jeune)
//   • Notes privées du conseiller (sauvegardées via PATCH /rendezvous/:id)
//   • Questions à poser pendant le RDV (idem, sauvegardé)
//   • Possibilité de modifier date / lieu / objet
// =====================================================

interface Props {
  jeuneUid: string;
  jeunePrenom: string;
}

function statusBadge(s: string) {
  switch (s) {
    case 'pending':   return { label: 'En attente', bg: 'rgba(180,83,9,0.10)', color: '#b45309' };
    case 'accepted':  return { label: 'Confirmé',   bg: 'rgba(16,185,129,0.12)', color: '#047857' };
    case 'declined':  return { label: 'Refusé',     bg: 'rgba(220,38,38,0.10)', color: '#dc2626' };
    case 'cancelled': return { label: 'Annulé',     bg: 'rgba(15,15,15,0.06)', color: '#525252' };
    default:          return { label: s,            bg: 'rgba(15,15,15,0.04)', color: 'var(--premium-text-4)' };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RdvTab({ jeuneUid, jeunePrenom }: Props) {
  const { token } = useAuth();
  const toast = useToast();
  const [rdvs, setRdvs] = useState<BackendRendezvousFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state pour notes/questions/date/lieu (par RDV en cours d'édition)
  const [draftNotes, setDraftNotes] = useState('');
  const [draftQuestions, setDraftQuestions] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('10:00');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftObjet, setDraftObjet] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRdvs = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listJeuneRendezvousAPI(token, jeuneUid);
      setRdvs(result.rendezvous);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRdvs();
    // v17.7.32 — Refresh immédiat quand un RDV est créé/modifié
    const onRdvChanged = () => { fetchRdvs(); };
    window.addEventListener('rdv:changed', onRdvChanged);
    return () => { window.removeEventListener('rdv:changed', onRdvChanged); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, jeuneUid]);

  const upcoming = useMemo(() =>
    rdvs.filter(r => r.dateTime && new Date(r.dateTime).getTime() > Date.now()),
  [rdvs]);
  const past = useMemo(() =>
    rdvs.filter(r => !r.dateTime || new Date(r.dateTime).getTime() <= Date.now()),
  [rdvs]);

  const startEdit = (r: BackendRendezvousFull) => {
    setEditingId(r.id);
    setDraftNotes(r.conseillerNotes || '');
    setDraftQuestions(r.questions || '');
    if (r.dateTime) {
      const d = new Date(r.dateTime);
      setDraftDate(d.toISOString().split('T')[0]);
      setDraftTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }
    setDraftLocation(r.location || '');
    setDraftObjet(r.objet || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (rdvId: string) => {
    if (!token) return;
    setSaving(true);
    try {
      const dt = new Date(`${draftDate}T${draftTime}:00`);
      await updateRendezvousAPI(token, rdvId, {
        dateTime: dt.toISOString(),
        location: draftLocation,
        objet: draftObjet,
        conseillerNotes: draftNotes,
        questions: draftQuestions,
      });
      toast.show('Modifications enregistrées', 'success');
      setEditingId(null);
      await fetchRdvs();
    } catch (e) {
      toast.show(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Sauvegarde rapide notes seules (sans toucher la date/lieu)
  const saveNotesQuick = async (rdvId: string, notes: string, questions: string) => {
    if (!token) return;
    try {
      await updateRendezvousAPI(token, rdvId, {
        conseillerNotes: notes,
        questions: questions,
      });
      toast.show('Notes enregistrées', 'success');
      await fetchRdvs();
    } catch (e) {
      toast.show(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`, 'error');
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 13 }}>
      Chargement des rendez-vous…
    </div>
  );

  if (error) return (
    <div style={{ padding: 20, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)', borderRadius: 12, color: '#991b1b', fontSize: 12.5 }}>
      Erreur : {error}
    </div>
  );

  if (rdvs.length === 0) return (
    <div style={{
      padding: '48px 24px', textAlign: 'center', borderRadius: 14,
      background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--premium-text)', marginBottom: 6 }}>
        Aucun rendez-vous pour {jeunePrenom}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--premium-text-4)' }}>
        Planifie un RDV depuis la page « Rendez-vous » ou depuis cette fiche.
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {upcoming.length > 0 && (
        <Section title="À venir" count={upcoming.length}>
          {upcoming.map(r => (
            <RdvCard
              key={r.id}
              rdv={r}
              isEditing={editingId === r.id}
              onStartEdit={() => startEdit(r)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(r.id)}
              onSaveNotesQuick={(n, q) => saveNotesQuick(r.id, n, q)}
              draftDate={draftDate} setDraftDate={setDraftDate}
              draftTime={draftTime} setDraftTime={setDraftTime}
              draftLocation={draftLocation} setDraftLocation={setDraftLocation}
              draftObjet={draftObjet} setDraftObjet={setDraftObjet}
              draftNotes={draftNotes} setDraftNotes={setDraftNotes}
              draftQuestions={draftQuestions} setDraftQuestions={setDraftQuestions}
              saving={saving}
            />
          ))}
        </Section>
      )}
      {past.length > 0 && (
        <Section title="Passés" count={past.length}>
          {past.map(r => (
            <RdvCard
              key={r.id}
              rdv={r}
              isEditing={editingId === r.id}
              onStartEdit={() => startEdit(r)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(r.id)}
              onSaveNotesQuick={(n, q) => saveNotesQuick(r.id, n, q)}
              draftDate={draftDate} setDraftDate={setDraftDate}
              draftTime={draftTime} setDraftTime={setDraftTime}
              draftLocation={draftLocation} setDraftLocation={setDraftLocation}
              draftObjet={draftObjet} setDraftObjet={setDraftObjet}
              draftNotes={draftNotes} setDraftNotes={setDraftNotes}
              draftQuestions={draftQuestions} setDraftQuestions={setDraftQuestions}
              saving={saving}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>
          {title}
        </span>
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
          background: 'rgba(15,15,15,0.05)', color: 'var(--premium-text-4)',
        }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

interface RdvCardProps {
  rdv: BackendRendezvousFull;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onSaveNotesQuick: (notes: string, questions: string) => void;
  draftDate: string; setDraftDate: (v: string) => void;
  draftTime: string; setDraftTime: (v: string) => void;
  draftLocation: string; setDraftLocation: (v: string) => void;
  draftObjet: string; setDraftObjet: (v: string) => void;
  draftNotes: string; setDraftNotes: (v: string) => void;
  draftQuestions: string; setDraftQuestions: (v: string) => void;
  saving: boolean;
}

function RdvCard(props: RdvCardProps) {
  const { rdv, isEditing, onStartEdit, onCancelEdit, onSaveEdit,
          draftDate, setDraftDate, draftTime, setDraftTime,
          draftLocation, setDraftLocation, draftObjet, setDraftObjet,
          draftNotes, setDraftNotes, draftQuestions, setDraftQuestions, saving } = props;
  const badge = statusBadge(rdv.status);
  const isJeuneRequest = rdv.requestedBy === 'jeune';

  // Notes locales pour la sauvegarde rapide quand on n'est pas en mode édition
  const [localNotes, setLocalNotes] = useState(rdv.conseillerNotes || '');
  const [localQuestions, setLocalQuestions] = useState(rdv.questions || '');
  useEffect(() => {
    setLocalNotes(rdv.conseillerNotes || '');
    setLocalQuestions(rdv.questions || '');
  }, [rdv.conseillerNotes, rdv.questions]);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 14,
      padding: 16,
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 4px 14px rgba(15,15,15,0.04)',
    }}>
      {/* Récap header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>
              {rdv.objet || 'Rendez-vous'}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '3px 8px', borderRadius: 999,
              background: badge.bg, color: badge.color,
              textTransform: 'uppercase', letterSpacing: '0.3px',
            }}>{badge.label}</span>
            {isJeuneRequest && (
              <span style={{
                fontSize: 9.5, fontWeight: 700,
                padding: '2px 6px', borderRadius: 4,
                background: 'linear-gradient(90deg, #7f4997, #E84393)', color: '#fff',
                letterSpacing: '0.3px',
              }}>DEMANDE JEUNE</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--premium-text-3)', marginBottom: 2 }}>
            📅 {formatDate(rdv.dateTime)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--premium-text-3)' }}>
            📍 {rdv.location || '—'}
          </div>
          {rdv.notes && (
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(127,73,151,0.04)', border: '1px solid rgba(127,73,151,0.10)',
              fontSize: 11.5, color: 'var(--premium-text-3)', fontStyle: 'italic',
            }}>
              <strong style={{ fontStyle: 'normal' }}>Note du candidat : </strong>« {rdv.notes} »
            </div>
          )}
        </div>
        {!isEditing && (
          <button onClick={onStartEdit} style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.10)',
            color: 'var(--premium-text-2)',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>Modifier</button>
        )}
      </div>

      {/* Mode édition complète : date / lieu / objet */}
      {isEditing && (
        <div style={{
          padding: 12, marginBottom: 12, borderRadius: 10,
          background: 'rgba(127,73,151,0.04)', border: '1px solid rgba(127,73,151,0.15)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div>
            <Label>Objet</Label>
            <input type="text" value={draftObjet} onChange={e => setDraftObjet(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label>Date</Label>
              <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <Label>Heure</Label>
              <input type="time" value={draftTime} onChange={e => setDraftTime(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <Label>Lieu</Label>
            <input type="text" value={draftLocation} onChange={e => setDraftLocation(e.target.value)} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Notes du conseiller (toujours visibles) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <Label>Notes du conseiller (privées)</Label>
          <textarea
            value={isEditing ? draftNotes : localNotes}
            onChange={e => (isEditing ? setDraftNotes(e.target.value) : setLocalNotes(e.target.value))}
            placeholder="Ce que tu veux retenir de ce RDV, points abordés, prochaines étapes…"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' as const, fontSize: 12.5 }}
          />
        </div>

        <div>
          <Label>Questions à poser pendant le RDV</Label>
          <textarea
            value={isEditing ? draftQuestions : localQuestions}
            onChange={e => (isEditing ? setDraftQuestions(e.target.value) : setLocalQuestions(e.target.value))}
            placeholder="• Comment se passe ta recherche ?&#10;• As-tu des pistes en tête ?&#10;• Sur quoi as-tu besoin d'aide ?"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' as const, fontSize: 12.5 }}
          />
        </div>

        {/* Boutons d'action */}
        {isEditing ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onCancelEdit} disabled={saving} style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'transparent', border: '1px solid rgba(15,15,15,0.10)',
              color: 'var(--premium-text-3)',
              fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>Annuler</button>
            <button onClick={onSaveEdit} disabled={saving} className="btn-gradient" style={{
              padding: '8px 18px', borderRadius: 8,
              fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => props.onSaveNotesQuick(localNotes, localQuestions)} style={{
              padding: '7px 14px', borderRadius: 8,
              background: 'rgba(127,73,151,0.06)', border: '1px solid rgba(127,73,151,0.20)',
              color: '#7f4997',
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}>Enregistrer les notes</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 10.5, fontWeight: 600, color: 'var(--premium-text-3)',
      textTransform: 'uppercase', letterSpacing: '0.4px',
      marginBottom: 6,
    }}>{children}</label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid rgba(15,15,15,0.10)',
  borderRadius: 9,
  background: '#ffffff',
  fontSize: 13, fontFamily: 'inherit',
  color: 'var(--premium-text)', outline: 'none',
};
