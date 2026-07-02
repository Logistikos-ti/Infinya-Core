import Link from "next/link";
import { ArrowLeft, PencilLine, Trash2, UserPlus } from "lucide-react";
import { ModulePageHeader } from "@/components/dashboard/module-page-header";
import { Button } from "@/components/ui/button";
import { requireRoleAccess } from "@/lib/auth";
import {
  APP_MODULES,
  CONFIG_SECTIONS,
  getConfigSectionLabel,
  getDefaultModulesForRole,
  getModuleLabel,
  getRoleLabel,
  type AppModule,
  type AppRole,
  type ConfigSection,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createUsuarioAction,
  deleteUsuarioAction,
  toggleUsuarioStatusAction,
  updateUsuarioAction,
} from "./actions";

type ConfiguracoesUsuariosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
    editar?: string;
    depositante?: string;
    papel?: string;
    page?: string;
    perPage?: string;
  }>;
};

type UsuarioListItem = {
  id: string;
  email: string;
  login: string | null;
  nome: string;
  papel: AppRole;
  ativo: boolean;
  created_at: string;
  ultimo_acesso_em: string | null;
  depositante_id: string | null;
  depositante: { nome?: string } | { nome?: string }[] | null;
  modulePermissions: AppModule[] | null;
  configSections: ConfigSection[] | null;
};

export default async function ConfiguracoesUsuariosPage({
  searchParams,
}: ConfiguracoesUsuariosPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;
  const editingId = params?.editar ?? null;
  const depositanteFilter = params?.depositante ?? "";
  const papelFilter = params?.papel ?? "";
  const page = normalizePositiveNumber(params?.page, 1);
  const perPage = normalizePerPage(params?.perPage);

  const currentUser = await requireRoleAccess(["ADMIN", "TI"]);
  const supabase = await createSupabaseServerClient();

  let usersQuery = supabase
    .from("usuarios")
    .select(
      "id, email, login, nome, papel, ativo, created_at, ultimo_acesso_em, depositante_id, depositante:depositantes(nome)",
    )
    .order("nome");

  if (depositanteFilter) {
    usersQuery = usersQuery.eq("depositante_id", depositanteFilter);
  }

  if (papelFilter) {
    usersQuery = usersQuery.eq("papel", papelFilter);
  }

  const [{ data: usuariosBase }, { data: depositantes }, authUsers] = await Promise.all([
    usersQuery,
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
    listAllAuthUsers(),
  ]);

  const authPermissionsById = new Map(
    authUsers.map((user) => [
      user.id,
      {
        modulePermissions: normalizeModulePermissions(user.user_metadata?.module_permissions),
        configSections: normalizeConfigSections(user.user_metadata?.config_sections),
      },
    ]),
  );

  const usuarios: UsuarioListItem[] = (usuariosBase ?? []).map((item) => ({
    ...item,
    papel: item.papel as AppRole,
    modulePermissions: authPermissionsById.get(item.id)?.modulePermissions ?? null,
    configSections: authPermissionsById.get(item.id)?.configSections ?? null,
  }));
  const totalUsers = usuarios.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedUsers = usuarios.slice(startIndex, startIndex + perPage);
  const visibleStart = totalUsers ? startIndex + 1 : 0;
  const visibleEnd = Math.min(startIndex + perPage, totalUsers);
  const baseQuery = {
    depositante: depositanteFilter,
    papel: papelFilter,
    perPage: String(perPage),
  };

  const currentEditUser = editingId ? usuarios.find((item) => item.id === editingId) ?? null : null;
  const currentEditModules = getEffectiveModulesForForm(
    currentEditUser?.papel,
    currentEditUser?.modulePermissions,
  );
  const currentEditConfigSections = getEffectiveConfigSectionsForForm(
    currentEditModules,
    currentEditUser?.configSections,
  );

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
        title="Usuários"
        description="Controle de acesso por papel, vínculo ao depositante e permissões finas por módulo."
        badge="Semana 2"
      />

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback === "criado" || feedback === "excluido" || feedback === "salvo"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          }`}
        >
          {feedback === "criado"
            ? "Usuário criado com sucesso."
            : feedback === "salvo"
              ? "Usuário atualizado com sucesso."
              : feedback === "excluido"
                ? "Usuário excluído com sucesso."
                : feedback === "autoprotecao"
                  ? "Seu próprio usuário não pode ser desativado nem excluído por esta tela."
                  : feedback === "login-duplicado"
                    ? "Esse usuário de login já existe. Escolha outro identificador."
                  : "Não foi possível concluir a operação solicitada."}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {currentEditUser ? "Editar usuário" : "Novo usuário"}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Defina papel, depositante, status operacional e os módulos liberados para cada
                usuário.
              </p>
            </div>
            <div className="rounded-full bg-sky-50 p-2 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              <UserPlus className="h-5 w-5" />
            </div>
          </div>

          <form
            action={currentEditUser ? updateUsuarioAction : createUsuarioAction}
            className="mt-5 space-y-4"
          >
            {currentEditUser ? <input type="hidden" name="id" value={currentEditUser.id} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Nome"
                name="nome"
                required
                defaultValue={currentEditUser?.nome ?? ""}
                placeholder="Nome completo"
              />
              <Field
                label="Usuário de login"
                name="login"
                type="text"
                required
                defaultValue={currentEditUser?.login ?? ""}
                placeholder="ex.: cadastro1"
              />
              <Field
                label={currentEditUser ? "Nova senha" : "Senha inicial"}
                name="senha"
                type="password"
                required={!currentEditUser}
                defaultValue=""
                placeholder={
                  currentEditUser
                    ? "Preencha apenas se quiser redefinir"
                    : "Mínimo de 8 caracteres"
                }
              />
              <SelectField
                label="Papel"
                name="papel"
                defaultValue={currentEditUser?.papel ?? "OPERADOR"}
                options={[
                  ["ADMIN", "Administrador"],
                  ["TI", "TI"],
                  ["OPERADOR", "Operador"],
                  ["DEPOSITANTE", "Depositante"],
                ]}
              />
            </div>

            <SelectField
              label="Depositante vinculado"
              name="depositanteId"
              defaultValue={currentEditUser?.depositante_id ?? ""}
              options={[
                ["", "Sem vínculo específico"],
                ...((depositantes ?? []).map((depositante) => [
                  depositante.id,
                  depositante.nome,
                ]) as [string, string][]),
              ]}
              helpText="Para perfis internos como TI e Administração, o vínculo pode ficar em branco. Para perfil Depositante, o vínculo deve existir."
            />

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Permissões por módulo
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Salve exatamente os módulos marcados para este usuário.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {APP_MODULES.map((module) => (
                  <label
                    key={module}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-zinc-800 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      name="modulos"
                      value={module}
                      defaultChecked={currentEditModules.includes(module)}
                      className="h-4 w-4 rounded"
                    />
                    {getModuleLabel(module)}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Acesso interno de Configurações
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Se o usuário tiver acesso ao módulo Configurações, você pode restringir só as
                áreas desejadas. Para o seu caso, marque apenas Produtos.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {CONFIG_SECTIONS.map((section) => (
                  <label
                    key={section}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-zinc-800 dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      name="configSections"
                      value={section}
                      defaultChecked={currentEditConfigSections.includes(section)}
                      className="h-4 w-4 rounded"
                    />
                    {getConfigSectionLabel(section)}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-zinc-800 dark:text-slate-300">
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={currentEditUser?.ativo ?? true}
                className="h-4 w-4 rounded"
              />
              Usuário ativo para login
            </label>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                className="bg-slate-950 text-white hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
              >
                {currentEditUser ? "Salvar alterações" : "Criar usuário"}
              </Button>
              {currentEditUser ? (
                <Link
                  href="/configuracoes/usuarios"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancelar edição
                </Link>
              ) : null}
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Usuários cadastrados
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Visão operacional por papel, depositante, status, último acesso e módulos ativos.
              </p>
            </div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {totalUsers} registros
            </span>
          </div>

          <form className="mt-5 flex flex-wrap gap-3">
            <select
              name="depositante"
              defaultValue={depositanteFilter}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="">Todos os depositantes</option>
              {(depositantes ?? []).map((depositante) => (
                <option key={depositante.id} value={depositante.id}>
                  {depositante.nome}
                </option>
              ))}
            </select>
            <select
              name="papel"
              defaultValue={papelFilter}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="">Todos os papéis</option>
              <option value="ADMIN">Administrador</option>
              <option value="TI">TI</option>
              <option value="OPERADOR">Operador</option>
              <option value="DEPOSITANTE">Depositante</option>
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filtrar
            </Button>
            <select
              name="perPage"
              defaultValue={String(perPage)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="10">10 / página</option>
              <option value="20">20 / página</option>
              <option value="50">50 / página</option>
            </select>
            {(depositanteFilter || papelFilter) && (
              <Link
                href="/configuracoes/usuarios"
                className="inline-flex h-9 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Limpar
              </Link>
            )}
          </form>

          <div className="mt-5 space-y-4">
            {paginatedUsers.length ? (
              <>
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-slate-300">
                  <span>
                    Exibindo {visibleStart}-{visibleEnd} de {totalUsers} usuário(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <PageLink
                      disabled={currentPage <= 1}
                      href={`/configuracoes/usuarios?${buildQueryString({
                        ...baseQuery,
                        page: String(currentPage - 1),
                      })}`}
                    >
                      Anterior
                    </PageLink>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Página {currentPage} de {totalPages}
                    </span>
                    <PageLink
                      disabled={currentPage >= totalPages}
                      href={`/configuracoes/usuarios?${buildQueryString({
                        ...baseQuery,
                        page: String(currentPage + 1),
                      })}`}
                    >
                      Próxima
                    </PageLink>
                  </div>
                </div>

                {paginatedUsers.map((item) => {
                  const isCurrentUser = currentUser.id === item.id;
                  const effectiveModules = getEffectiveModulesForForm(
                    item.papel,
                    item.modulePermissions,
                  );
                  const effectiveConfigSections = getEffectiveConfigSectionsForForm(
                    effectiveModules,
                    item.configSections,
                  );

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/20"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div>
                            <p className="text-base font-semibold text-slate-950 dark:text-white">
                              {item.nome}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Login: {item.login ?? "não definido"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge>{getRoleLabel(item.papel)}</Badge>
                            <Badge>{getDepositanteLabel(item.depositante)}</Badge>
                            <Badge>{item.ativo ? "Ativo" : "Inativo"}</Badge>
                            {isCurrentUser ? <Badge>Sessão atual</Badge> : null}
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Último acesso:{" "}
                            {item.ultimo_acesso_em
                              ? new Date(item.ultimo_acesso_em).toLocaleString("pt-BR")
                              : "Ainda não acessou"}
                          </p>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {effectiveModules.map((module) => (
                              <span
                                key={`${item.id}-${module}`}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
                              >
                                {getModuleLabel(module)}
                              </span>
                            ))}
                          </div>

                          {effectiveModules.includes("configuracoes") ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {effectiveConfigSections.map((section) => (
                                <span
                                  key={`${item.id}-config-${section}`}
                                  className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                                >
                                  Config: {getConfigSectionLabel(section)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-3 lg:text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            Criado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                          </p>
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Link
                              href={`/configuracoes/usuarios?editar=${item.id}`}
                              className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-slate-300 px-2.5 text-[0.8rem] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              <PencilLine className="h-4 w-4" />
                              Editar
                            </Link>
                            <form action={toggleUsuarioStatusAction}>
                              <input type="hidden" name="id" value={item.id} />
                              <input
                                type="hidden"
                                name="nextActive"
                                value={item.ativo ? "false" : "true"}
                              />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                disabled={isCurrentUser && item.ativo}
                              >
                                {item.ativo ? "Desativar" : "Ativar"}
                              </Button>
                            </form>
                            <form action={deleteUsuarioAction}>
                              <input type="hidden" name="id" value={item.id} />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                disabled={isCurrentUser}
                                className="border-rose-200 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
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
                })}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:text-slate-400">
                Nenhum usuário cadastrado com os filtros atuais.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  helpText,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: [string, string][];
  helpText?: string;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        {options.map(([value, labelOption]) => (
          <option key={value || "blank"} value={value}>
            {labelOption}
          </option>
        ))}
      </select>
      {helpText ? <p className="text-xs text-slate-500 dark:text-slate-400">{helpText}</p> : null}
    </label>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </span>
  );
}

function getEffectiveModulesForForm(
  papel: AppRole | undefined,
  currentPermissions: AppModule[] | null | undefined,
) {
  if (currentPermissions?.length) {
    return currentPermissions;
  }

  if (papel) {
    return getDefaultModulesForRole(papel);
  }

  return getDefaultModulesForRole("OPERADOR");
}

function getEffectiveConfigSectionsForForm(
  modules: AppModule[],
  currentSections: ConfigSection[] | null | undefined,
) {
  if (!modules.includes("configuracoes")) {
    return [] as ConfigSection[];
  }

  if (currentSections?.length) {
    return currentSections;
  }

  return [...CONFIG_SECTIONS];
}

function normalizeModulePermissions(value: unknown): AppModule[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const validModules = value.filter(
    (item): item is AppModule =>
      typeof item === "string" && APP_MODULES.includes(item as AppModule),
  );

  return validModules.length ? validModules : null;
}

function normalizeConfigSections(value: unknown): ConfigSection[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const validSections = value.filter(
    (item): item is ConfigSection =>
      typeof item === "string" && CONFIG_SECTIONS.includes(item as ConfigSection),
  );

  return validSections.length ? validSections : null;
}

function getDepositanteLabel(value: UsuarioListItem["depositante"]) {
  if (Array.isArray(value)) {
    return value[0]?.nome ?? "Sem depositante";
  }

  return value?.nome ?? "Sem depositante";
}

async function listAllAuthUsers() {
  const adminSupabase = createSupabaseAdminClient();
  const allUsers: Array<{
    id: string;
    user_metadata?: Record<string, unknown> | null;
  }> = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      break;
    }

    const batch = data.users.map((user) => ({
      id: user.id,
      user_metadata: user.user_metadata,
    }));

    allUsers.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return allUsers;
}

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePerPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return [10, 20, 50].includes(parsed) ? parsed : 10;
}

function buildQueryString(values: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-400 dark:border-zinc-800 dark:text-zinc-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
