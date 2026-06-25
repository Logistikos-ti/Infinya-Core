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
      <div className="w-full max-w-2xl rounded-[36px] border border-rose-200 bg-white p-8 shadow-2xl md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="mx-auto w-full max-w-[220px] rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-center md:order-2 md:mx-0 md:min-w-[180px] md:max-w-none md:px-6 md:py-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose-700">
              Retorno
            </p>
            <p className="mt-2 text-5xl font-bold leading-none text-rose-700 md:text-6xl">
              {countdownSeconds}
            </p>
            <p className="mt-2 text-sm font-medium text-rose-700 md:text-base">segundos</p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-700">
              Aviso de inatividade
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-950 md:text-3xl">{title}</h3>
            <p className="mt-3 text-base leading-7 text-slate-600 md:hidden">
              {mobileDescription ?? description}
            </p>
            <p className="mt-3 hidden text-lg leading-7 text-slate-600 md:block">{description}</p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-base text-amber-900 md:text-lg">
          <span className="md:hidden">Retome agora para não devolver o pedido à fila.</span>
          <span className="hidden md:inline">
            Retome a operação imediatamente para evitar que o pedido volte para a fila.
          </span>
        </div>
      </div>
    </div>
  );
}
