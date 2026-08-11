"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, Search } from "lucide-react";
import { FancySelectInput } from "@/components/ui/fancy-select-input";

type ShippingConferenceSplitLayoutProps = {
  initialOrders: any[];
  children: React.ReactNode;
};

const activeConferenceStatuses = new Set(["SEPARADO", "EM_CONFERENCIA"]);

export function ShippingConferenceSplitLayout({
  initialOrders,
  children,
}: ShippingConferenceSplitLayoutProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [depositanteFilter, setDepositanteFilter] = useState("todos");
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

  const depositanteOptions = useMemo(() => {
    const depositantes = new Map<string, string>();

    initialOrders.forEach((order) => {
      if (!activeConferenceStatuses.has(order.status)) return;
      if (!order.depositanteId) return;

      depositantes.set(order.depositanteId, order.depositante || "Sem depositante");
    });

    return [
      { value: "todos", label: "Todos" },
      ...Array.from(depositantes.entries())
        .sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [initialOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return initialOrders.filter((order) => {
      if (!activeConferenceStatuses.has(order.status)) return false;

      if (depositanteFilter !== "todos" && order.depositanteId !== depositanteFilter) {
        return false;
      }

      if (normalizedSearch) {
        const code = String(order.displayNumber || "").toLowerCase();
        const customer = String(order.customer || "").toLowerCase();
        const depositante = String(order.depositante || "").toLowerCase();

        if (!code.includes(normalizedSearch) && !customer.includes(normalizedSearch) && !depositante.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [initialOrders, depositanteFilter, searchQuery]);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "100%" }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: t.text }}>
              Fila de conferência
            </span>
            <span style={{ fontSize: "13px", color: t.textSub }}>
              {filteredOrders.length} {filteredOrders.length === 1 ? "pedido aguardando validação de saída." : "pedidos aguardando validação de saída."}
            </span>
          </div>

          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ position: "relative" }}>
              <Search
                className="h-4 w-4"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: t.textSub,
                  pointerEvents: "none",
                }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar pedido, cliente..."
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 14,
                  border: `1px solid ${t.border}`,
                  background: t.inputBg,
                  color: t.text,
                  padding: "0 14px 0 40px",
                  fontSize: 13,
                  outline: "none",
                  boxShadow: isDark ? "none" : "0 10px 28px rgba(15,23,42,0.04)",
                }}
              />
            </div>

            <FancySelectInput
              label="Depositante"
              name="conferenceDepositanteFilter"
              value={depositanteFilter}
              onChange={setDepositanteFilter}
              options={depositanteOptions}
              menuClassName="max-h-72"
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 12px", color: t.textSub, fontSize: "13px" }}>
              Nenhum pedido na fila com estes filtros.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isActive = pathname === `/expedicao/conferencia/${order.id}`;
              const marketplaceName = order.marketplace || order.destination || "Site Próprio";
              const color = carriers[marketplaceName] || "#64748B";

              return (
                <Link
                  key={order.id}
                  href={`/expedicao/conferencia/${order.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    if (isActive) return;
                    startTransition(() => {
                      router.push(`/expedicao/conferencia/${order.id}`, { scroll: false });
                    });
                  }}
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    textDecoration: "none",
                    border: `1.5px solid ${isActive ? "#8B5CF6" : t.border}`,
                    background: isActive ? hex2("#8B5CF6", 0.08) : t.cardBg,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    transition: "all 0.16s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14.5px", fontWeight: 700, color: t.text }}>
                      {order.displayNumber}
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
                        background: hex2(color, 0.15),
                        color,
                      }}
                    >
                      {marketplaceName}
                    </span>
                  </div>
                  <span style={{ fontSize: "12.5px", color: t.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {order.customer} · {order.totalUnits} {order.totalUnits === 1 ? "item" : "itens"}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {children}

        {isPending ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: isDark ? "rgba(10,17,32,0.6)" : "rgba(255,255,255,0.6)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                background: t.cardBg,
                padding: "20px 32px",
                borderRadius: "16px",
                border: `1px solid ${t.border}`,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              <span style={{ color: t.text, fontWeight: 600, fontSize: "14px" }}>Carregando pedido...</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
