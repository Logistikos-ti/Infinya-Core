"use client";

import Link from "next/link";
import { Boxes, ClipboardCheck, House, PackageCheck, ScanLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type AppMobileNavProps = {
  currentPath: string;
  user: AppUserContext;
};

const mobileNavigation: ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  module: "dashboard" | "recebimento" | "expedicao" | "estoque";
  match?: string[];
}> = [
  { href: "/dashboard", label: "Início", icon: House, module: "dashboard" },
  { href: "/recebimento", label: "Receb.", icon: PackageCheck, module: "recebimento" },
  {
    href: "/expedicao/separacao",
    label: "Separação",
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
] as const;

export function AppMobileNav({ currentPath, user }: AppMobileNavProps) {
  const visibleItems = mobileNavigation.filter((item) => canAccessModule(user, item.module));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = (item.match ?? [item.href]).some((path) => currentPath.startsWith(path));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
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
