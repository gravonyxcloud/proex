import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import type { SupportTicket } from '@/types/db';
import { catLabel, relativeTime, statusRank, StatusPill } from '@/components/support/ticket-status';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suporte | Admin' };

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'aguardando', label: 'Aguardando nós' },
  { key: 'cliente', label: 'Aguardando cliente' },
  { key: 'encerrados', label: 'Encerrados' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function matchesFilter(t: SupportTicket, f: FilterKey): boolean {
  if (f === 'aguardando') return t.status === 'open' || t.status === 'in_progress';
  if (f === 'cliente') return t.status === 'waiting_customer';
  if (f === 'encerrados') return t.status === 'resolved' || t.status === 'closed';
  return true;
}

export default async function AdminSuportePage({
  searchParams,
}: {
  searchParams: { filtro?: string; q?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return null;

  const { data, error } = await supabase.from('support_tickets').select('*');
  const all = (data ?? []) as SupportTicket[];

  const filtro: FilterKey = (FILTERS.find((f) => f.key === searchParams.filtro)?.key ?? 'todos') as FilterKey;
  const q = (searchParams.q ?? '').trim().toLowerCase();

  const list = all
    .filter((t) => matchesFilter(t, filtro))
    .filter((t) => {
      if (!q) return true;
      return (
        t.ticket_number.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.customer_email.toLowerCase().includes(q)
      );
    })
    // urgência primeiro; dentro do mesmo status, o mais antigo sem resposta sobe
    .sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status);
      if (r !== 0) return r;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.last_message_at).getTime() - new Date(b.last_message_at).getTime();
    });

  const counts = {
    aguardando: all.filter((t) => matchesFilter(t, 'aguardando')).length,
    cliente: all.filter((t) => matchesFilter(t, 'cliente')).length,
    encerrados: all.filter((t) => matchesFilter(t, 'encerrados')).length,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Suporte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.aguardando > 0
              ? `${counts.aguardando} ${counts.aguardando === 1 ? 'ticket esperando' : 'tickets esperando'} atendimento.`
              : 'Nenhum ticket esperando atendimento.'}
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          Não foi possível carregar a fila: {error.message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            { label: 'Aguardando nós', value: counts.aguardando, tone: 'text-amber-300' },
            { label: 'Aguardando cliente', value: counts.cliente, tone: 'text-violet-300' },
            { label: 'Encerrados', value: counts.encerrados, tone: 'text-emerald-300' },
          ] as const
        ).map((s) => (
          <div key={s.label} className="surface px-5 py-4">
            <div className={`font-display text-2xl font-semibold ${s.tone}`}>{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-1.5" aria-label="Filtro de tickets">
            {FILTERS.map((f) => {
              const ativo = f.key === filtro;
              const params = new URLSearchParams();
              if (f.key !== 'todos') params.set('filtro', f.key);
              if (q) params.set('q', searchParams.q ?? '');
              const href = params.toString() ? `/admin/suporte?${params}` : '/admin/suporte';
              return (
                <Link
                  key={f.key}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    ativo ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </nav>

          <form className="flex gap-2" action="/admin/suporte">
            {filtro !== 'todos' && <input type="hidden" name="filtro" value={filtro} />}
            <input
              name="q"
              defaultValue={searchParams.q ?? ''}
              placeholder="Buscar ticket, assunto ou e-mail…"
              className="input py-1.5 text-xs sm:w-64"
            />
            <button type="submit" className="btn-outline btn-sm">
              Buscar
            </button>
          </form>
        </div>

        {list.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {q ? 'Nenhum ticket corresponde à busca.' : 'Nenhum ticket na fila.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((t) => {
              const semResposta = t.status === 'open';
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/suporte/${t.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-muted/40 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          semResposta ? 'animate-pulse-soft bg-amber-400' : 'bg-border'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                          <StatusPill status={t.status} />
                          {!t.ai_enabled && t.ai_handoff_at && (
                            <span
                              className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                              title={t.ai_handoff_reason ?? undefined}
                            >
                              IA pausada
                            </span>
                          )}
                          {t.priority >= 5 && (
                            <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] text-danger">
                              prioridade {t.priority}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{t.subject}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {t.customer_email} · {catLabel(t.category)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 pl-5 text-xs text-muted-foreground sm:pl-0">
                      <time dateTime={t.last_message_at} title={new Date(t.last_message_at).toLocaleString('pt-BR')}>
                        {relativeTime(t.last_message_at)}
                      </time>
                      <span className="text-primary">Atender →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
