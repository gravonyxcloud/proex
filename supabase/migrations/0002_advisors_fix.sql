-- ===========================================================================
-- Proex — correcoes apontadas pelos advisors do Supabase (security + performance)
-- Projeto qacoswxzvviifsatvwxi. Fonte de verdade: aplicado via execute_sql.
--
-- NAO grava entrada no historico de migrations do Supabase (execute_sql nao
-- cria historico). Se um dia for usado `supabase db pull`, reconciliar este
-- arquivo com o que vier de la.
--
-- IMPORTANTE — sem DROP: o servidor MCP do Supabase recusa (status "declined")
-- instrucoes destrutivas como DROP e DELETE. Por isso as policies sao
-- reescritas com ALTER POLICY, que alcanca o mesmo resultado sem DROP.
--
-- Ver: get_advisors(security) e get_advisors(performance) — pos-este-arquivo:
--   security   -> 2 WARN restantes, ambos public.is_admin() (intencionais)
--   performance-> zero WARN; so unused_index (INFO, banco vazio)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) SECURITY — function_search_path_mutable (RESOLVIDO)
--    public.touch_updated_at com search_path mutavel: um objeto homonimo em
--    outro schema podia sequestrar a resolucao do corpo.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) SECURITY — anon/authenticated_security_definer_function_executable
--    (RESOLVIDO para handle_new_user; is_admin mantido de proposito)
--
--    public.handle_new_user() e uma TRIGGER function e nao precisa ser
--    invocavel via /rest/v1/rpc/handle_new_user. O revoke NAO afeta o
--    disparo: o Postgres exige EXECUTE no CREATE TRIGGER, nao na hora do
--    disparo. VERIFICADO em producao apos o revoke: inserir em auth.users
--    ainda criou a linha em public.profiles com role = 'customer'.
--
--    public.is_admin() SEGUE executavel — as policies precisam de EXECUTE.
--    O retorno e so "sou admin?", que quem pergunta ja sabe; nenhum dado
--    trafega. Se quiser silenciar o linter, mova para um schema nao exposto.
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) PERFORMANCE — unindexed_foreign_keys (RESOLVIDO)
-- ---------------------------------------------------------------------------
create index if not exists license_events_order_id_idx on public.license_events (order_id);
create index if not exists licenses_plan_slug_idx      on public.licenses (plan_slug);
create index if not exists orders_plan_slug_idx        on public.orders (plan_slug);
create index if not exists payments_order_id_idx       on public.payments (order_id);

-- ---------------------------------------------------------------------------
-- 4) PERFORMANCE — auth_rls_initplan (RESOLVIDO)
--    auth.<fn>() era reavaliado para CADA linha; embrulhar em (select ...)
--    resolve. Aproveitamos para explicitar TO authenticated nas policies que
--    so servem a usuario logado.
--
--    A policy de plans NAO e tocada: precos tem que ficar legiveis sem sessao
--    (auditoria confirmou 200 + 4 linhas para anon).
-- ---------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------
alter policy "profiles: read own or admin" on public.profiles
  to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

alter policy "profiles: update own" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- orders ---------------------------------------------------------------------
alter policy "orders: read own or admin" on public.orders
  to authenticated
  using ((select auth.uid()) = customer_id or (select public.is_admin()));

-- licenses -------------------------------------------------------------------
alter policy "licenses: read own or admin" on public.licenses
  to authenticated
  using ((select auth.uid()) = customer_id or (select public.is_admin()));

-- payments -------------------------------------------------------------------
alter policy "payments: read own or admin" on public.payments
  to authenticated
  using ((select auth.uid()) = customer_id or (select public.is_admin()));

-- usage_snapshots ------------------------------------------------------------
alter policy "usage: read own or admin" on public.usage_snapshots
  to authenticated
  using ((select auth.uid()) = customer_id or (select public.is_admin()));

-- auditoria: so administrador autenticado -------------------------------------
alter policy "webhook_events: admin only" on public.webhook_events
  to authenticated
  using ((select public.is_admin()));

alter policy "license_events: admin only" on public.license_events
  to authenticated
  using ((select public.is_admin()));

-- is_admin(): tirar do schema exposto (advisor authenticated_security_definer) --
-- 1. funcao real vai para private (nao exposta via PostgREST /rpc).
alter function public.is_admin() set schema private;
-- 2. policies ainda chamam public.is_admin() -> wrapper SECURITY INVOKER,
--    search_path vazio, delega para private.is_admin().
create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path to ''
as $$ select private.is_admin() $$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
-- 3. private.is_admin() precisa de EXECUTE no caller (RLS roda com privileges
--    do role da sessao, nao do dono da tabela).
grant execute on function private.is_admin() to anon, authenticated, service_role;
-- Leak de password: habilitado no dashboard (Auth -> Settings -> Password).
-- Sem equivalente SQL no Postgres; protecao e aplicada pelo GoTrue.
