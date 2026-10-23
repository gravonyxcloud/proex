import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';
import type { SupportTicket } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suporte | Admin' };

function statusLabel(s: string) {
  switch (s) {
    case 'open':
      return 'Aberto';
    case 'in_progress':
      return 'Em atendimento';
    case 'waiting_customer':
      return 'Aguardando cliente';
    case 'resolved':
      return 'Resolvido';
    case 'closed':
      return 'Fechado';
    default:
      return s;
  }
}

function statusClass(s: string) {
  switch (s) {
    case 'open':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'in_progress':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'waiting_customer':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'closed':
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    default:
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }
}

function catLabel(c: string) {
  switch (c) {
    case 'chave_nao_chegou':
      return 'Chave não chegou';
    case 'nao_autentica':
      return 'Chave não autentica';
    case 'rate_limit':
      return 'Rate limit';
    case 'renovacao':
      return 'Renovação';
    case 'reembolso':
      return 'Reembolso';
    case 'configuracao':
      return 'Configuração';
    default:
      return 'Outro';
  }
}

export default async function AdminSuportePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return null;

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
    .order('status', { ascending: true }) // open/in_progress primeiro? vamos por prioridade + tempo
    .order('priority', { ascending: false })
    .order('last_message_at', { ascending: true });

  const list = (tickets ?? []) as SupportTicket[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Suporte · Fila</h1>
        <p className="text-sm text-muted-foreground">Todos os tickets. Use a CLI para atender mais rápido, ou direto nesta tela.</p>
      </header>

      <section className="surface">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Fila de atendimento</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-6 py-3">Ticket</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Prioridade</th>
                <th className="px-6 py-3">Última msg</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-muted-foreground">
                    Nenhum ticket na fila.
                  </td>
                </tr>
              ) : (
                list.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40">
                    <td className="px-6 py-3">
                      <div className="font-medium">{t.ticket_number}</div>
                      <div className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground">{t.subject}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="max-w-[200px] truncate">{t.customer_email}</div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{catLabel(t.category)}</td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(t.status)}`}>
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{t.priority}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">
                      {new Date(t.last_message_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/admin/suporte/${t.id}`} className="text-xs text-primary hover:underline">
                        Atender →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
