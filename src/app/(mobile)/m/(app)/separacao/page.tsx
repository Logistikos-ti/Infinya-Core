import { requireModuleAccess } from "@/lib/auth";
import { listShippingPickingOrdersFromDb } from "@/lib/shipping-picking";
import { SeparacaoListClient } from "./separacao-list-client";

type MobilePickingQueuePageProps = {
  searchParams?: Promise<{
    feedback?: string;
    page?: string;
    perPage?: string;
  }>;
};

export default async function MobilePickingQueuePage({
  searchParams,
}: MobilePickingQueuePageProps) {
  const user = await requireModuleAccess("expedicao");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);
  const orders = await listShippingPickingOrdersFromDb(user);
  const pendingUnits = orders.reduce((sum, order) => sum + order.totalUnits, 0);
  const totalOrders = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedOrders = orders.slice(startIndex, startIndex + perPage);

  return (
    <SeparacaoListClient
      orders={paginatedOrders}
      totalOrders={totalOrders}
      pendingUnits={pendingUnits}
      currentPage={currentPage}
      totalPages={totalPages}
      perPage={perPage}
      feedback={feedback}
    />
  );
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePerPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return [10, 20, 50].includes(parsed) ? parsed : 10;
}
