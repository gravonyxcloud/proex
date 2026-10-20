import { AdminShell } from '@/components/admin/admin-shell';
import { pingLicenseApi } from '@/lib/license-api';
import { mpConfigured } from '@/lib/mp/client';
import { formatBRL } from '@/lib/money';
import { relativeTime } from '@/lib/date';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Order, WebhookEvent } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const supabase = createAdminClient();
  const agora = new Date();
  const inicio24h = new Date(agora.getTime() - 24 * 3_600_000).toISOString();
  const inicio7d = new Date(agora.getTime() - 7 * 86_400_000).toISOString();

  const [
    ordersRes,
    licensesRes,
    customersRes,
    webhookErrRes,
    recentOrdersRes,
    recentEventsRes,
    ponte,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('status, amount_brl, created_at, license_issued, license_error')
      .gte('created_at', inicio7d),
    supabase.from('licenses').select('status, expires_at'),
    supabase.from('profiles').select('id, created_at', { count: 'exact', head: true }),
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('result', 'error')
      .gte('received_at', inicio24h),
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('webhook_events')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(8),
    pingLicenseApi(),
  ]);

  const orders = (ordersRes.data ?? []) as Order[];
  const licencas = (licensesRes.data ?? []) as { status: string; expires_at: string }[];

  const aprovadas = orders.filter((o) => o.status === 'approved');
  const receita7d = aprovadas.reduce((acc, o) => acc + Number(o.amount_brl), 0);
  const pendentes = orders.filter((o) => o.status === 'pending' || o.status === 'in_process').length;
  const semChave = aprovadas.filter((o) => !o.license_issued).length;
  const ativas = licencas.filter((l) => l.status === 'active' && new Date(l.expires_at) > agora).length;
  const expirando = licencas.filter((l) => {
    const d = new Date(l.expires_at).getTime();
    return l.status === 'active' && d > agora.getTime() && d - agora.getTime() < 3 * 86_400_000;
  }).length;

  const kpis = [
    { k: 'Receita bruta (7d)', v: formatBRL(receita7d), sub: `${aprovadas.length} pedidos aprovados` },
    { k: 'Licenças ativas', v: String(ativas), sub: `${expirando} expiram em até 3 dias` },
    { k: 'Pendentes de pagamento', v: String(pendentes), sub: 'aguardando PIX/cartão' },
    {
      k: 'Ativações com falha',
      v: String(semChave),
      sub: semChave > 0 ? 'reprocessable abaixo' : 'nada enfileirado',
    },
  ];

  const recentes = (recentOrdersRes.data ?? []) as Order[];
  const eventos = (recentEventsRes.data ?? []) as WebhookEvent[];

  return (
    <AdminShell
      titulo="Visão geral"
      descricao="Pedidos, licenças e saúde da integração. Receita é bruta (sem taxa do Mercado Pago)."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.k} className="surface p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.k}</div>
            <div className="mt-2 font-display text-3xl font-bold text-premium">{k.v}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface flex items-center justify-between p-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Mercado Pago</div>
            <div className="mt-1 text-sm font-medium">
              {mpConfigured() ? 'token configurado' : 'token AUSENTE'}
            </div>
          </div>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              mpConfigured() ? 'bg-success shadow-[0_0_10px_hsl(var(--success))]' : 'bg-danger'
            }`}
          />
        </div>

        <div className="surface flex items-center justify-between p-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Ponte da API</div>
            <div className="mt-1 text-sm font-medium">{ponte.ok ? 'respondendo' : 'indisponível'}</div>
          </div>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              ponte.ok ? 'bg-success shadow-[0_0_10px_hsl(var(--success))]' : 'bg-danger'
            }`}
          />
        </div>

        <div className="surface flex items-center justify-between p-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Webhook (24h)
            </div>
            <div className="mt-1 text-sm font-medium">
              {(webhookErrRes.count ?? 0) === 0
                ? 'sem erro'
                : `${webhookErrRes.count} com erro`}
            </div>
          </div>
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              (webhookErrRes.count ?? 0) === 0
                ? 'bg-success shadow-[0_0_10px_hsl(var(--success))]'
                : 'bg-danger'
            }`}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Pedidos recentes</h2>
          </div>
          <ul className="divide-y divide-border">
            {recentes.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted-foreground">Nenhum pedido ainda.</li>
            )}
            {recentes.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {o.external_reference}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{o.customer_email}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs">{formatBRL(o.amount_brl)}</span>
                  <StatusTag status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Eventos de webhook</h2>
          </div>
          <ul className="divide-y divide-border">
            {eventos.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                Nenhum evento recebido ainda.
              </li>
            )}
            {eventos.map((e) => (
              <li key={e.id} className="px-5 py-3.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-xs">{e.event_id}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(e.received_at)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      e.result === 'error'
                        ? 'text-danger'
                        : e.result === 'ignored'
                          ? 'text-muted-foreground'
                          : 'text-success'
                    }`}
                  >
                    {e.result}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {e.error ?? e.status_raw ?? ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

function StatusTag({ status }: { status: string }) {
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