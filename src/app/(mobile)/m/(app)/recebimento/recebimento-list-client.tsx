"use client";

import { useRouter } from "next/navigation";
import { PackageCheck, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

type RecebimentoListClientProps = {
  orders: any[];
  totalOrders: number;
};

const RECEIVING_CARD_TONES = [
  { border: "rgba(16,185,129,0.15)", bg: "rgba(16,185,129,0.04)", iconBg: "#ECFDF5", iconColor: "#10B981", tagBg: "#D1FAE5", tagColor: "#065F46" },
  { border: "rgba(14,165,233,0.15)", bg: "rgba(14,165,233,0.04)", iconBg: "#F0F9FF", iconColor: "#0EA5E9", tagBg: "#E0F2FE", tagColor: "#075985" },
];

export function RecebimentoListClient({
  orders,
  totalOrders,
}: RecebimentoListClientProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="shrink-0 px-[18px] pb-[14px] flex items-center gap-3">
        <button
          onClick={() => router.push("/m/inicio")}
          className="w-[40px] h-[40px] rounded-xl border border-slate-400/15 bg-slate-400/5 text-slate-100 flex items-center justify-center text-[20px] active:scale-95 transition-transform"
        >
          ‹
        </button>
        <div className="flex-1 flex flex-col gap-px">
          <span className="text-[16px] font-extrabold font-['Space_Grotesk'] text-white">Fila de Recebimento</span>
          <span className="text-[12px] text-slate-400">Fila inbound do turno</span>
        </div>
        <span className="px-[11px] py-[5px] rounded-full text-[11.5px] font-extrabold bg-slate-400/10 text-slate-400">
          {totalOrders}
        </span>
      </div>

      {/* List */}
      <div className="app-scroll flex-1 overflow-y-auto px-[18px] pb-[10px] flex flex-col gap-[11px]">
        {orders.length > 0 ? (
          orders.map((order, index) => {
            const tone = RECEIVING_CARD_TONES[index % RECEIVING_CARD_TONES.length];
            return (
              <button
                key={order.id}
                onClick={() => router.push(`/m/recebimento/${order.id}`)}
                className="text-left p-[15px] rounded-[16px] flex items-center gap-[13px] active:scale-[0.985] transition-transform animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ border: `1px solid ${tone.border}`, background: tone.bg }}
              >
                <span
                  className="w-[44px] h-[44px] shrink-0 rounded-[12px] flex items-center justify-center"
                  style={{ background: tone.iconBg, color: tone.iconColor }}
                >
                  <PackageCheck className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <div className="flex items-center gap-[7px]">
                    <span className="font-['Space_Grotesk'] text-[15.5px] font-extrabold text-white">
                      {order.code}
                    </span>
                    <span
                      className="px-2 py-[2px] rounded-full text-[10px] font-extrabold whitespace-nowrap"
                      style={{ background: tone.tagBg, color: tone.tagColor }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <span className="text-[12px] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                    {order.depositante} • {order.volumeCount} volumes
                  </span>
                </div>
                <span className="text-slate-500 text-[19px] font-bold">›</span>
              </button>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm font-semibold text-slate-400">
            Nenhum recebimento disponível no momento.
          </div>
        )}
      </div>
    </div>
  );
}
