export const roadmapMilestones = [
  {
    title: "Semana 1 - Fundação",
    owner: "Produto + Tecnologia",
    status: "Em andamento",
    detail:
      "Repositório, Supabase, autenticação, RLS multi-tenant, schema base e estrutura do projeto.",
  },
  {
    title: "Semana 2 - Cadastros",
    owner: "Backoffice + Produto",
    status: "Na fila imediata",
    detail:
      "CRUD de depositantes, produtos, endereçamento, usuários e importação inicial de produtos.",
  },
  {
    title: "Semana 3 - Recebimento",
    owner: "Operação + Produto",
    status: "Prioridade máxima",
    detail:
      "Pedido de recebimento, importação NF-e XML, conferência, divergências, lote, validade e entrada em estoque.",
  },
  {
    title: "Semana 4 - Estoque Base",
    owner: "Operação + Qualidade",
    status: "Mês 1",
    detail:
      "Consulta de estoque, alerta de vencimento, relatório de saldo, testes end-to-end e deploy de homologação.",
  },
  {
    title: "Mês 2 - Expedição",
    owner: "Operação",
    status: "Planejado",
    detail:
      "Integração Bling V3, pedidos de expedição, separação, conferência, romaneio e transportadoras.",
  },
  {
    title: "Mês 3 - Go-live",
    owner: "Operação + Gestão",
    status: "Planejado",
    detail:
      "Estoque avançado, dashboard integrado ao financeiro, NF-e, migração do SmartGo e entrada em produção.",
  },
] as const;

export const receivingStats = [
  {
    label: "Pedidos aguardando",
    value: "14",
    help: "Ordens inbound prontas para agenda, doca ou conferência.",
  },
  {
    label: "Volumes previstos hoje",
    value: "1.284",
    help: "Soma do planejamento operacional do turno atual.",
  },
  {
    label: "Divergências abertas",
    value: "5",
    help: "Ocorrências de falta, sobra, avaria ou validade em tratativa.",
  },
  {
    label: "Tempo médio de doca",
    value: "42 min",
    help: "Meta operacional alvo para o primeiro ciclo do MVP.",
  },
] as const;

export const receivingOrders = [
  {
    code: "REC-240610-001",
    id: "rec-240610-001",
    depositante: "Evolveg",
    supplier: "Indústria Prisma",
    eta: "10/06 18:30",
    status: "Aguardando",
    skuCount: 23,
    volumeCount: 146,
  },
  {
    code: "REC-240610-002",
    id: "rec-240610-002",
    depositante: "Festcolor",
    supplier: "PaperCraft Brasil",
    eta: "10/06 19:15",
    status: "Em recebimento",
    skuCount: 11,
    volumeCount: 88,
  },
  {
    code: "REC-240610-003",
    id: "rec-240610-003",
    depositante: "Sua Aliada",
    supplier: "Vida Farma",
    eta: "10/06 20:00",
    status: "Divergência",
    skuCount: 7,
    volumeCount: 31,
  },
  {
    code: "REC-240610-004",
    id: "rec-240610-004",
    depositante: "Rennova",
    supplier: "Bio Supply",
    eta: "10/06 21:10",
    status: "Aguardando",
    skuCount: 18,
    volumeCount: 104,
  },
] as const;

export const receivingOrderDetails = {
  "rec-240610-001": {
    code: "REC-240610-001",
    depositante: "Evolveg",
    supplier: "Indústria Prisma",
    status: "Aguardando",
    eta: "10/06/2026 18:30",
    dock: "DOCA-01",
    noteNumber: "81273",
    volumes: 146,
    skuCount: 23,
    protocol: "PROC-REC-00191",
    checklist: [
      "Confirmar doca e veículo na chegada",
      "Conferir NF, volumes e integridade externa",
      "Liberar conferência por lote e validade",
    ],
    items: [
      {
        sku: "EVG-SERUM-30",
        description: "Sérum facial 30ml",
        expected: "80",
        received: "0",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
      {
        sku: "EVG-CREAM-50",
        description: "Creme hidratante 50g",
        expected: "40",
        received: "0",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
      {
        sku: "EVG-KIT-BOX",
        description: "Caixa kit promocional",
        expected: "26",
        received: "0",
        lot: "Não",
        expiry: "Não",
      },
    ],
  },
  "rec-240610-002": {
    code: "REC-240610-002",
    depositante: "Festcolor",
    supplier: "PaperCraft Brasil",
    status: "Em recebimento",
    eta: "10/06/2026 19:15",
    dock: "DOCA-02",
    noteNumber: "81274",
    volumes: 88,
    skuCount: 11,
    protocol: "PROC-REC-00192",
    checklist: [
      "Separar volumes por SKU",
      "Capturar divergências em tempo real",
      "Mover para pulmão após conferência",
    ],
    items: [
      {
        sku: "FES-PAPER-09",
        description: "Papel decorativo premium",
        expected: "120",
        received: "96",
        lot: "Não",
        expiry: "Não",
      },
      {
        sku: "FES-RIB-02",
        description: "Fita decorativa cetim",
        expected: "60",
        received: "60",
        lot: "Não",
        expiry: "Não",
      },
      {
        sku: "FES-BOX-11",
        description: "Caixa presente média",
        expected: "40",
        received: "40",
        lot: "Não",
        expiry: "Não",
      },
    ],
  },
  "rec-240610-003": {
    code: "REC-240610-003",
    depositante: "Sua Aliada",
    supplier: "Vida Farma",
    status: "Divergência",
    eta: "10/06/2026 20:00",
    dock: "DOCA-03",
    noteNumber: "81275",
    volumes: 31,
    skuCount: 7,
    protocol: "PROC-REC-00193",
    checklist: [
      "Segregar lote com validade crítica",
      "Anexar fotos da ocorrência",
      "Aguardar devolutiva do depositante",
    ],
    items: [
      {
        sku: "SUA-VIT-C",
        description: "Vitamina C 60 caps",
        expected: "24",
        received: "24",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
      {
        sku: "SUA-OMEGA-3",
        description: "Ômega 3 120 caps",
        expected: "18",
        received: "12",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
      {
        sku: "SUA-MELATONIN",
        description: "Melatonina 90 caps",
        expected: "12",
        received: "12",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
    ],
  },
  "rec-240610-004": {
    code: "REC-240610-004",
    depositante: "Rennova",
    supplier: "Bio Supply",
    status: "Aguardando",
    eta: "10/06/2026 21:10",
    dock: "DOCA-01",
    noteNumber: "81276",
    volumes: 104,
    skuCount: 18,
    protocol: "PROC-REC-00194",
    checklist: [
      "Conferência com fotos por avaria",
      "Priorizar itens com validade",
      "Separar lote bloqueado se houver variação",
    ],
    items: [
      {
        sku: "REN-COLAG-01",
        description: "Colágeno hidrolisado",
        expected: "52",
        received: "0",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
      {
        sku: "REN-SERUM-10",
        description: "Sérum renovador 10ml",
        expected: "32",
        received: "0",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
      {
        sku: "REN-MASK-05",
        description: "Máscara facial premium",
        expected: "20",
        received: "0",
        lot: "Obrigatório",
        expiry: "Obrigatória",
      },
    ],
  },
} as const;

export const receivingTasks = [
  {
    title: "Conferência física da NF 81273",
    type: "CONFERENCIA_FISICA",
    assignee: "Turno A",
    priority: "Alta",
    due: "Hoje, 19:00",
  },
  {
    title: "Etiquetagem de lotes com validade",
    type: "ETIQUETAGEM",
    assignee: "Turno B",
    priority: "Média",
    due: "Hoje, 20:30",
  },
  {
    title: "Endereço temporário de doca 03",
    type: "ENDERECAMENTO",
    assignee: "Recebimento",
    priority: "Alta",
    due: "Hoje, 21:00",
  },
] as const;

export const operationalIssues = [
  {
    title: "Avaria em 4 caixas de sérum facial",
    type: "AVARIA",
    depositante: "Rennova",
    action: "Segregar lote e anexar fotos no protocolo.",
  },
  {
    title: "Sobra de 12 unidades sem NF complementar",
    type: "SOBRA",
    depositante: "Festcolor",
    action: "Abrir tratativa com fornecedor antes da entrada final.",
  },
  {
    title: "Validade inferior a 90 dias",
    type: "VALIDADE",
    depositante: "Sua Aliada",
    action: "Bloquear estoque e aguardar aprovação do depositante.",
  },
] as const;

export const depositantesResumo = [
  { name: "Evolveg", skus: 124, addresses: 42, method: "FEFO" },
  { name: "Festcolor", skus: 56, addresses: 18, method: "FIFO" },
  { name: "Rennova", skus: 73, addresses: 21, method: "FEFO" },
  { name: "Sua Aliada", skus: 44, addresses: 16, method: "FEFO" },
] as const;

export const productChecklist = [
  "Código interno por depositante",
  "SKU externo / ERP",
  "Método de retirada",
  "Controle de lote e validade",
  "Dimensões e peso",
  "Mínimo e máximo por estoque",
] as const;

export const addressBlueprint = [
  { code: "DOCA-01", area: "RECEBIMENTO", capacity: "120 volumes" },
  { code: "PUL-02-A", area: "PULMÃO", capacity: "18 pallets" },
  { code: "PICK-03-B", area: "PICKING", capacity: "240 bins" },
  { code: "BLQ-01", area: "BLOQUEADO", capacity: "8 pallets" },
] as const;

export const stockStats = [
  {
    label: "Posições ativas",
    value: "97",
    help: "Endereços hoje disponíveis na operação.",
  },
  {
    label: "Lotes bloqueados",
    value: "6",
    help: "Itens em tratativa de avaria, validade ou divergência.",
  },
  {
    label: "Produtos com FEFO",
    value: "143",
    help: "Cadastros que exigem controle por validade.",
  },
  {
    label: "Inventário pendente",
    value: "12 ruas",
    help: "Mapa inicial para o primeiro ciclo de contagem.",
  },
] as const;

export const stockBalances = [
  {
    sku: "EVG-SERUM-30",
    depositante: "Evolveg",
    endereco: "PICK-03-B",
    lote: "LOT-2406A",
    saldo: "124",
    validade: "12/2026",
    status: "Disponível",
  },
  {
    sku: "REN-COLAG-01",
    depositante: "Rennova",
    endereco: "PUL-02-A",
    lote: "LOT-2405R",
    saldo: "88",
    validade: "09/2026",
    status: "Bloqueado",
  },
  {
    sku: "FES-PAPER-09",
    depositante: "Festcolor",
    endereco: "PICK-01-C",
    lote: "LOT-2404F",
    saldo: "310",
    validade: "-",
    status: "Disponível",
  },
] as const;

export const stockMovements = [
  "Entrada automática ao concluir recebimento",
  "Transferência entre doca, pulmão e picking",
  "Bloqueio e desbloqueio por ocorrência operacional",
  "Ajustes positivos e negativos com rastreabilidade",
] as const;

export const shippingStats = [
  {
    label: "Pedidos na fila",
    value: "186",
    help: "Backlog operacional do turno para separação.",
  },
  {
    label: "Separações em andamento",
    value: "34",
    help: "Ordens atualmente em picking ou conferência.",
  },
  {
    label: "Integrações com erro",
    value: "9",
    help: "Pedidos travados entre ERP, Bling e canais.",
  },
  {
    label: "SLA do dia",
    value: "94,2%",
    help: "Percentual dos pedidos dentro do prazo de despacho.",
  },
] as const;

export const shippingQueues = [
  {
    channel: "Bling V3",
    orders: 9,
    issue: "Fila de reprocessamento parada",
    action: "Retentativa automática e trilha de erro",
  },
  {
    channel: "Mercado Livre",
    orders: 61,
    issue: "Separação multipedido",
    action: "Agrupar por onda e prioridade",
  },
  {
    channel: "Shopee",
    orders: 37,
    issue: "Etiqueta pendente",
    action: "Gerar lote de impressão",
  },
  {
    channel: "Manual / B2B",
    orders: 14,
    issue: "Conferência final",
    action: "Validar romaneio e nota",
  },
] as const;

export const shippingFlow = [
  "Gerado",
  "Em separação",
  "Separado",
  "Em conferência",
  "Conferido",
  "Expedido",
] as const;

export const routeLoads = [
  { carrier: "Jadlog", route: "SP Capital", orders: 42, cutoff: "17:30" },
  { carrier: "Correios", route: "Interior SP", orders: 57, cutoff: "16:45" },
  { carrier: "Loggi", route: "Same day", orders: 19, cutoff: "15:00" },
] as const;

export const nfeInbox = [
  {
    key: "35260600000000000000550010000081273123456789",
    type: "Entrada",
    linked: "REC-240610-001",
    status: "Importada",
  },
  {
    key: "35260600000000000000550010000081274123456789",
    type: "Entrada",
    linked: "REC-240610-003",
    status: "Divergência",
  },
  {
    key: "35260600000000000000550010000091273123456789",
    type: "Saída",
    linked: "PED-240610-119",
    status: "Aguardando vínculo",
  },
] as const;

export const reportsCatalog = [
  "Saldo por depositante, SKU, lote e endereço",
  "Produtividade por operador, turno e etapa",
  "SLA de recebimento e expedição",
  "Rastreabilidade completa por NF, pedido e protocolo",
] as const;

export const usersOverview = [
  {
    name: "Vinícius Cruz",
    email: "ti@logistikos.com.br",
    role: "TI",
    depositante: "Global",
    status: "Ativo",
  },
  {
    name: "Larissa Recebimento",
    email: "larissa@evolveg.com.br",
    role: "OPERADOR",
    depositante: "Evolveg",
    status: "Ativo",
  },
  {
    name: "Carlos Estoque",
    email: "carlos@festcolor.com.br",
    role: "DEPOSITANTE",
    depositante: "Festcolor",
    status: "Ativo",
  },
  {
    name: "Bianca Qualidade",
    email: "bianca@rennova.com.br",
    role: "OPERADOR",
    depositante: "Rennova",
    status: "Pendente",
  },
] as const;

export const productOverview = [
  {
    sku: "EVG-SERUM-30",
    depositante: "Evolveg",
    method: "FEFO",
    unit: "UNIDADE",
    lot: "Sim",
    expiry: "Sim",
  },
  {
    sku: "FES-PAPER-09",
    depositante: "Festcolor",
    method: "FIFO",
    unit: "CAIXA",
    lot: "Não",
    expiry: "Não",
  },
  {
    sku: "REN-COLAG-01",
    depositante: "Rennova",
    method: "FEFO",
    unit: "UNIDADE",
    lot: "Sim",
    expiry: "Sim",
  },
  {
    sku: "SUA-VIT-C",
    depositante: "Sua Aliada",
    method: "FEFO",
    unit: "UNIDADE",
    lot: "Sim",
    expiry: "Sim",
  },
] as const;

export const configModules = [
  {
    href: "/configuracoes/depositantes",
    title: "Depositantes",
    description: "Carteira ativa, regras comerciais e segregação operacional.",
  },
  {
    href: "/configuracoes/usuarios",
    title: "Usuários",
    description: "Papéis, acessos e vínculo por depositante.",
  },
  {
    href: "/configuracoes/produtos",
    title: "Produtos",
    description: "SKU, retirada, lote, validade e dimensões.",
  },
  {
    href: "/configuracoes/enderecos",
    title: "Endereços",
    description: "Doca, pulmão, picking, bloqueado e expedição.",
  },
] as const;
