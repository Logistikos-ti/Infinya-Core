"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-[68px] h-[32px]" />;
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Alternar tema"
      aria-label="Alternar tema"
      className={cn(
        "relative w-[68px] h-[32px] p-0 rounded-full cursor-pointer transition-all duration-300 ease-in-out border",
        isDark 
          ? "bg-[#0A1120] border-[#1E293B] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]" 
          : "bg-slate-100 border-slate-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]"
      )}
    >
      {/* Background Track Icons */}
      <Moon 
        className={cn(
          "absolute top-1/2 left-[12px] -translate-y-1/2 w-[14px] h-[14px] transition-all duration-300 ease-in-out",
          isDark ? "opacity-0" : "text-slate-400 opacity-100"
        )} 
      />
      <Sun 
        className={cn(
          "absolute top-1/2 right-[12px] -translate-y-1/2 w-[14px] h-[14px] transition-all duration-300 ease-in-out",
          !isDark ? "opacity-0" : "text-slate-600 opacity-100"
        )} 
      />

      {/* Sliding Knob */}
      <div 
        className={cn(
          "absolute top-[3px] left-[3px] w-[24px] h-[24px] flex items-center justify-center rounded-full transition-all duration-[320ms] ease-[cubic-bezier(0.4,1.3,0.5,1)]",
          isDark 
            ? "translate-x-0 bg-[#131E32] shadow-[0_1px_4px_rgba(0,0,0,0.5)] border border-white/5" 
            : "translate-x-[36px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.15)] border border-slate-100"
        )}
      >
        {/* Knob Icons */}
        <Moon 
          className={cn(
            "absolute w-3.5 h-3.5 transition-all duration-300",
            isDark ? "text-blue-500 opacity-100 scale-100" : "text-transparent opacity-0 scale-50"
          )} 
        />
        <Sun 
          className={cn(
            "absolute w-3.5 h-3.5 transition-all duration-300",
            !isDark ? "text-amber-500 opacity-100 scale-100" : "text-transparent opacity-0 scale-50"
          )} 
        />
      </div>
    </button>
  );
}
