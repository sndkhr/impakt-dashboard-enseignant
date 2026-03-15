'use client';

import { useState, useCallback } from 'react';

function ProfCard({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, ...style }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}

function SettRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
      <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-700)' }}>
        {label}
        {sub && <small style={{ display: 'block', fontSize: 10, fontWeight: 400, color: 'var(--text-400)', marginTop: 1 }}>{sub}</small>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ defaultOn }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn ?? false);
  return (
    <div
      onClick={() => setOn(!on)}
      style={{
        position: 'relative', width: 40, height: 22, borderRadius: 11,
        background: on ? 'linear-gradient(135deg, #7f4997, #E84393)' : '#d1d5db',
        cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.15)',
      }} />
    </div>
  );
}

function SaveButton({ label, successLabel }: { label: string; successLabel: string }) {
  const [saved, setSaved] = useState(false);
  const handleClick = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);
  return (
    <button onClick={handleClick} style={{
      padding: '10px 24px', border: 'none', borderRadius: 10,
      background: 'linear-gradient(135deg, #7f4997, #E84393)', color: '#fff',
      fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>
      {saved ? successLabel : label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: 240, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 12, color: 'var(--text-900)', outline: 'none',
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: 'var(--white)', cursor: 'pointer' };

function ConnItem({ date, time, browser, active }: { date: string; time: string; browser: string; active?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 11, color: 'var(--text-700)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#059669' : '#d1d5db', flexShrink: 0 }} />
      <span>{active ? <strong>Aujourd&apos;hui</strong> : date} — {time} — {browser}</span>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="fi" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
      {/* LEFT COL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Profil + Notifications */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ProfCard>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12 }}>Mon profil</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7f4997, #E84393)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: '#fff',
              }}>MD</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-900)' }}>Marie Dupont</div>
                <div style={{ fontSize: 11, color: 'var(--text-400)' }}>Professeure principale</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Modifier la photo</div>
              </div>
            </div>
            <SettRow label="Nom"><input style={inputStyle} defaultValue="Dupont" /></SettRow>
            <SettRow label="Prénom"><input style={inputStyle} defaultValue="Marie" /></SettRow>
            <SettRow label="Email"><input style={inputStyle} type="email" defaultValue="m.dupont@lycee-exemple.fr" /></SettRow>
            <SettRow label="Téléphone"><input style={inputStyle} defaultValue="01 44 55 66 77" /></SettRow>
            <SettRow label="Structure">
              <select style={selectStyle} defaultValue="Lycée Jean Moulin — Bobigny">
                <option>Lycée Jean Moulin — Bobigny</option>
                <option>Lycée Paul Éluard — Saint-Denis</option>
                <option>Lycée Suger — Saint-Denis</option>
                <option>Lycée Alfred Nobel — Clichy-sous-Bois</option>
              </select>
            </SettRow>
            <div style={{ marginTop: 14, textAlign: 'right' }}><SaveButton label="Enregistrer" successLabel="✓ Sauvegardé" /></div>
          </ProfCard>

          <ProfCard>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12 }}>Notifications</div>
            <SettRow label="Nouvel élève inscrit" sub="Notification à chaque nouvel élève"><Toggle defaultOn /></SettRow>
            <SettRow label="Test IMPAKT terminé" sub="Quand un élève termine son évaluation"><Toggle defaultOn /></SettRow>
            <SettRow label="Rappel RDV à venir" sub="Notification avant chaque rendez-vous"><Toggle defaultOn /></SettRow>
            <SettRow label="Élève inactif" sub="Alerte quand un élève ne se connecte plus"><Toggle defaultOn /></SettRow>
            <SettRow label="Métier/formation validé" sub="Quand un élève like un métier ou une formation"><Toggle /></SettRow>
            <SettRow label="Canal de notification">
              <select style={selectStyle} defaultValue="Email + Push">
                <option>Email + Push</option>
                <option>Email uniquement</option>
                <option>Push uniquement</option>
                <option>Aucune</option>
              </select>
            </SettRow>
          </ProfCard>
        </div>

        {/* Préférences + Sécurité */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ProfCard>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12 }}>Préférences d&apos;accompagnement</div>
            <SettRow label="Seuil d'alerte inactivité" sub="Jours avant signalement">
              <select style={selectStyle} defaultValue="14 jours"><option>7 jours</option><option>14 jours</option><option>21 jours</option><option>30 jours</option></select>
            </SettRow>
            <SettRow label="Capacité max de suivi" sub="Élèves simultanés">
              <select style={selectStyle} defaultValue="50"><option>20</option><option>30</option><option>50</option><option>Illimité</option></select>
            </SettRow>
            <SettRow label="Rappel automatique RDV">
              <select style={selectStyle} defaultValue="24h avant"><option>1h avant</option><option>24h avant</option><option>1h + 24h avant</option><option>Aucun</option></select>
            </SettRow>
            <SettRow label="Format d'export par défaut">
              <select style={selectStyle} defaultValue="PDF"><option>PDF</option><option>Excel</option></select>
            </SettRow>
          </ProfCard>

          <ProfCard>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12 }}>Sécurité</div>
            <SettRow label="Mot de passe actuel"><input style={inputStyle} type="password" defaultValue="••••••••" /></SettRow>
            <SettRow label="Nouveau mot de passe"><input style={inputStyle} type="password" placeholder="Nouveau mot de passe" /></SettRow>
            <SettRow label="Confirmer"><input style={inputStyle} type="password" placeholder="Confirmer" /></SettRow>
            <div style={{ marginTop: 14, textAlign: 'right' }}><SaveButton label="Mettre à jour" successLabel="✓ Mis à jour" /></div>
          </ProfCard>
        </div>
      </div>

      {/* RIGHT COL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Logo card */}
        <ProfCard style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #7f4997, #E84393)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" style={{ width: 24, height: 24 }}>
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="gradient-text" style={{ fontSize: 15, fontWeight: 800 }}>IMPAKT</div>
          <div style={{ fontSize: 10, color: 'var(--text-400)', marginTop: 2 }}>Orientation personnalisée</div>
        </ProfCard>

        {/* Infos */}
        <ProfCard title="Informations">
          {[
            { label: 'Version', value: '1.0.0-beta' },
            { label: 'Mise à jour', value: '1 mars 2026' },
            { label: 'Environnement', value: 'Production' },
            { label: 'Licence', value: 'Lycée Jean Moulin 93' },
            { label: 'Hébergement', value: 'France (GCP europe-west1)' },
          ].map((info, i, arr) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.3px' }}>{info.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-900)', marginTop: 2 }}>{info.value}</div>
            </div>
          ))}
        </ProfCard>

        {/* Connexions */}
        <ProfCard title="Historique des connexions">
          <ConnItem date="" time="09h14" browser="Chrome · macOS" active />
          <ConnItem date="28 févr." time="14h30" browser="Safari · iPhone" />
          <ConnItem date="27 févr." time="08h45" browser="Chrome · macOS" />
          <ConnItem date="25 févr." time="10h12" browser="Chrome · Windows" />
          <ConnItem date="22 févr." time="16h45" browser="Chrome · macOS" />
        </ProfCard>
      </div>
    </div>
  );
}
