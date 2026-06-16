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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-950">Importação do endereçamento atual</h2>
        <p className="text-sm text-slate-600">
          Envie a planilha exportada do SmartGo para montar o mapa real do armazém no WMS.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Planilha</span>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Formato esperado: colunas <strong>Tipo</strong>, <strong>Endereço</strong> e
          <strong> Endereço Pai</strong>. Nesta primeira etapa, o sistema importa as posições
          operáveis do mapa.
        </div>

        {message ? (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              isError
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUploading ? "Importando..." : "Importar endereçamento"}
        </button>
      </form>
    </div>
  );
}
