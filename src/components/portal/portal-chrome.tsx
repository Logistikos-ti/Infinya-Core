"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  CircleHelp,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Package,
  PackageCheck,
  Receipt,
  Search,
  ShieldAlert,
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
import type { AppUserContext } from "@/lib/auth";
import { isPortalIntegrationEnabled } from "@/lib/portal-integration-access";

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
  const portalNavigation = getPortalNavigation(user);
  const isMasterPreview = user.papel === "ADMIN" || user.papel === "TI";
  const selectedDepositanteId = searchParams.get("depositanteId") ?? "";
  const unreadNotifications = notifications.reduce(
    (sum, notification) => sum + Number(notification.unreadCount || 0),
    0,
  );

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

  async function openNotification(notification: PortalNotification) {
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

  return (
    <div
      style={style}
      className="flex min-h-screen w-full overflow-hidden bg-[#f5f7fb] text-slate-900 dark:bg-[#0a1120] dark:text-slate-100"
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
        <header className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1424]/80 sm:flex-nowrap sm:px-7 sm:py-0">
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
              notifications={notifications}
              isLoading={notificationsLoading}
              unreadCount={unreadNotifications}
              onOpenNotification={openNotification}
              onOpenSupport={() => navigate("/portal?view=suporte")}
            />
          ) : null}
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-5 lg:px-4">
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
  notifications,
  isLoading,
  unreadCount,
  onOpenNotification,
  onOpenSupport,
}: {
  notifications: PortalNotification[];
  isLoading: boolean;
  unreadCount: number;
  onOpenNotification: (notification: PortalNotification) => void;
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
            Mensagens novas dos chamados
          </p>
        </div>
        <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-200">
          {unreadCount} nova(s)
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-2">
        {isLoading && notifications.length === 0 ? (
          <div className="flex min-h-[150px] items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-violet-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
              <Bell className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
              Tudo em dia
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Novas respostas da equipe Infinoos aparecerão aqui.
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.ticketId}
              type="button"
              onClick={() => onOpenNotification(notification)}
              className="group flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-cyan-50 dark:hover:bg-white/5"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-200">
                <MessageCircle className="h-4 w-4" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                  {notification.unreadCount > 9
                    ? "9+"
                    : notification.unreadCount}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs font-extrabold text-cyan-700 dark:text-cyan-200">
                    {notification.ticketNumber}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-[11px] font-semibold text-slate-400">
                    {formatNotificationAge(notification.createdAt)}
                  </span>
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-slate-950 dark:text-white">
                  {notification.title}
                </span>
                <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {notification.author}: {notification.preview}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
      {notifications.length > 0 ? (
        <button
          type="button"
          onClick={onOpenSupport}
          className="flex w-full items-center justify-center border-t border-slate-100 px-4 py-3 text-xs font-extrabold text-violet-600 transition hover:bg-violet-50 dark:border-white/10 dark:text-violet-200 dark:hover:bg-white/5"
        >
          Ver todos os chamados
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
