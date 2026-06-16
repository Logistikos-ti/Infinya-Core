import type { ReactNode } from "react";
import { requireModuleAccess } from "@/lib/auth";

type ConfiguracoesLayoutProps = {
  children: ReactNode;
};

export default async function ConfiguracoesLayout({
  children,
}: ConfiguracoesLayoutProps) {
  await requireModuleAccess("configuracoes");

  return children;
}
