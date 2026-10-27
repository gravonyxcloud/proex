import type { SupportAttachment, SupportMessage } from '@/types/db';

export type ChatViewer = 'admin' | 'customer';

interface ChatThreadProps {
  messages: SupportMessage[];
  /** quem está olhando — define de que lado ficam as bolhas */
  viewer: ChatViewer;
  /** anexos já resolvidos em signed URL, na mesma ordem de `messages` */
  attachments?: SupportAttachment[][];
  /** dica mostrada quando não há mensagens */
  emptyLabel?: string;
}

function senderName(m: SupportMessage, viewer: ChatViewer): string {
  if (m.sender_type === 'agent') return m.ai_generated ? 'Suporte (IA)' : 'Suporte Proex';
  if (m.sender_type === 'system') return 'Nota interna';
  return viewer === 'admin' ? 'Cliente' : 'Você';
}

function initials(m: SupportMessage): string {
  if (m.sender_type === 'agent') return 'PX';
  if (m.sender_type === 'system') return '!';
  return 'C';
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  if (dayKey(iso) === dayKey(hoje.toISOString())) return 'Hoje';
  if (dayKey(iso) === dayKey(ontem.toISOString())) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼';
  if (type === 'application/pdf') return '📄';
  return '📎';
}

function AttachmentChip({ a }: { a: SupportAttachment }) {
  const isImage = a.type.startsWith('image/') && Boolean(a.url);

  if (isImage) {
    return (
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block w-40 overflow-hidden rounded-xl border border-border bg-muted/40 transition hover:border-primary/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.name} className="h-28 w-full object-cover" />
        <span className="block truncate px-2 py-1.5 text-[11px] text-muted-foreground group-hover:text-foreground">
          {a.name}
        </span>
      </a>
    );
  }

  const inner = (
    <>
      <span aria-hidden>{fileIcon(a.type)}</span>
      <span className="max-w-[22ch] truncate">{a.name}</span>
      <span className="text-muted-foreground/70">{Math.round(a.size / 1024)}KB</span>
    </>
  );

  if (!a.url) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
        {inner}
      </span>
    );
  }

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-primary transition hover:border-primary/50 hover:bg-primary/10"
    >
      {inner}
    </a>
  );
}

/**
 * Conversa em formato de chat.
 *
 * Server component de propósito: as signed URLs dos anexos são resolvidas no
 * servidor e chegam prontas em `attachments`.
 */
export function ChatThread({
  messages,
  viewer,
  attachments = [],
  emptyLabel = 'Nenhuma mensagem ainda.',
}: ChatThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="grid place-items-center px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="space-y-1 px-4 py-5 sm:px-6">
      {messages.map((m, i) => {
        const day = dayKey(m.created_at);
        const showDay = day !== lastDay;
        lastDay = day;

        const isSystem = m.sender_type === 'system' || m.internal_note;
        const mine = viewer === 'admin' ? m.sender_type === 'agent' : m.sender_type === 'customer';
        const files = attachments[i] ?? [];

        return (
          <div key={m.id}>
            {showDay && (
              <div className="flex items-center gap-3 py-4">
                <span className="h-px flex-1 bg-border" />
                <span className="rounded-full border border-border bg-card px-3 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {dayLabel(m.created_at)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            {isSystem ? (
              <div className="py-2">
                <div className="mx-auto max-w-xl rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-amber-400/90">
                    <span aria-hidden>🔒</span>
                    {senderName(m, viewer)}
                    {m.internal_note && (
                      <span className="normal-case tracking-normal text-muted-foreground">visível só para a equipe</span>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{m.message}</p>
                  <time className="mt-1.5 block text-[11px] text-muted-foreground/70">{timeLabel(m.created_at)}</time>
                </div>
              </div>
            ) : (
              <div className={`flex items-end gap-2.5 py-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    m.sender_type === 'agent'
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                      : 'bg-muted text-muted-foreground ring-1 ring-border'
                  }`}
                  aria-hidden
                >
                  {initials(m)}
                </span>

                <div className={`flex max-w-[min(85%,34rem)] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div className={`mb-1 flex items-center gap-2 text-[11px] text-muted-foreground ${mine ? 'flex-row-reverse' : ''}`}>
                    <span className="font-medium text-foreground/80">{senderName(m, viewer)}</span>
                    {m.ai_generated && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
                        IA
                      </span>
                    )}
                    <time>{timeLabel(m.created_at)}</time>
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.sender_type === 'agent'
                        ? 'rounded-br-md border border-primary/25 bg-primary/10 text-foreground'
                        : 'rounded-bl-md border border-border bg-muted/60 text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  </div>

                  {files.length > 0 && (
                    <div className={`mt-2 flex flex-wrap gap-2 ${mine ? 'justify-end' : ''}`}>
                      {files.map((a, k) => (
                        <AttachmentChip key={a.path || k} a={a} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
