'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { runSupportAi } from '@/lib/ai/process-support';
import type { ActionState } from '@/actions/plans';

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autorizado.');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') throw new Error('Apenas administradores.');
  return user;
}

export async function adminReplySupportTicket(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const ticketId = (formData.get('ticketId') as string).trim();
    const message = (formData.get('message') as string).trim();
    const status = (formData.get('status') as string)?.trim() || null;
    const internal = formData.get('internal') === 'on';

    if (!ticketId || !message) throw new Error('Dados inválidos.');

    const now = new Date().toISOString();

    await admin.from('support_messages').insert({
      ticket_id: ticketId,
      sender_type: internal ? 'system' : 'agent',
      sender_id: null,
      message,
      attachments: [],
      internal_note: internal,
    });

    const updates: any = {
      last_message_at: now,
      last_agent_at: now,
    };

    if (status && ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].includes(status)) {
      updates.status = status;
    } else if (!internal) {
      updates.status = 'waiting_customer'; // aguardando cliente
    }

    if (!internal && !updates.status) updates.status = 'waiting_customer';
    if (internal && !status) updates.status = 'in_progress';

    await admin.from('support_tickets').update(updates).eq('id', ticketId);

    revalidatePath('/admin/suporte');
    revalidatePath(`/admin/suporte/${ticketId}`);
    revalidatePath('/painel/suporte');
    revalidatePath(`/painel/suporte/${ticketId}`);
    if (!internal) {
      await runSupportAi(ticketId);
    }
    return { ok: true, message: internal ? 'Nota interna adicionada.' : 'Resposta enviada ao cliente.' };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Erro inesperado.' };
  }
}

export async function adminUpdateTicketStatus(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const ticketId = (formData.get('ticketId') as string).trim();
    const status = (formData.get('status') as string).trim();
    const priority = formData.get('priority') ? Number(formData.get('priority')) : null;

    if (!ticketId || !status) throw new Error('Dados inválidos.');

    const updates: any = { status };
    if (priority !== null && !Number.isNaN(priority)) updates.priority = priority;
    if (status === 'in_progress') updates.assigned_to = 'agent';

    await admin.from('support_tickets').update(updates).eq('id', ticketId);

    revalidatePath('/admin/suporte');
    revalidatePath(`/admin/suporte/${ticketId}`);
    revalidatePath('/painel/suporte');
    revalidatePath(`/painel/suporte/${ticketId}`);
    if (status === 'open' || status === 'in_progress') {
      await runSupportAi(ticketId);
    }
    return { ok: true, message: 'Status atualizado.' };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Erro inesperado.' };
  }
}
