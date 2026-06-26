import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  help: string;
};

export function StatCard({ icon: Icon, label, value, help }: StatCardProps) {
  return (
    <div className="glass-card infinya-border-glow rounded-[24px] p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className="rounded-xl bg-infinya-gradient p-2 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{help}</p>
    </div>
  );
}
