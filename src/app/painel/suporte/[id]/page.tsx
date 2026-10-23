import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SupportReplyForm } from '@/components/panel/support-reply-form';
import { createClient } from '@/lib/supabase/server';
import { getSignedSupportAttachments } from '@/lib/support-attachments';
import type { SupportAttachment, SupportMessage, SupportTicket } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ticket' };

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

function senderLabel(type: string) {
  if (type === 'agent') return 'Suporte (Proex)';
  if (type === 'system') return 'Sistema';
  return 'Você';
}

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!ticket) notFound();
  // garantir que é do cliente
  if (ticket.customer_id && ticket.customer_id !== user.id) notFound();

  const { data: messages } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticket.id)
    .eq('internal_note', false)
    .order('created_at', { ascending: true });

  const t = ticket as SupportTicket;
  const msgs = (messages ?? []) as SupportMessage[];

  // O bucket é privado: resolve signed URL (1h) por mensagem a cada render.
  const msgAttachments = await Promise.all(
    msgs.map((m) =>
      Array.isArray(m.attachments) && m.attachments.length > 0
        ? getSignedSupportAttachments(m.attachments)
        : Promise.resolve([] as SupportAttachment[]),
    ),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{t.ticket_number}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(t.status)}`}>
              {statusLabel(t.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.subject}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Aberto em {new Date(t.created_at).toLocaleString('pt-BR')}
          </p>
        </div>
        <Link href="/painel/suporte" className="btn-ghost">
          ← Voltar para tickets
        </Link>
      </header>

      {Array.isArray(t.context_snapshot) && t.context_snapshot.length > 0 && (
        <section className="surface p-5">
          <h2 className="text-sm font-semibold">Contexto da conta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Capturado na abertura do ticket para agilizar a análise.
          </p>
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

      <section className="surface">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Conversa</h2>
        </div>
        <div className="divide-y divide-border">
          {msgs.length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
          ) : (
            msgs.map((m, mi) => (
              <article
                key={m.id}
                className={`px-6 py-5 ${m.sender_type === 'agent' ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{senderLabel(m.sender_type)}</span>
                    {m.sender_type === 'agent' && (
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
                {msgAttachments[mi]?.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                    {msgAttachments[mi].map((a, i) => (
                      <li key={a.path || i}>
                        {a.url ? (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-primary hover:bg-primary/10"
                          >
                            {a.type.startsWith('image/') ? '🖼' : a.type === 'application/pdf' ? '📄' : '📎'}
                            <span className="max-w-[24ch] truncate">{a.name}</span>
                          </a>
                        ) : (
                          <span className="rounded-lg border border-border px-2 py-1 text-muted-foreground">
                            {a.name}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <SupportReplyForm ticketId={t.id} disabled={t.status === 'closed'} />
    </div>
  );
}
