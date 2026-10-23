import Link from 'next/link';

import { SupportForm } from '@/components/panel/support-form';
import { createClient } from '@/lib/supabase/server';
import type { SupportTicket } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suporte' };

function statusLabel(s: string) {
  switch (s) {
    case 'open':
      return 'Aberto';
    case 'in_progress':
      return 'Em atendimento';
    case 'waiting_customer':
      return 'Aguardando sua resposta';
    case 'resolved':
      return 'Resolvido';
    case 'closed':
      return 'Fechado';
    default:
      return s;
  }
}

function statusClass(s: string) {
  switch (s) {
    case 'open':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'in_progress':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'waiting_customer':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'closed':
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }
}

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Suporte</h1>
        <p className="text-sm text-muted-foreground">
          Somente para clientes. Abra um ticket e eu analiso com calma e respondo o mais humano possível.
        </p>
      </header>

      <SupportForm />

      <section className="surface">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Meus tickets</h2>
          <p className="mt-1 text-xs text-muted-foreground">Histórico e acompanhamento das conversas.</p>
        </div>
        <div className="divide-y divide-border">
          {(tickets ?? []).length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">Nenhum ticket ainda.</p>
          ) : (
            (tickets as SupportTicket[]).map((t) => (
              <Link
                key={t.id}
                href={`/painel/suporte/${t.id}`}
                className="flex flex-col gap-2 px-6 py-4 transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.ticket_number}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(t.status)}`}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm">{t.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última mensagem: {new Date(t.last_message_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Ver conversa →</span>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
