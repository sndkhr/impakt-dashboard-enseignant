'use client';

import { useState, KeyboardEvent } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const { login, error, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!password.trim()) return;
    await login(password.trim());
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--white)', borderRadius: 20,
        padding: '48px 40px',
        boxShadow: '0 8px 40px rgba(0,0,0,.06)',
        textAlign: 'center',
      }}>
        {/* Brand */}
        <div style={{
          fontSize: 24, fontWeight: 800, letterSpacing: '-0.8px',
          background: 'linear-gradient(135deg, #7f4997, #E84393)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}>
          IMPAKT
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-400)', marginBottom: 36 }}>
          Tableau de bord enseignant
        </div>

        {/* Champ mot de passe */}
        <input
          type="password"
          placeholder="Clé d'accès"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyPress}
          style={{
            width: '100%', padding: '13px 16px',
            background: 'var(--bg)',
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            fontFamily: 'inherit', fontSize: 13,
            color: 'var(--text-900)', outline: 'none',
            marginBottom: 14,
          }}
        />

        {/* Bouton connexion */}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            width: '100%', padding: 13,
            background: 'linear-gradient(135deg, #7f4997, #E84393)',
            border: 'none', borderRadius: 10,
            color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: isLoading ? 'wait' : 'pointer',
            boxShadow: '0 4px 14px rgba(142,68,173,.25)',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Connexion...' : 'Se connecter'}
        </button>

        {/* Erreur */}
        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 14 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
