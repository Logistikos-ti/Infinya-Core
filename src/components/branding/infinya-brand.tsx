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
  animated = false,
}: InfinyaBrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_10px_30px_rgba(8,17,34,0.18)]",
          compact ? "h-11 w-11" : "h-14 w-14",
          animated && "infinya-mark-float",
          markClassName,
        )}
      >
        <Image
          src="/branding/infinya-mark-512.png"
          alt="Infinya"
          fill
          sizes={compact ? "44px" : "56px"}
          className={cn(
            "object-cover",
            animated && "infinya-mark-image",
          )}
          priority
        />
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "relative overflow-hidden",
              compact ? "h-5 w-[8.6rem]" : "h-7 w-[12rem]",
              nameClassName,
            )}
          >
            <Image
              src="/branding/infinya-wordmark.png"
              alt="Infinya"
              fill
              sizes={compact ? "138px" : "192px"}
              className="object-contain object-left"
              priority
            />
          </div>
          <span className="shrink-0 rounded-full border border-slate-300/70 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Log
          </span>
        </div>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-xs text-slate-500 dark:text-slate-300/90",
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
