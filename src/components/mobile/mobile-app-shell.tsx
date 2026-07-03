"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, House, LogOut, PackageCheck, ScanLine, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { InfinyaBrand } from "@/components/branding/infinya-brand";
import { MobileInstallCard } from "@/components/pwa/mobile-install-card";
import { canAccessModule, type AppModule } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type MobileAppShellProps = {
  children: ReactNode;
  user: AppUserContext;
};

const navItems: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  module: AppModule;
}> = [
  { href: "/m/inicio", label: "In\u00EDcio", icon: House, module: "dashboard" },
  { href: "/m/recebimento", label: "Receb.", icon: PackageCheck, module: "recebimento" },
  { href: "/m/separacao", label: "Separ.", icon: ScanLine, module: "expedicao" },
  { href: "/m/conferencia", label: "Conf.", icon: ClipboardCheck, module: "expedicao" },
  { href: "/configuracoes/produtos", label: "Produtos", icon: Settings2, module: "configuracoes" },
];

export function MobileAppShell({ children, user }: MobileAppShellProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => canAccessModule(user, item.module));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.1),transparent_28%),radial-gradient(circle_at_bottom,rgba(192,132,252,0.12),transparent_24%),#040816] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#040816]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-4">
          <InfinyaBrand
            compact
            className="min-w-0 flex-1"
            subtitle={user.nome}
            subtitleClassName="truncate"
            forceLightWordmark
          />
          <Link
            href="/m/sair"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Link>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-144px)] max-w-md px-4 py-4 pb-24">
        <div className="mb-4">
          <MobileInstallCard />
        </div>
        {children}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-medium text-white">Sessão ativa</p>
          <p className="mt-1 text-xs text-slate-300">{user.nome}</p>
          <Link
            href="/m/sair"
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15"
          >
            <LogOut className="h-4 w-4" />
            Sair do app
          </Link>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#040816]/95 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 backdrop-blur">
        <div
          className={cn(
            "mx-auto grid max-w-md gap-2 px-3",
            visibleItems.length <= 4 ? "grid-cols-4" : "grid-cols-5",
          )}
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-infinya-gradient text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.2)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
