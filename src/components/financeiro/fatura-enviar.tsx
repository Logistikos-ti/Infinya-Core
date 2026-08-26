"use client";

import { useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";

export function FaturaEnviar({
  faturaId,
  status,
}: {
  faturaId: string;
  status: string;
}) {
  const [emailExtra, setEmailExtra] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);

    const emails = emailExtra
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    try {
      const res = await fetch(`/api/financeiro/faturas/${faturaId}/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      const json = await res.json();

      if (!res.ok) {
        setResult({ success: false, message: json.error ?? "Erro ao enviar." });
        return;
      }

      const dest = json.destinatarios as string[];
      setResult({
        success: true,
        message: `Fatura enviada para ${dest.join(", ")}.${json.statusAtualizado ? " Status atualizado para ENVIADA." : ""}`,
      });
    } catch {
      setResult({ success: false, message: "Falha na conexão." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-zinc-700">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        <Mail className="h-3.5 w-3.5" />
        Enviar por e-mail
      </p>

      {result && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-xs ${
            result.success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={emailExtra}
          onChange={(e) => setEmailExtra(e.target.value)}
          placeholder="E-mails extras (opcional)"
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-700 dark:hover:bg-cyan-600"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500">
        Envia automaticamente para os usuários do depositante.
        {status === "FECHADA" && " O status será atualizado para ENVIADA."}
      </p>
    </div>
  );
}
