import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminReplyForm, AdminStatusForm } from '@/components/admin/ticket-forms';
import { ChatThread } from '@/components/support/chat-thread';
import { catLabel, relativeTime, StatusPill } from '@/components/support/ticket-status';
import { createClient } from '@/lib/supabase/server';
import { getSignedSupportAttachments } from '@/lib/support-attachments';
import type { SupportAttachment, SupportMessage, SupportTicket } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atender ticket | Admin' };

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

  // Bucket privado: signed URLs (1h) por render, em lote.
  const msgAttachments = await Promise.all(
    msgs.map((m) =>
      Array.isArray(m.attachments) && m.attachments.length > 0
        ? getSignedSupportAttachments(m.attachments)
        : Promise.resolve([] as SupportAttachment[]),
    ),
  );

  const temAnexo = msgAttachments.some((x) => x.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/admin/suporte" className="hover:text-foreground">
          Suporte
        </Link>
        <span aria-hidden>/</span>
        <span className="font-mono">{t.ticket_number}</span>
      </div>

      <header className="surface flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold">{t.subject}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <StatusPill status={t.status} />
            <span>{catLabel(t.category)}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{t.customer_email}</span>
            <span aria-hidden>·</span>
            <time dateTime={t.created_at}>aberto {relativeTime(t.created_at)}</time>
          </div>
        </div>

        {!t.ai_enabled && t.ai_handoff_at && (
          <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs">
            <p className="font-medium text-amber-300">IA pausada neste ticket</p>
            <p className="mt-0.5 max-w-[34ch] text-muted-foreground">
              {t.ai_handoff_reason ?? 'Motivo não registrado.'}
            </p>
          </div>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="surface flex min-h-[60vh] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Conversa</h2>
            <span className="text-[11px] text-muted-foreground">
              {msgs.length} {msgs.length === 1 ? 'mensagem' : 'mensagens'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <ChatThread
              messages={msgs}
              viewer="admin"
              attachments={msgAttachments}
              emptyLabel="O cliente ainda não escreveu."
            />
          </div>

          <AdminReplyForm ticketId={t.id} />
        </section>

        <aside className="space-y-5">
          <section className="surface p-5">
            <h2 className="text-sm font-semibold">Gerenciar</h2>
            <AdminStatusForm ticketId={t.id} status={t.status} priority={t.priority} />
          </section>

          <section className="surface p-5">
            <h2 className="text-sm font-semibold">Contexto da conta</h2>
            {Array.isArray(t.context_snapshot) && t.context_snapshot.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {t.context_snapshot.map((c, i) => (
                  <li key={c.id ?? i} className="rounded-lg border border-border px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {c.type === 'license' ? 'Licença' : 'Pedido'}
                    </div>
                    <div className="mt-0.5 text-xs font-medium">{c.label}</div>
                    {c.detail && <div className="mt-0.5 text-[11px] text-muted-foreground">{c.detail}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Sem licenças ou pedidos vinculados — conta sem histórico de compra.
              </p>
            )}
          </section>

          <section className="surface p-5">
            <h2 className="text-sm font-semibold">Detalhes</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Prioridade</dt>
                <dd>{t.priority}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Anexos</dt>
                <dd>{temAnexo ? 'sim' : 'nenhum'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Última mensagem</dt>
                <dd>{relativeTime(t.last_message_at)}</dd>
              </div>
              {t.ai_last_reply_at && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Última resposta da IA</dt>
                  <dd>{relativeTime(t.ai_last_reply_at)}</dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
