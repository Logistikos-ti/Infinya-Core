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
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="inline-flex w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
        {badge}
      </span>
      <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
