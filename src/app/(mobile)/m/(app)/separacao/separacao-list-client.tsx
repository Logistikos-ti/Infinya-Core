"use client";

import { useRouter } from "next/navigation";
import { ScanLine, ArrowLeft, ArrowRight, Package2 } from "lucide-react";
import Link from "next/link";

type SeparacaoListClientProps = {
  orders: any[];
  totalOrders: number;
  pendingUnits: number;
  currentPage: number;
  totalPages: number;
  perPage: number;
  feedback: string;
};

const PICKING_CARD_TONES = [
  { border: "rgba(59,130,246,0.15)", bg: "rgba(59,130,246,0.04)", iconBg: "#EFF6FF", iconColor: "#3B82F6", tagBg: "#DBEAFE", tagColor: "#1E40AF" },
  { border: "rgba(6,182,212,0.15)", bg: "rgba(6,182,212,0.04)", iconBg: "#ECFEFF", iconColor: "#06B6D4", tagBg: "#CFFAFE", tagColor: "#164E63" },
  { border: "rgba(139,92,246,0.15)", bg: "rgba(139,92,246,0.04)", iconBg: "#F5F3FF", iconColor: "#8B5CF6", tagBg: "#EDE9FE", tagColor: "#5B21B6" },
];

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function getMobileShippingOrderHref(status: string, orderId: string) {
  if (["SEPARADO", "EM_CONFERENCIA", "CONFERIDO", "PRONTO_ROMANEIO"].includes(status)) {
    return `/m/conferencia/${orderId}`;
  }
  return `/m/separacao/${orderId}`;
}

export function SeparacaoListClient({
  orders,
  totalOrders,
  currentPage,
  totalPages,
  perPage,
  feedback,
}: SeparacaoListClientProps) {
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
          <span className="text-[16px] font-extrabold font-['Space_Grotesk'] text-white">Fila de Separação</span>
          <span className="text-[12px] text-slate-400">Pedidos aguardando coleta</span>
        </div>
        <span className="px-[11px] py-[5px] rounded-full text-[11.5px] font-extrabold bg-slate-400/10 text-slate-400">
          {totalOrders}
        </span>
      </div>

      {feedback && (
        <div className="shrink-0 px-[18px] pb-[14px]">
          <div className="px-4 py-3 rounded-[15px] bg-amber-500/10 border border-amber-500/20 text-sm font-semibold text-amber-500">
            {feedback === "inatividade" && "Pedido devolvido por inatividade."}
            {feedback === "incompleto" && "Pedido voltou para a fila para nova separação."}
            {feedback === "concluido" && <span className="text-emerald-500">Separação concluída com sucesso.</span>}
          </div>
        </div>
      )}

      {/* List */}
      <div className="app-scroll flex-1 overflow-y-auto px-[18px] pb-[10px] flex flex-col gap-[11px]">
        {orders.length > 0 ? (
          orders.map((order, index) => {
            const tone = PICKING_CARD_TONES[index % PICKING_CARD_TONES.length];
            return (
              <button
                key={order.id}
                onClick={() => router.push(getMobileShippingOrderHref(order.status, order.id))}
                className="text-left p-[15px] rounded-[16px] flex items-center gap-[13px] active:scale-[0.985] transition-transform animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ border: `1px solid ${tone.border}`, background: tone.bg }}
              >
                <span
                  className="w-[44px] h-[44px] shrink-0 rounded-[12px] flex items-center justify-center"
                  style={{ background: tone.iconBg, color: tone.iconColor }}
                >
                  <ScanLine className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <div className="flex items-center gap-[7px]">
                    <span className="font-['Space_Grotesk'] text-[15.5px] font-extrabold text-white">
                      {order.displayNumber}
                    </span>
                    <span
                      className="px-2 py-[2px] rounded-full text-[10px] font-extrabold whitespace-nowrap"
                      style={{ background: tone.tagBg, color: tone.tagColor }}
                    >
                      {order.statusLabel}
                    </span>
                  </div>
                  <span className="text-[12px] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                    {order.customer} • {order.totalItems} itens ({order.completionPercent}%)
                  </span>
                </div>
                <span className="text-slate-500 text-[19px] font-bold">›</span>
              </button>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm font-semibold text-slate-400">
            Nenhum pedido disponível no momento.
          </div>
        )}

        {/* Pagination Controls */}
        {orders.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-2 bg-slate-400/5 p-2 rounded-[16px] border border-slate-400/10">
            <Link
              href={`/m/separacao?${buildQueryString({
                feedback,
                perPage: String(perPage),
                page: String(Math.max(1, currentPage - 1)),
              })}`}
              className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors ${
                currentPage <= 1 ? "opacity-50 pointer-events-none" : "bg-slate-400/10 text-slate-200 active:scale-95"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-[12px] font-bold text-slate-400">
              Página {currentPage} de {totalPages}
            </span>
            <Link
              href={`/m/separacao?${buildQueryString({
                feedback,
                perPage: String(perPage),
                page: String(Math.min(totalPages, currentPage + 1)),
              })}`}
              className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors ${
                currentPage >= totalPages ? "opacity-50 pointer-events-none" : "bg-slate-400/10 text-slate-200 active:scale-95"
              }`}
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
