import { NextResponse } from "next/server";
import { requireApiConfigSectionAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  detectDepositanteFromRows,
  parseProductSpreadsheet,
  type ImportedProductRow,
} from "@/lib/product-import";

const allowedSpreadsheetMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
]);

export async function POST(request: Request) {
  const auth = await requireApiConfigSectionAccess("produtos");

  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const file = formData.get("arquivo");
  const selectedDepositanteId = String(formData.get("depositanteId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione uma planilha para importar." }, { status: 400 });
  }

  if (!file.name) {
    return NextResponse.json({ error: "A planilha precisa ter um nome válido." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "A planilha enviada está vazia." }, { status: 400 });
  }

  if (!allowedSpreadsheetMimeTypes.has(file.type) && !/\.(xlsx|csv)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie uma planilha .xlsx ou .csv." },
      { status: 400 },
    );
  }

  let rows: ImportedProductRow[] = [];

  try {
    rows = await parseProductSpreadsheet(file);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível ler a planilha enviada.",
      },
      { status: 400 },
    );
  }

  if (!rows.length) {
    return NextResponse.json(
      { error: "Nenhum produto válido foi encontrado na planilha." },
      { status: 400 },
    );
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositantes, error: depositantesError } = await adminSupabase
    .from("depositantes")
    .select("id, codigo, nome")
    .order("nome");

  if (depositantesError) {
    return NextResponse.json(
      { error: `Não foi possível carregar os depositantes: ${depositantesError.message}` },
      { status: 500 },
    );
  }

  const targetDepositante = selectedDepositanteId
    ? depositantes?.find((item) => item.id === selectedDepositanteId) ?? null
    : detectDepositanteFromRows(rows, depositantes ?? []);

  if (!targetDepositante) {
    return NextResponse.json(
      {
        error:
          "Não foi possível identificar o depositante da planilha. Selecione o depositante manualmente e tente novamente.",
      },
      { status: 400 },
    );
  }

  const dedupedMap = new Map<string, ImportedProductRow>();

  rows.forEach((row) => {
    dedupedMap.set(row.codigoInterno, row);
  });

  const dedupedRows = [...dedupedMap.values()];
  const internalCodes = dedupedRows.map((row) => row.codigoInterno);

  const { data: existingProducts, error: existingProductsError } = await adminSupabase
    .from("produtos")
    .select("codigo_interno")
    .eq("depositante_id", targetDepositante.id)
    .in("codigo_interno", internalCodes);

  if (existingProductsError) {
    return NextResponse.json(
      { error: `Não foi possível validar os produtos existentes: ${existingProductsError.message}` },
      { status: 500 },
    );
  }

  const existingCodes = new Set((existingProducts ?? []).map((item) => item.codigo_interno));

  const payload = dedupedRows.map((row) => ({
    depositante_id: targetDepositante.id,
    codigo_interno: row.codigoInterno,
    codigo_externo: row.codigoExterno,
    sku: row.codigoInterno,
    nome: row.nome,
    descricao: row.descricao,
    categoria: row.categoria,
    metodo_retirada: row.metodoRetirada,
    unidade_estocagem: row.unidadeEstocagem,
    exige_lote: false,
    exige_validade: false,
    ativo: true,
  }));

  const chunkSize = 50;

  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    const { error } = await adminSupabase
      .from("produtos")
      .upsert(chunk, { onConflict: "depositante_id,codigo_interno" });

    if (error) {
      return NextResponse.json(
        { error: `Falha ao importar os produtos: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message: `Importação concluída para ${targetDepositante.nome}.`,
    summary: {
      depositante: targetDepositante.nome,
      linhasLidas: rows.length,
      produtosProcessados: dedupedRows.length,
      produtosCriados: dedupedRows.length - existingCodes.size,
      produtosAtualizados: existingCodes.size,
    },
  });
}
