import Link from "next/link";
import { ArrowLeft, PencilLine, Truck, Trash2 } from "lucide-react";
import { TransportadoraForm } from "@/components/configuracoes/transportadora-form";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireRoleAccess } from "@/lib/auth";
import {
  formatCnpj,
  formatTransportadoraModalidade,
  isTransportadorasSchemaMissing,
  TRANSPORTADORA_MODALIDADES,
  type TransportadoraListItem,
} from "@/lib/transportadoras";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteTransportadoraAction,
  toggleTransportadoraStatusAction,
} from "./actions";

type ConfiguracoesTransportadorasPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    editar?: string;
    status?: string;
  }>;
};

export default async function ConfiguracoesTransportadorasPage({
  searchParams,
}: ConfiguracoesTransportadorasPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const editingId = params?.editar ?? null;
  const statusFilter = params?.status?.trim() ?? "ativos";

  await requireRoleAccess(["ADMIN", "TI"]);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("transportadoras")
    .select("id, nome, razao_social, cnpj, email, telefone, modalidades, observacoes, ativo, created_at")
    .order("nome");

  if (statusFilter === "ativos") {
    query = query.eq("ativo", true);
  } else if (statusFilter === "inativos") {
    query = query.eq("ativo", false);
  }

  const { data, error } = await query;
  const schemaMissing = error ? isTransportadorasSchemaMissing(error) : false;
  const transportadoras: TransportadoraListItem[] = schemaMissing
    ? []
    : ((data ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id),
        nome: String(item.nome ?? ""),
        razaoSocial: String(item.razao_social ?? item.nome ?? ""),
        cnpj: String(item.cnpj ?? ""),
        email: typeof item.email === "string" ? item.email : null,
        telefone: typeof item.telefone === "string" ? item.telefone : null,
        modalidades: Array.isArray(item.modalidades)
          ? item.modalidades.filter(
              (value): value is (typeof TRANSPORTADORA_MODALIDADES)[number] =>
                typeof value === "string",
            )
          : [],
        observacoes: typeof item.observacoes === "string" ? item.observacoes : null,
        ativo: Boolean(item.ativo),
        createdAt: String(item.created_at ?? ""),
      }));

  const currentEditItem = editingId
    ? transportadoras.find((item) => item.id === editingId) ?? null
    : null;

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
        title="Transportadoras"
        description="Cadastro mestre de transportadoras com CNPJ, contato e modalidades operacionais usadas na expedição."
        badge="Cadastro mestre"
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
            ? "Transportadora criada com sucesso."
            : feedback === "salvo"
              ? "Transportadora atualizada com sucesso."
              : feedback === "excluido"
                ? "Transportadora excluída com sucesso."
                : feedback === "estrutura"
                  ? "A estrutura de transportadoras ainda não foi criada no banco."
                  : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      {schemaMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          A tela já está pronta, mas a tabela <code>public.transportadoras</code> ainda não existe
          no banco atual. Assim que ela for criada no Supabase, este cadastro passa a funcionar
          normalmente.
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {currentEditItem ? "Editar transportadora" : "Nova transportadora"}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Defina CNPJ, contato principal e modalidades de operação aceitas.
              </p>
            </div>
            <div className="rounded-full bg-sky-50 p-2 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              <Truck className="h-5 w-5" />
            </div>
          </div>

          <TransportadoraForm currentEditItem={currentEditItem} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Transportadoras cadastradas
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Base reutilizável para expedição, romaneio, integrações e regras logísticas.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {transportadoras.length} registros
            </span>
          </div>

          <form className="mt-5 flex flex-wrap gap-3">
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="ativos">Ativas</option>
              <option value="inativos">Inativas</option>
              <option value="todos">Todas</option>
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filtrar
            </Button>
            {statusFilter !== "ativos" ? (
              <Link
                href="/configuracoes/transportadoras"
                className="inline-flex h-9 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Limpar
              </Link>
            ) : null}
          </form>

          <div className="mt-5 space-y-4">
            {transportadoras.length ? (
              transportadoras.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950 dark:text-white">
                          {item.nome}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {item.razaoSocial}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatCnpj(item.cnpj)}
                        </p>
                      </div>

                      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                        <p>E-mail: {item.email || "-"}</p>
                        <p>Telefone: {item.telefone || "-"}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {item.modalidades.length ? (
                          item.modalidades.map((modalidade) => (
                            <Badge key={`${item.id}-${modalidade}`}>
                              {formatTransportadoraModalidade(modalidade)}
                            </Badge>
                          ))
                        ) : (
                          <Badge>Sem modalidades</Badge>
                        )}
                      </div>

                      {item.observacoes ? (
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {item.observacoes}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-3 lg:text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.ativo
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {item.ativo ? "Ativa" : "Inativa"}
                      </span>
                      <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Criada em{" "}
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : "-"}
                      </p>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/configuracoes/transportadoras?editar=${item.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-slate-300 px-2.5 text-[0.8rem] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          <PencilLine className="h-4 w-4" />
                          Editar
                        </Link>
                        <form action={toggleTransportadoraStatusAction}>
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
                        <form action={deleteTransportadoraAction}>
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
                {schemaMissing
                  ? "Cadastre a estrutura da tabela no Supabase para começar a usar esta área."
                  : "Nenhuma transportadora encontrada com os filtros atuais."}
              </div>
            )}
          </div>
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
