function StockLoadingCard({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70 ${className ?? ""}`} />;
}

export default function EstoqueLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <StockLoadingCard className="h-8 w-48" />
        <StockLoadingCard className="h-4 w-[32rem] max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StockLoadingCard className="h-28" />
        <StockLoadingCard className="h-28" />
        <StockLoadingCard className="h-28" />
        <StockLoadingCard className="h-28" />
      </div>

      <StockLoadingCard className="h-[300px]" />
      <StockLoadingCard className="h-[520px]" />
      <StockLoadingCard className="h-[340px]" />
    </div>
  );
}
