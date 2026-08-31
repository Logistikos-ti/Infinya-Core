"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { MobileInfinityLoader } from "@/components/mobile/mobile-kit-tokens";

const INFINOOS_HELP_URL =
  process.env.NEXT_PUBLIC_INFINOOS_HELP_URL ?? "https://help.infinoos.com.br";

// Aba "Ajuda" do Suporte — abre o Infinoos Help embutido (iframe), já
// logado via SSO, direto na fila de chamados de TI (product=WMS). Mesmo
// padrão já usado no RH (src/pages/Support.jsx): troca de tema
// bidirecional via postMessage e um "ready" handshake pra só trocar o
// loader pelo iframe quando ele já chegou na página final.
export function HelpEmbed({
  nextPath = "/chamados?product=WMS&embed=1",
}: {
  nextPath?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const themeFromIframe = useRef(false);

  useEffect(() => setMounted(true), []);

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== new URL(INFINOOS_HELP_URL).origin) return;
      if (e.data?.source !== "infinoos-help") return;
      if (e.data.type === "ready") {
        setReady(true);
        return;
      }
      if (e.data.type === "theme") {
        const incoming = e.data.theme;
        if (incoming !== "light" && incoming !== "dark") return;
        if (incoming === currentTheme) return;
        themeFromIframe.current = true;
        setTheme(incoming);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentTheme, setTheme]);

  useEffect(() => {
    if (!mounted) return;
    if (themeFromIframe.current) {
      themeFromIframe.current = false;
      return;
    }
    let cancelled = false;
    setReady(false);
    fetch("/api/sign-help-token", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.token) {
          setError("Não foi possível carregar a Ajuda agora.");
          return;
        }
        const next = encodeURIComponent(nextPath);
        setUrl(
          `${INFINOOS_HELP_URL}/sso?token=${encodeURIComponent(data.token)}&next=${next}&theme=${isDark ? "dark" : "light"}`,
        );
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar a Ajuda agora.");
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, isDark, nextPath]);

  if (!mounted) return null;

  if (error) {
    return (
      <div className="flex h-[60dvh] items-center justify-center">
        <span className="text-sm text-rose-500">{error}</span>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden rounded-2xl border border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-[#070c1d]">
          <MobileInfinityLoader />
        </div>
      )}
      {url && (
        <iframe
          src={url}
          title="Infinoos Help"
          className="block h-full w-full border-0"
          style={{ opacity: ready ? 1 : 0 }}
        />
      )}
    </div>
  );
}
