"use client";

import { Download, X } from "lucide-react";
import type { RomaneioUI } from "./romaneio-types";
import { ROMANEIO_MONO } from "@/lib/romaneio-theme";

type RomaneioPrintModalProps = {
  romaneio: RomaneioUI;
  onClose: () => void;
};

// Cores exatas do PDF real (src/lib/romaneio-pdf.ts) -- não o letterhead
// branco fictício do mockup. O botão "Baixar PDF" deste modal abre o PDF
// de verdade, então o preview usa a MESMA identidade visual (faixa navy
// no topo, barra de acento azul→violeta→rosa), pra não mostrar um preview
// que não bate com o que é baixado.
const PDF_NAVY = "#0A1120";
const PDF_NAVY_GLOW = "#211A4A";
const PDF_ACCENT = "linear-gradient(90deg,#3B82F6,#8B5CF6,#EC4899)";

export function RomaneioPrintModal({ romaneio: r, onClose }: RomaneioPrintModalProps) {
  const now = new Date().toLocaleString("pt-BR");

  return (
    <div
      className="fixed inset-0 z-[58] flex items-center justify-center p-5"
      style={{ background: "rgba(3,7,20,.55)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[600px] max-w-[96vw] max-h-[88vh] flex flex-col rounded-2xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,.4)]"
        style={{ background: "#fff", color: "#0F172A" }}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header band -- mesma identidade do PDF real */}
          <div className="px-[30px] pt-6 pb-4" style={{ background: `linear-gradient(90deg, ${PDF_NAVY}, ${PDF_NAVY_GLOW})` }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.6)" }}>
                  INFINOOS · WMS
                </div>
                <div className="font-[family-name:var(--font-space-grotesk)] text-xl font-extrabold text-white mt-1">
                  Romaneio Operacional
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-extrabold text-white" style={{ fontFamily: ROMANEIO_MONO }}>
                  {r.code}
                </div>
                <div className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Emitido em {now}
                </div>
              </div>
            </div>
          </div>
          <div className="h-[3px]" style={{ background: PDF_ACCENT }} />

          <div className="px-[30px] py-6">
            <div className="grid grid-cols-2 gap-2.5 text-[13px] mb-[18px]">
              <div>
                <b>Transportadora: </b>
                {r.carrier}
              </div>
              <div>
                <b>Doca: </b>
                {r.dock ?? "—"}
              </div>
              <div>
                <b>Motorista: </b>
                {r.driver}
              </div>
              <div>
                <b>Placa: </b>
                {r.plate}
              </div>
            </div>

            <table className="w-full text-[12.5px] mb-3.5" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Cliente", "Volumes", "Valor"].map((h, i) => (
                    <th
                      key={h}
                      className="py-1.5 px-1 text-[10.5px] tracking-[0.06em] uppercase"
                      style={{ textAlign: i === 0 ? "left" : "right", borderBottom: "1px solid #CBD5E1", color: "#64748B" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.stops.map((s, i) => (
                  <tr key={i}>
                    <td className="py-[7px] px-1" style={{ borderBottom: "1px solid #E2E8F0" }}>
                      {s.customer}
                    </td>
                    <td className="py-[7px] px-1 text-right" style={{ borderBottom: "1px solid #E2E8F0" }}>
                      {s.vol}
                    </td>
                    <td className="py-[7px] px-1 text-right" style={{ borderBottom: "1px solid #E2E8F0" }}>
                      {s.weight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end gap-6 text-[13px] font-bold mb-[34px]">
              <span>Total: {r.orders} pedido(s)</span>
              <span>{r.volumes} un.</span>
              <span>{r.weight}</span>
            </div>

            <div className="grid grid-cols-2 gap-6 text-[12px]" style={{ color: "#334155" }}>
              <div className="pt-1.5" style={{ borderTop: "1px solid #94A3B8" }}>
                Assinatura do motorista
              </div>
              <div className="pt-1.5" style={{ borderTop: "1px solid #94A3B8" }}>
                Assinatura do conferente
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 px-6 py-3.5 justify-end" style={{ borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-[9px] border text-sm font-bold flex items-center gap-2"
            style={{ background: "#fff", borderColor: "#CBD5E1", color: "#0F172A" }}
          >
            <X className="h-4 w-4" /> Fechar
          </button>
          {r.id ? (
            <a
              href={`/api/romaneio/${r.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="h-10 px-5 rounded-[9px] border-none text-sm font-extrabold flex items-center gap-2"
              style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#fff" }}
            >
              <Download className="h-4 w-4" /> Baixar PDF
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
