import Link from "next/link";
import { ArrowLeft, FileText, PencilLine } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { ContratoForm } from "@/components/financeiro/contrato-form";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

type ContratosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    editar?: string;
  }>;
};

export default async function ContratosPage({ searchParams }: ContratosPageProps) {
  await requireModuleAccess("financeiro");

  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const editingId = params?.editar ?? null;

  const admin = createSupabaseAdminClient();

  const [contratosRes, depositantesRes] = await Promise.all([
    admin
      .from("contratos_cobranca")
      .select("*, depositantes(id, nome, cnpj)")
      .order("created_at", { ascending: false }),
    admin
      .from("depositantes")
      .select("id, nome, ativo")
      .eq("ativo", true)
      .order("nome"),
  ]);

  const contratos = contratosRes.data ?? [];
  const depositantes = depositantesRes.data ?? [];
  const depositantesComContrato = new Set(contratos.map((c) => c.depositante_id));
  const depositantesSemContrato = depositantes.filter((d) => !depositantesComContrato.has(d.id));

  const currentEditItem = editingId
    ? contratos.find((c) => c.id === editingId) ?? null
    : null;

  const editData = currentEditItem
    ? {
        id: currentEditItem.id,
        depositante_id: currentEditItem.depositante_id,
        taxa_fulfillment: Number(currentEditItem.taxa_fulfillment),
        minimo_fulfillment: Number(currentEditItem.minimo_fulfillment),
        tarifa_posicao: Number(currentEditItem.tarifa_posicao),
        valor_ponto_coleta: Number(currentEditItem.valor_ponto_coleta),
        valor_impressao_nf: Number(currentEditItem.valor_impressao_nf),
        taxa_frete_fixa: Number(currentEditItem.taxa_frete_fixa),
        taxa_frete_percentual: Number(currentEditItem.taxa_frete_percentual),
        tarifa_recebimento: Number(currentEditItem.tarifa_recebimento),
        valor_logistica_reversa: Number(currentEditItem.valor_logistica_reversa),
        valor_software: Number(currentEditItem.valor_software),
        qtd_refrigeradores: Number(currentEditItem.qtd_refrigeradores),
        valor_unitario_refrigerador: Number(currentEditItem.valor_unitario_refrigerador),
        tipo_contrato: currentEditItem.tipo_contrato as string,
        vigencia_inicio: currentEditItem.vigencia_inicio as string | null,
        vigencia_fim: currentEditItem.vigencia_fim as string | null,
        observacoes: currentEditItem.observacoes as string | null,
        ativo: currentEditItem.ativo as boolean,
      }
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/financeiro"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao financeiro
      </Link>

      <ModulePageHeader
        title="Contratos de Cobrança"
        description="Gerencie as regras de cobrança por depositante"
        badge="Contratos"
      />

      {feedback === "criado" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Contrato criado com sucesso.
        </div>
      )}
      {feedback === "salvo" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Alterações salvas com sucesso.
        </div>
      )}

      {depositantesSemContrato.length > 0 && !editingId && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            {depositantesSemContrato.length} depositante(s) sem contrato:
          </p>
          <div className="flex flex-wrap gap-2">
            {depositantesSemContrato.map((d) => (
              <span
                key={d.id}
                className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-800/40 dark:text-amber-300"
              >
                {d.nome}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.35fr]">
        {/* Formulário */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
            {editData ? "Editar contrato" : "Novo contrato"}
          </h2>
          <ContratoForm
            depositantes={
              editData
                ? depositantes
                : depositantesSemContrato.length > 0
                  ? depositantesSemContrato
                  : depositantes
            }
            currentEditItem={editData}
          />
        </div>

        {/* Lista */}
        <div>
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-zinc-100">
            Contratos cadastrados ({contratos.length})
          </h2>

          {contratos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center dark:border-zinc-700">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Nenhum contrato cadastrado ainda.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {contratos.map((contrato) => {
                const dep = contrato.depositantes as { nome?: string; cnpj?: string } | null;
                const isEditing = editingId === contrato.id;
                return (
                  <div
                    key={contrato.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-zinc-900/70 ${
                      isEditing
                        ? "border-cyan-400 ring-2 ring-cyan-400/20 dark:border-cyan-500"
                        : "border-slate-200 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                          {dep?.nome ?? "—"}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          <span className={contrato.ativo ? "text-emerald-600" : "text-red-500"}>
                            {contrato.ativo ? "Ativo" : "Inativo"}
                          </span>
                          {contrato.tipo_contrato === "consignado" && (
                            <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                              Consignado
                            </span>
                          )}
                        </p>
                      </div>
                      <Link
                        href={isEditing ? "/financeiro/contratos" : `/financeiro/contratos?editar=${contrato.id}`}
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        <PencilLine className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3 lg:grid-cols-4">
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">Fulfillment</span>
                        <p className="font-medium text-slate-700 dark:text-zinc-300">
                          {formatPercent(Number(contrato.taxa_fulfillment))} (mín{" "}
                          {formatCurrency(Number(contrato.minimo_fulfillment))})
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">Posição</span>
                        <p className="font-medium text-slate-700 dark:text-zinc-300">
                          {formatCurrency(Number(contrato.tarifa_posicao))}/mês
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">Ponto Coleta</span>
                        <p className="font-medium text-slate-700 dark:text-zinc-300">
                          {formatCurrency(Number(contrato.valor_ponto_coleta))}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">Impressão NF</span>
                        <p className="font-medium text-slate-700 dark:text-zinc-300">
                          {formatCurrency(Number(contrato.valor_impressao_nf))}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">Frete</span>
                        <p className="font-medium text-slate-700 dark:text-zinc-300">
                          {formatCurrency(Number(contrato.taxa_frete_fixa))} +{" "}
                          {formatPercent(Number(contrato.taxa_frete_percentual))}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">Recebimento</span>
                        <p className="font-medium text-slate-700 dark:text-zinc-300">
                          {formatCurrency(Number(contrato.tarifa_recebimento))}/un
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 dark:text-zinc-500">Software</span>
                        <p className="font-medium text-slate-700 dark:text-zinc-300">
                          {formatCurrency(Number(contrato.valor_software))}/mês
                        </p>
                      </div>
                      {Number(contrato.qtd_refrigeradores) > 0 && (
                        <div>
                          <span className="text-slate-400 dark:text-zinc-500">Refrigeração</span>
                          <p className="font-medium text-slate-700 dark:text-zinc-300">
                            {contrato.qtd_refrigeradores}×{" "}
                            {formatCurrency(Number(contrato.valor_unitario_refrigerador))}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
