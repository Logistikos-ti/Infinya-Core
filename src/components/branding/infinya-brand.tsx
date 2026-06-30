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
          "infinya-brand-mark relative shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#071120]/94",
          compact ? "h-11 w-11" : "h-14 w-14",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_30%,rgba(34,211,238,0.24),transparent_44%),radial-gradient(circle_at_76%_72%,rgba(217,70,239,0.24),transparent_38%)]" />
        <Image
          src="/branding/infinya-mark-512.png"
          alt="Infinya"
          fill
          sizes={compact ? "44px" : "56px"}
          className={cn("object-cover", animated && "infinya-mark-breathe")}
          priority
        />

        <svg
          viewBox="0 0 100 60"
          aria-hidden="true"
          className="pointer-events-none absolute inset-[16%] overflow-visible"
        >
          <defs>
            <linearGradient id="infinyaOrbitStroke" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.1)" />
              <stop offset="50%" stopColor="rgba(125,211,252,0.55)" />
              <stop offset="100%" stopColor="rgba(217,70,239,0.2)" />
            </linearGradient>
            <filter id="infinyaOrbitGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 18 -7"
              />
            </filter>
          </defs>

          <path
            d="M10,30 C18,10 34,10 50,30 C66,50 82,50 90,30 C82,10 66,10 50,30 C34,50 18,50 10,30 Z"
            fill="none"
            stroke="url(#infinyaOrbitStroke)"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={cn(animated && "infinya-orbit-track")}
          />

          <g filter="url(#infinyaOrbitGlow)" className={cn(animated && "infinya-orbit-dot")}>
            <circle r="3.4" fill="#7ee8ff">
              <animateMotion
                dur={compact ? "4.8s" : "5.4s"}
                repeatCount="indefinite"
                rotate="auto"
                path="M10,30 C18,10 34,10 50,30 C66,50 82,50 90,30 C82,10 66,10 50,30 C34,50 18,50 10,30 Z"
              />
            </circle>
            <circle r="1.4" fill="#f5d0fe">
              <animateMotion
                dur={compact ? "4.8s" : "5.4s"}
                repeatCount="indefinite"
                rotate="auto"
                path="M10,30 C18,10 34,10 50,30 C66,50 82,50 90,30 C82,10 66,10 50,30 C34,50 18,50 10,30 Z"
              />
            </circle>
          </g>
        </svg>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={cn(
              "truncate font-semibold uppercase text-slate-950 dark:text-white",
              compact ? "text-[1.05rem] tracking-[0.18em]" : "text-[1.28rem] tracking-[0.22em]",
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
