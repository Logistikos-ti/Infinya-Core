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
    <div className="glass-card infinya-border-glow flex flex-col gap-3 rounded-3xl border border-slate-200/60 p-6 shadow-sm transition-all hover:border-primary-500/30 dark:border-white/10">
      <span className="inline-flex w-fit rounded-full bg-infinya-gradient px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-950">
        {badge}
      </span>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}
