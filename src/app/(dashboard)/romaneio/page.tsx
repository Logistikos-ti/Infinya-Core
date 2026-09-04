import { RomaneioDashboard } from "@/components/romaneio/romaneio-dashboard";
import { requireModuleAccess } from "@/lib/auth";
import {
  getOrderWeightsByOrderId,
  isRomaneioRecordsSchemaMissing,
  listRomaneioRecordsFromDb,
  listTransportadoraOptionsFromDb,
} from "@/lib/romaneio-records";

type RomaneioPageProps = {
  searchParams?: Promise<{
    status?: string;
    depositante?: string;
    dataInicial?: string;
    dataFinal?: string;
    feedback?: string;
  }>;
};

export default async function RomaneioPage({ searchParams }: RomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const params = searchParams ? await searchParams : undefined;
  const statusFilter = params?.status?.trim() ?? "";
  const dateFrom = params?.dataInicial?.trim() ?? "";
  const dateTo = params?.dataFinal?.trim() ?? "";
  const depositanteFilter =
    user.papel === "DEPOSITANTE" ? user.depositanteId ?? "" : params?.depositante?.trim() ?? "";

  const [recordsResult, transportadoraOptions] = await Promise.all([
    listRomaneioRecordsFromDb(user, {
      status: statusFilter || undefined,
      depositanteId: depositanteFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then((records) => ({ records, schemaMissing: false as const }))
      .catch((error) => {
        if (
          error instanceof Error &&
          isRomaneioRecordsSchemaMissing({ message: error.message })
        ) {
          return {
            records: [] as Awaited<ReturnType<typeof listRomaneioRecordsFromDb>>,
            schemaMissing: true as const,
          };
        }
        throw error;
      }),
    listTransportadoraOptionsFromDb(),
  ]);
  const { records, schemaMissing } = recordsResult;

  // Peso (kg) não vem pronto no pedido -- só nos produtos do catálogo --
  // então é calculado aqui (join com pedidos_expedicao_itens/produtos) e
  // repassado por PEDIDO (não já somado por romaneio): o drawer precisa do
  // peso individual de cada pedido, então o dashboard soma por romaneio
  // quando precisar do total, a partir desta mesma fonte.
  const allOrderIds = records.flatMap((record) => record.orders.map((order) => order.id));
  const weightsByOrderId = await getOrderWeightsByOrderId(allOrderIds);
  const orderWeights = Object.fromEntries(weightsByOrderId);

  return (
    <>
      {schemaMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 m-6 mb-0">
          A estrutura persistente do romaneio ainda não existe neste banco. Rode a nova migration do Supabase.
        </div>
      ) : null}
      <RomaneioDashboard records={records} transportadoraOptions={transportadoraOptions} orderWeights={orderWeights} />
    </>
  );
}
