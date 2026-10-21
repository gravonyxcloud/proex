'use client';

import Link from 'next/link';
import { useState } from 'react';

import { newPasswordSchema } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';

export function AccountForm() {
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setOk(false);

    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Verifique os campos.');
      return;
    }

    setCarregando(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setCarregando(false);

    if (updateError) {
      if (/same as the old password/i.test(updateError.message)) {
        setErro('A nova senha é igual à anterior. Escolha outra.');
      } else if (/should be at least|password/i.test(updateError.message)) {
        setErro('Senha fraca — use pelo menos 8 caracteres.');
      } else {
        setErro('Não foi possível alterar a senha. Tente novamente.');
      }
      return;
    }

    setPassword('');
    setConfirm('');
    setOk(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-primary/20 bg-secondary/50 p-6"
    >
      <h2 className="text-lg font-semibold text-text">Alterar senha</h2>
      <p className="text-sm text-muted-foreground">
        Use pelo menos 8 caracteres. Ao salvar, a senha antiga deixa de valer.
      </p>

      {erro ? (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      ) : null}
      {ok ? (
        <div role="status" className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          Senha alterada com sucesso.
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="nova-senha" className="text-sm font-medium text-text">
          Nova senha
        </label>
        <input
          id="nova-senha"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmar-senha" className="text-sm font-medium text-text">
          Confirmar nova senha
        </label>
        <input
          id="confirmar-senha"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-primary/20 bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </div>

      <button
        type="submit"
        disabled={carregando}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {carregando ? 'Salvando…' : 'Salvar nova senha'}
      </button>

      <p className="text-sm text-muted-foreground">
        Não consegue entrar?{' '}
        <Link href="/redefinir-senha" className="text-primary hover:underline">
          Peça um link de redefinição
        </Link>
        .
      </p>
    </form>
  );
}
