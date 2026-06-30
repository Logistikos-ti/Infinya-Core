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
  const symbolMaskStyle = {
    WebkitMaskImage: "url('/branding/infinya-mark-mask.png')",
    maskImage: "url('/branding/infinya-mark-mask.png')",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  } as const;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "infinya-brand-mark relative shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#071120]/94",
          compact ? "h-11 w-11" : "h-14 w-14",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_24%,rgba(34,211,238,0.16),transparent_44%),radial-gradient(circle_at_76%_70%,rgba(217,70,239,0.2),transparent_40%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />

        <div className="absolute inset-[10%] overflow-hidden rounded-[16px]">
          <Image
            src="/branding/infinya-mark-512.png"
            alt="Infinya"
            fill
            sizes={compact ? "44px" : "56px"}
            className={cn(
              "pointer-events-none object-contain scale-[1.1]",
              animated && "infinya-mark-base-motion",
            )}
            priority
          />

          <div
            className={cn(
              "pointer-events-none absolute inset-[-8%] opacity-[0.88] mix-blend-screen",
              animated && "infinya-mark-flow-overlay",
            )}
            style={symbolMaskStyle}
          />

          <div
            className={cn(
              "pointer-events-none absolute inset-[-12%] opacity-[0.76] mix-blend-screen blur-[1.5px]",
              animated && "infinya-mark-flow-ribbon",
            )}
            style={symbolMaskStyle}
          />

          <div
            className={cn(
              "pointer-events-none absolute inset-[-10%] opacity-[0.52] mix-blend-color-dodge",
              animated && "infinya-mark-prism-shift",
            )}
            style={symbolMaskStyle}
          />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_36%,rgba(4,8,22,0.06)_76%,rgba(4,8,22,0.2)_100%)]" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <p
            className={cn(
              "truncate font-semibold uppercase text-slate-950 dark:text-white",
              compact ? "text-[1.02rem] tracking-[0.18em]" : "text-[1.24rem] tracking-[0.22em]",
              nameClassName,
            )}
          >
            Infinya
          </p>
          <span className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
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
