import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { LancamentoForm } from "@/components/financeiro/lancamento-form";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDateTime(isoStr: string) {
  return new Date(isoStr).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
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

const origemColors: Record<string, string> = {
  AUTOMATICO: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  MANUAL: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  CRON: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
  ESTORNO: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type LancamentosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function LancamentosPage({ searchParams }: LancamentosPageProps) {
  await requireModuleAccess("financeiro");

  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;

  const admin = createSupabaseAdminClient();
  const mesAno = new Date().toISOString().slice(0, 7);

  const [depositantesRes, lancamentosRes] = await Promise.all([
    admin
      .from("depositantes")
      .select("id, nome, ativo")
      .eq("ativo", true)
      .order("nome"),
    admin
      .from("lancamentos")
      .select("*, depositantes(nome)")
      .eq("estornado", false)
      .eq("mes_ano", mesAno)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const depositantes = depositantesRes.data ?? [];
  const lancamentos = lancamentosRes.data ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/financeiro"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao financeiro
      </Link>

      <ModulePageHeader
        title="Lançamentos"
        description="Crie cobranças ou descontos manuais para qualquer depositante"
        badge="Manual"
      />

      {feedback === "criado" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Lançamento criado com sucesso.
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.45fr]">
        {/* Formulário */}
        <div>
          <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-zinc-100">
            Novo lançamento
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-zinc-400">
            O lançamento será vinculado à fatura do mês atual automaticamente.
          </p>
          <LancamentoForm depositantes={depositantes} />
        </div>

        {/* Lista */}
        <div>
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-zinc-100">
            Lançamentos do mês ({lancamentos.length})
          </h2>

          {lancamentos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center dark:border-zinc-700">
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Nenhum lançamento registrado neste mês.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-900">
                    <tr className="text-slate-400 dark:text-zinc-500">
                      <th className="px-4 py-2.5 font-medium">Depositante</th>
                      <th className="px-3 py-2.5 font-medium">Tipo</th>
                      <th className="px-3 py-2.5 font-medium">Descrição</th>
                      <th className="px-3 py-2.5 font-medium">Origem</th>
                      <th className="px-3 py-2.5 text-right font-medium">Qtd</th>
                      <th className="px-3 py-2.5 text-right font-medium">Unit.</th>
                      <th className="px-4 py-2.5 text-right font-medium">Total</th>
                      <th className="px-4 py-2.5 text-right font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map((l) => {
                      const depNome =
                        (l.depositantes as { nome?: string } | null)?.nome ?? "—";
                      return (
                        <tr
                          key={l.id}
                          className="border-t border-slate-100 dark:border-zinc-800/50"
                        >
                          <td className="px-4 py-2 font-medium text-slate-700 dark:text-zinc-300">
                            {depNome}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                            {labelServico[l.tipo_servico as string] ?? l.tipo_servico}
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-2 text-slate-600 dark:text-zinc-400">
                            {l.descricao}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${origemColors[l.origem as string] ?? ""}`}
                            >
                              {l.origem}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500 dark:text-zinc-400">
                            {Number(l.quantidade)}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500 dark:text-zinc-400">
                            {formatCurrency(Number(l.valor_unitario))}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-zinc-100">
                            {formatCurrency(Number(l.valor_total))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-right text-slate-400 dark:text-zinc-500">
                            {formatDateTime(l.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
