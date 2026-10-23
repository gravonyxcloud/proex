'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { replySupportTicket } from '@/actions/support';
import { useToast } from '@/components/ui/toaster';
import { useSupportAttachments } from './use-support-attachments';
import type { ActionState } from '@/actions/plans';

const initial: ActionState = { ok: false, message: '' };

function Submit({ busy }: { busy: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || busy;
  return (
    <button type="submit" className="btn-primary" disabled={disabled}>
      {disabled ? 'Enviando...' : 'Enviar resposta'}
    </button>
  );
}

export function SupportReplyForm({
  ticketId,
  disabled,
}: {
  ticketId: string;
  disabled: boolean;
}) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(replySupportTicket, initial);
  const { uploads, pending, onFiles, removeUpload, reset, serialize } = useSupportAttachments(ticketId);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      reset();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, toast, reset]);

  if (disabled) {
    return (
      <div className="surface p-5 text-sm text-muted-foreground">
        Este ticket está fechado. Não é possível responder.
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="surface p-6">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="attachments" value={serialize()} />
      <h2 className="text-sm font-semibold">Responder</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Responda com o máximo de informações. Se tiver prints, envie junto para eu analisar mais rápido.
      </p>

      <div className="mt-4">
        <textarea
          name="message"
          className="input min-h-[120px] resize-y"
          placeholder="Escreva sua resposta..."
          required
        />
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prints / anexos (opcional)
        </label>
        <input
          type="file"
          accept="image/*,.pdf,.txt"
          multiple
          onChange={onFiles}
          disabled={uploads.length >= 5}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
        />
        {uploads.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {uploads.map((u, i) => (
              <li key={u.attachment.path} className="flex items-center justify-between rounded-lg border border-border px-2 py-1">
                <span className="truncate">
                  {u.name} <span className="opacity-60">({Math.round(u.size / 1024)}KB) · enviado</span>
                </span>
                <button type="button" onClick={() => removeUpload(i)} className="text-red-400 hover:underline">
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
        {pending > 0 && (
          <p className="mt-2 text-xs text-amber-400">
            Enviando {pending} arquivo{pending > 1 ? 's' : ''}...
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Até 5 arquivos, máx 10MB cada.</p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Submit busy={pending > 0} />
        {pending > 0 && (
          <span className="text-xs text-muted-foreground">Aguarde o upload terminar antes de enviar.</span>
        )}
      </div>
    </form>
  );
}
