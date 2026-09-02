"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  Download,
  FileText,
  Layers,
  PackageX,
  Receipt,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Timer,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { MobileButtonSpinner, MobileInfinityLoader } from "@/components/mobile/mobile-kit-tokens";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};
const groteskStyle: React.CSSProperties = {
  fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
};

const ICONS: Record<string, LucideIcon> = {
  stock: Layers,
  sla: Timer,
  fiscal: Receipt,
  avarias: PackageX,
  reversa: Undo2,
  vendas: ShoppingCart,
};

export type Tone = "green" | "amber" | "red" | "blue" | "neutral";

export type PreviewStat = { label: string; value: string };
export type DrawerStat = { label: string; value: string; hint?: string; tone?: Tone };
export type ChartBar = { value: number; label: string };
export type ChartBar2 = { label: string; a: number; b: number };
export type FilterField =
  | {
      type: "select";
      name: string;
      label: string;
      value: string;
      options: { value: string; label: string }[];
      disabled?: boolean;
    }
  | { type: "date"; name: string; label: string; value: string }
  | { type: "text"; name: string; label: string; value: string; placeholder?: string }
  | {
      // Um rótulo único ("Período") agrupando duas datas início–fim, cada uma
      // enviada com seu próprio name (mantém o contrato do servidor).
      type: "daterange";
      name: string;
      label: string;
      fromName: string;
      fromValue: string;
      toName: string;
      toValue: string;
    };
export type TableCell = { text: string; badge?: Tone; strong?: boolean; sub?: string };
export type ReportData = {
  id: string;
  title: string;
  category: string;
  description: string;
  details: string;
  color: string;
  iconKey: string;
  previewStats: PreviewStat[];
  chartLabel: string;
  chartBars: ChartBar[];
  drawerChartBars?: ChartBar[];
  // Série com 2 colunas por dia (ex.: NF-e = entradas + saídas). Quando presente,
  // o gráfico do card/drawer usa o modo agrupado no lugar de chartBars.
  chartBars2?: ChartBar2[];
  drawerChartBars2?: ChartBar2[];
  chartSeries2?: { labelA: string; colorA: string; labelB: string; colorB: string };
  drawerStats: DrawerStat[];
  filters: FilterField[];
  table: {
    columns: string[];
    rows: TableCell[][];
    // Data ISO por linha (paralelo a rows) — habilita os filtros rápidos de
    // data no popup. Ausente nos relatórios sem data por linha (ex.: fiscal).
    rowDates?: Array<string | null>;
    note?: string;
    empty: string;
  };
  exportCsvHref: string;
  exportPdfHref: string;
  clearHref: string;
};

function toneStyle(tone: Tone | undefined): { bg: string; fg: string } {
  switch (tone) {
    case "green":
      return { bg: "rgba(16,185,129,0.1)", fg: "#10B981" };
    case "amber":
      return { bg: "rgba(245,158,11,0.12)", fg: "#F59E0B" };
    case "red":
      return { bg: "rgba(239,68,68,0.1)", fg: "#EF4444" };
    case "blue":
      return { bg: "rgba(59,130,246,0.1)", fg: "#3B82F6" };
    default:
      return { bg: "rgba(148,163,184,0.14)", fg: "#8695AD" };
  }
}

function Chart({ bars, color, height }: { bars: ChartBar[]; color: string; height: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  if (!bars.length) {
    return height > 80 ? (
      <div
        className={`flex items-center justify-center text-[11px] ${tokenTextSub}`}
        style={{ height }}
      >
        Sem dados no período
      </div>
    ) : (
      <div style={{ height }} />
    );
  }
  return (
    <div className="flex items-end gap-[3px]" style={{ height, padding: "8px 0" }}>
      {bars.map((b, i) => {
        const pct = Math.max(6, Math.round((b.value / max) * 100));
        const isTop = b.value === max;
        return (
          <div
            key={`${b.label}-${i}`}
            title={`${b.label}: ${b.value.toLocaleString("pt-BR")}`}
            style={{
              flex: 1,
              height: `${pct}%`,
              background: isTop ? color : `${color}55`,
              borderRadius: 3,
              transition: "height .3s ease",
            }}
          />
        );
      })}
    </div>
  );
}

// Gráfico com 2 colunas distintas por dia (ex.: NF-e entradas vs saídas).
function GroupedChart({
  bars,
  colorA,
  colorB,
  height,
}: {
  bars: ChartBar2[];
  colorA: string;
  colorB: string;
  height: number;
}) {
  const max = Math.max(1, ...bars.map((b) => Math.max(b.a, b.b)));
  const total = bars.reduce((s, b) => s + b.a + b.b, 0);
  if (!bars.length || total === 0) {
    return height > 80 ? (
      <div
        className={`flex items-center justify-center text-[11px] ${tokenTextSub}`}
        style={{ height }}
      >
        Sem dados no período
      </div>
    ) : (
      <div style={{ height }} />
    );
  }
  return (
    <div className="flex items-end gap-[4px]" style={{ height, padding: "8px 0" }}>
      {bars.map((b, i) => (
        <div key={`${b.label}-${i}`} className="flex flex-1 items-end justify-center gap-[2px]">
          <div
            title={`${b.label} · entradas: ${b.a.toLocaleString("pt-BR")}`}
            style={{
              width: "46%",
              height: `${Math.max(b.a ? 6 : 2, Math.round((b.a / max) * 100))}%`,
              background: colorA,
              borderRadius: 3,
              transition: "height .3s ease",
            }}
          />
          <div
            title={`${b.label} · saídas: ${b.b.toLocaleString("pt-BR")}`}
            style={{
              width: "46%",
              height: `${Math.max(b.b ? 6 : 2, Math.round((b.b / max) * 100))}%`,
              background: colorB,
              borderRadius: 3,
              transition: "height .3s ease",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// Arredonda o topo do eixo Y para um número "redondo" (escala limpa).
function niceCeil(n: number): number {
  if (n <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const frac = n / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

// Gráfico de colunas no estilo planilha: eixo Y com escala e linhas de grade,
// colunas agrupadas (N séries por categoria), rótulos no eixo X e legenda.
// Usado no drawer dos relatórios. Cores da série vêm de cada `series`.
function BarChartSVG({
  categories,
  series,
  height = 240,
  compact = false,
}: {
  categories: string[];
  series: { label: string; color: string; values: number[] }[];
  height?: number;
  compact?: boolean;
}) {
  const allVals = series.flatMap((s) => s.values);
  const total = allVals.reduce((s, v) => s + v, 0);
  if (!categories.length || total === 0) {
    return compact ? (
      <div style={{ height }} />
    ) : (
      <div className={`flex items-center justify-center text-[12px] ${tokenTextSub}`} style={{ height }}>
        Sem dados no período
      </div>
    );
  }
  const rawMax = Math.max(1, ...allVals);
  const niceMax = niceCeil(rawMax);
  const TICKS = compact ? 3 : 5;

  // viewBox define a PROPORÇÃO; o svg ocupa 100% da largura e a altura vem daí
  // (sem px fixo → nunca corta). Compacto é mais baixo/largo (mini-preview).
  const W = compact ? 480 : 900;
  const H = compact ? 132 : 380;
  const padL = compact ? 6 : 46;
  const padR = compact ? 6 : 14;
  const padT = compact ? 8 : 14;
  const padB = compact ? 8 : 52;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const groupW = plotW / categories.length;
  const sideGap = groupW * 0.16;
  const innerW = groupW - sideGap * 2;
  const barW = innerW / series.length;
  const yOf = (v: number) => padT + plotH - (v / niceMax) * plotH;
  // Rótulos do X: se forem muitos, mostra 1 a cada 2 pra não embolar.
  const labelStep = categories.length > 16 ? 2 : 1;

  return (
    <div className={tokenTextSub} style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", height: "auto" }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        {/* Grade horizontal + rótulos do eixo Y */}
        {Array.from({ length: TICKS + 1 }).map((_, i) => {
          const val = (niceMax / TICKS) * i;
          // No card (compacto) não desenha grade acima da barra mais alta —
          // evita a "linha vazia" no topo. A base (val 0) sempre fica.
          if (compact && val > rawMax) return null;
          const y = yOf(val);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="currentColor"
                strokeOpacity={i === 0 ? 0.28 : 0.12}
              />
              {!compact ? (
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={12} fill="currentColor" opacity={0.7}>
                  {Number.isInteger(val) ? val : val.toFixed(0)}
                </text>
              ) : null}
            </g>
          );
        })}
        {/* Colunas agrupadas + rótulos do eixo X */}
        {categories.map((cat, ci) => {
          const gx = padL + ci * groupW + sideGap;
          return (
            <g key={`cat-${ci}`}>
              {series.map((s, si) => {
                const v = s.values[ci] ?? 0;
                const y = yOf(v);
                const h = padT + plotH - y;
                return (
                  <rect
                    key={`bar-${ci}-${si}`}
                    x={gx + si * barW}
                    y={y}
                    width={barW * 0.82}
                    height={Math.max(0, h)}
                    fill={s.color}
                    rx={2}
                  >
                    <title>{`${cat} · ${s.label}: ${v.toLocaleString("pt-BR")}`}</title>
                  </rect>
                );
              })}
              {!compact && ci % labelStep === 0 ? (
                <text
                  x={padL + ci * groupW + groupW / 2}
                  y={padT + plotH + 18}
                  textAnchor="middle"
                  fontSize={12}
                  fill="currentColor"
                  opacity={0.7}
                >
                  {cat}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {/* Legenda */}
      {!compact ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          {series.map((s) => (
            <span key={s.label} className={`text-[11.5px] font-semibold ${tokenTextSub}`}>
              <span
                style={{ background: s.color }}
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[2px] align-middle"
              />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReportCard({ report, onOpen }: { report: ReportData; onOpen: (id: string) => void }) {
  const Icon = ICONS[report.iconKey] ?? FileText;
  return (
    <div
      onClick={() => onOpen(report.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.borderColor = "";
      }}
      className={`flex cursor-pointer flex-col gap-3 rounded-2xl border p-5 transition ${tokenBorder} ${tokenCardBg}`}
      style={{ transitionProperty: "transform, border-color" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: `${report.color}1a`, color: report.color }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[15px] font-bold ${tokenText}`}>{report.title}</div>
          <div className={`mt-0.5 text-[12px] ${tokenTextSub}`}>{report.category}</div>
        </div>
      </div>

      <p className={`text-[13px] leading-[1.5] ${tokenTextSub}`}>{report.description}</p>

      {report.chartBars2 && report.chartSeries2 ? (
        <BarChartSVG
          compact
          height={72}
          categories={report.chartBars2.map((b) => b.label)}
          series={[
            {
              label: report.chartSeries2.labelA,
              color: report.chartSeries2.colorA,
              values: report.chartBars2.map((b) => b.a),
            },
            {
              label: report.chartSeries2.labelB,
              color: report.chartSeries2.colorB,
              values: report.chartBars2.map((b) => b.b),
            },
          ]}
        />
      ) : (
        <BarChartSVG
          compact
          height={72}
          categories={report.chartBars.map((b) => b.label)}
          series={[{ label: report.chartLabel, color: report.color, values: report.chartBars.map((b) => b.value) }]}
        />
      )}

      <div className="flex gap-3">
        {report.previewStats.map((p, i) => (
          <div
            key={`${p.label}-${i}`}
            className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 ${tokenBorder} ${tokenInputBg}`}
          >
            <div
              className={`truncate text-[9.5px] font-bold uppercase tracking-[0.08em] ${tokenTextSub}`}
            >
              {p.label}
            </div>
            <div
              className={`mt-0.5 truncate text-[16px] font-bold ${tokenText}`}
              style={groteskStyle}
            >
              {p.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Link
          href={report.exportCsvHref}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8B5CF6")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
          className={`flex h-[34px] flex-1 items-center justify-center rounded-[9px] border text-[12px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
        >
          CSV
        </Link>
        <Link
          href={report.exportPdfHref}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8B5CF6")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
          className={`flex h-[34px] flex-1 items-center justify-center rounded-[9px] border text-[12px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
        >
          PDF
        </Link>
        <button
          type="button"
          onClick={() => onOpen(report.id)}
          className="flex h-[34px] flex-1 items-center justify-center rounded-[9px] text-[12px] font-extrabold text-white transition hover:brightness-105"
          style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
        >
          Abrir
        </button>
      </div>
    </div>
  );
}

// Menu suspenso "Período": um botão que abre um mini popover para escolher
// início e fim. Os valores vão pro form por inputs hidden (mantém os names
// originais slaDataInicio/slaDataFim), então o GET do drawer continua igual.
function DateRangeField({
  label,
  fromName,
  fromValue,
  toName,
  toValue,
}: {
  label: string;
  fromName: string;
  fromValue: string;
  toName: string;
  toValue: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(fromValue);
  const [to, setTo] = useState(toValue);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const fmt = (v: string) => {
    if (!v) return "";
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  };
  const summary = from || to ? `${fmt(from) || "…"} — ${fmt(to) || "…"}` : "Selecionar período";

  return (
    <div className="flex flex-col gap-1">
      <span className={`text-[11px] font-semibold ${tokenTextSub}`}>{label}</span>
      <div className="relative" ref={ref}>
        <input type="hidden" name={fromName} value={from} />
        <input type="hidden" name={toName} value={to} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex h-[42px] w-full items-center justify-between rounded-[11px] border px-3 text-[13px] outline-none transition hover:brightness-105 ${tokenBorder} ${tokenInputBg}`}
        >
          <span className={from || to ? tokenText : tokenTextSub}>{summary}</span>
          <CalendarDays className={`h-4 w-4 ${tokenTextSub}`} />
        </button>
        {open ? (
          <div
            className={`absolute left-0 top-[calc(100%+6px)] z-[70] w-full rounded-[12px] border p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${tokenBorder} bg-white dark:bg-[#0C1526]`}
          >
            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] font-semibold ${tokenTextSub}`}>Início</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={`h-[38px] w-full rounded-[10px] border px-2.5 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={`text-[11px] font-semibold ${tokenTextSub}`}>Fim</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={`h-[38px] w-full rounded-[10px] border px-2.5 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                />
              </label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                  className={`flex h-[34px] flex-1 items-center justify-center rounded-[9px] border text-[12px] font-semibold transition hover:brightness-105 ${tokenBorder} ${tokenText}`}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-[34px] flex-1 items-center justify-center rounded-[9px] text-[12px] font-bold transition hover:brightness-105"
                  style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#FFFFFF" }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type SaldoRow = {
  sku: string;
  produto: string;
  depositante: string;
  lote: string;
  validade: string;
  endereco: string;
  saldo: number;
};

// Popup exclusivo da Posição de estoque: mostra o SALDO por produto — atual
// (padrão) ou reconstruído como estava no fim de um dia escolhido. Busca a API
// /api/relatorios/saldo-em-data client-side (sem recarregar a página), honrando
// os filtros aplicados no drawer (depositante/produto/área/lote).
function StockSaldoPopup({
  title,
  filterValues,
  onClose,
}: {
  title: string;
  filterValues: Record<string, string>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"atual" | "dia">("atual");
  const [day, setDay] = useState("");
  const [rows, setRows] = useState<SaldoRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);

  const effectiveDate = mode === "dia" ? day : "";
  // Serializa os filtros para uma chave estável de dependência do efeito.
  const filterKey = JSON.stringify(filterValues);

  useEffect(() => {
    // No modo "período" só busca depois que a pessoa escolher um dia.
    if (mode === "dia" && !day) {
      setRows(null);
      setError(null);
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    if (effectiveDate) params.set("date", effectiveDate);
    for (const [k, v] of Object.entries(JSON.parse(filterKey) as Record<string, string>)) {
      if (v) params.set(k, v);
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/relatorios/saldo-em-data?${params.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Erro ${r.status}`);
        }
        return r.json() as Promise<{ rows: SaldoRow[]; asOf: string | null }>;
      })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows ?? []);
        setAsOf(data.asOf ?? null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar o saldo");
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveDate, mode, day, filterKey]);

  const total = rows?.reduce((s, r) => s + r.saldo, 0) ?? 0;
  const asOfLabel =
    asOf &&
    (() => {
      const [y, m, d] = asOf.split("-");
      return `${d}/${m}/${y}`;
    })();

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[rgba(3,7,20,0.6)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={`relative flex max-h-[88vh] w-[1200px] max-w-[97vw] flex-col rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.5)] ${tokenBorder} bg-white dark:bg-[#0C1526]`}
      >
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${tokenBorder}`}>
          <span className={`flex items-center gap-2 text-[14px] font-bold ${tokenText}`}>
            <Boxes className="h-4 w-4 text-[#8B5CF6]" />
            Saldo · {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${tokenBorder} ${tokenTextSub} hover:border-[#EF4444] hover:text-[#EF4444]`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filtro de ponto no tempo: Saldo atual | Período (dia) */}
        <div className={`flex flex-wrap items-center gap-2 border-b px-5 py-2.5 ${tokenBorder}`}>
          {(
            [
              { key: "atual", label: "Saldo atual" },
              { key: "dia", label: "Período" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${
                mode === opt.key
                  ? "text-white"
                  : `border ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`
              }`}
              style={
                mode === opt.key
                  ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }
                  : undefined
              }
            >
              {opt.label}
            </button>
          ))}
          {mode === "dia" ? (
            <label className="flex items-center gap-1.5">
              <CalendarDays className={`h-3.5 w-3.5 ${tokenTextSub}`} />
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={`rounded-lg border px-2 py-1 text-[12px] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              />
            </label>
          ) : null}
          <span className={`ml-auto text-[11px] font-semibold ${tokenTextSub}`}>
            {mode === "dia" && !day
              ? "Escolha um dia"
              : `${rows?.length ?? 0} lote(s) · ${total.toLocaleString("pt-BR")} un.`}
          </span>
        </div>

        {asOfLabel ? (
          <div className={`px-5 pt-2.5 text-[11px] font-semibold ${tokenTextSub}`}>
            Saldo reconstruído no fim de <span className={tokenText}>{asOfLabel}</span>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <MobileInfinityLoader size={120} label={null} />
            </div>
          ) : error ? (
            <div className="py-12 text-center text-[13px] text-[#EF4444]">{error}</div>
          ) : mode === "dia" && !day ? (
            <div className={`py-12 text-center text-[13px] ${tokenTextSub}`}>
              Escolha um dia para ver o saldo do estoque naquela data.
            </div>
          ) : (
            <table className="min-w-full text-left text-[12.5px]">
              <thead className={`border-b ${tokenBorder} ${tokenTextSub}`}>
                <tr>
                  <th className="whitespace-nowrap pb-2 pr-4 font-semibold">Produto</th>
                  <th className="whitespace-nowrap pb-2 pr-4 font-semibold">Lote</th>
                  <th className="whitespace-nowrap pb-2 pr-4 font-semibold">Validade</th>
                  <th className="whitespace-nowrap pb-2 pr-4 font-semibold">Endereço</th>
                  <th className="whitespace-nowrap pb-2 pr-4 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r, ri) => (
                  <tr key={`${r.sku}-${r.lote}-${ri}`} className={`border-b last:border-b-0 ${tokenBorder}`}>
                    <td className="py-2.5 pr-4 align-top">
                      <span className={`font-semibold ${tokenText}`}>{r.produto}</span>
                      <span className={`block text-[11px] ${tokenTextSub}`}>
                        {r.sku} · {r.depositante}
                      </span>
                    </td>
                    <td className={`py-2.5 pr-4 align-top ${tokenText}`}>{r.lote}</td>
                    <td className={`py-2.5 pr-4 align-top ${tokenTextSub}`}>{r.validade}</td>
                    <td className={`py-2.5 pr-4 align-top ${tokenTextSub}`}>{r.endereco}</td>
                    <td
                      className={`py-2.5 pr-4 text-right align-top font-bold ${tokenText}`}
                      style={groteskStyle}
                    >
                      {r.saldo.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
                {!loading && rows && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`py-8 text-center ${tokenTextSub}`}>
                      Sem saldo para os filtros selecionados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
          {asOf ? (
            <p className={`mt-3 text-[11px] ${tokenTextSub}`}>
              Reconstruído a partir do saldo atual, descontando as movimentações posteriores. Itens
              zerados desde a data escolhida não aparecem.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReportDrawer({
  report,
  preserved,
  onClose,
}: {
  report: ReportData;
  preserved: Record<string, string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isClearing, startClear] = useTransition();
  const Icon = ICONS[report.iconKey] ?? FileText;
  const ownedNames = new Set(
    report.filters.flatMap((f) =>
      f.type === "daterange" ? [f.name, f.fromName, f.toName] : [f.name],
    ),
  );
  const hiddenPreserved = Object.entries(preserved).filter(
    ([k]) => !ownedNames.has(k) && k !== "abrir",
  );
  // O drawer pode ter uma série mais longa que o card (ex.: estoque = 14 dias
  // no drawer, 7 dias no card). Cai no chartBars quando não houver específica.
  const drawerBars = report.drawerChartBars ?? report.chartBars;
  const drawerBars2 = report.drawerChartBars2 ?? report.chartBars2;
  const isGrouped = Boolean(drawerBars2 && report.chartSeries2);
  // O botão "Ver registros" (que abre o popup) só aparece quando há ≥1 filtro
  // ativo. O valor dos filtros vem do servidor (URL) → "tem filtro ativo" =
  // algum campo com valor.
  const hasActiveFilter = report.filters.some((f) =>
    f.type === "daterange"
      ? Boolean((f.fromValue ?? "").trim() || (f.toValue ?? "").trim())
      : (f.value ?? "").trim() !== "",
  );
  // O popup nunca auto-abre ao montar o drawer (reabrir o card com filtro na URL
  // não deve cair direto no popup). Ele só abre pelos botões Ver registros /
  // Ver saldo, ou logo após aplicar um filtro.
  const [showRecords, setShowRecords] = useState(false);

  // Posição de estoque tem um popup próprio (saldo atual / por dia) que busca a
  // API client-side — "Aplicar" abre esse popup SEM recarregar a página.
  const isStock = report.id === "saldo";
  const formRef = useRef<HTMLFormElement>(null);
  const [stockFilters, setStockFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      report.filters.map((f) => [f.name, f.type === "daterange" ? "" : f.value ?? ""]),
    ),
  );
  const openStockPopup = () => {
    if (formRef.current) {
      const fd = new FormData(formRef.current);
      setStockFilters({
        depositante: String(fd.get("depositante") ?? ""),
        produto: String(fd.get("produto") ?? ""),
        area: String(fd.get("area") ?? ""),
        lote: String(fd.get("lote") ?? ""),
      });
    }
    setShowRecords(true);
  };
  // Export do estoque reflete os filtros atuais do drawer (que agora são
  // client-side): monta a URL no clique lendo os campos do form. Sem filtro →
  // export geral. Os nomes batem com o que /api/relatorios lê.
  const exportStock = (format: "csv" | "pdf") => {
    const params = new URLSearchParams({ report: "saldo-estoque", format });
    if (formRef.current) {
      const fd = new FormData(formRef.current);
      for (const name of ["depositante", "produto", "area", "lote"]) {
        const v = String(fd.get(name) ?? "").trim();
        if (v) params.set(name, v);
      }
    }
    window.location.assign(`/api/relatorios?${params.toString()}`);
  };

  // Filtros rápidos de data DENTRO do popup — client-side, instantâneo, sobre
  // as linhas já carregadas (report.table.rowDates traz a data ISO de cada uma).
  const [rangeKey, setRangeKey] = useState<"all" | "current" | "last" | "custom">("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const rowDates = report.table.rowDates;
  const canFilterByDate = Array.isArray(rowDates) && rowDates.length > 0;
  const dateRange = (() => {
    const now = new Date();
    if (rangeKey === "current") {
      return {
        fromTs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        toTs: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
      };
    }
    if (rangeKey === "last") {
      return {
        fromTs: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
        toTs: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime(),
      };
    }
    if (rangeKey === "custom" && (customFrom || customTo)) {
      return {
        fromTs: customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : -Infinity,
        toTs: customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : Infinity,
      };
    }
    return null;
  })();
  const visibleRows =
    !dateRange || !canFilterByDate
      ? report.table.rows
      : report.table.rows.filter((_, i) => {
          const iso = rowDates?.[i];
          if (!iso) return false;
          const t = new Date(iso).getTime();
          return t >= dateRange.fromTs && t <= dateRange.toTs;
        });

  return (
    <div className="fixed inset-0 z-40" style={manropeStyle}>
      <div
        className="absolute inset-0 bg-[rgba(3,7,20,0.45)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[720px] max-w-[94vw] flex-col border-l shadow-[-24px_0_60px_rgba(0,0,0,0.35)] ${tokenBorder} bg-white dark:bg-[#0C1526]`}
        style={{ animation: "relDrawerIn .22s ease-out" }}
      >
        {/* Header */}
        <div className={`border-b px-6 pb-4 pt-[22px] ${tokenBorder}`}>
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[9px]"
              style={{ background: `${report.color}1a`, color: report.color }}
            >
              <Icon className="h-[17px] w-[17px]" />
            </span>
            <span
              className="rounded-full px-2.5 py-[3px] text-[11px] font-bold"
              style={{ color: report.color, background: `${report.color}1a` }}
            >
              {report.category}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              title="Fechar"
              onClick={onClose}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border transition ${tokenBorder} ${tokenTextSub} hover:border-[#EF4444] hover:text-[#EF4444]`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`text-[20px] font-bold ${tokenText}`} style={groteskStyle}>
            {report.title}
          </div>
          <div className={`mt-1 text-[13px] leading-[1.5] ${tokenTextSub}`}>{report.details}</div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div
            className={`mb-2 text-[11px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}
          >
            {report.chartLabel}
          </div>
          <div className={`rounded-[14px] border px-4 py-3 ${tokenBorder} ${tokenInputBg}`}>
            {isGrouped && drawerBars2 && report.chartSeries2 ? (
              <BarChartSVG
                categories={drawerBars2.map((b) => b.label)}
                series={[
                  {
                    label: report.chartSeries2.labelA,
                    color: report.chartSeries2.colorA,
                    values: drawerBars2.map((b) => b.a),
                  },
                  {
                    label: report.chartSeries2.labelB,
                    color: report.chartSeries2.colorB,
                    values: drawerBars2.map((b) => b.b),
                  },
                ]}
                height={240}
              />
            ) : (
              <BarChartSVG
                categories={drawerBars.map((b) => b.label)}
                series={[
                  {
                    label: report.chartLabel,
                    color: report.color,
                    values: drawerBars.map((b) => b.value),
                  },
                ]}
                height={240}
              />
            )}
          </div>

          {/* Stats */}
          {report.drawerStats.length ? (
            <div className="mt-4 flex gap-2">
              {report.drawerStats.map((s, i) => (
                <div
                  key={`${s.label}-${i}`}
                  className={`flex min-w-0 flex-1 flex-col justify-center gap-2 rounded-xl border px-3 py-5 ${tokenBorder} ${tokenInputBg}`}
                >
                  <div
                    className={`truncate text-[10px] font-bold uppercase tracking-[0.06em] ${tokenTextSub}`}
                  >
                    {s.label}
                  </div>
                  <div
                    className={`truncate text-[21px] font-bold ${tokenText}`}
                    style={groteskStyle}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Filtros (form GET real) */}
          <div
            className={`mb-2 mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
          </div>
          <form
            ref={formRef}
            method="get"
            action="/relatorios"
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              // Estoque abre o popup client-side; os demais re-buscam no servidor
              // via navegação SOFT (sem recarregar a página inteira).
              if (isStock) {
                openStockPopup();
                return;
              }
              const params = new URLSearchParams();
              for (const [k, v] of new FormData(e.currentTarget).entries()) {
                const s = String(v).trim();
                if (s) params.set(k, s);
              }
              // startTransition mantém o drawer visível durante a re-busca —
              // evita o skeleton do loading.tsx (a "página nova").
              startTransition(() => {
                router.push(`/relatorios?${params.toString()}`, { scroll: false });
              });
            }}
          >
            {hiddenPreserved.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <input type="hidden" name="abrir" value={report.id} />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {report.filters.map((f) =>
                f.type === "daterange" ? (
                  <DateRangeField
                    key={f.name}
                    label={f.label}
                    fromName={f.fromName}
                    fromValue={f.fromValue}
                    toName={f.toName}
                    toValue={f.toValue}
                  />
                ) : (
                <label key={f.name} className="flex flex-col gap-1">
                  <span className={`text-[11px] font-semibold ${tokenTextSub}`}>{f.label}</span>
                  {f.type === "select" ? (
                    <select
                      name={f.name}
                      defaultValue={f.value}
                      disabled={f.disabled}
                      className={`h-[42px] w-full rounded-[11px] border px-3 text-[13px] outline-none disabled:opacity-60 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                    >
                      {f.options.map((o) => (
                        <option key={o.value || "todos"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "date" ? "date" : "text"}
                      name={f.name}
                      defaultValue={f.value}
                      placeholder={f.type === "text" ? f.placeholder : undefined}
                      className={`h-[42px] w-full rounded-[11px] border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex h-[40px] items-center justify-center gap-2 rounded-[11px] px-4 text-[13px] font-bold text-white transition hover:brightness-105 disabled:opacity-70"
                style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
              >
                {isPending ? (
                  <MobileButtonSpinner size={22} />
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Aplicar filtros
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={() => {
                  startClear(() => {
                    router.push(report.clearHref, { scroll: false });
                  });
                }}
                className={`flex h-[40px] min-w-[92px] items-center justify-center rounded-[11px] border px-4 text-[13px] font-semibold transition hover:brightness-105 disabled:opacity-70 ${tokenBorder} ${tokenText}`}
              >
                {isClearing ? <MobileButtonSpinner size={22} /> : "Limpar"}
              </button>
            </div>
          </form>

          {/* Estoque abre o popup de saldo pelo rodapé (Ver saldo, ao lado do
              CSV/PDF); demais relatórios listam registros (em popup) só após
              aplicar ≥1 filtro. */}
          {isStock ? null : hasActiveFilter ? (
            <button
              type="button"
              onClick={() => setShowRecords(true)}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-[11px] border py-2.5 text-[12.5px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
            >
              Ver registros ({report.table.rows.length})
            </button>
          ) : (
            <p className={`mt-6 text-center text-[12px] ${tokenTextSub}`}>
              Aplique ao menos um filtro para listar os registros.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-2 border-t px-6 py-3.5 ${tokenBorder}`}>
          {isStock ? (
            <button
              type="button"
              onClick={openStockPopup}
              className={`flex h-[40px] flex-1 items-center justify-center rounded-[10px] border text-[13px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
            >
              Ver saldo
            </button>
          ) : null}
          {isStock ? (
            <button
              type="button"
              onClick={() => exportStock("csv")}
              className={`flex h-[40px] flex-1 items-center justify-center rounded-[10px] border text-[13px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
            >
              Exportar CSV
            </button>
          ) : (
            <Link
              href={report.exportCsvHref}
              className={`flex h-[40px] flex-1 items-center justify-center rounded-[10px] border text-[13px] font-bold transition hover:brightness-105 ${tokenBorder} ${tokenInputBg} ${tokenText}`}
            >
              Exportar CSV
            </Link>
          )}
          {isStock ? (
            <button
              type="button"
              onClick={() => exportStock("pdf")}
              className="flex h-[40px] flex-1 items-center justify-center rounded-[10px] text-[13px] font-extrabold transition hover:brightness-105"
              style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#FFFFFF" }}
            >
              Gerar PDF
            </button>
          ) : (
            <Link
              href={report.exportPdfHref}
              className="flex h-[40px] flex-1 items-center justify-center rounded-[10px] text-[13px] font-extrabold transition hover:brightness-105"
              style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)", color: "#FFFFFF" }}
            >
              Gerar PDF
            </Link>
          )}
        </div>
      </aside>

      {showRecords && isStock ? (
        <StockSaldoPopup
          title={report.title}
          filterValues={stockFilters}
          onClose={() => setShowRecords(false)}
        />
      ) : null}

      {showRecords && !isStock ? (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[rgba(3,7,20,0.6)] backdrop-blur-[2px]"
            onClick={() => setShowRecords(false)}
          />
          <div
            className={`relative flex max-h-[88vh] w-[1320px] max-w-[97vw] flex-col rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.5)] ${tokenBorder} bg-white dark:bg-[#0C1526]`}
          >
            <div className={`flex items-center justify-between border-b px-5 py-3.5 ${tokenBorder}`}>
              <span className={`text-[14px] font-bold ${tokenText}`}>
                Registros · {report.title}
              </span>
              <button
                type="button"
                onClick={() => setShowRecords(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${tokenBorder} ${tokenTextSub} hover:border-[#EF4444] hover:text-[#EF4444]`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {canFilterByDate ? (
              <div
                className={`flex flex-wrap items-center gap-2 border-b px-5 py-2.5 ${tokenBorder}`}
              >
                {(
                  [
                    { key: "all", label: "Todos" },
                    { key: "current", label: "Mês atual" },
                    { key: "last", label: "Mês passado" },
                    { key: "custom", label: "Período" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRangeKey(opt.key)}
                    className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${
                      rangeKey === opt.key
                        ? "text-white"
                        : `border ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`
                    }`}
                    style={
                      rangeKey === opt.key
                        ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }
                        : undefined
                    }
                  >
                    {opt.label}
                  </button>
                ))}
                {rangeKey === "custom" ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className={`rounded-lg border px-2 py-1 text-[12px] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                    />
                    <span className={tokenTextSub}>—</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className={`rounded-lg border px-2 py-1 text-[12px] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                    />
                  </div>
                ) : null}
                <span className={`ml-auto text-[11px] font-semibold ${tokenTextSub}`}>
                  {visibleRows.length} registro(s)
                </span>
              </div>
            ) : null}
            <div className="flex-1 overflow-auto px-5 py-4">
              <table className="min-w-full text-left text-[12.5px]">
                <thead className={`border-b ${tokenBorder} ${tokenTextSub}`}>
                  <tr>
                    {report.table.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap pb-2 pr-4 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, ri) => (
                    <tr key={ri} className={`border-b last:border-b-0 ${tokenBorder}`}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="py-2.5 pr-4 align-top">
                          {cell.badge ? (
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                              style={{
                                background: toneStyle(cell.badge).bg,
                                color: toneStyle(cell.badge).fg,
                              }}
                            >
                              {cell.text}
                            </span>
                          ) : (
                            <>
                              <span
                                className={cell.strong ? `font-semibold ${tokenText}` : tokenTextSub}
                              >
                                {cell.text}
                              </span>
                              {cell.sub ? (
                                <span className={`block text-[11px] ${tokenTextSub}`}>
                                  {cell.sub}
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!visibleRows.length ? (
                    <tr>
                      <td
                        colSpan={report.table.columns.length}
                        className={`py-8 text-center ${tokenTextSub}`}
                      >
                        {dateRange
                          ? "Nenhum registro nesse período."
                          : report.table.empty}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              {report.table.note ? (
                <p className={`mt-3 text-[11px] ${tokenTextSub}`}>{report.table.note}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RelatoriosView({
  reports,
  openId,
  params,
}: {
  reports: ReportData[];
  openId: string | null;
  params: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(openId);

  const categories = useMemo(() => {
    const set = new Set(reports.map((r) => r.category));
    return ["all", ...Array.from(set)];
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (cat !== "all" && r.category !== cat) return false;
      if (q && !(r.title + " " + r.description + " " + r.category).toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [reports, search, cat]);

  const active = reports.find((r) => r.id === activeId) ?? null;

  // Abre/fecha o drawer instantaneamente com estado do cliente — os dados dos 6
  // relatórios já vêm carregados, então não precisa navegar. Sem mexer na URL
  // (replaceState no Next 16 re-roda o server component e reabria o drawer ao
  // fechar). O filtro dentro do drawer ainda carrega o `abrir` pra reabrir
  // após o re-fetch dos dados.
  function open(id: string) {
    setActiveId(id);
  }
  function close() {
    setActiveId(null);
  }

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <style>{`@keyframes relDrawerIn{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}`}</style>

      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <span
          className={`${FIN_HEADING} rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100`}
        >
          Relatórios
        </span>
        <div className="flex-1" />
        <NotificationBell />
        <ThemeToggle />
      </header>

      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <p className={`text-sm ${tokenTextSub}`}>
          Visualize, exporte e compare dados operacionais do armazém.
        </p>

        {/* Busca + categorias */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`flex h-[42px] min-w-[200px] flex-1 items-center gap-2.5 rounded-[11px] border px-4 ${tokenBorder} ${tokenCardBg}`}
          >
            <Search className={`h-[15px] w-[15px] ${tokenTextSub}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar relatório..."
              className={`flex-1 border-none bg-transparent text-[14px] outline-none ${tokenText}`}
            />
          </div>
          <div className={`flex gap-0.5 rounded-xl border p-1 ${tokenBorder} ${tokenCardBg}`}>
            {categories.map((c) => {
              const activeCat = cat === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`h-[34px] whitespace-nowrap rounded-[9px] px-3.5 text-[12.5px] font-bold transition ${
                    activeCat ? "text-white" : tokenTextSub
                  }`}
                  style={
                    activeCat
                      ? { background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }
                      : undefined
                  }
                >
                  {c === "all" ? "Todos" : c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid de cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <ReportCard key={r.id} report={r} onOpen={open} />
          ))}
        </div>
        {!filtered.length ? (
          <div className={`py-16 text-center text-[14px] ${tokenTextSub}`}>
            Nenhum relatório encontrado para a busca.
          </div>
        ) : null}
      </div>

      {active ? <ReportDrawer report={active} preserved={params} onClose={close} /> : null}
    </div>
  );
}
