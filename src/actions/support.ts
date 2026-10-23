'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { supportTicketCreateSchema, supportTicketReplySchema } from '@/lib/schemas';
import type { ActionState } from '@/actions/plans';
import type { SupportAttachment, SupportTicketContextItem } from '@/types/db';
import { runSupportAi } from '@/lib/ai/process-support';

async function requireCustomer() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Faça login para abrir um ticket.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'customer') {
    // admin pode até ver, mas o atendimento é feito pelo agente via CLI; não abrir ticket como admin
    // ainda permitir? pedido diz "suporte e somente pra clientes" - bloqueamos admins aqui
    // se precisar, é só ajustar
  }

  if (profile?.role === 'admin') throw new Error('Suporte é para clientes. Use a fila de atendimento no painel admin.');

  return { user, email: user.email ?? '' };
}

export async function createSupportTicket(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState & { ticketId?: string }> {
  try {
    const { user, email } = await requireCustomer();

    const parsed = supportTicketCreateSchema.safeParse({
      subject: formData.get('subject'),
      category: formData.get('category'),
      message: formData.get('message'),
    });

    if (!parsed.success) return { ok: false, message: parsed.error.errors[0].message };

    const supabase = createClient();
    const admin = createAdminClient();

    // snapshot de contexto (licenças e pedidos) pra eu analisar sem perguntar
    const [licRes, ordRes] = await Promise.all([
      supabase
        .from('licenses')
        .select('id, plan_slug, status, key_hint, expires_at, issued_at')
        .eq('customer_id', user.id)
        .order('issued_at', { ascending: false })
        .limit(10),
      supabase
        .from('orders')
        .select('id, external_reference, plan_slug, amount_brl, status, created_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const context: SupportTicketContextItem[] = [
      ...(licRes.data ?? []).map((l: any) => ({
        type: 'license' as const,
        id: l.id,
        label: `chave ${l.key_hint} · ${l.plan_slug} · ${l.status}`,
        detail: `emitida ${l.issued_at} · vence ${l.expires_at}`,
      })),
      ...(ordRes.data ?? []).map((o: any) => ({
        type: 'order' as const,
        id: o.id,
        label: `pedido ${o.external_reference} · ${o.plan_slug} · ${o.status}`,
        detail: `R$ ${Number(o.amount_brl).toFixed(2)} · ${o.created_at}`,
      })),
    ];

    const { data: ticket, error: tErr } = await admin
      .from('support_tickets')
      .insert({
        customer_id: user.id,
        customer_email: email,
        subject: parsed.data.subject,
        category: parsed.data.category,
        status: 'open',
        priority: parsed.data.category === 'reembolso' ? 10 : 0,
        context_snapshot: context,
        last_message_at: new Date().toISOString(),
        last_customer_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (tErr || !ticket) return { ok: false, message: tErr?.message ?? 'Falha ao abrir ticket.' };

    const { error: mErr } = await admin.from('support_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'customer',
      sender_id: user.id,
      message: parsed.data.message,
      attachments: [],
      internal_note: false,
    });

    if (mErr) return { ok: false, message: mErr.message };

    revalidatePath('/painel/suporte');
    revalidatePath('/admin/suporte');
    await runSupportAi(ticket.id);
    return { ok: true, message: 'Ticket aberto. Te respondo assim que analisar.', ticketId: ticket.id };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Erro inesperado.' };
  }
}

export async function replySupportTicket(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user } = await requireCustomer();
    const supabase = createClient();
    const admin = createAdminClient();

    const parsed = supportTicketReplySchema.safeParse({
      ticketId: formData.get('ticketId'),
      message: formData.get('message'),
    });

    if (!parsed.success) return { ok: false, message: parsed.error.errors[0].message };

    // garantir que é dele e não fechado
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, status')
      .eq('id', parsed.data.ticketId)
      .maybeSingle();

    if (!ticket) return { ok: false, message: 'Ticket não encontrado.' };
    if (ticket.status === 'closed') return { ok: false, message: 'Este ticket está fechado.' };

    const now = new Date().toISOString();
    const { error: mErr } = await admin.from('support_messages').insert({
      ticket_id: parsed.data.ticketId,
      sender_type: 'customer',
      sender_id: user.id,
      message: parsed.data.message,
      attachments: [],
      internal_note: false,
    });

    if (mErr) return { ok: false, message: mErr.message };

    await admin
      .from('support_tickets')
      .update({
        status: ticket.status === 'waiting_customer' ? 'open' : ticket.status,
        last_message_at: now,
        last_customer_at: now,
      })
      .eq('id', parsed.data.ticketId);

    revalidatePath('/painel/suporte');
    revalidatePath(`/painel/suporte/${parsed.data.ticketId}`);
    revalidatePath('/admin/suporte');
    await runSupportAi(parsed.data.ticketId);
    return { ok: true, message: 'Resposta enviada.' };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Erro inesperado.' };
  }
}

export async function getSupportTicketUrl(ticketId: string) {
  const { user } = await requireCustomer();
  const supabase = createClient();
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket) throw new Error('Ticket não encontrado.');
  return `/painel/suporte/${ticketId}`;
}
