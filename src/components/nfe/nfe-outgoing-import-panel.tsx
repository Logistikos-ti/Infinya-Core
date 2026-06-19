"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DepositanteOption = {
  id: string;
  nome: string;
};

type NfeOutgoingImportPanelProps = {
  defaultDepositanteId: string | null;
  depositantes: DepositanteOption[];
  lockDepositante?: boolean;
};

export function NfeOutgoingImportPanel({
  defaultDepositanteId,
  depositantes,
  lockDepositante = false,
}: NfeOutgoingImportPanelProps) {
  const router = useRouter();
  const [depositanteId, setDepositanteId] = useState(
    defaultDepositanteId ?? depositantes[0]?.id ?? "",
  );
  const [pedidoBusca, setPedidoBusca] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(depositanteId && arquivo && !isUploading),
    [arquivo, depositanteId, isUploading],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!arquivo) {
      setIsError(true);
      setMessage("Selecione um XML autorizado da NF-e de saída antes de importar.");
      return;
    }

    setIsUploading(true);
    setIsError(false);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("depositanteId", depositanteId);
      formData.append("pedidoBusca", pedidoBusca.trim());
      formData.append("arquivo", arquivo);

      const response = await fetch("/api/nfe/importar-saida", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        summary?: {
          noteNumber?: string;
          recipientName?: string;
          totalValue?: string;
          accessKey?: string | null;
          linkedOrderCode?: string | null;
        };
        order?: {
          id: string;
        } | null;
      };

      if (!response.ok) {
        setIsError(true);
        setMessage(payload.error ?? "Falha ao importar o XML de saída.");
        return;
      }

      const summary = payload.summary;
      setIsError(false);
      setMessage(
        summary
          ? `${payload.message ?? "Importação concluída."} NF ${summary.noteNumber ?? "-"}. Destinatário: ${
              summary.recipientName ?? "-"
            }. Total: ${summary.totalValue ?? "-"}.`
          : payload.message ?? "Importação concluída.",
      );
      setArquivo(null);
      event.currentTarget.reset();

      if (payload.order?.id) {
        router.push(`/expedicao/${payload.order.id}?feedback=salvo`);
        return;
      }

      router.refresh();
    } catch {
      setIsError(true);
      setMessage("Falha de comunicação com a API de importação da NF-e de saída.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-950">Importar XML de saída (SEFAZ)</h2>
        <p className="text-sm text-slate-600">
          Envie o XML autorizado da NF-e de saída para vincular automaticamente ao pedido de
          expedição e registrar o anexo fiscal no WMS.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Depositante</span>
          <select
            value={depositanteId}
            onChange={(event) => setDepositanteId(event.target.value)}
            disabled={lockDepositante || depositantes.length <= 1}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            {depositantes.map((depositante) => (
              <option key={depositante.id} value={depositante.id}>
                {depositante.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Pedido ou código para vínculo manual
          </span>
          <input
            type="text"
            value={pedidoBusca}
            onChange={(event) => setPedidoBusca(event.target.value)}
            placeholder="Opcional: número do pedido, código interno ou número da loja"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Arquivo XML</span>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          O sistema valida se o XML é de saída, lê número da NF, chave de acesso e destinatário,
          e tenta vincular automaticamente ao pedido correspondente.
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
          {isUploading ? "Importando..." : "Importar XML de saída"}
        </button>
      </form>
    </div>
  );
}
