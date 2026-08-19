import type { ReactNode } from "react";
import { requireUserContext } from "@/lib/auth";
import { AppChrome } from "@/components/layout/app-chrome";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const user = await requireUserContext();
  const openTicketsCount = user.papel === "DEPOSITANTE" ? 0 : await getOpenTicketsCount();

  return <AppChrome user={user} openTicketsCount={openTicketsCount}>{children}</AppChrome>;
}

// AppShell wraps every single authenticated page, so this query runs on
// every request. It must never be able to hold up the whole app: a sidebar
// badge isn't worth blocking the entire WMS if the query is ever slow, or
// the table/connection is unavailable for any reason. Fails silently to 0
// (no badge shown) instead of letting the page hang or error out.
async function getOpenTicketsCount() {
  try {
    const admin = createSupabaseAdminClient();
    const query = admin
      .from("suporte_chamados")
      .select("id", { count: "exact", head: true })
      .not("status", "eq", "Resolvido");

    const { count } = await withTimeout(query, 3000);
    return count ?? 0;
  } catch {
    return 0;
  }
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out")), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
