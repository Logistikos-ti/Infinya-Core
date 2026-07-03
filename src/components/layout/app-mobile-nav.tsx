"use client";

import Link from "next/link";
import type { AppUserContext } from "@/lib/auth";
import { getMobileNavigationItems } from "@/lib/mobile";
import { cn } from "@/lib/utils";

type AppMobileNavProps = {
  currentPath: string;
  user: AppUserContext;
};

export function AppMobileNav({ currentPath, user }: AppMobileNavProps) {
  const navigationItems = getMobileNavigationItems(user);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#071120]/92 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.28)] backdrop-blur lg:hidden">
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
          const matches = item.match ?? [item.href];
          const isActive = matches.some((path) => currentPath.startsWith(path));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-infinya-gradient text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
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
