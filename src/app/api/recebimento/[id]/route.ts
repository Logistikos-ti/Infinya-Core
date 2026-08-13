import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import { getReceivingOrderDetailFromDb } from "@/lib/receiving";
import { PENDING_ADDRESSING_BLOCK_REASON } from "@/lib/stock-blocking";
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
      endereco_padrao_id?: string | null;
    }
  | Array<{
      sku?: string;
      nome?: string;
      exige_lote?: boolean;
      exige_validade?: boolean;
      metodo_retirada?: "FEFO" | "FIFO" | "LIFO";
      endereco_padrao_id?: string | null;
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
  enderecoPadraoId: string | null;
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
  let { data: orderData, error: orderError } = await adminSupabase
    .from("pedidos_recebimento")
    .select(
      "id, codigo, status, depositante_id, itens:pedidos_recebimento_itens(id, produto_id, quantidade_prevista, quantidade_recebida, lote, validade_em, produto:produtos(sku, nome, exige_lote, exige_validade, metodo_retirada, endereco_padrao_id))",
    )
    .eq("id", id)
    .maybeSingle();

  // The "endereco_padrao_id" column may not exist yet in an environment that
  // hasn't run the matching migration: fall back to the previous select so
  // receiving keeps working (every item just uses the staging address) until
  // that migration is applied.
  if (orderError && isMissingEnderecoPadraoColumnError(orderError.message)) {
    ({ data: orderData, error: orderError } = await adminSupabase
      .from("pedidos_recebimento")
      .select(
        "id, codigo, status, depositante_id, itens:pedidos_recebimento_itens(id, produto_id, quantidade_prevista, quantidade_recebida, lote, validade_em, produto:produtos(sku, nome, exige_lote, exige_validade, metodo_retirada))",
      )
      .eq("id", id)
      .maybeSingle());
  }

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
        enderecoPadraoId: extractProductField(current.produto, "endereco_padrao_id"),
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

  const hasIncompleteItems = normalizedItems.some((item) => item.status !== "RECEBIDO");

  if (parsed.data.finalizar && hasIncompleteItems && !parsed.data.confirmarDivergencia) {
    return NextResponse.json(
      {
        error:
          "Para concluir o recebimento, todos os itens precisam estar totalmente recebidos e sem divergência.",
        divergentItems: normalizedItems
          .filter((item) => item.status !== "RECEBIDO")
          .map((item) => ({
            sku: item.productSku,
            nome: item.productName,
            previsto: item.expected,
            recebido: item.received,
          })),
      },
      { status: 400 },
    );
  }

  // The operator reviewed the shortfall and chose to close anyway: items
  // still untouched (PENDENTE) are recorded as DIVERGENCIA instead, so the
  // saved history shows they were missing, not simply "not started yet".
  if (parsed.data.finalizar && parsed.data.confirmarDivergencia && hasIncompleteItems) {
    normalizedItems = normalizedItems.map((item) =>
      item.status === "PENDENTE" ? { ...item, status: "DIVERGENCIA" as const } : item,
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
    ? hasDivergence
      ? "DIVERGENCIA"
      : "RECEBIDO"
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

  let quarantinedItemCount = 0;

  if (parsed.data.finalizar && hasDivergence) {
    const quarantineResult = await createReceivingQuarantineRows({
      adminSupabase,
      authUserId: auth.user.id,
      order,
      normalizedItems,
      enderecoId: parsed.data.enderecoId,
      addressCode: address.codigo,
    });

    if (quarantineResult.error) {
      return NextResponse.json({ error: quarantineResult.error }, { status: 500 });
    }

    quarantinedItemCount = quarantineResult.createdCount;

    await adminSupabase
      .from("recebimento_tarefas")
      .update({
        status: "CONCLUIDA",
        concluido_em: new Date().toISOString(),
      })
      .eq("pedido_recebimento_id", order.id)
      .neq("tipo", "TRATATIVA_DIVERGENCIA")
      .in("status", ["PENDENTE", "EM_ANDAMENTO"]);
  }

  // Tracks whether any item fell back to the shared staging address (no
  // registered address on its product, or a deactivated one), so the final
  // response message can describe where stock actually landed.
  let usedFallbackAddress = false;

  if (parsed.data.finalizar && !hasDivergence) {
    // Items whose product has a registered address go straight there instead
    // of the shared receiving/staging address. Guard against an address that
    // was deactivated after being set on the product: only trust it if it's
    // still active, otherwise fall back like an unset address would.
    const registeredEnderecoIds = [
      ...new Set(
        normalizedItems
          .map((item) => item.enderecoPadraoId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const activeRegisteredEnderecoIds = new Set<string>();

    if (registeredEnderecoIds.length > 0) {
      const { data: activeEnderecos } = await adminSupabase
        .from("enderecos")
        .select("id")
        .in("id", registeredEnderecoIds)
        .eq("ativo", true);

      for (const row of activeEnderecos ?? []) {
        activeRegisteredEnderecoIds.add(row.id);
      }
    }

    for (const item of normalizedItems) {
      if (item.received <= 0) continue;

      const hasValidRegisteredEndereco =
        item.enderecoPadraoId !== null && activeRegisteredEnderecoIds.has(item.enderecoPadraoId);
      const destinationEnderecoId = hasValidRegisteredEndereco
        ? (item.enderecoPadraoId as string)
        : parsed.data.enderecoId;

      if (!hasValidRegisteredEndereco) {
        usedFallbackAddress = true;
      }

      const existingStock = await findExistingStock(
        adminSupabase,
        order.depositante_id,
        item.produtoId,
        destinationEnderecoId,
        item.lote,
        item.validadeEm,
      );

      let estoqueId = existingStock?.id ?? null;

      // Stock that lands on the shared triagem address (no registered
      // address on the product) is blocked from picking until someone
      // physically moves it to the right place — never touched when the
      // item already went to its own registered address.
      const blockFields = hasValidRegisteredEndereco
        ? {}
        : {
            bloqueado: true,
            bloqueio_motivo: PENDING_ADDRESSING_BLOCK_REASON,
            bloqueado_em: new Date().toISOString(),
          };

      if (existingStock) {
        const { error } = await adminSupabase
          .from("estoque")
          .update({
            quantidade: Number(existingStock.quantidade ?? 0) + item.received,
            ...blockFields,
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
            endereco_id: destinationEnderecoId,
            lote: item.lote,
            validade_em: item.validadeEm,
            quantidade: item.received,
            ...blockFields,
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
        endereco_destino_id: destinationEnderecoId,
        tipo: "ENTRADA",
        quantidade: item.received,
        referencia_tipo: "PEDIDO_RECEBIMENTO",
        referencia_id: order.id,
        observacoes: hasValidRegisteredEndereco
          ? `Entrada automática no endereço cadastrado do produto pelo método ${item.withdrawalMethod} via recebimento ${order.codigo}.`
          : `Entrada automática no estoque pelo método ${item.withdrawalMethod} via recebimento ${order.codigo}. Bloqueado até ser endereçado.`,
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

    // Only open the pending "endereçamento" task when at least one item
    // still landed in the shared staging address (no registered address of
    // its own, or a deactivated one). If every item went straight to its
    // product's own address, there's nothing left to manually put away.
    if (usedFallbackAddress) {
      const enderecamentoTaskError = await ensureEnderecamentoTask({
        adminSupabase,
        order,
        addressCode: address.codigo,
      });

      if (enderecamentoTaskError) {
        return NextResponse.json({ error: enderecamentoTaskError }, { status: 500 });
      }
    }
  }

  const finalizedLocationMessage = usedFallbackAddress
    ? `lançado no estoque nos endereços cadastrados dos produtos (itens sem endereço próprio foram para ${address.codigo})`
    : "lançado no estoque nos endereços cadastrados dos produtos";

  const responseMessage = parsed.data.finalizar
    ? hasDivergence
      ? quarantinedItemCount > 0
        ? "Recebimento finalizado com divergencia. O material recebido foi bloqueado em quarentena ate a correcao da nota fiscal pelo depositante."
        : "Recebimento finalizado com divergencia. A falta foi registrada para correcao da nota fiscal pelo depositante."
      : `Recebimento concluido e ${finalizedLocationMessage}.`
    : hasDivergence
      ? "Conferencia salva com divergencia ja registrada para tratativa."
      : "Conferencia salva com sucesso.";

  return NextResponse.json({
    message: responseMessage,
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

function extractProductField(value: ProductRelation, field: "sku" | "nome" | "endereco_padrao_id") {
  if (Array.isArray(value)) {
    return typeof value[0]?.[field] === "string" ? value[0][field] : null;
  }

  return value && typeof value[field] === "string" ? value[field] : null;
}

function isMissingEnderecoPadraoColumnError(message: string) {
  return message.includes("endereco_padrao_id");
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

async function createReceivingQuarantineRows({
  adminSupabase,
  authUserId,
  order,
  normalizedItems,
  enderecoId,
  addressCode,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  authUserId: string;
  order: RawConferenceOrder;
  normalizedItems: NormalizedConferenceItem[];
  enderecoId: string;
  addressCode: string;
}): Promise<{ createdCount: number; error: string | null }> {
  const rows = normalizedItems
    .filter((item) => item.received > 0)
    .map((item) => ({
      depositante_id: order.depositante_id,
      produto_id: item.produtoId,
      estoque_id: null,
      endereco_id: enderecoId,
      quantidade: item.received,
      motivo: buildReceivingQuarantineReason(order.codigo, item, addressCode),
      status: "EM_QUARENTENA",
      criado_por: authUserId,
    }));

  if (rows.length === 0) {
    return { createdCount: 0, error: null };
  }

  const { data: existingRows, error: existingError } = await adminSupabase
    .from("estoque_quarentena")
    .select("id")
    .eq("depositante_id", order.depositante_id)
    .eq("status", "EM_QUARENTENA")
    .ilike("motivo", `%${order.codigo}%`);

  if (existingError) {
    return { createdCount: 0, error: `Falha ao verificar quarentena do recebimento: ${existingError.message}` };
  }

  if ((existingRows ?? []).length >= rows.length) {
    return { createdCount: existingRows?.length ?? 0, error: null };
  }

  const { error } = await adminSupabase.from("estoque_quarentena").insert(rows);

  if (error) {
    return { createdCount: 0, error: `Falha ao enviar recebimento para quarentena: ${error.message}` };
  }

  return { createdCount: rows.length, error: null };
}

function buildReceivingQuarantineReason(orderCode: string, item: NormalizedConferenceItem, addressCode: string) {
  const issue = getIssueType(item.expected, item.received);
  const issueLabel = issue === "SOBRA" ? "sobra" : issue === "FALTA" ? "falta" : "divergência";

  return [
    `Recebimento ${orderCode} com ${issueLabel}.`,
    `Produto ${item.productSku} - ${item.productName}.`,
    `Previsto: ${item.expected}; recebido: ${item.received}.`,
    `Material físico bloqueado em quarentena no endereço ${addressCode} até correção da nota fiscal pelo depositante.`,
  ].join(" ");
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
