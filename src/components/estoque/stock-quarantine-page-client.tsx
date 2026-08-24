"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  LoaderCircle,
  PackageOpen,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import type { StockQuarantineItem } from "@/lib/stock-quarantine";
import { FancySelectInput } from "@/components/ui/fancy-select-input";
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
  canConfirm: boolean;
};

type TableMode = "status" | "pending-addressing";

function formatQuarantineType(tipo: string) {
  const normalizedType = tipo.trim().toUpperCase();

  if (normalizedType === "AVARIA") return "Avaria";
  if (normalizedType === "RECEBIMENTO") return "Recebimento";
  if (normalizedType === "DEVOLUCAO" || normalizedType === "DEVOLUÇÃO") return "Devolução";

  return "Outro";
}

export function StockQuarantinePageClient({
  depositantes,
  items,
  allItems,
  initialDepositanteId,
  initialStatus,
  initialQuery,
  canSelectDepositante,
  canConfirm,
}: StockQuarantinePageClientProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [, startTransition] = useTransition();
  const [depositanteId, setDepositanteId] = useState(initialDepositanteId);
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const [tableMode, setTableMode] = useState<TableMode>("status");
  const [selectedItem, setSelectedItem] = useState<StockQuarantineItem | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
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
    const pendingAddressing = allItems.filter((item) => item.isMissingDefaultAddress).length;

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
      return allItems.filter((item) => item.isMissingDefaultAddress);
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

  async function confirmQuarantine(item: StockQuarantineItem) {
    if (isConfirming) return;

    setFeedback(null);
    setIsConfirming(true);

    try {
      const response = await fetch(`/api/estoque/quarentena/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível confirmar a execução.");
      }

      setFeedback({
        type: "success",
        message: payload.message || "Execução física confirmada.",
      });
      setSelectedItem(null);
      router.refresh();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível confirmar a execução.",
      });
    } finally {
      setIsConfirming(false);
    }
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
            gridTemplateColumns: canSelectDepositante ? "minmax(160px, 220px) 1fr" : "1fr",
            gap: 12,
            padding: 18,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
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
                {["Produto", "Tipo", "Depositante", "Endereço", "Qtd.", "Status", "Registro"].map((header) => (
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
                  <td style={{ padding: 16, fontSize: 13, fontWeight: 700 }}>
                    {formatQuarantineType(item.tipo)}
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
                  <td colSpan={7} style={{ padding: 34, textAlign: "center", color: t.textSub }}>
                    {tableMode === "pending-addressing"
                      ? "Nenhum produto sem endereço padrão para recebimento."
                      : "Nenhum item encontrado para os filtros atuais."}
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
            className="flex h-full w-full max-w-[420px] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div className="min-w-0">
                <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-500">
                  {selectedItem.isMissingDefaultAddress ? "Produto sem endereço padrão" : "Item em quarentena"}
                </p>
                <h2 className="line-clamp-2 font-['Space_Grotesk'] text-lg font-extrabold leading-tight text-slate-950 dark:text-white" title={selectedItem.productName}>
                  {selectedItem.productName}
                </h2>
                <div className="mt-2">
                  <StatusPill status={selectedItem.status} label={selectedItem.statusLabel} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                aria-label="Fechar detalhe da quarentena"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 pb-8">
              <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-violet-500 shadow-sm dark:bg-slate-900">
                  {selectedItem.imageUrl ? (
                    <img src={selectedItem.imageUrl} alt={selectedItem.productName} className="h-full w-full object-cover" />
                  ) : (
                    <PackageOpen size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold text-slate-950 dark:text-white" title={selectedItem.productName}>
                    {selectedItem.productName}
                  </p>
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

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {selectedItem.isMissingDefaultAddress ? "Pendência operacional" : "Motivo da quarentena"}
                </p>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedItem.reason}</p>
                {selectedItem.resolutionHint ? (
                  <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <strong>Dica:</strong> {selectedItem.resolutionHint}
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
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

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Foto da avaria
                </p>
                {selectedItem.fotoUrl ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(selectedItem.fotoUrl)}
                    className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-900"
                    aria-label="Ampliar foto da avaria"
                  >
                    <img
                      src={selectedItem.fotoUrl}
                      alt={`Foto da avaria de ${selectedItem.productName}`}
                      className="h-52 w-full object-contain"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/35 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-950 shadow-xl">
                        <Eye size={16} />
                        Ampliar foto
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center text-sm font-semibold text-slate-500 dark:border-white/15 dark:bg-slate-900 dark:text-slate-400">
                    Nenhuma foto de avaria registrada.
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Ações</p>
                {selectedItem.isMissingDefaultAddress ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/configuracoes/produtos/${selectedItem.productId}/editar`)}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 text-sm font-extrabold text-white transition hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600"
                  >
                    Editar Produto
                  </button>
                ) : selectedItem.status === "EM_QUARENTENA" && selectedItem.depositanteDecision ? (
                  <div className="space-y-3">
                    <div
                      className={`rounded-2xl border p-4 ${
                        selectedItem.depositanteDecision === "DOAR"
                          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                          : "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                      }`}
                    >
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        Decisão do depositante
                      </p>
                      <p className="mt-1 text-base font-extrabold text-slate-950 dark:text-white">
                        {selectedItem.depositanteDecisionLabel}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {selectedItem.depositanteDecisionBy || "Depositante"}
                        {selectedItem.depositanteDecisionAtLabel
                          ? ` em ${selectedItem.depositanteDecisionAtLabel}`
                          : ""}
                      </p>
                      {selectedItem.depositanteDecisionNotes ? (
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                          {selectedItem.depositanteDecisionNotes}
                        </p>
                      ) : null}
                    </div>

                    {canConfirm ? (
                      <button
                        type="button"
                        disabled={isConfirming}
                        onClick={() => confirmQuarantine(selectedItem)}
                        className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${
                          selectedItem.depositanteDecision === "DOAR"
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-rose-600 hover:bg-rose-700"
                        }`}
                      >
                        {isConfirming ? (
                          <LoaderCircle size={17} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}
                        {selectedItem.depositanteDecision === "DOAR"
                          ? "Confirmar que foi doado / liberado"
                          : "Confirmar que foi descartado"}
                      </button>
                    ) : null}
                  </div>
                ) : selectedItem.status === "EM_QUARENTENA" ? (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    Aguardando o depositante decidir entre doar/liberar ou descartar. O operador não pode definir este destino.
                  </p>
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

      {selectedPhoto ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-md"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-rose-500">Evidência operacional</p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-950 dark:text-white">Foto da avaria</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                aria-label="Fechar foto da avaria"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-slate-100 p-4 dark:bg-slate-900">
              <img
                src={selectedPhoto}
                alt="Foto ampliada da avaria"
                className="max-h-[76vh] max-w-full rounded-2xl object-contain shadow-xl"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
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
