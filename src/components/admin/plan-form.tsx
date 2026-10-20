'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';

import { savePlan, type ActionState } from '@/actions/plans';
import { useToast } from '@/components/ui/toaster';
import type { Plan } from '@/types/db';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary btn-sm" disabled={pending}>
      {pending ? 'Salvando…' : label}
    </button>
  );
}

export function PlanForm({ plano }: { plano?: Plan }) {
  const toast = useToast();
  const [state, formAction] = useFormState<ActionState | null, FormData>(savePlan, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state, toast]);

  return (
    <form action={formAction} className="surface p-6">
      <h2 className="text-sm font-semibold">{plano ? `Editar ${plano.slug}` : 'Novo plano'}</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="slug" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            className="input font-mono"
            defaultValue={plano?.slug ?? ''}
            placeholder="cc_30d"
            pattern="cc_\d+d"
            required
            disabled={Boolean(plano)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Formato <code className="text-primary">cc_&lt;dias&gt;d</code>. Fixo após criar.
          </p>
        </div>

        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Nome
          </label>
          <input
            id="name"
            name="name"
            className="input"
            defaultValue={plano?.name ?? ''}
            placeholder="Claude Code · 30 dias"
            required
          />
        </div>

        <div>
          <label htmlFor="dias" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Dias
          </label>
          <input
            id="dias"
            name="dias"
            type="number"
            min={1}
            max={365}
            className="input"
            defaultValue={plano?.dias ?? 30}
            required
          />
        </div>

        <div>
          <label htmlFor="price_brl" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Preço (R$)
          </label>
          <input
            id="price_brl"
            name="price_brl"
            type="number"
            step="0.01"
            min={0}
            className="input"
            defaultValue={plano ? Number(plano.price_brl).toFixed(2) : '279.00'}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Descrição curta
          </label>
          <input
            id="description"
            name="description"
            className="input"
            defaultValue={plano?.description ?? ''}
            placeholder="Mês inteiro. Melhor custo por dia."
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="sort" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Ordem
          </label>
          <input
            id="sort"
            name="sort"
            type="number"
            min={0}
            max={999}
            className="input"
            defaultValue={plano?.sort ?? 5}
          />
        </div>

        <div className="flex items-end gap-5 pb-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={plano ? plano.active : true}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Ativo
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="highlight"
              defaultChecked={plano?.highlight ?? false}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Destaque
          </label>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Preços refletem na landing em segundos.</p>
        <Submit label={plano ? 'Salvar alterações' : 'Criar plano'} />
      </div>

      {state && !state.ok && (
        <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}