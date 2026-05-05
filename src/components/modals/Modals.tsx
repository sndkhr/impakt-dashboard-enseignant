'use client';

import { useState, useEffect, ReactNode } from 'react';
import { RdvType, RdvLocation } from '@/lib/scheduledRdv';
import { createRendezvousAPI, updateRendezvousAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useModals } from '@/lib/modals';
import { GlassDatePicker, GlassTimePicker } from '@/components/ui/GlassDatePicker';

// ====== MODAL WRAPPER ======

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 10, fontFamily: 'inherit', fontSize: 12, color: 'var(--premium-text)', outline: 'none',
  background: 'rgba(255,255,255,0.6)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: 'rgba(255,255,255,0.55)', cursor: 'pointer' };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--premium-text-3)', marginBottom: 6, display: 'block' };


function ModalShell({ open, title, onClose, children, footer, successContent }: {
  open: boolean; title: string; onClose: () => void;
  children: ReactNode; footer: ReactNode; successContent?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,15,15,0.45)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fi .2s ease',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 10px 60px rgba(15,15,15,0.25), 0 24px 80px rgba(127,73,151,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.85)',
        animation: 'stagger-in .2s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        {/* Head */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid rgba(15,15,15,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px' }}>{title}</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(15,15,15,0.08)',
            background: 'rgba(15,15,15,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 13, color: 'var(--premium-text-3)',
            transition: 'background .12s',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(15,15,15,0.08)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(15,15,15,0.04)'}
          >✕</button>
        </div>

        {successContent || (
          <>
            <div style={{ padding: '22px 24px' }}>{children}</div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(15,15,15,0.06)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {footer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TypeBtn({ selected, onClick, icon, label }: {
  selected: boolean; onClick: () => void; icon: ReactNode; label: string;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '16px 12px', border: selected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
      borderRadius: 12, background: selected ? 'rgba(142,68,173,.04)' : 'var(--white)',
      color: selected ? 'var(--accent)' : 'var(--text-700)',
      fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
    }}>
      {icon}
      {label}
    </button>
  );
}

function SuccessMessage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', background: '#ecfdf5',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" style={{ width: 24, height: 24 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--premium-text)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--premium-text-3)' }}>{subtitle}</div>
    </div>
  );
}

// ====== PLANIFIER UN ÉCHANGE ======

// v17.7.29 — Sandra : nouvelle liste épurée des types de RDV
const RDV_TYPES: RdvType[] = [
  'Suivi',
  'Point d\'étape',
  'Bilan test IMPAKT',
  'Point formations',
  'Premier entretien',
  'Autre',
];

// Lieux avec majuscule à l'affichage (mapping label propre)
const LOCATION_LABELS: { value: RdvLocation; label: string }[] = [
  { value: 'en agence',          label: 'En agence' },
  { value: 'en visio',           label: 'En visio' },
  { value: 'au téléphone',       label: 'Au téléphone' },
  { value: 'sur site partenaire', label: 'Sur site partenaire' },
];

export function ExchangeModal({ open, onClose, users }: {
  open: boolean; onClose: () => void; users: Array<{ uid: string; nom: string; prenom: string }>;
}) {
  const { token, data: dashboardData } = useAuth();
  const { editingRdv } = useModals();
  const isEditMode = !!editingRdv;
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [rdvType, setRdvType] = useState<RdvType>('Suivi');
  const [location, setLocation] = useState<RdvLocation>('en agence');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');

  // Reset au open / pré-remplir si mode édition
  useEffect(() => {
    if (open) {
      if (editingRdv) {
        // v17.7.30 — Mode édition : pré-remplit avec les données du RDV
        const d = new Date(editingRdv.dateTime);
        setDate(d.toISOString().split('T')[0]);
        setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
        setRdvType((editingRdv.objet || 'Suivi') as RdvType);
        // Map le label du lieu vers la valeur ENUM
        const locValue = LOCATION_LABELS.find(l => l.label.toLowerCase() === (editingRdv.location || '').toLowerCase())?.value
                      || LOCATION_LABELS.find(l => l.value.toLowerCase() === (editingRdv.location || '').toLowerCase())?.value
                      || 'en agence';
        setLocation(locValue);
        setNote(editingRdv.notes || '');
        setSelectedUid(editingRdv.jeuneUid || '');
        setSearch(editingRdv.jeuneName || '');
      } else {
        const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        setDate(tmr.toISOString().split('T')[0]);
        setRdvType('Suivi');
        setLocation('en agence');
        setTime('10:00');
        setNote('');
        setSearch('');
        if (users.length > 0) setSelectedUid(users[0].uid);
      }
      setSuccess(false);
      setSubmitting(false);
      setErrorMsg(null);
    }
  }, [open, users, editingRdv]);

  // Filtrer users par recherche
  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.prenom || '').toLowerCase().includes(q) || (u.nom || '').toLowerCase().includes(q);
  }).slice(0, 50);

  const selectedUser = users.find(u => u.uid === selectedUid);

  const handleSend = async () => {
    if (!token) {
      setErrorMsg("Session expirée — reconnecte-toi.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const dt = new Date(`${date}T${time}:00`);
      const iso = dt.toISOString();
      const locLabel = LOCATION_LABELS.find(l => l.value === location)?.label || location;

      if (isEditMode && editingRdv) {
        // v17.7.30 — Mode édition : PATCH /rendezvous/:id
        await updateRendezvousAPI(token, editingRdv.id, {
          dateTime: iso,
          location: locLabel,
          objet: rdvType,
          notes: note.trim() || undefined,
        });
      } else {
        // Création
        if (!selectedUser) {
          setErrorMsg("Sélectionne un bénéficiaire");
          setSubmitting(false);
          return;
        }
        const result = await createRendezvousAPI(token, {
          jeuneUid: selectedUser.uid,
          dateTime: iso,
          location: locLabel,
          objet: rdvType,
          notes: note.trim() || undefined,
          conseillerName: dashboardData?.conseillerName || undefined,
        });
        if (!result.success) throw new Error(result.error || 'Erreur inconnue');
        // Pas d'addRdv local : le backend est source de verite, et l'event
        // rdv:changed (dispatch ci-dessous) declenche un refresh des rdvs
        // backend dans la 1.5s avant que la modal se ferme.
      }

      // v17.7.32 — Émet un event global pour que les vues qui listent les RDV
      // refresh immédiatement (sans attendre le polling 15s).
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('rdv:changed'));
      }
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setErrorMsg(msg === 'UNAUTHORIZED' ? 'Session expirée — reconnecte-toi.' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const dateObj = date ? new Date(date) : new Date();
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const userName = selectedUser ? `${selectedUser.prenom} ${selectedUser.nom}` : '';

  return (
    <ModalShell
      open={open} title={isEditMode ? "Modifier le rendez-vous" : "Planifier un rendez-vous"} onClose={onClose}
      successContent={success ? <SuccessMessage title={isEditMode ? "Modifications enregistrées ✓" : "RDV planifié ✓"} subtitle={`${rdvType}${userName ? ` avec ${userName}` : ''} le ${dateStr} à ${time}`} /> : undefined}
      footer={
        <>
          <button onClick={onClose} disabled={submitting} style={{ padding: '10px 20px', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 10, background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--premium-text-2)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1 }}>Annuler</button>
          <button onClick={handleSend} disabled={(!selectedUid && !isEditMode) || submitting} className="btn-gradient" style={{ padding: '10px 24px', borderRadius: 10, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: ((selectedUid || isEditMode) && !submitting) ? 'pointer' : 'not-allowed', opacity: ((selectedUid || isEditMode) && !submitting) ? 1 : 0.5 }}>{submitting ? 'Envoi…' : (isEditMode ? 'Enregistrer' : 'Planifier le RDV')}</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Bénéficiaire</label>
          <input type="text" placeholder="Rechercher par nom ou prénom…" style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={{ ...selectStyle, marginTop: 6 }} value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)}>
            {filteredUsers.length === 0 ? (
              <option value="">Aucun résultat</option>
            ) : (
              filteredUsers.map(u => <option key={u.uid} value={u.uid}>{u.prenom || '—'} {u.nom || '—'}</option>)
            )}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Type de RDV</label>
          <select style={selectStyle} value={rdvType} onChange={(e) => setRdvType(e.target.value as RdvType)}>
            {RDV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Lieu</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LOCATION_LABELS.map(({ value, label }) => (
              <button key={value} onClick={() => setLocation(value)} style={{
                padding: '6px 12px', borderRadius: 8,
                background: location === value ? 'linear-gradient(135deg, #7f4997, #E84393)' : 'rgba(15,15,15,0.04)',
                border: location === value ? 'none' : '1px solid rgba(15,15,15,0.08)',
                color: location === value ? '#ffffff' : 'var(--premium-text-2)',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={labelStyle}>Date</label><GlassDatePicker value={date} onChange={setDate} /></div>
          <div><label style={labelStyle}>Heure</label><GlassTimePicker value={time} onChange={setTime} /></div>
        </div>

        <div><label style={labelStyle}>Note (optionnel)</label><input type="text" style={inputStyle} placeholder="Ex : Point sur le projet professionnel…" value={note} onChange={(e) => setNote(e.target.value)} /></div>

        {errorMsg && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#b91c1c', fontSize: 12, fontWeight: 500,
          }}>{errorMsg}</div>
        )}
      </div>
    </ModalShell>
  );
}

// ====== SIGNALER UN PROBLÈME ======

export function BugModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<'bug' | 'feature'>('bug');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) { setSuccess(false); setType('bug'); }
  }, [open]);

  const handleSubmit = () => {
    setSuccess(true);
    setTimeout(() => onClose(), 2500);
  };

  return (
    <ModalShell
      open={open} title="Signaler un problème" onClose={onClose}
      successContent={success ? <SuccessMessage title="Signalement envoyé !" subtitle="L'équipe IMPAKT a bien reçu votre signalement et reviendra vers vous rapidement." /> : undefined}
      footer={
        <>
          <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid rgba(255,255,255,0.7)', borderRadius: 10, background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--premium-text-2)', cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSubmit} className="btn-gradient" style={{ padding: '10px 24px', borderRadius: 10, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Envoyer le signalement</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={labelStyle}>Type de problème</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <TypeBtn selected={type === 'bug'} onClick={() => setType('bug')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 22, height: 22 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
              label="Bug technique" />
            <TypeBtn selected={type === 'feature'} onClick={() => setType('feature')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 22, height: 22 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>}
              label="Suggestion" />
          </div>
        </div>
        <div><label style={labelStyle}>Sujet</label><input type="text" style={inputStyle} placeholder="Ex : Le bouton exporter ne fonctionne pas..." /></div>
        <div><label style={labelStyle}>Page concernée</label>
          <select style={selectStyle} defaultValue="dashboard">
            <option value="dashboard">Tableau de bord</option>
            <option value="suivi">Jeunes suivis</option>
            <option value="rdv">Rendez-vous</option>
            <option value="stats">Statistiques</option>
            <option value="reglages">Réglages</option>
            <option value="profil">Fiche bénéficiaire</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div><label style={labelStyle}>Description détaillée</label>
          <textarea rows={4} placeholder="Décrivez le problème ou votre suggestion en détail..." style={{ ...inputStyle, resize: 'vertical' as const }} />
        </div>
        <div><label style={labelStyle}>Priorité</label>
          <select style={selectStyle} defaultValue="medium">
            <option value="low">Basse — Ce n&apos;est pas urgent</option>
            <option value="medium">Moyenne — Ça gêne mon travail</option>
            <option value="high">Haute — Je ne peux pas travailler</option>
          </select>
        </div>
      </div>
    </ModalShell>
  );
}
