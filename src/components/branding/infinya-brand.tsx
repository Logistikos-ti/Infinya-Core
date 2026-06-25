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
          "infinya-mark-shell relative overflow-hidden rounded-[22px] border border-white/12 bg-[#071120]/85 shadow-[0_0_30px_rgba(34,211,238,0.12)]",
          compact ? "h-12 w-12" : "h-14 w-14",
          animated && "infinya-mark-float",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.2),transparent_45%),radial-gradient(circle_at_72%_68%,rgba(192,132,252,0.26),transparent_42%)]" />
        <Image
          src="/branding/infinya-final.png"
          alt="Infinya"
          fill
          sizes={compact ? "48px" : "56px"}
          className={cn(
            "object-cover object-top scale-[1.42] saturate-125",
            animated && "infinya-mark-image",
          )}
          priority
        />
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold tracking-[0.18em] text-white",
            compact ? "text-sm" : "text-lg",
            "text-infinya-brand",
            nameClassName,
          )}
        >
          Infinya • Log
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
