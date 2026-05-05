'use client';

import { AuthProvider } from '@/lib/auth';
import { NavProvider } from '@/lib/navigation';
import { ModalsProvider } from '@/lib/modals';
import { ToastProvider } from '@/components/ui/Toast';
import { CommandPaletteProvider } from '@/components/ui/CommandPalette';
import { VideoCallProvider } from '@/lib/videoCall';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import VideoCallWindow from '@/components/messagerie/VideoCallWindow';
import App from '@/components/App';

export default function Page() {
  return (
    <AuthProvider>
      <NavProvider>
        <ModalsProvider>
          <ToastProvider>
            <CommandPaletteProvider>
              <VideoCallProvider>
                <KeyboardShortcuts />
                <App />
                <VideoCallWindow />
              </VideoCallProvider>
            </CommandPaletteProvider>
          </ToastProvider>
        </ModalsProvider>
      </NavProvider>
    </AuthProvider>
  );
}
