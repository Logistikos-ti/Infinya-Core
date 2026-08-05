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
import { formatDateTimePtBr } from "@/lib/utils";

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
  readOnly?: boolean;
  redirectTo?: string;
};

type ActionType = "PROSSEGUIR_COM_DIVERGENCIA" | "CANCELAR_DEFINITIVO";

export function ShippingDivergenceDrawer({
  order,
  isOpen,
  onClose,
  readOnly = false,
  redirectTo = "",
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

  const tratamento = order.raw?.payload_origem?.tratamentoDivergencia 
    || order.raw?.tratamentoDivergencia 
    || (order as any).tratamentoDivergencia;

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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {orderNumber}
                </h3>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {readOnly ? "Visualização de Divergência" : "Tratamento de Divergência"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {readOnly 
                  ? "Detalhes completos do pedido travado e status da tratativa" 
                  : "Defina a tratativa para destravar o fluxo deste pedido no armazém"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Card: Ocorrência Registrada */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Info className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Ocorrência / Motivo da Divergência:
                </h4>
                <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 leading-relaxed">
                  {reason}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 pt-1">
                  Registrado por: <strong className="text-slate-700 dark:text-zinc-300">{reporter}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Dados do Pedido */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Informações do Pedido
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Depositante
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {depositante}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Destinatário / Cliente
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {customer}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> NF-e
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {nfe}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1 flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" /> Canal / Origem
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {channel}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Transportadora
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {carrier}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Cidade / Destino
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                  {destination}
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Itens do Pedido */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Itens do Pedido ({items.length})
              </h4>
              <span className="text-xs text-slate-400">
                Qtd. Pedida vs Separada
              </span>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Nenhum item listado para este pedido.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-3">Produto / SKU</th>
                      <th className="py-2.5 text-center w-20">Qtd. Pedida</th>
                      <th className="py-2.5 text-center w-24">Qtd. Separada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">
                            {item.name || item.nome || "Item sem nome"}
                          </p>
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                            SKU: {item.sku || "-"}
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-semibold text-slate-700 dark:text-zinc-300">
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

          {/* READ ONLY: Exibe Status da Tratativa */}
          {readOnly ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Status da Tratativa
              </h4>

              {tratamento ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {tratamento.acao === "PROSSEGUIR_COM_DIVERGENCIA"
                        ? "Prosseguir com Divergência (Autorizado)"
                        : tratamento.acao === "CANCELAR_DEFINITIVO"
                        ? "Cancelamento Definitivo Confirmado"
                        : tratamento.acao || "Tratado"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300">
                    Tratado por: <strong>{tratamento.tratadoPorNome || "Depositante"}</strong>
                    {tratamento.tratadoEm && ` em ${formatDateTimePtBr(tratamento.tratadoEm)}`}
                  </p>
                  {tratamento.observacao && (
                    <div className="mt-2 rounded-xl bg-white/60 p-2.5 text-xs text-slate-700 dark:bg-zinc-900/60 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-800">
                      <strong>Observação:</strong> {tratamento.observacao}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 dark:border-amber-500/20 dark:bg-amber-500/10 flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Aguardando Tratativa do Depositante
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                      O pedido está bloqueado aguardando o depositante definir no portal se autoriza a expedição mesmo com a divergência ou se confirma o cancelamento.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SELEÇÃO DE AÇÕES DE RESOLUÇÃO (Depositante / Operador com ação ativa) */
            <form id="divergence-resolution-form" onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="resolutionType" value={selectedAction} />
              {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

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
                  placeholder="Ex: Autorizado envio sem o item faltante conforme alinhamento com cliente final..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer with Action Button (only in interactive mode) */}
        {!readOnly && (
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
        )}
      </div>
    </div>
  );
}
