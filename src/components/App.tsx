'use client';

import { useAuth } from '@/lib/auth';
import LoginScreen from '@/components/LoginScreen';
import DashboardShell from '@/components/DashboardShell';

export default function App() {
  const { token } = useAuth();

  if (!token) return <LoginScreen />;
  return <DashboardShell />;
}
