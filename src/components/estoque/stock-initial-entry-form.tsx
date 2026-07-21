"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Camera, CameraOff, MapPinned, Package, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FancySelectInput,
  type FancySelectOption,
} from "@/components/ui/fancy-select-input";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";

type DepositanteOption = FancySelectOption;

type ProdutoOption = {
  id: string;
  depositanteId: string;
  nome: string;
  sku: string | null;
  codigoInterno: string | null;
  codigoExterno: string | null;
  exigeLote: boolean;
  exigeValidade: boolean;
};

type EnderecoOption = {
  id: string;
  codigo: string;
  area: string;
};

type StockInitialEntryFormProps = {
  depositantes: DepositanteOption[];
  produtos: ProdutoOption[];
  enderecos: EnderecoOption[];
  defaultDepositanteId?: string;
  canSelectDepositante: boolean;
};

export function StockInitialEntryForm({
  depositantes,
  produtos,
  enderecos,
  defaultDepositanteId = "",
  canSelectDepositante,
}: StockInitialEntryFormProps) {
  const router = useRouter();
  const enderecoInputRef = useRef<HTMLInputElement | null>(null);
  const produtoInputRef = useRef<HTMLInputElement | null>(null);
  const quantidadeInputRef = useRef<HTMLInputElement | null>(null);
  const shouldAdvanceToProdutoRef = useRef(false);
  const shouldAdvanceToQuantidadeRef = useRef(false);
  const [depositanteId, setDepositanteId] = useState(
    defaultDepositanteId || (depositantes.length === 1 ? depositantes[0]?.value ?? "" : ""),
  );
  const [enderecoCodigo, setEnderecoCodigo] = useState("");
  const [produtoCodigo, setProdutoCodigo] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [lote, setLote] = useState("");
  const [validadeEm, setValidadeEm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const produtosDoDepositante = useMemo(
    () => produtos.filter((item) => item.depositanteId === depositanteId),
    [depositanteId, produtos],
  );

  const matchedEndereco = useMemo(() => {
    const normalized = normalizeCode(enderecoCodigo);
    if (!normalized) {
      return null;
    }

    return enderecos.find((item) => normalizeCode(item.codigo) === normalized) ?? null;
  }, [enderecoCodigo, enderecos]);

  const matchedProduto = useMemo(() => {
    const normalized = normalizeCode(produtoCodigo);
    if (!normalized || !depositanteId) {
      return null;
    }

    return (
      produtosDoDepositante.find((item) =>
        [item.codigoExterno, item.codigoInterno, item.sku].some(
          (value) => value && normalizeCode(value) === normalized,
        ),
      ) ?? null
    );
  }, [depositanteId, produtoCodigo, produtosDoDepositante]);

  const handleEnderecoDetected = useCallback(
    (code: string) => {
      const normalized = normalizeCode(code);
      const foundEndereco =
        enderecos.find((item) => normalizeCode(item.codigo) === normalized) ?? null;
      setEnderecoCodigo(code);
      if (foundEndereco) {
        shouldAdvanceToProdutoRef.current = true;
        return;
      }

      requestAnimationFrame(() => {
        enderecoInputRef.current?.focus();
        enderecoInputRef.current?.select();
      });
    },
    [enderecos],
  );

  const handleProdutoDetected = useCallback(
    (code: string) => {
      const normalized = normalizeCode(code);
      const foundProduto =
        normalized && depositanteId
          ? produtosDoDepositante.find((item) =>
              [item.codigoExterno, item.codigoInterno, item.sku].some(
                (value) => value && normalizeCode(value) === normalized,
              ),
            ) ?? null
          : null;
      setProdutoCodigo(code);
      if (foundProduto) {
        shouldAdvanceToQuantidadeRef.current = true;
        return;
      }

      requestAnimationFrame(() => {
        produtoInputRef.current?.focus();
        produtoInputRef.current?.select();
      });
    },
    [depositanteId, produtosDoDepositante],
  );

  const enderecoScanner = useCameraBarcodeScanner({
    onDetected: handleEnderecoDetected,
  });

  const produtoScanner = useCameraBarcodeScanner({
    onDetected: handleProdutoDetected,
  });

  const stopEnderecoCamera = enderecoScanner.stopCamera;
  const stopProdutoCamera = produtoScanner.stopCamera;

  useEffect(() => {
    if (!shouldAdvanceToProdutoRef.current || !matchedEndereco) {
      return;
    }

    shouldAdvanceToProdutoRef.current = false;
    stopEnderecoCamera("Endereço lido. Continue no produto.");
    requestAnimationFrame(() => {
      produtoInputRef.current?.focus();
      produtoInputRef.current?.select();
    });
  }, [matchedEndereco, stopEnderecoCamera]);

  useEffect(() => {
    if (!shouldAdvanceToQuantidadeRef.current || !matchedProduto) {
      return;
    }

    shouldAdvanceToQuantidadeRef.current = false;
    stopProdutoCamera("Produto lido. Informe a quantidade.");
    requestAnimationFrame(() => {
      quantidadeInputRef.current?.focus();
      quantidadeInputRef.current?.select();
    });
  }, [matchedProduto, stopProdutoCamera]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!depositanteId) {
      setFeedback({ type: "error", message: "Selecione o depositante da contagem." });
      return;
    }

    if (!matchedEndereco) {
      setFeedback({ type: "error", message: "Bipe ou digite um endereço válido antes de salvar." });
      return;
    }

    if (!matchedProduto) {
      setFeedback({ type: "error", message: "Bipe ou digite um produto válido antes de salvar." });
      return;
    }

    if (!quantidade.trim() || Number(quantidade) <= 0) {
      setFeedback({ type: "error", message: "Informe uma quantidade maior que zero." });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/estoque", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          depositanteId,
          enderecoCodigo,
          produtoCodigo,
          quantidade,
          lote,
          validadeEm,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: payload.error ?? "Não foi possível lançar o saldo inicial.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: payload.message ?? "Saldo inicial lançado com sucesso.",
      });
      setEnderecoCodigo("");
      setProdutoCodigo("");
      setQuantidade("");
      setLote("");
      setValidadeEm("");
      enderecoScanner.stopCamera("Leitura por câmera pausada.");
      produtoScanner.stopCamera("Leitura por câmera pausada.");
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Falha de comunicação ao salvar a contagem inicial.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Carga inicial de estoque
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Use esta etapa para lançar a primeira contagem real do armazém. Aqui entram endereço,
            produto, quantidade, lote e validade quando aplicável.
          </p>
        </div>
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
          Inventário inicial
        </span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FancySelectInput
            label="Depositante"
            name="depositanteId"
            value={depositanteId}
            onChange={setDepositanteId}
            options={depositantes}
            disabled={!canSelectDepositante}
          />

          <ScanInputField
            label="Endereço"
            icon={MapPinned}
            placeholder="Bipe ou digite o código do endereço"
            value={enderecoCodigo}
            onChange={setEnderecoCodigo}
            inputRef={enderecoInputRef}
            videoRef={enderecoScanner.videoRef}
            cameraSupported={enderecoScanner.cameraSupported}
            cameraEnabled={enderecoScanner.cameraEnabled}
            cameraStarting={enderecoScanner.cameraStarting}
            cameraMessage={enderecoScanner.cameraMessage}
            onToggleCamera={enderecoScanner.toggleCamera}
            helperText="Funciona com leitor USB conectado ao teclado ou com câmera do notebook/celular."
          />

          <ScanInputField
            label="Produto"
            icon={Barcode}
            placeholder="Bipe EAN, SKU ou código interno"
            value={produtoCodigo}
            onChange={setProdutoCodigo}
            inputRef={produtoInputRef}
            videoRef={produtoScanner.videoRef}
            cameraSupported={produtoScanner.cameraSupported}
            cameraEnabled={produtoScanner.cameraEnabled}
            cameraStarting={produtoScanner.cameraStarting}
            cameraMessage={produtoScanner.cameraMessage}
            onToggleCamera={produtoScanner.toggleCamera}
            helperText="Leia o EAN/GTIN, SKU ou código interno do produto para localizar o item."
          />

          <InputField
            label="Quantidade"
            icon={Package}
            placeholder="Ex.: 24"
            value={quantidade}
            onChange={setQuantidade}
            inputMode="decimal"
            inputRef={quantidadeInputRef}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="font-medium text-slate-700 dark:text-slate-200">Endereço localizado</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {matchedEndereco
                ? `${matchedEndereco.codigo} - ${formatÁreaLabel(matchedEndereco.area)}`
                : "Aguardando leitura do endereço."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="font-medium text-slate-700 dark:text-slate-200">Produto localizado</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {matchedProduto
                ? `${matchedProduto.nome}${matchedProduto.sku ? ` - ${matchedProduto.sku}` : ""}`
                : "Aguardando leitura do produto."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Lote
            </span>
            <input
              type="text"
              value={lote}
              onChange={(event) => setLote(event.target.value)}
              placeholder="Obrigatório se o produto controlar lote"
              className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-slate-500"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Validade
            </span>
            <input
              type="date"
              value={validadeEm}
              onChange={(event) => setValidadeEm(event.target.value)}
              className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </label>
        </div>

        {matchedProduto ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {matchedProduto.exigeLote ? "Este produto exige lote." : "Lote opcional."}{" "}
            {matchedProduto.exigeValidade
              ? "A validade é obrigatória para o saldo inicial."
              : "Validade opcional."}
          </div>
        ) : null}

        {feedback ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              feedback.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Lançando..." : "Lançar estoque inicial"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ScanInputField({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  inputRef,
  videoRef,
  cameraSupported,
  cameraEnabled,
  cameraStarting,
  cameraMessage,
  onToggleCamera,
  helperText,
}: {
  label: string;
  icon: typeof Barcode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraSupported: boolean;
  cameraEnabled: boolean;
  cameraStarting: boolean;
  cameraMessage: string | null;
  onToggleCamera: () => void;
  helperText: string;
}) {
  return (
    <div className="block md:col-span-1 xl:col-span-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleCamera}
            disabled={cameraStarting}
            className="h-9 rounded-xl border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            {cameraEnabled ? (
              <CameraOff className="mr-2 h-4 w-4" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            {cameraEnabled ? "Desligar câmera" : "Ler código"}
          </Button>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <Barcode className="h-3.5 w-3.5" />
            USB ou câmera
          </span>
        </div>
      </div>

      <div className="mt-2 flex h-[52px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-[0_10px_35px_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900">
        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
        {helperText}
      </div>

      {(cameraEnabled || cameraStarting || cameraMessage) && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="grid gap-3 sm:grid-cols-[180px,1fr] sm:items-start">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-[4/3] h-full w-full object-cover"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Leitura por câmera
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {cameraMessage ??
                  "Aponte a câmera para o código. Quando a leitura ocorrer, o campo será preenchido automaticamente."}
              </p>
              {!cameraSupported ? (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Seu navegador não liberou a câmera. Se estiver no celular, teste pelo Chrome ou
                  Safari atualizados.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  inputMode,
  inputRef,
}: {
  label: string;
  icon: typeof Barcode;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex h-[52px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-[0_10px_35px_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900">
        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
        />
      </div>
    </label>
  );
}

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function formatÁreaLabel(value: string) {
  switch (value) {
    case "RECEBIMENTO":
      return "Recebimento";
    case "PULMAO":
      return "Armazenagem";
    case "PICKING":
      return "Picking";
    case "BLOQUEADO":
      return "Bloqueado";
    case "EXPEDICAO":
      return "Expedição";
    default:
      return value;
  }
}
