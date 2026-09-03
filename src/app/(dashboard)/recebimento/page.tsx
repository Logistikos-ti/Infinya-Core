import { requireModuleAccess } from "@/lib/auth";
import { canManageMultipleTenants } from "@/lib/permissions";
import { listReceivingOrdersFromDb, type ReceivingOrderSummary } from "@/lib/receiving";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterDepositanteOptionsByUser } from "@/lib/tenant-scope";
import { ReceivingView, type ReceivingTab } from "@/components/receiving/receiving-view";
import { assignReceivingDock } from "./actions";

type RecebimentoPageProps = {
  searchParams?: Promise<{
    tab?: string;
    depositante?: string;
    q?: string;
    page?: string;
  }>;
};

// Abas visíveis agrupam o enum real de status (7 valores) em 3 etapas do
// fluxo operacional — RASCUNHO e CANCELADO ficam de fora (não fazem parte do
// dia a dia normal de recebimento).
const TAB_STATUSES: Record<ReceivingTab, string[]> = {
  agendados: ["AGUARDANDO"],
  conferencia: ["EM_RECEBIMENTO", "DIVERGENCIA", "QUARENTENA_CORRIGIDA"],
  concluidos: ["RECEBIDO", "RECEBIDO_PARCIAL"],
};

function normalizeTab(value: string | undefined): ReceivingTab {
  return value === "conferencia" || value === "concluidos" ? value : "agendados";
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function matchesSearch(order: ReceivingOrderSummary, term: string) {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return true;
  return [order.code, order.depositante, order.supplier, order.noteNumber].some(
    (value) => normalizeSearchText(value).includes(normalizedTerm),
  );
}

// Data de hoje em SP (UTC-3) no formato YYYY-MM-DD, para o KPI "Agendados hoje".
function todaySpDateString() {
  const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
  return new Date(Date.now() - SP_OFFSET_MS).toISOString().slice(0, 10);
}

export default async function RecebimentoPage({ searchParams }: RecebimentoPageProps) {
  const user = await requireModuleAccess("recebimento");
  const params = searchParams ? await searchParams : undefined;
  const tab = normalizeTab(params?.tab);
  const depositanteFilter = params?.depositante?.trim() ?? "";
  const searchTerm = params?.q?.trim() ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = 10;
  const effectiveDepositanteFilter =
    user.papel === "DEPOSITANTE" ? (user.depositanteId ?? "") : depositanteFilter;

  const canFilterByDepositante = canManageMultipleTenants(user);
  const supabase = await createSupabaseServerClient();
  const [depositantesRes, allOrders] = await Promise.all([
    canFilterByDepositante
      ? supabase.from("depositantes").select("id, nome").order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    // Um único fetch sem filtro de aba/status — os KPIs e as 3 listas de aba
    // são todos derivados dele em memória, evitando 4 round-trips separados.
    listReceivingOrdersFromDb({
      depositanteId: effectiveDepositanteFilter || undefined,
    }),
  ]);

  const depositanteOptions = filterDepositanteOptionsByUser(user, depositantesRes.data ?? []);

  const today = todaySpDateString();
  const kpis = {
    agendadosHoje: allOrders.filter(
      (o) => o.status === "AGUARDANDO" && (o.etaRaw ?? "").slice(0, 10) === today,
    ).length,
    emConferencia: allOrders.filter((o) => o.status === "EM_RECEBIMENTO").length,
    comDivergencia: allOrders.filter(
      (o) => o.status === "DIVERGENCIA" || o.status === "QUARENTENA_CORRIGIDA",
    ).length,
    itensRecebidosMes: allOrders
      .filter((o) => o.createdAtIso.slice(0, 7) === today.slice(0, 7))
      .reduce((sum, o) => sum + o.receivedCount, 0),
  };

  const tabCounts: Record<ReceivingTab, number> = {
    agendados: allOrders.filter((o) => TAB_STATUSES.agendados.includes(o.status)).length,
    conferencia: allOrders.filter((o) => TAB_STATUSES.conferencia.includes(o.status)).length,
    concluidos: allOrders.filter((o) => TAB_STATUSES.concluidos.includes(o.status)).length,
  };

  const tabOrders = allOrders
    .filter((o) => TAB_STATUSES[tab].includes(o.status))
    .filter((o) => matchesSearch(o, searchTerm));

  const totalOrders = tabOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const pageOrders = tabOrders.slice(startIndex, startIndex + perPage);

  return (
    <ReceivingView
      orders={pageOrders}
      depositanteOptions={depositanteOptions}
      showDepositanteFilter={canFilterByDepositante}
      tab={tab}
      tabCounts={tabCounts}
      search={searchTerm}
      depositanteFilter={effectiveDepositanteFilter}
      kpis={kpis}
      page={currentPage}
      totalPages={totalPages}
      totalOrders={totalOrders}
      perPage={perPage}
      assignDockAction={assignReceivingDock}
    />
  );
}
