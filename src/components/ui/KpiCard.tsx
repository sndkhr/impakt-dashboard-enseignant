'use client';

interface KpiCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  alert?: boolean;
}

export default function KpiCard({ title, value, suffix, alert }: KpiCardProps) {
  const baseStyle: React.CSSProperties = {
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '16px 20px',
    transition: 'box-shadow .2s',
  };

  const alertStyle: React.CSSProperties = alert
    ? {
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #7f4997, #E84393)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      }
    : {};

  return (
    <div style={{ ...baseStyle, ...alertStyle }}>
      <div style={{ fontSize: '11.5px', color: 'var(--text-500)', fontWeight: 500, marginBottom: 8, lineHeight: 1.3 }}>
        {title}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1,
        ...(alert ? {
          background: 'linear-gradient(135deg, #7f4997, #E84393)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        } : { color: 'var(--text-900)' }),
      }}>
        {value}
        {suffix && (
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-400)', WebkitTextFillColor: 'var(--text-400)' }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
