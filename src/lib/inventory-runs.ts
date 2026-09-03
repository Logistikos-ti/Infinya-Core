import {
  getCycleCountDetailFromDb,
  listCycleCountsFromDb,
  type CycleCountSummary,
} from "@/lib/stock-cycle-counts";
import { getGeneralInventory, listGeneralInventoriesFromDb } from "@/lib/general-inventories";

// Contagem cíclica e inventário geral usam vocabulários de status
// diferentes (ABERTA/CONCLUIDA vs EM_CONTAGEM/CONCLUIDO) -- a tela
// unificada só precisa saber em qual dos três estágios do fluxo cada
// registro está.
export type InventoryRunStage = "PROGRAMADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";

export function normalizeInventoryRunStage(status: string): InventoryRunStage {
  if (status === "PROGRAMADA" || status === "PROGRAMADO") return "PROGRAMADO";
  if (status === "ABERTA" || status === "EM_CONTAGEM") return "EM_ANDAMENTO";
  if (status === "CONCLUIDA" || status === "CONCLUIDO") return "CONCLUIDO";
  return "CANCELADO";
}

export type InventoryRun = CycleCountSummary & {
  stage: InventoryRunStage;
  accuracy: number | null;
};

/**
 * Acurácia = 1 - (soma das divergências em módulo / soma das quantidades de
 * sistema), sobre os itens já contados (systemQuantity só existe pra quem
 * tem um saldo esperado -- itens ainda PENDENTE não entram na conta).
 * Confirmado batendo com os números do mock: 112/120 (-8) e 58/60 (-2) dão
 * exatamente 94.4%.
 */
export function computeAccuracy(items: Array<{ systemQuantity: number; divergence: number | null }>): number | null {
  const counted = items.filter((item) => item.divergence !== null);
  if (!counted.length) return null;

  const totalSystem = counted.reduce((sum, item) => sum + Math.abs(item.systemQuantity), 0);
  if (totalSystem === 0) return null;

  const totalAbsDivergence = counted.reduce((sum, item) => sum + Math.abs(item.divergence ?? 0), 0);
  return Math.max(0, 1 - totalAbsDivergence / totalSystem);
}

async function getRunAccuracy(id: string, type: "CICLICO" | "GERAL"): Promise<number | null> {
  if (type === "CICLICO") {
    const result = await getCycleCountDetailFromDb(id);
    if (!result.data) return null;
    return computeAccuracy(
      result.data.items.map((item) => ({
        systemQuantity: item.systemQuantityRaw ?? 0,
        divergence: item.divergenceRaw,
      })),
    );
  }

  const detail = await getGeneralInventory(id);
  if (!detail) return null;
  return computeAccuracy(
    detail.itens.map((item) => ({
      systemQuantity: item.quantidadeSistema,
      divergence: item.status === "PENDENTE" ? null : item.divergencia,
    })),
  );
}

export type ListInventoryRunsOptions = {
  depositanteId?: string;
};

export async function listInventoryRuns(options?: ListInventoryRunsOptions): Promise<InventoryRun[]> {
  const [cycleResult, generalRuns] = await Promise.all([
    listCycleCountsFromDb(options?.depositanteId, 0),
    listGeneralInventoriesFromDb({ depositanteId: options?.depositanteId }),
  ]);

  const merged = [...(cycleResult.available ? cycleResult.data : []), ...generalRuns];

  const withAccuracy = await Promise.all(
    merged.map(async (run) => {
      const stage = normalizeInventoryRunStage(run.status);
      // Só faz sentido calcular (e vale o custo da consulta extra) pra quem
      // já foi concluído -- programado/em andamento/cancelado sempre mostram
      // "-" no lugar, igual ao mock.
      const accuracy =
        stage === "CONCLUIDO" ? await getRunAccuracy(run.id, run.type === "GERAL" ? "GERAL" : "CICLICO") : null;

      return { ...run, stage, accuracy } satisfies InventoryRun;
    }),
  );

  return withAccuracy.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}
