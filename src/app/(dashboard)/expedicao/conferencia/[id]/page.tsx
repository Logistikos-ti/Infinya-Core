import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ShippingConferencePanel } from "@/components/shipping/shipping-conference-panel";
import { requireModuleAccess } from "@/lib/auth";
import { listPickingOperatorsFromDb } from "@/lib/shipping-picking";
import { getShippingConferenceOrderFromDb } from "@/lib/shipping-conference";

type ShippingConferenceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function ShippingConferenceDetailPage({
  params,
  searchParams,
}: ShippingConferenceDetailPageProps) {
  const user = await requireModuleAccess("expedicao");
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const feedback = resolvedSearchParams?.feedback?.trim() ?? "";

  const [order, operators] = await Promise.all([
    getShippingConferenceOrderFromDb(user, id),
    listPickingOperatorsFromDb(user),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/expedicao/conferencia"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para fila de conferência
      </Link>

      <ModulePageHeader
        title={`Conferência do pedido ${order.externalNumber}`}
        description="Validação item a item do pedido já separado, antes da liberação final para expedição."
        badge={order.depositante}
      />

      <ShippingConferencePanel
        order={order}
        operators={operators}
        currentUserId={user.id}
        feedback={feedback}
      />
    </div>
  );
}
