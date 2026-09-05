"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ClipboardList, Maximize2, MessageCircle, Minimize2, PackageX, Truck, X } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAppNotifications, type AppNotification } from "@/hooks/use-app-notifications";
import { useSupportUnreadCounts } from "@/components/support/use-support-notifications";

type FeedItem = {
  key: string;
  icon: React.ReactNode;
  title: string;
  preview: string;
  createdAtIso: string;
  lida: boolean;
  onOpen: () => void;
};

const TYPE_ICON: Record<AppNotification["tipo"], React.ReactNode> = {
  ROMANEIO_LIBERADO: <Truck className="h-4 w-4" />,
  QUARENTENA_CRIADA: <PackageX className="h-4 w-4" />,
  INVENTARIO_DIVERGENTE: <ClipboardList className="h-4 w-4" />,
};

export function NotificationBell() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const { notifications, unreadCount, markRead, markAllRead } = useAppNotifications();
  const { notifications: supportNotifications, unreadCount: supportUnreadCount, markRead: markSupportRead } =
    useSupportUnreadCounts();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setExpanded(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function closePanel() {
    setOpen(false);
    setExpanded(false);
  }

  if (!mounted) {
    return <div className="h-[32px] w-[32px]" />;
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  const feed: FeedItem[] = [
    ...notifications.map((item): FeedItem => ({
      key: `n-${item.id}`,
      icon: TYPE_ICON[item.tipo] ?? <Bell className="h-4 w-4" />,
      title: item.titulo,
      preview: item.mensagem,
      createdAtIso: item.criadoEmIso,
      lida: item.lida,
      onOpen: () => {
        markRead(item.id);
        closePanel();
        if (item.link) router.push(item.link);
      },
    })),
    ...supportNotifications.map((item): FeedItem => ({
      key: `s-${item.ticketId}`,
      icon: <MessageCircle className="h-4 w-4" />,
      title: `${item.ticketNumber} · ${item.title}`,
      preview: `${item.author}: ${item.preview}`,
      createdAtIso: item.createdAt,
      lida: false,
      onOpen: () => {
        markSupportRead(item.ticketId);
        closePanel();
        router.push(`/suporte?chamado=${item.ticketId}`);
      },
    })),
  ].sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime());

  const totalUnread = unreadCount + supportUnreadCount;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setExpanded(false);
        }}
        title="Notificações"
        aria-label="Notificações"
        className={cn(
          "relative flex h-[32px] w-[32px] items-center justify-center rounded-full border p-0 transition-all duration-300 ease-in-out",
          isDark
            ? "border-[#1E293B] bg-[#0A1120] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] hover:bg-[#131E32]"
            : "border-slate-200 bg-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] hover:bg-slate-100",
        )}
      >
        <Bell className={cn("h-[16px] w-[16px]", isDark ? "text-slate-300" : "text-slate-500")} />
        {totalUnread > 0 && (
          <span
            className={cn(
              "absolute right-[1px] top-[1px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 px-[3px] text-[9px] font-extrabold leading-none text-white ring-2",
              isDark ? "ring-[#0A1120]" : "ring-white",
            )}
          >
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "z-50 flex flex-col overflow-hidden shadow-xl",
            isDark ? "border-[#1E293B] bg-[#0C1424]" : "border-slate-200 bg-white",
            expanded
              // Para no começo do conteúdo, sem cobrir a sidebar fixa --
              // --sidebar-width é a mesma CSS var que o app-chrome.tsx usa
              // pra reservar o espaço dela (herdada do wrapper root, já que
              // este painel sempre renderiza dentro do <main>).
              ? "fixed inset-y-0 right-0 left-0 lg:left-[calc(var(--sidebar-width)+28px)] rounded-none border-0"
              : "absolute right-0 top-[38px] w-[340px] max-w-[90vw] rounded-xl border",
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-sm font-bold",
              isDark ? "border-b border-[#1E293B] text-slate-100" : "border-b border-slate-100 text-slate-800",
            )}
          >
            <span>Notificações</span>
            <div className="flex items-center gap-3">
              {totalUnread > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markAllRead();
                  }}
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold",
                    isDark ? "text-violet-300 hover:text-violet-200" : "text-violet-600 hover:text-violet-700",
                  )}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar tudo como lido
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                title={expanded ? "Recolher" : "Expandir"}
                aria-label={expanded ? "Recolher painel de notificações" : "Expandir painel de notificações"}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  isDark ? "text-slate-400 hover:bg-white/10 hover:text-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                )}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              {expanded && (
                <button
                  type="button"
                  onClick={closePanel}
                  title="Fechar"
                  aria-label="Fechar painel de notificações"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                    isDark ? "text-slate-400 hover:bg-white/10 hover:text-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className={cn("overflow-y-auto", expanded ? "flex-1" : "max-h-[380px]")}>
            {feed.length === 0 ? (
              <div className={cn("px-4 py-8 text-center text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                Nenhuma notificação por aqui.
              </div>
            ) : (
              feed.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onOpen}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-4 py-3 text-left text-xs transition-colors",
                    expanded && "mx-auto max-w-[720px] px-5 py-4 text-sm",
                    isDark ? "hover:bg-white/5" : "hover:bg-slate-50",
                    !item.lida && (isDark ? "bg-violet-500/[0.06]" : "bg-violet-50/60"),
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      isDark ? "bg-violet-500/15 text-violet-300" : "bg-violet-100 text-violet-600",
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-semibold", isDark ? "text-slate-100" : "text-slate-800")}>
                      {item.title}
                    </span>
                    <span className={cn("mt-0.5 block line-clamp-2", isDark ? "text-slate-400" : "text-slate-500")}>
                      {item.preview}
                    </span>
                  </span>
                  {!item.lida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
