"use client";

import * as React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function SoundToggle() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("wms-sound-enabled");
    if (saved !== null) {
      setSoundEnabled(saved === "true");
    }

    const handleStorageChange = () => {
      const current = localStorage.getItem("wms-sound-enabled");
      if (current !== null) {
        setSoundEnabled(current === "true");
      }
    };

    window.addEventListener("sound-preference-changed", handleStorageChange);
    return () => window.removeEventListener("sound-preference-changed", handleStorageChange);
  }, []);

  if (!mounted) {
    return <div className="w-[32px] h-[32px]" />;
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("wms-sound-enabled", String(next));
    window.dispatchEvent(new Event("sound-preference-changed"));
  };

  return (
    <button
      onClick={toggleSound}
      title={soundEnabled ? "Desativar som" : "Ativar som"}
      aria-label="Alternar som"
      className={cn(
        "relative w-[32px] h-[32px] flex items-center justify-center p-0 rounded-full cursor-pointer transition-all duration-300 ease-in-out border",
        isDark 
          ? "bg-[#0A1120] border-[#1E293B] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] hover:bg-[#131E32]" 
          : "bg-slate-100 border-slate-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] hover:bg-slate-200"
      )}
    >
      {soundEnabled ? (
        <Volume2 className={cn("w-[16px] h-[16px]", isDark ? "text-emerald-400" : "text-emerald-600")} />
      ) : (
        <VolumeX className={cn("w-[16px] h-[16px]", isDark ? "text-red-400" : "text-red-600")} />
      )}
    </button>
  );
}
