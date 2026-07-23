"use client";

import { Check, FileText, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DatePickerInput } from "@/components/ui/date-picker-input";

type ReceivingItem = {
  id: string;
  code: string;
  supplier: string | null;
  volumeCount: number | null;
  eta: string | null;
  status: string;
};

type ReceivingViewClientProps = {
  receiving: ReceivingItem[];
};

const inputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-white/10";

export function ReceivingViewClient({ receiving }: ReceivingViewClientProps) {
  const [open, setOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [xmlName, setXmlName] = useState("");
  const [type, setType] = useState("NF-e XML");
  const [form, setForm] = useState({
    supplier: "",
    nf: "",
    eta: "",
    hour: "",
    volumes: "",
    notes: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function openDrawer() {
    setError("");
    setOpen(true);
    requestAnimationFrame(() => setDrawerVisible(true));
  }

  function closeDrawer() {
    setDrawerVisible(false);
    window.setTimeout(() => setOpen(false), 220);
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectXml(file?: File) {
    if (!file) return;
    setXmlName(file.name);
  }

  async function submitRequest() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/portal/recebimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type, xmlName }),
      });
      const responseText = await response.text();
      let payload: { error?: string } = {};
      try {
        payload = responseText
          ? (JSON.parse(responseText) as { error?: string })
          : {};
      } catch {
        payload = { error: responseText.replace(/<[^>]*>/g, "").trim() };
      }
      if (!response.ok) {
        throw new Error(
          payload.error ||
            `Não foi possível enviar a solicitação (HTTP ${response.status}).`,
        );
      }
      closeDrawer();
      setForm({
        supplier: "",
        nf: "",
        eta: "",
        hour: "",
        volumes: "",
        notes: "",
      });
      setXmlName("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar a solicitação.",
      );
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    agendado: receiving.filter((item) => item.status === "Agendado").length,
    recebimento: receiving.filter((item) => item.status === "Em recebimento")
      .length,
    conferido: receiving.filter((item) => item.status === "Conferido").length,
    divergencia: receiving.filter((item) => item.status === "Divergência")
      .length,
  };

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="font-display text-[27px] font-bold tracking-tight text-slate-950 dark:text-white">
            Recebimento
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Agende entradas de mercadoria e acompanhe o recebimento no CD.
          </p>
        </div>
        <button
          type="button"
          onClick={openDrawer}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5"
        >
          <span className="text-lg leading-none">+</span>
          Nova solicitação
        </button>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniKpi
          label="Agendados"
          value={counts.agendado}
          color="bg-violet-500"
        />
        <MiniKpi
          label="Em recebimento"
          value={counts.recebimento}
          color="bg-blue-500"
        />
        <MiniKpi
          label="Conferidos"
          value={counts.conferido}
          color="bg-emerald-500"
        />
        <MiniKpi
          label="Divergências"
          value={counts.divergencia}
          color="bg-rose-500"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#101b30]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/5">
              <tr>
                {[
                  "Solicitação",
                  "Fornecedor",
                  "Volumes",
                  "Previsão",
                  "Status",
                ].map((label) => (
                  <th key={label} className="px-5 py-3 font-bold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receiving.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-100 text-sm dark:border-white/10"
                >
                  <td className="px-5 py-4 font-bold">{item.code}</td>
                  <td className="px-5 py-4">{item.supplier ?? "A definir"}</td>
                  <td className="px-5 py-4">{item.volumeCount ?? 0}</td>
                  <td className="px-5 py-4">{item.eta ?? "A definir"}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-300">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!receiving.length ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma solicitação nesse filtro.
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-200 ${drawerVisible ? "opacity-100" : "opacity-0"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Nova solicitação de recebimento"
        >
          <button
            type="button"
            aria-label="Fechar nova solicitação"
            onClick={closeDrawer}
            className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[3px]"
          />
          <aside
            className={`relative flex h-full w-[560px] max-w-[96vw] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out dark:border-white/10 dark:bg-[#0c1526] ${drawerVisible ? "translate-x-0" : "translate-x-full"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden border-b border-slate-200 px-6 py-6 dark:border-white/10">
              <div className="pointer-events-none absolute -right-20 -top-28 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.28),transparent_70%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    SOLICITAÇÃO DE RECEBIMENTO
                  </span>
                  <h3 className="font-display text-2xl font-bold leading-none text-slate-950 dark:text-white">
                    Agendar entrada no CD
                  </h3>
                  <p className="text-[13px] text-slate-500 dark:text-slate-400">
                    Informe a nota e anexe o XML para agilizar a conferência.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:text-violet-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed p-5 text-left transition hover:border-violet-500 ${xmlName ? "border-emerald-500 bg-emerald-500/10" : "border-slate-300 bg-slate-50 dark:border-white/20 dark:bg-white/5"}`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${xmlName ? "bg-emerald-500/15 text-emerald-500" : "bg-blue-500/15 text-blue-500"}`}
                >
                  {xmlName ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {xmlName || "Importar XML da NF-e"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {xmlName
                      ? "Fornecedor e itens preenchidos automaticamente"
                      : "Arraste o arquivo ou clique para selecionar"}
                  </span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                className="hidden"
                onChange={(event) => selectXml(event.target.files?.[0])}
              />

              <section className="space-y-3.5">
                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                  Dados da nota
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
                  <label className="space-y-1.5 text-xs text-slate-500">
                    Transportadora
                    <input
                      className={inputClassName}
                      value={form.supplier}
                      onChange={(event) =>
                        updateField("supplier", event.target.value)
                      }
                      placeholder="Ex.: Transportes Rodoline"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs text-slate-500">
                    Nº da NF-e
                    <input
                      className={inputClassName}
                      value={form.nf}
                      onChange={(event) =>
                        updateField("nf", event.target.value)
                      }
                      placeholder="000000"
                    />
                  </label>
                  <DatePickerInput
                    label="Data prevista"
                    name="dataPrevista"
                    value={form.eta}
                    onChange={(value) => updateField("eta", value)}
                    compact
                  />
                  <label className="space-y-1.5 text-xs text-slate-500">
                    Horário previsto
                    <input
                      type="time"
                      className={inputClassName}
                      value={form.hour}
                      onChange={(event) =>
                        updateField("hour", event.target.value)
                      }
                    />
                  </label>
                  <label className="space-y-1.5 text-xs text-slate-500 sm:col-span-2">
                    Qtd. de volumes
                    <input
                      type="number"
                      min="1"
                      className={inputClassName}
                      value={form.volumes}
                      onChange={(event) =>
                        updateField("volumes", event.target.value)
                      }
                      placeholder="0"
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-2">
                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">
                  Tipo de recebimento
                </h4>
                <div className="flex flex-wrap gap-2">
                  {["NF-e XML", "Manual", "Transferência"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setType(item)}
                      className={`h-10 rounded-xl border-[1.5px] px-4 text-[13px] font-bold transition ${type === item ? "border-violet-500 bg-violet-500/10 text-slate-900 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <label className="block space-y-1.5 text-xs text-slate-500">
                Observações
                <textarea
                  className={`${inputClassName} min-h-20 resize-y py-3`}
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Ex.: entrega paletizada, agendar doca fria..."
                />
              </label>
              {error ? (
                <p className="rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-[#0c1526]">
              <div className="flex-1" />
              <button
                type="button"
                onClick={closeDrawer}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-800 transition hover:border-violet-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={saving}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="text-lg leading-none">⇢</span>
                {saving ? "Enviando..." : "Enviar solicitação"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function MiniKpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-[18px] dark:border-white/10 dark:bg-[#101b30]">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="font-display text-[26px] font-bold text-slate-950 dark:text-white">
          {value}
        </span>
      </div>
    </div>
  );
}
