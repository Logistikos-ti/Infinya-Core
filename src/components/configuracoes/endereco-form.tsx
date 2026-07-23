"use client";

import { useRef, useState } from "react";
import { Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FancySelectInput,
  type FancySelectOption,
} from "@/components/ui/fancy-select-input";

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
  const [area, setÁrea] = useState(defaultValues?.area ?? "PULMAO");
  const [unidadePadrao, setUnidadePadrao] = useState(
    defaultValues?.unidadePadrao ?? "",
  );

  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="id" value={defaultValues?.id ?? ""} />

      <div className="grid gap-4 md:grid-cols-2">
        <BarcodeField
          value={codigo}
          onChange={setCodigo}
          inputRef={codigoInputRef}
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
          onChange={setÁrea}
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
        <Field
          label="Corredor"
          name="rua"
          defaultValue={defaultValues?.rua ?? ""}
          placeholder="R01"
        />
        <Field
          label="Módulo"
          name="modulo"
          defaultValue={defaultValues?.modulo ?? ""}
          placeholder="M01"
        />
        <Field
          label="Nível"
          name="nivel"
          defaultValue={defaultValues?.nivel ?? ""}
          placeholder="N01"
        />
        <Field
          label="Posição"
          name="posicao"
          defaultValue={defaultValues?.posicao ?? ""}
          placeholder="P01"
        />
      </div>

      <Field
        label="Capacidade máxima"
        name="capacidadeMaxima"
        defaultValue={defaultValues?.capacidadeMaxima ?? ""}
        placeholder="Ex.: 120"
      />

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={defaultValues?.ativo ?? true}
          className="h-4 w-4 rounded accent-cyan-500"
        />
        Endereço ativo para operação
      </label>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          size="lg"
          className="rounded-xl px-5 shadow-[0_8px_24px_rgba(34,211,238,0.18)]"
        >
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
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-white/[0.07]"
      />
    </label>
  );
}

function BarcodeField({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [barcodeGenerated, setBarcodeGenerated] = useState(
    Boolean(value.trim()),
  );

  function updateCode(nextValue: string) {
    setBarcodeGenerated(false);
    onChange(nextValue);
  }

  return (
    <div className="block md:col-span-1">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Código
      </span>

      <input
        ref={inputRef}
        type="text"
        name="codigo"
        required
        value={value}
        onChange={(event) => updateCode(event.target.value.toUpperCase())}
        placeholder="Ex.: PICK-01-A"
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-white/[0.07]"
      />

      <button
        type="button"
        onClick={() => setBarcodeGenerated(Boolean(value.trim()))}
        disabled={!value.trim()}
        className="mt-2 inline-flex h-9 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 text-xs font-bold text-cyan-700 transition hover:border-cyan-400 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/15"
      >
        <Barcode className="h-4 w-4" />
        Gerar código de barras
      </button>

      {barcodeGenerated && value.trim() ? (
        <AddressBarcodePreview value={value.trim()} />
      ) : null}

      <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        Digite o código da posição ou use um leitor USB conectado ao teclado.
      </div>
    </div>
  );
}

const CODE128_PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

function code128BPattern(value: string) {
  const safeValue = Array.from(value)
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126)
    .join("");
  const values = Array.from(safeValue).map((char) => char.charCodeAt(0) - 32);
  const checksum =
    values.reduce((sum, item, index) => sum + item * (index + 1), 104) % 103;
  return [104, ...values, checksum, 106]
    .map((index) => CODE128_PATTERNS[index])
    .join("");
}

function AddressBarcodePreview({ value }: { value: string }) {
  const pattern = code128BPattern(value);
  let cursor = 8;
  const bars: Array<{ x: number; width: number }> = [];
  let black = true;

  for (const unit of pattern) {
    const width = Number(unit) * 2;
    if (black) bars.push({ x: cursor, width });
    cursor += width;
    black = !black;
  }

  const width = cursor + 8;
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950">
      <div className="mb-2 text-center font-mono text-sm font-bold tracking-wide text-slate-900 dark:text-white">
        {value}
      </div>
      <svg
        viewBox={`0 0 ${width} 76`}
        className="h-[76px] w-full"
        role="img"
        aria-label={`Código de barras do endereço ${value}`}
        preserveAspectRatio="none"
      >
        <rect width={width} height="76" fill="white" />
        {bars.map((bar, index) => (
          <rect
            key={`${bar.x}-${index}`}
            x={bar.x}
            y="4"
            width={bar.width}
            height="50"
            fill="black"
          />
        ))}
        <text
          x={width / 2}
          y="70"
          textAnchor="middle"
          fontSize="10"
          fontFamily="monospace"
          fill="black"
        >
          {value}
        </text>
      </svg>
    </div>
  );
}
