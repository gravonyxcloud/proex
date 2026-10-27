'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { adminReplySupportTicket, adminUpdateTicketStatus } from '@/actions/admin-support';
import type { ActionState } from '@/actions/plans';
import { useToast } from '@/components/ui/toaster';

function SendButton({ internal }: { internal: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary btn-sm" disabled={pending}>
      {pending ? 'Enviando…' : internal ? 'Salvar nota' : 'Responder'}
    </button>
  );
}

/**
 * Composer do atendente. Ctrl/Cmd+Enter envia; Enter sozinho quebra linha
 * (é um chat, não um chat de bolso — mensagens longas são comuns aqui).
 */
export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [internal, setInternal] = useState(false);
  const [state, formAction] = useFormState<ActionState | null, FormData>(adminReplySupportTicket, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      setInternal(false);
    } else {
      toast.error(state.message);
    }
  }, [state, toast]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-t border-border bg-card/60 p-4"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
    >
      <input type="hidden" name="ticketId" value={ticketId} />

      <label className="sr-only" htmlFor={`reply-${ticketId}`}>
        Resposta
      </label>
      <textarea
        id={`reply-${ticketId}`}
        name="message"
        className="input min-h-[92px] resize-y"
        placeholder={internal ? 'Nota interna — o cliente não vê.' : 'Escreva a resposta ao cliente…'}
        required
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted">
          <input
            type="checkbox"
            name="internal"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
            className="accent-primary"
          />
          Nota interna
        </label>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Status ao enviar
          <select name="status" className="input w-auto py-1.5 text-xs" defaultValue="">
            <option value="">Automático</option>
            <option value="in_progress">Em atendimento</option>
            <option value="waiting_customer">Aguardando cliente</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Fechado</option>
          </select>
        </label>

        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">⌘/Ctrl + Enter envia</span>
        <SendButton internal={internal} />
      </div>

      {state && !state.ok && (
        <p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">{state.message}</p>
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
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Status
        </label>
        <select name="status" defaultValue={status} className="input py-2 text-sm">
          <option value="open">Aberto</option>
          <option value="in_progress">Em atendimento</option>
          <option value="waiting_customer">Aguardando cliente</option>
          <option value="resolved">Resolvido</option>
          <option value="closed">Fechado</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Prioridade (0-10)
        </label>
        <input name="priority" type="number" min={0} max={10} defaultValue={priority} className="input py-2 text-sm" />
      </div>
      <button type="submit" className="btn-outline btn-sm w-full">
        Aplicar
      </button>
      {state && !state.ok && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs">{state.message}</p>
      )}
    </form>
  );
}
