import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, PencilLine, Plus, Trash2 } from "lucide-react";
import { AddressBulkGeneratorForm } from "@/components/configuracoes/address-bulk-generator-form";
import { AddressFiltersForm } from "@/components/configuracoes/address-filters-form";
import { AddressImportPanel } from "@/components/configuracoes/address-import-panel";
import { EnderecoForm } from "@/components/configuracoes/endereco-form";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireConfigSectionAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteEnderecoAction,
  generateEnderecosAction,
  saveEnderecoAction,
  toggleEnderecoStatusAction,
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

  const areaOptions = [
    { value: "", label: "Todas as áreas" },
    { value: "RECEBIMENTO", label: "Recebimento" },
    { value: "PULMAO", label: "Pulmão" },
    { value: "PICKING", label: "Picking" },
    { value: "BLOQUEADO", label: "Bloqueado" },
    { value: "EXPEDICAO", label: "Expedição" },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para configurações
      </Link>

      <ModulePageHeader
        title="Endereços"
        description="Mapa físico do armazém com áreas, corredores, módulos, níveis e posições operacionais."
        badge="Semana 2"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "criado" || feedback === "salvo" || feedback === "excluido"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {currentAddress ? "Editar endereço" : "Novo endereço"}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Cadastre áreas como recebimento, pulmão, picking, bloqueado e expedição com sua
                posição física.
              </p>
            </div>
            <div className="rounded-full bg-sky-50 p-2 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              <Plus className="h-5 w-5" />
            </div>
          </div>

          <EnderecoForm
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

          {currentAddress ? (
            <div className="mt-3">
              <Link
                href="/configuracoes/enderecos"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Cancelar edição
              </Link>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Endereços cadastrados
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Estrutura física usada em recebimento, armazenagem, picking e expedição.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                {enderecos?.length ?? 0} registros
              </span>
            </div>
          </div>

          <AddressFiltersForm area={areaFilter} areas={areaOptions} />

          <div className="mt-5 space-y-4">
            {enderecos?.length ? (
              enderecos.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div>
                        <p className="text-base font-semibold text-slate-950 dark:text-white">
                          {item.codigo}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {getAreaLabel(item.area)}
                          {item.descricao ? ` • ${item.descricao}` : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge>{item.rua || "Sem corredor"}</Badge>
                        <Badge>{item.modulo || "Sem módulo"}</Badge>
                        <Badge>{item.nivel || "Sem nível"}</Badge>
                        <Badge>{item.posicao || "Sem posição"}</Badge>
                        {item.unidade_padrao ? <Badge>{getUnidadeLabel(item.unidade_padrao)}</Badge> : null}
                        {item.capacidade_maxima !== null ? (
                          <Badge>Capacidade: {formatCapacity(item.capacidade_maxima)}</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3 lg:text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.ativo
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Criado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/configuracoes/enderecos?editar=${item.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-slate-300 px-2.5 text-[0.8rem] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          <PencilLine className="h-4 w-4" />
                          Editar
                        </Link>
                        <form action={toggleEnderecoStatusAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="nextActive"
                            value={item.ativo ? "false" : "true"}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {item.ativo ? "Desativar" : "Ativar"}
                          </Button>
                        </form>
                        <form action={deleteEnderecoAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Nenhum endereço cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </section>

      <AddressImportPanel />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Gerar endereços em massa
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Monte corredores, módulos, níveis e posições em lote para acelerar o setup do armazém.
          </p>
        </div>

        <AddressBulkGeneratorForm action={generateEnderecosAction} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Mapa 2D operacional
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Leitura visual inicial do galpão por corredor e módulo, usando os endereços já
            cadastrados no WMS.
          </p>
        </div>

        <div className="mt-5">
          <WarehouseMap2D addresses={enderecos ?? []} />
        </div>
      </section>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}

function getAreaLabel(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Pulmão";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return value;
  }
}

function getUnidadeLabel(value: string) {
  switch (value) {
    case "UNIDADE":
      return "Unidade";
    case "CAIXA":
      return "Caixa";
    case "PALLET":
      return "Pallet";
    default:
      return value;
  }
}

function formatCapacity(value: number | string) {
  return Number(value).toLocaleString("pt-BR");
}

function WarehouseMap2D({
  addresses,
}: {
  addresses: Array<{
    id: string;
    codigo: string;
    area: string;
    rua: string | null;
    modulo: string | null;
    nivel: string | null;
    posicao: string | null;
    ativo: boolean;
  }>;
}) {
  const normalized = addresses
    .filter((item) => item.rua && item.modulo && item.nivel && item.posicao)
    .map((item) => ({
      ...item,
      rua: item.rua || "SEM-RUA",
      modulo: item.modulo || "SEM-MODULO",
      nivel: item.nivel || "SEM-NIVEL",
      posicao: item.posicao || "SEM-POSICAO",
    }));

  const ruas = [...new Set(normalized.map((item) => item.rua))].sort(naturalCodeSort);

  if (!ruas.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Cadastre endereços com corredor, módulo, nível e posição para visualizar o mapa.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ruas.map((rua) => {
        const ruaItems = normalized.filter((item) => item.rua === rua);
        const modulos = [...new Set(ruaItems.map((item) => item.modulo))].sort(naturalCodeSort);

        return (
          <div
            key={rua}
            className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-slate-950 dark:text-white">{rua}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {ruaItems.length} endereços mapeados nesta rua
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {modulos.map((modulo) => {
                const moduloItems = ruaItems.filter((item) => item.modulo === modulo);
                const niveis = [...new Set(moduloItems.map((item) => item.nivel))].sort(
                  naturalCodeSort,
                );
                const posicoes = [...new Set(moduloItems.map((item) => item.posicao))].sort(
                  naturalCodeSort,
                );

                return (
                  <div
                    key={`${rua}-${modulo}`}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">
                          {modulo}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {moduloItems.length} posições
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `88px repeat(${posicoes.length}, minmax(84px, 1fr))`,
                        }}
                      >
                        <div />
                        {posicoes.map((posicao) => (
                          <div
                            key={`${modulo}-${posicao}-head`}
                            className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {posicao}
                          </div>
                        ))}

                        {niveis.map((nivel) => (
                          <Fragment key={`${modulo}-${nivel}`}>
                            <div className="rounded-lg bg-slate-100 px-2 py-2 text-center text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {nivel}
                            </div>
                            {posicoes.map((posicao) => {
                              const slot = moduloItems.find(
                                (item) => item.nivel === nivel && item.posicao === posicao,
                              );

                              return (
                                <div
                                  key={`${modulo}-${nivel}-${posicao}`}
                                  className={`min-h-[76px] rounded-xl border px-2 py-2 text-xs ${
                                    slot
                                      ? slot.ativo
                                        ? getAreaMapClass(slot.area)
                                        : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                                      : "border-dashed border-slate-200 bg-white text-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-600"
                                  }`}
                                  title={slot?.codigo ?? "Sem endereço cadastrado"}
                                >
                                  {slot ? (
                                    <div className="flex h-full flex-col justify-between gap-2">
                                      <span className="font-semibold">{slot.codigo}</span>
                                      <span>{getAreaShortLabel(slot.area)}</span>
                                    </div>
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      vazio
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function naturalCodeSort(left: string, right: string) {
  return left.localeCompare(right, "pt-BR", { numeric: true, sensitivity: "base" });
}

function getAreaMapClass(area: string) {
  switch (area) {
    case "RECEBIMENTO":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200";
    case "PULMAO":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-200";
    case "PICKING":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "BLOQUEADO":
      return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200";
    case "EXPEDICAO":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
  }
}

function getAreaShortLabel(area: string) {
  switch (area) {
    case "RECEBIMENTO":
      return "REC";
    case "PULMAO":
      return "PUL";
    case "PICKING":
      return "PICK";
    case "BLOQUEADO":
      return "BLQ";
    case "EXPEDICAO":
      return "EXP";
    default:
      return area;
  }
}
