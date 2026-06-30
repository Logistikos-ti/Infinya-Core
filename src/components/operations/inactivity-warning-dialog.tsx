"use client";

type InactivityWarningDialogProps = {
  countdownSeconds: number;
  isVisible: boolean;
  title: string;
  description: string;
  mobileDescription?: string;
};

export function InactivityWarningDialog({
  countdownSeconds,
  isVisible,
  title,
  description,
  mobileDescription,
}: InactivityWarningDialogProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[680px] rounded-[32px] border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-500/30 dark:bg-slate-950 md:p-8">
        <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1fr)_220px] md:items-start md:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-700 dark:text-rose-300">
              Aviso de inatividade
            </p>
            <h3 className="mt-3 text-[2rem] font-semibold leading-tight text-slate-950 dark:text-white md:text-[2.35rem]">
              {title}
            </h3>
            <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300 md:hidden">
              {mobileDescription ?? description}
            </p>
            <p className="mt-4 hidden text-lg leading-8 text-slate-600 dark:text-slate-300 md:block">
              {description}
            </p>
          </div>

          <div className="mx-auto w-full max-w-[240px] rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-5 text-center dark:border-rose-500/30 dark:bg-rose-500/10 md:mx-0 md:max-w-none md:px-6 md:py-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
              Retorno
            </p>
            <p className="mt-2 text-5xl font-bold leading-none text-rose-700 dark:text-rose-300 md:text-6xl">
              {countdownSeconds}
            </p>
            <p className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-300 md:text-base">
              segundos
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-base leading-7 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 md:mt-6 md:text-lg">
          <span className="md:hidden">Retome agora para não devolver o pedido à fila.</span>
          <span className="hidden md:inline">
            Retome a operação imediatamente para evitar que o pedido volte para a fila.
          </span>
        </div>
      </div>
    </div>
  );
}
