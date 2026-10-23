'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { replySupportTicket } from '@/actions/support';
import { useToast } from '@/components/ui/toaster';
import type { ActionState } from '@/actions/plans';

const initial: ActionState = { ok: false, message: '' };

export function SupportReplyForm({
  ticketId,
  disabled,
}: {
  ticketId: string;
  disabled: boolean;
}) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(replySupportTicket, initial);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      setFiles([]);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, toast]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    const valid = list.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: maior que 10MB`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
    e.target.value = '';
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

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
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
        />
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-border px-2 py-1">
                <span className="truncate">
                  {f.name} <span className="opacity-60">({Math.round(f.size / 1024)}KB)</span>
                </span>
                <button type="button" onClick={() => removeFile(i)} className="text-red-400 hover:underline">
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? 'Enviando...' : 'Enviar resposta'}
        </button />
      </div>
    </form>
  );
}
