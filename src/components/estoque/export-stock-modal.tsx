/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";

const ESCOPOS = [
  { value: "all", label: "Todos os produtos", desc: "Posição completa de estoque." },
  { value: "ideal", label: "Dentro da faixa", desc: "Somente itens saudáveis." },
  { value: "baixo", label: "Abaixo do mínimo", desc: "Itens em alerta de reposição." },
  { value: "critico", label: "Ruptura crítica", desc: "Itens em ruptura." },
];

const FORMATOS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "XLSX" },
  { value: "pdf", label: "PDF" },
];

export function ExportStockModal({ t, onClose }: { t: any; onClose: () => void }) {
  const [escopo, setEscopo] = useState("all");
  const [formato, setFormato] = useState<"csv" | "xlsx" | "pdf">("csv");

  const handleExportar = () => {
    window.location.href = `/api/estoque/exportar?escopo=${escopo}&formato=${formato}`;
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[56] flex items-center justify-center p-5"
      style={{ background: "rgba(3,7,20,.55)", backdropFilter: "blur(5px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-anim w-[500px] max-w-[96vw] rounded-[18px] border"
        style={{ background: t.cardBg, borderColor: t.border, boxShadow: "0 30px 60px rgba(0,0,0,.35)", fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="border-b px-[26px] pb-3 pt-[22px]" style={{ borderColor: t.border }}>
          <div className="mb-1 text-[10px] font-bold tracking-[0.28em]" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#8B5CF6" }}>
            EXPORTAR
          </div>
          <h3 className="m-0 text-[20px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: t.text }}>
            Exportar estoque
          </h3>
          <p className="mt-1.5 text-[13px]" style={{ color: t.textSub }}>
            Escolha o escopo e o formato.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 px-[26px] py-[18px]">
          {ESCOPOS.map((e) => {
            const sel = escopo === e.value;
            return (
              <button
                key={e.value}
                onClick={() => setEscopo(e.value)}
                className="flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left"
                style={{ borderColor: sel ? "#8B5CF6" : t.border, background: sel ? "rgba(139,92,246,.08)" : t.inputBg }}
              >
                <span
                  className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2"
                  style={{ borderColor: sel ? "#8B5CF6" : t.border }}
                >
                  {sel && <span className="h-2 w-2 rounded-full" style={{ background: "#8B5CF6" }} />}
                </span>
                <span>
                  <div className="text-[13.5px] font-bold" style={{ color: t.text }}>
                    {e.label}
                  </div>
                  <div className="mt-0.5 text-[12px]" style={{ color: t.textSub }}>
                    {e.desc}
                  </div>
                </span>
              </button>
            );
          })}

          <div className="mt-1.5">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: t.textSub }}>
              Formato
            </div>
            <div className="flex gap-2">
              {FORMATOS.map((f) => {
                const sel = formato === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setFormato(f.value as "csv" | "xlsx" | "pdf")}
                    className="h-10 flex-1 cursor-pointer rounded-[10px] border-2 text-[13.5px] font-bold"
                    style={{ borderColor: sel ? "#8B5CF6" : t.border, background: sel ? "rgba(139,92,246,.1)" : t.inputBg, color: sel ? "#7C3AED" : t.text }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 px-[26px] pb-5">
          <button
            onClick={onClose}
            className="h-11 cursor-pointer rounded-[11px] border px-[22px] text-[14px] font-bold"
            style={{ borderColor: t.border, background: t.inputBg, color: t.text }}
          >
            Cancelar
          </button>
          <button
            onClick={handleExportar}
            className="h-11 cursor-pointer rounded-[11px] border-none px-6 text-[14px] font-extrabold text-white"
            style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
          >
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
}
