function DashboardLoadingCard({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70 ${className ?? ""}`} />;
}

export default function ExpedicaoLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <DashboardLoadingCard className="h-8 w-56" />
          <DashboardLoadingCard className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-3">
          <DashboardLoadingCard className="h-10 w-36" />
          <DashboardLoadingCard className="h-10 w-36" />
          <DashboardLoadingCard className="h-10 w-32" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardLoadingCard className="h-32" />
        <DashboardLoadingCard className="h-32" />
        <DashboardLoadingCard className="h-32" />
        <DashboardLoadingCard className="h-32" />
      </div>

      <DashboardLoadingCard className="h-[440px] w-full" />
    </div>
  );
}
