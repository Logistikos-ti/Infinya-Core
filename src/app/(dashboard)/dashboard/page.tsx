import { Wrench } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import { isScopedDepositanteUser } from "@/lib/tenant-scope";

export default async function DashboardPage() {
  const user = await requireModuleAccess("dashboard");

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
      <div className="p-6 bg-primary/10 rounded-full">
        <Wrench className="w-16 h-16 text-primary" />
      </div>
      
      <div className="text-center max-w-lg">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
          Dashboard em Desenvolvimento
        </h1>
        <p className="mt-4 text-slate-600 dark:text-zinc-400">
          {isScopedDepositanteUser(user)
            ? `Olá, ${user.depositanteNome}. Seu painel de indicadores será construído em breve, assim que o volume de dados da operação aumentar.`
            : "Este painel está temporariamente pausado. Voltaremos a aprimorar o dashboard principal quando tivermos maior volume de dados para cruzar os indicadores da operação."}
        </p>
      </div>
    </div>
  );
}
