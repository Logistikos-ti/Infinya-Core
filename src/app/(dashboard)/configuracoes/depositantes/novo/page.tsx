import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { DepositanteForm } from "@/components/configuracoes/depositante-form";
import { requireConfigSectionAccess } from "@/lib/auth";

export default async function NovoDepositantePage() {
  await requireConfigSectionAccess("depositantes");

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes/depositantes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para depositantes
      </Link>

      <ModulePageHeader
        title="Novo depositante"
        description="Cadastre um novo depositante com dados cadastrais, endereço fiscal, contatos e parâmetros operacionais."
        badge="Cadastro"
      />

      <DepositanteForm />
    </div>
  );
}
