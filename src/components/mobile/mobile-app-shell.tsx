"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { InfinyaBrand } from "@/components/branding/infinya-brand";
import { MobileInstallCard } from "@/components/pwa/mobile-install-card";
import { ThemeProvider } from "@/components/theme-provider";
import { getMobileNavigationGroups } from "@/lib/mobile";
import { cn } from "@/lib/utils";

type MobileAppShellProps = {
  children: ReactNode;
  user: AppUserContext;
};

export function MobileAppShell({ children, user }: MobileAppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = useMemo(() => getMobileNavigationGroups(user), [user]);
  const primaryItems = navigation.primary;
  const secondaryItems = navigation.secondary;
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
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="w-full rounded-2xl text-left transition hover:scale-[1.01] active:scale-[0.99]"
              aria-label="Abrir menu"
            >
              <InfinyaBrand compact className="w-full" />
            </button>
          </div>
        </header>

        {menuOpen ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
            />

            <aside className="absolute left-0 top-0 flex h-full w-[84%] max-w-[20rem] flex-col border-r border-white/10 bg-[#06101f] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
                <InfinyaBrand compact className="min-w-0 flex-1" subtitle={user.nome} />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10"
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-2">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Menu
                  </p>

                  {secondaryItems.length ? (
                    secondaryItems.map((item) => {
                      const Icon = item.icon;
                      const matches = item.match ?? [item.href];
                      const active = matches.some((path) => pathname.startsWith(path));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                            active
                              ? "bg-infinya-gradient text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                              : "border border-white/8 bg-white/5 text-slate-100 hover:bg-white/8",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm text-slate-300">
                      Nenhum módulo extra liberado neste perfil.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 px-4 py-4">
                <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Sessão ativa
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">{user.nome}</p>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

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
          <div className="mx-auto grid max-w-md grid-cols-4 gap-2 px-3">
            {primaryItems.map((item) => {
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

            {primaryItems.length < 4
              ? Array.from({ length: 4 - primaryItems.length }).map((_, index) => (
                  <div key={`nav-spacer-${index}`} className="min-h-[60px]" aria-hidden="true" />
                ))
              : null}
          </div>
        </nav>
      </div>
    </ThemeProvider>
  );
}
