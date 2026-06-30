"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type InfinyaBrandProps = {
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
  compact?: boolean;
  animated?: boolean;
};

export function InfinyaBrand({
  className,
  markClassName,
  nameClassName,
  subtitle,
  subtitleClassName,
  compact = false,
  animated = true,
}: InfinyaBrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "infinya-mark-shell relative overflow-hidden rounded-[22px] border border-white/12 bg-[#071120]/90 shadow-[0_0_30px_rgba(34,211,238,0.12)]",
          compact ? "h-11 w-[3.55rem]" : "h-14 w-[4.6rem]",
          animated && "infinya-mark-float",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_24%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_74%_70%,rgba(192,132,252,0.28),transparent_42%)]" />
        <Image
          src="/branding/infinya-mark-512.png"
          alt="Infinya"
          fill
          sizes={compact ? "57px" : "74px"}
          className={cn(
            "object-contain px-1 py-1 saturate-125",
            animated && "infinya-mark-image",
          )}
          priority
        />
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold text-white",
            compact ? "text-base tracking-[0.08em]" : "text-[1.4rem] tracking-[0.06em]",
            nameClassName,
          )}
        >
          <span className="text-infinya-brand">Infinya</span>
          <span className="ml-2 align-middle text-[0.68em] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-300">
            {"• Log"}
          </span>
        </p>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-xs text-slate-300/90",
              compact ? "mt-0.5" : "mt-1",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
