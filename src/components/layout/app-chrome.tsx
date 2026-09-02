"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageSearch, Search, Settings2, Users, Warehouse } from "lucide-react";
import type { AppUserContext } from "@/lib/auth";
import { AppMobileNav } from "@/components/layout/app-mobile-nav";
import { FirstAccessPasswordDialog } from "@/components/layout/first-access-password-dialog";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SoundToggle } from "@/components/sound-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { isAdminUser } from "@/lib/permissions";

type AppChromeProps = {
  children: ReactNode;
  user: AppUserContext;
  navCounts?: Record<string, number>;
};

type GlobalSearchConfig = {
  targetPath: string;
  param: string;
  placeholder: string;
  clearParams?: string[];
  // Quando false, esta página não tem um destino de busca próprio: a busca
  // global fica desativada em vez de cair no fallback (que antes levava
  // silenciosamente para /expedicao, mesmo em telas sem nenhuma relação
  // com expedição, como Dashboard, Relatórios, YMS e Suporte).
  available: boolean;
};

const EXPEDICAO_SMART_SEARCH_PARAMS = [
  "pedido",
  "cliente",
  "nf",
  "marketplace",
  "depositanteNome",
  "transportadora",
] as const;

function parseExpedicaoSmartSearch(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return {};

  const rules: Array<{ param: (typeof EXPEDICAO_SMART_SEARCH_PARAMS)[number]; pattern: RegExp }> = [
    { param: "nf", pattern: /^(?:nf|nfe|nota|nota fiscal)\s*[:#-]?\s*(.+)$/i },
    { param: "cliente", pattern: /^(?:cliente|destinat[aá]rio|comprador)\s*[:#-]?\s*(.+)$/i },
    { param: "pedido", pattern: /^(?:pedido|ped|wms)\s*[:#-]?\s*(.+)$/i },
    { param: "marketplace", pattern: /^(?:canal|marketplace|mkt|loja)\s*[:#-]?\s*(.+)$/i },
    { param: "depositanteNome", pattern: /^(?:depositante|dep)\s*[:#-]?\s*(.+)$/i },
    { param: "transportadora", pattern: /^(?:transportadora|frete|envio|carrier)\s*[:#-]?\s*(.+)$/i },
  ];

  for (const rule of rules) {
    const match = normalizedValue.match(rule.pattern);
    const parsedValue = match?.[1]?.trim();
    if (parsedValue) {
      return { [rule.param]: parsedValue };
    }
  }

  return { pedido: normalizedValue };
}

function getGlobalSearchConfig(path: string): GlobalSearchConfig {
  if (path === "/configuracoes/produtos") {
    return {
      // A página de produtos filtra pelo próprio parâmetro "q" — mirar
      // "/configuracoes" (com um "tab" que a página raiz nunca leu) jogava o
      // usuário de volta no painel geral em vez da lista de produtos.
      targetPath: "/configuracoes/produtos",
      param: "q",
      placeholder: "Buscar produtos...",
      clearParams: ["page"],
      available: true,
    };
  }

  if (path.startsWith("/configuracoes/enderecos")) {
    // A página de endereços não tem busca por texto livre (só filtro por
    // área), então não há um destino de busca válido aqui — evita repetir o
    // mesmo problema de mirar em "/configuracoes" e cair no painel geral.
    return {
      targetPath: path,
      param: "q",
      placeholder: "Busca não disponível nesta página",
      available: false,
    };
  }

  if (path.startsWith("/configuracoes/transportadoras")) {
    // A tela de transportadoras tem busca própria embutida; a busca global não
    // deve mirar em "/configuracoes" e jogar o usuário no painel geral.
    return {
      targetPath: path,
      param: "q",
      placeholder: "Busca não disponível nesta página",
      available: false,
    };
  }

  if (path.startsWith("/configuracoes/integracoes")) {
    // A tela de integrações filtra por depositante localmente; sem busca global.
    return {
      targetPath: path,
      param: "q",
      placeholder: "Busca não disponível nesta página",
      available: false,
    };
  }

  if (path.startsWith("/configuracoes/auditoria")) {
    // A auditoria tem busca própria (por texto) embutida na tela.
    return {
      targetPath: path,
      param: "q",
      placeholder: "Busca não disponível nesta página",
      available: false,
    };
  }

  if (path.startsWith("/suporte")) {
    // O Suporte tem busca própria embutida na aba de chamados.
    return {
      targetPath: path,
      param: "q",
      placeholder: "Busca não disponível nesta página",
      available: false,
    };
  }

  if (path.startsWith("/relatorios")) {
    // Relatórios tem busca própria (catálogo de cards) na tela.
    return {
      targetPath: path,
      param: "q",
      placeholder: "Busca não disponível nesta página",
      available: false,
    };
  }

  if (path === "/expedicao") {
    return {
      targetPath: "/expedicao",
      param: "pedido",
      placeholder: "Buscar pedido, cliente, NF ou canal...",
      clearParams: ["page"],
      available: true,
    };
  }

  if (path === "/estoque") {
    return {
      targetPath: "/estoque",
      param: "produto",
      placeholder: "Buscar produto, SKU ou EAN...",
      clearParams: ["page"],
      available: true,
    };
  }

  if (path === "/estoque/quarentena") {
    return {
      targetPath: "/estoque/quarentena",
      param: "q",
      placeholder: "Buscar produto, SKU, endereço ou motivo...",
      available: true,
    };
  }

  if (path === "/romaneio") {
    return {
      targetPath: "/romaneio",
      param: "q",
      placeholder: "Buscar transportadora ou romaneio...",
      clearParams: ["page"],
      available: true,
    };
  }

  if (path === "/nfe") {
    return {
      targetPath: "/nfe",
      param: "q",
      placeholder: "Buscar NF, chave, emitente ou destinatário...",
      clearParams: ["page"],
      available: true,
    };
  }

  if (path === "/recebimento") {
    return {
      targetPath: "/recebimento",
      param: "q",
      placeholder: "Buscar recebimento ou NF...",
      clearParams: ["page"],
      available: true,
    };
  }

  // Páginas sem um destino de busca próprio (Dashboard, Relatórios, YMS,
  // Suporte, raiz de Configurações etc.): a busca fica desativada em vez de
  // cair silenciosamente em /expedicao.
  return {
    targetPath: path,
    param: "q",
    placeholder: "Busca não disponível nesta página",
    available: false,
  };
}

export function AppChrome({ children, user, navCounts }: AppChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = pathname || "/dashboard";
  const isPickingWave = currentPath === "/expedicao/separacao/lote";
  const isFinanceiro = currentPath === "/financeiro" || currentPath.startsWith("/financeiro/");
  const isConfiguracoesRoot = currentPath === "/configuracoes";
  const isDepositantesFullBleed =
    currentPath === "/configuracoes/depositantes" ||
    currentPath === "/configuracoes/depositantes/novo" ||
    (currentPath.startsWith("/configuracoes/depositantes/") && currentPath.endsWith("/editar"));
  const isUsuariosFullBleed = currentPath === "/configuracoes/usuarios";
  const isEnderecosFullBleed = currentPath === "/configuracoes/enderecos";
  const isTransportadorasFullBleed = currentPath === "/configuracoes/transportadoras";
  const isIntegracoesFullBleed = currentPath === "/configuracoes/integracoes";
  const isAuditoriaFullBleed = currentPath === "/configuracoes/auditoria";
  const isSuporteFullBleed = currentPath === "/suporte";
  const isRelatoriosFullBleed = currentPath === "/relatorios";
  const isNfeFullBleed = currentPath === "/nfe";
  const showAdminMobileShortcuts = isAdminUser(user);
  const searchParamsString = searchParams.toString();
  const globalSearchConfig = useMemo(
    () => getGlobalSearchConfig(currentPath),
    [currentPath],
  );
  const globalSearchValueFromUrl = useMemo(() => {
    if (globalSearchConfig.targetPath === "/expedicao") {
      const invoice = searchParams.get("nf");
      const customer = searchParams.get("cliente");
      const marketplace = searchParams.get("marketplace");
      const depositanteName = searchParams.get("depositanteNome");
      const carrier = searchParams.get("transportadora");
      const order = searchParams.get("pedido");

      if (invoice) return `nf ${invoice}`;
      if (customer) return `cliente ${customer}`;
      if (marketplace) return `canal ${marketplace}`;
      if (depositanteName) return `depositante ${depositanteName}`;
      if (carrier) return `transportadora ${carrier}`;
      if (order) return order;
    }

    return searchParams.get(globalSearchConfig.param) ?? "";
  }, [globalSearchConfig, searchParams]);
  const [globalSearch, setGlobalSearch] = useState(globalSearchValueFromUrl);

  const [isCollapsed, setIsCollapsed] = useState(false);
  // Larguras alinhadas com a sidebar do Infinoos People/ERP: 76 compacta / 264 expandida.
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);

  const [waveCode, setWaveCode] = useState("W-000");

  useEffect(() => {
    setGlobalSearch(globalSearchValueFromUrl);
  }, [globalSearchValueFromUrl]);

  const applyGlobalSearch = useCallback(
    (value: string) => {
      if (!globalSearchConfig.available) {
        return;
      }

      const normalizedValue = value.trim();
      const navigatingWithinSameRoute = currentPath === globalSearchConfig.targetPath;
      const params = new URLSearchParams(navigatingWithinSameRoute ? searchParamsString : "");

      for (const clearParam of globalSearchConfig.clearParams ?? []) {
        params.delete(clearParam);
      }

      const searchableParams =
        globalSearchConfig.targetPath === "/expedicao"
          ? EXPEDICAO_SMART_SEARCH_PARAMS
          : [globalSearchConfig.param];

      for (const searchParam of searchableParams) {
        params.delete(searchParam);
      }

      if (normalizedValue) {
        if (globalSearchConfig.targetPath === "/expedicao") {
          const parsedParams = parseExpedicaoSmartSearch(normalizedValue);
          for (const [param, paramValue] of Object.entries(parsedParams)) {
            params.set(param, paramValue);
          }
        } else {
          params.set(globalSearchConfig.param, normalizedValue);
        }
      }

      const query = params.toString();
      const nextUrl = `${globalSearchConfig.targetPath}${query ? `?${query}` : ""}`;
      const currentUrl = `${currentPath}${searchParamsString ? `?${searchParamsString}` : ""}`;

      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    },
    [currentPath, globalSearchConfig, router, searchParamsString],
  );

  useEffect(() => {
    if (
      isPickingWave ||
      currentPath.startsWith("/expedicao/conferencia") ||
      !globalSearchConfig.available ||
      globalSearch === globalSearchValueFromUrl
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      applyGlobalSearch(globalSearch);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [
    applyGlobalSearch,
    currentPath,
    globalSearch,
    globalSearchConfig.available,
    globalSearchValueFromUrl,
    isPickingWave,
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const wave = params.get("wave");
      const ids = params.get("ids") || "";
      if (wave) {
        setWaveCode(wave);
      } else if (ids) {
        setWaveCode('W-' + ids.split(',')[0].substring(0, 4).toUpperCase());
      }
    }
  }, [currentPath]);

useEffect(() => {
    const storedCollapsed = window.localStorage.getItem("infinoos-sidebar-collapsed");

    if (storedCollapsed !== null) {
      setIsCollapsed(storedCollapsed === "true");
    }

    // Ignora valor antigo de largura persistida — drag-resize removido, largura é fixa.
    // Também limpa o valor cacheado pra não voltar a interferir se drag-resize retornar.
    window.localStorage.removeItem("infinoos-sidebar-width");

    setSidebarPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!sidebarPreferenceLoaded) return;
    window.localStorage.setItem("infinoos-sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed, sidebarPreferenceLoaded]);

  const style = {
    '--sidebar-width': isCollapsed ? '76px' : `${sidebarWidth}px`
  } as React.CSSProperties;

  return (
    <div style={style} className="theme-transition flex h-screen h-[100dvh] w-full overflow-hidden bg-[linear-gradient(180deg,#040816_0%,#050b19_60%,#071120_100%)] text-zinc-100 lg:bg-[linear-gradient(180deg,#eef4ff_0%,#f7fbff_55%,#ffffff_100%)] lg:text-slate-900 dark:bg-[linear-gradient(180deg,#040816_0%,#050b19_60%,#071120_100%)] dark:text-zinc-100">
      
      {/* Background Decoration */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-primary-500/14 blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[30%] w-[30%] rounded-full bg-accent-500/14 blur-[120px]"></div>
      </div>

      {/* Sidebar - Hidden on mobile, block on lg
          Width reservada via CSS var pra o main content (flex-1) não passar
          por baixo da sidebar fixed. --sidebar-width vem do wrapper root. */}
      <div className="hidden lg:block z-10 flex-shrink-0" style={{ width: 'calc(var(--sidebar-width) + 28px)' }}>
        <AppSidebar
          user={user} 
          currentPath={currentPath} 
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          navCounts={navCounts}
        />
      </div>

      {/* Main Content Área */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className={`${isPickingWave || isFinanceiro || isConfiguracoesRoot || isDepositantesFullBleed || isUsuariosFullBleed || isEnderecosFullBleed || isTransportadorasFullBleed || isIntegracoesFullBleed || isAuditoriaFullBleed || isSuporteFullBleed || isRelatoriosFullBleed || isNfeFullBleed ? "hidden" : ""} z-10 flex h-24 flex-shrink-0 items-center justify-between border-b border-white/10 ${currentPath.startsWith("/expedicao/conferencia") ? "pl-[22px] pr-4 sm:pr-8" : "px-4 sm:px-8"} lg:border-none lg:border-slate-200/80 dark:border-white/10`}>
          <div className="flex w-full max-w-3xl items-center gap-4">
            {currentPath === "/expedicao/separacao/lote" || currentPath.startsWith("/expedicao/conferencia") ? (
              <div className="flex items-center gap-4">
                <Link href="/expedicao" className="flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200/80 bg-white/70 text-slate-700 font-bold text-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-[#071120]/70 dark:text-white dark:hover:bg-[#0A1120]">
                  ‹ Expedição
                </Link>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>Expedição</span><span>›</span><span className="text-slate-900 font-semibold dark:text-white">
                    {currentPath.startsWith("/expedicao/conferencia") ? "Conferência" : "Separação"}
                  </span>
                </div>
              </div>
            ) : globalSearchConfig.available ? (
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyGlobalSearch(globalSearch);
                    }
                  }}
                  placeholder={globalSearchConfig.placeholder}
                  className="w-full rounded-full border border-white/10 bg-[#071120]/70 py-2 pl-10 pr-4 text-sm text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50 lg:border-slate-200/80 lg:bg-white/70 lg:text-slate-900 dark:border-white/10 dark:bg-[#071120]/70 dark:text-white"
                />
              </div>
            ) : (
              // Sem destino de busca própria nesta página: não renderiza o campo
              // (evita um input "fantasma" que parece funcional mas não faz nada).
              <div />
            )}
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            {currentPath === "/expedicao/separacao/lote" && (
              <div className="flex items-center gap-2 h-9 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Onda {waveCode} ativa</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <NotificationBell />
              <SoundToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto z-10 scroll-smooth ${isPickingWave || isFinanceiro || isConfiguracoesRoot || isDepositantesFullBleed || isUsuariosFullBleed || isEnderecosFullBleed || isTransportadorasFullBleed || isIntegracoesFullBleed || isAuditoriaFullBleed || isSuporteFullBleed || isRelatoriosFullBleed || isNfeFullBleed || currentPath.startsWith("/expedicao/conferencia") ? "" : "px-4 sm:px-8 pb-24 lg:pb-12"}`}>
          {showAdminMobileShortcuts ? (
            <section className="mb-4 lg:hidden">
              <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-2">
                  <MobileAdminShortcut
                    href="/configuracoes"
                    label="Configurações"
                    active={currentPath === "/configuracoes"}
                    icon={<Settings2 className="h-4 w-4" />}
                  />
                  <MobileAdminShortcut
                    href="/configuracoes/produtos"
                    label="Produtos"
                    active={currentPath.startsWith("/configuracoes/produtos")}
                    icon={<PackageSearch className="h-4 w-4" />}
                  />
                  <MobileAdminShortcut
                    href="/configuracoes/depositantes"
                    label="Depositantes"
                    active={currentPath.startsWith("/configuracoes/depositantes")}
                    icon={<Warehouse className="h-4 w-4" />}
                  />
                  <MobileAdminShortcut
                    href="/configuracoes/usuarios"
                    label="Usuários"
                    active={currentPath.startsWith("/configuracoes/usuarios")}
                    icon={<Users className="h-4 w-4" />}
                  />
                </div>
              </div>
            </section>
          ) : null}
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
         <AppMobileNav currentPath={currentPath} user={user} />
      </div>

      {/* Floating Theme Toggle no canto inferior direito */}

      <FirstAccessPasswordDialog isVisible={user.forcePasswordReset} userName={user.nome} />
    </div>
  );
}

function MobileAdminShortcut({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
        active
          ? "border-cyan-300/30 bg-cyan-400/12 text-cyan-700 shadow-[0_0_18px_rgba(34,211,238,0.14)] dark:text-cyan-300"
          : "border-white/10 bg-[#071120]/80 text-slate-200 lg:border-slate-200/80 lg:bg-white/80 lg:text-slate-700 dark:border-white/10 dark:bg-[#071120]/80 dark:text-slate-200",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
