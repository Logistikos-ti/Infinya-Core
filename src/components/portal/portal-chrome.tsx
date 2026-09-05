"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  Bell,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Package,
  PackageCheck,
  PackageSearch,
  PackageX,
  Receipt,
  Search,
  ShieldAlert,
  TriangleAlert,
  Truck,
  PlugZap,
} from "lucide-react";
import {
  AppSidebar,
  type SidebarNavigationItem,
} from "@/components/layout/app-sidebar";
import { FirstAccessPasswordDialog } from "@/components/layout/first-access-password-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { FancySelectInput } from "@/components/ui/fancy-select-input";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import type { AppUserContext } from "@/lib/auth";
import { isPortalIntegrationEnabled } from "@/lib/portal-integration-access";
import type { AppNotification } from "@/lib/notifications";

type PortalNotification = {
  ticketId: string;
  ticketNumber: string;
  title: string;
  category: string;
  status: string;
  preview: string;
  author: string;
  createdAt?: string;
  unreadCount: number;
};

// Item unificado do sino do portal -- mistura chamados de suporte (sistema
// próprio de não-lidos) com as notificações genéricas de `notificacoes`
// (mesmo tipo que alimenta o sino do dashboard staff em notification-bell.tsx).
type PortalFeedItem = {
  key: string;
  icon: ReactNode;
  badgeCount?: number;
  eyebrow?: string;
  title: string;
  subtitle: string;
  createdAtIso?: string;
  lida: boolean;
  onOpen: () => void;
};

// Mesmo mapeamento de ícones do sino staff (notification-bell.tsx) --
// mantém a leitura visual consistente entre dashboard e portal.
const NOTIFICATION_TYPE_ICON: Record<AppNotification["tipo"], ReactNode> = {
  ROMANEIO_LIBERADO: <Truck className="h-4 w-4" />,
  QUARENTENA_CRIADA: <PackageX className="h-4 w-4" />,
  INVENTARIO_DIVERGENTE: <ClipboardList className="h-4 w-4" />,
  RECEBIMENTO_CONCLUIDO: <PackageCheck className="h-4 w-4" />,
  RECEBIMENTO_DIVERGENTE: <TriangleAlert className="h-4 w-4" />,
  EXPEDICAO_CANCELAMENTO_ABERTO: <Ban className="h-4 w-4" />,
  EXPEDICAO_DIVERGENTE: <TriangleAlert className="h-4 w-4" />,
  FATURA_GERADA: <Receipt className="h-4 w-4" />,
  FATURA_VENCIDA: <CircleAlert className="h-4 w-4" />,
  ESTOQUE_BAIXO: <PackageSearch className="h-4 w-4" />,
};

// `link` de AppNotification sempre aponta pra uma rota do dashboard staff
// (ex.: /expedicao/conferencia/123) -- nunca existe no portal. Remapeia pelo
// referenciaTipo/referenciaId pra rota real do portal (ver basePortalNavigation).
function resolvePortalNotificationLink(referenciaTipo: string | null, referenciaId: string | null): string {
  switch (referenciaTipo) {
    case "quarentena":
      return "/portal?view=quarentena";
    case "recebimento":
      return "/portal?view=recebimento";
    case "fatura":
      return "/portal?view=faturas";
    case "pedido_expedicao":
      return referenciaId ? `/portal?view=pedidos&order=${referenciaId}` : "/portal?view=pedidos";
    case "produto":
    case "inventario_geral":
    case "contagem_ciclica":
      return "/portal?view=produtos";
    case "romaneio":
    default:
      return "/portal?view=pedidos";
  }
}

// Mesma chave do SoundToggle (src/components/sound-toggle.tsx) -- ausente
// no localStorage = som ligado por padrão (mesmo default do toggle). O
// portal não tem o SoundToggle no cabeçalho, mas respeita a mesma preferência
// caso o usuário já tenha desligado em algum outro lugar do software.
function isSoundEnabled() {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem("wms-sound-enabled");
  return saved === null ? true : saved === "true";
}

// Sintetizado via Web Audio API (mesmo approach de notification-bell.tsx).
function playNotificationChime() {
  if (!isSoundEnabled()) return;
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(740, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.24);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {
    // AudioContext not supported
  }
}

const basePortalNavigation: ReadonlyArray<SidebarNavigationItem> = [
  {
    href: "/portal",
    label: "Início",
    icon: LayoutDashboard,
    module: "dashboard",
  },
  {
    href: "/portal?view=pedidos",
    label: "Meus pedidos",
    icon: Package,
    module: "dashboard",
  },
  {
    href: "/portal?view=full",
    label: "Pedidos Full",
    icon: PackageCheck,
    module: "dashboard",
  },
  {
    href: "/portal?view=recebimento",
    label: "Recebimento",
    icon: Truck,
    module: "dashboard",
  },
  {
    href: "/portal?view=produtos",
    label: "Meus produtos",
    icon: FileText,
    module: "dashboard",
  },
  {
    href: "/portal?view=quarentena",
    label: "Quarentena",
    icon: ShieldAlert,
    module: "dashboard",
  },
  {
    href: "/portal?view=faturas",
    label: "Faturas",
    icon: Receipt,
    module: "dashboard",
  },
  {
    href: "/portal?view=suporte",
    label: "Suporte",
    icon: CircleHelp,
    module: "dashboard",
  },
];

function getPortalNavigation(user: AppUserContext): ReadonlyArray<SidebarNavigationItem> {
  const canPreviewPortals = user.papel === "ADMIN" || user.papel === "TI";
  const isPortalManager = canPreviewPortals || user.portalProfile === "GESTOR";
  const navigation = isPortalManager
    ? basePortalNavigation
    : basePortalNavigation.filter((item) => item.href !== "/portal?view=faturas");
  if (!isPortalManager || !isPortalIntegrationEnabled(user.depositanteNome)) return navigation;

  return [
    ...navigation.slice(0, 5),
    { href: "/portal?view=integracoes", label: "Integrações", icon: PlugZap, module: "dashboard" },
    ...navigation.slice(5),
  ];
}

export function PortalChrome({
  children,
  user,
  masterDepositantes,
}: {
  children: ReactNode;
  user: AppUserContext;
  masterDepositantes: Array<{ id: string; nome: string }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentView = searchParams.get("view") ?? "inicio";
  const searchParamsString = searchParams.toString();
  const searchParamKey = currentView === "produtos" ? "search" : "q";
  const searchValue = searchParams.get(searchParamKey) ?? "";
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Largura alinhada com Infinoos People/ERP/WMS: 76 compacta / 264 expandida.
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [search, setSearch] = useState(searchValue);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [genericNotifications, setGenericNotifications] = useState<AppNotification[]>([]);
  const portalNavigation = getPortalNavigation(user);
  const isMasterPreview = user.papel === "ADMIN" || user.papel === "TI";
  const selectedDepositanteId = searchParams.get("depositanteId") ?? "";
  const unreadNotifications =
    notifications.reduce((sum, notification) => sum + Number(notification.unreadCount || 0), 0) +
    genericNotifications.filter((item) => !item.lida).length;

  useEffect(() => {
    if (!isMasterPreview) return;

    const storageKey = "infinoos-master-portal-depositante-id";
    if (selectedDepositanteId) {
      window.localStorage.setItem(storageKey, selectedDepositanteId);
      return;
    }

    const savedDepositanteId = window.localStorage.getItem(storageKey);
    if (!savedDepositanteId) return;

    const exists = masterDepositantes.some(
      (depositante) => depositante.id === savedDepositanteId,
    );
    if (!exists) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    const params = new URLSearchParams(searchParamsString);
    params.set("depositanteId", savedDepositanteId);
    router.replace(`${pathname}?${params.toString()}`);
  }, [
    isMasterPreview,
    masterDepositantes,
    pathname,
    router,
    searchParamsString,
    selectedDepositanteId,
  ]);

  useEffect(() => {
    const collapsed = window.localStorage.getItem(
      "infinoos-portal-sidebar-collapsed",
    );
    if (collapsed !== null) setIsCollapsed(collapsed === "true");

    // Drag-resize removido — largura é fixa. Limpa valor antigo cacheado
    // pra usuários que tinham 288 salvo (antes do rebranding da sidebar).
    window.localStorage.removeItem("infinoos-portal-sidebar-width");

    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded) return;
    window.localStorage.setItem(
      "infinoos-portal-sidebar-collapsed",
      String(isCollapsed),
    );
  }, [isCollapsed, preferenceLoaded]);

  useEffect(() => {
    setSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      setNotificationsLoading(true);
      try {
        const params = new URLSearchParams({ refresh: String(Date.now()) });
        if (isMasterPreview && selectedDepositanteId) {
          params.set("depositanteId", selectedDepositanteId);
        }
        const response = await fetch(
          `/api/suporte/notificacoes?${params.toString()}`,
          {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          },
        );
        const payload = await response.json();
        if (active && response.ok) {
          setNotifications(payload.notifications ?? []);
        }
      } catch {
        // O sino é complementar e não deve bloquear o portal.
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isMasterPreview, selectedDepositanteId]);

  useEffect(() => {
    let active = true;

    const loadGenericNotifications = async () => {
      try {
        const params = new URLSearchParams({ refresh: String(Date.now()) });
        if (isMasterPreview && selectedDepositanteId) {
          params.set("depositanteId", selectedDepositanteId);
        }
        const response = await fetch(`/api/notificacoes?${params.toString()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const payload = await response.json();
        if (active && response.ok) {
          setGenericNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
        }
      } catch {
        // O sino é complementar e não deve bloquear o portal.
      }
    };

    void loadGenericNotifications();
    const interval = window.setInterval(loadGenericNotifications, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isMasterPreview, selectedDepositanteId]);

  // Toca só quando o total de não-lidas AUMENTA (mesma lógica de
  // notification-bell.tsx) -- previousUnreadRef começa null, então a
  // primeira carga (que pode já vir com não-lidas de antes) nunca soa.
  const previousUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    if (previousUnreadRef.current !== null && unreadNotifications > previousUnreadRef.current) {
      playNotificationChime();
    }
    previousUnreadRef.current = unreadNotifications;
  }, [unreadNotifications]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [currentView, selectedDepositanteId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalizedSearch = search.trim();
      const nextView = currentView === "inicio" && normalizedSearch ? "pedidos" : currentView;
      const nextKey = nextView === "produtos" ? "search" : "q";
      const params = new URLSearchParams(searchParamsString);

      params.set("view", nextView);
      params.delete(nextKey === "search" ? "q" : "search");
      if (normalizedSearch) {
        params.set(nextKey, normalizedSearch);
      } else {
        params.delete(nextKey);
      }

      // Se a pesquisa mudou em relação ao que está na URL, limpa a paginação
      const currentSearchValue = new URLSearchParams(searchParamsString).get(nextKey) ?? "";
      if (currentSearchValue !== normalizedSearch) {
        params.delete("page");
      }

      const nextUrl = `${pathname}?${params.toString()}`;
      const currentUrl = `${pathname}?${searchParamsString}`;
      if (nextUrl !== currentUrl) {
        router.replace(nextUrl);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [currentView, pathname, router, search, searchParamsString]);

  const activePath = withPortalContext(
    currentView === "inicio" ? "/portal" : `${pathname}?view=${currentView}`,
  );
  const style = {
    "--sidebar-width": isCollapsed ? "76px" : `${sidebarWidth}px`,
  } as React.CSSProperties;

  function navigate(href: string) {
    router.push(withPortalContext(href));
  }

  function withPortalContext(href: string) {
    if (!isMasterPreview || !selectedDepositanteId) return href;
    const [path, query = ""] = href.split("?");
    const params = new URLSearchParams(query);
    params.set("depositanteId", selectedDepositanteId);
    return `${path}?${params.toString()}`;
  }

  function changeMasterDepositante(depositanteId: string) {
    const params = new URLSearchParams(searchParamsString);
    if (depositanteId) {
      params.set("depositanteId", depositanteId);
      window.localStorage.setItem(
        "infinoos-master-portal-depositante-id",
        depositanteId,
      );
    } else {
      params.delete("depositanteId");
      window.localStorage.removeItem("infinoos-master-portal-depositante-id");
    }
    params.delete("order");
    params.delete("page");
    params.delete("search");
    params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  function openNotification(notification: PortalNotification) {
    setNotificationsOpen(false);
    setNotifications((current) =>
      current.filter((item) => item.ticketId !== notification.ticketId),
    );
    void fetch(`/api/suporte/chamados/${notification.ticketId}/leitura`, {
      method: "POST",
    });
    router.push(
      withPortalContext(`/portal?view=suporte&chamado=${notification.ticketId}`),
    );
  }

  function openGenericNotification(notification: AppNotification) {
    setNotificationsOpen(false);
    setGenericNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, lida: true } : item)),
    );
    void fetch(`/api/notificacoes/${notification.id}/leitura`, { method: "POST" });
    router.push(
      withPortalContext(resolvePortalNotificationLink(notification.referenciaTipo, notification.referenciaId)),
    );
  }

  const notificationFeed: PortalFeedItem[] = [
    ...notifications.map((notification): PortalFeedItem => ({
      key: `s-${notification.ticketId}`,
      icon: <MessageCircle className="h-4 w-4" />,
      badgeCount: notification.unreadCount,
      eyebrow: notification.ticketNumber,
      title: notification.title,
      subtitle: `${notification.author}: ${notification.preview}`,
      createdAtIso: notification.createdAt,
      lida: false,
      onOpen: () => openNotification(notification),
    })),
    ...genericNotifications.map((notification): PortalFeedItem => ({
      key: `n-${notification.id}`,
      icon: NOTIFICATION_TYPE_ICON[notification.tipo] ?? <Bell className="h-4 w-4" />,
      title: notification.titulo,
      subtitle: notification.mensagem,
      createdAtIso: notification.criadoEmIso,
      lida: notification.lida,
      onOpen: () => openGenericNotification(notification),
    })),
  ].sort((a, b) => new Date(b.createdAtIso ?? 0).getTime() - new Date(a.createdAtIso ?? 0).getTime());

  return (
    <div
      style={style}
      className="flex min-h-screen w-full overflow-hidden bg-background text-slate-900 dark:text-slate-100"
    >
      {/* Wrapper com largura reservada — sidebar é position:fixed no CSS novo,
          então o flex-1 do main precisaria passar por baixo sem esse spacer. */}
      <div
        className="hidden shrink-0 lg:block"
        style={{ width: "calc(var(--sidebar-width) + 28px)" }}
      >
        <AppSidebar
          user={user}
          currentPath={activePath}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          navigationOverride={portalNavigation.map((item) => ({
            ...item,
            href: withPortalContext(item.href),
          }))}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <header
          className={
            currentView === "faturas"
              ? "flex h-[68px] flex-shrink-0 items-center gap-4 border-b border-slate-200 px-4 dark:border-white/10 sm:px-8"
              : "flex min-h-[68px] shrink-0 flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1424]/80 sm:flex-nowrap sm:px-7 sm:py-0"
          }
        >
          {currentView === "faturas" ? (
            <span
              className={`${FIN_HEADING} rounded-lg bg-blue-50 py-1.5 pl-0 pr-3.5 text-[28px] font-bold text-slate-900 dark:bg-transparent dark:text-zinc-100`}
            >
              Faturas
            </span>
          ) : (
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 dark:border-white/10 dark:bg-white/5 sm:max-w-[420px]">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                aria-label="Buscar no portal"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={currentView === "produtos" ? "Filtrar produtos..." : "Buscar pedido, cliente, canal..."}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          )}
          <div className="hidden flex-1 sm:block" />
          {isMasterPreview ? (
            <div className="flex w-full min-w-[300px] items-center justify-end gap-2 sm:w-auto">
              <span className="whitespace-nowrap text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                Modo mestre
              </span>
              <div className="w-[235px]">
                <FancySelectInput
                  label="Portal do depositante"
                  hideLabel
                  name="portal-depositante-mestre"
                  value={selectedDepositanteId}
                  onChange={changeMasterDepositante}
                  options={[
                    { value: "", label: "Selecionar portal" },
                    ...masterDepositantes.map((depositante) => ({
                      value: depositante.id,
                      label: depositante.nome,
                    })),
                  ]}
                  menuClassName="max-h-[min(24rem,calc(100vh-9rem))]"
                />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setNotificationsOpen((current) => !current)}
            aria-label="Notificações"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-cyan-600 hover:shadow-md hover:shadow-cyan-500/10 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-300/50 dark:hover:text-cyan-200"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold leading-none text-white shadow-md shadow-rose-500/30">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <PortalNotificationPanel
              feed={notificationFeed}
              isLoading={notificationsLoading}
              unreadCount={unreadNotifications}
              onOpenSupport={() => navigate("/portal?view=suporte")}
            />
          ) : null}
          <ThemeToggle />
        </header>

        <div
          className={
            currentView === "faturas"
              ? "flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-8"
              : "flex-1 overflow-y-auto px-3 py-6 sm:px-5 lg:px-4"
          }
        >
          {children}
        </div>

        <nav className="grid grid-cols-3 gap-2 border-t border-slate-200 bg-white/95 p-3 lg:hidden dark:border-white/10 dark:bg-[#0c1424]/95">
          {portalNavigation.slice(0, 3).map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/portal"
                ? currentView === "inicio"
                : item.href.includes(`view=${currentView}`);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold ${active ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </main>

      <FirstAccessPasswordDialog
        isVisible={user.forcePasswordReset}
        userName={user.nome}
      />
    </div>
  );
}
function PortalNotificationPanel({
  feed,
  isLoading,
  unreadCount,
  onOpenSupport,
}: {
  feed: PortalFeedItem[];
  isLoading: boolean;
  unreadCount: number;
  onOpenSupport: () => void;
}) {
  return (
    <div className="fixed right-4 top-[76px] z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#0e1728] dark:shadow-black/40 sm:right-7">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
        <div>
          <p className="font-display text-sm font-bold text-slate-950 dark:text-white">
            Notificações
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chamados, pedidos, estoque e faturas
          </p>
        </div>
        <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-200">
          {unreadCount} nova(s)
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-2">
        {isLoading && feed.length === 0 ? (
          <div className="flex min-h-[150px] items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-violet-500" />
          </div>
        ) : feed.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
              <Bell className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
              Tudo em dia
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Novidades sobre seus pedidos, chamados e estoque aparecerão aqui.
            </p>
          </div>
        ) : (
          feed.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onOpen}
              className={`group flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-cyan-50 dark:hover:bg-white/5 ${
                !item.lida ? "bg-cyan-50/50 dark:bg-white/[0.04]" : ""
              }`}
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-200">
                {item.icon}
                {item.badgeCount ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                    {item.badgeCount > 9 ? "9+" : item.badgeCount}
                  </span>
                ) : !item.lida ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0e1728]" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {item.eyebrow ? (
                    <>
                      <span className="truncate text-xs font-extrabold text-cyan-700 dark:text-cyan-200">
                        {item.eyebrow}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                    </>
                  ) : null}
                  <span className="text-[11px] font-semibold text-slate-400">
                    {formatNotificationAge(item.createdAtIso)}
                  </span>
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-slate-950 dark:text-white">
                  {item.title}
                </span>
                <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {item.subtitle}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
      {feed.length > 0 ? (
        <button
          type="button"
          onClick={onOpenSupport}
          className="flex w-full items-center justify-center border-t border-slate-100 px-4 py-3 text-xs font-extrabold text-violet-600 transition hover:bg-violet-50 dark:border-white/10 dark:text-violet-200 dark:hover:bg-white/5"
        >
          Ver chamados de suporte
        </button>
      ) : null}
    </div>
  );
}

function formatNotificationAge(value?: string) {
  if (!value) return "agora";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}
