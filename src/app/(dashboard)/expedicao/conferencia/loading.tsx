import { Loader2 } from "lucide-react";

export default function ConferenceLoading() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center bg-transparent">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500 dark:text-primary-400" />
      <p className="mt-4 text-sm font-medium text-slate-500 dark:text-zinc-400">
        Carregando conferência...
      </p>
    </div>
  );
}
