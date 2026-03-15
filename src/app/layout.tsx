import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'IMPAKT — Tableau de bord enseignant',
  description: 'Dashboard enseignant IMPAKT - Orientation prédictive',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
