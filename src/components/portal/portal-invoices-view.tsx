"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CircleDollarSign,
  FileText,
  Loader2,
  Receipt,
  TrendingUp,
} from "lucide-react";

type Lancamento = {
  id: string;
  tipo_servico: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  created_at: string;
};

type Fatura = {
  id: string;
  mes_ano: string;
  status: string;
  total_servicos: number;
  total_descontos: number;
  total_a_pagar: number;
  boleto_url: string | null;
  nf_url: string | null;
};

type PortalFaturasData = {
  faturas: Fatura[];
  lancamentosMesAtual: Lancamento[];
  resumoMesAtual: Record<string, { qtd: number; total: number }>;
  totalMesAtual: number;
};

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMesAno(mesAno: string) {
  const [year, month] = mesAno.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[Number(month) - 1]} ${year}`;
}

function formatDateTime(isoStr: string) {
  return new Date(isoStr).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function PortalInvoicesView({ depositanteId }: { depositanteId: string }) {
  const [data, setData] = useState<PortalFaturasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLancamentos, setShowLancamentos] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/faturas?depositante_id=${depositanteId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [depositanteId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-[#101b30]">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Não foi possível carregar as faturas.
        </p>
      </div>
    );
  }

  const resumoEntries = Object.entries(data.resumoMesAtual).sort(
    ([, a], [, b]) => b.total - a.total,
  );

  const statusColors: Record<string, string> = {
    ABERTA: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    FECHADA: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    ENVIADA: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    PAGO: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };

  return (
    <div className="space-y-6">
      {/* Total do mês atual em tempo real */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-cyan-900/20">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Mês atual (tempo real)
            </p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
              {formatCurrency(data.totalMesAtual)}
            </p>
          </div>
        </div>
      </div>

      {/* Composição por serviço */}
      {resumoEntries.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101b30]">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
            <CircleDollarSign className="h-4 w-4 text-violet-500" />
            Composição do mês
          </h3>
          <div className="space-y-3">
            {resumoEntries.map(([tipo, info]) => {
              const percent = data.totalMesAtual > 0 ? (info.total / data.totalMesAtual) * 100 : 0;
              return (
                <div key={tipo}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      {labelServico[tipo] ?? tipo}
                      <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                        ({info.qtd}×)
                      </span>
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatCurrency(info.total)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lançamentos recentes */}
      {data.lancamentosMesAtual.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
          <button
            type="button"
            onClick={() => setShowLancamentos(!showLancamentos)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
              <Receipt className="h-4 w-4 text-violet-500" />
              Lançamentos recentes ({data.lancamentosMesAtual.length})
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {showLancamentos ? "Ocultar" : "Ver detalhes"}
            </span>
          </button>

          {showLancamentos && (
            <div className="max-h-96 overflow-y-auto border-t border-slate-100 dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-[#0c1524]">
                  <tr className="text-slate-400 dark:text-slate-500">
                    <th className="px-5 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                    <th className="px-5 py-2 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lancamentosMesAtual.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t border-slate-50 dark:border-white/5"
                    >
                      <td className="px-5 py-2 text-slate-700 dark:text-slate-300">
                        {l.descricao}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-white">
                        {formatCurrency(Number(l.valor_total))}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2 text-right text-slate-400 dark:text-slate-500">
                        {formatDateTime(l.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Histórico de faturas */}
      {data.faturas.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <FileText className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Histórico de faturas
            </h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/5">
            {data.faturas.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {formatMesAno(f.mes_ano)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatCurrency(Number(f.total_a_pagar))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusColors[f.status] ?? ""}`}
                  >
                    {f.status}
                  </span>
                  {f.boleto_url && (
                    <a
                      href={f.boleto_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-600 hover:underline dark:text-cyan-400"
                    >
                      Boleto
                    </a>
                  )}
                  {f.nf_url && (
                    <a
                      href={f.nf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-600 hover:underline dark:text-cyan-400"
                    >
                      NF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.faturas.length === 0 && data.lancamentosMesAtual.length === 0 && (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Nenhum lançamento registrado ainda.
          </p>
        </div>
      )}
    </div>
  );
}
