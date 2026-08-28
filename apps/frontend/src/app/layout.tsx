import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'ReachInbox — Email Scheduler',
  description: 'Schedule and manage email campaigns with ReachInbox',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '10px', fontSize: '14px' },
          }}
        />
      </body>
    </html>
  );
}
