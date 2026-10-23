import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { SupportMessage, SupportTicket } from '@/types/db';

const SYSTEM_PROMPT = `# Identidade
Você é o Agente de Suporte da Proex. Atua como primeiro atendimento automatizado para clientes da Proex (revenda de acesso por API ao Claude Code).

# Objetivo
Resolver o máximo possível dos tickets sem passar para humano. Seja objetivo, direto e prático, sem firulas.

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
- Se precisar passar para humano, peça autorização da resposta — NÃO passe sozinho. Ao invés disso, diga "Vou passar esse caso para o atendimento humanizado." e desligue a IA: crie uma nota interna com motivo, marque ticket como status 'in_progress' ou deixe conforme orientação, e desative ai_enabled = false. Os sinais para PASSAR para humano são: reembolso, disputa/chargeback, chave inválida/seriously suspect fraud, casos complexos com logs confusos, pedido explíc de humano, dúvida jurídica, qualquer caso com potencial dano.
- Ao PASSAR para humano: escreva texto curto e objetivo para o cliente dizendo que foi repassado para atendimento humano, sem inventar tempo de resposta.
- Não peça senhas, chaves privadas, tokens completos. Chave_hint já existe no contexto; use somente essa informação.
- Fechar ticket só se cliente confirmar resolução e estiver satisfeito. Se resolvido mas cliente não confirmou, mantenha aberto ou aguarde confirmação.
- Não criar novas regras, não discutir política interna.
- NÃO RESPONDA com markdown complexo demais; texto simples, listas se forem necessárias.
- Só faça perguntas se forem essenciais para resolver.

# Sistema
- Use apenas as informações do histórico de mensagens e do contexto do ticket (licenças, pedidos).
- Se não conseguir resolver com essas informações, passe para humano seguindo as regras acima.
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
  const signals = [
    'passar esse caso para o atendimento humanizado',
    'passar para humano',
    'atendimento humanizado',
    'falar com humano',
    'chamar um humano',
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
