"use client";

import { ReactNode } from "react";
import type { AppUserContext } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { IOSDevice } from "@/components/mobile/ios-glass";

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
      <div className="mx-auto min-h-dvh max-w-md w-full bg-[#0A1120] text-white">
        <IOSDevice dark={true}>
          {children}
        </IOSDevice>
      </div>
    </ThemeProvider>
  );
}
