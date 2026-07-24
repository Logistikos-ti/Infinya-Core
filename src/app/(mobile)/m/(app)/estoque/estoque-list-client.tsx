"use client";

import { useRouter } from "next/navigation";
import { PlusCircle, MoveRight, ClipboardList } from "lucide-react";

export function EstoqueListClient() {
  const router = useRouter();

  const actionCards = [
    {
      href: "/m/estoque/saldo-inicial",
      title: "Lançar estoque",
      sub: "Registrar a primeira carga",
      tag: "Entrada",
      icon: <PlusCircle className="w-5 h-5" />,
      border: "rgba(6,182,212,0.15)",
      bg: "rgba(6,182,212,0.04)",
      iconBg: "#ECFEFF",
      iconColor: "#06B6D4",
      tagBg: "#CFFAFE",
      tagColor: "#164E63",
    },
    {
      href: "/m/estoque/movimentacao-interna",
      title: "Movimentação",
      sub: "Transfira saldo entre endereços",
      tag: "Interno",
      icon: <MoveRight className="w-5 h-5" />,
      border: "rgba(139,92,246,0.15)",
      bg: "rgba(139,92,246,0.04)",
      iconBg: "#F5F3FF",
      iconColor: "#8B5CF6",
      tagBg: "#EDE9FE",
      tagColor: "#5B21B6",
    },
    {
      href: "/m/estoque/inventarios",
      title: "Inventário cíclico",
      sub: "Abra contagens cegas",
      tag: "Auditoria",
      icon: <ClipboardList className="w-5 h-5" />,
      border: "rgba(245,158,11,0.15)",
      bg: "rgba(245,158,11,0.04)",
      iconBg: "#FEF3C7",
      iconColor: "#F59E0B",
      tagBg: "#FEF3C7",
      tagColor: "#92400E",
    },
  ];

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
          <span className="text-[16px] font-extrabold font-['Space_Grotesk'] text-white">Fluxos do Estoque</span>
          <span className="text-[12px] text-slate-400">Auditoria e controle</span>
        </div>
        <span className="px-[11px] py-[5px] rounded-full text-[11.5px] font-extrabold bg-slate-400/10 text-slate-400">
          3
        </span>
      </div>

      {/* List */}
      <div className="app-scroll flex-1 overflow-y-auto px-[18px] pb-[10px] flex flex-col gap-[11px]">
        {actionCards.map((card, index) => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className="text-left p-[15px] rounded-[16px] flex items-center gap-[13px] active:scale-[0.985] transition-transform animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ border: `1px solid ${card.border}`, background: card.bg }}
          >
            <span
              className="w-[44px] h-[44px] shrink-0 rounded-[12px] flex items-center justify-center"
              style={{ background: card.iconBg, color: card.iconColor }}
            >
              {card.icon}
            </span>
            <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
              <div className="flex items-center gap-[7px]">
                <span className="font-['Space_Grotesk'] text-[15.5px] font-extrabold text-white">
                  {card.title}
                </span>
                <span
                  className="px-2 py-[2px] rounded-full text-[10px] font-extrabold whitespace-nowrap"
                  style={{ background: card.tagBg, color: card.tagColor }}
                >
                  {card.tag}
                </span>
              </div>
              <span className="text-[12px] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                {card.sub}
              </span>
            </div>
            <span className="text-slate-500 text-[19px] font-bold">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
