'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  adminActivate,
  adminRevoke,
  adminRenew,
  adminUnrevoke,
} from '@/actions/licenses';
import { reprocessLicense, syncOrder } from '@/actions/orders';
import { useToast } from '@/components/ui/toaster';
import { formatBRL } from '@/lib/money';
import type { License, Order, Plan } from '@/types/db';

type Tab = 'licencas' | 'ativar' | 'renovar' | 'pendentes';

export function LicencaManager({
  licencas,
  planos,
  pendentes,
}: {
  licencas: (License & { profiles?: { full_name: string | null } | null })[];
  planos: Plan[];
  pendentes: Order[];
}) {
  const [tab, setTab] = useState<Tab>(licencas.length === 0 ? 'ativar' : 'licencas');

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'licencas', label: 'Licenças', count: licencas.length },
    { id: 'pendentes', label: 'Ativações pendentes', count: pendentes.length },
    { id: 'ativar', label: 'Ativar licença' },
    { id: 'renovar', label: 'Renovar licença' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'licencas' && <LicencaTable licencas={licencas} />}
      {tab === 'pendentes' && <PendenteTable pendentes={pendentes} />}
      {tab === 'ativar' && <AtivarForm planos={planos} />}
      {tab === 'renovar' && <RenovarForm planos={planos} licencas={licencas} />}
    </div>
  );
}

/* --------------------------------------------------------------- LICENÇAS */

function LicencaTable({
  licencas,
}: {
  licencas: (License & { profiles?: { full_name: string | null } | null })[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function revogar(l: License) {
    const motivo = window.prompt(
      `Revogar ${l.key_hint}?\n\nMotivo (fica na auditoria):`,
      'Divisão de chave',
    );
    if (motivo === null) return;

    setBusy(l.id);
    const prev = new FormData();
    prev.set('licenseId', l.id);
    prev.set('reason', motivo);
    const res = await adminRevoke(null, prev);
    setBusy(null);

    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    router.refresh();
  }

  async function reativar(l: License) {
    setBusy(l.id);
    const res = await adminUnrevoke(l.id);
    setBusy(null);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    router.refresh();
  }

  if (licencas.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-muted-foreground">
        Nenhuma licença emitida até agora.
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Chave</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {licencas.map((l) => (
              <tr key={l.id} className="transition hover:bg-white/[0.02]">
                <td className="px-5 py-3.5 font-mono text-xs">{l.key_hint}</td>
                <td className="px-4 py-3.5">
                  <div className="max-w-[220px] truncate">{l.customer_email}</div>
                  {l.profiles?.full_name && (
                    <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {l.profiles.full_name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5">{l.plan_slug.replace('cc_', '').replace('d', ' dias')}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">{l.expires_at.slice(0, 10)}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      l.status === 'active'
                        ? 'border-success/40 bg-success/15 text-success'
                        : l.status === 'revoked'
                          ? 'border-border bg-muted text-muted-foreground'
                          : 'border-danger/40 bg-danger/15 text-danger'
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {l.status === 'revoked' ? (
                    <button
                      onClick={() => reativar(l)}
                      disabled={busy === l.id}
                      className="btn-outline btn-sm"
                    >
                      Reativar
                    </button>
                  ) : (
                    <button
                      onClick={() => revogar(l)}
                      disabled={busy === l.id}
                      className="btn-ghost btn-sm hover:border-danger/40 hover:text-danger"
                    >
                      {busy === l.id ? '…' : 'Revogar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-5 py-3.5 text-xs leading-relaxed text-muted-foreground">
        Revogação é <strong className="text-foreground">local</strong>: a API upstream ainda não tem
        endpoint de revogação, então a chave continua valendo na ponte até o bloqueio ser solicitado
        à equipe da API. O evento fica registrado na auditoria.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- PENDENTES */

function PendenteTable({ pendentes }: { pendentes: Order[] }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function sincronizar(o: Order) {
    setBusy(`s-${o.id}`);
    const res = await syncOrder(o.id);
    setBusy(null);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    router.refresh();
  }

  async function reemitir(o: Order) {
    setBusy(`r-${o.id}`);
    const res = await reprocessLicense(o.id);
    setBusy(null);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    router.refresh();
  }

  if (pendentes.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-muted-foreground">
        Nenhuma ativação pendente. Tudo em dia.
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pendentes.map((o) => (
              <tr key={o.id} className="transition hover:bg-white/[0.02]">
                <td className="px-5 py-3.5">
                  <div className="font-mono text-xs">{o.external_reference}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.plan_slug.replace('cc_', '').replace('d', ' dias')}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="max-w-[220px] truncate">{o.customer_email}</div>
                </td>
                <td className="px-4 py-3.5 text-right font-mono">{formatBRL(o.amount_brl)}</td>
                <td className="px-4 py-3.5">
                  <div className="text-xs font-semibold uppercase">{o.status}</div>
                  {o.license_error && (
                    <div className="max-w-[240px] truncate text-xs text-danger" title={o.license_error}>
                      {o.license_error}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => sincronizar(o)}
                      disabled={busy !== null}
                      className="btn-outline btn-sm"
                    >
                      {busy === `s-${o.id}` ? '…' : 'Sincronizar'}
                    </button>
                    {o.status === 'approved' && !o.license_issued && (
                      <button
                        onClick={() => reemitir(o)}
                        disabled={busy !== null}
                        className="btn-primary btn-sm"
                      >
                        {busy === `r-${o.id}` ? '…' : 'Emitir chave'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ FORMS */

function AtivarForm({ planos }: { planos: Plan[] }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await adminActivate(null, fd);
    setBusy(false);

    if (res.ok) {
      toast.success(res.message);
      e.currentTarget.reset();
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface p-6">
      <h2 className="text-sm font-semibold">Ativar licença manualmente</h2>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Venda fechada fora do site, cortesia ou ajuste. Requer segredo de licença configurado no
        servidor.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="a-email" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            E-mail do cliente
          </label>
          <input id="a-email" name="email" type="email" className="input" required />
        </div>
        <div>
          <label htmlFor="a-plan" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Plano
          </label>
          <select id="a-plan" name="planSlug" className="input" defaultValue={planos[0]?.slug ?? 'cc_30d'}>
            {planos.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} — {formatBRL(p.price_brl)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="a-order" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            orderId <span className="normal-case">(opcional — evita duplicidade)</span>
          </label>
          <input
            id="a-order"
            name="orderId"
            className="input font-mono"
            placeholder="pedido-123"
            maxLength={64}
          />
        </div>
      </div>

      <button type="submit" className="btn-primary mt-5" disabled={busy}>
        {busy ? 'Ativando…' : 'Ativar agora'}
      </button>
    </form>
  );
}

function RenovarForm({
  planos,
  licencas,
}: {
  planos: Plan[];
  licencas: License[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chave, setChave] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await adminRenew(null, fd);
    setBusy(false);

    if (res.ok) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface p-6">
      <h2 className="text-sm font-semibold">Renovar licença existente</h2>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Mantém a mesma chave e soma o prazo ao vencimento atual (ou a partir de agora, se já
        venceu).
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="r-email" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            E-mail cadastrado
          </label>
          <input id="r-email" name="email" type="email" className="input" required />
        </div>

        <div>
          <label htmlFor="r-key" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Chave atual
          </label>
          {licencas.length > 0 ? (
            <select
              id="r-key"
              name="key"
              className="input font-mono"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              required
            >
              <option value="">selecione…</option>
              {licencas.map((l) => (
                <option key={l.id} value={l.key}>
                  {l.key_hint} — {l.customer_email}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="r-key"
              name="key"
              className="input font-mono"
              placeholder="sk-px-..."
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              required
            />
          )}
        </div>

        <div>
          <label htmlFor="r-plan" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            Plano a somar
          </label>
          <select id="r-plan" name="planSlug" className="input" defaultValue={planos[0]?.slug ?? 'cc_30d'}>
            {planos.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name} — {formatBRL(p.price_brl)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="r-order" className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            orderId <span className="normal-case">(opcional)</span>
          </label>
          <input id="r-order" name="orderId" className="input font-mono" placeholder="renovacao-456" maxLength={64} />
        </div>
      </div>

      <button type="submit" className="btn-primary mt-5" disabled={busy}>
        {busy ? 'Renovando…' : 'Renovar'}
      </button>
    </form>
  );
}
