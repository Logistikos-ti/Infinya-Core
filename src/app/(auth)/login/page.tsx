import { redirect } from "next/navigation";
import { LoginForm, ThemeToggle } from "@/components/auth/login-form";
import { getCurrentUserContext } from "@/lib/auth";
import { getPreferredWebRoute } from "@/lib/permissions";
import Image from "next/image";
import { Manrope, Space_Grotesk } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export default async function LoginPage() {
  const user = await getCurrentUserContext();

  if (user) {
    redirect(getPreferredWebRoute(user));
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
        className={`flex w-full h-screen overflow-hidden bg-[#F4F6FB] dark:bg-[#070C1A] transition-colors duration-300 ${manrope.variable} ${space.variable} font-manrope m-0 p-0`}
      >
        {/* ============ PAINEL DE MARCA (esquerda) ============ */}
        <div className="flex-1 lg:flex-[1.1] min-w-0 relative hidden lg:flex flex-col justify-between p-12 xl:p-14 brand-panel-bg overflow-hidden transition-all duration-300">
          
          {/* brilhos de fundo animados */}
          <div className="absolute w-[520px] h-[520px] -left-[140px] -bottom-[180px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(139,92,246,0) 70%)", animation: "driftA 14s ease-in-out infinite" }} />
          <div className="absolute w-[460px] h-[460px] -right-[120px] -top-[140px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.28) 0%, rgba(59,130,246,0) 70%)", animation: "driftB 17s ease-in-out infinite" }} />
          
          {/* grade tecnológica em movimento */}
          <div className="absolute -inset-12 grid-overlay bg-[length:48px_48px] pointer-events-none" style={{ animation: "gridPan 6s linear infinite", maskImage: "radial-gradient(120% 100% at 30% 20%, #000 30%, transparent 90%)", WebkitMaskImage: "radial-gradient(120% 100% at 30% 20%, #000 30%, transparent 90%)" }} />
          
          {/* linha de varredura */}
          <div className="absolute left-0 right-0 h-[180px] pointer-events-none transition-colors duration-300 bg-gradient-to-b from-transparent via-[rgba(99,102,241,0.12)] dark:via-[rgba(96,165,250,0.10)] to-transparent" style={{ animation: "scanSweep 7s ease-in-out infinite" }} />
          
          {/* rede de nós + conexões */}
          <svg viewBox="0 0 600 800" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none opacity-85">
            <circle cx="70" cy="150" r="5" fill="#60A5FA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite, orbA 13s ease-in-out infinite" }} />
            <circle cx="260" cy="90" r="4" fill="#A78BFA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 0.6s, orbB 16s ease-in-out infinite" }} />
            <circle cx="500" cy="210" r="6" fill="#60A5FA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 1.2s, orbC 15s ease-in-out infinite" }} />
            <circle cx="400" cy="430" r="4" fill="#A78BFA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 1.8s, orbA 18s ease-in-out infinite 1s" }} />
            <circle cx="120" cy="520" r="5" fill="#60A5FA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 2.4s, orbB 14s ease-in-out infinite 2s" }} />
            <circle cx="320" cy="300" r="3" fill="#818CF8" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 1.5s, orbC 12s ease-in-out infinite 0.5s" }} />
            <circle cx="540" cy="600" r="4" fill="#A78BFA" style={{ animation: "nodeBlink 3.2s ease-in-out infinite 0.9s, orbA 17s ease-in-out infinite 2.5s" }} />
          </svg>
          
          {/* partículas subindo */}
          <div className="absolute left-[12%] bottom-0 w-1 h-1 rounded-full bg-[#60A5FA] shadow-[0_0_10px_#60A5FA] pointer-events-none" style={{ animation: "riseUp 9s linear infinite" }} />
          <div className="absolute left-[34%] bottom-0 w-[3px] h-[3px] rounded-full bg-[#A78BFA] shadow-[0_0_10px_#A78BFA] pointer-events-none" style={{ animation: "riseUp 11s linear infinite 2s" }} />
          <div className="absolute left-[58%] bottom-0 w-[5px] h-[5px] rounded-full bg-[#818CF8] shadow-[0_0_10px_#818CF8] pointer-events-none" style={{ animation: "riseUp 8s linear infinite 1s" }} />
          <div className="absolute left-[78%] bottom-0 w-[3px] h-[3px] rounded-full bg-[#60A5FA] shadow-[0_0_10px_#60A5FA] pointer-events-none" style={{ animation: "riseUp 12s linear infinite 3s" }} />

          {/* topo: lockup */}
          <div className="relative flex flex-col gap-0.5">
            <span className="font-space text-[13px] font-semibold tracking-[0.42em] text-[#4B5578] dark:text-[#94A3B8] transition-colors duration-300">INFINOOS</span>
            <span className="font-space text-[24px] font-bold leading-none bg-gradient-to-r from-[#60A5FA] to-[#A78BFA] bg-clip-text text-transparent">WMS</span>
          </div>

          {/* centro: ícone flutuante + headline */}
          <div className="relative flex flex-col items-start gap-7 max-w-[480px]">
            <div className="relative w-[148px] h-[148px]">
              <div className="absolute inset-0 rounded-[36px] border border-violet-500/35" style={{ animation: "pulseRing 2.8s ease-out infinite" }} />
              <div className="absolute inset-0 rounded-[36px] shadow-[0_24px_64px_rgba(99,102,241,0.45),0_0_48px_rgba(139,92,246,0.35)]" style={{ animation: "floatGlow 5s ease-in-out infinite" }}>
                <Image
                  src="/branding/login-icon.png"
                  alt="Infinoos Logo Icon"
                  fill
                  className="object-cover rounded-[36px]"
                />
              </div>
            </div>
            <h1 className="m-0 font-space text-[40px] font-bold leading-[1.15] text-[#1E2545] dark:text-[#F1F5F9] transition-colors duration-300 text-pretty">
              Seu armazém,<br />sem limites.
            </h1>
            <p className="m-0 text-[17px] leading-[1.6] text-[#4B5578] dark:text-[#94A3B8] transition-colors duration-300 text-pretty">
              Recebimento, endereçamento, picking e expedição em uma plataforma única — do chão do armazém à diretoria.
            </p>
          </div>

          {/* rodapé: destaques */}
          <div className="relative flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-500/20 dark:border-slate-400/15 bg-white/60 dark:bg-slate-900/50 text-[13px] font-semibold text-[#4B5578] dark:text-[#94A3B8] backdrop-blur-md transition-colors duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399]" />
              Operação em tempo real
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-500/20 dark:border-slate-400/15 bg-white/60 dark:bg-slate-900/50 text-[13px] font-semibold text-[#4B5578] dark:text-[#94A3B8] backdrop-blur-md transition-colors duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] shadow-[0_0_8px_#60A5FA]" />
              Coletores integrados
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-500/20 dark:border-slate-400/15 bg-white/60 dark:bg-slate-900/50 text-[13px] font-semibold text-[#4B5578] dark:text-[#94A3B8] backdrop-blur-md transition-colors duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] shadow-[0_0_8px_#A78BFA]" />
              Portal do cliente
            </div>
          </div>
        </div>

        {/* ============ PAINEL DO FORMULÁRIO (direita) ============ */}
        <div className="flex-1 min-w-0 relative flex flex-col items-center justify-between pt-24 px-8 pb-6 lg:px-12 bg-[#FBFCFE] dark:bg-[#0D1526] transition-colors duration-300 overflow-y-auto">
          <ThemeToggle />

          <LoginForm />

          <p className="m-0 mt-8 flex-shrink-0 text-[12px] text-slate-400 dark:text-slate-500 font-medium transition-colors">
            Infinoos WMS © 2026 · v2.4 · <span className="cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Status do sistema</span>
          </p>
        </div>
      </main>
    </>
  );
}
