'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { fetchUserDetail, validateJob, ValidateJobPayload } from '@/lib/api';
import { exportProfileCSV, exportProfilePDF, ProfileExportData, PathwayExport, PathwayQuestion } from '@/lib/export';
import { formatNiveauEtudes, formatDateLongFr, UserDetail, ActivityEvent } from '@/types';
import Chart from 'chart.js/auto';
import Badge from '@/components/ui/Badge';

// ====== SOUS-COMPOSANTS ======

function ProfCard({ title, children, titleRight, style }: {
  title?: string; children: React.ReactNode; titleRight?: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: 'var(--white)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 18, transition: 'box-shadow .2s', ...style,
    }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-400)',
          textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12,
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

function ValidBtn({ type, defaultOn, loading, onToggle }: {
  type: 'like' | 'validate'; defaultOn?: boolean; loading?: boolean; onToggle?: (newState: boolean) => void;
}) {
  const [on, setOn] = useState(defaultOn || false);
  const isLike = type === 'like';
  const isReadOnly = isLike;

  useEffect(() => { setOn(defaultOn || false); }, [defaultOn]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly || loading) return;
    const newState = !on;
    setOn(newState);
    onToggle?.(newState);
  };

  return (
    <button onClick={handleClick} style={{
      width: 28, height: 28, borderRadius: 7, border: on ? 'none' : '1.5px solid var(--border)',
      background: on ? (isLike ? '#fce7f3' : '#ecfdf5') : 'var(--white)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: isReadOnly ? 'default' : loading ? 'wait' : 'pointer', transition: 'all .2s',
      opacity: (isReadOnly && !on) || loading ? 0.5 : 1,
    }} title={isLike ? 'Intérêt de l\'élève (non modifiable)' : 'Validation enseignant'}>
      {isLike ? (
        <svg viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, color: on ? '#be185d' : 'var(--text-300)' }}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14, color: on ? '#059669' : 'var(--text-300)' }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function MetiersList({ metiers, uid, token }: { metiers: string[]; uid: string; token: string | null }) {
  const [validations, setValidations] = useState<Record<number, boolean>>({});
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  if (!metiers.length) return <span style={{ fontSize: 12, color: 'var(--text-400)' }}>Évaluation non terminée</span>;

  const handleValidate = async (jobIndex: number, jobName: string, newState: boolean) => {
    if (!token || !uid) return;
    setLoadingIdx(jobIndex);
    try {
      const payload: ValidateJobPayload = { beneficiaireUid: uid, jobName, jobIndex, validated: newState };
      await validateJob(token, payload);
      setValidations(prev => ({ ...prev, [jobIndex]: newState }));
    } catch (err) {
      console.error('Erreur validation métier:', err);
      setValidations(prev => ({ ...prev, [jobIndex]: !newState }));
    }
    setLoadingIdx(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {metiers.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < metiers.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            background: i === 0 ? 'linear-gradient(135deg, #7f4997, #E84393)' : i === 1 ? '#1a1a2e' : i === 2 ? '#374151' : '#f3f4f6',
            color: i < 3 ? '#fff' : 'var(--text-400)',
          }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-700)' }}>{m}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <ValidBtn type="validate" defaultOn={validations[i] ?? (i === 0)} loading={loadingIdx === i} onToggle={(ns) => handleValidate(i, m, ns)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FormationsList({ pathways, activity, hasQuiz }: { pathways: Array<{ id: string; [key: string]: unknown }>; activity: Array<{ type: string; action: string; detail?: string | null; metadata?: Record<string, unknown> | null; timestamp?: string | null }>; hasQuiz: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const s = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (obj.name) return String(obj.name);
      if (obj.titre) return String(obj.titre);
      if (obj.label) return String(obj.label);
      return '';
    }
    return String(val);
  };

  // Parse activity into saved and proposed
  const savedActs: Array<{ detail: string; type: string; ecoles: string[] }> = [];
  const resultActs: Array<{ detail: string; timestamp: string; publics: Array<Record<string, string>>; prives: Array<Record<string, string>> }> = [];

  activity.forEach(a => {
    if (a.type !== 'formation') return;
    const meta = (a.metadata || {}) as Record<string, unknown>;
    if (a.action === 'pathway_saved') {
      const ecoles = Array.isArray(meta.ecoles) ? (meta.ecoles as unknown[]).map(e => String(e)) : [];
      savedActs.push({ detail: a.detail || '', type: typeof meta.type === 'string' ? meta.type : '', ecoles });
    }
    if (a.action === 'pathway_results') {
      const pub = Array.isArray(meta.parcours_publics) ? (meta.parcours_publics as Array<Record<string, string>>) : [];
      const pri = Array.isArray(meta.parcours_prives) ? (meta.parcours_prives as Array<Record<string, string>>) : [];
      resultActs.push({ detail: a.detail || '', timestamp: a.timestamp || '', publics: pub, prives: pri });
    }
  });

  if (!hasQuiz || (pathways.length === 0 && savedActs.length === 0 && resultActs.length === 0)) {
    return <span style={{ fontSize: 12, color: 'var(--text-400)', padding: '8px 0', display: 'block' }}>Aucun parcours généré</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ===== PARCOURS ENREGISTRÉS ===== */}
      {savedActs.length > 0 && (
        <div style={{ background: 'rgba(52,211,153,.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginBottom: 8, textTransform: 'uppercase' }}>⭐ Parcours enregistrés</div>
          {savedActs.map((sa, i) => (
            <div key={`sa-${i}`} style={{ padding: '6px 0', borderBottom: i < savedActs.length - 1 ? '1px solid rgba(52,211,153,.15)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-900)' }}>
                {sa.detail || 'Parcours'}
                {sa.type ? <span style={{ fontSize: 10, color: 'var(--text-400)', marginLeft: 4 }}>({sa.type})</span> : null}
              </div>
              {sa.ecoles.map((ecole, ei) => (
                <div key={ei} style={{ fontSize: 10, color: 'var(--text-700)', padding: '2px 0 2px 12px' }}>{ei + 1}. {ecole}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ===== PARCOURS PROPOSÉS ===== */}
      {resultActs.map((r, ri) => {
        const detailId = `result-${ri}`;
        const isOpen = expandedId === detailId;
        return (
          <div key={detailId} style={{ margin: '4px 0' }}>
            <div
              onClick={() => setExpandedId(isOpen ? null : detailId)}
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 10, transition: 'transform .2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
              Parcours proposé : {r.detail || 'N/A'}
            </div>
            {isOpen && (
              <div style={{ padding: '10px 0' }}>
                {r.publics.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-400)', margin: '8px 0 6px' }}>Parcours publics</div>
                    {r.publics.map((p, pi) => {
                      const etapes = Object.keys(p).filter(k => k.startsWith('etape')).sort();
                      return (
                        <div key={pi} style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px', margin: '4px 0' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-900)', marginBottom: 4 }}>🏛 Parcours {pi + 1}{p.titre ? ` : ${p.titre}` : ''}</div>
                          {etapes.map((k, ei) => (
                            <div key={ei} style={{ display: 'flex', gap: 6, padding: '2px 0 2px 10px' }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-400)', minWidth: 14 }}>{ei + 1}.</span>
                              <span style={{ fontSize: 10, color: 'var(--text-700)' }}>{p[k]}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
                {r.prives.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-400)', margin: '8px 0 6px' }}>Parcours privés</div>
                    {r.prives.map((p, pi) => {
                      const etapes = Object.keys(p).filter(k => k.startsWith('etape')).sort();
                      return (
                        <div key={pi} style={{ background: '#f9fafb', borderRadius: 6, padding: '8px 10px', margin: '4px 0' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-900)', marginBottom: 4 }}>🏫 Parcours {pi + 1}{p.titre ? ` : ${p.titre}` : ''}</div>
                          {etapes.map((k, ei) => (
                            <div key={ei} style={{ display: 'flex', gap: 6, padding: '2px 0 2px 10px' }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-400)', minWidth: 14 }}>{ei + 1}.</span>
                              <span style={{ fontSize: 10, color: 'var(--text-700)' }}>{p[k]}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ===== FALLBACK: PATHWAYS SUBCOLLECTION ===== */}
      {pathways.length > 0 && resultActs.length === 0 && savedActs.length === 0 && pathways.map((p, i) => {
        const title = s(p.titre) || s(p.title) || s(p.name) || 'Parcours ' + (i + 1);
        const metier = s(p.metier) || s(p.name);
        const pType = s(p.type);
        const formations = Array.isArray(p.formations) ? p.formations : [];
        const etapes = Array.isArray(p.prochaines_etapes) ? p.prochaines_etapes : [];
        const createdAt = p.createdAt ? (() => { try { return new Date(p.createdAt as string).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); } catch { return ''; } })() : '';
        const isOpen = expandedId === p.id;
        return (
          <div key={p.id || 'pw-' + i} style={{ border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden', background: '#fafbfc' }}>
            <div onClick={() => setExpandedId(isOpen ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-800)' }}>
                  {title}
                  {pType ? <span style={{ fontSize: 9, fontWeight: 600, marginLeft: 6, padding: '2px 6px', borderRadius: 4, background: pType === 'public' ? '#ecfdf5' : pType === 'prive' || pType === 'privé' ? '#fef2f2' : '#eff6ff', color: pType === 'public' ? '#059669' : pType === 'prive' || pType === 'privé' ? '#dc2626' : '#2563eb', textTransform: 'capitalize' as const }}>{pType}</span> : null}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-400)' }}>
                  {metier && metier !== title ? metier + ' \u00b7 ' : ''}{formations.length} formation{formations.length > 1 ? 's' : ''}{createdAt ? ' \u00b7 ' + createdAt : ''}
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, color: 'var(--text-300)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {isOpen && (
              <div style={{ padding: '0 12px 12px 12px' }}>
                {formations.map((f: Record<string, unknown>, fi: number) => (
                  <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: fi < formations.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#059669', marginTop: 1 }}>{fi + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-700)' }}>{s(f.nom) || 'Formation'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-400)' }}>
                        {s(f.ecole)}{s(f.ville) ? ' (' + s(f.ville) + ')' : ''}{s(f.duree) ? ' \u00b7 ' + s(f.duree) : ''}
                      </div>
                    </div>
                  </div>
                ))}
                {etapes.length > 0 && (
                  <div style={{ background: '#f8f5ff', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: '#7f4997', marginBottom: 6 }}>Prochaines étapes</div>
                    {etapes.map((e: Record<string, unknown>, ei: number) => (
                      <div key={ei} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '3px 0', fontSize: 10.5 }}>
                        <span style={{ color: '#7f4997', fontWeight: 600, flexShrink: 0 }}>→</span>
                        <span style={{ color: 'var(--text-600)' }}>{s(e.action)}{s(e.date) ? ' — ' + s(e.date) : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NotesSection({ idx }: { idx: number }) {
  const [notes, setNotes] = useState<Array<{ author: string; date: string; content: string }>>(() => {
    if (idx % 2 === 0) return [
      { author: 'Marie Dupont', date: '28 févr. 2026', content: 'Jeune motivé, souhaite se réorienter vers le numérique.' },
      { author: 'Marie Dupont', date: '15 févr. 2026', content: 'Premier RDV effectué. Besoin accompagnement CV.' },
    ];
    return [];
  });
  const [showInput, setShowInput] = useState(false);
  const [text, setText] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const addNote = () => {
    if (!text.trim()) return;
    const ds = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    setNotes(prev => [{ author: 'Marie Dupont', date: ds, content: text.trim() }, ...prev]);
    setText(''); setShowInput(false);
  };

  useEffect(() => { if (showInput && textRef.current) textRef.current.focus(); }, [showInput]);

  return (
    <ProfCard title="Notes de l\'enseignant" titleRight={
      <button onClick={() => setShowInput(true)} style={{ width: 28, height: 28, borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--white)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
    } style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 250, overflowY: 'auto', scrollbarWidth: 'thin', flex: 1 }}>
        {notes.length === 0 && <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-300)', fontSize: 12 }}>Aucune note pour le moment</div>}
        {notes.map((n, i) => (
          <div key={i} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', animation: 'fi .3s ease both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-900)' }}>{n.author}</span>
              <span style={{ fontSize: 10, color: 'var(--text-400)' }}>{n.date}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-700)', lineHeight: 1.5 }}>{n.content}</div>
          </div>
        ))}
      </div>
      {showInput && (
        <div style={{ marginTop: 10 }}>
          <textarea ref={textRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire une note..."
            style={{ width: '100%', minHeight: 100, padding: 12, border: '1.5px solid var(--border)', borderRadius: 10, fontFamily: 'inherit', fontSize: 12, color: 'var(--text-900)', resize: 'vertical', outline: 'none', background: 'var(--white)', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
            <button onClick={() => { setShowInput(false); setText(''); }} style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--white)', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>Annuler</button>
            <button onClick={addNote} style={{ padding: '6px 14px', border: 'none', borderRadius: 7, background: 'linear-gradient(135deg, #7f4997, #E84393)', color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Enregistrer</button>
          </div>
        </div>
      )}
    </ProfCard>
  );
}

function RadarChart({ riasecScores, hasQuiz }: { riasecScores: number[]; hasQuiz: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !hasQuiz) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: ['Réaliste', 'Investigateur', 'Artistique', 'Social', 'Entreprenant', 'Conventionnel'],
        datasets: [{ data: riasecScores, backgroundColor: 'rgba(142,68,173,.12)', borderColor: '#8E44AD', borderWidth: 2, pointBackgroundColor: '#8E44AD', pointRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { r: { beginAtZero: true, max: 10, ticks: { display: false, stepSize: 2 }, grid: { color: '#f0f0f0' }, pointLabels: { font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 }, color: '#374151' } } },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, [hasQuiz, riasecScores]);

  if (!hasQuiz) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 12, color: 'var(--text-400)' }}>Évaluation non démarrée</span></div>;
  return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><canvas ref={canvasRef} /></div>;
}

function SlidePanel({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.25)', zIndex: 200 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, background: 'var(--white)', boxShadow: '-8px 0 30px rgba(0,0,0,.1)', zIndex: 201, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fi .2s ease' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-900)' }}>{title}</span>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: 'var(--text-500)' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>{children}</div>
        {footer && <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>{footer}</div>}
      </div>
    </>
  );
}

function ActivityTimeline({ activity, inscriptionDate }: { activity: ActivityEvent[]; inscriptionDate: string }) {
  const ds = formatDateLongFr(inscriptionDate);

  const activityItems = useMemo(() => {
    if (!activity || activity.length === 0) {
      return [{ emoji: '👤', bg: '#ecfdf5', text: <strong>Inscription</strong>, date: ds }];
    }
    const skipActions = ['anthropicProxy', 'pathway'];
    const skipTypes = ['api_usage', 'api_call'];
    const labelMap: Record<string, string> = {
      'pathway_generated': 'Parcours généré',
      'pathway_saved': 'Parcours enregistré',
      'pathway_results': 'Résultats parcours',
      'pathway_questions': 'Questions parcours',
      'tab_opened': 'Page consultée',
      'question_answered': 'Question répondue',
      'job_viewed': 'Fiche métier consultée',
      'message_sent': 'Message chatbot',
      'hiring_results': 'Résultats recrutement',
      'hiring_search': 'Recherche recrutement',
    };
    return activity
      .filter(evt => !skipTypes.includes(evt.type) && !skipActions.includes(evt.action))
      .map((evt) => {
      const evtDate = evt.timestamp ? new Date(evt.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ds;
      let emoji = '📋', bg = '#f3f4f6';
      switch (evt.type) {
        case 'quiz': emoji = '✅'; bg = '#ecfdf5'; break;
        case 'recherche': emoji = '🔍'; bg = '#f3f4f6'; break;
        case 'formation': emoji = '🎓'; bg = '#e0e7ff'; break;
        case 'navigation': emoji = '🧭'; bg = '#f0f9ff'; break;
        case 'hiring': emoji = '📊'; bg = '#fff7ed'; break;
      }
      const label = labelMap[evt.action] || evt.action.replace(/_/g, ' ');
      return { emoji, bg, text: <><strong>{label}</strong>{evt.detail ? ` : ${evt.detail}` : ''}</>, date: evtDate };
    });
  }, [activity, ds]);

  return (
    <div style={{ maxHeight: 240, overflowY: 'auto', scrollbarWidth: 'thin', flex: 1 }}>
      {activityItems.map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < activityItems.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: h.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>{h.emoji}</div>
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-700)', lineHeight: 1.4 }}>{h.text}</div>
            <div style={{ fontSize: 10, color: 'var(--text-400)', marginTop: 1 }}>{h.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}


// ====== PAGE PRINCIPALE ======

export default function ProfilePage() {
  const { data, token } = useAuth();
  const { selectedUserIndex, selectedUserUid, closeProfile } = useNav();
  // const { openExchange } = useModals();
  const [slidePanel, setSlidePanel] = useState<'none' | 'finalize' | 'finalized' | 'cancelled'>('none');
  const [finalizeConfirmed, setFinalizeConfirmed] = useState(false);

  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const users = useMemo(() => data?.recentUsers || [], [data]);
  const sorted = useMemo(() => [...users].sort((a, b) => (a.nom || '').localeCompare(b.nom || '')), [users]);

  // Find user by uid or by index
  const idx = useMemo(() => {
    if (selectedUserUid) {
      const found = sorted.findIndex(u => u.uid === selectedUserUid);
      return found >= 0 ? found : 0;
    }
    return selectedUserIndex ?? 0;
  }, [selectedUserUid, selectedUserIndex, sorted]);
  const u = sorted[idx];

  useEffect(() => {
    setSlidePanel('none'); setFinalizeConfirmed(false);
    setUserDetail(null); setDetailError(null);
  }, [selectedUserIndex, selectedUserUid]);

  // Charger le détail via /user/:uid
  useEffect(() => {
    if (!u?.uid || !token) return;
    let cancelled = false;
    setDetailLoading(true); setDetailError(null);
    fetchUserDetail(token, u.uid)
      .then(detail => { if (!cancelled) { setUserDetail(detail); setDetailLoading(false); } })
      .catch(err => { if (!cancelled) { console.error('Erreur détail:', err); setDetailError(err.message || 'Erreur'); setDetailLoading(false); } });
    return () => { cancelled = true; };
  }, [u?.uid, token]);

  const edu = formatNiveauEtudes(u?.niveauEtudes);
  const ds = formatDateLongFr(u?.inscriptionDate);
  const init = ((u?.prenom || '?')[0] + (u?.nom || '?')[0]).toUpperCase();
  const connexions = u?.connexions || 0;
  const totalAppTime = u?.totalAppTime || 0;
  const testTimeDisplay = totalAppTime > 0 ? `${Math.round(totalAppTime / 60)}` : '—';
  const lastConn = u?.lastActive ? new Date(u.lastActive).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';
  const stLabel = u?.quizCompleted ? 'Terminée' : u?.quizStarted ? 'En cours' : 'Non démarrée';
  const stCls = u?.quizCompleted ? 'badge-green' : u?.quizStarted ? 'badge-orange' : 'badge-grey';
  const email = u?.email || '—';
  const ville = u?.ville || '—';
  const metiers10 = u?.topMetiers || [];
  const hasQuiz = !!(u?.quizCompleted || u?.quizStarted);

  const pathways = useMemo(() => userDetail?.pathways || [], [userDetail]);
  const activity = useMemo(() => userDetail?.activity || [], [userDetail]);
  const orientationScore = useMemo(() => userDetail?.orientationScore || null, [userDetail]);

  const riasecProfile = u?.riasecProfile || null;
  const riasecScores = useMemo(() => {
    const source = orientationScore || riasecProfile;
    if (!source) return [0, 0, 0, 0, 0, 0];
    const keys = ['R', 'I', 'A', 'S', 'E', 'C'];
    return keys.map(k => {
      const val = source[k] ?? source[k.toLowerCase()] ?? 0;
      return typeof val === 'number' ? Math.round(val) : 0;
    });
  }, [orientationScore, riasecProfile]);

  const antData: Array<{ type: string; title: string; detail: string }> = [];
  const searchTags: string[] = useMemo(() => {
    const tags = new Set<string>();
    activity.forEach(a => {
      if (a.type === 'formation' && a.detail) {
        tags.add(a.detail);
      }
    });
    return Array.from(tags);
  }, [activity]);

  const actions = useMemo(() => {
    const a: Array<{ text: React.ReactNode; date: string }> = [];
    if (idx % 2 === 0 && metiers10[0]) a.push({ text: <><strong>Métier validé</strong> : {metiers10[0]}</>, date: '28 févr. 2026' });
    a.push({ text: <strong>Note ajoutée</strong>, date: '15 févr. 2026' });
    return a;
  }, [idx, metiers10]);

  const handleFinalize = useCallback(() => { setSlidePanel('finalized'); setFinalizeConfirmed(false); }, []);

  const handleProfileExport = useCallback((fmt: 'csv' | 'pdf') => {
    if (!u) return;

    // Actions de l\'enseignant
    const actionTexts: Array<{ text: string; date: string }> = [];
    if (idx % 2 === 0 && metiers10[0]) actionTexts.push({ text: `Métier validé : ${metiers10[0]}`, date: '28 févr. 2026' });
    actionTexts.push({ text: 'Note ajoutée', date: '15 févr. 2026' });

    // Parcours structurés par métier
    const parcoursMap = new Map<string, PathwayExport>();

    activity.forEach(a => {
      if (a.type !== 'formation') return;
      const meta = (a.metadata || {}) as Record<string, unknown>;
      const metierName = a.detail || 'Métier inconnu';

      if (!parcoursMap.has(metierName)) {
        parcoursMap.set(metierName, { metier: metierName, publics: [], prives: [] });
      }
      const entry = parcoursMap.get(metierName)!;

      if (a.action === 'pathway_saved') {
        const ecoles = Array.isArray(meta.ecoles) ? (meta.ecoles as unknown[]).map(e => String(e)) : [];
        const type = typeof meta.type === 'string' ? meta.type : '';
        entry.saved = { type, ecoles };
      }

      if (a.action === 'pathway_results') {
        const pub = Array.isArray(meta.parcours_publics) ? (meta.parcours_publics as Array<Record<string, string>>) : [];
        const pri = Array.isArray(meta.parcours_prives) ? (meta.parcours_prives as Array<Record<string, string>>) : [];
        pub.forEach(p => {
          const etapes = Object.keys(p).filter(k => k.startsWith('etape')).sort().map(k => p[k]).filter(Boolean);
          if (etapes.length > 0) entry.publics.push({ titre: p.titre || undefined, etapes });
        });
        pri.forEach(p => {
          const etapes = Object.keys(p).filter(k => k.startsWith('etape')).sort().map(k => p[k]).filter(Boolean);
          if (etapes.length > 0) entry.prives.push({ titre: p.titre || undefined, etapes });
        });
      }
    });

    // Fallback sur pathways subcollection si pas d'activité
    if (parcoursMap.size === 0 && pathways.length > 0) {
      pathways.forEach(pw => {
        const name = (pw.metier || pw.name || pw.title || pw.id || '') as string;
        const pType = (pw.type || '') as string;
        const formations = Array.isArray(pw.formations) ? pw.formations : [];
        const etapes = formations.map((f: Record<string, unknown>) => {
          const nom = f.nom || f.name || '';
          const ecole = f.ecole || '';
          const fVille = f.ville || '';
          return `${nom}${ecole ? ' — ' + ecole : ''}${fVille ? ' (' + fVille + ')' : ''}`;
        }).filter(Boolean) as string[];
        if (etapes.length > 0) {
          const entry: PathwayExport = { metier: name || 'Parcours', publics: [], prives: [] };
          if (pType === 'public') entry.publics.push({ etapes });
          else if (pType === 'prive' || pType === 'privé') entry.prives.push({ etapes });
          else entry.publics.push({ etapes });
          parcoursMap.set(name, entry);
        }
      });
    }

    // Questions parcours
    const questionsExport: PathwayQuestion[] = [];
    activity.forEach(a => {
      if (a.type === 'formation' && a.action === 'pathway_questions') {
        const meta = (a.metadata || {}) as Record<string, unknown>;
        const reponses: Record<string, string> = {};
        const fields = ['alternance', 'durée études', 'filière', 'lieu', 'moyenne', 'spécialités', 'étranger'];
        fields.forEach(f => {
          const val = meta[f];
          if (val !== undefined && val !== null) reponses[f] = String(val);
        });
        if (Object.keys(reponses).length > 0) {
          questionsExport.push({ metier: a.detail || 'Métier', reponses });
        }
      }
    });

    const exportData: ProfileExportData = {
      prenom: u.prenom || '', nom: u.nom || '', age: u.age, gender: u.situation || '—',
      edu, email, phone: '—', address: ville, statut: stLabel, prog: u.quizProgress ?? 0,
      connexions, testTime: Math.round(totalAppTime / 60), lastConn, inscDate: ds,
      metiers: metiers10,
      parcours: Array.from(parcoursMap.values()),
      questions: questionsExport,
      anterieurs: antData, searchTags,
      notes: [], actions: actionTexts, riasec: riasecScores, hasQuiz,
      hasRdv: false, rdvType: '', rdvDate: '', rdvTime: '',
    };
    if (fmt === 'csv') exportProfileCSV(exportData);
    else exportProfilePDF(exportData);
  }, [u, edu, email, ville, stLabel, connexions, totalAppTime, lastConn, ds, metiers10, pathways, activity, antData, searchTags, riasecScores, hasQuiz, idx]);

  if (!u) return <div className="ld"><div className="ld-spin" />Chargement...</div>;

  return (
    <>
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, alignItems: 'start' }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* TOP BAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
            <button onClick={closeProfile} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18, color: 'var(--text-500)' }}><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{init}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-900)' }}>{u.prenom} {u.nom}</div>
              <div style={{ fontSize: 12, color: 'var(--text-400)', marginTop: 2 }}>{u.age || '—'} ans · {u.situation || '—'} · {edu} · <Badge label={stLabel} className={stCls} /></div>
            </div>
            <button onClick={() => handleProfileExport('csv')} style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--white)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              CSV
            </button>
            <button onClick={() => handleProfileExport('pdf')} style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--white)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              PDF
            </button>
            <button onClick={() => { /* TODO: envoyer top métiers + métiers recherchés à Avenir(s) via API */ }} className="btn-gradient" style={{ padding: '9px 20px', borderRadius: 10, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: 1, display: 'flex', alignItems: 'center', gap: 6 }} title="Intégration Avenir(s) à venir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M12 19V5" /><polyline points="5 12 12 5 19 12" /></svg>
              Avenir(s)
            </button>
          </div>

          {detailLoading && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="ld-spin" style={{ width: 14, height: 14 }} /> Chargement des données détaillées...
            </div>
          )}
          {detailError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#dc2626' }}>
              Impossible de charger le détail : {detailError}
            </div>
          )}

          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { val: testTimeDisplay, suffix: totalAppTime > 0 ? ' min' : '', label: "Temps sur l'app" },
              { val: `${connexions}`, label: 'Connexions' },
              { val: lastConn, label: 'Dernière connexion' },
            ].map((k, i) => (
              <ProfCard key={i} style={{ padding: '14px 16px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-900)', lineHeight: 1 }}>
                  {k.val}{k.suffix && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-400)' }}>{k.suffix}</span>}
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-400)', marginTop: 3 }}>{k.label}</div>
              </ProfCard>
            ))}
          </div>

          <div style={{ columnCount: 2, columnGap: 14 }}>
            <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <ProfCard title="Top 10 métiers recommandés">
                <MetiersList metiers={metiers10} uid={u.uid} token={token} />
              </ProfCard>
            </div>

          {(() => {
            const pqActs = activity.filter(a => a.type === 'formation' && a.action === 'pathway_questions');
            if (pqActs.length === 0) return null;
            const fields = ['alternance', 'dur\u00e9e \u00e9tudes', 'fili\u00e8re', 'lieu', 'moyenne', 'sp\u00e9cialit\u00e9s', '\u00e9tranger'];
            const fieldLabels: Record<string, string> = { 'alternance': 'Alternance', 'dur\u00e9e \u00e9tudes': 'Dur\u00e9e \u00c9tudes', 'fili\u00e8re': 'Fili\u00e8re', 'lieu': 'Lieu', 'moyenne': 'Moyenne', 'sp\u00e9cialit\u00e9s': 'Sp\u00e9cialit\u00e9s', '\u00e9tranger': '\u00c9tranger' };
            return (
              <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <ProfCard title="Questions parcours" style={{ padding: '12px 18px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {pqActs.map((pq, qi) => {
                    const meta = (pq.metadata || {}) as Record<string, unknown>;
                    return (
                      <details key={qi} style={{ marginBottom: 4 }}>
                        <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-900)', cursor: 'pointer', padding: '4px 0' }}>
                          {pq.detail || 'M\u00e9tier'}
                        </summary>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
                          <tbody>
                            {fields.map(f => {
                              const val = meta[f];
                              if (val === undefined || val === null) return null;
                              return (
                                <tr key={f}>
                                  <td style={{ fontSize: 11, color: 'var(--text-400)', padding: '4px 8px 4px 0', width: 120, verticalAlign: 'top' }}>{fieldLabels[f] || f}</td>
                                  <td style={{ fontSize: 11, color: 'var(--text-700)', fontWeight: 500, padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>{String(val)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </details>
                    );
                  })}
                </div>
              </ProfCard>
              </div>
            );
          })()}
            <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <NotesSection idx={idx} />
            </div>
            <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <ProfCard title="Actions de l\'enseignant">
              {actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < actions.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-700)', lineHeight: 1.4 }}>{a.text}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-400)', marginTop: 1 }}>{a.date}</div>
                  </div>
                </div>
              ))}
            </ProfCard>
            </div>
            <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <ProfCard title="Parcours de formation">
                <FormationsList pathways={pathways} activity={activity} hasQuiz={hasQuiz} />
              </ProfCard>
            </div>
            <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <ProfCard title="Profil IMPAKT">
                <RadarChart riasecScores={riasecScores} hasQuiz={hasQuiz} />
              </ProfCard>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ProfCard title="Coordonnées">
            {[
              { label: 'Email', value: email, icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></> },
              { label: 'Ville', value: ville, icon: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></> },
              { label: 'Situation', value: u?.situation || '—', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #f5f5f5' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, color: 'var(--text-400)' }}>{c.icon}</svg>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-400)' }}>{c.label}</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-900)', wordBreak: 'break-all' as const }}>{c.value}</div>
                </div>
              </div>
            ))}
          </ProfCard>

          <ProfCard title="Antérieur">
            {antData.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-400)' }}>Aucune donnée</span> : antData.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < antData.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: a.type === 'edu' ? '#e0e7ff' : '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, color: a.type === 'edu' ? '#4338ca' : '#d97706' }}>
                    {a.type === 'edu' ? <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5" /></> : <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>}
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-900)' }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: a.detail.includes('Non terminé') ? '#d97706' : 'var(--text-400)' }}>{a.detail}</div>
                </div>
              </div>
            ))}
          </ProfCard>

          <ProfCard title="Métiers recherchés">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {searchTags.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-400)' }}>Aucune recherche</span> : searchTags.map((s, i) => (
                <span key={i} style={{ display: 'inline-block', fontSize: 11, background: '#f3f4f6', color: 'var(--text-700)', padding: '4px 10px', borderRadius: 6, fontWeight: 500 }}>{s}</span>
              ))}
            </div>
          </ProfCard>

          <ProfCard title="Historique" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ActivityTimeline activity={activity} inscriptionDate={u.inscriptionDate || ''} />
          </ProfCard>
        </div>
      </div>
    </div>

    {/* SLIDE PANELS */}
    <SlidePanel open={slidePanel === 'finalize'} title="Finaliser le parcours" onClose={() => { setSlidePanel('none'); setFinalizeConfirmed(false); }}
      footer={<>
        <button onClick={() => { setSlidePanel('none'); setFinalizeConfirmed(false); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}>Annuler</button>
        <button onClick={handleFinalize} disabled={!finalizeConfirmed} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#059669', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#fff', cursor: finalizeConfirmed ? 'pointer' : 'not-allowed', opacity: finalizeConfirmed ? 1 : 0.5 }}>Finaliser le parcours</button>
      </>}
    >
      <div style={{ padding: '8px 0' }}>
        <div style={{ fontSize: 13, color: 'var(--text-700)', lineHeight: 1.6, marginBottom: 16 }}>
          Vous êtes sur le point de finaliser le parcours de cet élève. Cette action confirme que l&apos;élève a trouvé sa voie professionnelle.
        </div>
        <div style={{ background: '#ecfdf5', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 6 }}>Cela signifie :</div>
          <div style={{ fontSize: 12, color: '#065f46', lineHeight: 1.6 }}>
            • Le statut passera à &quot;Parcours finalisé&quot;<br />
            • Comptabilisé comme sortie positive<br />
            • Dossier archivé
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: '#f9fafb', borderRadius: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={finalizeConfirmed} onChange={(e) => setFinalizeConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: '#059669' }} />
          <div style={{ fontSize: 12, color: 'var(--text-700)', lineHeight: 1.4 }}>Je confirme que l&apos;élève a trouvé sa voie professionnelle.</div>
        </label>
      </div>
    </SlidePanel>

    <SlidePanel open={slidePanel === 'finalized'} title="Finaliser le parcours" onClose={() => setSlidePanel('none')}
      footer={<button onClick={() => setSlidePanel('none')} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#059669', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Fermer</button>}
    >
      <div style={{ textAlign: 'center', padding: '30px 0' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" style={{ width: 56, height: 56, margin: '0 auto 14px', display: 'block' }}><circle cx="12" cy="12" r="10" /><polyline points="16 8 10.5 14 8 11.5" /></svg>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>Parcours finalisé !</div>
        <div style={{ fontSize: 12, color: 'var(--text-400)', marginTop: 6 }}>Le élève est sorti du dispositif avec succès.</div>
      </div>
    </SlidePanel>
    </>
  );
}
