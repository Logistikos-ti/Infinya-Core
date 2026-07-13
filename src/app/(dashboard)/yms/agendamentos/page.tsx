import { ModulePageHeader } from "@/components/dashboard/module-page-header";

export default function AgendamentosPage() {
  return (
    <div className="space-y-6">
      <ModulePageHeader
        title="Agendamentos"
        description="Gestão de janelas de tempo para carga e descarga de transportadoras."
        badge="YMS"
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-slate-100 p-4 dark:bg-zinc-800">
            <svg
              className="h-8 w-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            Agenda Vazia
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            A interface para criação e gerenciamento de agendamentos será construída em breve.
          </p>
        </div>
      </div>
    </div>
  );
}
