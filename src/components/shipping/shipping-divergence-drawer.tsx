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

type ActionType = "PROSSEGUIR_COM_DIVERGENCIA" | "CANCELAR_DEFINITIVO";

export function ShippingDivergenceDrawer({
  order,
  isOpen,
  onClose,
}: ShippingDivergenceDrawerProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType>("PROSSEGUIR_COM_DIVERGENCIA");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset state when opening a new order
  useEffect(() => {
    if (isOpen) {
      setSelectedAction("PROSSEGUIR_COM_DIVERGENCIA");
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
      case "PROSSEGUIR_COM_DIVERGENCIA":
        return {
          title: "Prosseguir com Divergência",
          description: "Autoriza a expedição do pedido mesmo com a divergência atual (ex: item faltante acordado com o depositante). O pedido é liberado para geração de romaneio e despacho.",
          badge: "Liberar para Envio",
          btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white font-bold",
          borderActive: "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500",
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
        };
      case "CANCELAR_DEFINITIVO":
        return {
          title: "Confirmar Cancelamento Definitivo",
          description: "Confirma o cancelamento do pedido por divergência insanável. O pedido é encerrado definitivamente e retirado do fluxo operacional.",
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
              {orderNumber}
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
                {/* Opção 1: Prosseguir com Divergência */}
                <div
                  onClick={() => setSelectedAction("PROSSEGUIR_COM_DIVERGENCIA")}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    selectedAction === "PROSSEGUIR_COM_DIVERGENCIA"
                      ? getActionConfig("PROSSEGUIR_COM_DIVERGENCIA").borderActive
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Prosseguir com Divergência
                        </h4>
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Liberar para Envio
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        Autoriza a expedição do pedido mesmo com a divergência atual (ex: item faltante acordado com o depositante). O pedido é liberado para geração de romaneio e despacho.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opção 2: Cancelar Definitivo */}
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
                        Confirma o cancelamento do pedido por divergência insanável. O pedido é encerrado definitivamente e retirado do fluxo operacional.
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
        <div className="border-t border-slate-200 bg-slate-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <button
            type="submit"
            form="divergence-resolution-form"
            disabled={isPending}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 px-6 text-sm shadow-md transition disabled:opacity-50 ${activeConfig.btnColor}`}
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
