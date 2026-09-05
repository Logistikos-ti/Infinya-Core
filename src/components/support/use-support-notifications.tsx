"use client";

import { MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type SupportTicketNotification = {
  ticketId: string;
  ticketNumber: string;
  title: string;
  preview: string;
  author: string;
  createdAt: string;
};

export function useSupportUnreadCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<SupportTicketNotification[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/suporte/notificacoes?refresh=${Date.now()}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        },
      );
      const payload = await response.json();
      if (response.ok) {
        setCounts(payload.unreadByTicket ?? {});
        setUnreadCount(payload.unreadCount ?? 0);
        setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      }
    } catch {
      // Notifications are supplementary and should never block the support screen.
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  // Realtime: reage na hora a mudanças de chamados/comentários/leituras em
  // vez de esperar o próximo poll -- o setInterval acima continua rodando
  // como rede de segurança caso o websocket caia. Mesmo padrão de
  // debounce/cleanup do useRealtimeRefresh compartilhado
  // (src/hooks/use-realtime-refresh.ts), mas chamando `load()` (fetch
  // client-side) em vez de router.refresh(), já que este hook não vive
  // numa página Server Component.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleLoad = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void loadRef.current();
      }, 500);
    };

    // Sufixo aleatório -- evita a colisão "cannot add postgres_changes
    // callbacks... after subscribe()" quando o Strict Mode (dev) ou uma
    // remontagem rápida cria um novo canal antes do anterior terminar de se
    // desinscrever (mesmo fix aplicado em use-app-notifications.ts).
    const channel = supabase
      .channel(`support-notifications-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suporte_chamados" },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suporte_comentarios" },
        scheduleLoad,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "suporte_leituras" },
        scheduleLoad,
      )
      .subscribe();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      supabase.removeChannel(channel);
    };
  }, []);

  const markRead = useCallback((ticketId: string) => {
    setCounts((current) => ({ ...current, [ticketId]: 0 }));
    setNotifications((current) => current.filter((item) => item.ticketId !== ticketId));
    setUnreadCount((current) => Math.max(0, current - 1));
    void fetch(`/api/suporte/chamados/${ticketId}/leitura`, { method: "POST" });
  }, []);

  return { counts, unreadCount, notifications, markRead };
}

export function UnreadMessageBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300">
      <MessageCircle className="h-4 w-4" />
      <span className="absolute -right-1 -top-1 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold leading-none text-white shadow-sm shadow-rose-500/30">
        {count > 99 ? "99+" : count}
      </span>
    </span>
  );
}
