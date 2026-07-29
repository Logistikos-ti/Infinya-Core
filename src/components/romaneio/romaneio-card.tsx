import { MapPin, Truck } from "lucide-react";
import type { RomaneioUI } from "./romaneio-types";

type RomaneioCardProps = {
  romaneio: RomaneioUI;
  onClick?: () => void;
};

export function RomaneioCard({ romaneio: r, onClick }: RomaneioCardProps) {
  return (
    <div
      onClick={onClick}
      className="rounded-[18px] border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#101B30] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 hover:border-violet-400/50 dark:hover:border-violet-500/40 group flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-[18px] py-4 border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 shrink-0 rounded-[11px] flex items-center justify-center font-[family-name:var(--font-space-grotesk)] text-[13px] font-extrabold"
            style={{ backgroundColor: r.carrierBg, color: r.carrierColor }}
          >
            {r.carrierInit}
          </span>
          <div className="flex flex-col gap-[1px]">
            <span className="font-[family-name:var(--font-space-grotesk)] text-base font-bold text-slate-900 dark:text-slate-100">
              {r.code}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {r.carrier}
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-[7px] px-3 py-[5px] rounded-full text-xs font-bold"
          style={{ backgroundColor: r.statusBg, color: r.statusColor }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{ backgroundColor: r.statusDot }}
          />
          {r.status}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col p-[18px] gap-[14px]">
        <div className="flex items-center gap-2.5 text-[13.5px]">
          <MapPin className="w-[17px] h-[17px] text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
            {r.route}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col gap-[3px] p-2.5 rounded-[11px] bg-slate-50 dark:bg-slate-800/40">
            <span className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold text-slate-900 dark:text-slate-100">
              {r.orders}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              pedidos
            </span>
          </div>
          <div className="flex flex-col gap-[3px] p-2.5 rounded-[11px] bg-slate-50 dark:bg-slate-800/40">
            <span className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold text-slate-900 dark:text-slate-100">
              {r.volumes}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              volumes
            </span>
          </div>
          <div className="flex flex-col gap-[3px] p-2.5 rounded-[11px] bg-slate-50 dark:bg-slate-800/40">
            <span className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold text-slate-900 dark:text-slate-100">
              {r.weight}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              peso
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-[7px]">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-slate-500 dark:text-slate-400">
              Ocupação do veículo
            </span>
            <span
              className="font-bold"
              style={{ color: r.capColor }}
            >
              {r.cap}%
            </span>
          </div>
          <div className="h-[7px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out origin-left"
              style={{ width: `${r.cap}%`, background: r.capFill }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-[9px] min-w-0">
            <Truck className="w-[18px] h-[18px] text-slate-400 dark:text-slate-500 shrink-0" />
            <div className="flex flex-col gap-[1px] min-w-0">
              <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                {r.driver}
              </span>
              <span className="font-[family-name:var(--font-space-grotesk)] text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                {r.plate} · {r.vehicle}
              </span>
            </div>
          </div>
          <span
            className="text-[12.5px] font-bold whitespace-nowrap ml-2"
            style={{ color: r.depColor }}
          >
            {r.departure}
          </span>
        </div>
      </div>
    </div>
  );
}
