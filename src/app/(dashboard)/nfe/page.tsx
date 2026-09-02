import { NfeWorkspace } from "@/components/nfe/nfe-workspace";
import { requireModuleAccess } from "@/lib/auth";
import { listFiscalDocumentDetails, listFiscalDocumentMonths } from "@/lib/fiscal-documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";

type NfePageProps = {
  searchParams?: Promise<{ mes?: string }>;
};

function currentMonthKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export default async function NfePage({ searchParams }: NfePageProps) {
  const user = await requireModuleAccess("nfe");
  const params = searchParams ? await searchParams : undefined;
  const isDepositante = user.papel === "DEPOSITANTE";
  const depositanteScope = isDepositante ? user.depositanteId ?? undefined : undefined;

  const supabase = await createSupabaseServerClient();

  const [{ data: depositantes }, availableMonths] = await Promise.all([
    supabase.from("depositantes").select("id, nome").order("nome"),
    listFiscalDocumentMonths(user, { depositanteId: depositanteScope }),
  ]);

  // Mês selecionado: o da URL (?mes=YYYY-MM) se válido; senão o mês atual (se
  // tiver registros) ou o mês mais recente com NF-e.
  const current = currentMonthKey();
  const requested = params?.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : null;
  const selectedMonth =
    requested ?? (availableMonths.includes(current) ? current : availableMonths[0] ?? current);

  const documents = await listFiscalDocumentDetails(user, {
    depositanteId: depositanteScope,
    month: selectedMonth,
  });

  const depositanteOptions = filterDepositanteOptionsByUser(
    user,
    (depositantes ?? []).map((item) => ({ id: item.id, nome: item.nome })),
  );

  return (
    <NfeWorkspace
      documents={documents}
      depositanteOptions={depositanteOptions}
      canFilterDepositante={!isDepositante}
      availableMonths={availableMonths}
      selectedMonth={selectedMonth}
    />
  );
}
