import Link from "next/link";
import { ArrowLeft, PencilLine, Plus, Trash2 } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireConfigSectionAccess } from "@/lib/auth";
import { parseDepositanteConfiguracoes } from "@/lib/depositantes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteDepositanteAction,
  toggleDepositanteStatusAction,
} from "@/app/(dashboard)/configuracoes/depositantes/actions";

type ConfiguracoesDepositantesPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function ConfiguracoesDepositantesPage({
  searchParams,
}: ConfiguracoesDepositantesPageProps) {
  await requireConfigSectionAccess("depositantes");
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const supabase = await createSupabaseServerClient();

  const { data: depositantes } = await supabase
    .from("depositantes")
    .select("id, codigo, nome, cnpj, ativo, logo_url, observacoes, configuracoes, created_at")
    .order("nome");

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
        title="Depositantes"
        description="Carteira ativa de clientes do WMS, com gestão de cadastro, status operacional e parâmetros por depositante."
        badge="Semana 2"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "criado" || feedback === "salvo" || feedback === "excluido"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          {feedback === "criado"
            ? "Depositante criado com sucesso."
            : feedback === "salvo"
              ? "Depositante atualizado com sucesso."
              : feedback === "excluido"
                ? "Depositante excluído com sucesso."
                : feedback === "vinculos"
                  ? "Não foi possível excluir este depositante porque já existem vínculos operacionais. Nesse caso, use desativar."
                  : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Depositantes cadastrados
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Base ativa para produtos, usuários vinculados e operação multi-tenant.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {depositantes?.length ?? 0} registros
            </span>
            <Link href="/configuracoes/depositantes/novo">
              <Button className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
                <Plus className="h-4 w-4" />
                Novo depositante
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {depositantes?.length ? (
            depositantes.map((item) => {
              const configuracoes = parseDepositanteConfiguracoes(
                item.configuracoes ? JSON.stringify(item.configuracoes) : item.observacoes,
              );
              const razaoSocial = configuracoes.razaoSocial || item.nome;
              const cidadeUf = [
                configuracoes.enderecoFiscal.cidade,
                configuracoes.enderecoFiscal.uf,
              ]
                .filter(Boolean)
                .join(" / ");
              const telefones = configuracoes.telefonesContato.slice(0, 2);
              const emails = configuracoes.emailsContato.slice(0, 2);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/20"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900">
                          {item.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.logo_url}
                              alt={`Logo ${item.nome}`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                              Sem logo
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-slate-950 dark:text-white">
                            {item.nome}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {razaoSocial}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {item.codigo} • {formatCnpj(item.cnpj)}
                          </p>
                        </div>
                      </div>

                      {cidadeUf ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Fiscal: {cidadeUf}
                        </p>
                      ) : null}

                      {telefones.length ? (
                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {telefones.map((contato) => (
                            <p key={`${contato.nome}-${contato.telefone}`}>
                              {contato.nome}: {contato.telefone}
                            </p>
                          ))}
                        </div>
                      ) : null}

                      {emails.length ? (
                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {emails.map((contato) => (
                            <p key={contato.email}>{contato.email}</p>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Badge>{configuracoes.metodoRetiradaPadrao}</Badge>
                        <Badge>{configuracoes.exigeLotePadrao ? "Com lote" : "Sem lote"}</Badge>
                        <Badge>
                          {configuracoes.exigeValidadePadrao ? "Com validade" : "Sem validade"}
                        </Badge>
                        <Badge>
                          {configuracoes.permiteFracionamento
                            ? "Fracionamento ativo"
                            : "Sem fracionamento"}
                        </Badge>
                        <Badge>
                          Validade mínima: {configuracoes.diasMinimosValidade} dias
                        </Badge>
                        {configuracoes.prefixoRecebimento ? (
                          <Badge>Prefixo: {configuracoes.prefixoRecebimento}</Badge>
                        ) : null}
                      </div>

                      {configuracoes.observacoes ? (
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {configuracoes.observacoes}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-3 lg:text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.ativo
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Criado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/configuracoes/depositantes/${item.id}/editar`}
                          className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-slate-300 px-2.5 text-[0.8rem] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <PencilLine className="h-4 w-4" />
                          Editar
                        </Link>
                        <form action={toggleDepositanteStatusAction}>
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
                        <form action={deleteDepositanteAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400">
              Nenhum depositante cadastrado ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </span>
  );
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 14) {
    return value;
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
