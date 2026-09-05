"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AppNotification = {
  id: string;
  tipo:
    | "ROMANEIO_LIBERADO"
    | "QUARENTENA_CRIADA"
    | "INVENTARIO_DIVERGENTE"
    | "RECEBIMENTO_CONCLUIDO"
    | "RECEBIMENTO_DIVERGENTE"
    | "EXPEDICAO_CANCELAMENTO_ABERTO"
    | "EXPEDICAO_DIVERGENTE"
    | "FATURA_GERADA"
    | "FATURA_VENCIDA"
    | "ESTOQUE_BAIXO";
  titulo: string;
  mensagem: string;
  link: string | null;
  criadoEm: string;
  criadoEmIso: string;
  lida: boolean;
};

// Mesmo padrão de use-support-notifications.tsx (polling + Realtime com
// debounce) -- essa aqui cobre os tipos genéricos (romaneio liberado,
// quarentena, inventário divergente), não os chamados de suporte, que já
// têm seu próprio sistema de não-lidos.
export function useAppNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/notificacoes?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const payload = await response.json();
      if (response.ok) {
        setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
        setUnreadCount(payload.unreadCount ?? 0);
      }
    } catch {
      // Notificações são supletivas -- nunca devem travar a tela.
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, [load]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void loadRef.current(), 500);
    };

    // Nome do tópico com sufixo aleatório -- evita a colisão "cannot add
    // postgres_changes callbacks... after subscribe()" quando o Strict Mode
    // (dev) ou uma remontagem rápida entre páginas cria um novo canal antes
    // do anterior terminar de se desinscrever (o cliente Supabase reaproveita
    // um canal existente pelo nome do tópico, mesmo em processo de remoção).
    const channel = supabase
      .channel(`app-notifications-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes_leituras" }, scheduleLoad)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, lida: true } : item)));
    setUnreadCount((current) => Math.max(0, current - 1));
    void fetch(`/api/notificacoes/${id}/leitura`, { method: "POST" });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, lida: true })));
    setUnreadCount(0);
    void fetch("/api/notificacoes/marcar-todas", { method: "POST" });
  }, []);

  return { notifications, unreadCount, markRead, markAllRead };
}
