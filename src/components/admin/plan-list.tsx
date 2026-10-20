'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { togglePlan } from '@/actions/plans';
import { useToast } from '@/components/ui/toaster';
import { formatBRL, pricePerDay } from '@/lib/money';
import type { Plan } from '@/types/db';

export function PlanList({ planos }: { planos: Plan[] }) {
  const toast = useToast();
  const router = useRouter();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function alterar(slug: string, field: 'active' | 'highlight') {
    setPendingSlug(slug);
    startTransition(async () => {
      const res = await togglePlan(slug, field);
      setPendingSlug(null);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  if (planos.length === 0) {
    return <div className="surface p-8 text-center text-sm text-muted-foreground">Nenhum plano.</div>;
  }

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Planos cadastrados</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 text-right font-medium">Dias</th>
              <th className="px-4 py-3 text-right font-medium">Preço</th>
              <th className="px-4 py-3 text-right font-medium">Por dia</th>
              <th className="px-4 py-3 text-center font-medium">Ativo</th>
              <th className="px-5 py-3 text-center font-medium">Destaque</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {planos.map((p) => {
              const ocupado = pendingSlug === p.slug;
              return (
                <tr key={p.slug} className="transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{p.slug}</td>
                  <td className="px-4 py-3.5">{p.name}</td>
                  <td className="px-4 py-3.5 text-right">{p.dias}</td>
                  <td className="px-4 py-3.5 text-right font-mono">{formatBRL(p.price_brl)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">
                    {formatBRL(pricePerDay(Number(p.price_brl), p.dias))}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Chave
                      checked={p.active}
                      disabled={ocupado}
                      onClick={() => alterar(p.slug, 'active')}
                      label={`Ativar/desativar ${p.name}`}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Chave
                      checked={p.highlight}
                      disabled={ocupado}
                      onClick={() => alterar(p.slug, 'highlight')}
                      label={`Destacar ${p.name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chave({
  checked,
  disabled,
  onClick,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition disabled:opacity-60 ${
        checked ? 'bg-primary' : 'bg-border'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}