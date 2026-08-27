"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, PackageX, RotateCcw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  abandonShippingOrderCancellationAction,
  concludeShippingOrderCancellationAction,
  registerCancellationScanAction,
} from "@/app/(dashboard)/expedicao/cancelamento/actions";

type CancellationLine = {
  id: string;
  produtoId: string;
  sku: string;
  productName: string;
  imageUrl: string | null;
  estoqueId: string | null;
  enderecoEsperadoId: string | null;
  enderecoEsperadoCodigo: string | null;
  quantidadeEsperada: number;
  quantidadeConfirmada: number;
  quantidadeConfirmadaAvariada: number;
  status: "PENDENTE" | "CONCLUIDO" | "DIVERGENTE";
};

type ShippingCancellationScanPanelProps = {
  cancelamentoId: string;
  status: string;
  motivo: string | null;
  abertoEm: string;
  feedback: string;
  currentUserId: string;
  order: {
    id: string;
    orderNumber: string;
    depositante: string;
    cliente: string;
  };
  lines: CancellationLine[];
};

type ScanPhase = "endereco" | "produto";

function generateScanId() {
  return crypto.randomUUID();
}

export function ShippingCancellationScanPanel({
  cancelamentoId,
  status,
  motivo,
  order,
  lines: initialLines,
  feedback,
}: ShippingCancellationScanPanelProps) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [phase, setPhase] = useState<ScanPhase>("endereco");
  const [scanValue, setScanValue] = useState("");
  const [condicao, setCondicao] = useState<"BOM" | "AVARIADO">("BOM");
  const [message, setMessage] = useState<{ type: "erro" | "info"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDivergenceConfirm, setShowDivergenceConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentLine = useMemo(() => lines.find((line) => line.status === "PENDENTE") ?? null, [lines]);
  const allConfirmed = lines.every((line) => line.status !== "PENDENTE");
  const pendingCount = lines.filter((line) => line.status === "PENDENTE").length;

  if (status === "CONCLUIDO") {
    return (
      <SummaryState
        icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
        title="Cancelamento concluído"
        description={`Pedido ${order.orderNumber} — a devolução ao estoque já foi confirmada.`}
      />
    );
  }

  if (status === "ABANDONADO") {
    return (
      <SummaryState
        icon={<RotateCcw className="h-10 w-10 text-slate-400" />}
        title="Processo abandonado"
        description={`O cancelamento do pedido ${order.orderNumber} foi abandonado sem concluir.`}
      />
    );
  }

  async function handleScanSubmit() {
    if (!currentLine || !scanValue.trim() || isSubmitting) return;
    const code = scanValue.trim().toUpperCase();

    if (phase === "endereco") {
      const expected = currentLine.enderecoEsperadoCodigo?.toUpperCase();
      if (expected && code !== expected) {
        setMessage({ type: "erro", text: `Endereço incorreto. Esperado: ${expected}.` });
        setScanValue("");
        return;
      }
      setMessage(null);
      setScanValue("");
      setPhase("produto");
      return;
    }

    const expectedProduct = currentLine.sku.toUpperCase();
    if (code !== expectedProduct) {
      setMessage({ type: "erro", text: `Produto incorreto. Esperado: ${currentLine.sku}.` });
      setScanValue("");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const result = await registerCancellationScanAction({
      cancelamentoItemId: currentLine.id,
      enderecoId: currentLine.enderecoEsperadoId ?? "",
      estoqueId: currentLine.estoqueId,
      produtoId: currentLine.produtoId,
      quantity: 1,
      condicao,
      scanId: generateScanId(),
    });

    setIsSubmitting(false);
    setScanValue("");
    setPhase("endereco");
    setCondicao("BOM");

    if (!result.ok) {
      setMessage({ type: "erro", text: result.message ?? "Não foi possível registrar a bipagem." });
      return;
    }

    setLines((current) =>
      current.map((line) => {
        if (line.id !== currentLine.id) return line;
        const nextConfirmada = line.quantidadeConfirmada + 1;
        return {
          ...line,
          quantidadeConfirmada: nextConfirmada,
          quantidadeConfirmadaAvariada:
            line.quantidadeConfirmadaAvariada + (condicao === "AVARIADO" ? 1 : 0),
          status: nextConfirmada >= line.quantidadeEsperada ? "CONCLUIDO" : "PENDENTE",
        };
      }),
    );

    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Cancelamento em andamento
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {order.depositante} · {order.cliente}
            </p>
            {motivo ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Motivo: {motivo}</p> : null}
          </div>
          <form action={abandonShippingOrderCancellationAction}>
            <input type="hidden" name="cancelamentoId" value={cancelamentoId} />
            <Button
              type="submit"
              variant="outline"
              className="dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Abandonar
            </Button>
          </form>
        </div>

        {feedback === "divergencia" ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Ainda há itens sem confirmação completa de devolução. Confirme o restante ou force a
            conclusão com divergência abaixo.
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Itens pendentes de devolução ({pendingCount})
        </h2>

        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <div
              key={line.id}
              className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
                line.id === currentLine?.id
                  ? "border-primary-500 bg-primary-500/5 dark:border-primary-400"
                  : line.status === "CONCLUIDO"
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-zinc-800"
              }`}
            >
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">{line.productName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  SKU {line.sku} · Endereço esperado:{" "}
                  {line.enderecoEsperadoCodigo ?? "a definir na primeira bipagem"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {line.status === "CONCLUIDO" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : null}
                <span className="text-slate-700 dark:text-slate-200">
                  {line.quantidadeConfirmada}/{line.quantidadeEsperada}
                </span>
                {line.quantidadeConfirmadaAvariada > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" />
                    {line.quantidadeConfirmadaAvariada} avariado(s)
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {currentLine ? (
          <div className="mt-6 rounded-2xl border border-dashed border-primary-500/40 bg-primary-500/5 p-5">
            <div className="flex items-center gap-3">
              <ScanLine className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">
                  {phase === "endereco" ? "Bipe o endereço de devolução" : "Bipe o produto para confirmar"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentLine.productName} — {currentLine.enderecoEsperadoCodigo ?? "endereço a confirmar"}
                </p>
              </div>
            </div>

            <input
              ref={inputRef}
              autoFocus
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleScanSubmit();
                }
              }}
              disabled={isSubmitting}
              placeholder={
                phase === "endereco" ? "Código do endereço..." : "SKU / código do produto..."
              }
              className="mt-4 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-primary-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />

            {phase === "produto" ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCondicao("BOM")}
                  className={`h-9 flex-1 rounded-lg border text-xs font-semibold ${
                    condicao === "BOM"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 text-slate-500 dark:border-zinc-700 dark:text-slate-400"
                  }`}
                >
                  Bom estado
                </button>
                <button
                  type="button"
                  onClick={() => setCondicao("AVARIADO")}
                  className={`h-9 flex-1 rounded-lg border text-xs font-semibold ${
                    condicao === "AVARIADO"
                      ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300"
                      : "border-slate-200 text-slate-500 dark:border-zinc-700 dark:text-slate-400"
                  }`}
                >
                  Avariado
                </button>
              </div>
            ) : null}

            {message ? (
              <p
                className={`mt-3 text-sm ${message.type === "erro" ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}`}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            Todos os itens foram confirmados. Conclua o cancelamento abaixo.
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {!allConfirmed && !showDivergenceConfirm ? (
            <Button
              type="button"
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-300"
              onClick={() => setShowDivergenceConfirm(true)}
            >
              <PackageX className="h-4 w-4" />
              Forçar conclusão com itens faltando
            </Button>
          ) : null}

          {showDivergenceConfirm ? (
            <form
              action={concludeShippingOrderCancellationAction}
              className="flex items-center gap-2"
              onSubmit={() => router.refresh()}
            >
              <input type="hidden" name="cancelamentoId" value={cancelamentoId} />
              <input type="hidden" name="forcarDivergencia" value="true" />
              <input type="hidden" name="motivoDivergencia" value="Itens não localizados na devolução." />
              <Button
                type="submit"
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                Confirmar divergência e concluir
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowDivergenceConfirm(false)}>
                Cancelar
              </Button>
            </form>
          ) : (
            <form action={concludeShippingOrderCancellationAction}>
              <input type="hidden" name="cancelamentoId" value={cancelamentoId} />
              <Button
                type="submit"
                disabled={!allConfirmed}
                className="bg-slate-950 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950"
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir cancelamento
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      {icon}
      <h1 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}
