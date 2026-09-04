"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import Link from "next/link";
import { RomaneioDetailModal } from "./romaneio-detail-modal";
import { RomaneioPrintModal } from "./romaneio-print-modal";
import type { RomaneioUI } from "./romaneio-types";
import { ROMANEIO_GRADIENT, ROMANEIO_MONO } from "@/lib/romaneio-theme";

type RomaneioDrawerProps = {
  romaneio: RomaneioUI;
  onClose: () => void;
};

function KeyValueRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[9px] text-[13.5px]" style={{ borderBottom: "1px solid var(--romaneio-border)" }}>
      <span style={{ color: "var(--romaneio-text-sub)" }}>{label}</span>
      <span
        className="text-right font-semibold"
        style={{ color: "var(--romaneio-text)", fontFamily: mono ? ROMANEIO_MONO : "inherit" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export function RomaneioDrawer({ romaneio: r, onClose }: RomaneioDrawerProps) {
  const [showPrint, setShowPrint] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [closeHover, setCloseHover] = useState(false);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 animate-in fade-in duration-200" style={{ background: "rgba(3,7,20,.4)" }} />

      {/* Drawer */}
      <aside
        className="absolute top-0 right-0 bottom-0 flex flex-col animate-in slide-in-from-right duration-300 ease-out"
        style={{
          width: 480,
          maxWidth: "92vw",
          background: "var(--romaneio-drawer-bg)",
          borderLeft: "1px solid var(--romaneio-border)",
          boxShadow: "-24px 0 60px rgba(0,0,0,.35)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-[22px] pb-4" style={{ borderBottom: "1px solid var(--romaneio-border)" }}>
          <div className="flex items-center gap-2 mb-[10px] flex-wrap">
            <span
              className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[11.5px] font-bold"
              style={{ backgroundColor: r.statusBg, color: r.statusColor }}
            >
              <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: r.statusDot }} />
              {r.statusLabel}
            </span>
            {r.dock ? (
              <span
                className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11.5px] font-bold"
                style={{ background: "rgba(139,92,246,.14)", color: "#8B5CF6" }}
              >
                Doca {r.dock}
              </span>
            ) : null}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setShowPrint(true)}
              title="Imprimir romaneio"
              className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border"
              style={{ borderColor: "var(--romaneio-border)", color: "var(--romaneio-text-sub)" }}
            >
              <Printer className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={() => setCloseHover(true)}
              onMouseLeave={() => setCloseHover(false)}
              className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border text-[15px] transition-colors"
              style={
                closeHover
                  ? { background: "rgba(239,68,68,.12)", borderColor: "rgba(239,68,68,.35)", color: "#EF4444" }
                  : { borderColor: "var(--romaneio-border)", color: "var(--romaneio-text-sub)" }
              }
            >
              ×
            </button>
          </div>
          <div className="text-[18px] font-bold" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
            {r.code}
          </div>
          <div className="text-sm font-semibold mt-1" style={{ color: "var(--romaneio-text)" }}>
            {r.carrier}
          </div>
          <Link href="/configuracoes/transportadoras" className="text-xs mt-0.5 inline-block" style={{ color: "#A78BFA" }}>
            Ver transportadora
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <KeyValueRow label="Motorista" value={r.driver} />
          <KeyValueRow label="Placa" value={r.plate} mono />
          <KeyValueRow label="Emissão" value={r.departure} mono />
          <KeyValueRow label="Liberação" value={r.releasedAtLabel ?? "—"} mono />
          <KeyValueRow label="Volumes" value={String(r.volumes)} />
          <KeyValueRow label="Peso total" value={`${r.weightKg.toFixed(1)} kg`} />

          <div className="mt-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2.5" style={{ color: "#8B5CF6" }}>
              Pedidos ({r.stops.length})
            </div>
            <div className="flex flex-col gap-2">
              {r.stops.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border"
                  style={{ background: "var(--romaneio-input-bg)", borderColor: "var(--romaneio-border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: "var(--romaneio-text)" }}>
                      {s.customer}
                    </div>
                    <div className="text-[11px]" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text-sub)", marginTop: 1 }}>
                      {s.code} · {s.vol} vol.
                    </div>
                  </div>
                  <div className="text-[13px] font-extrabold whitespace-nowrap" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
                    {s.weight}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-[14px] flex gap-2" style={{ borderTop: "1px solid var(--romaneio-border)" }}>
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="flex-1 h-10 rounded-[10px] flex items-center justify-center text-[13px] font-extrabold"
            style={{ background: ROMANEIO_GRADIENT, color: "#fff" }}
          >
            Ver detalhes
          </button>
        </div>
      </aside>

      {showPrint ? <RomaneioPrintModal romaneio={r} onClose={() => setShowPrint(false)} /> : null}
      {showDetail ? <RomaneioDetailModal romaneio={r} onClose={() => setShowDetail(false)} /> : null}
    </div>
  );
}
