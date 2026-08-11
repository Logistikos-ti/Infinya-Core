import { notFound, redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { GeneralInventoryClient } from "./general-inventory-client";

export default async function MobileGeneralInventoryPage({ params }: { params: Promise<{ depositanteId: string }> }) {
  const { depositanteId } = await params;
  const user = await getCurrentUserContext();
  if (!user || !user.ativo) redirect("/m/login");
  if (!canAccessModule(user, "estoque")) redirect("/m/inicio");

  const supabase = createSupabaseAdminClient();
  const { data: depositante } = await supabase.from("depositantes").select("id, nome").eq("id", depositanteId).eq("ativo", true).maybeSingle();
  if (!depositante || !filterDepositanteOptionsByUser(user, [depositante]).length) notFound();

  return <GeneralInventoryClient depositanteId={depositanteId} depositanteNome={depositante.nome} />;
}
