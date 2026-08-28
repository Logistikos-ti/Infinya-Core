import { requireApiRoleAccess } from "@/lib/api-auth";
import { registrarLancamentoQuarentena } from "@/lib/billing";
import {
  recordStockQuarantineDecision,
  resolveStockQuarantine,
} from "@/lib/stock-quarantine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type QuarantineAction = "decide_donate" | "decide_discard" | "confirm";

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI", "OPERADOR", "DEPOSITANTE"]);

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as
    | { action?: QuarantineAction; observations?: string; actingDepositanteId?: string }
    | null;

  if (
    payload?.action !== "decide_donate" &&
    payload?.action !== "decide_discard" &&
    payload?.action !== "confirm"
  ) {
    return Response.json({ error: "Ação inválida para quarentena." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: quarantine, error: quarantineError } = await supabase
    .from("estoque_quarentena")
    .select("id, depositante_id, status, decisao_depositante, decisao_observacoes, tipo")
    .eq("id", id)
    .maybeSingle();

  if (
    quarantineError?.code === "42703" ||
    quarantineError?.message.includes("decisao_depositante")
  ) {
    return Response.json(
      { error: "A atualização do fluxo de quarentena ainda não foi aplicada ao banco de dados." },
      { status: 503 },
    );
  }

  if (quarantineError || !quarantine) {
    return Response.json({ error: "Quarentena não encontrada." }, { status: 404 });
  }

  try {
    if (payload.action === "decide_donate" || payload.action === "decide_discard") {
      const isPortalManager =
        auth.user.papel === "DEPOSITANTE" &&
        auth.user.portalProfile === "GESTOR" &&
        auth.user.depositanteId === quarantine.depositante_id;
      const isMasterActingForDepositante =
        (auth.user.papel === "ADMIN" || auth.user.papel === "TI") &&
        payload.actingDepositanteId === quarantine.depositante_id;

      if (!isPortalManager && !isMasterActingForDepositante) {
        return Response.json(
          { error: "Seu perfil não pode decidir esta quarentena." },
          { status: 403 },
        );
      }

      const decision = payload.action === "decide_donate" ? "DOAR" : "DESCARTAR";
      await recordStockQuarantineDecision({
        quarantineId: id,
        decision,
        userId: auth.user.id,
        observations: payload.observations,
      });

      const isVencimento = String(quarantine.tipo ?? "").trim().toUpperCase() === "VENCIMENTO";
      return Response.json({
        message:
          decision === "DOAR"
            ? isVencimento
              ? "Retirada autorizada. Aguardando confirmação do operador logístico."
              : "Doação/liberação autorizada. Aguardando confirmação do operador logístico."
            : "Descarte autorizado. Aguardando confirmação do operador logístico.",
      });
    }

    if (auth.user.papel === "DEPOSITANTE") {
      return Response.json(
        { error: "A confirmação física deve ser realizada pelo operador logístico." },
        { status: 403 },
      );
    }

    if (
      quarantine.decisao_depositante !== "DOAR" &&
      quarantine.decisao_depositante !== "DESCARTAR"
    ) {
      return Response.json(
        { error: "O depositante ainda não decidiu o destino desta quarentena." },
        { status: 409 },
      );
    }

    await resolveStockQuarantine({
      quarantineId: id,
      action: quarantine.decisao_depositante === "DOAR" ? "donate" : "discard",
      userId: auth.user.id,
      observations: payload.observations || quarantine.decisao_observacoes || undefined,
    });

    // Awaited (não fire-and-forget): route handler serverless pode congelar
    // após a resposta e descartar a inserção da cobrança. Erros na cobrança
    // não devem derrubar a confirmação da quarentena.
    await registrarLancamentoQuarentena(id).catch(() => {});

    return Response.json({
      message:
        quarantine.decisao_depositante === "DOAR"
          ? String(quarantine.tipo ?? "").trim().toUpperCase() === "VENCIMENTO"
            ? "Retirada confirmada pelo operador."
            : "Doação/liberação confirmada pelo operador."
          : "Descarte confirmado pelo operador.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar a quarentena." },
      { status: 400 },
    );
  }
}
