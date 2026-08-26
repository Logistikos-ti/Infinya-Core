import Link from "next/link";
import { ArrowLeft, Package, PencilLine } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { InsumoForm, CobrarInsumoForm } from "@/components/financeiro/insumo-forms";
import { requireModuleAccess } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type InsumosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    editar?: string;
  }>;
};

export default async function InsumosPage({ searchParams }: InsumosPageProps) {
  await requireModuleAccess("financeiro");

  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const editingId = params?.editar ?? null;

  const admin = createSupabaseAdminClient();

  const [insumosRes, depositantesRes] = await Promise.all([
    admin.from("insumos_catalogo").select("*").order("ordem").order("nome"),
    admin.from("depositantes").select("id, nome, ativo").eq("ativo", true).order("nome"),
  ]);

  const insumos = insumosRes.data ?? [];
  const depositantes = depositantesRes.data ?? [];

  const currentEditItem = editingId
    ? insumos.find((i) => i.id === editingId) ?? null
    : null;

  const editData = currentEditItem
    ? {
        id: currentEditItem.id as string,
        nome: currentEditItem.nome as string,
        unidade: currentEditItem.unidade as string,
        preco_unitario: Number(currentEditItem.preco_unitario),
        ordem: Number(currentEditItem.ordem),
        ativo: currentEditItem.ativo as boolean,
      }
    : null;

  const insumosAtivos = insumos
    .filter((i) => i.ativo)
    .map((i) => ({
      id: i.id as string,
      nome: i.nome as string,
      unidade: i.unidade as string,
      preco_unitario: Number(i.preco_unitario),
    }));

  return (
    <div className="space-y-6">
      <Link
        href="/financeiro"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao financeiro
      </Link>

      <ModulePageHeader
        title="Insumos"
        description="Catálogo de materiais e cobrança por depositante"
        badge="Insumos"
      />

      {feedback === "criado" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Insumo cadastrado com sucesso.
        </div>
      )}
      {feedback === "salvo" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Alterações salvas com sucesso.
        </div>
      )}
      {feedback === "cobrado" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Insumo cobrado com sucesso. Lançamento criado na fatura do mês.
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[0.85fr_1.45fr]">
        {/* Formulários à esquerda */}
        <div className="space-y-6">
          <div>
            <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-zinc-100">
              {editData ? "Editar insumo" : "Novo insumo"}
            </h2>
            <InsumoForm currentEditItem={editData} />
          </div>

          {!editData && insumosAtivos.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-800 dark:bg-emerald-900/10">
              <h2 className="mb-1 text-base font-semibold text-emerald-800 dark:text-emerald-300">
                Cobrar insumo
              </h2>
              <p className="mb-4 text-xs text-emerald-600 dark:text-emerald-400">
                Cria um lançamento de insumo na fatura do mês atual.
              </p>
              <CobrarInsumoForm depositantes={depositantes} insumos={insumosAtivos} />
            </div>
          )}
        </div>

        {/* Catálogo à direita */}
        <div>
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-zinc-100">
            Catálogo ({insumos.length})
          </h2>

          {insumos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center dark:border-zinc-700">
              <Package className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Nenhum insumo cadastrado ainda.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-3 py-3 font-medium">Unidade</th>
                    <th className="px-3 py-3 text-right font-medium">Preço</th>
                    <th className="px-3 py-3 text-center font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {insumos.map((insumo) => {
                    const isEditing = editingId === insumo.id;
                    return (
                      <tr
                        key={insumo.id}
                        className={`border-t border-slate-50 dark:border-zinc-800/50 ${
                          isEditing ? "bg-cyan-50/50 dark:bg-cyan-900/10" : ""
                        }`}
                      >
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-zinc-200">
                          {insumo.nome}
                        </td>
                        <td className="px-3 py-3 text-slate-500 dark:text-zinc-400">
                          {insumo.unidade}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-900 dark:text-zinc-100">
                          {formatCurrency(Number(insumo.preco_unitario))}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              insumo.ativo
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {insumo.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={isEditing ? "/financeiro/insumos" : `/financeiro/insumos?editar=${insumo.id}`}
                            className="inline-flex rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
