import type { AppUserContext } from "@/lib/auth";
import { registrarLancamentosExpedicao } from "@/lib/billing";
import { extractCarrierName, extractTrackingCode, formatShippingStatusLabel, isOrderLockedForDecision } from "@/lib/shipping";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRowsInChunks } from "@/lib/supabase/chunked-fetch";

type RelationName = { nome?: string } | { nome?: string }[] | null;

type RawShippingOrderRow = {
  id: string;
  codigo: string;
  numero_wms: number | string | null;
  status: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  valor_total: number | string | null;
  quantidade_itens: number | null;
  quantidade_unidades: number | string | null;
  data_pedido: string | null;
  previsao_envio_em: string | null;
  cliente_nome: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  payload_origem: Record<string, unknown> | null;
  depositante_id: string;
  depositante: RelationName;
};

type RawRomaneioRow = {
  id: string;
  codigo: string;
  status: RomaneioStatus;
  transportadora_id: string | null;
  transportadora_nome: string;
  transportadora_cnpj: string | null;
  motorista_nome: string | null;
  motorista_documento: string | null;
  veiculo_modelo: string | null;
  veiculo_placa: string | null;
  doca: string | null;
  coleta_prevista: string | null;
  observacoes: string | null;
  conferencia_dupla_checagem: Record<string, unknown> | null;
  criado_por: string | null;
  liberado_por: string | null;
  cancelado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  liberado_em: string | null;
  cancelado_em: string | null;
};

type RawRomaneioLinkRow = {
  romaneio_id: string;
  pedido_expedicao_id: string;
  sequencia: number;
};

export type RomaneioStatus = "ABERTO" | "LIBERADO" | "CANCELADO";

export type RomaneioRecordOrder = {
  id: string;
  code: string;
  externalNumber: string;
  depositanteId: string;
  depositante: string;
  customer: string;
  destination: string;
  carrierName: string;
  invoiceNumber: string;
  /** Chave de acesso completa da NF-e (44 dígitos), sem a transformação
   * lossy de extractInvoiceNumber -- "" quando não disponível. Usado pra
   * comparação exata no bipe de fechamento do romaneio (mobile), não pra
   * exibição. */
  invoiceKey: string;
  /** Número da nota sem o prefixo "NF ", pra comparação exata -- "" quando
   * não disponível. */
  invoiceNumberDigits: string;
  /** Código de rastreio real (transporte.volumes[0].codigoRastreamento) --
   * "" quando não disponível. */
  trackingCode: string;
  /** Quantidade de volumes (embalagens/pacotes físicos) declarada na NF-e
   * (transp.vol/qVol somado, gravado em transporte.volumes[].quantidade na
   * importação do XML) -- não confundir com `unitsRaw` (unidades de
   * produto). Pedidos sem XML/NF ainda não têm essa informação real; conta
   * como 1 volume (mesmo default usado em full-actions.ts/shipping-danfe.ts
   * pra "pelo menos 1 pacote sai fisicamente"). */
  volumeCount: number;
  status: string;
  statusLabel: string;
  unitsRaw: number;
  units: string;
  itemCount: number;
  totalRaw: number;
  total: string;
  orderDate: string;
  shipForecast: string;
};

export type RomaneioSuggestionGroup = {
  slug: string;
  carrierName: string;
  transportadoraId: string | null;
  transportadoraCnpj: string | null;
  orderCount: number;
  totalUnitsRaw: number;
  totalUnits: string;
  totalValueRaw: number;
  totalValue: string;
  depositantes: string[];
  destinations: string[];
  oldestOrderDate: string;
  cutoff: string;
  statuses: string[];
  orders: RomaneioRecordOrder[];
};

export type RomaneioRecordListItem = {
  id: string;
  code: string;
  status: RomaneioStatus;
  statusLabel: string;
  carrierName: string;
  transportadoraId: string | null;
  transportadoraCnpj: string | null;
  driverName: string | null;
  driverDocument: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  dock: string | null;
  /** Previsão de coleta informada pelo operador na criação -- texto livre,
   * independente de createdAt (esse é o timestamp real de auditoria,
   * não editável). */
  expectedPickup: string | null;
  notes: string | null;
  /** JSON (string) do payload de dupla checagem do fechamento mobile
   * (fotos + conferido_por/em) -- SEMPRE de conferencia_dupla_checagem
   * quando presente; cai pra `notes` só pra romaneios fechados antes desta
   * coluna existir (o payload antigo foi gravado ali por engano, ver
   * migration 20260903202320). `notes` propriamente dito nunca mais é
   * tocado pelo fechamento -- fica livre pra texto humano. */
  conferenceInfoJson: string | null;
  createdAt: string;
  updatedAt: string;
  releasedAt: string | null;
  canceledAt: string | null;
  orderCount: number;
  totalUnitsRaw: number;
  totalUnits: string;
  totalValueRaw: number;
  totalValue: string;
  depositantes: string[];
  destinations: string[];
  orders: RomaneioRecordOrder[];
};

export type RomaneioRecordDetail = RomaneioRecordListItem & {
  isOpen: boolean;
};

export type RomaneioRecordFilters = {
  status?: string;
  depositanteId?: string;
  carrier?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type RomaneioTransportadoraOption = {
  id: string;
  nome: string;
  cnpj: string;
};

const SUGGESTION_SOURCE_STATUSES = ["PRONTO_ROMANEIO"] as const;
const ACTIVE_RECORD_STATUSES: RomaneioStatus[] = ["ABERTO", "LIBERADO"];

export function isRomaneioRecordsSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    error?.code === "42704" ||
    error?.message?.includes("romaneios_carga") === true
  );
}

export async function resolveValidUserId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId?: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return null;
  const { data } = await supabase.from("usuarios").select("id").eq("id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function listRomaneioSuggestionsFromDb(
  user: AppUserContext,
  filters?: RomaneioRecordFilters,
) {
  const orders = await listAvailableShippingOrdersForRomaneio(user, filters);
  const groups = new Map<string, RomaneioSuggestionGroup>();

  for (const order of orders) {
    const key = order.carrierName.trim().toLocaleLowerCase("pt-BR");
    const current =
      groups.get(key) ??
      ({
        slug: slugify(order.carrierName),
        carrierName: order.carrierName,
        transportadoraId: null,
        transportadoraCnpj: null,
        orderCount: 0,
        totalUnitsRaw: 0,
        totalUnits: "0",
        totalValueRaw: 0,
        totalValue: formatCurrency(0),
        depositantes: [],
        destinations: [],
        oldestOrderDate: order.orderDate,
        cutoff: "Sem previsão",
        statuses: [],
        orders: [],
      } satisfies RomaneioSuggestionGroup);

    current.orderCount += 1;
    current.totalUnitsRaw += order.unitsRaw;
    current.totalUnits = current.totalUnitsRaw.toLocaleString("pt-BR");
    current.totalValueRaw += order.totalRaw;
    current.totalValue = formatCurrency(current.totalValueRaw);
    current.orders.push(order);

    if (!current.depositantes.includes(order.depositante)) {
      current.depositantes.push(order.depositante);
    }

    if (!current.destinations.includes(order.destination)) {
      current.destinations.push(order.destination);
    }

    if (!current.statuses.includes(order.statusLabel)) {
      current.statuses.push(order.statusLabel);
    }

    current.cutoff = getLatestCutoff(current.cutoff, order.shipForecast);
    current.oldestOrderDate = getOldestDateLabel(current.oldestOrderDate, order.orderDate);
    groups.set(key, current);
  }

  const transportadoras = await listTransportadoraOptionsFromDb();

  return [...groups.values()]
    .map((group) => {
      const match = transportadoras.find(
        (item) => item.nome.trim().toLocaleLowerCase("pt-BR") === group.carrierName.trim().toLocaleLowerCase("pt-BR"),
      );

      return {
        ...group,
        transportadoraId: match?.id ?? null,
        transportadoraCnpj: match?.cnpj ?? null,
        orders: group.orders.sort(compareOrdersForRoute),
        depositantes: [...group.depositantes].sort((left, right) => left.localeCompare(right, "pt-BR")),
        destinations: [...group.destinations].sort((left, right) => left.localeCompare(right, "pt-BR")).slice(0, 6),
      };
    })
    .sort((left, right) => left.carrierName.localeCompare(right.carrierName, "pt-BR"));
}

export async function listRomaneioRecordsFromDb(user: AppUserContext, filters?: RomaneioRecordFilters) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("romaneios_carga")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    if (isRomaneioRecordsSchemaMissing(error)) {
      return [] as RomaneioRecordListItem[];
    }

    throw new Error(`Não foi possível carregar os romaneios criados: ${error.message}`);
  }

  const rows = (data ?? []) as RawRomaneioRow[];
  const ids = rows.map((item) => item.id);
  const links = await listRomaneioLinksByRecordIds(ids);
  const orderIds = [...new Set(links.map((item) => item.pedido_expedicao_id))];
  const orders = await listShippingOrdersByIds(orderIds);
  const orderMap = new Map(orders.map((item) => [item.id, item]));
  const recordLinks = groupLinksByRomaneioId(links);

  return rows
    .map((row) => {
      const linkedOrders = (recordLinks.get(row.id) ?? [])
        .map((link) => orderMap.get(link.pedido_expedicao_id))
        .filter((item): item is RomaneioRecordOrder => Boolean(item))
        .sort(compareOrdersForRoute);

      return mapRomaneioRecordListItem(row, linkedOrders);
    })
    .filter((item) => canUserSeeRecord(user, item))
    .filter((item) => matchesRecordFilters(item, filters));
}

export async function getRomaneioRecordDetailFromDb(user: AppUserContext, id: string) {
  const records = await listRomaneioRecordsFromDb(user);
  const record = records.find((item) => item.id === id) ?? null;

  if (!record) {
    return null;
  }

  return {
    ...record,
    isOpen: record.status === "ABERTO",
  } satisfies RomaneioRecordDetail;
}

export async function createRomaneioRecordFromOrders(params: {
  user: AppUserContext;
  orderIds: string[];
  transportadoraId?: string | null;
  transportadoraNome?: string | null;
  motoristaNome?: string | null;
  veiculoPlaca?: string | null;
  doca?: string | null;
  coletaPrevista?: string | null;
  observacoes?: string | null;
}) {
  const orderIds = [...new Set(params.orderIds.map((item) => item.trim()).filter(Boolean))];
  if (!orderIds.length) {
    throw new Error("Selecione ao menos um pedido para gerar o romaneio.");
  }

  const orders = await listShippingOrdersByIds(orderIds);
  const visibleOrders = orders.filter((item) => canUserSeeOrder(params.user, item));

  if (!visibleOrders.length) {
    throw new Error("Nenhum pedido elegível foi encontrado para este romaneio.");
  }

  const linkedOrderIds = await listOrderIdsAlreadyLinkedToActiveRomaneio(orderIds);
  const availableOrders = visibleOrders.filter((item) => !linkedOrderIds.has(item.id));

  if (!availableOrders.length) {
    throw new Error("Os pedidos selecionados já estão vinculados a outro romaneio em aberto.");
  }

  const carrierName =
    params.transportadoraNome?.trim() ||
    availableOrders[0]?.carrierName ||
    "Transportadora não informada";

  const matchedTransportadora =
    params.transportadoraId
      ? (await listTransportadoraOptionsFromDb()).find((item) => item.id === params.transportadoraId) ?? null
      : null;

  const code = buildRomaneioCode();
  const admin = createSupabaseAdminClient();
  const validUserId = await resolveValidUserId(admin, params.user.id);

  const { data: created, error: createError } = await admin
    .from("romaneios_carga")
    .insert({
      codigo: code,
      transportadora_id: matchedTransportadora?.id ?? null,
      transportadora_nome: matchedTransportadora?.nome ?? carrierName,
      transportadora_cnpj: matchedTransportadora?.cnpj ?? null,
      motorista_nome: normalizeNullableText(params.motoristaNome),
      veiculo_placa: normalizeNullableText(params.veiculoPlaca),
      doca: normalizeNullableText(params.doca),
      coleta_prevista: normalizeNullableText(params.coletaPrevista),
      observacoes: normalizeNullableText(params.observacoes),
      criado_por: validUserId,
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(`Não foi possível criar o romaneio: ${createError?.message ?? "sem retorno do banco"}`);
  }

  const linksPayload = availableOrders.map((order, index) => ({
    romaneio_id: created.id,
    pedido_expedicao_id: order.id,
    sequencia: index + 1,
  }));

  const { error: linksError } = await admin.from("romaneios_carga_pedidos").insert(linksPayload);

  if (linksError) {
    await admin.from("romaneios_carga").delete().eq("id", created.id);
    throw new Error(`Não foi possível vincular os pedidos ao romaneio: ${linksError.message}`);
  }

  return created.id;
}

export async function updateRomaneioRecordDetails(params: {
  user: AppUserContext;
  romaneioId: string;
  transportadoraId?: string | null;
  transportadoraNome?: string | null;
  motoristaNome?: string | null;
  motoristaDocumento?: string | null;
  veiculoModelo?: string | null;
  veiculoPlaca?: string | null;
  doca?: string | null;
  coletaPrevista?: string | null;
  observacoes?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const transportadoras = params.transportadoraId ? await listTransportadoraOptionsFromDb() : [];
  const matchedTransportadora = params.transportadoraId
    ? transportadoras.find((item) => item.id === params.transportadoraId) ?? null
    : null;

  const payload = {
    transportadora_id: matchedTransportadora?.id ?? null,
    transportadora_nome:
      matchedTransportadora?.nome ??
      params.transportadoraNome?.trim() ??
      "Transportadora não informada",
    transportadora_cnpj: matchedTransportadora?.cnpj ?? null,
    motorista_nome: normalizeNullableText(params.motoristaNome),
    motorista_documento: normalizeNullableText(params.motoristaDocumento),
    veiculo_modelo: normalizeNullableText(params.veiculoModelo),
    veiculo_placa: normalizeNullableText(params.veiculoPlaca),
    doca: normalizeNullableText(params.doca),
    coleta_prevista: normalizeNullableText(params.coletaPrevista),
    observacoes: normalizeNullableText(params.observacoes),
  };

  const { error } = await admin.from("romaneios_carga").update(payload).eq("id", params.romaneioId);

  if (error) {
    throw new Error(`Não foi possível atualizar o romaneio: ${error.message}`);
  }
}

export async function cancelRomaneioRecord(params: { user: AppUserContext; romaneioId: string }) {
  const admin = createSupabaseAdminClient();
  const links = await listRomaneioLinksByRecordIds([params.romaneioId]);
  const orderIds = links.map((item) => item.pedido_expedicao_id);
  const validUserId = await resolveValidUserId(admin, params.user.id);

  const { error: updateRecordError } = await admin
    .from("romaneios_carga")
    .update({
      status: "CANCELADO",
      cancelado_por: validUserId,
      cancelado_em: new Date().toISOString(),
    })
    .eq("id", params.romaneioId);

  if (updateRecordError) {
    throw new Error(`Não foi possível cancelar o romaneio: ${updateRecordError.message}`);
  }

  if (orderIds.length) {
    const { error: updateOrdersError } = await admin
      .from("pedidos_expedicao")
      .update({ status: "PRONTO_ROMANEIO" })
      .in("id", orderIds);

    if (updateOrdersError) {
      throw new Error(`Romaneio cancelado, mas os pedidos não foram devolvidos para a fila: ${updateOrdersError.message}`);
    }
  }
}

export async function listTransportadoraOptionsFromDb() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("transportadoras")
    .select("id, nome, cnpj")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    return [] as RomaneioTransportadoraOption[];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id),
    nome: String(item.nome ?? ""),
    cnpj: String(item.cnpj ?? ""),
  }));
}

export async function listAvailableShippingOrdersForRomaneio(user: AppUserContext, filters?: RomaneioRecordFilters) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_wms, status, numero_pedido, numero_loja, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, cliente_nome, cliente_cidade, cliente_uf, payload_origem, depositante_id, depositante:depositantes(nome)",
    )
    .in("status", [...SUGGESTION_SOURCE_STATUSES])
    .order("data_pedido", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (filters?.depositanteId) {
    query = query.eq("depositante_id", filters.depositanteId);
  }

  if (filters?.dateFrom) {
    query = query.gte("data_pedido", `${filters.dateFrom}T00:00:00`);
  }

  if (filters?.dateTo) {
    query = query.lte("data_pedido", `${filters.dateTo}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Não foi possível carregar os pedidos prontos para romaneio: ${error.message}`);
  }

  const orders = ((data ?? []) as RawShippingOrderRow[])
    .map(mapRomaneioOrderSummary)
    .filter((item) => canUserSeeOrder(user, item))
    .filter((item) => {
      if (filters?.carrier) {
        return item.carrierName.toLocaleLowerCase("pt-BR").includes(filters.carrier.trim().toLocaleLowerCase("pt-BR"));
      }

      return true;
    });

  const linkedOrderIds = await listOrderIdsAlreadyLinkedToActiveRomaneio(orders.map((item) => item.id));
  return orders.filter((item) => !linkedOrderIds.has(item.id));
}

async function listOrderIdsAlreadyLinkedToActiveRomaneio(orderIds: string[]) {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) {
    return new Set<string>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("romaneios_carga_pedidos")
    .select("pedido_expedicao_id, romaneio:romaneios_carga!inner(status)")
    .in("pedido_expedicao_id", ids);

  if (error) {
    if (isRomaneioRecordsSchemaMissing(error)) {
      return new Set<string>();
    }

    throw new Error(`Não foi possível validar pedidos já romaneados: ${error.message}`);
  }

  const linkedIds = (data ?? [])
    .filter((item) => {
      const relation = item.romaneio;
      const record = Array.isArray(relation) ? relation[0] : relation;
      const status = typeof record?.status === "string" ? (record.status as RomaneioStatus) : null;
      return status ? ACTIVE_RECORD_STATUSES.includes(status) : false;
    })
    .map((item) => String(item.pedido_expedicao_id));

  return new Set(linkedIds);
}

async function listRomaneioLinksByRecordIds(recordIds: string[]) {
  const ids = [...new Set(recordIds.filter(Boolean))];
  if (!ids.length) {
    return [] as RawRomaneioLinkRow[];
  }

  const admin = createSupabaseAdminClient();
  const { rows, error } = await fetchRowsInChunks<RawRomaneioLinkRow>(ids, 200, (chunk) =>
    admin
      .from("romaneios_carga_pedidos")
      .select("romaneio_id, pedido_expedicao_id, sequencia")
      .in("romaneio_id", chunk)
      .order("sequencia", { ascending: true }),
  );

  if (error) {
    if (isRomaneioRecordsSchemaMissing(error)) {
      return [] as RawRomaneioLinkRow[];
    }

    throw new Error(`Não foi possível carregar os vínculos do romaneio: ${error.message}`);
  }

  return rows;
}

type RawOrderItemWeightRow = {
  pedido_expedicao_id: string;
  quantidade: number | string | null;
  produto: { peso_kg: number | string | null } | Array<{ peso_kg: number | string | null }> | null;
};

/**
 * Peso total (kg) de cada pedido, somando quantidade * produtos.peso_kg dos
 * itens vinculados. Não há peso em pedidos_expedicao -- só nos produtos do
 * catálogo (peso_kg é peso por unidade, não por embalagem) -- por isso
 * precisa desse join com pedidos_expedicao_itens em vez de vir pronto do
 * pedido. Itens de produtos sem peso cadastrado (peso_kg null) contam 0,
 * não travam a soma do resto.
 */
export async function getOrderWeightsByOrderId(orderIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  const weights = new Map<string, number>();
  if (!ids.length) return weights;

  const admin = createSupabaseAdminClient();
  const { rows, error } = await fetchRowsInChunks<RawOrderItemWeightRow>(ids, 200, (chunk) =>
    admin
      .from("pedidos_expedicao_itens")
      .select("pedido_expedicao_id, quantidade, produto:produtos(peso_kg)")
      .in("pedido_expedicao_id", chunk),
  );

  if (error) {
    throw new Error(`Não foi possível calcular o peso dos pedidos: ${error.message}`);
  }

  for (const row of rows) {
    const produto = Array.isArray(row.produto) ? row.produto[0] : row.produto;
    const pesoKg = Number(produto?.peso_kg ?? 0);
    const quantidade = Number(row.quantidade ?? 0);
    if (!pesoKg || !quantidade) continue;
    weights.set(row.pedido_expedicao_id, (weights.get(row.pedido_expedicao_id) ?? 0) + pesoKg * quantidade);
  }

  return weights;
}

async function listShippingOrdersByIds(orderIds: string[]) {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) {
    return [] as RomaneioRecordOrder[];
  }

  const admin = createSupabaseAdminClient();
  const { rows, error } = await fetchRowsInChunks<RawShippingOrderRow>(ids, 200, (chunk) =>
    admin
      .from("pedidos_expedicao")
      .select(
        "id, codigo, numero_wms, status, numero_pedido, numero_loja, valor_total, quantidade_itens, quantidade_unidades, data_pedido, previsao_envio_em, cliente_nome, cliente_cidade, cliente_uf, payload_origem, depositante_id, depositante:depositantes(nome)",
      )
      .in("id", chunk),
  );

  if (error) {
    throw new Error(`Não foi possível carregar os pedidos do romaneio: ${error.message}`);
  }

  return rows.map(mapRomaneioOrderSummary);
}

function mapRomaneioRecordListItem(row: RawRomaneioRow, orders: RomaneioRecordOrder[]) {
  const totalUnitsRaw = orders.reduce((sum, item) => sum + item.unitsRaw, 0);
  const totalValueRaw = orders.reduce((sum, item) => sum + item.totalRaw, 0);

  return {
    id: row.id,
    code: row.codigo,
    status: row.status,
    statusLabel: formatRomaneioStatus(row.status),
    carrierName: row.transportadora_nome,
    transportadoraId: row.transportadora_id,
    transportadoraCnpj: row.transportadora_cnpj,
    driverName: row.motorista_nome,
    driverDocument: row.motorista_documento,
    vehicleModel: row.veiculo_modelo,
    vehiclePlate: row.veiculo_placa,
    dock: row.doca,
    expectedPickup: row.coleta_prevista,
    notes: row.observacoes,
    conferenceInfoJson: row.conferencia_dupla_checagem ? JSON.stringify(row.conferencia_dupla_checagem) : row.observacoes,
    createdAt: row.criado_em,
    updatedAt: row.atualizado_em,
    releasedAt: row.liberado_em,
    canceledAt: row.cancelado_em,
    orderCount: orders.length,
    totalUnitsRaw,
    totalUnits: totalUnitsRaw.toLocaleString("pt-BR"),
    totalValueRaw,
    totalValue: formatCurrency(totalValueRaw),
    depositantes: [...new Set(orders.map((item) => item.depositante))].sort((left, right) =>
      left.localeCompare(right, "pt-BR"),
    ),
    destinations: [...new Set(orders.map((item) => item.destination))].sort((left, right) =>
      left.localeCompare(right, "pt-BR"),
    ),
    orders,
  } satisfies RomaneioRecordListItem;
}

export function extractInvoiceNumber(payload: Record<string, unknown> | null | undefined, fallback?: string): string {
  const digits = extractInvoiceNumberDigits(payload);
  return digits ? `NF ${digits}` : fallback || "Sem NF";
}

/** Mesma cascata de campos que extractInvoiceNumber, mas devolvendo só os
 * dígitos (sem o prefixo "NF ") e "" (não um texto de fallback legível)
 * quando nada é encontrado -- pra comparação EXATA no bipe de fechamento
 * de romaneio, não pra exibição. */
function extractInvoiceNumberDigits(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  // 1. Direct notaFiscal object
  const notaFiscal = payload.notaFiscal || payload.nota_fiscal || payload.nfe;
  if (notaFiscal && typeof notaFiscal === "object") {
    const nfObj = notaFiscal as Record<string, unknown>;
    if (nfObj.numero) return String(nfObj.numero).trim();
    if (nfObj.chave && typeof nfObj.chave === "string" && nfObj.chave.length === 44) {
      const numFromKey = parseInt(nfObj.chave.substring(25, 34), 10);
      if (!isNaN(numFromKey) && numFromKey > 0) return String(numFromKey);
    }
  }

  // 2. Direct string fields
  if (payload.numero_nota) return String(payload.numero_nota).trim();
  if (payload.numero_nf) return String(payload.numero_nf).trim();
  if (payload.nota_fiscal && typeof payload.nota_fiscal === "string") return payload.nota_fiscal.trim();

  // 3. From danfe_simplificada / danfe
  const danfe = payload.danfe_simplificada || payload.danfe || payload.chave_nfe || payload.chave_acesso;
  if (typeof danfe === "string" && danfe.trim().length === 44) {
    const numFromKey = parseInt(danfe.trim().substring(25, 34), 10);
    if (!isNaN(numFromKey) && numFromKey > 0) return String(numFromKey);
  }

  // 4. In fiscal / nfe sub-objects
  if (payload.fiscal && typeof payload.fiscal === "object") {
    const fisc = payload.fiscal as Record<string, unknown>;
    if (fisc.numero) return String(fisc.numero).trim();
    if (fisc.numero_nota) return String(fisc.numero_nota).trim();
  }

  return "";
}

/** Chave de acesso completa da NF-e (44 dígitos), quando disponível -- sem
 * a transformação lossy de extractInvoiceNumberDigits (que devolve só os
 * dígitos 25-34 embutidos na chave). Cobre os mesmos 2 pontos onde a chave
 * aparece no payload. */
function extractInvoiceKey(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const notaFiscal = payload.notaFiscal || payload.nota_fiscal || payload.nfe;
  if (notaFiscal && typeof notaFiscal === "object") {
    const chave = (notaFiscal as Record<string, unknown>).chave;
    if (typeof chave === "string" && chave.trim().length === 44) {
      return chave.trim();
    }
  }

  const danfe = payload.danfe_simplificada || payload.danfe || payload.chave_nfe || payload.chave_acesso;
  if (typeof danfe === "string" && danfe.trim().length === 44) {
    return danfe.trim();
  }

  return "";
}

/** Soma qVol/quantidade de todas as entradas em transporte.volumes (ou
 * payload.volumes, mesmo fallback de local que shipping.ts já usa pra peso)
 * -- é a contagem real de embalagens físicas da NF-e, gravada na
 * importação do XML (nfe-import.ts:160). Pedidos sem essa informação
 * (nunca teve XML anexado) contam como 1 volume, não 0 -- todo pedido sai
 * fisicamente em pelo menos 1 pacote. */
function extractVolumeCount(payload: Record<string, unknown>): number {
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const volumes = Array.isArray(transporte?.volumes)
    ? transporte.volumes
    : Array.isArray(payload.volumes)
      ? payload.volumes
      : [];

  const sum = volumes.reduce((total: number, volume) => {
    if (!isRecord(volume)) return total;
    const quantidade = Number(volume.quantidade ?? volume.qVol ?? 0);
    return Number.isFinite(quantidade) && quantidade > 0 ? total + quantidade : total;
  }, 0);

  return sum > 0 ? sum : 1;
}

function mapRomaneioOrderSummary(item: RawShippingOrderRow) {
  const payload = isRecord(item.payload_origem) ? item.payload_origem : {};
  const customer = item.cliente_nome?.trim() || "Cliente não informado";
  const destination =
    [item.cliente_cidade?.trim(), item.cliente_uf?.trim()].filter(Boolean).join(" - ") ||
    "Destino não informado";
  const unitsRaw = Number(item.quantidade_unidades ?? 0);
  const totalRaw = Number(item.valor_total ?? 0);
  const rawTrackingCode = extractTrackingCode(payload);

  return {
    id: item.id,
    code: formatWmsOrderNumber(item.numero_wms, item.codigo, extractRelationName(item.depositante)),
    externalNumber: extractPlatformOrderNumber(payload, item.numero_pedido, item.numero_loja, item.codigo),
    depositanteId: item.depositante_id,
    depositante: extractRelationName(item.depositante) ?? "Sem depositante",
    customer,
    destination,
    carrierName: extractCarrierName(payload),
    invoiceNumber: extractInvoiceNumber(payload),
    invoiceKey: extractInvoiceKey(payload),
    invoiceNumberDigits: extractInvoiceNumberDigits(payload),
    // extractTrackingCode() usa "Rastreio não informado" como placeholder de
    // EXIBIÇÃO -- aqui o campo é só pra comparação de bipe, então normaliza
    // pra "" (evita esse texto entrar como um "target" de match).
    trackingCode: rawTrackingCode === "Rastreio não informado" ? "" : rawTrackingCode,
    volumeCount: extractVolumeCount(payload),
    status: item.status,
    statusLabel: formatShippingStatusLabel(item.status),
    unitsRaw,
    units: unitsRaw.toLocaleString("pt-BR"),
    itemCount: Number(item.quantidade_itens ?? 0),
    totalRaw,
    total: formatCurrency(totalRaw),
    orderDate: formatDateOrFallback(item.data_pedido, "Sem data"),
    shipForecast: formatDateOrFallback(item.previsao_envio_em, "Sem previsão"),
  } satisfies RomaneioRecordOrder;
}

function canUserSeeOrder(user: AppUserContext, order: RomaneioRecordOrder) {
  if (user.papel !== "DEPOSITANTE") {
    return true;
  }

  return !user.depositanteId || user.depositanteId === order.depositanteId;
}

function canUserSeeRecord(user: AppUserContext, record: RomaneioRecordListItem) {
  if (user.papel !== "DEPOSITANTE") {
    return true;
  }

  if (!user.depositanteId) {
    return false;
  }

  return record.orders.some((item) => item.depositanteId === user.depositanteId);
}

function matchesRecordFilters(item: RomaneioRecordListItem, filters?: RomaneioRecordFilters) {
  if (!filters) {
    return true;
  }

  if (filters.status && item.status !== filters.status) {
    return false;
  }

  if (filters.depositanteId && !item.orders.some((order) => order.depositanteId === filters.depositanteId)) {
    return false;
  }

  if (
    filters.carrier &&
    !item.carrierName.toLocaleLowerCase("pt-BR").includes(filters.carrier.trim().toLocaleLowerCase("pt-BR"))
  ) {
    return false;
  }

  if (filters.dateFrom && item.createdAt < `${filters.dateFrom}T00:00:00`) {
    return false;
  }

  if (filters.dateTo && item.createdAt > `${filters.dateTo}T23:59:59`) {
    return false;
  }

  return true;
}

function extractPlatformOrderNumber(
  payload: Record<string, unknown>,
  numeroPedido: string | null,
  numeroLoja: string | null,
  fallbackCode: string,
) {
  const mercadoLivre = isRecord(payload.mercadoLivre) ? payload.mercadoLivre : null;
  const manualCommercial = isRecord(payload.comercial) ? payload.comercial : null;
  const orderNumber = readString(numeroPedido);
  const storeNumber = readString(numeroLoja);

  return (
    readString(mercadoLivre?.orderId) ??
    readString(mercadoLivre?.resourceId) ??
    readString(manualCommercial?.numeroPedido) ??
    orderNumber ??
    storeNumber ??
    fallbackCode
  );
}

function extractRelationName(value: RelationName) {
  if (Array.isArray(value)) {
    return typeof value[0]?.nome === "string" ? value[0].nome : null;
  }

  return typeof value?.nome === "string" ? value.nome : null;
}

function formatDateOrFallback(value: string | null, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getLatestCutoff(current: string, next: string) {
  if (current === "Sem previsão") {
    return next;
  }

  if (next === "Sem previsão") {
    return current;
  }

  return current.localeCompare(next, "pt-BR") >= 0 ? current : next;
}

function getOldestDateLabel(current: string, next: string) {
  if (current === "Sem data") {
    return next;
  }

  if (next === "Sem data") {
    return current;
  }

  const [currentDay, currentMonth, currentYear] = current.split("/");
  const [nextDay, nextMonth, nextYear] = next.split("/");
  const currentKey = `${currentYear}${currentMonth}${currentDay}`;
  const nextKey = `${nextYear}${nextMonth}${nextDay}`;

  return currentKey <= nextKey ? current : next;
}

function compareOrdersForRoute(left: RomaneioRecordOrder, right: RomaneioRecordOrder) {
  return left.customer.localeCompare(right.customer, "pt-BR");
}

function formatRomaneioStatus(status: RomaneioStatus) {
  switch (status) {
    case "ABERTO":
      return "Aberto";
    case "LIBERADO":
      return "Liberado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return status;
  }
}

function groupLinksByRomaneioId(links: RawRomaneioLinkRow[]) {
  const grouped = new Map<string, RawRomaneioLinkRow[]>();

  for (const link of links) {
    const current = grouped.get(link.romaneio_id) ?? [];
    current.push(link);
    grouped.set(link.romaneio_id, current);
  }

  return grouped;
}

function buildRomaneioCode() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = String(now.getTime()).slice(-4);
  return `ROM-${date}-${suffix}`;
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type SavedDriver = {
  nome: string;
  documento: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  transportadoraNome?: string | null;
};

export async function listSavedDriversFromDb(transportadoraNome?: string | null): Promise<SavedDriver[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("romaneios_carga")
    .select("motorista_nome, motorista_documento, veiculo_modelo, veiculo_placa, transportadora_nome")
    .not("motorista_nome", "is", null)
    .order("atualizado_em", { ascending: false });

  if (transportadoraNome && transportadoraNome.trim()) {
    query = query.ilike("transportadora_nome", `%${transportadoraNome.trim()}%`);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  const seen = new Set<string>();
  const drivers: SavedDriver[] = [];

  for (const row of data) {
    const nome = row.motorista_nome?.trim();
    if (!nome) continue;
    const key = `${nome.toLowerCase()}|${(row.motorista_documento ?? "").trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      drivers.push({
        nome,
        documento: row.motorista_documento?.trim() ?? "",
        veiculoModelo: row.veiculo_modelo?.trim() ?? "",
        veiculoPlaca: row.veiculo_placa?.trim() ?? "",
        transportadoraNome: row.transportadora_nome?.trim() ?? null,
      });
    }
  }

  return drivers;
}

/** Lançado quando o pedido não tem transportadora identificável -- evita
 * repetir o antigo catch-all "Transportadora Padrão", que foi a causa do
 * pior caso de contaminação de dados (225 pedidos de canais diferentes
 * misturados num romaneio só, ver investigação de 2026-09-04). */
export class CarrierNotIdentifiedError extends Error {
  constructor(orderCode: string) {
    super(
      `Não foi possível identificar a transportadora do pedido ${orderCode}. Abra o pedido no desktop (Expedição) e informe a transportadora manualmente antes de bipar a DANFE.`,
    );
    this.name = "CarrierNotIdentifiedError";
  }
}

export async function validateAndAssignOrderDanfeToRomaneio({
  user,
  orderId,
  scannedDanfe,
}: {
  user: AppUserContext;
  orderId: string;
  scannedDanfe?: string;
}) {
  const admin = createSupabaseAdminClient();

  // 1. Get the order details
  const { data: order, error: orderError } = await admin
    .from("pedidos_expedicao")
    .select("id, codigo, numero_wms, numero_pedido, referencia_externa, payload_origem, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("Pedido não encontrado no banco de dados.");
  }

  if (isOrderLockedForDecision(order.status)) {
    throw new Error("Este pedido está com cancelamento ou divergência em andamento e não pode ser liberado para romaneio.");
  }

  // 2. Validate DANFE / code
  const danfe = (scannedDanfe || "").trim();

  // Determine carrier name
  const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
  const carrierName = extractCarrierName(payload);
  if (!carrierName || carrierName === "Transportadora não informada") {
    // Não inventa mais um catch-all ("Transportadora Padrão") -- isso foi
    // o que gerou o pior caso de contaminação (225 pedidos misturados).
    // Bloqueia o auto-vínculo e pede resolução manual no desktop, ANTES de
    // qualquer escrita no pedido (nada muda de estado aqui).
    throw new CarrierNotIdentifiedError(order.codigo);
  }

  // Match exato (case-insensitive), NUNCA substring/ILIKE -- é justamente
  // o .ilike em texto livre que hoje mistura carriers com nomes parecidos.
  const transportadoras = await listTransportadoraOptionsFromDb();
  const normalizedCarrierName = carrierName.trim().toLocaleLowerCase("pt-BR");
  const matchedTransportadora =
    transportadoras.find((item) => item.nome.trim().toLocaleLowerCase("pt-BR") === normalizedCarrierName) ?? null;

  // Update order status to PRONTO_ROMANEIO and save danfe key if provided
  const updatedPayload = {
    ...payload,
    transportadora: matchedTransportadora?.nome ?? carrierName,
    ...(danfe ? { danfe_simplificada: danfe } : {}),
    danfe_conferida_em: new Date().toISOString(),
    danfe_conferida_por: user.nome || user.email,
  };

  await admin
    .from("pedidos_expedicao")
    .update({
      status: "PRONTO_ROMANEIO",
      payload_origem: updatedPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  registrarLancamentosExpedicao([orderId]).catch(() => {});

  // 3. Find an ABERTO romaneio for this carrier -- por transportadora_id
  // quando cadastrada (nunca por .ilike substring em texto livre: dois
  // carriers com nomes parecidos não podem mais ser fundidos na mesma
  // carga só por causa de um match parcial).
  let romaneioQuery = admin
    .from("romaneios_carga")
    .select("id, codigo")
    .eq("status", "ABERTO")
    .order("criado_em", { ascending: false })
    .limit(1);

  romaneioQuery = matchedTransportadora
    ? romaneioQuery.eq("transportadora_id", matchedTransportadora.id)
    : romaneioQuery.eq("transportadora_nome", carrierName);

  const { data: romaneios } = await romaneioQuery;

  let romaneioId: string;
  let romaneioCodigo: string;

  const validUserId = await resolveValidUserId(admin, user.id);

  if (!romaneios || romaneios.length === 0) {
    // Create new romaneio
    const codigo = buildRomaneioCode();
    const { data: newRomaneio, error: createError } = await admin
      .from("romaneios_carga")
      .insert({
        codigo,
        status: "ABERTO",
        transportadora_id: matchedTransportadora?.id ?? null,
        transportadora_nome: matchedTransportadora?.nome ?? carrierName,
        transportadora_cnpj: matchedTransportadora?.cnpj ?? null,
        criado_por: validUserId,
      })
      .select("id, codigo")
      .single();

    if (createError || !newRomaneio) {
      throw new Error(`Falha ao abrir romaneio para ${carrierName}: ${createError?.message}`);
    }

    romaneioId = newRomaneio.id;
    romaneioCodigo = newRomaneio.codigo;
  } else {
    romaneioId = romaneios[0].id;
    romaneioCodigo = romaneios[0].codigo;
  }

  // 4. Link the order to the romaneio
  const { data: currentLinks } = await admin
    .from("romaneios_carga_pedidos")
    .select("sequencia")
    .eq("romaneio_id", romaneioId)
    .order("sequencia", { ascending: false })
    .limit(1);

  const nextSequence = currentLinks && currentLinks.length > 0 ? currentLinks[0].sequencia + 1 : 1;

  await admin
    .from("romaneios_carga_pedidos")
    .upsert(
      {
        romaneio_id: romaneioId,
        pedido_expedicao_id: orderId,
        sequencia: nextSequence,
      },
      { onConflict: "romaneio_id,pedido_expedicao_id" },
    );

  // Count total orders in this romaneio
  const { count } = await admin
    .from("romaneios_carga_pedidos")
    .select("*", { count: "exact", head: true })
    .eq("romaneio_id", romaneioId);

  return {
    ok: true,
    romaneioId,
    romaneioCodigo,
    codigo: romaneioCodigo,
    carrierName,
    orderCode: order.codigo,
    totalOrders: count ?? 1,
  };
}

export const autoAssignOrderToRomaneio = validateAndAssignOrderDanfeToRomaneio;

export async function completeRomaneioWithDoubleCheck({
  user,
  romaneioId,
  driverData,
  photos,
  scannedOrderIds,
}: {
  user: AppUserContext;
  romaneioId: string;
  driverData: {
    nome: string;
    documento: string;
    veiculoModelo: string;
    veiculoPlaca: string;
  };
  photos: {
    operadorUrl?: string | null;
    motoristaUrl?: string | null;
    motoristaCaptureType?: "foto" | "assinatura" | null;
  };
  scannedOrderIds: string[];
}) {
  const admin = createSupabaseAdminClient();

  // 1. Fetch romaneio and all linked orders
  const { data: romaneio, error: romError } = await admin
    .from("romaneios_carga")
    .select("*")
    .eq("id", romaneioId)
    .maybeSingle();

  if (romError || !romaneio) {
    throw new Error("Romaneio não encontrado.");
  }

  const { data: links, error: linkErr } = await admin
    .from("romaneios_carga_pedidos")
    .select("pedido_expedicao_id")
    .eq("romaneio_id", romaneioId);

  if (linkErr || !links || links.length === 0) {
    throw new Error("Este romaneio não possui pedidos vinculados.");
  }

  const allOrderIds = links.map((l) => l.pedido_expedicao_id);
  const scannedSet = new Set(scannedOrderIds);
  const missingOrders = allOrderIds.filter((id) => !scannedSet.has(id));

  if (missingOrders.length > 0) {
    throw new Error(
      `Ainda faltam ${missingOrders.length} pedido(s) a serem conferidos no double check de embarque.`,
    );
  }

  // 2. Build metadata -- grava em conferencia_dupla_checagem (coluna
  // própria, jsonb), NUNCA em observacoes: essa é a mesma coluna que o
  // desktop usa pra texto livre (criação e edição), e escrever ali
  // sobrescrevia sem merge qualquer observação humana já digitada (bug
  // real, corrigido na migration 20260903202320).
  const obsPayload = {
    foto_operador_url: photos.operadorUrl ?? null,
    foto_motorista_url: photos.motoristaUrl ?? null,
    // Ausente em romaneios fechados antes desta coluna existir -- os
    // leitores (visualizar/page.tsx, foto/page.tsx, romaneio-pdf.ts)
    // tratam a ausência da chave como "foto", idêntico ao comportamento
    // de sempre (só a assinatura na tela é um caminho novo).
    foto_motorista_tipo: photos.motoristaUrl ? photos.motoristaCaptureType ?? "foto" : null,
    conferido_em: new Date().toISOString(),
    conferido_por: user.nome || user.email,
  };

  const validUserId = await resolveValidUserId(admin, user.id);

  // 3. Update romaneio to LIBERADO
  const { error: updateRomError } = await admin
    .from("romaneios_carga")
    .update({
      status: "LIBERADO",
      motorista_nome: driverData.nome.trim(),
      motorista_documento: driverData.documento.trim(),
      veiculo_modelo: driverData.veiculoModelo.trim(),
      veiculo_placa: driverData.veiculoPlaca.trim().toUpperCase(),
      conferencia_dupla_checagem: obsPayload,
      liberado_por: validUserId,
      liberado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", romaneioId);

  if (updateRomError) {
    throw new Error(`Falha ao finalizar romaneio: ${updateRomError.message}`);
  }

  // 4. Update all linked orders to EXPEDIDO
  await admin
    .from("pedidos_expedicao")
    .update({
      status: "EXPEDIDO",
      updated_at: new Date().toISOString(),
    })
    .in("id", allOrderIds);

  // Cobrança agora acontece na conferência, não no romaneio

  return { ok: true, romaneioId, codigo: romaneio.codigo };
}
