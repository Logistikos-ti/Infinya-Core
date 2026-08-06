"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileUp, Paperclip, UploadCloud } from "lucide-react";
import { uploadShippingAttachmentAction } from "@/app/(dashboard)/expedicao/conferencia/actions";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

type ShippingAttachmentUploadPanelProps = {
  depositanteId: string;
  pedidoExpedicaoId: string;
  defaultTipo?: "NF" | "ETIQUETA" | "CARTA_CORRECAO" | "OUTRO" | string;
  onSuccess?: () => void;
};

const attachmentTypes = [
  {
    value: "CARTA_CORRECAO",
    label: "Carta de Correção (CC-e)",
    hint: "PDF ou XML da CC-e emitida para a nota fiscal.",
  },
  {
    value: "NF",
    label: "XML da Nota Fiscal",
    hint: "XML fiscal da NF-e do pedido.",
  },
  {
    value: "ETIQUETA",
    label: "Etiqueta de Envio",
    hint: "PDF ou imagem da etiqueta de transporte.",
  },
  {
    value: "OUTRO",
    label: "Outro documento",
    hint: "Declaração de conteúdo, comprovante ou anexo adicional.",
  },
] as const;

export function ShippingAttachmentUploadPanel({
  depositanteId,
  pedidoExpedicaoId,
  defaultTipo,
  onSuccess,
}: ShippingAttachmentUploadPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tipo, setTipo] = useState<string>(() => {
    if (defaultTipo && attachmentTypes.some((item) => item.value === defaultTipo)) {
      return defaultTipo;
    }
    return "CARTA_CORRECAO";
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [state, formAction, isUploading] = useActionState(uploadShippingAttachmentAction, {
    ok: false,
    message: null,
    uploadedKind: null,
  });

  const selectedType = useMemo(
    () => attachmentTypes.find((item) => item.value === tipo) ?? attachmentTypes[0],
    [tipo],
  );

  useEffect(() => {
    if (defaultTipo && attachmentTypes.some((item) => item.value === defaultTipo)) {
      setTipo(defaultTipo);
    }
  }, [defaultTipo]);

  useEffect(() => {
    if (!state.message || !state.ok) {
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }

    setArquivo(null);
    router.refresh();
    onSuccess?.();
  }, [onSuccess, router, state]);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="depositanteId" value={depositanteId} />
      <input type="hidden" name="pedidoExpedicaoId" value={pedidoExpedicaoId} />
      <input type="hidden" name="tipo" value={tipo} />

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-zinc-400">
          Tipo de documento a anexar
        </span>
        <div className="grid grid-cols-2 gap-2">
          {attachmentTypes.map((item) => {
            const active = item.value === tipo;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTipo(item.value)}
                className={`flex flex-col items-start justify-center rounded-xl border p-2.5 text-left transition-all ${
                  active
                    ? "border-violet-500 bg-violet-50/70 text-violet-900 shadow-sm ring-1 ring-violet-500/20 dark:border-violet-500/70 dark:bg-violet-500/10 dark:text-violet-200"
                    : "border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300 hover:bg-slate-100/60 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span className="text-[12px] font-bold">{item.label}</span>
                <span className="line-clamp-1 text-[10px] text-slate-500 dark:text-zinc-400">
                  {item.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 dark:text-zinc-400">
          Arquivo
        </span>
        <input
          ref={fileInputRef}
          type="file"
          name="arquivo"
          accept=".xml,.pdf,.png,.jpg,.jpeg"
          onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-dashed border-slate-300 bg-slate-50/60 p-3.5 transition-colors hover:border-violet-500 hover:bg-violet-500/[0.02] dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-400"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
            {arquivo ? <Paperclip className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
              {arquivo ? arquivo.name : `Selecionar ${selectedType.label}`}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              {arquivo
                ? `${(arquivo.size / 1024).toFixed(1)} KB • Pronto para enviar`
                : "Clique para escolher PDF, XML, PNG ou JPG (até 25MB)"}
            </span>
          </div>
        </div>
      </div>

      {arquivo && (
        <button
          type="submit"
          disabled={isUploading}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-violet-700 disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" />
          {isUploading ? <MobileButtonSpinner /> : `Anexar ${selectedType.label}`}
        </button>
      )}

      {state.message && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-[12.5px] font-semibold ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
