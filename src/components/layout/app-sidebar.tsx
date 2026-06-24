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
  { href: "/estoque", label: "Estoque", icon: Boxes, module: "estoque" },
  { href: "/recebimento", label: "Recebimento", icon: PackageCheck, module: "recebimento" },
  { href: "/expedicao", label: "Expedição", icon: Truck, module: "expedicao" },
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
    <aside className="sticky top-0 z-10 flex min-h-screen w-full flex-shrink-0 flex-col justify-between border-r border-slate-200 bg-slate-950 px-5 py-6 text-white">
      <div>
        <div className="mb-8 flex items-center gap-3 px-2 py-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-sm font-bold text-white shadow-lg shadow-sky-900/30">
            IC
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">Infinya Core</p>
            <p className="text-sm text-slate-300">WMS multi-depositante</p>
          </div>
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
                  "flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Contexto ativo
        </p>
        <p className="truncate text-sm font-medium text-white">{user.nome}</p>
        <p className="text-xs text-slate-300">{getRoleLabel(user.papel)}</p>
      </div>
    </aside>
  );
}
