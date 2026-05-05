'use client';

import { useState, useCallback } from 'react';

interface FilterState {
  genders: string[];
  ageMin: number;
  ageMax: number;
  eduLevels: string[];
  statuts: string[];
  alertLevels: string[];
}

const DEFAULT_FILTERS: FilterState = {
  genders: [],
  ageMin: 15, ageMax: 26,
  eduLevels: [],
  statuts: [],
  alertLevels: [],
};

function CheckChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label onClick={onChange} style={{
      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      fontSize: '12.5px', padding: '6px 12px',
      border: checked ? '1px solid #1a1a2e' : '1px solid var(--border)',
      borderRadius: 8, transition: 'all .15s', userSelect: 'none',
      background: checked ? '#1a1a2e' : 'var(--white)',
      color: checked ? '#fff' : 'var(--text-700)',
    }}>
      {label}
      {checked && <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.7 }}>✕</span>}
    </label>
  );
}

export default function FilterPanel({ open, onClose, onApply }: {
  open: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
}) {
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });

  const toggleInArray = useCallback((arr: string[], val: string) => {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }, []);

  const handleReset = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const pct = (v: number) => ((v - 15) / (26 - 15)) * 100;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,.2)', zIndex: 100,
        opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
        transition: 'opacity .25s',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 320,
        background: 'rgba(255,255,255,0.55)', boxShadow: '-4px 0 24px rgba(0,0,0,.08)',
        zIndex: 101, transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .3s cubic-bezier(.16,1,.3,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Head */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--premium-text)' }}>Filtres</span>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, color: 'var(--premium-text-3)',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Genre */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--premium-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Genre</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <CheckChip label="Homme" checked={filters.genders.includes('H')} onChange={() => setFilters(f => ({ ...f, genders: toggleInArray(f.genders, 'H') }))} />
              <CheckChip label="Femme" checked={filters.genders.includes('F')} onChange={() => setFilters(f => ({ ...f, genders: toggleInArray(f.genders, 'F') }))} />
            </div>
          </div>

          {/* Âge */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--premium-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Tranche d&apos;âge</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--premium-text)', marginBottom: 8 }}>
              <span>{filters.ageMin} ans</span><span>{filters.ageMax} ans</span>
            </div>
            <div style={{ position: 'relative', height: 18 }}>
              <div style={{ position: 'relative', height: 6, background: '#e5e7eb', borderRadius: 4, margin: '0 8px' }}>
                <div style={{
                  position: 'absolute', height: '100%',
                  background: 'linear-gradient(135deg, #7f4997, #E84393)', borderRadius: 4,
                  left: `${pct(filters.ageMin)}%`, right: `${100 - pct(filters.ageMax)}%`,
                }} />
              </div>
              <input type="range" min="15" max="26" value={filters.ageMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setFilters(f => ({ ...f, ageMin: Math.min(v, f.ageMax) }));
                }}
                style={{ position: 'absolute', top: -6, width: 'calc(100% - 16px)', left: 8, WebkitAppearance: 'none', appearance: 'none', background: 'transparent', pointerEvents: 'none', height: 18 }}
              />
              <input type="range" min="15" max="26" value={filters.ageMax}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setFilters(f => ({ ...f, ageMax: Math.max(v, f.ageMin) }));
                }}
                style={{ position: 'absolute', top: -6, width: 'calc(100% - 16px)', left: 8, WebkitAppearance: 'none', appearance: 'none', background: 'transparent', pointerEvents: 'none', height: 18 }}
              />
            </div>
          </div>

          {/* Niveau d'étude */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--premium-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Niveau d&apos;étude</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { v: 'sans', l: 'Sans diplôme' }, { v: 'cap', l: 'CAP / BEP' }, { v: 'bac', l: 'Bac' },
                { v: 'bac2', l: 'Bac+2' }, { v: 'bac3', l: 'Bac+3' }, { v: 'bac5', l: 'Bac+5' },
              ].map(e => (
                <CheckChip key={e.v} label={e.l} checked={filters.eduLevels.includes(e.v)}
                  onChange={() => setFilters(f => ({ ...f, eduLevels: toggleInArray(f.eduLevels, e.v) }))} />
              ))}
            </div>
          </div>

          {/* Statut parcours */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--premium-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Statut du parcours</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { v: 'n', l: 'Non démarré' }, { v: 'p', l: 'En cours' }, { v: 't', l: 'Terminé' },
              ].map(s => (
                <CheckChip key={s.v} label={s.l} checked={filters.statuts.includes(s.v)}
                  onChange={() => setFilters(f => ({ ...f, statuts: toggleInArray(f.statuts, s.v) }))} />
              ))}
            </div>
          </div>

          {/* Niveau alerte */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--premium-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Niveau de statut</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { v: 'ok', l: 'En bonne voie' }, { v: 'cours', l: 'En cours' }, { v: 'bloque', l: 'Bloqué' },
                { v: 'decroch', l: 'Décrochage' }, { v: 'non', l: 'Non démarré' },
              ].map(a => (
                <CheckChip key={a.v} label={a.l} checked={filters.alertLevels.includes(a.v)}
                  onChange={() => setFilters(f => ({ ...f, alertLevels: toggleInArray(f.alertLevels, a.v) }))} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={handleReset} style={{
            flex: 1, padding: 10, border: '1px solid rgba(255,255,255,0.7)', borderRadius: 8,
            background: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            color: 'var(--premium-text-2)', cursor: 'pointer',
          }}>Réinitialiser</button>
          <button onClick={handleApply} className="btn-gradient" style={{
            flex: 1, padding: 10, borderRadius: 8, fontFamily: 'inherit', fontSize: 12,
            fontWeight: 600, cursor: 'pointer',
          }}>Appliquer</button>
        </div>
      </div>
    </>
  );
}
