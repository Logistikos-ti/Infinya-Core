import Link from "next/link";
import { requireModuleAccess } from "@/lib/auth";
import { listRomaneioRecordsFromDb } from "@/lib/romaneio-records";
import { mobileColors, hexAlpha, headingFont } from "@/components/mobile/mobile-kit-tokens";
import { RomaneioListClient } from "./romaneio-list-client";

type MobileRomaneioPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function MobileRomaneioPage({ searchParams }: MobileRomaneioPageProps) {
  const user = await requireModuleAccess("romaneio");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? "";

  const records = await listRomaneioRecordsFromDb(user);

  const totalOrders = records.reduce((sum, item) => sum + item.orderCount, 0);
  const openCount = records.filter((r) => r.status === "ABERTO").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Standard Mobile Header */}
      <div style={{ flexShrink: 0, padding: "18px 18px 14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href="/m/inicio"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: `1px solid ${hexAlpha("#94A3B8", 0.16)}`,
            background: hexAlpha("#94A3B8", 0.06),
            color: mobileColors.text,
            cursor: "pointer",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            textDecoration: "none",
          }}
        >
          &#8249;
        </Link>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, ...headingFont }}>Romaneio</span>
          <span style={{ fontSize: 12, color: mobileColors.muted }}>Cargas consolidadas</span>
        </div>
        <span
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 800,
            background: hexAlpha("#94A3B8", 0.1),
            color: mobileColors.muted,
            flexShrink: 0,
          }}
        >
          {records.length} criado{records.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="app-scroll space-y-4 px-[18px] pb-[24px]" style={{ flex: 1, overflowY: "auto" }}>
        {feedback === "criado" && (
          <div
            className="rounded-[15px] px-4 py-3 text-sm font-semibold"
            style={{
              background: hexAlpha(mobileColors.green, 0.1),
              border: `1px solid ${hexAlpha(mobileColors.green, 0.2)}`,
              color: mobileColors.green,
            }}
          >
            Romaneio gerado com sucesso!
          </div>
        )}

        {feedback === "ja-finalizado" && (
          <div
            className="rounded-[15px] px-4 py-3 text-sm font-semibold"
            style={{
              background: hexAlpha(mobileColors.amber, 0.1),
              border: `1px solid ${hexAlpha(mobileColors.amber, 0.2)}`,
              color: mobileColors.amber,
            }}
          >
            Este romaneio já foi finalizado.
          </div>
        )}

        {/* 3 Stat Cards */}
        <div className="flex gap-2.5">
          <StatCard value={records.length} label="romaneios" color={mobileColors.violetLight} />
          <StatCard value={openCount} label="em aberto" color={mobileColors.amber} />
          <StatCard value={totalOrders} label="pedidos" color={mobileColors.blueLight} />
        </div>

        <RomaneioListClient records={records} />
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
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
