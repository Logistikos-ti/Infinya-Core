import { Boxes, FileText, PackageCheck, Truck } from "lucide-react";
import { requireRoleAccess } from "@/lib/auth";
import { listReceivingOrdersFromDb } from "@/lib/receiving";
import { listShippingOrdersFromDb } from "@/lib/shipping";
import { listStockBalancesFromDb } from "@/lib/stock";

type PortalPageProps = { searchParams?: Promise<{ view?: string }> };

export default async function PortalPage({ searchParams }: PortalPageProps) {
  const user = await requireRoleAccess(["DEPOSITANTE"]);
  const view = (await searchParams)?.view ?? "inicio";
  const depositanteId = user.depositanteId ?? "";
  const [orders, receiving, stock] = await Promise.all([
    listShippingOrdersFromDb({ depositanteId }),
    listReceivingOrdersFromDb({ depositanteId }),
    listStockBalancesFromDb({ depositanteId }),
  ]);

  const titles: Record<string, string> = {
    inicio: "Visão geral da operação",
    pedidos: "Meus pedidos",
    recebimento: "Recebimento",
    produtos: "Meus produtos",
    faturas: "Faturas",
    suporte: "Suporte",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#101b30] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Infinoos WMS</p>
        <h2 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">{titles[view] ?? "Portal do depositante"}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Acompanhe a sua operação logística com dados atualizados do armazém.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PortalStat icon={PackageCheck} label="Pedidos" value={orders.length} />
        <PortalStat icon={Truck} label="Recebimentos" value={receiving.length} />
        <PortalStat icon={Boxes} label="Linhas em estoque" value={stock.length} />
        <PortalStat icon={FileText} label="Itens monitorados" value={stock.reduce((sum, item) => sum + Number(item.rawQuantidade ?? 0), 0)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <PortalList title="Pedidos recentes" empty="Nenhum pedido encontrado." items={orders.slice(0, 6).map((item) => `${item.displayNumber ?? item.id} · ${item.status}`)} />
        <PortalList title="Recebimentos recentes" empty="Nenhum recebimento encontrado." items={receiving.slice(0, 6).map((item) => `${item.code} · ${item.status}`)} />
      </section>
    </div>
  );
}

function PortalStat({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]"><Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /><p className="mt-5 text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}

function PortalList({ title, empty, items }: { title: string; empty: string; items: string[] }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]"><h3 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h3><div className="mt-4 space-y-2">{items.length ? items.map((item) => <div key={item} className="rounded-xl border border-slate-100 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-300">{item}</div>) : <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:bg-white/5 dark:text-slate-400">{empty}</p>}</div></div>;
}
