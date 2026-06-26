import Link from "next/link";
import { ArrowRight } from "lucide-react";

type ModuleCardProps = {
  href: string;
  title: string;
  description: string;
  status: string;
};

export function ModuleCard({
  href,
  title,
  description,
  status,
}: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="glass-card infinya-border-glow group rounded-[24px] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.08)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-950 dark:text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition group-hover:text-cyan-500" />
      </div>
      <span className="mt-5 inline-flex rounded-full bg-infinya-gradient px-3 py-1 text-xs font-semibold text-slate-950">
        {status}
      </span>
    </Link>
  );
}
