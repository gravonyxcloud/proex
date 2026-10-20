import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente service-role — ignora RLS.
 * So pode ser importado por codigo de servidor (guardado por `server-only`).
 * Nunca importar em componente de cliente: exporia a chave.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase admin não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
