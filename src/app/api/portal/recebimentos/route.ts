import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PortalReceivingPayload = {
  supplier?: unknown;
  nf?: unknown;
  eta?: unknown;
  hour?: unknown;
  volumes?: unknown;
  notes?: unknown;
  type?: unknown;
  xmlName?: unknown;
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
    const type = String(payload.type ?? "NF-e XML").trim();
    const xmlName = String(payload.xmlName ?? "").trim();
    const volumes = Number(payload.volumes);

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
    if (!Number.isFinite(volumes) || volumes <= 0) {
      return NextResponse.json(
        { error: "Informe uma quantidade de volumes maior que zero." },
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

    const code = buildReceivingCode(depositante.codigo ?? "DEP");
    const observacoes = [
      `Tipo de recebimento: ${type}`,
      `Volumes previstos: ${volumes}`,
      hour ? `Horário previsto: ${hour}` : "",
      xmlName ? `XML selecionado: ${xmlName}` : "",
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
