import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { listStockBalancesFromDb } from "@/lib/stock";
import { canManagePortalStock } from "@/lib/portal-integration-access";

export async function GET() {
  const auth = await requireApiRoleAccess(["DEPOSITANTE"]);
  if (auth.response) return auth.response;

  if (!canManagePortalStock(auth.user)) {
    return NextResponse.json(
      { error: "Seu perfil não tem permissão para exportar o estoque." },
      { status: 403 },
    );
  }

  const depositanteId = auth.user.depositanteId;
  if (!depositanteId) {
    return NextResponse.json({ error: "Depositante não identificado." }, { status: 403 });
  }

  const balances = await listStockBalancesFromDb({ depositanteId });
  const products = new Map<string, { nome: string; sku: string; quantidade: number }>();

  for (const balance of balances) {
    const current = products.get(balance.productId) ?? {
      nome: balance.productName || "Produto sem nome",
      sku: balance.sku || "",
      quantidade: 0,
    };
    current.quantidade += Number(balance.rawAvailable ?? 0);
    products.set(balance.productId, current);
  }

  const rows = [...products.values()]
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    .map((product) => [product.nome, product.sku, product.quantidade]);
  const csv = [
    ["Nome do produto", "SKU", "Quantidade"],
    ...rows,
  ]
    .map((row) => row.map(escapeCsv).join(";"))
    .join("\r\n");
  const fileDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="estoque-atual-${fileDate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function escapeCsv(value: string | number) {
  const normalized = String(value).replace(/"/g, '""');
  return /[;"\r\n]/.test(normalized) ? `"${normalized}"` : normalized;
}
