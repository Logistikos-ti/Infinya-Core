"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

type AppChromeProps = {
  children: ReactNode;
  user: AppUserContext;
};

export function AppChrome({ children, user }: AppChromeProps) {
  const pathname = usePathname();
  const currentPath = pathname || "/dashboard";

  return (
    <div className="theme-transition bg-lightBg text-slate-900 dark:bg-darkBg dark:text-zinc-100 flex min-h-screen w-full overflow-hidden">
      
      {/* Background Decoration */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-500/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-accent-500/10 blur-[100px]"></div>
      </div>

      {/* Sidebar - Hidden on mobile, block on lg */}
      <div className="hidden lg:block z-10">
        <AppSidebar user={user} currentPath={currentPath} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-4 sm:px-8 z-10 border-b lg:border-none border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-4 w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar pedidos, produtos..." 
                className="w-full pl-10 pr-4 py-2 rounded-full bg-white/50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm transition-colors"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            <ThemeToggle />
            <div className="hidden sm:block">
              <LogoutButton />
            </div>
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
    </div>
  );
}
