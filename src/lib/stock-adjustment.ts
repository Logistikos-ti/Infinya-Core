import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdjustStockInput = {
  userId: string;
  depositanteId: string;
  stockId?: string;
  stockIds?: string[];
  targetQuantity: number;
  reason: string;
};

function parseOperationalQuantity(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""));
  return Number(raw);
}

export async function adjustStockBalance(input: AdjustStockInput) {
  if (!Number.isFinite(input.targetQuantity) || input.targetQuantity < 0) {
    throw new Error("A quantidade final deve ser igual ou maior que zero.");
  }

  const supabase = createSupabaseAdminClient();
  const stockIds = Array.from(new Set([...(input.stockIds ?? []), input.stockId].filter(Boolean) as string[]));

  if (stockIds.length === 0) throw new Error("Selecione um saldo para ajustar.");

  const { data: stocks, error: stockError } = await supabase
    .from("estoque")
    .select("id, depositante_id, produto_id, endereco_id, quantidade, quantidade_reservada, bloqueado, created_at")
    .in("id", stockIds);

  if (stockError || !stocks || stocks.length !== stockIds.length) {
    throw new Error("Saldo de estoque nao encontrado ou falha na leitura.");
  }
  if (stocks.some((stock) => stock.depositante_id !== input.depositanteId)) {
    throw new Error("O saldo selecionado nao pertence ao depositante informado.");
  }
  if (stocks.some((stock) => stock.bloqueado)) {
    throw new Error("Nao e possivel ajustar um saldo bloqueado.");
  }

  const productId = stocks[0]?.produto_id;
  if (stocks.some((stock) => stock.produto_id !== productId)) {
    throw new Error("Os saldos selecionados devem pertencer ao mesmo produto.");
  }

  const currentQuantity = stocks.reduce((total, stock) => total + parseOperationalQuantity(stock.quantidade), 0);
  const reservedQuantity = stocks.reduce((total, stock) => total + parseOperationalQuantity(stock.quantidade_reservada), 0);
  const newQuantity = input.targetQuantity;
  const quantityDiff = newQuantity - currentQuantity;

  if (quantityDiff === 0) throw new Error("A nova quantidade nao pode ser igual a quantidade atual.");
  if (newQuantity < reservedQuantity) {
    throw new Error(`A nova quantidade (${newQuantity}) nao pode ser menor que a quantidade reservada (${reservedQuantity}).`);
  }

  // Keep the final balance entered by the operator when the drawer adjusts multiple lots.
  const orderedStocks = [...stocks].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  let remaining = newQuantity;
  const changes = orderedStocks.map((stock, index) => {
    const current = parseOperationalQuantity(stock.quantidade);
    const reserved = parseOperationalQuantity(stock.quantidade_reservada);
    const next = index === orderedStocks.length - 1 ? remaining : Math.min(current, Math.max(reserved, remaining));
    remaining -= next;
    return { stock, current, next, difference: next - current };
  }).filter((change) => change.difference !== 0);

  const appliedChanges: typeof changes = [];
  try {
    for (const change of changes) {
      const { error: updateError } = await supabase
        .from("estoque")
        .update({ quantidade: change.next })
        .eq("id", change.stock.id);
      if (updateError) throw new Error(`Falha ao atualizar o saldo: ${updateError.message}`);
      appliedChanges.push(change);

      const type = change.difference > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO";
      const { error: movementError } = await supabase.from("movimentacoes_estoque").insert({
        depositante_id: change.stock.depositante_id,
        estoque_id: change.stock.id,
        produto_id: change.stock.produto_id,
        endereco_origem_id: type === "AJUSTE_NEGATIVO" ? change.stock.endereco_id : null,
        endereco_destino_id: type === "AJUSTE_POSITIVO" ? change.stock.endereco_id : null,
        tipo: type,
        quantidade: Math.abs(change.difference),
        referencia_tipo: "AJUSTE_MANUAL",
        observacoes: input.reason,
        criado_por: input.userId,
      });
      if (movementError) throw new Error(`Falha ao registrar o ajuste: ${movementError.message}`);
    }
  } catch (error) {
    await Promise.all(appliedChanges.map((change) => supabase.from("estoque").update({ quantidade: change.current }).eq("id", change.stock.id)));
    throw error;
  }

  return { success: true, newQuantity };
}
