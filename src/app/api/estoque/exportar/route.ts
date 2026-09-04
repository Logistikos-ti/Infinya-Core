import { requireApiModuleAccess } from "@/lib/api-auth";
import { listStockBalancesFromDb, type StockBalance } from "@/lib/stock";
import { buildCsv, buildPdf, buildXlsx, type StockExportRow } from "@/lib/estoque-export";

function faixaStatus(qtd: number, min: number): "critico" | "baixo" | "ideal" {
  if (qtd < min / 2) return "critico";
  if (qtd < min) return "baixo";
  return "ideal";
}

const FAIXA_LABEL: Record<string, string> = {
  ideal: "Dentro da faixa ideal",
  baixo: "Abaixo do mínimo",
  critico: "Ruptura crítica",
};

export async function GET(request: Request) {
  const auth = await requireApiModuleAccess("estoque");

  if (auth.response) {
    return auth.response;
  }

  const url = new URL(request.url);
  const escopo = (url.searchParams.get("escopo") || "all").toLowerCase();
  const formato = (url.searchParams.get("formato") || "csv").toLowerCase();

  const depositanteScope = auth.user.papel === "DEPOSITANTE" ? auth.user.depositanteId ?? undefined : undefined;

  let balances: StockBalance[];
  try {
    balances = await listStockBalancesFromDb({ depositanteId: depositanteScope });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar o estoque para exportação." },
      { status: 500 },
    );
  }

  const porProduto = new Map<
    string,
    { sku: string; nome: string; categoria: string; depositante: string; qtd: number; reservado: number; min: number; ativo: boolean; enderecos: Set<string> }
  >();

  for (const b of balances) {
    const entry = porProduto.get(b.productId) ?? {
      sku: b.sku,
      nome: b.productName,
      categoria: b.categoria || "Geral",
      depositante: b.depositante,
      qtd: 0,
      reservado: 0,
      min: b.minQuantity ?? 0,
      ativo: b.ativo ?? true,
      enderecos: new Set<string>(),
    };
    entry.qtd += b.rawQuantidade;
    entry.reservado += b.rawReserved;
    if (b.endereco && b.endereco !== "Sem endereço") entry.enderecos.add(b.endereco);
    porProduto.set(b.productId, entry);
  }

  const rows: StockExportRow[] = Array.from(porProduto.values())
    .filter((p) => {
      if (escopo === "all") return true;
      return faixaStatus(p.qtd, p.min) === escopo;
    })
    .map((p) => ({
      sku: p.sku,
      nome: p.nome,
      categoria: p.categoria,
      depositante: p.depositante,
      estoque: p.qtd,
      reservado: p.reservado,
      disponivel: p.qtd - p.reservado,
      enderecos: p.enderecos.size ? Array.from(p.enderecos).join(", ") : "—",
      status: p.ativo ? "Ativo" : "Inativo",
      faixa: FAIXA_LABEL[faixaStatus(p.qtd, p.min)],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `estoque-${stamp}`;

  try {
    if (formato === "xlsx") {
      return binary(buildXlsx(rows), `${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    if (formato === "pdf") {
      const pdf = await buildPdf(rows, `Estoque · ${stamp}`);
      return binary(pdf, `${base}.pdf`, "application/pdf");
    }
    return binary(buildCsv(rows), `${base}.csv`, "text/csv; charset=utf-8");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao gerar o arquivo de exportação." },
      { status: 500 },
    );
  }
}

function binary(content: Buffer, filename: string, type: string) {
  return new Response(new Uint8Array(content), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(content.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
