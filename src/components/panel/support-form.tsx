'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/toaster';

const ASSUNTOS = [
  'Chave não chegou',
  'Chave não autentica',
  'Rate limit / uso justo',
  'Renovação ou plano',
  'Pedido de reembolso',
  'Outro',
] as const;

export function SupportForm({ contexto, email }: { contexto: string; email: string }) {
  const toast = useToast();
  const [assunto, setAssunto] = useState<string>(ASSUNTOS[0]);
  const [mensagem, setMensagem] = useState('');
  const [reembolso, setReembolso] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function montarTexto() {
    return [
      `Assunto: ${assunto}${reembolso ? ' (REEMBOLSO)' : ''}`,
      `E-mail: ${email}`,
      '',
      mensagem.trim() || '(sem descrição)',
      '',
      '--- contexto da conta ---',
      contexto || '(nenhuma licença ou pedido encontrado)',
    ].join('\n');
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();

    if (mensagem.trim().length < 10) {
      toast.error('Descreva o problema com pelo menos 10 caracteres.');
      return;
    }

    const texto = montarTexto();

    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
      toast.success('Mensagem copiada. Cole no canal de atendimento.');
    } catch {
      toast.error('Não foi possível copiar. O texto está visível abaixo.');
    }
  }

  return (
    <form onSubmit={enviar} className="surface p-6">
      <h2 className="text-sm font-semibold">Abrir um atendimento</h2>

      <div className="mt-5">
        <label htmlFor="assunto" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Assunto
        </label>
        <select
          id="assunto"
          className="input"
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
        >
          {ASSUNTOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label htmlFor="mensagem" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          O que aconteceu
        </label>
        <textarea
          id="mensagem"
          rows={7}
          className="input resize-y"
          placeholder="Descreva o problema. Se for uma chave, diga qual e o que você viu na tela."
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          required
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          checked={reembolso}
          onChange={(e) => setReembolso(e.target.checked)}
        />
        <span>
          <span className="font-medium">Quero pedir reembolso</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            7 dias corridos da compra, 100% do valor no mesmo método.
          </span>
        </span>
      </label>

      <button type="submit" className="btn-primary mt-5 w-full">
        {copiado ? 'copiado ✓' : 'Gerar mensagem de atendimento'}
      </button>

      <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-[#0d0c0b] p-4 font-mono text-[11px] leading-relaxed text-foreground/75">
        {montarTexto()}
      </pre>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Sua chave nunca é copiada automaticamente — apenas o <code className="text-primary">
        key_hint</code> (ex.: <code className="text-primary">sk-px-…a1b2</code>) vai junto para
        identificação.
      </p>
    </form>
  );
}
