"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import { listMotivationJournalsAPI, MotivationJournalDTO, MotivationAnswerDTO } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { computeEngagementScore, computeCompositeScore, EngagementBreakdown, MOTIV_PALETTE, motivLevelFromScore } from "@/lib/motivationScore";

// =====================================================
// MotivationSection — Affiche dans la fiche jeune le score
// composite motivation = 60% journal (déclaratif) + 40%
// engagement (comportement réel app) + courbe d'évolution.
// =====================================================

interface Props {
  uid: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData?: any;            // user object pour calculer le score d'engagement
  fullDetail?: boolean;
  onSeeAll?: () => void;     // si défini, affiche un bouton "Voir tout →" en bas
}

const QUESTIONS: Array<{ key: keyof MotivationJournalDTO; label: string; positiveIsGood: boolean; infoOnly?: boolean }> = [
  { key: 'motivation', label: 'Te sens-tu motivé·e en ce moment ?', positiveIsGood: true },
  { key: 'ressources', label: 'Penses-tu avoir les ressources nécessaires pour atteindre tes objectifs ?', positiveIsGood: true },
  { key: 'visionAvenir', label: 'As-tu une vision globalement positive de l’avenir ?', positiveIsGood: true },
  { key: 'stress', label: 'Es-tu stressé·e en ce moment ?', positiveIsGood: false },
  { key: 'decourage', label: 'Te sens-tu découragé·e par ta situation actuelle ?', positiveIsGood: false },
  { key: 'visionPro', label: 'Vois-tu ton avenir professionnel de façon positive ?', positiveIsGood: true },
  { key: 'entretienPret', label: 'Te sens-tu prêt·e à passer un entretien avec un employeur ?', positiveIsGood: true },
  { key: 'besoinAideCV', label: 'As-tu besoin d’aide pour ton CV et/ou ta lettre de motivation ?', positiveIsGood: false, infoOnly: true },
];

const SCORE_THRESHOLDS = {
  green: 70,
  orange: 40,
};

function scoreColor(score: number): string {
  return MOTIV_PALETTE[motivLevelFromScore(score)].dot;
}

function scoreLabel(score: number): string {
  if (score >= SCORE_THRESHOLDS.green) return "Bonne motivation";
  if (score >= SCORE_THRESHOLDS.orange) return "Motivation modérée";
  return "Motivation faible";
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return "—"; }
}

export default function MotivationSection({ uid, userData, onSeeAll }: Props) {
  const { token } = useAuth();
  const [journals, setJournals] = useState<MotivationJournalDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !uid) return;
    let mounted = true;
    setLoading(true);
    listMotivationJournalsAPI(token, uid)
      .then(res => {
        if (!mounted) return;
        setJournals(res.journals || []);
        setErr(null);
      })
      .catch(e => {
        if (!mounted) return;
        setErr(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token, uid]);

  const latest = journals[0];
  const journalScore = latest?.score ?? null;

  // Engagement score (calculé à partir de userData si fourni)
  const engagement: EngagementBreakdown | null = useMemo(
    () => userData ? computeEngagementScore(userData) : null,
    [userData]
  );

  // Score composite : 60% journal + 40% engagement
  // Si pas de journal → on affiche juste l'engagement
  const composite = engagement && journalScore != null
    ? computeCompositeScore(journalScore, engagement.total)
    : null;
  const current = composite ?? journalScore ?? engagement?.total ?? null;

  // Évolution journal : score actuel vs précédent
  const prev = journals[1]?.score;
  const delta = journalScore != null && prev != null ? journalScore - prev : null;

  // Pour le graphique : on inverse pour avoir l'ordre chronologique gauche→droite
  const chronological = [...journals].reverse();

  // Style ProfCard standard du dashboard (glassmorphism premium IMPAKT)
  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.52)",
    backdropFilter: "blur(28px) saturate(140%)",
    WebkitBackdropFilter: "blur(28px) saturate(140%)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.85)",
    position: "relative" as const,
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <SectionHeader />
        <div style={{ padding: 20, textAlign: "center", color: "var(--premium-text-4)", fontSize: 12 }}>Chargement…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={cardStyle}>
        <SectionHeader />
        <div style={{ padding: 20, textAlign: "center", color: "#dc2626", fontSize: 12 }}>Erreur : {err}</div>
      </div>
    );
  }

  // Cas : pas de journal mais on a quand même l'engagement (signal partiel)
  if (journals.length === 0 && engagement) {
    return (
      <div style={cardStyle}>
        <SectionHeader />
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em",
            color: scoreColor(engagement.total),
          }}>
            {engagement.total}<span style={{ fontSize: 18, color: "var(--premium-text-4)", fontWeight: 600, marginLeft: 4 }}>/100</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--premium-text-3)", marginTop: 4, fontWeight: 600 }}>
            Score d&apos;engagement seul
          </div>
          <div style={{ fontSize: 11, color: "var(--premium-text-4)", marginTop: 8, lineHeight: 1.4 }}>
            Le jeune n&apos;a pas encore complété son journal hebdo. Le score est calculé uniquement
            sur son comportement dans l&apos;app (quiz, connexions, métiers vus…).
          </div>
        </div>
        <EngagementBreakdownView eng={engagement} />
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ marginTop: 16, padding: "8px 0", border: "none", background: "transparent", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "#7f4997", cursor: "pointer", textAlign: "left", width: "100%" }}>
            Voir tout →
          </button>
        )}
      </div>
    );
  }

  if (journals.length === 0) {
    return (
      <div style={cardStyle}>
        <SectionHeader />
        <div style={{ padding: 24, textAlign: "center", color: "var(--premium-text-4)", fontSize: 13 }}>
          Le jeune n&apos;a pas encore complété son journal motivation.
          <div style={{ fontSize: 11, marginTop: 6, color: "var(--premium-text-5)" }}>
            (Il s&apos;ouvre automatiquement la 1ère fois après inscription, puis tous les 7 jours.)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <SectionHeader />

      {/* Bloc score — typo XL avec gradient IMPAKT */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #7f4997 0%, #E84393 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            display: "inline-block",
          }}>
            {current ?? "—"}<span style={{
              fontSize: 18,
              color: "var(--premium-text-4)",
              WebkitTextFillColor: "var(--premium-text-4)",
              fontWeight: 600,
              marginLeft: 4,
              background: "none",
            }}>/100</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--premium-text-2)", marginTop: 6, fontWeight: 600, letterSpacing: "-0.1px" }}>
            {scoreLabel(current ?? 0)}
          </div>
          {composite != null && engagement && journalScore != null && (
            <div style={{ fontSize: 10.5, color: "var(--premium-text-4)", marginTop: 4, fontWeight: 500, letterSpacing: 0.1 }}>
              Journal {journalScore}/100 · Engagement {engagement.total}/100
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {delta !== null && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 9px", borderRadius: 100,
              background: delta >= 0 ? "rgba(16,185,129,0.10)" : "rgba(220,38,38,0.10)",
              color: delta >= 0 ? "#047857" : "#dc2626",
              fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1,
            }}>
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} pts
            </div>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9.5, color: "var(--premium-text-4)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
              Dernière maj
            </div>
            <div style={{ fontSize: 11.5, color: "var(--premium-text-2)", fontWeight: 600, marginTop: 2 }}>
              {fmtDateShort(latest?.createdAt ?? null)}
            </div>
          </div>
        </div>
      </div>

      {/* Sparkline — gradient subtil sur les barres */}
      {chronological.length > 1 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(15,15,15,0.06)" }}>
          <div style={{ fontSize: 9.5, color: "var(--premium-text-4)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 10 }}>
            Évolution des {chronological.length} dernières semaines
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56 }}>
            {chronological.map(j => {
              const h = Math.max(4, (j.score / 100) * 56);
              return (
                <div key={j.id} title={`${fmtDateShort(j.createdAt)} — ${j.score}/100`}
                  style={{
                    flex: 1, height: h,
                    background: "linear-gradient(180deg, rgba(232,67,147,0.85) 0%, rgba(127,73,151,0.65) 100%)",
                    borderRadius: 4,
                    transition: "all .2s",
                  }}
                />
              );
            })}
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            marginTop: 8, fontSize: 9.5, color: "var(--premium-text-5)", fontWeight: 600, letterSpacing: 0.2,
          }}>
            <span>{fmtDateShort(chronological[0].createdAt)}</span>
            <span>{fmtDateShort(chronological[chronological.length - 1].createdAt)}</span>
          </div>
        </div>
      )}

      {engagement && <EngagementBreakdownView eng={engagement} />}

      {onSeeAll && (
        <button
          onClick={onSeeAll}
          style={{
            marginTop: 16, padding: "8px 0",
            border: "none", background: "transparent",
            fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
            color: "#7f4997", cursor: "pointer", textAlign: "left",
            width: "100%",
          }}
        >
          Voir tout →
        </button>
      )}
    </div>
  );
}

function SectionHeader() {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      color: "#525252",
      textTransform: "uppercase", letterSpacing: ".5px",
      marginBottom: 14, paddingBottom: 12,
      borderBottom: "1px solid rgba(15,15,15,0.06)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span>Motivation</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--premium-text-4)", textTransform: "none", letterSpacing: 0 }}>
        Journal + engagement
      </span>
    </div>
  );
}

function EngagementBreakdownView({ eng }: { eng: EngagementBreakdown }) {
  const items: Array<[string, number, number]> = [
    ['Quiz d\'orientation',   eng.parts.quiz, 30],
    ['Connexions à l\'app',   eng.parts.connexions, 20],
    ['Temps passé',            eng.parts.tempsApp, 15],
    ['Métiers consultés',      eng.parts.metiersVus, 15],
    ['Parcours générés',       eng.parts.parcoursGeneres, 10],
    ['Variété d\'utilisation', eng.parts.varieteOnglets, 10],
  ];
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(15,15,15,0.06)" }}>
      <div style={{ fontSize: 9.5, color: "var(--premium-text-4)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 12 }}>
        Engagement (7 derniers jours)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(([label, val, max]) => {
          const pct = (val / max) * 100;
          return (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 70px 38px", gap: 10, alignItems: "center", fontSize: 11.5 }}>
              <span style={{ color: "var(--premium-text-2)", fontWeight: 500, letterSpacing: "-0.1px" }}>{label}</span>
              <div style={{ height: 6, background: "rgba(15,15,15,0.05)", borderRadius: 100, overflow: "hidden" }}>
                <div style={{
                  width: `${pct}%`, height: "100%",
                  background: pct >= 70
                    ? "linear-gradient(90deg, #7f4997, #E84393)"
                    : pct >= 40
                      ? "rgba(127,73,151,0.5)"
                      : "rgba(15,15,15,0.18)",
                  borderRadius: 100,
                  transition: "width .3s ease",
                }} />
              </div>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--premium-text-2)", textAlign: "right", fontWeight: 700, fontSize: 11 }}>
                {val}<span style={{ color: "var(--premium-text-5)", fontWeight: 500 }}>/{max}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================
// MotivationDetailCard — Carte questions + réponses
// du journal motivation (le plus récent par défaut, ou
// celui passé en prop pour la sélection de semaine).
// =====================================================

export function MotivationDetailCard({ uid, journal: externalJournal }: { uid: string; journal?: MotivationJournalDTO | null }) {
  const { token } = useAuth();
  const [internalJournal, setInternalJournal] = useState<MotivationJournalDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const usingExternal = externalJournal !== undefined;
  const latest = usingExternal ? externalJournal : internalJournal;

  useEffect(() => {
    if (usingExternal) { setLoading(false); return; }
    if (!token || !uid) return;
    let mounted = true;
    setLoading(true);
    listMotivationJournalsAPI(token, uid)
      .then(res => {
        if (!mounted) return;
        setInternalJournal(res.journals?.[0] || null);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token, uid, usingExternal]);

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.52)",
    backdropFilter: "blur(28px) saturate(140%)",
    WebkitBackdropFilter: "blur(28px) saturate(140%)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.85)",
  };

  return (
    <div style={cardStyle}>
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: "#525252",
        textTransform: "uppercase", letterSpacing: ".5px",
        marginBottom: 14, paddingBottom: 12,
        borderBottom: "1px solid rgba(15,15,15,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>Réponses de l&apos;utilisateur</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "var(--premium-text-4)", textTransform: "none", letterSpacing: 0 }}>
          {latest?.createdAt
            ? new Date(latest.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            : "—"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {loading && <div style={{ padding: 20, textAlign: "center", color: "var(--premium-text-4)", fontSize: 12 }}>Chargement…</div>}
        {!loading && !latest && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--premium-text-4)", fontSize: 12 }}>
            Le jeune n&apos;a pas encore complété son journal.
          </div>
        )}
        {!loading && latest && QUESTIONS.map(q => (
          <DetailRow
            key={q.key as string}
            label={q.label}
            answer={latest[q.key] as MotivationAnswerDTO | null}
            positiveIsGood={q.positiveIsGood}
            infoOnly={q.infoOnly}
          />
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, answer }: {
  label: string;
  answer: MotivationAnswerDTO | null;
  positiveIsGood?: boolean;
  infoOnly?: boolean;
}) {
  if (!answer) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(15,15,15,0.05)", fontSize: 12, color: "var(--premium-text-4)" }}>
        <span>{label}</span><span>—</span>
      </div>
    );
  }
  const v = answer.value;
  const levelText = answer.level === "legere" ? " · Légère"
    : answer.level === "moderee" ? " · Modérée"
    : answer.level === "forte" ? " · Forte" : "";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(15,15,15,0.05)" }}>
      <span style={{ fontSize: 12.5, color: "var(--premium-text-2)", flex: 1, lineHeight: 1.4 }}>{label}</span>
      <span style={{
        fontWeight: 700, fontSize: 13,
        color: v ? "var(--premium-text)" : "var(--premium-text-3)",
        whiteSpace: "nowrap",
        flexShrink: 0,
        marginTop: 1,
      }}>
        {v ? "Oui" : "Non"}{v ? levelText : ""}
      </span>
    </div>
  );
}

// =====================================================
// MotivationTabContent — wrapper de l'onglet Motivation
// Combine : sélecteur de semaine + encart d'alertes + 2 cards
// (avec un seul fetch des journaux partagé entre tout).
// =====================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MotivationTabContent({ uid, userData }: { uid: string; userData?: any }) {
  const { token } = useAuth();
  const [journals, setJournals] = useState<MotivationJournalDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!token || !uid) return;
    let mounted = true;
    setLoading(true);
    listMotivationJournalsAPI(token, uid)
      .then(res => {
        if (!mounted) return;
        setJournals(res.journals || []);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token, uid]);

  const selected = journals[selectedIdx] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Sélecteur de semaine */}
      <WeekPicker
        journals={journals}
        selectedIdx={selectedIdx}
        onSelect={(i) => { setSelectedIdx(i); setPickerOpen(false); }}
        open={pickerOpen}
        onToggle={() => setPickerOpen(o => !o)}
        loading={loading}
      />

      {/* v17.8 — Graphique d'évolution du score sur les semaines */}
      <MotivationChart journals={journals} loading={loading} />

      {/* Encart d'alertes basé sur les réponses du journal sélectionné */}
      {selected && <MotivationAlerts journal={selected} />}

      {/* 2 cards côte-à-côte */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <MotivationSection uid={uid} userData={userData} />
        <MotivationDetailCard uid={uid} journal={selected} />
      </div>
    </div>
  );
}

// =====================================================
// v17.8 — Graphique d'évolution du score motivation
// Courbe ligne, gradient brand purple→pink, points colorés selon le niveau
// (vert / orange / rouge), tooltip date + score sur hover.
// =====================================================
function MotivationChart({ journals, loading }: { journals: MotivationJournalDTO[]; loading: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // Trie chronologique ascendant (la liste arrive en desc du backend)
  const sorted = useMemo(() => {
    return [...journals]
      .filter(j => j.createdAt && typeof j.score === 'number')
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }, [journals]);

  useEffect(() => {
    if (!canvasRef.current || sorted.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = sorted.map(j => {
      const d = new Date(j.createdAt!);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    });
    const scores = sorted.map(j => j.score);
    const pointColors = scores.map(s => {
      const lvl = motivLevelFromScore(s);
      return MOTIV_PALETTE[lvl].dot;
    });

    // Gradient remplissage sous la courbe (brand)
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, 'rgba(232,67,147,0.28)');
    grad.addColorStop(1, 'rgba(127,73,151,0)');

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score motivation',
          data: scores,
          borderColor: '#E84393',
          backgroundColor: grad,
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: pointColors,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: pointColors,
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,15,15,0.92)',
            titleColor: '#ffffff', bodyColor: 'rgba(255,255,255,0.85)',
            titleFont: { family: 'Plus Jakarta Sans', size: 11, weight: 700 },
            bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
            padding: 10, cornerRadius: 8, displayColors: false,
            borderColor: 'rgba(232,67,147,0.3)', borderWidth: 1,
            callbacks: {
              label: (ctx) => `Motivation : ${ctx.parsed.y}/100`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#a3a3a3',
              font: { family: 'Plus Jakarta Sans', size: 10 },
              maxRotation: 0,
              autoSkipPadding: 12,
            },
            border: { display: false },
          },
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(15,15,15,0.05)' },
            ticks: {
              color: '#a3a3a3',
              font: { family: 'Plus Jakarta Sans', size: 10 },
              stepSize: 25,
              callback: (v) => `${v}`,
            },
            border: { display: false },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [sorted]);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(28px) saturate(140%)',
      WebkitBackdropFilter: 'blur(28px) saturate(140%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 18,
      padding: 18,
      boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>Évolution de la motivation</div>
          <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 2 }}>
            {sorted.length === 0 ? 'Aucune donnée' : `${sorted.length} journal${sorted.length > 1 ? 'aux' : ''} renseigné${sorted.length > 1 ? 's' : ''}`}
          </div>
        </div>
        {sorted.length > 0 && (
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--premium-text-4)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: MOTIV_PALETTE.forte.dot, display: 'inline-block' }} /> Forte
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: MOTIV_PALETTE.moderee.dot, display: 'inline-block' }} /> Modérée
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: MOTIV_PALETTE.faible.dot, display: 'inline-block' }} /> Faible
            </span>
          </div>
        )}
      </div>
      <div style={{ position: 'relative', height: 220 }}>
        {loading ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--premium-text-4)', fontSize: 12 }}>
            Chargement…
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--premium-text-4)', fontSize: 12, textAlign: 'center', padding: 16 }}>
            Pas encore de journal motivation rempli — le graphique apparaîtra dès la première semaine.
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
    </div>
  );
}

// Sélecteur de semaine (style identique au PERIODS picker de la home dashboard)
function WeekPicker({ journals, selectedIdx, onSelect, open, onToggle, loading }: {
  journals: MotivationJournalDTO[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  open: boolean;
  onToggle: () => void;
  loading: boolean;
}) {
  const fmtRange = (iso: string | null): string => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const start = new Date(d); start.setDate(d.getDate() - 6);
      const fmt = (x: Date) => x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      return `${fmt(start)} → ${fmt(d)}`;
    } catch { return "—"; }
  };

  const labelFor = (i: number) => {
    if (i === 0) return "Cette semaine";
    if (i === 1) return "Semaine dernière";
    return `Il y a ${i} semaines`;
  };

  if (loading || journals.length === 0) {
    return (
      <div style={{ fontSize: 11.5, color: "var(--premium-text-4)", fontWeight: 500 }}>
        {loading ? "Chargement…" : "Aucun journal disponible"}
      </div>
    );
  }

  const current = journals[selectedIdx];

  return (
    <div style={{ position: "relative", alignSelf: "flex-start" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: 10,
        background: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 1px 2px rgba(15,15,15,0.03), 0 4px 12px rgba(15,15,15,0.04)",
        fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
        color: "var(--premium-text)", cursor: "pointer",
        transition: "all .15s ease",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E84393", boxShadow: "0 0 8px rgba(232,67,147,0.6)" }} />
        {labelFor(selectedIdx)}
        <span style={{ color: "var(--premium-text-4)", fontWeight: 500, marginLeft: 4 }}>
          · {fmtRange(current?.createdAt ?? null)}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, marginLeft: 2, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          width: 260, zIndex: 100,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.85)",
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.06)",
          overflow: "hidden", padding: 4,
          maxHeight: 320, overflowY: "auto",
        }}>
          {journals.map((j, i) => {
            const active = i === selectedIdx;
            return (
              <button key={j.id} onClick={() => onSelect(i)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px",
                background: active ? "linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))" : "transparent",
                border: "none", borderRadius: 8,
                color: active ? "#7f4997" : "#262626",
                fontSize: 11.5, fontWeight: active ? 600 : 500,
                fontFamily: "inherit", cursor: "pointer", textAlign: "left",
              }}>
                <span>{labelFor(i)} · <span style={{ color: "var(--premium-text-4)", fontWeight: 500 }}>{fmtRange(j.createdAt)}</span></span>
                {active && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Encart d'alertes : signaux de besoin d'aide / risque détectés dans le journal
function MotivationAlerts({ journal }: { journal: MotivationJournalDTO }) {
  type Alert = { kind: 'critical' | 'warning' | 'info'; text: string };
  const alerts: Alert[] = [];

  if (journal.besoinAideCV?.value) {
    alerts.push({ kind: 'info', text: "Demande de l'aide pour son CV / lettre de motivation" });
  }
  if (journal.entretienPret?.value === false) {
    alerts.push({ kind: 'warning', text: "Ne se sent pas prêt à passer un entretien" });
  }
  if (journal.decourage?.value) {
    alerts.push({ kind: 'critical', text: "Se sent découragé par sa situation" });
  }
  if (journal.stress?.value && journal.stress.level === 'forte') {
    alerts.push({ kind: 'critical', text: "Stress important en ce moment" });
  } else if (journal.stress?.value && journal.stress.level === 'moderee') {
    alerts.push({ kind: 'warning', text: "Stress modéré en ce moment" });
  }
  if (journal.motivation?.value === false) {
    alerts.push({ kind: 'critical', text: "Pas motivé en ce moment" });
  } else if (journal.motivation?.value && journal.motivation.level === 'legere') {
    alerts.push({ kind: 'warning', text: "Motivation faible cette semaine" });
  }
  if (journal.ressources?.value === false) {
    alerts.push({ kind: 'warning', text: "N'estime pas avoir les ressources pour atteindre ses objectifs" });
  }
  if (journal.visionPro?.value === false) {
    alerts.push({ kind: 'warning', text: "Vision négative de son avenir professionnel" });
  }
  if (journal.visionAvenir?.value === false) {
    alerts.push({ kind: 'warning', text: "Vision négative de l'avenir en général" });
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.55)",
    backdropFilter: "blur(28px) saturate(140%)",
    WebkitBackdropFilter: "blur(28px) saturate(140%)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 16, padding: 16,
  };

  if (alerts.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, fontWeight: 500, color: "var(--premium-text-2)",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "linear-gradient(135deg, #7f4997, #E84393)",
            flexShrink: 0,
          }} />
          <span>Aucun signal d&apos;attention sur ce journal — l&apos;utilisateur est dans une bonne dynamique.</span>
        </div>
      </div>
    );
  }

  // Dot couleur selon kind, mais bg/border restent neutres glass dashboard
  const dotColor = (kind: Alert['kind']) =>
    kind === 'critical' ? "#E84393"   // magenta IMPAKT (signal fort)
      : kind === 'warning' ? "#7f4997" // violet IMPAKT
      : "#a3a3a3";                      // gris (info neutre)

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 10.5, color: "var(--premium-text-4)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 12 }}>
        Points d&apos;attention ({alerts.length})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {alerts.map((a, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            background: "rgba(15,15,15,0.03)",
            border: "1px solid rgba(15,15,15,0.06)",
            borderRadius: 10,
            fontSize: 12, fontWeight: 500, color: "var(--premium-text-2)",
            lineHeight: 1.35,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: dotColor(a.kind),
              flexShrink: 0,
            }} />
            <span>{a.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// MotivationStatusPill — Pill compact à mettre dans le
// header d'un profil. Style identique à "Données temps réel"
// du dashboard mais avec un dot couleur dynamique selon le
// niveau de motivation (vert / orange / rouge).
// =====================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MotivationStatusPill({ uid, userData, onClick }: { uid: string; userData: any; onClick?: () => void }) {
  const { token } = useAuth();
  const [journalScore, setJournalScore] = useState<number | null>(null);
  const [journalLoaded, setJournalLoaded] = useState(false);

  // Fetch journal une seule fois par uid (ne dépend PAS de userData → pas de re-fetch)
  useEffect(() => {
    if (!token || !uid) return;
    let mounted = true;
    listMotivationJournalsAPI(token, uid)
      .then(res => {
        if (!mounted) return;
        setJournalScore(res.journals?.[0]?.score ?? null);
        setJournalLoaded(true);
      })
      .catch(() => { if (mounted) setJournalLoaded(true); });
    return () => { mounted = false; };
  }, [token, uid]);

  // userData est considéré "prêt" quand activity est défini (ProfilePage loadDetail terminé)
  const userDataReady = userData && (userData.activity !== undefined || userData.connexions !== undefined);

  // Engagement recomputé seulement quand userData stabilisé (évite le flicker 26 → 36)
  const engagement = useMemo(
    () => (userDataReady ? computeEngagementScore(userData) : null),
    [userDataReady, userData]
  );

  // On attend que TOUT soit chargé avant d'afficher (pas de score partiel visible)
  if (!journalLoaded || !engagement) return null;

  const score = journalScore != null
    ? computeCompositeScore(journalScore, engagement.total) ?? engagement.total
    : engagement.total;
  const hasJournal = journalScore != null;

  const baseLabel = score >= 70 ? "Motivation forte"
    : score >= 40 ? "Motivation modérée"
    : "Motivation faible";
  const label = hasJournal ? baseLabel : baseLabel.replace("Motivation", "Engagement");

  // Frosted glass tinté avec la palette pastel centralisée
  const palette = MOTIV_PALETTE[motivLevelFromScore(score)];
  const tint = { color: palette.rgb, text: palette.text, dot: palette.dot };

  return (
    <div
      title={hasJournal ? "Score motivation composite (journal + engagement) — cliquer pour ouvrir l'onglet Motivation" : "Score d'engagement seul (pas encore de journal) — cliquer pour ouvrir l'onglet Motivation"}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "8px 14px",
        cursor: onClick ? "pointer" : "default",
        transition: "transform .15s ease, filter .15s ease",
        // Voile blanc translucide + sous-couche couleur → effet verre dépoli
        background: `
          linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 100%),
          rgba(${tint.color}, 0.10)
        `,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "none",
        color: tint.text,
        borderRadius: 999,
        fontSize: 11.5, fontWeight: 500,
        fontFamily: "var(--font-display)",
        letterSpacing: "-0.1px",
        // Highlight intérieur en haut (réflexion lumière) + ombre douce extérieure
        boxShadow: `
          inset 0 1px 0.5px rgba(255,255,255,0.85),
          inset 0 -0.5px 0 rgba(${tint.color}, 0.10),
          0 1px 2px rgba(15,15,15,0.04),
          0 4px 12px rgba(${tint.color}, 0.08)
        `,
        whiteSpace: "nowrap",
      }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: tint.dot,
        boxShadow: `0 0 8px ${tint.dot}99`,
      }} />
      {label} · <span style={{ fontWeight: 700 }}>{score}/100</span>
    </div>
  );
}
