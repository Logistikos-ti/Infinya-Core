"use client";

import Link from "next/link";
import {
  Boxes,
  ClipboardCheck,
  House,
  LogOut,
  PackageCheck,
  ScanLine,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import {
  canAccessModule,
  isCatalogAndStockOperatorUser,
  isProductCatalogOnlyUser,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

type AppMobileNavProps = {
  currentPath: string;
  user: AppUserContext;
};

const mobileNavigation: ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  module: "dashboard" | "recebimento" | "expedicao" | "estoque" | "configuracoes";
  match?: string[];
}> = [
  { href: "/dashboard", label: "Inicio", icon: House, module: "dashboard" },
  { href: "/recebimento", label: "Receb.", icon: PackageCheck, module: "recebimento" },
  {
    href: "/expedicao/separacao",
    label: "Separacao",
    icon: ScanLine,
    module: "expedicao",
    match: ["/expedicao/separacao"],
  },
  {
    href: "/expedicao/conferencia",
    label: "Confer.",
    icon: ClipboardCheck,
    module: "expedicao",
    match: ["/expedicao/conferencia"],
  },
  { href: "/estoque", label: "Estoque", icon: Boxes, module: "estoque" },
  {
    href: "/configuracoes/produtos",
    label: "Produtos",
    icon: Settings2,
    module: "configuracoes",
    match: ["/configuracoes", "/configuracoes/produtos"],
  },
] as const;

export function AppMobileNav({ currentPath, user }: AppMobileNavProps) {
  const isCatalogOnly = isProductCatalogOnlyUser(user);
  const isCatalogAndStockUser = isCatalogAndStockOperatorUser(user);
  const visibleItems = mobileNavigation.filter((item) => {
    if (isCatalogOnly && item.href === "/dashboard") {
      return false;
    }

    return canAccessModule(user, item.module);
  });

  const navigationItems = isCatalogOnly
    ? [
        { href: "/m/inicio", label: "Inicio", icon: House, match: ["/m/inicio"] },
        {
          href: "/configuracoes/produtos",
          label: "Produtos",
          icon: Settings2,
          match: ["/configuracoes", "/configuracoes/produtos"],
        },
        { href: "/m/sair", label: "Sair", icon: LogOut, match: ["/m/sair"] },
      ]
    : isCatalogAndStockUser
      ? [
          { href: "/m/inicio", label: "Inicio", icon: House, match: ["/m/inicio"] },
          { href: "/estoque", label: "Estoque", icon: Boxes, match: ["/estoque"] },
          {
            href: "/configuracoes/produtos",
            label: "Produtos",
            icon: Settings2,
            match: ["/configuracoes", "/configuracoes/produtos"],
          },
          { href: "/m/sair", label: "Sair", icon: LogOut, match: ["/m/sair"] },
        ]
      : visibleItems.map((item) => ({
          href: item.href,
          label: item.label,
          icon: item.icon,
          match: item.match ?? [item.href],
        }));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/92 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#071120]/92 lg:hidden">
      <div
        className={cn(
          "grid gap-1",
          navigationItems.length <= 3
            ? "grid-cols-3"
            : navigationItems.length <= 4
              ? "grid-cols-4"
              : "grid-cols-5",
        )}
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.match.some((path) => currentPath.startsWith(path));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-infinya-gradient text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
