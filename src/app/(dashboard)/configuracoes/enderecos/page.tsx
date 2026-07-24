import Link from "next/link";
import { AddressBulkGeneratorForm } from "@/components/configuracoes/address-bulk-generator-form";
import { AddressImportPanel } from "@/components/configuracoes/address-import-panel";
import { EnderecoForm } from "@/components/configuracoes/endereco-form";
import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EnderecosDashboard } from "@/components/configuracoes/enderecos-dashboard";
import {
  generateEnderecosAction,
  saveEnderecoAction,
} from "@/app/(dashboard)/configuracoes/enderecos/actions";

type ConfiguracoesEnderecosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    editar?: string;
    area?: string;
    total?: string;
  }>;
};

export default async function ConfiguracoesEnderecosPage({
  searchParams,
}: ConfiguracoesEnderecosPageProps) {
  await requireConfigSectionAccess("enderecos");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const editingId = params?.editar ?? null;
  const areaFilter = params?.area ?? "";
  const totalGenerated = Number(params?.total ?? 0) || 0;
  const supabase = await createSupabaseServerClient();

  let enderecosQuery = supabase
    .from("enderecos")
    .select(
      "id, codigo, descricao, area, rua, modulo, nivel, posicao, capacidade_maxima, unidade_padrao, ativo, created_at",
    )
    .order("codigo");

  if (areaFilter) {
    enderecosQuery = enderecosQuery.eq("area", areaFilter);
  }

  const { data: enderecos } = await enderecosQuery;
  const currentAddress = editingId
    ? (enderecos ?? []).find((item) => item.id === editingId) ?? null
    : null;

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
            feedback === "criado" || feedback === "salvo" || feedback === "excluido"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200"
          }`}
        >
          {feedback === "criado"
            ? "Endereço criado com sucesso."
            : feedback === "salvo"
              ? "Endereço atualizado com sucesso."
              : feedback === "excluido"
                ? "Endereço excluído com sucesso."
                : feedback === "gerado"
                  ? `${totalGenerated} endereços gerados ou atualizados com sucesso.`
                  : feedback === "vinculos"
                    ? "Não foi possível excluir este endereço porque ele já possui estoque vinculado. Nesse caso, use desativar."
                    : feedback === "erro-geracao"
                      ? "Não foi possível gerar os endereços em massa. Revise os intervalos e tente novamente."
                      : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      <EnderecosDashboard
        enderecos={enderecos ?? []}
        initialShowForm={Boolean(currentAddress)}
        formSlot={
          <div className="space-y-4">
            <EnderecoForm
              key={currentAddress?.id ?? "novo-endereco"}
              action={saveEnderecoAction}
              defaultValues={{
                id: currentAddress?.id,
                codigo: currentAddress?.codigo ?? "",
                descricao: currentAddress?.descricao ?? "",
                area: currentAddress?.area ?? "PICKING",
                unidadePadrao: currentAddress?.unidade_padrao ?? "",
                rua: currentAddress?.rua ?? "",
                modulo: currentAddress?.modulo ?? "",
                nivel: currentAddress?.nivel ?? "",
                posicao: currentAddress?.posicao ?? "",
                capacidadeMaxima: currentAddress?.capacidade_maxima?.toString() ?? "",
                ativo: currentAddress?.ativo ?? true,
              }}
            />
            {currentAddress && (
              <div className="flex justify-end">
                <Link
                  href="/configuracoes/enderecos"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Cancelar edição
                </Link>
              </div>
            )}
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-2 mt-8">
          <AddressImportPanel />
          <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-white/10 dark:bg-slate-900/40">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Gerar endereços em massa
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Monte corredores, módulos, níveis e posições em lote para acelerar o setup do armazém.
              </p>
            </div>
            <div className="mt-4">
              <AddressBulkGeneratorForm action={generateEnderecosAction} />
            </div>
          </section>
        </div>
      </EnderecosDashboard>
    </div>
  );
}

