"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Headphones, LayoutDashboard, Package, Receipt, Truck } from "lucide-react";
import { AppSidebar, type SidebarNavigationItem } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppUserContext } from "@/lib/auth";

const portalNavigation: ReadonlyArray<SidebarNavigationItem> = [
  { href: "/portal", label: "Início", icon: LayoutDashboard, module: "dashboard" },
  { href: "/portal?view=pedidos", label: "Meus pedidos", icon: Package, module: "dashboard" },
  { href: "/portal?view=recebimento", label: "Recebimento", icon: Truck, module: "dashboard" },
  { href: "/portal?view=produtos", label: "Meus produtos", icon: FileText, module: "dashboard" },
  { href: "/portal?view=faturas", label: "Faturas", icon: Receipt, module: "dashboard" },
  { href: "/portal?view=suporte", label: "Suporte", icon: Headphones, module: "dashboard" },
];

export function PortalChrome({ children, user }: { children: ReactNode; user: AppUserContext }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get("view") ?? "inicio";
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    const collapsed = window.localStorage.getItem("infinoos-portal-sidebar-collapsed");
    const width = Number(window.localStorage.getItem("infinoos-portal-sidebar-width"));
    if (collapsed !== null) setIsCollapsed(collapsed === "true");
    if (Number.isFinite(width) && width >= 200 && width <= 500) setSidebarWidth(width);
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded) return;
    window.localStorage.setItem("infinoos-portal-sidebar-collapsed", String(isCollapsed));
    window.localStorage.setItem("infinoos-portal-sidebar-width", String(sidebarWidth));
  }, [isCollapsed, preferenceLoaded, sidebarWidth]);

  const activePath = currentView === "inicio" ? "/portal" : `${pathname}?view=${currentView}`;
  const style = { "--sidebar-width": isCollapsed ? "80px" : `${sidebarWidth}px` } as React.CSSProperties;

  function navigate(href: string) {
    router.push(href);
  }

  return (
    <div style={style} className="flex min-h-screen w-full overflow-hidden bg-[#f5f7fb] text-slate-900 dark:bg-[#0a1120] dark:text-slate-100">
      <div className="hidden shrink-0 lg:block">
        <AppSidebar
          user={user}
          currentPath={activePath}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          navigationOverride={portalNavigation}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-24 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1424]/80 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Portal do depositante</p>
            <h1 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Olá, {user.nome}</h1>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">{children}</div>

        <nav className="grid grid-cols-3 gap-2 border-t border-slate-200 bg-white/95 p-3 lg:hidden dark:border-white/10 dark:bg-[#0c1424]/95">
          {portalNavigation.slice(0, 3).map((item) => {
            const Icon = item.icon;
            const active = item.href === "/portal" ? currentView === "inicio" : item.href.includes(`view=${currentView}`);
            return (
              <button key={item.href} type="button" onClick={() => navigate(item.href)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold ${active ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300" : "text-slate-500 dark:text-slate-400"}`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
