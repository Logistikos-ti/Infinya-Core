import fs from 'fs';
let content = fs.readFileSync('src/components/portal/portal-orders-view.tsx', 'utf-8');

const target1 = \<div className="flex-1 overflow-y-auto p-6">\;

const target2 = \<footer className="border-t border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f172a]">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isCancelling || order.status === "EXPEDIDO" || order.status === "CANCELADO"}
              onClick={() => {
                if (window.confirm("Tem certeza que deseja cancelar este pedido?")) {
                  startTransition(async () => {
                    const result = await cancelPortalOrderAction(order.id);
                    if (result.ok) {
                      onClose();
                    } else {
                      window.alert(result.error || "Falha ao cancelar pedido.");
                    }
                  });
                }
              }}
              className="flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:-translate-y-px hover:border-rose-300 disabled:pointer-events-none disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
            >
              {isCancelling ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                "Cancelar"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              Fechar
            </button>
          </div>
        </footer>\;

if (content.includes(target1) && content.includes(target2)) {
  content = content.replace(target1, \{showCancelForm ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="font-display text-base font-bold">Solicitar Cancelamento</h3>
              <p className="mb-4 mt-1 text-xs text-slate-500">
                Isso abrira um chamado de cancelamento para o operador logistico e pausara o pedido.
              </p>
              
              <label className="block text-xs text-slate-500">
                Assunto (Automatico)
                <input
                  disabled
                  value={\Cancelamento de pedido \\}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm opacity-70 outline-none dark:border-white/10 dark:bg-white/5"
                />
              </label>

              <label className="mt-4 block text-xs text-slate-500">
                Mensagem
                <textarea
                  autoFocus
                  value={cancelMessage}
                  onChange={(e) => setCancelMessage(e.target.value)}
                  className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-rose-500 dark:border-white/10 dark:bg-white/5"
                  placeholder="Descreva o motivo do cancelamento..."
                />
              </label>
            </div>
            <footer className="border-t border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f172a]">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isCancelling || !cancelMessage.trim()}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await requestPortalOrderCancellationAction(order.id, cancelMessage);
                      if (result.ok) {
                        onClose();
                      } else {
                        window.alert(result.error || "Falha ao solicitar cancelamento.");
                      }
                    });
                  }}
                  className="flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:-translate-y-px hover:border-rose-300 disabled:pointer-events-none disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
                >
                  {isCancelling ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    "Enviar Chamado"
                  )}
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setShowCancelForm(false)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  Voltar
                </button>
              </div>
            </footer>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">\);

  content = content.replace(target2, \<footer className="border-t border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0f172a]">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={order.status === "EXPEDIDO" || order.status === "CANCELADO"}
                  onClick={() => setShowCancelForm(true)}
                  className="flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition hover:-translate-y-px hover:border-rose-300 disabled:pointer-events-none disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
                >
                  Cancelar Pedido
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 transition hover:-translate-y-px hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  Fechar
                </button>
              </div>
            </footer>
          </>\);

  fs.writeFileSync('src/components/portal/portal-orders-view.tsx', content, 'utf-8');
  console.log("Success");
} else {
  console.log("Targets not found");
}
