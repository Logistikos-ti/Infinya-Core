/* eslint-disable */
import type { AppUserContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDatePtBr, formatDateTimePtBr, getSaoPauloDateStamp } from "@/lib/utils";

type ProductRelation =
  | {
      sku?: string;
      nome?: string;
      codigo_interno?: string;
      metodo_retirada?: string;
      imagem_principal_url?: string | null;
      qtd_minima?: number | null;
      qtd_maxima?: number | null;
    }
  | Array<{
      sku?: string;
      nome?: string;
      codigo_interno?: string;
      metodo_retirada?: string;
      imagem_principal_url?: string | null;
      qtd_minima?: number | null;
      qtd_maxima?: number | null;
    }>
  | null;

type DepositanteRelation = { nome?: string } | Array<{ nome?: string }> | null;
type EnderecoRelation = { codigo?: string; area?: string } | Array<{ codigo?: string; area?: string }> | null;
type UserRelation = { nome?: string } | Array<{ nome?: string }> | null;
type StockRelation =
  | { lote?: string | null; validade_em?: string | null }
  | Array<{ lote?: string | null; validade_em?: string | null }>
  | null;

type WithdrawalMethod = "FEFO" | "FIFO" | "LIFO";

export type StockFilters = {
  depositanteId?: string;
  productTerm?: string;
  area?: string;
  lot?: string;
};

type RawStockRow = {
  id: string;
  depositante_id: string;
  quantidade: number | string;
  bloqueado: boolean;
  bloqueio_motivo?: string | null;
  bloqueado_em?: string | null;
  lote: string | null;
  validade_em: string | null;
  quantidade_reservada?: number | string | null;
  created_at: string;
  depositante: DepositanteRelation;
  produto: ProductRelation;
  endereco: EnderecoRelation;
};

type RawStockDetailRow = {
  id: string;
  quantidade: number | string;
  quantidade_reservada: number | string;
  bloqueado: boolean;
  bloqueio_motivo?: string | null;
  bloqueado_em?: string | null;
  lote: string | null;
  validade_em: string | null;
  fabricacao_em: string | null;
  created_at: string;
  depositante_id: string;
  produto_id: string;
  endereco_id: string;
  depositante: DepositanteRelation;
  produto: ProductRelation;
  endereco: EnderecoRelation;
};

type RawMovementRow = {
  id: string;
  depositante_id: string;
  tipo: string;
  quantidade: number | string;
  created_at: string;
  referencia_tipo: string | null;
  referencia_id: string | null;
  observacoes: string | null;
  produto: ProductRelation;
  endereco_origem: EnderecoRelation;
  endereco_destino: EnderecoRelation;
  estoque: StockRelation;
  criado_por: UserRelation;
};

type RawReceivingOrderReference = {
  id: string;
  codigo: string;
  nota_fiscal_numero: string | null;
  fornecedor_nome: string | null;
  created_at: string;
};

export type StockBalance = {
  id: string;
  protocol: string;
  sku: string;
  productName: string;
  internalCode: string;
  depositanteId: string;
  depositante: string;
  endereco: string;
  area: string;
  lote: string;
  saldo: string;
  reserved: string;
  available: string;
  rawQuantidade: number;
  rawReserved: number;
  validade: string;
  status: string;
  blockReason: string;
  blockedAt: string | null;
  createdAt: string;
  withdrawalMethod: WithdrawalMethod;
  withdrawalLabel: string;
  withdrawalRank: number;
  imageUrl?: string | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
};

export type StockMovement = {
  id: string;
  protocol: string;
  label: string;
  lot: string;
  expiry: string;
  reference: string;
  sku: string;
  type: string;
  quantity: number;
  createdAt: string;
};

export type StockTraceabilityProtocol = {
  id: string;
  protocol: string;
  sku: string;
  productName: string;
  depositante: string;
  endereco: string;
  area: string;
  lote: string;
  validade: string;
  saldo: string;
  reserved: string;
  available: string;
  createdAt: string;
  status: string;
  withdrawalMethod: WithdrawalMethod;
  withdrawalLabel: string;
};

export type ReceivingDepositProtocolSummary = {
  id: string;
  protocol: string;
  sku: string;
  productName: string;
  endereco: string;
  area: string;
  lote: string;
  validade: string;
  saldo: string;
  status: string;
  createdAt: string;
  withdrawalLabel: string;
};

export type StockTraceabilityDetail = {
  id: string;
  protocol: string;
  sku: string;
  productName: string;
  depositante: string;
  endereco: string;
  area: string;
  lote: string;
  validade: string;
  fabricacao: string;
  saldo: string;
  reservado: string;
  disponivel: string;
  status: string;
  blockReason: string;
  blockedAt: string | null;
  createdAt: string;
  withdrawalMethod: WithdrawalMethod;
  withdrawalLabel: string;
  source: {
    kind: "RECEBIMENTO" | "INVENTARIO_INICIAL";
    referenceLabel: string;
    referenceValue: string;
    noteNumber: string;
    counterpartLabel: string;
    counterpartValue: string;
    launchedAt: string;
    launchedBy: string;
  } | null;
  movements: Array<{
    id: string;
    type: string;
    quantity: string;
    route: string;
    reference: string;
    lot: string;
    expiry: string;
    user: string;
    createdAt: string;
    notes: string;
  }>;
};

export type StockExpiryAlert = {
  id: string;
  protocol: string;
  sku: string;
  productName: string;
  depositante: string;
  area: string;
  endereco: string;
  lote: string;
  saldo: string;
  expiryDate: string;
  daysToExpiry: number;
  severity: "critico" | "atencao";
  severityLabel: string;
};

export async function listStockBalancesFromDb(filters?: StockFilters) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("estoque")
    .select(
      "id, depositante_id, quantidade, quantidade_reservada, bloqueado, bloqueio_motivo, bloqueado_em, lote, validade_em, created_at, depositante:depositantes(nome), produto:produtos(sku, nome, codigo_interno, metodo_retirada, imagem_principal_url, qtd_minima, qtd_maxima), endereco:enderecos(codigo, area)",
    )
    .order("created_at", { ascending: false });

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  const { data } = await query;
  const balances = ((data ?? []) as RawStockRow[]).map(mapStockBalance);
  const filteredBalances = balances.filter((item) => matchesStockFilters(item, filters));

  return sortBalancesByWithdrawalMethod(filteredBalances);
}

export async function listStockMovementsFromDb(filters?: StockFilters, limit: number = 8) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("movimentacoes_estoque")
    .select(
      "id, depositante_id, tipo, quantidade, created_at, referencia_tipo, referencia_id, observacoes, produto:produtos(sku, nome, codigo_interno, metodo_retirada, imagem_principal_url, qtd_minima), endereco_origem:enderecos!movimentacoes_estoque_endereco_origem_id_fkey(codigo, area), endereco_destino:enderecos!movimentacoes_estoque_endereco_destino_id_fkey(codigo, area), estoque:estoque_id(lote, validade_em), criado_por:usuarios(nome)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  const { data } = await query;

  return ((data ?? []) as RawMovementRow[])
    .filter((item) => matchesMovementFilters(item, filters))
    .map(mapMovementSummary);
}

export async function listStockTraceabilityProtocolsFromDb(
  filters?: StockFilters,
  sourceBalances?: StockBalance[],
) {
  const balances = sourceBalances ?? (await listStockBalancesFromDb(filters));
  return balances.slice(0, 8).map(
    (item) =>
      ({
        id: item.id,
        protocol: item.protocol,
        sku: item.sku,
        productName: item.productName,
        depositante: item.depositante,
        endereco: item.endereco,
        area: item.area,
        lote: item.lote,
        validade: item.validade,
        saldo: item.saldo,
        reserved: item.reserved,
        available: item.available,
        createdAt: item.createdAt,
        status: item.status,
        withdrawalMethod: item.withdrawalMethod,
        withdrawalLabel: item.withdrawalLabel,
      }) satisfies StockTraceabilityProtocol,
  );
}

export async function listDepositProtocolsByReceivingOrderId(receivingOrderId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: movementRows, error } = await supabase
    .from("movimentacoes_estoque")
    .select("estoque_id")
    .eq("tipo", "ENTRADA")
    .eq("referencia_tipo", "PEDIDO_RECEBIMENTO")
    .eq("referencia_id", receivingOrderId);

  if (error) {
    throw new Error(`Não foi possível localizar os protocolos deste recebimento: ${error.message}`);
  }

  const stockIds = [...new Set((movementRows ?? []).map((item) => item.estoque_id).filter(Boolean))] as string[];

  if (!stockIds.length) {
    return [] satisfies ReceivingDepositProtocolSummary[];
  }

  const { data: stockRows, error: stockError } = await supabase
    .from("estoque")
    .select(
      "id, depositante_id, quantidade, bloqueado, lote, validade_em, created_at, depositante:depositantes(nome), produto:produtos(sku, nome, codigo_interno, metodo_retirada, imagem_principal_url, qtd_minima), endereco:enderecos(codigo, area)",
    )
    .in("id", stockIds)
    .order("created_at", { ascending: false });

  if (stockError) {
    throw new Error(`Não foi possível carregar os saldos gerados por este recebimento: ${stockError.message}`);
  }

  return ((stockRows ?? []) as RawStockRow[]).map((item) => {
    const balance = mapStockBalance(item);

    return {
      id: balance.id,
      protocol: balance.protocol,
      sku: balance.sku,
      productName: balance.productName,
      endereco: balance.endereco,
      area: balance.area,
      lote: balance.lote,
      validade: balance.validade,
      saldo: balance.saldo,
      status: balance.status,
      createdAt: balance.createdAt,
      withdrawalLabel: balance.withdrawalLabel,
    } satisfies ReceivingDepositProtocolSummary;
  });
}

export async function listStockExpiryAlertsFromDb(
  filters?: StockFilters,
  daysAhead = 30,
  sourceBalances?: StockBalance[],
) {
  const balances = sourceBalances ?? (await listStockBalancesFromDb(filters));
  const today = new Date();

  return balances
    .filter((item) => item.validade !== "-")
    .map((item) => {
      const [day, month, year] = item.validade.split("/");
      const expiryDate = new Date(`${year}-${month}-${day}T00:00:00`);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: item.id,
        protocol: item.protocol,
        sku: item.sku,
        productName: item.productName,
        depositante: item.depositante,
        area: item.area,
        endereco: item.endereco,
        lote: item.lote,
        saldo: item.saldo,
        expiryDate: item.validade,
        daysToExpiry: diffDays,
        severity: diffDays <= 7 ? "critico" : "atencao",
        severityLabel:
          diffDays < 0
            ? `Vencido há ${Math.abs(diffDays)} dia(s)`
            : diffDays === 0
              ? "Vence hoje"
              : `Vence em ${diffDays} dia(s)`,
      } satisfies StockExpiryAlert;
    })
    .filter((item) => item.daysToExpiry <= daysAhead)
    .sort((left, right) => left.daysToExpiry - right.daysToExpiry)
    .slice(0, 12);
}

export async function getStockTraceabilityDetailFromDb(stockId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: stockRow } = await supabase
    .from("estoque")
    .select(
      "id, quantidade, quantidade_reservada, bloqueado, bloqueio_motivo, bloqueado_em, lote, validade_em, fabricacao_em, created_at, depositante_id, produto_id, endereco_id, depositante:depositantes(nome), produto:produtos(sku, nome, codigo_interno, metodo_retirada, imagem_principal_url, qtd_minima), endereco:enderecos(codigo, area)",
    )
    .eq("id", stockId)
    .maybeSingle();

  if (!stockRow) {
    return null;
  }

  const stock = stockRow as RawStockDetailRow;

  const { data: movementRows } = await supabase
    .from("movimentacoes_estoque")
    .select(
      "id, depositante_id, tipo, quantidade, created_at, referencia_tipo, referencia_id, observacoes, produto:produtos(sku, nome, codigo_interno, metodo_retirada, imagem_principal_url, qtd_minima), endereco_origem:enderecos!movimentacoes_estoque_endereco_origem_id_fkey(codigo, area), endereco_destino:enderecos!movimentacoes_estoque_endereco_destino_id_fkey(codigo, area), estoque:estoque_id(lote, validade_em), criado_por:usuarios(nome)",
    )
    .eq("estoque_id", stock.id)
    .order("created_at", { ascending: true });

  const movements = ((movementRows ?? []) as RawMovementRow[]).map((item) => ({
    id: item.id,
    type: formatMovementType(item.tipo),
    quantity: Number(item.quantidade ?? 0).toLocaleString("pt-BR"),
    route: buildMovementRoute(
      extractEnderecoField(item.endereco_origem, "codigo"),
      extractEnderecoField(item.endereco_destino, "codigo"),
    ),
    reference: formatReference(item.referencia_tipo, item.referencia_id, item.observacoes),
    lot: extractStockField(item.estoque, "lote") ?? stock.lote ?? "-",
    expiry: extractStockField(item.estoque, "validade_em")
      ? formatDate(extractStockField(item.estoque, "validade_em")!)
      : stock.validade_em
        ? formatDate(stock.validade_em)
        : "-",
    user: extractUserName(item.criado_por) ?? "Sistema",
    createdAt: formatDateTimePtBr(item.created_at),
    notes: item.observacoes?.trim() || "Sem observações.",
  }));

  const firstInboundMovement = (movementRows ?? []).find(
    (item) => item.tipo === "ENTRADA" && item.referencia_tipo === "PEDIDO_RECEBIMENTO",
  ) as RawMovementRow | undefined;
  const firstInventoryMovement = (movementRows ?? []).find(
    (item) => item.referencia_tipo === "INVENTARIO_INICIAL",
  ) as RawMovementRow | undefined;

  let source: StockTraceabilityDetail["source"] = null;

  if (firstInboundMovement?.referencia_id) {
    const { data: receivingOrder } = await supabase
      .from("pedidos_recebimento")
      .select("id, codigo, nota_fiscal_numero, fornecedor_nome, created_at")
      .eq("id", firstInboundMovement.referencia_id)
      .maybeSingle();

    if (receivingOrder) {
      const order = receivingOrder as RawReceivingOrderReference;
      source = {
        kind: "RECEBIMENTO",
        referenceLabel: "Pedido de recebimento",
        referenceValue: order.codigo,
        noteNumber: order.nota_fiscal_numero ?? "-",
        counterpartLabel: "Fornecedor",
        counterpartValue: order.fornecedor_nome ?? "Fornecedor não informado",
        launchedAt: formatDateTimePtBr(order.created_at),
        launchedBy: extractUserName(firstInboundMovement.criado_por) ?? "Sistema",
      };
    }
  } else if (firstInventoryMovement) {
    source = {
      kind: "INVENTARIO_INICIAL",
      referenceLabel: "Origem",
      referenceValue: "Inventário inicial",
      noteNumber: "-",
      counterpartLabel: "Responsável pelo lançamento",
      counterpartValue: extractUserName(firstInventoryMovement.criado_por) ?? "Sistema",
      launchedAt: formatDateTimePtBr(firstInventoryMovement.created_at),
      launchedBy: extractUserName(firstInventoryMovement.criado_por) ?? "Sistema",
    };
  }

  const balance = mapStockBalance(stock);
  const quantity = Number(stock.quantidade ?? 0);
  const reserved = Number(stock.quantidade_reservada ?? 0);

  return {
    id: stock.id,
    protocol: balance.protocol,
    sku: balance.sku,
    productName: balance.productName,
    depositante: balance.depositante,
    endereco: balance.endereco,
    area: balance.area,
    lote: balance.lote,
    validade: balance.validade,
    fabricacao: stock.fabricacao_em ? formatDate(stock.fabricacao_em) : "-",
    saldo: balance.saldo,
    reservado: reserved.toLocaleString("pt-BR"),
    disponivel: Math.max(quantity - reserved, 0).toLocaleString("pt-BR"),
    status: balance.status,
    blockReason: balance.blockReason,
    blockedAt: balance.blockedAt,
    createdAt: balance.createdAt,
    withdrawalMethod: balance.withdrawalMethod,
    withdrawalLabel: balance.withdrawalLabel,
    source,
    movements,
  } satisfies StockTraceabilityDetail;
}

export async function listStockStatsFromDb(
  user: AppUserContext,
  filters?: StockFilters,
  sourceBalances?: StockBalance[],
  sourceExpiryAlerts?: StockExpiryAlert[],
) {
  const balances = sourceBalances ?? (await listStockBalancesFromDb(filters));
  const expiryAlerts = sourceExpiryAlerts ?? (await listStockExpiryAlertsFromDb(filters, 30, balances));

  let totalFisico = 0;
  let totalReservado = 0;
  
  for (const b of balances) {
    totalFisico += b.rawQuantidade;
    totalReservado += b.rawReserved;
  }
  
  const totalDisponivel = totalFisico - totalReservado;

  return [
    {
      label: "Saldo total",
      value: totalFisico.toLocaleString("pt-BR"),
      help: "Saldo total físico",
    },
    {
      label: "Reservado",
      value: totalReservado.toLocaleString("pt-BR"),
      help: "Saldo reservado",
    },
    {
      label: "A vencer",
      value: `${expiryAlerts.length} lotes`,
      help: "ver",
    },
    {
      label: "Acuracidade",
      value: "99,2%",
      help: "▲ 0,3%",
    },
  ] as const;
}

function mapStockBalance(item: RawStockRow | RawStockDetailRow): StockBalance {
  const withdrawalMethod = extractWithdrawalMethod(item.produto);
  const createdAt = item.created_at;
  const expiryDate = item.validade_em;

  const rawQuantidade = Number(item.quantidade ?? 0);
  const rawReserved = Number((item as any).quantidade_reservada ?? 0);
  const available = Math.max(0, rawQuantidade - rawReserved);

  return {
    id: item.id,
    protocol: buildTraceabilityProtocol(item),
    sku: extractProductField(item.produto, "sku") ?? "SKU",
    productName: extractProductField(item.produto, "nome") ?? "Produto sem descrição",
    internalCode: extractProductField(item.produto, "codigo_interno") ?? "",
    depositanteId: item.depositante_id,
    depositante: extractDepositanteName(item.depositante) ?? "Sem depositante",
    endereco: extractEnderecoField(item.endereco, "codigo") ?? "Sem endereço",
    area: extractEnderecoField(item.endereco, "area") ?? "Sem área",
    lote: item.lote ?? "-",
    saldo: rawQuantidade.toLocaleString("pt-BR"),
    reserved: rawReserved.toLocaleString("pt-BR"),
    available: available.toLocaleString("pt-BR"),
    rawQuantidade,
    rawReserved,
    validade: expiryDate ? formatDate(expiryDate) : "-",
    status: item.bloqueado ? "Bloqueado" : "Disponível",
    blockReason: item.bloqueio_motivo?.trim() || "",
    blockedAt: item.bloqueado_em ? formatDateTimePtBr(item.bloqueado_em) : null,
    createdAt: formatDateTimePtBr(createdAt),
    withdrawalMethod,
    withdrawalLabel: formatWithdrawalLabel(withdrawalMethod, expiryDate, createdAt),
    withdrawalRank: buildWithdrawalRank(withdrawalMethod, expiryDate, createdAt),
    imageUrl: extractProductField(item.produto, "imagem_principal_url") as string | null,
    minQuantity: Number(extractProductField(item.produto, "qtd_minima") ?? 0) || null,
    maxQuantity: Number(extractProductField(item.produto, "qtd_maxima") ?? 0) || null,
  };
}

function mapMovementSummary(item: RawMovementRow): StockMovement {
  const sku = extractProductField(item.produto, "sku") ?? "-";
  const lot = extractStockField(item.estoque, "lote") ?? "-";
  const expiryRaw = extractStockField(item.estoque, "validade_em");
  const expiry = expiryRaw ? formatDate(expiryRaw) : "-";
  const destination = extractEnderecoField(item.endereco_destino, "codigo");
  const origin = extractEnderecoField(item.endereco_origem, "codigo");

  return {
    id: item.id,
    protocol: buildTraceabilityProtocol({
      createdAt: item.created_at,
      id: item.id,
    }),
    label: `${formatMovementType(item.tipo)} de ${Number(item.quantidade ?? 0).toLocaleString("pt-BR")} no SKU ${sku} ${buildMovementRoute(origin, destination)} em ${formatDateTimePtBr(item.created_at)}`,
    lot,
    expiry,
    reference: formatReference(item.referencia_tipo, item.referencia_id, item.observacoes),
    sku,
    type: item.tipo,
    quantity: Number(item.quantidade ?? 0),
    createdAt: item.created_at,
  };
}

function matchesStockFilters(item: StockBalance, filters?: StockFilters) {
  if (!filters) {
    return true;
  }

  if (filters.area && item.area !== filters.area) {
    return false;
  }

  if (filters.lot && !normalizeSearch(item.lote).includes(normalizeSearch(filters.lot))) {
    return false;
  }

  if (filters.productTerm) {
    const query = normalizeSearch(filters.productTerm);
    const haystack = [item.sku, item.productName, item.internalCode].map(normalizeSearch);

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  return true;
}

function matchesMovementFilters(item: RawMovementRow, filters?: StockFilters) {
  if (!filters) {
    return true;
  }

  if (filters.productTerm) {
    const query = normalizeSearch(filters.productTerm);
    const sku = normalizeSearch(extractProductField(item.produto, "sku") ?? "");
    const productName = normalizeSearch(extractProductField(item.produto, "nome") ?? "");
    const internalCode = normalizeSearch(extractProductField(item.produto, "codigo_interno") ?? "");

    if (![sku, productName, internalCode].some((value) => value.includes(query))) {
      return false;
    }
  }

  if (filters.lot) {
    const lot = normalizeSearch(extractStockField(item.estoque, "lote") ?? "");
    if (!lot.includes(normalizeSearch(filters.lot))) {
      return false;
    }
  }

  if (filters.area) {
    const originÁrea = extractEnderecoField(item.endereco_origem, "area");
    const destinationÁrea = extractEnderecoField(item.endereco_destino, "area");

    if (originÁrea !== filters.area && destinationÁrea !== filters.area) {
      return false;
    }
  }

  return true;
}

function sortBalancesByWithdrawalMethod(balances: StockBalance[]) {
  return [...balances].sort((left, right) => {
    if (left.withdrawalRank !== right.withdrawalRank) {
      return left.withdrawalRank - right.withdrawalRank;
    }

    return left.protocol.localeCompare(right.protocol, "pt-BR");
  });
}

function extractProductField(
  value: ProductRelation,
  field: "sku" | "nome" | "codigo_interno" | "metodo_retirada" | "imagem_principal_url" | "qtd_minima" | "qtd_maxima",
): any {
  if (Array.isArray(value)) {
    return value[0]?.[field] !== undefined ? value[0][field] : null;
  }

  if (value && typeof value[field] !== "undefined") {
    return value[field];
  }

  return null;
}

function extractDepositanteName(value: DepositanteRelation) {
  if (Array.isArray(value)) {
    return typeof value[0]?.nome === "string" ? value[0].nome : null;
  }

  if (value && typeof value.nome === "string") {
    return value.nome;
  }

  return null;
}

function extractEnderecoField(value: EnderecoRelation, field: "codigo" | "area") {
  if (Array.isArray(value)) {
    return typeof value[0]?.[field] === "string" ? value[0][field] : null;
  }

  if (value && typeof value[field] === "string") {
    return value[field] as string;
  }

  return null;
}

function extractUserName(value: UserRelation) {
  if (Array.isArray(value)) {
    return typeof value[0]?.nome === "string" ? value[0].nome : null;
  }

  if (value && typeof value.nome === "string") {
    return value.nome;
  }

  return null;
}

function extractStockField(value: StockRelation, field: "lote" | "validade_em") {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first?.[field] === "string" ? first[field] : null;
  }

  if (value && typeof value[field] === "string") {
    return value[field] as string;
  }

  return null;
}

function extractWithdrawalMethod(value: ProductRelation): WithdrawalMethod {
  const method = extractProductField(value, "metodo_retirada");
  if (method === "FIFO" || method === "LIFO") {
    return method;
  }

  return "FEFO";
}

function formatDate(value: string) {
  return formatDatePtBr(new Date(`${value}T00:00:00`));
}

function formatMovementType(value: string) {
  switch (value) {
    case "ENTRADA":
      return "Entrada";
    case "SAIDA":
      return "SaÃ­da";
    case "TRANSFERENCIA":
      return "TransferÃªncia";
    case "AJUSTE_POSITIVO":
      return "Ajuste positivo";
    case "AJUSTE_NEGATIVO":
      return "Ajuste negativo";
    case "BLOQUEIO":
      return "Bloqueio";
    case "DESBLOQUEIO":
      return "Desbloqueio";
    default:
      return value;
  }
}

function buildTraceabilityProtocol(input: { created_at?: string; createdAt?: string; id: string }) {
  const createdAt = input.created_at ?? input.createdAt ?? new Date().toISOString();
  const dateStamp = getSaoPauloDateStamp(createdAt) ?? "00000000";

  return `DEP-${dateStamp}-${input.id.slice(0, 8).toUpperCase()}`;
}

function buildMovementRoute(origin: string | null, destination: string | null) {
  if (origin && destination) {
    return `de ${origin} para ${destination}`;
  }

  if (destination) {
    return `para ${destination}`;
  }

  if (origin) {
    return `a partir de ${origin}`;
  }

  return "sem endereÃ§o vinculado";
}

function formatReference(
  referenceType: string | null,
  referenceId: string | null,
  notes: string | null,
) {
  if (referenceType && referenceId) {
    return `${referenceType} Â· ${referenceId.slice(0, 8).toUpperCase()}`;
  }

  if (notes?.trim()) {
    return notes.trim();
  }

  return "Sem referÃªncia";
}

function buildWithdrawalRank(
  method: WithdrawalMethod,
  expiryDate: string | null,
  createdAt: string,
) {
  const entryTimestamp = new Date(createdAt).getTime();

  if (method === "FEFO") {
    const expiryTimestamp = expiryDate
      ? new Date(`${expiryDate}T00:00:00`).getTime()
      : Number.MAX_SAFE_INTEGER;

    return expiryTimestamp * 1000 + entryTimestamp;
  }

  if (method === "FIFO") {
    return entryTimestamp;
  }

  return Number.MAX_SAFE_INTEGER - entryTimestamp;
}

function formatWithdrawalLabel(
  method: WithdrawalMethod,
  expiryDate: string | null,
  createdAt: string,
) {
  if (method === "FEFO") {
    return expiryDate
      ? `FEFO Â· vence em ${formatDate(expiryDate)}`
      : "FEFO Â· aguardando validade";
  }

  if (method === "FIFO") {
    return `FIFO Â· entrou em ${formatDatePtBr(createdAt)}`;
  }

  return `LIFO Â· entrou em ${formatDatePtBr(createdAt)}`;
}

function normalizeSearch(value: string | null | undefined) {
  return (
    value
      ?.normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR")
      .trim() ?? ""
  );
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDateOnly(value: string) {
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) {
    return null;
  }

  return new Date(Number(year), Number(month) - 1, Number(day));
}

function diffInDays(start: Date, end: Date) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay);
}


