"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  Truck,
  PlugZap,
} from "lucide-react";
import {
  AppSidebar,
  type SidebarNavigationItem,
} from "@/components/layout/app-sidebar";
import { FirstAccessPasswordDialog } from "@/components/layout/first-access-password-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppUserContext } from "@/lib/auth";
import { isPortalIntegrationEnabled } from "@/lib/portal-integration-access";

const basePortalNavigation: ReadonlyArray<SidebarNavigationItem> = [
  {
    href: "/portal",
    label: "Início",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    href: "/portal?view=pedidos",
    label: "Meus pedidos",
    icon: Package,
    module: "dashboard",
  },
  {
    href: "/portal?view=recebimento",
    label: "Recebimento",
    icon: Truck,
    module: "dashboard",
  },
  {
    href: "/portal?view=produtos",
    label: "Meus produtos",
    icon: FileText,
    module: "dashboard",
  },
  {
    href: "/portal?view=faturas",
    label: "Faturas",
    icon: Receipt,
    module: "dashboard",
  },
  {
    href: "/portal?view=suporte",
    label: "Suporte",
    icon: CircleHelp,
    module: "dashboard",
  },
];

function getPortalNavigation(user: AppUserContext): ReadonlyArray<SidebarNavigationItem> {
  if (!isPortalIntegrationEnabled(user.depositanteNome)) return basePortalNavigation;

  return [
    ...basePortalNavigation.slice(0, 5),
    { href: "/portal?view=integracoes", label: "Integrações", icon: PlugZap, module: "dashboard" },
    ...basePortalNavigation.slice(5),
  ];
}

export function PortalChrome({
  children,
  user,
}: {
  children: ReactNode;
  user: AppUserContext;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get("view") ?? "inicio";
  const searchParamsString = searchParams.toString();
  const searchParamKey = currentView === "produtos" ? "search" : "q";
  const searchValue = searchParams.get(searchParamKey) ?? "";
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [search, setSearch] = useState(searchValue);
  const portalNavigation = getPortalNavigation(user);

  useEffect(() => {
    const collapsed = window.localStorage.getItem(
      "infinoos-portal-sidebar-collapsed",
    );
    const width = Number(
      window.localStorage.getItem("infinoos-portal-sidebar-width"),
    );
    if (collapsed !== null) setIsCollapsed(collapsed === "true");
    if (Number.isFinite(width) && width >= 200 && width <= 500)
      setSidebarWidth(width);
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded) return;
    window.localStorage.setItem(
      "infinoos-portal-sidebar-collapsed",
      String(isCollapsed),
    );
    window.localStorage.setItem(
      "infinoos-portal-sidebar-width",
      String(sidebarWidth),
    );
  }, [isCollapsed, preferenceLoaded, sidebarWidth]);

  useEffect(() => {
    setSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalizedSearch = search.trim();
      const nextView = currentView === "inicio" && normalizedSearch ? "pedidos" : currentView;
      const nextKey = nextView === "produtos" ? "search" : "q";
      const params = new URLSearchParams(searchParamsString);

      params.set("view", nextView);
      params.delete(nextKey === "search" ? "q" : "search");
      if (normalizedSearch) {
        params.set(nextKey, normalizedSearch);
      } else {
        params.delete(nextKey);
      }

      const nextUrl = `${pathname}?${params.toString()}`;
      const currentUrl = `${pathname}?${searchParamsString}`;
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [currentView, pathname, router, search, searchParamsString]);

  const activePath =
    currentView === "inicio" ? "/portal" : `${pathname}?view=${currentView}`;
  const style = {
    "--sidebar-width": isCollapsed ? "80px" : `${sidebarWidth}px`,
  } as React.CSSProperties;

  function navigate(href: string) {
    router.push(href);
  }

  return (
    <div
      style={style}
      className="flex min-h-screen w-full overflow-hidden bg-[#f5f7fb] text-slate-900 dark:bg-[#0a1120] dark:text-slate-100"
    >
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
        <header className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1424]/80 sm:flex-nowrap sm:px-7 sm:py-0">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 dark:border-white/10 dark:bg-white/5 sm:max-w-[420px]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              aria-label="Buscar no portal"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={currentView === "produtos" ? "Filtrar produtos..." : "Buscar pedido, cliente, canal..."}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="hidden flex-1 sm:block" />
          <button
            type="button"
            aria-label="Notificações"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <Bell className="h-4 w-4" />
          </button>
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-5 lg:px-4">
          {children}
        </div>

        <nav className="grid grid-cols-3 gap-2 border-t border-slate-200 bg-white/95 p-3 lg:hidden dark:border-white/10 dark:bg-[#0c1424]/95">
          {portalNavigation.slice(0, 3).map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/portal"
                ? currentView === "inicio"
                : item.href.includes(`view=${currentView}`);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold ${active ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </main>

      <FirstAccessPasswordDialog
        isVisible={user.forcePasswordReset}
        userName={user.nome}
      />
    </div>
  );
}
