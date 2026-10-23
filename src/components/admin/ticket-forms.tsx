'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { adminReplySupportTicket, adminUpdateTicketStatus } from '@/actions/admin-support';
import type { ActionState } from '@/actions/plans';
import { useToast } from '@/components/ui/toaster';

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? 'Enviando…' : label}
    </button>
  );
}

export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const toast = useToast();
  const [state, formAction] = useFormState<ActionState | null, FormData>(adminReplySupportTicket, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state, toast]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea name="message" className="input min-h-[120px] resize-y" placeholder="Escreva a resposta..." required />
      <div className="flex flex-wrap items-center gap-3">
        <select name="status" className="input w-auto">
          <option value="">Deixar automático</option>
          <option value="in_progress">Em atendimento</option>
          <option value="waiting_customer">Aguardando cliente</option>
          <option value="resolved">Resolvido</option>
          <option value="closed">Fechado</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="internal" />
          Nota interna (não envia para cliente)
        </label>
        <Submit label="Enviar" className="btn-primary" />
      </div>
      {state && !state.ok && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">{state.message}</p>
      )}
    </form>
  );
}

export function AdminStatusForm({
  ticketId,
  status,
  priority,
}: {
  ticketId: string;
  status: string;
  priority: number;
}) {
  const toast = useToast();
  const [state, formAction] = useFormState<ActionState | null, FormData>(adminUpdateTicketStatus, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state, toast]);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</label>
        <select name="status" defaultValue={status} className="input">
          <option value="open">Aberto</option>
          <option value="in_progress">Em atendimento</option>
          <option value="waiting_customer">Aguardando cliente</option>
          <option value="resolved">Resolvido</option>
          <option value="closed">Fechado</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prioridade (0-10)
        </label>
        <input name="priority" type="number" min={0} max={10} defaultValue={priority} className="input" />
      </div>
      <Submit label="Atualizar" className="btn-ghost w-full" />
      {state && !state.ok && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">{state.message}</p>
      )}
    </form>
  );
}
