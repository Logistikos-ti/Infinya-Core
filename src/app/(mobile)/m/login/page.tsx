import { redirect } from "next/navigation";
import { MobileLoginForm } from "@/components/auth/mobile-login-form";
import { MobileInstallCard } from "@/components/pwa/mobile-install-card";
import { getCurrentUserContext } from "@/lib/auth";
import { getDefaultMobileRoute } from "@/lib/mobile";
import { mobileColors, headingFont, MobileIcon } from "@/components/mobile/mobile-kit-tokens";

export default async function MobileLoginPage() {
  const user = await getCurrentUserContext();

  if (user && user.ativo) {
    redirect(getDefaultMobileRoute(user));
  }

  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-6 py-10"
      style={{ background: mobileColors.pageBg, color: mobileColors.text }}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className="mb-1.5 flex h-[66px] w-[66px] items-center justify-center rounded-[20px]"
          style={{
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
            boxShadow: "0 14px 34px rgba(99,102,241,0.4)",
          }}
        >
          <span className="flex text-white">
            <MobileIcon name="scan" size={34} strokeWidth={2} />
          </span>
        </div>
        <span
          className="text-xs font-semibold"
          style={{ letterSpacing: "0.42em", color: mobileColors.dim, ...headingFont }}
        >
          INFINOOS
        </span>
        <span
          className="text-[30px] font-bold leading-none text-transparent"
          style={{
            background: "linear-gradient(90deg, #60A5FA, #A78BFA)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            ...headingFont,
          }}
        >
          WMS · Coletor
        </span>
      </div>

      <MobileLoginForm redirectTo="/m/inicio" submitLabel="Entrar na operação" />

      <div className="w-full max-w-[400px]">
        <MobileInstallCard />
      </div>

      <p className="m-0 text-center text-[11px]" style={{ color: mobileColors.dim }}>
        Infinoos WMS Mobile © 2026
      </p>
    </main>
  );
}
