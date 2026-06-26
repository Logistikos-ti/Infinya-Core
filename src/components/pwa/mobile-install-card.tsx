"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function MobileInstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => isStandaloneMode());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("infinya-mobile-install-dismissed") === "true";
  });
  const ios = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed || dismissed) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("infinya-mobile-install-dismissed", "true");
    }
  };

  const install = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;

    if (result.outcome === "accepted") {
      setInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <section className="rounded-[24px] border border-cyan-400/25 bg-gradient-to-br from-cyan-400/10 via-fuchsia-400/10 to-white/5 p-4 shadow-[0_18px_50px_rgba(34,211,238,0.08)] backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-infinya-gradient p-3 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
          <Smartphone className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Webapp instalável
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Instale o Infinya • Log no celular
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Abra como aplicativo, com acesso rápido pela tela inicial e experiência mais fluida na operação.
          </p>

          {deferredPrompt ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex items-center gap-2 rounded-2xl bg-infinya-gradient px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
              >
                <Download className="h-4 w-4" />
                Instalar agora
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300"
              >
                Depois
              </button>
            </div>
          ) : ios ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              No iPhone/iPad, use o menu do navegador e toque em <strong>Adicionar à Tela de Início</strong>.
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Se o navegador ainda não mostrar o botão de instalar, continue navegando no mobile por alguns segundos e tente novamente pelo menu do navegador.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
