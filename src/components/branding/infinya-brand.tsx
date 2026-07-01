"use client";

import { useId } from "react";
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
  compact = false,
  animated = true,
}: InfinyaBrandProps) {
  const id = useId().replace(/:/g, "");
  const outlineGradientId = `infinya-outline-${id}`;
  const outlineGlowId = `infinya-outline-glow-${id}`;
  const infinityPath =
    "M 24 70 C 42 24 92 24 120 70 C 148 116 198 116 216 70 C 234 24 184 24 120 70 C 56 116 6 116 24 70";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "infinya-brand-mark relative shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#071120]/94",
          compact ? "h-11 w-11" : "h-14 w-14",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_26%,rgba(34,211,238,0.16),transparent_42%),radial-gradient(circle_at_78%_72%,rgba(217,70,239,0.18),transparent_38%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />

        <div className="absolute inset-[10%] overflow-hidden rounded-[16px]">
          <Image
            src="/branding/infinya-mark-symbol.png"
            alt="Infinya"
            fill
            sizes={compact ? "44px" : "56px"}
            className={cn(
              "pointer-events-none object-contain scale-[1.08]",
              animated && "infinya-symbol-image",
            )}
            priority
          />

          <svg
            viewBox="0 0 240 140"
            className="pointer-events-none absolute inset-[7%] h-[86%] w-[86%] overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={outlineGradientId} x1="8" y1="28" x2="228" y2="112" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#9efcff" />
                <stop offset="24%" stopColor="#22d3ee" />
                <stop offset="54%" stopColor="#6f7cff" />
                <stop offset="78%" stopColor="#b56dff" />
                <stop offset="100%" stopColor="#ff9ff3" />
              </linearGradient>
              <filter id={outlineGlowId} x="-45%" y="-45%" width="190%" height="190%">
                <feGaussianBlur stdDeviation="2.6" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 1.2 0"
                />
              </filter>
            </defs>

            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${outlineGradientId})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="56 250"
              className={cn(animated && "infinya-symbol-outline-glow")}
              filter={`url(#${outlineGlowId})`}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${outlineGradientId})`}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="40 266"
              className={cn(animated && "infinya-symbol-outline-core")}
            />
          </svg>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_38%,rgba(4,8,22,0.06)_74%,rgba(4,8,22,0.18)_100%)]" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="min-w-0">
          <div
            className={cn(
              "relative overflow-hidden",
              compact ? "h-5 w-[6.6rem]" : "h-6 w-[8rem]",
              nameClassName,
            )}
          >
            <Image
              src="/branding/infinya-wordmark-black-trim.png"
              alt="Infinya"
              fill
              sizes={compact ? "106px" : "128px"}
              className="object-contain object-left dark:invert"
              priority
            />
          </div>
          <span
            className={cn(
              "mt-0.5 block w-full text-left text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-slate-950 dark:text-white",
              compact && "text-[0.62rem]",
            )}
          >
            Log
          </span>
        </div>
      </div>
    </div>
  );
}
