import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Box, ChevronRight, MapPin, Plug, Truck, User, Users } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth";
import {
  getEffectiveConfigSections,
  isAdminUser,
  isProductCatalogOnlyUser,
  type ConfigSection,
} from "@/lib/permissions";
import { isTransportadorasSchemaMissing } from "@/lib/transportadoras";
import { isOwnOperationMode } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { SoundToggle } from "@/components/sound-toggle";
import { TarefasPanel } from "./tarefas-panel";

const surfaceClass = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0b1424]";
const panelClass = `${surfaceClass} p-6`;
const subPanelClass = "rounded-[13px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5";
const rowClass =
  "flex items-center justify-between gap-3 rounded-xl border px-[18px] py-4 text-[13px] border-[rgba(100,116,139,0.16)] bg-[rgba(100,116,139,0.05)] dark:border-[rgba(148,163,184,0.14)] dark:bg-[rgba(148,163,184,0.06)]";

const configModules = [
  {
    href: "/configuracoes/depositantes",
    title: "Depositantes",
    description: "Carteira ativa, contatos, regras operacionais e segregação por cliente.",
    icon: Users,
    iconBg: "rgba(59,130,246,0.15)",
    iconColor: "#3B82F6",
  },
  {
    href: "/configuracoes/usuarios",
    title: "Usuários",
    description: "Papéis, acessos, vínculo por depositante e gestão de sessão operacional.",
    icon: User,
    iconBg: "rgba(139,92,246,0.15)",
    iconColor: "#8B5CF6",
  },
  {
    href: "/configuracoes/produtos",
    title: "Produtos",
    description: "SKU, EAN/GTIN, categoria, FEFO/FIFO, unidade, lote e validade.",
    icon: Users,
    iconBg: "rgba(59,130,246,0.15)",
    iconColor: "#3B82F6",
  },
  {
    href: "/configuracoes/enderecos",
    title: "Endereços",
    description: "Mapa físico de recebimento, pulmão, picking, bloqueado e expedição.",
    icon: MapPin,
    iconBg: "rgba(16,185,129,0.15)",
    iconColor: "#10B981",
  },
  {
    href: "/configuracoes/transportadoras",
    title: "Transportadoras",
    description: "CNPJ, modalidades, contato principal e base logística para expedição e romaneio.",
    icon: Truck,
    iconBg: "rgba(245,158,11,0.15)",
    iconColor: "#F59E0B",
  },
  {
    href: "/configuracoes/integracoes",
    title: "Integrações",
    description: "Bling V3, OAuth2, webhooks operacionais e conexões externas por depositante.",
    icon: Plug,
    iconBg: "rgba(6,182,212,0.15)",
    iconColor: "#06B6D4",
  },
] as const;

const avatarGradients = [
  "linear-gradient(135deg,#3B82F6,#60A5FA)",
  "linear-gradient(135deg,#10B981,#34D399)",
  "linear-gradient(135deg,#EC4899,#F472B6)",
  "linear-gradient(135deg,#F59E0B,#FBBF24)",
  "linear-gradient(135deg,#06B6D4,#22D3EE)",
  "linear-gradient(135deg,#8B5CF6,#A78BFA)",
];

export default async function ConfiguracoesPage() {
  const currentUser = await requireModuleAccess("configuracoes");

  if (isProductCatalogOnlyUser(currentUser)) {
    redirect("/configuracoes/produtos");
  }

  const allowedSections = getEffectiveConfigSections(currentUser);
  const isFullConfigUser = isAdminUser(currentUser) || allowedSections.length === configModules.length;

  if (!isFullConfigUser && allowedSections.length === 1) {
    redirect(`/configuracoes/${allowedSections[0]}`);
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const [
    { data: depositantes },
    { data: produtos },
    { data: usuarios },
    { count: activeAddresses },
    transportadorasResult,
    { data: tarefas },
  ] = await Promise.all([
    supabase.from("depositantes").select("id, codigo, nome, ativo, logo_url").order("nome"),
    supabase.from("produtos").select("depositante_id, metodo_retirada, ativo"),
    supabase.from("usuarios").select("depositante_id, ativo"),
    supabase.from("enderecos").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("transportadoras").select("id, ativo"),
    admin
      .from("configuracoes_tarefas")
      .select("id, texto, concluida")
      .eq("criado_por", currentUser.id)
      .order("criado_em", { ascending: false }),
  ]);

  const productCountByDepositante = new Map<string, number>();
  const userCountByDepositante = new Map<string, number>();
  const methodCountByDepositante = new Map<string, Array<string | null | undefined>>();

  for (const product of produtos ?? []) {
    if (!product.depositante_id) {
      continue;
    }

    productCountByDepositante.set(
      product.depositante_id,
      (productCountByDepositante.get(product.depositante_id) ?? 0) + 1,
    );

    const currentMethods = methodCountByDepositante.get(product.depositante_id) ?? [];
    currentMethods.push(product.metodo_retirada);
    methodCountByDepositante.set(product.depositante_id, currentMethods);
  }

  for (const user of usuarios ?? []) {
    if (!user.depositante_id) {
      continue;
    }

    userCountByDepositante.set(
      user.depositante_id,
      (userCountByDepositante.get(user.depositante_id) ?? 0) + 1,
    );
  }

  const depositanteCards = (depositantes ?? []).map((depositante, index) => {
    const preferredMethod = getPreferredMethod(methodCountByDepositante.get(depositante.id) ?? []);

    return {
      id: depositante.id,
      nome: depositante.nome,
      ativo: depositante.ativo,
      logoUrl: depositante.logo_url as string | null,
      skus: productCountByDepositante.get(depositante.id) ?? 0,
      usuarios: userCountByDepositante.get(depositante.id) ?? 0,
      metodo: preferredMethod,
      avatarGradient: avatarGradients[index % avatarGradients.length],
      initials: getInitials(depositante.nome),
    };
  });

  const activeDepositantes = depositanteCards.filter((item) => item.ativo).length;
  const activeUsers = (usuarios ?? []).filter((item) => item.ativo).length;
  const transportadoras =
    transportadorasResult.error && isTransportadorasSchemaMissing(transportadorasResult.error)
      ? []
      : (transportadorasResult.data ?? []);
  const activeCarriers = transportadoras.filter((item) => item.ativo).length;
  const visibleConfigModules = (
    isFullConfigUser
      ? configModules.filter((module) => module.href !== "/configuracoes/produtos")
      : configModules.filter((module) =>
          module.href !== "/configuracoes/produtos" &&
          allowedSections.includes(module.href.split("/").pop() as ConfigSection),
        )
  ).filter((module) => !(isOwnOperationMode() && module.href === "/configuracoes/depositantes"));

  const statCards = [
    { label: "Depositantes ativos", value: activeDepositantes, icon: Users, iconBg: "rgba(59,130,246,0.15)", iconColor: "#3B82F6" },
    { label: "Usuários ativos", value: activeUsers, icon: User, iconBg: "rgba(139,92,246,0.15)", iconColor: "#8B5CF6" },
    { label: "Endereços ativos", value: activeAddresses ?? 0, icon: MapPin, iconBg: "rgba(16,185,129,0.15)", iconColor: "#10B981" },
    { label: "Transportadoras", value: activeCarriers, icon: Truck, iconBg: "rgba(245,158,11,0.15)", iconColor: "#F59E0B" },
  ];

  return (
    <div className="flex h-full flex-col font-[family-name:var(--font-manrope)]">
      <header className="flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8">
        <div className="flex items-baseline gap-2.5">
          <span
            className={`${FIN_HEADING} rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100`}
          >
            Configurações
          </span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tracking-[0.08em] text-[#64748B] dark:text-[#8695AD]">
            SISTEMA/01
          </span>
        </div>
        <div className="flex-1" />
        <NotificationBell />
        <SoundToggle forceLight />
        <ThemeToggle />
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-24 pt-5 sm:px-8 lg:pb-12">
      <p className="text-sm text-slate-500 dark:text-zinc-400">Resumo de cadastros e integrações do CD.</p>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#101B30]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">{card.label}</span>
              <span
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                <card.icon size={20} />
              </span>
            </div>
            <div className={`${FIN_HEADING} text-[30px] font-bold text-slate-900 dark:text-zinc-100`}>
              {card.value.toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className={panelClass}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Depositantes base</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Isolamento multi-tenant e políticas de acesso por cliente.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {activeDepositantes} ativos
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {depositanteCards.length ? (
              depositanteCards.map((item) => (
                <div key={item.id} className={subPanelClass}>
                  <div className="flex items-center gap-3">
                    {item.logoUrl ? (
                      <Image
                        src={item.logoUrl}
                        alt={item.nome}
                        width={36}
                        height={36}
                        unoptimized
                        className="h-9 w-9 shrink-0 rounded-full border border-slate-200 bg-white object-contain dark:border-white/10"
                      />
                    ) : (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: item.avatarGradient }}
                      >
                        {item.initials}
                      </span>
                    )}
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {item.nome}
                    </p>
                    <span
                      className={`shrink-0 rounded-[7px] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        item.metodo === "FIFO"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {item.metodo}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        SKUs
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{item.skus}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        Usuários
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{item.usuarios}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 md:col-span-2">
                Nenhum depositante cadastrado ainda.
              </div>
            )}
          </div>
        </div>

        <div className={panelClass}>
          <TarefasPanel initialTasks={tarefas ?? []} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleConfigModules.map((module) => (
          <Link key={module.href} href={module.href} className={`group transition hover:-translate-y-0.5 hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${surfaceClass} p-5`}>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                style={{ background: module.iconBg, color: module.iconColor }}
              >
                <module.icon className="h-[18px] w-[18px]" />
              </span>
              <p className="flex-1 text-[15px] font-bold text-slate-900 dark:text-white">{module.title}</p>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 dark:text-slate-500" />
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{module.description}</p>
          </Link>
        ))}
        {isAdminUser(currentUser) ? (
          <Link href="/configuracoes/auditoria" className={`group transition hover:-translate-y-0.5 hover:border-[#8B5CF6] dark:hover:border-[#8B5CF6] ${surfaceClass} p-5`}>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                style={{ background: "rgba(236,72,153,0.15)", color: "#EC4899" }}
              >
                <Box className="h-[18px] w-[18px]" />
              </span>
              <p className="flex-1 text-[15px] font-bold text-slate-900 dark:text-white">Auditoria</p>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 dark:text-slate-500" />
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Registro completo de ações, alterações e acessos ao sistema.
            </p>
          </Link>
        ) : null}
      </div>

      <div className={`${surfaceClass} p-[22px]`}>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Cobertura atual</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CoverageRow
            label="Depositantes com SKU cadastrado"
            value={String(depositanteCards.filter((item) => item.skus > 0).length)}
            valueColor="#10B981"
          />
          <CoverageRow
            label="Depositantes sem SKU cadastrado"
            value={String(depositanteCards.filter((item) => item.skus === 0).length)}
            valueColorLight="#64748B"
            valueColorDark="#8695AD"
          />
          <CoverageRow
            label="Usuários vinculados a depositantes"
            value={String((usuarios ?? []).filter((item) => item.depositante_id).length)}
            valueColorLight="#0F172A"
            valueColorDark="#F1F5F9"
          />
          <CoverageRow
            label="Método predominante no ambiente"
            value={getPreferredMethod((produtos ?? []).map((item) => item.metodo_retirada))}
            valueColor="#8B5CF6"
          />
        </div>
      </div>
      </div>
    </div>
  );
}

function CoverageRow({
  label,
  value,
  valueColor,
  valueColorLight,
  valueColorDark,
}: {
  label: string;
  value: string;
  valueColor?: string;
  valueColorLight?: string;
  valueColorDark?: string;
}) {
  return (
    <div className={rowClass}>
      <span className="text-[#0F172A] dark:text-[#F1F5F9]">{label}</span>
      {valueColor ? (
        <span className="text-[18px] font-bold" style={{ color: valueColor }}>
          {value}
        </span>
      ) : (
        <span
          className="text-[18px] font-bold"
          style={{ color: valueColorLight }}
        >
          <span className="dark:hidden">{value}</span>
          <span className="hidden dark:inline" style={{ color: valueColorDark }}>
            {value}
          </span>
        </span>
      )}
    </div>
  );
}

function getPreferredMethod(methods: Array<string | null | undefined>) {
  const counter = new Map<string, number>();

  methods.filter(Boolean).forEach((method) => counter.set(method!, (counter.get(method!) ?? 0) + 1));

  const mostFrequent = [...counter.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  return mostFrequent ?? "Sem produtos";
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
