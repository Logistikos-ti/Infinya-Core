import { NextResponse } from "next/server";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  parseAddressSpreadsheet,
  type ImportedAddressRow,
} from "@/lib/address-import";

const allowedSpreadsheetMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
]);

export async function POST(request: Request) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);

  if (auth.response) {
    return auth.response;
  }

  const formData = await request.formData();
  const file = formData.get("arquivo");

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

  let rows: ImportedAddressRow[] = [];

  try {
    rows = await parseAddressSpreadsheet(file);
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
      { error: "Nenhum endereço operável foi encontrado na planilha." },
      { status: 400 },
    );
  }

  const dedupedMap = new Map<string, ImportedAddressRow>();
  rows.forEach((row) => {
    dedupedMap.set(row.codigo, row);
  });

  const dedupedRows = [...dedupedMap.values()];
  const codes = dedupedRows.map((row) => row.codigo);
  const adminSupabase = createSupabaseAdminClient();

  const { data: existingAddresses, error: existingAddressesError } = await adminSupabase
    .from("enderecos")
    .select("codigo")
    .in("codigo", codes);

  if (existingAddressesError) {
    return NextResponse.json(
      { error: `Não foi possível validar os endereços existentes: ${existingAddressesError.message}` },
      { status: 500 },
    );
  }

  const existingCodes = new Set((existingAddresses ?? []).map((item) => item.codigo));
  const payload = dedupedRows.map((row) => ({
    codigo: row.codigo,
    descricao: row.descricao,
    area: row.area,
    rua: row.rua,
    modulo: row.modulo,
    nivel: row.nivel,
    posicao: row.posicao,
    capacidade_maxima: row.capacidadeMaxima,
    unidade_padrao: row.unidadePadrao,
    ativo: row.ativo,
  }));

  const chunkSize = 200;

  for (let index = 0; index < payload.length; index += chunkSize) {
    const chunk = payload.slice(index, index + chunkSize);
    const { error } = await adminSupabase.from("enderecos").upsert(chunk, { onConflict: "codigo" });

    if (error) {
      return NextResponse.json(
        { error: `Falha ao importar os endereços: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message: "Importação do endereçamento concluída.",
    summary: {
      enderecosProcessados: dedupedRows.length,
      enderecosCriados: dedupedRows.length - existingCodes.size,
      enderecosAtualizados: existingCodes.size,
    },
  });
}
