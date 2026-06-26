function NfeLoadingCard({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70 ${className ?? ""}`} />;
}

export default function NfeLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <NfeLoadingCard className="h-8 w-36" />
        <NfeLoadingCard className="h-4 w-[34rem] max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NfeLoadingCard className="h-28" />
        <NfeLoadingCard className="h-28" />
        <NfeLoadingCard className="h-28" />
        <NfeLoadingCard className="h-28" />
      </div>

      <NfeLoadingCard className="h-[920px]" />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <NfeLoadingCard className="h-[280px]" />
        <NfeLoadingCard className="h-[280px]" />
      </div>
    </div>
  );
}
