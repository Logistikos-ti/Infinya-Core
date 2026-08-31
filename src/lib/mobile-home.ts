import type { AppUserContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RelationName = { nome?: string } | { nome?: string }[] | null;

type MobileReceivingRow = {
  id: string;
  codigo: string;
  depositante: RelationName;
};

type MobileShippingHeadlineRow = {
  id: string;
  codigo: string;
  numero_pedido: string | null;
  numero_loja: string | null;
  cliente_nome: string | null;
  payload_origem: Record<string, unknown> | null;
};

type MobileConferenceRow = MobileShippingHeadlineRow & {
  itens:
    | Array<{
        quantidade: number | string | null;
        payload_origem: Record<string, unknown> | null;
      }>
    | null;
};

type MobileRomaneioRow = {
  id: string;
  payload_origem: Record<string, unknown> | null;
};

export type MobileQueueSnapshot = {
  count: number;
  first: {
    id: string;
    code: string;
    externalNumber?: string;
    customer?: string;
    depositante?: string;
  } | null;
};

export type MobileOperationsSnapshot = {
  receiving: MobileQueueSnapshot;
  picking: MobileQueueSnapshot & {
    /** Waves the operator will actually find on the Separação screen. */
    activeWaves: number;
    /** Orders released for picking but not yet grouped into a wave. */
    awaitingWave: number;
  };
  conference: MobileQueueSnapshot & {
    divergentItems: number;
  };
  romaneio: MobileQueueSnapshot;
  /** Cancelamentos aguardando a bipagem de devolução ao estoque. */
  cancellation: MobileQueueSnapshot;
};

export async function getMobileOperationsSnapshot(
  user: AppUserContext,
  options?: {
    includeReceiving?: boolean;
    includeShipping?: boolean;
    includeRomaneio?: boolean;
  },
): Promise<MobileOperationsSnapshot> {
  const supabase = createSupabaseAdminClient();
  const depositanteId = user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined;
  const includeReceiving = options?.includeReceiving ?? true;
  const includeShipping = options?.includeShipping ?? true;
  const includeRomaneio = options?.includeRomaneio ?? true;

  const receivingPromise = includeReceiving
    ? getReceivingSnapshot(supabase, depositanteId)
    : Promise.resolve({
        count: 0,
        first: null,
      } satisfies MobileQueueSnapshot);

  const pickingPromise = includeShipping
    ? getPickingSnapshot(supabase, depositanteId)
    : Promise.resolve({
        count: 0,
        first: null,
        activeWaves: 0,
        awaitingWave: 0,
      } satisfies MobileOperationsSnapshot["picking"]);

  const conferencePromise = includeShipping
    ? getConferenceSnapshot(supabase, depositanteId)
    : Promise.resolve({
        count: 0,
        first: null,
        divergentItems: 0,
      } satisfies MobileOperationsSnapshot["conference"]);

  const romaneioPromise = includeRomaneio
    ? getRomaneioSnapshot(supabase, depositanteId)
    : Promise.resolve({
        count: 0,
        first: null,
      } satisfies MobileQueueSnapshot);

  // Cancellation return-to-stock is an expedição exception flow, so it rides
  // along with the shipping snapshots.
  const cancellationPromise = includeShipping
    ? getCancellationSnapshot(supabase, depositanteId)
    : Promise.resolve({
        count: 0,
        first: null,
      } satisfies MobileQueueSnapshot);

  const [receiving, picking, conference, romaneio, cancellation] = await Promise.all([
    receivingPromise,
    pickingPromise,
    conferencePromise,
    romaneioPromise,
    cancellationPromise,
  ]);

  return {
    receiving,
    picking,
    conference,
    romaneio,
    cancellation,
  };
}

// Mirrors how the desktop recebimento screen groups statuses (see
// StatusBadge in src/app/(dashboard)/recebimento/page.tsx): RECEBIDO,
// RECEBIDO_PARCIAL and CANCELADO are shown there as settled/closed work.
// Without this filter, getReceivingSnapshot counted every pedido_recebimento
// ever created -- including years-old finished/cancelled ones -- so the
// "tarefas hoje" badge kept growing forever instead of reflecting actual
// pending work.
const PENDING_RECEIVING_STATUSES = ["RASCUNHO", "AGUARDANDO", "EM_RECEBIMENTO", "DIVERGENCIA"];

async function getReceivingSnapshot(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId?: string,
): Promise<MobileQueueSnapshot> {
  let baseQuery = supabase
    .from("pedidos_recebimento")
    .select("id, codigo, depositante:depositantes(nome)", { count: "exact" })
    .in("status", PENDING_RECEIVING_STATUSES)
    .order("created_at", { ascending: false });

  if (depositanteId) {
    baseQuery = baseQuery.eq("depositante_id", depositanteId);
  }

  const { data, count, error } = await baseQuery.limit(1);

  if (error) {
    throw new Error(`Não foi possível carregar o snapshot de recebimento: ${error.message}`);
  }

  const first = ((data ?? []) as MobileReceivingRow[])[0];

  return {
    count: count ?? 0,
    first: first
      ? {
          id: first.id,
          code: first.codigo,
          depositante: extractRelationName(first.depositante) ?? "Sem depositante",
        }
      : null,
  };
}

async function getPickingSnapshot(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId?: string,
): Promise<MobileOperationsSnapshot["picking"]> {
  // SEPARADO is deliberately excluded: those orders are already picked, so
  // counting them made the home badge claim pending work that did not exist.
  let query = supabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, numero_loja, cliente_nome, payload_origem", {
      count: "exact",
    })
    .in("status", ["NOVO", "EM_SEPARACAO"])
    .order("created_at", { ascending: false });

  if (depositanteId) {
    query = query.eq("depositante_id", depositanteId);
  }

  let awaitingWaveQuery = supabase
    .from("pedidos_expedicao")
    .select("id", { count: "exact", head: true })
    .eq("status", "NOVO");

  if (depositanteId) {
    awaitingWaveQuery = awaitingWaveQuery.eq("depositante_id", depositanteId);
  }

  const [{ data, count, error }, { count: awaitingWave }, { count: activeWaves }] =
    await Promise.all([
      query.limit(1),
      awaitingWaveQuery,
      // The Separação screen lists waves, so the badge has to count waves too --
      // counting orders made it show a number with nothing behind it.
      supabase
        .from("ondas_separacao")
        .select("id", { count: "exact", head: true })
        .in("status", ["PENDENTE", "EM_SEPARACAO"]),
    ]);

  if (error) {
    throw new Error(`Não foi possível carregar o snapshot de separação: ${error.message}`);
  }

  const first = ((data ?? []) as MobileShippingHeadlineRow[])[0];

  return {
    count: count ?? 0,
    activeWaves: activeWaves ?? 0,
    awaitingWave: awaitingWave ?? 0,
    first: first
      ? {
          id: first.id,
          code: first.codigo,
          externalNumber: extractPlatformOrderNumber(
            isRecord(first.payload_origem) ? first.payload_origem : {},
            first.numero_pedido,
            first.numero_loja,
            first.codigo,
          ),
          customer: first.cliente_nome?.trim() || "Cliente não informado",
        }
      : null,
  };
}

async function getConferenceSnapshot(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId?: string,
): Promise<MobileOperationsSnapshot["conference"]> {
  let firstQuery = supabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, numero_loja, cliente_nome, payload_origem", {
      count: "exact",
    })
    .in("status", ["SEPARADO", "EM_CONFERENCIA"])
    .order("updated_at", { ascending: false });

  let divergenceQuery = supabase
    .from("pedidos_expedicao")
    .select(
      "id, codigo, numero_pedido, numero_loja, cliente_nome, payload_origem, itens:pedidos_expedicao_itens(quantidade, payload_origem)",
    )
    .in("status", ["SEPARADO", "EM_CONFERENCIA"]);

  if (depositanteId) {
    firstQuery = firstQuery.eq("depositante_id", depositanteId);
    divergenceQuery = divergenceQuery.eq("depositante_id", depositanteId);
  }

  const [{ data: firstData, count, error: firstError }, { data: divergenceData, error: divergenceError }] =
    await Promise.all([firstQuery.limit(1), divergenceQuery]);

  if (firstError) {
    throw new Error(`Não foi possível carregar o snapshot de conferência: ${firstError.message}`);
  }

  if (divergenceError) {
    throw new Error(`Não foi possível carregar as divergências da conferência: ${divergenceError.message}`);
  }

  const first = ((firstData ?? []) as MobileShippingHeadlineRow[])[0];
  const divergentItems = ((divergenceData ?? []) as MobileConferenceRow[]).reduce((sum, order) => {
    const items = order.itens ?? [];

    return (
      sum +
      items.filter((item) => {
        const requestedQuantity = Number(item.quantidade ?? 0);
        const payload = isRecord(item.payload_origem) ? item.payload_origem : {};
        const conference = isRecord(payload.conferencia) ? payload.conferencia : {};
        const confirmedQuantity = Number(readString(conference.quantidadeConferida) ?? 0);

        return confirmedQuantity !== requestedQuantity;
      }).length
    );
  }, 0);

  return {
    count: count ?? 0,
    first: first
      ? {
          id: first.id,
          code: first.codigo,
          externalNumber: extractPlatformOrderNumber(
            isRecord(first.payload_origem) ? first.payload_origem : {},
            first.numero_pedido,
            first.numero_loja,
            first.codigo,
          ),
          customer: first.cliente_nome?.trim() || "Cliente não informado",
        }
      : null,
    divergentItems,
  };
}

async function getRomaneioSnapshot(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId?: string,
): Promise<MobileQueueSnapshot> {
  let query = supabase
    .from("pedidos_expedicao")
    .select("id, payload_origem", {
      count: "exact",
    })
    .in("status", ["PRONTO_ROMANEIO", "EXPEDIDO"])
    .order("previsao_envio_em", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (depositanteId) {
    query = query.eq("depositante_id", depositanteId);
  }

  const { data, count, error } = await query.limit(1);

  if (error) {
    throw new Error(`Não foi possível carregar o snapshot de romaneio: ${error.message}`);
  }

  const first = ((data ?? []) as MobileRomaneioRow[])[0];
  const payload = isRecord(first?.payload_origem) ? first.payload_origem : {};

  return {
    count: count ?? 0,
    first: first
      ? {
          id: first.id,
          code: first.id,
          depositante: extractCarrierName(payload),
        }
      : null,
  };
}

async function getCancellationSnapshot(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId?: string,
): Promise<MobileQueueSnapshot> {
  let query = supabase
    .from("pedidos_expedicao_cancelamentos")
    .select("id", { count: "exact" })
    .eq("status", "EM_ANDAMENTO")
    .order("aberto_em", { ascending: true });

  if (depositanteId) {
    query = query.eq("depositante_id", depositanteId);
  }

  const { data, count, error } = await query.limit(1);

  if (error) {
    throw new Error(`Não foi possível carregar o snapshot de cancelamento: ${error.message}`);
  }

  const first = ((data ?? []) as Array<{ id: string }>)[0];

  return {
    count: count ?? 0,
    first: first ? { id: first.id, code: first.id } : null,
  };
}

function extractRelationName(value: RelationName) {
  if (Array.isArray(value)) {
    return typeof value[0]?.nome === "string" ? value[0].nome : null;
  }

  if (value && typeof value.nome === "string") {
    return value.nome;
  }

  return null;
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
  const mercadoLivreOrderId = readString(mercadoLivre?.orderId);
  const salesChannelCode = readString(manualCommercial?.canal);

  if (salesChannelCode === "MERCADO_LIVRE" && storeNumber) {
    return storeNumber;
  }

  return mercadoLivreOrderId ?? orderNumber ?? storeNumber ?? fallbackCode;
}

function extractCarrierName(payload: Record<string, unknown>) {
  const transporte = isRecord(payload.transporte) ? payload.transporte : null;
  const transportador = transporte && isRecord(transporte.contato) ? transporte.contato : null;

  return readString(transportador?.nome) ?? "Transportadora não informada";
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
