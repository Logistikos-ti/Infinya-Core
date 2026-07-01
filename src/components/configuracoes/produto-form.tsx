"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { Barcode, Camera, CameraOff } from "lucide-react";
import { saveProdutoAction } from "@/app/(dashboard)/configuracoes/produtos/actions";
import { Button } from "@/components/ui/button";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";

type DepositanteOption = {
  id: string;
  nome: string;
};

type ProdutoFormProps = {
  depositantes: DepositanteOption[];
  defaultValues?: {
    id?: string;
    depositanteId?: string;
    codigoInterno?: string;
    sku?: string;
    nome?: string;
    eanGtin?: string;
    categoria?: string;
    metodoRetirada?: "FEFO" | "FIFO" | "LIFO";
    unidadeEstocagem?: "UNIDADE" | "CAIXA" | "PALLET";
    exigeLote?: boolean;
    exigeValidade?: boolean;
    ativo?: boolean;
  };
};

export function ProdutoForm({ depositantes, defaultValues }: ProdutoFormProps) {
  const initialState = {
    success: false,
    message: null,
  };

  const [state, formAction, isPending] = useActionState(saveProdutoAction, initialState);
  const [eanGtinValue, setEanGtinValue] = useState(defaultValues?.eanGtin ?? "");
  const eanInputRef = useRef<HTMLInputElement | null>(null);

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
          Cadastro de SKU com depositante, EAN/GTIN, categoria, método de retirada e unidade de
          estocagem.
        </p>
      </div>

      <input type="hidden" name="id" value={defaultValues?.id ?? ""} />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Depositante"
          name="depositanteId"
          defaultValue={defaultValues?.depositanteId ?? ""}
          error={state.errors?.depositanteId}
          options={[
            { value: "", label: "Selecione um depositante" },
            ...depositantes.map((item) => ({ value: item.id, label: item.nome })),
          ]}
        />
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
        <Field
          label="Categoria"
          name="categoria"
          defaultValue={defaultValues?.categoria ?? ""}
          error={state.errors?.categoria}
        />
        <SelectField
          label="Método de retirada"
          name="metodoRetirada"
          defaultValue={defaultValues?.metodoRetirada ?? "FEFO"}
          error={state.errors?.metodoRetirada}
          options={[
            { value: "FEFO", label: "FEFO" },
            { value: "FIFO", label: "FIFO" },
            { value: "LIFO", label: "LIFO" },
          ]}
        />
        <SelectField
          label="Unidade de estocagem"
          name="unidadeEstocagem"
          defaultValue={defaultValues?.unidadeEstocagem ?? "UNIDADE"}
          error={state.errors?.unidadeEstocagem}
          options={[
            { value: "UNIDADE", label: "Unidade" },
            { value: "CAIXA", label: "Caixa" },
            { value: "PALLET", label: "Pallet" },
          ]}
        />
      </div>

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

type FieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value?: string;
  onChange?: (value: string) => void;
};

function Field({ label, name, defaultValue, error, inputRef, value, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        ref={inputRef ?? undefined}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/40"
      />
      {error ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-300">{error}</span> : null}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  options: { value: string; label: string }[];
};

function SelectField({ label, name, defaultValue, error, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/40"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-2 block text-xs text-rose-600 dark:text-rose-300">{error}</span> : null}
    </label>
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
            {cameraEnabled ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
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
