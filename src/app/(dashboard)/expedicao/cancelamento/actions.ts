"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth";
import { registrarLancamentoCancelamento } from "@/lib/billing";
import { requiresBipagemForCancellation } from "@/lib/shipping-cancellation-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSupabase = ReturnType<typeof createSupabaseAdminClient>;

type SeededLine = {
  item_pedido_id: string;
  produto_id: string;
  estoque_id: string | null;
  endereco_esperado_id: string | null;
  quantidade_esperada: number;
};

export type OpenCancellationResult =
  | { ok: true; cancelamentoId: string; requerBipagem: boolean; concluido: boolean }
  | { ok: false; message: string };

/**
 * Core logic shared by every existing cancel entry point. Always opens a
 * pedidos_expedicao_cancelamentos header (even for a trivial NOVO-order
 * cancel) and always concludes through concluir_cancelamento_pedido_expedicao
 * -- one code path, so quantidade_separada reset and reservation release stay
 * consistent everywhere, matching the WMS-DEV-01534-style guard pattern this
 * session already applied to the picking-wave save actions.
 *
 * Takes an already-resolved `user` instead of gating internally: this is
 * called from several action files that each have their own appropriate role
 * gate for their own UI context (some ADMIN/TI-only, some also DEPOSITANTE,
 * e.g. the portal divergence-resolution flow, and the Bling webhook, which
 * has no interactive user at all -- pass `{ id: null }`, same "system change,
 * no auth.uid()" convention already used by garantir_baixa_fisica_pedido's
 * trigger call). A DEPOSITANTE can still *open* a cancellation this way --
 * they just can never reach the bipagem screen itself, since
 * registerCancellationScanAction/concludeShippingOrderCancellationAction gate
 * to warehouse staff only.
 */
export async function openShippingOrderCancellation(input: {
  orderId: string;
  motivo?: string;
  user: { id: string | null };
}): Promise<OpenCancellationResult> {
  const { user } = input;
  const adminSupabase = createSupabaseAdminClient();

  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_expedicao")
    .select("id, status, depositante_id")
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, message: orderError?.message ?? "Pedido não encontrado." };
  }

  if (order.status === "CANCELADO") {
    return { ok: false, message: "Este pedido já está cancelado." };
  }

  const { data: existingOpen } = await adminSupabase
    .from("pedidos_expedicao_cancelamentos")
    .select("id")
    .eq("pedido_expedicao_id", order.id)
    .eq("status", "EM_ANDAMENTO")
    .maybeSingle();

  if (existingOpen) {
    return { ok: true, cancelamentoId: existingOpen.id, requerBipagem: true, concluido: false };
  }

  const wouldNeedBipagem = requiresBipagemForCancellation(order.status);
  const lines = wouldNeedBipagem ? await seedCancellationLines(adminSupabase, order.id) : [];
  const requerBipagem = wouldNeedBipagem && lines.length > 0;

  const { data: cancelamento, error: insertError } = await adminSupabase
    .from("pedidos_expedicao_cancelamentos")
    .insert({
      pedido_expedicao_id: order.id,
      depositante_id: order.depositante_id,
      requer_bipagem: requerBipagem,
      status_pedido_na_abertura: order.status,
      motivo: input.motivo?.trim() || null,
      aberto_por: user.id,
    })
    .select("id")
    .single();

  if (insertError || !cancelamento) {
    return { ok: false, message: insertError?.message ?? "Não foi possível abrir o processo de cancelamento." };
  }

  if (lines.length) {
    const { error: linesError } = await adminSupabase.from("pedidos_expedicao_cancelamento_itens").insert(
      lines.map((line) => ({ ...line, cancelamento_id: cancelamento.id })),
    );

    if (linesError) {
      await adminSupabase.from("pedidos_expedicao_cancelamentos").delete().eq("id", cancelamento.id);
      return { ok: false, message: linesError.message };
    }
  }

  // The order sits in EM_CANCELAMENTO for the whole EM_ANDAMENTO window --
  // this is what actually locks it (romaneio release, delete, manual status
  // change, order edit, etc. all gate on isAwaitingCancellationReturn) rather
  // than leaving the order's old status untouched and unguarded everywhere.
  if (requerBipagem) {
    const { error: statusError } = await adminSupabase
      .from("pedidos_expedicao")
      .update({ status: "EM_CANCELAMENTO" })
      .eq("id", order.id);

    if (statusError) {
      await adminSupabase.from("pedidos_expedicao_cancelamentos").delete().eq("id", cancelamento.id);
      return { ok: false, message: statusError.message };
    }
  }

  revalidateShippingPaths(order.id);

  if (!requerBipagem) {
    const { error: concludeError } = await adminSupabase.rpc(
      "concluir_cancelamento_pedido_expedicao" as never,
      { p_cancelamento_id: cancelamento.id, p_usuario_id: user.id } as never,
    );

    if (concludeError) {
      return { ok: false, message: concludeError.message };
    }

    registrarLancamentoCancelamento(cancelamento.id).catch(() => {});

    revalidateShippingPaths(order.id);
    return { ok: true, cancelamentoId: cancelamento.id, requerBipagem: false, concluido: true };
  }

  return { ok: true, cancelamentoId: cancelamento.id, requerBipagem: true, concluido: false };
}

export async function openShippingOrderCancellationAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const orderId = String(formData.get("orderId") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/expedicao").trim() || "/expedicao";

  if (!orderId) {
    redirect(appendFeedback(returnTo, "erro"));
  }

  const result = await openShippingOrderCancellation({ orderId, motivo: motivo || undefined, user });

  if (!result.ok) {
    redirect(appendFeedback(returnTo, "erro"));
  }

  if (result.concluido) {
    redirect(appendFeedback("/expedicao", "cancelado"));
  }

  redirect(`/expedicao/cancelamento/${result.cancelamentoId}`);
}

export async function registerCancellationScanAction(input: {
  cancelamentoItemId: string;
  enderecoId: string;
  estoqueId: string | null;
  produtoId: string;
  quantity: number;
  condicao?: "BOM" | "AVARIADO";
  scanId: string;
}) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);

  if (!input.cancelamentoItemId || !input.enderecoId || !input.produtoId || !input.scanId) {
    return { ok: false as const, message: "Dados de leitura inválidos." };
  }

  const quantity = Number(input.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false as const, message: "Quantidade inválida." };
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data: item, error: itemError } = await adminSupabase
    .from("pedidos_expedicao_cancelamento_itens")
    .select(
      "id, estoque_id, cancelamento:pedidos_expedicao_cancelamentos(id, status, depositante_id, pedido_expedicao_id)",
    )
    .eq("id", input.cancelamentoItemId)
    .maybeSingle();

  if (itemError || !item) {
    return { ok: false as const, message: "Item de cancelamento não encontrado." };
  }

  const cancelamento = firstRelation(item.cancelamento);
  if (!cancelamento || cancelamento.status !== "EM_ANDAMENTO") {
    return { ok: false as const, message: "Este processo de cancelamento não está mais em andamento." };
  }

  let estoqueId = input.estoqueId || item.estoque_id;
  if (!estoqueId) {
    const resolved = await findOrCreateReturnStock(adminSupabase, {
      depositanteId: cancelamento.depositante_id,
      produtoId: input.produtoId,
      enderecoId: input.enderecoId,
    });

    if (!resolved.ok) {
      return { ok: false as const, message: resolved.message };
    }

    estoqueId = resolved.estoqueId;
  }

  const { data, error } = await adminSupabase.rpc(
    "registrar_bipagem_cancelamento_expedicao" as never,
    {
      p_cancelamento_item_id: input.cancelamentoItemId,
      p_endereco_id: input.enderecoId,
      p_estoque_id: estoqueId,
      p_produto_id: input.produtoId,
      p_quantidade: quantity,
      p_usuario_id: user.id,
      p_scan_id: input.scanId,
      p_condicao: input.condicao ?? "BOM",
    } as never,
  );

  if (error) {
    return { ok: false as const, message: error.message };
  }

  revalidatePath(`/expedicao/cancelamento/${cancelamento.id}`);
  revalidatePath(`/m/cancelamento/${cancelamento.id}`);

  return { ok: true as const, data };
}

export async function concludeShippingOrderCancellationAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const cancelamentoId = String(formData.get("cancelamentoId") ?? "").trim();
  const forcarDivergencia = String(formData.get("forcarDivergencia") ?? "") === "true";
  const motivoDivergencia = String(formData.get("motivoDivergencia") ?? "").trim() || null;

  if (!cancelamentoId) {
    redirect("/expedicao?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error } = await adminSupabase.rpc("concluir_cancelamento_pedido_expedicao" as never, {
    p_cancelamento_id: cancelamentoId,
    p_usuario_id: user.id,
    p_forcar_divergencia: forcarDivergencia,
    p_motivo_divergencia: motivoDivergencia,
  } as never);

  if (error) {
    if (error.message.toLowerCase().includes("sem confirmacao completa")) {
      redirect(`/expedicao/cancelamento/${cancelamentoId}?feedback=divergencia`);
    }
    redirect(`/expedicao/cancelamento/${cancelamentoId}?feedback=erro`);
  }

  registrarLancamentoCancelamento(cancelamentoId).catch(() => {});

  revalidatePath("/expedicao");
  revalidatePath("/expedicao/separacao");
  revalidatePath("/expedicao/conferencia");
  revalidatePath("/expedicao/cancelamento");
  redirect("/expedicao?feedback=cancelado");
}

export async function abandonShippingOrderCancellationAction(formData: FormData) {
  const user = await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  const cancelamentoId = String(formData.get("cancelamentoId") ?? "").trim();

  if (!cancelamentoId) {
    redirect("/expedicao?feedback=erro");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: cancelamento } = await adminSupabase
    .from("pedidos_expedicao_cancelamentos")
    .select("id, pedido_expedicao_id, status, status_pedido_na_abertura")
    .eq("id", cancelamentoId)
    .maybeSingle();

  if (!cancelamento || cancelamento.status !== "EM_ANDAMENTO") {
    redirect("/expedicao?feedback=erro");
  }

  // Every EM_ANDAMENTO cancellation was opened with requerBipagem === true
  // (the false case auto-concludes synchronously and never reaches
  // EM_ANDAMENTO), so the order is always sitting in EM_CANCELAMENTO here --
  // restore it before marking abandoned, not after: if this update fails,
  // the cancellation stays EM_ANDAMENTO (still blocked/retryable) instead of
  // ending up ABANDONADO with the order stuck in limbo.
  const { error: restoreError } = await adminSupabase
    .from("pedidos_expedicao")
    .update({ status: cancelamento.status_pedido_na_abertura })
    .eq("id", cancelamento.pedido_expedicao_id)
    .eq("status", "EM_CANCELAMENTO");

  if (restoreError) {
    redirect(`/expedicao/${cancelamento.pedido_expedicao_id}?feedback=erro`);
  }

  await adminSupabase
    .from("pedidos_expedicao_cancelamentos")
    .update({
      status: "ABANDONADO",
      concluido_por: user.id,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", cancelamentoId);

  revalidatePath(`/expedicao/${cancelamento.pedido_expedicao_id}`);
  revalidatePath("/expedicao/cancelamento");
  redirect(`/expedicao/${cancelamento.pedido_expedicao_id}?feedback=cancelamento-abandonado`);
}

async function seedCancellationLines(adminSupabase: AdminSupabase, orderId: string): Promise<SeededLine[]> {
  const { data: items } = await adminSupabase
    .from("pedidos_expedicao_itens")
    .select("id, produto_id, quantidade_separada")
    .eq("pedido_expedicao_id", orderId)
    .gt("quantidade_separada", 0);

  if (!items?.length) return [];

  const itemIds = items.map((item) => item.id);
  const { data: scans } = await adminSupabase
    .from("bipagens_separacao")
    .select("item_pedido_id, estoque_id, quantidade")
    .in("item_pedido_id", itemIds);

  const scansByItem = new Map<string, Map<string, number>>();
  for (const scan of scans ?? []) {
    const byEstoque = scansByItem.get(scan.item_pedido_id) ?? new Map<string, number>();
    byEstoque.set(scan.estoque_id, (byEstoque.get(scan.estoque_id) ?? 0) + Number(scan.quantidade));
    scansByItem.set(scan.item_pedido_id, byEstoque);
  }

  type DraftLine = { item_pedido_id: string; produto_id: string; estoque_id: string | null; quantidade_esperada: number };
  const draftLines: DraftLine[] = [];

  for (const item of items) {
    const separated = Number(item.quantidade_separada);
    const byEstoque = scansByItem.get(item.id);
    let remaining = separated;

    if (byEstoque?.size) {
      for (const [estoqueId, scannedQuantity] of byEstoque) {
        if (remaining <= 0) break;
        const take = Math.min(scannedQuantity, remaining);
        draftLines.push({ item_pedido_id: item.id, produto_id: item.produto_id, estoque_id: estoqueId, quantidade_esperada: take });
        remaining -= take;
      }
    }

    // Picked without a formal scan (e.g. desktop manual quantity entry) --
    // no known origin bin, falls back to the product's default address.
    if (remaining > 0) {
      draftLines.push({ item_pedido_id: item.id, produto_id: item.produto_id, estoque_id: null, quantidade_esperada: remaining });
    }
  }

  const estoqueIds = [...new Set(draftLines.map((line) => line.estoque_id).filter((id): id is string => Boolean(id)))];
  const enderecoByEstoque = new Map<string, string>();

  if (estoqueIds.length) {
    const { data: stocks } = await adminSupabase.from("estoque").select("id, endereco_id").in("id", estoqueIds);
    for (const stock of stocks ?? []) {
      if (stock.endereco_id) enderecoByEstoque.set(stock.id, stock.endereco_id);
    }
  }

  const produtoIdsNeedingFallback = [
    ...new Set(draftLines.filter((line) => !line.estoque_id).map((line) => line.produto_id)),
  ];
  const fallbackEnderecoByProduto = new Map<string, string>();

  if (produtoIdsNeedingFallback.length) {
    const { data: produtos } = await adminSupabase
      .from("produtos")
      .select("id, endereco_padrao_id")
      .in("id", produtoIdsNeedingFallback);

    for (const produto of produtos ?? []) {
      if (produto.endereco_padrao_id) fallbackEnderecoByProduto.set(produto.id, produto.endereco_padrao_id);
    }
  }

  return draftLines.map((line) => ({
    ...line,
    endereco_esperado_id: line.estoque_id
      ? enderecoByEstoque.get(line.estoque_id) ?? null
      : fallbackEnderecoByProduto.get(line.produto_id) ?? null,
  }));
}

async function findOrCreateReturnStock(
  adminSupabase: AdminSupabase,
  input: { depositanteId: string; produtoId: string; enderecoId: string },
) {
  const { data: existing, error: findError } = await adminSupabase
    .from("estoque")
    .select("id")
    .eq("depositante_id", input.depositanteId)
    .eq("produto_id", input.produtoId)
    .eq("endereco_id", input.enderecoId)
    .is("lote", null)
    .is("validade_em", null)
    .maybeSingle();

  if (findError) {
    return { ok: false as const, message: findError.message };
  }

  if (existing) {
    return { ok: true as const, estoqueId: existing.id as string };
  }

  const { data: created, error: insertError } = await adminSupabase
    .from("estoque")
    .insert({
      depositante_id: input.depositanteId,
      produto_id: input.produtoId,
      endereco_id: input.enderecoId,
      quantidade: 0,
      quantidade_reservada: 0,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return { ok: false as const, message: insertError?.message ?? "Não foi possível criar o saldo de destino." };
  }

  return { ok: true as const, estoqueId: created.id as string };
}

function revalidateShippingPaths(orderId: string) {
  revalidatePath("/expedicao");
  revalidatePath("/expedicao/separacao");
  revalidatePath("/expedicao/conferencia");
  revalidatePath("/expedicao/cancelamento");
  revalidatePath("/m/separacao");
  revalidatePath("/m/conferencia");
  revalidatePath(`/expedicao/${orderId}`);
}

function appendFeedback(path: string, feedback: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}feedback=${feedback}`;
}

type Relation<T> = T | T[] | null;

function firstRelation<T>(value: Relation<T>) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
