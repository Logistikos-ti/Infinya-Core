"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function AddressImportPanel() {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const canSubmit = useMemo(() => Boolean(arquivo && !isUploading), [arquivo, isUploading]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!arquivo) {
      setIsError(true);
      setMessage("Selecione uma planilha antes de importar.");
      return;
    }

    setIsUploading(true);
    setIsError(false);
    setMessage(null);

    let successMessage: string | null = null;

    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);

      const response = await fetch("/api/configuracoes/enderecos/importar", {
        method: "POST",
        body: formData,
      });

      const rawResponse = await response.text();
      let payload: Record<string, unknown> = {};

      try {
        payload = rawResponse ? (JSON.parse(rawResponse) as Record<string, unknown>) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        setIsError(true);
        setMessage(
          typeof payload.error === "string" && payload.error
            ? payload.error
            : rawResponse || "Falha ao importar a planilha.",
        );
        return;
      }

      const summary =
        typeof payload.summary === "object" && payload.summary !== null
          ? (payload.summary as {
              enderecosProcessados?: number;
              enderecosCriados?: number;
              enderecosAtualizados?: number;
            })
          : null;

      successMessage = summary
        ? `${String(payload.message ?? "Importação concluída.")} ${summary.enderecosProcessados ?? 0} endereços processados, ${summary.enderecosCriados ?? 0} criados e ${summary.enderecosAtualizados ?? 0} atualizados.`
        : String(payload.message ?? "Importação concluída.");
    } catch {
      setIsError(true);
      setMessage("Falha de comunicação com a API de importação.");
      return;
    } finally {
      setIsUploading(false);
    }

    setIsError(false);
    setMessage(successMessage);
    setArquivo(null);

    try {
      event.currentTarget.reset();
    } catch {
      // Ignore form reset edge cases from the embedded browser/runtime.
    }

    try {
      router.refresh();
    } catch {
      // The import already succeeded; avoid showing a false negative if refresh fails.
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-[0_20px_45px_-24px_rgba(15,23,42,0.22)] transition-colors dark:border-white/10 dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 dark:shadow-[0_20px_45px_-24px_rgba(0,0,0,0.65)]">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
          Importação do endereçamento atual
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Envie a planilha exportada do SmartGo para montar o mapa real do armazém no WMS.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Planilha
          </span>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-cyan-800 hover:file:bg-cyan-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:file:bg-white/10 dark:file:text-cyan-300 dark:hover:file:bg-white/15"
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          Formato esperado: colunas <strong>Tipo</strong>, <strong>Endereço</strong> e
          <strong> Endereço Pai</strong>. Nesta primeira etapa, o sistema importa as posições
          operáveis do mapa.
        </div>

        {message ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              isError
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200"
            }`}
          >
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_rgba(34,211,238,0.18)] transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-slate-500"
        >
          {isUploading ? "Importando..." : "Importar endereçamento"}
        </button>
      </form>
    </div>
  );
}
