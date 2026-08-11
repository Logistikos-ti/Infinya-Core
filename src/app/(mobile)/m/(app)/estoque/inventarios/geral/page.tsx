import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { GeneralInventoryDepositantListClient } from "./general-inventory-depositant-list-client";

export default async function MobileGeneralInventoryDepositantsPage() {
  const user = await getCurrentUserContext();
  if (!user || !user.ativo) redirect("/m/login");
  if (!canAccessModule(user, "estoque")) redirect("/m/inicio");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("depositantes").select("id, nome, codigo, logo_url").eq("ativo", true).order("nome");
  const depositantes = filterDepositanteOptionsByUser(user, data ?? []).map((item) => ({
    id: item.id,
    nome: item.nome,
    codigo: item.codigo,
    logoUrl: item.logo_url ?? null,
  }));

  return <GeneralInventoryDepositantListClient depositantes={depositantes} />;
}
