"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppUserContext } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getRoleLabel } from "@/lib/permissions";

type AppChromeProps = {
  children: ReactNode;
  user: AppUserContext;
};

export function AppChrome({ children, user }: AppChromeProps) {
  const pathname = usePathname();
  const currentPath = pathname || "/dashboard";
  const mobileTitle = getMobileSectionTitle(currentPath);

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-950">
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <AppSidebar user={user} currentPath={currentPath} />
        </div>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6 xl:px-8">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">Infinya Core</p>
                <h1 className="hidden text-lg font-semibold text-slate-950 sm:block">
                  Operação, estoque e expedição no mesmo lugar
                </h1>
                <h1 className="text-lg font-semibold text-slate-950 sm:hidden">{mobileTitle}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Sessão ativa: {user.nome} ({getRoleLabel(user.papel)})
                </p>
              </div>

              <div className="shrink-0">
                <LogoutButton />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-6 lg:pb-6 xl:px-8">
            {children}
          </main>
        </div>
      </div>

      <AppMobileNav currentPath={currentPath} user={user} />
    </div>
  );
}

function getMobileSectionTitle(pathname: string) {
  if (pathname.startsWith("/expedicao/separacao")) {
    return "Separação";
  }

  if (pathname.startsWith("/expedicao/conferencia")) {
    return "Conferência";
  }

  if (pathname.startsWith("/recebimento")) {
    return "Recebimento";
  }

  if (pathname.startsWith("/estoque")) {
    return "Estoque";
  }

  if (pathname.startsWith("/romaneio")) {
    return "Romaneio";
  }

  if (pathname.startsWith("/nfe")) {
    return "NF-e";
  }

  if (pathname.startsWith("/configuracoes")) {
    return "Configurações";
  }

  if (pathname.startsWith("/relatorios")) {
    return "Relatórios";
  }

  return "Dashboard";
}
