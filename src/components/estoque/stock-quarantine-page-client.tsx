"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, CheckCircle2, PackageOpen, ShieldAlert, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";

import type { StockQuarantineItem } from "@/lib/stock-quarantine";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";
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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const t = {
    appBg: isDark ? "#0B1120" : "#FFFFFF",
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
    const count = (targetStatus: string) => allItems.filter((item) => item.status === targetStatus).length;

    return [
      {
        label: "Em quarentena",
        value: count("EM_QUARENTENA"),
        icon: ShieldAlert,
        color: "#F59E0B",
      },
      {
        label: "Liberados",
        value: count("LIBERADO"),
        icon: CheckCircle2,
        color: "#10B981",
      },
      {
        label: "Descartados",
        value: count("DESCARTADO"),
        icon: Trash2,
        color: "#EF4444",
      },
      {
        label: "Registros",
        value: allItems.length,
        icon: PackageOpen,
        color: "#3B82F6",
      },
    ];
  }, [allItems]);

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
      setFeedback({ type: "error", message: payload.error || "Não foi possível atualizar a quarentena." });
      return;
    }

    setFeedback({
      type: "success",
      message: action === "release" ? "Saldo liberado para estoque." : "Saldo descartado da quarentena.",
    });
    router.refresh();
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "28px 32px 40px",
        background: t.appBg,
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
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800 }}>Quarentena</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: t.textSub }}>
            Acompanhe produtos avariados, vencidos, suspeitos ou pendentes de tratativa sem misturar com o estoque operacional.
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{ border: `1px solid ${t.border}`, borderRadius: 18, background: t.cardBg, padding: 18 }}>
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
            </div>
          );
        })}
      </div>

      <section style={{ border: `1px solid ${t.border}`, borderRadius: 20, background: t.cardBg, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 220px) minmax(160px, 220px) 1fr",
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
                setDepositanteId(value);
                updateRoute({ depositanteId: value });
              }}
              options={depositanteOptions}
            />
          ) : (
            <div />
          )}
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: t.textSub }}>Buscar</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") updateRoute({ q: query });
              }}
              onBlur={() => updateRoute({ q: query })}
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead style={{ background: t.headBg }}>
              <tr>
                {["Produto", "Depositante", "Endereço", "Qtd.", "Motivo", "Status", "Registro", "Ações"].map((header) => (
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
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: `1px solid ${t.border}` }}>
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
                          style={{ display: "block", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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
                  <td style={{ padding: 16, maxWidth: 300, color: t.textSub, fontSize: 13 }}>
                    {item.reason}
                    {item.resolutionHint ? (
                      <p style={{ margin: "8px 0 0", color: "#0891B2", fontWeight: 800 }}>{item.resolutionHint}</p>
                    ) : null}
                  </td>
                  <td style={{ padding: 16 }}>
                    <StatusPill status={item.status} label={item.statusLabel} />
                  </td>
                  <td style={{ padding: 16, fontSize: 12.5, color: t.textSub }}>
                    <strong style={{ color: t.text }}>{item.createdBy}</strong>
                    <br />
                    {item.createdAtLabel}
                    {item.resolvedAtLabel ? (
                      <>
                        <br />
                        Resolvido por {item.resolvedBy || "Sistema"} em {item.resolvedAtLabel}
                      </>
                    ) : null}
                  </td>
                  <td style={{ padding: 16 }}>
                    {item.isSystemHold ? (
                      <span
                        className="inline-flex rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-extrabold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
                        title={item.resolutionHint}
                      >
                        Endereçar estoque
                      </span>
                    ) : item.status === "EM_QUARENTENA" && canResolve ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => resolveQuarantine(item.id, "release")}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                        >
                          <ArchiveRestore size={15} />
                          Liberar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => resolveQuarantine(item.id, "discard")}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-bold text-rose-700 transition hover:-translate-y-0.5 hover:border-rose-400 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                        >
                          <Trash2 size={15} />
                          Descartar
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: t.textSub, fontSize: 13 }}>Sem ação pendente</span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 34, textAlign: "center", color: t.textSub }}>
                    Nenhum item encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
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
