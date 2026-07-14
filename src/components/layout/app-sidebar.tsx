"use client";

import { useState, useRef, useEffect } from "react";

import Link from "next/link";
import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  Map,
  PackageCheck,
  Receipt,
  Settings2,
  Truck,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { InfinyaBrand } from "@/components/branding/infinya-brand";
import type { AppUserContext } from "@/lib/auth";
import {
  canAccessConfigSection,
  canAccessModule,
  getRoleLabel,
  isCatalogAndStockOperatorUser,
  isProductCatalogOnlyUser,
  type AppModule,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

const navigation: ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  module: AppModule;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/recebimento", label: "Recebimento", icon: PackageCheck, module: "recebimento" },
  { href: "/expedicao", label: "Expedição", icon: Truck, module: "expedicao" },
  { href: "/estoque", label: "Estoque", icon: Boxes, module: "estoque" },
  { href: "/romaneio", label: "Romaneio", icon: FileText, module: "romaneio" },
  { href: "/nfe", label: "NF-e", icon: Receipt, module: "nfe" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, module: "relatorios" },
  { href: "/yms", label: "YMS (Docas)", icon: Map, module: "yms" },
  { href: "/configuracoes", label: "Configurações", icon: Settings2, module: "configuracoes" },
] as const;

type AppSidebarProps = {
  user: AppUserContext;
  currentPath: string;
};

export function AppSidebar({ user, currentPath }: AppSidebarProps) {
  const isYMS = currentPath.startsWith("/yms");

  const visibleNavigation = isProductCatalogOnlyUser(user)
    ? [
        {
          href: "/configuracoes/produtos",
          label: "Produtos",
          icon: Settings2,
          module: "configuracoes" as AppModule,
        },
      ]
    : isCatalogAndStockOperatorUser(user)
      ? [
          ...(canAccessModule(user, "estoque")
            ? [{ href: "/estoque", label: "Estoque", icon: Boxes, module: "estoque" as AppModule }]
            : []),
          ...(canAccessModule(user, "expedicao")
            ? [{ href: "/expedicao", label: "Expedição", icon: Truck }]
            : []),
          ...(canAccessModule(user, "romaneio")
            ? [{ href: "/romaneio", label: "Romaneio", icon: FileText, module: "romaneio" as AppModule }]
            : []),
          {
            href: "/configuracoes/produtos",
            label: "Produtos",
            icon: Settings2,
            module: "configuracoes" as AppModule,
          },
          ...(canAccessConfigSection(user, "enderecos")
            ? [{ href: "/configuracoes/enderecos", label: "Endereços", icon: Settings2 }]
            : []),
        ]
      : navigation.filter((item) => canAccessModule(user, item.module));

  // Filtragem visual entre os módulos WMS e YMS
  const currentNavItems = visibleNavigation.filter((item) => {
    if (isYMS) {
      // No YMS, mostramos apenas itens do YMS
      return item.module === "yms";
    }
    // No WMS, escondemos os itens específicos do YMS
    return item.module !== "yms";
  });

  return (
    <aside className="glass-card infinya-border-glow sticky top-0 z-10 m-3 flex min-h-screen w-72 flex-shrink-0 flex-col justify-between rounded-[28px] p-4 theme-transition shadow-xl">
      <div>
        <ModuleSwitcher currentPath={currentPath} />

        <nav className="space-y-1.5">
          {currentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors",
                  isActive
                    ? "border border-cyan-300/25 bg-cyan-400/10 text-cyan-700 dark:text-cyan-300"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 border-t border-slate-200/80 px-2 py-3 pt-4 dark:border-white/10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Sessão ativa
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="overflow-hidden">
            <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{user.nome}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{getRoleLabel(user.papel)}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

function ModuleSwitcher({ currentPath }: { currentPath: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isYMS = currentPath.startsWith("/yms");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative mb-6 px-1 py-2" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-2xl border border-transparent p-1.5 transition-colors hover:bg-slate-100/50 dark:hover:bg-white/5"
      >
        <InfinyaBrand compact isYMS={isYMS} />
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#071120]">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Módulos Disponíveis
          </p>
          <Link 
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              !isYMS 
                ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            Infinoos WMS
          </Link>
          <Link 
            href="/yms"
            onClick={() => setIsOpen(false)}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              isYMS 
                ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Map className="h-4 w-4" />
            </div>
            Infinoos YMS
          </Link>
        </div>
      )}
    </div>
  );
}
