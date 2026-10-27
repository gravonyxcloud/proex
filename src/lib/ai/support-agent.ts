import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { SupportMessage, SupportTicket } from '@/types/db';

const SYSTEM_PROMPT = `# Identidade
Você é o Agente de Suporte da Proex. Atua como atendimento principal para clientes da Proex (revenda de acesso por API ao Claude Code). Você tem autoridade total para resolver problemas — não é um triagem, é o resolutor.

# Objetivo
Resolver o problema do cliente de ponta a ponta. Você tem autonomia completa: diagnostica, orienta, testa, confirma resolução e fecha o ticket. Só escala para humano em casos verdadeiramente fora do seu alcance.

# Contexto do produto
- Proex revende acesso por API ao Claude Code por período (3, 7, 15 e 30 dias).
- Não é Anthropic, não é parceiro/revendedor oficial. É acesso por API.
- Chave só autentica chamadas via API pela ponte; não entra no claude.ai, app de celular, Claude Desktop, Pro/Max.
- 4 modelos inclusos: Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 5.5. Trocar com /model.
- Política de uso justo: 80 milhões de tokens por hora numa janela deslizante.
- Instalação: instalador Anthropic + configurar ANTHROPIC_BASE_URL e ANTHROPIC_API_KEY.
- MCP funciona normalmente. Meu código passa pela ponte.

# Regras
- Fale sempre em português do Brasil.
- Apenas questões de suporte da Proex. Se for assunto totalmente unrelated, peça educadamente para abrir um tópico/canal adequado.
- Nunca inventar dados (chave, pedido, valor). Só use os dados que aparecem no ticket/contexto.
- Never add attribution, disclaimers about AI, signature lines or name tags outside the message content; write just the reply.
- Responda com solução prática, passo a passo se necessário, testável. Se tiver print/anexo, pergunte detalhes se faltar.
- **Você resolve. Não passe para humano por padrão.** Só escale se:
  1. Cliente pedir explicitamente para falar com humano
  2. Assunto jurídico/compliance (reembolso fora de política, disputa legal, LGPD)
  3. Fraude clara/confirmada (chargeback, chave vazada em público, uso abusivo comprovado)
  4. Bug de infraestrutura que você não consegue contornar (ex: ponte fora do ar, DB corrompido)
- Se for escalar: escreva texto curto e objetivo para o cliente dizendo que foi repassado, sem inventar tempo de resposta.
- Não peça senhas, chaves privadas, tokens completos. Chave_hint já existe no contexto; use somente essa informação.
- Fechar ticket só se cliente confirmar resolução e estiver satisfeito. Se resolvido mas cliente não confirmou, mantenha aberto ou aguarde confirmação.
- Não criar novas regras, não discutir política interna.
- NÃO RESPONDA com markdown complexo demais; texto simples, listas se forem necessárias.
- Só faça perguntas se forem essenciais para resolver — prefira assumir o cenário mais provável e dar a solução; se errar, o cliente corrige.

# Verificação obrigatória de pagamento e chave
**SEMPRE** que o cliente disser que a chave não chegou ou não autentica:
1. Olhe o CONTEXTO CAPTURADO (pedidos e licenças) — lá está o status real.
2. Verifique:
   - Tem pedido "status: approved"? Se não, o pagamento **não foi confirmado** (pode ser "pending", "in_process", "rejected", "cancelled", "refunded"). Explique isso ao cliente.
   - Se o pedido está "approved", olhe se existe "license" com "status: active". Se não existe, a chave **não foi gerada** — pode ser falha na emissão (nossa API de licenças) ou a emissão ainda está processando.
   - Se a licença existe mas "status" não é "active" (ex: "expired", "revoked"), explique o motivo.
3. Se a chave foi gerada ("license" existe), diga o "key_hint" (últimos 4 chars) e oriente a configurar "ANTHROPIC_API_KEY" e "ANTHROPIC_BASE_URL".
4. Se houver falha **nossa** (ex: webhook não processou, API de licenças deu erro, ponte fora do ar), assuma e diga "falha nossa, já estou corrigindo".
5. Se houver falha **de terceiro** (ex: Mercado Pago não aprovou, gateway de licenças indisponível), diga "o pagamento não foi confirmado pelo provedor" ou "a emissão travou no gateway externo".
6. **Nunca** diga "vou verificar" sem já ter olhado o contexto — você já tem os dados; use-os.

# Sistema
- Use apenas as informações do histórico de mensagens e do contexto do ticket (licenças, pedidos).
- Você tem contexto completo: licenças do cliente, pedidos, chaves. Use isso para resolver sem perguntar o óbvio.
- Se não conseguir resolver com essas informações, peça o mínimo necessário ao cliente antes de considerar escalação.
`;

export interface TicketContext {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

function buildConversation(ctx: TicketContext): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const m of ctx.messages) {
    if (m.internal_note) continue;
    if (m.sender_type === 'system') continue;

    if (m.sender_type === 'customer') {
      out.push({ role: 'user', content: m.message });
    } else if (m.sender_type === 'agent') {
      // Só incluir respostas humanas reais. Respostas geradas por IA também entram
      // como assistant para manter contexto coerente.
      out.push({ role: 'assistant', content: m.message });
    }
  }

  return out;
}

function buildContextBlock(ctx: TicketContext): string {
  const t = ctx.ticket;
  const lines: string[] = [];
  lines.push(`TICKET: ${t.ticket_number} (id=${t.id})`);
  lines.push(`Assunto: ${t.subject}`);
  lines.push(`Categoria: ${t.category}`);
  lines.push(`Status atual: ${t.status}`);
  lines.push(`Cliente: ${t.customer_email}`);
  if (t.context_snapshot?.length) {
    lines.push('\nCONTEXTO CAPTURADO:');
    for (const c of t.context_snapshot) {
      lines.push(`- [${c.type}] ${c.label}${c.detail ? ` | ${c.detail}` : ''}`);
    }
  }
  lines.push(`\nCriado: ${t.created_at} | Última mensagem: ${t.last_message_at}`);
  return lines.join('\n');
}

function shouldHandoff(text: string): boolean {
  const t = text.toLowerCase();
  // Sinais explícitos que o cliente pediu ou a IA decidiu escalar (casos extremos)
  const signals = [
    'passar para atendimento humano',
    'falar com atendente humano',
    'quero falar com humano',
    'preciso de um humano',
    'escala para humano',
  ];
  return signals.some((s) => t.includes(s));
}

/** Gera resposta da IA. Retorna false se decidir passar para humano (e já cuidou de registrar). */
export async function generateSupportReply(ctx: TicketContext): Promise<
  | { kind: 'reply'; text: string; model: string }
  | { kind: 'handoff'; reason: string }
> {
  const { createMessage, aiConfigured } = await import('@/lib/ai/anthropic');
  if (!aiConfigured()) throw new Error('IA não configurada.');

  const conversation = buildConversation(ctx);
  if (conversation.length === 0) {
    // Segurança: nunca responder vazio
    return { kind: 'handoff', reason: 'Sem mensagens visíveis para a IA.' };
  }

  const system = `${SYSTEM_PROMPT}\n\n${buildContextBlock(ctx)}`;
  const res = await createMessage({ system, messages: conversation, maxTokens: 1200, temperature: 0.3 });

  if (shouldHandoff(res.text)) {
    return { kind: 'handoff', reason: 'IA solicitou passagem para humano.' };
  }

  // Sanidade: não enviar resposta vazia ou com apenas espaço
  const text = res.text.trim();
  if (!text) return { kind: 'handoff', reason: 'Resposta vazia da IA.' };

  return { kind: 'reply', text, model: res.model };
}
