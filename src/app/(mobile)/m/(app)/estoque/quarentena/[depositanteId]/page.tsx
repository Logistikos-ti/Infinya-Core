import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { QuarentenaScanClient } from "./quarentena-scan-client";

export default async function MobileQuarentenaProdutosPage({
  params,
}: {
  params: Promise<{ depositanteId: string }>;
}) {
  const { depositanteId } = await params;
  const adminSupabase = createSupabaseAdminClient();

  const [user, { data: depositanteRow }] = await Promise.all([
    getCurrentUserContext(),
    adminSupabase
      .from("depositantes")
      .select("id, nome")
      .eq("id", depositanteId)
      .eq("ativo", true)
      .maybeSingle(),
  ]);

  if (!user || !user.ativo) {
    redirect("/m/login");
  }

  if (!canAccessModule(user, "estoque")) {
    redirect("/m/inicio");
  }

  if (!depositanteRow || !filterDepositanteOptionsByUser(user, [depositanteRow]).length) {
    notFound();
  }

  return <QuarentenaScanClient depositanteId={depositanteId} depositanteNome={depositanteRow.nome} />;
}
