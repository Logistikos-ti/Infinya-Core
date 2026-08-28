import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRoleAccess } from "@/lib/auth";
import {
  APP_MODULES,
  CONFIG_SECTIONS,
  getRoleLabel,
  type AppModule,
  type AppRole,
  type ConfigSection,
} from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { UsuarioRowActions } from "@/components/configuracoes/usuario-row-actions";
import { NovoUsuarioTrigger } from "@/components/configuracoes/novo-usuario-trigger";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";

const manropeStyle: React.CSSProperties = {
  fontFamily: "var(--font-manrope), Manrope, sans-serif",
};

const roleAccent: Record<AppRole, string> = {
  ADMIN: "#EF4444",
  TI: "#8B5CF6",
  OPERADOR: "#10B981",
  DEPOSITANTE: "#3B82F6",
};

const avatarPalette: Array<[string, string]> = [
  ["#3B82F6", "rgba(59,130,246,0.6)"],
  ["#8B5CF6", "rgba(139,92,246,0.6)"],
  ["#EC4899", "rgba(236,72,153,0.6)"],
  ["#10B981", "rgba(16,185,129,0.6)"],
  ["#F59E0B", "rgba(245,158,11,0.6)"],
  ["#06B6D4", "rgba(6,182,212,0.6)"],
  ["#A855F7", "rgba(168,85,247,0.6)"],
];

type ConfiguracoesUsuariosPageProps = {
  searchParams?: Promise<{
    feedback?: string;
  }>;
};

export default async function ConfiguracoesUsuariosPage({
  searchParams,
}: ConfiguracoesUsuariosPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const feedback = params?.feedback ?? null;

  const currentUser = await requireRoleAccess(["ADMIN", "TI"]);
  const supabase = await createSupabaseServerClient();

  const [{ data: usuariosBase }, { data: depositantesList }, authUsers] = await Promise.all([
    supabase
      .from("usuarios")
      .select(
        "id, email, login, nome, papel, ativo, ultimo_acesso_em, depositante_id, depositante:depositantes(nome)",
      )
      .order("nome"),
    supabase.from("depositantes").select("id, nome").eq("ativo", true).order("nome"),
    listAllAuthUsers(),
  ]);

  const authPermissionsById = new Map(
    authUsers.map((user) => [
      user.id,
      {
        modulePermissions: normalizeModulePermissions(user.user_metadata?.module_permissions),
        configSections: normalizeConfigSections(user.user_metadata?.config_sections),
        portalProfile:
          user.user_metadata?.portal_profile === "COLABORADOR"
            ? ("COLABORADOR" as const)
            : ("GESTOR" as const),
        contactEmail:
          typeof user.user_metadata?.contact_email === "string"
            ? (user.user_metadata.contact_email as string)
            : null,
      },
    ]),
  );

  const depositanteOptions = (depositantesList ?? []).map((d) => ({
    id: d.id as string,
    nome: d.nome as string,
  }));

  const rows = (usuariosBase ?? []).map((item, index) => {
    const [color, colorFaded] = avatarPalette[index % avatarPalette.length];
    const permissions = authPermissionsById.get(item.id as string);
    const depositanteLabel = getDepositanteLabel(item.depositante) ?? "Todos os depositantes";

    return {
      id: item.id as string,
      nome: item.nome as string,
      login: (item.login as string | null) ?? "",
      papel: item.papel as AppRole,
      ativo: item.ativo as boolean,
      ultimoAcesso: item.ultimo_acesso_em as string | null,
      depositanteId: (item.depositante_id as string | null) ?? null,
      depositanteLabel,
      initials: getInitials(item.nome as string),
      avatarBg: `linear-gradient(135deg, ${color}, ${colorFaded})`,
      modulePermissions: permissions?.modulePermissions ?? null,
      configSections: permissions?.configSections ?? null,
      portalProfile: permissions?.portalProfile ?? "GESTOR",
      contactEmail: permissions?.contactEmail ?? "",
    };
  });

  return (
    <div className="flex h-full flex-col" style={manropeStyle}>
      <header className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b px-4 sm:px-8 ${tokenBorder}`}>
        <Link
          href="/configuracoes"
          title="Voltar para Configurações"
          className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
        >
          <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] ${tokenText}`} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <h1 className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>
            Usuários &amp; permissões
          </h1>
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <Link href="/configuracoes" className="hover:underline">
              Configurações
            </Link>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>Usuários</span>
          </div>
        </div>
        <NotificationBell />
        <ThemeToggle />
      </header>

      <div className="flex-1 space-y-[22px] overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`text-sm ${tokenTextSub}`}>Equipe com acesso ao WMS e seus perfis.</p>
          <NovoUsuarioTrigger depositantes={depositanteOptions} />
        </div>

        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback === "criado" || feedback === "excluido" || feedback === "salvo"
                ? "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] text-[#10B981]"
                : "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] text-[#F59E0B]"
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
                      ? "Esse ID de usuário já existe. Escolha outro identificador."
                      : "Não foi possível concluir a operação solicitada."}
          </div>
        ) : null}

        <div className={`overflow-x-auto rounded-2xl border ${tokenBorder} ${tokenCardBg}`}>
          <div style={{ minWidth: "1000px" }}>
            <div
              className={`flex items-center border-b ${tokenBorder} ${tokenInputBg}`}
              style={{ gap: "16px", padding: "12px 22px" }}
            >
              <HeaderCell flex={2.2} label="Usuário" />
              <HeaderCell flex={1.1} label="Papel" />
              <HeaderCell flex={1} label="ID" />
              <HeaderCell flex={1.6} label="Depositante" />
              <HeaderCell flex={1.2} label="Último acesso" />
              <HeaderCell flex={2.2} label="Status / Ações" align="right" />
            </div>

            {rows.length ? (
              rows.map((row) => {
                const accent = roleAccent[row.papel] ?? "#8B5CF6";
                return (
                  <div
                    key={row.id}
                    className={`flex items-center border-b last:border-b-0 ${tokenBorder}`}
                    style={{ gap: "16px", padding: "15px 22px" }}
                  >
                    <div
                      className="flex items-center"
                      style={{ flex: "2.2 1 0%", gap: "13px", minWidth: "220px" }}
                    >
                      <span
                        style={{
                          width: "40px",
                          height: "40px",
                          flexShrink: 0,
                          borderRadius: "11px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "13.5px",
                          color: "#FFFFFF",
                          background: row.avatarBg,
                          fontFamily: "var(--font-space-grotesk), sans-serif",
                        }}
                      >
                        {row.initials}
                      </span>
                      <div className="flex flex-col" style={{ minWidth: 0, gap: "2px" }}>
                        <span
                          className={tokenText}
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {row.nome}
                        </span>
                        {row.contactEmail ? (
                          <span
                            className={tokenTextSub}
                            style={{
                              fontSize: "12px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {row.contactEmail}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center" style={{ flex: "1.1 1 0%" }}>
                      <span
                        className="inline-flex items-center"
                        style={{
                          padding: "4px 11px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background: hexAlpha(accent, 0.14),
                          color: accent,
                        }}
                      >
                        {getRoleLabel(row.papel)}
                      </span>
                    </div>
                    <span
                      className={tokenTextSub}
                      style={{
                        flex: "1 1 0%",
                        fontSize: "13px",
                        fontWeight: 600,
                        fontFamily: "var(--font-space-grotesk), sans-serif",
                      }}
                    >
                      {row.login || "—"}
                    </span>
                    <span
                      className={tokenText}
                      style={{
                        flex: "1.6 1 0%",
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {row.depositanteLabel}
                    </span>
                    <span
                      className={tokenTextSub}
                      style={{ flex: "1.2 1 0%", fontSize: "12.5px" }}
                    >
                      {formatUltimoAcesso(row.ultimoAcesso)}
                    </span>
                    <div className="flex items-center justify-end" style={{ flex: "2.2 1 0%" }}>
                      <UsuarioRowActions
                        id={row.id}
                        nome={row.nome}
                        ativo={row.ativo}
                        isCurrentUser={currentUser.id === row.id}
                        editDefaults={{
                          id: row.id,
                          nome: row.nome,
                          login: row.login,
                          email: row.contactEmail,
                          papel: row.papel,
                          depositanteId: row.depositanteId,
                          ativo: row.ativo,
                          modulePermissions: row.modulePermissions,
                          configSections: row.configSections,
                          portalProfile: row.portalProfile,
                        }}
                        depositantes={depositanteOptions}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={`px-[22px] py-10 text-center text-sm ${tokenTextSub}`}>
                Nenhum usuário cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  flex,
  label,
  align,
}: {
  flex: number;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <span
      style={{
        flex: `${flex} 1 0%`,
        fontSize: "11.5px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#64748B",
        textAlign: align ?? "left",
      }}
    >
      {label}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getDepositanteLabel(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] as { nome?: string } | undefined)?.nome ?? null;
  }
  return (value as { nome?: string }).nome ?? null;
}

function formatUltimoAcesso(value: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 5) return "Agora há pouco";
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffH < 24) return `Há ${diffH} h`;
  if (diffD < 7) return `Há ${diffD} dias`;
  return date.toLocaleDateString("pt-BR");
}

function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function normalizeModulePermissions(value: unknown): AppModule[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.filter(
    (item): item is AppModule =>
      typeof item === "string" && APP_MODULES.includes(item as AppModule),
  );
  return valid.length ? valid : null;
}

function normalizeConfigSections(value: unknown): ConfigSection[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.filter(
    (item): item is ConfigSection =>
      typeof item === "string" && CONFIG_SECTIONS.includes(item as ConfigSection),
  );
  return valid.length ? valid : null;
}

async function listAllAuthUsers() {
  const adminSupabase = createSupabaseAdminClient();
  const allUsers: Array<{ id: string; user_metadata?: Record<string, unknown> | null }> = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const batch = data.users.map((user) => ({
      id: user.id,
      user_metadata: user.user_metadata,
    }));
    allUsers.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return allUsers;
}
