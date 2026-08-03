import { Printer, Edit2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createRomaneioRecordAction } from "@/app/(dashboard)/romaneio/actions";
import type { RomaneioUI } from "./romaneio-types";

type RomaneioDrawerProps = {
  romaneio: RomaneioUI;
  onClose: () => void;
};

export function RomaneioDrawer({ romaneio: r, onClose }: RomaneioDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* Drawer */}
      <div className="relative w-[500px] max-w-[94vw] h-full bg-white dark:bg-[#0C1526] border-l border-slate-200 dark:border-slate-800/80 shadow-[-24px_0_60px_rgba(0,0,0,0.15)] dark:shadow-[-24px_0_60px_rgba(0,0,0,0.35)] flex flex-col animate-in slide-in-from-right duration-300 ease-out overflow-hidden">
        
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden">
          <div className="absolute w-[260px] h-[260px] -right-20 -top-[120px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.15),transparent_70%)] dark:bg-[radial-gradient(circle,rgba(139,92,246,0.28),transparent_70%)] pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                ROMANEIO
              </span>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center font-[family-name:var(--font-space-grotesk)] text-[13px] font-extrabold"
                  style={{ backgroundColor: r.carrierBg, color: r.carrierColor }}
                >
                  {r.carrierInit}
                </span>
                <span className="font-[family-name:var(--font-space-grotesk)] text-[24px] font-bold leading-none text-slate-900 dark:text-slate-100">
                  {r.code}
                </span>
              </div>
              <span
                className="inline-flex items-center gap-[7px] self-start px-3 py-[5px] rounded-full text-[12.5px] font-bold"
                style={{ backgroundColor: r.statusBg, color: r.statusColor }}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full"
                  style={{ backgroundColor: r.statusDot }}
                />
                {r.status}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 shrink-0 rounded-[10px] border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-base flex items-center justify-center hover:text-violet-500 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Transport summary */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {r.specs.map((s, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#101B30] flex flex-col gap-[5px]"
              >
                <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                  {s.k}
                </span>
                <span className="text-[14.5px] font-bold text-slate-900 dark:text-slate-100">
                  {s.v}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-3 gap-3 mb-[22px]">
            <div className="p-4 rounded-[14px] border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#101B30] flex flex-col gap-1">
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                Pedidos
              </span>
              <span className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-bold text-slate-900 dark:text-slate-100">
                {r.orders}
              </span>
            </div>
            <div className="p-4 rounded-[14px] border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#101B30] flex flex-col gap-1">
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                Volumes
              </span>
              <span className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-bold text-slate-900 dark:text-slate-100">
                {r.volumes}
              </span>
            </div>
            <div className="p-4 rounded-[14px] border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#101B30] flex flex-col gap-1">
              <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
                Peso total
              </span>
              <span className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-bold text-slate-900 dark:text-slate-100">
                {r.weight}
              </span>
            </div>
          </div>

          {/* Orders list */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-bold text-slate-900 dark:text-slate-100">
                Pedidos no romaneio
              </span>
              <span className="text-[12.5px] text-slate-500 dark:text-slate-400">
                sequência de entrega
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {r.stops.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-[13px] px-3.5 py-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#101B30]"
                >
                  <span className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-[family-name:var(--font-space-grotesk)] text-[13px] font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                    {s.seq}
                  </span>
                  <div className="flex flex-col gap-[1px] flex-1 min-w-0">
                    <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis">
                      {s.customer}
                    </span>
                    <span className="font-[family-name:var(--font-space-grotesk)] text-[11.5px] text-slate-500 dark:text-slate-400">
                      {s.code} · {s.city}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[1px] items-end shrink-0">
                    <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
                      {s.vol}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {s.weight}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-4 px-6 border-t border-slate-200 dark:border-slate-800/60 flex gap-2.5 bg-slate-50 dark:bg-[#0C1526]">
          {r.status === "Sugestão" ? (
            <form action={createRomaneioRecordAction} className="w-full flex gap-2.5">
              {r.orderIds.map((id) => (
                <input key={id} type="hidden" name="pedidoIds" value={id} />
              ))}
              <input type="hidden" name="transportadoraId" value={r.transportadoraId || ""} />
              <input type="hidden" name="transportadoraNome" value={r.transportadoraNome || ""} />
              <button type="submit" className="flex-[1.3] h-[46px] rounded-[11px] bg-gradient-to-r from-blue-500 to-violet-500 text-white font-[family-name:var(--font-manrope)] text-sm font-extrabold flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(99,102,241,0.32)] hover:-translate-y-[1px] transition-transform w-full">
                Gerar Romaneio <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <>
              <Link href={`/romaneio/${r.id}`} className="flex-1 h-[46px] rounded-[11px] border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#101B30] text-slate-900 dark:text-slate-100 font-[family-name:var(--font-manrope)] text-sm font-bold flex items-center justify-center gap-2 hover:border-violet-500 dark:hover:border-violet-400 transition-colors">
                <Edit2 className="w-4 h-4" /> Ver Detalhes
              </Link>
              <a href={`/api/romaneio/${r.id}/pdf`} target="_blank" rel="noreferrer" className="flex-[1.3] h-[46px] rounded-[11px] bg-gradient-to-r from-blue-500 to-violet-500 text-white font-[family-name:var(--font-manrope)] text-sm font-extrabold flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(99,102,241,0.32)] hover:-translate-y-[1px] transition-transform">
                <Printer className="w-4 h-4" /> Imprimir Romaneio
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
