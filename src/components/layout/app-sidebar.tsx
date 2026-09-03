"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  Activity, ChevronsLeft, ChevronsRight, CircleHelp, ClipboardList, FileCode2,
  Layers, LogOut, MapPin, PackageOpen, PieChart, Receipt, Route, Send,
  ShieldAlert, SlidersHorizontal, Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import {
  canAccessConfigSection, canAccessModule, getRoleLabel,
  isCatalogAndStockOperatorUser, isProductCatalogOnlyUser,
  type AppModule,
} from "@/lib/permissions";
import { logoutAction } from "@/app/(auth)/login/actions";

/**
 * Sidebar do Infinoos WMS — visual e estrutura idênticos ao Infinoos People.
 *
 * Estrutura preservada do padrão Infinoos:
 * - Grupos com section labels em maiúsculas
 * - Footer com avatar + user + logout (hover vermelho)
 * - Tooltip portalizado no modo recolhido
 * - Larguras 76 (compacta) / 264 (expandida) via CSS var
 *
 * Lógica preservada do WMS antigo:
 * - Filtragem por papel: canAccessModule / isProductCatalogOnly / isCatalogAndStockOperator
 * - Ticket badge em Suporte
 * - Distinção WMS vs YMS
 */

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  module: AppModule;
  badge?: string;
  // Item de acesso universal (ex.: Suporte/Ajuda): aparece independente dos
  // módulos do usuário. Sem isso, um operador com módulos customizados sem
  // "dashboard" perdia a aba Suporte.
  alwaysVisible?: boolean;
};

type Grupo = {
  id: string;
  label: string;
  itens: Item[];
};

// Catálogo agrupado (mesmo padrão do Infinoos People)
const GRUPOS_COMPLETOS: Grupo[] = [
  {
    id: "OPERACAO",
    label: "Operação",
    itens: [
      { href: "/dashboard",    label: "Dashboard",   icon: Activity,      module: "dashboard" },
      { href: "/recebimento",  label: "Recebimento", icon: PackageOpen,   module: "recebimento" },
      { href: "/expedicao",    label: "Expedição",   icon: Send,          module: "expedicao" },
      { href: "/romaneio",     label: "Romaneio",    icon: ClipboardList, module: "romaneio" },
    ],
  },
  {
    id: "ESTOQUE",
    label: "Estoque",
    itens: [
      { href: "/estoque",            label: "Estoque",    icon: Layers,      module: "estoque" },
      { href: "/estoque/quarentena", label: "Quarentena", icon: ShieldAlert, module: "estoque" },
      { href: "/configuracoes/produtos", label: "Produtos", icon: Tag, module: "configuracoes" },
    ],
  },
  {
    id: "FISCAL",
    label: "Fiscal & Análise",
    itens: [
      { href: "/nfe",         label: "NF-e",       icon: FileCode2, module: "nfe" },
      { href: "/relatorios",  label: "Relatórios", icon: PieChart,  module: "relatorios" },
      { href: "/financeiro",  label: "Financeiro", icon: Receipt,   module: "financeiro" },
    ],
  },
  {
    id: "AREAS",
    label: "Áreas",
    itens: [
      { href: "/yms", label: "YMS (Docas)", icon: Route, module: "yms" },
    ],
  },
  {
    id: "SISTEMA",
    label: "Sistema",
    itens: [
      { href: "/configuracoes", label: "Configurações", icon: SlidersHorizontal, module: "configuracoes" },
      { href: "/suporte",       label: "Suporte",       icon: CircleHelp,        module: "dashboard", alwaysVisible: true },
    ],
  },
];

export type SidebarNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  module: AppModule;
};

type AppSidebarProps = {
  user: AppUserContext;
  currentPath: string;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
  sidebarWidth?: number;               // legado — ignorado, largura fixa
  setSidebarWidth?: (width: number) => void;  // legado
  navigationOverride?: ReadonlyArray<SidebarNavigationItem>;
  navCounts?: Record<string, number>;
};

type FlyoutState = { label: string; top: number; left: number; active: boolean } | null;

export function AppSidebar({
  user,
  currentPath,
  isCollapsed = false,
  setIsCollapsed,
  navigationOverride,
  navCounts,
}: AppSidebarProps) {
  const [flyout, setFlyout] = useState<FlyoutState>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isYMS = currentPath.startsWith("/yms");

  // Aplica filtros por papel do usuário e retorna grupos visíveis
  const gruposVisiveis: Grupo[] = navigationOverride
    ? [{ id: "OVERRIDE", label: "", itens: [...navigationOverride] }]
    : isProductCatalogOnlyUser(user)
      ? [{
          id: "PRODUTO",
          label: "Cadastros",
          itens: [
            { href: "/configuracoes/produtos", label: "Produtos", icon: Tag,        module: "configuracoes" },
            { href: "/suporte",                label: "Suporte",  icon: CircleHelp, module: "dashboard", alwaysVisible: true },
          ],
        }]
      : isCatalogAndStockOperatorUser(user)
        ? buildOperatorGrupos(user)
        : filtrarPorPapel(user);

  // WMS vs YMS
  const gruposFinais = gruposVisiveis
    .map((g) => ({
      ...g,
      itens: g.itens.filter((item) => isYMS ? item.module === "yms" : item.module !== "yms"),
    }))
    .filter((g) => g.itens.length > 0);

  // Só UM item fica ativo por vez. Itens como "Estoque" (/estoque) e
  // "Quarentena" (/estoque/quarentena) são irmãos na sidebar, mas o href de
  // um é prefixo do outro — sem isso, os dois acendiam juntos. Entre todos
  // os itens visíveis que combinam com a URL atual, vence o href mais
  // específico (o mais longo); os demais ficam apagados.
  const activeHref = useMemo(() => {
    let best: string | null = null;
    for (const g of gruposFinais) {
      for (const item of g.itens) {
        const hasQuery = item.href.includes("?");
        const matches = hasQuery
          ? currentPath === item.href
          : currentPath === item.href || currentPath.startsWith(item.href + "/");
        if (matches && (best === null || item.href.length > best.length)) {
          best = item.href;
        }
      }
    }
    return best;
  }, [gruposFinais, currentPath]);

  const handleFlyoutEnter = (e: React.MouseEvent<HTMLLIElement>, label: string, active: boolean) => {
    if (!isCollapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setFlyout({ label, active, top: r.top + r.height / 2 - 22, left: r.right + 16 });
  };
  const handleFlyoutLeave = () => setFlyout(null);

  const nomeUsuario = user.nome ?? user.email ?? "";
  const funcao = getRoleLabel(user.papel);

  return (
    <aside className={`sb ${isCollapsed ? "sb--collapsed" : ""}`}>
      <div className="sb__grid" aria-hidden />
      <div className="sb__scan" aria-hidden />

      {/* Header */}
      <div className="sb__header">
        <div className="sb__logo">
          <Image src="/branding/icone-infinoos-wms.svg" alt="Infinoos WMS" width={40} height={40} priority />
        </div>
        <div className="sb__brand">
          <span className="sb__eyebrow">INFINOOS</span>
          <span className="sb__title">WMS</span>
        </div>
        <button
          type="button"
          className="sb__toggle"
          onClick={() => setIsCollapsed?.(!isCollapsed)}
          aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? (
            <Image src="/branding/icone-infinoos-wms.svg" alt="Infinoos" width={40} height={40} />
          ) : (
            <ChevronsLeft size={17} />
          )}
        </button>
      </div>

      {/* Conteúdo — mesma estrutura do HR: grupos com section labels */}
      <div className="sb__content">
        {gruposFinais.map((g) => (
          <section key={g.id}>
            {g.label && <div className="sb__section-label">{g.label}</div>}
            <ul className="sb__list">
              {g.itens.map((item, i) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                const badgeCount = navCounts?.[item.href] ?? 0;

                return (
                  <li
                    key={item.href}
                    className={`sb__item ${active ? "sb__item--active" : ""}`}
                    style={{ animationDelay: `${i * 28}ms` }}
                    onMouseEnter={(e) => handleFlyoutEnter(e, item.label, active)}
                    onMouseLeave={handleFlyoutLeave}
                  >
                    <Link href={item.href} className="sb__link">
                      <Icon className="sb__icon" />
                      <span className="sb__label">{item.label}</span>
                      {badgeCount > 0 && (
                        <span
                          className="sb__badge"
                          style={
                            active
                              ? {
                                  background: "rgba(255,255,255,0.24)",
                                  borderColor: "rgba(255,255,255,0.4)",
                                  color: "#FFFFFF",
                                }
                              : undefined
                          }
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Footer — igual ao HR */}
      <div className="sb__footer">
        <div className="sb__avatar">{initials(nomeUsuario)}</div>
        <div className="sb__user">
          <div className="sb__user-name">{nomeCurto(nomeUsuario)}</div>
          <span className="sb__user-role">{funcao}</span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="sb__menu-toggle sb__menu-toggle--logout"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </form>
      </div>

      {/* Flyout portalizado */}
      {mounted && isCollapsed && flyout && createPortal(
        <div
          className={`sb-flyout ${flyout.active ? "sb-flyout--active" : ""}`}
          style={{ top: flyout.top, left: flyout.left }}
        >
          {flyout.label}
        </div>,
        document.body,
      )}
    </aside>
  );
}

// Filtra os grupos completos deixando só itens acessíveis pro papel
function filtrarPorPapel(user: AppUserContext): Grupo[] {
  return GRUPOS_COMPLETOS.map((g) => ({
    ...g,
    itens: g.itens.filter(
      (item) =>
        (item.alwaysVisible || canAccessModule(user, item.module)) &&
        (item.href !== "/configuracoes/produtos" || canAccessConfigSection(user, "produtos")),
    ),
  })).filter((g) => g.itens.length > 0);
}

// Nav customizada pro operador de catálogo+estoque
function buildOperatorGrupos(user: AppUserContext): Grupo[] {
  const operacao: Item[] = [];
  if (canAccessModule(user, "recebimento"))
    operacao.push({ href: "/recebimento", label: "Recebimento", icon: PackageOpen, module: "recebimento" });
  if (canAccessModule(user, "expedicao"))
    operacao.push({ href: "/expedicao", label: "Expedição", icon: Send, module: "expedicao" });
  if (canAccessModule(user, "romaneio"))
    operacao.push({ href: "/romaneio", label: "Romaneio", icon: ClipboardList, module: "romaneio" });

  const estoque: Item[] = [];
  if (canAccessModule(user, "estoque")) {
    estoque.push(
      { href: "/estoque",            label: "Estoque",    icon: Layers,      module: "estoque" },
      { href: "/estoque/quarentena", label: "Quarentena", icon: ShieldAlert, module: "estoque" },
    );
  }

  const cadastros: Item[] = [
    { href: "/configuracoes/produtos", label: "Produtos", icon: Tag, module: "configuracoes" },
  ];
  if (canAccessConfigSection(user, "enderecos")) {
    cadastros.push({ href: "/configuracoes/enderecos", label: "Endereços", icon: MapPin, module: "configuracoes" });
  }

  const sistema: Item[] = [
    { href: "/suporte", label: "Suporte", icon: CircleHelp, module: "dashboard", alwaysVisible: true },
  ];

  return [
    { id: "OPERACAO",  label: "Operação",  itens: operacao },
    { id: "ESTOQUE",   label: "Estoque",   itens: estoque },
    { id: "CADASTROS", label: "Cadastros", itens: cadastros },
    { id: "SISTEMA",   label: "Sistema",   itens: sistema },
  ].filter((g) => g.itens.length > 0);
}

// Helpers idênticos ao Infinoos People

function nomeCurto(nome: string): string {
  const LIMITE = 18;
  const s = String(nome || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (s.length <= LIMITE) return s;
  const partes = s.split(" ");
  if (partes.length >= 2) {
    const primeiroUltimo = `${partes[0]} ${partes[partes.length - 1]}`;
    if (primeiroUltimo.length <= LIMITE) return primeiroUltimo;
  }
  return partes[0];
}

function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// evita warning "unused"
export { ChevronsRight };
