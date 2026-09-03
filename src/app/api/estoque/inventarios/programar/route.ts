import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createCycleCount, scheduleCycleCount } from "@/lib/stock-cycle-counts";
import { openGeneralInventory, scheduleGeneralInventory } from "@/lib/general-inventories";

// Uma data/hora programada "agora" (ou no passado) não faz sentido como
// estágio PROGRAMADA -- inicia direto, preservando o comportamento imediato
// de sempre pra quem não quer agendar de verdade. Uma pequena folga evita
// que o tempo de ida e volta da requisição empurre "agora mesmo" pro
// passado por uns milissegundos e vire um agendamento sem sentido.
const IMMEDIATE_START_THRESHOLD_MS = 60_000;

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as
    | {
        tipo?: string;
        depositanteId?: string;
        area?: string;
        skuId?: string;
        titulo?: string;
        observacoes?: string;
        blindCount?: boolean;
        responsavelId?: string;
        programadoPara?: string;
      }
    | null;

  if (!payload) {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const tipo = payload.tipo === "GERAL" ? "GERAL" : "CICLICO";
  const depositanteId = auth.user.depositanteId ?? String(payload.depositanteId ?? "").trim();
  const programadoPara = String(payload.programadoPara ?? "").trim();

  if (!depositanteId) {
    return Response.json({ error: "Selecione um depositante válido." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  if (!programadoPara) {
    return Response.json({ error: "Informe a data e hora programadas." }, { status: 400 });
  }

  const responsavelId = payload.responsavelId ? String(payload.responsavelId).trim() : undefined;
  const startImmediately = new Date(programadoPara).getTime() <= Date.now() + IMMEDIATE_START_THRESHOLD_MS;

  try {
    if (tipo === "GERAL") {
      if (startImmediately) {
        const result = await openGeneralInventory({ depositanteId, userId: auth.user.id });
        return Response.json({
          message: "Inventário geral iniciado.",
          result: { id: result?.id, type: "GERAL" as const },
        });
      }

      const result = await scheduleGeneralInventory({
        depositanteId,
        userId: auth.user.id,
        programadoPara,
        responsavelId,
      });
      return Response.json({ message: "Inventário geral programado com sucesso.", result: { ...result, type: "GERAL" } });
    }

    const titulo = String(payload.titulo ?? "").trim() || `Contagem cíclica — ${new Date(programadoPara).toLocaleDateString("pt-BR")}`;
    const area = String(payload.area ?? "").trim() || undefined;
    const skuId = payload.skuId ? String(payload.skuId).trim() : undefined;
    const observacoes = String(payload.observacoes ?? "").trim();
    const blindCount = Boolean(payload.blindCount);

    if (startImmediately) {
      const result = await createCycleCount({
        userId: auth.user.id,
        depositanteId,
        area,
        skuId,
        titulo,
        observacoes,
        blindCount,
      });
      return Response.json({ message: "Contagem cíclica iniciada.", result: { ...result, type: "CICLICO" as const } });
    }

    const result = await scheduleCycleCount({
      userId: auth.user.id,
      depositanteId,
      area,
      skuId,
      titulo,
      observacoes,
      blindCount,
      programadoPara,
      responsavelId,
    });

    return Response.json({ message: "Contagem cíclica programada com sucesso.", result: { ...result, type: "CICLICO" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao programar o inventário." },
      { status: 400 },
    );
  }
}
