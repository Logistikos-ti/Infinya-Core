import type { RomaneioRecordListItem } from "@/lib/romaneio-records";

/**
 * Funções puras de string, sem nenhum import server-only -- romaneio-records.ts
 * importa createSupabaseAdminClient (admin, server-only) e tem ~900 linhas;
 * um client component que importasse dele puxaria esse grafo inteiro pro
 * bundle. Mantido separado por isso (mesmo motivo documentado em
 * receiving-constants.ts para o caso do recebimento).
 */
export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function matchesRomaneioSearch(record: RomaneioRecordListItem, term: string) {
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
