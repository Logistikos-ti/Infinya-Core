"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

const manropeStyle: React.CSSProperties = { fontFamily: "var(--font-manrope), Manrope, sans-serif" };
const groteskStyle: React.CSSProperties = {
  fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
};
const MONO = "font-[family-name:var(--font-jetbrains-mono)]";

export type DashboardData = {
  userName: string;
  kpis: { label: string; value: string; color?: string; bar?: number; sub?: string; subColor?: string }[];
  dailyOrders: { label: string; value: number }[];
  ranking: { nome: string; valor: number }[];
  hourly: { hour: string; recebimento: number; expedicao: number }[];
  recebimentosHoje: { hora: string; fornecedor: string; depositante: string; doca: string }[];
  ondas: { id: string; pedidos: number; pct: number; operador: string }[];
  enderecosCriticos: { codigo: string; produto: string; pct: number }[];
  movimentacoes: { tipo: string; detalhe: string; operador: string; quando: string }[];
  chamados: { id: string; assunto: string; prioridade: string }[];
  alertas: { severidade: "critical" | "warning"; mensagem: string }[];
};

const PRIORITY_COLOR: Record<string, string> = {
  Crítica: "#EF4444",
  Alta: "#F59E0B",
  Normal: "#3B82F6",
  Baixa: "#64748B",
};

function useGreetingClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function greetingFor(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function ListCard({
  title,
  href,
  linkLabel,
  badge,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-[14px] border p-4 ${tokenBorder} ${tokenCardBg}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`text-[13.5px] font-bold ${tokenText}`} style={groteskStyle}>
          {title}
        </span>
        {href ? (
          <Link
            href={href}
            className="-mx-2 -my-1 rounded-md px-2 py-1 text-[11.5px] text-[#8B5CF6] transition-colors hover:bg-[rgba(139,92,246,0.14)] hover:text-[#A78BFA]"
          >
            {linkLabel ?? "Ver tudo"} →
          </Link>
        ) : (
          badge
        )}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({ children, first }: { children: React.ReactNode; first: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 py-2.5 ${first ? "" : `border-t ${tokenBorder}`}`}>{children}</div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className={`py-4 text-center text-[12px] ${tokenTextSub}`}>{message}</p>;
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const w = 560;
  const h = 180;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const max = Math.max(1, ...data.map((d) => d.value));
  const xStep = (w - padL - padR) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => ({
    x: padL + i * xStep,
    y: padT + (h - padT - padB) * (1 - d.value / max),
  }));
  const pointsStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `M ${points[0].x} ${h - padB} L ${pointsStr.split(" ").join(" L ")} L ${points[points.length - 1].x} ${h - padB} Z`;

  const hovered = hoverIndex != null ? { point: points[hoverIndex], item: data[hoverIndex] } : null;

  return (
    <div className="relative">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="dashLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[1, 2, 3, 4].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={w - padR}
            y1={padT + ((h - padT - padB) / 4) * g}
            y2={padT + ((h - padT - padB) / 4) * g}
            stroke="currentColor"
            strokeWidth={1}
            className={tokenTextSub}
            opacity={0.25}
          />
        ))}
        <path d={areaPath} fill="url(#dashLineGrad)" />
        {hovered ? (
          <line
            x1={hovered.point.x}
            x2={hovered.point.x}
            y1={padT}
            y2={h - padB}
            stroke="#8B5CF6"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        ) : null}
        <polyline
          fill="none"
          stroke="#8B5CF6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsStr}
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 6 : i === points.length - 1 ? 5 : 3}
              fill="#8B5CF6"
              className="stroke-white dark:stroke-[#101B30] transition-[r]"
              strokeWidth={2}
            />
            {/* Alvo invisível maior, só pra facilitar o hover do ponto */}
            <circle
              cx={p.x}
              cy={p.y}
              r={10}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((current) => (current === i ? null : current))}
            />
          </g>
        ))}
      </svg>
      {hovered ? (
        <div
          className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold shadow-lg ${tokenBorder} ${tokenCardBg} ${tokenText}`}
          style={{
            left: `${(hovered.point.x / w) * 100}%`,
            top: `${(hovered.point.y / h) * 100}%`,
            marginTop: -10,
          }}
        >
          <div style={groteskStyle}>{hovered.item.label}</div>
          <div className={tokenTextSub}>
            {hovered.item.value} pedido{hovered.item.value === 1 ? "" : "s"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HourlyBarChart({
  hourly,
  maxHourly,
}: {
  hourly: DashboardData["hourly"];
  maxHourly: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  return (
    <div className="flex h-[160px] items-end gap-1.5">
      {hourly.map((h, i) => (
        <div
          key={h.hour}
          className="relative flex h-full flex-1 flex-col items-center gap-1"
          onMouseEnter={() => setHoverIndex(i)}
          onMouseLeave={() => setHoverIndex((current) => (current === i ? null : current))}
        >
          {hoverIndex === i ? (
            <div
              className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold shadow-lg ${tokenBorder} ${tokenCardBg} ${tokenText}`}
            >
              <div style={groteskStyle}>{h.hour}h</div>
              <div>
                <span className="text-[#3B82F6]">●</span> {h.recebimento}{" "}
                {h.recebimento === 1 ? "recebimento" : "recebimentos"}
              </div>
              <div>
                <span className="text-[#8B5CF6]">●</span> {h.expedicao}{" "}
                {h.expedicao === 1 ? "expedição" : "expedições"}
              </div>
            </div>
          ) : null}
          <div className="flex w-full flex-1 items-end gap-0.5">
            <div
              className={`flex-1 rounded-t-[3px] bg-[#3B82F6] transition-opacity ${hoverIndex != null && hoverIndex !== i ? "opacity-40" : ""}`}
              style={{ height: `${Math.max(2, (h.recebimento / maxHourly) * 100)}%` }}
            />
            <div
              className={`flex-1 rounded-t-[3px] bg-[#8B5CF6] transition-opacity ${hoverIndex != null && hoverIndex !== i ? "opacity-40" : ""}`}
              style={{ height: `${Math.max(2, (h.expedicao / maxHourly) * 100)}%` }}
            />
          </div>
          <span className={`text-[10px] ${tokenTextSub} ${MONO}`}>{h.hour}h</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  const now = useGreetingClock();
  const hour = now ? now.getHours() : 9;
  const maxRanking = Math.max(1, ...data.ranking.map((r) => r.valor));
  const maxHourly = Math.max(1, ...data.hourly.flatMap((h) => [h.recebimento, h.expedicao]));

  return (
    <div className="h-full overflow-y-auto" style={manropeStyle}>
      <div className="px-5 pb-10 pt-5 sm:px-8">
        {/* Cabeçalho: saudação + relógio + sino + tema */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className={`m-0 text-[26px] font-bold ${tokenText}`} style={groteskStyle}>
              {greetingFor(hour)}, {data.userName}
            </h1>
            <p className={`mt-1.5 text-[14px] ${tokenTextSub}`}>Visão geral da operação</p>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="flex flex-col items-end leading-tight">
              <span className={`text-[22px] font-bold ${tokenText} ${MONO}`} style={groteskStyle}>
                {now
                  ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
                  : "--:--:--"}
              </span>
              <span className={`text-[12.5px] font-semibold ${tokenTextSub}`}>
                {now
                  ? `${DIAS[now.getDay()]}, ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}`
                  : ""}
              </span>
            </div>
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-[18px] grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {data.kpis.map((k) => (
            <div key={k.label} className={`rounded-[14px] border px-4 py-3.5 ${tokenBorder} ${tokenCardBg}`}>
              <div className={`text-[10.5px] font-bold uppercase tracking-[0.12em] ${tokenTextSub}`}>
                {k.label}
              </div>
              <div
                className="mt-1.5 text-[22px] font-bold"
                style={{ ...groteskStyle, color: k.color }}
              >
                <span className={k.color ? "" : tokenText}>{k.value}</span>
              </div>
              {k.bar != null ? (
                <div className="mt-2 h-[5px] overflow-hidden rounded-[3px] bg-[rgba(148,163,184,0.14)]">
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(100, k.bar)}%`, background: "linear-gradient(90deg,#3B82F6,#8B5CF6)" }}
                  />
                </div>
              ) : null}
              {k.sub ? (
                <div
                  className={`mt-1.5 text-[11.5px] font-semibold ${k.subColor ? "" : tokenTextSub}`}
                  style={k.subColor ? { color: k.subColor } : undefined}
                >
                  {k.sub}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Pedidos por dia + Ranking depositantes */}
        <div className="mb-3.5 grid gap-3.5 xl:grid-cols-[2fr_1fr]">
          <div className={`rounded-[14px] border p-[18px] ${tokenBorder} ${tokenCardBg}`}>
            <div className="mb-3.5 flex items-center justify-between">
              <span className={`text-[14.5px] font-bold ${tokenText}`} style={groteskStyle}>
                Pedidos por dia
              </span>
              <span className={`text-[11.5px] ${tokenTextSub}`}>últimos 14 dias</span>
            </div>
            <LineChart data={data.dailyOrders} />
          </div>
          <div className={`rounded-[14px] border p-[18px] ${tokenBorder} ${tokenCardBg}`}>
            <div className="mb-3.5 flex items-center justify-between">
              <span className={`text-[14.5px] font-bold ${tokenText}`} style={groteskStyle}>
                Ranking depositantes
              </span>
              <span className={`text-[11.5px] ${tokenTextSub}`}>mês atual</span>
            </div>
            {data.ranking.length ? (
              <div className="flex flex-col gap-3">
                {data.ranking.map((d) => (
                  <div key={d.nome}>
                    <div className="mb-1 flex justify-between text-[12.5px] font-semibold">
                      <span className={tokenText}>{d.nome}</span>
                      <span className={`${MONO} ${tokenText}`}>
                        {d.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-[rgba(148,163,184,0.14)]">
                      <div
                        className="h-full"
                        style={{
                          width: `${(d.valor / maxRanking) * 100}%`,
                          background: "linear-gradient(90deg,#3B82F6,#8B5CF6)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyRow message="Nenhuma fatura no mês atual." />
            )}
          </div>
        </div>

        {/* Movimentação por hora */}
        <div className={`mb-3.5 rounded-[14px] border p-[18px] ${tokenBorder} ${tokenCardBg}`}>
          <div className="mb-3.5 flex items-center justify-between">
            <span className={`text-[14.5px] font-bold ${tokenText}`} style={groteskStyle}>
              Movimentação por hora
            </span>
            <div className={`flex gap-3.5 text-[11.5px] ${tokenTextSub}`}>
              <span>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#3B82F6] align-middle" />
                Recebimento
              </span>
              <span>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#8B5CF6] align-middle" />
                Expedição
              </span>
            </div>
          </div>
          {data.hourly.length ? (
            <HourlyBarChart hourly={data.hourly} maxHourly={maxHourly} />
          ) : (
            <EmptyRow message="Nenhuma movimentação registrada hoje." />
          )}
        </div>

        {/* Listas */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          <ListCard title="Recebimentos hoje" href="/recebimento">
            {data.recebimentosHoje.length ? (
              data.recebimentosHoje.map((r, i) => (
                <Row key={i} first={i === 0}>
                  <span className={`min-w-[42px] text-[12px] font-bold text-[#3B82F6] ${MONO}`}>{r.hora}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[12.5px] font-semibold ${tokenText}`}>{r.fornecedor}</div>
                    <div className={`text-[11px] ${tokenTextSub}`}>{r.depositante}</div>
                  </div>
                  <span className={`rounded-md bg-[rgba(139,92,246,0.14)] px-2 py-0.5 text-[11px] font-bold text-[#8B5CF6] ${MONO}`}>
                    {r.doca}
                  </span>
                </Row>
              ))
            ) : (
              <EmptyRow message="Nenhum recebimento previsto para hoje." />
            )}
          </ListCard>

          <ListCard title="Ondas em separação" href="/expedicao/separacao">
            {data.ondas.length ? (
              data.ondas.map((o, i) => (
                <Row key={o.id} first={i === 0}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12px] font-bold ${tokenText} ${MONO}`}>{o.id}</div>
                    <div className={`text-[11px] ${tokenTextSub}`}>
                      {o.pedidos} pedido(s) · {o.operador}
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded bg-[rgba(148,163,184,0.14)]">
                      <div
                        className="h-full"
                        style={{ width: `${o.pct}%`, background: "linear-gradient(90deg,#3B82F6,#8B5CF6)" }}
                      />
                    </div>
                  </div>
                  <span className={`min-w-[38px] text-right text-[13px] font-extrabold ${tokenText} ${MONO}`}>
                    {o.pct}%
                  </span>
                </Row>
              ))
            ) : (
              <EmptyRow message="Nenhuma onda em separação agora." />
            )}
          </ListCard>

          <ListCard title="Endereços críticos" href="/configuracoes/enderecos">
            {data.enderecosCriticos.length ? (
              data.enderecosCriticos.map((e, i) => (
                <Row key={e.codigo} first={i === 0}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12px] font-bold ${tokenText} ${MONO}`}>{e.codigo}</div>
                    <div className={`truncate text-[11px] ${tokenTextSub}`}>{e.produto}</div>
                  </div>
                  <span
                    className={`min-w-[38px] text-right text-[13px] font-extrabold ${MONO}`}
                    style={{ color: e.pct >= 98 ? "#EF4444" : "#F59E0B" }}
                  >
                    {e.pct}%
                  </span>
                </Row>
              ))
            ) : (
              <EmptyRow message="Nenhum endereço acima de 90% de ocupação." />
            )}
          </ListCard>

          <ListCard title="Últimas movimentações" href="/configuracoes/auditoria" linkLabel="Ver log">
            {data.movimentacoes.length ? (
              data.movimentacoes.map((m, i) => (
                <Row key={i} first={i === 0}>
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#8B5CF6]" />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[12.5px] ${tokenText}`}>
                      <b>{m.tipo}</b> · {m.detalhe}
                    </div>
                    <div className={`text-[11px] ${tokenTextSub} ${MONO}`}>
                      {m.quando} · {m.operador}
                    </div>
                  </div>
                </Row>
              ))
            ) : (
              <EmptyRow message="Nenhuma movimentação recente." />
            )}
          </ListCard>

          <ListCard title="Chamados abertos" href="/suporte">
            {data.chamados.length ? (
              data.chamados.map((c, i) => (
                <Row key={c.id} first={i === 0}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11.5px] font-bold ${tokenTextSub} ${MONO}`}>{c.id}</div>
                    <div className={`truncate text-[12.5px] ${tokenText}`}>{c.assunto}</div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{
                      color: PRIORITY_COLOR[c.prioridade] ?? tokenTextSub,
                      background: `${PRIORITY_COLOR[c.prioridade] ?? "#64748B"}1a`,
                    }}
                  >
                    {c.prioridade}
                  </span>
                </Row>
              ))
            ) : (
              <EmptyRow message="Nenhum chamado aberto." />
            )}
          </ListCard>

          <ListCard
            title="Alertas críticos"
            badge={
              <span className="text-[11.5px] font-bold text-[#EF4444]">
                {data.alertas.length} ativo(s)
              </span>
            }
          >
            {data.alertas.length ? (
              data.alertas.map((a, i) => (
                <Row key={i} first={i === 0}>
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[13px]"
                    style={{
                      color: a.severidade === "critical" ? "#EF4444" : "#F59E0B",
                      background: a.severidade === "critical" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                    }}
                  >
                    ⚠
                  </span>
                  <span className={`flex-1 text-[12.5px] ${tokenText}`}>{a.mensagem}</span>
                </Row>
              ))
            ) : (
              <EmptyRow message="Nenhum alerta crítico no momento." />
            )}
          </ListCard>
        </div>
      </div>
    </div>
  );
}
