"use client";

type InactivityWarningDialogProps = {
  countdownSeconds: number;
  isVisible: boolean;
  title: string;
  description: string;
};

export function InactivityWarningDialog({
  countdownSeconds,
  isVisible,
  title,
  description,
}: InactivityWarningDialogProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-rose-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-rose-700">
              Aviso de inatividade
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>

          <div className="min-w-[96px] rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-rose-700">
              Retorno
            </p>
            <p className="mt-1 text-3xl font-bold leading-none text-rose-700">
              {countdownSeconds}
            </p>
            <p className="mt-1 text-xs font-medium text-rose-700">segundos</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Retome a operação imediatamente para evitar que o pedido volte para a fila.
        </div>
      </div>
    </div>
  );
}
