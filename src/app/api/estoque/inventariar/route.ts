import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createCycleCount } from "@/lib/stock-cycle-counts";

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        skuId?: string;
        titulo?: string;
        observacoes?: string;
        blindCount?: boolean;
        depositanteId?: string;
      }
    | null;

  if (!payload || !payload.skuId) {
    return Response.json({ error: "Faltam dados obrigatórios para criar contagem." }, { status: 400 });
  }

  const skuId = String(payload.skuId).trim();
  const titulo = payload.titulo?.trim() || `Contagem pontual (SKU)`;
  const observacoes = payload.observacoes?.trim() || "";
  const blindCount = Boolean(payload.blindCount);
  const depositanteId = auth.user.depositanteId ?? String(payload.depositanteId ?? "").trim();

  const depositanteAccess = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (depositanteAccess.error) {
    return Response.json({ error: depositanteAccess.error }, { status: 403 });
  }

  try {
    const result = await createCycleCount({
      userId: auth.user.id,
      depositanteId,
      skuId,
      titulo,
      observacoes,
      blindCount,
    });

    return Response.json({ message: "Contagem criada com sucesso", id: result.id });
  } catch (error: any) {
    console.error("Erro na criação de contagem:", error);
    return Response.json({ error: error.message || "Falha interna ao criar contagem." }, { status: 500 });
  }
}
