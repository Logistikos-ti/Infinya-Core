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
  forceLightWordmark?: boolean;
};

export function InfinyaBrand({
  className,
  markClassName,
  nameClassName,
  subtitle,
  subtitleClassName,
  compact = false,
  forceLightWordmark = false,
}: InfinyaBrandProps) {
  const wordmarkClassName = forceLightWordmark
    ? "text-white"
    : "text-slate-950 dark:text-white";

  if (compact) {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#071120] shadow-[0_18px_40px_rgba(4,8,22,0.24)]",
              markClassName,
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(110,231,255,0.16),transparent_30%),radial-gradient(circle_at_82%_82%,rgba(217,70,239,0.14),transparent_28%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />
            <Image
              src="/branding/infinoos-icon-wms.svg"
              alt="Infinoos WMS"
              fill
              sizes="56px"
              className="relative z-10 object-contain p-2.5"
              priority
            />
          </div>

          <div className="min-w-0">
            <div
              className={cn(
                "truncate text-[0.95rem] font-black uppercase tracking-[0.24em]",
                wordmarkClassName,
                nameClassName,
              )}
            >
              Infinoos
            </div>
            <div className="mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.48em] text-sky-300 dark:text-violet-200">
              WMS
            </div>
          </div>
        </div>

        {subtitle ? (
          <p
            className={cn(
              "mt-2 truncate pl-[68px] text-xs font-medium text-slate-600 dark:text-slate-300",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "infinya-brand-mark relative overflow-hidden rounded-[24px] border border-white/10 bg-[#071120]/96 shadow-[0_18px_40px_rgba(4,8,22,0.24)]",
          "h-[92px] w-[320px]",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(110,231,255,0.14),transparent_28%),radial-gradient(circle_at_85%_82%,rgba(217,70,239,0.14),transparent_26%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />
        <Image
          src="/branding/infinoos-lockup-wms.png"
          alt="Infinoos WMS"
          fill
          sizes="320px"
          className={cn("relative z-10 object-contain px-4 py-3", nameClassName)}
          priority
        />
      </div>

      {subtitle ? (
        <p
          className={cn(
            "mt-2 truncate text-xs font-medium text-slate-600 dark:text-slate-300",
            subtitleClassName,
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
