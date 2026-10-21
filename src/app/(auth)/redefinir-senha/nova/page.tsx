'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { newPasswordSchema } from '@/lib/schemas';

type Estado = 'checando' | 'sem-sessao' | 'form' | 'salvo';

export default function NovaSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [estado, setEstado] = useState<Estado>('checando');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setEstado(data.session ? 'form' : 'sem-sessao');
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);

    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Confira os campos.');
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setCarregando(false);
    if (error) {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado — peça um novo.');
      return;
    }
    setEstado('salvo');
    router.replace('/painel');
    router.refresh();
  }

  return (
    <section className="section min-h-[calc(100svh-65px)] flex items-center justify-center py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Criar nova senha</h1>
          <p className="text-sm text-muted-foreground">
            {estado === 'checando' && 'Validando o link de recuperação…'}
            {estado === 'sem-sessao' && 'Este link expirou ou já foi usado.'}
            {estado === 'form' && 'Escolha uma senha nova para a sua conta.'}
            {estado === 'salvo' && 'Senha atualizada. Redirecionando…'}
          </p>
        </div>

        {estado === 'sem-sessao' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Peça um novo link de recuperação e use-o logo em seguida.
            </p>
            <Link href="/redefinir-senha" className="btn-primary inline-flex w-full justify-center">
              Pedir novo link
            </Link>
          </div>
        )}

        {estado === 'form' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm" className="text-sm font-medium">
                Confirmar nova senha
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                required
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <button type="submit" disabled={carregando} className="btn-primary w-full justify-center">
              {carregando ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Lembrou a senha?{' '}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </section>
  );
}
