function ConfigLoadingBlock({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70 ${className ?? ""}`} />;
}

export default function ConfiguracoesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ConfigLoadingBlock className="h-8 w-56" />
        <ConfigLoadingBlock className="h-4 w-[32rem] max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ConfigLoadingBlock className="h-24" />
        <ConfigLoadingBlock className="h-24" />
        <ConfigLoadingBlock className="h-24" />
        <ConfigLoadingBlock className="h-24" />
        <ConfigLoadingBlock className="h-24" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <ConfigLoadingBlock className="h-[320px]" />
        <ConfigLoadingBlock className="h-[320px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ConfigLoadingBlock className="h-36" />
        <ConfigLoadingBlock className="h-36" />
        <ConfigLoadingBlock className="h-36" />
      </div>
    </div>
  );
}
