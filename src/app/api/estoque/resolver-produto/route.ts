import { ensureUserCanAccessDepositante, requireApiModuleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RelationName =
  | { codigo?: string }
  | Array<{ codigo?: string }>
  | null;

function extractCodigo(value: RelationName) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.codigo ?? "";
}

// Same equality-only .or() lookup pattern already used by registerInitialStock
// (src/lib/stock-initial.ts) for resolving a produto by whatever code the
// operator bipped -- kept local instead of imported since that helper isn't
// exported and this route's needs (no lote/validade) are simpler.
function escapeSupabaseValue(value: string) {
  return value.replaceAll(",", "\\,");
}

/**
 * Resolves a scanned barcode to the matching estoque row(s) for Entrada
 * Manual / Saída Manual, replacing the old "pick from the product list"
 * step -- the operator now bips the product right after choosing the
 * depositante, and this endpoint figures out which saldo(s) that
 * corresponds to. A product stored in a single location resolves
 * straight to one estoqueId; a product split across multiple locations
 * comes back as several matches so the client can show a short chooser
 * (only for that product, not the full catalog).
 */
export async function POST(request: Request) {
  const auth = await requireApiModuleAccess("estoque");
  if (auth.response) return auth.response;

  const payload = (await request.json().catch(() => null)) as {
    depositanteId?: string;
    barcode?: string;
    mode?: "entrada" | "saida";
  } | null;

  const depositanteId = String(payload?.depositanteId ?? "").trim();
  const barcode = String(payload?.barcode ?? "").trim();
  const mode = payload?.mode === "entrada" ? "entrada" : "saida";

  if (!depositanteId || !barcode) {
    return Response.json({ error: "Informe o depositante e o código bipado." }, { status: 400 });
  }

  const scopeError = ensureUserCanAccessDepositante(auth.user, depositanteId);
  if (scopeError) return scopeError;

  const admin = createSupabaseAdminClient();

  const { data: produtos, error: produtoError } = await admin
    .from("produtos")
    .select("id, nome, sku, codigo_externo, codigo_interno, imagem_principal_url")
    .eq("depositante_id", depositanteId)
    .eq("ativo", true)
    .or(
      [
        `codigo_externo.eq.${escapeSupabaseValue(barcode)}`,
        `codigo_interno.eq.${escapeSupabaseValue(barcode)}`,
        `sku.eq.${escapeSupabaseValue(barcode)}`,
      ].join(","),
    )
    .limit(2);

  if (produtoError) {
    return Response.json({ error: "Falha ao localizar o produto." }, { status: 500 });
  }

  if (!produtos?.length) {
    return Response.json({ error: "Produto não encontrado neste depositante." }, { status: 404 });
  }

  if (produtos.length > 1) {
    return Response.json(
      { error: "Mais de um produto corresponde a este código. Revise o cadastro." },
      { status: 409 },
    );
  }

  const produto = produtos[0];

  const { data: estoqueRows, error: estoqueError } = await admin
    .from("estoque")
    .select("id, quantidade, quantidade_reservada, bloqueado, endereco:enderecos(codigo)")
    .eq("depositante_id", depositanteId)
    .eq("produto_id", produto.id)
    .eq("bloqueado", false);

  if (estoqueError) {
    return Response.json({ error: "Falha ao consultar o saldo do produto." }, { status: 500 });
  }

  const matches = (estoqueRows ?? [])
    .map((row) => ({
      estoqueId: row.id,
      enderecoCodigo: extractCodigo(row.endereco) || "Sem endereço",
      quantidade: Number(row.quantidade ?? 0),
      disponivel: Number(row.quantidade ?? 0) - Number(row.quantidade_reservada ?? 0),
    }))
    // Saída só pode baixar de saldos com disponível > 0; entrada pode
    // lançar em qualquer saldo já cadastrado, mesmo zerado.
    .filter((row) => (mode === "saida" ? row.disponivel > 0 : true));

  if (!matches.length) {
    return Response.json(
      {
        error:
          mode === "saida"
            ? "Produto sem saldo disponível para saída neste depositante."
            : "Produto sem saldo cadastrado neste depositante.",
      },
      { status: 404 },
    );
  }

  return Response.json({
    produto: {
      nome: produto.nome,
      sku: produto.sku,
      barcode: produto.codigo_externo,
      codigoInterno: produto.codigo_interno,
      imagemUrl: produto.imagem_principal_url,
    },
    matches,
  });
}
