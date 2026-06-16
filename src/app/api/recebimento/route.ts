import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/api-auth";
import {
  listOperationalIssuesFromDb,
  listReceivingOrdersFromDb,
  listReceivingTasksFromDb,
} from "@/lib/receiving";
import { ensureUserCanAccessDepositante } from "@/lib/tenant-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { receivingOrderDraftSchema } from "@/lib/validations/receiving";

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("recebimento");

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() ?? "";
  const depositanteId =
    auth.user.papel === "DEPOSITANTE"
      ? auth.user.depositanteId ?? ""
      : searchParams.get("depositante")?.trim() ?? "";
  const dateFrom = searchParams.get("dataInicial")?.trim() ?? "";
  const dateTo = searchParams.get("dataFinal")?.trim() ?? "";

  const [orders, tasks, issues] = await Promise.all([
    listReceivingOrdersFromDb({
      status: status || undefined,
      depositanteId: depositanteId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    listReceivingTasksFromDb(),
    listOperationalIssuesFromDb(),
  ]);

  return NextResponse.json({
    orders,
    tasks,
    issues,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("recebimento");

  if (auth.response) {
    return auth.response;
  }

  const payload = await request.json();
  const parsed = receivingOrderDraftSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Payload inválido para abertura de recebimento.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, parsed.data.depositanteId);

  if (scopeError) {
    return scopeError;
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositante } = await adminSupabase
    .from("depositantes")
    .select("id, codigo, nome, configuracoes")
    .eq("id", parsed.data.depositanteId)
    .maybeSingle();

  if (!depositante) {
    return NextResponse.json(
      { error: "Depositante não encontrado para este recebimento." },
      { status: 404 },
    );
  }

  const productIds = parsed.data.items.map((item) => item.produtoId);
  const { data: produtos, error: productsError } = await adminSupabase
    .from("produtos")
    .select("id, nome, sku")
    .eq("depositante_id", depositante.id)
    .eq("ativo", true)
    .in("id", productIds);

  if (productsError) {
    return NextResponse.json(
      {
        error: `Não foi possível validar os produtos do recebimento: ${productsError.message}`,
      },
      { status: 500 },
    );
  }

  const validProducts = new Map((produtos ?? []).map((produto) => [produto.id, produto]));

  if (validProducts.size !== productIds.length) {
    return NextResponse.json(
      {
        error: "Um ou mais produtos informados não pertencem ao depositante selecionado.",
        fieldErrors: {
          items: ["Revise os itens do recebimento e selecione apenas produtos válidos."],
        },
      },
      { status: 400 },
    );
  }

  const code = buildReceivingCode(depositante.codigo);
  const { data: order, error: orderError } = await adminSupabase
    .from("pedidos_recebimento")
    .insert({
      depositante_id: depositante.id,
      codigo: code,
      referencia_externa: parsed.data.notaFiscal,
      status: "AGUARDANDO",
      previsto_para: parsed.data.previsao.slice(0, 10),
      nota_fiscal_numero: parsed.data.notaFiscal,
      fornecedor_nome: parsed.data.fornecedor,
      observacoes: parsed.data.observacoes || null,
      criado_por: auth.user.id,
    })
    .select("id, codigo")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      {
        error: `Não foi possível criar o pedido de recebimento: ${orderError?.message ?? "erro desconhecido"}`,
      },
      { status: 500 },
    );
  }

  const { error: itemsError } = await adminSupabase
    .from("pedidos_recebimento_itens")
    .insert(
      parsed.data.items.map((item) => ({
        pedido_recebimento_id: order.id,
        depositante_id: depositante.id,
        produto_id: item.produtoId,
        status: "PENDENTE",
        quantidade_prevista: item.quantidadePrevista,
        quantidade_recebida: 0,
      })),
    );

  if (itemsError) {
    await adminSupabase.from("pedidos_recebimento").delete().eq("id", order.id);

    return NextResponse.json(
      {
        error: `O pedido foi aberto, mas falhou ao gravar os itens: ${itemsError.message}`,
      },
      { status: 500 },
    );
  }

  await adminSupabase.from("recebimento_tarefas").insert({
    pedido_recebimento_id: order.id,
    depositante_id: depositante.id,
    tipo: "DOCA",
    status: "PENDENTE",
    titulo: `Preparar ${parsed.data.doca} para ${order.codigo}`,
    descricao: `Recebimento previsto para ${depositante.nome} com NF ${parsed.data.notaFiscal}.`,
    prioridade: 1,
  });

  return NextResponse.json(
    {
      message: "Recebimento criado com sucesso.",
      order: {
        id: order.id,
        code: order.codigo,
      },
    },
    { status: 201 },
  );
}

function buildReceivingCode(depositanteCodigo: string) {
  const now = new Date();
  const datePart = [
    now.getFullYear().toString().slice(-2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.floor(Math.random() * 900 + 100);

  return `REC-${datePart}-${depositanteCodigo.slice(0, 3).toUpperCase()}-${suffix}`;
}
