import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

import { ToastProvider } from '@/components/ui/toaster';
import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://proex.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Proex — Claude Code ilimitado por API',
    template: '%s · Proex',
  },
  description:
    'Acesso por API para usar o Claude Code no seu computador. Planos por período com uso ilimitado e política de uso justo de 80 milhões de tokens por hora. Pague com PIX ou cartão e receba a chave na hora.',
  keywords: [
    'Claude Code',
    'API Claude Code',
    'acesso por API',
    'claude code ilimitado',
    'proex',
    'PIX',
    'tokens por hora',
  ],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Proex',
    title: 'Proex — Claude Code ilimitado por API',
    description:
      'Planos por período, uso ilimitado, 80 milhões de tokens por hora. PIX ou cartão, chave liberada na aprovação.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Proex — Claude Code ilimitado por API',
    description:
      'Planos por período, uso ilimitado, 80 milhões de tokens por hora. PIX ou cartão, chave liberada na aprovação.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#e8763a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
