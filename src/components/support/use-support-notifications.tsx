"use client";

import { MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function useSupportUnreadCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/suporte/notificacoes", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (response.ok) setCounts(payload.unreadByTicket ?? {});
    } catch {
      // Notifications are supplementary and should never block the support screen.
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const markRead = useCallback((ticketId: string) => {
    setCounts((current) => ({ ...current, [ticketId]: 0 }));
    void fetch(`/api/suporte/chamados/${ticketId}/leitura`, { method: "POST" });
  }, []);

  return { counts, markRead };
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
