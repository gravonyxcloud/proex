import Link from 'next/link';

import { SITE } from '@/lib/constants';

const NAV = [
  { label: 'Planos', href: '/#planos' },
  { label: 'Como funciona', href: '/#como-funciona' },
  { label: 'Uso justo', href: '/#uso-justo' },
  { label: 'Perguntas', href: '/#faq' },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="section flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label={`${SITE.name} — início`}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground shadow-glow transition group-hover:brightness-110">
            PX
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Proex
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link href="/login" className="btn-ghost btn-sm hidden sm:inline-flex">
            Entrar
          </Link>
          <Link href="/precos" className="btn-primary btn-sm">
            Ver planos
          </Link>
        </div>
      </div>
    </header>
  );
}
