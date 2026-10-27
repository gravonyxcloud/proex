import Link from 'next/link';

import { SupportForm } from '@/components/panel/support-form';
import { catLabel, relativeTime, StatusPill } from '@/components/support/ticket-status';
import { createClient } from '@/lib/supabase/server';
import type { SupportTicket } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suporte' };

export default async function SuportePainelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('customer_id', user.id)
    .order('last_message_at', { ascending: false });

  const list = (tickets ?? []) as SupportTicket[];
  const abertos = list.filter((t) => t.status !== 'closed' && t.status !== 'resolved').length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-xl font-semibold">Suporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {abertos > 0
            ? `${abertos} ${abertos === 1 ? 'ticket em aberto' : 'tickets em aberto'}. Respondo por aqui mesmo.`
            : 'Abra um ticket e respondo por aqui mesmo.'}
        </p>
      </header>

      <SupportForm />

      <section className="surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Meus tickets</h2>
        </div>

        {list.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum ticket ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/painel/suporte/${t.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{t.ticket_number}</span>
                      <StatusPill status={t.status} viewer="customer" />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {catLabel(t.category)} · atualizado {relativeTime(t.last_message_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-primary">Abrir →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
