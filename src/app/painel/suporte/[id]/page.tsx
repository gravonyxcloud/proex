import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SupportReplyForm } from '@/components/panel/support-reply-form';
import { ChatThread } from '@/components/support/chat-thread';
import { catLabel, relativeTime, StatusPill } from '@/components/support/ticket-status';
import { createClient } from '@/lib/supabase/server';
import { getSignedSupportAttachments } from '@/lib/support-attachments';
import type { SupportAttachment, SupportMessage, SupportTicket } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ticket' };

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', params.id).maybeSingle();
  if (!ticket) notFound();
  if (ticket.customer_id && ticket.customer_id !== user.id) notFound();

  // RLS já esconde notas internas; o filtro explícito é uma segunda barreira.
  const { data: messages } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticket.id)
    .eq('internal_note', false)
    .order('created_at', { ascending: true });

  const t = ticket as SupportTicket;
  const msgs = (messages ?? []) as SupportMessage[];

  const msgAttachments = await Promise.all(
    msgs.map((m) =>
      Array.isArray(m.attachments) && m.attachments.length > 0
        ? getSignedSupportAttachments(m.attachments)
        : Promise.resolve([] as SupportAttachment[]),
    ),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/painel/suporte" className="hover:text-foreground">
          Suporte
        </Link>
        <span aria-hidden>/</span>
        <span className="font-mono">{t.ticket_number}</span>
      </div>

      <header className="surface px-5 py-4">
        <h1 className="font-display text-lg font-semibold">{t.subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <StatusPill status={t.status} viewer="customer" />
          <span>{catLabel(t.category)}</span>
          <span aria-hidden>·</span>
          <time dateTime={t.created_at}>aberto {relativeTime(t.created_at)}</time>
        </div>
      </header>

      <section className="surface overflow-hidden">
        <ChatThread
          messages={msgs}
          viewer="customer"
          attachments={msgAttachments}
          emptyLabel="Nenhuma mensagem ainda."
        />
      </section>

      <SupportReplyForm ticketId={t.id} disabled={t.status === 'closed'} />
    </div>
  );
}
