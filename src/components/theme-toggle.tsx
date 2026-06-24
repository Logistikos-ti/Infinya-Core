"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full bg-white/50 dark:bg-zinc-900/50 border border-lightBorder dark:border-darkBorder hover:bg-slate-200 dark:hover:bg-zinc-800 backdrop-blur-sm transition-colors text-slate-600 dark:text-zinc-400 shadow-sm"
      title="Alternar Modo Claro/Escuro"
    >
      <Sun className="w-5 h-5 hidden dark:block" />
      <Moon className="w-5 h-5 block dark:hidden" />
    </button>
  );
}
