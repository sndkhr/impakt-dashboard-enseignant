'use client';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="fi" style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '60px 40px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-900)', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-400)' }}>
        Cette section sera migrée dans la prochaine étape.
      </div>
    </div>
  );
}
