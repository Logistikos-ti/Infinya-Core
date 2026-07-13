"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Camera, CameraOff, Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { saveProdutoAction } from "@/app/(dashboard)/configuracoes/produtos/actions";
import { Button } from "@/components/ui/button";
import type { ProductKitComponentDraft, ProductKitComponentOption } from "@/lib/product-kits";
import { cn } from "@/lib/utils";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";

type DepositanteOption = {
  id: string;
  nome: string;
};

type ProdutoFormProps = {
  depositantes: DepositanteOption[];
  productOptions: ProductKitComponentOption[];
  productKitEnabled?: boolean;
  compactMode?: boolean;
  returnPath?: string;
  defaultValues?: {
    id?: string;
    depositanteId?: string;
    codigoInterno?: string;
    sku?: string;
    nome?: string;
    eanGtin?: string;
    categoria?: string;
    tipoProduto?: "SIMPLES" | "KIT";
    metodoRetirada?: "FEFO" | "FIFO" | "LIFO";
    unidadeEstocagem?: "UNIDADE" | "CAIXA" | "PACK" | "PALLET";
    quantidadePorEmbalagem?: number | null;
    exigeLote?: boolean;
    exigeValidade?: boolean;
    ativo?: boolean;
    kitComponents?: ProductKitComponentDraft[];
  };
};

export function ProdutoForm({
  depositantes,
  productOptions,
  productKitEnabled = false,
  compactMode = false,
  returnPath,
  defaultValues,
}: ProdutoFormProps) {
  const initialState = {
    success: false,
    message: null,
  };

  const [state, formAction, isPending] = useActionState(saveProdutoAction, initialState);
  const [eanGtinValue, setEanGtinValue] = useState(defaultValues?.eanGtin ?? "");
  const [depositanteId, setDepositanteId] = useState(
    defaultValues?.depositanteId ?? (depositantes.length === 1 ? depositantes[0]?.id ?? "" : ""),
  );
  const [tipoProduto, setTipoProduto] = useState<"SIMPLES" | "KIT">(
    defaultValues?.tipoProduto ?? "SIMPLES",
  );
  const [metodoRetirada, setMetodoRetirada] = useState<"FEFO" | "FIFO" | "LIFO">(
    defaultValues?.metodoRetirada ?? "FEFO",
  );
  const [unidadeEstocagem, setUnidadeEstocagem] = useState<
    "UNIDADE" | "CAIXA" | "PACK" | "PALLET"
  >(defaultValues?.unidadeEstocagem ?? "UNIDADE");
  const [kitComponents, setKitComponents] = useState<Array<ProductKitComponentDraft & { key: string }>>(
    buildKitRows(defaultValues?.kitComponents),
  );
  const eanInputRef = useRef<HTMLInputElement | null>(null);

  const exibeQuantidadePorEmbalagem = useMemo(
    () => unidadeEstocagem === "CAIXA" || unidadeEstocagem === "PACK",
    [unidadeEstocagem],
  );

  const depositanteOptions = useMemo(
    () =>
      depositantes.length === 1
        ? depositantes.map((item) => ({ value: item.id, label: item.nome }))
        : [
            { value: "", label: "Selecione um depositante" },
            ...depositantes.map((item) => ({ value: item.id, label: item.nome })),
          ],
    [depositantes],
  );

  const filteredProductOptions = useMemo(
    () =>
      productOptions.filter(
        (item) =>
          (!depositanteId || item.depositanteId === depositanteId) &&
          (!defaultValues?.id || item.id !== defaultValues.id),
      ),
    [defaultValues?.id, depositanteId, productOptions],
  );

  const handleBarcodeDetected = useCallback((code: string) => {
    setEanGtinValue(code);
    requestAnimationFrame(() => {
      eanInputRef.current?.focus();
      eanInputRef.current?.select();
    });
  }, []);

  const {
    videoRef,
    cameraSupported,
    cameraEnabled,
    cameraStarting,
    cameraMessage,
    toggleCamera,
  } = useCameraBarcodeScanner({
    onDetected: handleBarcodeDetected,
  });

  useEffect(() => {
    setEanGtinValue(defaultValues?.eanGtin ?? "");
    setDepositanteId(
      defaultValues?.depositanteId ?? (depositantes.length === 1 ? depositantes[0]?.id ?? "" : ""),
    );
    setTipoProduto(defaultValues?.tipoProduto ?? "SIMPLES");
    setMetodoRetirada(defaultValues?.metodoRetirada ?? "FEFO");
    setUnidadeEstocagem(defaultValues?.unidadeEstocagem ?? "UNIDADE");
    setKitComponents(buildKitRows(defaultValues?.kitComponents));
  }, [
    defaultValues?.depositanteId,
    defaultValues?.eanGtin,
    defaultValues?.kitComponents,
    defaultValues?.metodoRetirada,
    defaultValues?.tipoProduto,
    defaultValues?.unidadeEstocagem,
    depositantes,
  ]);

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
          {defaultValues?.id ? "Editar produto" : "Novo produto"}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Cadastro de SKU com depositante, EAN/GTIN, categoria, tipo de produto, método de retirada,
          unidade de estocagem e regra de embalagem.
        </p>
        {compactMode ? (
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            Modo de cadastro rápido com identificação técnica preservada automaticamente.
          </p>
        ) : null}
      </div>

      <input type="hidden" name="id" value={defaultValues?.id ?? ""} />
      <input type="hidden" name="returnPath" value={returnPath ?? ""} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <FancySelectField
          label="Depositante"
          name="depositanteId"
          value={depositanteId}
          onChange={setDepositanteId}
          error={state.errors?.depositanteId}
          options={depositanteOptions}
        />

        {compactMode ? (
          <>
            <input type="hidden" name="codigoInterno" value={defaultValues?.codigoInterno ?? ""} />
            <input type="hidden" name="sku" value={defaultValues?.sku ?? ""} />
          </>
        ) : (
          <>
            <Field
              label="Código interno"
              name="codigoInterno"
              defaultValue={defaultValues?.codigoInterno ?? ""}
              error={state.errors?.codigoInterno}
            />
            <Field
              label="SKU"
              name="sku"
              defaultValue={defaultValues?.sku ?? ""}
              error={state.errors?.sku}
            />
          </>
        )}

        <Field
          label="Nome do produto"
          name="nome"
          defaultValue={defaultValues?.nome ?? ""}
          error={state.errors?.nome}
        />

        <BarcodeField
          value={eanGtinValue}
          error={state.errors?.eanGtin}
          inputRef={eanInputRef}
          onChange={setEanGtinValue}
          videoRef={videoRef}
          cameraSupported={cameraSupported}
          cameraEnabled={cameraEnabled}
          cameraStarting={cameraStarting}
          cameraMessage={cameraMessage}
          onToggleCamera={toggleCamera}
        />

        {compactMode ? (
          <input type="hidden" name="categoria" value={defaultValues?.categoria ?? ""} />
        ) : (
          <Field
            label="Categoria"
            name="categoria"
            defaultValue={defaultValues?.categoria ?? ""}
            error={state.errors?.categoria}
          />
        )}

        {productKitEnabled ? (
          <FancySelectField
            label="Tipo de produto"
            name="tipoProduto"
            value={tipoProduto}
            onChange={(value) => setTipoProduto(value as "SIMPLES" | "KIT")}
            error={state.errors?.tipoProduto}
            options={[
              { value: "SIMPLES", label: "Simples" },
              { value: "KIT", label: "Kit montado na separação" },
            ]}
          />
        ) : (
          <input type="hidden" name="tipoProduto" value="SIMPLES" />
        )}

        <FancySelectField
          label="Método de retirada"
          name="metodoRetirada"
          value={metodoRetirada}
          onChange={(value) => setMetodoRetirada(value as "FEFO" | "FIFO" | "LIFO")}
          error={state.errors?.metodoRetirada}
          options={[
            { value: "FEFO", label: "FEFO" },
            { value: "FIFO", label: "FIFO" },
            { value: "LIFO", label: "LIFO" },
          ]}
        />

        <FancySelectField
          label="Unidade de estocagem"
          name="unidadeEstocagem"
          value={unidadeEstocagem}
          onChange={(value) => setUnidadeEstocagem(value as "UNIDADE" | "CAIXA" | "PACK" | "PALLET")}
          error={state.errors?.unidadeEstocagem}
          options={[
            { value: "UNIDADE", label: "Unidade" },
            { value: "CAIXA", label: "Caixa" },
            { value: "PACK", label: "Pack" },
            { value: "PALLET", label: "Pallet" },
          ]}
        />

        {exibeQuantidadePorEmbalagem ? (
          <Field
            label={`Quantidade por ${unidadeEstocagem === "PACK" ? "pack" : "caixa"}`}
            name="quantidadePorEmbalagem"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={String(defaultValues?.quantidadePorEmbalagem ?? "")}
            error={state.errors?.quantidadePorEmbalagem}
            helperText="Informe quantas unidades deste SKU existem dentro da embalagem."
          />
        ) : (
          <input type="hidden" name="quantidadePorEmbalagem" value="" />
        )}
      </div>

      {productKitEnabled && tipoProduto === "KIT" ? (
        <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/20 dark:bg-cyan-500/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                Composição do kit
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Escolha os SKUs reais que o operador deve bipar para montar este kit.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setKitComponents((current) => [
                  ...current,
                  {
                    key: `component-${current.length}-${Date.now()}`,
                    componentProductId: "",
                    quantity: 1,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Adicionar componente
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {kitComponents.map((component, index) => (
              <div
                key={component.key}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60 md:grid-cols-[minmax(0,1fr)_180px_48px]"
              >
                <FancySelectField
                  label={`Componente ${index + 1}`}
                  name={`kit-component-visible-${index}`}
                  value={component.componentProductId}
                  onChange={(value) =>
                    setKitComponents((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, componentProductId: value } : item,
                      ),
                    )
                  }
                  options={[
                    { value: "", label: "Selecione um SKU componente" },
                    ...filteredProductOptions.map((item) => ({
                      value: item.id,
                      label: `${item.nome} • ${item.sku ?? item.codigoInterno ?? item.codigoExterno ?? item.id}`,
                    })),
                  ]}
                />

                <Field
                  label="Qtd por kit"
                  name={`kit-component-quantity-visible-${index}`}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[,.]?[0-9]*"
                  defaultValue={String(component.quantity)}
                  value={String(component.quantity)}
                  onChange={(value) =>
                    setKitComponents((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, quantity: Number(value.replace(",", ".")) || 0 }
                          : item,
                      ),
                    )
                  }
                />

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-[52px] w-12"
                    onClick={() =>
                      setKitComponents((current) =>
                        current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current,
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <input type="hidden" name="kitComponentProductId" value={component.componentProductId} />
                <input type="hidden" name="kitComponentQuantity" value={String(component.quantity)} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <CheckboxField
          name="exigeLote"
          label="Controlar lote"
          description="Exige rastreabilidade de lote nas operações do produto."
          defaultChecked={defaultValues?.exigeLote ?? false}
        />
        <CheckboxField
          name="exigeValidade"
          label="Controlar validade"
          description="Ativa controle de validade e suporte ao FEFO quando necessário."
          defaultChecked={defaultValues?.exigeValidade ?? false}
        />
        <CheckboxField
          name="ativo"
          label="Produto ativo"
          description="Mantém o SKU disponível para recebimento, estoque e expedição."
          defaultChecked={defaultValues?.ativo ?? true}
        />
      </div>

      {state.message ? (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            state.success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
        >
          {isPending ? "Salvando..." : defaultValues?.id ? "Salvar alterações" : "Criar produto"}
        </Button>
      </div>
    </form>
  );
}

function buildKitRows(components?: ProductKitComponentDraft[]) {
  const source = components?.length ? components : [{ componentProductId: "", quantity: 1 }];
  return source.map((item, index) => ({
    ...item,
    key: `${item.componentProductId || "component"}-${index}`,
  }));
}

type FieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value?: string;
  onChange?: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  step?: number;
  helperText?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
};

function Field({
  label,
  name,
  defaultValue,
  error,
  inputRef,
  value,
  onChange,
  type = "text",
  min,
  step,
  helperText,
  inputMode,
  pattern,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        ref={inputRef ?? undefined}
        type={type}
        min={min}
        step={step}
        inputMode={inputMode}
        pattern={pattern}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        onWheel={type === "number" ? (event) => event.currentTarget.blur() : undefined}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/40"
      />
      {helperText ? (
        <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">{helperText}</span>
      ) : null}
      {error ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-300">{error}</span> : null}
    </label>
  );
}

type FancySelectFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  options: { value: string; label: string }[];
};

function FancySelectField({
  label,
  name,
  value,
  onChange,
  error,
  options,
}: FancySelectFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="block" ref={containerRef}>
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-[52px] w-full items-center justify-between rounded-2xl border bg-white px-4 text-left text-sm text-slate-950 outline-none transition",
          "border-slate-300 shadow-[0_10px_35px_rgba(15,23,42,0.04)] hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)]",
          "focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus-visible:ring-cyan-900/40",
        )}
      >
        <span className="truncate">{selectedOption?.label ?? "Selecionar"}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-500 transition-transform dark:text-slate-300",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {open ? (
        <div className="relative">
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-950">
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={`${name}-${option.value}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition",
                    selected
                      ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
                  )}
                >
                  <span>{option.label}</span>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-300">{error}</span> : null}
    </div>
  );
}

type CheckboxFieldProps = {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
};

function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
}: CheckboxFieldProps) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
      <span>
        <span className="font-medium text-slate-950 dark:text-slate-100">{label}</span>
        <span className="mt-1 block text-slate-500 dark:text-slate-400">{description}</span>
      </span>
    </label>
  );
}

type BarcodeFieldProps = {
  value: string;
  error?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraSupported: boolean;
  cameraEnabled: boolean;
  cameraStarting: boolean;
  cameraMessage: string | null;
  onToggleCamera: () => void;
};

function BarcodeField({
  value,
  error,
  inputRef,
  onChange,
  videoRef,
  cameraSupported,
  cameraEnabled,
  cameraStarting,
  cameraMessage,
  onToggleCamera,
}: BarcodeFieldProps) {
  return (
    <div className="block md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
          EAN/GTIN
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

      <input
        ref={inputRef}
        name="eanGtin"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Digite ou leia o código de barras"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/40"
      />

      <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
        Funciona com leitor USB conectado ao teclado ou com câmera do notebook/celular.
      </div>

      {(cameraEnabled || cameraStarting || cameraMessage) && (
        <div className="mt-3 max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="grid gap-3 sm:grid-cols-[200px,1fr] sm:items-start">
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
                  "Aponte a câmera para o código. Quando a leitura ocorrer, o EAN/GTIN será preenchido automaticamente."}
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

      {error ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-300">{error}</span> : null}
    </div>
  );
}
