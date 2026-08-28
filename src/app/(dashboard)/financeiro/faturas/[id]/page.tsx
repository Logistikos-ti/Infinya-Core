import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { FaturaUpload } from "@/components/financeiro/fatura-upload";
import { FaturaEnviar } from "@/components/financeiro/fatura-enviar";
import { FinScope, FinBadge, FIN_HEADING } from "@/components/financeiro/fin-ui";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMesAno(mesAno: string) {
  const [year, month] = mesAno.split("-");
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[Number(month) - 1]} ${year}`;
}

function formatDateTime(isoStr: string | null) {
  if (!isoStr) return "—";
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
  CANCELAMENTO: "Cancelamento",
  RETIRADA: "Retirada",
  DESCARTE: "Descarte",
  SOFTWARE: "Software",
  REFRIGERADOR: "Refrigerador",
  DESCONTO: "Desconto",
  COBRANCA_EXTRA: "Cobrança Extra",
};

type RouteParams = { params: Promise<{ id: string }> };

export default async function FaturaDetailPage({ params }: RouteParams) {
  await requireModuleAccess("financeiro");

  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: fatura } = await admin
    .from("faturas")
    .select("*, depositantes(id, nome, cnpj)")
    .eq("id", id)
    .single();

  if (!fatura) redirect("/financeiro");

  const { data: lancamentos } = await admin
    .from("lancamentos")
    .select("*")
    .eq("fatura_id", id)
    .eq("estornado", false)
    .order("tipo_servico")
    .order("created_at");

  const items = lancamentos ?? [];
  const dep = fatura.depositantes as { id?: string; nome?: string; cnpj?: string } | null;

  const agrupado: Record<string, { items: typeof items; total: number }> = {};
  for (const l of items) {
    const tipo = l.tipo_servico as string;
    if (!agrupado[tipo]) agrupado[tipo] = { items: [], total: 0 };
    agrupado[tipo].items.push(l);
    agrupado[tipo].total += Number(l.valor_total);
  }

  return (
    <FinScope>
      <Link
        href="/financeiro"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao financeiro
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={`${FIN_HEADING} text-2xl font-bold text-slate-900 dark:text-zinc-100`}>
            Fatura · {dep?.nome ?? "—"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{formatMesAno(fatura.mes_ano)}</p>
        </div>
        <FinBadge status={fatura.status} />
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#101B30]">
          <p className="text-xs text-slate-400 dark:text-zinc-500">Total Serviços</p>
          <p className={`${FIN_HEADING} text-xl font-bold text-slate-900 dark:text-zinc-100`}>
            {formatCurrency(Number(fatura.total_servicos))}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#101B30]">
          <p className="text-xs text-slate-400 dark:text-zinc-500">Descontos</p>
          <p className={`${FIN_HEADING} text-xl font-bold text-red-500`}>
            - {formatCurrency(Number(fatura.total_descontos))}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Total a Pagar</p>
          <p className={`${FIN_HEADING} text-xl font-bold text-emerald-600 dark:text-emerald-400`}>
            {formatCurrency(Number(fatura.total_a_pagar))}
          </p>
        </div>
      </section>

      {fatura.fechado_em && (
        <p className="text-xs text-slate-400 dark:text-zinc-500">
          Fechado em {formatDateTime(fatura.fechado_em)}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <FaturaUpload
          faturaId={fatura.id}
          tipo="boleto"
          label="Boleto"
          currentUrl={fatura.boleto_url}
          currentNome={fatura.boleto_nome}
        />
        <FaturaUpload
          faturaId={fatura.id}
          tipo="nf"
          label="Nota Fiscal"
          currentUrl={fatura.nf_url}
          currentNome={fatura.nf_nome}
        />
      </section>

      {fatura.status !== "ABERTA" && (
        <FaturaEnviar faturaId={fatura.id} status={fatura.status} />
      )}

      <div className="space-y-4">
        <h2 className={`${FIN_HEADING} text-lg font-bold text-slate-900 dark:text-zinc-100`}>
          Lançamentos ({items.length})
        </h2>

        {Object.entries(agrupado)
          .sort(([, a], [, b]) => b.total - a.total)
          .map(([tipo, grupo]) => (
            <div
              key={tipo}
              className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#101B30]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-white/10">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  {labelServico[tipo] ?? tipo}
                  <span className="ml-2 text-xs font-normal text-slate-400 dark:text-zinc-500">
                    ({grupo.items.length})
                  </span>
                </h3>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-zinc-100">
                  {formatCurrency(grupo.total)}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-[#0E1728]">
                    <tr className="text-slate-400 dark:text-zinc-500">
                      <th className="px-5 py-2 font-medium">Descrição</th>
                      <th className="px-3 py-2 text-right font-medium">Qtd</th>
                      <th className="px-3 py-2 text-right font-medium">Unitário</th>
                      <th className="px-5 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map((l) => (
                      <tr
                        key={l.id}
                        className="border-t border-slate-50 dark:border-white/5"
                      >
                        <td className="px-5 py-2 text-slate-700 dark:text-zinc-300">
                          {l.descricao}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500 dark:text-zinc-400">
                          {Number(l.quantidade)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500 dark:text-zinc-400">
                          {formatCurrency(Number(l.valor_unitario))}
                        </td>
                        <td className="px-5 py-2 text-right font-mono font-bold text-slate-900 dark:text-zinc-100">
                          {formatCurrency(Number(l.valor_total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>
    </FinScope>
  );
}
