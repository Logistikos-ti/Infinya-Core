import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth";
import { MobilePickingPanel } from "@/components/mobile/mobile-picking-panel";
import { getShippingPickingOrderFromDb, listPickingOperatorsFromDb } from "@/lib/shipping-picking";

type MobilePickingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MobilePickingDetailPage({ params }: MobilePickingDetailPageProps) {
  const user = await requireModuleAccess("expedicao");
  const { id } = await params;

  const [order, operators] = await Promise.all([
    getShippingPickingOrderFromDb(user, id),
    listPickingOperatorsFromDb(user),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link href="/m/separacao" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a fila
      </Link>

      <MobilePickingPanel order={order} operators={operators} currentUserId={user.id} />
    </div>
  );
}
