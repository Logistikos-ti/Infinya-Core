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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_28%,rgba(34,211,238,0.24),transparent_42%),radial-gradient(circle_at_78%_72%,rgba(217,70,239,0.22),transparent_38%),linear-gradient(180deg,rgba(5,11,25,0.99)_0%,rgba(8,17,34,0.98)_100%)]" />
        <div className="absolute inset-[10%] overflow-hidden rounded-[16px]">
          <svg
            viewBox="0 0 240 140"
            className={cn("h-full w-full overflow-visible", animated && "infinya-mark-breathe")}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={tubeGradientId} x1="16" y1="16" x2="224" y2="124" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#071325" />
                <stop offset="24%" stopColor="#10284f" />
                <stop offset="50%" stopColor="#2d2b73" />
                <stop offset="76%" stopColor="#512b8f" />
                <stop offset="100%" stopColor="#16103b" />
              </linearGradient>
              <linearGradient id={coreGradientId} x1="22" y1="18" x2="220" y2="122" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#b5fcff" />
                <stop offset="18%" stopColor="#61eeff" />
                <stop offset="42%" stopColor="#1dd6ff" />
                <stop offset="62%" stopColor="#6e88ff" />
                <stop offset="82%" stopColor="#ab74ff" />
                <stop offset="100%" stopColor="#f59efb" />
              </linearGradient>
              <linearGradient id={trailGradientAId} x1="0" y1="70" x2="240" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#e6feff" />
                <stop offset="30%" stopColor="#7ceeff" />
                <stop offset="60%" stopColor="#7f76ff" />
                <stop offset="100%" stopColor="#ffb0f4" />
              </linearGradient>
              <linearGradient id={trailGradientBId} x1="240" y1="70" x2="0" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="28%" stopColor="#ffb3f7" />
                <stop offset="62%" stopColor="#8d80ff" />
                <stop offset="100%" stopColor="#7ef2ff" />
              </linearGradient>
              <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4.5" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 1.22 0"
                />
              </filter>
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
              strokeWidth="17"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(animated && "infinya-loop-inner-pulse")}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke="rgba(255,255,255,0.44)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="22 244"
              className={cn(animated && "infinya-loop-sheen")}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${trailGradientAId})`}
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="72 210"
              className={cn(animated && "infinya-loop-trail-a")}
            />
            <path
              d={infinityPath}
              fill="none"
              stroke={`url(#${trailGradientBId})`}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="40 242"
              className={cn(animated && "infinya-loop-trail-b")}
            />

            <g opacity="0.32">
              <path d="M49 29 L82 60" stroke="rgba(214,245,255,0.72)" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M83 25 L113 56" stroke="rgba(155,128,255,0.46)" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M156 26 L188 57" stroke="rgba(255,200,248,0.62)" strokeWidth="3.2" strokeLinecap="round" />
              <path d="M127 82 L157 112" stroke="rgba(138,120,255,0.42)" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(4,8,22,0.08)_74%,rgba(4,8,22,0.22)_100%)]" />
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
