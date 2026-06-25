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
  Infinity as InfinityIcon
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { canAccessModule, getRoleLabel, type AppModule } from "@/lib/permissions";
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
  const visibleNavigation = navigation.filter((item) => canAccessModule(user, item.module));

  return (
    <aside className="sticky top-0 z-10 flex min-h-screen w-64 flex-shrink-0 flex-col justify-between p-4 theme-transition glass-card m-3 rounded-2xl shadow-xl">
      <div>
        <div className="flex items-center gap-3 px-2 py-4 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-infinya-gradient text-sm font-bold text-white shadow-lg shadow-primary-500/30">
            <InfinityIcon className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 uppercase tracking-widest">
            INFINYA
          </p>
        </div>

        <nav className="space-y-1">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors",
                  isActive
                    ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800/50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="px-2 py-2 border-t border-slate-200 dark:border-zinc-800 mt-4 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
          Contexto ativo
        </p>
        <p className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">{user.nome}</p>
        <p className="text-xs text-slate-500">{getRoleLabel(user.papel)}</p>
      </div>
    </aside>
  );
}
