import { NextResponse } from "next/server";
import { requireApiUser, ensureUserCanAccessDepositante, isScopedDepositanteUser } from "@/lib/api-auth";
import { canAccessModule } from "@/lib/permissions";
import { getAccessDeniedErrorMessage } from "@/lib/auth";
import { buildRelatorioFaturaData } from "@/lib/relatorio-fatura";
import { renderRelatorioFaturaHtml } from "@/lib/relatorio-fatura-html";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const data = await buildRelatorioFaturaData(id);
  if (!data) {
    return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
  }

  // Usuários do módulo financeiro (admin/TI) veem qualquer fatura; um
  // depositante do portal só pode ver a fatura do próprio depositante —
  // mesmo padrão de exceção usado em requireApiShippingDocumentAccess.
  if (!canAccessModule(auth.user, "financeiro")) {
    if (!isScopedDepositanteUser(auth.user)) {
      return NextResponse.json({ error: getAccessDeniedErrorMessage("financeiro") }, { status: 403 });
    }
    const denied = ensureUserCanAccessDepositante(auth.user, data.depositanteId);
    if (denied) return denied;
  }

  const html = renderRelatorioFaturaHtml(data);
  const fileName = `Fechamento-Infinoos-WMS-${data.cliente.replace(/[^\w-]+/g, "-")}-${data.periodoRef.replace("/", "-")}.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
