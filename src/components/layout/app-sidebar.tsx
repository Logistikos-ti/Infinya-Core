"use client";

import Link from "next/link";
import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  PackageCheck,
  Receipt,
  Settings2,
  Truck,
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
  { href: "/configuracoes", label: "Configurações", icon: Settings2, module: "configuracoes" },
] as const;

type AppSidebarProps = {
  user: AppUserContext;
  currentPath: string;
};

export function AppSidebar({ user, currentPath }: AppSidebarProps) {
  const visibleNavigation = isProductCatalogOnlyUser(user)
    ? [{ href: "/configuracoes/produtos", label: "Produtos", icon: Settings2 }]
    : isCatalogAndStockOperatorUser(user)
      ? [
          ...(canAccessModule(user, "estoque")
            ? [{ href: "/estoque", label: "Estoque", icon: Boxes }]
            : []),
          ...(canAccessModule(user, "expedicao")
            ? [{ href: "/expedicao", label: "Expedição", icon: Truck }]
            : []),
          { href: "/configuracoes/produtos", label: "Produtos", icon: Settings2 },
          ...(canAccessConfigSection(user, "enderecos")
            ? [{ href: "/configuracoes/enderecos", label: "Endereços", icon: Settings2 }]
            : []),
        ]
      : navigation.filter((item) => canAccessModule(user, item.module));

  return (
    <aside className="glass-card infinya-border-glow sticky top-0 z-10 m-3 flex min-h-screen w-72 flex-shrink-0 flex-col justify-between rounded-[28px] p-4 theme-transition shadow-xl">
      <div>
        <div className="mb-6 px-1 py-2">
          <InfinyaBrand
            compact
            subtitle="Operação logística multi-tenant"
            subtitleClassName="text-slate-500 dark:text-slate-400"
          />
        </div>

        <nav className="space-y-1.5">
          {visibleNavigation.map((item) => {
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
