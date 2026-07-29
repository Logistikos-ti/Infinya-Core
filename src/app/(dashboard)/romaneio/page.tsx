import Link from "next/link";
import type { ReactNode } from "react";
import { FileDown, Layers3, Route, Truck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { RomaneioFiltersForm } from "@/components/romaneio/romaneio-filters-form";
import { RomaneioDashboard } from "@/components/romaneio/romaneio-dashboard";
import { requireModuleAccess } from "@/lib/auth";
import {
  isRomaneioRecordsSchemaMissing,
  listRomaneioRecordsFromDb,
  listRomaneioSuggestionsFromDb,
} from "@/lib/romaneio-records";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { createRomaneioRecordAction } from "./actions";

type RomaneioPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    transportadora?: string;
    dataInicial?: string;
    dataFinal?: string;
    feedback?: string;
  }>;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "ABERTO", label: "Abertos" },
  { value: "LIBERADO", label: "Liberados" },
  { value: "CANCELADO", label: "Cancelados" },
] as const;

export default async function RomaneioPage({ searchParams }: RomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback?.trim() ?? "";
  const statusFilter = params?.status?.trim() ?? "";
  const carrierFilter = params?.transportadora?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";

  const supabase = createSupabaseAdminClient();
  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, nome")
    .order("nome");
  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantes ?? []);
  const depositanteSelectOptions = [
    { value: "", label: "Todos" },
    ...depositanteOptions.map((depositante) => ({
      value: depositante.id,
      label: depositante.nome,
    })),
  ];

  let schemaMissing = false;
  let records = [] as Awaited<ReturnType<typeof listRomaneioRecordsFromDb>>;
  let suggestions = [] as Awaited<ReturnType<typeof listRomaneioSuggestionsFromDb>>;

  try {
    [records, suggestions] = await Promise.all([
      listRomaneioRecordsFromDb(user, {
        status: statusFilter || undefined,
        depositanteId: depositanteFilter || undefined,
        carrier: carrierFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
      listRomaneioSuggestionsFromDb(user, {
        depositanteId: depositanteFilter || undefined,
        carrier: carrierFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    ]);
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

  const activeRecords = records.filter((item) => item.status === "ABERTO");
  const totalOrdersInRecords = records.reduce((sum, item) => sum + item.orderCount, 0);
  const totalOrdersInSuggestions = suggestions.reduce((sum, item) => sum + item.orderCount, 0);

  return (
    <>
      {schemaMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 m-6 mb-0">
          A estrutura persistente do romaneio ainda não existe neste banco. Rode a nova migration do Supabase.
        </div>
      ) : null}
      <RomaneioDashboard />
    </>
  );
}
