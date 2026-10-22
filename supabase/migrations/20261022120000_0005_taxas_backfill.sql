-- ===========================================================================
-- Proex — backfill das taxas e blindagem do líquido.
--
-- A 0003 criou fee_brl/fee_source/net_brl, mas nada populava as colunas: todo
-- pagamento anterior ficava com fee_brl = 0 e net_brl = amount_brl, ou seja,
-- o caixa aparecia inflado. Aqui:
--   1. marcamos o que já existia como 'estimada' (não temos o fee_details
--      histórico sem reconsultar o MP linha a linha);
--   2. recalculamos a taxa por app_settings na hora do backfill;
--   3. criamos o índice do relatório de fluxo de caixa.
-- ===========================================================================

-- 1. + 2. backfill único, idempotente: só toca em linhas que nunca foram
-- calculadas (fee_source is null).
update public.payments p
set
  fee_brl = least(
    round(p.amount_brl * s.mp_fee_percent / 100 + s.mp_fee_fixed_brl, 2),
    p.amount_brl
  ),
  fee_source = 'estimada'
from public.app_settings s
where s.id = true
  and p.fee_source is null;

comment on column public.payments.fee_source is
  'mercadopago = taxa real lida de fee_details/net_received_amount; estimada = calculada por app_settings no momento da cobrança.';

-- 3. o relatório varre pagamentos por data de pagamento, não por created_at.
create index if not exists payments_paid_at_idx
  on public.payments (paid_at desc)
  where paid_at is not null;
