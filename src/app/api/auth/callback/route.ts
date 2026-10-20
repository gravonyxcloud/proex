import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/auth/callback?code=...
 * Troca o código do Supabase Auth por sessão (padrão do @supabase/ssr).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/painel';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : `/painel`}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=conexao`);
}
