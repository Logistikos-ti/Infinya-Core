import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  FileText,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getMesAnoAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMesAno(mesAno: string) {
  const [year, month] = mesAno.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[Number(month) - 1]} ${year}`;
}

export default async function FinanceiroPage() {
  await requireModuleAccess("financeiro");

  const admin = createSupabaseAdminClient();
  const mesAtual = getMesAnoAtual();

  const [faturasRes, lancamentosRes, contratosRes, origemRes] = await Promise.all([
    admin.from("faturas").select("*").order("mes_ano", { ascending: false }).limit(50),
    admin
      .from("lancamentos")
      .select("tipo_servico, valor_total, depositante_id, origem")
      .eq("mes_ano", mesAtual)
      .eq("estornado", false),
    admin.from("contratos_cobranca").select("id, depositante_id, ativo").eq("ativo", true),
    admin
      .from("lancamentos")
      .select("origem, valor_total")
      .eq("mes_ano", mesAtual)
      .eq("estornado", false),
  ]);

  const faturas = faturasRes.data ?? [];
  const lancamentos = lancamentosRes.data ?? [];
  const contratos = contratosRes.data ?? [];

  const origemStats = (origemRes.data ?? []).reduce<Record<string, { count: number; total: number }>>((acc, l) => {
    const o = (l.origem as string) ?? "OUTRO";
    if (!acc[o]) acc[o] = { count: 0, total: 0 };
    acc[o].count++;
    acc[o].total += Number(l.valor_total);
    return acc;
  }, {});

  const faturasMesAtual = faturas.filter((f) => f.mes_ano === mesAtual);
  const totalMesAtual = lancamentos.reduce((sum, l) => sum + Number(l.valor_total), 0);
  const depositantesComLancamento = new Set(lancamentos.map((l) => l.depositante_id)).size;
  const faturasFechadas = faturas.filter((f) => f.status === "FECHADA" || f.status === "ENVIADA").length;

  const totaisPorServico: Record<string, number> = {};
  for (const l of lancamentos) {
    const tipo = l.tipo_servico as string;
    totaisPorServico[tipo] = (totaisPorServico[tipo] ?? 0) + Number(l.valor_total);
  }

  const labelServico: Record<string, string> = {
    FULFILLMENT: "Fulfillment",
    PONTO_COLETA: "Ponto de Coleta",
    IMPRESSAO_NF: "Impressão NF",
    GESTAO_FRETE: "Gestão de Frete",
    RECEBIMENTO: "Recebimento",
    ARMAZENAMENTO: "Armazenamento",
    INSUMO: "Insumos",
    LOGISTICA_REVERSA: "Logística Reversa",
    SOFTWARE: "Software",
    REFRIGERADOR: "Refrigerador",
    DESCONTO: "Desconto",
    COBRANCA_EXTRA: "Cobrança Extra",
  };

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Financeiro"
        description="Cobranças em tempo real, contratos e faturas"
        badge={formatMesAno(mesAtual)}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Receita do mês"
          value={formatCurrency(totalMesAtual)}
          help="Valor acumulado em lançamentos no mês atual"
          icon={TrendingUp}
        />
        <StatCard
          label="Depositantes ativos"
          value={String(depositantesComLancamento)}
          help="Com lançamentos neste mês"
          icon={CircleDollarSign}
        />
        <StatCard
          label="Contratos ativos"
          value={String(contratos.length)}
          help="Total de contratos cadastrados"
          icon={FileText}
        />
        <StatCard
          label="Faturas fechadas"
          value={String(faturasFechadas)}
          help="Faturas fechadas ou enviadas"
          icon={Receipt}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/financeiro/contratos"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Contratos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/financeiro/lancamentos"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Lançamentos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/financeiro/insumos"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Insumos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Composição por serviço */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              Composição {formatMesAno(mesAtual)}
            </h2>
          </div>
          {Object.keys(totaisPorServico).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Nenhum lançamento registrado neste mês.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(totaisPorServico)
                .sort(([, a], [, b]) => b - a)
                .map(([tipo, total]) => {
                  const percent = totalMesAtual > 0 ? (total / totalMesAtual) * 100 : 0;
                  return (
                    <div key={tipo}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-zinc-300">
                          {labelServico[tipo] ?? tipo}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-zinc-100">
                          {formatCurrency(total)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Faturas recentes */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              Faturas recentes
            </h2>
            <Link
              href="/financeiro/contratos"
              className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
            >
              Contratos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {faturas.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Nenhuma fatura encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {faturas.slice(0, 10).map((fatura) => {
                const statusColors: Record<string, string> = {
                  ABERTA: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                  FECHADA: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                  ENVIADA: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                  PAGO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                };
                const depositanteNome =
                  (fatura as Record<string, unknown>).depositantes &&
                  typeof (fatura as Record<string, unknown>).depositantes === "object"
                    ? ((fatura as Record<string, unknown>).depositantes as { nome?: string })?.nome
                    : null;

                return (
                  <Link
                    key={fatura.id}
                    href={`/financeiro/faturas/${fatura.id}`}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100">
                        {depositanteNome ?? "—"} · {formatMesAno(fatura.mes_ano)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {formatCurrency(Number(fatura.total_a_pagar))}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[fatura.status] ?? ""}`}
                    >
                      {fatura.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {Object.keys(origemStats).length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-zinc-100">
            Origem dos lançamentos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(origemStats)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([origem, stats]) => {
                const origemColors: Record<string, string> = {
                  AUTOMATICO: "border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20",
                  MANUAL: "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20",
                  CRON: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20",
                  ESTORNO: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20",
                };
                const origemLabels: Record<string, string> = {
                  AUTOMATICO: "Automático (Bling/webhooks)",
                  MANUAL: "Manual",
                  CRON: "Cron (mensal)",
                  ESTORNO: "Estorno",
                };
                return (
                  <div key={origem} className={`rounded-xl border p-4 ${origemColors[origem] ?? "border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50"}`}>
                    <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                      {origemLabels[origem] ?? origem}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-zinc-100">
                      {formatCurrency(stats.total)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">
                      {stats.count} lançamento{stats.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
