"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import {
  deleteDepositanteAction,
  toggleDepositanteStatusAction,
} from "@/app/(dashboard)/configuracoes/depositantes/actions";
import { DepositanteForm } from "./depositante-form";
import type { EmailContato, MetodoRetirada, TelefoneContato } from "@/lib/depositantes";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

export type DepositanteEditDefaults = {
  id: string;
  codigo: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  ativo: boolean;
  logoUrl: string | null;
  logoStoragePath: string | null;
  enderecoFiscalCep: string;
  enderecoFiscalLogradouro: string;
  enderecoFiscalNumero: string;
  enderecoFiscalComplemento: string;
  enderecoFiscalBairro: string;
  enderecoFiscalCidade: string;
  enderecoFiscalUf: string;
  emailsContato: EmailContato[];
  telefonesContato: TelefoneContato[];
  observacoes: string;
  metodoRetiradaPadrao: MetodoRetirada;
  exigeLotePadrao: boolean;
  exigeValidadePadrao: boolean;
  permiteFracionamento: boolean;
  diasMinimosValidade: number;
  prefixoRecebimento: string;
};

export function DepositanteRowActions({
  id,
  nome,
  ativo,
  editDefaults,
}: {
  id: string;
  nome: string;
  ativo: boolean;
  editDefaults: DepositanteEditDefaults;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  function handleEditClose() {
    setEditOpen(false);
    router.refresh();
  }

  function handleConfirmDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("isSpa", "true");
      const result = await deleteDepositanteAction(formData);
      if (result && result.success === false) {
        setDeleteError(result.message);
        return;
      }
      setConfirmOpen(false);
    });
  }

  return (
    <div
      className="flex items-center justify-end"
      style={{ gap: "10px", fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          height: "28px",
          gap: "7px",
          padding: "0 11px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 700,
          background: ativo ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.14)",
          color: ativo ? "#10B981" : "#EF4444",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: ativo ? "#10B981" : "#EF4444",
          }}
        />
        {ativo ? "Ativo" : "Inativo"}
      </span>

      <form action={toggleDepositanteStatusAction} style={{ display: "inline-flex" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="nextActive" value={ativo ? "false" : "true"} />
        <button
          type="submit"
          title="Ativar/desativar"
          style={{
            position: "relative",
            width: "50px",
            height: "28px",
            flexShrink: 0,
            borderRadius: "999px",
            border: "none",
            cursor: "pointer",
            background: ativo ? "#10B981" : "rgba(148,163,184,0.25)",
            transition: "background 0.25s",
            padding: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: "3px",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              transform: ativo ? "translateX(22px)" : "translateX(0)",
              transition: "transform 0.25s cubic-bezier(0.4, 1.3, 0.5, 1)",
            }}
          />
        </button>
      </form>

      <button
        type="button"
        title="Editar"
        onClick={() => setEditOpen(true)}
        className={`group/edit inline-flex border transition hover:scale-[1.08] hover:border-[rgba(90,167,255,0.4)] hover:bg-[rgba(90,167,255,0.12)] dark:hover:border-[rgba(90,167,255,0.4)] dark:hover:bg-[rgba(90,167,255,0.12)] ${tokenBorder} ${tokenInputBg}`}
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "999px",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Pencil
          className={`${tokenText} transition-colors group-hover/edit:text-[#5AA7FF] dark:group-hover/edit:text-[#5AA7FF]`}
          style={{ width: "13px", height: "13px" }}
        />
      </button>

      <button
        type="button"
        title="Excluir"
        onClick={() => setConfirmOpen(true)}
        className={`group/delete inline-flex border transition hover:scale-[1.08] hover:border-[rgba(251,113,133,0.45)] hover:bg-[rgba(251,113,133,0.12)] dark:hover:border-[rgba(251,113,133,0.45)] dark:hover:bg-[rgba(251,113,133,0.12)] ${tokenBorder} ${tokenInputBg}`}
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "999px",
          cursor: "pointer",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <Trash2
          className={`${tokenText} transition-colors group-hover/delete:text-[#FB7185] dark:group-hover/delete:text-[#FB7185]`}
          style={{ width: "13px", height: "13px" }}
        />
      </button>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F7FB] dark:bg-[#0A1120]" style={manropeStyle}>
          <DepositanteForm defaultValues={editDefaults} onClose={handleEditClose} />
        </div>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-6"
          style={manropeStyle}
        >
          <div
            className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
            onClick={() => !isDeleting && setConfirmOpen(false)}
          />
          <div
            className={`relative flex w-[420px] max-w-[94vw] flex-col gap-4 rounded-[18px] border ${tokenBorder} ${tokenCardBg} p-[26px] shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(239,68,68,0.14)] text-[#EF4444]">
                <Trash2 className="h-[22px] w-[22px]" />
              </span>
              <div className="flex flex-col gap-[3px]">
                <span className={`${FIN_HEADING} text-[18px] font-bold ${tokenText}`}>Excluir registro?</span>
                <span className={`text-[13px] leading-[1.4] ${tokenTextSub}`}>Esta ação não pode ser desfeita.</span>
              </div>
            </div>
            <div
              className={`rounded-full border ${tokenBorder} bg-[rgba(148,163,184,0.06)] px-4 py-3.5 text-[13.5px] font-bold ${tokenText}`}
            >
              {nome}
            </div>
            {deleteError ? <p className="text-[13px] text-[#EF4444]">{deleteError}</p> : null}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmOpen(false)}
                className={`h-12 flex-1 rounded-full border text-sm font-bold transition-colors hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:opacity-50 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{ background: "#EF4444", color: "#fff" }}
                className="h-12 flex-1 rounded-full text-sm font-extrabold shadow-[0_8px_22px_rgba(239,68,68,0.35)] transition-transform hover:-translate-y-px disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isDeleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
