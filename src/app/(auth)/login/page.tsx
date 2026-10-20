'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useToast } from '@/components/ui/toaster';
import { createClient } from '@/lib/supabase/client';
import { loginSchema } from '@/lib/schemas';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErro(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar agora. Tente novamente.',
      );
      setLoading(false);
      return;
    }

    const next = params.get('next');
    toast.success('Bem-vindo de volta.');
    router.push(next && next.startsWith('/') ? next : '/painel');
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Acesse seu painel para ver a chave, o prazo e os pagamentos.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Senha
            </label>
            <Link href="/redefinir-senha" className="text-xs text-primary hover:underline">
              Esqueci a senha
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {erro && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-foreground">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link href="/cadastro" className="text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
