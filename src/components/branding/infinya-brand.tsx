"use client";

import { useId } from "react";
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
  const id = useId().replace(/:/g, "");
  const tubeGradientId = `infinya-tube-${id}`;
  const coreGradientId = `infinya-core-${id}`;
  const trailGradientAId = `infinya-trail-a-${id}`;
  const trailGradientBId = `infinya-trail-b-${id}`;
  const edgeGradientId = `infinya-edge-${id}`;
  const facetGradientId = `infinya-facet-${id}`;
  const clipPathId = `infinya-clip-${id}`;
  const glowFilterId = `infinya-glow-${id}`;

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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,rgba(34,211,238,0.28),transparent_42%),radial-gradient(circle_at_76%_72%,rgba(217,70,239,0.24),transparent_38%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />
        <div className="absolute inset-[10%] overflow-hidden rounded-[16px]">
          <svg
            viewBox="0 0 240 140"
            className={cn("h-full w-full overflow-visible", animated && "infinya-mark-breathe")}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={tubeGradientId} x1="16" y1="16" x2="224" y2="124" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#07101f" />
                <stop offset="16%" stopColor="#0c2242" />
                <stop offset="38%" stopColor="#1e2f6b" />
                <stop offset="58%" stopColor="#352a82" />
                <stop offset="82%" stopColor="#5b2f92" />
                <stop offset="100%" stopColor="#160f37" />
              </linearGradient>
              <linearGradient id={coreGradientId} x1="22" y1="18" x2="220" y2="122" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#aefbff" />
                <stop offset="18%" stopColor="#5ceaff" />
                <stop offset="40%" stopColor="#2ad1ff" />
                <stop offset="58%" stopColor="#6184ff" />
                <stop offset="78%" stopColor="#9d6dff" />
                <stop offset="100%" stopColor="#f0a0ff" />
              </linearGradient>
              <linearGradient id={edgeGradientId} x1="18" y1="20" x2="222" y2="118" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(226,253,255,0.95)" />
                <stop offset="28%" stopColor="rgba(103,235,255,0.9)" />
                <stop offset="56%" stopColor="rgba(143,123,255,0.72)" />
                <stop offset="100%" stopColor="rgba(255,168,246,0.9)" />
              </linearGradient>
              <linearGradient id={facetGradientId} x1="40" y1="22" x2="206" y2="116" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
                <stop offset="35%" stopColor="rgba(157,241,255,0.18)" />
                <stop offset="68%" stopColor="rgba(194,143,255,0.14)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
              </linearGradient>
              <linearGradient id={trailGradientAId} x1="0" y1="70" x2="240" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#d9fbff" />
                <stop offset="34%" stopColor="#73ebff" />
                <stop offset="64%" stopColor="#7e73ff" />
                <stop offset="100%" stopColor="#ffa3f6" />
              </linearGradient>
              <linearGradient id={trailGradientBId} x1="240" y1="70" x2="0" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#d9fbff" />
                <stop offset="34%" stopColor="#ffa1f8" />
                <stop offset="64%" stopColor="#8c82ff" />
                <stop offset="100%" stopColor="#78efff" />
              </linearGradient>
              <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 1.2 0"
                />
              </filter>
              <clipPath id={clipPathId}>
                <path
                  d={infinityPath}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="36"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </clipPath>
            </defs>

            <path
              d={infinityPath}
              fill="none"
              stroke="rgba(4, 8, 22, 0.56)"
              strokeWidth="44"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${tubeGradientId})`}
              strokeWidth="36"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${coreGradientId})`}
              strokeWidth="26"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(animated && "infinya-loop-core-glow")}
              filter={`url(#${glowFilterId})`}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${coreGradientId})`}
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(animated && "infinya-loop-inner-pulse")}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${edgeGradientId})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(animated && "infinya-loop-edge")}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${trailGradientAId})`}
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="84 198"
              className={cn(animated && "infinya-loop-trail-a")}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${trailGradientBId})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="46 232"
              className={cn(animated && "infinya-loop-trail-b")}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke="rgba(255,255,255,0.58)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="24 248"
              className={cn(animated && "infinya-loop-sheen")}
            />
            <g clipPath={`url(#${clipPathId})`} className={cn(animated && "infinya-loop-facets")}>
              <path d="M50 28 L84 60" stroke={`url(#${facetGradientId})`} strokeWidth="4" strokeLinecap="round" />
              <path d="M82 24 L114 58" stroke={`url(#${facetGradientId})`} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M126 80 L156 112" stroke={`url(#${facetGradientId})`} strokeWidth="3.5" strokeLinecap="round" />
              <path d="M156 26 L190 58" stroke={`url(#${facetGradientId})`} strokeWidth="4" strokeLinecap="round" />
              <path d="M92 82 L118 108" stroke={`url(#${facetGradientId})`} strokeWidth="3" strokeLinecap="round" />
              <path d="M118 32 L144 58" stroke={`url(#${facetGradientId})`} strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_36%,rgba(4,8,22,0.08)_74%,rgba(4,8,22,0.24)_100%)]" />
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
