import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { completeCycleCount, createCycleCount } from "@/lib/stock-cycle-counts";

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        action?: string;
        depositanteId?: string;
        area?: string;
        titulo?: string;
        observacoes?: string;
        cycleCountId?: string;
      }
    | null;

  if (!payload) {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (payload.action === "concluir") {
    const cycleCountId = String(payload.cycleCountId ?? "").trim();

    if (!cycleCountId) {
      return Response.json({ error: "Contagem inválida para conclusão." }, { status: 400 });
    }

    try {
      await completeCycleCount(cycleCountId);
      return Response.json({ message: "Contagem concluída com sucesso." });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Falha ao concluir a contagem." },
        { status: 400 },
      );
    }
  }

  const depositanteId = auth.user.depositanteId ?? String(payload.depositanteId ?? "").trim();
  const title = String(payload.titulo ?? "").trim();
  const area = String(payload.area ?? "").trim();

  if (!depositanteId) {
    return Response.json({ error: "Selecione um depositante válido." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) {
    return scopeError;
  }

  if (!title) {
    return Response.json({ error: "Informe um título para a contagem." }, { status: 400 });
  }

  try {
    const result = await createCycleCount({
      userId: auth.user.id,
      depositanteId,
      area,
      titulo: title,
      observacoes: String(payload.observacoes ?? "").trim(),
    });

    return Response.json({
      message: "Contagem cíclica criada com sucesso.",
      result,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao criar a contagem." },
      { status: 400 },
    );
  }
}
