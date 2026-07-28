"use client";

import { ReactNode } from "react";
import type { AppUserContext } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";

type MobileAppShellProps = {
  children: ReactNode;
  user: AppUserContext;
};

export function MobileAppShell({ children, user }: MobileAppShellProps) {
  return (
    <ThemeProvider
      attribute="class"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <div
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col text-[#F1F5F9]"
        style={{
          background: "linear-gradient(180deg, #0A1120 0%, #0B1424 100%)",
          fontFamily: "'Manrope', -apple-system, system-ui, sans-serif",
        }}
      >
        {children}
      </div>
    </ThemeProvider>
  );
}
