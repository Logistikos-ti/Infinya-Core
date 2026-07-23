"use client";

import { useEffect, useState } from "react";

export function SupportNotificationBadge({
  className = "",
}: {
  className?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/suporte/notificacoes", {
          cache: "no-store",
        });
        const payload = await response.json();
        if (active && response.ok) setCount(Number(payload.unreadCount) || 0);
      } catch {
        // The badge is supplementary and should never block navigation.
      }
    };
    void load();
    const interval = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!count) return null;
  return (
    <span
      aria-label={`${count} mensagem(ns) não lida(s)`}
      className={`absolute -right-1 -top-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold leading-none text-white shadow-md shadow-rose-500/30 ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
