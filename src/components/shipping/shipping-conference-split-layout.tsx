"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Filter, Search } from "lucide-react";
import Link from "next/link";
import { FancySelectInput } from "@/components/ui/fancy-select-input";

type ShippingConferenceSplitLayoutProps = {
  initialOrders: any[];
  children: React.ReactNode;
};

export function ShippingConferenceSplitLayout({ initialOrders, children }: ShippingConferenceSplitLayoutProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();
  const router = useRouter();

  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const t = isDark
    ? {
        sideBg2: "transparent",
        cardBg: "#101B30",
        inputBg: "#0E1728",
        border: "rgba(148,163,184,0.14)",
        text: "#F1F5F9",
        textSub: "#8695AD",
      }
    : {
        sideBg2: "transparent",
        cardBg: "#FFFFFF",
        inputBg: "rgba(255, 255, 255, 0.6)",
        border: "rgba(100,116,139,0.16)",
        text: "#0F172A",
        textSub: "#64748B",
      };

  const hex2 = (h: string, a: number) => {
    const n = parseInt(h.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  };

  const carriers: Record<string, string> = {
    "Mercado Livre": "#2D3277",
    Shopee: "#EE4D2D",
    Amazon: "#FF9900",
    Magalu: "#0086FF",
  };

  const marketplaces = useMemo(() => {
    const mkts = new Set<string>();
    initialOrders.forEach((o) => {
      if (o.marketplace) mkts.add(o.marketplace);
      else if (o.destination) mkts.add(o.destination); // Fallback if marketplace is not explicitly in db result yet
    });
    return ["Todos", ...Array.from(mkts).filter(Boolean)];
  }, [initialOrders]);

  const filteredOrders = useMemo(() => {
    return initialOrders.filter((o) => {
      // Status filter: we usually only want to show SEPARADO and EM_CONFERENCIA in the queue
      if (o.status !== "SEPARADO" && o.status !== "EM_CONFERENCIA") return false;

      const mkt = o.marketplace || o.destination || "";
      if (marketplaceFilter !== "Todos" && mkt !== marketplaceFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const code = (o.displayNumber || "").toLowerCase();
        const customer = (o.customer || "").toLowerCase();
        if (!code.includes(query) && !customer.includes(query)) return false;
      }

      return true;
    });
  }, [initialOrders, marketplaceFilter, searchQuery]);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "100%" }}>
      {/* LEFT: conference queue */}
      <div
        style={{
          width: "320px",
          flexShrink: 0,
          borderRight: `1px solid ${t.border}`,
          display: "flex",
          flexDirection: "column",
          background: t.sideBg2,
        }}
      >
        <div style={{ padding: "20px 22px 16px 22px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: t.text }}>
              Fila de conferência
            </span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: t.textSub }}>
              &middot; {filteredOrders.length}
            </span>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {marketplaces.length > 1 && (
              <div style={{ marginTop: "4px" }}>
                <FancySelectInput
                  label="Marketplace"
                  name="marketplaceFilter"
                  value={marketplaceFilter}
                  onChange={setMarketplaceFilter}
                  options={[
                    { value: "Todos", label: "Todos os marketplaces" },
                    ...marketplaces.filter(m => m !== "Todos").map(m => ({ value: m, label: m }))
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 12px", color: t.textSub, fontSize: "13px" }}>
              Nenhum pedido na fila com estes filtros.
            </div>
          ) : (
            filteredOrders.map((o) => {
              const isActive = pathname === `/expedicao/conferencia/${o.id}`;
              const carrierName = o.carrier || "Transportadora";
              const c = carriers[carrierName] || "#64748B";

              return (
                <Link
                  key={o.id}
                  href={`/expedicao/conferencia/${o.id}`}
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    textDecoration: "none",
                    border: `1.5px solid ${isActive ? "#8B5CF6" : t.border}`,
                    background: isActive ? hex2("#8B5CF6", 0.1) : t.cardBg,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    transition: "all 0.16s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14.5px", fontWeight: 700, color: t.text }}>
                      {o.displayNumber}
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 9px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: hex2(c, 0.15),
                        color: c,
                      }}
                    >
                      {carrierName}
                    </span>
                  </div>
                  <span style={{ fontSize: "12.5px", color: t.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.customer} · {o.totalUnits} {o.totalUnits === 1 ? "item" : "itens"}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* CENTER: active conference */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}
