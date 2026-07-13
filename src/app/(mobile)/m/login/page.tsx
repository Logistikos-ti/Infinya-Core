import { redirect } from "next/navigation";
import { LoginForm, ThemeToggle } from "@/components/auth/login-form";
import { MobileInstallCard } from "@/components/pwa/mobile-install-card";
import { getCurrentUserContext } from "@/lib/auth";
import { getDefaultMobileRoute } from "@/lib/mobile";
import Image from "next/image";
import { Manrope, Space_Grotesk } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export default async function MobileLoginPage() {
  const user = await getCurrentUserContext();

  if (user && user.ativo) {
    redirect(getDefaultMobileRoute(user));
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes floatGlow {
              0%, 100% { transform: translateY(0px); opacity: 0.85; }
              50% { transform: translateY(-10px); opacity: 1; }
            }
            @keyframes pulseRing {
              0% { transform: scale(1); opacity: 0.35; }
              100% { transform: scale(1.6); opacity: 0; }
            }
            @keyframes gridPan {
              0% { background-position: 0 0, 0 0; }
              100% { background-position: 48px 48px, 48px 48px; }
            }
            @keyframes scanSweep {
              0% { transform: translateY(-40%); opacity: 0; }
              12% { opacity: 1; }
              88% { opacity: 1; }
              100% { transform: translateY(140%); opacity: 0; }
            }
            @keyframes driftA {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(40px, -30px); }
            }
            @keyframes driftB {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(-36px, 34px); }
            }
            @keyframes nodeBlink {
              0%, 100% { opacity: 0.25; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.15); }
            }
            @keyframes orbA {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(30px, -40px); }
            }
            @keyframes orbB {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(-34px, 28px); }
            }
            @keyframes orbC {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(24px, 36px); }
            }
            @keyframes riseUp {
              0% { transform: translateY(0); opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateY(-102vh); opacity: 0; }
            }
            
            .brand-panel-bg {
              background: radial-gradient(120% 90% at 20% 10%, #E8ECFA 0%, #DCE3F7 45%, #CFD8F2 100%);
            }
            .dark .brand-panel-bg {
              background: radial-gradient(120% 90% at 20% 10%, #101B33 0%, #0A1122 45%, #070C1A 100%);
            }
            .grid-overlay {
              background-image: linear-gradient(rgba(71,85,105,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(71,85,105,0.1) 1px, transparent 1px);
            }
            .dark .grid-overlay {
              background-image: linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px);
            }
          `,
        }}
      />
      <main
        className={`flex min-h-[100dvh] flex-col overflow-y-auto bg-[#FBFCFE] dark:bg-[#0D1526] transition-colors duration-300 ${manrope.variable} ${space.variable} font-manrope m-0 p-0 relative`}
      >
        <ThemeToggle />

        {/* ============ PAINEL DE MARCA (Topo) ============ */}
        <div className="w-full relative flex flex-col items-center justify-center p-8 pt-16 brand-panel-bg overflow-hidden transition-all duration-300 border-b border-slate-200/50 dark:border-white/5">
          
          {/* brilhos de fundo animados */}
          <div className="absolute w-[320px] h-[320px] -left-[80px] -bottom-[100px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 70%)", animation: "driftA 14s ease-in-out infinite" }} />
          <div className="absolute w-[260px] h-[260px] -right-[60px] -top-[80px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 70%)", animation: "driftB 17s ease-in-out infinite" }} />
          
          {/* grade tecnológica em movimento */}
          <div className="absolute -inset-12 grid-overlay bg-[length:48px_48px] pointer-events-none" style={{ animation: "gridPan 6s linear infinite", maskImage: "radial-gradient(120% 100% at 50% 50%, #000 30%, transparent 90%)", WebkitMaskImage: "radial-gradient(120% 100% at 50% 50%, #000 30%, transparent 90%)" }} />
          
          {/* linha de varredura */}
          <div className="absolute left-0 right-0 h-[100px] pointer-events-none transition-colors duration-300 bg-gradient-to-b from-transparent via-[rgba(99,102,241,0.12)] dark:via-[rgba(96,165,250,0.10)] to-transparent" style={{ animation: "scanSweep 7s ease-in-out infinite" }} />
          
          {/* rede de nós + conexões */}
          <svg viewBox="0 0 400 400" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none opacity-85">
            <circle cx="50" cy="80" r="4" fill="#60A5FA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite, orbA 13s ease-in-out infinite" }} />
            <circle cx="150" cy="40" r="3" fill="#A78BFA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 0.6s, orbB 16s ease-in-out infinite" }} />
            <circle cx="300" cy="110" r="5" fill="#60A5FA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 1.2s, orbC 15s ease-in-out infinite" }} />
            <circle cx="200" cy="230" r="3" fill="#A78BFA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 1.8s, orbA 18s ease-in-out infinite 1s" }} />
            <circle cx="70" cy="280" r="4" fill="#60A5FA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 2.4s, orbB 14s ease-in-out infinite 2s" }} />
            <circle cx="320" cy="300" r="3" fill="#A78BFA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 0.9s, orbA 17s ease-in-out infinite 2.5s" }} />
          </svg>
          
          {/* partículas subindo */}
          <div className="absolute left-[12%] bottom-0 w-1 h-1 rounded-full bg-[#60A5FA] shadow-[0_0_8px_#60A5FA] pointer-events-none" style={{ animation: "riseUp 9s linear infinite" }} />
          <div className="absolute left-[34%] bottom-0 w-[3px] h-[3px] rounded-full bg-[#A78BFA] shadow-[0_0_8px_#A78BFA] pointer-events-none" style={{ animation: "riseUp 11s linear infinite 2s" }} />
          <div className="absolute left-[78%] bottom-0 w-[3px] h-[3px] rounded-full bg-[#60A5FA] shadow-[0_0_8px_#60A5FA] pointer-events-none" style={{ animation: "riseUp 12s linear infinite 3s" }} />

          {/* topo: lockup */}
          <div className="relative flex flex-col gap-0.5 text-center mb-6">
            <span className="font-space text-[11px] font-semibold tracking-[0.42em] text-[#4B5578] dark:text-[#94A3B8] transition-colors duration-300">INFINOOS</span>
            <span className="font-space text-[20px] font-bold leading-none bg-gradient-to-r from-[#60A5FA] to-[#A78BFA] bg-clip-text text-transparent">WMS MOBILE</span>
          </div>

          {/* centro: ícone flutuante */}
          <div className="relative flex flex-col items-center gap-6">
            <div className="relative w-[100px] h-[100px]">
              <div className="absolute inset-0 rounded-[28px] border border-violet-500/35" style={{ animation: "pulseRing 2.8s ease-out infinite" }} />
              <div className="absolute inset-0 rounded-[28px] shadow-[0_16px_48px_rgba(99,102,241,0.40),0_0_32px_rgba(139,92,246,0.30)]" style={{ animation: "floatGlow 5s ease-in-out infinite" }}>
                <Image
                  src="/branding/login-icon.png"
                  alt="Infinoos Logo Icon"
                  fill
                  className="object-cover rounded-[28px]"
                />
              </div>
            </div>
            <div className="text-center space-y-1 z-10">
              <h1 className="m-0 font-space text-[28px] font-bold leading-[1.15] text-[#1E2545] dark:text-[#F1F5F9] transition-colors duration-300 text-pretty">
                Seu armazém,<br />sem limites.
              </h1>
              <p className="m-0 text-[14px] font-medium leading-[1.6] text-[#4B5578] dark:text-[#94A3B8] transition-colors duration-300 text-pretty px-4">
                Operações de recebimento, separação e conferência direto no coletor.
              </p>
            </div>
          </div>
        </div>

        {/* ============ PAINEL DO FORMULÁRIO (Baixo) ============ */}
        <div className="flex-1 w-full relative flex flex-col items-center pt-8 px-6 pb-8 transition-colors duration-300 z-10 bg-gradient-to-b from-[#FBFCFE] to-transparent dark:from-[#0D1526] dark:to-transparent">
          <div className="w-full max-w-[400px] mb-6">
            <MobileInstallCard />
          </div>

          <div className="w-full">
            <LoginForm redirectTo="/m/inicio" submitLabel="Entrar no mobile" />
          </div>

          <p className="m-0 mt-8 flex-shrink-0 text-[11px] text-slate-400 dark:text-slate-500 font-medium transition-colors text-center w-full">
            Infinoos WMS Mobile © 2026 · <span className="cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Status do sistema</span>
          </p>
        </div>
      </main>
    </>
  );
}
