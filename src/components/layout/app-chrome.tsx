"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { InfinyaBrand } from "@/components/branding/infinya-brand";

type AppChromeProps = {
  children: ReactNode;
  user: AppUserContext;
};

export function AppChrome({ children, user }: AppChromeProps) {
  const pathname = usePathname();
  const currentPath = pathname || "/dashboard";

  return (
    <div className="theme-transition flex min-h-screen w-full overflow-hidden bg-[linear-gradient(180deg,#eef4ff_0%,#f7fbff_55%,#ffffff_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#040816_0%,#050b19_60%,#071120_100%)] dark:text-zinc-100">
      
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
        <header className="z-10 flex h-24 flex-shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-white/10 sm:px-8 lg:border-none">
          <div className="flex w-full max-w-3xl items-center gap-4">
            <div className="hidden xl:block">
              <InfinyaBrand compact subtitle="WMS de execução logística" subtitleClassName="text-slate-500 dark:text-slate-400" />
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar pedidos, produtos..." 
                className="w-full rounded-full border border-slate-200/80 bg-white/70 py-2 pl-10 pr-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50 dark:border-white/10 dark:bg-[#071120]/70"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            {/* O ThemeToggle ficava aqui e foi movido para o fixed bottom */}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-24 lg:pb-12 z-10 scroll-smooth">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
         <AppMobileNav currentPath={currentPath} user={user} />
      </div>

      {/* Floating Theme Toggle no canto inferior direito */}
      <div className="fixed bottom-6 right-6 z-[100]">
        <div className="rounded-full bg-infinya-gradient p-[2px] shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 transition-all hover:-translate-y-1">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-full overflow-hidden">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
