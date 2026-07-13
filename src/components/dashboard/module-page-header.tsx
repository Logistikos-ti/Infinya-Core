type ModulePageHeaderProps = {
  title: string;
  description: string;
  badge: string;
};

export function ModulePageHeader({
  title,
  description,
  badge,
}: ModulePageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-white via-white to-cyan-50/60 p-6 shadow-[0_24px_50px_-28px_rgba(8,145,178,0.35)] transition-all hover:border-cyan-300/70 dark:border-white/10 dark:bg-linear-to-br dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/40 dark:shadow-[0_24px_50px_-28px_rgba(0,0,0,0.6)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-cyan-400 via-sky-400 to-fuchsia-400" />
      <div className="pointer-events-none absolute -right-12 top-0 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-24 w-24 rounded-full bg-fuchsia-400/20 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <span className="inline-flex w-fit rounded-full bg-infinya-gradient px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)]">
          {badge}
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
