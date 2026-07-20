"use client";

import Link from "next/link";
import { Bell, Boxes, CheckCircle2, ChevronRight, ClipboardList, Clock3, FileText, ListChecks, PackageCheck, Search, ScanBarcode, Settings2, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ShippingOrderSummary, ShippingQueueSummary } from "@/lib/shipping";

type ReferenceStat = { label: string; value: string; help: string };
type Props = {
  orders: ShippingOrderSummary[];
  stats: readonly ReferenceStat[];
  queues: ShippingQueueSummary[];
  totalOrders: number;
  currentPage: number;
  totalPages: number;
  perPage: number;
  statusFilter: string;
  depositanteFilter: string;
  orderSearchFilter: string;
  depositantes: Array<{ id: string; nome: string }>;
  canManageTenants: boolean;
  baseQuery: Record<string, string>;
};

const nav = [
  ["Dashboard", "/dashboard", "dashboard"],
  ["Recebimento", "/recebimento", "inbound"],
  ["Estoque", "/estoque", "stock"],
  ["Produtos", "/configuracoes/produtos", "products"],
  ["Endereços", "/configuracoes/enderecos", "pin"],
  ["Separação", "/expedicao/separacao", "picking"],
  ["Expedição", "/expedicao", "outbound"],
  ["Inventário", "/estoque/inventarios", "inventory"],
  ["Relatórios", "/relatorios", "reports"],
] as const;

function iconFor(name: string) {
  const props = { size: 18, strokeWidth: 1.7 };
  if (name === "dashboard") return <Boxes {...props} />;
  if (name === "inbound") return <PackageCheck {...props} />;
  if (name === "stock") return <Boxes {...props} />;
  if (name === "products") return <PackageCheck {...props} />;
  if (name === "pin") return <span className="text-lg leading-none">⌖</span>;
  if (name === "picking") return <ListChecks {...props} />;
  if (name === "outbound") return <Truck {...props} />;
  if (name === "inventory") return <Clock3 {...props} />;
  return <FileText {...props} />;
}

function statusStyle(status: string) {
  if (["EM_CONFERENCIA", "CONFERIDO"].includes(status)) return "bg-violet-500/15 text-violet-300";
  if (["EXPEDIDO"].includes(status)) return "bg-blue-500/15 text-blue-300";
  if (["EM_SEPARACAO", "SEPARADO", "PRONTO_ROMANEIO"].includes(status)) return "bg-emerald-500/15 text-emerald-300";
  return "bg-amber-500/15 text-amber-300";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    NOVO: "Aguardando",
    EM_SEPARACAO: "Em separação",
    SEPARADO: "Separado",
    EM_CONFERENCIA: "Em conferência",
    CONFERIDO: "Conferido",
    PRONTO_ROMANEIO: "Pronto para romaneio",
    EXPEDIDO: "Expedido",
  };
  return labels[status] ?? status;
}

export function ExpedicaoReferenceDashboard({
  orders,
  stats,
  queues,
  totalOrders,
  currentPage,
  totalPages,
  perPage,
  statusFilter,
  depositanteFilter,
  orderSearchFilter,
  depositantes,
  canManageTenants,
  baseQuery,
}: Props) {
  const [selected, setSelected] = useState<ShippingOrderSummary | null>(null);
  const [search, setSearch] = useState(orderSearchFilter);
  const pageHref = (page: number) => `/expedicao?${new URLSearchParams({ ...baseQuery, page: String(page) }).toString()}`;
  const visibleOrders = useMemo(() => orders, [orders]);

  return (
    <div className="fixed inset-0 z-40 flex overflow-hidden bg-[#0a1120] font-sans text-slate-100">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0c1424] lg:flex">
        <div className="border-b border-white/[0.08] px-[22px] py-6">
          <div className="font-space text-[11px] font-semibold tracking-[0.4em] text-slate-400">INFINOOS</div>
          <div className="font-space mt-1 bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-[22px] font-bold leading-none text-transparent">WMS</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map(([label, href, key]) => {
            const active = key === "outbound";
            return <Link key={key} href={href} className={`flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] font-semibold transition ${active ? "bg-violet-500/15 text-violet-300" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"}`}>
              <span className="flex h-5 w-5 items-center justify-center">{iconFor(key)}</span>{label}
            </Link>;
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-4 text-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 font-bold text-white">TI</div>
          <div className="min-w-0"><div className="truncate font-bold">Sessão ativa</div><div className="truncate text-slate-400">Operação logística</div></div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[68px] shrink-0 items-center gap-4 border-b border-white/[0.08] bg-[#0c1424] px-7">
          <form action="/expedicao" className="flex h-[42px] w-full max-w-[420px] items-center gap-2.5 rounded-[11px] border border-white/[0.1] bg-[#101b30] px-4">
            <Search size={16} className="text-slate-500" />
            <input name="pedido" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pedido, cliente, NF, transportadora..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" />
          </form>
          <div className="flex-1" />
          <button type="button" aria-label="Notificações" className="relative flex h-[42px] w-[42px] items-center justify-center rounded-[11px] border border-white/[0.1] bg-[#101b30] text-slate-400"><Bell size={17} /><span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full bg-red-500" /></button>
          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><Settings2 size={16} /> Operação</div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-7 sm:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><span>Operação</span><ChevronRight size={13} /><span className="font-semibold text-slate-300">Expedição</span></div>
              <h1 className="font-space text-[28px] font-bold">Expedição</h1>
              <p className="mt-1.5 text-sm text-slate-400">Conferência de saída, carregamento por doca e despacho de pedidos.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/expedicao" className="rounded-[9px] bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2.5 text-[13px] font-bold text-white">Pedidos</Link>
              <Link href="/expedicao/separacao" className="rounded-[9px] border border-white/[0.1] bg-[#101b30] px-4 py-2.5 text-[13px] font-bold text-slate-300 hover:border-violet-400">Separação</Link>
              <Link href="/expedicao/conferencia" className="rounded-[9px] border border-white/[0.1] bg-[#101b30] px-4 py-2.5 text-[13px] font-bold text-slate-300 hover:border-violet-400">Conferência</Link>
              <Link href="/expedicao/conferidos" className="rounded-[9px] border border-white/[0.1] bg-[#101b30] px-4 py-2.5 text-[13px] font-bold text-slate-300 hover:border-violet-400">Conferidos</Link>
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => <div key={stat.label} className="rounded-2xl border border-white/[0.1] bg-[#101b30] p-5">
              <div className="flex items-center justify-between text-[13px] font-semibold text-slate-400"><span>{stat.label}</span><span className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] ${index === 0 ? "bg-blue-500/15 text-blue-400" : index === 1 ? "bg-violet-500/15 text-violet-400" : index === 2 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>{index === 0 ? <Boxes size={17} /> : index === 1 ? <CheckCircle2 size={17} /> : index === 2 ? <Clock3 size={17} /> : <Truck size={17} />}</span></div>
              <div className="font-space mt-3 text-3xl font-bold text-slate-100">{stat.value}</div><p className="mt-2 text-xs text-slate-500">{stat.help}</p>
            </div>)}
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-4">
            {[
              ["PAINEL", "Pedidos", "Ir direto para a listagem completa, filtros e acompanhamento da fila.", "/expedicao", "blue", <ClipboardList size={20} />],
              ["OPERAÇÃO", "Separação", "Abrir a fila de picking e iniciar a leitura operacional do armazém.", "/expedicao/separacao", "cyan", <ListChecks size={20} />],
              ["VALIDAÇÃO", "Conferência", "Validar item a item e liberar somente pedidos conferidos.", "/expedicao/conferencia", "violet", <ScanBarcode size={20} />],
              ["PÓS-CONFERÊNCIA", "Conferidos", "Acompanhar pedidos prontos antes do despacho e romaneio.", "/expedicao/conferidos", "emerald", <FileText size={20} />],
            ].map(([kicker, title, description, href, color, icon]) => <Link key={String(title)} href={String(href)} className={`group rounded-2xl border border-white/[0.1] bg-[#101b30] p-[22px] transition hover:-translate-y-1 hover:border-${color}-400/70 hover:shadow-2xl hover:shadow-${color}-500/10`}>
              <div className="flex items-start justify-between"><span className={`text-[11px] font-extrabold tracking-[0.15em] text-${color}-400`}>{String(kicker)}</span><span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${color}-500/15 text-${color}-400`}>{icon}</span></div>
              <h2 className="font-space mt-5 text-[22px] font-bold text-slate-100">{String(title)}</h2><p className="mt-2 text-xs leading-relaxed text-slate-400">{String(description)}</p><span className={`mt-5 inline-flex rounded-[10px] bg-${color}-500/15 px-3.5 py-2 text-[13px] font-bold text-${color}-300`}>Abrir módulo</span>
            </Link>)}
          </div>

          <section className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101b30]">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-4">
              <Link href="/expedicao" className="rounded-[9px] bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2 text-[13px] font-bold text-white">Todos</Link>
              {[["NOVO", "Aguardando"], ["EM_CONFERENCIA", "Em conferência"], ["PRONTO_ROMANEIO", "Pronto para romaneio"]].map(([value, label]) => <Link key={value} href={`/expedicao?${new URLSearchParams({ ...baseQuery, status: value }).toString()}`} className="rounded-[9px] border border-white/[0.1] bg-[#0e1728] px-4 py-2 text-[13px] font-bold text-slate-400 hover:border-violet-400">{label}</Link>)}
              <span className="flex-1" />
              <span className="text-[13px] text-slate-500">{totalOrders} pedido(s) na fila</span>
            </div>
            <form action="/expedicao" className="flex flex-wrap gap-2 border-b border-white/[0.08] bg-[#0e1728] p-4">
              {canManageTenants && <select name="depositante" defaultValue={depositanteFilter} className="rounded-[9px] border border-white/[0.1] bg-[#101b30] px-3 py-2 text-xs text-slate-300 outline-none"><option value="">Todos os depositantes</option>{depositantes.map((dep) => <option key={dep.id} value={dep.id}>{dep.nome}</option>)}</select>}
              <input name="pedido" defaultValue={orderSearchFilter} placeholder="Nº do pedido" className="w-36 rounded-[9px] border border-white/[0.1] bg-[#101b30] px-3 py-2 text-xs text-slate-300 outline-none placeholder:text-slate-500" />
              <button type="submit" className="rounded-[9px] bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-2 text-xs font-bold text-white">Filtrar</button>
            </form>
            <div className="overflow-x-auto"><table className="w-full min-w-[920px] border-collapse text-left"><thead><tr className="bg-[#0e1728]">{["Pedido", "Cliente", "Depositante", "Marketplace", "Itens", "Conferência", "SLA", "Status", ""].map((column) => <th key={column} className="border-b border-white/[0.08] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-500">{column}</th>)}</tr></thead><tbody>{visibleOrders.map((order) => <tr key={order.id} className="border-b border-white/[0.08] transition hover:bg-white/[0.03]">
              <td className="px-5 py-4"><Link href={`/expedicao/${order.id}`} className="font-space text-sm font-bold text-slate-100 hover:text-violet-300">{order.displayNumber}</Link><div className="mt-1 text-[11px] text-slate-500">{order.code}</div></td>
              <td className="px-5 py-4"><div className="max-w-[210px] truncate text-sm font-semibold text-slate-200">{order.customer}</div><div className="text-xs text-slate-500">{order.destination}</div></td>
              <td className="max-w-[180px] truncate px-5 py-4 text-sm font-semibold text-slate-300">{order.depositante}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-300">{order.marketplace || order.storeDisplay || "-"}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-300">{order.itemCount} item(ns)</td>
              <td className="min-w-[150px] px-5 py-4"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: order.status === "CONFERIDO" ? "100%" : order.status === "EM_CONFERENCIA" ? "60%" : "0%" }} /></div><span className="text-xs font-bold text-slate-300">{order.status === "CONFERIDO" ? "100%" : order.status === "EM_CONFERENCIA" ? "60%" : "0%"}</span></div></td>
              <td className="px-5 py-4 text-xs font-bold text-slate-400">{order.ageLabel}</td>
              <td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusStyle(order.status)}`}>{statusLabel(order.status)}</span></td>
              <td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelected(order)} className="text-lg font-bold text-slate-500 hover:text-violet-300">›</button></td>
            </tr>)}</tbody></table></div>
            {!visibleOrders.length && <div className="p-10 text-center text-sm text-slate-500">Nenhum pedido encontrado com os filtros atuais.</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] p-4 text-xs text-slate-500"><span>Exibindo {visibleOrders.length} de {totalOrders} pedidos</span><div className="flex gap-1.5"><Link href={pageHref(Math.max(1, currentPage - 1))} className="rounded-lg border border-white/[0.1] bg-[#0e1728] px-3 py-2">‹</Link><span className="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 px-3 py-2 font-bold text-white">{currentPage}</span><Link href={pageHref(Math.min(totalPages, currentPage + 1))} className="rounded-lg border border-white/[0.1] bg-[#0e1728] px-3 py-2">›</Link></div></div>
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.1] bg-[#101b30] p-5"><h2 className="font-space flex items-center gap-2 text-base font-bold"><ClipboardList size={18} className="text-amber-400" /> Filas operacionais</h2><div className="mt-4 space-y-2">{queues.map((queue) => <div key={queue.status} className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"><div><p className="text-sm font-bold text-slate-200">{queue.label}</p><p className="mt-1 text-xs text-slate-500">{queue.help}</p></div><span className="rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300">{queue.orders}</span></div>)}</div></div>
            <div className="rounded-2xl border border-white/[0.1] bg-[#101b30] p-5"><h2 className="font-space flex items-center gap-2 text-base font-bold"><ListChecks size={18} className="text-violet-400" /> Fluxo obrigatório</h2><div className="mt-4 space-y-2">{["Separação item a item", "Conferência e bipagem da DANFE", "Preparação para romaneio", "Despacho e rastreabilidade"].map((step, index) => <div key={step} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-300"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-300">{index + 1}</span>{step}</div>)}</div></div>
          </section>
        </main>
      </div>

      {selected && <div className="fixed inset-0 z-[70] flex justify-end"><button type="button" aria-label="Fechar detalhes" className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} /><aside className="relative flex h-full w-[460px] max-w-[92vw] flex-col border-l border-white/[0.1] bg-[#0c1526] shadow-2xl"><div className="flex items-start justify-between border-b border-white/[0.08] p-6"><div><p className="text-xs font-bold tracking-[0.12em] text-slate-500">PEDIDO</p><h2 className="font-space mt-2 text-2xl font-bold">{selected.displayNumber}</h2><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusStyle(selected.status)}`}>{statusLabel(selected.status)}</span></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-white/[0.1] bg-[#101b30] p-2 text-slate-400 hover:text-white"><X size={17} /></button></div><div className="flex-1 overflow-y-auto p-6"><div className="rounded-2xl border border-white/[0.1] bg-[#101b30] p-5"><p className="text-xs text-slate-500">Cliente</p><p className="mt-1 text-base font-bold">{selected.customer}</p><p className="mt-1 text-sm text-slate-400">{selected.destination}</p><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-xs text-slate-500">Depositante</p><p className="mt-1 text-sm font-bold">{selected.depositante}</p></div><div><p className="text-xs text-slate-500">Marketplace</p><p className="mt-1 text-sm font-bold">{selected.marketplace || selected.storeDisplay || "-"}</p></div></div></div><div className="mt-5 space-y-3"><p className="font-space text-sm font-bold">Resumo operacional</p><div className="grid grid-cols-2 gap-3">{[["Itens", String(selected.itemCount)], ["Unidades", selected.units], ["Criado em", selected.createdAt], ["Código", selected.code]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.08] bg-[#101b30] p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-200">{value}</p></div>)}</div></div></div><div className="flex gap-2 border-t border-white/[0.08] p-4"><Link href={`/expedicao/${selected.id}`} className="flex-1 rounded-xl border border-white/[0.1] bg-[#101b30] px-3 py-3 text-center text-sm font-bold text-slate-200">Ver pedido</Link><Link href={`/expedicao/separacao/${selected.id}`} className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-3 py-3 text-center text-sm font-bold text-white">Operar</Link></div></aside></div>}
    </div>
  );
}
