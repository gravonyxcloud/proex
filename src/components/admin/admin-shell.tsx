import Link from 'next/link';

import type { ReactNode } from 'react';

const LINKS = [
  { href: '/admin', label: 'Visão geral', icon: '◈' },
  { href: '/admin/clientes', label: 'Clientes', icon: '◉' },
  { href: '/admin/chaves', label: 'Licenças', icon: '⌁' },
  { href: '/admin/planos', label: 'Planos', icon: '▤' },
  { href: '/admin/pagamentos', label: 'Pagamentos', icon: '◫' },
  { href: '/admin/webhooks', label: 'Webhooks', icon: '↯' },
  { href: '/admin/uso', label: 'Consumo', icon: '◔' },
  { href: '/admin/docs', label: 'Docs da API', icon: '⌘' },
] as const;

export function AdminShell({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string;
  descricao: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Administração</p>
          <h1 className="mt-1 text-3xl font-bold">{titulo}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{descricao}</p>
        </div>
        {acao}
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Administração">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <span aria-hidden className="mr-2">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}