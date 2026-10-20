import Link from 'next/link';

import { DISCLOSURE, FOOTER, SITE } from '@/lib/constants';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="section py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
                PX
              </span>
              <span className="font-display text-lg font-semibold">Proex</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {FOOTER.descricao}
            </p>
          </div>

          {FOOTER.colunas.map((col) => (
            <div key={col.titulo}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.titulo}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-foreground/75 transition hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-border pt-8 text-xs leading-relaxed text-muted-foreground">
          <p>{DISCLOSURE}</p>
          <p>
            A chave não loga no claude.ai, no app de celular nem no Claude Desktop, e não vira plano
            Pro ou Max. Claude in Chrome e os connectors ficam de fora. MCP funciona normalmente.
          </p>
          <p>
            © {new Date().getFullYear()} {SITE.name} · Pagamentos processados pelo Mercado Pago ·
            Ponte da API em {SITE.apiBase.replace(/^https?:\/\//, '')}
          </p>
        </div>
      </div>
    </footer>
  );
}
