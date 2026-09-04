import { redirect } from "next/navigation";
import { DepositanteForm } from "@/components/configuracoes/depositante-form";
import { requireConfigSectionAccess } from "@/lib/auth";
import { isOwnOperationMode } from "@/lib/brand";

export default async function NovoDepositantePage() {
  if (isOwnOperationMode()) {
    redirect("/configuracoes");
  }
  await requireConfigSectionAccess("depositantes");

  return <DepositanteForm />;
}
