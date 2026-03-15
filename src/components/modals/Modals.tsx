'use client';

import { useState, useEffect, ReactNode } from 'react';

// ====== MODAL WRAPPER ======

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)',
  borderRadius: 10, fontFamily: 'inherit', fontSize: 12, color: 'var(--text-900)', outline: 'none',
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: 'var(--white)', cursor: 'pointer' };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-500)', marginBottom: 6, display: 'block' };

function ModalShell({ open, title, onClose, children, footer, successContent }: {
  open: boolean; title: string; onClose: () => void;
  children: ReactNode; footer: ReactNode; successContent?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,.3)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fi .2s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: 'var(--white)',
        borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.15)', overflow: 'hidden',
      }}>
        {/* Head */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-900)' }}>{title}</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: 'none', background: '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 13, color: 'var(--text-500)',
          }}>✕</button>
        </div>

        {successContent || (
          <>
            <div style={{ padding: '20px 24px' }}>{children}</div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-900)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-500)' }}>{subtitle}</div>
    </div>
  );
}

// ====== PLANIFIER UN ÉCHANGE ======

export function ExchangeModal({ open, onClose, users }: {
  open: boolean; onClose: () => void; users: Array<{ nom: string; prenom: string }>;
}) {
  const [type, setType] = useState<'tel' | 'rdv'>('tel');
  const [success, setSuccess] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');

  // Default date to tomorrow
  useEffect(() => {
    if (open) {
      const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
      setDate(tmr.toISOString().split('T')[0]);
      setSuccess(false);
      setType('tel');
      if (users.length > 0) setSelectedUser(`${users[0].prenom} ${users[0].nom}`);
    }
  }, [open, users]);

  const handleSend = () => {
    setSuccess(true);
    setTimeout(() => onClose(), 2500);
  };

  const typeLbl = type === 'tel' ? 'Appel téléphonique' : 'RDV en présentiel';
  const dateObj = date ? new Date(date) : new Date();
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <ModalShell
      open={open} title="Planifier un échange" onClose={onClose}
      successContent={success ? <SuccessMessage title="Demande envoyée !" subtitle={`${typeLbl} avec ${selectedUser} le ${dateStr} à ${time}`} /> : undefined}
      footer={
        <>
          <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--white)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>Annuler</button>
          <button onClick={handleSend} className="btn-gradient" style={{ padding: '10px 24px', borderRadius: 10, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Envoyer la demande</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={labelStyle}>Élève</label>
          <select style={selectStyle} value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
            {users.map((u, i) => <option key={i} value={`${u.prenom} ${u.nom}`}>{u.prenom} {u.nom}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Type d&apos;échange</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <TypeBtn selected={type === 'tel'} onClick={() => setType('tel')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 22, height: 22 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>}
              label="Appel téléphonique" />
            <TypeBtn selected={type === 'rdv'} onClick={() => setType('rdv')}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 22, height: 22 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M21 15l-3-3m0 0l-3 3m3-3v6" /></svg>}
              label="RDV en présentiel" />
          </div>
        </div>
        <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label style={labelStyle}>Heure</label><input type="time" style={inputStyle} value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div><label style={labelStyle}>Note (optionnel)</label><input type="text" style={inputStyle} placeholder="Ex : Point sur le projet professionnel..." /></div>
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
          <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--white)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>Annuler</button>
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
            <option value="profil">Fiche élève</option>
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
