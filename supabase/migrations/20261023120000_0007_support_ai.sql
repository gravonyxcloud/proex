-- ===========================================================================
-- Proex — Atendimento automático por IA no suporte
--
-- A IA responde todo ticket novo e toda réplica do cliente. Ela mesma desliga
-- (ai_enabled = false) quando precisa passar para humano, e um admin pode
-- assumir a qualquer momento pelo painel.
--
-- ai_running funciona como trava: evita duas gerações simultâneas no mesmo
-- ticket quando o cliente abre o ticket e responde em seguida.
-- ===========================================================================

alter table public.support_tickets
  add column if not exists ai_enabled     boolean not null default true,
  add column if not exists ai_running     boolean not null default false,
  add column if not exists ai_handoff_at  timestamptz,
  add column if not exists ai_handoff_reason text,
  add column if not exists ai_last_reply_at  timestamptz;

alter table public.support_messages
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_model     text;

-- Fila: tickets que a IA está tocando continuam elegíveis a novo disparo.
create index if not exists support_tickets_ai_idx
  on public.support_tickets (ai_enabled, status, last_message_at desc);

-- Rede de segurança: se um processo morrer no meio, a trava não fica presa.
create index if not exists support_tickets_ai_running_idx
  on public.support_tickets (ai_running)
  where ai_running = true;
