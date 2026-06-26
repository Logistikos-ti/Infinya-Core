function MobileLoadingBlock({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-[24px] bg-white/8 ${className ?? ""}`} />;
}

export default function MobileAppLoading() {
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-white/5 p-5">
        <MobileLoadingBlock className="h-3 w-28" />
        <MobileLoadingBlock className="mt-3 h-8 w-48" />
        <MobileLoadingBlock className="mt-3 h-4 w-full max-w-xs" />
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MobileLoadingBlock className="h-20" />
          <MobileLoadingBlock className="h-20" />
          <MobileLoadingBlock className="h-20" />
        </div>
      </section>

      <MobileLoadingBlock className="h-28" />
      <MobileLoadingBlock className="h-28" />
      <MobileLoadingBlock className="h-28" />
    </div>
  );
}
