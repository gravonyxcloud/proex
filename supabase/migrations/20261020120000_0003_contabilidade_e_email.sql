-- ===========================================================================
-- Proex — contabilidade (taxas, saques, configurações) + rastreio do e-mail
-- da chave.
--
-- Aplicado em qacoswxzvviifsatvwxi.
--
-- Regra de ouro daqui pra frente: valor BRUTO fica em payments.amount_brl
-- (é o que o Mercado Pago cobrou). Taxa e líquido são DERIVADOS e ficam
-- gravados para a contabilidade não mudar de resultado se a taxa for editada
-- depois. O caixa da operação é sempre SUM(net_brl) - SUM(withdrawals.amount_brl).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- app_settings — linha única (id = true) com as taxas da operação.
-- Editável no /admin/contabilidade.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id                boolean primary key default true check (id),  -- trava em 1 linha
  store_name        text not null default 'Proex',
  -- Taxa do gateway, em % sobre o bruto (Mercado Pago ~4,99% no cartão à vista)
  mp_fee_percent    numeric(6,3) not null default 4.990 check (mp_fee_percent between 0 and 100),
  -- Taxa fixa por transação, em R$; o PIX costuma ser menor que o cartão
  mp_fee_fixed_brl  numeric(10,2) not null default 0.00 check (mp_fee_fixed_brl >= 0),
  -- Reserva para imposto/taxa de recebimento, em % do líquido.
  -- NÃO vai para payments.fee_brl — é descontada só no lucro estimado.
  tax_percent       numeric(6,3) not null default 0.000 check (tax_percent between 0 and 100),
  updated_at        timestamptz not null default now()
);
alter table public.app_settings enable row level security;

create policy "app_settings: admin read"
  on public.app_settings for select
  using (public.is_admin());

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

create trigger t_app_settings_touch
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- payments — a taxa fica CONGELADA no momento em que o pagamento entra.
-- Sem isso, mudar mp_fee_percent hoje reescreveria o relatório de 2026.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column fee_brl numeric(10,2) not null default 0 check (fee_brl >= 0),
  add column fee_source text check (fee_source in ('mercadopago', 'estimada')),
  -- o MP devolve o valor real da taxa em /v1/payments (fee_details)
  add column net_brl numeric(10,2)
    generated always as (amount_brl - fee_brl) stored;

comment on column public.payments.fee_brl is
  'Taxa da operação em R$: vem do MP quando disponível, senão é estimada pelas taxas de app_settings e fica gravada.';
comment on column public.payments.net_brl is
  'Líquido recebido (amount_brl - fee_brl). Coluna gerada — não escrever.';

-- ---------------------------------------------------------------------------
-- withdrawals — saques/retiradas. Cada linha é dinheiro que SAIU do caixa.
-- Sem policy de insert/update: escrito pela service role via server action.
-- ---------------------------------------------------------------------------
create table public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  amount_brl    numeric(10,2) not null check (amount_brl > 0),
  -- data em que o dinheiro saiu (pode diferir de created_at se lançado depois)
  withdrawn_at  timestamptz not null default now(),
  method        text not null default 'pix' check (method in ('pix', 'ted', 'transferencia', 'dinheiro', 'outro')),
  destination   text,
  note          text,
  actor         text not null default 'admin',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.withdrawals enable row level security;

create policy "withdrawals: admin read"
  on public.withdrawals for select
  using (public.is_admin());

create index withdrawals_date_idx on public.withdrawals (withdrawn_at desc);

create trigger t_withdrawals_touch
  before update on public.withdrawals
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- licenses — rastreio da entrega da chave por e-mail.
-- A chave é emitida mesmo se o e-mail falhar: o dinheiro entrou e a licença
-- já é válida. A falha vira aviso no admin com botão de reenviar.
-- ---------------------------------------------------------------------------
alter table public.licenses
  add column email_sent_at    timestamptz,
  add column email_to         text,
  add column email_error      text,
  add column email_attempts   smallint not null default 0;

comment on column public.licenses.email_error is
  'Último erro do SMTP ao enviar a chave. Null = nunca tentou ou o último envio passou.';
