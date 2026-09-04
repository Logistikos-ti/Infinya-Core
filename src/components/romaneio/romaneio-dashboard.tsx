"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Search } from "lucide-react";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { RomaneioCreateModal } from "./romaneio-create-modal";
import { RomaneioDrawer } from "./romaneio-drawer";
import type { RomaneioRecordListItem, RomaneioTransportadoraOption } from "@/lib/romaneio-records";
import type { RomaneioStop, RomaneioUI } from "./romaneio-types";
import { getCarrierBrand } from "@/lib/carrier-branding";
import { matchesRomaneioSearch } from "@/lib/romaneio-search";
import { ROMANEIO_GRADIENT, ROMANEIO_MONO, ROMANEIO_THEME_CSS } from "@/lib/romaneio-theme";
import { formatDatePtBr } from "@/lib/utils";

type RomaneioDashboardProps = {
  records: RomaneioRecordListItem[];
  transportadoraOptions: RomaneioTransportadoraOption[];
  /** Peso (kg) de cada PEDIDO, a partir de produtos.peso_kg -- calculado no
   * servidor (romaneio-records.ts não pode ser importado por um client
   * component). Chave = order id. Somado por romaneio onde necessário
   * (tabela, KPI, drawer). */
  orderWeights: Record<string, number>;
};

type TabStatus = "ABERTO" | "LIBERADO";

const PAGE_SIZE = 10;

function isCurrentMonth(iso: string | null) {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

// Alpha (~10%) igual ao sufixo hex "1a" que o mockup usa pra todo badge de
// status (stC+'1a'), uniforme entre as 3 cores -- não uma opacidade
// diferente por status.
const statusStyle = (status: string) => {
  if (status === "ABERTO") return { statusBg: "rgba(59,130,246,0.10)", statusColor: "#3B82F6", statusDot: "#3B82F6" };
  if (status === "LIBERADO") return { statusBg: "rgba(16,185,129,0.10)", statusColor: "#10B981", statusDot: "#10B981" };
  return { statusBg: "rgba(148,163,184,0.10)", statusColor: "#8695AD", statusDot: "#8695AD" };
};

const mapRecordToUI = (r: RomaneioRecordListItem, orderWeights: Record<string, number>): RomaneioUI => {
  const brand = getCarrierBrand(r.carrierName);
  const ss = statusStyle(r.status);

  const stops: RomaneioStop[] = r.orders.map((o, i) => ({
    seq: i + 1,
    customer: o.customer,
    code: o.code,
    city: o.destination,
    invoiceNumber: o.invoiceNumber || "Sem NF",
    vol: o.units,
    weight: `${(orderWeights[o.id] ?? 0).toFixed(1)} kg`,
  }));
  const weightKg = r.orders.reduce((sum, o) => sum + (orderWeights[o.id] ?? 0), 0);

  return {
    id: r.id,
    orderIds: r.orders.map((o) => o.id),
    transportadoraId: r.transportadoraId,
    transportadoraNome: r.carrierName,
    code: r.code,
    carrier: r.carrierName,
    route: r.destinations.join(" · ") || "N/A",
    orders: r.orderCount,
    itemCount: r.orders.reduce((sum, o) => sum + o.itemCount, 0),
    volumes: r.orders.reduce((sum, o) => sum + o.volumeCount, 0),
    weight: r.totalValue,
    weightKg,
    driver: r.driverName || "Não definido",
    plate: r.vehiclePlate || "—",
    vehicle: r.vehicleModel || "—",
    dock: r.dock,
    departure: formatDatePtBr(r.createdAt),
    releasedAtLabel: r.releasedAt ? formatDatePtBr(r.releasedAt) : null,
    status: r.status,
    statusLabel: r.statusLabel,
    carrierColor: brand.color,
    carrierBg: brand.bg,
    carrierInit: brand.init,
    statusBg: ss.statusBg,
    statusColor: ss.statusColor,
    statusDot: ss.statusDot,
    depColor: r.status === "LIBERADO" ? "#8695AD" : "#8B5CF6",
    stops,
    conferenceInfoJson: r.conferenceInfoJson,
  };
};

export function RomaneioDashboard({ records = [], transportadoraOptions, orderWeights }: RomaneioDashboardProps) {
  const [selectedRomaneio, setSelectedRomaneio] = useState<RomaneioUI | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tab, setTab] = useState<TabStatus>("ABERTO");
  const [search, setSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const allRomaneios = useMemo(() => records.map((r) => mapRecordToUI(r, orderWeights)), [records, orderWeights]);
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);

  function selectTab(next: TabStatus) {
    setTab(next);
    setPage(1);
    setSelectedIds(new Set());
  }

  const carrierNames = useMemo(
    () => Array.from(new Set(allRomaneios.map((r) => r.carrier))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allRomaneios],
  );

  const filtered = useMemo(() => {
    const term = search.trim();
    return allRomaneios.filter((r) => {
      if (r.status !== tab) return false;
      if (carrierFilter && r.carrier !== carrierFilter) return false;
      if (term) {
        const record = r.id ? recordById.get(r.id) : undefined;
        if (record && !matchesRomaneioSearch(record, term)) return false;
      }
      return true;
    });
  }, [allRomaneios, tab, carrierFilter, search, recordById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const abertosCount = allRomaneios.filter((r) => r.status === "ABERTO").length;
  const liberadosMes = records.filter((r) => r.status === "LIBERADO" && isCurrentMonth(r.releasedAt)).length;
  const registrosMes = records.filter((r) => isCurrentMonth(r.createdAt));
  const unidadesMes = registrosMes.reduce((sum, r) => sum + r.totalUnitsRaw, 0);
  const pesoMes = registrosMes.reduce(
    (sum, r) => sum + r.orders.reduce((orderSum, o) => orderSum + (orderWeights[o.id] ?? 0), 0),
    0,
  );

  const kpis = [
    { label: "Abertos", value: abertosCount.toString(), color: "#3B82F6" },
    { label: "Liberados (mês)", value: liberadosMes.toString(), color: "#10B981" },
    { label: "Volumes (mês)", value: unidadesMes.toLocaleString("pt-BR"), color: "var(--romaneio-text)" },
    { label: "Peso total (mês)", value: `${pesoMes.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`, color: "var(--romaneio-text)" },
  ];

  const canSelect = tab !== "ABERTO";
  const allPageSelected = canSelect && pageRows.length > 0 && pageRows.every((r) => r.id && selectedIds.has(r.id));

  function toggleRow(id: string | null) {
    if (!id || !canSelect) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    if (!canSelect) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageRows.forEach((r) => r.id && next.delete(r.id));
      } else {
        pageRows.forEach((r) => r.id && next.add(r.id));
      }
      return next;
    });
  }

  async function handleExport() {
    if (!selectedIds.size || exporting) return;
    setExporting(true);
    try {
      const response = await fetch(`/api/romaneio/exportar?ids=${Array.from(selectedIds).join(",")}`);
      if (!response.ok) return;
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `romaneios-resumo-${stamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } finally {
      setExporting(false);
    }
  }

  useRealtimeRefresh([{ table: "romaneios_carga" }, { table: "romaneios_carga_pedidos" }]);

  return (
    <div className="romaneio-theme flex h-full flex-col">
      <style>{ROMANEIO_THEME_CSS}</style>

      {/* Cabeçalho (padrão rebranding: título + sino + som + tema) */}
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span className="rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100">
          Romaneio
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-3 sm:px-8 lg:pb-12">
      {/* Title row */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <p className="m-0 text-[14.5px]" style={{ color: "var(--romaneio-text-sub)" }}>
          Agrupamento de pedidos por rota, veículo e transportadora para o carregamento.
        </p>
        <div className="flex gap-2.5 items-center">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="h-11 px-4 rounded-[11px] border-none text-white font-[family-name:var(--font-manrope)] text-sm font-extrabold flex items-center gap-2 shadow-[0_8px_22px_rgba(99,102,241,0.32)] hover:-translate-y-[1px] transition-transform"
            style={{ background: ROMANEIO_GRADIENT }}
          >
            <Plus className="w-4 h-4" /> Gerar romaneio
          </button>
        </div>
      </div>

      {/* KPI cards — mesma altura do financeiro/recebimento/quarentena
          (rótulo com h-[34px] fixo, no lugar onde ficaria o ícone, pra não
          variar o tamanho do card conforme o texto quebra linha ou não) */}
      <div className="grid grid-cols-2 gap-4 mb-6 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border p-5"
            style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)" }}
          >
            <span
              className="flex h-[34px] items-center text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "var(--romaneio-text-sub)" }}
            >
              {k.label}
            </span>
            <span className="font-[family-name:var(--font-space-grotesk)] text-[30px] font-bold" style={{ color: k.color }}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-2.5 mb-4 flex-wrap">
        <div className="flex p-1 gap-0.5 rounded-xl border" style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)" }}>
          {(["ABERTO", "LIBERADO"] as TabStatus[]).map((value) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => selectTab(value)}
                className="h-[34px] px-4 rounded-[9px] text-[13px] font-bold transition-all"
                style={{
                  background: active ? ROMANEIO_GRADIENT : "transparent",
                  color: active ? "#fff" : "var(--romaneio-text-sub)",
                }}
              >
                {value === "ABERTO" ? "Aberto" : "Liberado"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div
          className="flex items-center gap-2.5 h-[42px] flex-1 min-w-[200px] px-4 rounded-[11px] border"
          style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)" }}
        >
          <Search className="h-[15px] w-[15px]" style={{ color: "var(--romaneio-text-sub)" }} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar ID, motorista, placa, cliente..."
            className="flex-1 border-none outline-none bg-transparent text-sm"
            style={{ color: "var(--romaneio-text)" }}
          />
        </div>

        <select
          value={carrierFilter}
          onChange={(event) => {
            setCarrierFilter(event.target.value);
            setPage(1);
          }}
          className="h-[42px] px-3 rounded-[11px] border text-[13.5px] font-semibold"
          style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)", color: "var(--romaneio-text)" }}
        >
          <option value="">Todas transportadoras</option>
          {carrierNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {selectedIds.size > 0 ? (
        <div
          className="flex items-center justify-between gap-3 mb-4 px-4 h-[46px] rounded-[11px] border"
          style={{ borderColor: "rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.08)" }}
        >
          <span className="text-[13px] font-semibold" style={{ color: "var(--romaneio-text)" }}>
            {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="h-9 px-3.5 rounded-[9px] border-none text-white text-[13px] font-bold flex items-center gap-2 disabled:opacity-60"
            style={{ background: ROMANEIO_GRADIENT }}
          >
            <Download className="w-3.5 h-3.5" /> {exporting ? "Gerando PDF..." : "Exportar selecionados"}
          </button>
        </div>
      ) : null}

      {/* Table -- estrutura e espaçamento idênticos ao mockup (tabela
          sempre visível, com uma linha de "vazio" dentro dela mesma, não um
          card à parte) */}
      <div className="rounded-t-2xl border overflow-hidden" style={{ borderColor: "var(--romaneio-border)", background: "var(--romaneio-card-bg)" }}>
        <div className="overflow-auto">
          <table className="w-full" style={{ minWidth: 1080, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--romaneio-head-bg)" }}>
                {canSelect ? (
                  <th className="py-[10px] px-4 text-left w-10">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAllOnPage} className="h-4 w-4 cursor-pointer" />
                  </th>
                ) : null}
                {["ID", "Transportadora", "Pedidos", "Itens/Volumes", "Emissão", "Status", ""].map((label, i) => (
                  <th
                    key={i}
                    className="py-[10px] px-4 font-bold text-[10.5px] tracking-[0.1em] uppercase whitespace-nowrap"
                    style={{ color: "var(--romaneio-text-sub)", textAlign: label === "Pedidos" || label === "Itens/Volumes" ? "center" : "left" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((r) => {
                  const isActive = r.id !== null && selectedRomaneio?.id === r.id;
                  return (
                    <tr
                      key={r.id ?? r.code}
                      onClick={() => setSelectedRomaneio(r)}
                      className="cursor-pointer transition-colors hover:bg-[var(--romaneio-row-hover)]"
                      style={{
                        borderTop: "1px solid var(--romaneio-border)",
                        background: isActive ? "rgba(139,92,246,.08)" : "transparent",
                      }}
                    >
                      {canSelect ? (
                        <td className="py-3 px-4" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={r.id ? selectedIds.has(r.id) : false}
                            onChange={() => toggleRow(r.id)}
                            className="h-4 w-4 cursor-pointer"
                          />
                        </td>
                      ) : null}
                      <td className="py-3 px-4 text-xs whitespace-nowrap font-bold" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
                        {r.code}
                      </td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="text-[13.5px] font-semibold truncate" style={{ color: "var(--romaneio-text)" }}>
                          {r.carrier}
                        </div>
                        <div className="text-[11px] truncate" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text-sub)", marginTop: 1 }}>
                          {r.driver} · {r.plate}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
                        {r.orders}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="font-bold" style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>
                          {r.itemCount} {r.itemCount === 1 ? "item" : "itens"}
                        </div>
                        <div className="text-[10.5px]" style={{ color: "var(--romaneio-text-sub)", marginTop: 1 }}>
                          {r.volumes} vol.
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div style={{ fontFamily: ROMANEIO_MONO, color: "var(--romaneio-text)" }}>{r.departure}</div>
                        {r.releasedAtLabel ? (
                          <div className="text-[11px]" style={{ fontFamily: ROMANEIO_MONO, color: "#10B981", marginTop: 2 }}>
                            ✓ {r.releasedAtLabel}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-[11.5px] font-bold whitespace-nowrap"
                          style={{ backgroundColor: r.statusBg, color: r.statusColor }}
                        >
                          <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: r.statusDot }} />
                          {r.statusLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right" style={{ color: "var(--romaneio-text-sub)" }}>
                        ›
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={canSelect ? 8 : 7} className="p-12 text-center" style={{ color: "var(--romaneio-text-sub)" }}>
                    Nenhum romaneio nesta etapa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="flex items-center gap-3.5 px-5 py-2.5 border-t text-[12.5px] flex-wrap"
          style={{ borderColor: "var(--romaneio-border)", color: "var(--romaneio-text-sub)" }}
        >
          <span>
            {filtered.length === 0 ? "0" : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)}`} de {filtered.length}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="w-[30px] h-[30px] rounded-lg border bg-transparent disabled:opacity-40"
            style={{ borderColor: "var(--romaneio-border)", color: "var(--romaneio-text-sub)" }}
          >
            <ChevronLeft className="h-4 w-4 mx-auto" />
          </button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="w-[30px] h-[30px] rounded-lg border bg-transparent disabled:opacity-40"
            style={{ borderColor: "var(--romaneio-border)", color: "var(--romaneio-text-sub)" }}
          >
            <ChevronRight className="h-4 w-4 mx-auto" />
          </button>
        </div>
      </div>
      </div>

      {selectedRomaneio ? <RomaneioDrawer romaneio={selectedRomaneio} onClose={() => setSelectedRomaneio(null)} /> : null}

      {showCreateModal ? (
        <RomaneioCreateModal
          records={records}
          transportadoraOptions={transportadoraOptions}
          orderWeights={orderWeights}
          onClose={() => setShowCreateModal(false)}
        />
      ) : null}
    </div>
  );
}
