"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Mesmas cores do ícone do toggle no Infinoos Help (ThemeSwitchPill.jsx).
const BRAND = "#3BB8FF";
const AMBER = "#F59E0B";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[34px] w-[74px]" />;
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Alternar tema"
      aria-label="Alternar tema"
      className={cn(
        "relative flex h-[34px] w-[74px] cursor-pointer items-center rounded-full border p-[3px] transition-all duration-300 ease-in-out",
        isDark ? "border-white/[0.08] bg-[#111634]" : "border-[#E2E8F0] bg-white",
      )}
    >
      <div className="pointer-events-none flex w-full items-center justify-between px-[7px]">
        <Moon className={cn("h-3 w-3", isDark ? "text-[#5AA7FF]" : "text-[#9A9DB8]")} />
        <Sun className={cn("h-3 w-3", isDark ? "text-[#8B96B8]" : "text-[#5B6FFF]")} />
      </div>

      <div
        className={cn(
          "absolute left-[3px] top-[3px] flex h-[28px] w-[28px] items-center justify-center rounded-full border shadow-[0_1px_4px_rgba(0,0,0,0.28)] transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isDark ? "translate-x-0 border-[#94A3B8]/[0.22] bg-[#040816]" : "translate-x-[40px] border-black/[0.14] bg-white",
        )}
      >
        {isDark ? <Moon size={14} color={BRAND} /> : <Sun size={14} color={AMBER} />}
      </div>
    </button>
  );
}
