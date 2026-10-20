import Link from 'next/link';

import { formatBRL } from '@/lib/money';
import { formatDate } from '@/lib/date';
import { createClient } from '@/lib/supabase/server';
import type { Order, Payment } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pagamentos' };

const STATUS_LABEL: Record<string, string> = {
  pending: 'aguardando',
  in_process: 'processando',
  approved: 'aprovado',
  rejected: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado',
};

function badge(status: string) {
  if (status === 'approved') return 'border-success/40 bg-success/15 text-success';
  if (status === 'rejected' || status === 'cancelled')
    return 'border-danger/40 bg-danger/15 text-danger';
  if (status === 'refunded') return 'border-border bg-muted text-muted-foreground';
  return 'border-primary/40 bg-primary/10 text-primary';
}

export default async function PagamentosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [ordRes, payRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('payments')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const ordens = (ordRes.data ?? []) as Order[];
  const pagamentos = (payRes.data ?? []) as Payment[];
  const totalAprovado = ordens
    .filter((o) => o.status === 'approved')
    .reduce((acc, o) => acc + Number(o.amount_brl), 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Financeiro</p>
        <h1 className="mt-1 text-3xl font-bold">Pagamentos</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi rotulo="Total aprovado" valor={formatBRL(totalAprovado)} />
        <Kpi rotulo="Pedidos" valor={String(ordens.length)} />
        <Kpi rotulo="Transações" valor={String(pagamentos.length)} />
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Histórico de pedidos</h2>
        </div>

        {ordens.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
            <Link href="/precos" className="btn-primary mt-5 inline-flex">
              Ver planos
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Chave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ordens.map((o) => (
                  <tr key={o.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-6 py-3.5 font-mono text-xs text-muted-foreground">
                      {o.external_reference.slice(0, 14)}…
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3.5 capitalize">{o.method ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      {formatBRL(o.amount_brl)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge(o.status)}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {o.license_issued ? (
                        <span className="text-xs text-success">emitida</span>
                      ) : o.license_error ? (
                        <span className="text-xs text-danger" title={o.license_error}>
                          pendente
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagamentos.length > 0 && (
        <div className="surface overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Transações no Mercado Pago</h2>
          </div>
          <ul className="divide-y divide-border">
            {pagamentos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="capitalize">{p.method ?? '—'}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.installments && p.installments > 1 ? `${p.installments}x` : 'à vista'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{formatBRL(p.amount_brl)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Precisa de nota ou tem alguma dúvida sobre um cobrança? Fale pelo{' '}
        <Link href="/painel/suporte" className="text-primary hover:underline">
          suporte
        </Link>
        . Reembolso de 7 dias é pedido pela própria área logada.
      </p>
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="surface p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{rotulo}</div>
      <div className="mt-2 font-display text-2xl font-bold text-premium">{valor}</div>
    </div>
  );
}
