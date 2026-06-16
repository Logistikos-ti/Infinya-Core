import type { ReactNode } from "react";
import { requireUserContext } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getRoleLabel } from "@/lib/permissions";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const user = await requireUserContext();

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-950">
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_minmax(0,1fr)]">
        <AppSidebar user={user} />
        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur xl:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium text-slate-500">Infinya Core</p>
                <h1 className="text-lg font-semibold text-slate-950">
                  Operação, estoque e expedição no mesmo lugar
                </h1>
                <p className="text-sm text-slate-500">
                  Sessão ativa: {user.nome} ({getRoleLabel(user.papel)})
                </p>
              </div>
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 min-w-0 px-6 py-6 xl:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
