import Link from "next/link";
import { ArrowLeft, Boxes, FileText, PackageCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { MobileReceivingPanel } from "@/components/mobile/mobile-receiving-panel";
import { requireModuleAccess } from "@/lib/auth";
import { getReceivingOrderDetailFromDb } from "@/lib/receiving";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MobileReceivingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MobileReceivingDetailPage({
  params,
}: MobileReceivingDetailPageProps) {
  await requireModuleAccess("recebimento");
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [order, addresses] = await Promise.all([
    getReceivingOrderDetailFromDb(id),
    supabase
      .from("enderecos")
      .select("id, codigo, area")
      .eq("ativo", true)
      .neq("area", "BLOQUEADO")
      .order("codigo"),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link
        href="/m/recebimento"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para recebimento
      </Link>

      <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Pedido de recebimento
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{order.code}</h1>
            <p className="mt-2 text-sm text-slate-300">{order.depositante}</p>
            <p className="mt-1 text-sm text-slate-400">{order.supplier}</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
            {order.status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <InfoCard label="Previsão" value={order.eta} icon={FileText} />
          <InfoCard label="Volumes" value={String(order.volumes)} icon={Boxes} />
          <InfoCard label="SKUs" value={String(order.skuCount)} icon={PackageCheck} />
          <InfoCard label="NF" value={order.noteNumber} icon={FileText} />
        </div>
      </section>

      <MobileReceivingPanel
        orderId={order.id}
        initialItems={order.items}
        addresses={addresses.data ?? []}
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center gap-2 text-slate-300">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
