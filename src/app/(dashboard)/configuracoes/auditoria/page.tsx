import Link from "next/link";
import { Download, Search, ShieldCheck } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimePtBr } from "@/lib/utils";

const PAGE_SIZE = 30;

type AuditoriaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AuditRow = {
  id: string;
  ocorrido_em: string;
  depositante_id: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_papel: string | null;
  modulo: string;
  acao: string;
  entidade_tipo: string;
  entidade_id: string | null;
  resultado: "SUCESSO" | "ERRO" | "NEGADO";
  origem: string;
  dados_anteriores: unknown;
  dados_novos: unknown;
  metadados: unknown;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  depositante?: { nome?: string | null } | Array<{ nome?: string | null }> | null;
};

export default async function AuditoriaPage({ searchParams }: AuditoriaPageProps) {
  await requireRoleAccess(["ADMIN", "TI"]);
  const rawParams = searchParams ? await searchParams : {};
  const filters = parseFilters(rawParams);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("auditoria_eventos")
    .select("*, depositante:depositantes(nome)", { count: "exact" })
    .order("ocorrido_em", { ascending: false });

  query = applyFilters(query, filters);
  const from = (filters.page - 1) * PAGE_SIZE;
  const [{ data, count, error }, depositantesResult] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from("depositantes").select("id, nome").order("nome"),
  ]);

  const rows = (data ?? []) as AuditRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportHref = `/api/configuracoes/auditoria/exportar?${buildQueryString(filters, false)}`;

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Auditoria"
        description="Histórico imutável das alterações críticas, acessos e eventos operacionais do WMS. Consulte quem fez, o que mudou e quando aconteceu."
        badge="Governança e rastreabilidade"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Eventos encontrados" value={String(total)} />
        <SummaryCard label="Nesta página" value={String(rows.length)} />
        <SummaryCard label="Página atual" value={`${Math.min(filters.page, totalPages)} de ${totalPages}`} />
        <SummaryCard label="Retenção" value="Histórico imutável" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/55">
        <form className="grid gap-4 xl:grid-cols-[minmax(240px,1.4fr)_repeat(6,minmax(130px,0.7fr))_auto]" method="get">
          <Field label="Buscar">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="Usuário, ação, entidade ou código..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </Field>
          <Field label="Módulo">
            <select name="modulo" defaultValue={filters.modulo} className={selectClassName}>
              <option value="">Todos</option>
              {AUDIT_MODULES.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
            </select>
          </Field>
          <Field label="Ação">
            <select name="acao" defaultValue={filters.acao} className={selectClassName}>
              <option value="">Todas</option>
              {AUDIT_ACTIONS.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
            </select>
          </Field>
          <Field label="Resultado">
            <select name="resultado" defaultValue={filters.resultado} className={selectClassName}>
              <option value="">Todos</option>
              <option value="SUCESSO">Sucesso</option>
              <option value="ERRO">Erro</option>
              <option value="NEGADO">Negado</option>
            </select>
          </Field>
          <Field label="Depositante">
            <select name="depositante" defaultValue={filters.depositante} className={selectClassName}>
              <option value="">Todos</option>
              {(depositantesResult.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </Field>
          <Field label="De">
            <input type="date" name="de" defaultValue={filters.de} className={selectClassName} />
          </Field>
          <Field label="Até">
            <input type="date" name="ate" defaultValue={filters.ate} className={selectClassName} />
          </Field>
          <div className="flex items-end gap-2">
            <button className="h-11 rounded-xl bg-infinya-gradient px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:-translate-y-0.5" type="submit">
              Filtrar
            </button>
            <Link href="/configuracoes/auditoria" className="flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-white/10 dark:text-slate-300">
              Limpar
            </Link>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Exibindo {rows.length ? from + 1 : 0}-{Math.min(from + rows.length, total)} de {total} eventos.
          </p>
          <Link href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-300 dark:border-white/10 dark:text-slate-200">
            <Download className="size-4" /> Exportar CSV
          </Link>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-950/55">
        {error ? (
          <div className="p-8 text-center">
            <ShieldCheck className="mx-auto size-9 text-amber-500" />
            <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">A base de auditoria ainda não está disponível</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Aplique a migration de auditoria no Supabase e atualize esta página.</p>
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">Data e hora</th>
                  <th className="px-5 py-4 font-semibold">Usuário</th>
                  <th className="px-5 py-4 font-semibold">Evento</th>
                  <th className="px-5 py-4 font-semibold">Entidade</th>
                  <th className="px-5 py-4 font-semibold">Depositante</th>
                  <th className="px-5 py-4 font-semibold">Resultado</th>
                  <th className="px-5 py-4 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-cyan-50/30 dark:border-white/5 dark:hover:bg-cyan-500/5">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">{formatDateTimePtBr(row.ocorrido_em)}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{row.usuario_nome || actorFallback(row)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{formatLabel(row.usuario_papel || "SISTEMA")}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{formatLabel(row.acao)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{formatLabel(row.modulo)} · {formatLabel(row.origem)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-700 dark:text-slate-200">{formatLabel(row.entidade_tipo)}</p>
                      <p className="mt-0.5 max-w-[220px] truncate font-mono text-xs text-slate-500" title={row.entidade_id ?? undefined}>{row.entidade_id || "-"}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{getDepositanteName(row.depositante) || "Ambiente geral"}</td>
                    <td className="px-5 py-4"><ResultBadge result={row.resultado} /></td>
                    <td className="px-5 py-4">
                      <details className="group">
                        <summary className="cursor-pointer list-none font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300">Ver alterações</summary>
                        <div className="mt-3 grid w-[520px] max-w-[70vw] gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-white/10 dark:bg-slate-900">
                          <JsonBlock title="Antes" value={row.dados_anteriores} />
                          <JsonBlock title="Depois" value={row.dados_novos} />
                          <JsonBlock title="Metadados" value={row.metadados} />
                          <div className="grid gap-1 text-slate-500 dark:text-slate-400">
                            <span>IP: {row.ip || "não informado"}</span>
                            <span>Request ID: {row.request_id || "não informado"}</span>
                            <span className="break-all">Agente: {row.user_agent || "não informado"}</span>
                          </div>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum evento encontrado para os filtros selecionados.</div>
        )}
      </section>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginação da auditoria">
          <PageLink label="Anterior" page={Math.max(1, filters.page - 1)} disabled={filters.page <= 1} filters={filters} />
          <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300">{filters.page} / {totalPages}</span>
          <PageLink label="Próxima" page={Math.min(totalPages, filters.page + 1)} disabled={filters.page >= totalPages} filters={filters} />
        </nav>
      ) : null}
    </div>
  );
}

const selectClassName = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15 dark:border-white/10 dark:bg-slate-900 dark:text-white";
const AUDIT_MODULES = ["ACESSOS", "CADASTROS", "PRODUTOS", "ENDERECAMENTO", "RECEBIMENTO", "ESTOQUE", "INVENTARIO", "QUARENTENA", "EXPEDICAO", "SEPARACAO", "ROMANEIO", "PEDIDOS_FULL", "SUPORTE", "FINANCEIRO", "INTEGRACOES"];
const AUDIT_ACTIONS = ["CRIAR", "ATUALIZAR", "EXCLUIR", "LOGIN", "LOGIN_FALHOU", "LOGOUT", "EXPORTAR"];

type Filters = ReturnType<typeof parseFilters>;

function parseFilters(params: Record<string, string | string[] | undefined>) {
  const get = (key: string) => typeof params[key] === "string" ? String(params[key]) : "";
  return {
    q: get("q").trim().slice(0, 100),
    modulo: get("modulo").trim().slice(0, 80),
    acao: get("acao").trim().slice(0, 80),
    resultado: get("resultado").trim().slice(0, 20),
    depositante: get("depositante").trim().slice(0, 50),
    de: get("de").trim().slice(0, 10),
    ate: get("ate").trim().slice(0, 10),
    page: Math.max(1, Number.parseInt(get("page") || "1", 10) || 1),
  };
}

function applyFilters(query: any, filters: Filters) {
  if (filters.modulo) query = query.eq("modulo", filters.modulo);
  if (filters.acao) query = query.eq("acao", filters.acao);
  if (filters.resultado) query = query.eq("resultado", filters.resultado);
  if (filters.depositante) query = query.eq("depositante_id", filters.depositante);
  if (filters.de) query = query.gte("ocorrido_em", `${filters.de}T00:00:00-03:00`);
  if (filters.ate) query = query.lte("ocorrido_em", `${filters.ate}T23:59:59.999-03:00`);
  if (filters.q) {
    const term = filters.q.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`usuario_nome.ilike.%${term}%,acao.ilike.%${term}%,entidade_tipo.ilike.%${term}%,entidade_id.ilike.%${term}%`);
  }
  return query;
}

function buildQueryString(filters: Filters, includePage = true) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if ((!includePage && key === "page") || !value || value === 1) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><span>{label}</span>{children}</label>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/55"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{value}</p></div>;
}

function ResultBadge({ result }: { result: AuditRow["resultado"] }) {
  const styles = result === "SUCESSO" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : result === "NEGADO" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}>{formatLabel(result)}</span>;
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return <div><p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{title}</p><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-3 text-[11px] leading-5 text-cyan-100">{JSON.stringify(value, null, 2)}</pre></div>;
}

function PageLink({ label, page, disabled, filters }: { label: string; page: number; disabled: boolean; filters: Filters }) {
  const href = `/configuracoes/auditoria?${buildQueryString({ ...filters, page })}`;
  return disabled ? <span className="cursor-not-allowed rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-300 dark:border-white/10 dark:text-slate-600">{label}</span> : <Link href={href} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">{label}</Link>;
}

function formatLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function actorFallback(row: AuditRow) {
  return row.origem === "BANCO" ? "Operação do sistema" : "Usuário não identificado";
}

function getDepositanteName(value: AuditRow["depositante"]) {
  if (Array.isArray(value)) return value[0]?.nome ?? null;
  return value?.nome ?? null;
}
