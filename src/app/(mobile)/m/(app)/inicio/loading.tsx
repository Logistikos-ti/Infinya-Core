function MobileHomeLoadingCard({
  className,
}: {
  className?: string;
}) {
  return <div className={`animate-pulse rounded-[24px] bg-white/10 ${className ?? ""}`} />;
}

export default function MobileHomeLoading() {
  return (
    <div className="space-y-4">
      <MobileHomeLoadingCard className="h-52 rounded-[28px]" />
      <MobileHomeLoadingCard className="h-24" />
      <MobileHomeLoadingCard className="h-20" />
      <MobileHomeLoadingCard className="h-28" />
      <MobileHomeLoadingCard className="h-28" />
      <MobileHomeLoadingCard className="h-28" />
    </div>
  );
}
