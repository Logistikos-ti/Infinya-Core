"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { FancySelectInput, type FancySelectOption } from "@/components/ui/fancy-select-input";

type RomaneioDetailFormProps = {
  romaneioId: string;
  carrierName: string;
  transportadoraId: string;
  driverName: string;
  driverDocument: string;
  vehicleModel: string;
  vehiclePlate: string;
  notes: string;
  transportadoraOptions: FancySelectOption[];
  pdfHref: string;
  saveAction: (formData: FormData) => void | Promise<void>;
};

export function RomaneioDetailForm({
  romaneioId,
  carrierName,
  transportadoraId,
  driverName,
  driverDocument,
  vehicleModel,
  vehiclePlate,
  notes,
  transportadoraOptions,
  pdfHref,
  saveAction,
}: RomaneioDetailFormProps) {
  const [selectedTransportadoraId, setSelectedTransportadoraId] = useState(transportadoraId);

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
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Nome exibido da transportadora
        </span>
        <input
          type="text"
          name="transportadoraNome"
          defaultValue={carrierName}
          className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus:ring-cyan-900/40"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Motorista" name="motoristaNome" defaultValue={driverName} />
        <TextField
          label="Documento do motorista"
          name="motoristaDocumento"
          defaultValue={driverDocument}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Modelo do veículo" name="veiculoModelo" defaultValue={vehicleModel} />
        <TextField label="Placa do veículo" name="veiculoPlaca" defaultValue={vehiclePlate} />
      </div>

      <label className="space-y-1.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Observações</span>
        <textarea
          name="observacoes"
          rows={4}
          defaultValue={notes}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus:ring-cyan-900/40"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          Salvar romaneio
        </button>
        <a
          href={pdfHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition hover:border-cyan-300 hover:shadow-[0_12px_35px_rgba(34,211,238,0.10)] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-400/40 dark:hover:shadow-[0_12px_35px_rgba(34,211,238,0.12)] dark:focus:ring-cyan-900/40"
      />
    </label>
  );
}
