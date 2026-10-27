import type { SupportTicketCategory, SupportTicketStatus } from '@/types/db';

export function statusLabel(s: SupportTicketStatus | string, viewer: 'admin' | 'customer' = 'admin'): string {
  switch (s) {
    case 'open':
      return viewer === 'customer' ? 'Aguardando atendimento' : 'Aberto';
    case 'in_progress':
      return 'Em atendimento';
    case 'waiting_customer':
      return viewer === 'customer' ? 'Aguardando sua resposta' : 'Aguardando cliente';
    case 'resolved':
      return 'Resolvido';
    case 'closed':
      return 'Fechado';
    default:
      return s;
  }
}

/** Classes da pílula de status. Mesmo par cor/semântica nas duas telas. */
export function statusClass(s: SupportTicketStatus | string): string {
  switch (s) {
    case 'open':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case 'in_progress':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'waiting_customer':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-300';
    case 'resolved':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'closed':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400';
    default:
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400';
  }
}

/** Ordem de urgência na fila do admin. Menor = mais no topo. */
export function statusRank(s: SupportTicketStatus | string): number {
  switch (s) {
    case 'open':
      return 0;
    case 'in_progress':
      return 1;
    case 'waiting_customer':
      return 2;
    case 'resolved':
      return 3;
    case 'closed':
      return 4;
    default:
      return 5;
  }
}

export function catLabel(c: SupportTicketCategory | string): string {
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

export function StatusPill({
  status,
  viewer = 'admin',
}: {
  status: SupportTicketStatus | string;
  viewer?: 'admin' | 'customer';
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusClass(status)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {statusLabel(status, viewer)}
    </span>
  );
}

/** "há 3 min", "há 2 h", "há 4 dias" — usado na fila e no cabeçalho do chat. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
