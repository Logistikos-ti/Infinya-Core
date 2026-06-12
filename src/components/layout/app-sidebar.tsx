import Link from "next/link";
import { BarChart3, Boxes, FileText, PackageCheck, Receipt, Settings2, Truck } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/recebimento", label: "Recebimento", icon: PackageCheck },
  { href: "/expedicao", label: "Expedição", icon: Truck },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/romaneio", label: "Romaneio", icon: FileText },
  { href: "/nfe", label: "NFe", icon: Receipt },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings2 },
];

type AppSidebarProps = {
  user: AppUserContext;
};

export function AppSidebar({ user }: AppSidebarProps) {
  return (
    <aside className="border-r border-slate-200 bg-slate-950 px-5 py-6 text-slate-50">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/20 text-sm font-bold text-sky-300">
          IC
        </div>
        <div>
          <p className="text-sm font-semibold">Infinya Core</p>
          <p className="text-xs text-slate-400">WMS multi-depositante</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Contexto ativo
        </p>
        <p className="mt-2 text-sm text-slate-200">
          {user.nome} - {user.papel}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {user.depositanteId
            ? "Acesso limitado ao depositante vinculado."
            : "Acesso administrativo a toda a operação."}
        </p>
      </div>
    </aside>
  );
}
