import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresca a sessão em toda requisição e faz o guard das rotas
 * /painel (precisa de conta) e /admin (precisa de role = admin).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith('/painel') || path.startsWith('/admin');
  const isAuthPage = path === '/login' || path === '/cadastro' || path === '/redefinir-senha';

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // limpa os params da rota original: /painel/uso?dias=14 nao pode virar
    // /login?dias=14&next=... — so o `next` importa.
    url.search = '';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/painel';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/painel';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/.*|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
