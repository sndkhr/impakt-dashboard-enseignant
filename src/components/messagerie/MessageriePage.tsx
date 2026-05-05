'use client';

import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/navigation';
import { useConversations, useConversationMessages } from '@/lib/useBackendRdvs';
import { startConversationFromDashboard, BackendConversation } from '@/lib/api';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useVideoCall, parseCallSummary } from '@/lib/videoCall';
import InlineVideoCall from '@/components/messagerie/InlineVideoCall';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const cal = (d2: Date) => { const x = new Date(d2); x.setHours(0,0,0,0); return x.getTime(); };
  const today = cal(new Date());
  const target = cal(d);
  const diffDays = Math.round((today - target) / 864e5);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (diffDays === 0) return `${hh}:${mm}`;
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatBubbleTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const cal = (d2: Date) => { const x = new Date(d2); x.setHours(0,0,0,0); return x.getTime(); };
  const today = cal(new Date());
  const target = cal(d);
  const diffDays = Math.round((today - target) / 864e5);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (diffDays === 0) return `${hh}:${mm}`;
  if (diffDays === 1) return `hier ${hh}:${mm}`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ` ${hh}:${mm}`;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

// Renvoie l'étiquette du jour pour les séparateurs de date façon WhatsApp
function dayLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d); target.setHours(0,0,0,0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 864e5);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays > 1 && diffDays < 7) {
    const day = d.toLocaleDateString('fr-FR', { weekday: 'long' });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}


interface DraftRecipient {
  uid: string;
  prenom?: string;
  nom?: string;
}

export default function MessageriePage() {
  const { token, data } = useAuth();
  const { openProfile } = useNav();
  const toast = useToast();
  const { startCall, activeCall } = useVideoCall();
  const { conversations, loading: loadingConvs, refresh: refreshConvs } = useConversations();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [draftRecipient, setDraftRecipient] = useState<DraftRecipient | null>(null);
  const [draft, setDraft] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvFilter, setNewConvFilter] = useState('');
  const [pendingDraftMessage, setPendingDraftMessage] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [showAudioCallConfirm, setShowAudioCallConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<unknown>(null);

  const selectedConv = useMemo(
    () => conversations.find(c => c.id === selectedConvId) || null,
    [conversations, selectedConvId]
  );

  const { messages, loading: loadingMsgs, send, markRead } = useConversationMessages(selectedConvId);

  // Auto-select première conv au chargement (mais pas si on est en train de drafter)
  useEffect(() => {
    if (!selectedConvId && !draftRecipient && conversations.length > 0) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId, draftRecipient]);

  // Mark as read quand on ouvre une conv
  useEffect(() => {
    if (selectedConvId) {
      markRead().then(() => refreshConvs());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvId]);

  // ✨ Quand la nouvelle conv apparaît dans la liste → on peut lâcher le draft
  useEffect(() => {
    if (draftRecipient && selectedConv && selectedConv.jeuneUid === draftRecipient.uid) {
      setDraftRecipient(null);
    }
  }, [selectedConv, draftRecipient]);

  // Auto-scroll en bas quand nouveau message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length]);

  // ✨ Refresh agressif après envoi : on retente la liste plusieurs fois pour
  // attraper la nouvelle conv (Firestore peut prendre 1-2s pour propager).
  const aggressiveRefresh = async () => {
    for (let i = 0; i < 5; i++) {
      await refreshConvs();
      await new Promise(r => setTimeout(r, 800));
    }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;

    // Cas 1 : conversation existante → envoi instantané (UI optimiste)
    if (selectedConvId && !draftRecipient) {
      setDraft('');
      send(text);
      setTimeout(() => { refreshConvs(); }, 600);
      return;
    }

    // Cas 2 : nouvelle conversation (draft) → on crée la conv via le backend
    // ✨ Fire-and-forget : pas de "sending=true", le bouton ne se grise jamais.
    // Le message s'affiche en optimistic dans le chat en attendant la conv.
    if (draftRecipient) {
      if (!token) {
        toast.show('Session expirée — reconnecte-toi', 'error');
        return;
      }
      setDraft('');
      setPendingDraftMessage(text);
      (async () => {
        try {
          const res = await startConversationFromDashboard(token, draftRecipient.uid, text);
          if (res.conversationId) setSelectedConvId(res.conversationId);
          aggressiveRefresh();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erreur inconnue';
          toast.show(`Erreur : ${msg}`, 'error');
          setPendingDraftMessage(null);
        }
      })();
    }
  };

  // Quand le message "draft" apparaît dans la conv réelle → on peut lâcher le pending
  useEffect(() => {
    if (pendingDraftMessage && messages.some(m => m.text === pendingDraftMessage && m.senderType === 'conseiller')) {
      setPendingDraftMessage(null);
    }
  }, [messages, pendingDraftMessage]);

  // ✨ Auto-grow du textarea : la zone d'écriture s'agrandit en hauteur au fur
  // et à mesure que le message s'allonge (jusqu'à 220px ~10 lignes, puis scroll).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }, [draft]);

  // === Démarrer un appel (vidéo ou audio) ===
  // Pas de message d'invitation : pendant l'appel, on ne voit pas la messagerie.
  // À la fin de l'appel, un message récap est envoyé automatiquement par
  // le contexte VideoCall (ex: "📹 Appel vidéo · 3 min 45 s").
  const handleStartCall = async (audioOnly = false) => {
    if (!selectedConv || !selectedConv.jeuneUid) return;
    const recipientName = selectedConv.jeuneName || 'Bénéficiaire';
    const conseillerName = data?.conseillerName?.trim() || 'Conseiller France Travail';
    setShowCallConfirm(false);
    setShowAudioCallConfirm(false);
    const url = await startCall({
      recipientName,
      recipientUid: selectedConv.jeuneUid,
      conversationId: selectedConv.id,
      conseillerName,
      audioOnly,
    });
    if (!url) {
      toast.show("Impossible de démarrer l'appel — réessaie dans un instant.", 'error');
    }
  };

  // === Helpers barre de saisie ===
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.show("Pièces jointes bientôt disponibles", 'info');
    }
    e.target.value = ''; // reset
    setShowAttachMenu(false);
  };

  const toggleDictation = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.show("Dictée non supportée par ce navigateur", 'error');
      return;
    }
    if (isListening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop?.();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = draft;
    rec.onresult = (event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => {
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setDraft((finalText + interim).trimStart());
    };
    rec.onerror = () => { setIsListening(false); };
    rec.onend = () => { setIsListening(false); };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  };

  // Liste des bénéficiaires sans conv (pour démarrer une nouvelle conversation)
  const eligibleUsers = useMemo(() => {
    const existing = new Set(conversations.map(c => c.jeuneUid));
    const list = (data?.recentUsers || []).filter(u => u.uid && !existing.has(u.uid));
    if (!newConvFilter) return list.slice(0, 60);
    const f = newConvFilter.toLowerCase();
    return list.filter(u =>
      `${u.prenom || ''} ${u.nom || ''}`.toLowerCase().includes(f) ||
      (u.email || '').toLowerCase().includes(f)
    ).slice(0, 60);
  }, [conversations, data?.recentUsers, newConvFilter]);

  // ✨ NOUVEAU FLOW : sélectionner un user → ouvrir le chat vide en mode "draft"
  const handleSelectUserForNewConv = (jeuneUid: string, prenom?: string, nom?: string) => {
    setSelectedConvId(null);
    setDraftRecipient({ uid: jeuneUid, prenom, nom });
    setDraft('');
    setShowNewConv(false);
    setNewConvFilter('');
  };

  // Calcul de l'affichage central :
  //   - 'conv'    : conv existante chargée
  //   - 'pending' : on attend que la conv apparaisse dans la liste après envoi
  //   - 'draft'   : on rédige le tout premier message à un nouveau bénéficiaire
  //   - 'empty'   : rien de sélectionné
  const displayMode: 'conv' | 'pending' | 'draft' | 'empty' =
    selectedConv ? 'conv'
    : (selectedConvId && !selectedConv) ? 'pending'
    : draftRecipient ? 'draft'
    : 'empty';

  const currentRecipientName = displayMode === 'conv'
    ? (selectedConv?.jeuneName || 'Bénéficiaire')
    : draftRecipient
      ? (`${draftRecipient.prenom || ''} ${draftRecipient.nom || ''}`.trim() || 'Nouveau bénéficiaire')
      : '';

  const currentRecipientUid = displayMode === 'conv'
    ? selectedConv?.jeuneUid
    : draftRecipient?.uid || null;

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 130px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px', margin: 0 }}>
            Messagerie
          </h2>
          <div style={{ fontSize: 11.5, color: 'var(--premium-text-4)', marginTop: 3 }}>
            {conversations.length} conversation{conversations.length > 1 ? 's' : ''} active{conversations.length > 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={() => setShowNewConv(s => !s)} className="btn-gradient" style={{
          padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouvelle conversation
        </button>
      </div>

      {/* Layout : liste à gauche, chat à droite */}
      <div style={{
        display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14,
        flex: 1, minHeight: 0,
      }}>
        {/* === Liste conversations === */}
        <div style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.7)',
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {showNewConv && (
            <div style={{
              padding: '12px 14px',
              background: 'linear-gradient(135deg, rgba(127,73,151,0.04), rgba(232,67,147,0.04))',
              borderBottom: '1px solid rgba(15,15,15,0.06)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--premium-text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
                Choisir un bénéficiaire
              </div>
              <input value={newConvFilter} onChange={e => setNewConvFilter(e.target.value)}
                placeholder="Rechercher un bénéficiaire…"
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px solid rgba(15,15,15,0.10)', background: '#fff',
                  fontSize: 12, fontFamily: 'inherit', color: 'var(--premium-text)', outline: 'none',
                  marginBottom: 8,
                }} />
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {eligibleUsers.length === 0 ? (
                  <div style={{ padding: 8, fontSize: 11, color: 'var(--premium-text-4)', textAlign: 'center' }}>
                    Aucun bénéficiaire disponible
                  </div>
                ) : eligibleUsers.map(u => (
                  <button key={u.uid} onClick={() => handleSelectUserForNewConv(u.uid!, u.prenom, u.nom)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 9px', borderRadius: 8,
                      background: '#fff', border: '1px solid rgba(15,15,15,0.06)',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(127,73,151,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: 'linear-gradient(135deg, #7f4997, #E84393)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>{getInitials(`${u.prenom || ''} ${u.nom || ''}`)}</div>
                    <span style={{ fontSize: 12, color: 'var(--premium-text)', fontWeight: 500 }}>
                      {u.prenom} {u.nom}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Pin du draft en cours (utilisateur sélectionné mais pas encore de conv en BDD) */}
            {draftRecipient && (
              <div style={{
                padding: '12px 14px',
                background: selectedConvId
                  ? 'linear-gradient(135deg, rgba(127,73,151,0.06), rgba(232,67,147,0.06))'
                  : 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))',
                borderLeft: '3px solid #E84393',
                borderBottom: '1px solid rgba(15,15,15,0.04)',
                display: 'flex', alignItems: 'center', gap: 11,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #7f4997, #E84393)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11.5, fontWeight: 700, flexShrink: 0,
                }}>{getInitials(`${draftRecipient.prenom || ''} ${draftRecipient.nom || ''}`)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.1px' }}>
                    {draftRecipient.prenom} {draftRecipient.nom}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 2 }}>
                    {selectedConvId ? 'Envoi en cours…' : 'Brouillon — pas encore envoyé'}
                  </div>
                </div>
                {!selectedConvId && (
                  <button onClick={() => setDraftRecipient(null)}
                    title="Annuler"
                    style={{
                      width: 22, height: 22, borderRadius: 7,
                      background: 'rgba(15,15,15,0.06)', border: 'none',
                      color: 'var(--premium-text-3)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, lineHeight: 1, padding: 0,
                    }}>×</button>
                )}
              </div>
            )}

            {loadingConvs && conversations.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 12 }}>
                Chargement…
              </div>
            ) : conversations.length === 0 && !draftRecipient ? (
              <div style={{ padding: 30, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--premium-text)' }}>
                  Aucune conversation
                </div>
                <div style={{ fontSize: 11, color: 'var(--premium-text-4)', marginTop: 4 }}>
                  Démarre-en une avec « Nouvelle conversation » en haut à droite.
                </div>
              </div>
            ) : conversations.map(c => (
              <ConversationRow key={c.id} conv={c}
                isSelected={selectedConvId === c.id}
                onClick={() => { setDraftRecipient(null); setSelectedConvId(c.id); }}
              />
            ))}
          </div>
        </div>

        {/* === Chat (ou appel vidéo inline si actif) === */}
        <div style={{
          background: activeCall ? '#0f0f0f' : 'rgba(255,255,255,0.55)',
          backdropFilter: activeCall ? 'none' : 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: activeCall ? 'none' : 'blur(28px) saturate(140%)',
          border: activeCall ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.7)',
          borderRadius: 16,
          boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 6px 22px rgba(15,15,15,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {activeCall ? (
            <InlineVideoCall />
          ) : displayMode === 'empty' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState
                iconKind="calendar"
                title="Sélectionne une conversation"
                description="Choisis un bénéficiaire à gauche pour ouvrir la discussion."
              />
            </div>
          ) : (
            <>
              {/* Header chat */}
              <div style={{
                padding: '13px 18px',
                borderBottom: '1px solid rgba(15,15,15,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #7f4997, #E84393)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>{getInitials(currentRecipientName)}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.2px' }}>
                      {currentRecipientName}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--premium-text-4)', marginTop: 1 }}>
                      {displayMode === 'draft' ? 'Nouvelle conversation' : displayMode === 'pending' ? 'Synchronisation…' : 'Demandeur d’emploi'}
                    </div>
                  </div>
                </div>
                {currentRecipientUid && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* Bouton appel audio */}
                    {displayMode === 'conv' && !activeCall && (
                      <button onClick={() => setShowAudioCallConfirm(true)}
                        title="Démarrer un appel audio"
                        style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.08)',
                          color: 'var(--premium-text-2)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0,
                          transition: 'background .12s, color .12s, border-color .12s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))';
                          e.currentTarget.style.color = '#E84393';
                          e.currentTarget.style.borderColor = 'rgba(232,67,147,0.30)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(15,15,15,0.04)';
                          e.currentTarget.style.color = 'var(--premium-text-2)';
                          e.currentTarget.style.borderColor = 'rgba(15,15,15,0.08)';
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </button>
                    )}
                    {/* Bouton appel vidéo */}
                    {displayMode === 'conv' && !activeCall && (
                      <button onClick={() => setShowCallConfirm(true)}
                        title="Démarrer un appel vidéo"
                        style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.08)',
                          color: 'var(--premium-text-2)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0,
                          transition: 'background .12s, color .12s, border-color .12s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(127,73,151,0.10), rgba(232,67,147,0.10))';
                          e.currentTarget.style.color = '#E84393';
                          e.currentTarget.style.borderColor = 'rgba(232,67,147,0.30)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(15,15,15,0.04)';
                          e.currentTarget.style.color = 'var(--premium-text-2)';
                          e.currentTarget.style.borderColor = 'rgba(15,15,15,0.08)';
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      </button>
                    )}
                    <button onClick={() => openProfile(currentRecipientUid)}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: 'rgba(15,15,15,0.04)', border: '1px solid rgba(15,15,15,0.08)',
                        color: 'var(--premium-text-2)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}>Voir fiche →</button>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div ref={scrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '18px 22px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {(() => {
                  // En mode draft, on affiche le message optimiste si présent
                  if (displayMode === 'draft' && pendingDraftMessage) {
                    return (
                      <>
                        <DayDivider label={dayLabel(new Date().toISOString())} />
                        <MessageBubble isMine={true} text={pendingDraftMessage} time={formatBubbleTime(new Date().toISOString())} pending />
                      </>
                    );
                  }
                  if (displayMode === 'draft') {
                    return (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 30 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--premium-text)', letterSpacing: '-0.3px', marginBottom: 6 }}>
                            Nouveau message à {(draftRecipient?.prenom || 'ce bénéficiaire').split(' ')[0]}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--premium-text-4)', maxWidth: 380, lineHeight: 1.5 }}>
                            Écris ton message ci-dessous. La conversation sera créée à l&apos;envoi.
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (displayMode === 'pending') {
                    if (pendingDraftMessage) {
                      return (
                        <>
                          <DayDivider label={dayLabel(new Date().toISOString())} />
                          <MessageBubble isMine={true} text={pendingDraftMessage} time={formatBubbleTime(new Date().toISOString())} pending />
                        </>
                      );
                    }
                    return (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: 'var(--premium-text-4)' }}>Synchronisation…</div>
                      </div>
                    );
                  }
                  if (loadingMsgs && messages.length === 0) {
                    return <div style={{ textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 12, padding: 20 }}>Chargement…</div>;
                  }
                  if (messages.length === 0) {
                    return <div style={{ textAlign: 'center', color: 'var(--premium-text-4)', fontSize: 12, padding: 40 }}>Aucun message. Envoie-en un pour démarrer.</div>;
                  }
                  // Affichage normal avec séparateurs de date
                  return messages.map((m, i) => {
                    const isMine = m.senderType === 'conseiller';
                    const prev = i > 0 ? messages[i - 1] : null;
                    const showDay = !prev || dayLabel(m.createdAt) !== dayLabel(prev.createdAt);
                    return (
                      <Fragment key={m.id}>
                        {showDay && <DayDivider label={dayLabel(m.createdAt)} />}
                        <MessageBubble
                          isMine={isMine}
                          text={m.text}
                          time={formatBubbleTime(m.createdAt)}
                          pending={m.id.startsWith('temp_')}
                          mediaUrl={m.mediaUrl ?? null}
                          mediaType={m.mediaType ?? null}
                          mediaName={m.mediaName ?? null}
                        />
                      </Fragment>
                    );
                  });
                })()}
              </div>

              {/* === Input bar style iMessage === */}
              <input ref={fileInputRef} type="file" onChange={onFileSelected} style={{ display: 'none' }} />
              <div style={{
                borderTop: '1px solid rgba(15,15,15,0.06)',
                padding: '10px 12px',
                display: 'flex', gap: 8, alignItems: 'flex-end',
                position: 'relative',
              }}>
                {/* + bouton fichier — ouvre un menu */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button onClick={() => { setShowAttachMenu(s => !s); }}
                    title="Ajouter"
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: showAttachMenu ? 'rgba(15,15,15,0.10)' : 'rgba(15,15,15,0.06)',
                      border: 'none', color: 'var(--premium-text-2)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 400, lineHeight: 1, padding: 0,
                      transition: 'background .12s, transform .12s',
                      transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)',
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ width: 16, height: 16 }}>
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  {showAttachMenu && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0,
                      marginBottom: 8,
                      background: '#fff',
                      border: '1px solid rgba(15,15,15,0.10)',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(15,15,15,0.12)',
                      padding: 4,
                      zIndex: 10,
                      minWidth: 180,
                    }}>
                      <button onClick={() => { fileInputRef.current?.click(); }}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: '9px 12px', borderRadius: 8,
                          background: 'transparent', border: 'none',
                          fontSize: 12.5, fontFamily: 'inherit',
                          color: 'var(--premium-text)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 9,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(15,15,15,0.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, color: 'var(--premium-text-3)' }}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        Ajouter un fichier
                      </button>
                    </div>
                  )}
                </div>

                {/* Textarea */}
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder={displayMode === 'draft'
                      ? `Message à ${draftRecipient?.prenom || 'ce bénéficiaire'}…`
                      : 'Message'}
                    rows={1}
                    style={{
                      flex: 1, resize: 'none',
                      padding: '8px 70px 8px 14px',
                      borderRadius: 18,
                      border: '1px solid rgba(15,15,15,0.10)',
                      background: '#fff',
                      fontSize: 13, fontFamily: 'inherit',
                      color: 'var(--premium-text)', outline: 'none',
                      minHeight: 34, maxHeight: 220,
                      lineHeight: 1.45,
                      overflowY: 'auto',
                    }}
                  />
                  {/* Actions internes au textarea : micro + emoji + envoi */}
                  <div style={{
                    position: 'absolute', right: 6, bottom: 4,
                    display: 'flex', gap: 2, alignItems: 'center',
                  }}>
                    <button onClick={toggleDictation}
                      title={isListening ? 'Arrêter la dictée' : 'Dicter un message'}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: isListening ? 'rgba(232,67,147,0.15)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isListening ? '#E84393' : 'var(--premium-text-3)',
                        padding: 0,
                      }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    {draft.trim() && (
                      <button onClick={handleSend}
                        title="Envoyer"
                        style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #7f4997, #E84393)',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', padding: 0, marginLeft: 2,
                        }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      </div>
      {/* Modale de confirmation d'appel vidéo */}
      <ConfirmDialog
        open={showCallConfirm}
        title="Démarrer un appel vidéo ?"
        message={`${(selectedConv?.jeuneName || 'Le bénéficiaire').split(' ')[0]} sera notifié·e et pourra rejoindre depuis son téléphone.`}
        confirmLabel="Démarrer l'appel"
        cancelLabel="Annuler"
        variant="primary"
        onConfirm={() => handleStartCall(false)}
        onCancel={() => setShowCallConfirm(false)}
      />
      {/* Modale de confirmation d'appel audio */}
      <ConfirmDialog
        open={showAudioCallConfirm}
        title="Démarrer un appel audio ?"
        message={`${(selectedConv?.jeuneName || 'Le bénéficiaire').split(' ')[0]} sera notifié·e et pourra rejoindre depuis son téléphone.`}
        confirmLabel="Démarrer l'appel"
        cancelLabel="Annuler"
        variant="primary"
        onConfirm={() => handleStartCall(true)}
        onCancel={() => setShowAudioCallConfirm(false)}
      />
    </div>
  );
}

// === Sub-component : ligne de conversation dans la liste ===
function ConversationRow({ conv, isSelected, onClick }: {
  conv: BackendConversation; isSelected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '12px 14px',
        background: isSelected
          ? 'linear-gradient(135deg, rgba(127,73,151,0.08), rgba(232,67,147,0.08))'
          : 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(15,15,15,0.04)',
        borderLeft: isSelected ? '3px solid #E84393' : '3px solid transparent',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', gap: 11, alignItems: 'flex-start',
        transition: 'background .12s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(127,73,151,0.04)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'linear-gradient(135deg, #7f4997, #E84393)',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11.5, fontWeight: 700, flexShrink: 0,
      }}>{getInitials(conv.jeuneName)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--premium-text)', letterSpacing: '-0.1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conv.jeuneName || 'Bénéficiaire'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--premium-text-4)', flexShrink: 0 }}>
            {formatTime(conv.lastMessageAt)}
          </span>
        </div>
        <div style={{
          fontSize: 11.5,
          color: conv.unreadByConseiller > 0 ? 'var(--premium-text-2)' : 'var(--premium-text-4)',
          fontWeight: conv.unreadByConseiller > 0 ? 600 : 400,
          marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {conv.lastSenderType === 'conseiller' && <span style={{ color: 'var(--premium-text-4)', fontWeight: 400 }}>Toi : </span>}
          {conv.lastMessage}
        </div>
      </div>
      {conv.unreadByConseiller > 0 && (
        <div style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
          background: 'linear-gradient(135deg, #7f4997, #E84393)',
          color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 5px rgba(232,67,147,0.25)',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>{conv.unreadByConseiller > 99 ? '99+' : conv.unreadByConseiller}</div>
      )}
    </button>
  );
}

// === Séparateur de jour façon WhatsApp ===
function DayDivider({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '14px 0 6px',
      gap: 10,
    }}>
      <div style={{
        background: 'rgba(15,15,15,0.05)',
        color: 'var(--premium-text-3)',
        fontSize: 10.5, fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 10,
        textTransform: 'capitalize',
      }}>{label}</div>
    </div>
  );
}

// Helper : télécharge une PJ (force download, ne s'ouvre pas dans le navigateur).
// On passe par fetch → blob → object URL → <a download> pour bypass le fait
// que Firebase Storage est cross-origin et ignore l'attribut "download" natif.
async function downloadAttachment(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[downloadAttachment]', e);
    // Fallback : ouvrir dans un nouvel onglet
    window.open(url, '_blank');
  }
}

function fileEmojiForType(mime?: string | null): string {
  if (!mime) return '📎';
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('video/')) return '🎥';
  if (mime.startsWith('audio/')) return '🎙️';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📎';
}

function humanFileType(mime?: string | null): string {
  if (!mime) return 'Fichier';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('video/')) return 'Vidéo';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.includes('word') || mime.includes('document')) return 'Document Word';
  if (mime.includes('sheet') || mime.includes('excel')) return 'Tableur';
  if (mime === 'text/plain') return 'Texte';
  return 'Fichier';
}

// === Bulle de message — timestamp inline façon WhatsApp + carte d'appel ===
function MessageBubble({ isMine, text, time, pending, mediaUrl, mediaType, mediaName }: {
  isMine: boolean;
  text: string;
  time: string;
  pending?: boolean;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
}) {
  const stamp = pending ? 'envoi…' : time;
  const hasImage = !!mediaUrl && (mediaType || '').startsWith('image/');
  const hasFile = !!mediaUrl && !hasImage;

  // Si c'est un récap d'appel ("📹 Appel vidéo · 3 min 45 s"), on affiche
  // une carte compacte au lieu d'une bulle texte classique.
  const callSummary = parseCallSummary(text);
  if (callSummary) {
    const Icon = callSummary.kind === 'video' ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
    return (
      <div style={{
        display: 'flex',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
      }}>
        <div style={{
          maxWidth: '72%',
          padding: '10px 14px',
          borderRadius: 16,
          background: 'rgba(15,15,15,0.04)',
          border: '1px solid rgba(15,15,15,0.06)',
          display: 'flex', alignItems: 'center', gap: 11,
          opacity: pending ? 0.65 : 1,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7f4997, #E84393)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{Icon}</div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--premium-text)', letterSpacing: '-0.1px', lineHeight: 1.2 }}>
              {callSummary.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--premium-text-4)', marginTop: 2, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
              {callSummary.duration} · {stamp}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isMine ? 'flex-end' : 'flex-start',
      gap: 6,
    }}>
      {/* Image inline */}
      {hasImage && mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ display: 'block', maxWidth: '72%' }}>
          <img
            src={mediaUrl}
            alt={mediaName || 'Photo'}
            style={{
              maxWidth: 280,
              maxHeight: 280,
              borderRadius: 14,
              display: 'block',
              opacity: pending ? 0.65 : 1,
            }}
          />
        </a>
      )}

      {/* Carte fichier non-image — bulle + bouton téléchargement à côté */}
      {hasFile && mediaUrl && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexDirection: isMine ? 'row-reverse' : 'row',
          maxWidth: '80%',
        }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderRadius: 14,
              background: isMine ? 'rgba(15,15,15,0.05)' : 'rgba(15,15,15,0.025)',
              color: 'var(--premium-text)',
              opacity: pending ? 0.65 : 1,
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(15,15,15,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>{fileEmojiForType(mediaType)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mediaName || 'Fichier'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--premium-text-4)', marginTop: 2 }}>
                {humanFileType(mediaType)} · {stamp}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => downloadAttachment(mediaUrl, mediaName || 'fichier')}
            title="Télécharger"
            aria-label="Télécharger"
            style={{
              flexShrink: 0,
              border: 'none',
              background: 'rgba(15,15,15,0.06)',
              color: 'var(--premium-text)',
              borderRadius: '50%',
              width: 34, height: 34,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,15,15,0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,15,15,0.06)'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      )}

      {/* Bulle texte (si du texte est présent — peut être combiné avec une photo) */}
      {text && (
        <div style={{
          maxWidth: '72%',
          padding: '10px 14px 9px',
          borderRadius: 16,
          background: isMine ? 'rgba(15,15,15,0.05)' : 'rgba(15,15,15,0.025)',
          color: 'var(--premium-text)',
          fontSize: 14, lineHeight: 1.6,
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          opacity: pending ? 0.65 : 1,
        }}>
          <span style={{
            float: 'right',
            fontSize: 9.5,
            color: 'var(--premium-text-4)',
            marginLeft: 10,
            marginTop: 5,
            fontVariantNumeric: 'tabular-nums',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}>{stamp}</span>
          {text}
        </div>
      )}

      {/* Pour une image seule (sans texte), on ajoute un timestamp en dessous */}
      {hasImage && !text && (
        <span style={{
          fontSize: 10, color: 'var(--premium-text-4)',
          fontVariantNumeric: 'tabular-nums',
          padding: '0 6px',
        }}>{stamp}</span>
      )}
    </div>
  );
}
