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
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-950">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition group-hover:text-sky-700" />
      </div>
      <span className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
        {status}
      </span>
    </Link>
  );
}
