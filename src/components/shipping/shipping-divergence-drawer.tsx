"use client";

import { useState, useTransition, useEffect } from "react";
import { 
  X, 
  AlertTriangle, 
  Boxes, 
  ScanBarcode, 
  XCircle, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  Package, 
  User, 
  Truck, 
  FileText, 
  Store,
  MapPin,
  Clock,
  Info
} from "lucide-react";
import { resolveShippingOrderDivergenceAction } from "@/app/(dashboard)/expedicao/actions";

type DivergenceOrderData = {
  id: string;
  code: string;
  displayNumber?: string;
  depositante?: string;
  customer?: string;
  destination?: string;
  channel?: string;
  carrierName?: string;
  nfe?: string;
  total?: string;
  status?: string;
  statusLabel?: string;
  orderDate?: string;
  cancellationReason?: string | null;
  divergenceReporter?: string | null;
  items?: Array<{
    name: string;
    sku: string;
    quantity: number;
    separatedQuantity: number;
  }>;
  raw?: any;
};

type ShippingDivergenceDrawerProps = {
  order: DivergenceOrderData | null;
  isOpen: boolean;
  onClose: () => void;
};

type ActionType = "REABRIR_SEPARACAO" | "REINICIAR_CONFERENCIA" | "CANCELAR_DEFINITIVO";

export function ShippingDivergenceDrawer({
  order,
  isOpen,
  onClose,
}: ShippingDivergenceDrawerProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>("REABRIR_SEPARACAO");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset state when opening a new order
  useEffect(() => {
    if (isOpen) {
      setSelectedAction("REABRIR_SEPARACAO");
      setNotes("");
    }
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const orderNumber = order.displayNumber || order.code;
  const reason = order.cancellationReason || order.raw?.cancellationReason || "Divergência registrada durante o fluxo de expedição.";
  const reporter = order.divergenceReporter || order.raw?.divergenceReporter || order.raw?.cancellationReporter || "Sistema";
  const items = order.items || order.raw?.items || [];
  const depositante = order.depositante || order.raw?.depositante || "-";
  const customer = order.customer || order.raw?.customer || "Cliente não informado";
  const destination = order.destination || order.raw?.destination || "-";
  const carrier = order.carrierName || order.raw?.carrierName || "-";
  const nfe = order.nfe || order.raw?.nfe || "Não vinculada";
  const total = order.total || order.raw?.total || "R$ 0,00";
  const channel = order.channel || order.raw?.channel || "Bling";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await resolveShippingOrderDivergenceAction(formData);
    });
  };

  const getActionConfig = (action: ActionType) => {
    switch (action) {
      case "REABRIR_SEPARACAO":
        return {
          title: "Reabrir para Separação / Picking",
          description: "Zera a contagem de itens separados e devolve o pedido para a fila de separação (picking). O operador deverá coletar todos os itens novamente nas prateleiras do armazém.",
          badge: "Reset de Picking",
          btnColor: "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold",
          borderActive: "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500",
          icon: <Boxes className="h-5 w-5 text-amber-500" />,
        };
      case "REINICIAR_CONFERENCIA":
        return {
          title: "Reiniciar Mesa de Conferência",
          description: "Mantém os itens marcados como separados e direciona o pedido imediatamente para a tela de conferência para nova validação e bipagem da DANFE/produtos.",
          badge: "Nova Bipagem",
          btnColor: "bg-purple-600 hover:bg-purple-700 text-white font-bold",
          borderActive: "border-purple-500 bg-purple-500/10 ring-1 ring-purple-500",
          icon: <ScanBarcode className="h-5 w-5 text-purple-500" />,
        };
      case "CANCELAR_DEFINITIVO":
        return {
          title: "Confirmar Cancelamento Definitivo",
          description: "Mantém o pedido cancelado e marca a divergência como tratada e encerrada. Não haverá novas tentativas operacionais.",
          badge: "Encerramento",
          btnColor: "bg-rose-600 hover:bg-rose-700 text-white font-bold",
          borderActive: "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500",
          icon: <XCircle className="h-5 w-5 text-rose-500" />,
        };
    }
  };

  const activeConfig = getActionConfig(selectedAction);

  return (
    <div 
      className="fixed inset-0 z-[120] flex justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl border-l border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                Tratamento de Divergência
              </span>
              <span className="text-xs text-slate-400 dark:text-zinc-500">•</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Canal: {channel}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white font-mono">
              Pedido {orderNumber}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu lateral"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card da Ocorrência */}
          <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-5 dark:border-amber-500/30">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Motivo da Divergência Reportada
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {reason}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-zinc-400 pt-1">
                  <span>Registrado por: <strong className="text-slate-900 dark:text-zinc-200">{reporter}</strong></span>
                  {order.orderDate ? (
                    <span>Data: <strong className="text-slate-900 dark:text-zinc-200">{order.orderDate}</strong></span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Dados do Pedido e Depositante */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Informações do Pedido
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500 dark:text-zinc-400 block">Depositante</span>
                <span className="font-semibold text-slate-900 dark:text-white">{depositante}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-zinc-400 block">Cliente</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">{customer}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-zinc-400 block">Destino</span>
                <span className="font-semibold text-slate-900 dark:text-white">{destination}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-zinc-400 block">Transportadora</span>
                <span className="font-semibold text-slate-900 dark:text-white">{carrier}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-zinc-400 block">Nota Fiscal (NF-e)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{nfe}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-zinc-400 block">Valor Total</span>
                <span className="font-semibold text-slate-900 dark:text-white">{total}</span>
              </div>
            </div>
          </div>

          {/* Itens do Pedido */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Produtos do Pedido ({items.length})
              </h3>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-zinc-400 py-3 text-center">
                Nenhum detalhamento de produto disponível.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-slate-400 dark:border-zinc-800 dark:text-zinc-500">
                    <tr>
                      <th className="pb-2 font-medium">Produto</th>
                      <th className="pb-2 font-medium">SKU / Código</th>
                      <th className="pb-2 font-medium text-center">Qtd Solicitada</th>
                      <th className="pb-2 font-medium text-center">Qtd Separada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {items.map((item: any, idx: number) => (
                      <tr key={idx} className="py-2.5">
                        <td className="py-2.5 pr-2 font-medium text-slate-900 dark:text-white max-w-[220px] truncate">
                          {item.name || item.nome || "Item"}
                        </td>
                        <td className="py-2.5 pr-2 font-mono text-slate-500 dark:text-zinc-400">
                          {item.sku || item.codigo_produto || "-"}
                        </td>
                        <td className="py-2.5 text-center font-bold text-slate-900 dark:text-white">
                          {item.quantity ?? item.quantidade ?? 1}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold ${
                            Number(item.separatedQuantity ?? item.quantidade_separada ?? 0) >= Number(item.quantity ?? item.quantidade ?? 1)
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}>
                            {item.separatedQuantity ?? item.quantidade_separada ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Seleção de Ações Disponíveis */}
          <form id="divergence-resolution-form" onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="resolutionType" value={selectedAction} />

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 block mb-2.5">
                Escolha a Ação de Resolução:
              </label>
              <div className="grid gap-3">
                {/* Opção 1: Reabrir Separação */}
                <div
                  onClick={() => setSelectedAction("REABRIR_SEPARACAO")}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    selectedAction === "REABRIR_SEPARACAO"
                      ? getActionConfig("REABRIR_SEPARACAO").borderActive
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                      <Boxes className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Reabrir para Separação
                        </h4>
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          Reset de Picking
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        Zera a coleta e devolve o pedido para a fila de separação (picking) no armazém. O operador separará novamente os itens.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opção 2: Reiniciar Conferência */}
                <div
                  onClick={() => setSelectedAction("REINICIAR_CONFERENCIA")}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    selectedAction === "REINICIAR_CONFERENCIA"
                      ? getActionConfig("REINICIAR_CONFERENCIA").borderActive
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                      <ScanBarcode className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Reiniciar Conferência
                        </h4>
                        <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                          Mesa de Conferência
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        Mantém a separação e abre a mesa de conferência para o operador realizar a bipagem e conferência da DANFE novamente.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opção 3: Cancelar Definitivo */}
                <div
                  onClick={() => setSelectedAction("CANCELAR_DEFINITIVO")}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    selectedAction === "CANCELAR_DEFINITIVO"
                      ? getActionConfig("CANCELAR_DEFINITIVO").borderActive
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                      <XCircle className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Confirmar Cancelamento Definitivo
                        </h4>
                        <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          Encerramento
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        Mantém o pedido cancelado e conclui o tratamento da divergência. Nenhuma nova etapa operacional será executada.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Observações Opcionais */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
                Observação do Tratamento (Opcional):
              </label>
              <textarea
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Produto avariado reposto no estoque, autorizado retorno para picking..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              />
            </div>
          </form>
        </div>

        {/* Footer with Action Button */}
        <div className="border-t border-slate-200 bg-slate-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition disabled:opacity-50"
          >
            Cancelar / Fechar
          </button>

          <button
            type="submit"
            form="divergence-resolution-form"
            disabled={isPending}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs shadow-md transition disabled:opacity-50 ${activeConfig.btnColor}`}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                Confirmar {activeConfig.title}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
