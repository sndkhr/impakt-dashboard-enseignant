'use client';

export default function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="progress-text">{value}%</span>
    </div>
  );
}
