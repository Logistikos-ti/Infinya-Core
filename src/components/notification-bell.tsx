"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[32px] w-[32px]" />;
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  return (
    <button
      title="Notificações"
      aria-label="Notificações"
      className={cn(
        "relative flex h-[32px] w-[32px] items-center justify-center rounded-full border p-0 transition-all duration-300 ease-in-out",
        isDark
          ? "border-[#1E293B] bg-[#0A1120] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] hover:bg-[#131E32]"
          : "border-slate-200 bg-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] hover:bg-slate-100",
      )}
    >
      <Bell className={cn("h-[16px] w-[16px]", isDark ? "text-slate-300" : "text-slate-500")} />
      <span
        className={cn(
          "absolute right-[3px] top-[3px] h-[7px] w-[7px] rounded-full bg-red-500 ring-2",
          isDark ? "ring-[#0A1120]" : "ring-white",
        )}
      />
    </button>
  );
}
