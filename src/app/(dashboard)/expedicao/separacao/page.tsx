import Link from "next/link";
import { ArrowLeft, PackageCheck, ScanSearch, TriangleAlert, UserRound } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireModuleAccess } from "@/lib/auth";
import { listPickingOperatorsFromDb, listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type ExpedicaoSeparacaoPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    operador?: string;
    feedback?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "NOVO", label: "Aguardando início" },
  { value: "EM_SEPARACAO", label: "Em separação" },
  { value: "SEPARADO", label: "Separado" },
] as const;

export default async function ExpedicaoSeparacaoPage({
  searchParams,
}: ExpedicaoSeparacaoPageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const operatorFilter = params?.operador?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";
  const feedback = params?.feedback?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const { data: depositantes } = await supabase.from("depositantes").select("id, nome").order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);

  const [orders, operators] = await Promise.all([
    listShippingPickingOrdersFromDb(user, {
      status: statusFilter || undefined,
      depositanteId: depositanteFilter || undefined,
      operatorId: operatorFilter || undefined,
    }),
    listPickingOperatorsFromDb(user, depositanteFilter || undefined),
  ]);

  const pendingOrders = orders.filter((order) => order.status === "NOVO").length;
  const runningOrders = orders.filter((order) => order.status === "EM_SEPARACAO").length;
  const shortageOrders = orders.filter((order) => order.shortageUnits > 0).length;

  return (
    <div className="space-y-6">
      <Link
        href="/expedicao"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para expedição
      </Link>

      <ModulePageHeader
        title="Tela de separação"
        description="Picking list por operador, com rota sugerida no armazém, leitura de código de barras e apontamento das quantidades separadas."
        badge="Semana 6"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "salvo" || feedback === "concluido"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {feedback === "salvo"
            ? "Andamento da separação salvo com sucesso."
            : feedback === "concluido"
              ? "Separação concluída e pedido movido para o próximo passo."
              : feedback === "incompleto"
                ? "Ainda existem itens pendentes. Salvei o andamento, mas o pedido não foi concluído."
                : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={PackageCheck} label="Pedidos na fila" value={String(orders.length)} />
        <StatTile icon={ScanSearch} label="Aguardando início" value={String(pendingOrders)} />
        <StatTile icon={UserRound} label="Em separação" value={String(runningOrders)} />
        <StatTile icon={TriangleAlert} label="Com falta de saldo" value={String(shortageOrders)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Filtro operacional</h2>
          <p className="text-sm text-slate-600">
            Use operador, depositante e status para montar a fila de picking do turno.
          </p>
        </div>

        <form className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "todos"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Operador</span>
            <select
              name="operador"
              defaultValue={operatorFilter}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="">Todos</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Depositante</span>
            <select
              name="depositante"
              defaultValue={depositanteFilter}
              disabled={user.papel === "DEPOSITANTE"}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Todos</option>
              {depositanteOptions.map((depositante) => (
                <option key={depositante.id} value={depositante.id}>
                  {depositante.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <Button type="submit" className="h-11 bg-slate-950 text-white hover:bg-slate-800">
              Aplicar
            </Button>
            <Link
              href="/expedicao/separacao"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      <section className="space-y-6">
        {orders.length ? (
          orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                      {order.statusLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {order.depositante}
                    </span>
                    {order.shortageUnits > 0 ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        Pendentes: {order.shortageUnits} un
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{order.externalNumber}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {order.customer} • {order.destination}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Código interno {order.code}</span>
                    <span>{order.totalItems} item(ns)</span>
                    <span>{order.totalUnits} unidade(s)</span>
                    <span>{order.routeStopCount} parada(s)</span>
                    <span>{order.completionPercent}% concluído</span>
                    <span>Operador: {order.assignedOperatorName ?? "Não atribuído"}</span>
                  </div>
                </div>

                <Link
                  href={`/expedicao/separacao/${order.id}`}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Iniciar separação
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Nenhum pedido disponível para separação com os filtros atuais.
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PackageCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-full bg-sky-50 p-3 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
