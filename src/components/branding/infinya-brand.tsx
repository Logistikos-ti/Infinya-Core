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
  isYMS?: boolean;
};

function BrandGlyph({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] border border-white/10 bg-[#071120] shadow-[0_18px_40px_rgba(4,8,22,0.24)]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_18%,rgba(110,231,255,0.16),transparent_30%),radial-gradient(circle_at_84%_82%,rgba(217,70,239,0.14),transparent_28%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />
      <Image
        src="/branding/infinoos-icon-wms.svg"
        alt="Infinoos WMS"
        fill
        sizes="72px"
        className="relative z-10 object-contain p-[0.22rem]"
        priority
      />
    </div>
  );
}

function BrandLockup({
  compact,
  className,
  isYMS,
}: {
  compact?: boolean;
  className?: string;
  isYMS?: boolean;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Image
        src={isYMS ? "/branding/infinoos-lockup-yms.png" : "/branding/infinoos-lockup-wms-house.png"}
        alt={isYMS ? "Infinoos YMS" : "Infinoos WMS"}
        width={compact ? 184 : 286}
        height={compact ? 58 : 90}
        priority
        className={cn(
          "h-auto w-auto max-w-full object-contain",
          compact ? "max-h-[54px]" : "max-h-[86px]",
        )}
      />
    </div>
  );
}

export function InfinyaBrand({
  className,
  markClassName,
  subtitle,
  subtitleClassName,
  compact = false,
  isYMS = false,
}: InfinyaBrandProps) {
  if (compact) {
    return (
      <div className={cn("min-w-0", className)}>
        <div
          className={cn(
            "relative overflow-hidden rounded-[24px] border border-white/10 bg-[#071120]/96 px-4 py-3 shadow-[0_18px_40px_rgba(4,8,22,0.24)]",
            markClassName,
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(110,231,255,0.14),transparent_28%),radial-gradient(circle_at_85%_82%,rgba(217,70,239,0.14),transparent_26%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />
          <div className="relative z-10">
            <BrandLockup compact className="w-full" isYMS={isYMS} />
          </div>
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

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "infinya-brand-mark relative overflow-hidden rounded-[26px] border border-white/10 bg-[#071120]/96 px-5 py-4 shadow-[0_18px_40px_rgba(4,8,22,0.24)]",
          "w-fit min-w-[308px]",
          markClassName,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(110,231,255,0.14),transparent_28%),radial-gradient(circle_at_85%_82%,rgba(217,70,239,0.14),transparent_26%),linear-gradient(180deg,rgba(5,11,25,0.98)_0%,rgba(8,17,34,0.98)_100%)]" />
        <div className="relative z-10 flex min-w-0 items-center gap-4.5">
          <BrandGlyph className="h-[66px] w-[66px] flex-shrink-0 rounded-[21px]" />
          <BrandLockup className="min-w-0" isYMS={isYMS} />
        </div>
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
