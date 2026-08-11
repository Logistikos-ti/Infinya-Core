import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { getGeneralInventory, openGeneralInventory } from "@/lib/general-inventories";

export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as { depositanteId?: string } | null;
  const depositanteId = auth.user.depositanteId ?? String(payload?.depositanteId ?? "").trim();
  if (!depositanteId) return Response.json({ error: "Selecione um depositante válido." }, { status: 400 });

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  try {
    const result = await openGeneralInventory({ depositanteId, userId: auth.user.id });
    return Response.json({ result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível abrir o inventário geral." },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: "Informe o inventário geral." }, { status: 400 });
  try {
    const result = await getGeneralInventory(id);
    if (!result) return Response.json({ error: "Inventário geral não encontrado." }, { status: 404 });
    const scopeError = ensureUserCanAccessDepositante(auth.user, result.depositanteId);
    if (scopeError) return scopeError;
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao carregar o inventário." }, { status: 400 });
  }
}
