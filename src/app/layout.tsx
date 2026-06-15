import type { Metadata } from 'next';
import { Geist_Mono, Geist } from 'next/font/google';
import './globals.css';
import { HangarProvider } from '@/components/HangarProvider';
import { Shell } from '@/components/Shell';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'The Hangar',
  description: 'Fleet command for Patrick MacLyman. Every rig, radio, and acquisition — racked, statused, and mission-assigned.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <HangarProvider>
          <Shell>{children}</Shell>
        </HangarProvider>
        <div className="crt-overlay" aria-hidden />
      </body>
    </html>
  );
}
