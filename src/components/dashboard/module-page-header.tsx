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
    <div className="glass-card flex flex-col gap-3 rounded-3xl border border-slate-200/60 dark:border-zinc-800/60 p-6 shadow-sm transition-all hover:border-primary-500/30">
      <span className="inline-flex w-fit rounded-full bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
        {badge}
      </span>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}
