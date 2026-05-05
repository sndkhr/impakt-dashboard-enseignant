/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react/no-unescaped-entities, react-hooks/exhaustive-deps */
// @ts-nocheck
"use client";
// =====================================================
// ProfilePage — port "au pixel près" de la fiche admin
// =====================================================
// Source : impakt-admin-update/components/profile/UserProfile.js
// Adaptations conseiller :
//  - Onglets restreints : Accueil, Métiers, Parcours, Informations, Technique, RDV
//    (pas de Pool Claude ni Personnalité — admin only)
//  - "Aperçu scoring" remplacé par "Offres d'emploi matchées" (à brancher)
//  - Onglet RDV utilise le RdvTab existant
//  - Auth/navigation via les hooks du conseiller (useAuth + useNav)
// =====================================================
import { useState, useEffect } from "react";
import { V, G } from "@/lib/theme";
import { dashAPI, listFormationRequestsAPI, FormationRequest } from "@/lib/api";
import Badge from "@/components/ui/Badge";
import Ic from "@/components/ui/Icons";
import { CountUp, SpotlightCard } from "@/components/ui/PremiumMotion";
import { staggerDelay } from "@/lib/motion";
import { useAuth } from "@/lib/auth";
import { useNav } from "@/lib/navigation";
import RdvTab from "@/components/profile/RdvTab";
import MotivationSection, { MotivationTabContent, MotivationStatusPill } from "@/components/profile/MotivationSection";
import { downloadProfilePdf } from "@/lib/profilePdfTemplate";

/* ============================================================
   USER PROFILE — Glassmorphisme homogene avec Dashboard/Users/Stats/...
   Pour revenir : git revert <commit>
   ============================================================ */

// ====== SOUS-COMPOSANTS GLASS ======

// ProfCard converti en GlassCard — meme API, meme recette glassmorphisme
function ProfCard({ title, children, titleRight, style }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.52)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 18,
      padding: 18,
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
      position: 'relative',
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: '#525252',
          textTransform: 'uppercase', letterSpacing: '.5px',
          marginBottom: 12, paddingBottom: 10,
          borderBottom: '1px solid rgba(15,15,15,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{title}</span>
          {titleRight}
        </div>
      )}
      {children}
    </div>
  );
}

// Tabs discrets minimalistes sur fond glass
// className "fi-tabs" + CSS global ci-dessous → masque la barre de scroll
// horizontale (sinon visible quand la fenêtre est étroite et que tous les
// onglets ne tiennent plus). Les onglets restent scrollables au touch/swipe.
function DiscreteTabs({ tabs, active, onChange }) {
  return (
    <div className="fi-tabs" style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(15,15,15,0.08)', overflowX: 'auto' }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '12px 22px', fontFamily: 'inherit', fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? '#0a0a0a' : '#a3a3a3',
              background: 'none', border: 'none',
              borderBottom: '2px solid transparent',
              borderImage: isActive ? 'linear-gradient(135deg, #7f4997, #E84393) 1' : 'none',
              cursor: 'pointer', marginBottom: -1, transition: 'all .15s',
              whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            {t.label}
            {(t.badge ?? 0) > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fff',
                background: 'linear-gradient(135deg, #7f4997, #E84393)',
                padding: '2px 7px', borderRadius: 999,
                letterSpacing: 0.3,
                boxShadow: '0 2px 6px rgba(232,67,147,0.28), inset 0 1px 0 rgba(255,255,255,0.45)',
                lineHeight: 1.2,
              }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ====== HELPERS DE RENDU ======

function RiasecBars({ rp }) {
  if (!rp) return <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 16 }}>En attente du test</div>;
  const max = Math.max(...Object.values(rp).map(Number).filter(n => !isNaN(n)), 1);
  return (
    <>
      {[['R', 'Réaliste'], ['I', 'Investigateur'], ['A', 'Artistique'], ['S', 'Social'], ['E', 'Entreprenant'], ['C', 'Conventionnel']].map(([code, label]) => {
        const val = rp[code] || rp[code.toLowerCase()] || 0;
        return (
          <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: G, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', width: 16 }}>{code}</span>
            <span style={{ fontSize: 11, color: V.t7, width: 100 }}>{label}</span>
            <div style={{ flex: 1, height: 8, background: V.card2, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(val / max * 100)}%`, background: G, borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: V.t9, width: 24, textAlign: 'right' }}>{val}</span>
          </div>
        );
      })}
    </>
  );
}

function ScoringDetail({ d, compact }) {
  const os = d.orientationScore || {};
  const domaines = os.domaines || {};
  const families = os.families || {};
  const interests = os.interests || os.interets || {};
  const env = os.env || {};
  const branches = os.branches || {};
  const antiR = os.antiRiasec || [];
  const antiF = os.antiFamilies || [];
  const hasData = Object.keys(domaines).length || Object.keys(families).length || Object.keys(interests).length;
  if (!hasData) return <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 16 }}>Scoring non disponible (test non complété)</div>;
  const limit = compact ? 5 : 10;
  const renderSection = (title, data, color) => {
    const entries = Object.entries(data).filter(([, v]) => v && v !== 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const max = Math.max(...entries.map(([, v]) => Math.abs(v)), 1);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: color || V.accent, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 6 }}>{title}</div>
        {entries.slice(0, limit).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <span style={{ fontSize: 10, color: V.t7, width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k}>{k}</span>
            <div style={{ flex: 1, height: 6, background: V.card2, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(Math.abs(v) / max * 100)}%`, background: v < 0 ? V.red : color || G, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: v < 0 ? V.red : V.t9, width: 28, textAlign: 'right' }}>{typeof v === 'number' ? (v.toFixed ? v.toFixed(1) : v) : v}</span>
          </div>
        ))}
        {entries.length > limit && <div style={{ fontSize: 10, color: V.t4, marginTop: 2 }}>+{entries.length - limit} autres</div>}
      </div>
    );
  };
  // Palette unifiée sur le violet du design (nuances d'opacité pour hiérarchie)
  const shade1 = V.accent;                    // violet fort
  const shade2 = 'rgba(142,68,173,0.78)';     // violet atténué
  const shade3 = 'rgba(142,68,173,0.58)';     // violet clair
  const shade4 = 'rgba(142,68,173,0.42)';     // violet très clair
  const shade5 = 'rgba(142,68,173,0.28)';     // violet pâle
  return (
    <div>
      {renderSection('Domaines', domaines, shade1)}
      {renderSection('Familles de métiers', families, shade2)}
      {renderSection('Intérêts', interests, shade3)}
      {!compact && renderSection('Environnement', env, shade4)}
      {!compact && renderSection('Branches', branches, shade5)}
      {(antiR.length > 0 || antiF.length > 0) && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(248,113,113,.06)', borderRadius: 8, border: `1px solid rgba(248,113,113,.15)` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: V.red, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 4 }}>Exclusions</div>
          {antiR.length > 0 && <div style={{ fontSize: 11, color: V.t7 }}>Anti-RIASEC : {antiR.join(', ')}</div>}
          {antiF.length > 0 && <div style={{ fontSize: 11, color: V.t7, marginTop: 2 }}>Anti-Familles : {antiF.join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

// Chevron Apple-style : SVG net, aligné, couleur inheritée
const Chevron = ({ open, size = 10, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 10 10"
    fill="none"
    style={{
      transition: 'transform .2s ease',
      transform: open ? 'rotate(-180deg)' : 'rotate(0deg)',
      flexShrink: 0,
      display: 'block'
    }}
    aria-hidden="true"
  >
    <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={color || V.t4} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Helper : retire les accolades { } qui peuvent apparaître dans les textes
// retournés par le LLM (artefacts de prompt). Sandra ne les veut pas.
const stripBraces = (s: any) => (typeof s === 'string' ? s.replace(/[{}]/g, '').trim() : s);

// =====================================================
// Résumé narratif du candidat — état des lieux pour le conseiller
// =====================================================
//
// Utilise les vraies données collectées à l'inscription :
//  - prenom + age + typeDiplome
//  - experiencesPro [{ domaine, domaineLabel, duree }]
//  - dispoFormation [travailler_vite | formation_courte | reprendre_etudes]
//  - orientationLLM.careerPaths [{ name, description }] — les SECTEURS
//    identifiés par Claude (pas les titres de métiers individuels)
// =====================================================

function buildCandidateSummary(d: any): string {
  if (!d) return 'Profil incomplet.';

  const isFem = d.gender === 'femme' || d.gender === 'F';
  const il = isFem ? 'elle' : 'il';
  const Il = isFem ? 'Elle' : 'Il';
  const ouvert = isFem ? 'ouverte' : 'ouvert';
  const interesse = isFem ? 'intéressée' : 'intéressé';
  const demandeur = isFem ? 'demandeuse' : 'demandeur';

  const out: string[] = [];

  // 1) Identité concise : "Noah, 23 ans, titulaire d'un Bac STMG (Management, Gestion)."
  const prenom = (d.prenom || '').trim() || 'Le candidat';
  const ageStr = d.age ? `${d.age} ans` : null;
  const diploma = (d.typeDiplome || d.niveauEtudes || d.classe || '').toString().trim();
  let identity = prenom;
  if (ageStr) identity += `, ${ageStr}`;
  if (diploma) {
    const lower = diploma.toLowerCase();
    if (lower.startsWith('niveau')) identity += `, ${lower}`;
    else identity += `, titulaire d'un ${diploma}`;
  }
  out.push(identity + '.');

  // 2) Expérience pro détaillée — durée + secteur
  const expsRaw: any[] = Array.isArray(d.experiencesPro) ? d.experiencesPro : [];
  const exps = expsRaw
    .map(e => ({
      // Firestore stocke le champ sous le nom `label` (cf. doc users/{uid}.experiencesPro)
      label: (e.label || e.domaineLabel || e.domaine_label || e.secteur || e.sector || '').trim(),
      duree: (e.duree || e.duration || '').trim(),
    }))
    .filter(e => e.label || e.duree);
  if (exps.length > 0) {
    const phrases = exps.map(e => {
      if (e.duree && e.label) return `${e.duree} dans ${e.label.toLowerCase()}`;
      if (e.label) return `dans ${e.label.toLowerCase()}`;
      return e.duree;
    });
    if (phrases.length === 1) {
      out.push(`Expérience professionnelle : ${phrases[0]}.`);
    } else {
      out.push(`Expérience professionnelle : ${phrases.slice(0, -1).join(', ')} et ${phrases[phrases.length - 1]}.`);
    }
  } else if (d.metierActuel) {
    out.push(`Travaille actuellement comme ${d.metierActuel}.`);
  } else if (d.aExperiencePro === true || d.aExperiencePro === 'true') {
    out.push(`A déjà une expérience professionnelle.`);
  } else if (d.aExperiencePro === false || d.aExperiencePro === 'false') {
    out.push(`Pas encore d'expérience professionnelle.`);
  }

  // 3) Ce que le jeune cherche (situation + dispoFormation)
  const dispos = Array.isArray(d.dispoFormation) ? d.dispoFormation : (d.dispoFormation ? [d.dispoFormation] : []);
  const isJobSeeker = d.situation === 'sans_emploi' || d.situation === 'sansEmploi';
  const wantsFast = dispos.includes('travailler_vite');
  const wantsFC = dispos.includes('formation_courte');
  const wantsReprise = dispos.includes('reprendre_etudes');

  if (isJobSeeker) {
    let s = `${Il} est ${demandeur} d'emploi`;
    const wants: string[] = [];
    if (wantsFast) wants.push('cherche à travailler rapidement');
    if (wantsFC) wants.push(`reste ${ouvert} à une formation courte certifiante`);
    if (wantsReprise) wants.push('envisage de reprendre des études');
    if (wants.length === 1) s += ` et ${wants[0]}`;
    else if (wants.length > 1) s += ` : ${il} ${wants.slice(0, -1).join(', ')} et ${wants[wants.length - 1]}`;
    out.push(s + '.');
  } else if (wants(dispos)) {
    const wantsList: string[] = [];
    if (wantsFast) wantsList.push('cherche à travailler rapidement');
    if (wantsFC) wantsList.push(`est ${ouvert} à une formation courte`);
    if (wantsReprise) wantsList.push('envisage de reprendre des études');
    if (wantsList.length > 0) out.push(`${Il} ${wantsList.join(' et ')}.`);
  }

  // 4) Secteurs d'intérêt — depuis careerPaths (pas les job titles)
  const careerPaths = d.orientationLLM?.careerPaths;
  if (Array.isArray(careerPaths) && careerPaths.length > 0) {
    const sectors = careerPaths
      .map((p: any) => stripBraces(p?.name))
      .filter((s: any) => typeof s === 'string' && s.length > 0)
      .slice(0, 5);
    if (sectors.length === 1) {
      out.push(`${Il} est ${interesse} par le secteur ${sectors[0]}.`);
    } else if (sectors.length === 2) {
      out.push(`${Il} est ${interesse} par les secteurs ${sectors[0]} et ${sectors[1]}.`);
    } else if (sectors.length >= 3) {
      out.push(`${Il} est ${interesse} par les secteurs ${sectors.slice(0, -1).join(', ')} et ${sectors[sectors.length - 1]}.`);
    }
  } else {
    // Fallback sur le top métiers si pas de careerPaths
    const tops: string[] = [];
    const topRaw = d.topMetiers || d.top3Jobs || [];
    for (const m of topRaw.slice(0, 3)) {
      const t = typeof m === 'string' ? m : (m && (m.title || m.name));
      if (t) tops.push(String(t));
    }
    if (tops.length > 0) {
      out.push(`Métiers les plus alignés avec son profil : ${tops.join(', ')}.`);
    }
  }

  return out.join(' ');
}

// petit helper local pour le check dispoFormation non vide
function wants(arr: string[]): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

function MetiersList({ metiers, limit, llm }) {
  // v16.9 — Si on a les données LLM Claude (demandeur d'emploi), on priorise son Top 10 + justifs
  const useLLM = llm && Array.isArray(llm.top10_titles) && llm.top10_titles.length > 0;
  const items = useLLM
    ? llm.top10_titles.slice(0, limit || 10).map((title, i) => ({
        title: stripBraces(title),
        id: (llm.top10_ids || [])[i] || null,
      }))
    : metiers.slice(0, limit || 10);

  // v16.12 — État déplié par métier. Cliquer la flèche ouvre/ferme la justif Claude.
  const [expanded, setExpanded] = useState({});
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showPaths, setShowPaths] = useState(false);

  if (items.length === 0) return <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 20 }}>Test non complété</div>;

  const toggle = (i) => setExpanded({ ...expanded, [i]: !expanded[i] });

  // Largeur fixe du conteneur chevron pour garantir l'alignement vertical parfait
  const chevronSlot = { width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

  return (
    <>
      {useLLM && llm.profileAnalysis && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            style={{ width: '100%', padding: '10px 12px', background: V.card2, border: `1px solid ${V.borderSoft}`, borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: .3 }}>Analyse du profil</span>
            <span style={chevronSlot}><Chevron open={showAnalysis} color={V.t5} /></span>
          </button>
          {showAnalysis && (
            <div style={{ marginTop: 4, padding: 12, background: V.card2, border: `1px solid ${V.borderSoft}`, borderRadius: 10, fontSize: 12, color: V.t9, lineHeight: 1.45 }}>{stripBraces(llm.profileAnalysis)}</div>
          )}
        </div>
      )}
      {useLLM && Array.isArray(llm.careerPaths) && llm.careerPaths.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => setShowPaths(!showPaths)}
            style={{ width: '100%', padding: '10px 12px', background: V.card2, border: `1px solid ${V.borderSoft}`, borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: .3 }}>Chemins identifiés · {llm.careerPaths.length}</span>
            <span style={chevronSlot}><Chevron open={showPaths} color={V.t5} /></span>
          </button>
          {showPaths && (
            <div style={{ marginTop: 4, padding: 12, background: V.card2, border: `1px solid ${V.borderSoft}`, borderRadius: 10 }}>
              {llm.careerPaths.map((p, pi) => (
                <div key={pi} style={{ marginBottom: pi < llm.careerPaths.length - 1 ? 8 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: V.t9 }}>{stripBraces(p.name)}</div>
                  {p.description && <div style={{ fontSize: 11, color: V.t5, marginTop: 2, lineHeight: 1.4 }}>{stripBraces(p.description)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {items.map((m, i) => {
        const name = typeof m === 'string' ? m : (m.title || m.name || '');
        if (!name) return null;
        const metierID = (typeof m === 'object' && m.id) ? m.id : null;
        const justif = useLLM && metierID ? (llm.justifications || {})[metierID] : null;
        const rankJustif = useLLM && metierID ? (llm.rankJustifications || {})[metierID] : null;
        const chemin = useLLM && metierID ? (llm.careerPathByCareerID || {})[metierID] : null;
        const hasExtra = useLLM && (justif || rankJustif || chemin);
        const isExpanded = !!expanded[i];

        return (
          <div key={i} style={{ borderBottom: i < items.length - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>
            <button
              onClick={() => hasExtra && toggle(i)}
              disabled={!hasExtra}
              style={{ width: '100%', padding: '10px 0', background: 'transparent', border: 'none', fontFamily: 'inherit', cursor: hasExtra ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
            >
              <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, background: i === 0 ? G : i === 1 ? '#1a1a2e' : i === 2 ? '#374151' : '#f3f4f6', color: i < 3 ? '#fff' : V.t4 }}>{i + 1}</div>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: V.t7 }}>{name}</span>
              <span style={chevronSlot}>{hasExtra && <Chevron open={isExpanded} color={V.t4} />}</span>
            </button>
            {hasExtra && isExpanded && (
              // v4 conseiller : alignement à gauche sous le numéro, plus de fond
              // cassé blanc (V.card2). Texte sobre directement sur le fond glass.
              <div style={{ padding: '0 0 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chemin && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(142,68,173,0.08)', color: V.accent, alignSelf: 'flex-start', textTransform: 'uppercase', letterSpacing: .3 }}>{stripBraces(chemin)}</span>
                )}
                {justif && (
                  <div>
                    <div style={{ color: V.accent, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 3 }}>Pourquoi ce métier</div>
                    <div style={{ fontSize: 12, color: V.t9, lineHeight: 1.5 }}>{stripBraces(justif)}</div>
                  </div>
                )}
                {rankJustif && (
                  <div>
                    <div style={{ color: V.t5, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 3 }}>Pourquoi #{i + 1}</div>
                    <div style={{ fontSize: 12, color: V.t9, lineHeight: 1.5 }}>{stripBraces(rankJustif)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ====== Section : tous les métiers qui recrutent dans le département ======
function HiringByDeptSection({ tk, dept }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!dept) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `https://europe-west1-impakt-6c00e.cloudfunctions.net/hiringByDeptDashboard?dept=${encodeURIComponent(dept)}`,
          { headers: { Authorization: `Bearer ${tk}` } }
        );
        if (!cancelled) {
          if (r.ok) setData(await r.json());
          else setData({ error: 'Département pas encore rempli en Firestore', dept });
        }
      } catch (e) {
        if (!cancelled) setData({ error: e.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tk, dept]);

  if (loading) {
    return (
      <ProfCard title={`Univers FT — Métiers qui recrutent dans le ${dept || '?'}`}>
        <div style={{ padding: 16, textAlign: 'center', color: '#737373', fontSize: 12 }}>Chargement…</div>
      </ProfCard>
    );
  }
  if (!data || data.error) {
    return (
      <ProfCard title={`Univers FT — Métiers qui recrutent dans le ${dept || '?'}`}>
        <div style={{ padding: 16, textAlign: 'center', color: '#a3a3a3', fontSize: 12 }}>
          {data?.error || 'Pas de données pour ce département'}
        </div>
      </ProfCard>
    );
  }

  const c = data.counts;
  const sections = [
    { key: 'tresRecherche', label: 'Très recherché', romes: data.byTension.tresRecherche, color: '#047857', bg: 'rgba(16,185,129,0.10)' },
    { key: 'enDemande', label: 'En demande', romes: data.byTension.enDemande, color: '#059669', bg: 'rgba(16,185,129,0.06)' },
    { key: 'stable', label: 'Stable', romes: data.byTension.stable, color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
    { key: 'peuOffres', label: "Peu d'offres", romes: data.byTension.peuOffres, color: '#c2410c', bg: 'rgba(194,65,12,0.08)' },
    { key: 'sature', label: 'Saturé', romes: data.byTension.sature, color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  ];
  const totalDemande = c.tresRecherche + c.enDemande;

  return (
    <ProfCard title={`Univers FT — Métiers qui recrutent dans le ${dept} (${data.totalRomes} ROMEs)`}>
      <div style={{ marginBottom: 12, fontSize: 12, color: '#525252' }}>
        Pour le mode <b>« travailler vite »</b>, l&apos;algo ne propose que les métiers dont la tension est <b>« Très recherché »</b> ou <b>« En demande »</b> selon France Travail. Soit <b style={{ color: '#047857' }}>{totalDemande} ROMEs</b> sur {data.totalRomes} dans ce département.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <div key={s.key} style={{
            padding: '6px 10px', borderRadius: 8,
            background: s.bg, border: `1px solid ${s.color}33`,
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.romes.length}</div>
          </div>
        ))}
      </div>

      {/* v17.7.22 — Sandra : "j'ai pas accès à tous les métiers qui recrutent"
          → Recherche + suppression des limites + scroll par section. */}
      <input
        type="text"
        placeholder="Rechercher un métier (ex: commercial, dev, technicien...)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '8px 12px', marginBottom: 12,
          border: '1px solid rgba(15,15,15,0.12)', borderRadius: 8,
          fontFamily: 'inherit', fontSize: 12.5, color: '#171717',
          background: '#fafafa',
        }}
      />

      {sections.filter(s => s.romes.length > 0 && (showAll || ['tresRecherche', 'enDemande'].includes(s.key))).map(s => {
        const filtered = search.trim()
          ? s.romes.filter(r => {
              const q = search.trim().toLowerCase();
              if (r.codeROME?.toLowerCase().includes(q)) return true;
              return (r.titles || []).some(t => t.toLowerCase().includes(q));
            })
          : s.romes;
        if (filtered.length === 0) return null;
        return (
          <div key={s.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              {s.label} — {filtered.length}{search.trim() ? ` / ${s.romes.length}` : ''} ROMEs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 380, overflowY: 'auto', padding: 2 }}>
              {filtered.map((r, i) => (
                <div key={r.codeROME || i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', background: s.bg, borderRadius: 5,
                  fontSize: 11.5,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 9.5, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 4, background: 'rgba(127,73,151,0.10)', color: '#7f4997',
                    letterSpacing: 0.3, whiteSpace: 'nowrap',
                  }}>{r.codeROME}</span>
                  <span style={{ flex: 1, color: '#262626', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(r.titles && r.titles[0]) || r.codeROME}
                    {r.titles && r.titles.length > 1 && (
                      <span style={{ color: '#a3a3a3', fontSize: 10, marginLeft: 6 }}>
                        + {r.titles.length - 1} autre{r.titles.length > 2 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: '#737373', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {r.offersCount || 0} offres
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button onClick={() => setShowAll(!showAll)}
        style={{
          marginTop: 8, padding: '7px 14px',
          border: '1px solid rgba(15,15,15,0.12)', borderRadius: 8,
          background: 'rgba(255,255,255,0.65)',
          fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: '#525252',
          cursor: 'pointer',
        }}>
        {showAll ? '▲ Masquer Stable / Peu d\'offres / Saturé' : '▼ Voir aussi Stable / Peu d\'offres / Saturé'}
      </button>
    </ProfCard>
  );
}

// ====== Ligne d'un métier dans le pool Claude (sélectionné OU écarté) ======
// Si écarté : on affiche aussi "pourquoi" (matching branches/themes/RIASEC)
function PoolMetierRow({ m, selected, userBranches = [], userThemes = [], userRiasec = [] }) {
  // Calcul des matches
  const branchesMatch = (m.branches || []).filter(b => userBranches.includes(b));
  const themesMatch = (m.themes || []).filter(t => userThemes.includes(t));
  const riasecMatch = (m.riasec || []).filter(r => userRiasec.includes(r));

  // Raison probable du rejet (heuristique)
  let reason = null;
  if (!selected) {
    if (branchesMatch.length === 0 && themesMatch.length === 0) {
      reason = 'Aucun match branche/thème user';
    } else if (branchesMatch.length === 0 && themesMatch.length <= 1) {
      reason = 'Match faible (peu de thèmes)';
    } else if (m.niveauAcces && (m.niveauAcces.toLowerCase().includes('cap') && !m.niveauAcces.toLowerCase().includes('bac'))) {
      reason = 'Demande un CAP spécifique';
    } else if (riasecMatch.length === 0) {
      reason = 'Aucun match RIASEC';
    } else {
      reason = 'Score affinité plus faible';
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '8px 10px',
      background: selected ? 'rgba(16,185,129,0.05)' : 'rgba(15,15,15,0.02)',
      borderRadius: 6,
      fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 9.5, fontWeight: 700,
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(127,73,151,0.10)',
          color: '#7f4997',
          letterSpacing: 0.3,
          whiteSpace: 'nowrap',
        }}>{m.codeROME || '?'}</span>
        <span style={{ flex: 1, color: '#262626', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
        {m.niveauAcces && (
          <span style={{ fontSize: 10, color: '#737373', fontStyle: 'italic', whiteSpace: 'nowrap' }}>{m.niveauAcces}</span>
        )}
      </div>

      {/* Détails matches/rejet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4, flexWrap: 'wrap', fontSize: 10.5 }}>
        {branchesMatch.length > 0 && (
          <span style={{ color: '#047857' }}>
            ✓ {branchesMatch.length} branche{branchesMatch.length > 1 ? 's' : ''} : {branchesMatch.slice(0, 3).join(', ')}{branchesMatch.length > 3 ? '…' : ''}
          </span>
        )}
        {themesMatch.length > 0 && (
          <span style={{ color: '#047857' }}>
            ✓ {themesMatch.length} thème{themesMatch.length > 1 ? 's' : ''} : {themesMatch.slice(0, 3).join(', ')}{themesMatch.length > 3 ? '…' : ''}
          </span>
        )}
        {riasecMatch.length > 0 && (
          <span style={{ color: '#a3a3a3', fontFamily: 'monospace' }}>
            RIASEC ✓{riasecMatch.join('')}
          </span>
        )}
        {!selected && reason && (
          <span style={{
            color: '#dc2626', fontWeight: 600,
            background: 'rgba(220,38,38,0.06)',
            padding: '2px 8px', borderRadius: 4,
            marginLeft: 'auto',
          }}>
            ✕ {reason}
          </span>
        )}
      </div>
    </div>
  );
}

// ====== COMPOSANT PRINCIPAL ======

export default function ProfilePage() {
  const { token: tk, data: dashData } = useAuth();
  const { selectedUserUid, profileDefaultTab, closeProfile } = useNav();
  const onBack = closeProfile;

  // Cherche l'user dans la liste déjà chargée (sidebar) → on a les champs de
  // base immédiatement (prenom, nom, age, situation, etc.) sans attendre
  // l'API. Comme ça la fiche s'affiche INSTANTANÉMENT, puis on enrichit
  // avec les données complètes (activity, pathways, offres) en arrière-plan
  // — exactement le comportement du dashboard admin.
  const cachedUser = (() => {
    if (!selectedUserUid) return null;
    const list = (dashData?.recentUsers as any[]) || [];
    return list.find(x => x.uid === selectedUserUid) || null;
  })();
  const u = selectedUserUid ? (cachedUser || { uid: selectedUserUid }) : null;

  const [detail, setDetail] = useState<any>(cachedUser);
  // v17.8 — Si l'ouverture vient d'un point d'entrée précis (ex: clic sur
  // une demande de formation depuis la sidebar), on respecte l'onglet demandé.
  const [tab, setTab] = useState(profileDefaultTab || 'accueil');
  const [poolMode, setPoolMode] = useState('initial');
  const [expandedRooms, setExpandedRooms] = useState({});
  const [expandedPathway, setExpandedPathway] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  // Etat du bouton "Envoyer à Avenir(s)" : idle → sending → sent (3s) → idle
  const [avenirsState, setAvenirsState] = useState<'idle' | 'sending' | 'sent'>('idle');
  // v17.8 — Demandes de formation envoyées par le jeune via le bouton iOS
  const [formationRequests, setFormationRequests] = useState<FormationRequest[]>([]);

  // Fetch detail user (enrichissement en arrière-plan)
  const loadDetail = async () => {
    if (!u?.uid) return;
    setRefreshing(true);
    try {
      const r = await fetch(`${dashAPI}/user/${u.uid}`, { headers: { Authorization: `Bearer ${tk}` } });
      if (r.ok) { const dd = await r.json(); setDetail(dd); }
    } catch (e) {}
    setRefreshing(false);
  };

  useEffect(() => {
    // Si on change d'utilisateur, on remet le détail au cache (instantané)
    setDetail(cachedUser);
    // v17.8 — Si on a un onglet demandé via openProfile(uid, tab), on le force.
    if (profileDefaultTab) setTab(profileDefaultTab);
    loadDetail();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selectedUserUid, tk]);

  // v17.8 — Charge les demandes de formation envoyées par le jeune.
  useEffect(() => {
    if (!u?.uid || !tk) { setFormationRequests([]); return; }
    let cancelled = false;
    listFormationRequestsAPI(tk, u.uid)
      .then((res) => { if (!cancelled) setFormationRequests(res.requests || []); })
      .catch(() => { if (!cancelled) setFormationRequests([]); });
    return () => { cancelled = true; };
  }, [selectedUserUid, tk]);

  // Skeleton de chargement — le user voit immédiatement la structure de la
  // fiche au lieu d'un texte vide qui donne l'impression que rien ne se passe.
  if (!detail) {
    const ShimmerBlock = ({ height = 14, width = '100%', radius = 8 }: { height?: number; width?: number | string; radius?: number }) => (
      <div style={{
        height, width, borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(15,15,15,0.04) 0%, rgba(15,15,15,0.08) 50%, rgba(15,15,15,0.04) 100%)',
        backgroundSize: '200% 100%',
        animation: 'fi-shimmer 1.4s ease-in-out infinite',
      }} />
    );
    const ShimmerCard = ({ tall = false }: { tall?: boolean }) => (
      <div style={{
        background: 'rgba(255,255,255,0.52)',
        backdropFilter: 'blur(28px) saturate(140%)',
        WebkitBackdropFilter: 'blur(28px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 18,
        padding: 18,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <ShimmerBlock height={11} width={120} />
        <ShimmerBlock height={14} />
        <ShimmerBlock height={14} width="80%" />
        {tall && <><ShimmerBlock height={14} /><ShimmerBlock height={14} width="60%" /></>}
      </div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Les keyframes fi-shimmer sont déclarés dans le bloc global du return principal — pas besoin de les redéclarer ici. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{
              background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(28px) saturate(140%)',
              border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: 16, padding: 14,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <ShimmerBlock height={46} width={46} radius={12} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ShimmerBlock height={16} width={180} />
                <ShimmerBlock height={11} width={240} />
              </div>
            </div>
            <ShimmerCard tall />
            <ShimmerCard />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ShimmerCard tall />
            <ShimmerCard />
          </div>
        </div>
      </div>
    );
  }
  const d = detail;
  const ds = d.inscriptionDate ? new Date(d.inscriptionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const acts = d.activity || [];
  // Map des noms d'écrans iOS → libellé lisible pour le conseiller
  const screenNames: Record<string, string> = {
    home: "Accueil",
    top10: "Top 10 Métiers",
    pathway: "Parcours de formation",
    personality: "Personnalité",
    chat: "Conseiller IA",
    hiring: "Qui recrute",
    calendar: "Calendrier",
    offresEmploi: "Offres d'emploi",
    offresPersonnalisees: "Offres d'emploi",
    favoris: "Mes favoris",
    conseiller: "Messagerie conseiller",
    messagerie: "Messagerie conseiller",
    rendezvous: "Rendez-vous",
    profil: "Profil",
    profile: "Profil",
    settings: "Réglages",
    reglages: "Réglages",
    quiz: "Quiz d'orientation",
  };
  // Filtre les entrées d'activité qui sont des appels API internes (logs
  // techniques) — le conseiller ne doit voir que des actions utilisateur.
  const userActs = acts.filter((a: any) => {
    if (a.type === 'api' || a.type === 'api_call') return false;
    // Entrées techniques du backend (apiLogger) repérables par l'absence
    // d'action user-friendly et la présence d'un endpoint Cloud Function
    const techActions = new Set([
      'anthropicProxy', 'ftOffresList', 'ftOffres', 'dashboardAPI',
      'formationProSearch', 'sendMessageFromApp', 'createVideoRoom',
      'sendVoipCall', 'heartbeat', 'rebuildStats', 'logAudit',
    ]);
    if (techActions.has(a.action)) return false;
    return true;
  });
  const totalAppTime = d.totalAppTime || 0;
  const testTimeDisplay = totalAppTime > 0 ? (totalAppTime < 60 ? totalAppTime + 's' : totalAppTime < 3600 ? Math.floor(totalAppTime / 60) + ' min' : Math.floor(totalAppTime / 3600) + 'h' + ('0' + Math.floor((totalAppTime % 3600) / 60)).slice(-2)) : '—';
  const rp = d.riasecProfile || d.orientationScore?.riasec;
  const topMetiers = d.topMetiers || d.top3Jobs || [];
  const connexions = d.connexions || 0;
  const lastConn = d.lastActive ? new Date(d.lastActive).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';

  const quizAnswers = acts.filter(a => a.type === 'quiz' && a.action === 'question_answered');
  const room1Answers = quizAnswers.filter(a => a.detail === 'room1' || a.detail === 'Room 1').sort((a, b) => (a.metadata?.questionIndex || 0) - (b.metadata?.questionIndex || 0));
  const room2Answers = quizAnswers.filter(a => a.detail === 'room2' || a.detail === 'Room 2').sort((a, b) => (a.metadata?.questionIndex || 0) - (b.metadata?.questionIndex || 0));
  const room3Answers = quizAnswers.filter(a => a.detail === 'room3' || a.detail === 'Room 3').sort((a, b) => (a.metadata?.questionIndex || 0) - (b.metadata?.questionIndex || 0));

  const pathwayQuestionsActs = acts.filter(a => a.type === 'formation' && a.action === 'pathway_questions');
  const pathwayResultsActs = acts.filter(a => a.type === 'formation' && a.action === 'pathway_results');
  // Metiers recherches via le pathway generator (le user a tape son propre metier dans la barre de recherche)
  const pathwaySearchActs = acts.filter(a => a.action === 'job_viewed' && (a.metadata?.sector === 'pathway_search' || a.metadata?.sector === 'pathway'));
  const savedPathways = d.pathways || [];

  const toggleRoom = (r) => setExpandedRooms(prev => ({ ...prev, [r]: !prev[r] }));
  const togglePathway = (k) => setExpandedPathway(prev => ({ ...prev, [k]: !prev[k] }));

  const init = ((d.prenom || '?')[0] + (d.nom || '?')[0]).toUpperCase();
  const isJobSeeker = d.situation === 'sans_emploi' || d.situation === 'sansEmploi';

  const stLabel = d.quizCompleted ? 'Test complété' : d.quizStarted ? 'En cours' : 'Non démarré';
  const stType = d.quizCompleted ? 'green' : d.quizStarted ? 'orange' : 'red';

  const niveauLabel = d.niveauEtudes || d.classe || '—';

  // ===== EXPORT JSON =====
  const handleExport = () => {
    const exportData = {
      utilisateur: { nom: d.nom, prenom: d.prenom, age: d.age, dateNaissance: d.dateNaissance || null, gender: d.gender || null, email: d.email, ville: d.ville, codePostal: d.codePostal || null, codeDepartement: d.codeDepartement || null, situation: d.situation, niveau: d.niveauEtudes || d.classe || null, mineur: d.isMinor || false, inscription: d.inscriptionDate || ds || null, testDemarré: d.quizStarted || false, testComplété: d.quizCompleted || false },
      inscriptionDetail: isJobSeeker ? {
        identité: { prenom: d.prenom || null, nom: d.nom || null, dateNaissance: d.dateNaissance || null, age: d.age || null, gender: d.gender || null, email: d.email || null },
        localisation: { ville: d.ville || null, codePostal: d.codePostal || null, codeDepartement: d.codeDepartement || null },
        statutCompte: { inscription: d.inscriptionDate || ds || null, testDemarré: d.quizStarted || false, testComplété: d.quizCompleted || false, mineur: d.isMinor || false, situationDéclarée: "demandeur_emploi" },
        disponibilitéFormation: { dispoFormation: d.dispoFormation || [], dureeEtudesMax: d.dureeEtudesMax || null },
        dernierDiplôme: { typeDiplome: d.typeDiplome || null, domaineDiplome: d.domaineDiplome || null, niveauEtudes: d.niveauEtudes || null, classe: d.classe || null, filiere: d.filiere || null, niveauScolaire: d.niveauScolaire || null, moyenneGenerale: d.moyenneGenerale || null },
        expériencesPro: { aExperiencePro: d.aExperiencePro || null, metierActuel: d.metierActuel || null, liste: d.experiencesPro || [] },
        objectif: d.objectif || null
      } : null,
      quiz: { started: d.quizStarted || false, completed: d.quizCompleted || false, room1Completed: d.room1Completed || false, room2Completed: d.room2Completed || false, room3Completed: d.room3Completed || false, progression: d.quizProgress || 0 },
      riasec: rp || {},
      orientationScore: d.orientationScore || {},
      topMetiers: (topMetiers || []).map((m, i) => ({ rang: i + 1, titre: typeof m === 'string' ? m : (m.title || m.name || '') })),
      reponses: { room1: room1Answers.map(a => ({ question: a.metadata?.question || '', reponse: a.metadata?.answer || '', raw: a })), room2: room2Answers.map(a => ({ question: a.metadata?.question || '', reponse: a.metadata?.answer || '', raw: a })), room3: room3Answers.map(a => ({ question: a.metadata?.question || '', reponse: a.metadata?.answer || '', raw: a })), totalQuizAnswers: quizAnswers.length, totalActivity: acts.length, activitySample: acts.slice(0, 5) },
      parcours: { enregistres: (savedPathways || []).map(p => ({ type: p.type, metier: p.metierTitle || p.metier, date: p.savedAt || null, etapes: p.steps || p.etapes || [] })), proposes: (pathwayResultsActs || []).map(a => ({ metier: a.metadata?.metier || '', date: a.timestamp || null })) },
      engagement: { sessions: connexions, tempsTotal: totalAppTime, derniereConnexion: d.lastConnexion || null },
      historique: acts.slice(0, 100).map(a => ({ type: a.type, action: a.action, detail: a.detail, date: a.timestamp, metadata: a.metadata })),
      // v17.7.20 — Sandra : "je veux voir si Claude a vraiment trié et avec quel pool"
      // → On expose orientationLLM (résultat tri) + claudePool (entrée tri) dans l'export.
      orientationLLM: d.orientationLLM || null,
      orientationLLMFormationCourte: d.orientationLLMFormationCourte || null,
      claudePool: d.claudePool || null,
      // v17.7.21 — Trace pas-à-pas du flow LLM
      llmDebugTrace: d.llmDebugTrace || [],
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement('a');
    a2.href = url;
    a2.download = `profil_${(d.prenom || '').toLowerCase()}_${(d.nom || '').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
    a2.click();
    URL.revokeObjectURL(url);
  };

  // ========== EXPORT CSV ==========
  // Une ligne "champ → valeur", lisible dans Excel/Numbers/Google Sheets.
  const handleExportCSV = () => {
    const dispoLabels: Record<string, string> = {
      travailler_vite: 'Travailler vite', formation_courte: 'Formation courte', reprendre_etudes: 'Reprendre études'
    };
    const dispos = Array.isArray(d.dispoFormation) ? d.dispoFormation : (d.dispoFormation ? [d.dispoFormation] : []);
    const dispoStr = dispos.map((v: string) => dispoLabels[v] || v).join(', ');
    const exps = (d.experiencesPro || []).map((e: any) => `${e.duree || ''} - ${e.label || e.domaineLabel || ''}`).join(' | ');
    const careerPaths = (d.orientationLLM?.careerPaths || []).map((p: any) => p.name).join(', ');
    const topMet = (d.topMetiers || []).slice(0, 10).map((m: any, i: number) => `${i + 1}. ${typeof m === 'string' ? m : (m.title || '')}`).join(' | ');

    const rows: [string, any][] = [
      ['Prénom', d.prenom || ''],
      ['Nom', d.nom || ''],
      ['Âge', d.age || ''],
      ['Date de naissance', d.dateNaissance || ''],
      ['Genre', d.gender || ''],
      ['Email', d.email || ''],
      ['Ville', d.ville || ''],
      ['Code postal', d.codePostal || ''],
      ['Département', d.codeDepartement || ''],
      ['Situation', d.situation || ''],
      ['Niveau d\'études', d.niveauEtudes || d.classe || ''],
      ['Diplôme', d.typeDiplome || ''],
      ['Mineur', d.isMinor ? 'Oui' : 'Non'],
      ['Inscription', d.inscriptionDate ? new Date(d.inscriptionDate).toLocaleDateString('fr-FR') : ''],
      ['A une expérience pro', d.aExperiencePro === true || d.aExperiencePro === 'oui' ? 'Oui' : 'Non'],
      ['Expériences', exps],
      ['Métier actuel', d.metierActuel || ''],
      ['Disponibilité formation', dispoStr],
      ['Quiz démarré', d.quizStarted ? 'Oui' : 'Non'],
      ['Quiz complété', d.quizCompleted ? 'Oui' : 'Non'],
      ['Progression quiz', `${d.quizProgress || 0}%`],
      ['Top 10 métiers', topMet],
      ['Secteurs identifiés (Claude)', careerPaths],
      ['Dernière connexion', d.lastActive ? new Date(d.lastActive).toLocaleDateString('fr-FR') : ''],
      ['Temps total dans l\'app (s)', d.totalAppTime || 0],
      ['Connexions', d.connexions || 0],
      ['Offres matchées (total)', (d.matchedJobOffers || []).length],
      ['Offres vues', (d.matchedJobOffers || []).filter((o: any) => o.viewed).length],
      ['Offres en favoris', (d.matchedJobOffers || []).filter((o: any) => o.favorited).length],
    ];
    const escape = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    // Sépare avec ;  pour qu'Excel français ouvre direct sans assistant
    const csv = '﻿' + ['Champ;Valeur', ...rows.map(([k, v]) => `${escape(k)};${escape(v)}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement('a');
    a2.href = url;
    a2.download = `profil_${(d.prenom || '').toLowerCase()}_${(d.nom || '').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a2.click();
    URL.revokeObjectURL(url);
  };

  // ========== EXPORT PDF ==========
  // Fiche A4 magazine 6 pages — design IMPAKT V1.0
  // Téléchargement direct via html2canvas + jsPDF (pas de dialogue d'impression).
  const handleExportPDF = async () => {
    try {
      await downloadProfilePdf(d);
    } catch (e) {
      console.error('Export PDF échoué', e);
      alert("Échec de l'export PDF. Réessaie ou contacte le support.");
    }
    return;
    // --- Ancien export (jsPDF + autoTable) — conservé désactivé ---
    // eslint-disable-next-line no-unreachable
    const { default: jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = (autoTableModule as any).default || (autoTableModule as any);

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // Helper : si on est trop bas dans la page on saute à la suivante
    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };
    // Helper : titre de section avec barre violette à gauche
    const sectionTitle = (label: string) => {
      ensureSpace(28);
      doc.setFillColor(127, 73, 151);
      doc.rect(margin, y - 2, 3, 14, 'F');
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text(label, margin + 10, y + 9);
      y += 22;
    };

    // ============ HEADER ============
    doc.setFillColor(127, 73, 151);
    doc.rect(0, 0, pageW, 80, 'F');
    doc.setFillColor(232, 67, 147);
    doc.rect(0, 80, pageW, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text(`${d.prenom || ''} ${d.nom || ''}`.trim() || 'Candidat', margin, 38);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const subParts: string[] = [];
    if (d.age) subParts.push(`${d.age} ans`);
    if (d.situation) subParts.push(d.situation === 'sans_emploi' || d.situation === 'sansEmploi' ? "Demandeur d'emploi" : d.situation);
    if (d.ville) subParts.push(d.ville);
    if (d.codeDepartement) subParts.push(`Dept. ${d.codeDepartement}`);
    doc.text(subParts.join('  ·  '), margin, 58);
    doc.setFontSize(8.5);
    doc.text(`Fiche générée le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}  ·  IMPAKT Intelligence`, pageW - margin, 38, { align: 'right' });
    y = 105;

    // ============ RÉSUMÉ ============
    sectionTitle('Résumé du candidat');
    const summary = buildCandidateSummary(d);
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(summary, pageW - 2 * margin);
    ensureSpace(summaryLines.length * 13 + 6);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 13 + 16;

    // ============ COORDONNÉES ============
    autoTable(doc, {
      startY: y,
      head: [['Coordonnées', '']],
      body: [
        ['Email', d.email || '—'],
        ['Ville', d.ville || '—'],
        ['Code postal', d.codePostal || '—'],
        ['Département', d.codeDepartement ? `Dept. ${d.codeDepartement}` : '—'],
        ['Date de naissance', d.dateNaissance || '—'],
        ['Genre', d.gender || '—'],
        ['Niveau / Diplôme', d.typeDiplome || d.niveauEtudes || d.classe || '—'],
        ['Inscription IMPAKT', d.inscriptionDate ? new Date(d.inscriptionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
        ['Mineur', d.isMinor ? 'Oui' : 'Non'],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [232, 67, 147], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 130 } },
    });
    y = (doc as any).lastAutoTable.finalY + 18;

    // ============ SITUATION & DISPONIBILITÉ ============
    const dispos = Array.isArray(d.dispoFormation) ? d.dispoFormation : (d.dispoFormation ? [d.dispoFormation] : []);
    const wantsFast = dispos.includes('travailler_vite');
    const wantsFC = dispos.includes('formation_courte');
    const wantsReprise = dispos.includes('reprendre_etudes');
    const exps = (d.experiencesPro || []).map((e: any) => `${e.duree || ''} en ${e.label || e.domaineLabel || '—'}`);

    autoTable(doc, {
      startY: y,
      head: [['Situation et disponibilité', '']],
      body: [
        ['Situation déclarée', d.situation === 'sans_emploi' || d.situation === 'sansEmploi' ? "Demandeur d'emploi" : (d.situation || '—')],
        ['Souhaite travailler rapidement', wantsFast ? '✓  OUI' : '—'],
        ['Ouvert à une formation courte certifiante', wantsFC ? '✓  OUI' : '—'],
        ['Envisage de reprendre des études', wantsReprise ? '✓  OUI' : '—'],
        ['Durée d\'études maximum', d.dureeEtudesMax || '—'],
        ['A déjà une expérience pro', d.aExperiencePro === true || d.aExperiencePro === 'oui' ? 'Oui' : (d.aExperiencePro === false || d.aExperiencePro === 'non' ? 'Non' : '—')],
        ['Expérience(s) pro', exps.length > 0 ? exps.join('\n') : '—'],
        ['Métier actuel', d.metierActuel || '—'],
        ['Objectif déclaré', d.objectif || '—'],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [232, 67, 147], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 220 } },
    });
    y = (doc as any).lastAutoTable.finalY + 18;

    // ============ PROFIL D'ORIENTATION ============
    const rp = d.riasecProfile || d.orientationScore?.riasec;
    if (rp) {
      const labels: Record<string, string> = {
        R: 'Réaliste', I: 'Investigateur', A: 'Artistique', S: 'Social', E: 'Entreprenant', C: 'Conventionnel'
      };
      const sortedRiasec = Object.entries(rp)
        .map(([k, v]) => [k.toUpperCase(), Number(v)] as [string, number])
        .filter(([, v]) => !isNaN(v))
        .sort((a, b) => b[1] - a[1]);
      autoTable(doc, {
        startY: y,
        head: [['Profil RIASEC', 'Score']],
        body: sortedRiasec.map(([k, v]) => [`${k} — ${labels[k] || k}`, String(v)]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center', cellWidth: 60 } },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ============ SECTEURS IDENTIFIÉS PAR L'IA ============
    const careerPaths = d.orientationLLM?.careerPaths;
    if (Array.isArray(careerPaths) && careerPaths.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Secteurs identifiés', 'Description']],
        body: careerPaths.map((p: any) => [stripBraces(p?.name) || '—', stripBraces(p?.description) || '—']),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 150 } },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ============ TOP 10 MÉTIERS ============
    // Si l'IA a généré un Top 10, on prend ses titres ; sinon on prend topMetiers
    const llm = d.orientationLLM;
    const useLLM = llm && Array.isArray(llm.top10_titles) && llm.top10_titles.length > 0;
    const topItems: Array<{ rank: number; title: string }> = useLLM
      ? llm.top10_titles.slice(0, 10).map((t: string, i: number) => ({ rank: i + 1, title: stripBraces(t) }))
      : (d.topMetiers || []).slice(0, 10).map((m: any, i: number) => ({ rank: i + 1, title: typeof m === 'string' ? m : (m.title || m.name || '') }));
    if (topItems.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Top 10 métiers recommandés (sans formation)']],
        body: topItems.map(it => [String(it.rank), it.title]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 30, halign: 'center' } },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ============ TOP 10 AVEC FORMATION COURTE CERTIFIANTE ============
    const llmFC = d.orientationLLMFormationCourte;
    if (llmFC && Array.isArray(llmFC.top10_titles) && llmFC.top10_titles.length > 0) {
      const altItems = llmFC.top10_titles.slice(0, 10).map((t: string, i: number) => [String(i + 1), stripBraces(t)]);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Top 10 avec formation courte certifiante']],
        body: altItems,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [232, 67, 147], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 30, halign: 'center' } },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ============ PARCOURS DE FORMATION ============
    const savedP: any[] = d.pathways || [];
    if (savedP.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Parcours de formation enregistrés', '']],
        body: savedP.slice(0, 8).map((p: any, i: number) => [
          String(i + 1),
          (p.titre || p.metier || p.metierTitle || 'Parcours'),
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 30, halign: 'center' } },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ============ OFFRES D'EMPLOI MATCHÉES ============
    const offers = d.matchedJobOffers || [];
    if (offers.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Offre', 'Entreprise', 'Lieu', 'Salaire', 'Vue', 'Favori']],
        body: offers.map((o: any) => [
          o.title || '—',
          o.company || '—',
          o.location || '—',
          o.salaire || '—',
          o.viewed ? 'Oui' : 'Non',
          o.favorited ? '★' : '—',
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [127, 73, 151], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          3: { cellWidth: 60 },
          4: { cellWidth: 35, halign: 'center' },
          5: { cellWidth: 35, halign: 'center' },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ============ ENGAGEMENT & QUIZ ============
    const lastConn = d.lastActive ? new Date(d.lastActive).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const totalT = d.totalAppTime || 0;
    const tDisplay = totalT > 0 ? (totalT < 60 ? totalT + ' s' : totalT < 3600 ? Math.floor(totalT / 60) + ' min' : Math.floor(totalT / 3600) + ' h ' + Math.floor((totalT % 3600) / 60) + ' min') : '—';
    const quizState = d.quizCompleted ? 'Complété' : (d.quizStarted ? `En cours (${d.quizProgress || 0}%)` : 'Non démarré');
    autoTable(doc, {
      startY: y,
      head: [['Engagement et progression', '']],
      body: [
        ['Quiz d\'orientation', quizState],
        ['Room 1', d.room1Completed ? `Terminée${d.room1CompletedAt ? ' le ' + new Date(d.room1CompletedAt).toLocaleDateString('fr-FR') : ''}` : '—'],
        ['Room 2', d.room2Completed ? `Terminée${d.room2CompletedAt ? ' le ' + new Date(d.room2CompletedAt).toLocaleDateString('fr-FR') : ''}` : '—'],
        ['Room 3', d.room3Completed ? `Terminée${d.room3CompletedAt ? ' le ' + new Date(d.room3CompletedAt).toLocaleDateString('fr-FR') : ''}` : '—'],
        ['Connexions à l\'app', String(d.connexions || 0)],
        ['Temps total dans l\'app', tDisplay],
        ['Dernière connexion', lastConn],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [232, 67, 147], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 200 } },
    });

    doc.save(`profil_${(d.prenom || '').toLowerCase()}_${(d.nom || '').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ===== TABS (vue conseiller — sans Pool Claude ni Personnalité) =====
  // v17.8 — fusion Informations+Technique en un seul onglet "Informations",
  // ajout d'un onglet "Motivation" (uniquement pour les demandeurs d'emploi)
  const tabs = [
    { id: 'accueil', label: 'Accueil' },
    { id: 'metiers', label: 'Métiers recommandés' },
    { id: 'parcours', label: 'Parcours', badge: formationRequests.length > 0 ? formationRequests.length : undefined },
    ...(isJobSeeker ? [{ id: 'motivation', label: 'Motivation' }] : []),
    { id: 'informations', label: 'Informations' },
    { id: 'rdv', label: 'Rendez-vous' },
  ];

  // ===== TIMELINE PROGRESSION QUIZ (right column) =====
  // Coches uniquement pour Room 1, 2, 3. Demarrage et Termine = juste texte+timestamp.
  const renderQuizProgress = () => {
    const rows = [
      { label: 'Démarrage', done: !!d.quizStarted, at: d.quizStartedAt || d.inscriptionDate, withCheck: false },
      { label: 'Room 1', done: !!d.room1Completed, at: d.room1CompletedAt, withCheck: true },
      { label: 'Room 2', done: !!d.room2Completed, at: d.room2CompletedAt, withCheck: true },
      { label: 'Room 3', done: !!d.room3Completed, at: d.room3CompletedAt, withCheck: true },
      { label: 'Terminé', done: !!d.quizCompleted, at: d.quizCompletedAt || d.completedAt, withCheck: false },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r, i) => {
          const ts = r.at ? (() => {
            try {
              const dt = new Date(r.at);
              return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
            } catch { return ''; }
          })() : '';
          return (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < rows.length - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>
              {r.withCheck && (
                <div style={{ width: 18, height: 18, borderRadius: 5, background: r.done ? '#ecfdf5' : V.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {r.done ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" style={{ width: 11, height: 11 }}><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: V.t3 }} />
                  )}
                </div>
              )}
              <span style={{ fontSize: 12, color: r.done ? V.t9 : V.t4, fontWeight: r.done ? 600 : 500, flex: 1 }}>{r.label}</span>
              {ts && <span style={{ fontSize: 10, color: V.t4 }}>{ts}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const renderHistoriqueMini = () => {
    if (userActs.length === 0) return <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 12 }}>Aucune activité récente</div>;
    // Plus de slice(0, 6) : la card parente est scrollable, on affiche tout l'historique
    return userActs.map((a: any, i: number) => {
      let text: string | null = null;
      let emoji = '📋', bg = V.card2;
      if (a.action === 'tab_opened') {
        const name = screenNames[a.detail] || null;
        if (!name) return null; // page inconnue → on n'affiche pas
        text = `A consulté : ${name}`;
        emoji = '🧭'; bg = '#f0f9ff';
      } else if (a.action === 'job_viewed') {
        text = `Fiche métier : ${a.detail || ''}`;
        emoji = '🔍'; bg = '#f3f4f6';
      } else if (a.action === 'job_searched') {
        text = `Recherche métier : ${a.detail || ''}`;
        emoji = '🔎'; bg = '#f3f4f6';
      } else if (a.action === 'offer_viewed' || a.action === 'job_offer_viewed') {
        text = `Offre d'emploi consultée${a.detail ? ' : ' + a.detail : ''}`;
        emoji = '💼'; bg = '#fef3c7';
      } else if (a.type === 'formation') {
        text = `Parcours formation${a.detail ? ' : ' + a.detail : ''}`;
        emoji = '🎓'; bg = '#e0e7ff';
      } else if (a.type === 'chat') {
        text = 'Message au conseiller IA';
        emoji = '💬'; bg = '#fef3c7';
      } else if (a.type === 'quiz') {
        if (a.action === 'question_answered') text = `Quiz : a répondu à une question`;
        else if (a.action === 'room_completed' || a.action === 'completed') text = `Quiz : ${a.detail || 'room'} terminée`;
        else text = `Quiz d'orientation`;
        emoji = '✅'; bg = '#ecfdf5';
      } else {
        // Action inconnue / technique → on skip
        return null;
      }
      const ts = a.timestamp ? new Date(a.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < Math.min(userActs.length, 6) - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11 }}>{emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: V.t7, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</div>
            <div style={{ fontSize: 10, color: V.t4, marginTop: 1 }}>{ts}</div>
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      {/* Bug styled-jsx 0.73 : avoir plusieurs <style jsx global> dans le
          même composant fait paniquer son visiteur AST. On consolide donc
          tout ici (responsive grid + spin + shimmer) en UN seul bloc. */}
      <style jsx global>{`
        .fi-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 1200px) {
          .fi-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .fi-grid .fi-sidebar {
            position: static !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fi-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes sentPop {
          0%   { transform: scale(.7); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes sentRipple {
          0%   { transform: scale(.6); opacity: .7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        /* Masque la scrollbar horizontale sous la rangée d'onglets — tout en
           conservant le défilement par swipe/trackpad. */
        .fi-tabs::-webkit-scrollbar { display: none; height: 0; }
        .fi-tabs { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
      <div className="fi-grid">

        {/* ===== LEFT COLUMN ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          {/* TOP BAR — glass */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(255,255,255,0.52)',
            backdropFilter: 'blur(28px) saturate(140%)',
            WebkitBackdropFilter: 'blur(28px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 20,
            padding: '14px 18px',
            boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
          }}>
            <button onClick={onBack} style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid rgba(15,15,15,0.12)',
              background: 'rgba(255,255,255,0.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, color: '#525252',
              backdropFilter: 'blur(20px)',
            }}>
              <span style={{ width: 18, height: 18, display: 'inline-flex' }}>{Ic.back}</span>
            </button>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: G, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 700, flexShrink: 0,
              boxShadow: '0 3px 10px rgba(127,73,151,0.22), 0 8px 22px rgba(232,67,147,0.18)',
            }}>{init}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0a0a0a', letterSpacing: '-0.3px' }}>{d.prenom} {d.nom}</div>
              <div style={{ fontSize: 12, color: '#a3a3a3', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>{d.age ? d.age + ' ans' : '—'}</span>
                <span>·</span>
                <span>{d.situation || '—'}</span>
                <span>·</span>
                <span>{niveauLabel}</span>
                <Badge type={stType}>{stLabel}</Badge>
              </div>
            </div>
            {isJobSeeker && d.uid && <MotivationStatusPill uid={d.uid} userData={d} onClick={() => setTab('motivation')} />}
            <button
              onClick={loadDetail}
              disabled={refreshing}
              title="Réactualiser les données"
              aria-label="Réactualiser"
              onMouseEnter={(e) => { if (!refreshing) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.78)'; }}
              onMouseLeave={(e) => { if (!refreshing) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.55)'; }}
              style={{
                width: 36, height: 36,
                padding: 0,
                border: '1px solid rgba(255,255,255,0.7)',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(18px) saturate(140%)',
                WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
                cursor: refreshing ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: refreshing ? 0.55 : 1,
                color: '#262626',
                transition: 'background .15s ease, transform .15s ease',
              }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowExportMenu(v => !v)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.78)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.55)'; }}
                style={{
                  padding: '8px 14px',
                  border: '1px solid rgba(255,255,255,0.7)',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(18px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                  boxShadow: '0 2px 8px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
                  fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, color: '#262626',
                  letterSpacing: '-0.1px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'background .15s ease',
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                Exporter
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, marginLeft: 2, transform: showExportMenu ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showExportMenu && (
                <>
                  {/* clic en dehors → ferme le menu */}
                  <div onClick={() => setShowExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: 'rgba(255,255,255,0.88)',
                    backdropFilter: 'blur(24px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                    minWidth: 200, zIndex: 101,
                    overflow: 'hidden',
                    padding: 4,
                    animation: 'subnavIn .18s ease-out',
                  }}>
                    {[
                      { label: 'Exporter en PDF', desc: 'Fiche imprimable', onClick: () => { handleExportPDF(); setShowExportMenu(false); } },
                      { label: 'Exporter en CSV', desc: 'Tableur (Excel, Numbers)', onClick: () => { handleExportCSV(); setShowExportMenu(false); } },
                    ].map((opt, i) => (
                      <button
                        key={i}
                        onClick={opt.onClick}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '10px 14px',
                          background: 'transparent', border: 'none', borderBottom: i === 0 ? '1px solid rgba(15,15,15,0.06)' : 'none',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(127,73,151,0.06)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#262626' }}>{opt.label}</div>
                        <div style={{ fontSize: 10.5, color: '#a3a3a3', marginTop: 1 }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* === Bouton "Envoyer à Avenir(s)" avec animation de confirmation === */}
            <button
              onClick={() => {
                if (avenirsState !== 'idle') return;
                setAvenirsState('sending');
                // Simu API call — quand le vrai endpoint sera prêt, remplacer par un fetch réel
                setTimeout(() => {
                  setAvenirsState('sent');
                  setTimeout(() => setAvenirsState('idle'), 2200);
                }, 700);
              }}
              disabled={avenirsState !== 'idle'}
              onMouseEnter={(e) => {
                if (avenirsState === 'idle') {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 20px rgba(232,67,147,0.32), inset 0 1px 0 rgba(255,255,255,0.35)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = avenirsState === 'sent'
                  ? '0 4px 14px rgba(22,163,74,0.28), inset 0 1px 0 rgba(255,255,255,0.35)'
                  : '0 4px 14px rgba(232,67,147,0.25), inset 0 1px 0 rgba(255,255,255,0.35)';
              }}
              style={{
                position: 'relative', overflow: 'hidden',
                padding: '8px 16px',
                border: 'none', borderRadius: 999,
                background: avenirsState === 'sent'
                  ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
                  : 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
                color: '#fff',
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                letterSpacing: '-0.1px',
                cursor: avenirsState === 'idle' ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: avenirsState === 'sent'
                  ? '0 4px 14px rgba(22,163,74,0.28), inset 0 1px 0 rgba(255,255,255,0.35)'
                  : '0 4px 14px rgba(232,67,147,0.25), inset 0 1px 0 rgba(255,255,255,0.35)',
                transition: 'all .25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                minWidth: 132, justifyContent: 'center',
              }}
            >
              {avenirsState === 'idle' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Envoyer à Avenir(s)
                </>
              )}
              {avenirsState === 'sending' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }}>
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Envoi…
                </>
              )}
              {avenirsState === 'sent' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, animation: 'sentPop .4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Envoyé !
                </span>
              )}
              {avenirsState === 'sent' && (
                <span aria-hidden style={{
                  position: 'absolute', inset: 0, borderRadius: 999,
                  background: 'rgba(255,255,255,0.25)',
                  animation: 'sentRipple .9s ease-out',
                  pointerEvents: 'none',
                }} />
              )}
            </button>
          </div>

          {/* TABS DISCRETS — juste sous le header */}
          <DiscreteTabs tabs={tabs} active={tab} onChange={setTab} />

          {/* KPIs : UNIQUEMENT sur Technique — ils sont caches ailleurs y compris Accueil */}
          {tab === 'technique' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { val: testTimeDisplay, label: "Temps sur l'app", gradient: true },
                { val: connexions, label: 'Connexions' },
                { val: lastConn, label: 'Dernière connexion' },
              ].map((k, i) => (
                <SpotlightCard key={i}
                  spotlightColor={k.gradient ? 'rgba(255,255,255,0.18)' : 'rgba(232,67,147,0.16)'}
                  style={{
                    background: k.gradient ? 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)' : 'rgba(255,255,255,0.52)',
                    backdropFilter: k.gradient ? 'none' : 'blur(28px) saturate(140%)',
                    WebkitBackdropFilter: k.gradient ? 'none' : 'blur(28px) saturate(140%)',
                    border: k.gradient ? 'none' : '1px solid rgba(255,255,255,0.7)',
                    borderRadius: 16,
                    padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 5,
                    boxShadow: k.gradient
                      ? '0 3px 10px rgba(127,73,151,0.22), 0 8px 22px rgba(232,67,147,0.18), inset 0 1px 0 rgba(255,255,255,0.25)'
                      : '0 1px 2px rgba(15,15,15,0.03), 0 6px 20px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
                    animation: 'stagger-in 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
                    animationDelay: staggerDelay(i, 60, 5),
                  }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: k.gradient ? 'rgba(255,255,255,0.72)' : '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.gradient ? '#fff' : '#0a0a0a', letterSpacing: '-0.8px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {typeof k.val === 'number' && !isNaN(k.val) ? <CountUp value={k.val} /> : k.val}
                  </div>
                </SpotlightCard>
              ))}
            </div>
          )}

          {/* ============ TAB: ACCUEIL — résumé en haut + 2-col grid en dessous ============ */}
          {tab === 'accueil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* RÉSUMÉ DU CANDIDAT — pleine largeur, narratif, état des lieux
                  On attend les données complètes de l'API avant d'afficher
                  (sinon on affiche un fallback partiel qui change ensuite,
                  effet flash désagréable). Le marqueur fiable : la liste
                  `activity` ou `orientationLLM` n'est présente que dans la
                  réponse API, pas dans le cache user list. */}
              <ProfCard title="Résumé du candidat">
                {(() => {
                  const apiLoaded = Array.isArray(d.activity) || !!d.orientationLLM || Array.isArray(d.experiencesPro);
                  if (!apiLoaded) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className="shimmer-bg" style={{ height: 14, borderRadius: 6 }} />
                        <div className="shimmer-bg" style={{ height: 14, width: '90%', borderRadius: 6 }} />
                        <div className="shimmer-bg" style={{ height: 14, width: '75%', borderRadius: 6 }} />
                      </div>
                    );
                  }
                  const summary = buildCandidateSummary(d);
                  const favOffers = (d.matchedJobOffers || []).filter((o: any) => o.favorited);
                  const savedFormations = (savedPathways || []).length;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 13.5, color: V.t9, lineHeight: 1.6 }}>{summary}</div>
                      {(favOffers.length > 0 || savedFormations > 0) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 6, borderTop: `1px solid ${V.borderSoft}` }}>
                          {favOffers.length > 0 && (
                            <div style={{ fontSize: 11.5, color: V.t7, padding: '5px 10px', borderRadius: 999, background: 'rgba(232,67,147,0.08)' }}>
                              <span style={{ color: V.pink, fontWeight: 700 }}>★ {favOffers.length}</span> offre{favOffers.length > 1 ? 's' : ''} en favoris
                            </div>
                          )}
                          {savedFormations > 0 && (
                            <div style={{ fontSize: 11.5, color: V.t7, padding: '5px 10px', borderRadius: 999, background: 'rgba(127,73,151,0.08)' }}>
                              <span style={{ color: V.accent, fontWeight: 700 }}>⭐ {savedFormations}</span> parcours de formation enregistré{savedFormations > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </ProfCard>

              <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, alignItems: 'start' }}>
              {/* COLONNE GAUCHE — stack vertical */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ProfCard title="Top 10 métiers recommandés">
                  <MetiersList metiers={topMetiers} limit={10} llm={d.orientationLLM} />
                </ProfCard>

                <ProfCard title="Parcours de formation">
                  {savedPathways.length === 0 && pathwayResultsActs.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 12 }}>Aucun parcours généré</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {savedPathways.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: V.green, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 6 }}>⭐ Enregistrés · {savedPathways.length}</div>
                          {savedPathways.slice(0, 4).map((p, i) => (
                            <div key={i} style={{ fontSize: 12, color: V.t7, padding: '4px 0', borderBottom: i < Math.min(savedPathways.length, 4) - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>• {p.titre || p.metier || 'Parcours'}</div>
                          ))}
                        </div>
                      )}
                      {pathwayResultsActs.length > 0 && (
                        <div style={{ marginTop: savedPathways.length > 0 ? 8 : 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 6 }}>Proposés · {pathwayResultsActs.length}</div>
                          {pathwayResultsActs.slice(0, 4).map((a, i) => (
                            <div key={i} style={{ fontSize: 12, color: V.t7, padding: '4px 0', borderBottom: i < Math.min(pathwayResultsActs.length, 4) - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>• {a.detail || 'Métier'}</div>
                          ))}
                        </div>
                      )}
                      <button onClick={() => setTab('parcours')} style={{ marginTop: 6, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: V.accent, cursor: 'pointer', textAlign: 'left' }}>
                        Voir tous les parcours →
                      </button>
                    </div>
                  )}
                </ProfCard>

                <ProfCard title={`Réponses au quiz · ${quizAnswers.length} réponses`}>
                  {quizAnswers.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 12 }}>Quiz non démarré</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {[['Room 1', room1Answers.length], ['Room 2', room2Answers.length], ['Room 3', room3Answers.length]].map(([label, n], i) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? `1px solid ${V.borderSoft}` : 'none' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: V.t9 }}>{label}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: V.t4 }}>{n} réponses</span>
                        </div>
                      ))}
                      {/* Lien retiré : la vue conseiller n'a pas l'onglet Personnalité */}
                    </div>
                  )}
                </ProfCard>
              </div>

              {/* COLONNE DROITE — stack vertical (Inscription demandeur en haut + Apercu scoring + RIASEC en bas) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {isJobSeeker && (() => {
                  const dispoLabels = { travailler_vite: "Travailler vite", formation_courte: "Formation courte", reprendre_etudes: "Reprendre études" };
                  const dispos = Array.isArray(d.dispoFormation) ? d.dispoFormation : (d.dispoFormation ? [d.dispoFormation] : []);
                  return (
                    <ProfCard title="Inscription · Demandeur d'emploi">
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: V.t4, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 6 }}>Disponibilité formation</div>
                        {dispos.length === 0 ? <div style={{ fontSize: 11, color: V.t4 }}>Non renseigné</div> :
                          dispos.map((v, i) => (
                            <div key={i} style={{ fontSize: 13, fontWeight: 700, color: V.t9, padding: '3px 0' }}>• {dispoLabels[v] || v}</div>
                          ))
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: V.t4, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 6 }}>Dernier diplôme</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: V.t9 }}>{d.typeDiplome || d.niveauEtudes || '—'}</div>
                      </div>
                      <button onClick={() => setTab('informations')} style={{ marginTop: 12, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: V.accent, cursor: 'pointer', textAlign: 'left' }}>
                        Voir le détail complet →
                      </button>
                    </ProfCard>
                  );
                })()}

                {isJobSeeker && d.uid && (
                  <MotivationSection uid={d.uid} userData={d} onSeeAll={() => setTab('motivation')} />
                )}


                <ProfCard title="Offres d'emploi matchées">
                  {(() => {
                    const offers = d.matchedJobOffers || d.personalisedOffers || [];
                    if (offers.length === 0) {
                      return <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 12 }}>Aucune offre matchée pour l&apos;instant</div>;
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {offers.slice(0, 6).map((o: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom: i < Math.min(offers.length, 6) - 1 ? `1px solid ${V.borderSoft}` : 'none',
                          }}>
                            <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: V.t9, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title || o.intitule || 'Offre'}</div>
                              <div style={{ fontSize: 10.5, color: V.t4, marginTop: 2 }}>
                                {(o.company || o.entreprise || '—')}{o.location ? ' · ' + o.location : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                              {o.favorited && (
                                <div style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(232,67,147,0.12)', color: V.pink, textTransform: 'uppercase', letterSpacing: .3 }}>
                                  ★ Favori
                                </div>
                              )}
                              <div style={{
                                fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                                background: o.viewed ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                color: o.viewed ? V.green : V.orange,
                                textTransform: 'uppercase', letterSpacing: .3,
                              }}>
                                {o.viewed ? 'Vu' : 'Pas vu'}
                              </div>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => setTab('offres')} style={{ marginTop: 6, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: V.accent, cursor: 'pointer', textAlign: 'left' }}>
                          Voir toutes les offres ({offers.length}) →
                        </button>
                      </div>
                    );
                  })()}
                </ProfCard>

                <ProfCard title="Profil IMPAKT (RIASEC)">
                  <RiasecBars rp={rp} />
                </ProfCard>
              </div>
              </div>
            </div>
          )}

          {/* ============ TAB: MÉTIERS RECOMMANDÉS ============ */}
          {/* v17.7.22 — Si top 10 alternatif (formation courte) dispo, on l'affiche
              à côté de l'initial. Le scoring passe en dessous sur toute la largeur. */}
          {tab === 'metiers' && (() => {
            const altLLM = d.orientationLLMFormationCourte;
            const hasAlt = altLLM && Array.isArray(altLLM.top10_titles) && altLLM.top10_titles.length > 0;
            const altMetiers = hasAlt
              ? altLLM.top10_titles.map((t, i) => ({ rang: i + 1, titre: t, id: altLLM.top10_ids?.[i] }))
              : [];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: hasAlt ? '1fr 1fr' : '1fr', gap: 14, alignItems: 'start' }}>
                  <ProfCard title="Top 10 — Sans formation (initial)">
                    <MetiersList metiers={topMetiers} limit={10} llm={d.orientationLLM} />
                  </ProfCard>
                  {hasAlt && (
                    <ProfCard title="Top 10 — Avec formation courte certifiante">
                      <div style={{ fontSize: 11, color: '#7f4997', marginBottom: 8, padding: '4px 8px', background: 'rgba(127,73,151,0.06)', borderRadius: 6 }}>
                        Métiers accessibles via titre pro RNCP, certif, bootcamp (qq semaines à mois).
                      </div>
                      <MetiersList metiers={altMetiers} limit={10} llm={altLLM} />
                    </ProfCard>
                  )}
                </div>
                <ProfCard title="Détail du scoring">
                  <ScoringDetail d={d} />
                </ProfCard>
              </div>
            );
          })()}

          {/* ============ TAB: POOL CLAUDE — métiers vus par Claude + univers FT du dept ============ */}
          {tab === 'pool' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Section 0 : Tous les métiers qui recrutent dans le département */}
              <HiringByDeptSection tk={tk} dept={d.codeDepartement} />

              {/* v17.7.21 — Trace pas-à-pas du flow LLM (où ça plante) */}
              {Array.isArray(d.llmDebugTrace) && d.llmDebugTrace.length > 0 && (
                <ProfCard title={`Trace flow LLM (${d.llmDebugTrace.length} étapes)`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    {d.llmDebugTrace.map((e, i) => {
                      const isFail = e.step?.includes('FAIL') || e.step?.includes('99_');
                      const isSuccess = e.step?.includes('SUCCESS') || e.step?.includes('07_claude_returned') || e.step?.includes('08_');
                      const bg = isFail ? 'rgba(220,38,38,0.08)' : isSuccess ? 'rgba(16,185,129,0.08)' : '#fafafa';
                      const color = isFail ? '#991b1b' : isSuccess ? '#047857' : '#525252';
                      const t = e.timestamp ? new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                      return (
                        <div key={i} style={{ padding: '6px 10px', background: bg, borderRadius: 6, display: 'flex', gap: 10, alignItems: 'baseline' }}>
                          <code style={{ fontSize: 10, color: V.t4, fontFamily: 'monospace', minWidth: 70 }}>{t}</code>
                          <strong style={{ color, fontFamily: 'monospace', fontSize: 11, minWidth: 220 }}>{e.step}</strong>
                          <span style={{ color: V.t4, fontSize: 11 }}>{e.detail}</span>
                        </div>
                      );
                    })}
                  </div>
                </ProfCard>
              )}

              {(() => {
                // v17.7.25 — On choisit pool + top10 selon le mode (initial vs formation courte)
                const isFC = poolMode === 'formationCourte';
                const pool = isFC ? d.claudePoolFormationCourte : d.claudePool;
                const llm = isFC ? d.orientationLLMFormationCourte : d.orientationLLM;
                const hasFC = !!(d.claudePoolFormationCourte && d.claudePoolFormationCourte.metiers && d.claudePoolFormationCourte.metiers.length > 0);
                const hasInitial = !!(d.claudePool && d.claudePool.metiers && d.claudePool.metiers.length > 0);

                // Toggle Initial / Formation courte (visible uniquement si formation courte existe)
                const toggle = hasFC ? (
                  <ProfCard title="Mode pool">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setPoolMode('initial')}
                        style={{
                          padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: poolMode === 'initial' ? '1px solid #171717' : '1px solid rgba(15,15,15,0.12)',
                          background: poolMode === 'initial' ? '#171717' : 'transparent',
                          color: poolMode === 'initial' ? '#fff' : '#525252',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}
                      >Sans formation (initial)</button>
                      <button
                        onClick={() => setPoolMode('formationCourte')}
                        style={{
                          padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: poolMode === 'formationCourte' ? '1px solid #171717' : '1px solid rgba(15,15,15,0.12)',
                          background: poolMode === 'formationCourte' ? '#171717' : 'transparent',
                          color: poolMode === 'formationCourte' ? '#fff' : '#525252',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}
                      >Avec formation courte</button>
                    </div>
                  </ProfCard>
                ) : null;

                if (!pool || !pool.metiers || pool.metiers.length === 0) {
                  return (
                    <>
                      {toggle}
                      <ProfCard title={`Pool Claude — ${isFC ? 'formation courte' : 'initial'}`}>
                        <div style={{ padding: 30, textAlign: 'center', color: V.t4, fontSize: 13 }}>
                          Aucun pool enregistré pour ce mode.<br />
                          <span style={{ fontSize: 11 }}>
                            {isFC
                              ? 'Le user ne qualifie pas pour la variante formation courte (ou pas encore calculé).'
                              : 'Voir la trace ci-dessus pour comprendre pourquoi.'}
                          </span>
                        </div>
                      </ProfCard>
                    </>
                  );
                }
                // On compare avec le top10 du MÊME mode
                const top10Ids = new Set((llm?.top10_ids) || []);
                const top10Titles = new Set((llm?.top10_titles) || []);
                const inTop10 = (m) => top10Ids.has(m.id) || top10Titles.has(m.title);
                const kept = pool.metiers.filter(inTop10);
                const dropped = pool.metiers.filter(m => !inTop10(m));
                const generatedAt = pool.generatedAt
                  ? new Date(pool.generatedAt._seconds ? pool.generatedAt._seconds * 1000 : pool.generatedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '—';
                const claudeLatency = llm?.latencyMs ? Math.round(llm.latencyMs / 100) / 10 : null;
                const claudeTokensIn = llm?.inputTokens || 0;
                const claudeTokensOut = llm?.outputTokens || 0;
                const claudeRanAt = llm?.generatedAt ? new Date(llm.generatedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
                const claudeReallyRan = !!llm && (claudeLatency || claudeTokensIn);
                return (
                  <>
                    {/* v17.7.25 — Toggle Initial / Formation courte (en haut) */}
                    {toggle}
                    {/* v17.7.20 — Bandeau "Claude est-il intervenu ?" — preuve directe */}
                    <ProfCard title={`Appel Claude (tri du Top 10 — ${isFC ? 'formation courte' : 'initial'})`}>
                      {claudeReallyRan ? (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)', borderRadius: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.4 }}>Statut</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>✅ Claude a trié</div>
                          </div>
                          <div style={{ padding: '8px 12px', background: '#fafafa', border: '1px solid rgba(15,15,15,0.08)', borderRadius: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: 0.4 }}>Durée</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>{claudeLatency != null ? `${claudeLatency}s` : '—'}</div>
                          </div>
                          <div style={{ padding: '8px 12px', background: '#fafafa', border: '1px solid rgba(15,15,15,0.08)', borderRadius: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: 0.4 }}>Tokens In</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>{claudeTokensIn.toLocaleString('fr-FR')}</div>
                          </div>
                          <div style={{ padding: '8px 12px', background: '#fafafa', border: '1px solid rgba(15,15,15,0.08)', borderRadius: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: 0.4 }}>Tokens Out</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#171717', fontVariantNumeric: 'tabular-nums' }}>{claudeTokensOut.toLocaleString('fr-FR')}</div>
                          </div>
                          {claudeRanAt && (
                            <div style={{ padding: '8px 12px', background: '#fafafa', border: '1px solid rgba(15,15,15,0.08)', borderRadius: 8 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: 0.4 }}>Effectué le</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#171717' }}>{claudeRanAt}</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
                          ❌ <strong>Claude n&apos;a pas trié</strong> (champ orientationLLM vide).
                          {pool ? ' Le pool a été préparé mais l\'appel Claude a échoué ou n\'a pas été fait.' : ' Aucun pool préparé non plus.'}
                        </div>
                      )}
                    </ProfCard>

                    <ProfCard title={`Pool envoyé à Claude — ${pool.size} métiers`}>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.4 }}>Sélectionnés (Top 10)</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#047857', fontVariantNumeric: 'tabular-nums' }}>{kept.length}</div>
                        </div>
                        <div style={{ padding: '8px 12px', background: 'rgba(115,115,115,0.08)', border: '1px solid rgba(15,15,15,0.10)', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: 0.4 }}>Écartés par Claude</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#525252', fontVariantNumeric: 'tabular-nums' }}>{dropped.length}</div>
                        </div>
                        <div style={{ padding: '8px 12px', background: 'rgba(127,73,151,0.06)', border: '1px solid rgba(127,73,151,0.20)', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#7f4997', textTransform: 'uppercase', letterSpacing: 0.4 }}>Généré</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#7f4997' }}>{generatedAt}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: V.t4, marginBottom: 8 }}>
                        Ce sont les métiers que Claude a reçus en entrée après le filtrage (niveau d&apos;études + tension France Travail). Claude a ensuite sélectionné les 10 meilleurs.
                      </div>
                    </ProfCard>

                    <ProfCard title={`✅ Sélectionnés par Claude (${kept.length})`}>
                      {kept.length === 0 ? (
                        <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 12 }}>
                          Aucun métier du pool n&apos;est dans le top 10 (incohérence ?)
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {kept.map((m, i) => (
                            <PoolMetierRow
                              key={m.id || i}
                              m={m}
                              selected
                              userBranches={d.orientationScore?.selectedBranches || []}
                              userThemes={d.orientationScore?.themePreferences || []}
                              userRiasec={Object.keys(d.orientationScore?.riasec || {}).sort((a, b) => (d.orientationScore.riasec[b] || 0) - (d.orientationScore.riasec[a] || 0)).slice(0, 3)}
                            />
                          ))}
                        </div>
                      )}
                    </ProfCard>

                    <ProfCard title={`Écartés par Claude (${dropped.length})`}>
                      {dropped.length === 0 ? (
                        <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 12 }}>
                          Tout le pool a été retenu dans le top 10
                        </div>
                      ) : (
                        <div style={{ maxHeight: 600, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {dropped.map((m, i) => (
                            <PoolMetierRow
                              key={m.id || i}
                              m={m}
                              userBranches={d.orientationScore?.selectedBranches || []}
                              userThemes={d.orientationScore?.themePreferences || []}
                              userRiasec={Object.keys(d.orientationScore?.riasec || {}).sort((a, b) => (d.orientationScore.riasec[b] || 0) - (d.orientationScore.riasec[a] || 0)).slice(0, 3)}
                            />
                          ))}
                        </div>
                      )}
                    </ProfCard>
                  </>
                );
              })()}
            </div>
          )}

          {/* ============ TAB: PARCOURS — 2 colonnes qui s'empilent proprement (fini les espaces vides) ============ */}
          {tab === 'parcours' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
              {/* COLONNE GAUCHE : Demandes formation + Parcours proposes + Parcours enregistres (empiles) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* v17.8 — Demandes de formation envoyées par le jeune depuis l'app iOS */}
                {formationRequests.length > 0 && (
                  <ProfCard title={`Demandes de formation reçues (${formationRequests.length})`} titleRight={
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #7f4997, #E84393)', padding: '3px 9px', borderRadius: 999, letterSpacing: 0.3, boxShadow: '0 2px 8px rgba(232,67,147,0.30), inset 0 1px 0 rgba(255,255,255,0.4)' }}>NOUVEAU</span>
                  }>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {formationRequests.map((r) => {
                        const ts = r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                        // Bouton Voir : lien direct France Compétences si on a le code RNCP,
                        // sinon recherche Google ciblée pour retrouver la fiche.
                        // v17.8 — Portail formation France Travail (alimenté par Carif-OREF) :
                        // recherche publique, pas de connexion requise pour consulter une
                        // fiche. Le bouton "Voir la fiche" emmène le conseiller directement
                        // sur les sessions concrètes correspondant à la demande du jeune.
                        const ficheQuery = [r.formationNom, r.formationOrganisme].filter(Boolean).join(' ');
                        const ficheUrl = `https://candidat.francetravail.fr/formations/recherche?motsCles=${encodeURIComponent(ficheQuery)}`;
                        return (
                          <div key={r.id} style={{
                            position: 'relative',
                            padding: '14px 14px 12px 14px',
                            borderRadius: 14,
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.35) 100%), linear-gradient(180deg, rgba(232,67,147,0.06) 0%, rgba(127,73,151,0.04) 100%)',
                            backdropFilter: 'blur(18px) saturate(160%)',
                            WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                            border: '1px solid rgba(232,67,147,0.20)',
                            boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.85), 0 1px 2px rgba(15,15,15,0.04), 0 6px 18px rgba(232,67,147,0.10)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, flexShrink: 0,
                                borderRadius: 9,
                                background: 'linear-gradient(135deg, #7f4997, #E84393)',
                                color: '#fff', fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 10px rgba(232,67,147,0.30), inset 0 1px 0 rgba(255,255,255,0.45)',
                              }}>📚</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: V.t9, letterSpacing: '-0.1px', lineHeight: 1.3 }}>{r.formationNom}</div>
                                  <div style={{ fontSize: 10.5, fontWeight: 500, color: V.t4, whiteSpace: 'nowrap' }}>{ts}</div>
                                </div>
                                {(r.formationOrganisme || r.formationVille) && (
                                  <div style={{ fontSize: 11.5, color: V.t7, marginTop: 3, lineHeight: 1.4 }}>
                                    {[r.formationOrganisme, r.formationVille].filter(Boolean).join(' — ')}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* v17.8 — Tags + bouton Voir la fiche alignés horizontalement
                                (le bouton est à droite, en face des tags durée/RNCP/financement). */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
                                {r.metier && <span style={{ fontSize: 10, fontWeight: 600, color: V.t8, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: '3px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.7)' }}>Métier : {r.metier}</span>}
                                {r.formationDuree && <span style={{ fontSize: 10, fontWeight: 600, color: V.t8, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', padding: '3px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.7)' }}>⏱ {r.formationDuree}</span>}
                                {r.formationCodeRNCP && <span style={{ fontSize: 10, fontWeight: 700, color: '#7f4997', background: 'rgba(127,73,151,0.10)', padding: '3px 9px', borderRadius: 999, border: '1px solid rgba(127,73,151,0.20)' }}>{r.formationCodeRNCP}</span>}
                                {r.formationFinancement && <span style={{ fontSize: 10, fontWeight: 700, color: '#047857', background: 'rgba(16,185,129,0.12)', padding: '3px 9px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.22)' }}>💶 {r.formationFinancement}</span>}
                              </div>
                              <a
                                href={ficheUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  flexShrink: 0,
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '6px 11px',
                                  background: 'linear-gradient(135deg, #7f4997, #E84393)',
                                  color: '#fff',
                                  fontSize: 11, fontWeight: 600, letterSpacing: '-0.1px',
                                  borderRadius: 8,
                                  textDecoration: 'none',
                                  boxShadow: '0 3px 10px rgba(232,67,147,0.25), inset 0 1px 0 rgba(255,255,255,0.40)',
                                  transition: 'transform .15s ease, box-shadow .15s ease',
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
                              >
                                <span>Voir la fiche</span>
                                <span style={{ fontSize: 10 }}>↗</span>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ProfCard>
                )}

                <ProfCard title={`Parcours proposés (${pathwayResultsActs.length} générations)`}>
                  {pathwayResultsActs.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 16 }}>Aucun parcours généré</div>
                  ) : pathwayResultsActs.map((a, i) => {
                    const key = 'proposed_' + i;
                    const isOpen = expandedPathway[key];
                    const publics = a.metadata?.parcours_publics || [];
                    const prives = a.metadata?.parcours_prives || [];
                    const ts = a.timestamp ? new Date(a.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <div key={i}>
                        <button onClick={() => togglePathway(key)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 0', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 12, color: V.t9, cursor: 'pointer', borderBottom: `1px solid ${V.borderSoft}`, textAlign: 'left' }}>
                          <span style={{ width: 12, height: 12, color: V.t4, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                          <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail || 'Métier inconnu'}</span>
                          <span style={{ fontSize: 10, color: V.t4 }}>{ts}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '8px 0 8px 20px' }}>
                            {publics.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: V.blue, textTransform: 'uppercase', marginBottom: 4 }}>Parcours publics</div>
                                {publics.map((p, j) => (
                                  <div key={j} style={{ padding: '4px 0', borderBottom: `1px solid ${V.borderSoft}` }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: V.t9 }}>{p.titre || `Parcours ${j + 1}`}</div>
                                    {Object.entries(p).filter(([k]) => k.startsWith('etape')).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => <div key={k} style={{ fontSize: 11, color: V.t7, paddingLeft: 8 }}>• {v}</div>)}
                                  </div>
                                ))}
                              </div>
                            )}
                            {prives.length > 0 && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: V.accent, textTransform: 'uppercase', marginBottom: 4 }}>Parcours privés</div>
                                {prives.map((p, j) => (
                                  <div key={j} style={{ padding: '4px 0', borderBottom: `1px solid ${V.borderSoft}` }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: V.t9 }}>{p.titre || `Parcours ${j + 1}`}</div>
                                    {Object.entries(p).filter(([k]) => k.startsWith('etape')).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => <div key={k} style={{ fontSize: 11, color: V.t7, paddingLeft: 8 }}>• {v}</div>)}
                                  </div>
                                ))}
                              </div>
                            )}
                            {publics.length === 0 && prives.length === 0 && <div style={{ fontSize: 11, color: V.t4 }}>Données non disponibles</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </ProfCard>

              </div>

              {/* COLONNE DROITE : Parcours enregistres (en haut, à côté des proposés) + Questions parcours + Metiers recherches */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* v17.8 — Parcours enregistres déplacé ici pour être à côté des proposés (au lieu de dessous) */}
                <ProfCard title={`Parcours enregistrés (${savedPathways.length})`}>
                  {savedPathways.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 16 }}>Aucun parcours enregistré</div>
                  ) : savedPathways.map((p, i) => {
                    const key = 'saved_' + i;
                    const isOpen = expandedPathway[key];
                    return (
                      <div key={i}>
                        <button onClick={() => togglePathway(key)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 0', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 12, color: V.t9, cursor: 'pointer', borderBottom: `1px solid ${V.borderSoft}`, textAlign: 'left' }}>
                          <span style={{ width: 12, height: 12, color: V.t4, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                          <Badge type={p.type === 'public' ? 'blue' : p.type === 'privé' ? 'purple' : 'green'}>{p.type}</Badge>
                          <span style={{ fontWeight: 600 }}>{p.titre || p.metier || 'Parcours'}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '8px 0 8px 20px' }}>
                            {(p.formations || p.etapes_formation || []).map((f, j) => {
                              // v17.8 — Bouton "Voir" : lien direct Parcoursup si on a le code,
                              // sinon recherche France Compétences par nom + organisme.
                              const nom = f.nom || f.titre || '';
                              const ecole = f.ecole || '';
                              const ville = f.ville || '';
                              // v17.8 — Parcoursup pour les formations post-bac, sinon
                              // portail formation France Travail (Carif-OREF public).
                              const ficheUrl = f.parcoursup_code && f.parcoursup_code !== 'null'
                                ? `https://www.parcoursup.fr/index.php?desc=formations&for=fr&codeFormation=${encodeURIComponent(f.parcoursup_code)}`
                                : `https://candidat.francetravail.fr/formations/recherche?motsCles=${encodeURIComponent([nom, ecole].filter(Boolean).join(' '))}`;
                              return (
                                <div key={j} style={{ padding: '8px 0', borderBottom: `1px solid ${V.borderSoft}`, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: V.t9 }}>{j + 1}. {nom || '—'}</div>
                                    <div style={{ fontSize: 11, color: V.t4 }}>{ecole}{ville ? ' — ' + ville : ''}{f.duree ? ' — ' + f.duree : ''}</div>
                                    {f.cout && <div style={{ fontSize: 10, color: V.t4 }}>Coût: {f.cout}</div>}
                                  </div>
                                  {nom && (
                                    <a
                                      href={ficheUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        flexShrink: 0,
                                        fontSize: 10.5, fontWeight: 600, letterSpacing: '-0.1px',
                                        color: V.t8,
                                        background: 'rgba(255,255,255,0.55)',
                                        backdropFilter: 'blur(8px)',
                                        WebkitBackdropFilter: 'blur(8px)',
                                        padding: '5px 10px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(15,15,15,0.10)',
                                        textDecoration: 'none',
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        whiteSpace: 'nowrap',
                                        transition: 'all .15s ease',
                                      }}
                                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.85)'; }}
                                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.55)'; }}
                                    >
                                      Voir <span style={{ fontSize: 9 }}>↗</span>
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </ProfCard>

                <ProfCard title={`Questions parcours (${pathwayQuestionsActs.length})`}>
                  {pathwayQuestionsActs.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 16 }}>Aucune donnée</div>
                  ) : pathwayQuestionsActs.map((a, i) => {
                    const key = 'pq_' + i;
                    const isOpen = expandedPathway[key];
                    const answers = a.metadata || {};
                    const ts = a.timestamp ? new Date(a.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                    const labels = { 'métier': 'Métier visé', 'lieu': 'Lieu', 'filière': 'Filière', 'spécialités': 'Spécialités', 'moyenne': 'Moyenne', 'durée études': 'Durée études', 'étranger': 'Étranger', 'alternance': 'Alternance', 'diplôme en cours': 'Diplôme en cours', 'filière étudiant': 'Filière étudiant', "année d'études": 'Année', 'poursuivre/réorienter': 'Objectif', 'format formation': 'Format', 'modalité': 'Modalité', 'objectif': 'Objectif', 'dernier diplôme': 'Dernier diplôme', 'droits formation': 'Droits formation' };
                    return (
                      <div key={i}>
                        <button onClick={() => togglePathway(key)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 0', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 12, color: V.t9, cursor: 'pointer', borderBottom: `1px solid ${V.borderSoft}`, textAlign: 'left' }}>
                          <span style={{ width: 12, height: 12, color: V.t4, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                          <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail || 'Métier inconnu'}</span>
                          <span style={{ fontSize: 10, color: V.t4 }}>{ts}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '8px 0 8px 20px' }}>
                            {Object.entries(answers).map(([k, v], j) => (
                              <div key={j} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: `1px solid ${V.borderSoft}` }}>
                                <span style={{ fontSize: 11, color: V.t4, minWidth: 110 }}>{labels[k] || k}</span>
                                <span style={{ fontSize: 12, fontWeight: 500, color: V.t9 }}>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </ProfCard>

                <ProfCard title={`Métiers recherchés (${pathwaySearchActs.length})`}>
                  {pathwaySearchActs.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 16 }}>Aucun métier recherché par l&apos;utilisateur</div>
                  ) : (() => {
                    const grouped = {};
                    pathwaySearchActs.forEach(a => {
                      const k = a.detail || 'Métier inconnu';
                      if (!grouped[k]) grouped[k] = { count: 0, lastTs: 0 };
                      grouped[k].count++;
                      const ts = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                      if (ts > grouped[k].lastTs) grouped[k].lastTs = ts;
                    });
                    const entries = Object.entries(grouped).sort((a, b) => b[1].lastTs - a[1].lastTs);
                    return entries.map(([metier, info], i) => {
                      const ts = info.lastTs ? new Date(info.lastTs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < entries.length - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(99,102,241,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke={V.blue} strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: V.t9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{metier}</div>
                            <div style={{ fontSize: 10, color: V.t4, marginTop: 1 }}>Dernière recherche · {ts}</div>
                          </div>
                          {info.count > 1 && (<Badge type="blue">×{info.count}</Badge>)}
                        </div>
                      );
                    });
                  })()}
                </ProfCard>
              </div>
            </div>
          )}

          {/* ============ TAB: PERSONNALITÉ — RIASEC + Quiz a gauche, Scoring detail a droite (pas de vide blanc) ============ */}
          {tab === 'personnalite' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
              {/* Colonne gauche : RIASEC (court) + Reponses quiz (long) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ProfCard title="Profil IMPAKT (RIASEC)">
                  <RiasecBars rp={rp} />
                </ProfCard>

                <ProfCard title={`Réponses au quiz · ${quizAnswers.length} réponses`}>
                  {quizAnswers.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12, textAlign: 'center', padding: 16 }}>Aucune réponse enregistrée</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {[['Room 1', room1Answers], ['Room 2', room2Answers], ['Room 3', room3Answers]].map(([label, answers]) => {
                        const isOpen = expandedRooms[label];
                        return (
                          <div key={label}>
                            <button onClick={() => toggleRoom(label)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 0', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: V.t9, cursor: 'pointer', borderBottom: `1px solid ${V.borderSoft}`, textAlign: 'left' }}>
                              <span style={{ width: 12, height: 12, color: V.t4, transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none', display: 'inline-flex', alignItems: 'center' }}>▶</span>
                              <span style={{ flex: 1 }}>{label}</span>
                              <span style={{ fontSize: 10, color: V.t4, fontWeight: 500 }}>{answers.length} réponses</span>
                            </button>
                            {isOpen && (
                              <div style={{ padding: '8px 0 8px 20px' }}>
                                {answers.length === 0 ? (
                                  <div style={{ fontSize: 11, color: V.t4 }}>Aucune réponse</div>
                                ) : answers.map((a, i) => (
                                  <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${V.borderSoft}` }}>
                                    <div style={{ fontSize: 11, color: V.t4 }}>{a.metadata?.question || `Question ${(a.metadata?.questionIndex || 0) + 1}`}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: V.t9, marginTop: 2 }}>{a.metadata?.answer || '—'}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ProfCard>
              </div>

              {/* Colonne droite : Detail scoring (long) */}
              <ProfCard title="Détail du scoring">
                <ScoringDetail d={d} />
              </ProfCard>
            </div>
          )}

          {/* ============ TAB: INFORMATIONS ============ */}
          {tab === 'informations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!isJobSeeker && (
                <ProfCard title="Identité">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      ['Nom', d.nom],
                      ['Prénom', d.prenom],
                      ['Âge', d.age ? d.age + ' ans' : '—'],
                      ['Date de naissance', d.dateNaissance || '—'],
                      ['Genre', d.gender || '—'],
                      ['Mineur', d.isMinor ? '⚠️ Oui' : 'Non'],
                      ['Date d\'inscription', ds],
                      ['Niveau', niveauLabel],
                    ].map(([l, v], i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: V.t4, textTransform: 'uppercase', letterSpacing: .3 }}>{l}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: V.t9, marginTop: 2 }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>
                </ProfCard>
              )}

              {isJobSeeker && (() => {
                const dispoLabels = { travailler_vite: "Travailler au plus vite", formation_courte: "Formation courte (quelques mois)", reprendre_etudes: "Reprendre des études (1 an ou +)" };
                const dureeLabels = { "1_an": "1 an maximum", "2_ans": "Jusqu'à 2 ans", "3_ans_plus": "3 ans ou plus" };
                const grandDomaineLabels = { A: "🌿 Agriculture & Nature", B: "🎨 Arts & Artisanat", C: "🏦 Banque, Assurance & Immobilier", D: "🛒 Commerce & Vente", E: "📱 Communication & Médias", F: "🏗️ Construction & BTP", G: "🍽️ Hôtellerie, Restauration & Tourisme", H: "🏭 Industrie", I: "🔧 Maintenance & Installation", J: "⚕️ Santé", K: "🤝 Social, Éducation & Services publics", L: "🎭 Spectacle & Arts vivants", M: "💼 Entreprise, Tech & Gestion", N: "🚛 Transport & Logistique" };
                const filiereLabels = { generale: "Générale", technologique: "Technologique", professionnelle: "Professionnelle" };
                const niveauScolaireLabels = { difficile: "C'est compliqué, je galère un peu", moyen: "Dans la moyenne", bien: "Ça se passe bien", tres_bien: "À l'aise, plutôt bon(ne)" };
                const moyenneLabels = { moins_8: "Moins de 8", "8_10": "Entre 8 et 10", "10_12": "Entre 10 et 12", "12_14": "Entre 12 et 14", "14_16": "Entre 14 et 16", "16_plus": "Plus de 16" };
                const genderLabels = { femme: "Femme", homme: "Homme", autre: "Autre / non précisé" };

                const dispos = Array.isArray(d.dispoFormation) ? d.dispoFormation : (d.dispoFormation ? [d.dispoFormation] : []);
                const exps = Array.isArray(d.experiencesPro) ? d.experiencesPro : [];
                const aExp = d.aExperiencePro === 'oui';
                const domaineDiplomeLabel = d.domaineDiplome ? (grandDomaineLabels[d.domaineDiplome] || d.domaineDiplome) : '—';

                const Row = ({ l, v, mono }) => (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '5px 0', borderBottom: `1px dashed ${V.border}` }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: V.t4, textTransform: 'uppercase', letterSpacing: .3, minWidth: 140, flexShrink: 0, paddingTop: 2 }}>{l}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: v ? V.t9 : V.t4, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-word', flex: 1 }}>{v || '—'}</span>
                  </div>
                );
                const Section = ({ title, children, last }) => (
                  <div style={{ marginBottom: last ? 0 : 14, paddingBottom: last ? 0 : 10, borderBottom: last ? 'none' : `1px solid ${V.border}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>{title}</div>
                    {children}
                  </div>
                );

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
                    {/* CARTE GAUCHE : Identité + Localisation + Statut */}
                    <ProfCard title="Profil & compte">
                      <Section title="Identité">
                        <Row l="Nom complet" v={`${d.prenom || ''} ${d.nom || ''}`.trim()} />
                        <Row l="Date de naissance" v={d.dateNaissance} />
                        <Row l="Âge" v={d.age ? d.age + ' ans' : null} />
                        <Row l="Genre" v={genderLabels[d.gender] || d.gender} />
                        <Row l="Email" v={d.email} mono />
                      </Section>

                      <Section title="Localisation">
                        <Row l="Ville" v={d.ville} />
                        <Row l="Code postal" v={d.codePostal} />
                        <Row l="Département" v={d.codeDepartement ? `Dept. ${d.codeDepartement}` : null} />
                      </Section>

                      <Section title="Statut du compte" last>
                        <Row l="Date d'inscription" v={ds} />
                        <Row l="Test démarré" v={d.quizStarted ? '✅ Oui' : '❌ Non'} />
                        <Row l="Test complété" v={d.quizCompleted ? '✅ Oui' : '❌ Non'} />
                        <Row l="Mineur" v={d.isMinor ? '⚠️ Oui' : 'Non'} />
                        <Row l="Situation déclarée" v="Demandeur d'emploi" />
                      </Section>
                    </ProfCard>

                    {/* CARTE DROITE : Dispo + Diplôme + Exp pro + Objectif */}
                    <ProfCard title="Parcours & expériences">
                      <Section title="Disponibilité formation (question clé scoring)">
                        {dispos.length === 0 ? <div style={{ fontSize: 12, color: V.t4, paddingBottom: 4 }}>Aucune disponibilité renseignée</div> :
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: dispos.includes('reprendre_etudes') && d.dureeEtudesMax ? 8 : 4 }}>
                            {dispos.map((v, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: V.card2, borderRadius: 6, border: `1px solid ${V.border}` }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: V.accent, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: V.t9 }}>{dispoLabels[v] || v}</span>
                              </div>
                            ))}
                          </div>}
                        {dispos.includes('reprendre_etudes') && d.dureeEtudesMax &&
                          <div style={{ padding: '8px 10px', background: 'rgba(168,85,247,.06)', borderRadius: 6, fontSize: 11, borderLeft: `3px solid ${V.accent}` }}>
                            <span style={{ color: V.t4, fontWeight: 600 }}>↳ Durée max études acceptée : </span>
                            <span style={{ fontWeight: 700, color: V.accent }}>{dureeLabels[d.dureeEtudesMax] || d.dureeEtudesMax}</span>
                          </div>}
                      </Section>

                      <Section title="Dernier diplôme / études">
                        <Row l="Type de diplôme" v={d.typeDiplome} />
                        <Row l="Domaine du diplôme" v={domaineDiplomeLabel} />
                        <Row l="Niveau d'études" v={d.niveauEtudes || d.classe} />
                        <Row l="Filière (si lycée)" v={filiereLabels[d.filiere] || d.filiere} />
                        <Row l="Niveau scolaire vécu" v={niveauScolaireLabels[d.niveauScolaire] || d.niveauScolaire} />
                        <Row l="Moyenne générale" v={moyenneLabels[d.moyenneGenerale] || d.moyenneGenerale} />
                      </Section>

                      <Section title={`Expériences professionnelles${exps.length ? ` (${exps.length})` : ''}`} last={!d.objectif}>
                        <Row l="A déjà travaillé ?" v={aExp ? '✅ Oui' : d.aExperiencePro === 'non' ? '❌ Non' : null} />
                        <Row l="Dernier métier exercé" v={d.metierActuel} />
                        {exps.length > 0 ?
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: V.t4, textTransform: 'uppercase', letterSpacing: .3 }}>Liste détaillée</div>
                            {exps.map((e, i) => (
                              <div key={i} style={{ padding: '10px 12px', background: V.card2, borderRadius: 8, border: `1px solid ${V.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(168,85,247,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                                  {(grandDomaineLabels[e.domaine] || '').split(' ')[0] || '💼'}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: V.t9 }}>{e.label || grandDomaineLabels[e.domaine] || e.domaine || 'Domaine inconnu'}</div>
                                  <div style={{ fontSize: 10, color: V.t4, marginTop: 2 }}>Code domaine : <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{e.domaine || '?'}</span>{e.duree ? ` · Durée : ${e.duree}` : ''}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          : aExp ? <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(251,191,36,.08)', borderRadius: 6, fontSize: 11, color: V.orange, borderLeft: `3px solid ${V.orange}` }}>
                            ⚠️ A répondu "Oui" mais aucune expérience détaillée enregistrée.
                          </div> : null}
                      </Section>

                      {d.objectif && <Section title="Objectif exprimé" last>
                        <div style={{ padding: '10px 12px', background: V.card2, borderRadius: 8, border: `1px solid ${V.border}`, fontSize: 12, color: V.t9, fontStyle: 'italic', lineHeight: 1.5 }}>
                          &quot;{d.objectif}&quot;
                        </div>
                      </Section>}
                    </ProfCard>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ============ TAB: TECHNIQUE — fusionné dans Informations ============ */}
          {tab === 'informations' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
              <ProfCard title="Avancement du test par room">
                {[['Room 1', 'room1Completed', 'room1CompletedAt'], ['Room 2', 'room2Completed', 'room2CompletedAt'], ['Room 3', 'room3Completed', 'room3CompletedAt']].map(([label, key, atKey]) => {
                  const done = d[key];
                  const at = d[atKey] ? new Date(d[atKey]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${V.borderSoft}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: done ? V.green : V.border }} />
                      <span style={{ fontSize: 12, color: V.t7, flex: 1 }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: done ? V.green : V.t4 }}>{done ? `Complété${at ? ' à ' + at : ''}` : ' Non commencé'}</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: V.t4, marginBottom: 4 }}>Progression : {d.quizProgress || 0}%</div>
                  <div style={{ height: 6, background: V.card2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${d.quizProgress || 0}%`, background: G, borderRadius: 3 }} />
                  </div>
                </div>
              </ProfCard>

              <ProfCard title="Engagement & Activité">
                {[
                  ['Sessions', connexions],
                  ['Temps total app', testTimeDisplay],
                  ['Dernière connexion', d.lastActive ? new Date(d.lastActive).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'],
                  ['Date inscription', ds],
                ].map(([l, v], i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>
                    <span style={{ fontSize: 11, color: V.t4, textTransform: 'uppercase', letterSpacing: .3, fontWeight: 600 }}>{l}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: V.t9 }}>{v}</span>
                  </div>
                ))}
              </ProfCard>

              {/* Diagnostic API supprimé sur demande conseiller */}
              {false && (
              <ProfCard title="Diagnostic API par fonctionnalité (GP / T10MR / T10P / CIA / ME)" style={{ gridColumn: 'span 2' }}>
                {(() => {
                  const FEATURES = [
                    { id: 'GP', title: 'Génération Parcours' },
                    { id: 'T10MR', title: 'Top 10 Métiers qui Recrute' },
                    { id: 'T10P', title: 'Top 10 Personnalisé (IA)' },
                    { id: 'CIA', title: 'Chat IA' },
                    { id: 'ME', title: 'Matching Emploi' },
                  ];
                  const apiCalls = acts.filter(a => a.type === 'api_call');
                  const byFeature = {};
                  FEATURES.forEach(f => { byFeature[f.id] = { total: 0, ok: 0, err: 0, lastCall: null, lastStatus: null }; });
                  apiCalls.forEach(c => {
                    const feat = c.metadata?.feature;
                    if (!feat || !byFeature[feat]) return;
                    byFeature[feat].total++;
                    const success = c.metadata?.success === true || c.detail === 'ok';
                    if (success) byFeature[feat].ok++;
                    else byFeature[feat].err++;
                    if (!byFeature[feat].lastCall) {
                      byFeature[feat].lastCall = c.timestamp;
                      byFeature[feat].lastStatus = success ? 'OK' : 'Err';
                    }
                  });
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                      {FEATURES.map(f => {
                        const slot = byFeature[f.id];
                        const isEmpty = slot.total === 0;
                        const lastIsOk = slot.lastStatus === 'OK';
                        const bg = isEmpty ? 'rgba(15,15,15,0.04)'
                          : lastIsOk ? 'rgba(16,185,129,0.08)'
                          : 'rgba(220,38,38,0.08)';
                        const color = isEmpty ? V.t4
                          : lastIsOk ? '#047857'
                          : '#dc2626';
                        const border = isEmpty ? 'rgba(15,15,15,0.10)'
                          : lastIsOk ? 'rgba(16,185,129,0.25)'
                          : 'rgba(220,38,38,0.25)';
                        return (
                          <div key={f.id} title={f.title} style={{
                            padding: '10px 12px',
                            background: bg,
                            border: `1px solid ${border}`,
                            borderRadius: 10,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: V.t7, marginBottom: 4, letterSpacing: 0.3 }}>{f.id}</div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: color, lineHeight: 1, marginBottom: 4 }}>
                              {isEmpty ? '—' : slot.lastStatus}
                            </div>
                            <div style={{ fontSize: 10, color: V.t4 }}>
                              {isEmpty ? 'Aucun appel' : `${slot.ok}/${slot.total} OK`}
                            </div>
                            {slot.err > 0 && (
                              <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, marginTop: 2 }}>
                                {slot.err} erreur{slot.err > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </ProfCard>
              )}

              {/* Historique complet supprimé : doublon avec "Historique récent" colonne droite (qui est maintenant scrollable) */}
            </div>
          )}

          {/* ============ TAB: OFFRES D'EMPLOI (table complète) ============ */}
          {tab === 'offres' && (() => {
            const offers = d.matchedJobOffers || [];
            const viewedCount = offers.filter((o: any) => o.viewed).length;
            const favCount = offers.filter((o: any) => o.favorited).length;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Petits compteurs en haut */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Offres matchées', val: offers.length, color: V.accent },
                    { label: 'Vues', val: viewedCount, color: V.green },
                    { label: 'En favoris', val: favCount, color: V.pink },
                  ].map((k, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.52)',
                      backdropFilter: 'blur(28px) saturate(140%)',
                      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                      border: '1px solid rgba(255,255,255,0.7)',
                      borderRadius: 16, padding: '14px 16px',
                      display: 'flex', flexDirection: 'column', gap: 4,
                      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 20px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
                    }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: V.t5, textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: k.color, letterSpacing: '-.5px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {k.val}
                      </div>
                    </div>
                  ))}
                </div>

                <ProfCard title={`Toutes les offres matchées · ${offers.length}`}>
                  {offers.length === 0 ? (
                    <div style={{ color: V.t4, fontSize: 12.5, textAlign: 'center', padding: 24 }}>
                      Aucune offre matchée pour l&apos;instant.<br />
                      <span style={{ fontSize: 11.5, color: V.t5 }}>Le jeune doit ouvrir l&apos;onglet « Emploi » dans l&apos;app pour que les offres apparaissent ici.</span>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', margin: '-4px -4px 0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: V.t5, textTransform: 'uppercase', letterSpacing: .3, borderBottom: `1px solid ${V.border}` }}>Offre</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: V.t5, textTransform: 'uppercase', letterSpacing: .3, borderBottom: `1px solid ${V.border}` }}>Lieu</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: V.t5, textTransform: 'uppercase', letterSpacing: .3, borderBottom: `1px solid ${V.border}` }}>Salaire</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: V.t5, textTransform: 'uppercase', letterSpacing: .3, borderBottom: `1px solid ${V.border}` }}>Vu</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: V.t5, textTransform: 'uppercase', letterSpacing: .3, borderBottom: `1px solid ${V.border}` }}>Favori</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: V.t5, textTransform: 'uppercase', letterSpacing: .3, borderBottom: `1px solid ${V.border}` }}>Annonce</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offers.map((o: any, i: number) => (
                            <tr key={o.id || i} style={{
                              borderBottom: i < offers.length - 1 ? `1px solid ${V.borderSoft}` : 'none',
                              background: i % 2 === 0 ? 'transparent' : 'rgba(15,15,15,0.015)',
                            }}>
                              <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: V.t9, lineHeight: 1.35 }}>{o.title || 'Offre'}</div>
                                <div style={{ fontSize: 11, color: V.t5, marginTop: 3 }}>
                                  {o.company || '—'}{o.typeContrat ? ' · ' + o.typeContrat : ''}
                                </div>
                              </td>
                              <td style={{ padding: '12px 12px', verticalAlign: 'top', color: V.t7 }}>
                                {o.location || '—'}
                              </td>
                              <td style={{ padding: '12px 12px', verticalAlign: 'top', color: V.t7 }}>
                                {o.salaire || <span style={{ color: V.t4 }}>Non précisé</span>}
                              </td>
                              <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                                  background: o.viewed ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                                  color: o.viewed ? V.green : V.orange,
                                  textTransform: 'uppercase', letterSpacing: .3,
                                }}>
                                  {o.viewed ? 'Vu' : 'Pas vu'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'center' }}>
                                {o.favorited ? (
                                  <span style={{ fontSize: 14, color: V.pink }} title={o.favoritedAt ? new Date(o.favoritedAt).toLocaleString('fr-FR') : ''}>★</span>
                                ) : (
                                  <span style={{ fontSize: 14, color: V.t3 }}>☆</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 12px', verticalAlign: 'top', textAlign: 'right' }}>
                                {o.franceTravailUrl ? (
                                  <a
                                    href={o.franceTravailUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      background: 'linear-gradient(135deg,#7f4997,#E84393)',
                                      color: '#fff',
                                      fontSize: 11.5, fontWeight: 600,
                                      textDecoration: 'none',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Voir
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                      <polyline points="15 3 21 3 21 9" />
                                      <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span style={{ color: V.t4, fontSize: 11 }}>—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ProfCard>
              </div>
            );
          })()}

          {/* ============ TAB: MOTIVATION (demandeurs d'emploi uniquement) ============ */}
          {tab === 'motivation' && isJobSeeker && d.uid && (
            <MotivationTabContent uid={d.uid} userData={d} />
          )}

          {/* ============ TAB: RDV (vue conseiller — composant existant) ============ */}
          {tab === 'rdv' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <RdvTab />
            </div>
          )}

        </div>

        {/* ===== RIGHT COLUMN STICKY ===== */}
        <div className="fi-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 14, minWidth: 0 }}>
          {/* Coordonnées (toujours présent) */}
          <ProfCard title="Coordonnées">
            {[
              { label: 'Email', value: d.email || '—', icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></> },
              { label: 'Ville', value: d.ville || '—', icon: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></> },
              { label: 'Département', value: d.codeDepartement ? `Dept. ${d.codeDepartement}` : '—', icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></> },
              { label: 'Situation', value: d.situation || '—', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
              { label: 'Niveau', value: niveauLabel, icon: <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5" /></> },
              { label: 'Date de naissance', value: d.dateNaissance || '—', icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
              { label: 'Genre', value: d.gender || '—', icon: <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></> },
              { label: 'Inscription', value: ds, icon: <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></> },
              { label: 'Mineur', value: d.isMinor ? '⚠️ Oui' : 'Non', icon: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></> },
            ].map((c, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${V.borderSoft}` : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: V.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, color: V.t4 }}>{c.icon}</svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: V.t4 }}>{c.label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: V.t9, wordBreak: 'break-all' }}>{c.value}</div>
                </div>
              </div>
            ))}
          </ProfCard>

          {/* Progression du quiz */}
          <ProfCard title="Progression Quiz">
            {renderQuizProgress()}
          </ProfCard>

          {/* Historique récent — scrollable interne (toutes les actions, pas de bouton "Voir tout") */}
          <ProfCard title={`Historique${acts.length > 0 ? ` (${acts.length})` : ''}`}>
            <div style={{ maxHeight: 400, overflowY: 'auto', marginRight: -8, paddingRight: 8 }}>
              {renderHistoriqueMini()}
            </div>
          </ProfCard>
        </div>
      </div>
    </div>
  );
}
