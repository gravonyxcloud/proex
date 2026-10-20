import { AdminShell } from '@/components/admin/admin-shell';
import { formatDateTime, relativeTime } from '@/lib/date';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WebhookEvent } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function WebhooksAdmin() {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(150);

  const eventos = (data ?? []) as WebhookEvent[];

  const erros = eventos.filter((e) => e.result === 'error');
  const duplicados = eventos.filter((e) => e.event_id.startsWith('err:'));
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://seu-dominio';

  return (
    <AdminShell
      titulo="Webhooks"
      descricao="Cada notificação do Mercado Pago registrada. Duplicatas do mesmo evento são bloqueadas na gravação — isso é o que impede chave duplicada quando o MP reenvia."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi rotulo="Eventos listados" valor={String(eventos.length)} />
        <Kpi rotulo="Com erro" valor={String(erros.length)} sub={erros.length ? 'ver abaixo' : 'nenhum'} />
        <Kpi rotulo="Processados" valor={String(eventos.length - erros.length - duplicados.length)} />
      </div>

      <div className="surface p-5">
        <h2 className="text-sm font-semibold">Configuração no Mercado Pago</h2>
        <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
          <li>
            1. Em <strong className="text-foreground">Tus Integraciones / Notificações</strong>, cadastre{' '}
            <code className="break-all text-primary">{site.replace(/\/+$/, '')}/api/webhooks/mercadopago</code>{' '}
            para o evento <code className="text-primary">payments</code>.
          </li>
          <li>
            2. Copie a <strong className="text-foreground">chave de assinatura</strong> para{' '}
            <code className="text-primary">MP_WEBHOOK_SECRET</code>. Sem ela o endpoint devolve 503.
          </li>
          <li>
            3. Teste:{' '}
            <code className="text-primary">curl -X POST &lt;url&gt;</code> deve responder{' '}
            <code className="text-primary">401</code> (sem assinatura), nunca 404 — 404 significa
            que a rota não está pública.
          </li>
          <li>
            4. <code className="text-primary">back_urls</code> só funciona em domínios autorizados no
            painel. PIX nunca dispara <code className="text-primary">auto_return</code>: o retorno é
            sempre por polling.
          </li>
        </ol>
      </div>

      <div className="surface overflow-hidden">
        {eventos.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma notificação recebida. Assim que o primeiro pagamento for aprovado, aparece aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Tópico</th>
                  <th className="px-4 py-3 font-medium">Status MP</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                  <th className="px-4 py-3 font-medium">Recebido</th>
                  <th className="px-5 py-3 text-right font-medium">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventos.map((e) => (
                  <tr key={e.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-mono text-xs">{e.event_id}</td>
                    <td className="px-4 py-3.5 text-xs">{e.topic ?? '—'}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{e.status_raw ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          e.result === 'error'
                            ? 'border-danger/40 bg-danger/15 text-danger'
                            : e.result === 'ignored'
                              ? 'border-border bg-muted text-muted-foreground'
                              : 'border-success/40 bg-success/15 text-success'
                        }`}
                      >
                        {e.result}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground" title={formatDateTime(e.received_at)}>
                      {relativeTime(e.received_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {e.error ? (
                        <span className="text-xs text-danger">{e.error}</span>
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
    </AdminShell>
  );
}

function Kpi({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="surface p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{rotulo}</div>
      <div className="mt-2 font-display text-3xl font-bold text-premium">{valor}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}