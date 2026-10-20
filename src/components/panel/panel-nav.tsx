'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

const LINKS = [
  { href: '/painel', label: 'Início', icon: '◈' },
  { href: '/painel/pagamentos', label: 'Pagamentos', icon: '◫' },
  { href: '/painel/uso', label: 'Uso', icon: '◔' },
  { href: '/painel/suporte', label: 'Suporte', icon: '✉' },
] as const;

export function PanelNav({
  email,
  fullName,
  isAdmin,
}: {
  email: string;
  fullName: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function sair() {
    setBusy(true);
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const nome = fullName || email.split('@')[0];

  return (
    <aside className="flex h-full flex-col gap-6 border-r border-border bg-card/50 p-5 lg:sticky lg:top-0 lg:h-screen">
      <Link href="/" className="flex items-center gap-2.5 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground shadow-glow">
          PX
        </span>
        <span className="font-display text-lg font-semibold">Proex</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5" aria-label="Painel">
        {LINKS.map((l) => {
          const ativo = l.href === '/painel' ? pathname === '/painel' : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${
                ativo
                  ? 'bg-primary/15 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span aria-hidden className="w-4 text-center">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            <span aria-hidden className="w-4 text-center">★</span>
            Administração
          </Link>
        )}
      </nav>

      <div className="border-t border-border pt-4">
        <div className="truncate text-sm font-medium" title={email}>
          {nome}
        </div>
        <div className="truncate text-xs text-muted-foreground" title={email}>
          {email}
        </div>

        <button onClick={sair} disabled={busy} className="btn-ghost btn-sm mt-3 w-full justify-start">
          {busy ? 'Saindo…' : 'Sair da conta'}
        </button>
      </div>
    </aside>
  );
}
