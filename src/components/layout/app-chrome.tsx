"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PackageSearch, Search, Settings2, Users, Warehouse } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { FirstAccessPasswordDialog } from "@/components/layout/first-access-password-dialog";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { isAdminUser, isProductCatalogOnlyUser } from "@/lib/permissions";

type AppChromeProps = {
  children: ReactNode;
  user: AppUserContext;
};

export function AppChrome({ children, user }: AppChromeProps) {
  const pathname = usePathname();
  const currentPath = pathname || "/dashboard";
  const showAdminMobileShortcuts = isAdminUser(user);
  const isCatalogOnly = isProductCatalogOnlyUser(user);

  return (
    <div className="theme-transition flex h-screen h-[100dvh] w-full overflow-hidden bg-[linear-gradient(180deg,#040816_0%,#050b19_60%,#071120_100%)] text-zinc-100 lg:bg-[linear-gradient(180deg,#eef4ff_0%,#f7fbff_55%,#ffffff_100%)] lg:text-slate-900 dark:bg-[linear-gradient(180deg,#040816_0%,#050b19_60%,#071120_100%)] dark:text-zinc-100">
      
      {/* Background Decoration */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-primary-500/14 blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[30%] w-[30%] rounded-full bg-accent-500/14 blur-[120px]"></div>
      </div>

      {/* Sidebar - Hidden on mobile, block on lg */}
      <div className="hidden lg:block z-10">
        <AppSidebar user={user} currentPath={currentPath} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="z-10 flex h-24 flex-shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-8 lg:border-none lg:border-slate-200/80 dark:border-white/10">
          <div className="flex w-full max-w-3xl items-center gap-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={isCatalogOnly ? "Buscar produtos..." : "Buscar pedidos, produtos..."} 
                className="w-full rounded-full border border-white/10 bg-[#071120]/70 py-2 pl-10 pr-4 text-sm text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50 lg:border-slate-200/80 lg:bg-white/70 lg:text-slate-900 dark:border-white/10 dark:bg-[#071120]/70 dark:text-white"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            {/* O ThemeToggle ficava aqui e foi movido para o fixed bottom */}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-24 lg:pb-12 z-10 scroll-smooth">
          {showAdminMobileShortcuts ? (
            <section className="mb-4 lg:hidden">
              <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-2">
                  <MobileAdminShortcut
                    href="/configuracoes"
                    label="Configurações"
                    active={currentPath === "/configuracoes"}
                    icon={<Settings2 className="h-4 w-4" />}
                  />
                  <MobileAdminShortcut
                    href="/configuracoes/produtos"
                    label="Produtos"
                    active={currentPath.startsWith("/configuracoes/produtos")}
                    icon={<PackageSearch className="h-4 w-4" />}
                  />
                  <MobileAdminShortcut
                    href="/configuracoes/depositantes"
                    label="Depositantes"
                    active={currentPath.startsWith("/configuracoes/depositantes")}
                    icon={<Warehouse className="h-4 w-4" />}
                  />
                  <MobileAdminShortcut
                    href="/configuracoes/usuarios"
                    label="Usuários"
                    active={currentPath.startsWith("/configuracoes/usuarios")}
                    icon={<Users className="h-4 w-4" />}
                  />
                </div>
              </div>
            </section>
          ) : null}
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
         <AppMobileNav currentPath={currentPath} user={user} />
      </div>

      {/* Floating Theme Toggle no canto inferior direito */}
      <div className="fixed bottom-6 right-6 z-[100] hidden lg:block">
        <div className="rounded-full bg-infinya-gradient p-[2px] shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all hover:-translate-y-1">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-full overflow-hidden">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <FirstAccessPasswordDialog isVisible={user.forcePasswordReset} userName={user.nome} />
    </div>
  );
}

function MobileAdminShortcut({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
        active
          ? "border-cyan-300/30 bg-cyan-400/12 text-cyan-700 shadow-[0_0_18px_rgba(34,211,238,0.14)] dark:text-cyan-300"
          : "border-white/10 bg-[#071120]/80 text-slate-200 lg:border-slate-200/80 lg:bg-white/80 lg:text-slate-700 dark:border-white/10 dark:bg-[#071120]/80 dark:text-slate-200",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
