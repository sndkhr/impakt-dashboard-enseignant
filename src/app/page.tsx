'use client';

import { AuthProvider } from '@/lib/auth';
import { NavProvider } from '@/lib/navigation';
import { ModalsProvider } from '@/lib/modals';
import App from '@/components/App';

export default function Page() {
  return (
    <AuthProvider>
      <NavProvider>
        <ModalsProvider>
          <App />
        </ModalsProvider>
      </NavProvider>
    </AuthProvider>
  );
}
