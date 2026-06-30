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
  const gradientId = useId();
  const glowId = useId();
  const orbitId = useId();
  const trailId = useId();
  const infinityPath =
    "M 10 30 C 18 10, 34 10, 50 30 C 66 50, 82 50, 90 30 C 82 10, 66 10, 50 30 C 34 50, 18 50, 10 30 Z";

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

        <svg
          viewBox="0 0 100 60"
          aria-hidden="true"
          className={cn(
            "absolute inset-[14%] overflow-visible",
            animated && "infinya-mark-breathe",
          )}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#4ee6ff" />
              <stop offset="34%" stopColor="#7fe8ff" />
              <stop offset="67%" stopColor="#8f6bff" />
              <stop offset="100%" stopColor="#ea7cff" />
            </linearGradient>

            <linearGradient id={trailId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="rgba(78,230,255,0)" />
              <stop offset="50%" stopColor="rgba(126,232,255,0.95)" />
              <stop offset="100%" stopColor="rgba(234,124,255,0)" />
            </linearGradient>

            <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 17 -7"
              />
            </filter>

            <filter id={orbitId} x="-90%" y="-90%" width="280%" height="280%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 20 -8"
              />
            </filter>
          </defs>

          <path
            d={infinityPath}
            fill="none"
            stroke="rgba(7,17,32,0.72)"
            strokeWidth="15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={infinityPath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="11.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
            className={cn(animated && "infinya-symbol-shimmer")}
          />

          <path
            d={infinityPath}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={infinityPath}
            fill="none"
            stroke={`url(#${trailId})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="18 240"
            className={cn(animated && "infinya-symbol-trail")}
          />

          <g filter={`url(#${orbitId})`} className={cn(animated && "infinya-orbit-runner")}>
            <circle r="3.1" fill="#8ff1ff">
              <animateMotion
                dur={compact ? "5s" : "5.8s"}
                repeatCount="indefinite"
                rotate="auto"
                path={infinityPath}
              />
            </circle>
            <circle r="1.4" fill="#f4c2ff">
              <animateMotion
                dur={compact ? "5s" : "5.8s"}
                repeatCount="indefinite"
                rotate="auto"
                path={infinityPath}
              />
            </circle>
          </g>
        </svg>
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
