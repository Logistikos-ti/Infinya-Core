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
        className="mx-auto flex w-full max-w-md flex-col text-[#F1F5F9]"
        style={{
          background: "linear-gradient(180deg, #0A1120 0%, #0B1424 100%)",
          fontFamily: "'Manrope', -apple-system, system-ui, sans-serif",
          // The viewport is served with viewport-fit=cover so the gradient can
          // reach the screen edges, which means content would otherwise sit
          // under the notch/status bar on devices like the iPhone X.
          paddingTop: "env(safe-area-inset-top)",
          // Keep the shell a full screen tall *including* that padding,
          // otherwise the inset pushes the layout into an overflow.
          minHeight: "100dvh",
        }}
      >
        {children}
      </div>
    </ThemeProvider>
  );
}
