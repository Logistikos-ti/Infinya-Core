import { RomaneioDashboard } from "@/components/romaneio/romaneio-dashboard";
import { requireModuleAccess } from "@/lib/auth";
import {
  isRomaneioRecordsSchemaMissing,
  listRomaneioRecordsFromDb,
} from "@/lib/romaneio-records";

type RomaneioPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    transportadora?: string;
    q?: string;
    dataInicial?: string;
    dataFinal?: string;
    feedback?: string;
  }>;
};

export default async function RomaneioPage({ searchParams }: RomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const carrierFilter = params?.transportadora?.trim() ?? "";
  const searchTerm = params?.q?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";

  let schemaMissing = false;
  let records = [] as Awaited<ReturnType<typeof listRomaneioRecordsFromDb>>;

  try {
    records = await listRomaneioRecordsFromDb(user, {
      status: statusFilter || undefined,
      depositanteId: depositanteFilter || undefined,
      carrier: carrierFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      isRomaneioRecordsSchemaMissing({ message: error.message })
    ) {
      schemaMissing = true;
    } else {
      throw error;
    }
  }

  const filteredRecords = searchTerm
    ? records.filter((record) => matchesRomaneioSearch(record, searchTerm))
    : records;

  return (
    <>
      {schemaMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 m-6 mb-0">
          A estrutura persistente do romaneio ainda não existe neste banco. Rode a nova migration do Supabase.
        </div>
      ) : null}
      <RomaneioDashboard records={filteredRecords} />
    </>
  );
}

function matchesRomaneioSearch(
  record: Awaited<ReturnType<typeof listRomaneioRecordsFromDb>>[number],
  term: string,
) {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;

  const orderFields = record.orders.flatMap((order) => [
    order.code,
    order.externalNumber,
    order.customer,
    order.destination,
    order.invoiceNumber,
    order.depositante,
    order.statusLabel,
  ]);

  return [
    record.code,
    record.statusLabel,
    record.carrierName,
    record.transportadoraCnpj,
    record.driverName,
    record.driverDocument,
    record.vehicleModel,
    record.vehiclePlate,
    record.notes,
    ...record.depositantes,
    ...record.destinations,
    ...orderFields,
  ].some((value) => normalizeSearchText(value).includes(normalizedTerm));
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
