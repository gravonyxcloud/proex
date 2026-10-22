'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { addWithdrawal, removeWithdrawal } from '@/actions/contabilidade';
import { useToast } from '@/components/ui/toaster';
import { formatDateTime } from '@/lib/date';
import { formatBRL } from '@/lib/money';
import type { Withdrawal } from '@/types/db';
import type { ActionState } from '@/actions/plans';

const METODOS: { value: Withdrawal['method']; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'ted', label: 'TED' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'outro', label: 'Outro' },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary btn-sm" disabled={pending}>
      {pending ? 'Lançando…' : 'Lançar saque'}
    </button>
  );
}

export function SaquesManager({ saques }: { saques: Withdrawal[] }) {
  const toast = useToast();
  const router = useRouter();
  const [state, formAction] = useFormState<ActionState | null, FormData>(addWithdrawal, null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, toast, router]);

  function remover(id: string) {
    setRemovendo(id);
    startTransition(async () => {
      const res = await removeWithdrawal(id);
      setRemovendo(null);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <form action={formAction} className="surface p-6">
        <h2 className="text-sm font-semibold">Lançar saque</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Dinheiro que saiu do caixa. É o que o Mercado Pago não sabe — só o lançamento manual fecha
          o saldo.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="amount_brl"
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
            >
              Valor (R$)
            </label>
            <input
              id="amount_brl"
              name="amount_brl"
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              placeholder="1500.00"
              required
            />
          </div>

          <div>
            <label
              htmlFor="withdrawn_at"
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
            >
              Data
            </label>
            <input
              id="withdrawn_at"
              name="withdrawn_at"
              type="date"
              className="input"
              defaultValue={hoje}
            />
          </div>

          <div>
            <label
              htmlFor="method"
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
            >
              Meio
            </label>
            <select id="method" name="method" className="input" defaultValue="pix">
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="destination"
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
            >
              Destino
            </label>
            <input
              id="destination"
              name="destination"
              className="input"
              placeholder="Banco / chave PIX"
              maxLength={120}
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="note"
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
            >
              Observação
            </label>
            <input
              id="note"
              name="note"
              className="input"
              placeholder="Opcional"
              maxLength={280}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Submit />
        </div>
      </form>

      <div className="surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Saques lançados</h2>
        </div>

        <ul className="divide-y divide-border">
          {saques.length === 0 && (
            <li className="px-5 py-6 text-sm text-muted-foreground">Nenhum saque lançado.</li>
          )}
          {saques.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
              <div className="min-w-0">
                <div className="font-mono text-xs text-muted-foreground">
                  {formatDateTime(s.withdrawn_at)} · {s.method}
                  {s.destination ? ` · ${s.destination}` : ''}
                </div>
                <div className="truncate text-xs text-muted-foreground">{s.note ?? s.actor}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-xs">−{formatBRL(s.amount_brl)}</span>
                <button
                  type="button"
                  onClick={() => remover(s.id)}
                  disabled={removendo === s.id}
                  className="btn-ghost btn-sm text-danger hover:bg-danger/10 hover:text-danger"
                  aria-label={`Remover saque de ${formatBRL(s.amount_brl)}`}
                >
                  {removendo === s.id ? '…' : 'remover'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
