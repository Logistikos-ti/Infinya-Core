import { requireApiConfigSectionAccess } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

export async function GET() {
  const auth = await requireApiConfigSectionAccess("produtos");

  if (auth.response) {
    return auth.response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("produtos")
    .select(
      "id, depositante_id, codigo_interno, codigo_externo, sku, nome, categoria, metodo_retirada, unidade_estocagem, quantidade_por_embalagem, exige_lote, exige_validade, ativo, created_at, depositante:depositantes(nome)",
    )
    .order("nome");

  if (error) {
    return Response.json(
      { error: `Não foi possível listar os produtos: ${error.message}` },
      { status: 500 },
    );
  }

  const allowedDepositanteIds = new Set(
    filterDepositanteOptionsByUser(
      auth.user,
      (data ?? [])
        .map((item) => ({
          id: item.depositante_id,
          nome:
            ((item.depositante as { nome?: string } | null) ?? null)?.nome ??
            "",
        }))
        .filter((item): item is { id: string; nome: string } => Boolean(item.id)),
    ).map((item) => item.id),
  );

  const products =
    allowedDepositanteIds.size > 0
      ? (data ?? []).filter((item) => allowedDepositanteIds.has(item.depositante_id))
      : (data ?? []);

  return Response.json({
    products,
  });
}
