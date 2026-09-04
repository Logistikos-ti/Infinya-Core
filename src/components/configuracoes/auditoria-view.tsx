"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { PillSelect } from "@/components/ui/pill-select";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-jetbrains-mono)]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

export type AuditoriaRow = {
  id: string;
  dataHora: string;
  usuario: string;
  papel: string;
  acao: string;
  modulo: string;
  origem: string;
  entidadeTipo: string;
  entidadeId: string;
  depositante: string;
  resultado: "SUCESSO" | "ERRO" | "NEGADO";
  ip: string;
  dispositivo: string;
  requestId: string;
  dadosAnteriores: unknown;
  dadosNovos: unknown;
  metadados: unknown;
};

type Filters = { q: string; usuario: string; modulo: string; depositante: string };

function tint(hex: string) {
  return { bg: `${hex}1a`, fg: hex };
}

// Cor do selo de ação: erro/negado sempre sinalizados; caso contrário varia
// por tipo de ação para dar leitura visual rápida da tabela.
function actionStyle(row: AuditoriaRow) {
  if (row.resultado === "ERRO") return tint("#EF4444");
  if (row.resultado === "NEGADO") return tint("#F59E0B");
  const a = row.acao.toLowerCase();
  if (a.includes("excluir") || a.includes("remov") || a.includes("cancel")) return tint("#EC4899");
  if (a.includes("criar") || a.includes("cadastr") || a.includes("gerar")) return tint("#10B981");
  if (a.includes("atualizar") || a.includes("editar") || a.includes("alter")) return tint("#3B82F6");
  if (a.includes("login") || a.includes("logout") || a.includes("acesso")) return tint("#94A3B8");
  if (a.includes("export") || a.includes("relat")) return tint("#8B5CF6");
  if (a.includes("bloque")) return tint("#F59E0B");
  if (a.includes("sincron") || a.includes("import") || a.includes("integr")) return tint("#06B6D4");
  return tint("#10B981");
}

export function AuditoriaView({
  rows,
  error,
  total,
  shownFrom,
  shownTo,
  page,
  totalPages,
  filters,
  kpis,
  usuarios,
  depositantes,
  modulos,
}: {
  rows: AuditoriaRow[];
  error: boolean;
  total: number;
  shownFrom: number;
  shownTo: number;
  page: number;
  totalPages: number;
  filters: Filters;
  kpis: { total: number; hoje: number; erro: number; usuariosAtivos: number };
  usuarios: Array<{ id: string; nome: string }>;
  depositantes: Array<{ id: string; nome: string }>;
  modulos: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(filters.q);
  const [detail, setDetail] = useState<AuditoriaRow | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDe, setExportDe] = useState("");
  const [exportAte, setExportAte] = useState("");
  const [exportResultado, setExportResultado] = useState("");

  function runExport() {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.usuario) params.set("usuario", filters.usuario);
    if (filters.modulo) params.set("modulo", filters.modulo);
    if (filters.depositante) params.set("depositante", filters.depositante);
    if (exportResultado) params.set("resultado", exportResultado);
    if (exportDe) params.set("de", exportDe);
    if (exportAte) params.set("ate", exportAte);
    const link = document.createElement("a");
    link.href = `/api/configuracoes/auditoria/exportar?${params.toString()}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setExportModalOpen(false);
  }

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  function navigate(next: Partial<Filters & { page: number }>) {
    const merged = { ...filters, page: 1, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.usuario) params.set("usuario", merged.usuario);
    if (merged.modulo) params.set("modulo", merged.modulo);
    if (merged.depositante) params.set("depositante", merged.depositante);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/configuracoes/auditoria?${qs}` : "/configuracoes/auditoria");
    });
  }

  // Busca com debounce: só navega quando o texto estabiliza e difere do atual.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput.trim() !== filters.q) navigate({ q: searchInput.trim() });
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const hasFilters = Boolean(filters.q || filters.usuario || filters.modulo || filters.depositante);

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <header
        className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b px-4 sm:px-8 ${tokenBorder}`}
      >
        <Link
          href="/configuracoes"
          title="Voltar para Configurações"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] dark:group-hover:text-[#8B5CF6] ${tokenText}`} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <h1 className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>Auditoria</h1>
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <Link href="/configuracoes" className="hover:underline">
              Configurações
            </Link>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>Auditoria</span>
          </div>
        </div>
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="flex-1 space-y-[18px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`text-sm ${tokenTextSub}`}>
            Rastreabilidade completa de ações e alterações no sistema.
          </p>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="flex h-[42px] items-center rounded-full border border-slate-200 bg-white px-[18px] text-[13.5px] font-bold text-slate-900 transition hover:brightness-[1.06] dark:border-white/10 dark:bg-[#101B30] dark:text-zinc-100"
          >
            Exportar logs
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard label="Total de ações" value={kpis.total.toLocaleString("pt-BR")} />
          <KpiCard label="Ações hoje" value={kpis.hoje.toLocaleString("pt-BR")} valueColor="#3B82F6" />
          <KpiCard
            label="Ações com erro"
            value={kpis.erro.toLocaleString("pt-BR")}
            valueColor={kpis.erro > 0 ? "#EF4444" : undefined}
          />
          <KpiCard
            label="Usuários ativos"
            value={kpis.usuariosAtivos.toLocaleString("pt-BR")}
            valueColor={kpis.usuariosAtivos > 0 ? "#10B981" : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`flex h-[42px] flex-1 min-w-[220px] items-center gap-2 rounded-full border px-3 ${tokenBorder} ${tokenCardBg}`}>
            <Search className={`h-4 w-4 ${tokenTextSub}`} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por usuário, ação, entidade ou código..."
              className={`flex-1 bg-transparent text-sm outline-none placeholder:text-[#64748B] dark:placeholder:text-[#8695AD] ${tokenText}`}
            />
          </div>
          <PillSelect
            value={filters.usuario}
            onChange={(v) => navigate({ usuario: v })}
            options={[
              { value: "", label: "Todos os usuários" },
              { value: "sistema", label: "Sistema" },
              ...usuarios.map((u) => ({ value: u.id, label: u.nome })),
            ]}
          />
          <PillSelect
            value={filters.modulo}
            onChange={(v) => navigate({ modulo: v })}
            options={[
              { value: "", label: "Todos os módulos" },
              ...modulos.map((m) => ({ value: m.value, label: m.label })),
            ]}
          />
          <PillSelect
            value={filters.depositante}
            onChange={(v) => navigate({ depositante: v })}
            options={[
              { value: "", label: "Todos depositantes" },
              ...depositantes.map((d) => ({ value: d.id, label: d.nome })),
            ]}
          />
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                startTransition(() => router.push("/configuracoes/auditoria"));
              }}
              className={`flex h-[42px] items-center rounded-full border px-[18px] text-[13.5px] font-bold transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
            >
              Limpar
            </button>
          ) : null}
        </div>

        <div className={`overflow-hidden rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
          {error ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <ShieldCheck className="h-9 w-9 text-[#F59E0B]" />
              <span className={`${FIN_HEADING} text-[16px] font-bold ${tokenText}`}>
                A base de auditoria ainda não está disponível
              </span>
              <span className={`text-[13px] ${tokenTextSub}`}>
                Aplique a migration de auditoria no Supabase e atualize esta página.
              </span>
            </div>
          ) : (
            <>
              <div className={`relative overflow-x-auto ${isPending ? "opacity-60" : ""}`}>
                <table className="w-full" style={{ minWidth: "980px" }}>
                  <thead>
                    <tr className={`border-b ${tokenBorder} ${tokenInputBg}`}>
                      <Th>Data e hora</Th>
                      <Th>Usuário</Th>
                      <Th>Ação</Th>
                      <Th>Módulo</Th>
                      <Th>Depositante</Th>
                      <Th>Detalhes</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length ? (
                      rows.map((row) => (
                        <AuditoriaRowTr key={row.id} row={row} onClick={() => setDetail(row)} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className={`px-5 py-12 text-center text-sm ${tokenTextSub}`}>
                          Nenhum evento encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {total > 0 ? (
                <div className={`flex items-center justify-between border-t px-5 py-3 ${tokenBorder}`}>
                  <span className={`text-[12.5px] ${tokenTextSub}`}>
                    {shownFrom}–{shownTo} de {total.toLocaleString("pt-BR")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate({ page: Math.max(1, page - 1) })}
                      disabled={page <= 1}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className={`text-[12.5px] font-semibold ${tokenText}`}>
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate({ page: Math.min(totalPages, page + 1) })}
                      disabled={page >= totalPages}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${tokenBorder} ${tokenInputBg} ${tokenText} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {detail ? <AuditoriaDrawer row={detail} onClose={() => setDetail(null)} /> : null}

      {exportModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" style={manropeStyle}>
          <div
            className="absolute inset-0 bg-[rgba(6,10,20,0.6)] backdrop-blur-sm"
            onClick={() => setExportModalOpen(false)}
          />
          <div
            className={`relative flex w-[460px] max-w-[94vw] flex-col rounded-[18px] border ${tokenBorder} ${tokenCardBg} shadow-[0_26px_64px_rgba(0,0,0,0.45)]`}
          >
            <div className={`flex items-start justify-between gap-3 border-b px-6 py-5 ${tokenBorder}`}>
              <div className="flex flex-col gap-1">
                <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tokenTextSub}`}>
                  Exportar
                </span>
                <span className={`${FIN_HEADING} text-[20px] font-bold ${tokenText}`}>
                  Exportar auditoria
                </span>
                <span className={`text-[13px] ${tokenTextSub}`}>
                  Refine o período e o resultado; os filtros da tela também são aplicados.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="flex flex-col gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${tokenTextSub}`}>
                  Período
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={exportDe}
                    max={exportAte || undefined}
                    onChange={(e) => setExportDe(e.target.value)}
                    className={`h-11 flex-1 rounded-full border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                  />
                  <span className={`text-[13px] ${tokenTextSub}`}>até</span>
                  <input
                    type="date"
                    value={exportAte}
                    min={exportDe || undefined}
                    onChange={(e) => setExportAte(e.target.value)}
                    className={`h-11 flex-1 rounded-full border px-3 text-[13px] outline-none ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${tokenTextSub}`}>
                  Resultado
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "", label: "Todos" },
                      { key: "SUCESSO", label: "Sucesso" },
                      { key: "ERRO", label: "Erro" },
                      { key: "NEGADO", label: "Negado" },
                    ] as const
                  ).map((opt) => {
                    const selected = exportResultado === opt.key;
                    return (
                      <button
                        key={opt.key || "todos"}
                        type="button"
                        onClick={() => setExportResultado(opt.key)}
                        className={`h-10 flex-1 rounded-full border-2 text-[13px] font-bold transition ${
                          selected
                            ? "border-[#8B5CF6] bg-[rgba(139,92,246,0.1)] text-[#8B5CF6]"
                            : `${tokenBorder} ${tokenInputBg} ${tokenTextSub} hover:border-violet-300`
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className={`text-[12px] ${tokenTextSub}`}>
                O arquivo sai em CSV (abre no Excel), com até 10.000 registros mais recentes.
              </p>
            </div>

            <div className={`flex items-center justify-center gap-3 border-t px-6 py-4 ${tokenBorder}`}>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className={`flex h-11 items-center rounded-full border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={runExport}
                className="auditoria-export-btn flex h-11 items-center gap-2 rounded-full px-[22px] text-sm font-extrabold"
                style={{ color: "#fff" }}
              >
                Exportar CSV
              </button>
            </div>
            <style jsx>{`
              .auditoria-export-btn {
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%);
                background-size: 220% 100%;
                background-position: 0% 50%;
                box-shadow: 0 8px 22px rgba(99, 102, 241, 0.32);
                transition:
                  background-position 0.6s ease,
                  transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.3s ease;
              }
              .auditoria-export-btn:hover {
                background-position: 100% 50%;
                transform: translateY(-3px);
                box-shadow: 0 12px 30px rgba(99, 140, 255, 0.45);
              }
            `}</style>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuditoriaRowTr({ row, onClick }: { row: AuditoriaRow; onClick: () => void }) {
  const rs = actionStyle(row);
  const detalhe = row.entidadeId ? `${row.entidadeTipo} · ${row.entidadeId}` : row.entidadeTipo;
  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-t transition ${tokenBorder} hover:bg-[rgba(139,92,246,0.08)]`}
    >
      <td
        className={`${monoFont} ${tokenTextSub}`}
        style={{ padding: "12px 16px", fontSize: "12px", whiteSpace: "nowrap" }}
      >
        {row.dataHora}
      </td>
      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
        <div className={`text-[13.5px] font-semibold ${tokenText}`}>{row.usuario}</div>
        <div className={`mt-0.5 text-[11.5px] ${tokenTextSub}`}>{row.papel}</div>
      </td>
      <td style={{ padding: "12px 16px" }}>
        <span
          className="inline-flex items-center"
          style={{
            gap: "6px",
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            background: rs.bg,
            color: rs.fg,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: rs.fg }} />
          {row.acao}
        </span>
      </td>
      <td className={tokenTextSub} style={{ padding: "12px 16px", fontSize: "12.5px", whiteSpace: "nowrap" }}>
        {row.modulo}
      </td>
      <td className={tokenTextSub} style={{ padding: "12px 16px", fontSize: "12.5px", whiteSpace: "nowrap" }}>
        {row.depositante}
      </td>
      <td
        className={tokenText}
        style={{
          padding: "12px 16px",
          fontSize: "13px",
          maxWidth: "320px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={detalhe}
      >
        {detalhe}
      </td>
      <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "13px" }} className={tokenTextSub}>
        ›
      </td>
    </tr>
  );
}

function AuditoriaDrawer({ row, onClose }: { row: AuditoriaRow; onClose: () => void }) {
  const as = actionStyle(row);
  const detalhe = row.entidadeId ? `${row.entidadeTipo} · ${row.entidadeId}` : row.entidadeTipo;
  const changes = diffChanges(row.dadosAnteriores, row.dadosNovos);

  return (
    <div className="fixed inset-0 z-40" style={manropeStyle}>
      <div className="absolute inset-0 bg-[rgba(6,10,20,0.45)] backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[460px] max-w-[92vw] flex-col border-l bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        <div className={`border-b px-6 pb-4 pt-[22px] ${tokenBorder}`}>
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="flex items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
              style={{ background: as.bg, color: as.fg }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: as.fg }} />
              {row.acao}
            </span>
            <span
              className="rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
              style={{ background: "rgba(139,92,246,0.14)", color: "#8B5CF6" }}
            >
              {row.modulo}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              title="Fechar"
              onClick={onClose}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-full border ${tokenBorder} ${tokenTextSub} transition hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6]`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`text-[18px] font-bold ${tokenText}`}>{row.acao}</div>
          <div className={`${monoFont} mt-1 text-[12px] ${tokenTextSub}`}>{row.dataHora}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-4">
          <div
            className={`mb-3.5 rounded-[12px] border px-4 py-3.5 text-[13.5px] leading-[1.6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          >
            {detalhe}
          </div>

          <KvRow label="Usuário" value={row.usuario} />
          <KvRow label="Depositante" value={row.depositante} />
          <KvRow label="IP" value={row.ip || "—"} mono />
          <KvRow label="Dispositivo" value={deviceLabel(row.dispositivo)} />

          {changes.length ? (
            <div className={`mt-3.5 rounded-[12px] border px-4 py-3.5 ${tokenBorder} ${tokenInputBg}`}>
              <SectionLabel>Alteração</SectionLabel>
              <div className="flex flex-col gap-2.5">
                {changes.slice(0, 8).map((c, i) => (
                  <div key={i}>
                    {changes.length > 1 ? (
                      <div className={`mb-1 text-[11px] font-semibold ${tokenTextSub}`}>{formatKey(c.key)}</div>
                    ) : null}
                    <div className="flex items-center gap-3 text-[13px]">
                      <span
                        className="min-w-0 flex-1 truncate rounded-full px-3 py-2 font-semibold"
                        title={formatVal(c.antes)}
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#DC2626" }}
                      >
                        {formatVal(c.antes)}
                      </span>
                      <span className={tokenTextSub}>→</span>
                      <span
                        className="min-w-0 flex-1 truncate rounded-full px-3 py-2 font-semibold"
                        title={formatVal(c.depois)}
                        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#059669" }}
                      >
                        {formatVal(c.depois)}
                      </span>
                    </div>
                  </div>
                ))}
                {changes.length > 8 ? (
                  <div className={`text-[11.5px] ${tokenTextSub}`}>
                    +{changes.length - 8} campo(s) alterado(s)
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function diffChanges(antes: unknown, depois: unknown) {
  const a =
    antes && typeof antes === "object" && !Array.isArray(antes)
      ? (antes as Record<string, unknown>)
      : {};
  const d =
    depois && typeof depois === "object" && !Array.isArray(depois)
      ? (depois as Record<string, unknown>)
      : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(d)]);
  const changes: Array<{ key: string; antes: unknown; depois: unknown }> = [];
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(d[key])) {
      changes.push({ key, antes: a[key], depois: d[key] });
    }
  }
  return changes;
}

function formatVal(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatKey(key: string) {
  return key.replace(/_/g, " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function deviceLabel(userAgent: string) {
  if (!userAgent) return "—";
  const s = userAgent.toLowerCase();
  if (/ipad|tablet/.test(s)) return "Tablet";
  if (/mobile|android|iphone|coletor/.test(s)) return "Celular";
  return "Desktop";
}

function KvRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b py-[9px] text-[13.5px] ${tokenBorder}`}>
      <span className={tokenTextSub}>{label}</span>
      <span className={`text-right font-semibold ${mono ? `${monoFont} text-[12px] break-all` : ""} ${tokenText}`}>
        {value}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mb-2 text-[12px] font-bold uppercase tracking-[0.1em] ${tokenTextSub}`}>
      {children}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      className={tokenTextSub}
      style={{
        padding: "10px 16px",
        textAlign: "left",
        fontWeight: 700,
        fontSize: "10.5px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function KpiCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101B30]">
      <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
      <span
        className={`${FIN_HEADING} text-[30px] font-bold`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        <span className={valueColor ? "" : "text-slate-900 dark:text-zinc-100"}>{value}</span>
      </span>
    </div>
  );
}
