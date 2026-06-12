import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
