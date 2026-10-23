'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

import { createSupportTicket } from '@/actions/support';
import { useToast } from '@/components/ui/toaster';
import { useSupportAttachments } from './use-support-attachments';
import type { ActionState } from '@/actions/plans';

const CATEGORIAS = [
  { value: 'chave_nao_chegou', label: 'Chave não chegou' },
  { value: 'nao_autentica', label: 'Chave não autentica' },
  { value: 'rate_limit', label: 'Rate limit / uso justo' },
  { value: 'renovacao', label: 'Renovação ou plano' },
  { value: 'reembolso', label: 'Pedido de reembolso' },
  { value: 'configuracao', label: 'Configuração / uso' },
  { value: 'outro', label: 'Outro' },
] as const;

const initial: (ActionState & { ticketId?: string }) | null = null;

function Submit({ busy }: { busy: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || busy;
  return (
    <button type="submit" className="btn-primary" disabled={disabled}>
      {disabled ? 'Abrindo ticket...' : 'Abrir ticket'}
    </button>
  );
}

export function SupportForm() {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(createSupportTicket, initial);
  const { uploads, pending, onFiles, removeUpload, reset, serialize } = useSupportAttachments();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      reset();
      if (state.ticketId) {
        router.push(`/painel/suporte/${state.ticketId}`);
      } else {
        router.refresh();
      }
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router, toast, reset]);

  return (
    <form ref={formRef} action={formAction} className="surface p-6">
      <input type="hidden" name="attachments" value={serialize()} />
      <h2 className="text-sm font-semibold">Abrir novo ticket</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Somente para clientes. Descreva o problema com clareza. Se precisar, envie prints (imagens/PDF/TXT).
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="subject" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Assunto
          </label>
          <input id="subject" name="subject" className="input" placeholder="Ex.: Chave não chegou no e-mail" required />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="category" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Categoria
          </label>
          <select id="category" name="category" className="input" defaultValue="outro">
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="message" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Descreva o problema
        </label>
        <textarea
          id="message"
          name="message"
          className="input min-h-[160px] resize-y"
          placeholder="Explique com detalhes. Se for erro na ativação, cole mensagem exata. Quanto mais claro, mais rápido analiso."
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">Mínimo 15 caracteres.</p>
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
        <p className="mt-1 text-xs text-muted-foreground">Até 5 arquivos, máx 10MB cada. Você pode enviar prints direto.</p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Submit busy={pending > 0} />
        {pending > 0 && (
          <span className="text-xs text-muted-foreground">Aguarde o upload terminar antes de abrir o ticket.</span>
        )}
      </div>
    </form>
  );
}
