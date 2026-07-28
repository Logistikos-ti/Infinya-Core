"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUserContext } from "@/lib/auth";
import {
  mobileColors,
  hexAlpha,
  headingFont,
  MobileIcon,
  MobileCard,
  type MobileIconName,
} from "@/components/mobile/mobile-kit";

type OperationsSnapshot = {
  picking: { count: number };
  receiving: { count: number };
  conference: { count: number };
};

type InicioClientProps = {
  user: AppUserContext;
  snapshot: OperationsSnapshot;
  totalPendencias: number;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia,";
  if (hour < 18) return "Boa tarde,";
  return "Boa noite,";
}

export function InicioClient({ user, snapshot, totalPendencias }: InicioClientProps) {
  const router = useRouter();
  const [greeting, setGreeting] = useState(getGreeting);

  useEffect(() => {
    setGreeting(getGreeting());
    const timer = window.setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 px-[22px] pb-[14px] pt-[18px]">
        <div className="flex flex-1 flex-col gap-px min-w-0">
          <span className="text-[12px]" style={{ color: mobileColors.muted }}>
            {greeting}
          </span>
          <span className="truncate text-[17px] font-extrabold" style={headingFont}>
            {user.nome}
          </span>
        </div>
        <button
          onClick={() => router.push("/m/sair")}
          title="Sair"
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95"
          style={{
            border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
            background: hexAlpha("#94A3B8", 0.06),
            color: mobileColors.muted,
          }}
        >
          <MobileIcon name="logout" size={19} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex shrink-0 gap-2.5 px-[22px] pb-[16px]">
        <StatCard value={totalPendencias} label="tarefas hoje" color={mobileColors.blueLight} />
        <StatCard value={snapshot.picking.count} label="linhas / dia" color={mobileColors.green} />
        <StatCard value="99%" label="acuracidade" color={mobileColors.violetLight} />
      </div>

      <div className="shrink-0 px-[22px] pb-2">
        <span
          className="text-[12.5px] font-bold uppercase"
          style={{ letterSpacing: "0.06em", color: mobileColors.dim }}
        >
          Minhas tarefas
        </span>
      </div>

      {/* Task list */}
      <div className="app-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-[22px] pb-[10px] pt-1">
        <TaskCard
          title="Separação"
          sub="Onda de separação pendente"
          badge={snapshot.picking.count > 0 ? String(snapshot.picking.count) : undefined}
          icon="pick"
          color={mobileColors.blue}
          onClick={() => router.push("/m/separacao")}
        />
        <TaskCard
          title="Recebimento"
          sub="Fila inbound do turno"
          badge={snapshot.receiving.count > 0 ? String(snapshot.receiving.count) : undefined}
          icon="inbound"
          color={mobileColors.violet}
          onClick={() => router.push("/m/recebimento")}
        />
        <TaskCard
          title="Inventário"
          sub="Contagem por depositante"
          icon="clip"
          color={mobileColors.amber}
          onClick={() => router.push("/m/estoque")}
        />
      </div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div
      className="flex flex-1 flex-col gap-0.5 rounded-[14px] px-[14px] py-[13px]"
      style={{ background: hexAlpha(color, 0.1), border: `1px solid ${hexAlpha(color, 0.22)}` }}
    >
      <span className="text-[22px] font-bold" style={{ color, ...headingFont }}>
        {value}
      </span>
      <span className="text-[11.5px]" style={{ color: mobileColors.muted }}>
        {label}
      </span>
    </div>
  );
}

function TaskCard({
  title,
  sub,
  badge,
  icon,
  color,
  onClick,
}: {
  title: string;
  sub: string;
  badge?: string;
  icon: MobileIconName;
  color: string;
  onClick: () => void;
}) {
  return (
    <MobileCard as="button" onClick={onClick} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
      <span
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px]"
        style={{ background: hexAlpha(color, 0.16), color }}
      >
        <MobileIcon name={icon} size={22} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-extrabold" style={{ color: mobileColors.text, ...headingFont }}>
            {title}
          </span>
          {badge ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
              style={{ background: hexAlpha(mobileColors.red, 0.16), color: mobileColors.redLight }}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <span
          className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]"
          style={{ color: mobileColors.muted }}
        >
          {sub}
        </span>
      </div>
      <span className="text-[20px] font-bold" style={{ color: mobileColors.dim }}>
        &#8250;
      </span>
    </MobileCard>
  );
}
