-- ===========================================================================
-- Proex — Suporte com fila (tickets)
--
-- Suporte APENAS para clientes autenticados.
-- Cliente vê/cria apenas seus próprios tickets.
-- Agente (você) atende via CLI com service-role (ler tudo, responder, fechar).
-- Suporta prints/anexos e snapshot de contexto (licenças/pedidos) na abertura.
-- ===========================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Numeração legível: PROEX-000001
-- ---------------------------------------------------------------------------
create sequence if not exists public.support_ticket_number_seq;

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id                uuid primary key default gen_random_uuid(),
  ticket_number     text not null unique default (
    'PROEX-' || lpad(nextval('public.support_ticket_number_seq')::text, 6, '0')
  ),
  customer_id       uuid references public.profiles (id) on delete set null,
  customer_email    text not null,
  subject           text not null,
  category          text not null default 'outro'
                    check (category in (
                      'chave_nao_chegou',
                      'nao_autentica',
                      'rate_limit',
                      'renovacao',
                      'reembolso',
                      'configuracao',
                      'outro'
                    )),
  status            text not null default 'open'
                    check (status in ('open','in_progress','waiting_customer','resolved','closed')),
  priority          integer not null default 0,  -- maior = mais prioritário
  assigned_to       text,                        -- 'agent' quando eu estiver atendendo
  context_snapshot  jsonb not null default '[]'::jsonb, -- licenças/pedidos no momento da abertura
  last_message_at   timestamptz not null default now(),
  last_customer_at  timestamptz,
  last_agent_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index if not exists support_tickets_customer_idx on public.support_tickets (customer_id, created_at desc);
create index if not exists support_tickets_status_idx   on public.support_tickets (status, priority desc, last_message_at asc);
create index if not exists support_tickets_email_idx    on public.support_tickets (customer_email, created_at desc);

-- ---------------------------------------------------------------------------
-- Mensagens
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.support_tickets (id) on delete cascade,
  sender_type   text not null check (sender_type in ('customer','agent','system')),
  sender_id     uuid references auth.users (id) on delete set null,
  message       text not null,
  attachments   jsonb not null default '[]'::jsonb, -- [{bucket,path,name,size,type}]
  internal_note boolean not null default false,    -- notas internas (só agente vê)
  created_at    timestamptz not null default now()
);

alter table public.support_messages enable row level security;

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists t_support_tickets_touch on public.support_tickets;
create trigger t_support_tickets_touch
  before update on public.support_tickets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: cliente só vê seus tickets/mensagens (não internas)
-- ---------------------------------------------------------------------------
drop policy if exists "support_tickets: read own or admin" on public.support_tickets;
create policy "support_tickets: read own or admin"
  on public.support_tickets for select
  using (
    customer_id = auth.uid()
    or customer_email = (auth.jwt() ->> 'email')
    or public.is_admin()
  );

drop policy if exists "support_tickets: insert own" on public.support_tickets;
create policy "support_tickets: insert own"
  on public.support_tickets for insert
  with check (
    auth.uid() is not null
    and (
      customer_id = auth.uid()
      or customer_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "support_tickets: update own or admin" on public.support_tickets;
create policy "support_tickets: update own or admin"
  on public.support_tickets for update
  using (
    (customer_id = auth.uid() or customer_email = (auth.jwt() ->> 'email'))
    or public.is_admin()
  );

drop policy if exists "support_messages: read own non-internal or admin" on public.support_messages;
create policy "support_messages: read own non-internal or admin"
  on public.support_messages for select
  using (
    internal_note = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and (t.customer_id = auth.uid() or t.customer_email = (auth.jwt() ->> 'email'))
    )
    or public.is_admin()
  );

drop policy if exists "support_messages: insert own or admin" on public.support_messages;
create policy "support_messages: insert own or admin"
  on public.support_messages for insert
  with check (
    (
      sender_type = 'customer'
      and sender_id = auth.uid()
      and internal_note = false
      and exists (
        select 1 from public.support_tickets t
        where t.id = support_messages.ticket_id
          and (t.customer_id = auth.uid() or t.customer_email = (auth.jwt() ->> 'email'))
          and t.status <> 'closed'
      )
    )
    or public.is_admin()
  );

-- Agent/admin usa service-role para tudo (ignora RLS). Sem policies para service-role.
-- ===========================================================================
-- Storage bucket (prints/anexos)
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false, -- privado, sempre via signed URL
  10485760, -- 10MB
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic','image/heif','application/pdf','text/plain']
)
on conflict (id) do nothing;

-- Policies de storage (cliente só upa em caminho próprio)
drop policy if exists "support_attachments: upload own" on storage.objects;
create policy "support_attachments: upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'support-attachments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "support_attachments: read own or admin" on storage.objects;
create policy "support_attachments: read own or admin"
  on storage.objects for select
  using (
    bucket_id = 'support-attachments'
    and (
      auth.uid() is not null
      and (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "support_attachments: delete own or admin" on storage.objects;
create policy "support_attachments: delete own or admin"
  on storage.objects for delete
  using (
    bucket_id = 'support-attachments'
    and (
      auth.uid() is not null
      and (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
