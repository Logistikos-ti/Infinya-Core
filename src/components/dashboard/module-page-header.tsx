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
    <div className="glass-card infinya-border-glow relative overflow-hidden rounded-3xl border border-slate-200/60 p-6 shadow-sm transition-all hover:border-primary-500/30 dark:border-white/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent dark:via-cyan-300/50" />
      <div className="pointer-events-none absolute -right-12 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-24 w-24 rounded-full bg-fuchsia-400/10 blur-3xl" />

      <div className="relative flex flex-col gap-4">
        <span className="inline-flex w-fit rounded-full bg-infinya-gradient px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.16)]">
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
