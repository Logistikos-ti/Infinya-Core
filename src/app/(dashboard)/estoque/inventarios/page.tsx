import Link from "next/link";
import { ArrowLeft, ClipboardCheck, ClipboardList, LayoutGrid } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireModuleAccess } from "@/lib/auth";

// Hub temporário: reúne os três fluxos de inventário (contagem cíclica,
// inventário geral, pendências/histórico) que hoje só existem como botões
// soltos dentro da tela de Estoque. Ponto de entrada da aba nova na sidebar
// enquanto o rebranding definitivo desta tela não chega.
export default async function EstoqueInventariosPage() {
  await requireModuleAccess("estoque");

  const links = [
    {
      href: "/estoque/inventarios/novo",
      icon: ClipboardList,
      title: "Nova contagem cíclica",
      description: "Inicie a contagem cíclica de um endereço ou lote específico.",
    },
    {
      href: "/estoque/inventarios/geral",
      icon: LayoutGrid,
      title: "Inventário geral",
      description: "Conte o estoque completo de um depositante, endereço por endereço.",
    },
    {
      href: "/estoque/inventarios/pendencias",
      icon: ClipboardCheck,
      title: "Pendências e histórico",
      description: "Divergências aguardando aprovação e o registro de contagens concluídas.",
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/estoque"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para estoque
      </Link>

      <ModulePageHeader
        title="Inventário"
        description="Contagens cíclicas, inventário geral por depositante e o histórico de ajustes de estoque."
        badge="Estoque"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/70 hover:shadow-[0_24px_50px_-28px_rgba(8,145,178,0.35)] dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-cyan-400/40"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-600 transition group-hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:group-hover:bg-cyan-500/20">
              <Icon className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
