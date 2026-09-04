import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTimePtBr } from "@/lib/utils";

type ProductRow = {
  id: string;
  nome: string;
  sku: string | null;
  codigo_externo: string | null;
  codigo_interno: string | null;
  codigo_externo_pack: string | null;
  imagem_principal_url: string | null;
};

type StockRow = {
  id: string;
  produto_id: string;
  endereco_id: string;
  quantidade: number | string | null;
};

export type GeneralInventoryItem = {
  id: string;
  produtoId: string;
  nome: string;
  sku: string;
  codigoExterno: string | null;
  codigoInterno: string | null;
  codigoExternoPack: string | null;
  /** Unidades por embalagem -- buscado ao vivo em produtos (não é
   * snapshotado; tamanho de pack não muda no meio de uma contagem). */
  quantidadePorEmbalagem: number | null;
  imagemUrl: string | null;
  quantidadeSistema: number;
  quantidadeContada: number | null;
  divergencia: number;
  status: "PENDENTE" | "CONTADO" | "DIVERGENTE";
  atribuidoA: string | null;
  atribuidoNome: string | null;
  contadoPor: string | null;
  contadoEm: string | null;
  /** Address codes this product currently sits at (as captured when the
   * inventory was opened) -- used by the camera scan flow to validate the
   * "bipe o endereço" step against any of the product's real locations. */
  enderecos: string[];
};

export type GeneralInventoryDetail = {
  id: string;
  depositanteId: string;
  depositante: string;
  dataOperacional: string;
  status: string;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  programadoPara: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  totalItens: number;
  contados: number;
  pendentes: number;
  divergentes: number;
  zerados: number;
  aumentos: number;
  reducoes: number;
  itens: GeneralInventoryItem[];
};

function operationalToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function missingTable(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.message?.includes("inventarios_gerais") ||
        error.message?.includes("inventários_gerais")),
  );
}

async function countActiveProdutos(supabase: ReturnType<typeof createSupabaseAdminClient>, depositanteId: string) {
  const { count } = await supabase
    .from("produtos")
    .select("id", { count: "exact", head: true })
    .eq("depositante_id", depositanteId)
    .eq("ativo", true);
  return count ?? 0;
}

// Busca os produtos ativos do depositante e o saldo atual (somado por
// produto, entre todos os endereços) e grava um item PENDENTE por produto.
// Compartilhado por openGeneralInventory (varre na hora de abrir, hoje) e
// startScheduledGeneralInventory (varre na hora de iniciar um inventário
// programado, pra não guardar um retrato de estoque desatualizado).
async function snapshotGeneralInventoryItems(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  inventoryId: string,
  depositanteId: string,
) {
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("id, nome, sku, codigo_externo, codigo_interno, codigo_externo_pack, imagem_principal_url")
    .eq("depositante_id", depositanteId)
    .eq("ativo", true)
    .order("nome");

  if (productsError) {
    throw new Error(`Não foi possível carregar os produtos: ${productsError.message}`);
  }

  if (!products?.length) {
    throw new Error("Este depositante não possui produtos ativos para inventariar.");
  }

  const productIds = products.map((product) => product.id);
  const { data: stockRows, error: stockError } = await supabase
    .from("estoque")
    .select("id, produto_id, endereco_id, quantidade")
    .eq("depositante_id", depositanteId)
    .in("produto_id", productIds);

  if (stockError) {
    throw new Error(`Não foi possível capturar os saldos atuais: ${stockError.message}`);
  }

  const byProduct = new Map<string, StockRow[]>();
  for (const stock of (stockRows ?? []) as StockRow[]) {
    const list = byProduct.get(stock.produto_id) ?? [];
    list.push(stock);
    byProduct.set(stock.produto_id, list);
  }

  const itemRows = (products as ProductRow[]).map((product) => {
    const balances = byProduct.get(product.id) ?? [];
    return {
      inventario_id: inventoryId,
      depositante_id: depositanteId,
      produto_id: product.id,
      nome_produto: product.nome,
      sku: product.sku,
      codigo_externo: product.codigo_externo,
      codigo_interno: product.codigo_interno,
      codigo_externo_pack: product.codigo_externo_pack,
      imagem_url: product.imagem_principal_url,
      quantidade_sistema: balances.reduce((sum, row) => sum + Number(row.quantidade ?? 0), 0),
      estoque_snapshot: balances.map((row) => ({
        id: row.id,
        quantidade: Number(row.quantidade ?? 0),
        endereco_id: row.endereco_id,
      })),
    };
  });

  const { error: itemError } = await supabase.from("inventarios_gerais_itens").insert(itemRows);
  if (itemError) {
    await supabase.from("inventarios_gerais").delete().eq("id", inventoryId);
    throw new Error(`Não foi possível preparar a lista do inventário: ${itemError.message}`);
  }
}

export async function openGeneralInventory(input: {
  depositanteId: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const today = operationalToday();

  const { data: existing, error: existingError } = await supabase
    .from("inventarios_gerais")
    .select("id")
    .eq("depositante_id", input.depositanteId)
    .eq("data_operacional", today)
    .eq("status", "EM_CONTAGEM")
    .maybeSingle();

  if (existingError && !missingTable(existingError)) {
    throw new Error(`Não foi possível localizar o inventário geral: ${existingError.message}`);
  }

  let inventoryId = existing?.id as string | undefined;

  if (!inventoryId) {
    // An active session from a previous day cannot be resumed. It is closed as
    // cancelled before today's session is created, preserving the audit trail.
    await supabase
      .from("inventarios_gerais")
      .update({
        status: "CANCELADO",
        observacoes: "Sessão encerrada automaticamente por não ter sido concluída no dia operacional.",
      })
      .eq("depositante_id", input.depositanteId)
      .eq("status", "EM_CONTAGEM")
      .neq("data_operacional", today);

    const { data: header, error: headerError } = await supabase
      .from("inventarios_gerais")
      .insert({
        depositante_id: input.depositanteId,
        data_operacional: today,
        status: "EM_CONTAGEM",
        criado_por: input.userId,
        iniciado_em: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (headerError?.code === "23505") {
      const { data: concurrent } = await supabase
        .from("inventarios_gerais")
        .select("id")
        .eq("depositante_id", input.depositanteId)
        .eq("data_operacional", today)
        .eq("status", "EM_CONTAGEM")
        .maybeSingle();
      inventoryId = concurrent?.id as string | undefined;
    } else if (headerError || !header) {
      throw new Error(`Não foi possível abrir o inventário geral: ${headerError?.message ?? "erro desconhecido"}`);
    }

    if (!inventoryId) inventoryId = header?.id as string | undefined;
    if (header && inventoryId === header.id) {
      await snapshotGeneralInventoryItems(supabase, header.id, input.depositanteId);
    }
  }

  if (!inventoryId) throw new Error("Inventário geral não encontrado.");

  await supabase.from("inventarios_gerais_participantes").upsert(
    { inventario_id: inventoryId, usuario_id: input.userId },
    { onConflict: "inventario_id,usuario_id" },
  );

  return getGeneralInventory(inventoryId);
}

// Programa um inventário geral pra uma data futura, com responsável
// pré-atribuído. Diferente de openGeneralInventory, NÃO faz snapshot de
// produtos/saldo agora nem grava data_operacional -- isso só acontece em
// startScheduledGeneralInventory, na hora de iniciar de verdade.
export async function scheduleGeneralInventory(input: {
  depositanteId: string;
  userId: string;
  programadoPara: string;
  responsavelId?: string;
}) {
  const supabase = createSupabaseAdminClient();

  const { data: header, error: headerError } = await supabase
    .from("inventarios_gerais")
    .insert({
      depositante_id: input.depositanteId,
      status: "PROGRAMADO",
      criado_por: input.userId,
      programado_para: input.programadoPara,
      responsavel_id: input.responsavelId || null,
    })
    .select("id")
    .single();

  if (headerError || !header) {
    throw new Error(`Não foi possível programar o inventário: ${headerError?.message ?? "erro desconhecido"}`);
  }

  return { id: header.id as string };
}

export async function startScheduledGeneralInventory(inventoryId: string) {
  const supabase = createSupabaseAdminClient();
  const today = operationalToday();

  const { data: header, error: headerError } = await supabase
    .from("inventarios_gerais")
    .select("id, depositante_id, status")
    .eq("id", inventoryId)
    .maybeSingle();

  if (headerError) {
    throw new Error(`Não foi possível localizar o inventário programado: ${headerError.message}`);
  }

  if (!header) {
    throw new Error("Inventário não encontrado.");
  }

  if (header.status !== "PROGRAMADO") {
    throw new Error("Este inventário já foi iniciado.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("inventarios_gerais")
    .select("id")
    .eq("depositante_id", header.depositante_id)
    .eq("data_operacional", today)
    .eq("status", "EM_CONTAGEM")
    .maybeSingle();

  if (existingError) {
    throw new Error(`Não foi possível verificar contagens em andamento: ${existingError.message}`);
  }

  if (existing) {
    throw new Error("Já existe um inventário geral em andamento hoje para este depositante. Conclua-o antes de iniciar este.");
  }

  const { error: updateError } = await supabase
    .from("inventarios_gerais")
    .update({ status: "EM_CONTAGEM", data_operacional: today, iniciado_em: new Date().toISOString() })
    .eq("id", inventoryId);

  if (updateError) {
    throw new Error(`Não foi possível iniciar o inventário: ${updateError.message}`);
  }

  await snapshotGeneralInventoryItems(supabase, inventoryId, header.depositante_id);

  return { id: inventoryId };
}

/**
 * Reinicia um inventário geral EM_CONTAGEM do zero: todos os itens voltam a
 * PENDENTE (contagem, divergência e atribuição apagadas). Diferente da
 * contagem cíclica, o inventário geral nunca toca o estoque real durante a
 * contagem -- o ajuste só acontece na finalização (finalize_general_inventory)
 * -- então reiniciar aqui é só um reset de metadados, sem estorno nenhum.
 */
export async function restartGeneralInventory(inventoryId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: header, error: headerError } = await supabase
    .from("inventarios_gerais")
    .select("id, status")
    .eq("id", inventoryId)
    .maybeSingle();

  if (headerError) {
    throw new Error(`Não foi possível localizar o inventário: ${headerError.message}`);
  }

  if (!header) {
    throw new Error("Inventário não encontrado.");
  }

  if (header.status !== "EM_CONTAGEM") {
    throw new Error("Só é possível reiniciar um inventário em andamento.");
  }

  const { error } = await supabase
    .from("inventarios_gerais_itens")
    .update({
      quantidade_contada: null,
      divergencia: 0,
      status: "PENDENTE",
      atribuido_a: null,
      atribuido_em: null,
      contado_por: null,
      contado_em: null,
    })
    .eq("inventario_id", inventoryId);

  if (error) {
    throw new Error(`Não foi possível reiniciar os itens do inventário: ${error.message}`);
  }

  return getGeneralInventory(inventoryId);
}

export async function cancelGeneralInventory(inventoryId: string) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("inventarios_gerais")
    .update({ status: "CANCELADO" })
    .eq("id", inventoryId)
    .in("status", ["PROGRAMADO", "EM_CONTAGEM"]);

  if (error) {
    throw new Error(`Não foi possível cancelar o inventário: ${error.message}`);
  }
}

export async function rescheduleGeneralInventory(
  inventoryId: string,
  input: { programadoPara: string; responsavelId?: string },
) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("inventarios_gerais")
    .update({
      programado_para: input.programadoPara,
      responsavel_id: input.responsavelId || null,
    })
    .eq("id", inventoryId)
    .eq("status", "PROGRAMADO");

  if (error) {
    throw new Error(`Não foi possível reagendar o inventário: ${error.message}`);
  }
}

export async function getGeneralInventory(id: string): Promise<GeneralInventoryDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data: header, error: headerError } = await supabase
    .from("inventarios_gerais")
    .select(
      "id, depositante_id, data_operacional, status, iniciado_em, concluido_em, programado_para, responsavel_id, responsavel:usuarios!inventarios_gerais_responsavel_id_fkey(nome), depositante:depositantes(nome)",
    )
    .eq("id", id)
    .maybeSingle();

  if (headerError) throw new Error(`Não foi possível carregar o inventário: ${headerError.message}`);
  if (!header) return null;

  const { data: rows, error: itemError } = await supabase
    .from("inventarios_gerais_itens")
    .select("id, produto_id, nome_produto, sku, codigo_externo, codigo_interno, codigo_externo_pack, imagem_url, quantidade_sistema, quantidade_contada, divergencia, status, atribuido_a, contado_por, contado_em, estoque_snapshot")
    .eq("inventario_id", id)
    .order("nome_produto");

  if (itemError) throw new Error(`Não foi possível carregar os itens do inventário: ${itemError.message}`);

  const userIds = Array.from(new Set((rows ?? []).flatMap((row) => [row.atribuido_a, row.contado_por]).filter(Boolean)));
  const { data: users } = userIds.length
    ? await supabase.from("usuarios").select("id, nome").in("id", userIds)
    : { data: [] };
  const names = new Map((users ?? []).map((user) => [user.id, user.nome]));

  const enderecoIds = Array.from(
    new Set(
      (rows ?? []).flatMap((row) => {
        const snapshot = Array.isArray(row.estoque_snapshot) ? row.estoque_snapshot : [];
        return snapshot
          .map((entry: { endereco_id?: string | null }) => entry?.endereco_id)
          .filter((value): value is string => Boolean(value));
      }),
    ),
  );
  const { data: enderecos } = enderecoIds.length
    ? await supabase.from("enderecos").select("id, codigo").in("id", enderecoIds)
    : { data: [] };
  const enderecoCodesById = new Map((enderecos ?? []).map((endereco) => [endereco.id, endereco.codigo]));

  const produtoIds = Array.from(new Set((rows ?? []).map((row) => row.produto_id).filter(Boolean)));
  const { data: produtos } = produtoIds.length
    ? await supabase.from("produtos").select("id, quantidade_por_embalagem").in("id", produtoIds)
    : { data: [] };
  const packQtyByProdutoId = new Map((produtos ?? []).map((p) => [p.id, p.quantidade_por_embalagem as number | null]));

  const items = (rows ?? []).map((row) => {
    const snapshot = Array.isArray(row.estoque_snapshot) ? row.estoque_snapshot : [];
    const enderecoCodes = Array.from(
      new Set(
        snapshot
          .map((entry: { endereco_id?: string | null }) => (entry?.endereco_id ? enderecoCodesById.get(entry.endereco_id) : null))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    return {
      id: row.id,
      produtoId: row.produto_id,
      nome: row.nome_produto,
      sku: row.sku ?? "Sem SKU",
      codigoExterno: row.codigo_externo,
      codigoInterno: row.codigo_interno,
      codigoExternoPack: row.codigo_externo_pack,
      quantidadePorEmbalagem: packQtyByProdutoId.get(row.produto_id) ?? null,
      imagemUrl: row.imagem_url,
      quantidadeSistema: Number(row.quantidade_sistema ?? 0),
      quantidadeContada: row.quantidade_contada === null ? null : Number(row.quantidade_contada ?? 0),
      divergencia: Number(row.divergencia ?? 0),
      status: row.status as GeneralInventoryItem["status"],
      atribuidoA: row.atribuido_a,
      atribuidoNome: row.atribuido_a ? names.get(row.atribuido_a) ?? "Outro operador" : null,
      contadoPor: row.contado_por ? names.get(row.contado_por) ?? "Operador" : null,
      contadoEm: row.contado_em ? formatDateTimePtBr(row.contado_em) : null,
      enderecos: enderecoCodes,
    };
  });

  const depositanteRelation = header.depositante as unknown as { nome?: string } | Array<{ nome?: string }> | null;
  const responsavelRelation = header.responsavel as unknown as { nome?: string } | Array<{ nome?: string }> | null;

  return {
    id: header.id,
    depositanteId: header.depositante_id,
    depositante: Array.isArray(depositanteRelation) ? depositanteRelation[0]?.nome ?? "Depositante" : depositanteRelation?.nome ?? "Depositante",
    dataOperacional: header.data_operacional,
    status: header.status,
    iniciadoEm: header.iniciado_em ? formatDateTimePtBr(header.iniciado_em) : null,
    concluidoEm: header.concluido_em ? formatDateTimePtBr(header.concluido_em) : null,
    programadoPara: header.programado_para,
    responsavelId: header.responsavel_id,
    responsavelNome: Array.isArray(responsavelRelation) ? responsavelRelation[0]?.nome ?? null : responsavelRelation?.nome ?? null,
    totalItens: items.length,
    contados: items.filter((item) => item.status !== "PENDENTE").length,
    pendentes: items.filter((item) => item.status === "PENDENTE").length,
    divergentes: items.filter((item) => item.status === "DIVERGENTE").length,
    zerados: items.filter((item) => item.status !== "PENDENTE" && item.quantidadeContada === 0).length,
    aumentos: items.filter((item) => item.status === "DIVERGENTE" && item.divergencia > 0).length,
    reducoes: items.filter((item) => item.status === "DIVERGENTE" && item.divergencia < 0).length,
    itens: items,
  };
}

export async function claimGeneralInventoryItem(input: {
  inventoryId: string;
  itemId?: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const detail = await getGeneralInventory(input.inventoryId);
  if (!detail) throw new Error("Inventário geral não encontrado.");
  if (detail.dataOperacional !== operationalToday()) throw new Error("Este inventário só pode ser operado no dia em que foi iniciado.");
  if (detail.status !== "EM_CONTAGEM") throw new Error("Este inventário já foi encerrado.");

  const target = input.itemId
    ? detail.itens.find((item) => item.id === input.itemId)
    : detail.itens.find((item) => item.status === "PENDENTE" && !item.atribuidoA);
  if (!target) throw new Error("Nenhum produto pendente está disponível para assumir.");
  if (target.atribuidoA && target.atribuidoA !== input.userId) throw new Error("Este produto já está com outro operador.");

  if (!target.atribuidoA) {
    const { data, error } = await supabase
      .from("inventarios_gerais_itens")
      .update({ atribuido_a: input.userId, atribuido_em: new Date().toISOString() })
      .eq("id", target.id)
      .is("atribuido_a", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new Error("Outro operador assumiu este produto. Escolha o próximo disponível.");
  }

  await supabase.from("inventarios_gerais_participantes").upsert(
    { inventario_id: input.inventoryId, usuario_id: input.userId },
    { onConflict: "inventario_id,usuario_id" },
  );
  return {
    detail: await getGeneralInventory(input.inventoryId),
    claimedItemId: target.id,
  };
}

export async function recordGeneralInventoryItem(input: {
  inventoryId: string;
  itemId: string;
  userId: string;
  quantidade: number;
  /**
   * false = rascunho (bipagem em andamento: trocando de item, ou a aba foi
   * escondida no meio da contagem). Persiste quantidade_contada e mantém o
   * claim fresco, mas NÃO toca status/divergencia/contado_por/contado_em --
   * o item continua PENDENTE, então não escapa do gate de finalização nem
   * é contado como "fechado" a partir de uma tally parcial. Default true
   * (comportamento de sempre: fecha o item como CONTADO/DIVERGENTE).
   */
  final?: boolean;
}) {
  if (!Number.isFinite(input.quantidade) || input.quantidade < 0) throw new Error("Informe uma quantidade válida.");
  const supabase = createSupabaseAdminClient();

  // Validação enxuta (1 linha do cabeçalho + 1 linha do item) em vez de
  // recarregar o inventário inteiro (todos os itens + endereços + usuários)
  // só pra checar status/atribuição -- isso era o principal motivo do atraso
  // percebido pelo operador entre o bipe e a tela atualizar.
  const { data: header, error: headerError } = await supabase
    .from("inventarios_gerais")
    .select("id, status, data_operacional")
    .eq("id", input.inventoryId)
    .maybeSingle();
  if (headerError) throw new Error(`Não foi possível validar o inventário: ${headerError.message}`);
  if (!header || header.data_operacional !== operationalToday()) throw new Error("Este inventário só pode ser operado no dia em que foi iniciado.");
  if (header.status !== "EM_CONTAGEM") throw new Error("Este inventário já foi encerrado.");

  const { data: itemRow, error: itemRowError } = await supabase
    .from("inventarios_gerais_itens")
    .select("id, atribuido_a, quantidade_sistema")
    .eq("id", input.itemId)
    .eq("inventario_id", input.inventoryId)
    .maybeSingle();
  if (itemRowError) throw new Error(`Não foi possível validar o item: ${itemRowError.message}`);
  if (!itemRow) throw new Error("Item do inventário não encontrado.");
  if (itemRow.atribuido_a && itemRow.atribuido_a !== input.userId) throw new Error("Este produto está atribuído a outro operador.");

  const final = input.final ?? true;
  const updatePayload: Record<string, unknown> = {
    quantidade_contada: input.quantidade,
    atribuido_a: input.userId,
    atribuido_em: new Date().toISOString(),
  };

  if (final) {
    const divergence = input.quantidade - Number(itemRow.quantidade_sistema ?? 0);
    updatePayload.divergencia = divergence;
    updatePayload.status = divergence === 0 ? "CONTADO" : "DIVERGENTE";
    updatePayload.contado_por = input.userId;
    updatePayload.contado_em = new Date().toISOString();
  }

  const { error } = await supabase
    .from("inventarios_gerais_itens")
    .update(updatePayload)
    .eq("id", input.itemId)
    .eq("inventario_id", input.inventoryId);
  if (error) throw new Error(`Não foi possível salvar a contagem: ${error.message}`);
  return getGeneralInventory(input.inventoryId);
}

/**
 * Libera o claim de um item ainda PENDENTE, revertendo um "assumir"
 * acidental (ex.: bipe do produto errado por embalagem parecida). Só quem
 * detém o claim pode liberar, e só enquanto o item não foi fechado.
 */
export async function releaseGeneralInventoryItem(input: {
  inventoryId: string;
  itemId: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("inventarios_gerais_itens")
    .update({ atribuido_a: null, atribuido_em: null })
    .eq("id", input.itemId)
    .eq("inventario_id", input.inventoryId)
    .eq("atribuido_a", input.userId)
    .eq("status", "PENDENTE")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Não foi possível liberar o produto: ${error.message}`);
  if (!data) throw new Error("Este produto não está mais atribuído a você ou já foi contado.");
  return getGeneralInventory(input.inventoryId);
}

export async function finalizeGeneralInventory(input: { inventoryId: string; userId: string }) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("finalize_general_inventory", {
    p_inventory_id: input.inventoryId,
    p_user_id: input.userId,
  });
  if (error) throw new Error(error.message);
  return data as { divergentes: number; zerados: number; aumentos: number; reducoes: number; ajustesAplicados: number };
}

export async function getGeneralInventoryReport(id: string) {
  const detail = await getGeneralInventory(id);
  if (!detail) throw new Error("Inventário geral não encontrado.");
  const header = ["Produto", "SKU", "Quantidade no sistema", "Quantidade contada", "Divergência", "Status", "Contado por", "Contado em"];
  const rows = detail.itens.map((item) => [
    item.nome,
    item.sku,
    item.quantidadeSistema,
    item.quantidadeContada ?? "",
    item.divergencia,
    item.status,
    item.contadoPor ?? "",
    item.contadoEm ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
    .join("\r\n");
  return { detail, csv: `\ufeff${csv}` };
}

// Lista inventários gerais em qualquer status (PROGRAMADO/EM_CONTAGEM/
// CONCLUIDO/CANCELADO), no mesmo formato de CycleCountSummary usado pela
// contagem cíclica -- alimenta a lista unificada de inventários (ver
// src/lib/inventory-runs.ts).
export async function listGeneralInventoriesFromDb(options?: {
  depositanteId?: string;
  status?: string;
  limit?: number;
}): Promise<import("./stock-cycle-counts").CycleCountSummary[]> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("inventarios_gerais")
    .select("id, depositante_id, data_operacional, status, iniciado_em, concluido_em, created_at")
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.depositanteId) {
    query = query.eq("depositante_id", options.depositanteId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: headers, error } = await query;

  if (error) {
    if (missingTable(error)) return [];
    throw new Error(`Não foi possível carregar os inventários gerais: ${error.message}`);
  }

  const summaries = await Promise.all(
    (headers || []).map(async (header) => {
      const detail = await getGeneralInventory(header.id);
      if (!detail) return null;
      // Programado ainda não tem itens gravados (o snapshot só acontece ao
      // iniciar) -- estima quantos SKUs serão varridos pra não mostrar "—"
      // na coluna Itens da lista. Mesma aproximação da prévia do drawer.
      const totalItems =
        detail.status === "PROGRAMADO"
          ? await countActiveProdutos(supabase, detail.depositanteId)
          : detail.totalItens;
      return {
        id: detail.id,
        type: "GERAL" as const,
        titulo: `Inventário geral (${detail.dataOperacional ?? "a agendar"})`,
        depositanteId: detail.depositanteId,
        depositante: detail.depositante,
        area: "Todas as áreas",
        status: detail.status,
        blindCount: false,
        createdAt: detail.concluidoEm || detail.iniciadoEm || "-",
        programadoPara: detail.programadoPara,
        responsavelId: detail.responsavelId,
        responsavelNome: detail.responsavelNome,
        countedItems: detail.contados,
        totalItems,
        divergentItems: detail.divergentes,
        timestamp: new Date(header.concluido_em || header.iniciado_em || header.created_at).getTime(),
      } satisfies import("./stock-cycle-counts").CycleCountSummary;
    }),
  );

  return summaries.filter(Boolean) as import("./stock-cycle-counts").CycleCountSummary[];
}

export async function listCompletedGeneralInventoriesFromDb(limit = 50) {
  return listGeneralInventoriesFromDb({ status: "CONCLUIDO", limit });
}
