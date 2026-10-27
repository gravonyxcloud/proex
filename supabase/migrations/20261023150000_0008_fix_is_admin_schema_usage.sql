-- ===========================================================================
-- Proex — conserta RLS do painel admin (is_admin)
--
-- BUG: public.is_admin() e SECURITY INVOKER e delega para
-- private.is_admin(). A migration 0002 moveu a funcao real para o schema
-- `private` e concedeu EXECUTE nela, mas nunca concedeu USAGE no SCHEMA
-- `private`. Sem USAGE, o Postgres barra antes de chegar ao EXECUTE e
-- qualquer policy que chame is_admin() estoura:
--
--   ERROR: 42501: permission denied for schema private
--
-- Efeito: toda consulta que passa por uma policy `... or is_admin()`
-- devolve null/erro em vez de linhas. O painel admin inteiro fica vazio —
-- support_tickets, orders, licenses, payments, profiles, webhook_events.
-- (plans escapava porque o `or active` curto-circuitava antes do is_admin.)
--
-- CORRECAO: conceder USAGE no schema `private` aos roles que ja tinham
-- EXECUTE na funcao. Nao expoe dado nenhum: `private` tem exatamente uma
-- funcao (is_admin), e ela devolve so um boolean.
--
-- Idempotente: grant e repetivel sem erro.
-- ===========================================================================

grant usage on schema private to anon, authenticated, service_role;

-- Garante o EXECUTE (a 0002 ja concedeu; repetir aqui torna esta migration
-- autossuficiente caso rode num banco que pulou o passo).
grant execute on function private.is_admin() to anon, authenticated, service_role;
