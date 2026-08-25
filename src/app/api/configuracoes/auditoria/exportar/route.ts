import { NextRequest, NextResponse } from "next/server";
import { safeRecordAuditEvent } from "@/lib/audit";
import { requireApiRoleAccess } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimePtBr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiRoleAccess(["ADMIN", "TI"]);
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("auditoria_eventos")
    .select("ocorrido_em, usuario_nome, usuario_papel, modulo, acao, entidade_tipo, entidade_id, resultado, origem, ip, depositante:depositantes(nome)")
    .order("ocorrido_em", { ascending: false })
    .limit(10000);

  const modulo = clean(params.get("modulo"), 80);
  const acao = clean(params.get("acao"), 80);
  const resultado = clean(params.get("resultado"), 20);
  const depositante = clean(params.get("depositante"), 50);
  const de = clean(params.get("de"), 10);
  const ate = clean(params.get("ate"), 10);
  const q = clean(params.get("q"), 100).replace(/[%_,()]/g, " ").trim();

  if (modulo) query = query.eq("modulo", modulo);
  if (acao) query = query.eq("acao", acao);
  if (resultado) query = query.eq("resultado", resultado);
  if (depositante) query = query.eq("depositante_id", depositante);
  if (de) query = query.gte("ocorrido_em", `${de}T00:00:00-03:00`);
  if (ate) query = query.lte("ocorrido_em", `${ate}T23:59:59.999-03:00`);
  if (q) query = query.or(`usuario_nome.ilike.%${q}%,acao.ilike.%${q}%,entidade_tipo.ilike.%${q}%,entidade_id.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Não foi possível exportar a auditoria." }, { status: 500 });

  await safeRecordAuditEvent({
    actor: auth.user,
    modulo: "AUDITORIA",
    acao: "EXPORTAR",
    entidadeTipo: "auditoria_eventos",
    origem: "APLICACAO",
    metadados: { quantidade: data?.length ?? 0, filtros: Object.fromEntries(params.entries()) },
  });

  const header = ["Data e hora", "Usuário", "Papel", "Módulo", "Ação", "Entidade", "Identificador", "Depositante", "Resultado", "Origem", "IP"];
  const body = (data ?? []).map((row) => [
    formatDateTimePtBr(row.ocorrido_em), row.usuario_nome, row.usuario_papel, row.modulo, row.acao,
    row.entidade_tipo, row.entidade_id, getDepositanteName(row.depositante), row.resultado, row.origem, row.ip,
  ]);
  const csv = `\uFEFF${[header, ...body].map((line) => line.map(csvCell).join(";")).join("\r\n")}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-wms-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function clean(value: string | null, limit: number) { return (value ?? "").trim().slice(0, limit); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function getDepositanteName(value: unknown) {
  if (Array.isArray(value)) return String((value[0] as { nome?: unknown } | undefined)?.nome ?? "");
  return String((value as { nome?: unknown } | null)?.nome ?? "");
}
