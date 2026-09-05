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
          className="h-10 flex-1 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="fatura-enviar-btn inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar
        </button>
        <style jsx>{`
          .fatura-enviar-btn {
            background: linear-gradient(135deg, #0891b2 0%, #22d3ee 50%, #0891b2 100%);
            background-size: 220% 100%;
            background-position: 0% 50%;
            box-shadow: 0 8px 22px rgba(8, 145, 178, 0.32);
            transition:
              background-position 0.6s ease,
              transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease;
          }
          .fatura-enviar-btn:hover:not(:disabled) {
            background-position: 100% 50%;
            transform: translateY(-3px);
            box-shadow: 0 12px 30px rgba(34, 211, 238, 0.45);
          }
        `}</style>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-zinc-500">
        Envia automaticamente para os usuários do depositante.
        {status === "FECHADA" && " O status será atualizado para ENVIADA."}
      </p>
    </div>
  );
}
