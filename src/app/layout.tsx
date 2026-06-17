import type { Metadata } from 'next';
import { JetBrains_Mono, Inter, Outfit } from 'next/font/google';
import './globals.css';
import { HangarProvider } from '@/components/HangarProvider';
import { Shell } from '@/components/Shell';

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'The Hangar',
  description: 'Fleet command for Patrick MacLyman. Every rig, radio, and acquisition — racked, statused, and mission-assigned.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable}`}>
      <body>
        <HangarProvider>
          <Shell>{children}</Shell>
        </HangarProvider>
        <div className="crt-overlay" aria-hidden />
      </body>
    </html>
  );
}
