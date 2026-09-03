"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Info } from "lucide-react";
import { FIN_HEADING, FIN_MONO, FinBadge } from "@/components/financeiro/fin-ui";
import { FaturaDrawer, type FaturaDrawerFatura, type FaturaDrawerExtratoRow } from "@/components/financeiro/fatura-drawer";

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
  const [drawerFaturaId, setDrawerFaturaId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<{ fatura: FaturaDrawerFatura; extrato: FaturaDrawerExtratoRow[] } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

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

  async function openDrawer(faturaId: string) {
    setDrawerFaturaId(faturaId);
    setDrawerData(null);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/portal/faturas/${faturaId}/detalhes`);
      if (res.ok) {
        const json = await res.json();
        setDrawerData(json);
      }
    } finally {
      setDrawerLoading(false);
    }
  }

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
                <button
                  onClick={() => openDrawer(f.id)}
                  title="Ver detalhes da fatura"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  <Info className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {drawerFaturaId && drawerData && (
        <FaturaDrawer
          fatura={drawerData.fatura}
          extrato={drawerData.extrato}
          onClose={() => setDrawerFaturaId(null)}
          allowBoletoUpload={false}
        />
      )}
      {drawerFaturaId && drawerLoading && !drawerData && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerFaturaId(null)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-[440px] items-center justify-center border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0C1526]">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        </div>
      )}
    </div>
  );
}
