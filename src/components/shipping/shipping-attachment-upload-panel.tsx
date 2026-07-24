"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileUp, Paperclip, UploadCloud } from "lucide-react";
import { uploadShippingAttachmentAction } from "@/app/(dashboard)/expedicao/conferencia/actions";

type ShippingAttachmentUploadPanelProps = {
  depositanteId: string;
  pedidoExpedicaoId: string;
};

const attachmentTypes = [
  { value: "NF", label: "XML da nota fiscal", hint: "Envie o XML fiscal do pedido." },
  {
    value: "ETIQUETA",
    label: "Etiqueta de envio",
    hint: "Envie PDF ou imagem da etiqueta do marketplace.",
  },
] as const;

export function ShippingAttachmentUploadPanel({
  depositanteId,
  pedidoExpedicaoId,
}: ShippingAttachmentUploadPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tipo, setTipo] = useState<(typeof attachmentTypes)[number]["value"]>("NF");
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    if (!state.message || !state.ok) {
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }

    router.refresh();
  }, [router, state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="depositanteId" value={depositanteId} />
      <input type="hidden" name="pedidoExpedicaoId" value={pedidoExpedicaoId} />
      <input type="hidden" name="tipo" value={tipo} />

      <div className="flex flex-col gap-[7px]">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
          Tipo do anexo
        </span>
        <div className="flex gap-[7px]">
          {attachmentTypes.map((item) => {
            const active = item.value === tipo;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTipo(item.value)}
                className={`flex flex-1 items-center justify-center rounded-[9px] border-[1.5px] font-['Manrope'] text-[12px] font-bold transition-all h-[36px] ${
                  active
                    ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:border-violet-500 dark:text-violet-400"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[7px]">
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
          className="flex cursor-pointer items-center gap-[12px] rounded-[11px] border-[1.5px] border-dashed border-slate-300 bg-white/60 p-[14px] transition-colors hover:border-violet-500 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-violet-400"
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
            {arquivo ? <Paperclip className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
            <span className="truncate text-[12.5px] font-bold text-slate-900 dark:text-white">
              {arquivo ? arquivo.name : "Selecionar arquivo"}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {arquivo ? "Pronto para enviar" : "Aceita XML, PDF, PNG e JPG."}
            </span>
          </div>
        </div>
      </div>

      {arquivo && (
        <button
          type="submit"
          disabled={isUploading}
          className="flex h-[38px] w-full items-center justify-center gap-2 rounded-[9px] bg-violet-600 px-4 font-['Manrope'] text-[12.5px] font-bold text-white transition-all hover:bg-violet-700 disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" />
          {isUploading ? "Enviando..." : "Enviar anexo"}
        </button>
      )}

      {state.message && (
        <div
          className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
