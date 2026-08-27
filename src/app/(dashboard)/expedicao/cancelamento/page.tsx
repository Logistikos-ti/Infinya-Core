import Link from "next/link";
import { AlertTriangle, ScanLine } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireModuleAccess } from "@/lib/auth";
import { formatWmsOrderNumber } from "@/lib/shipping-order-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Relation<T> = T | T[] | null;

function firstRelation<T>(value: Relation<T>) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function ShippingCancellationQueuePage() {
  await requireModuleAccess("expedicao");

  const supabase = createSupabaseAdminClient();
  const { data: cancelamentos } = await supabase
    .from("pedidos_expedicao_cancelamentos")
    .select(
      "id, motivo, aberto_em, pedido:pedidos_expedicao(id, codigo, numero_wms, cliente_nome, depositante:depositantes(nome))",
    )
    .eq("status", "EM_ANDAMENTO")
    .order("aberto_em", { ascending: true });

  const rows = (cancelamentos ?? []).map((item) => {
    const order = firstRelation(item.pedido);
    const depositante = firstRelation(order?.depositante ?? null);

    return {
      id: item.id,
      motivo: item.motivo,
      abertoEm: item.aberto_em,
      orderNumber: order
        ? formatWmsOrderNumber(order.numero_wms, order.codigo, depositante?.nome ?? null)
        : "Pedido não encontrado",
      depositante: depositante?.nome?.trim() || "Sem depositante",
      cliente: order?.cliente_nome?.trim() || "Cliente não informado",
    };
  });

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Cancelamentos pendentes"
        description="Pedidos aguardando a bipagem obrigatória de devolução ao estoque antes de virarem cancelados."
        badge="Expedição"
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        {rows.length ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`/expedicao/cancelamento/${row.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-primary-400 hover:bg-primary-500/5 dark:border-zinc-800 dark:hover:border-primary-500"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">{row.orderNumber}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {row.depositante} · {row.cliente}
                    </p>
                    {row.motivo ? (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{row.motivo}</p>
                    ) : null}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/10 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
                  <ScanLine className="h-3.5 w-3.5" />
                  Bipar devolução
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum cancelamento aguardando bipagem no momento.
          </p>
        )}
      </section>
    </div>
  );
}
