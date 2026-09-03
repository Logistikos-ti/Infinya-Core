"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { FIN_HEADING, FIN_MONO, FinBadge } from "@/components/financeiro/fin-ui";

type FaturaRow = {
  id: string;
  codigo: string;
  mesAno: string;
  status: string;
  totalAPagar: number;
  vencimento: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMesAnoCurto(mesAno: string) {
  const [year, month] = mesAno.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[Number(month) - 1]}/${year}`;
}

function formatDateBr(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function PortalInvoicesView({ depositanteId }: { depositanteId: string }) {
  const [faturas, setFaturas] = useState<FaturaRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/faturas?depositante_id=${depositanteId}`);
      if (res.ok) {
        const json = await res.json();
        setFaturas(json.faturas);
      }
    } finally {
      setLoading(false);
    }
  }, [depositanteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!faturas || faturas.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Nenhuma fatura registrada ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
      <table className={`${FIN_HEADING} w-full min-w-[720px] text-left text-sm`}>
        <thead>
          <tr className={`${FIN_MONO} text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500`}>
            <th className="px-5 py-3">Fatura</th>
            <th className="px-3 py-3">Referência</th>
            <th className="px-3 py-3 text-right">Valor</th>
            <th className="px-3 py-3">Vencimento</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {faturas.map((f) => (
            <tr key={f.id}>
              <td className={`${FIN_MONO} px-5 py-3.5 text-sm font-bold text-slate-900 dark:text-white`}>
                {f.codigo}
              </td>
              <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">
                {formatMesAnoCurto(f.mesAno)}
              </td>
              <td className={`${FIN_MONO} px-3 py-3.5 text-right font-bold text-slate-900 dark:text-white`}>
                {formatCurrency(f.totalAPagar)}
              </td>
              <td className={`${FIN_MONO} px-3 py-3.5 text-xs text-slate-400 dark:text-slate-500`}>
                {formatDateBr(f.vencimento)}
              </td>
              <td className="px-3 py-3.5">
                <FinBadge status={f.status} />
              </td>
              <td className="px-5 py-3.5 text-right">
                <a
                  href={`/api/financeiro/faturas/${f.id}/relatorio`}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Ver fatura
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
