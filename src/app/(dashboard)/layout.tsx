import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRoleAccess } from "@/lib/auth";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  // O portal e o WMS operacional são áreas distintas. Impede que um depositante
  // alcance qualquer tela interna digitando a URL diretamente.
  await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);

  return <AppShell>{children}</AppShell>;
}
