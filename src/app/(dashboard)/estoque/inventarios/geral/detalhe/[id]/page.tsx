import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Boxes, Download, PackageSearch, TriangleAlert, User } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { GeneralInventoryStartButton } from "@/components/estoque/general-inventory-start-button";
import { requireModuleAccess } from "@/lib/auth";
import { getGeneralInventory } from "@/lib/general-inventories";

type PageProps = {
  params: Promise<{ id: string }>;
};

// Inventário geral, ao contrário da contagem cíclica, hoje só é endereçável
// por depositante ("o de hoje") -- essa página dá uma URL estável por id
// pra um inventário específico, seja ele programado ou já concluído (o
// bipador de verdade continua em /estoque/inventarios/geral/[depositanteId]).
export default async function EstoqueInventarioGeralDetalhePage({ params }: PageProps) {
  await requireModuleAccess("estoque");
  const { id } = await params;

  const detail = await getGeneralInventory(id);
  if (!detail) {
    notFound();
  }

  if (detail.status === "EM_CONTAGEM") {
    redirect(`/estoque/inventarios/geral/${detail.depositanteId}`);
  }

  if (detail.status === "PROGRAMADO") {
    return (
      <div className="space-y-6">
        <Link
          href="/estoque/inventarios"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para inventário
        </Link>

        <ModulePageHeader
          title={`Inventário geral — ${detail.depositante}`}
          description={`Programado para ${detail.programadoPara ? new Date(detail.programadoPara).toLocaleString("pt-BR") : "data a definir"}.`}
          badge="Programado"
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-900 dark:text-white">Responsável:</span>{" "}
            {detail.responsavelNome ?? "Não atribuído"}
          </p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            O saldo do estoque é capturado no momento em que o inventário é iniciado, não na hora
            em que foi programado — assim os itens refletem o estoque real do dia da contagem.
          </p>
          <div className="mt-5">
            <GeneralInventoryStartButton inventoryId={detail.id} depositanteId={detail.depositanteId} />
          </div>
        </section>
      </div>
    );
  }

  // CONCLUIDO ou CANCELADO: resumo somente leitura.
  return (
    <div className="space-y-6">
      <Link
        href="/estoque/inventarios"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para inventário
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
          title={`Inventário geral — ${detail.depositante}`}
          description={`Contagem completa do depositante, ${detail.status === "CONCLUIDO" ? "concluída" : "cancelada"}${detail.concluidoEm ? ` em ${detail.concluidoEm}` : ""}.`}
          badge={detail.status === "CONCLUIDO" ? "Concluído" : "Cancelado"}
        />
      </div>

      {detail.status === "CONCLUIDO" ? (
        <Link
          href={`/api/estoque/inventarios-gerais/${detail.id}/relatorio`}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-900"
        >
          <Download className="h-4 w-4" />
          Baixar relatório (CSV)
        </Link>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label="Itens" value={String(detail.totalItens)} help={`Início ${detail.iniciadoEm ?? "-"}`} />
        <StatCard icon={PackageSearch} label="Contados" value={String(detail.contados)} help="Itens fechados" />
        <StatCard icon={TriangleAlert} label="Divergentes" value={String(detail.divergentes)} help="Diferença entre contado e sistema" />
        <StatCard icon={User} label="Responsável" value={detail.responsavelNome ?? "—"} help="Atribuído na criação" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Itens do inventário</h2>
        <div className="mt-5 space-y-3">
          {detail.itens.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {item.sku} • {item.nome}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.enderecos.join(", ") || "Sem endereço"}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {item.status}
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                <p>Sistema: {item.quantidadeSistema}</p>
                <p>Contado: {item.quantidadeContada ?? "-"}</p>
                <p>Divergência: {item.divergencia}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
