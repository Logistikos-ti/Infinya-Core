function ReportsLoadingCard({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70 ${className ?? ""}`} />;
}

export default function RelatoriosLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ReportsLoadingCard className="h-8 w-40" />
        <ReportsLoadingCard className="h-4 w-[32rem] max-w-full" />
      </div>

      <ReportsLoadingCard className="h-[320px]" />
      <ReportsLoadingCard className="h-[420px]" />
      <ReportsLoadingCard className="h-[260px]" />
    </div>
  );
}
