import { CircleHelp } from "lucide-react";
import { SupportOperationsClient } from "@/components/support/support-operations-client";
import { requireRoleAccess } from "@/lib/auth";

export default async function SupportOperationsPage() {
  await requireRoleAccess(["ADMIN", "TI", "OPERADOR"]);
  return <div className="space-y-6"><div><div className="mb-2 flex items-center gap-2 text-cyan-600"><CircleHelp className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Atendimento</span></div><h1 className="font-display text-3xl font-bold">Suporte</h1><p className="mt-2 text-sm text-slate-500">Acompanhe e responda aos chamados dos depositantes.</p></div><SupportOperationsClient /></div>;
}
