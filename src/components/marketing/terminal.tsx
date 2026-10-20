'use client';

import { useState } from 'react';

interface Props {
  sistema: string;
  linhas: readonly string[];
}

export function Terminal({ sistema, linhas }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(linhas.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard bloqueado — o usuário pode selecionar à mão */
    }
  }

  return (
    <div className="terminal">
      <div className="terminal__bar">
        <span className="terminal__dot bg-[#ff5f57]" />
        <span className="terminal__dot bg-[#febc2e]" />
        <span className="terminal__dot bg-[#28c840]" />
        <span className="ml-3 text-xs font-medium text-muted-foreground">{sistema}</span>
        <button
          onClick={copy}
          className="ml-auto rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary"
          aria-label={`Copiar comandos para ${sistema}`}
        >
          {copied ? 'copiado ✓' : 'copiar'}
        </button>
      </div>

      <div className="terminal__body">
        <ol className="space-y-3">
          {linhas.map((linha, i) => (
            <li key={linha} className="flex gap-3">
              <span className="select-none text-muted-foreground/60">{i + 1}</span>
              <code className="text-foreground/90">
                <span className="mr-2 select-none text-primary">$</span>
                {linha}
              </code>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
