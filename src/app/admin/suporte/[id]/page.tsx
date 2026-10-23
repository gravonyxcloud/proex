import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminReplyForm, AdminStatusForm } from '@/components/admin/ticket-forms';
import { createClient } from '@/lib/supabase/server';
import type { SupportMessage, SupportTicket } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atender ticket | Admin' };

function statusLabel(s: string) {
  switch (s) {
    case 'open':
      return 'Aberto';
    case 'in_progress':
      return 'Em atendimento';
    case 'waiting_customer':
      return 'Aguardando cliente';
    case 'resolved':
      return 'Resolvido';
    case 'closed':
      return 'Fechado';
    default:
      return s;
  }
}

function senderLabel(type: string) {
  if (type === 'agent') return 'Suporte (Proex)';
  if (type === 'system') return 'Sistema / Nota interna';
  return 'Cliente';
}

export default async function AdminTicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return null;

  const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', params.id).maybeSingle();
  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true });

  const t = ticket as SupportTicket;
  const msgs = (messages ?? []) as SupportMessage[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{t.ticket_number}</h1>
            <span className="rounded-full border px-2 py-0.5 text-xs">{statusLabel(t.status)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.subject}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cliente: {t.customer_email} · Aberto em {new Date(t.created_at).toLocaleString('pt-BR')}
          </p>
        </div>
        <Link href="/admin/suporte" className="btn-ghost">
          ← Voltar para fila
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="surface">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold">Conversa (inclui notas internas)</h2>
            </div>
            <div className="divide-y divide-border">
              {msgs.length === 0 ? (
                <p className="px-6 py-6 text-sm text-muted-foreground">Sem mensagens.</p>
              ) : (
                msgs.map((m) => (
                  <article
                    key={m.id}
                    className={`px-6 py-5 ${m.internal_note ? 'bg-amber-500/5' : m.sender_type === 'agent' ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{senderLabel(m.sender_type)}</span>
                        {m.internal_note && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                            Nota interna
                          </span>
                        )}
                        {m.sender_type === 'agent' && !m.internal_note && (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            Atendente
                          </span>
                        )}
                      </div>
                      <time className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString('pt-BR')}
                      </time>
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{m.message}</div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="surface p-6">
            <h2 className="text-sm font-semibold">Responder ao cliente</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ao responder sem marcar &quot;nota interna&quot;, o status vira &quot;Aguardando cliente&quot;.
            </p>
            <AdminReplyForm ticketId={t.id} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-sm font-semibold">Gerenciar ticket</h2>
            <AdminStatusForm ticketId={t.id} status={t.status} priority={t.priority} />
          </section>

          {Array.isArray(t.context_snapshot) && t.context_snapshot.length > 0 && (
            <section className="surface p-6">
              <h2 className="text-sm font-semibold">Contexto da conta</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {t.context_snapshot.map((c: any, i: number) => (
                  <li key={i} className="rounded-lg border border-border px-3 py-2">
                    <div className="font-medium">{c.label}</div>
                    {c.detail && <div className="mt-0.5 text-xs text-muted-foreground">{c.detail}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="surface p-6">
            <h2 className="text-sm font-semibold">Dados</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Categoria</dt>
                <dd>{t.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Criado em</dt>
                <dd>{new Date(t.created_at).toLocaleString('pt-BR')}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Última mensagem</dt>
                <dd>{new Date(t.last_message_at).toLocaleString('pt-BR')}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
