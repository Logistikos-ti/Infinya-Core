"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { saveUsuarioAction } from "@/app/(dashboard)/configuracoes/usuarios/actions";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";
import { ChevronDown } from "lucide-react";
import {
  APP_MODULES,
  CONFIG_SECTIONS,
  getConfigSectionLabel,
  getModuleLabel,
  type AppModule,
  type AppRole,
  type ConfigSection,
} from "@/lib/permissions";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-space-grotesk)]";
const cardClass = `rounded-2xl border ${tokenBorder} ${tokenCardBg} p-6`;
const inputClass = `h-[46px] w-full rounded-[11px] border px-[15px] text-sm outline-none transition ${tokenBorder} ${tokenInputBg} ${tokenText}`;

const roleAccent: Record<AppRole, string> = {
  ADMIN: "#EF4444",
  TI: "#8B5CF6",
  OPERADOR: "#10B981",
  DEPOSITANTE: "#3B82F6",
};

const roleOptions: Array<{ key: AppRole; label: string }> = [
  { key: "OPERADOR", label: "Operador" },
  { key: "TI", label: "TI" },
  { key: "DEPOSITANTE", label: "Depositante" },
  { key: "ADMIN", label: "Administrador" },
];

const moduleDescriptions: Record<AppModule, string> = {
  dashboard: "Visão geral e KPIs operacionais",
  recebimento: "Conferir entradas e NFs",
  expedicao: "Separar, conferir e expedir",
  romaneio: "Emissão e gestão de romaneios",
  estoque: "Consultar e ajustar saldos",
  nfe: "Emissão e consulta de NF-e",
  relatorios: "Relatórios e exportações",
  financeiro: "Faturamento e conciliação",
  yms: "Gestão do pátio e docas",
  configuracoes: "Administração do sistema",
};

const configSectionDescriptions: Record<ConfigSection, string> = {
  depositantes: "Cadastro de depositantes",
  usuarios: "Usuários e permissões",
  produtos: "Catálogo de produtos",
  enderecos: "Endereços de armazenagem",
  transportadoras: "Parceiros de frete",
  integracoes: "Marketplaces e ERP",
};

type PortalAccessItem = { label: string; description: string; enabled: boolean };

const gestorPortalAccess: PortalAccessItem[] = [
  { label: "Meus pedidos", description: "Consultar e criar pedidos manuais", enabled: true },
  { label: "Pedidos Full", description: "Acompanhar pedidos de fulfillment", enabled: true },
  { label: "Recebimento", description: "Agendar e acompanhar entradas", enabled: true },
  { label: "Meus produtos", description: "Catálogo e ficha de SKUs", enabled: true },
  { label: "Quarentena", description: "Decidir sobre itens em quarentena", enabled: true },
  { label: "Faturas", description: "Extrato financeiro e boletos", enabled: true },
  { label: "Integrações", description: "Marketplaces e ERP", enabled: true },
  { label: "Suporte", description: "Abrir e acompanhar chamados", enabled: true },
];

const colaboradorPortalAccess: PortalAccessItem[] = [
  { label: "Meus pedidos", description: "Consulta operacional (sem criar manuais)", enabled: true },
  { label: "Pedidos Full", description: "Acompanhar pedidos de fulfillment", enabled: true },
  { label: "Recebimento", description: "Agendar e acompanhar entradas", enabled: true },
  { label: "Meus produtos", description: "Catálogo e ficha de SKUs", enabled: true },
  { label: "Quarentena", description: "Sem permissão de decisão", enabled: false },
  { label: "Faturas", description: "Sem acesso", enabled: false },
  { label: "Integrações", description: "Sem acesso", enabled: false },
  { label: "Suporte", description: "Abrir e acompanhar chamados", enabled: true },
];

export type UsuarioFormDefaults = {
  id?: string;
  nome?: string;
  login?: string;
  email?: string;
  papel?: AppRole;
  depositanteId?: string | null;
  ativo?: boolean;
  modulePermissions?: AppModule[] | null;
  configSections?: ConfigSection[] | null;
  portalProfile?: "GESTOR" | "COLABORADOR";
};

export type UsuarioFormDepositanteOption = {
  id: string;
  nome: string;
};

type UsuarioFormProps = {
  defaultValues?: UsuarioFormDefaults;
  depositantes: UsuarioFormDepositanteOption[];
  onClose?: () => void;
};

export function UsuarioForm({ defaultValues, depositantes, onClose }: UsuarioFormProps) {
  const initialState = { success: false, message: null };

  const isEdit = Boolean(defaultValues?.id);
  const [papel, setPapel] = useState<AppRole>(defaultValues?.papel ?? "OPERADOR");
  const [depositanteId, setDepositanteId] = useState<string>(defaultValues?.depositanteId ?? "");
  const initialModules = defaultValues?.modulePermissions ?? [];
  const [modules, setModules] = useState<Set<AppModule>>(new Set(initialModules));
  const initialConfigSections =
    defaultValues?.configSections?.length
      ? defaultValues.configSections
      : ([...CONFIG_SECTIONS] as ConfigSection[]);
  const [configSections, setConfigSections] = useState<Set<ConfigSection>>(
    new Set(initialConfigSections),
  );
  const [portalProfile, setPortalProfile] = useState<"GESTOR" | "COLABORADOR">(
    defaultValues?.portalProfile ?? "GESTOR",
  );
  const [state, formAction, isPending] = useActionState(saveUsuarioAction, initialState);

  useEffect(() => {
    if (state.success && onClose) {
      onClose();
    }
  }, [state.success, onClose]);

  function toggleModule(module: AppModule) {
    setModules((current) => {
      const next = new Set(current);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }

  function toggleConfigSection(section: ConfigSection) {
    setConfigSections((current) => {
      const next = new Set(current);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  return (
    <form
      action={formAction}
      className="flex h-full flex-col"
      style={{ fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
    >
      <header
        className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b bg-white px-[28px] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Voltar"
            className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] ${tokenText}`} />
          </button>
        ) : (
          <Link
            href="/configuracoes/usuarios"
            title="Voltar"
            className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] ${tokenText}`} />
          </Link>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <span>Configurações</span>
            <span>›</span>
            <span>Usuários</span>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>{isEdit ? "Editar" : "Novo usuário"}</span>
          </div>
          <span className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>
            {isEdit ? "Editar usuário" : "Novo usuário"}
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={`flex h-11 shrink-0 items-center rounded-[11px] border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          >
            Cancelar
          </button>
        ) : (
          <Link
            href="/configuracoes/usuarios"
            className={`flex h-11 shrink-0 items-center rounded-[11px] border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <span className={tokenText}>Cancelar</span>
          </Link>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex h-11 shrink-0 items-center gap-2 rounded-[11px] px-[22px] text-sm font-extrabold shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: "linear-gradient(92deg, #3B82F6, #8B5CF6)", color: "#fff" }}
        >
          {isPending ? <MobileButtonSpinner /> : isEdit ? "Salvar alterações" : "Salvar usuário"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[18px]">
          <input type="hidden" name="id" value={defaultValues?.id ?? ""} />
          <input type="hidden" name="isOverlay" value={onClose ? "true" : "false"} />
          <input type="hidden" name="papel" value={papel} />
          <input type="hidden" name="depositanteId" value={depositanteId} />
          <input type="hidden" name="ativo" value={defaultValues?.ativo === false ? "" : "on"} />
          <input type="hidden" name="portalProfile" value={portalProfile} />
          {Array.from(configSections).map((section) => (
            <input key={`cs-${section}`} type="hidden" name="configSections" value={section} />
          ))}
          {Array.from(modules).map((module) => (
            <input key={`m-${module}`} type="hidden" name="modulos" value={module} />
          ))}

          <section className={cardClass}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Dados do usuário</span>
            <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-[2fr_1fr]">
              <FormField
                label="Nome completo"
                name="nome"
                defaultValue={defaultValues?.nome ?? ""}
                placeholder="Nome do usuário"
                required
              />
              <FormField
                label="ID de usuário"
                name="login"
                defaultValue={defaultValues?.login ?? ""}
                placeholder="USR-0000"
                required
                mono
              />
              <FormField
                label="E-mail"
                name="email"
                type="email"
                defaultValue={defaultValues?.email ?? ""}
                placeholder="nome@infinoos.com"
              />
              <FormField
                label={isEdit ? "Nova senha" : "Senha inicial"}
                name="senha"
                type="password"
                defaultValue=""
                placeholder={
                  isEdit ? "Preencha apenas se quiser redefinir" : "Mínimo de 8 caracteres"
                }
                required={!isEdit}
                mono
              />
            </div>
          </section>

          <section className={`${cardClass} flex flex-col gap-3.5`}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Papel / permissão</span>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((option) => {
                const active = option.key === papel;
                const accent = roleAccent[option.key];
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPapel(option.key)}
                    className="inline-flex items-center transition"
                    style={{
                      height: "40px",
                      padding: "0 16px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: active ? `1.5px solid ${accent}` : "1.5px solid rgba(100,116,139,0.16)",
                      background: active ? hexAlpha(accent, 0.12) : "transparent",
                      color: active ? accent : "#64748B",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`${cardClass} flex flex-col gap-2.5`}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Depositante vinculado</span>
            <span className={`text-[13px] ${tokenTextSub}`}>
              Selecione o depositante ou o acesso a todos.
            </span>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <ChipOption
                label="Todos os depositantes"
                active={depositanteId === ""}
                onClick={() => setDepositanteId("")}
              />
              <div className="relative">
                <select
                  value={depositanteId}
                  onChange={(event) => setDepositanteId(event.target.value)}
                  className={`h-10 cursor-pointer appearance-none rounded-[10px] border pl-4 pr-9 text-[13px] font-bold outline-none transition ${
                    depositanteId
                      ? "border-[#8B5CF6] bg-[rgba(139,92,246,0.12)] text-[#8B5CF6]"
                      : `${tokenBorder} ${tokenInputBg} ${tokenTextSub}`
                  }`}
                  style={{ borderWidth: "1.5px", borderStyle: "solid" }}
                >
                  <option value="">Escolher depositante...</option>
                  {depositantes.map((depositante) => (
                    <option key={depositante.id} value={depositante.id}>
                      {depositante.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{
                    width: "16px",
                    height: "16px",
                    color: depositanteId ? "#8B5CF6" : "#64748B",
                  }}
                />
              </div>
            </div>
          </section>

          {papel === "DEPOSITANTE" ? (
            <section className={`${cardClass} flex flex-col gap-3.5`}>
              <div className="flex flex-col gap-1">
                <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>
                  Portal do depositante
                </span>
                <span className={`text-[13px] ${tokenTextSub}`}>
                  Perfil de acesso ao portal e áreas liberadas.
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "GESTOR", label: "Gestor" },
                    { key: "COLABORADOR", label: "Colaborador" },
                  ] as const
                ).map((option) => {
                  const active = option.key === portalProfile;
                  const accent = option.key === "GESTOR" ? "#8B5CF6" : "#3B82F6";
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPortalProfile(option.key)}
                      className="inline-flex items-center transition"
                      style={{
                        height: "40px",
                        padding: "0 16px",
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        border: active
                          ? `1.5px solid ${accent}`
                          : "1.5px solid rgba(100,116,139,0.16)",
                        background: active ? hexAlpha(accent, 0.12) : "transparent",
                        color: active ? accent : "#64748B",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col">
                {(portalProfile === "GESTOR" ? gestorPortalAccess : colaboradorPortalAccess).map(
                  (item) => (
                    <PortalAccessRow key={item.label} label={item.label} description={item.description} enabled={item.enabled} />
                  ),
                )}
              </div>
            </section>
          ) : (
          <section className={`${cardClass} flex flex-col gap-3.5`}>
            <div className="flex flex-col gap-1">
              <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Permissões do sistema</span>
              <span className={`text-[13px] ${tokenTextSub}`}>
                Módulos que este usuário pode acessar.
              </span>
            </div>
            <div className="flex flex-col">
              {APP_MODULES.map((module) => {
                const isConfig = module === "configuracoes";
                const isActive = modules.has(module);
                return (
                  <div key={module} className="flex flex-col">
                    <ModuleToggleRow
                      label={getModuleLabel(module)}
                      description={moduleDescriptions[module] ?? ""}
                      active={isActive}
                      onToggle={() => toggleModule(module)}
                    />
                    {isConfig && isActive ? (
                      <div
                        className="ml-3 flex flex-col pl-4"
                        style={{ borderLeft: "2px solid rgba(139,92,246,0.25)" }}
                      >
                        {CONFIG_SECTIONS.map((section) => (
                          <ModuleToggleRow
                            key={section}
                            label={getConfigSectionLabel(section)}
                            description={configSectionDescriptions[section] ?? ""}
                            active={configSections.has(section)}
                            onToggle={() => toggleConfigSection(section)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {state.message && !state.success ? (
            <div className="rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#EF4444]">
              {state.message}
            </div>
          ) : null}
        </div>
      </div>

    </form>
  );
}

type FormFieldProps = {
  label: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "password" | "email";
  mono?: boolean;
  readOnlyDisplay?: string;
};

function FormField({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  type = "text",
  mono,
  readOnlyDisplay,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>{label}</span>
      {readOnlyDisplay !== undefined ? (
        <div
          className={`flex items-center rounded-[11px] border px-[15px] text-sm ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          style={{ height: "46px" }}
        >
          {readOnlyDisplay}
        </div>
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className={`${inputClass} ${mono ? monoFont : ""}`}
        />
      )}
    </div>
  );
}

function ChipOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center transition"
      style={{
        height: "40px",
        padding: "0 16px",
        borderRadius: "10px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        border: active ? "1.5px solid #8B5CF6" : "1.5px solid rgba(100,116,139,0.16)",
        background: active ? "rgba(139,92,246,0.12)" : "transparent",
        color: active ? "#8B5CF6" : "#64748B",
      }}
    >
      {label}
    </button>
  );
}

function ModuleToggleRow({
  label,
  description,
  active,
  onToggle,
}: {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex flex-1 flex-col gap-[1px]">
        <span className={`text-[13.5px] font-bold ${tokenText}`}>{label}</span>
        <span className={`text-[12px] ${tokenTextSub}`}>{description}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        title={active ? "Desativar" : "Ativar"}
        style={{
          position: "relative",
          width: "46px",
          height: "26px",
          flexShrink: 0,
          borderRadius: "999px",
          border: "none",
          cursor: "pointer",
          background: active ? "#10B981" : "rgba(148,163,184,0.25)",
          transition: "background 0.25s",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: "3px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transform: active ? "translateX(20px)" : "translateX(0)",
            transition: "transform 0.25s cubic-bezier(0.4, 1.3, 0.5, 1)",
          }}
        />
      </button>
    </div>
  );
}

function PortalAccessRow({
  label,
  description,
  enabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex flex-1 flex-col gap-[1px]">
        <span className={`text-[13.5px] font-bold ${enabled ? tokenText : tokenTextSub}`}>{label}</span>
        <span className={`text-[12px] ${tokenTextSub}`}>{description}</span>
      </div>
      <span
        className="inline-flex items-center gap-[6px]"
        style={{
          padding: "3px 10px",
          borderRadius: "999px",
          fontSize: "11.5px",
          fontWeight: 700,
          background: enabled ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.12)",
          color: enabled ? "#10B981" : "#64748B",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: enabled ? "#10B981" : "#94A3B8",
          }}
        />
        {enabled ? "Liberado" : "Bloqueado"}
      </span>
    </div>
  );
}

function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
