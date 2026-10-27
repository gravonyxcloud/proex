import Link from 'next/link';

import { KeyCard } from '@/components/panel/key-card';
import { UsageMeter } from '@/components/panel/usage-meter';
import { UsageUnavailable } from '@/components/panel/usage-unavailable';
import { RenewalForm } from '@/components/panel/renewal-form';
import { fetchUsage } from '@/lib/usage';
import { getActivePlans } from '@/lib/plans';
import { formatBRL } from '@/lib/money';
import { formatDate } from '@/lib/date';
import { createClient } from '@/lib/supabase/server';
import type { License, Order, Plan } from '@/types/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Painel' };

export default async function PainelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [licRes, ordRes] = await Promise.all([
    supabase
      .from('licenses')
      .select('*')
      .eq('customer_id', user.id)
      .order('issued_at', { ascending: false })
      .limit(10),
    supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const licencas = (licRes.data ?? []) as License[];
  const ordens = (ordRes.data ?? []) as Order[];

  const ativa =
    licencas.find((l) => l.status === 'active') ??
    licencas.find((l) => l.status === 'expired') ??
    licencas[0] ??
    null;

  // Consumo vem do gateway (GET /api/license/usage), não de tabela local.
  const consumo = ativa
    ? await fetchUsage({
        email: user.email ?? ativa.customer_email,
        key: ativa.key,
        days: 7,
      })
    : null;

  const pendente = ordens.find(
    (o) => o.status === 'pending' || o.status === 'in_process',
  );

  // Busca planos ativos para o formulário de renovação
  const planos = await getActivePlans();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
        <h1 className="mt-1 text-3xl font-bold">Seu acesso</h1>
      </header>

      {pendente && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-5 py-4 text-sm">
          <span>
            Há um pagamento em andamento ({formatBRL(pendente.amount_brl)} ·{' '}
            {pendente.plan_slug.replace('cc_', '').replace('d', ' dias')}). Ele pode levar alguns
            segundos.
          </span>
          <Link
            href={`/checkout/retorno?orderId=${pendente.id}&email=${encodeURIComponent(user.email ?? '')}`}
            className="btn-primary btn-sm"
          >
            Acompanhar
          </Link>
        </div>
      )}

      {ativa ? (
        <>
          <KeyCard
            licenseKey={ativa.key}
            keyHint={ativa.key_hint}
            status={ativa.status}
            expiresAt={ativa.expires_at}
            issuedAt={ativa.issued_at}
            planSlug={ativa.plan_slug}
          />
          <section aria-label="Renovação">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Renovar acesso</h2>
              <Link href="/precos" className="text-xs text-primary hover:underline">
                ver todos os planos →
              </Link>
            </div>
            <RenewalForm
              planos={planos}
              licenseKey={ativa.key}
              licenseHint={ativa.key_hint}
              currentPlanSlug={ativa.plan_slug}
            />
          </section>
        </>
      ) : (
        <div className="surface grid place-items-center gap-5 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-border bg-muted text-xl text-muted-foreground">
            ⌁
          </div>
          <div>
            <h2 className="text-xl font-bold">Você ainda não tem uma chave</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Escolha um período, pague com PIX ou cartão e a chave aparece aqui assim que o
              pagamento aprovar.
            </p>
          </div>
          <Link href="/precos" className="btn-primary">
            Ver planos
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      <section aria-label="Consumo">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Consumo</h2>
          <Link href="/painel/uso" className="text-xs text-primary hover:underline">
            ver detalhe →
          </Link>
        </div>

        {consumo?.ok ? (
          <UsageMeter
            hour={consumo.data.usage.currentHour}
            limits={consumo.data.limits}
            overLimit={consumo.data.overLimit}
            size="sm"
          />
        ) : consumo ? (
          <UsageUnavailable failure={consumo.failure} />
        ) : (
          <div className="surface px-6 py-8 text-center text-sm text-muted-foreground">
            Emita uma chave para acompanhar o consumo da janela de 60 minutos.
          </div>
        )}
      </section>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Últimos pedidos</h2>
          <Link href="/painel/pagamentos" className="text-xs text-primary hover:underline">
            ver todos
          </Link>
        </div>

        {ordens.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum pedido por aqui ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {ordens.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
                <div>
                  <div className="font-medium">{o.plan_slug.replace('cc_', '').replace('d', ' dias')} de Claude Code</div>
                  <div className="text-xs text-muted-foreground">{formatDate(o.created_at)}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{formatBRL(o.amount_brl)}</span>
                  <EstadoOrdem status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { t: 'Como configurar', d: 'Instalar o Claude Code e apontar para a ponte.', href: '/#como-funciona' },
          { t: 'Suporte', d: 'Chave que não autentica, a gente resolve.', href: '/painel/suporte' },
          { t: 'Renovar', d: 'Mais período, mesma chave.', href: '/precos' },
        ].map((c) => (
          <Link key={c.t} href={c.href} className="surface surface-hover block p-5">
            <div className="text-sm font-semibold">{c.t}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">{c.d}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EstadoOrdem({ status }: { status: Order['status'] }) {
  const map: Record<Order['status'], { label: string; cls: string }> = {
    pending: { label: 'aguardando', cls: 'border-primary/40 bg-primary/10 text-primary' },
    in_process: { label: 'processando', cls: 'border-primary/40 bg-primary/10 text-primary' },
    approved: { label: 'aprovado', cls: 'border-success/40 bg-success/15 text-success' },
    rejected: { label: 'recusado', cls: 'border-danger/40 bg-danger/15 text-danger' },
    cancelled: { label: 'cancelado', cls: 'border-border bg-muted text-muted-foreground' },
    refunded: { label: 'estornado', cls: 'border-border bg-muted text-muted-foreground' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

