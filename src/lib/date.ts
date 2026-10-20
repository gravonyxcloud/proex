const dtf = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dtfFull = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dtfShort = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return dtf.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return dtfFull.format(d);
}

export function formatShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return dtfShort.format(d);
}

/** "12 dias restantes" / "expira hoje" / "expirada" */
export function formatDaysLeft(expiresAt: string | null | undefined): string {
  if (!expiresAt) return '—';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diff)) return '—';
  if (diff <= 0) return 'Expirada';

  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return `Expira em ${Math.max(1, Math.floor(diff / 60_000))} min`;
  if (hours < 24) return `${hours}h restantes`;

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days === 1) return '1 dia restante';
  return restHours > 0 ? `${days} dias e ${restHours}h restantes` : `${days} dias restantes`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '—';
  const abs = Math.abs(diff);
  const past = diff >= 0;

  const m = Math.floor(abs / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return past ? `há ${m} min` : `em ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return past ? `há ${h}h` : `em ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return past ? `há ${d} dia${d > 1 ? 's' : ''}` : `em ${d} dia${d > 1 ? 's' : ''}`;
  return formatDate(iso);
}
