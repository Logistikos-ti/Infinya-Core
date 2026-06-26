function DashboardLoadingTile({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-[24px] bg-slate-200/70 dark:bg-zinc-800/70 ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <DashboardLoadingTile className="h-32 rounded-[28px]" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardLoadingTile className="h-32" />
        <DashboardLoadingTile className="h-32" />
        <DashboardLoadingTile className="h-32" />
        <DashboardLoadingTile className="h-32" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <DashboardLoadingTile className="h-[360px]" />
        <div className="flex flex-col gap-6">
          <DashboardLoadingTile className="h-[160px]" />
          <DashboardLoadingTile className="h-[180px]" />
        </div>
      </div>

      <DashboardLoadingTile className="h-[340px] rounded-[28px]" />
    </div>
  );
}
