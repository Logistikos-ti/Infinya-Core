import type { ReactNode } from "react";
import { requireUserContext } from "@/lib/auth";
import { AppChrome } from "@/components/layout/app-chrome";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const user = await requireUserContext();
  
  let openTicketsCount = 0;
  if (user.papel !== "DEPOSITANTE") {
    const admin = createSupabaseAdminClient();
    const { count } = await admin
      .from("suporte_chamados")
      .select("id", { count: "exact", head: true })
      .not("status", "eq", "Resolvido");
    openTicketsCount = count || 0;
  }

  return <AppChrome user={user} openTicketsCount={openTicketsCount}>{children}</AppChrome>;
}
