"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, PackageCheck, Boxes, LogOut } from "lucide-react";
import { IOSListRow } from "@/components/mobile/ios-glass";
import type { AppUserContext } from "@/lib/auth";

type InicioClientProps = {
  user: AppUserContext;
  snapshot: any;
  totalPendencias: number;
};

export function InicioClient({ user, snapshot, totalPendencias }: InicioClientProps) {
  const router = useRouter();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const pressDigit = (d: string) => {
    if (pin.length >= 4) return;
    const np = pin + d;
    setPin(np);
    setPinError(false);
    if (np.length === 4) {
      setTimeout(() => {
        if (np === "1234") {
          setIsUnlocked(true);
          setPin("");
        } else {
          setPin("");
          setPinError(true);
        }
      }, 180);
    }
  };

  const handleLogout = () => {
    router.push("/m/sair");
  };

  if (!isUnlocked) {
    const pinDots = [0, 1, 2, 3].map((i) => ({
      bg: i < pin.length ? "#8B5CF6" : "transparent",
      border: i < pin.length ? "#8B5CF6" : "rgba(148,163,184,0.4)",
    }));

    const kd = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "ok"];
    
    return (
      <div className="flex flex-col flex-1 px-[26px] pt-2 pb-6">
        <div className="flex flex-col flex-1 items-center justify-center gap-2">
          <div className="w-[66px] h-[66px] rounded-[20px] flex items-center justify-center mb-1.5 shadow-[0_14px_34px_rgba(99,102,241,0.4)] bg-gradient-to-br from-blue-500 to-violet-500">
            <ScanLine className="text-white w-8 h-8" />
          </div>
          <span className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.42em] text-slate-500">
            INFINOOS
          </span>
          <span className="font-['Space_Grotesk'] text-[30px] font-bold leading-none bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            WMS · Coletor
          </span>
          
          <div className="mt-[18px] flex items-center gap-[9px] px-[15px] py-2 rounded-xl bg-slate-400/10 border border-slate-400/15">
            <span className="text-slate-400 text-sm font-bold">
              Matrícula {user.id.slice(0, 4)} · {user.nome.split(" ")[0]}
            </span>
          </div>

          <span className="mt-6 text-[13.5px] font-semibold text-slate-400">
            Digite seu PIN
          </span>
          <div className="flex gap-[14px] mt-3">
            {pinDots.map((d, i) => (
              <span
                key={i}
                className="w-[15px] h-[15px] rounded-full transition-all duration-150 ease-in-out"
                style={{ background: d.bg, border: `2px solid ${d.border}` }}
              />
            ))}
          </div>
          {pinError && (
            <span className="mt-3 text-[12.5px] font-bold text-red-500">
              PIN incorreto — tente novamente
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 pb-2 mt-8">
          {kd.map((label) => {
            const isDel = label === "⌫";
            const isOk = label === "ok";
            const isNum = !isDel && !isOk;
            
            return (
              <button
                key={label}
                onClick={() => {
                  if (isDel) {
                    setPin((p) => p.slice(0, -1));
                    setPinError(false);
                  } else if (isNum) {
                    pressDigit(label);
                  }
                }}
                className={`h-[62px] rounded-2xl border flex items-center justify-center font-['Space_Grotesk'] font-semibold text-[25px] active:scale-95 transition-transform ${
                  isOk
                    ? "border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30"
                    : "border-slate-400/15 bg-slate-400/5 text-slate-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span className="text-center text-[11.5px] text-slate-500 mt-1">
          Dica: PIN de demonstração é 1234
        </span>
      </div>
    );
  }

  // Home Screen
  const userInitials = user.nome.split(" ").map(n => n[0]).slice(0, 2).join("");

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="shrink-0 px-[22px] pb-[14px] flex items-center gap-3">
        <div className="w-[44px] h-[44px] rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-[15px]">
          {userInitials}
        </div>
        <div className="flex-1 flex flex-col gap-px">
          <span className="text-[12px] text-slate-400">Bom dia,</span>
          <span className="text-[17px] font-extrabold font-['Space_Grotesk']">
            {user.nome}
          </span>
        </div>
        <button
          onClick={handleLogout}
          title="Sair"
          className="w-[40px] h-[40px] rounded-xl border border-slate-400/15 bg-slate-400/5 text-slate-400 flex items-center justify-center active:scale-95 transition-transform"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="shrink-0 px-[22px] pb-[16px] flex gap-2.5">
        <div className="flex-1 p-[13px_14px] rounded-[14px] bg-blue-500/10 border border-blue-500/20 flex flex-col gap-[2px]">
          <span className="font-['Space_Grotesk'] text-[22px] font-bold text-blue-400">
            {totalPendencias}
          </span>
          <span className="text-[11.5px] text-slate-400">tarefas hoje</span>
        </div>
        <div className="flex-1 p-[13px_14px] rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-[2px]">
          <span className="font-['Space_Grotesk'] text-[22px] font-bold text-emerald-500">
            {snapshot.picking.count}
          </span>
          <span className="text-[11.5px] text-slate-400">linhas pick</span>
        </div>
        <div className="flex-1 p-[13px_14px] rounded-[14px] bg-violet-500/10 border border-violet-500/20 flex flex-col gap-[2px]">
          <span className="font-['Space_Grotesk'] text-[22px] font-bold text-violet-400">
            99%
          </span>
          <span className="text-[11.5px] text-slate-400">acuracidade</span>
        </div>
      </div>

      <div className="shrink-0 px-[22px] pb-2">
        <span className="text-[12.5px] font-bold tracking-[0.06em] uppercase text-slate-500">
          Minhas tarefas
        </span>
      </div>

      {/* Task List */}
      <div className="app-scroll flex-1 overflow-y-auto px-[22px] pt-1 pb-[10px] flex flex-col gap-3">
        <TaskCard
          title="Separação"
          sub="Pedidos aguardando coleta"
          badge={`${snapshot.picking.count}`}
          hasBadge={snapshot.picking.count > 0}
          badgeBg="#DBEAFE"
          badgeColor="#1E40AF"
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
          icon={<ScanLine className="w-6 h-6" />}
          border="rgba(59,130,246,0.15)"
          bg="rgba(59,130,246,0.04)"
          onClick={() => router.push("/m/separacao")}
        />
        
        <TaskCard
          title="Recebimento"
          sub="Fila inbound do turno"
          badge={`${snapshot.receiving.count}`}
          hasBadge={snapshot.receiving.count > 0}
          badgeBg="#D1FAE5"
          badgeColor="#065F46"
          iconBg="#ECFDF5"
          iconColor="#10B981"
          icon={<PackageCheck className="w-6 h-6" />}
          border="rgba(16,185,129,0.15)"
          bg="rgba(16,185,129,0.04)"
          onClick={() => router.push("/m/recebimento")}
        />

        <TaskCard
          title="Inventário"
          sub="Consultas e auditoria"
          badge=""
          hasBadge={false}
          badgeBg="#EDE9FE"
          badgeColor="#5B21B6"
          iconBg="#F5F3FF"
          iconColor="#8B5CF6"
          icon={<Boxes className="w-6 h-6" />}
          border="rgba(139,92,246,0.15)"
          bg="rgba(139,92,246,0.04)"
          onClick={() => router.push("/m/estoque")}
        />
      </div>
    </div>
  );
}

function TaskCard({ title, sub, badge, hasBadge, badgeBg, badgeColor, iconBg, iconColor, icon, border, bg, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-[18px] flex items-center gap-[14px] active:scale-[0.985] transition-transform animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ border: `1px solid ${border}`, background: bg }}
    >
      <span
        className="w-[46px] h-[46px] shrink-0 rounded-[13px] flex items-center justify-center"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-extrabold text-slate-100 font-['Space_Grotesk']">
            {title}
          </span>
          {hasBadge && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
              style={{ background: badgeBg, color: badgeColor }}
            >
              {badge}
            </span>
          )}
        </div>
        <span className="text-[12.5px] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
          {sub}
        </span>
      </div>
      <span className="text-slate-500 text-[20px] font-bold">›</span>
    </button>
  );
}
