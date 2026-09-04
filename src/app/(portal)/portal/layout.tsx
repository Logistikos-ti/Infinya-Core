import { redirect } from "next/navigation";
import { PortalChrome } from "@/components/portal/portal-chrome";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOwnOperationMode } from "@/lib/brand";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // Modo operação própria não tem depositante-cliente: o portal (interface do
  // cliente terceiro) não se aplica.
  if (isOwnOperationMode()) {
    redirect("/dashboard");
  }

  const user = await requireRoleAccess(["DEPOSITANTE", "ADMIN", "TI"]);
  const canPreviewPortals = user.papel === "ADMIN" || user.papel === "TI";
  const { data: depositantes } = canPreviewPortals
    ? await createSupabaseAdminClient()
        .from("depositantes")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome")
    : { data: [] };

  return (
    <PortalChrome
      user={user}
      masterDepositantes={(depositantes ?? []).map((depositante) => ({
        id: depositante.id,
        nome: depositante.nome,
      }))}
    >
      {children}
    </PortalChrome>
  );
}
