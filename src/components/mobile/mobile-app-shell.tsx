"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, House, PackageCheck, ScanLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
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
          />
          <div className="shrink-0 [&_button]:border-white/15 [&_button]:bg-white/5 [&_button]:text-white [&_button:hover]:bg-white/10">
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-144px)] max-w-md px-4 py-4 pb-24">
        <div className="mb-4">
          <MobileInstallCard />
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#040816]/95 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2 px-3">
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
