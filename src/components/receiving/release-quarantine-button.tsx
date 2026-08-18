"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ReleaseQuarantineButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRelease() {
    if (!window.confirm("Liberar estoque da quarentena? Isso transferirá os itens bloqueados para o estoque disponível.")) {
      return;
    }

    setLoading(true);
    try {
      const { releaseQuarantinedReceiving } = await import("@/app/(dashboard)/recebimento/actions");
      const result = await releaseQuarantinedReceiving(orderId);
      if (result?.error) {
        alert(result.error);
      } else {
        alert("Estoque liberado com sucesso!");
        router.refresh();
      }
    } catch (err: any) {
      alert("Erro ao liberar quarentena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Divergência Corrigida pelo Depositante
          </h2>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
            A NF-e (XML) foi substituída e validada com sucesso. Os itens aguardam sua aprovação para serem injetados no estoque disponível.
          </p>
        </div>
        <button
          onClick={handleRelease}
          disabled={loading}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Liberar Quarentena"}
        </button>
      </div>
    </section>
  );
}
