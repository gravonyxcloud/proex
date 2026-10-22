import { AdminShell } from '@/components/admin/admin-shell';
import { formatBRL } from '@/lib/money';
import { formatDateTime, relativeTime } from '@/lib/date';
import { createAdminClient } from '@/lib/supabase/admin';
import type { License, Order, Payment } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function PagamentosAdmin({
  searchParams,
}: {
  searchParams: { filtro?: string };
}) {
  const supabase = createAdminClient();
  const filtro = searchParams.filtro ?? 'todos';

  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filtro === 'pendentes') {
    query = query.in('status', ['pending', 'in_process']);
  } else if (filtro === 'aprovados') {
    query = query.eq('status', 'approved');
  } else if (filtro === 'problemas') {
    query = query.ilike('license_error', '%');
  }

  const { data } = await query;
  const ordens = (data ?? []) as Order[];

  const { data: paysRaw } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  const pagamentos = (paysRaw ?? []) as Payment[];

  const { data: licRaw } = await supabase
    .from('licenses')
    .select('id, order_id, key_hint, customer_email, status')
    .order('expires_at', { ascending: false })
    .limit(500);
  type LicRow = Pick<License, 'id' | 'key_hint'> & {
    order_id: string | null;
    customer_email: string;
    status: string;
  };
  const licencas = (licRaw ?? []) as LicRow[];

  // Renovação não troca licenses.order_id: sem o fallback por e-mail a linha
  // do pedido renovado aparece como "falhou" mesmo com a chave emitida.
  const hintPorPedido = new Map<string, string>();
  const hintPorEmail = new Map<string, string>();
  for (const l of licencas) {
    if (l.status === 'revoked') continue;
    if (l.order_id && !hintPorPedido.has(l.order_id)) hintPorPedido.set(l.order_id, l.key_hint);
    if (!hintPorEmail.has(l.customer_email)) hintPorEmail.set(l.customer_email, l.key_hint);
  }
  const hintDe = (o: Order): string | null =>
    hintPorPedido.get(o.id) ??
    (o.status === 'approved' && o.license_issued
      ? (hintPorEmail.get(o.customer_email) ?? null)
      : null);

  const filtros = [
    { id: 'todos', label: 'Todos' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'aprovados', label: 'Aprovados' },
    { id: 'problemas', label: 'Com falha na ativação' },
  ] as const;

  return (
    <AdminShell
      titulo="Pagamentos"
      descricao="Pedidos e transações no Mercado Pago. Use Sincronizar em Licências quando um webhook não chegou."
    >
      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <a
            key={f.id}
            href={f.id === 'todos' ? '/admin/pagamentos' : `/admin/pagamentos?filtro=${f.id}`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              filtro === f.id
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <div className="surface overflow-hidden">
        {ordens.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Chave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ordens.map((o) => (
                  <tr key={o.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                      {o.external_reference}
                      <div className="mt-0.5 text-[11px]">MP: {o.mp_payment_id ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="max-w-[220px] truncate">{o.customer_email}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.plan_slug.replace('cc_', '').replace('d', ' dias')}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                      {relativeTime(o.created_at)}
                    </td>
                    <td className="px-4 py-3.5 capitalize">{o.method ?? '—'}</td>
                    <td className="px-4 py-3.5 text-right font-mono">{formatBRL(o.amount_brl)}</td>
                    <td className="px-4 py-3.5">
                      <Tag status={o.status} />
                      {o.license_error && (
                        <div className="mt-1 max-w-[200px] truncate text-[11px] text-danger" title={o.license_error}>
                          {o.license_error}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {hintDe(o) ? (
                        <span className="font-mono text-xs text-success" title="Chave emitida">
                          {hintDe(o)}
                        </span>
                      ) : o.status === 'approved' ? (
                        <span className="text-xs text-danger">falhou</span>
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
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Últimas transações</h2>
          </div>
          <ul className="divide-y divide-border">
            {pagamentos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="capitalize">{p.method ?? '—'}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.mp_payment_id ?? '—'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{formatBRL(p.amount_brl)}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</span>
                  <span className="font-mono text-xs">{p.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminShell>
  );
}

function Tag({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'border-success/40 bg-success/15 text-success',
    rejected: 'border-danger/40 bg-danger/15 text-danger',
    cancelled: 'border-border bg-muted text-muted-foreground',
    refunded: 'border-border bg-muted text-muted-foreground',
    pending: 'border-primary/40 bg-primary/10 text-primary',
    in_process: 'border-primary/40 bg-primary/10 text-primary',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}