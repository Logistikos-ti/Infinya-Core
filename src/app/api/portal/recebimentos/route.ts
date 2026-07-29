import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PortalReceivingItemPayload = {
  produtoId?: unknown;
  quantidade?: unknown;
};

type PortalReceivingPayload = {
  supplier?: unknown;
  nf?: unknown;
  eta?: unknown;
  hour?: unknown;
  notes?: unknown;
  type?: unknown;
  items?: PortalReceivingItemPayload[];
};

export async function POST(request: Request) {
  try {
    const auth = await requireApiRoleAccess(["DEPOSITANTE"]);

    if (auth.response) {
      return auth.response;
    }

    if (!auth.user.depositanteId) {
      return NextResponse.json(
        { error: "Seu usuário não está vinculado a um depositante." },
        { status: 422 },
      );
    }

    let payload: PortalReceivingPayload;
    try {
      payload = (await request.json()) as PortalReceivingPayload;
    } catch {
      return NextResponse.json(
        { error: "Não foi possível ler os dados enviados." },
        { status: 400 },
      );
    }

    const supplier = String(payload.supplier ?? "").trim();
    const nf = String(payload.nf ?? "").trim();
    const eta = String(payload.eta ?? "").trim();
    const hour = String(payload.hour ?? "").trim();
    const notes = String(payload.notes ?? "").trim();
    const type = String(payload.type ?? "Manual").trim();
    const items = (Array.isArray(payload.items) ? payload.items : [])
      .map((item) => ({
        produtoId: String(item.produtoId ?? "").trim(),
        quantidade: Number(item.quantidade),
      }))
      .filter((item) => item.produtoId && Number.isFinite(item.quantidade) && item.quantidade > 0);

    if (supplier.length < 2) {
      return NextResponse.json(
        { error: "Informe a transportadora." },
        { status: 400 },
      );
    }
    if (nf.length < 3) {
      return NextResponse.json(
        { error: "Informe o número da NF-e." },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eta)) {
      return NextResponse.json(
        { error: "Informe uma data prevista válida." },
        { status: 400 },
      );
    }
    if (!items.length) {
      return NextResponse.json(
        { error: "Adicione ao menos um item com produto e quantidade." },
        { status: 400 },
      );
    }

    const adminSupabase = createSupabaseAdminClient();
    const { data: depositante, error: depositanteError } = await adminSupabase
      .from("depositantes")
      .select("id, codigo")
      .eq("id", auth.user.depositanteId)
      .maybeSingle();

    if (depositanteError) {
      throw new Error(
        `Não foi possível consultar o depositante: ${depositanteError.message}`,
      );
    }
    if (!depositante) {
      return NextResponse.json(
        { error: "Depositante não encontrado." },
        { status: 404 },
      );
    }

    const { data: ownedProducts, error: productsError } = await adminSupabase
      .from("produtos")
      .select("id")
      .eq("depositante_id", depositante.id)
      .in(
        "id",
        items.map((item) => item.produtoId),
      );

    if (productsError) {
      throw new Error(
        `Não foi possível validar os produtos informados: ${productsError.message}`,
      );
    }

    const ownedProductIds = new Set((ownedProducts ?? []).map((product) => product.id));
    if (items.some((item) => !ownedProductIds.has(item.produtoId))) {
      return NextResponse.json(
        { error: "Um ou mais produtos informados não pertencem ao seu depositante." },
        { status: 400 },
      );
    }

    const volumes = items.reduce((sum, item) => sum + item.quantidade, 0);
    const code = buildReceivingCode(depositante.codigo ?? "DEP");
    const observacoes = [
      `Tipo de recebimento: ${type}`,
      hour ? `Horário previsto: ${hour}` : "",
      notes ? `Observações: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: order, error: orderError } = await adminSupabase
      .from("pedidos_recebimento")
      .insert({
        depositante_id: depositante.id,
        codigo: code,
        referencia_externa: nf,
        status: "AGUARDANDO",
        previsto_para: eta,
        nota_fiscal_numero: nf,
        fornecedor_nome: supplier,
        observacoes: observacoes || null,
        criado_por: auth.user.id,
      })
      .select("id, codigo")
      .single();

    if (orderError || !order) {
      throw new Error(
        `Não foi possível criar o recebimento: ${orderError?.message ?? "erro desconhecido"}`,
      );
    }

    const { error: itemsError } = await adminSupabase.from("pedidos_recebimento_itens").insert(
      items.map((item) => ({
        pedido_recebimento_id: order.id,
        depositante_id: depositante.id,
        produto_id: item.produtoId,
        status: "PENDENTE",
        quantidade_prevista: item.quantidade,
        quantidade_recebida: 0,
      })),
    );

    if (itemsError) {
      await adminSupabase.from("pedidos_recebimento").delete().eq("id", order.id);
      throw new Error(`Não foi possível gravar os itens do recebimento: ${itemsError.message}`);
    }

    const { error: taskError } = await adminSupabase
      .from("recebimento_tarefas")
      .insert({
        pedido_recebimento_id: order.id,
        depositante_id: depositante.id,
        tipo: "DOCA",
        status: "PENDENTE",
        titulo: `Preparar recebimento ${order.codigo}`,
        descricao: `NF-e ${nf} com ${volumes} volume(s).`,
        prioridade: 1,
      });

    if (taskError) {
      await adminSupabase
        .from("pedidos_recebimento")
        .delete()
        .eq("id", order.id);
      throw new Error(
        `Não foi possível criar a tarefa de recebimento: ${taskError.message}`,
      );
    }

    return NextResponse.json(
      { message: "Solicitação enviada com sucesso.", order },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a solicitação de recebimento.",
      },
      { status: 500 },
    );
  }
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
