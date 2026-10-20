'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { resetSchema } from '@/lib/schemas';

export default function ResetPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      setErro(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/painel`,
    });

    setLoading(false);

    if (error) {
      setErro('Não foi possível enviar o e-mail agora. Tente novamente.');
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <>
        <h1 className="text-2xl font-bold">E-mail enviado</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Se existir uma conta para <span className="text-foreground">{email}</span>, você recebeu um
          link para redefinir a senha.
        </p>
        <Link href="/login" className="btn-outline mt-7 w-full">
          Voltar para o login
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Redefinir senha</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Informe seu e-mail e enviamos um link para criar uma nova senha.
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

        {erro && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-foreground">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Lembrou a senha?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
