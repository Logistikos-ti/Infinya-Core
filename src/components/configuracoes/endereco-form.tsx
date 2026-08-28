"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ChevronLeft, Printer, Trash2 } from "lucide-react";
import { saveEnderecoStateAction } from "@/app/(dashboard)/configuracoes/enderecos/actions";
import { FIN_HEADING } from "@/components/financeiro/fin-ui";
import { MobileButtonSpinner } from "@/components/mobile/mobile-kit-tokens";

const tokenBorder = "border-[rgba(100,116,139,0.16)] dark:border-[rgba(148,163,184,0.14)]";
const tokenInputBg = "bg-[#F8FAFC] dark:bg-[#0E1728]";
const tokenCardBg = "bg-white dark:bg-[#101B30]";
const tokenText = "text-[#0F172A] dark:text-[#F1F5F9]";
const tokenTextSub = "text-[#64748B] dark:text-[#8695AD]";
const monoFont = "font-[family-name:var(--font-space-grotesk)]";
const cardClass = `rounded-2xl border ${tokenBorder} ${tokenCardBg} p-6`;
const inputClass = `h-[46px] w-full rounded-[11px] border px-[15px] text-sm outline-none transition ${tokenBorder} ${tokenInputBg} ${tokenText}`;

type EnderecoFormProps = {
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
    capacidadePesoKg?: string;
    volumeModo?: string;
    alturaCm?: string;
    larguraCm?: string;
    comprimentoCm?: string;
    ativo?: boolean;
  };
  onClose?: () => void;
  onDelete?: () => void;
};

const palletPresets: Array<{
  label: string;
  largura: string;
  comprimento: string;
  altura?: string;
}> = [
  { label: "PBR 1,00×1,20 m", largura: "100", comprimento: "120" },
  { label: "Europeu 0,80×1,20 m", largura: "80", comprimento: "120" },
  { label: "Chep 1,00×1,20 m", largura: "100", comprimento: "120" },
  { label: "1×1×1 m (1 m³)", largura: "100", comprimento: "100", altura: "100" },
];

const areaOptions: Array<{ value: string; label: string }> = [
  { value: "RECEBIMENTO", label: "Recebimento" },
  { value: "PULMAO", label: "Armazenagem" },
  { value: "PICKING", label: "Picking" },
  { value: "EXPEDICAO", label: "Expedição" },
  { value: "BLOQUEADO", label: "Bloqueado" },
];

const unidadeOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Não definida" },
  { value: "UNIDADE", label: "Unidade" },
  { value: "CAIXA", label: "Caixa" },
  { value: "PALLET", label: "Pallet" },
];

export function EnderecoForm({ defaultValues, onClose, onDelete }: EnderecoFormProps) {
  const isEdit = Boolean(defaultValues?.id);
  const [codigo, setCodigo] = useState(defaultValues?.codigo ?? "");
  const [area, setArea] = useState(defaultValues?.area ?? "PICKING");
  const [unidadePadrao, setUnidadePadrao] = useState(defaultValues?.unidadePadrao ?? "");
  const [volumeModo, setVolumeModo] = useState(defaultValues?.volumeModo ?? "");
  const [alturaCm, setAlturaCm] = useState(defaultValues?.alturaCm ?? "");
  const [larguraCm, setLarguraCm] = useState(defaultValues?.larguraCm ?? "");
  const [comprimentoCm, setComprimentoCm] = useState(defaultValues?.comprimentoCm ?? "");
  const [nPallets, setNPallets] = useState(defaultValues?.capacidadeMaxima ?? "");
  const [state, formAction, isPending] = useActionState(saveEnderecoStateAction, {
    success: false,
    message: null,
  });

  useEffect(() => {
    if (state.success && onClose) onClose();
  }, [state.success, onClose]);

  async function printEtiqueta() {
    const code = codigo.trim();
    if (!code) return;
    const svg = document.getElementById("barcode-form-preview")?.querySelector("svg");
    const barcode = svg ? new XMLSerializer().serializeToString(svg) : "";

    let logoMarkup = "";
    try {
      const res = await fetch("/branding/infinoos-icon-wms.svg");
      if (res.ok) {
        const svgText = await res.text();
        logoMarkup = `<div class="logo">${svgText}</div>`;
      }
    } catch {
      logoMarkup = "";
    }

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;
    const styles = `
      @page { size: 100mm 150mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, sans-serif; }
      .label { position: relative; width: 100mm; height: 150mm; page-break-after: always; padding: 8mm 6mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; }
      .ticket { width: 100%; padding: 3mm 3mm 2mm; border: .35mm solid #dbe3ef; border-radius: 4mm; background: #fff; }
      .label-head { position: relative; width: 100%; height: 10mm; display: flex; align-items: center; justify-content: center; }
      .logo { position: absolute; top: 0; left: 0; width: 7mm; height: 7mm; filter: grayscale(1); }
      .logo svg { width: 100%; height: 100%; object-fit: contain; }
      .address { font-family: monospace; font-size: 14pt; font-weight: 800; line-height: 1.1; letter-spacing: .04em; word-break: break-word; }
      .barcode { width: 86mm; margin-top: 1mm; }
      .barcode svg { display: block; width: 86mm; height: 30mm; }
    `;
    const label = `
      <section class="label">
        <div class="ticket">
          <div class="label-head">${logoMarkup}<div class="address">${code}</div></div>
          <div class="barcode">${barcode}</div>
        </div>
      </section>
    `;
    printWindow.document.write(
      `<!doctype html><html><head><title>Etiqueta ${code}</title><style>${styles}</style></head><body>${label}</body></html>`,
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  return (
    <form
      action={formAction}
      className="fixed inset-0 z-50 flex h-full flex-col bg-[#F5F7FB] dark:bg-[#0A1120]"
      style={{ fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
    >
      <header
        className={`flex h-[68px] shrink-0 items-center gap-3.5 border-b bg-white px-[28px] dark:bg-[#0C1424] ${tokenBorder}`}
      >
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Voltar"
            className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] ${tokenText}`} />
          </button>
        ) : (
          <Link
            href="/configuracoes/enderecos"
            title="Voltar"
            className={`group flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg}`}
          >
            <ChevronLeft className={`h-5 w-5 transition-colors group-hover:text-[#8B5CF6] ${tokenText}`} />
          </Link>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <div className={`flex items-center gap-2 text-[12.5px] ${tokenTextSub}`}>
            <span>Configurações</span>
            <span>›</span>
            <span>Endereços</span>
            <span>›</span>
            <span className={`font-semibold ${tokenText}`}>{isEdit ? codigo || "Editar" : "Novo"}</span>
          </div>
          <span className={`${FIN_HEADING} truncate text-[18px] font-bold ${tokenText}`}>
            {isEdit ? "Editar endereço" : "Novo endereço"}
          </span>
        </div>
        {isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-11 shrink-0 items-center gap-2 rounded-[11px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 text-sm font-bold text-[#EF4444] transition-colors hover:bg-[rgba(239,68,68,0.16)]"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={`flex h-11 shrink-0 items-center rounded-[11px] border px-[18px] text-sm font-bold transition hover:border-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isPending}
          className="flex h-11 shrink-0 items-center gap-2 rounded-[11px] px-[22px] text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,0.32)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: "linear-gradient(92deg, #3B82F6, #8B5CF6)" }}
        >
          {isPending ? <MobileButtonSpinner /> : isEdit ? "Salvar alterações" : "Salvar endereço"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-7 sm:px-8 lg:pb-12">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-[18px]">
          <input type="hidden" name="id" value={defaultValues?.id ?? ""} />
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="unidadePadrao" value={unidadePadrao} />
          <input type="hidden" name="volumeModo" value={volumeModo} />

          <section className={cardClass}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Identificação</span>
            <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-[7px]">
                <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>Código</span>
                <input
                  type="text"
                  name="codigo"
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ex.: PICK-01-A"
                  className={`${inputClass} ${monoFont}`}
                />
              </div>
              <FormField
                label="Descrição"
                name="descricao"
                defaultValue={defaultValues?.descricao ?? ""}
                placeholder="Descrição operacional da posição"
              />
            </div>
            {codigo.trim() ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="w-full max-w-[340px]">
                  <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>Etiqueta</span>
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/branding/infinoos-icon-wms.svg"
                      alt="Infinoos WMS"
                      className="pointer-events-none absolute left-5 top-2 z-10 h-8 w-8 object-contain grayscale"
                    />
                    <AddressBarcodePreview value={codigo.trim()} containerId="barcode-form-preview" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={printEtiqueta}
                  className={`inline-flex h-10 items-center gap-2 rounded-[11px] border px-4 text-[13px] font-bold transition hover:border-[#8B5CF6] hover:text-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenText}`}
                >
                  <Printer className="h-[15px] w-[15px]" />
                  Imprimir etiqueta
                </button>
              </div>
            ) : null}
          </section>

          <section className={cardClass}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Localização física</span>
            <div className="mt-[18px] grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <FormField label="Corredor" name="rua" defaultValue={defaultValues?.rua ?? ""} placeholder="R01" mono />
              <FormField label="Módulo" name="modulo" defaultValue={defaultValues?.modulo ?? ""} placeholder="M01" mono />
              <FormField label="Nível" name="nivel" defaultValue={defaultValues?.nivel ?? ""} placeholder="N01" mono />
              <FormField label="Posição" name="posicao" defaultValue={defaultValues?.posicao ?? ""} placeholder="P01" mono />
            </div>
          </section>

          <section className={`${cardClass} flex flex-col gap-4`}>
            <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>Classificação</span>
            <div className="flex flex-col gap-2.5">
              <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>Área</span>
              <div className="flex flex-wrap gap-2">
                {areaOptions.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={area === opt.value} onClick={() => setArea(opt.value)} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>Unidade padrão</span>
              <div className="flex flex-wrap gap-2">
                {unidadeOptions.map((opt) => (
                  <Chip
                    key={opt.value || "none"}
                    label={opt.label}
                    active={unidadePadrao === opt.value}
                    onClick={() => setUnidadePadrao(opt.value)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className={`${cardClass} flex flex-col gap-4`}>
            <div className="flex flex-col gap-1">
              <span className={`${FIN_HEADING} text-base font-bold ${tokenText}`}>
                Volume da posição
              </span>
              <span className={`text-[13px] ${tokenTextSub}`}>
                Capacidade de peso e metragem. A ocupação é a média das capacidades preenchidas
                (peso e volume dos produtos).
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <FormField
                label="Capacidade de peso (kg)"
                name="capacidadePesoKg"
                defaultValue={defaultValues?.capacidadePesoKg ?? ""}
                placeholder="Ex.: 800"
                mono
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>Medir volume por</span>
              <div className="flex flex-wrap gap-2">
                <Chip
                  label="Dimensões do endereço"
                  active={volumeModo === "DIMENSOES"}
                  onClick={() => setVolumeModo(volumeModo === "DIMENSOES" ? "" : "DIMENSOES")}
                />
                <Chip
                  label="Tamanho do pallet"
                  active={volumeModo === "PALLET"}
                  onClick={() => setVolumeModo(volumeModo === "PALLET" ? "" : "PALLET")}
                />
              </div>
            </div>

            {volumeModo ? (
              <>
                {volumeModo === "PALLET" ? (
                  <div className="flex flex-col gap-2">
                    <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>
                      Padrões comuns de pallet
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {palletPresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setLarguraCm(preset.largura);
                            setComprimentoCm(preset.comprimento);
                            if (preset.altura) setAlturaCm(preset.altura);
                          }}
                          className={`inline-flex h-9 items-center rounded-[10px] border px-3.5 text-[12.5px] font-bold transition hover:border-[#8B5CF6] hover:text-[#8B5CF6] ${tokenBorder} ${tokenInputBg} ${tokenTextSub}`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  <ControlledField
                    label="Altura (cm)"
                    name="alturaCm"
                    value={alturaCm}
                    onChange={setAlturaCm}
                    placeholder="Ex.: 150"
                  />
                  <ControlledField
                    label="Largura (cm)"
                    name="larguraCm"
                    value={larguraCm}
                    onChange={setLarguraCm}
                    placeholder="Ex.: 100"
                  />
                  <ControlledField
                    label="Comprimento (cm)"
                    name="comprimentoCm"
                    value={comprimentoCm}
                    onChange={setComprimentoCm}
                    placeholder="Ex.: 120"
                  />
                </div>
                {volumeModo === "PALLET" ? (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <ControlledField
                      label="Nº de pallets na posição"
                      name="capacidadeMaxima"
                      value={nPallets}
                      onChange={setNPallets}
                      placeholder="Ex.: 4"
                    />
                  </div>
                ) : null}
                <p className={`text-xs leading-[1.5] ${tokenTextSub}`}>
                  {volumeModo === "PALLET"
                    ? "Informe as dimensões de 1 pallet e quantos pallets cabem. Volume da posição = volume do pallet × nº de pallets."
                    : "Informe as dimensões internas da posição. Volume = Altura × Largura × Comprimento."}
                </p>
              </>
            ) : null}
          </section>

          <label
            className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${tokenBorder} ${tokenCardBg}`}
          >
            <span className="flex flex-col gap-1">
              <span className={`text-sm font-bold ${tokenText}`}>Endereço ativo para operação</span>
              <span className={`text-xs leading-[1.4] ${tokenTextSub}`}>
                Posições inativas ficam bloqueadas para novos recebimentos e separações.
              </span>
            </span>
            <span className="relative inline-flex h-[26px] w-[46px] shrink-0 items-center">
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={defaultValues?.ativo ?? true}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-[rgba(100,116,139,0.3)] transition-colors peer-checked:bg-[#10B981] dark:bg-[rgba(148,163,184,0.25)]" />
              <span className="absolute left-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform peer-checked:translate-x-5" />
            </span>
          </label>

          {state.message && !state.success ? (
            <div className="rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#EF4444]">
              {state.message}
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  placeholder,
  mono,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`${inputClass} ${mono ? monoFont : ""}`}
      />
    </div>
  );
}

function ControlledField({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className={`text-[12.5px] font-bold ${tokenTextSub}`}>{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} ${monoFont}`}
      />
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center transition"
      style={{
        height: "40px",
        padding: "0 16px",
        borderRadius: "10px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        border: active ? "1.5px solid #8B5CF6" : "1.5px solid rgba(100,116,139,0.16)",
        background: active ? "rgba(139,92,246,0.12)" : "transparent",
        color: active ? "#8B5CF6" : "#64748B",
      }}
    >
      {label}
    </button>
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

// Gera a string SVG do código de barras (CODE128) de um endereço, para uso
// fora do React (ex.: janela de impressão de etiquetas em lote).
export function addressBarcodeSvgMarkup(value: string): string {
  const pattern = code128BPattern(value);
  let cursor = 8;
  const bars: Array<{ x: number; width: number }> = [];
  let black = true;
  for (const unit of pattern) {
    const w = Number(unit) * 2;
    if (black) bars.push({ x: cursor, width: w });
    cursor += w;
    black = !black;
  }
  const width = cursor + 8;
  const rects = bars
    .map((bar) => `<rect x="${bar.x}" y="4" width="${bar.width}" height="50" fill="black" />`)
    .join("");
  return `<svg viewBox="0 0 ${width} 76" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="76" fill="white" />${rects}<text x="${width / 2}" y="70" text-anchor="middle" font-size="10" font-family="monospace" fill="black">${value}</text></svg>`;
}

export function AddressBarcodePreview({ value, containerId, showValue = true }: { value: string; containerId?: string; showValue?: boolean }) {
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
    <div id={containerId} className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950">
      {showValue ? <div className="mb-2 text-center font-mono text-sm font-bold tracking-wide text-slate-900 dark:text-white">
        {value}
      </div> : null}
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
