'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useToast } from '@/components/ui/toaster';
import { createClient } from '@/lib/supabase/client';
import { signupSchema } from '@/lib/schemas';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const supabase = createClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const parsed = signupSchema.safeParse({ email, password, full_name: fullName });
    if (!parsed.success) {
      setErro(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.full_name },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/painel`,
      },
    });

    if (error) {
      setErro(
        error.message === 'User already registered'
          ? 'Este e-mail já tem conta. Faça login.'
          : 'Não foi possível criar a conta agora. Tente novamente.',
      );
      setLoading(false);
      return;
    }

    // Sem sessão = confirmação de e-mail obrigatória no projeto.
    if (!data.session) {
      setEnviado(true);
      setLoading(false);
      return;
    }

    toast.success('Conta criada! Bem-vindo à Proex.');
    const next = params.get('next');
    router.push(next && next.startsWith('/') ? next : '/painel');
    router.refresh();
  }

  if (enviado) {
    return (
      <>
        <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Enviamos um link de confirmação para <span className="text-foreground">{email}</span>. Abra
          ele para ativar a conta e acessar o painel.
        </p>
        <div className="mt-7 space-y-3">
          <Link href="/login" className="btn-primary w-full">
            Já confirmei, ir para o login
          </Link>
          <button onClick={() => setEnviado(false)} className="btn-outline w-full">
            Reenviar para outro e-mail
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use o mesmo e-mail da compra que a licença aparece no painel sozinha.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="nome" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Nome
          </label>
          <input
            id="nome"
            autoComplete="name"
            className="input"
            placeholder="Seu nome"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

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
          <label htmlFor="senha" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            autoComplete="new-password"
            className="input"
            placeholder="mínimo de 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        {erro && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-foreground">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
