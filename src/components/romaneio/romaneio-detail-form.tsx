"use client";

import { useState } from "react";
import { FileDown, Info } from "lucide-react";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";

const DOCK_OPTIONS = ["DOCA-01", "DOCA-02", "DOCA-03"];

const fieldClassName =
  "h-[52px] w-full rounded-2xl border px-4 text-sm outline-none transition";
const fieldStyle = {
  background: "var(--romaneio-input-bg)",
  borderColor: "var(--romaneio-border)",
  color: "var(--romaneio-text)",
};

type RomaneioDetailFormProps = {
  romaneioId: string;
  carrierName: string;
  transportadoraId: string;
  driverName: string;
  driverDocument: string;
  vehicleModel: string;
  vehiclePlate: string;
  dock: string;
  expectedPickup: string;
  notes: string;
  transportadoraOptions: FancySelectOption[];
  pdfHref: string;
  saveAction: (formData: FormData) => void | Promise<void>;
};

function looksLikeJsonNotes(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed !== null && typeof parsed === "object";
  } catch {
    return false;
  }
}

export function RomaneioDetailForm({
  romaneioId,
  carrierName,
  transportadoraId,
  driverName,
  driverDocument,
  vehicleModel,
  vehiclePlate,
  dock,
  expectedPickup,
  notes,
  transportadoraOptions,
  pdfHref,
  saveAction,
}: RomaneioDetailFormProps) {
  const [selectedTransportadoraId, setSelectedTransportadoraId] = useState(transportadoraId);
  const [selectedDock, setSelectedDock] = useState(dock || DOCK_OPTIONS[0]);
  // O fechamento via app mobile (dupla checagem) grava JSON neste mesmo
  // campo (fotos, conferido_por/em) -- nunca mostrar isso cru num textarea
  // editável, nem deixar um "Salvar" sem querer sobrescrever com null.
  // Enquanto for JSON, o valor original viaja intacto num input hidden.
  const notesIsJson = looksLikeJsonNotes(notes);
  const [observacoes, setObservacoes] = useState(notesIsJson ? "" : notes);

  return (
    <form action={saveAction} className="mt-6 space-y-4">
      <input type="hidden" name="romaneioId" value={romaneioId} />

      <FancySelectInput
        label="Transportadora cadastrada"
        name="transportadoraId"
        value={selectedTransportadoraId}
        onChange={setSelectedTransportadoraId}
        options={transportadoraOptions}
      />

      <label className="space-y-1.5">
        <span className="text-sm font-medium" style={{ color: "var(--romaneio-text-sub)" }}>
          Nome exibido da transportadora
        </span>
        <input type="text" name="transportadoraNome" defaultValue={carrierName} className={fieldClassName} style={fieldStyle} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Motorista" name="motoristaNome" defaultValue={driverName} />
        <TextField label="Documento do motorista" name="motoristaDocumento" defaultValue={driverDocument} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <TextField label="Modelo do veículo" name="veiculoModelo" defaultValue={vehicleModel} />
        <TextField label="Placa do veículo" name="veiculoPlaca" defaultValue={vehiclePlate} />
        <label className="space-y-1.5">
          <span className="text-sm font-medium" style={{ color: "var(--romaneio-text-sub)" }}>
            Doca
          </span>
          <select
            name="doca"
            value={selectedDock}
            onChange={(event) => setSelectedDock(event.target.value)}
            className={fieldClassName}
            style={fieldStyle}
          >
            {DOCK_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Coleta prevista" name="coletaPrevista" defaultValue={expectedPickup} />
      </div>

      {notesIsJson ? (
        <div
          className="flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.1)", color: "#3B82F6" }}
        >
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Este romaneio foi fechado via app mobile com conferência dupla (fotos de motorista/operador). Os dados
            dessa conferência ficam guardados aqui e não são exibidos como texto — salvar este formulário não os
            apaga, a menos que você digite uma nova observação abaixo.
          </span>
        </div>
      ) : null}

      <label className="space-y-1.5">
        <span className="text-sm font-medium" style={{ color: "var(--romaneio-text-sub)" }}>
          Observações
        </span>
        <textarea
          name="observacoes"
          rows={4}
          value={observacoes}
          onChange={(event) => setObservacoes(event.target.value)}
          placeholder={notesIsJson ? "Digite para substituir o registro de conferência acima" : undefined}
          className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
          style={fieldStyle}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-xl border-none text-white text-sm font-bold"
          style={{ background: "linear-gradient(92deg,#3B82F6,#8B5CF6)" }}
        >
          Salvar romaneio
        </button>
        <a
          href={pdfHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium"
          style={{ borderColor: "var(--romaneio-border)", color: "var(--romaneio-text)" }}
        >
          <FileDown className="h-4 w-4" />
          Emitir PDF
        </a>
      </div>
    </form>
  );
}

function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium" style={{ color: "var(--romaneio-text-sub)" }}>
        {label}
      </span>
      <input type="text" name={name} defaultValue={defaultValue} className={fieldClassName} style={fieldStyle} />
    </label>
  );
}
