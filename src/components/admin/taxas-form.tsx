'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { saveSettings } from '@/actions/contabilidade';
import { useToast } from '@/components/ui/toaster';
import type { AppSettings } from '@/types/db';
import type { ActionState } from '@/actions/plans';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary btn-sm" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar taxas'}
    </button>
  );
}

export function TaxasForm({ settings }: { settings: AppSettings }) {
  const toast = useToast();
  const [state, formAction] = useFormState<ActionState | null, FormData>(saveSettings, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state, toast]);

  return (
    <form action={formAction} className="surface p-6">
      <h2 className="text-sm font-semibold">Taxas da operação</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Usadas como <strong className="text-foreground">estimativa</strong> quando o Mercado Pago não
        devolve o detalhamento da tarifa. Quando ele devolve, o valor real ganha sempre.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="store_name"
            className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
          >
            Nome da loja
          </label>
          <input
            id="store_name"
            name="store_name"
            className="input"
            defaultValue={settings.store_name}
            maxLength={60}
            required
          />
        </div>

        <div>
          <label
            htmlFor="mp_fee_percent"
            className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
          >
            Taxa MP (%)
          </label>
          <input
            id="mp_fee_percent"
            name="mp_fee_percent"
            type="number"
            step="0.01"
            min={0}
            max={100}
            className="input"
            defaultValue={Number(settings.mp_fee_percent).toFixed(2)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="mp_fee_fixed_brl"
            className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
          >
            Taxa fixa por venda (R$)
          </label>
          <input
            id="mp_fee_fixed_brl"
            name="mp_fee_fixed_brl"
            type="number"
            step="0.01"
            min={0}
            max={999}
            className="input"
            defaultValue={Number(settings.mp_fee_fixed_brl).toFixed(2)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="tax_percent"
            className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground"
          >
            Reserva de imposto (%)
          </label>
          <input
            id="tax_percent"
            name="tax_percent"
            type="number"
            step="0.01"
            min={0}
            max={100}
            className="input"
            defaultValue={Number(settings.tax_percent).toFixed(2)}
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Descontada do líquido no painel. Não entra em <code className="text-primary">fee_brl</code>.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Vale só para cobranças novas.</p>
        <Submit />
      </div>
    </form>
  );
}
