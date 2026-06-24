import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { MobileConferencePanel } from "@/components/mobile/mobile-conference-panel";
import { requireModuleAccess } from "@/lib/auth";
import { listPickingOperatorsFromDb } from "@/lib/shipping-picking";
import { getShippingConferenceOrderFromDb } from "@/lib/shipping-conference";

type MobileConferenceDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ feedback?: string }>;
};

export default async function MobileConferenceDetailPage({
  params,
  searchParams,
}: MobileConferenceDetailPageProps) {
  const user = await requireModuleAccess("expedicao");
  const { id } = await params;
  const feedback = (searchParams ? await searchParams : undefined)?.feedback?.trim() ?? "";

  const [order, operators] = await Promise.all([
    getShippingConferenceOrderFromDb(user, id),
    listPickingOperatorsFromDb(user),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link href="/m/conferencia" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a fila
      </Link>

      <MobileConferencePanel
        order={order}
        operators={operators}
        currentUserId={user.id}
        feedback={feedback}
      />
    </div>
  );
}
