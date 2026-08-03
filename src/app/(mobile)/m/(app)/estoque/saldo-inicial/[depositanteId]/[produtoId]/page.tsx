import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { MobileInitialStockPanel } from "./mobile-initial-stock-panel";

export default async function MobileSaldoInicialFlowPage({
  params,
}: {
  params: Promise<{ depositanteId: string; produtoId: string }>;
}) {
  const { depositanteId, produtoId } = await params;
  const user = await getCurrentUserContext();

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: depositanteRow } = await adminSupabase
    .from("depositantes")
    .select("id, nome")
    .eq("id", depositanteId)
    .eq("ativo", true)
    .maybeSingle();

  if (!depositanteRow || !filterDepositanteOptionsByUser(user, [depositanteRow]).length) {
    notFound();
  }

  const { data: produtoRow } = await adminSupabase
    .from("produtos")
    .select("id, nome, sku, codigo_externo, codigo_interno, imagem_principal_url, exige_lote, exige_validade")
    .eq("id", produtoId)
    .eq("depositante_id", depositanteId)
    .eq("ativo", true)
    .maybeSingle();

  if (!produtoRow) {
    notFound();
  }

  const { data: enderecosRows } = await adminSupabase
    .from("enderecos")
    .select("id, codigo, area")
    .eq("ativo", true)
    .order("codigo");

  return (
    <MobileInitialStockPanel
      depositanteId={depositanteId}
      depositanteNome={depositanteRow.nome}
      produtoNome={produtoRow.nome}
      produtoSku={produtoRow.sku ?? "Sem SKU"}
      produtoBarcode={produtoRow.codigo_externo ?? null}
      produtoCodigoInterno={produtoRow.codigo_interno ?? null}
      produtoImagemUrl={produtoRow.imagem_principal_url ?? null}
      exigeLote={Boolean(produtoRow.exige_lote)}
      exigeValidade={Boolean(produtoRow.exige_validade)}
      enderecos={(enderecosRows ?? []).map((row) => ({ id: row.id, codigo: row.codigo, area: row.area }))}
    />
  );
}
