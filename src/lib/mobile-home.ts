import type { AppUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  picking: MobileQueueSnapshot;
  conference: MobileQueueSnapshot & {
    divergentItems: number;
  };
};

export async function getMobileOperationsSnapshot(
  user: AppUserContext,
  options?: {
    includeReceiving?: boolean;
    includeShipping?: boolean;
  },
): Promise<MobileOperationsSnapshot> {
  const supabase = await createSupabaseServerClient();
  const depositanteId = user.papel === "DEPOSITANTE" ? user.depositanteId ?? undefined : undefined;
  const includeReceiving = options?.includeReceiving ?? true;
  const includeShipping = options?.includeShipping ?? true;

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
      } satisfies MobileQueueSnapshot);

  const conferencePromise = includeShipping
    ? getConferenceSnapshot(supabase, depositanteId)
    : Promise.resolve({
        count: 0,
        first: null,
        divergentItems: 0,
      } satisfies MobileOperationsSnapshot["conference"]);

  const [receiving, picking, conference] = await Promise.all([
    receivingPromise,
    pickingPromise,
    conferencePromise,
  ]);

  return {
    receiving,
    picking,
    conference,
  };
}

async function getReceivingSnapshot(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  depositanteId?: string,
): Promise<MobileQueueSnapshot> {
  let baseQuery = supabase
    .from("pedidos_recebimento")
    .select("id, codigo, depositante:depositantes(nome)", { count: "exact" })
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
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  depositanteId?: string,
): Promise<MobileQueueSnapshot> {
  let query = supabase
    .from("pedidos_expedicao")
    .select("id, codigo, numero_pedido, numero_loja, cliente_nome, payload_origem", {
      count: "exact",
    })
    .in("status", ["NOVO", "EM_SEPARACAO", "SEPARADO"])
    .order("created_at", { ascending: false });

  if (depositanteId) {
    query = query.eq("depositante_id", depositanteId);
  }

  const { data, count, error } = await query.limit(1);

  if (error) {
    throw new Error(`Não foi possível carregar o snapshot de separação: ${error.message}`);
  }

  const first = ((data ?? []) as MobileShippingHeadlineRow[])[0];

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
  };
}

async function getConferenceSnapshot(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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
