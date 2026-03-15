'use client';

import { useState } from 'react';
import { useModals } from '@/lib/modals';

function ProfCard({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, ...style }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  );
}

const faqItems = [
  { q: 'Comment fonctionne le test IMPAKT ?', a: 'Le test IMPAKT est basé sur le modèle RIASEC (Réaliste, Investigateur, Artistique, Social, Entreprenant, Conventionnel). L\'élève répond à une série de questions adaptatives qui permettent d\'identifier ses traits de personnalité dominants. L\'algorithme croise ensuite ces résultats avec les données du marché de l\'emploi pour proposer des métiers et formations personnalisés.' },
  { q: 'Comment valider un métier ou une formation ?', a: 'Sur la fiche de l\'élève, dans les sections "Top 10 métiers" et "Formations recommandées", vous trouverez deux boutons pour chaque suggestion : le cœur indique l\'intérêt du jeune, et la coche permet votre validation en tant qu\'enseignant. Un métier validé apparaîtra dans les actions de l\'enseignant.' },
  { q: 'Comment planifier un rendez-vous ?', a: 'Vous pouvez planifier un RDV de deux façons : depuis la fiche d\'un élève en cliquant sur "Planifier un échange", ou depuis l\'onglet Rendez-vous en cliquant sur "Ajouter un RDV". Choisissez le type (appel ou présentiel), la date et l\'heure, puis confirmez.' },
  { q: 'Comment finaliser un parcours ?', a: 'Quand un élève a trouvé sa voie professionnelle, ouvrez sa fiche et cliquez sur "Finaliser le parcours". Vous devrez confirmer cette action qui fait sortir l\'élève du dispositif d\'accompagnement avec une sortie positive.' },
  { q: 'Comment interpréter le profil RIASEC ?', a: 'Le profil RIASEC se compose de 6 dimensions représentées sur un graphique radar. Les dimensions les plus élevées correspondent aux centres d\'intérêt dominants du jeune. Un profil "SA" (Social-Artistique) orientera vers des métiers liés à l\'aide et la créativité, tandis qu\'un profil "RI" (Réaliste-Investigateur) orientera vers des métiers techniques et scientifiques.' },
  { q: 'Que signifient les niveaux de statut ?', a: 'En bonne voie : l\'élève avance normalement. En cours : actif mais parcours non terminé. Bloqué : arrêté à une étape depuis plus de 7 jours. Décrochage : aucune connexion depuis plus de 14 jours. Non démarré : inscrit mais aucune action effectuée.' },
];

const guides = [
  {
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    title: 'Prise en main du dashboard', desc: 'Découvrez les fonctionnalités essentielles pour bien démarrer avec IMPAKT.', tag: '5 min',
  },
  {
    icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
    title: 'Accompagner un élève de A à Z', desc: "Le parcours complet : de l'inscription à la sortie positive.", tag: '8 min',
  },
  {
    icon: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    title: 'Gérer les décrochages', desc: "Identifier les signes, relancer efficacement et adapter l'accompagnement.", tag: '6 min',
  },
  {
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    title: 'Exporter mes données', desc: 'Générer des rapports PDF ou Excel pour vos bilans et réunions.', tag: '3 min',
  },
];

const changelog = [
  { date: '1 mars 2026', items: ['Nouvel onglet Rendez-vous', 'Système de statut à 5 niveaux', 'Page Statistiques avec graphiques', 'Export PDF et Excel'] },
  { date: '15 févr. 2026', items: ['Fiche personnalisée de l\'élève', 'Notes de l\'enseignant', 'Validation métiers et formations', 'Slide panel RDV'] },
  { date: '1 févr. 2026', items: ['Dashboard avec KPIs', 'Tableau de suivi des bénéficiaires', 'Filtres avancés', 'Système de connexion'] },
];

function FaqItem({ q, a, visible }: { q: string; a: string; visible: boolean }) {
  const [open, setOpen] = useState(false);
  if (!visible) return null;
  return (
    <div style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-900)' }}>
        <span>{q}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          style={{ width: 14, height: 14, flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div style={{
        fontSize: 12, color: 'var(--text-500)', lineHeight: 1.6,
        maxHeight: open ? 300 : 0, overflow: 'hidden',
        transition: 'max-height .3s, padding .3s',
        padding: open ? '0 0 12px' : 0,
      }}>
        {a}
      </div>
    </div>
  );
}

export default function AidePage() {
  const [search, setSearch] = useState('');
  const { openBug } = useModals();

  return (
    <div className="fi" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
      {/* LEFT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Search */}
        <ProfCard style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-400)" strokeWidth="2" strokeLinecap="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" placeholder="Rechercher dans l'aide..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--text-900)', width: '100%' }}
            />
          </div>
        </ProfCard>

        {/* FAQ */}
        <ProfCard title="Questions fréquentes">
          {faqItems.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} visible={!search.trim() || (f.q + f.a).toLowerCase().includes(search.toLowerCase())} />
          ))}
        </ProfCard>

        {/* Guides */}
        <ProfCard title="Guides rapides">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {guides.map((g, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
                borderBottom: i < guides.length - 1 ? '1px solid #f5f5f5' : 'none', cursor: 'pointer',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: '#f8f5ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ width: 20, height: 20 }}>{g.icon}</svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-900)' }}>{g.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 2 }}>{g.desc}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: '#f8f5ff', padding: '4px 10px', borderRadius: 6 }}>{g.tag}</span>
              </div>
            ))}
          </div>
        </ProfCard>
      </div>

      {/* RIGHT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Contact */}
        <ProfCard title="Contact & Support">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Email', value: 'support@impakt-app.fr', icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></> },
              { label: 'Téléphone', value: '01 80 00 00 00', icon: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /> },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f8f5ff', borderRadius: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18, flexShrink: 0 }}>{c.icon}</svg>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-900)' }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent)' }}>{c.value}</div>
                </div>
              </div>
            ))}
            <button onClick={openBug} className="btn-gradient" style={{
              width: '100%', padding: '10px 16px', borderRadius: 10,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginTop: 4,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Signaler un problème
            </button>
          </div>
        </ProfCard>

        {/* Changelog */}
        <ProfCard title="Nouveautés">
          {changelog.map((c, ci) => (
            <div key={ci} style={{ padding: '12px 0', borderBottom: ci < changelog.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>{c.date}</div>
              {c.items.map((item, ii) => (
                <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg, #7f4997, #E84393)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-700)' }}>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </ProfCard>
      </div>
    </div>
  );
}
