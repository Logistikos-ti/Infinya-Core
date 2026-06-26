function ReceivingLoadingCard({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70 ${className ?? ""}`} />;
}

export default function RecebimentoLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <ReceivingLoadingCard className="h-8 w-56" />
          <ReceivingLoadingCard className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-3">
          <ReceivingLoadingCard className="h-10 w-36" />
          <ReceivingLoadingCard className="h-10 w-36" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReceivingLoadingCard className="h-32" />
        <ReceivingLoadingCard className="h-32" />
        <ReceivingLoadingCard className="h-32" />
        <ReceivingLoadingCard className="h-32" />
      </div>

      <ReceivingLoadingCard className="h-[440px] w-full" />
    </div>
  );
}
