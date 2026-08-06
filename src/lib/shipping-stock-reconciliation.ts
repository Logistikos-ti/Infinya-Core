import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const INVENTORY_CUTOFF = "2026-08-05T12:53:15.662061+00:00";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export type ShippingReconciliationRow = {
  id: string;
  codigo: string;
  pedidoExterno: string;
  notaFiscal: string;
  depositante: string;
  status: string;
  criadoEm: string;
  itens: number;
  unidades: number;
  situacao: "PENDENTE" | "JA_BAIXADO" | "REVISAR_MANUAL";
  detalhe: string;
};

export async function listShippingStockReconciliation() {
  const admin = createSupabaseAdminClient();
  const { data: orders, error } = await admin
    .from("pedidos_expedicao")
    .select("id, numero_wms, numero_pedido, status, created_at, payload_origem, depositante:depositantes(nome), itens:pedidos_expedicao_itens(produto_id, quantidade)")
    .gte("created_at", INVENTORY_CUTOFF)
    .in("status", ["PRONTO_ROMANEIO", "EXPEDIDO"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const orderIds = (orders ?? []).map((order) => order.id);
  if (!orderIds.length) return { cutoff: INVENTORY_CUTOFF, rows: [] as ShippingReconciliationRow[] };

  const [{ data: physicalMovements }, { data: manualMovements }] = await Promise.all([
    admin
      .from("movimentacoes_estoque")
      .select("referencia_id")
      .in("referencia_id", orderIds)
      .eq("tipo", "SAIDA")
      .in("referencia_tipo", ["BAIXA_FISICA_CONFERENCIA", "BAIXA_FISICA_CONCILIACAO_RETROATIVA"]),
    admin
      .from("movimentacoes_estoque")
      .select("produto_id, observacoes")
      .gte("created_at", INVENTORY_CUTOFF)
      .eq("tipo", "SAIDA")
      .eq("referencia_tipo", "SAIDA_MANUAL"),
  ]);

  const physicallyDeducted = new Set((physicalMovements ?? []).map((item) => item.referencia_id));
  const manual = manualMovements ?? [];

  const rows = (orders ?? []).map((order) => {
    const payload = asRecord(order.payload_origem);
    const note = asRecord(payload.notaFiscal);
    const notaFiscal = readText(note.numero);
    const itens = Array.isArray(order.itens) ? order.itens : [];
    const products = new Set(itens.map((item) => item.produto_id));
    const referenceTokens = [String(order.numero_pedido ?? ""), notaFiscal].filter(Boolean);
    const hasManualExit = manual.some((movement) => {
      if (!products.has(movement.produto_id)) return false;
      const observation = String(movement.observacoes ?? "").toLowerCase();
      return referenceTokens.some((token) => observation.includes(token.toLowerCase()));
    });
    const totalUnits = itens.reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0);
    const depositante = asRecord(order.depositante);

    let situacao: ShippingReconciliationRow["situacao"] = "PENDENTE";
    let detalhe = "Sem baixa física vinculada. Elegível para conciliação.";
    if (physicallyDeducted.has(order.id)) {
      situacao = "JA_BAIXADO";
      detalhe = "Já possui baixa física vinculada ao pedido.";
    } else if (hasManualExit) {
      situacao = "REVISAR_MANUAL";
      detalhe = "Há saída manual compatível por produto e referência. Evite duplicar a baixa.";
    }

    return {
      id: order.id,
      codigo: `WMS-${String(order.numero_wms).padStart(6, "0")}`,
      pedidoExterno: String(order.numero_pedido ?? "-"),
      notaFiscal: notaFiscal || "Sem NF",
      depositante: readText(depositante.nome) || "Não informado",
      status: String(order.status),
      criadoEm: String(order.created_at),
      itens: itens.length,
      unidades: totalUnits,
      situacao,
      detalhe,
    } satisfies ShippingReconciliationRow;
  });

  return { cutoff: INVENTORY_CUTOFF, rows };
}
