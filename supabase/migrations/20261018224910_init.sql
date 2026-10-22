-- ===========================================================================
-- Proex — schema inicial
-- Aplicado em qacoswxzvviifsatvwxi como migration 20261018224910_0001_init.
--
-- ORDEM IMPORTA: is_admin() e LANGUAGE sql, validado contra o catalogo na
-- criacao, entao public.profiles precisa existir antes dele.
--
-- RLS e ligado na MESMA transacao do create table: uma tabela public sem RLS
-- no PostgREST fica legivel/gravavel com a anon key e exporia licenses.key.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Helper admin (security definer evita recursao infinita de policy em profiles)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- trigger de criacao de perfil no signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- plans (editaveis no admin; precos refletem na landing)
-- ---------------------------------------------------------------------------
create table public.plans (
  slug         text primary key check (slug ~ '^cc_\d+d$'),
  name         text not null,
  dias         integer not null check (dias between 1 and 365),
  price_brl    numeric(10,2) not null check (price_brl >= 0),
  description  text,
  highlight    boolean not null default false,
  active       boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.plans enable row level security;

-- ---------------------------------------------------------------------------
-- orders — amount_brl CONGELADO na criacao. O webhook honra este valor,
-- nunca o preco atual do plano (um admin pode editar o plano no meio do PIX).
-- ---------------------------------------------------------------------------
create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  -- usado como external_reference no MP E como orderId no activate/renew
  -- upstream. Sempre presente: e o dedupe do lado da API de licencas.
  external_reference text not null unique,
  customer_id        uuid references public.profiles (id) on delete set null,
  customer_email     text not null,
  plan_slug          text not null references public.plans (slug),
  amount_brl         numeric(10,2) not null check (amount_brl >= 0),
  method             text check (method in ('pix', 'card')),
  status             text not null default 'pending'
                     check (status in ('pending','in_process','approved','rejected','cancelled','refunded')),
  mp_preference_id   text,
  mp_payment_id      text,
  mp_payment_status  text,
  license_issued     boolean not null default false,
  license_error      text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.orders enable row level security;
create index orders_customer_idx  on public.orders (customer_id, created_at desc);
create index orders_status_idx    on public.orders (status);
create index orders_payment_idx   on public.orders (mp_payment_id);

-- ---------------------------------------------------------------------------
-- licenses — guarda a chave em texto puro porque o painel tem que exibir e
-- copiar. A RLS impede a leitura cruzada e a chave NUNCA pode ir para log.
-- ---------------------------------------------------------------------------
create table public.licenses (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid references public.profiles (id) on delete set null,
  customer_email text not null,
  plan_slug      text not null references public.plans (slug),
  key            text not null unique,
  key_hint       text not null,            -- sk-px-...abcd, para listas
  status         text not null default 'active'
                 check (status in ('active', 'expired', 'revoked')),
  order_id       uuid references public.orders (id) on delete set null,
  issued_at      timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  revoked_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.licenses enable row level security;
create index licenses_customer_idx on public.licenses (customer_id, created_at desc);
create index licenses_email_idx    on public.licenses (customer_email);
-- um pedido gera UMA chave: trava duplicidade no banco se dois webhooks
-- simultaneos tentarem emitir ao mesmo tempo.
create unique index licenses_order_uniq on public.licenses (order_id) where order_id is not null;

-- ---------------------------------------------------------------------------
-- payments — historico de cobranca exibido no painel (cliente + admin)
-- ---------------------------------------------------------------------------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  customer_id   uuid references public.profiles (id) on delete set null,
  mp_payment_id text,
  method        text check (method in ('pix', 'card')),
  amount_brl    numeric(10,2) not null,
  installments  smallint,
  status        text not null,
  status_detail text,
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.payments enable row level security;
-- unica, mas admite NULOS (postgres permite varios NULL em unique)
create unique index payments_mp_id_uniq on public.payments (mp_payment_id);
create index payments_customer_idx on public.payments (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- webhook_events — idempotencia. MP reenvia e entrega fora de ordem.
-- payload ja SANITIZADO (sem PII de cartao) antes de gravar.
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id            bigint generated always as identity primary key,
  event_id      text not null unique,
  topic         text,
  mp_payment_id text,
  status_raw    text,
  payload       jsonb,
  result        text not null default 'processed' check (result in ('processed','ignored','error')),
  error         text,
  received_at   timestamptz not null default now()
);
alter table public.webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- license_events — auditoria de activate / renew / revoke / falha
-- ---------------------------------------------------------------------------
create table public.license_events (
  id         bigint generated always as identity primary key,
  license_id uuid references public.licenses (id) on delete set null,
  order_id   uuid references public.orders (id) on delete set null,
  action     text not null check (action in ('activate','renew','revoke','reprocess','failed')),
  detail     text,
  actor      text not null default 'system',
  created_at timestamptz not null default now()
);
alter table public.license_events enable row level security;
create index license_events_license_idx on public.license_events (license_id, created_at desc);

-- ---------------------------------------------------------------------------
-- usage_snapshots — schema pronto; o feed da API entra depois.
-- Uma linha por janela de 1h por licenca/modelo.
-- ---------------------------------------------------------------------------
create table public.usage_snapshots (
  id           bigint generated always as identity primary key,
  license_id   uuid not null references public.licenses (id) on delete cascade,
  customer_id  uuid references public.profiles (id) on delete set null,
  bucket_start timestamptz not null,          -- inicio da janela de 60 min
  model        text not null default '',      -- '' = agregado geral (permite unique simples)
  tokens_in    bigint not null default 0,
  tokens_out   bigint not null default 0,
  requests     bigint not null default 0,
  rate_limit   bigint not null default 80000000,  -- politica de uso justo
  created_at   timestamptz not null default now()
);
alter table public.usage_snapshots enable row level security;
create unique index usage_bucket_uniq on public.usage_snapshots (license_id, bucket_start, model);
create index usage_customer_idx on public.usage_snapshots (customer_id, bucket_start desc);

-- ===========================================================================
-- RLS
-- ===========================================================================

create policy "profiles: read own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Colunas: o usuario comum so pode mexer no nome. Sem isso, um UPDATE
-- proprio em role = 'admin' se promovia sem passar por is_admin().
revoke all on table public.profiles from anon, authenticated;
grant select, update (full_name, updated_at) on table public.profiles to authenticated;

create policy "plans: read active or admin"
  on public.plans for select
  using (active or public.is_admin());

create policy "orders: read own or admin"
  on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "licenses: read own or admin"
  on public.licenses for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "payments: read own or admin"
  on public.payments for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "usage: read own or admin"
  on public.usage_snapshots for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "webhook_events: admin only"
  on public.webhook_events for select
  using (public.is_admin());

create policy "license_events: admin only"
  on public.license_events for select
  using (public.is_admin());

-- Nenhuma policy de INSERT/UPDATE/DELETE para orders, licenses, payments,
-- usage_snapshots, webhook_events, license_events, plans: essas tabelas sao
-- escritas exclusivamente pela service role (server-side).

-- ===========================================================================
-- updated_at
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger t_profiles_touch   before update on public.profiles   for each row execute function public.touch_updated_at();
create trigger t_plans_touch      before update on public.plans      for each row execute function public.touch_updated_at();
create trigger t_orders_touch     before update on public.orders     for each row execute function public.touch_updated_at();
create trigger t_licenses_touch   before update on public.licenses   for each row execute function public.touch_updated_at();
create trigger t_payments_touch   before update on public.payments   for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Seed — planos confirmados
-- ===========================================================================
insert into public.plans (slug, name, dias, price_brl, description, highlight, sort) values
  ('cc_3d',  'Claude Code · 3 dias',   3,  49.00, 'Para uma rodada de ajustes.',            false, 1),
  ('cc_7d',  'Claude Code · 7 dias',   7,  89.00, 'A semana inteira de trabalho.',          false, 2),
  ('cc_15d', 'Claude Code · 15 dias', 15, 159.00, 'Projeto longo, sem contar token.',       false, 3),
  ('cc_30d', 'Claude Code · 30 dias', 30, 279.00, 'Mes inteiro. Melhor custo por dia.',     true,  4)
on conflict (slug) do nothing;
