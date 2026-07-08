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
        sizes="64px"
        className="relative z-10 object-contain p-[0.58rem]"
        priority
      />
    </div>
  );
}

function BrandWordmark({
  forceLightWordmark,
  nameClassName,
  compact,
}: {
  forceLightWordmark?: boolean;
  nameClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className={cn(
          "truncate font-black uppercase leading-none",
          compact ? "text-[0.98rem] tracking-[0.2em]" : "text-[1.34rem] tracking-[0.22em]",
          forceLightWordmark ? "text-white" : "text-slate-950 dark:text-white",
          nameClassName,
        )}
      >
        Infinoos
      </div>
      <div
        className={cn(
          "mt-1 font-black uppercase leading-none",
          compact ? "text-[0.76rem] tracking-[0.42em]" : "text-[1.5rem] tracking-[0.3em]",
          "bg-[linear-gradient(90deg,#6ee7ff_0%,#60a5fa_28%,#7c78ff_62%,#d946ef_100%)] bg-clip-text text-transparent",
          "drop-shadow-[0_0_18px_rgba(96,165,250,0.18)]",
        )}
      >
        WMS
      </div>
    </div>
  );
}

export function InfinyaBrand({
  className,
  markClassName,
  nameClassName,
  subtitle,
  subtitleClassName,
  compact = false,
  forceLightWordmark = false,
}: InfinyaBrandProps) {
  if (compact) {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="flex min-w-0 items-center gap-3.5">
          <BrandGlyph
            className={cn("h-[52px] w-[52px] flex-shrink-0 rounded-[17px]", markClassName)}
          />
          <BrandWordmark
            compact
            forceLightWordmark={forceLightWordmark}
            nameClassName={nameClassName}
          />
        </div>

        {subtitle ? (
          <p
            className={cn(
              "mt-2 truncate pl-[66px] text-xs font-medium text-slate-600 dark:text-slate-300",
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
          <BrandWordmark forceLightWordmark={forceLightWordmark} nameClassName={nameClassName} />
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
