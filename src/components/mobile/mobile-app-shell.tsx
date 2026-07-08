"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppUserContext } from "@/lib/auth";
import { InfinyaBrand } from "@/components/branding/infinya-brand";
import { MobileInstallCard } from "@/components/pwa/mobile-install-card";
import { ThemeProvider } from "@/components/theme-provider";
import { getMobileNavigationItems } from "@/lib/mobile";
import { cn } from "@/lib/utils";

type MobileAppShellProps = {
  children: ReactNode;
  user: AppUserContext;
};

export function MobileAppShell({ children, user }: MobileAppShellProps) {
  const pathname = usePathname();
  const navigationItems = getMobileNavigationItems(user);
  const mobileShellBackground = {
    backgroundColor: "#040816",
    backgroundImage:
      "radial-gradient(circle at top, rgba(34,211,238,0.10), transparent 28%), radial-gradient(circle at bottom, rgba(192,132,252,0.12), transparent 24%)",
  } as const;

  return (
    <ThemeProvider
      attribute="class"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <div
        className="min-h-dvh overflow-x-hidden bg-[#040816] text-white dark"
        style={mobileShellBackground}
      >
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#040816]/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
            <InfinyaBrand
              compact
              className="min-w-0 flex-1"
              subtitle={user.nome}
              subtitleClassName="truncate"
              forceLightWordmark
            />
          </div>
        </header>

        <main
          className="mx-auto min-h-[calc(100dvh-144px)] max-w-md bg-[#040816] px-4 py-4 pb-24"
          style={mobileShellBackground}
        >
          <div className="mb-4">
            <MobileInstallCard />
          </div>

          {children}

          <div className="mobile-glass-card mt-6 rounded-2xl p-4">
            <p className="text-sm font-medium text-white">Sessão ativa</p>
            <p className="mt-1 text-xs text-slate-300">{user.nome}</p>
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#040816]/95 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 backdrop-blur">
          <div
            className={cn(
              "mx-auto grid max-w-md gap-2 px-3",
              navigationItems.length <= 3
                ? "grid-cols-3"
                : navigationItems.length <= 4
                  ? "grid-cols-4"
                  : "grid-cols-5",
            )}
          >
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const matches = item.match ?? [item.href];
              const active = matches.some((path) => pathname.startsWith(path));

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
    </ThemeProvider>
  );
}
