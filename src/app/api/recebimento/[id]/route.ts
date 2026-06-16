import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { getReceivingOrderDetailFromDb } from "@/lib/receiving";
import { ensureUserCanAccessDepositante } from "@/lib/tenant-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { receivingConferenceSchema } from "@/lib/validations/receiving";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProductRelation =
  | {
      sku?: string;
      nome?: string;
      exige_lote?: boolean;
      exige_validade?: boolean;
      metodo_retirada?: "FEFO" | "FIFO" | "LIFO";
    }
  | Array<{
      sku?: string;
      nome?: string;
      exige_lote?: boolean;
      exige_validade?: boolean;
      metodo_retirada?: "FEFO" | "FIFO" | "LIFO";
    }>
  | null;

type RawConferenceOrder = {
  id: string;
  codigo: string;
  status: string;
  depositante_id: string;
  itens: Array<{
    id: string;
    produto_id: string;
    quantidade_prevista: number | string;
    quantidade_recebida: number | string;
    lote: string | null;
    validade_em: string | null;
    produto: ProductRelation;
  }>;
};

type NormalizedConferenceItem = {
  id: string;
  produtoId: string;
  expected: number;
  received: number;
  lote: string | null;
  validadeEm: string | null;
  status: "PENDENTE" | "RECEBIDO" | "DIVERGENCIA";
  productSku: string;
  productName: string;
  withdrawalMethod: "FEFO" | "FIFO" | "LIFO";
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("recebimento");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const order = await getReceivingOrderDetailFromDb(id);

  if (!order) {
    return NextResponse.json(
      { error: "Pedido de recebimento não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(order);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiModuleAccess("recebimento");

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = await request.json();
  const parsed = receivingConferenceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload inválido para conferência de recebimento.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: orderData, error: orderError } = await adminSupabase
    .from("pedidos_recebimento")
    .select(
      "id, codigo, status, depositante_id, itens:pedidos_recebimento_itens(id, produto_id, quantidade_prevista, quantidade_recebida, lote, validade_em, produto:produtos(sku, nome, exige_lote, exige_validade, metodo_retirada))",
    )
    .eq("id", id)
    .maybeSingle();

  if (orderError || !orderData) {
    return NextResponse.json(
      { error: "Pedido de recebimento não encontrado." },
      { status: 404 },
    );
  }

  const order = orderData as RawConferenceOrder;
  const scopeError = ensureUserCanAccessDepositante(auth.user, order.depositante_id);

  if (scopeError) {
    return scopeError;
  }

  const { data: address, error: addressError } = await adminSupabase
    .from("enderecos")
    .select("id, codigo, ativo")
    .eq("id", parsed.data.enderecoId)
    .eq("ativo", true)
    .maybeSingle();

  if (addressError || !address) {
    return NextResponse.json(
      { error: "Endereço destino inválido para esta conferência." },
      { status: 400 },
    );
  }

  const itemMap = new Map(order.itens.map((item) => [item.id, item]));

  if (parsed.data.items.some((item) => !itemMap.has(item.id))) {
    return NextResponse.json(
      { error: "Um ou mais itens enviados não pertencem a este pedido." },
      { status: 400 },
    );
  }

  let normalizedItems: NormalizedConferenceItem[];

  try {
    normalizedItems = parsed.data.items.map((item) => {
      const current = itemMap.get(item.id)!;
      const expected = Number(current.quantidade_prevista ?? 0);
      const received = Number(item.quantidadeRecebida ?? 0);
      const requireLot = extractProductBoolean(current.produto, "exige_lote");
      const requireExpiry = extractProductBoolean(current.produto, "exige_validade");
      const withdrawalMethod = extractWithdrawalMethod(current.produto);

      if (received > 0 && requireLot && !item.lote?.trim()) {
        throw new Error("Há itens com controle de lote sem lote informado.");
      }

      if (received > 0 && requireExpiry && !item.validadeEm?.trim()) {
        throw new Error("Há itens com controle de validade sem data informada.");
      }

      if (received > 0 && withdrawalMethod === "FEFO" && !item.validadeEm?.trim()) {
        throw new Error(
          "Produtos configurados com FEFO exigem validade informada para entrada automática no estoque.",
        );
      }

      return {
        id: item.id,
        produtoId: current.produto_id,
        expected,
        received,
        lote: item.lote?.trim() || null,
        validadeEm: item.validadeEm?.trim() || null,
        status: calculateItemStatus(expected, received),
        productSku: extractProductField(current.produto, "sku") ?? "SKU",
        productName: extractProductField(current.produto, "nome") ?? "Produto",
        withdrawalMethod,
      };
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível validar os itens da conferência.",
      },
      { status: 400 },
    );
  }

  if (parsed.data.finalizar && normalizedItems.some((item) => item.status !== "RECEBIDO")) {
    return NextResponse.json(
      {
        error:
          "Para concluir o recebimento, todos os itens precisam estar totalmente recebidos e sem divergência.",
      },
      { status: 400 },
    );
  }

  try {
    await Promise.all(
      normalizedItems.map((item) =>
        adminSupabase
          .from("pedidos_recebimento_itens")
          .update({
            quantidade_recebida: item.received,
            lote: item.lote,
            validade_em: item.validadeEm,
            status: item.status,
          })
          .eq("id", item.id)
          .eq("pedido_recebimento_id", order.id),
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar os itens da conferência." },
      { status: 500 },
    );
  }

  const hasDivergence = normalizedItems.some((item) => item.status === "DIVERGENCIA");
  const orderStatus = parsed.data.finalizar
    ? "RECEBIDO"
    : calculateOrderStatus(normalizedItems.map((item) => item.status));

  const { error: statusUpdateError } = await adminSupabase
    .from("pedidos_recebimento")
    .update({
      status: orderStatus,
    })
    .eq("id", order.id);

  if (statusUpdateError) {
    return NextResponse.json(
      { error: `Não foi possível atualizar o status do pedido: ${statusUpdateError.message}` },
      { status: 500 },
    );
  }

  const divergenceSyncError = await syncDivergenceWorkflow({
    adminSupabase,
    authUserId: auth.user.id,
    order,
    normalizedItems,
    hasDivergence,
  });

  if (divergenceSyncError) {
    return NextResponse.json({ error: divergenceSyncError }, { status: 500 });
  }

  if (parsed.data.finalizar) {
    for (const item of normalizedItems) {
      const existingStock = await findExistingStock(
        adminSupabase,
        order.depositante_id,
        item.produtoId,
        parsed.data.enderecoId,
        item.lote,
        item.validadeEm,
      );

      let estoqueId = existingStock?.id ?? null;

      if (existingStock) {
        const { error } = await adminSupabase
          .from("estoque")
          .update({
            quantidade: Number(existingStock.quantidade ?? 0) + item.received,
          })
          .eq("id", existingStock.id);

        if (error) {
          return NextResponse.json(
            { error: `Falha ao atualizar estoque: ${error.message}` },
            { status: 500 },
          );
        }
      } else {
        const { data: createdStock, error } = await adminSupabase
          .from("estoque")
          .insert({
            depositante_id: order.depositante_id,
            produto_id: item.produtoId,
            endereco_id: parsed.data.enderecoId,
            lote: item.lote,
            validade_em: item.validadeEm,
            quantidade: item.received,
          })
          .select("id")
          .single();

        if (error || !createdStock) {
          return NextResponse.json(
            { error: `Falha ao criar estoque: ${error?.message ?? "erro desconhecido"}` },
            { status: 500 },
          );
        }

        estoqueId = createdStock.id;
      }

      const { error: movementError } = await adminSupabase.from("movimentacoes_estoque").insert({
        depositante_id: order.depositante_id,
        estoque_id: estoqueId,
        produto_id: item.produtoId,
        endereco_destino_id: parsed.data.enderecoId,
        tipo: "ENTRADA",
        quantidade: item.received,
        referencia_tipo: "PEDIDO_RECEBIMENTO",
        referencia_id: order.id,
        observacoes: `Entrada automática no estoque pelo método ${item.withdrawalMethod} via recebimento ${order.codigo}.`,
        criado_por: auth.user.id,
      });

      if (movementError) {
        return NextResponse.json(
          { error: `Falha ao registrar movimentação: ${movementError.message}` },
          { status: 500 },
        );
      }
    }

    await adminSupabase
      .from("recebimento_tarefas")
      .update({
        status: "CONCLUIDA",
        concluido_em: new Date().toISOString(),
      })
      .eq("pedido_recebimento_id", order.id)
      .in("status", ["PENDENTE", "EM_ANDAMENTO"]);

    const enderecamentoTaskError = await ensureEnderecamentoTask({
      adminSupabase,
      order,
      addressCode: address.codigo,
    });

    if (enderecamentoTaskError) {
      return NextResponse.json({ error: enderecamentoTaskError }, { status: 500 });
    }
  }

  return NextResponse.json({
    message: parsed.data.finalizar
      ? `Recebimento concluído e lançado no estoque em ${address.codigo}.`
      : hasDivergence
        ? "Conferência salva com divergência já registrada para tratativa."
        : "Conferência salva com sucesso.",
    status: orderStatus,
  });
}

function calculateItemStatus(expected: number, received: number) {
  if (received <= 0) return "PENDENTE";
  if (received === expected) return "RECEBIDO";
  return "DIVERGENCIA";
}

function calculateOrderStatus(itemStatuses: string[]) {
  if (itemStatuses.some((status) => status === "DIVERGENCIA")) {
    return "DIVERGENCIA";
  }

  if (itemStatuses.every((status) => status === "PENDENTE")) {
    return "AGUARDANDO";
  }

  if (itemStatuses.every((status) => status === "RECEBIDO")) {
    return "RECEBIDO_PARCIAL";
  }

  return "EM_RECEBIMENTO";
}

function extractProductBoolean(
  value: ProductRelation,
  field: "exige_lote" | "exige_validade",
) {
  if (Array.isArray(value)) {
    return Boolean(value[0]?.[field]);
  }

  return Boolean(value?.[field]);
}

function extractProductField(value: ProductRelation, field: "sku" | "nome") {
  if (Array.isArray(value)) {
    return typeof value[0]?.[field] === "string" ? value[0][field] : null;
  }

  return value && typeof value[field] === "string" ? value[field] : null;
}

function extractWithdrawalMethod(value: ProductRelation): "FEFO" | "FIFO" | "LIFO" {
  if (Array.isArray(value)) {
    const method = value[0]?.metodo_retirada;
    return method === "FIFO" || method === "LIFO" ? method : "FEFO";
  }

  const method = value?.metodo_retirada;
  return method === "FIFO" || method === "LIFO" ? method : "FEFO";
}

async function findExistingStock(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  depositanteId: string,
  produtoId: string,
  enderecoId: string,
  lote: string | null,
  validadeEm: string | null,
) {
  let query = adminSupabase
    .from("estoque")
    .select("id, quantidade")
    .eq("depositante_id", depositanteId)
    .eq("produto_id", produtoId)
    .eq("endereco_id", enderecoId);

  query = lote ? query.eq("lote", lote) : query.is("lote", null);
  query = validadeEm ? query.eq("validade_em", validadeEm) : query.is("validade_em", null);

  const { data } = await query.maybeSingle();
  return data;
}

async function syncDivergenceWorkflow({
  adminSupabase,
  authUserId,
  order,
  normalizedItems,
  hasDivergence,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  authUserId: string;
  order: RawConferenceOrder;
  normalizedItems: NormalizedConferenceItem[];
  hasDivergence: boolean;
}) {
  for (const item of normalizedItems) {
    const issueType = getIssueType(item.expected, item.received);
    const { data: openIssues } = await adminSupabase
      .from("ocorrencias_operacionais")
      .select("id")
      .eq("pedido_recebimento_id", order.id)
      .eq("item_recebimento_id", item.id)
      .in("status", ["ABERTA", "EM_ANALISE"]);
    const openIssueIds = (openIssues ?? []).map((issue) => issue.id);

    if (item.status === "DIVERGENCIA" && issueType) {
      if (openIssueIds.length) {
        const { error } = await adminSupabase
          .from("ocorrencias_operacionais")
          .update({
            tipo: issueType,
            titulo: buildIssueTitle(item),
            descricao: buildIssueDescription(order.codigo, item),
          })
          .in("id", openIssueIds);

        if (error) {
          return `Falha ao atualizar ocorrência de divergência: ${error.message}`;
        }
      } else {
        const { error } = await adminSupabase.from("ocorrencias_operacionais").insert({
          depositante_id: order.depositante_id,
          pedido_recebimento_id: order.id,
          item_recebimento_id: item.id,
          tipo: issueType,
          status: "ABERTA",
          titulo: buildIssueTitle(item),
          descricao: buildIssueDescription(order.codigo, item),
          aberto_por: authUserId,
        });

        if (error) {
          return `Falha ao abrir ocorrência de divergência: ${error.message}`;
        }
      }
    } else if (openIssueIds.length) {
      const { error } = await adminSupabase
        .from("ocorrencias_operacionais")
        .update({
          status: "RESOLVIDA",
          resolvido_por: authUserId,
          resolvido_em: new Date().toISOString(),
        })
        .in("id", openIssueIds);

      if (error) {
        return `Falha ao resolver ocorrência do item: ${error.message}`;
      }
    }
  }

  const { data: openTasks } = await adminSupabase
    .from("recebimento_tarefas")
    .select("id")
    .eq("pedido_recebimento_id", order.id)
    .eq("tipo", "TRATATIVA_DIVERGENCIA")
    .in("status", ["PENDENTE", "EM_ANDAMENTO"]);
  const openTaskIds = (openTasks ?? []).map((task) => task.id);

  if (hasDivergence) {
    if (openTaskIds.length) {
      const { error } = await adminSupabase
        .from("recebimento_tarefas")
        .update({
          titulo: `Tratar divergência do recebimento ${order.codigo}`,
          descricao:
            "Recebimento com diferença entre previsto e recebido. Avaliar falta, sobra ou outra tratativa.",
          status: "PENDENTE",
        })
        .in("id", openTaskIds);

      if (error) {
        return `Falha ao atualizar tarefa de divergência: ${error.message}`;
      }
    } else {
      const { error } = await adminSupabase.from("recebimento_tarefas").insert({
        pedido_recebimento_id: order.id,
        depositante_id: order.depositante_id,
        tipo: "TRATATIVA_DIVERGENCIA",
        status: "PENDENTE",
        titulo: `Tratar divergência do recebimento ${order.codigo}`,
        descricao:
          "Recebimento com diferença entre previsto e recebido. Avaliar falta, sobra ou outra tratativa.",
        prioridade: 1,
      });

      if (error) {
        return `Falha ao criar tarefa de divergência: ${error.message}`;
      }
    }
  } else if (openTaskIds.length) {
    const { error } = await adminSupabase
      .from("recebimento_tarefas")
      .update({
        status: "CONCLUIDA",
        concluido_em: new Date().toISOString(),
      })
      .in("id", openTaskIds);

    if (error) {
      return `Falha ao concluir tarefa de divergência: ${error.message}`;
    }
  }

  return null;
}

async function ensureEnderecamentoTask({
  adminSupabase,
  order,
  addressCode,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  order: RawConferenceOrder;
  addressCode: string;
}) {
  const { data: existingTasks } = await adminSupabase
    .from("recebimento_tarefas")
    .select("id")
    .eq("pedido_recebimento_id", order.id)
    .eq("tipo", "ENDERECAMENTO")
    .in("status", ["PENDENTE", "EM_ANDAMENTO"]);

  if ((existingTasks ?? []).length) {
    return null;
  }

  const { error } = await adminSupabase.from("recebimento_tarefas").insert({
    pedido_recebimento_id: order.id,
    depositante_id: order.depositante_id,
    tipo: "ENDERECAMENTO",
    status: "PENDENTE",
    titulo: `Validar endereçamento do recebimento ${order.codigo}`,
    descricao: `Conferir a entrada física e a disponibilidade no endereço ${addressCode}.`,
    prioridade: 2,
  });

  if (error) {
    return `Falha ao criar tarefa de endereçamento: ${error.message}`;
  }

  return null;
}

function getIssueType(expected: number, received: number) {
  if (received < expected) {
    return "FALTA";
  }

  if (received > expected) {
    return "SOBRA";
  }

  return null;
}

function buildIssueTitle(item: NormalizedConferenceItem) {
  const issueType = getIssueType(item.expected, item.received);
  const prefix = issueType === "FALTA" ? "Falta" : "Sobra";

  return `${prefix} no SKU ${item.productSku}`;
}

function buildIssueDescription(orderCode: string, item: NormalizedConferenceItem) {
  return `Recebimento ${orderCode}: produto ${item.productName} (${item.productSku}) com previsto ${item.expected.toLocaleString("pt-BR")} e recebido ${item.received.toLocaleString("pt-BR")}.`;
}
