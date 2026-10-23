import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { generateSupportReply, type TicketContext } from '@/lib/ai/support-agent';
import type { SupportMessage, SupportTicket } from '@/types/db';

export async function processSupportTicket(ticketId: string) {
  const admin = createAdminClient();

  // Tenta adquirir trava
  const { data: lockTicket } = await admin
    .from('support_tickets')
    .update({ ai_running: true })
    .eq('id', ticketId)
    .eq('ai_enabled', true)
    .eq('ai_running', false)
    .select('*')
    .maybeSingle();

  if (!lockTicket) {
    // Já rodando ou IA desabilitada
    return;
  }

  const ticket = lockTicket as SupportTicket;

  try {
    const { data: messages } = await admin
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    const ctx: TicketContext = {
      ticket,
      messages: (messages ?? []) as SupportMessage[],
    };

    const result = await generateSupportReply(ctx);

    if (result.kind === 'handoff') {
      const now = new Date().toISOString();
      await admin.from('support_messages').insert({
        ticket_id: ticketId,
        sender_type: 'system',
        sender_id: null,
        message: `IA: passando para atendimento humano. Motivo: ${result.reason}`,
        attachments: [],
        internal_note: true,
        ai_generated: false,
      });

      await admin
        .from('support_tickets')
        .update({
          ai_enabled: false,
          ai_handoff_at: now,
          ai_handoff_reason: result.reason,
          status: ticket.status === 'open' ? 'in_progress' : ticket.status,
        })
        .eq('id', ticketId);

      return;
    }

    const now = new Date().toISOString();
    await admin.from('support_messages').insert({
      ticket_id: ticketId,
      sender_type: 'agent',
      sender_id: null,
      message: result.text,
      attachments: [],
      internal_note: false,
      ai_generated: true,
      ai_model: result.model,
    });

    await admin
      .from('support_tickets')
      .update({
        status: 'waiting_customer',
        last_message_at: now,
        last_agent_at: now,
        ai_last_reply_at: now,
      })
      .eq('id', ticketId);
  } catch (e) {
    // Em caso de erro, passa para humano para não travar
    const now = new Date().toISOString();
    const reason = e instanceof Error ? e.message : 'Erro ao processar com IA.';
    try {
      await admin.from('support_messages').insert({
        ticket_id: ticketId,
        sender_type: 'system',
        sender_id: null,
        message: `IA: falha ao responder automaticamente. Passando para humano. Motivo: ${reason}`,
        attachments: [],
        internal_note: true,
        ai_generated: false,
      });
      await admin
        .from('support_tickets')
        .update({
          ai_enabled: false,
          ai_handoff_at: now,
          ai_handoff_reason: reason,
          status: ticket.status === 'open' ? 'in_progress' : ticket.status,
        })
        .eq('id', ticketId);
    } catch {
      // ignora
    }
  } finally {
    await admin.from('support_tickets').update({ ai_running: false }).eq('id', ticketId);
  }
}

/**
 * Roda a IA e espera o resultado.
 *
 * Aguardado de propósito: `void async()` depois de retornar a Server Action
 * pode ser morto pelo runtime. O cliente espera alguns segundos e já cai na
 * página com a resposta pronta. Nunca lança — falha vira handoff.
 */
export async function runSupportAi(ticketId: string) {
  try {
    await processSupportTicket(ticketId);
  } catch {
    // processSupportTicket já trata; aqui é só reforço.
  }
}
