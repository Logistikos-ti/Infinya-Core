import { DepositanteForm } from "@/components/configuracoes/depositante-form";
import { requireConfigSectionAccess } from "@/lib/auth";

export default async function NovoDepositantePage() {
  await requireConfigSectionAccess("depositantes");

  return <DepositanteForm />;
}
