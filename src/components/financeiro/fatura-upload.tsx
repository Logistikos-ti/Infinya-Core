"use client";

import { useState, useRef } from "react";
import { FileText, Trash2, Upload, Loader2 } from "lucide-react";

type Props = {
  faturaId: string;
  tipo: "boleto" | "nf";
  label: string;
  currentUrl: string | null;
  currentNome: string | null;
};

export function FaturaUpload({ faturaId, tipo, label, currentUrl, currentNome }: Props) {
  const [url, setUrl] = useState(currentUrl);
  const [nome, setNome] = useState(currentNome);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("tipo", tipo);
      form.append("file", file);

      const res = await fetch(`/api/financeiro/faturas/${faturaId}/upload`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro no upload.");
        return;
      }

      setUrl(json.url);
      setNome(json.nome);
    } catch {
      setError("Falha na conexão.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setRemoving(true);
    try {
      const res = await fetch(`/api/financeiro/faturas/${faturaId}/upload?tipo=${tipo}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Erro ao remover.");
        return;
      }

      setUrl(null);
      setNome(null);
    } catch {
      setError("Falha na conexão.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-zinc-700">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </p>

      {error && (
        <p className="mb-2 text-xs text-rose-600">{error}</p>
      )}

      {url ? (
        <div className="flex items-center justify-between gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 truncate text-sm text-cyan-600 hover:underline dark:text-cyan-400"
          >
            <FileText className="h-4 w-4 shrink-0" />
            {nome ?? label}
          </a>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="rounded-lg border border-red-200 p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/20"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Enviando..." : `Enviar ${label.toLowerCase()}`}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      )}
    </div>
  );
}
