export const SITE = {
  name: 'Proex',
  tagline: 'Claude Code ilimitado por API',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://proex.app',
  apiBase: process.env.LICENSE_API_BASE ?? 'https://api.gravonyx.com',
  keyPrefix: 'sk-px-',
} as const;

/** Politica de uso justo — token por hora. */
export const FAIR_USE = {
  unlimited: 80_000_000,
  unlimitedLabel: '80 milhões de tokens por hora',
} as const;

export const MODELS = [
  'Claude Opus 5.5',
  'Claude Sonnet 5.5',
  'Claude Haiku 5.5',
  'Claude Fable 5.1',
] as const;

export const DISCLOSURE =
  'Não somos a Anthropic, nem parceiros, revendedores oficiais ou patrocinados por ela. Você compra acesso por API: a chave autentica chamadas de API, e só isso.';

/** Itens do hero / benefícios. */
export const HERO = {
  rotulo: 'Proex · acesso por API ao Claude Code',
  titulo: 'Seu Claude Code, sem acabar o período.',
  sub: 'Compre um período, use o quanto quiser dentro do ritmo de 80 milhões de tokens por hora. Pague com PIX ou cartão, receba a chave por e-mail e configure no seu terminal em dois comandos.',
  cta: 'Quero meu acesso agora',
  ctaSec: 'Ver os planos',
} as const;

/** Por que 80M/h — comparativo com os limites do Claude Code. */
export const FAIR_USE_BAND = {
  titulo: 'Política de uso justo: 80.000.000 de tokens por hora',
  texto:
    'Você paga pelo tempo, não por token. Não existe cota diária nem cobrança por comando. O que existe é um teto de ritmo: a cada 60 minutos a janela desliza e o consumo mais antigo libera espaço. Trabalho concentrado não é cortado no meio — só o excesso automático é freado.',
  metricas: [
    {
      valor: '80M',
      rotulo: 'tokens por hora',
      detalhe: 'Janela deslizante de 60 minutos. No ilimitado, começa na emissão da chave e não pausa.',
    },
    {
      valor: '0',
      rotulo: 'cota diária',
      detalhe: 'Nada de mesada que zera à meia-noite. O período corre contínuo do primeiro ao último dia.',
    },
    {
      valor: '4',
      rotulo: 'modelos inclusos',
      detalhe: 'Opus 5.5, Fable 5.1, Sonnet 5.5 e Haiku 5.5. Troque com /model dentro do Claude Code.',
    },
    {
      valor: '1',
      rotulo: 'chave por pessoa',
      detalhe: 'Uma chave, uma pessoa. Pode usar em vários computadores seus — só não se divide.',
    },
  ],
} as const;

/** Passos de instalação e uso. */
export const STEPS = {
  titulo: 'Do pedido em português à publicação.',
  sub: 'Cinco passos e você está alterando o seu projeto.',
  itens: [
    {
      titulo: 'Instale o Claude Code',
      texto: 'Use o instalador da própria Anthropic no Windows, no macOS ou no Linux.',
    },
    {
      titulo: 'Configure a ponte',
      texto: 'Aponte o terminal para a ponte da Proex e informe a chave que chegou no seu e-mail.',
    },
    {
      titulo: 'Abra a pasta do projeto',
      texto: 'O Claude Code trabalha nos arquivos locais do seu repositório, lendo, editando e criando.',
    },
    {
      titulo: 'Peça em português e revise',
      texto: 'Digite o pedido, acompanhe os arquivos modificados e use /model para trocar de modelo.',
    },
    {
      titulo: 'Publique quando estiver pronto',
      texto: 'Teste, suba ao Git e publique pelo fluxo do seu projeto. Você controla a versão final.',
    },
  ],
} as const;

/** Blocos de terminal por sistema operacional. */
export const TERMINALS = [
  {
    sistema: 'Windows, no PowerShell:',
    linhas: [
      'irm https://claude.ai/install.ps1 | iex',
      `setx ANTHROPIC_BASE_URL "${SITE.apiBase}"`,
      'setx ANTHROPIC_API_KEY "sk-px-..."',
    ],
  },
  {
    sistema: 'macOS e Linux:',
    linhas: [
      'curl -fsSL https://claude.ai/install.sh | bash',
      `export ANTHROPIC_BASE_URL="${SITE.apiBase}"`,
      'export ANTHROPIC_API_KEY="sk-px-..."',
    ],
  },
] as const;

export const TERMINAL_NOTA =
  'No Windows, abra um terminal novo depois do setx — ele só vale para sessões seguintes. No macOS e no Linux, continue no mesmo terminal. Depois, entre na pasta do projeto e rode';

export const TERMINAL_RUN = 'claude';

/** Benefícios dos planos. */
export interface Benefit {
  titulo: string;
  texto: string;
  destaque?: boolean;
}

export const BENEFITS: {
  titulo: string;
  sub: string;
  itens: readonly Benefit[];
} = {
  titulo: 'Tudo que vem junto.',
  sub: 'Incluso em todos os planos, do de 3 dias ao de 30.',
  itens: [
    {
      titulo: 'Uso ilimitado no período',
      texto: 'Sem contar comando, sem saldo que acaba. Só o ritmo de 80M tokens/hora.',
      destaque: true,
    },
    { titulo: 'Entrega automática', texto: 'A chave chega no e-mail assim que o PIX ou o cartão aprova.' },
    { titulo: 'Quatro modelos', texto: 'Opus 5.5, Fable 5.1, Sonnet 5.5 e Haiku 5.5, no mesmo acesso.' },
    { titulo: 'Windows, macOS e Linux', texto: 'É terminal. Funciona em qualquer um dos três.' },
    { titulo: 'MCP normal', texto: 'Servidores locais e remotos continuam funcionando.' },
    { titulo: 'Suporte humano', texto: 'Chave que não chega ou não autentica, você fala com a gente.' },
  ],
};

/** Pagamento, entrega e reembolso. */
export const PURCHASE = {
  titulo: 'Pagamento, entrega e reembolso.',
  itens: [
    {
      destaque: 'PIX ou cartão.',
      texto:
        'A chave é gerada e enviada para o seu e-mail assim que o pagamento aprova. No PIX costuma ser em segundos.',
    },
    {
      destaque: '7 dias de garantia.',
      texto:
        'Se não serviu, você pede o reembolso pelo painel em até 7 dias da compra e devolvemos 100% no mesmo método.',
    },
    {
      destaque: 'Sem SLA.',
      texto: 'Se a ponte cair, não há compensação automática: a gente avisa, corrige e trata caso a caso.',
    },
  ],
} as const;

export const FAQ = [
  {
    p: 'Tem limite de tokens?',
    r: `Sim, e é o limite de uso justo: ${FAIR_USE.unlimitedLabel} numa janela deslizante de 60 minutos. Fora isso não existe cota total, nem mesada diária, nem cobrança por comando — no período contratado você usa o quanto quiser.`,
  },
  {
    p: 'É o Claude Code oficial mesmo ou é um clone?',
    r: 'É o oficial da Anthropic, instalado pelo instalador dela. Não temos fork, wrapper nem binário próprio. O que muda é o endereço para onde ele manda a chamada.',
  },
  {
    p: 'Quais modelos eu consigo usar?',
    r: `Os modelos em destaque são ${MODELS.join(', ')}, inclusos em todos os planos. Use /model dentro do Claude Code para ver as opções e trocar. A lista depende do provedor e pode mudar sem aviso.`,
  },
  {
    p: 'Quando meu período começa e o que acontece quando acaba?',
    r: 'Começa na emissão da chave e não pausa. Quando o prazo termina, a chave para de autenticar. Nada é apagado do seu lado: o projeto continua seu, no seu computador e no seu repositório.',
  },
  {
    p: 'A chave loga no claude.ai ou no app de celular?',
    r: 'Não. A chave só autentica chamadas de API pela ponte. Ela não entra no claude.ai, no app de celular, no Claude Desktop, não vira plano Pro ou Max, e o Claude in Chrome e os connectors ficam de fora. MCP funciona normalmente.',
  },
  {
    p: 'Meu código passa por vocês?',
    r: 'Passa. A ponte é um servidor nosso que autentica a chave e repassa a chamada ao provedor, então o prompt e o trecho de código trafegam por ela. É assim que qualquer revenda de acesso por API funciona. Se a sua regra proíbe isso, é motivo para não comprar aqui.',
  },
  {
    p: 'Posso usar a chave em mais de um computador?',
    r: 'Nos seus, sim, e trocar de rede não conta. O que não pode é dividir com outra pessoa: uma chave, uma pessoa. Compartilhamento confirmado suspende o acesso; antes de agir a gente pergunta, e você pode contestar.',
  },
  {
    p: 'Preciso saber programar?',
    r: 'Dá para pedir em português, como “na tela de pedidos, adiciona um filtro por data”. Para usar é preciso instalar o Claude Code e configurar a chave — o tutorial desta página mostra. Revise e teste antes de publicar: alguns problemas exigem conhecimento técnico.',
  },
  {
    p: 'Como eu pago e quando recebo a chave?',
    r: 'PIX ou cartão, pelo Mercado Pago. A chave sai assim que o pagamento aprova e vai para o e-mail da compra e para o seu painel aqui no site.',
  },
  {
    p: 'E se der problema?',
    r: 'Fala com o suporte pelo painel. Se for problema nosso, a gente resolve. O reembolso de 7 dias você pede pela própria área logada.',
  },
] as const;

export const FOOTER = {
  descricao:
    'Proex — revenda de acesso por API ao Claude Code. Planos por período, uso ilimitado dentro do ritmo de 80 milhões de tokens por hora.',
  colunas: [
    {
      titulo: 'Produto',
      links: [
        { label: 'Planos', href: '/precos' },
        { label: 'Como configurar', href: '/#como-funciona' },
      ],
    },
    {
      titulo: 'Conta',
      links: [
        { label: 'Entrar', href: '/login' },
        { label: 'Criar conta', href: '/cadastro' },
        { label: 'Meu painel', href: '/painel' },
      ],
    },
    {
      titulo: 'Ajuda',
      links: [
        { label: 'Suporte', href: '/suporte' },
        { label: 'Perguntas frequentes', href: '/#faq' },
        { label: 'Reembolso', href: '/suporte#reembolso' },
      ],
    },
  ],
} as const;
