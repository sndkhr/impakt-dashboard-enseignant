"use client";
import { useEffect, useState } from "react";
import { listSatisfactionSurveysAPI, SatisfactionSurveyDTO } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// =====================================================
// SatisfactionSection — v17.4
// Affiche les réponses du jeune au questionnaire de
// satisfaction (test lycée mai 2026).
// =====================================================

const QUESTIONS: Array<{ key: keyof SatisfactionSurveyDTO; label: string }> = [
  { key: 'canImagineJob',    label: "Y a-t-il un métier dans ton top 10 dans lequel tu pourrais t'imaginer plus tard ?" },
  { key: 'wantUseTerminale', label: "Aimerais-tu pouvoir utiliser Impakt en terminale, au moment de choisir ton orientation sur Parcoursup ?" },
  { key: 'wouldReassure',    label: "Est-ce que ça te rassurerait de pouvoir utiliser l'app au moment de ton choix d'orientation ?" },
  { key: 'learnedSelf',      label: "Le test t'a-t-il appris un truc sur toi que tu ne savais pas avant ?" },
  { key: 'couldHelp',        label: "Penses-tu que l'app pourrait t'aider ?" },
  { key: 'wouldShare',       label: "Pourrais-tu partager l'app avec un pote ?" },
];

interface Props {
  uid: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric"
    });
  } catch { return "—"; }
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Très positif";
  if (score >= 40) return "Mitigé";
  return "Critique";
}

export default function SatisfactionSection({ uid }: Props) {
  const { token } = useAuth();
  const [surveys, setSurveys] = useState<SatisfactionSurveyDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !uid) return;
    let mounted = true;
    setLoading(true);
    listSatisfactionSurveysAPI(token, uid)
      .then(res => {
        if (!mounted) return;
        setSurveys(res.surveys || []);
        setErr(null);
      })
      .catch(e => {
        if (!mounted) return;
        setErr(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token, uid]);

  const latest = surveys[0];

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.52)",
    backdropFilter: "blur(28px) saturate(140%)",
    WebkitBackdropFilter: "blur(28px) saturate(140%)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 1px 2px rgba(15,15,15,0.03), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.85)",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14, paddingBottom: 12,
    borderBottom: "1px solid rgba(15,15,15,0.06)",
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#525252", textTransform: "uppercase", letterSpacing: ".5px" }}>
            Questionnaire de satisfaction
          </div>
        </div>
        <div style={{ padding: 20, textAlign: "center", color: "var(--premium-text-4)", fontSize: 12 }}>Chargement…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#525252", textTransform: "uppercase", letterSpacing: ".5px" }}>
            Questionnaire de satisfaction
          </div>
        </div>
        <div style={{ padding: 20, textAlign: "center", color: "#dc2626", fontSize: 12 }}>Erreur : {err}</div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#525252", textTransform: "uppercase", letterSpacing: ".5px" }}>
          Questionnaire de satisfaction
        </div>
        <div style={{ fontSize: 9, fontWeight: 600, color: "var(--premium-text-4)" }}>
          {latest ? fmtDate(latest.createdAt) : "—"}
        </div>
      </div>

      {!latest && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--premium-text-4)", fontSize: 12 }}>
          Le jeune n&apos;a pas encore complété le questionnaire.
        </div>
      )}

      {latest && (
        <>
          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 100,
              background: scoreColor(latest.score),
            }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--premium-text-1)" }}>
              {latest.score}/100
            </div>
            <div style={{ fontSize: 11, color: "var(--premium-text-3)", fontWeight: 500 }}>
              {scoreLabel(latest.score)}
            </div>
          </div>

          {/* Réponses */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUESTIONS.map(q => {
              const val = latest[q.key] as boolean | null;
              return (
                <div key={q.key as string}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 30px",
                    gap: 10, alignItems: "start",
                    padding: "8px 0",
                    borderBottom: "1px dashed rgba(15,15,15,0.06)"
                  }}>
                  <span style={{
                    color: "var(--premium-text-2)",
                    fontSize: 12, lineHeight: "16px"
                  }}>{q.label}</span>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: val === true ? "rgba(34,197,94,0.15)" : val === false ? "rgba(239,68,68,0.12)" : "rgba(15,15,15,0.04)",
                    color: val === true ? "#22c55e" : val === false ? "#ef4444" : "#999",
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {val === true ? "✓" : val === false ? "✗" : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Historique court si plusieurs */}
          {surveys.length > 1 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(15,15,15,0.06)", fontSize: 10, color: "var(--premium-text-4)" }}>
              {surveys.length} questionnaires complétés au total
            </div>
          )}
        </>
      )}
    </div>
  );
}
