import { requireRoleAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimePtBr } from "@/lib/utils";
import { AuditoriaView, type AuditoriaRow } from "@/components/configuracoes/auditoria-view";

const PAGE_SIZE = 10;

// Vocabulário de módulos exibido no filtro. Inclui os módulos usados pelos
// gatilhos de auditoria além da lista base da tela antiga.
const AUDIT_MODULES = [
  "ACESSOS",
  "CADASTROS",
  "PRODUTOS",
  "ENDERECAMENTO",
  "RECEBIMENTO",
  "ESTOQUE",
  "INVENTARIO",
  "QUARENTENA",
  "EXPEDICAO",
  "SEPARACAO",
  "ROMANEIO",
  "PEDIDOS_FULL",
  "SUPORTE",
  "FINANCEIRO",
  "INTEGRACOES",
  "TRANSPORTADORAS",
  "OPERACAO",
  "DOCUMENTOS",
  "AUDITORIA",
].sort();

type AuditoriaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AuditRecord = {
  id: string;
  ocorrido_em: string;
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

function parseFilters(params: Record<string, string | string[] | undefined>) {
  const get = (key: string) => (typeof params[key] === "string" ? String(params[key]) : "");
  return {
    q: get("q").trim().slice(0, 100),
    usuario: get("usuario").trim().slice(0, 50),
    modulo: get("modulo").trim().slice(0, 80),
    acao: get("acao").trim().slice(0, 80),
    resultado: get("resultado").trim().slice(0, 20),
    depositante: get("depositante").trim().slice(0, 50),
    de: get("de").trim().slice(0, 10),
    ate: get("ate").trim().slice(0, 10),
    page: Math.max(1, Number.parseInt(get("page") || "1", 10) || 1),
  };
}

type Filters = ReturnType<typeof parseFilters>;

function applyFilters(query: any, filters: Filters) {
  if (filters.usuario === "sistema") query = query.is("usuario_id", null);
  else if (filters.usuario) query = query.eq("usuario_id", filters.usuario);
  if (filters.modulo) query = query.eq("modulo", filters.modulo);
  if (filters.acao) query = query.eq("acao", filters.acao);
  if (filters.resultado) query = query.eq("resultado", filters.resultado);
  if (filters.depositante) query = query.eq("depositante_id", filters.depositante);
  if (filters.de) query = query.gte("ocorrido_em", `${filters.de}T00:00:00-03:00`);
  if (filters.ate) query = query.lte("ocorrido_em", `${filters.ate}T23:59:59.999-03:00`);
  if (filters.q) {
    const term = filters.q.replace(/[%_,()]/g, " ").trim();
    if (term) {
      query = query.or(
        `usuario_nome.ilike.%${term}%,acao.ilike.%${term}%,entidade_tipo.ilike.%${term}%,entidade_id.ilike.%${term}%`,
      );
    }
  }
  return query;
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function getDepositanteName(value: AuditRecord["depositante"]) {
  if (Array.isArray(value)) return value[0]?.nome ?? null;
  return value?.nome ?? null;
}

function actorFallback(row: AuditRecord) {
  return row.origem === "BANCO" ? "Operação do sistema" : "Usuário não identificado";
}

export default async function AuditoriaPage({ searchParams }: AuditoriaPageProps) {
  await requireRoleAccess(["ADMIN", "TI"]);
  const rawParams = searchParams ? await searchParams : {};
  const filters = parseFilters(rawParams);
  const supabase = await createSupabaseServerClient();

  const agora = new Date();
  const hojeSp = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const inicioHojeIso = `${hojeSp}T00:00:00-03:00`;
  const inicio30dIso = new Date(agora.getTime() - 30 * 86400000).toISOString();

  let listQuery = supabase
    .from("auditoria_eventos")
    .select("*, depositante:depositantes(nome)", { count: "exact" })
    .order("ocorrido_em", { ascending: false });
  listQuery = applyFilters(listQuery, filters);
  const from = (filters.page - 1) * PAGE_SIZE;

  const [
    listResult,
    depositantesResult,
    usuariosResult,
    totalResult,
    hojeResult,
    erroResult,
    ativosResult,
  ] = await Promise.all([
    listQuery.range(from, from + PAGE_SIZE - 1),
    supabase.from("depositantes").select("id, nome").order("nome"),
    supabase.from("usuarios").select("id, nome").order("nome"),
    supabase.from("auditoria_eventos").select("*", { count: "exact", head: true }),
    supabase
      .from("auditoria_eventos")
      .select("*", { count: "exact", head: true })
      .gte("ocorrido_em", inicioHojeIso),
    supabase
      .from("auditoria_eventos")
      .select("*", { count: "exact", head: true })
      .eq("resultado", "ERRO"),
    supabase
      .from("auditoria_eventos")
      .select("usuario_id")
      .gte("ocorrido_em", inicio30dIso)
      .not("usuario_id", "is", null)
      .limit(5000),
  ]);

  const error = listResult.error;
  const records = (listResult.data ?? []) as AuditRecord[];
  const total = totalResult.count ?? listResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil((listResult.count ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);

  const usuariosAtivos = new Set(
    (ativosResult.data ?? []).map((r) => String((r as { usuario_id: string }).usuario_id)),
  ).size;

  const rows: AuditoriaRow[] = records.map((r) => ({
    id: r.id,
    dataHora: formatDateTimePtBr(r.ocorrido_em),
    usuario: r.usuario_nome || actorFallback(r),
    papel: formatLabel(r.usuario_papel || "SISTEMA"),
    acao: formatLabel(r.acao),
    modulo: formatLabel(r.modulo),
    origem: formatLabel(r.origem),
    entidadeTipo: formatLabel(r.entidade_tipo),
    entidadeId: r.entidade_id || "",
    depositante: getDepositanteName(r.depositante) || "Ambiente geral",
    resultado: r.resultado,
    ip: r.ip || "",
    dispositivo: r.user_agent || "",
    requestId: r.request_id || "",
    dadosAnteriores: r.dados_anteriores ?? null,
    dadosNovos: r.dados_novos ?? null,
    metadados: r.metadados ?? null,
  }));

  return (
    <AuditoriaView
      rows={rows}
      error={Boolean(error)}
      total={total}
      shownFrom={records.length ? from + 1 : 0}
      shownTo={from + records.length}
      page={currentPage}
      totalPages={totalPages}
      filters={{
        q: filters.q,
        usuario: filters.usuario,
        modulo: filters.modulo,
        depositante: filters.depositante,
      }}
      kpis={{
        total,
        hoje: hojeResult.count ?? 0,
        erro: erroResult.count ?? 0,
        usuariosAtivos,
      }}
      usuarios={(usuariosResult.data ?? []).map((u) => ({ id: String(u.id), nome: String(u.nome) }))}
      depositantes={(depositantesResult.data ?? []).map((d) => ({ id: String(d.id), nome: String(d.nome) }))}
      modulos={AUDIT_MODULES.map((m) => ({ value: m, label: formatLabel(m) }))}
    />
  );
}
