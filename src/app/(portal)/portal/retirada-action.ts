"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AWAITING_RETURN_INVOICE_STATUS } from "@/lib/shipping";

export type CreateRetiradaState = {
  status: "idle" | "success" | "error";
  detail?: string;
  orderNumber?: string;
};

const idleState: CreateRetiradaState = { status: "idle" };

export async function createRetiradaDepositanteAction(
  _prev: CreateRetiradaState = idleState,
  formData: FormData,
): Promise<CreateRetiradaState> {
  const user = await requireRoleAccess(["ADMIN", "TI", "DEPOSITANTE"]);

  if (user.papel === "DEPOSITANTE" && user.portalProfile === "COLABORADOR") {
    return { status: "error", detail: "Seu perfil não possui permissão para solicitar retiradas." };
  }

  const depositanteId = String(formData.get("depositanteId") ?? "").trim();
  const clienteNome = String(formData.get("clienteNome") ?? "").trim();
  const clienteDocumento = String(formData.get("clienteDocumento") ?? "").trim();
  const clienteCep = String(formData.get("clienteCep") ?? "").trim();
  const clienteEndereco = String(formData.get("clienteEndereco") ?? "").trim();
  const clienteNumero = String(formData.get("clienteNumero") ?? "").trim();
  const clienteTelefone = String(formData.get("clienteTelefone") ?? "").trim();
  const clienteCidade = String(formData.get("clienteCidade") ?? "").trim();
  const clienteUf = String(formData.get("clienteUf") ?? "").trim().toUpperCase().slice(0, 2);
  const observacoes = String(formData.get("observacoes") ?? "").trim();
  const carrierName = String(formData.get("carrierName") ?? "").trim();
  const shippingService = String(formData.get("shippingService") ?? "").trim();
  const selectedProductIds = formData.getAll("productId[]").map((item) => String(item ?? "").trim()).filter(Boolean);
  const selectedProductQuantities = formData
    .getAll("itemQuantity[]")
    .map((item) => Number(String(item ?? "0").replace(",", ".")));

  if (!depositanteId || !clienteNome) {
    return { status: "error", detail: "Preencha o destinatário antes de enviar a retirada." };
  }

  if (user.papel === "DEPOSITANTE" && user.depositanteId !== depositanteId) {
    return { status: "error", detail: "O depositante selecionado não corresponde ao perfil autenticado." };
  }

  if (!selectedProductIds.length) {
    return { status: "error", detail: "Selecione ao menos um produto para retirar." };
  }

  const adminSupabase = createSupabaseAdminClient();

  const { data: selectedProducts, error: productsError } = await adminSupabase
    .from("produtos")
    .select("id, nome, sku, codigo_interno, codigo_externo, unidade_estocagem")
    .eq("depositante_id", depositanteId)
    .in("id", selectedProductIds);

  if (productsError) {
    return { status: "error", detail: productsError.message || "Não foi possível carregar os produtos." };
  }

  const productById = new Map((selectedProducts ?? []).map((produto) => [produto.id, produto]));
  const itemDrafts = selectedProductIds.flatMap((productId, index) => {
    const produto = productById.get(productId);
    if (!produto) return [];
    const raw = selectedProductQuantities[index];
    const quantidade = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return [{
      depositante_id: depositanteId,
      produto_id: produto.id,
      codigo_produto: produto.codigo_externo || produto.codigo_interno || null,
      sku: produto.sku || null,
      nome: produto.nome,
      unidade: produto.unidade_estocagem || "UNIDADE",
      quantidade,
      payload_origem: { retirada: true },
    }];
  });

  if (itemDrafts.length !== selectedProductIds.length) {
    return { status: "error", detail: "Um ou mais produtos selecionados não pertencem ao depositante." };
  }

  const totalUnidades = itemDrafts.reduce((sum, item) => sum + item.quantidade, 0);

  const headerPayload = {
    depositante_id: depositanteId,
    codigo: `RET-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
    referencia_externa: `RETIRADA-${randomUUID()}`,
    origem: "RETIRADA_DEPOSITANTE",
    canal: "Retirada de mercadoria",
    status: AWAITING_RETURN_INVOICE_STATUS,
    status_origem: "RETIRADA",
    tipo_operacao: "RETIRADA",
    cliente_nome: clienteNome,
    cliente_documento: clienteDocumento || null,
    cliente_cidade: clienteCidade || null,
    cliente_uf: clienteUf || null,
    quantidade_itens: itemDrafts.length,
    quantidade_unidades: totalUnidades,
    data_pedido: new Date().toISOString(),
    sincronizado_em: new Date().toISOString(),
    observacoes: observacoes || null,
    payload_origem: {
      retirada: true,
      // `criado_por` (snake_case) na raiz é lido pelo trigger de auditoria
      // (registrar_auditoria_tabela), que resolve o nome/papel do usuário
      // consultando public.usuarios. Sem essa chave o INSERT via service_role
      // ficava com autoria nula na tabela auditoria_eventos.
      criado_por: user.id,
      criadoPor: {
        userId: user.id,
        nome: user.nome,
        papel: user.papel,
        em: new Date().toISOString(),
      },
      destinatario: {
        cep: clienteCep || null,
        endereco: clienteEndereco || null,
        numero: clienteNumero || null,
        telefone: clienteTelefone || null,
      },
      transporte: {
        contato: { nome: carrierName || null },
        volumes: [{ servico: shippingService || null }],
      },
    },
  };

  const { data: createdOrder, error: insertError } = await adminSupabase
    .from("pedidos_expedicao")
    .insert(headerPayload)
    .select("id, numero_wms")
    .single();

  if (insertError || !createdOrder) {
    return { status: "error", detail: insertError?.message || "Não foi possível criar a solicitação de retirada." };
  }

  const orderId = createdOrder.id as string;

  // A reserva do estoque acontece aqui, no INSERT dos itens: o trigger
  // `trg_reservar_item_pedido_expedicao_insert` chama
  // `reservar_item_pedido_expedicao` para cada item. Se faltar saldo, ele
  // levanta a exceção e o INSERT falha, caindo no tratamento abaixo.
  //
  // Não chamamos mais `reservar_estoque_retirada`: ela gravava a reserva com
  // outro marcador em `observacoes`, e a bipagem só aceita
  // `reserva-criacao:item:<id>:` — a retirada travava na separação com
  // "Este endereço não possui saldo reservado para o item deste pedido".
  // Além disso ela não expandia KIT em componentes, como o trigger faz.
  const { error: itemsError } = await adminSupabase
    .from("pedidos_expedicao_itens")
    .insert(itemDrafts.map((item) => ({ pedido_expedicao_id: orderId, ...item })));

  if (itemsError) {
    await adminSupabase.from("pedidos_expedicao").delete().eq("id", orderId);
    return {
      status: "error",
      detail: itemsError.message || "Não foi possível reservar o estoque para a retirada.",
    };
  }

  revalidatePath("/expedicao");
  revalidatePath("/portal");

  const orderNumber = createdOrder.numero_wms
    ? `WMS-${String(createdOrder.numero_wms).padStart(6, "0")}`
    : undefined;

  return {
    status: "success",
    orderNumber,
    detail: `Retirada ${orderNumber ?? ""} solicitada. Aguardando a NF-e de devolução do armazém.`.replace("  ", " "),
  };
}
