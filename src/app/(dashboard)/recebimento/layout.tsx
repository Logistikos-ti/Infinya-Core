import type { ReactNode } from "react";
import { requireModuleAccess } from "@/lib/auth";

type RecebimentoLayoutProps = {
  children: ReactNode;
};

export default async function RecebimentoLayout({
  children,
}: RecebimentoLayoutProps) {
  await requireModuleAccess("recebimento");

  return children;
}
