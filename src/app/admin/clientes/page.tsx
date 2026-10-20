import Link from 'next/link';

import { AdminShell } from '@/components/admin/admin-shell';
import { LicencaManager } from '@/components/admin/licenca-manager';
import { formatBRL } from '@/lib/money';
import { formatDate, relativeTime } from '@/lib/date';
import { createAdminClient } from '@/lib/supabase/admin';
import type { License, Order, Payment, Plan, Profile } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function ClientesAdmin({
  searchParams,
}: {
  searchParams: { id?: string; q?: string };
}) {
  const supabase = createAdminClient();

  if (searchParams.id) {
    return <ClienteDetalhe id={searchParams.id} />;
  }

  const busca = (searchParams.q ?? '').trim().toLowerCase();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  let perfis = (data ?? []) as Profile[];
  if (busca) {
    perfis = perfis.filter(
      (p) => p.email.toLowerCase().includes(busca) || (p.full_name ?? '').toLowerCase().includes(busca),
    );
  }

  const ids = perfis.map((p) => p.id);
  const [licRes, ordRes] = await Promise.all([
    supabase
      .from('licenses')
      .select('id, customer_id, plan_slug, status, expires_at, key_hint')
      .in('customer_id', ids)
      .order('issued_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, customer_id, amount_brl, status, created_at, license_issued, license_error')
      .in('customer_id', ids)
      .order('created_at', { ascending: false }),
  ]);

  const licencas = (licRes.data ?? []) as License[];
  const ordens = (ordRes.data ?? []) as Order[];

  return (
    <AdminShell
      titulo="Clientes"
      descricao={`${perfis.length} contas. Clique em uma linha para ver licenças, pedidos e as ações de ativação, renovação e revogação.`}
    >
      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ''}
          className="input max-w-md"
          placeholder="Buscar por e-mail ou nome…"
        />
        <button type="submit" className="btn-outline">
          Buscar
        </button>
      </form>

      <div className="surface overflow-hidden">
        {perfis.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {busca ? 'Nenhuma conta corresponde à busca.' : 'Nenhuma conta cadastrada ainda.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Cargo</th>
                  <th className="px-4 py-3 font-medium">Cadastrou</th>
                  <th className="px-4 py-3 text-right font-medium">Pedidos</th>
                  <th className="px-4 py-3 text-right font-medium">Pago</th>
                  <th className="px-5 py-3 text-right font-medium">Licença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perfis.map((p) => {
                  const minhas = ordens.filter((o) => o.customer_id === p.id);
                  const pago = minhas
                    .filter((o) => o.status === 'approved')
                    .reduce((a, o) => a + Number(o.amount_brl), 0);
                  const minhaLic = licencas.find((l) => l.customer_id === p.id);

                  return (
                    <tr key={p.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <Link href={`/admin/clientes?id=${p.id}`} className="block">
                          <div className="font-medium text-primary hover:underline">{p.full_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            p.role === 'admin'
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border bg-muted text-muted-foreground'
                          }`}
                        >
                          {p.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground" title={formatDate(p.created_at)}>
                        {relativeTime(p.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right">{minhas.length}</td>
                      <td className="px-4 py-3.5 text-right font-mono">{formatBRL(pago)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {minhaLic ? (
                          <span
                            className={`font-mono text-xs ${
                              minhaLic.status === 'active' ? 'text-success' : 'text-muted-foreground'
                            }`}
                          >
                            {minhaLic.key_hint}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

async function ClienteDetalhe({ id }: { id: string }) {
  const supabase = createAdminClient();

  const [profRes, licRes, ordRes, payRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('licenses')
      .select('*')
      .eq('customer_id', id)
      .order('issued_at', { ascending: false }),
    supabase
      .from('orders')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const perfil = profRes.data as Profile | null;
  if (!perfil) {
    return (
      <AdminShell titulo="Cliente" descricao="Conta não encontrada.">
        <Link href="/admin/clientes" className="btn-outline">
          ← Voltar
        </Link>
      </AdminShell>
    );
  }

  const licencas = (licRes.data ?? []) as License[];
  const ordens = (ordRes.data ?? []) as Order[];
  const pagamentos = (payRes.data ?? []) as Payment[];

  const totalPago = ordens
    .filter((o) => o.status === 'approved')
    .reduce((a, o) => a + Number(o.amount_brl), 0);

  const planosRes = await supabase.from('plans').select('*').order('sort');
  const planos = (planosRes.data ?? []) as Plan[];

  const pendentes = ordens.filter(
    (o) =>
      (o.status === 'pending' || o.status === 'in_process') ||
      (o.status === 'approved' && !o.license_issued),
  );

  return (
    <AdminShell
      titulo={perfil.full_name || perfil.email}
      descricao={`${perfil.email} · conta de ${formatDate(perfil.created_at)} · cargo ${perfil.role}`}
      acao={
        <Link href="/admin/clientes" className="btn-ghost btn-sm">
          ← Todos os clientes
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi rotulo="Total pago" valor={formatBRL(totalPago)} />
        <Kpi rotulo="Pedidos" valor={String(ordens.length)} />
        <Kpi rotulo="Licenças" valor={String(licencas.length)} />
        <Kpi rotulo="Transações" valor={String(pagamentos.length)} />
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Pedidos</h2>
        </div>
        {ordens.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum pedido.</p>
        ) : (
          <ul className="divide-y divide-border">
            {ordens.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{o.external_reference}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(o.created_at)} · {o.method ?? '—'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono">{formatBRL(o.amount_brl)}</span>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {o.status}
                  </span>
                  {o.license_issued && <span className="text-xs text-success">chave emitida</span>}
                  {o.license_error && (
                    <span className="max-w-[240px] truncate text-xs text-danger" title={o.license_error}>
                      {o.license_error}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-semibold">Licenças e ações</h2>
          <LicencaManager licencas={licencas} planos={planos} pendentes={pendentes} />
        </div>

        <div className="surface h-fit overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Transações</h2>
          </div>
          {pagamentos.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma transação registrada.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pagamentos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <div>
                    <div className="capitalize">{p.method ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(p.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{formatBRL(p.amount_brl)}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{p.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
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