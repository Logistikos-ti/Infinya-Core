import type { ReactNode } from "react";
import { requireUserContext } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppSidebar } from "@/components/layout/app-sidebar";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const user = await requireUserContext();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1720px] lg:grid-cols-[280px_1fr]">
        <AppSidebar user={user} />
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-slate-500">Infinya Core</p>
                <h1 className="text-lg font-semibold text-slate-950">
                  Operação, estoque e expedição no mesmo lugar
                </h1>
                <p className="text-sm text-slate-500">
                  Sessão ativa: {user.nome} ({user.papel})
                </p>
              </div>
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
