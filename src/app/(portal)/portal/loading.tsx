import { LoaderCircle } from "lucide-react";

export default function PortalLoading() {
  return (
    <div className="flex min-h-[60dvh] flex-1 items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-xl dark:border-white/10 dark:bg-[#101b30] dark:text-white">
        <LoaderCircle className="h-5 w-5 animate-spin text-violet-500" /> Carregando...
      </div>
    </div>
  );
}
