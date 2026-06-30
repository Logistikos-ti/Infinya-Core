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
    WebkitMaskImage: "url('/branding/infinya-mark-overlay.png')",
    maskImage: "url('/branding/infinya-mark-overlay.png')",
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_24%,rgba(34,211,238,0.2),transparent_46%),radial-gradient(circle_at_76%_70%,rgba(217,70,239,0.18),transparent_38%)]" />
        <div className="absolute inset-[10%] overflow-hidden rounded-[16px]">
          <div
            className={cn(
              "absolute inset-0 opacity-[0.98]",
              animated && "infinya-mark-breathe infinya-symbol-flow",
            )}
            style={symbolMaskStyle}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-0 mix-blend-screen opacity-[0.96]",
              animated && "infinya-symbol-aurora",
            )}
            style={symbolMaskStyle}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-[-18%] mix-blend-color-dodge opacity-[0.82] blur-[9px]",
              animated && "infinya-symbol-wave",
            )}
            style={symbolMaskStyle}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-[-10%] mix-blend-screen opacity-[0.88]",
              animated && "infinya-symbol-ribbon",
            )}
            style={symbolMaskStyle}
          />
          <Image
            src="/branding/infinya-mark-overlay.png"
            alt="Infinya"
            fill
            sizes={compact ? "44px" : "56px"}
            className={cn(
              "pointer-events-none object-cover scale-[1.12] opacity-[0.76]",
              animated && "infinya-mark-overlay-motion",
            )}
            priority
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_38%,rgba(4,8,22,0.06)_75%,rgba(4,8,22,0.18)_100%)]" />
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
