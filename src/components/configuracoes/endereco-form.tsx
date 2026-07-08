"use client";

import { useCallback, useRef, useState } from "react";
import { Barcode, Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";
import { useCameraBarcodeScanner } from "@/hooks/use-camera-barcode-scanner";

type EnderecoFormProps = {
  action: (formData: FormData) => void;
  defaultValues?: {
    id?: string;
    codigo?: string;
    descricao?: string | null;
    area?: string;
    unidadePadrao?: string | null;
    rua?: string | null;
    modulo?: string | null;
    nivel?: string | null;
    posicao?: string | null;
    capacidadeMaxima?: string;
    ativo?: boolean;
  };
};

const areaOptions: FancySelectOption[] = [
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "EXPEDICAO", label: "Expedição" },
];

const unidadeOptions: FancySelectOption[] = [
  { value: "", label: "Não definida" },
  { value: "UNIDADE", label: "Unidade" },
  { value: "CAIXA", label: "Caixa" },
  { value: "PALLET", label: "Pallet" },
];

export function EnderecoForm({ action, defaultValues }: EnderecoFormProps) {
  const codigoInputRef = useRef<HTMLInputElement | null>(null);
  const [codigo, setCodigo] = useState(defaultValues?.codigo ?? "");
  const [area, setArea] = useState(defaultValues?.area ?? "PICKING");
  const [unidadePadrao, setUnidadePadrao] = useState(defaultValues?.unidadePadrao ?? "");

  const handleBarcodeDetected = useCallback((code: string) => {
    setCodigo(code.toUpperCase());
    requestAnimationFrame(() => {
      codigoInputRef.current?.focus();
      codigoInputRef.current?.select();
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
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="id" value={defaultValues?.id ?? ""} />

      <div className="grid gap-4 md:grid-cols-2">
        <BarcodeField
          value={codigo}
          onChange={setCodigo}
          inputRef={codigoInputRef}
          videoRef={videoRef}
          cameraSupported={cameraSupported}
          cameraEnabled={cameraEnabled}
          cameraStarting={cameraStarting}
          cameraMessage={cameraMessage}
          onToggleCamera={toggleCamera}
        />
        <Field
          label="Descrição"
          name="descricao"
          defaultValue={defaultValues?.descricao ?? ""}
          placeholder="Descrição operacional"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FancySelectInput
          label="Área"
          name="area"
          value={area}
          onChange={setArea}
          options={areaOptions}
        />
        <FancySelectInput
          label="Unidade padrão"
          name="unidadePadrao"
          value={unidadePadrao}
          onChange={setUnidadePadrao}
          options={unidadeOptions}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Corredor" name="rua" defaultValue={defaultValues?.rua ?? ""} placeholder="R01" />
        <Field label="Módulo" name="modulo" defaultValue={defaultValues?.modulo ?? ""} placeholder="M01" />
        <Field label="Nível" name="nivel" defaultValue={defaultValues?.nivel ?? ""} placeholder="N01" />
        <Field label="Posição" name="posicao" defaultValue={defaultValues?.posicao ?? ""} placeholder="P01" />
      </div>

      <Field
        label="Capacidade máxima"
        name="capacidadeMaxima"
        defaultValue={defaultValues?.capacidadeMaxima ?? ""}
        placeholder="Ex.: 120"
      />

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={defaultValues?.ativo ?? true}
          className="h-4 w-4 rounded"
        />
        Endereço ativo para operação
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="bg-slate-950 text-white hover:bg-slate-800">
          {defaultValues?.id ? "Salvar alterações" : "Criar endereço"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
      <span className="font-medium">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </label>
  );
}

function BarcodeField({
  value,
  onChange,
  inputRef,
  videoRef,
  cameraSupported,
  cameraEnabled,
  cameraStarting,
  cameraMessage,
  onToggleCamera,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraSupported: boolean;
  cameraEnabled: boolean;
  cameraStarting: boolean;
  cameraMessage: string | null;
  onToggleCamera: () => void;
}) {
  return (
    <div className="block md:col-span-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Código</span>
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
        type="text"
        name="codigo"
        required
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        placeholder="Ex.: PICK-01-A"
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none transition focus:border-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
        Funciona com leitor USB conectado ao teclado ou com câmera do notebook/celular.
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
                  "Aponte a câmera para um código de localização. Quando a leitura ocorrer, o campo será preenchido automaticamente."}
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
