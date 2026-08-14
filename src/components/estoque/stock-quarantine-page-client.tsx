"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  PackageOpen,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import type { StockQuarantineItem } from "@/lib/stock-quarantine";
import {
  FancySelectInput,
  type FancySelectOption,
} from "@/components/ui/fancy-select-input";
import { cn } from "@/lib/utils";

type DepositanteOption = {
  id: string;
  nome: string;
};

type StockQuarantinePageClientProps = {
  depositantes: DepositanteOption[];
  items: StockQuarantineItem[];
  allItems: StockQuarantineItem[];
  initialDepositanteId: string;
  initialStatus: string;
  initialQuery: string;
  canSelectDepositante: boolean;
  canResolve: boolean;
};

const STATUS_OPTIONS: FancySelectOption[] = [
  { value: "EM_QUARENTENA", label: "Em quarentena" },
  { value: "LIBERADO", label: "Liberados" },
  { value: "DESCARTADO", label: "Descartados" },
  { value: "TODOS", label: "Todos" },
];

type TableMode = "status" | "pending-addressing";

export function StockQuarantinePageClient({
  depositantes,
  items,
  allItems,
  initialDepositanteId,
  initialStatus,
  initialQuery,
  canSelectDepositante,
  canResolve,
}: StockQuarantinePageClientProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isPending, startTransition] = useTransition();
  const [depositanteId, setDepositanteId] = useState(initialDepositanteId);
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const [tableMode, setTableMode] = useState<TableMode>("status");
  const [selectedItem, setSelectedItem] = useState<StockQuarantineItem | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const t = {
    border: isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0",
    text: isDark ? "#F8FAFC" : "#0F172A",
    textSub: isDark ? "#94A3B8" : "#64748B",
    cardBg: isDark ? "#0F172A" : "#FFFFFF",
    inputBg: isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
    softBg: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9",
    headBg: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
  };

  const depositanteOptions = useMemo(
    () => [
      { value: "", label: "Todos" },
      ...depositantes.map((item) => ({ value: item.id, label: item.nome })),
    ],
    [depositantes],
  );

  const stats = useMemo(() => {
    const count = (targetStatus: string) =>
      allItems.filter((item) => item.status === targetStatus).length;
    const pendingAddressing = allItems.filter((item) => item.isSystemHold).length;

    return [
      {
        label: "Em quarentena",
        value: count("EM_QUARENTENA"),
        icon: ShieldAlert,
        color: "#F59E0B",
        mode: "status" as TableMode,
        status: "EM_QUARENTENA",
      },
      {
        label: "Descartados",
        value: count("DESCARTADO"),
        icon: Trash2,
        color: "#EF4444",
        mode: "status" as TableMode,
        status: "DESCARTADO",
      },
      {
        label: "Produtos sem endereço padrão",
        value: pendingAddressing,
        icon: PackageOpen,
        color: "#3B82F6",
        mode: "pending-addressing" as TableMode,
        status: "EM_QUARENTENA",
      },
    ];
  }, [allItems]);

  const displayItems = useMemo(() => {
    if (tableMode === "pending-addressing") {
      return allItems.filter((item) => item.isSystemHold);
    }

    return items;
  }, [allItems, items, tableMode]);

  function handleStatClick(stat: { mode: TableMode; status: string }) {
    setTableMode(stat.mode);
    if (stat.status !== status) {
      setStatus(stat.status);
      updateRoute({ status: stat.status });
    }
  }

  function updateRoute(next: { depositanteId?: string; status?: string; q?: string }) {
    const params = new URLSearchParams();
    const nextDepositanteId = next.depositanteId ?? depositanteId;
    const nextStatus = next.status ?? status;
    const nextQuery = next.q ?? query;

    if (nextDepositanteId) params.set("depositante", nextDepositanteId);
    if (nextStatus && nextStatus !== "EM_QUARENTENA") params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());

    startTransition(() => {
      router.replace(`/estoque/quarentena${params.toString() ? `?${params.toString()}` : ""}`);
    });
  }

  async function resolveQuarantine(id: string, action: "release" | "discard") {
    setFeedback(null);
    const response = await fetch(`/api/estoque/quarentena/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        type: "error",
        message: payload.error || "Não foi possível atualizar a quarentena.",
      });
      return;
    }

    setFeedback({
      type: "success",
      message: action === "release" ? "Saldo liberado para estoque." : "Saldo descartado da quarentena.",
    });
    setSelectedItem((current) => (current?.id === id ? null : current));
    router.refresh();
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "28px 32px 40px",
        background: "transparent",
        color: t.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.textSub }}>
            <span>WMS</span>
            <span>›</span>
            <span>Estoque</span>
            <span>›</span>
            <span style={{ color: t.text, fontWeight: 700 }}>Quarentena</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800 }}>
            Quarentena
          </h1>
          <p style={{ margin: 0, fontSize: 14.5, color: t.textSub }}>
            Produtos retidos por divergência, avaria, falta de endereço ou pendência operacional.
          </p>
        </div>
        <div
          style={{
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            background: t.inputBg,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 800,
            color: "#D97706",
          }}
        >
          <ShieldAlert size={16} />
          Controle operacional de retenções
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isActive = tableMode === stat.mode && status === stat.status;
          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => handleStatClick(stat)}
              className="text-left transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                border: `1px solid ${isActive ? stat.color : t.border}`,
                borderRadius: 18,
                background: t.cardBg,
                padding: 18,
                boxShadow: isActive ? `0 14px 34px ${stat.color}24` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: t.textSub }}>{stat.label}</p>
                  <strong style={{ display: "block", marginTop: 8, fontFamily: "'Space Grotesk', sans-serif", fontSize: 28 }}>
                    {stat.value.toLocaleString("pt-BR")}
                  </strong>
                </div>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: `${stat.color}1A`,
                    color: stat.color,
                  }}
                >
                  <Icon size={18} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <section style={{ border: `1px solid ${t.border}`, borderRadius: 20, background: t.cardBg, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: canSelectDepositante ? "minmax(160px, 220px) minmax(160px, 220px) 1fr" : "minmax(160px, 220px) 1fr",
            gap: 12,
            padding: 18,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <FancySelectInput
            label="Status"
            name="quarantine-status"
            value={status}
            onChange={(value) => {
              setTableMode("status");
              setStatus(value);
              updateRoute({ status: value });
            }}
            options={STATUS_OPTIONS}
          />
          {canSelectDepositante ? (
            <FancySelectInput
              label="Depositante"
              name="quarantine-filter-depositante"
              value={depositanteId}
              onChange={(value) => {
                setTableMode("status");
                setDepositanteId(value);
                updateRoute({ depositanteId: value });
              }}
              options={depositanteOptions}
            />
          ) : null}
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: t.textSub }}>Buscar</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setTableMode("status");
                  updateRoute({ q: query });
                }
              }}
              onBlur={() => {
                setTableMode("status");
                updateRoute({ q: query });
              }}
              placeholder="Produto, SKU, endereço ou motivo..."
              className="h-[52px] rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition hover:border-cyan-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-cyan-900/40"
            />
          </label>
        </div>

        {feedback ? (
          <div
            className={cn(
              "mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold",
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
            )}
          >
            {feedback.message}
          </div>
        ) : null}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead style={{ background: t.headBg }}>
              <tr>
                {["Produto", "Depositante", "Endereço", "Qtd.", "Status", "Registro"].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: "13px 16px",
                      textAlign: "left",
                      fontSize: 11.5,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      color: t.textSub,
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                  style={{ borderTop: `1px solid ${t.border}` }}
                >
                  <td style={{ padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          background: t.softBg,
                          overflow: "hidden",
                          display: "grid",
                          placeItems: "center",
                          color: "#8B5CF6",
                        }}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <PackageOpen size={18} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{ display: "block", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={item.productName}
                        >
                          {item.productName}
                        </strong>
                        <span style={{ fontSize: 12, color: t.textSub }}>{item.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 16, fontSize: 13, color: t.textSub }}>{item.depositante}</td>
                  <td style={{ padding: 16, fontSize: 13 }}>
                    <strong>{item.endereco}</strong>
                    <br />
                    <span style={{ color: t.textSub }}>{item.area}</span>
                  </td>
                  <td style={{ padding: 16, fontWeight: 800 }}>{item.quantityLabel}</td>
                  <td style={{ padding: 16 }}>
                    <StatusPill status={item.status} label={item.statusLabel} />
                  </td>
                  <td style={{ padding: 16, fontSize: 12.5, color: t.textSub }}>
                    <strong style={{ color: t.text }}>{item.createdBy}</strong>
                    <br />
                    {item.createdAtLabel}
                  </td>
                </tr>
              ))}
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 34, textAlign: "center", color: t.textSub }}>
                    Nenhum item encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedItem ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <aside
            className="h-full w-full max-w-[500px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-7 py-6 dark:border-white/10">
              <div>
                <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-500">Item em quarentena</p>
                <h2 className="font-['Space_Grotesk'] text-2xl font-extrabold text-slate-950 dark:text-white">
                  {selectedItem.productName}
                </h2>
                <StatusPill status={selectedItem.status} label={selectedItem.statusLabel} />
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                aria-label="Fechar detalhe da quarentena"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 px-7 py-6">
              <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-violet-500 shadow-sm dark:bg-slate-900">
                  {selectedItem.imageUrl ? (
                    <img src={selectedItem.imageUrl} alt={selectedItem.productName} className="h-full w-full object-cover" />
                  ) : (
                    <PackageOpen size={26} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold text-slate-950 dark:text-white">{selectedItem.productName}</p>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">SKU {selectedItem.sku}</p>
                  {selectedItem.internalCode ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Código interno {selectedItem.internalCode}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="Depositante" value={selectedItem.depositante} />
                <InfoTile label="Quantidade retida" value={`${selectedItem.quantityLabel} un`} />
                <InfoTile label="Endereço" value={selectedItem.endereco} />
                <InfoTile label="Área" value={selectedItem.area} />
              </div>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Motivo da quarentena
                </p>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedItem.reason}</p>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Registro
                </p>
                <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    Criado por <strong className="text-slate-950 dark:text-white">{selectedItem.createdBy}</strong> em{" "}
                    <strong className="text-slate-950 dark:text-white">{selectedItem.createdAtLabel}</strong>
                  </p>
                  {selectedItem.resolvedAtLabel ? (
                    <p>
                      Resolvido por <strong className="text-slate-950 dark:text-white">{selectedItem.resolvedBy || "Sistema"}</strong> em{" "}
                      <strong className="text-slate-950 dark:text-white">{selectedItem.resolvedAtLabel}</strong>
                    </p>
                  ) : null}
                  {selectedItem.resolutionNotes ? <p>Observação: {selectedItem.resolutionNotes}</p> : null}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Ações</p>
                {selectedItem.status === "EM_QUARENTENA" && canResolve ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => resolveQuarantine(selectedItem.id, "release")}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-extrabold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    >
                      <ArchiveRestore size={16} />
                      Liberar
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => resolveQuarantine(selectedItem.id, "discard")}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-extrabold text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-400 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                    >
                      <Trash2 size={16} />
                      Descartar
                    </button>
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:bg-white/5 dark:text-slate-300">
                    Sem ação pendente para este item.
                  </p>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-extrabold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const styles =
    status === "LIBERADO"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30"
      : status === "DESCARTADO"
        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/30"
        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold", styles)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
