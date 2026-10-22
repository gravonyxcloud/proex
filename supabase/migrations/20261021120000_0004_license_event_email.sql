-- ===========================================================================
-- Proex — reenvio manual da chave.
--
-- O reenvio pelo admin precisa deixar rastro em license_events junto das
-- outras ações, mas o check original só aceitava activate/renew/revoke/
-- reprocess/failed. Adiciona 'email'.
-- ===========================================================================

alter table public.license_events
  drop constraint if exists license_events_action_check;

alter table public.license_events
  add constraint license_events_action_check
  check (action in ('activate', 'renew', 'revoke', 'reprocess', 'failed', 'email'));
