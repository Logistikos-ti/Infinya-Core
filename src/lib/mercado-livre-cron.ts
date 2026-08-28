import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import {
  getMercadoLivrePayload,
  readSalesChannelCode,
  syncMercadoLivreAssetsForShippingOrder,
} from "@/lib/mercado-livre-shipping";

// Pedidos nesses status não precisam mais de enriquecimento de etiqueta/rastreio:
// ou já saíram (EXPEDIDO), ou estão travados/encerrados por outro fluxo.
const TERMINAL_STATUSES = [
  "CANCELADO",
  "EXPEDIDO",
  "EM_CANCELAMENTO",
  "EM_DIVERGENCIA",
  "AGUARDANDO_NF_DEVOLUCAO",
] as const;

// Teto de pedidos ativos lidos por depositante em cada rodada. Como quase todo
// pedido ML ganha rastreio rápido, a fila real de pendentes é pequena; esse teto
// só protege contra varredura ilimitada.
const CANDIDATE_FETCH_LIMIT_PER_DEPOSITANTE = 300;

type PendingOrderSyncResult = {
  orderId: string;
  ok: boolean;
  status: string;
};

export type PendingMercadoLivreSyncSummary = {
  ok: boolean;
  connectedDepositantes: number;
  candidates: number;
  processed: number;
  synced: number;
  results: PendingOrderSyncResult[];
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Varre os depositantes com Mercado Livre conectado, encontra os pedidos ativos
 * que ainda não têm código de rastreio sincronizado e chama o sync de
 * etiqueta/rastreio para cada um (limitado por `limit` por rodada).
 *
 * Espelha o padrão do cron do Bling: idempotente, seguro para rodar em intervalo
 * fixo, e no-op enquanto nenhum depositante estiver conectado.
 */
export async function syncPendingMercadoLivreOrders(
  adminSupabase: SupabaseClient,
  limit = 40,
): Promise<PendingMercadoLivreSyncSummary> {
  const { data: depositantes, error: depError } = await adminSupabase
    .from("depositantes")
    .select("id, nome, configuracoes, observacoes")
    .eq("ativo", true);

  if (depError) {
    return {
      ok: false,
      connectedDepositantes: 0,
      candidates: 0,
      processed: 0,
      synced: 0,
      results: [],
      error: depError.message,
    };
  }

  const connected = (depositantes ?? []).filter((dep) => {
    const rawConfig = dep.configuracoes
      ? JSON.stringify(dep.configuracoes)
      : (dep.observacoes as string | null) ?? null;
    const config = parseDepositanteConfiguracoes(rawConfig);
    return Boolean(config.mercadoLivre?.connected);
  });

  if (!connected.length) {
    return {
      ok: true,
      connectedDepositantes: 0,
      candidates: 0,
      processed: 0,
      synced: 0,
      results: [],
    };
  }

  const notInTerminal = `(${TERMINAL_STATUSES.join(",")})`;
  const candidateIds: string[] = [];

  for (const dep of connected) {
    const { data: orders, error: ordersError } = await adminSupabase
      .from("pedidos_expedicao")
      .select("id, payload_origem")
      .eq("depositante_id", dep.id)
      .not("status", "in", notInTerminal)
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_FETCH_LIMIT_PER_DEPOSITANTE);

    if (ordersError) {
      continue;
    }

    for (const order of orders ?? []) {
      const payload = isRecord(order.payload_origem) ? order.payload_origem : {};
      if (readSalesChannelCode(payload) !== "MERCADO_LIVRE") {
        continue;
      }
      if (getMercadoLivrePayload(payload).trackingNumber) {
        continue;
      }
      candidateIds.push(order.id as string);
    }
  }

  const toProcess = candidateIds.slice(0, limit);
  const results: PendingOrderSyncResult[] = [];

  for (const orderId of toProcess) {
    try {
      const result = await syncMercadoLivreAssetsForShippingOrder(adminSupabase, orderId);
      results.push({ orderId, ok: result.ok, status: result.status });
    } catch (error) {
      results.push({
        orderId,
        ok: false,
        status: error instanceof Error ? `error:${error.message}` : "error",
      });
    }
  }

  return {
    ok: true,
    connectedDepositantes: connected.length,
    candidates: candidateIds.length,
    processed: results.length,
    synced: results.filter((item) => item.ok).length,
    results,
  };
}
