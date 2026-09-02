import { gunzipSync } from "node:zlib";
import type { AppUserContext } from "@/lib/auth";
import { parseNfeXml, type ParsedNfe } from "@/lib/nfe-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { documentsBucketName } from "@/lib/storage";

type RelatedShippingOrder = {
  id?: string;
  codigo?: string | null;
  numero_pedido?: string | null;
  status?: string | null;
  payload_origem?: Record<string, unknown> | null;
} | null;

type RelatedReceivingOrder = {
  id?: string;
  codigo?: string | null;
  nota_fiscal_numero?: string | null;
  status?: string | null;
} | null;

type FiscalDocumentRow = {
  id: string;
  nome_arquivo: string;
  tipo: string;
  created_at: string;
  depositante_id: string;
  mime_type: string | null;
  caminho_storage: string;
  pedido_expedicao_id?: string | null;
  pedido_recebimento_id?: string | null;
  depositante: { nome?: string } | null;
  pedido_expedicao?: RelatedShippingOrder;
  pedido_recebimento?: RelatedReceivingOrder;
};

type FiscalDocumentFilters = {
  q?: string;
  fluxo?: string;
  depositanteId?: string;
  issuerTerm?: string;
  recipientTerm?: string;
  page?: number;
  perPage?: number;
};

export type FiscalSummaryFilters = {
  depositanteId?: string;
  dateFrom?: string;
  dateTo?: string;
  flow?: "ENTRADA" | "SAIDA";
  issuerTerm?: string;
  recipientTerm?: string;
};

export type FiscalDocumentDetail = {
  id: string;
  fileName: string;
  createdAt: string;
  createdAtLabel: string;
  depositanteId: string;
  depositante: string;
  flow: "ENTRADA" | "SAIDA";
  flowLabel: string;
  noteNumber: string;
  accessKey: string | null;
  issuerName: string;
  issuerDocument: string | null;
  recipientName: string;
  recipientDocument: string | null;
  recipientAddress: string | null;
  issuedAt: string | null;
  issuedAtLabel: string;
  totalValue: number;
  totalValueLabel: string;
  volumeCount: number;
  protocolNumber: string | null;
  protocolStatusCode: string | null;
  protocolStatusLabel: string | null;
  linkedOrderLabel: string;
  linkedOrderHref: string | null;
  linkedOrderStatus: string;
  itemCount: number;
  itemsPreview: ParsedNfe["items"];
  downloadHref: string;
};

export type FiscalSummaryRow = {
  depositanteId: string;
  depositante: string;
  totalDocuments: number;
  entradaDocuments: number;
  saidaDocuments: number;
  totalValue: number;
  entradaValue: number;
  saidaValue: number;
  totalItems: number;
  totalVolumes: number;
  firstIssuedAt: string | null;
  firstIssuedAtLabel: string;
  lastIssuedAt: string | null;
  lastIssuedAtLabel: string;
};

type ParsedFiscalDocument = {
  row: FiscalDocumentRow;
  parsed: ParsedNfe;
};

export type FiscalDocumentsPage = {
  items: FiscalDocumentDetail[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function listFiscalDocumentsWithDetails(
  user: AppUserContext,
  filters?: FiscalDocumentFilters,
) : Promise<FiscalDocumentsPage> {
  const page = Math.max(1, filters?.page ?? 1);
  const perPage = normalizePerPage(filters?.perPage);
  const hasDeepFilters = Boolean(
    filters?.q?.trim() ||
      filters?.issuerTerm?.trim() ||
      filters?.recipientTerm?.trim() ||
      filters?.fluxo?.trim(),
  );

  if (!hasDeepFilters) {
    const offset = (page - 1) * perPage;
    const { rows, total } = await fetchFiscalDocumentRows(user, {
      depositanteId: filters?.depositanteId,
      limit: perPage,
      offset,
      count: true,
    });
    const parsedDocuments = await loadParsedFiscalDocumentsFromRows(rows);

    return {
      items: parsedDocuments.map(({ row, parsed }) => mapFiscalDetail(row, parsed)),
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  const parsedDocuments = await loadParsedFiscalDocuments(user, {
    depositanteId: filters?.depositanteId,
    limit: 150,
  });

  const filtered = parsedDocuments
    .map(({ row, parsed }) => mapFiscalDetail(row, parsed))
    .filter((item) => {
      if (filters?.fluxo && item.flow !== filters.fluxo) {
        return false;
      }

      if (filters?.q) {
        const needle = normalizeSearch(filters.q);
        const haystack = normalizeSearch(
          [
            item.fileName,
            item.noteNumber,
            item.accessKey,
            item.issuerName,
            item.recipientName,
            item.depositante,
            item.linkedOrderLabel,
          ]
            .filter(Boolean)
            .join(" "),
        );

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      if (filters?.issuerTerm) {
        const needle = normalizeSearch(filters.issuerTerm);
        const haystack = normalizeSearch(
          [item.issuerName, item.issuerDocument].filter(Boolean).join(" "),
        );

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      if (filters?.recipientTerm) {
        const needle = normalizeSearch(filters.recipientTerm);
        const haystack = normalizeSearch(
          [item.recipientName, item.recipientDocument].filter(Boolean).join(" "),
        );

        if (!haystack.includes(needle)) {
          return false;
        }
      }

      return true;
    });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * perPage;

  return {
    items: filtered.slice(startIndex, startIndex + perPage),
    total,
    page: normalizedPage,
    perPage,
    totalPages,
  };
}

// Fuso oficial da operação — usado para recortar "mês" pela data de registro.
const SAO_PAULO_OFFSET = "-03:00";

// Início do mês e do mês seguinte (ISO com offset de São Paulo) para o filtro
// [createdFrom, createdTo) por `created_at`.
function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const nextYear = m === 12 ? year + 1 : year;
  const nextMonth = m === 12 ? 1 : m + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${year}-${pad(m)}-01T00:00:00${SAO_PAULO_OFFSET}`,
    to: `${nextYear}-${pad(nextMonth)}-01T00:00:00${SAO_PAULO_OFFSET}`,
  };
}

// Chave "YYYY-MM" de um timestamp, no fuso de São Paulo.
function saoPauloMonthKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return year && month ? `${year}-${month}` : null;
}

/**
 * Lista os meses (YYYY-MM, fuso São Paulo) que possuem NF-e, do mais recente
 * para o mais antigo. Consulta BARATA: lê só a coluna `created_at`, sem baixar
 * nem parsear XML. Alimenta o seletor de mês da aba de NF-e.
 */
export async function listFiscalDocumentMonths(
  user: AppUserContext,
  options?: { depositanteId?: string },
): Promise<string[]> {
  const adminSupabase = createSupabaseAdminClient();
  let query = adminSupabase
    .from("documentos_armazenados")
    .select("created_at, depositante_id")
    .eq("tipo", "NF")
    .order("created_at", { ascending: false })
    .limit(20000);

  const scopeDepositante =
    options?.depositanteId ??
    (user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined);
  if (scopeDepositante) {
    query = query.eq("depositante_id", scopeDepositante);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Não foi possível listar os meses de NF-e: ${error.message}`);
  }

  const months = new Set<string>();
  for (const row of data ?? []) {
    const key = saoPauloMonthKey((row as { created_at: string }).created_at);
    if (key) months.add(key);
  }
  return [...months].sort().reverse();
}

/**
 * Carrega os documentos fiscais de UM mês (recorte por `created_at`), já
 * mapeados e com a lista COMPLETA de itens (para o drawer/DANFE). Como é um
 * mês só, os totais (quantidade e valor) do mês são exatos — diferente de puxar
 * "as N mais recentes" e filtrar no cliente. `limit` é só uma trava de
 * segurança para meses gigantes.
 */
export async function listFiscalDocumentDetails(
  user: AppUserContext,
  options?: { depositanteId?: string; month?: string; limit?: number },
): Promise<FiscalDocumentDetail[]> {
  const range = options?.month ? monthRange(options.month) : undefined;
  const parsedDocuments = await loadParsedFiscalDocuments(user, {
    depositanteId: options?.depositanteId,
    createdFrom: range?.from,
    createdTo: range?.to,
    limit: options?.limit ?? (range ? 2000 : 80),
  });

  return parsedDocuments.map(({ row, parsed }) => ({
    ...mapFiscalDetail(row, parsed),
    // O drawer não mostra mais a tabela de itens, então não enviamos a lista de
    // itens no payload (só o itemCount, que vem de mapFiscalDetail) — reduz
    // bastante o tamanho da resposta em meses com muitas notas.
    itemsPreview: [],
  }));
}

export type FiscalExportDocument = {
  detail: FiscalDocumentDetail;
  xml: string;
  fileName: string;
};

/**
 * Igual a listFiscalDocumentDetails, mas mantém o XML de cada nota — usado pela
 * rota de exportação para poder empacotar os XMLs em ZIP.
 */
export async function loadFiscalDocumentsForExport(
  user: AppUserContext,
  options?: { depositanteId?: string; month?: string },
): Promise<FiscalExportDocument[]> {
  const range = options?.month ? monthRange(options.month) : undefined;
  const { rows } = await fetchFiscalDocumentRows(user, {
    depositanteId: options?.depositanteId,
    createdFrom: range?.from,
    createdTo: range?.to,
    limit: range ? 2000 : 80,
  });

  const adminSupabase = createSupabaseAdminClient();
  const settled = await Promise.all(
    rows.map(async (row): Promise<FiscalExportDocument | null> => {
      try {
        const xml = await downloadXml(adminSupabase, row.caminho_storage, row.mime_type);
        const parsed = parseNfeXml(xml);
        return {
          detail: { ...mapFiscalDetail(row, parsed), itemsPreview: [] },
          xml,
          fileName: row.nome_arquivo,
        };
      } catch (error) {
        console.warn(
          `[fiscal-documents] Export: falha ao ler XML do documento ${row.id}:`,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    }),
  );

  return settled.filter((item): item is FiscalExportDocument => item !== null);
}

export async function listFiscalSummaryRows(
  user: AppUserContext,
  filters?: FiscalSummaryFilters,
) {
  const parsedDocuments = await loadParsedFiscalDocuments(user, {
    depositanteId: filters?.depositanteId,
    limit: 500,
  });

  const rows = parsedDocuments.filter(({ row, parsed }) =>
    matchesFiscalSummaryFilters(row, parsed, filters),
  );

  const summaryMap = new Map<string, FiscalSummaryRow>();

  for (const { row, parsed } of rows) {
    const key = row.depositante_id;
    const current =
      summaryMap.get(key) ??
      ({
        depositanteId: row.depositante_id,
        depositante: row.depositante?.nome ?? "-",
        totalDocuments: 0,
        entradaDocuments: 0,
        saidaDocuments: 0,
        totalValue: 0,
        entradaValue: 0,
        saidaValue: 0,
        totalItems: 0,
        totalVolumes: 0,
        firstIssuedAt: null,
        firstIssuedAtLabel: "-",
        lastIssuedAt: null,
        lastIssuedAtLabel: "-",
      } satisfies FiscalSummaryRow);

    current.totalDocuments += 1;
    current.totalValue += parsed.totalValue;
    current.totalItems += parsed.items.length;
    current.totalVolumes += parsed.volumeCount;

    if (parsed.direction === "ENTRADA") {
      current.entradaDocuments += 1;
      current.entradaValue += parsed.totalValue;
    } else {
      current.saidaDocuments += 1;
      current.saidaValue += parsed.totalValue;
    }

    const effectiveIssuedAt = parsed.issuedAt ?? row.created_at;

    if (!current.firstIssuedAt || compareDates(effectiveIssuedAt, current.firstIssuedAt) < 0) {
      current.firstIssuedAt = effectiveIssuedAt;
      current.firstIssuedAtLabel = formatDateTime(effectiveIssuedAt);
    }

    if (!current.lastIssuedAt || compareDates(effectiveIssuedAt, current.lastIssuedAt) > 0) {
      current.lastIssuedAt = effectiveIssuedAt;
      current.lastIssuedAtLabel = formatDateTime(effectiveIssuedAt);
    }

    summaryMap.set(key, current);
  }

  return [...summaryMap.values()].sort((left, right) =>
    left.depositante.localeCompare(right.depositante, "pt-BR"),
  );
}

async function loadParsedFiscalDocuments(
  user: AppUserContext,
  options?: {
    depositanteId?: string;
    limit?: number;
    createdFrom?: string;
    createdTo?: string;
  },
) {
  const { rows } = await fetchFiscalDocumentRows(user, options);
  return loadParsedFiscalDocumentsFromRows(rows);
}

async function loadParsedFiscalDocumentsFromRows(rows: FiscalDocumentRow[]) {
  const adminSupabase = createSupabaseAdminClient();

  // Um único XML corrompido/inválido não pode derrubar a listagem inteira:
  // com Promise.all uma rejeição estoura a página toda. Cada nota é parseada
  // de forma isolada e, se falhar, é apenas omitida (com um aviso no log) em
  // vez de zerar a aba de NF-e para todos os documentos.
  const settled = await Promise.all(
    rows.map(async (row) => {
      try {
        const xml = await downloadXml(adminSupabase, row.caminho_storage, row.mime_type);
        const parsed = parseNfeXml(xml);
        return { row, parsed } satisfies ParsedFiscalDocument;
      } catch (error) {
        console.warn(
          `[fiscal-documents] Falha ao ler o XML do documento ${row.id} (${row.nome_arquivo}):`,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    }),
  );

  return settled.filter((item): item is ParsedFiscalDocument => item !== null);
}

async function fetchFiscalDocumentRows(
  user: AppUserContext,
  options?: {
    depositanteId?: string;
    limit?: number;
    offset?: number;
    count?: boolean;
    createdFrom?: string;
    createdTo?: string;
  },
) {
  const adminSupabase = createSupabaseAdminClient();
  let query = adminSupabase
    .from("documentos_armazenados")
    .select(
      "id, nome_arquivo, tipo, created_at, depositante_id, mime_type, caminho_storage, pedido_expedicao_id, pedido_recebimento_id, depositante:depositantes(nome), pedido_expedicao:pedidos_expedicao(id, codigo, numero_pedido, status, payload_origem), pedido_recebimento:pedidos_recebimento(id, codigo, nota_fiscal_numero, status)",
      options?.count ? { count: "exact" } : undefined,
    )
    .eq("tipo", "NF")
    .order("created_at", { ascending: false });

  if (options?.depositanteId) {
    query = query.eq("depositante_id", options.depositanteId);
  }

  // Recorte por mês (data de registro/created_at): [createdFrom, createdTo).
  if (options?.createdFrom) {
    query = query.gte("created_at", options.createdFrom);
  }
  if (options?.createdTo) {
    query = query.lt("created_at", options.createdTo);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (typeof options?.offset === "number" && options.limit) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Não foi possível carregar os documentos fiscais: ${error.message}`);
  }

  const rows = (data ?? []) as FiscalDocumentRow[];

  if (user.depositanteId && user.papel === "DEPOSITANTE") {
    return {
      rows: rows.filter((item) => item.depositante_id === user.depositanteId),
      total: count ?? rows.length,
    };
  }

  return {
    rows,
    total: count ?? rows.length,
  };
}

async function downloadXml(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  storagePath: string,
  mimeType: string | null,
) {
  const downloadResult = await adminSupabase.storage
    .from(documentsBucketName)
    .download(storagePath);

  if (downloadResult.error || !downloadResult.data) {
    throw new Error("Não foi possível baixar o XML fiscal armazenado.");
  }

  let bytes = Buffer.from(await downloadResult.data.arrayBuffer());

  if ((mimeType || "").includes("xml") && isGzipBuffer(bytes)) {
    bytes = gunzipSync(bytes);
  }

  return bytes.toString("utf-8");
}

function mapFiscalDetail(row: FiscalDocumentRow, parsed: ParsedNfe): FiscalDocumentDetail {
  const linkedOrderHref = row.pedido_expedicao_id
    ? `/expedicao/${row.pedido_expedicao_id}`
    : row.pedido_recebimento_id
      ? `/recebimento/${row.pedido_recebimento_id}`
      : null;

  // Direção pela PERSPECTIVA DO ARMAZÉM, não pelo tpNF do emitente. A NF de um
  // fornecedor tem tpNF=1 (saída dele) mas, pra nós, é uma ENTRADA. Então quando
  // a nota está vinculada a um pedido de recebimento ela é ENTRADA; a um pedido
  // de expedição, SAÍDA. Sem vínculo, cai no que o XML diz (parsed.direction).
  const flow: "ENTRADA" | "SAIDA" = row.pedido_recebimento_id
    ? "ENTRADA"
    : row.pedido_expedicao_id
      ? "SAIDA"
      : parsed.direction;

  return {
    id: row.id,
    fileName: row.nome_arquivo,
    createdAt: row.created_at,
    createdAtLabel: formatDateTime(row.created_at),
    depositanteId: row.depositante_id,
    depositante: row.depositante?.nome ?? "-",
    flow,
    flowLabel: flow === "ENTRADA" ? "Entrada" : "Saída",
    noteNumber: parsed.noteNumber,
    accessKey: parsed.accessKey,
    issuerName: parsed.supplierName,
    issuerDocument: parsed.supplierDocument,
    recipientName: parsed.recipientName,
    recipientDocument: parsed.recipientDocument,
    recipientAddress: parsed.recipientAddress,
    issuedAt: parsed.issuedAt,
    issuedAtLabel: formatDateTime(parsed.issuedAt),
    totalValue: parsed.totalValue,
    totalValueLabel: formatCurrency(parsed.totalValue),
    volumeCount: parsed.volumeCount,
    protocolNumber: parsed.protocolNumber,
    protocolStatusCode: parsed.protocolStatusCode,
    protocolStatusLabel: parsed.protocolStatusLabel,
    linkedOrderLabel: resolveLinkLabel(row),
    linkedOrderHref,
    linkedOrderStatus: resolveStatusLabel(row),
    itemCount: parsed.items.length,
    itemsPreview: parsed.items.slice(0, 10),
    downloadHref: `/api/documentos/${row.id}/download`,
  };
}

function resolveLinkLabel(item: FiscalDocumentRow) {
  if (item.pedido_expedicao) {
    return item.pedido_expedicao.numero_pedido || item.pedido_expedicao.codigo || "Pedido de expedição";
  }

  if (item.pedido_recebimento) {
    return item.pedido_recebimento.codigo || item.pedido_recebimento.nota_fiscal_numero || "Pedido de recebimento";
  }

  return "Sem vínculo automático";
}

function resolveStatusLabel(item: FiscalDocumentRow) {
  if (item.pedido_expedicao?.status) {
    return item.pedido_expedicao.status;
  }

  if (item.pedido_recebimento?.status) {
    return item.pedido_recebimento.status;
  }

  return "Armazenado";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesFiscalPeriod(value: string | null, dateFrom?: string, dateTo?: string) {
  const normalized = normalizeDateKey(value);

  if (!normalized) {
    return !dateFrom && !dateTo;
  }

  if (dateFrom && normalized < dateFrom) {
    return false;
  }

  if (dateTo && normalized > dateTo) {
    return false;
  }

  return true;
}

function matchesFiscalSummaryFilters(
  row: FiscalDocumentRow,
  parsed: ParsedNfe,
  filters?: FiscalSummaryFilters,
) {
  if (
    !matchesFiscalPeriod(
      parsed.issuedAt ?? row.created_at,
      filters?.dateFrom,
      filters?.dateTo,
    )
  ) {
    return false;
  }

  if (filters?.flow && parsed.direction !== filters.flow) {
    return false;
  }

  if (filters?.issuerTerm) {
    const issuerNeedle = normalizeSearch(filters.issuerTerm);
    const issuerHaystack = normalizeSearch(
      [parsed.supplierName, parsed.supplierDocument].filter(Boolean).join(" "),
    );

    if (!issuerHaystack.includes(issuerNeedle)) {
      return false;
    }
  }

  if (filters?.recipientTerm) {
    const recipientNeedle = normalizeSearch(filters.recipientTerm);
    const recipientHaystack = normalizeSearch(
      [parsed.recipientName, parsed.recipientDocument].filter(Boolean).join(" "),
    );

    if (!recipientHaystack.includes(recipientNeedle)) {
      return false;
    }
  }

  return true;
}

function normalizeDateKey(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function compareDates(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isGzipBuffer(value: Buffer) {
  return value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b;
}

function normalizePerPage(value?: number) {
  if (!value) {
    return 10;
  }

  return [10, 20, 50].includes(value) ? value : 10;
}
