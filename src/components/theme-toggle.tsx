"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
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
        "relative w-[68px] h-[32px] p-0 rounded-full cursor-pointer transition-colors duration-300 ease-in-out border",
        isDark 
          ? "bg-slate-800 border-slate-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]" 
          : "bg-slate-200 border-slate-300 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]"
      )}
    >
      <Moon 
        className={cn(
          "absolute top-1/2 left-[12px] -translate-y-1/2 w-3 h-3 transition-colors duration-300 ease-in-out",
          isDark ? "text-slate-400" : "text-slate-400/40"
        )} 
      />
      <Sun 
        className={cn(
          "absolute top-1/2 right-[12px] -translate-y-1/2 w-3 h-3 transition-colors duration-300 ease-in-out",
          !isDark ? "text-amber-500" : "text-slate-400/40"
        )} 
      />
      <div 
        className={cn(
          "absolute top-[3px] left-[3px] w-[24px] h-[24px] flex items-center justify-center rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.35)] transition-transform duration-[320ms] ease-[cubic-bezier(0.4,1.3,0.5,1)]",
          isDark 
            ? "translate-x-[36px] bg-slate-900 text-slate-200" 
            : "translate-x-0 bg-white text-slate-600"
        )}
      >
        {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </div>
    </button>
  );
}
