"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RealtimeRefreshTarget = {
  table: string;
  schema?: string;
  filter?: string;
};

type UseRealtimeRefreshOptions = {
  debounceMs?: number;
  enabled?: boolean;
};

const DEFAULT_DEBOUNCE_MS = 500;

// Atualiza a tela sozinha quando outro usuário/processo muda os dados por
// trás dela -- sem isso, cada aba só vê dado novo depois de navegar de novo
// ou apertar F5 (revalidatePath/router.refresh hoje só roda na aba de quem
// fez a própria ação). Não tenta reconciliar o payload do evento -- só usa a
// notificação de mudança pra disparar router.refresh() (debounced), que
// reaproveita o fetch normal da Server Component da página. Segurança fica
// por conta da RLS de cada tabela (mesma política que já vale pra SELECT
// via REST); isso aqui só decide QUANDO reconsultar, não O QUE cada um vê.
export function useRealtimeRefresh(
  targets: RealtimeRefreshTarget | RealtimeRefreshTarget[],
  { debounceMs = DEFAULT_DEBOUNCE_MS, enabled = true }: UseRealtimeRefreshOptions = {},
) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const targetList = Array.isArray(targets) ? targets : [targets];
  const targetListRef = useRef(targetList);
  useEffect(() => {
    targetListRef.current = targetList;
  });
  const targetsKey = targetList
    .map((target) => `${target.schema ?? "public"}.${target.table}:${target.filter ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!enabled || !targetsKey) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        routerRef.current.refresh();
      }, debounceMs);
    };

    let channel = supabase.channel(`realtime-refresh:${targetsKey}`);
    for (const target of targetListRef.current) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: target.schema ?? "public",
          table: target.table,
          ...(target.filter ? { filter: target.filter } : {}),
        },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [targetsKey, debounceMs, enabled]);
}
