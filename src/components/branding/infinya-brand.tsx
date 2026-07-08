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
}: InfinyaBrandProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "infinya-brand-mark relative overflow-hidden rounded-[22px] border border-white/10 bg-[#071120]/96 shadow-[0_18px_40px_rgba(4,8,22,0.24)]",
          compact ? "h-14 w-[186px]" : "h-[84px] w-[272px]",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(110,231,255,0.14),transparent_28%),radial-gradient(circle_at_85%_82%,rgba(217,70,239,0.14),transparent_26%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />
        <Image
          src="/branding/infinoos-lockup-wms.png"
          alt="Infinoos WMS"
          fill
          sizes={compact ? "186px" : "272px"}
          className={cn(
            "relative z-10 object-contain object-left px-3 py-2",
            compact ? "scale-[0.98]" : "scale-100",
            nameClassName,
          )}
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
