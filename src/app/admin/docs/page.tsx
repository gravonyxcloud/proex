import { AdminShell } from '@/components/admin/admin-shell';
import { Terminal } from '@/components/marketing/terminal';
import { SITE, TERMINALS } from '@/lib/constants';

export const metadata = {
  title: 'Documentação da API de licenças',
  robots: { index: false, follow: false },
};

function Endpoint({
  method,
  path,
  children,
}: {
  method: 'POST' | 'GET';
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="terminal">
      <div className="terminal__bar items-center justify-between">
        <span className="font-mono text-sm font-semibold text-foreground">{path}</span>
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
            method === 'POST' ? 'bg-primary/15 text-primary' : 'bg-success/15 text-success'
          }`}
        >
          {method}
        </span>
      </div>
      <div className="terminal__body space-y-4">{children}</div>
    </div>
  );
}

/**
 * CONFIDENCIAL — fica dentro do guard de `admin/layout.tsx` (role = admin).
 * Nao existe versao publica: os endpoints de activate/renew dependem do
 * x-license-secret e por isso nunca podem estar em /docs aberto.
 */
export default function AdminDocsPage() {
  return (
    <AdminShell
      titulo="Documentação da API de licenças"
      descricao="Uso interno e de revenda. Use estes endpoints somente no backend, por HTTPS. Nunca envie o segredo privado ao navegador nem ao cliente final."
    >
      <div className="space-y-12">
        {/* ---------------------------------------------------------- ATIVAR */}
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold">Ativar / criar licença</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Planos aceitos: <code className="text-primary">3d</code>,{' '}
              <code className="text-primary">7d</code>, <code className="text-primary">15d</code> ou{' '}
              <code className="text-primary">30d</code>. A resposta traz a chave e a expiração.{' '}
              <code className="text-primary">orderId</code> é opcional e evita ativações duplicadas.
            </p>
          </div>

          <Endpoint method="POST" path="/api/license/activate">
            <pre className="overflow-x-auto text-[12.5px] leading-relaxed text-foreground/85">{`curl -X POST "${SITE.apiBase}/api/license/activate" \\
  -H "Content-Type: application/json" \\
  -H "x-license-secret: $LICENSE_API_SECRET" \\
  -d '{"email":"cliente@exemplo.com","plan":"30d","orderId":"pedido-123"}'`}</pre>
          </Endpoint>
        </section>

        {/* --------------------------------------------------------- RENOVAR */}
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold">Renovar licença existente</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Exige a chave atual e o mesmo e-mail cadastrado. Mantém a chave e soma o prazo ao
              vencimento atual; se já venceu, conta a partir de agora.
            </p>
          </div>

          <Endpoint method="POST" path="/api/license/renew">
            <pre className="overflow-x-auto text-[12.5px] leading-relaxed text-foreground/85">{`curl -X POST "${SITE.apiBase}/api/license/renew" \\
  -H "Content-Type: application/json" \\
  -H "x-license-secret: $LICENSE_API_SECRET" \\
  -d '{"email":"cliente@exemplo.com","key":"CHAVE_ATUAL","plan":"7d","orderId":"renovacao-456"}'`}</pre>
          </Endpoint>
        </section>

        {/* ------------------------------------------------------- CABEÇALHOS */}
        <section className="surface p-6">
          <h2 className="text-xl font-bold">Cabeçalhos aceitos</h2>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              O e-mail pode ir no corpo como <code className="text-primary">email</code> ou no
              cabeçalho <code className="text-primary">x-customer-email</code>.
            </li>
            <li>
              Na renovação, a chave pode estar no corpo como{' '}
              <code className="text-primary">key</code> ou no cabeçalho{' '}
              <code className="text-primary">x-api-key</code>.
            </li>
            <li>
              <code className="text-primary">x-license-secret</code> é obrigatório em ambos.
            </li>
          </ul>
        </section>

        {/* -------------------------------------------------- USO PELO CLIENTE */}
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold">Como o cliente usa a chave</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Esta parte é o que pode ser repassado ao cliente sem risco. A API lista somente os
              combos publicados: modelos e serviços internos ficam ocultos e não podem ser chamados
              diretamente pela chave do cliente.
            </p>
          </div>

          <Endpoint method="GET" path="/v1/models">
            <pre className="overflow-x-auto text-[12.5px] leading-relaxed text-foreground/85">{`curl "${SITE.apiBase}/v1/models" \\
  -H "Authorization: Bearer CHAVE_DO_CLIENTE"`}</pre>
          </Endpoint>

          <div>
            <h3 className="text-base font-semibold">No Claude Code</h3>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              {TERMINALS.map((t) => (
                <Terminal key={t.sistema} sistema={t.sistema} linhas={t.linhas} />
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- SEGURANÇA */}
        <section className="surface border-danger/30 p-6">
          <h2 className="text-xl font-bold text-danger">Regras de segurança</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Nunca</strong> exponha{' '}
              <code className="text-primary">LICENSE_API_SECRET</code> ou{' '}
              <code className="text-primary">MP_ACCESS_TOKEN</code> no frontend.
            </li>
            <li>
              Envie <code className="text-primary">orderId</code> em toda chamada de ativação e
              renovação: é o dedupe que impede chave duplicada quando o Mercado Pago reenvia o
              webhook.
            </li>
            <li>
              Chave de cliente é credencial bearer: não vai para log, para URL nem para erro
              exibido ao usuário.
            </li>
            <li>
              Trate erros HTTP 4xx/5xx e mostre mensagens amigáveis ao cliente — o texto cru da API
              nunca deve chegar à tela final.
            </li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
