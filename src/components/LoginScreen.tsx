'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { useMagnetic } from '@/lib/motion';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState(false);
  const { login, error, isLoading } = useAuth();
  const submitRef = useRef<HTMLButtonElement>(null);
  const magnetic = useMagnetic(submitRef as React.RefObject<HTMLElement>, { strength: 0.18, radius: 60 });

  const handleLogin = async () => {
    if (!password.trim()) return;
    await login(password.trim());
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(135deg, #fafafa 0%, #f5f3ff 50%, #fdf2f8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, overflow: 'hidden',
      fontFamily: 'var(--font-display)',
    }}>
      {/* Sphères iridescentes */}
      <div className="premium-sphere s1" />
      <div className="premium-sphere s2" />
      <div className="premium-sphere s3" />

      {/* Card glass premium */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 400,
        padding: '38px 36px 32px',
        background: 'rgba(255,255,255,0.68)',
        backdropFilter: 'blur(32px) saturate(150%)',
        WebkitBackdropFilter: 'blur(32px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.85)',
        borderRadius: 24,
        boxShadow: '0 1px 2px rgba(15,15,15,0.03), 0 20px 60px rgba(127,73,151,0.08), 0 8px 28px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}>
        {/* Logo IMPAKT + pill "Dashboard Enseignant" */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <img
              src="/impakt-logo.png"
              alt="Impakt"
              style={{
                width: 64, height: 64, borderRadius: 16,
                objectFit: 'cover',
                boxShadow: '0 8px 24px rgba(127,73,151,0.25), 0 2px 6px rgba(15,15,15,0.10)',
              }}
            />
          </div>
          <span style={{
            fontSize: 9.5, fontWeight: 700,
            color: '#7f4997',
            background: 'rgba(127,73,151,0.10)',
            padding: '4px 10px', borderRadius: 20,
            letterSpacing: '0.6px', textTransform: 'uppercase',
          }}>Dashboard Enseignant</span>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontSize: 24, fontWeight: 700,
            color: '#0a0a0a',
            letterSpacing: '-0.6px',
            marginBottom: 6,
          }}>Bienvenue sur IMPAKT</div>
          <div style={{
            fontSize: 13, fontWeight: 450,
            color: '#525252',
            letterSpacing: '-0.005em',
          }}>Accompagnement de vos élèves</div>
        </div>

        {/* Input label */}
        <label style={{
          display: 'block',
          fontSize: 11, fontWeight: 600,
          color: '#525252',
          marginBottom: 8,
          textTransform: 'uppercase', letterSpacing: '0.4px',
        }}>Clé d&apos;accès</label>

        {/* Input avec focus state */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              width: 16, height: 16,
              color: focused ? '#E84393' : '#a3a3a3',
              transition: 'color .15s ease',
              pointerEvents: 'none',
            }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            type="password"
            placeholder="••••••••••"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '13px 16px 13px 42px',
              border: error
                ? '1.5px solid #dc2626'
                : focused
                  ? '1.5px solid #E84393'
                  : '1px solid rgba(15,15,15,0.08)',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.7)',
              fontFamily: 'inherit', fontSize: 13,
              color: '#0a0a0a', outline: 'none',
              letterSpacing: '0.2px',
              transition: 'border-color .15s ease, box-shadow .15s ease',
              boxShadow: focused
                ? '0 0 0 4px rgba(232,67,147,0.08), inset 0 1px 2px rgba(15,15,15,0.04)'
                : 'inset 0 1px 2px rgba(15,15,15,0.03)',
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            fontSize: 11.5, color: '#dc2626',
            background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.15)',
            padding: '8px 12px', borderRadius: 8,
            marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Submit button avec magnetic hover */}
        <button
          ref={submitRef}
          onClick={handleLogin}
          disabled={isLoading || !password.trim()}
          style={{
            width: '100%',
            padding: '13px',
            border: 'none', borderRadius: 12,
            background: !password.trim()
              ? 'rgba(127,73,151,0.25)'
              : isLoading
                ? 'linear-gradient(135deg, #a387b0, #e693b9)'
                : 'linear-gradient(135deg, #7f4997 0%, #E84393 100%)',
            color: '#fff', fontFamily: 'inherit',
            fontSize: 13.5, fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: (isLoading || !password.trim()) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: password.trim() && !isLoading
              ? '0 4px 14px rgba(232,67,147,0.28), 0 1px 2px rgba(127,73,151,0.12)'
              : 'none',
            transform: (password.trim() && !isLoading) ? magnetic.transform : 'translate(0, 0)',
            transition: magnetic.transition + ', box-shadow .15s ease, background .15s ease',
          }}
        >
          {isLoading ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14, animation: 'spin .6s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Connexion…
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </div>
    </div>
  );
}
