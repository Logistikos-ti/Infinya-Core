import type { ReactNode } from "react";
import { requireUserContext } from "@/lib/auth";
import { AppChrome } from "@/components/layout/app-chrome";

type AppShellProps = {
  children: ReactNode;
};

export async function AppShell({ children }: AppShellProps) {
  const user = await requireUserContext();

  return <AppChrome user={user}>{children}</AppChrome>;
}
