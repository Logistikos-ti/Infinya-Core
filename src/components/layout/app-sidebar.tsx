"use client";

import { useState, useRef, useEffect } from "react";

import { Space_Grotesk } from "next/font/google";
import Link from "next/link";
import {
  Activity,
  Archive,
  BarChart3,
  Boxes,
  ClipboardList,
  Cpu,
  FileCode2,
  FileText,
  Layers,
  LayoutDashboard,
  Map,
  MapPin,
  PackageCheck,
  PackageOpen,
  PieChart,
  Receipt,
  Route,
  ScrollText,
  Send,
  Settings2,
  SlidersHorizontal,
  Tag,
  Truck,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { InfinyaBrand } from "@/components/branding/infinya-brand";
import type { AppUserContext } from "@/lib/auth";
import {
  canAccessConfigSection,
  canAccessModule,
  getRoleLabel,
  isCatalogAndStockOperatorUser,
  isProductCatalogOnlyUser,
  type AppModule,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

const navigation: ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  module: AppModule;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: Activity, module: "dashboard" },
  { href: "/recebimento", label: "Recebimento", icon: PackageOpen, module: "recebimento" },
  { href: "/expedicao", label: "Expedição", icon: Send, module: "expedicao" },
  { href: "/estoque", label: "Estoque", icon: Layers, module: "estoque" },
  { href: "/romaneio", label: "Romaneio", icon: ClipboardList, module: "romaneio" },
  { href: "/nfe", label: "NF-e", icon: FileCode2, module: "nfe" },
  { href: "/relatorios", label: "Relatórios", icon: PieChart, module: "relatorios" },
  { href: "/yms", label: "YMS (Docas)", icon: Route, module: "yms" },
  { href: "/configuracoes", label: "Configurações", icon: SlidersHorizontal, module: "configuracoes" },
] as const;

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
  sidebarWidth?: number;
  setSidebarWidth?: (width: number) => void;
  navigationOverride?: ReadonlyArray<SidebarNavigationItem>;
};

export function AppSidebar({ user, currentPath, isCollapsed, setIsCollapsed, sidebarWidth, setSidebarWidth, navigationOverride }: AppSidebarProps) {
  const isYMS = currentPath.startsWith("/yms");
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<boolean>(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    setIsDragging(true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    let newWidth = e.clientX;
    if (newWidth < 200) newWidth = 200;
    if (newWidth > 500) newWidth = 500;
    if (setSidebarWidth) setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    dragRef.current = false;
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const visibleNavigation = navigationOverride ?? (isProductCatalogOnlyUser(user)
    ? [
        {
          href: "/configuracoes/produtos",
          label: "Produtos",
          icon: Tag,
          module: "configuracoes" as AppModule,
        },
      ]
    : isCatalogAndStockOperatorUser(user)
      ? [
          ...(canAccessModule(user, "estoque")
            ? [{ href: "/estoque", label: "Estoque", icon: Layers, module: "estoque" as AppModule }]
            : []),
          ...(canAccessModule(user, "expedicao")
            ? [{ href: "/expedicao", label: "Expedição", icon: Send }]
            : []),
          ...(canAccessModule(user, "romaneio")
            ? [{ href: "/romaneio", label: "Romaneio", icon: ClipboardList, module: "romaneio" as AppModule }]
            : []),
          {
            href: "/configuracoes/produtos",
            label: "Produtos",
            icon: Tag,
            module: "configuracoes" as AppModule,
          },
          ...(canAccessConfigSection(user, "enderecos")
            ? [{ href: "/configuracoes/enderecos", label: "Endereços", icon: MapPin }]
            : []),
        ]
      : navigation.filter((item) => canAccessModule(user, item.module)));

  // Filtragem visual entre os módulos WMS e YMS
  const currentNavItems = visibleNavigation.filter((item) => {
    if (isYMS) {
      // No YMS, mostramos apenas itens do YMS
      return item.module === "yms";
    }
    // No WMS, escondemos os itens específicos do YMS
    return item.module !== "yms";
  });

  return (
    <aside 
      style={{ width: isCollapsed ? 80 : sidebarWidth, transition: isDragging ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
      className="glass-card relative sticky top-0 z-10 m-0 flex min-h-screen flex-shrink-0 flex-col justify-between rounded-none border-r border-slate-200/50 bg-white/40 p-4 backdrop-blur-2xl dark:border-white/5 dark:bg-[#0a1128]/50"
    >
      {/* Drag handle */}
      {!isCollapsed && setSidebarWidth && (
        <div 
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/50 active:bg-cyan-500 z-50 transition-colors"
        />
      )}

      <div>
        <div className={cn("flex items-center mb-8", isCollapsed ? "flex-col gap-4" : "justify-between gap-2")}>
          <div className={cn(isCollapsed ? "flex justify-center" : "flex-1 min-w-0")}>
            <ModuleSwitcher currentPath={currentPath} isCollapsed={!!isCollapsed} />
          </div>
          <button 
            onClick={() => setIsCollapsed?.(!isCollapsed)}
            className="p-2 rounded-xl bg-slate-100/50 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 transition-colors flex-shrink-0"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <ChevronDown className="w-5 h-5 -rotate-90" /> : <ChevronDown className="w-5 h-5 rotate-90" />}
          </button>
        </div>

        <nav className="space-y-1.5">
          {currentNavItems.map((item) => {
            const Icon = item.icon;
            const [itemPath, itemQuery] = item.href.split("?");
            const isActive = itemQuery
              ? currentPath === item.href
              : currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition-all duration-300",
                  spaceGrotesk.className,
                  isCollapsed && "justify-center px-0",
                  isActive
                    ? "bg-gradient-to-r from-cyan-500/10 to-transparent text-cyan-700 dark:from-cyan-400/15 dark:text-cyan-300"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-[70%] w-[3px] -translate-y-1/2 rounded-r-full bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)] dark:bg-cyan-400 dark:shadow-[0_0_16px_rgba(34,211,238,0.7)]" />
                )}
                <Icon className={cn("h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110", isActive && "drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] dark:drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]")} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={cn("mt-4 border-t border-slate-200/80 pt-4 dark:border-white/10", isCollapsed ? "px-0 flex flex-col items-center gap-4" : "px-2 py-3")}>
        {!isCollapsed && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sessão ativa
          </p>
        )}
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between gap-3")}>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{user.nome}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{getRoleLabel(user.papel)}</p>
            </div>
          )}
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

function ModuleSwitcher({ currentPath, isCollapsed }: { currentPath: string; isCollapsed: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isYMS = currentPath.startsWith("/yms");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative px-1" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border border-transparent p-1.5 transition-colors hover:bg-slate-100/50 dark:hover:bg-white/5",
          isCollapsed && "justify-center p-0 hover:bg-transparent dark:hover:bg-transparent"
        )}
      >
        {isCollapsed ? (
          <InfinyaBrand glyphOnly className="w-10 h-10" />
        ) : (
          <>
            <InfinyaBrand compact naked isYMS={isYMS} />
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {isOpen && !isCollapsed && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#0a1128]">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Módulos Disponíveis
          </p>
          <Link 
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              !isYMS 
                ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            Infinoos WMS
          </Link>
          <Link 
            href="/yms"
            onClick={() => setIsOpen(false)}
            className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              isYMS 
                ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Map className="h-4 w-4" />
            </div>
            Infinoos YMS
          </Link>
        </div>
      )}
    </div>
  );
}
